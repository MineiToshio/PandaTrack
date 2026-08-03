import { cache } from "react";
import { roleGrantsAdmin } from "@/lib/auth/adminRole";
import { prisma } from "@/lib/prisma";
import { buildQuotaSnapshot, formatPeriodKey, type ImageIntakeQuotaSnapshot } from "@/lib/imageIntake/quota";

export type { ImageIntakeQuotaSnapshot };

/**
 * Reads one collector's photo balance for the current period.
 *
 * Two indexed reads, both by unique key: the per-user override on `user`, and the roll-up row for
 * this period. The roll-up already excludes failed submissions (they are refunded at settlement)
 * and already includes reservations still in flight, so `usedPhotos` is exactly what the counter
 * must show without scanning the ledger.
 *
 * A period with no row yet means nothing has been spent this month: reset is implicit in the key,
 * so no job has to create anything.
 */
export async function getImageIntakeQuotaSnapshot(params: {
  userId: string;
  isAdmin: boolean;
  now: Date;
}): Promise<ImageIntakeQuotaSnapshot> {
  const periodKey = formatPeriodKey(params.now);

  const [account, rollUp] = await Promise.all([
    prisma.user.findUnique({ where: { id: params.userId }, select: { aiMonthlyPhotoLimit: true } }),
    prisma.imageIntakePeriod.findUnique({
      where: { userId_periodKey: { userId: params.userId, periodKey } },
      select: { usedPhotos: true },
    }),
  ]);

  return buildQuotaSnapshot({
    isAdmin: params.isAdmin,
    override: account?.aiMonthlyPhotoLimit ?? null,
    usedPhotos: rollUp?.usedPhotos ?? 0,
    now: params.now,
  });
}

/**
 * Request-scoped memoization of the balance read. The counter appears on several surfaces that can
 * render in the same request (the shell's floating button, the orders list toolbar, the empty
 * state), and `cache()` collapses those into one query. Arguments are primitives so the memo key
 * actually matches between callers.
 */
export const getImageIntakeQuotaSnapshotCached = cache(
  (userId: string, isAdmin: boolean): Promise<ImageIntakeQuotaSnapshot> =>
    getImageIntakeQuotaSnapshot({ userId, isAdmin, now: new Date() }),
);

export type ImageIntakeQuotaAccount = {
  userId: string;
  username: string;
  name: string;
  email: string;
  isAdmin: boolean;
  /** Per-user override as stored; `null` means the product default applies. */
  overrideLimit: number | null;
  usedPhotos: number;
};

/** Upper bound on the admin search result set, so a broad term cannot return the whole user table. */
const QUOTA_ACCOUNT_SEARCH_LIMIT = 10;

/**
 * Finds collectors by username or email for the administrator's override console, with the photos
 * each has already spent in the current period.
 *
 * The search is deliberately narrow (two exact-ish text fields, capped result set) because this
 * console exists to adjust one known account's bag, not to browse the user base.
 */
export async function searchImageIntakeQuotaAccounts(params: {
  query: string;
  now: Date;
}): Promise<ImageIntakeQuotaAccount[]> {
  const term = params.query.trim();
  if (term.length === 0) return [];

  const periodKey = formatPeriodKey(params.now);

  const accounts = await prisma.user.findMany({
    where: {
      OR: [{ username: { contains: term, mode: "insensitive" } }, { email: { contains: term, mode: "insensitive" } }],
    },
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      role: true,
      aiMonthlyPhotoLimit: true,
      imageIntakePeriods: { where: { periodKey }, select: { usedPhotos: true } },
    },
    orderBy: { username: "asc" },
    take: QUOTA_ACCOUNT_SEARCH_LIMIT,
  });

  return accounts.map((account) => ({
    userId: account.id,
    username: account.username,
    name: account.name,
    email: account.email,
    // Same membership check the session gate uses; applied to the stored role because this listing
    // is about other accounts, not about the caller's own session.
    isAdmin: roleGrantsAdmin(account.role),
    overrideLimit: account.aiMonthlyPhotoLimit,
    usedPhotos: account.imageIntakePeriods[0]?.usedPhotos ?? 0,
  }));
}
