import { prisma } from "@/lib/prisma";

export type UserStoreOption = {
  id: string;
  name: string;
  countryCode: string;
};

export async function getUserStores(userId: string): Promise<UserStoreOption[]> {
  return prisma.store.findMany({
    where: { createdByUserId: userId },
    select: { id: true, name: true, countryCode: true },
    orderBy: { name: "asc" },
  });
}
