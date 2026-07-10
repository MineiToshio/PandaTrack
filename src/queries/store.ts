import type {
  Prisma,
  PrismaClient,
  StoreContactChannelType,
  StorePresenceType,
  StoreStatus,
} from "../../generated/prisma/client";
import {
  getDuplicateMatchScore,
  getSimilarityPercent,
  normalizeStoreName,
  SIMILARITY_THRESHOLD_PERCENT,
} from "@/lib/store/duplicateMatch";
import { generateStoreSlug } from "@/lib/store/slug";

const DEFAULT_DUPLICATE_CANDIDATES_LIMIT = 5;
export const DEFAULT_PUBLIC_STORE_PAGE_SIZE = 12;
const DEFAULT_PUBLIC_STORE_REVIEW_LIMIT = 10;

/**
 * Hard cap on rows scanned for in-memory duplicate scoring. Bounds the query so a large
 * store table can never be loaded in full, while staying well above the handful of
 * candidates the scorer ultimately returns.
 */
const MAX_DUPLICATE_SCAN = 200;
const MIN_DUPLICATE_TERM_LENGTH = 2;

/**
 * Builds a name pre-filter so only rows that share a query token (or the whole query)
 * are fetched, instead of loading every store and scoring it in memory. Returns `null`
 * when the query yields no usable term, so the caller can skip the DB hit entirely.
 */
function buildDuplicateNameFilter(trimmedQuery: string): Prisma.StoreWhereInput | null {
  const normalized = normalizeStoreName(trimmedQuery);
  if (!normalized) return null;

  const terms = new Set<string>();
  for (const token of normalized.split(" ")) {
    if (token.length >= MIN_DUPLICATE_TERM_LENGTH) terms.add(token);
  }
  if (normalized.length >= MIN_DUPLICATE_TERM_LENGTH) terms.add(normalized);
  if (terms.size === 0) return null;

  return {
    OR: Array.from(terms).map((term) => ({
      name: { contains: term, mode: "insensitive" as const },
    })),
  };
}

export interface DuplicateCandidate {
  id: string;
  name: string;
  slug: string;
  countryCode: string;
  logoUrl: string | null;
}

export interface ContactChannelInput {
  type: StoreContactChannelType;
  value: string;
  label?: string | null;
}

export interface AddressInput {
  city?: string | null;
  addressLine: string;
  reference?: string | null;
  isPrimary?: boolean;
}

/**
 * Finds likely duplicate stores for the provided query using normalized and token-based matching.
 * Results are sorted by best match score first and then by name.
 */
