import type { Prisma, StoreRemovalReason, StoreReportStatus, StoreStatus } from "../../../../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES, type AuditAction } from "@/lib/data/admin/adminAuditVocabulary";
import { writeAuditEntry } from "@/lib/data/admin/adminAuditMutations";

/**
 * Expected outcomes of a moderation mutation that are not bugs: the store or report no longer
 * exists, or the requested transition is not valid from the current status. Callers translate these
 * into a user-facing message; they must not be reported to Sentry.
 */
export type StoreModerationErrorCode = "storeNotFound" | "reportNotFound" | "invalidTransition";

export class StoreModerationError extends Error {
  readonly code: StoreModerationErrorCode;

  constructor(code: StoreModerationErrorCode, message?: string) {
    super(message ?? code);
    this.name = "StoreModerationError";
    this.code = code;
  }
}

export interface StoreModerationResult {
  id: string;
  slug: string;
  status: StoreStatus;
  /** Prior status before the transition, useful for analytics and unflag derivation. */
  previousStatus: StoreStatus;
}

/** Common shape: the store to act on plus the resolved admin actor id (never taken from the client). */
interface BaseModerationInput {
  storeId: string;
  actorId: string;
  /** Optional non-sensitive moderator note persisted on the audit entry only. */
  note?: string | null;
}

export interface RemoveStoreInput extends BaseModerationInput {
  removalReason: StoreRemovalReason;
}

const MODERATION_STORE_SELECT = {
  id: true,
  slug: true,
  status: true,
  approvedAt: true,
  approvedByUserId: true,
} satisfies Prisma.StoreSelect;

type ModerationStoreRow = Prisma.StoreGetPayload<{ select: typeof MODERATION_STORE_SELECT }>;

/**
 * Resolves a store by slug for the admin moderation layer, regardless of status or visibility (so a
 * `FLAGGED` store, which the public reads exclude by slug filter, still resolves). Admin-only:
 * callers must gate with `requireAdmin()` before invoking. Returns null when no store matches.
 */
export async function getModerationStoreBySlug(
  slug: string,
): Promise<{ id: string; slug: string; status: StoreStatus } | null> {
  return prisma.store.findUnique({
    where: { slug },
    select: { id: true, slug: true, status: true },
  });
}

async function loadStoreForModeration(tx: Prisma.TransactionClient, storeId: string): Promise<ModerationStoreRow> {
  const store = await tx.store.findUnique({
    where: { id: storeId },
    select: MODERATION_STORE_SELECT,
  });
  if (!store) {
    throw new StoreModerationError("storeNotFound");
  }
  return store;
}

/**
 * Applies one moderation transition and appends the matching audit entry inside a single
 * transaction, so no orphaned or missing audit rows are possible. The transition is validated
 * against the store's current status; an invalid transition throws {@link StoreModerationError}
 * before any write. The actor id must come from `requireAdmin()` at the action layer.
 */
async function runModerationTransition(params: {
  storeId: string;
  actorId: string;
  action: AuditAction;
  note?: string | null;
  resolve: (current: ModerationStoreRow) => { data: Prisma.StoreUpdateInput; nextStatus: StoreStatus };
}): Promise<StoreModerationResult> {
  return prisma.$transaction(async (tx) => {
    const current = await loadStoreForModeration(tx, params.storeId);
    const { data, nextStatus } = params.resolve(current);

    const updated = await tx.store.update({
      where: { id: current.id },
      data,
      select: { id: true, slug: true, status: true },
    });

    await writeAuditEntry(
      {
        actorId: params.actorId,
        action: params.action,
        targetType: AUDIT_TARGET_TYPES.STORE,
        targetId: current.id,
        reason: params.note ?? null,
      },
      tx,
    );

    return {
      id: updated.id,
      slug: updated.slug,
      status: nextStatus,
      previousStatus: current.status,
    };
  });
}

/** Approves a `PENDING` store, setting it `APPROVED` and stamping the approving admin and time. */
export async function approveStore(input: BaseModerationInput): Promise<StoreModerationResult> {
  return runModerationTransition({
    storeId: input.storeId,
    actorId: input.actorId,
    action: AUDIT_ACTIONS.STORE_APPROVE,
    note: input.note,
    resolve: (current) => {
      if (current.status !== "PENDING") {
        throw new StoreModerationError("invalidTransition");
      }
      return {
        nextStatus: "APPROVED",
        data: {
          status: "APPROVED",
          approvedByUser: { connect: { id: input.actorId } },
          approvedAt: new Date(),
        },
      };
    },
  });
}

/**
 * Removes (rejects) a `PENDING`, `APPROVED`, or `FLAGGED` store, persisting the `removalReason`.
 * Tombstone semantics: the row is retained so referencing records keep resolving; the store is
 * excluded from every public surface by `PUBLIC_VISIBLE_STORE_STATUSES`. The transition logic is
 * kept isolated so a future notification enqueue can run after the transaction commits.
 */
