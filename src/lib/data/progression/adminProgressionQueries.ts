import type { Prisma } from "../../../../generated/prisma/client";
import { roleGrantsAdmin } from "@/lib/auth/adminRole";
import { prisma } from "@/lib/prisma";
import { getShippedMedalCount } from "./medalCatalogue";
import type { PointLedgerEntryDto } from "./progressionQueries";
import { FIRST_RANK_INDEX, RANK_LADDER, type RankKey } from "./rankLadder";

/**
 * Admin-facing reads over one collector's progression.
 *
 * Separate from `progressionQueries.ts` on purpose. That module answers "what does this collector
 * see", and its shapes carry the merit lock, the monthly grouping, cache staleness and the
 * visibility preference. An administrator is asking a different question: is this total explainable,
 * and what exactly would a void reverse. Reusing `getProgressSummary` here would have coupled the
 * moderation surface to the collector's own presentation decisions, so the overview below composes
 * the same primitives instead of borrowing the collector's view of them.
 *
 * Everything here is read-only. There is deliberately no admin write path other than the void that
 * already lives in `progressionMutations.ts` (`FR-12-45`: no route grants, edits or reorders an
 * entry).
 */

/** Upper bound on an account lookup, so a broad term cannot return an unbounded user listing. */
export const PROGRESSION_ACCOUNT_SEARCH_LIMIT = 20;

/** Default page size for the admin ledger listing, matching the audit viewer's. */
export const DEFAULT_LEDGER_PAGE_SIZE = 25;

/** Upper bound so a caller cannot request an unbounded ledger page. */
const MAX_LEDGER_PAGE_SIZE = 100;

/**
 * The same projection `listUserPointLedger` returns, shared so the paginated read and the full read
 * cannot drift into two different row shapes.
 */
const LEDGER_ENTRY_SELECT = {
  id: true,
  ruleKey: true,
  entityType: true,
  entityId: true,
  points: true,
  occurredOn: true,
  source: true,
  createdAt: true,
  voidedAt: true,
  voidedReason: true,
  voidedByUserId: true,
} satisfies Prisma.PointLedgerEntrySelect;

export type ProgressionAccount = {
  userId: string;
  username: string;
  name: string;
  email: string;
  isAdmin: boolean;
};

/**
 * Accounts matching a username or email fragment, for the administrator who already knows who they
 * are looking for.
 *
 * A blank term returns nothing rather than everyone: this is the entry point to a surface that can
 * reverse someone's progression, and handing out a full user directory by default is not something
 * it needs to do its job.
 */
export async function searchProgressionAccounts(params: { query: string }): Promise<ProgressionAccount[]> {
  const term = params.query.trim();
  if (term.length === 0) return [];

  const accounts = await prisma.user.findMany({
    where: {
      OR: [{ username: { contains: term, mode: "insensitive" } }, { email: { contains: term, mode: "insensitive" } }],
    },
    select: { id: true, username: true, name: true, email: true, role: true },
    orderBy: { username: "asc" },
    take: PROGRESSION_ACCOUNT_SEARCH_LIMIT,
  });

  return accounts.map((account) => ({
    userId: account.id,
    username: account.username,
    name: account.name,
    email: account.email,
    // The stored role, not the caller's session: this listing is about other accounts.
    isAdmin: roleGrantsAdmin(account.role),
  }));
}

export type ProgressionAccountIdentity = ProgressionAccount;

/** The account a `?user=<id>` selection names, or `null` when the id matches nobody. */
export async function getProgressionAccount(targetUserId: string): Promise<ProgressionAccountIdentity | null> {
  const account = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, username: true, name: true, email: true, role: true },
  });
  if (!account) return null;

  return {
    userId: account.id,
    username: account.username,
    name: account.name,
    email: account.email,
    isAdmin: roleGrantsAdmin(account.role),
  };
}