export async function findDuplicateCandidates(
  db: PrismaClient,
  nameQuery: string,
  limit: number = DEFAULT_DUPLICATE_CANDIDATES_LIMIT,
): Promise<DuplicateCandidate[]> {
  const trimmed = nameQuery.trim();
  if (!trimmed) return [];

  const nameFilter = buildDuplicateNameFilter(trimmed);
  if (!nameFilter) return [];

  const stores = await db.store.findMany({
    where: nameFilter,
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
  db: PrismaClient,
  nameQuery: string,
  countryCode: string,
  limit: number = DEFAULT_DUPLICATE_CANDIDATES_LIMIT,
  minSimilarityPercent: number = SIMILARITY_THRESHOLD_PERCENT,
): Promise<DuplicateCandidate[]> {
  const trimmed = nameQuery.trim();
  if (!trimmed || !countryCode) return [];

  const nameFilter = buildDuplicateNameFilter(trimmed);
  if (!nameFilter) return [];

  const stores = await db.store.findMany({
    where: { countryCode, ...nameFilter },
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

export interface CreateStoreInput {
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  storeType: "BUSINESS" | "PERSON";
  countryCode: string;
  presenceTypes: StorePresenceType[];
  productTypeKeys: string[];
  createdByUserId: string;
  status: StoreStatus;
  approvedByUserId?: string | null;
  hasStock?: boolean | null;
  receivesOrders?: boolean | null;
  isPrivate?: boolean;
  contactChannels?: ContactChannelInput[];
  addresses?: AddressInput[];
  importCountries?: string[];
}

export interface StoreDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: StoreStatus;
  storeType: "BUSINESS" | "PERSON";
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
  /** Only for BUSINESS stores; PERSON stores do not expose these. */
  logoUrl?: string | null;
  /** Only for BUSINESS stores; public channels only. */
  contactChannels?: Array<{ type: StoreContactChannelType; value: string; label?: string | null }>;
  /** Only for BUSINESS stores; public addresses only. */
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
  storeType: "BUSINESS" | "PERSON";
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

export interface PersistedStoreReview {
  id: string;
  overallRating: number;
  comment: string | null;
  createdAt: Date;
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

export interface UpsertStoreReviewInput {
  storeId: string;
  userId: string;
  overallRating: number;
  comment?: string | null;
}

export interface UpsertStoreNoteInput {
  storeId: string;
  userId: string;
  content: string;
}

function buildPublicStoreListingWhere(filters: PublicStoreListingFilters): Prisma.StoreWhereInput {
  const {
    nameQuery,
    productTypeKeys = [],
    countryCodes = [],
    importCountryCodes = [],
    presenceTypes = [],
    receivesOrders = false,
    hasStock = false,
  } = filters;

  const trimmedName = nameQuery?.trim();
  const hasProductTypeFilter = productTypeKeys.length > 0;
  const hasCountryFilter = countryCodes.length > 0;
  const hasImportCountryFilter = importCountryCodes.length > 0;
  const hasPresenceFilter = presenceTypes.length > 0;

  return {
    visibility: "PUBLIC",
    status: { in: ["PENDING", "APPROVED"] },
    isPrivate: false,
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
  storeType: "BUSINESS" | "PERSON";
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
    storeType: store.storeType,
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

export async function getPublicStoresListingPage(
  db: PrismaClient,
  filters: PublicStoreListingFilters,
): Promise<PublicStoreListingPage> {
  const requestedPage = filters.page && Number.isInteger(filters.page) && filters.page > 0 ? filters.page : 1;
  const requestedPageSize =
    filters.pageSize && Number.isInteger(filters.pageSize) && filters.pageSize > 0
      ? filters.pageSize
      : DEFAULT_PUBLIC_STORE_PAGE_SIZE;
  const where = buildPublicStoreListingWhere(filters);

  const totalCount = await db.store.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / requestedPageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const skip = (currentPage - 1) * requestedPageSize;

  const stores = await db.store.findMany({
    where,
    select: {
      slug: true,
      name: true,
      countryCode: true,
      status: true,
      storeType: true,
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
 * page can render its count as a separate suspended unit (S10 list-loading pattern, L080).
 */
export async function countPublicStores(db: PrismaClient, filters: PublicStoreListingFilters): Promise<number> {
  return db.store.count({ where: buildPublicStoreListingWhere(filters) });
}

/**
 * Creates a store and its presences, product type assignments, contact channels, addresses, and import countries
 * in a single transaction. Slug is generated from name; caller must ensure countryCode and productTypeKeys exist
 * in catalogs.
 */
export async function createStore(db: PrismaClient, input: CreateStoreInput): Promise<{ id: string; slug: string }> {
  const slug = generateStoreSlug(input.name);
  const presenceTypes = [...new Set(input.presenceTypes)];
  const productTypeKeys = [...new Set(input.productTypeKeys)];
  const contactChannels = input.contactChannels ?? [];
  const addresses = input.addresses ?? [];
  const importCountryCodes = [...new Set(input.importCountries ?? [])];

  const store = await db.store.create({
    data: {
      slug,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      logoUrl: input.logoUrl ?? null,
      storeType: input.storeType,
      countryCode: input.countryCode,
      status: input.status,
      createdByUserId: input.createdByUserId,
      approvedByUserId: input.approvedByUserId ?? null,
      approvedAt: input.status === "APPROVED" ? new Date() : null,
      hasStock: input.hasStock ?? null,
      receivesOrders: input.receivesOrders ?? null,
      isPrivate: input.isPrivate === true && input.storeType === "PERSON" ? true : false,
      presences: {
        create: presenceTypes.map((presenceType) => ({ presenceType })),
      },
      productTypeAssignments: {
        create: productTypeKeys.map((productTypeKey) => ({ productTypeKey })),
      },
      ...(contactChannels.length > 0 && {
        contactChannels: {
          create: contactChannels.map((ch) => ({
            type: ch.type,
            value: ch.value.trim(),
            label: ch.label?.trim() || null,
            isPrimary: false,
          })),
        },
      }),
      ...(addresses.length > 0 && {
        addresses: {
          create: addresses.map((a, i) => ({
            city: a.city?.trim() || null,
            addressLine: a.addressLine.trim(),
            reference: a.reference?.trim() || null,
            isPrimary: a.isPrimary ?? i === 0,
          })),
        },
      }),
      ...(importCountryCodes.length > 0 && {
        importCountries: {
          create: importCountryCodes.map((countryCode) => ({ countryCode })),
        },
      }),
    },
    select: { id: true, slug: true },
  });

  return { id: store.id, slug: store.slug };
}

/**
 * Returns a public store by slug for the store detail page.
 * Pending stores are included so they can be discovered in-app; inactive stores are included and should show a warning.
 * Business vs person visibility: BUSINESS exposes logo, contact channels, and addresses; PERSON does not.
 */
export async function getStoreBySlug(db: PrismaClient, slug: string): Promise<StoreDetail | null> {
  const store = await db.store.findFirst({
    where: {
      slug,
      visibility: "PUBLIC",
      status: { in: ["PENDING", "APPROVED"] },
    },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      status: true,
      storeType: true,
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
    storeType: store.storeType,
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

  if (store.storeType === "BUSINESS") {
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
 * Only PUBLIC, PENDING or APPROVED stores; isActive is not filtered so inactive stores can appear (detail page shows warning).
 */
export async function getPublicStoresListing(
  db: PrismaClient,
  filters: PublicStoreListingFilters,
): Promise<PublicStoreListingItem[]> {
  const listingPage = await getPublicStoresListingPage(db, filters);
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
  db: PrismaClient,
  storeId: string,
  viewerUserId?: string,
  limit: number = DEFAULT_PUBLIC_STORE_REVIEW_LIMIT,
): Promise<PublicStoreReview[]> {
  if (limit <= 0) {
    return [];
  }

  if (viewerUserId == null || viewerUserId === "") {
    const reviews = await db.storeReview.findMany({
      where: { storeId },
      select: publicStoreReviewSelect,
      orderBy: publicStoreReviewOrderBy,
      take: limit,
    });
    return mapRowsToPublicStoreReviews(reviews, undefined);
  }

  const viewerReviewRow = await db.storeReview.findUnique({
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
      ? await db.storeReview.findMany({
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

export async function getStoreViewerContext(
  db: PrismaClient,
  storeId: string,
  userId: string,
): Promise<StoreViewerContext> {
  const [review, note] = await Promise.all([
    db.storeReview.findUnique({
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
    db.storeNote.findFirst({
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

export async function upsertStoreReview(
  db: PrismaClient,
  input: UpsertStoreReviewInput,
): Promise<PersistedStoreReview> {
  const trimmedComment = input.comment?.trim() || null;
  const RATING_PERSISTENCE_TOLERANCE = 0.001;

  return db.$transaction(async (tx) => {
    await tx.store.findUniqueOrThrow({
      where: { id: input.storeId },
      select: { id: true },
    });

    let review = await tx.storeReview.upsert({
      where: {
        storeId_userId: {
          storeId: input.storeId,
          userId: input.userId,
        },
      },
      update: {
        overallRating: input.overallRating,
        comment: trimmedComment,
      },
      create: {
        storeId: input.storeId,
        userId: input.userId,
        overallRating: input.overallRating,
        comment: trimmedComment,
      },
      select: {
        id: true,
        overallRating: true,
        comment: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const persistedRatingMismatch = Math.abs(review.overallRating - input.overallRating) > RATING_PERSISTENCE_TOLERANCE;

    if (persistedRatingMismatch) {
      await tx.$executeRaw`
        UPDATE "store_review"
        SET "overallRating" = ${input.overallRating}
        WHERE "storeId" = ${input.storeId} AND "userId" = ${input.userId}
      `;

      review = await tx.storeReview.findUniqueOrThrow({
        where: {
          storeId_userId: {
            storeId: input.storeId,
            userId: input.userId,
          },
        },
        select: {
          id: true,
          overallRating: true,
          comment: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    const [reviewCount, reviewAggregate] = await Promise.all([
      tx.storeReview.count({
        where: { storeId: input.storeId },
      }),
      tx.storeReview.aggregate({
        where: { storeId: input.storeId },
        _avg: {
          overallRating: true,
        },
      }),
    ]);

    await tx.store.update({
      where: { id: input.storeId },
      data: {
        reviewCount,
        averageRating: reviewAggregate._avg.overallRating,
      },
    });

    return {
      id: review.id,
      overallRating: review.overallRating,
      comment: review.comment,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    };
  });
}

export interface DeleteStoreReviewInput {
  reviewId: string;
  userId: string;
}

export interface DeleteStoreReviewResult {
  slug: string;
}

/**
 * Deletes a store review owned by the given user and updates the store's review stats.
 * Returns the store slug for path revalidation. Returns null if the review was not found or not owned by the user.
 */
export async function deleteStoreReview(
  db: PrismaClient,
  input: DeleteStoreReviewInput,
): Promise<DeleteStoreReviewResult | null> {
  const review = await db.storeReview.findFirst({
    where: {
      id: input.reviewId,
      userId: input.userId,
    },
    select: { storeId: true },
  });

  if (!review) {
    return null;
  }

  return db.$transaction(async (tx) => {
    await tx.storeReview.delete({
      where: { id: input.reviewId },
    });

    const [reviewCount, reviewAggregate] = await Promise.all([
      tx.storeReview.count({
        where: { storeId: review.storeId },
      }),
      tx.storeReview.aggregate({
        where: { storeId: review.storeId },
        _avg: {
          overallRating: true,
        },
      }),
    ]);

    const store = await tx.store.update({
      where: { id: review.storeId },
      data: {
        reviewCount,
        averageRating: reviewAggregate._avg.overallRating,
      },
      select: { slug: true },
    });

    return { slug: store.slug };
  });
}

/**
 * Updates the stored logo URL for a store. Used after a successful logo upload to persist the final URL.
 */
export async function updateStoreLogoUrl(db: PrismaClient, storeId: string, logoUrl: string | null): Promise<void> {
  await db.store.update({
    where: { id: storeId },
    data: { logoUrl },
  });
}

/**
 * Deletes a store row by id. Used for best-effort rollback when a multi-step create flow fails
 * after the row has been inserted (e.g. logo upload failure).
 */
export async function deleteStoreById(db: PrismaClient, storeId: string): Promise<void> {
  await db.store.delete({ where: { id: storeId } });
}

export async function upsertStoreNote(db: PrismaClient, input: UpsertStoreNoteInput): Promise<StoreViewerNote> {
  const trimmedContent = input.content.trim();

  return db.$transaction(async (tx) => {
    await tx.store.findUniqueOrThrow({
      where: { id: input.storeId },
      select: { id: true },
    });

    // Keep one editable note per user/store until the database enforces note uniqueness.
    const existingNote = await tx.storeNote.findFirst({
      where: {
        storeId: input.storeId,
        userId: input.userId,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    });

    const note = existingNote
      ? await tx.storeNote.update({
          where: { id: existingNote.id },
          data: { content: trimmedContent },
          select: {
            content: true,
            updatedAt: true,
          },
        })
      : await tx.storeNote.create({
          data: {
            storeId: input.storeId,
            userId: input.userId,
            content: trimmedContent,
          },
          select: {
            content: true,
            updatedAt: true,
          },
        });

    return {
      content: note.content,
      updatedAt: note.updatedAt,
    };
  });
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
export async function getViewerStoreActivity(
  db: PrismaClient,
  userId: string,
  storeId: string,
): Promise<ViewerStoreActivity> {
  const orders = await db.order.findMany({
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
  db: PrismaClient,
  userId: string,
  slugs: string[],
): Promise<Record<string, number>> {
  if (slugs.length === 0) return {};

  const orders = await db.order.findMany({
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
