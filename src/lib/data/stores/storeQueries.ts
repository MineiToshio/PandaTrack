import type {
  Prisma,
  StoreContactChannelType,
  StorePresenceType,
  StoreStatus,
} from "../../../../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getDuplicateMatchScore,
  getSimilarityPercent,
  normalizeStoreName,
  SIMILARITY_THRESHOLD_PERCENT,
} from "@/lib/store/duplicateMatch";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/lib/constants";

const DEFAULT_DUPLICATE_CANDIDATES_LIMIT = 5;
export const DEFAULT_PUBLIC_STORE_PAGE_SIZE = DEFAULT_PAGE_SIZE;
const DEFAULT_PUBLIC_STORE_REVIEW_LIMIT = 10;

/**
 * Single source of truth for which store statuses are visible on every public surface (listing,
 * search, detail, and the order-creation picker). `REJECTED` is excluded everywhere (tombstone); only
 * removal hides a store. Open reports never hide one: they drive a derived notice on the detail, not a
 * visibility rule. Encoding the rule once keeps the surfaces from diverging.
 */
export const PUBLIC_VISIBLE_STORE_STATUSES = ["PENDING", "APPROVED"] as const satisfies readonly StoreStatus[];

/**
 * Safety cap on rows fed into in-memory duplicate scoring. The query already pre-filters in SQL
 * on the persisted, normalized `searchName` column (`contains` on diacritic-stripped, lowercased
 * terms — both sides normalized, so "Pokémon" matches the query "pokemon" without accent issues),
 * so this bounds only the pathological case where a single common term still matches a very large
 * number of stores. The final ranking is computed in memory over this bounded candidate set.
 */
const MAX_DUPLICATE_SCAN = 500;

/**
 * Splits a raw name query into the distinct normalized terms used to pre-filter `searchName` in SQL.
 * Returns `[]` when the query normalizes to nothing (callers already early-return in that case).
 */
function buildSearchNameTerms(nameQuery: string): string[] {
  const normalized = normalizeStoreName(nameQuery);
  if (!normalized) return [];
  return Array.from(new Set(normalized.split(" ").filter(Boolean)));
}

export interface DuplicateCandidate {
  id: string;
  name: string;
  slug: string;
  countryCode: string;
  logoUrl: string | null;
}

export interface StoreDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: StoreStatus;
  sellerType: "RETAILER" | "PERSON" | "PROXY";
  countryCode: string;
  isActive: boolean;
  isPrivate: boolean;
  createdByUserId: string;
  createdAt: Date;
  receivesOrders: boolean | null;
  hasStock: boolean | null;
  averageRating: number | null;
  reviewCount: number;
  presenceTypes: StorePresenceType[];
  productTypeKeys: string[];
  importCountryCodes: string[];
  /** Exposed for RETAILER and PROXY sellers; PERSON sellers do not expose these. */
  logoUrl?: string | null;
  /** Exposed for RETAILER and PROXY sellers; public channels only. */
  contactChannels?: Array<{ type: StoreContactChannelType; value: string; label?: string | null }>;
  /** Exposed for RETAILER and PROXY sellers; public addresses only. */
  addresses?: Array<{
    city?: string | null;
    addressLine: string;
    reference?: string | null;
  }>;
}

export interface PublicStoreListingItem {
  slug: string;
  name: string;
  countryCode: string;
  status: StoreStatus;
  sellerType: "RETAILER" | "PERSON" | "PROXY";
  logoUrl: string | null;
  presenceTypes: StorePresenceType[];
  productTypeKeys: string[];
  importCountryCodes: string[];
  contactChannels: Array<{ type: StoreContactChannelType; value: string }>;
  receivesOrders: boolean | null;
  hasStock: boolean | null;
  averageRating: number | null;
  reviewCount: number;
}

export interface PublicStoreListingFilters {
  nameQuery?: string;
  productTypeKeys?: string[];
  countryCodes?: string[];
  importCountryCodes?: string[];
  presenceTypes?: StorePresenceType[];
  receivesOrders?: boolean;
  hasStock?: boolean;
  /** When true, closed (inactive) stores are included in the listing. Defaults to false (closed stores hidden). */
  includeClosed?: boolean;
  page?: number;
  pageSize?: number;
}

