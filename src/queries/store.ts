import type {
  Prisma,
  PrismaClient,
  StoreContactChannelType,
  StorePresenceType,
  StoreStatus,
} from "../../generated/prisma/client";
import { getDuplicateMatchScore, normalizeStoreName } from "@/lib/store/duplicateMatch";
import { generateStoreSlug } from "@/lib/store/slug";

const DEFAULT_DUPLICATE_CANDIDATES_LIMIT = 5;
export const DEFAULT_PUBLIC_STORE_PAGE_SIZE = 10;

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
  countryCode: string;
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

  const stores = await db.store.findMany({
    select: { id: true, name: true, slug: true, countryCode: true, logoUrl: true },
    orderBy: { name: "asc" },
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

export interface CreateStoreInput {
  name: string;
  description?: string | null;
  storeType: "BUSINESS" | "PERSON";
  countryCode: string;
  presenceTypes: StorePresenceType[];
  productTypeKeys: string[];
  createdByUserId: string;
  status: StoreStatus;
  approvedByUserId?: string | null;
  hasStock?: boolean | null;
  receivesOrders?: boolean | null;
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
    countryCode: string;
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
    orderBy: [{ name: "asc" }],
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
      storeType: input.storeType,
      countryCode: input.countryCode,
      status: input.status,
      createdByUserId: input.createdByUserId,
      approvedByUserId: input.approvedByUserId ?? null,
      approvedAt: input.status === "APPROVED" ? new Date() : null,
      hasStock: input.hasStock ?? null,
      receivesOrders: input.receivesOrders ?? null,
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
            countryCode: a.countryCode,
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
          countryCode: true,
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
        countryCode: a.countryCode,
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
