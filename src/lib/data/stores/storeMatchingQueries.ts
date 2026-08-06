import { prisma } from "@/lib/prisma";
import { normalizeStoreName } from "@/lib/store/duplicateMatch";
import { PUBLIC_VISIBLE_STORE_STATUSES, storeVisibleToViewerFilter } from "./storeQueries";

/**
 * Store matching for the image-intake review screen.
 *
 * Promotes the `resolveStore` pattern that today lives only inside
 * `scripts/local/migrate-pedidos/chat-load.ts` into a shared data-layer helper, and adds the
 * phone-number signal the review screen's disambiguation flow needs. The script itself is left
 * untouched: this module reuses `normalizeStoreName` and the same "exact, then normalized" name
 * semantics, it does not import from the script.
 *
 * Where the phone-to-store association lives: the existing `StoreContactChannel` model, matched on
 * its `PHONE` and `WHATSAPP` rows. No dedicated association table is introduced.
 */

/** Minimum digit count for a phone comparison to be trusted; shorter strings are not a real number. */
export const MIN_PHONE_MATCH_DIGITS = 7;

/**
 * Safety cap on contact-channel rows scanned per intake match, mirroring `MAX_DUPLICATE_SCAN` in
 * `storeQueries.ts`: the DB `where` already pre-filters to orderable stores' `PHONE`/`WHATSAPP`
 * channels, so this only bounds the pathological case of an unexpectedly large catalog.
 */
const MAX_PHONE_CHANNEL_SCAN = 3000;

/** Safety cap on exact-name-match rows; a normalized store name is expected to be near-unique. */
const MAX_NAME_MATCH_SCAN = 50;

export type StoreMatchCandidate = {
  storeId: string;
  name: string;
};

export type StoreMatchResult =
  | { kind: "certain"; storeId: string; name: string; matchedBy: "phone" | "name" }
  | { kind: "ambiguous"; candidates: StoreMatchCandidate[] }
  | { kind: "unknown" };

export type StoreMatchInput = {
  name: string | null;
  phone: string | null;
};

/**
 * Strips everything but digits. The extracted phone is untrusted input: this never feeds a raw
 * SQL string, only Prisma's own query builder and in-memory comparison.
 */
export function normalizePhoneDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * True when two normalized digit strings plausibly identify the same subscriber number. No country
 * calling-code catalog is assumed (the product is not Peru-only): the shorter string being a suffix
 * of the longer one tolerates an optional international prefix on either side ("+51987654321",
 * "51987654321", "0051987654321", "987654321" all compare equal), which is what a phone-based
 * match needs to work regardless of which country's numbers a collector has saved.
 */
export function phoneDigitsMatch(a: string, b: string): boolean {
  if (a.length < MIN_PHONE_MATCH_DIGITS || b.length < MIN_PHONE_MATCH_DIGITS) return false;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  return longer.endsWith(shorter);
}

const ORDERABLE_STORE_STATUS_FILTER = { in: [...PUBLIC_VISIBLE_STORE_STATUSES] };

/**
 * Candidate stores whose stored phone/WhatsApp channel matches the extracted phone, deduplicated by
 * store. Scoped to the same "orderable" catalog `getOrderableStores` exposes to the manual form, so
 * an intake match never surfaces a store the buyer could not otherwise pick.
 */
async function findCandidatesByPhone(viewerId: string, rawPhone: string | null): Promise<StoreMatchCandidate[]> {
  const digits = rawPhone ? normalizePhoneDigits(rawPhone) : "";
  if (digits.length < MIN_PHONE_MATCH_DIGITS) return [];

  const channels = await prisma.storeContactChannel.findMany({
    where: {
      type: { in: ["PHONE", "WHATSAPP"] },
      store: {
        visibility: "PUBLIC",
        status: ORDERABLE_STORE_STATUS_FILTER,
        isActive: true,
        ...storeVisibleToViewerFilter(viewerId),
      },
    },
    select: { storeId: true, value: true, store: { select: { name: true } } },
    take: MAX_PHONE_CHANNEL_SCAN,
  });

  const byStoreId = new Map<string, string>();
  for (const channel of channels) {
    if (byStoreId.has(channel.storeId)) continue;
    if (!phoneDigitsMatch(digits, normalizePhoneDigits(channel.value))) continue;
    byStoreId.set(channel.storeId, channel.store.name);
  }

  return Array.from(byStoreId, ([storeId, name]) => ({ storeId, name }));
}

/**
 * Candidate stores whose `searchName` equals the extracted name once normalized. This is the
 * `resolveStore` semantics: an exact `name` match is a special case of an exact `searchName`
 * match, since `searchName` is written as `normalizeStoreName(name)` on every create or
 * rename, so a single equality query on `searchName` covers both of the script's two steps.
 */
