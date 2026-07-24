import { prisma } from "@/lib/prisma";
import { slugifyStoreProductTypeKey } from "@/lib/data/catalog/storeProductTypeMutations";

/**
 * A single pending product-type request as seen by an administrator: the requester identity, the
 * suggested name / key / reason, and a `suggestedKeySlug` preview of the catalog key approval would
 * generate. This is an admin-only read (the request is global, with no owning store); callers must
 * gate with `requireAdmin()` (or the page-level admin check) before reading.
 */
export type AdminPendingStoreProductTypeRequest = {
  id: string;
  suggestedName: string;
  suggestedKey: string | null;
  /** Preview of the key approval would author, so the console can show it before the write. */
  suggestedKeySlug: string;
  reason: string | null;
  createdAt: Date;
  requester: {
    id: string;
    username: string;
    name: string;
  };
};

/**
 * Lists every `PENDING` `StoreProductTypeRequest`, newest first, with requester identity for the
 * moderation console review surface. Server-only and admin-only: this must never be reached from a
 * public route. Resolved (`APPROVED` / `REJECTED`) requests are history and are not returned here.
 */
export async function getAdminPendingStoreProductTypeRequests(): Promise<AdminPendingStoreProductTypeRequest[]> {
  const requests = await prisma.storeProductTypeRequest.findMany({
    where: { status: "PENDING" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      suggestedName: true,
      suggestedKey: true,
      reason: true,
      createdAt: true,
      requestedBy: {
        select: {
          id: true,
          username: true,
          name: true,
        },
      },
    },
  });

  return requests.map((request) => ({
    id: request.id,
    suggestedName: request.suggestedName,
    suggestedKey: request.suggestedKey,
    suggestedKeySlug: slugifyStoreProductTypeKey(request.suggestedKey ?? request.suggestedName),
    reason: request.reason,
    createdAt: request.createdAt,
    requester: request.requestedBy,
  }));
}