export interface PublicStoreListingPage {
  items: PublicStoreListingItem[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
}

export interface PublicStoreReview {
  id: string;
  overallRating: number;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
  authorName: string | null;
  isViewerReview: boolean;
}

export interface StoreViewerReview {
  overallRating: number;
  comment: string | null;
  updatedAt: Date;
}

export interface StoreViewerNote {
  content: string;
  updatedAt: Date;
}

export interface StoreViewerContext {
  review: StoreViewerReview | null;
  note: StoreViewerNote | null;
}

export type UserStoreOption = {
  id: string;
  name: string;
  countryCode: string;
};

/**
 * Finds likely duplicate stores for the provided query using normalized and token-based matching.
 * Results are sorted by best match score first and then by name.
 */
export async function findDuplicateCandidates(
  nameQuery: string,
  limit: number = DEFAULT_DUPLICATE_CANDIDATES_LIMIT,
): Promise<DuplicateCandidate[]> {
  const trimmed = nameQuery.trim();
  if (!trimmed) return [];
  const searchTerms = buildSearchNameTerms(trimmed);
  if (searchTerms.length === 0) return [];

  const stores = await prisma.store.findMany({
    where: { OR: searchTerms.map((term) => ({ searchName: { contains: term } })) },
    select: { id: true, name: true, slug: true, countryCode: true, logoUrl: true },
    orderBy: { name: "asc" },
    take: MAX_DUPLICATE_SCAN,
  });

  return stores
    .map((store) => ({
      store,
      score: getDuplicateMatchScore(trimmed, store.name),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return normalizeStoreName(a.store.name).localeCompare(normalizeStoreName(b.store.name));
    })
    .slice(0, limit)
    .map((item) => item.store);
}

/**
 * Finds stores in the given country whose name similarity to the query meets the minimum threshold.
 * Used on create-store submit to warn only when there are similar stores in the same country.
 */
export async function findDuplicateCandidatesInCountry(
  nameQuery: string,
  countryCode: string,
  limit: number = DEFAULT_DUPLICATE_CANDIDATES_LIMIT,
  minSimilarityPercent: number = SIMILARITY_THRESHOLD_PERCENT,
): Promise<DuplicateCandidate[]> {
  const trimmed = nameQuery.trim();
  if (!trimmed || !countryCode) return [];
  const searchTerms = buildSearchNameTerms(trimmed);
  if (searchTerms.length === 0) return [];

  const stores = await prisma.store.findMany({
    where: {
      countryCode,
      OR: searchTerms.map((term) => ({ searchName: { contains: term } })),
    },
    select: { id: true, name: true, slug: true, countryCode: true, logoUrl: true },
    orderBy: { name: "asc" },
    take: MAX_DUPLICATE_SCAN,
  });

  return stores
    .map((store) => ({
      store,
      similarityPercent: getSimilarityPercent(trimmed, store.name),
    }))
    .filter((item) => item.similarityPercent >= minSimilarityPercent)
    .sort((a, b) => {
      if (b.similarityPercent !== a.similarityPercent) return b.similarityPercent - a.similarityPercent;
      return normalizeStoreName(a.store.name).localeCompare(normalizeStoreName(b.store.name));
    })
    .slice(0, limit)
    .map((item) => item.store);
}

/**
 * Builds the Prisma `where` for the public store listing.
 * By default it hides closed (inactive) stores; pass `includeClosed: true` to surface them.
 * Exported for unit testing of the default-hidden behavior.
 */
export function buildPublicStoreListingWhere(filters: PublicStoreListingFilters): Prisma.StoreWhereInput {
  const {
    nameQuery,
    productTypeKeys = [],
    countryCodes = [],
    importCountryCodes = [],
    presenceTypes = [],
    receivesOrders = false,
    hasStock = false,
    includeClosed = false,
  } = filters;

  const trimmedName = nameQuery?.trim();
  const hasProductTypeFilter = productTypeKeys.length > 0;
  const hasCountryFilter = countryCodes.length > 0;
  const hasImportCountryFilter = importCountryCodes.length > 0;
  const hasPresenceFilter = presenceTypes.length > 0;

  return {
    visibility: "PUBLIC",
    status: { in: [...PUBLIC_VISIBLE_STORE_STATUSES] },
    isPrivate: false,
    // Closed stores are hidden by default; the listing exposes an opt-in "show closed" filter.
    ...(!includeClosed && { isActive: true }),
    ...(trimmedName && {
      name: { contains: trimmedName, mode: "insensitive" },
    }),
    ...(hasProductTypeFilter && {
      productTypeAssignments: {
        some: { productTypeKey: { in: productTypeKeys } },
      },
    }),
    ...(hasCountryFilter && {
      countryCode: { in: countryCodes },
    }),
    ...(hasPresenceFilter && {
      presences: {
        some: { presenceType: { in: presenceTypes } },
      },
    }),
    ...(hasImportCountryFilter && {
      importCountries: {
        some: { countryCode: { in: importCountryCodes } },
      },
    }),
    ...(receivesOrders && {
      receivesOrders: true,
    }),
    ...(hasStock && {
      hasStock: true,
    }),
  };
}

function mapPublicStoreListingItem(store: {
  slug: string;
  name: string;
  countryCode: string;
  status: StoreStatus;
  sellerType: "RETAILER" | "PERSON" | "PROXY";
  logoUrl: string | null;
  receivesOrders: boolean | null;
  hasStock: boolean | null;
  averageRating: number | null;
  reviewCount: number;
  presences: Array<{ presenceType: StorePresenceType }>;
  productTypeAssignments: Array<{ productTypeKey: string }>;
  importCountries: Array<{ countryCode: string }>;
  contactChannels: Array<{ type: StoreContactChannelType; value: string }>;
}): PublicStoreListingItem {
  return {
    slug: store.slug,
    name: store.name,
    countryCode: store.countryCode,
    status: store.status,
    sellerType: store.sellerType,
    logoUrl: store.logoUrl,
    presenceTypes: store.presences.map((p) => p.presenceType),
    productTypeKeys: store.productTypeAssignments.map((assignment) => assignment.productTypeKey),
    importCountryCodes: store.importCountries.map((country) => country.countryCode),
    contactChannels: store.contactChannels.map((channel) => ({
      type: channel.type,
      value: channel.value,
    })),
    receivesOrders: store.receivesOrders,
    hasStock: store.hasStock,
    averageRating: store.averageRating,
    reviewCount: store.reviewCount,
  };
}

export async function getPublicStoresListingPage(filters: PublicStoreListingFilters): Promise<PublicStoreListingPage> {
  const requestedPage = filters.page && Number.isInteger(filters.page) && filters.page > 0 ? filters.page : 1;
  // Hardened against arbitrary URL values: only the allow-listed options are honored.
  const requestedPageSize =
    filters.pageSize && (PAGE_SIZE_OPTIONS as readonly number[]).includes(filters.pageSize)
      ? filters.pageSize
      : DEFAULT_PUBLIC_STORE_PAGE_SIZE;
  const where = buildPublicStoreListingWhere(filters);

  const totalCount = await prisma.store.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / requestedPageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const skip = (currentPage - 1) * requestedPageSize;

  const stores = await prisma.store.findMany({
    where,
    select: {
      slug: true,
      name: true,
      countryCode: true,
      status: true,
      sellerType: true,
      logoUrl: true,
      receivesOrders: true,
      hasStock: true,
      averageRating: true,
      reviewCount: true,
      presences: { select: { presenceType: true } },
      productTypeAssignments: { select: { productTypeKey: true } },
      importCountries: { select: { countryCode: true } },
      contactChannels: {
        where: { isPublic: true },
        select: {
          type: true,
          value: true,
        },
      },
    },
    orderBy: [{ averageRating: "desc" }, { reviewCount: "desc" }, { name: "asc" }],
    skip,
    take: requestedPageSize,
  });

  return {
    items: stores.map(mapPublicStoreListingItem),
    totalCount,
    currentPage,
    pageSize: requestedPageSize,
    totalPages,
  };
}

/**
 * Light count for the listing header — reuses the same filter where-clause as
 * `getPublicStoresListingPage` (no item fetch, no duplicated filter logic) so the stores
 * page can render its count as a separate suspended unit.
 */
export async function countPublicStores(filters: PublicStoreListingFilters): Promise<number> {
  return prisma.store.count({ where: buildPublicStoreListingWhere(filters) });
}

/**
 * Returns a public store by slug for the store detail page.
 * Pending stores are included so they can be discovered in-app; inactive stores are included and should show a warning.
 * Seller-type visibility: RETAILER and PROXY expose logo, contact channels, and addresses; PERSON does not.
 */
export async function getStoreBySlug(slug: string): Promise<StoreDetail | null> {
  const store = await prisma.store.findFirst({
    where: {
      slug,
      visibility: "PUBLIC",
      status: { in: [...PUBLIC_VISIBLE_STORE_STATUSES] },
    },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      status: true,
      sellerType: true,
      countryCode: true,
      isActive: true,
      isPrivate: true,
      createdByUserId: true,
      createdAt: true,
      receivesOrders: true,
      hasStock: true,
      averageRating: true,
      reviewCount: true,
      logoUrl: true,
      presences: {
        select: {
          presenceType: true,
        },
      },
      productTypeAssignments: {
        select: {
          productTypeKey: true,
        },
      },
      importCountries: {
        select: {
          countryCode: true,
        },
      },
      contactChannels: {
        where: { isPublic: true },
        select: {
          type: true,
          value: true,
          label: true,
        },
      },
      addresses: {
        where: { isPublic: true },
        select: {
          city: true,
          addressLine: true,
          reference: true,
        },
      },
    },
  });

  if (!store) {
    return null;
  }

  const presenceTypes = store.presences.map((p) => p.presenceType);
  const productTypeKeys = store.productTypeAssignments.map((assignment) => assignment.productTypeKey);
  const importCountryCodes = store.importCountries.map((country) => country.countryCode);

  const base: StoreDetail = {
    id: store.id,
    slug: store.slug,
    name: store.name,
    description: store.description,
    status: store.status,
    sellerType: store.sellerType,
    countryCode: store.countryCode,
    isActive: store.isActive,
    isPrivate: store.isPrivate,
    createdByUserId: store.createdByUserId,
    createdAt: store.createdAt,
    receivesOrders: store.receivesOrders,
    hasStock: store.hasStock,
    averageRating: store.averageRating,
    reviewCount: store.reviewCount,
    presenceTypes,
    productTypeKeys,
    importCountryCodes,
  };

  // RETAILER and PROXY sellers expose logo, contact channels, and addresses; PERSON does not.
  if (store.sellerType !== "PERSON") {
    return {
      ...base,
      logoUrl: store.logoUrl,
      contactChannels: store.contactChannels.map((ch) => ({
        type: ch.type,
        value: ch.value,
        label: ch.label,
      })),
      addresses: store.addresses.map((a) => ({
        city: a.city,
        addressLine: a.addressLine,
        reference: a.reference,
      })),
    };
  }

  return base;
}

/**
 * Public store listing with optional filters.
 * OR within same filter family (e.g. any of selected product types), AND across families.
 * Only PUBLIC stores in a publicly visible status (`PUBLIC_VISIBLE_STORE_STATUSES`); `REJECTED` is
 * excluded. Closed (inactive) stores are hidden by default and
 * only included when `includeClosed` is set; they remain reachable by direct URL (detail page shows warning).
 */
export async function getPublicStoresListing(filters: PublicStoreListingFilters): Promise<PublicStoreListingItem[]> {
  const listingPage = await getPublicStoresListingPage(filters);
  return listingPage.items;
}

const publicStoreReviewSelect = {
  id: true,
  userId: true,
  overallRating: true,
  comment: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      name: true,
    },
  },
} as const;

