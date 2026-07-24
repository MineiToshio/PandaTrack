import { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from "@/lib/data/admin/adminAuditVocabulary";
import { writeAuditEntry } from "@/lib/data/admin/adminAuditMutations";

const UNIQUE_CONSTRAINT_ERROR = "P2002";

/**
 * Expected outcomes of a product-type request approval that are not bugs: the request no longer
 * exists, it is not in a state that can be resolved, or the generated catalog key collides with an
 * existing type. Callers translate these into a message the reviewing admin can act on; they must
 * not be reported to Sentry.
 */
export type StoreProductTypeApprovalErrorCode = "notFound" | "invalidTransition" | "duplicateKey";

export class StoreProductTypeApprovalError extends Error {
  readonly code: StoreProductTypeApprovalErrorCode;

  constructor(code: StoreProductTypeApprovalErrorCode, message?: string) {
    super(message ?? code);
    this.name = "StoreProductTypeApprovalError";
    this.code = code;
  }
}

/**
 * Derives a stable snake_case catalog key from a display name: diacritics are stripped, everything
 * outside `[a-z0-9]` collapses to a single underscore, and leading/trailing underscores are trimmed.
 * So "Álbumes de figuritas" becomes "albumes_de_figuritas". The result is the primary key of the
 * catalog row, so uniqueness is enforced by the database, not here.
 */
export function slugifyStoreProductTypeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_CONSTRAINT_ERROR;
}

export interface ApproveStoreProductTypeRequestInput {
  requestId: string;
  /** Resolved server-side from `requireAdmin()`; never taken from the client. */
  actorId: string;
  nameEs: string;
  nameEn: string;
  /** Optional explicit key; otherwise generated from the request's `suggestedKey` or the es name. */
  key?: string | null;
}

export interface StoreProductTypeApprovalResult {
  requestId: string;
  key: string;
}

/**
 * Approves a `PENDING` `StoreProductTypeRequest` and authors its catalog entry in one transaction:
 * insert `StoreProductType { key, nameEs, nameEn, isActive }`, flip the request to `APPROVED`
 * (persisting the final `key` into `suggestedKey` for traceability), and append a
 * `productType.approve` audit entry. A missing request throws `notFound`; a non-`PENDING` request
 * throws `invalidTransition`; a key that collides with an existing catalog row throws `duplicateKey`
 * and writes nothing. The actor id must come from `requireAdmin()` at the action layer.
 */
export async function approveStoreProductTypeRequest(
  input: ApproveStoreProductTypeRequestInput,
): Promise<StoreProductTypeApprovalResult> {
  return prisma.$transaction(async (tx) => {
    const request = await tx.storeProductTypeRequest.findUnique({
      where: { id: input.requestId },
      select: { id: true, status: true, suggestedKey: true },
    });
    if (!request) {
      throw new StoreProductTypeApprovalError("notFound");
    }
    if (request.status !== "PENDING") {
      throw new StoreProductTypeApprovalError("invalidTransition");
    }

    const seedKey = input.key?.trim() || request.suggestedKey?.trim() || input.nameEs;
    const key = slugifyStoreProductTypeKey(seedKey);
    if (!key) {
      // The name has no alphanumeric content to derive a key from, so the request cannot be authored.
      throw new StoreProductTypeApprovalError("invalidTransition");
    }

    try {
      await tx.storeProductType.create({
        data: { key, nameEs: input.nameEs, nameEn: input.nameEn, isActive: true },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new StoreProductTypeApprovalError("duplicateKey");
      }
      throw error;
    }

    await tx.storeProductTypeRequest.update({
      where: { id: request.id },
      data: { status: "APPROVED", suggestedKey: key },
    });

    await writeAuditEntry(
      {
        actorId: input.actorId,
        action: AUDIT_ACTIONS.PRODUCT_TYPE_APPROVE,
        targetType: AUDIT_TARGET_TYPES.PRODUCT_TYPE,
        targetId: request.id,
      },
      tx,
    );

    return { requestId: request.id, key };
  });
}

export interface RejectStoreProductTypeRequestInput {
  requestId: string;
  /** Resolved server-side from `requireAdmin()`; never taken from the client. */
  actorId: string;
}

export interface StoreProductTypeRejectionResult {
  requestId: string;
}

/**
 * Rejects a `PENDING` `StoreProductTypeRequest`: flip it to `REJECTED` and append a
 * `productType.reject` audit entry in one transaction, with no catalog write. A missing request
 * throws `notFound`; a non-`PENDING` request throws `invalidTransition`.
 */
export async function rejectStoreProductTypeRequest(
  input: RejectStoreProductTypeRequestInput,
): Promise<StoreProductTypeRejectionResult> {
  return prisma.$transaction(async (tx) => {
    const request = await tx.storeProductTypeRequest.findUnique({
      where: { id: input.requestId },
      select: { id: true, status: true },
    });
    if (!request) {
      throw new StoreProductTypeApprovalError("notFound");
    }
    if (request.status !== "PENDING") {
      throw new StoreProductTypeApprovalError("invalidTransition");
    }

    await tx.storeProductTypeRequest.update({
      where: { id: request.id },
      data: { status: "REJECTED" },
    });

    await writeAuditEntry(
      {
        actorId: input.actorId,
        action: AUDIT_ACTIONS.PRODUCT_TYPE_REJECT,
        targetType: AUDIT_TARGET_TYPES.PRODUCT_TYPE,
        targetId: request.id,
      },
      tx,
    );

    return { requestId: request.id };
  });
}