export type UserPointLedgerPage = {
  items: PointLedgerEntryDto[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
};

/**
 * One page of a collector's ledger, newest first, voided rows included.
 *
 * `listUserPointLedger` stays the full-ledger contract of `FR-12-45` and is what the void's own
 * reasoning reads; this is the paginated sibling the surface renders, because loading every entry a
 * collector has ever earned in order to show twenty-five of them is a read that stays acceptable
 * only while the ledger is small.
 */
export async function listUserPointLedgerPage(params: {
  targetUserId: string;
  page?: number;
  pageSize?: number;
}): Promise<UserPointLedgerPage> {
  const requestedPage = params.page && Number.isInteger(params.page) && params.page > 0 ? params.page : 1;
  const requestedPageSize =
    params.pageSize && Number.isInteger(params.pageSize) && params.pageSize > 0
      ? Math.min(params.pageSize, MAX_LEDGER_PAGE_SIZE)
      : DEFAULT_LEDGER_PAGE_SIZE;

  const where: Prisma.PointLedgerEntryWhereInput = { userId: params.targetUserId };

  const totalCount = await prisma.pointLedgerEntry.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / requestedPageSize));
  // A page past the end reads as the last real page rather than as an empty table, so a stale link
  // or a void that shrank nothing still lands somewhere meaningful.
  const currentPage = Math.min(requestedPage, totalPages);

  const items = await prisma.pointLedgerEntry.findMany({
    where,
    select: LEDGER_ENTRY_SELECT,
    orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
    skip: (currentPage - 1) * requestedPageSize,
    take: requestedPageSize,
  });

  return { items, totalCount, currentPage, pageSize: requestedPageSize, totalPages };
}

export type AdminProgressionOverview = {
  /** `null` when this collector has never been recomputed (first-run, not an error). */
  maturedPoints: number | null;
  rankIndex: number | null;
  rankKey: RankKey | null;
  highestRankIndex: number | null;
  highestRankKey: RankKey | null;
  lastRecomputedAt: Date | null;
  unlockedMedalCount: number;
  shippedMedalCount: number;
  liveEntryCount: number;
  voidedEntryCount: number;
};

/** The rank key a stored index names, or `null` when the index falls outside the ladder. */
function resolveRankKey(rankIndex: number | null): RankKey | null {
  if (rankIndex === null) return null;
  return RANK_LADDER[rankIndex - FIRST_RANK_INDEX]?.rankKey ?? null;
}

/**
 * The figures the administrator reads above the ledger: what the collector currently holds, and how
 * much of it is still live.
 *
 * Live and voided entries are counted separately rather than reported as one total, because the gap
 * between them is the whole question a void surface exists to answer. No monetary figure is read or
 * returned anywhere in this module.
 */
export async function getAdminProgressionOverview(targetUserId: string): Promise<AdminProgressionOverview> {
  const [cache, unlockedMedalCount, liveEntryCount, voidedEntryCount] = await Promise.all([
    prisma.userProgress.findUnique({
      where: { userId: targetUserId },
      select: { maturedPoints: true, rankIndex: true, highestRankIndex: true, lastRecomputedAt: true },
    }),
    prisma.medalUnlock.count({ where: { userId: targetUserId } }),
    prisma.pointLedgerEntry.count({ where: { userId: targetUserId, voidedAt: null } }),
    prisma.pointLedgerEntry.count({ where: { userId: targetUserId, voidedAt: { not: null } } }),
  ]);

  return {
    maturedPoints: cache?.maturedPoints ?? null,
    rankIndex: cache?.rankIndex ?? null,
    rankKey: resolveRankKey(cache?.rankIndex ?? null),
    highestRankIndex: cache?.highestRankIndex ?? null,
    highestRankKey: resolveRankKey(cache?.highestRankIndex ?? null),
    lastRecomputedAt: cache?.lastRecomputedAt ?? null,
    unlockedMedalCount,
    shippedMedalCount: getShippedMedalCount(),
    liveEntryCount,
    voidedEntryCount,
  };
}