async function findCandidatesByName(viewerId: string, rawName: string | null): Promise<StoreMatchCandidate[]> {
  const trimmed = rawName?.trim() ?? "";
  if (!trimmed) return [];
  const searchName = normalizeStoreName(trimmed);
  if (!searchName) return [];

  const stores = await prisma.store.findMany({
    where: {
      searchName,
      visibility: "PUBLIC",
      status: ORDERABLE_STORE_STATUS_FILTER,
      isActive: true,
      ...storeVisibleToViewerFilter(viewerId),
    },
    select: { id: true, name: true },
    take: MAX_NAME_MATCH_SCAN,
  });

  return stores.map((store) => ({ storeId: store.id, name: store.name }));
}

/**
 * How a collector relates to a store, which is what decides whether a contact detail they supply may
 * be written onto it.
 *
 * The store catalog is shared across every user, so "the caller picked this store on their own review
 * screen" is not by itself evidence that they know anything about it: the review screen is handed the
 * whole orderable catalog, so any authenticated user can name any store id. Only a caller who created
 * the store, or who has actually bought from it, has a relationship that makes their contribution
 * worth trusting.
 */
export type IntakeStoreRelation = "creator" | "buyer" | "none";

/**
 * Resolves the caller's relationship with a store.
 *
 * Returns `none` for a store that does not exist, so a caller cannot use a made-up id to reach a
 * write path at all.
 */
export async function findIntakeStoreRelation(userId: string, storeId: string): Promise<IntakeStoreRelation> {
  const [store, priorOrder] = await Promise.all([
    prisma.store.findUnique({ where: { id: storeId }, select: { createdByUserId: true } }),
    prisma.order.findFirst({ where: { userId, storeId }, select: { id: true } }),
  ]);

  if (!store) return "none";
  if (store.createdByUserId === userId) return "creator";
  return priorOrder ? "buyer" : "none";
}

/** Store ids among `storeIds` the user has ordered from before, used only to order (never preselect) ambiguous candidates. */
async function findStoreIdsWithPriorOrders(userId: string, storeIds: string[]): Promise<Set<string>> {
  if (storeIds.length === 0) return new Set();
  const orders = await prisma.order.findMany({
    where: { userId, storeId: { in: storeIds } },
    select: { storeId: true },
    distinct: ["storeId"],
  });
  return new Set(orders.map((order) => order.storeId));
}

/**
 * Resolves the store step of an image-intake draft against the existing store catalog.
 *
 * `certain` fires on a single distinct store matched by phone, by name, or by both.
 * `ambiguous` fires on two or more distinct stores, ordered with nothing preselected, since a wrong
 * guess here would misattribute the purchase to the wrong seller, with the more reliable
 * phone-matched candidates first, then stores the same user has ordered from before, then
 * alphabetically. `unknown` fires when neither signal matches anything.
 *
 * `userId` scopes matching only to the extent privacy requires: the shared catalog is matchable by
 * everyone, but another collector's private person store is not, because it is not theirs to be
 * shown (`FR-04-33`, ADR 0009). Without that scope an intake could resolve, with full confidence,
 * to a private individual someone else recorded from their own chat. Beyond privacy `userId` does
 * not decide what matches, only what sorts first: a store the caller has bought from before leads
 * an ambiguous list.
 */
export async function findStoreMatchesForIntake(userId: string, input: StoreMatchInput): Promise<StoreMatchResult> {
  const [byPhone, byName] = await Promise.all([
    findCandidatesByPhone(userId, input.phone),
    findCandidatesByName(userId, input.name),
  ]);

  const merged = new Map<string, { name: string; matchedByPhone: boolean }>();
  for (const candidate of byPhone) {
    merged.set(candidate.storeId, { name: candidate.name, matchedByPhone: true });
  }
  for (const candidate of byName) {
    const existing = merged.get(candidate.storeId);
    if (existing) continue;
    merged.set(candidate.storeId, { name: candidate.name, matchedByPhone: false });
  }

  if (merged.size === 0) {
    return { kind: "unknown" };
  }

  if (merged.size === 1) {
    const [[storeId, info]] = merged;
    return { kind: "certain", storeId, name: info.name, matchedBy: info.matchedByPhone ? "phone" : "name" };
  }

  const candidateIds = [...merged.keys()];
  const priorOrderStoreIds = await findStoreIdsWithPriorOrders(userId, candidateIds);

  const candidates = candidateIds
    .map((storeId) => {
      const info = merged.get(storeId)!;
      return {
        storeId,
        name: info.name,
        matchedByPhone: info.matchedByPhone,
        hasPriorOrders: priorOrderStoreIds.has(storeId),
      };
    })
    .sort((a, b) => {
      if (a.matchedByPhone !== b.matchedByPhone) return a.matchedByPhone ? -1 : 1;
      if (a.hasPriorOrders !== b.hasPriorOrders) return a.hasPriorOrders ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .map(({ storeId, name }) => ({ storeId, name }));

  return { kind: "ambiguous", candidates };
}