export async function removeStore(input: RemoveStoreInput): Promise<StoreModerationResult> {
  return runModerationTransition({
    storeId: input.storeId,
    actorId: input.actorId,
    action: AUDIT_ACTIONS.STORE_REMOVE,
    note: input.note,
    resolve: (current) => {
      if (current.status !== "PENDING" && current.status !== "APPROVED" && current.status !== "FLAGGED") {
        throw new StoreModerationError("invalidTransition");
      }
      return {
        nextStatus: "REJECTED",
        data: {
          status: "REJECTED",
          removalReason: input.removalReason,
        },
      };
    },
  });
}

/** Result of a report resolution transition, mirroring {@link StoreModerationResult} for stores. */
export interface StoreReportModerationResult {
  id: string;
  status: StoreReportStatus;
  /** Prior status before the transition, useful for analytics. */
  previousStatus: StoreReportStatus;
}

/** Shared shape for a report resolution: which report, the admin actor, and an optional note. */
interface ReportModerationInput {
  reportId: string;
  actorId: string;
  /** Optional non-sensitive moderator note persisted on the audit entry only. */
  note?: string | null;
}

/**
 * Moves an `OPEN` `StoreReport` to a resolved status and appends the matching audit entry inside a
 * single transaction, so no orphaned or missing audit rows are possible. A missing row throws
 * `reportNotFound`; a non-`OPEN` report throws `invalidTransition`, both before any write. The actor
 * id must come from `requireAdmin()` at the action layer, never from the client. Report resolution
 * accountability is audit-only (no reviewer columns on `StoreReport`): the actor and time live on
 * the `report.resolve` / `report.dismiss` audit entry.
 */
async function runReportResolution(params: {
  reportId: string;
  actorId: string;
  action: AuditAction;
  nextStatus: Extract<StoreReportStatus, "REVIEWED" | "DISMISSED">;
  note?: string | null;
}): Promise<StoreReportModerationResult> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.storeReport.findUnique({
      where: { id: params.reportId },
      select: { id: true, status: true },
    });
    if (!current) {
      throw new StoreModerationError("reportNotFound");
    }
    if (current.status !== "OPEN") {
      throw new StoreModerationError("invalidTransition");
    }

    const updated = await tx.storeReport.update({
      where: { id: current.id },
      data: { status: params.nextStatus },
      select: { id: true, status: true },
    });

    await writeAuditEntry(
      {
        actorId: params.actorId,
        action: params.action,
        targetType: AUDIT_TARGET_TYPES.REPORT,
        targetId: current.id,
        reason: params.note ?? null,
      },
      tx,
    );

    return {
      id: updated.id,
      status: updated.status,
      previousStatus: current.status,
    };
  });
}

/** Resolves an `OPEN` report (`OPEN` to `REVIEWED`); frees the reporter to file a new report. */
export async function resolveStoreReport(input: ReportModerationInput): Promise<StoreReportModerationResult> {
  return runReportResolution({
    reportId: input.reportId,
    actorId: input.actorId,
    action: AUDIT_ACTIONS.REPORT_RESOLVE,
    nextStatus: "REVIEWED",
    note: input.note,
  });
}

/** Dismisses an `OPEN` report (`OPEN` to `DISMISSED`); frees the reporter to file a new report. */
export async function dismissStoreReport(input: ReportModerationInput): Promise<StoreReportModerationResult> {
  return runReportResolution({
    reportId: input.reportId,
    actorId: input.actorId,
    action: AUDIT_ACTIONS.REPORT_DISMISS,
    nextStatus: "DISMISSED",
    note: input.note,
  });
}

/** Flags a `PENDING` or `APPROVED` store as `FLAGGED`; the store stays publicly visible. */
export async function flagStore(input: BaseModerationInput): Promise<StoreModerationResult> {
  return runModerationTransition({
    storeId: input.storeId,
    actorId: input.actorId,
    action: AUDIT_ACTIONS.STORE_FLAG,
    note: input.note,
    resolve: (current) => {
      if (current.status !== "PENDING" && current.status !== "APPROVED") {
        throw new StoreModerationError("invalidTransition");
      }
      return {
        nextStatus: "FLAGGED",
        data: { status: "FLAGGED" },
      };
    },
  });
}

/**
 * Removes the flag from a `FLAGGED` store, restoring its prior public state. The prior state is
 * derived from `approvedAt` / `approvedByUserId`: an approved store returns to `APPROVED`, an
 * unapproved one returns to `PENDING`. No dedicated column is needed to record the prior state.
 */
export async function unflagStore(input: BaseModerationInput): Promise<StoreModerationResult> {
  return runModerationTransition({
    storeId: input.storeId,
    actorId: input.actorId,
    action: AUDIT_ACTIONS.STORE_UNFLAG,
    note: input.note,
    resolve: (current) => {
      if (current.status !== "FLAGGED") {
        throw new StoreModerationError("invalidTransition");
      }
      const wasApproved = current.approvedAt != null || current.approvedByUserId != null;
      return {
        nextStatus: wasApproved ? "APPROVED" : "PENDING",
        data: { status: wasApproved ? "APPROVED" : "PENDING" },
      };
    },
  });
}