const publicStoreReviewOrderBy = [{ updatedAt: "desc" as const }, { createdAt: "desc" as const }];

function mapRowsToPublicStoreReviews(
  rows: Array<{
    id: string;
    userId: string;
    overallRating: number;
    comment: string | null;
    createdAt: Date;
    updatedAt: Date;
    user: { name: string | null };
  }>,
  viewerUserId: string | undefined,
): PublicStoreReview[] {
  return rows.map((review) => ({
    id: review.id,
    overallRating: review.overallRating,
    comment: review.comment,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    authorName: review.user.name,
    isViewerReview: viewerUserId != null && review.userId === viewerUserId,
  }));
}

/**
 * Public reviews for a store, newest first among "other" reviewers.
 * When `viewerUserId` is set and that user has a review, it is always included first and counts toward `limit`;
 * remaining slots are filled with the most recently updated reviews from everyone else.
 */
export async function getPublicStoreReviews(
  storeId: string,
  viewerUserId?: string,
  limit: number = DEFAULT_PUBLIC_STORE_REVIEW_LIMIT,
): Promise<PublicStoreReview[]> {
  if (limit <= 0) {
    return [];
  }

  if (viewerUserId == null || viewerUserId === "") {
    const reviews = await prisma.storeReview.findMany({
      where: { storeId },
      select: publicStoreReviewSelect,
      orderBy: publicStoreReviewOrderBy,
      take: limit,
    });
    return mapRowsToPublicStoreReviews(reviews, undefined);
  }

  const viewerReviewRow = await prisma.storeReview.findUnique({
    where: {
      storeId_userId: {
        storeId,
        userId: viewerUserId,
      },
    },
    select: publicStoreReviewSelect,
  });

  const remainingSlots = Math.max(0, limit - (viewerReviewRow ? 1 : 0));

  const otherReviewRows =
    remainingSlots > 0
      ? await prisma.storeReview.findMany({
          where: {
            storeId,
            ...(viewerReviewRow ? { userId: { not: viewerUserId } } : {}),
          },
          select: publicStoreReviewSelect,
          orderBy: publicStoreReviewOrderBy,
          take: remainingSlots,
        })
      : [];

  const combinedRows = viewerReviewRow ? [viewerReviewRow, ...otherReviewRows] : otherReviewRows;

  return mapRowsToPublicStoreReviews(combinedRows, viewerUserId);
}

