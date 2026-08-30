import type { Prisma, StoreReportReason, SellerType } from "../../../../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeStoreName } from "@/lib/store/duplicateMatch";
import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from "@/lib/data/admin/adminAuditVocabulary";
import { writeAuditEntry } from "@/lib/data/admin/adminAuditMutations";
import {
  getEditableStoreForRebase,
  mergeEditableStoreWithChangeRequest,
  type EditableStore,
  type EditableStoreDiff,
  type EditableStoreInput,
} from "./storeGovernanceQueries";

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function normalizeNullableString(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeEditableStoreInput(input: EditableStoreInput, sellerType: SellerType): Required<EditableStoreInput> {
  // RETAILER and PROXY sellers keep contact channels; PERSON sellers do not expose them.
  const exposesContactInfo = sellerType !== "PERSON";
  // A PROXY is an intermediary with no catalog of its own: no categories, stock, or pre-order signal.
  const isProxy = sellerType === "PROXY";
  const normalizedContactChannels = exposesContactInfo
    ? (input.contactChannels ?? [])
        .map((channel) => ({
          type: channel.type,
          value: channel.value.trim(),
          label: normalizeNullableString(channel.label),
        }))
        .filter((channel) => channel.value.length > 0)
        .sort((left, right) => {
          const typeCompare = left.type.localeCompare(right.type);
          if (typeCompare !== 0) return typeCompare;
          return left.value.localeCompare(right.value);
        })
    : [];

  const normalizedAddresses = exposesContactInfo
    ? (input.addresses ?? [])
        .map((address) => ({
          city: normalizeNullableString(address.city),
          addressLine: address.addressLine.trim(),
          reference: normalizeNullableString(address.reference),
        }))
        .filter((address) => address.addressLine.length > 0)
        .sort((left, right) => {
          const cityCompare = (left.city ?? "").localeCompare(right.city ?? "");
          if (cityCompare !== 0) return cityCompare;
          return left.addressLine.localeCompare(right.addressLine);
        })
    : [];

  return {
    name: input.name.trim(),
    description: normalizeNullableString(input.description),
    logoUrl: exposesContactInfo ? normalizeNullableString(input.logoUrl) : null,
    presenceTypes: [...new Set(input.presenceTypes)].sort((left, right) => left.localeCompare(right)),
    productTypeKeys: isProxy ? [] : uniqueSorted(input.productTypeKeys),
    hasStock: isProxy ? null : (input.hasStock ?? null),
    receivesOrders: isProxy ? null : (input.receivesOrders ?? null),
    isPrivate: sellerType === "PERSON" ? Boolean(input.isPrivate) : false,
    isActive: input.isActive ?? true,
    contactChannels: normalizedContactChannels,
    addresses: normalizedAddresses,
    importCountries: uniqueSorted((input.importCountries ?? []).filter((countryCode) => countryCode.length === 2)),
  };
}

function buildEditableStoreDiff(existing: EditableStore, input: Required<EditableStoreInput>): EditableStoreDiff {
  const diff: EditableStoreDiff = {};

  if (existing.name !== input.name) diff.name = input.name;
  if ((existing.description ?? null) !== input.description) diff.description = input.description;
  if ((existing.logoUrl ?? null) !== input.logoUrl) diff.logoUrl = input.logoUrl;
  if (JSON.stringify(existing.presenceTypes) !== JSON.stringify(input.presenceTypes))
    diff.presenceTypes = input.presenceTypes;
  if (JSON.stringify(existing.productTypeKeys) !== JSON.stringify(input.productTypeKeys)) {
    diff.productTypeKeys = input.productTypeKeys;
  }
  if ((existing.hasStock ?? null) !== input.hasStock) diff.hasStock = input.hasStock;
  if ((existing.receivesOrders ?? null) !== input.receivesOrders) diff.receivesOrders = input.receivesOrders;
  if (existing.isPrivate !== input.isPrivate) diff.isPrivate = input.isPrivate;
  if (existing.isActive !== input.isActive) diff.isActive = input.isActive;
  if (JSON.stringify(existing.contactChannels) !== JSON.stringify(input.contactChannels))
    diff.contactChannels = input.contactChannels;
  if (JSON.stringify(existing.addresses) !== JSON.stringify(input.addresses)) diff.addresses = input.addresses;
  if (JSON.stringify(existing.importCountryCodes) !== JSON.stringify(input.importCountries)) {
    diff.importCountries = input.importCountries;
  }

  return diff;
}

/**
 * Result of rebasing a stored change-request diff against a store's current state.
 *  - `mergedInput`: the normalized store input to write when applying (current store overlaid with
 *    the still-effective proposed values).
 *  - `effectiveDiff`: the subset of the stored diff that still changes the store; empty means every
 *    proposed value already matches the current state.
 *  - `alreadyAppliedKeys`: stored-diff fields dropped by the rebase because the current value already
 *    equals the proposal; they are never re-written and are tagged "already applied" in the UI.
 */
export type ChangeRequestRebase = {
  mergedInput: Required<EditableStoreInput>;
  effectiveDiff: EditableStoreDiff;
  alreadyAppliedKeys: string[];
};

/**
 * Re-derives a stored change-request diff against the store's CURRENT state. Merges the stored
 * proposed values over the current store, normalizes, and recomputes the diff, so approval applies
 * only the changes that still have effect and never blind-applies a stale diff. Structural
 * immutability of `sellerType` and country is inherent: those fields are absent from
 * {@link EditableStoreInput} / {@link EditableStoreDiff}, so a tampered diff cannot mutate them.
 */
export function rebaseChangeRequestDiff(store: EditableStore, storedDiff: EditableStoreDiff): ChangeRequestRebase {
  const mergedInput = normalizeEditableStoreInput(
    mergeEditableStoreWithChangeRequest(store, storedDiff),
    store.sellerType,
  );
  const effectiveDiff = buildEditableStoreDiff(store, mergedInput);
  const effectiveKeys = new Set(Object.keys(effectiveDiff));
  const alreadyAppliedKeys = Object.keys(storedDiff).filter((key) => !effectiveKeys.has(key));

  return { mergedInput, effectiveDiff, alreadyAppliedKeys };
}

/**
 * Expected outcomes of a change-request review that are not bugs: the request no longer exists (or
 * does not belong to the store), or it is not in a state that can be reviewed. Callers translate
 * these into a user-facing message and must not report them to Sentry.
 */
export type StoreChangeRequestErrorCode = "changeRequestNotFound" | "invalidTransition";

export class StoreChangeRequestError extends Error {
  readonly code: StoreChangeRequestErrorCode;

  constructor(code: StoreChangeRequestErrorCode, message?: string) {
    super(message ?? code);
    this.name = "StoreChangeRequestError";
    this.code = code;
  }
}

export async function upsertStoreReport(input: {
  storeId: string;
  userId: string;
  reason: StoreReportReason;
  details?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.store.findUniqueOrThrow({
      where: { id: input.storeId },
      select: { id: true },
    });

    const existingOpenReport = await tx.storeReport.findFirst({
      where: {
        storeId: input.storeId,
        reportedById: input.userId,
        status: "OPEN",
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    });

    const report = existingOpenReport
      ? await tx.storeReport.update({
          where: { id: existingOpenReport.id },
          data: {
            reason: input.reason,
            details: normalizeNullableString(input.details),
          },
          select: {
            id: true,
            reason: true,
            details: true,
            status: true,
            updatedAt: true,
          },
        })
      : await tx.storeReport.create({
          data: {
            storeId: input.storeId,
            reportedById: input.userId,
            reason: input.reason,
            details: normalizeNullableString(input.details),
          },
          select: {
            id: true,
            reason: true,
            details: true,
            status: true,
            updatedAt: true,
          },
        });

    return report;
  });
}

export async function createStoreProductTypeRequest(input: {
  userId: string;
  suggestedName: string;
  reason?: string | null;
}) {
  return prisma.storeProductTypeRequest.create({
    data: {
      requestedById: input.userId,
      suggestedName: input.suggestedName.trim(),
      reason: normalizeNullableString(input.reason),
    },
    select: {
      id: true,
      suggestedName: true,
      reason: true,
      status: true,
      createdAt: true,
    },
  });
}

/**
 * Writes the scalar and relation fields of a store from an already-normalized input, inside the
 * supplied transaction. Extracted from {@link updateStoreEditableFields} so the direct-edit path and
 * the change-request apply path share the exact same relation-write logic (delete-then-recreate the
 * presence / product-type / import-country / contact-channel / address rows). The caller owns the
 * transaction, normalization, and any supersede sweep; this helper only writes.
 */
async function writeEditableStoreFields(
  tx: Prisma.TransactionClient,
  store: EditableStore,
  normalizedInput: Required<EditableStoreInput>,
): Promise<{ id: string; slug: string }> {
  const updatedStore = await tx.store.update({
    where: { id: store.id },
    data: {
      name: normalizedInput.name,
      searchName: normalizeStoreName(normalizedInput.name),
      description: normalizedInput.description,
      logoUrl: normalizedInput.logoUrl,
      hasStock: normalizedInput.hasStock,
      receivesOrders: normalizedInput.receivesOrders,
      isPrivate: normalizedInput.isPrivate,
      isActive: normalizedInput.isActive,
    },
    select: { id: true, slug: true },
  });

  await Promise.all([
    tx.storePresence.deleteMany({ where: { storeId: store.id } }),
    tx.storeProductTypeAssignment.deleteMany({ where: { storeId: store.id } }),
    tx.storeImportCountry.deleteMany({ where: { storeId: store.id } }),
    // Public channels only, mirroring what `EDITABLE_STORE_SELECT` let the form see. A non-public
    // channel is an inferred matching hint the editor never showed and never submitted, so a
    // blanket delete here silently destroyed it: editing an intake-created store's name dropped the
    // phone the matcher had learned, and the next intake from that seller matched nothing and made
    // a duplicate. Rewriting only what was actually edited keeps the hint alive.
    tx.storeContactChannel.deleteMany({ where: { storeId: store.id, isPublic: true } }),
    tx.storeAddress.deleteMany({ where: { storeId: store.id } }),
  ]);

  await Promise.all([
    ...(normalizedInput.presenceTypes.length > 0
      ? [
          tx.storePresence.createMany({
            data: normalizedInput.presenceTypes.map((presenceType) => ({
              storeId: store.id,
              presenceType,
            })),
          }),
        ]
      : []),
    ...(normalizedInput.productTypeKeys.length > 0
      ? [
          tx.storeProductTypeAssignment.createMany({
            data: normalizedInput.productTypeKeys.map((productTypeKey) => ({
              storeId: store.id,
              productTypeKey,
            })),
          }),
        ]
      : []),
    ...(normalizedInput.importCountries.length > 0
      ? [
          tx.storeImportCountry.createMany({
            data: normalizedInput.importCountries.map((countryCode) => ({
              storeId: store.id,
              countryCode,
            })),
          }),
        ]
      : []),
    ...(normalizedInput.contactChannels.length > 0
      ? [
          tx.storeContactChannel.createMany({
            data: normalizedInput.contactChannels.map((channel) => ({
              storeId: store.id,
              type: channel.type,
              value: channel.value,
              label: channel.label ?? null,
              isPrimary: false,
            })),
          }),
        ]
      : []),
    ...(normalizedInput.addresses.length > 0
      ? [
          tx.storeAddress.createMany({
            data: normalizedInput.addresses.map((address, index) => ({
              storeId: store.id,
              city: address.city ?? null,
              addressLine: address.addressLine,
              reference: address.reference ?? null,
              isPrimary: index === 0,
            })),
          }),
        ]
      : []),
  ]);

  return updatedStore;
}

/**
 * Re-evaluates the other open change requests on a store after it was written, and moves any whose
 * rebased diff is now empty against the new state to the terminal `SUPERSEDED` status (no human
 * decided it, so `reviewedByUserId` stays null while `reviewedAt` is stamped with system time). It
 * must run inside the transaction of every store-write path (direct edit, change-request apply, and
 * moderation transition) so cross-request invalidation is atomic with the write that caused it.
 * Pass `excludeId` to skip the request that triggered the write (for example the one just approved).
 * Returns the number of requests superseded.
 */
export async function supersedeStaleChangeRequests(
  tx: Prisma.TransactionClient,
  storeId: string,
  options: { excludeId?: string } = {},
): Promise<number> {
  const store = await getEditableStoreForRebase(tx, storeId);
  if (!store) return 0;

  const openRequests = await tx.storeChangeRequest.findMany({
    where: {
      storeId,
      status: "PENDING",
      ...(options.excludeId ? { id: { not: options.excludeId } } : {}),
    },
    select: { id: true, changes: true },
  });

  let supersededCount = 0;
  for (const request of openRequests) {
    const storedDiff = (request.changes as EditableStoreDiff | null) ?? {};
    const { effectiveDiff } = rebaseChangeRequestDiff(store, storedDiff);
    if (Object.keys(effectiveDiff).length === 0) {
      await tx.storeChangeRequest.update({
        where: { id: request.id },
        data: { status: "SUPERSEDED", reviewedAt: new Date(), reviewedByUserId: null },
      });
      supersededCount += 1;
    }
  }

  return supersededCount;
}

/**
 * Applies a direct edit to a store's editable fields. Assumes the caller has already verified the
 * viewer is allowed to edit this store directly (`canDirectlyEditStore` in `saveStoreEdit.ts`):
 * this function performs no ownership or governance check of its own.
 */
export async function updateStoreEditableFields(
  store: EditableStore,
  input: EditableStoreInput,
): Promise<{ id: string; slug: string }> {
  const normalizedInput = normalizeEditableStoreInput(input, store.sellerType);

  return prisma.$transaction(async (tx) => {
    const updatedStore = await writeEditableStoreFields(tx, store, normalizedInput);
    // A direct edit changes the store, so other open requests whose diff is now empty are superseded.
    await supersedeStaleChangeRequests(tx, store.id);
    return updatedStore;
  });
}

export async function upsertStoreChangeRequest(
  store: EditableStore,
  userId: string,
  input: EditableStoreInput,
  comment?: string | null,
): Promise<
  | { status: "saved"; changeRequestId: string; changedFieldCount: number }
  | { status: "discarded"; deletedExisting: boolean }
> {
  const normalizedInput = normalizeEditableStoreInput(input, store.sellerType);
  const diff = buildEditableStoreDiff(store, normalizedInput);
  const commentValue = normalizeNullableString(comment);

  return prisma.$transaction(async (tx) => {
    const existingOpenRequest = await tx.storeChangeRequest.findFirst({
      where: {
        storeId: store.id,
        requestedById: userId,
        status: "PENDING",
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    });

    const hasChanges = Object.keys(diff).length > 0;

    if (!hasChanges) {
      if (existingOpenRequest) {
        await tx.storeChangeRequest.delete({
          where: { id: existingOpenRequest.id },
        });
      }

      return {
        status: "discarded" as const,
        deletedExisting: existingOpenRequest != null,
      };
    }

    const changeRequest = existingOpenRequest
      ? await tx.storeChangeRequest.update({
          where: { id: existingOpenRequest.id },
          data: {
            changes: diff as Prisma.InputJsonValue,
            comment: commentValue,
          },
          select: { id: true },
        })
      : await tx.storeChangeRequest.create({
          data: {
            storeId: store.id,
            requestedById: userId,
            changes: diff as Prisma.InputJsonValue,
            comment: commentValue,
          },
          select: { id: true },
        });

    return {
      status: "saved" as const,
      changeRequestId: changeRequest.id,
      changedFieldCount: Object.keys(diff).length,
    };
  });
}

/**
 * Outcome of approving a change request.
 *  - `applied`: the rebased diff still had effect and was written to the store; `appliedFieldCount`
 *    is the number of fields written and `supersededCount` the number of other open requests
 *    invalidated by the write.
 *  - `superseded`: by approval time every proposed value already matched the store, so nothing was
 *    written and the request itself was moved to `SUPERSEDED` (the UI toasts "nothing to apply").
 */
export type ApplyStoreChangeRequestResult =
  | { outcome: "applied"; slug: string; appliedFieldCount: number; supersededCount: number }
  | { outcome: "superseded"; slug: string };

/**
 * Approves a `PENDING` change request by rebasing its stored diff against the store's current state
 * and applying only the changes that still have effect, in a single transaction: write the store,
 * stamp the request `APPROVED` with the reviewer, sweep other open requests, and append the
 * `changeRequest.apply` audit entry. When the rebased diff is empty (every proposal already
 * applied), nothing is written and the request is moved to `SUPERSEDED` instead. The stored diff is
 * never blind-applied. The actor id must come from `requireAdmin()` at the action layer.
 */
export async function applyStoreChangeRequest(
  store: EditableStore,
  changeRequestId: string,
  adminUserId: string,
): Promise<ApplyStoreChangeRequestResult> {
  return prisma.$transaction(async (tx) => {
    const request = await tx.storeChangeRequest.findUnique({
      where: { id: changeRequestId },
      select: { id: true, storeId: true, status: true, changes: true },
    });
    if (!request || request.storeId !== store.id) {
      throw new StoreChangeRequestError("changeRequestNotFound");
    }
    if (request.status !== "PENDING") {
      throw new StoreChangeRequestError("invalidTransition");
    }

    // Rebase against the current state read inside the transaction, not the state passed in.
    const currentStore = await getEditableStoreForRebase(tx, store.id);
    if (!currentStore) {
      throw new StoreChangeRequestError("changeRequestNotFound");
    }

    const storedDiff = (request.changes as EditableStoreDiff | null) ?? {};
    const { mergedInput, effectiveDiff } = rebaseChangeRequestDiff(currentStore, storedDiff);
    const appliedFieldCount = Object.keys(effectiveDiff).length;

    if (appliedFieldCount === 0) {
      // Nothing left to apply: supersede this request instead of writing a no-op edit or auditing an
      // apply that changed nothing. No store write means no supersede sweep of siblings is warranted.
      await tx.storeChangeRequest.update({
        where: { id: request.id },
        data: { status: "SUPERSEDED", reviewedAt: new Date(), reviewedByUserId: null },
      });
      return { outcome: "superseded", slug: currentStore.slug };
    }

    await writeEditableStoreFields(tx, currentStore, mergedInput);
    await tx.storeChangeRequest.update({
      where: { id: request.id },
      data: { status: "APPROVED", reviewedByUserId: adminUserId, reviewedAt: new Date() },
    });
    const supersededCount = await supersedeStaleChangeRequests(tx, currentStore.id, { excludeId: request.id });

    await writeAuditEntry(
      {
        actorId: adminUserId,
        action: AUDIT_ACTIONS.CHANGE_REQUEST_APPLY,
        targetType: AUDIT_TARGET_TYPES.CHANGE_REQUEST,
        targetId: request.id,
      },
      tx,
    );

    return { outcome: "applied", slug: currentStore.slug, appliedFieldCount, supersededCount };
  });
}

/**
 * Rejects a `PENDING` change request: close it (`REJECTED`) with the reviewer stamp and append the
 * `changeRequest.reject` audit entry, in one transaction. No store write, so no supersede sweep. The
 * actor id must come from `requireAdmin()` at the action layer.
 */
export async function rejectStoreChangeRequest(
  store: EditableStore,
  changeRequestId: string,
  adminUserId: string,
): Promise<{ id: string; slug: string }> {
  return prisma.$transaction(async (tx) => {
    const request = await tx.storeChangeRequest.findUnique({
      where: { id: changeRequestId },
      select: { id: true, storeId: true, status: true },
    });
    if (!request || request.storeId !== store.id) {
      throw new StoreChangeRequestError("changeRequestNotFound");
    }
    if (request.status !== "PENDING") {
      throw new StoreChangeRequestError("invalidTransition");
    }

    await tx.storeChangeRequest.update({
      where: { id: request.id },
      data: { status: "REJECTED", reviewedByUserId: adminUserId, reviewedAt: new Date() },
    });

    await writeAuditEntry(
      {
        actorId: adminUserId,
        action: AUDIT_ACTIONS.CHANGE_REQUEST_REJECT,
        targetType: AUDIT_TARGET_TYPES.CHANGE_REQUEST,
        targetId: request.id,
      },
      tx,
    );

    return { id: request.id, slug: store.slug };
  });
}
