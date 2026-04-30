import { prisma } from "@/lib/prisma";

export type UserStoreOption = {
  id: string;
  name: string;
  countryCode: string;
};

/**
 * Returns the catalog of stores a collector can place a pedido at: publicly visible
 * and active, in `PENDING` or `APPROVED` moderation status.
 *
 * Stores are shared across users — a collector can buy from any catalog store, not
 * only the ones they created themselves. `PENDING` is included so that a user who
 * just registered a new store (which starts as `PENDING`) can immediately use it
 * without waiting for moderation. This matches the public store listing query
 * in `getPublicStoresListingPage`.
 */
export async function getOrderableStores(): Promise<UserStoreOption[]> {
  return prisma.store.findMany({
    where: {
      visibility: "PUBLIC",
      status: { in: ["PENDING", "APPROVED"] },
      isActive: true,
    },
    select: { id: true, name: true, countryCode: true },
    orderBy: { name: "asc" },
  });
}