export async function getStoreViewerContext(storeId: string, userId: string): Promise<StoreViewerContext> {
  const [review, note] = await Promise.all([
    prisma.storeReview.findUnique({
      where: {
        storeId_userId: {
          storeId,
          userId,
        },
      },
      select: {
        overallRating: true,
        comment: true,
        updatedAt: true,
      },
    }),
    prisma.storeNote.findFirst({
      where: { storeId, userId },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: {
        content: true,
        updatedAt: true,
      },
    }),
  ]);

  return {
    review: review
      ? {
          overallRating: review.overallRating,
          comment: review.comment,
          updatedAt: review.updatedAt,
        }
      : null,
    note: note
      ? {
          content: note.content,
          updatedAt: note.updatedAt,
        }
      : null,
  };
}

export type ViewerStoreActivity = {
  /** Total number of orders the viewer has placed at this store. */
  ordersTotal: number;
  /** Orders that are not in a terminal state (excludes COMPLETED and CANCELLED). */
  ordersActive: number;
  /** Total spend grouped by currency. Empty array when the viewer has no orders. */
  totalSpentByCurrency: Array<{ currencyCode: string; totalMinorUnits: number }>;
};

/**
 * Aggregates the viewer's order activity at a single store for the detail-page sidebar:
 * total orders, active orders, and total spend grouped by currency.
 *
 * Only orders owned by `userId` at `storeId` are counted. Returns zeroed totals
 * when the viewer has not placed any order at this store.
 */
export async function getViewerStoreActivity(userId: string, storeId: string): Promise<ViewerStoreActivity> {
  const orders = await prisma.order.findMany({
    where: { userId, storeId },
    select: { status: true, currencyCode: true, totalCost: true },
  });

  if (orders.length === 0) {
    return { ordersTotal: 0, ordersActive: 0, totalSpentByCurrency: [] };
  }

  let ordersActive = 0;
  const spendByCurrency = new Map<string, number>();
  for (const order of orders) {
    if (order.status !== "COMPLETED" && order.status !== "CANCELLED") {
      ordersActive += 1;
    }
    const prev = spendByCurrency.get(order.currencyCode) ?? 0;
    spendByCurrency.set(order.currencyCode, prev + order.totalCost);
  }

  // Sort currencies by spend descending so the dominant currency renders first.
  const totalSpentByCurrency = Array.from(spendByCurrency.entries())
    .map(([currencyCode, totalMinorUnits]) => ({ currencyCode, totalMinorUnits }))
    .sort((a, b) => b.totalMinorUnits - a.totalMinorUnits);

  return { ordersTotal: orders.length, ordersActive, totalSpentByCurrency };
}

/**
 * Returns a map of store slug → total order count for the given viewer.
 * Only stores present in `slugs` are included; stores with zero orders are omitted.
 * Counts all orders regardless of status (OPEN, COMPLETED, CANCELLED…).
 */
export async function getViewerOrderCountsByStoreSlugs(
  userId: string,
  slugs: string[],
): Promise<Record<string, number>> {
  if (slugs.length === 0) return {};

  const orders = await prisma.order.findMany({
    where: { userId, store: { slug: { in: slugs } } },
    select: { store: { select: { slug: true } } },
  });

  const result: Record<string, number> = {};
  for (const o of orders) {
    const slug = o.store.slug;
    result[slug] = (result[slug] ?? 0) + 1;
  }
  return result;
}

/**
 * Returns the catalog of stores a collector can place a pedido at: publicly visible
 * and active, in any publicly visible moderation status (`PUBLIC_VISIBLE_STORE_STATUSES`).
 *
 * Stores are shared across users — a collector can buy from any catalog store, not
 * only the ones they created themselves. `PENDING` is included so that a user who
 * just registered a new store (which starts as `PENDING`) can immediately use it
 * without waiting for moderation. A store with open reports stays orderable too: the derived
 * report notice is informational, not a lock. This matches the public store listing query
 * in `getPublicStoresListingPage`.
 */
export async function getOrderableStores(): Promise<UserStoreOption[]> {
  return prisma.store.findMany({
    where: {
      visibility: "PUBLIC",
      status: { in: [...PUBLIC_VISIBLE_STORE_STATUSES] },
      isActive: true,
    },
    select: { id: true, name: true, countryCode: true },
    orderBy: { name: "asc" },
  });
}
