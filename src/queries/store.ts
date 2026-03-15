import type {
  PrismaClient,
  StoreContactChannelType,
  StorePresenceType,
  StoreStatus,
} from "../../generated/prisma/client";
import { normalizeStoreName } from "@/lib/store/duplicateMatch";
import { generateStoreSlug } from "@/lib/store/slug";

const DEFAULT_DUPLICATE_CANDIDATES_LIMIT = 10;

export interface DuplicateCandidate {
  id: string;
  name: string;
  slug: string;
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
 * Finds stores whose name matches the query (case-insensitive contains),
 * for duplicate suggestion UI. Results are limited and ordered by name.
 */
export async function findDuplicateCandidates(
  db: PrismaClient,
  nameQuery: string,
  limit: number = DEFAULT_DUPLICATE_CANDIDATES_LIMIT,
): Promise<DuplicateCandidate[]> {
  const trimmed = nameQuery.trim();
  if (!trimmed) return [];

  const stores = await db.store.findMany({
    where: {
      name: { contains: trimmed, mode: "insensitive" },
    },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
    take: limit,
  });

  const normalizedQuery = normalizeStoreName(trimmed);
  return stores.filter(
    (s) => normalizeStoreName(s.name).includes(normalizedQuery) || normalizedQuery.includes(normalizeStoreName(s.name)),
  );
}

export interface CreateStoreInput {
  name: string;
  description?: string | null;
  storeType: "BUSINESS" | "PERSON";
  countryCode: string;
  presenceTypes: StorePresenceType[];
  categoryKeys: string[];
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
  presenceTypes: StorePresenceType[];
  categoryKeys: string[];
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
  categoryKeys: string[];
  importCountryCodes: string[];
  contactChannels: Array<{ type: StoreContactChannelType; value: string }>;
  receivesOrders: boolean | null;
  hasStock: boolean | null;
  averageRating: number | null;
  reviewCount: number;
}

export interface PublicStoreListingFilters {
  nameQuery?: string;
  categoryKeys?: string[];
  countryCodes?: string[];
  importCountryCodes?: string[];
  presenceTypes?: StorePresenceType[];
  receivesOrders?: boolean;
  hasStock?: boolean;
}

/**
 * Creates a store and its presences, category assignments, contact channels, addresses, and import countries in a single transaction.
 * Slug is generated from name; caller must ensure countryCode and categoryKeys exist in catalogs.
 */
export async function createStore(db: PrismaClient, input: CreateStoreInput): Promise<{ id: string; slug: string }> {
  const slug = generateStoreSlug(input.name);
  const presenceTypes = [...new Set(input.presenceTypes)];
  const categoryKeys = [...new Set(input.categoryKeys)];
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
      categoryAssignments: {
        create: categoryKeys.map((categoryKey) => ({ categoryKey })),
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
      logoUrl: true,
      presences: {
        select: {
          presenceType: true,
        },
      },
      categoryAssignments: {
        select: {
          categoryKey: true,
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
  const categoryKeys = store.categoryAssignments.map((a) => a.categoryKey);

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
    presenceTypes,
    categoryKeys,
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
 * OR within same filter family (e.g. any of selected categories), AND across families.
 * Only PUBLIC, PENDING or APPROVED stores; isActive is not filtered so inactive stores can appear (detail page shows warning).
 */
export async function getPublicStoresListing(
  db: PrismaClient,
  filters: PublicStoreListingFilters,
): Promise<PublicStoreListingItem[]> {
  const {
    nameQuery,
    categoryKeys = [],
    countryCodes = [],
    importCountryCodes = [],
    presenceTypes = [],
    receivesOrders = false,
    hasStock = false,
  } = filters;

  const trimmedName = nameQuery?.trim();
  const hasCategoryFilter = categoryKeys.length > 0;
  const hasCountryFilter = countryCodes.length > 0;
  const hasImportCountryFilter = importCountryCodes.length > 0;
  const hasPresenceFilter = presenceTypes.length > 0;

  const stores = await db.store.findMany({
    where: {
      visibility: "PUBLIC",
      status: { in: ["PENDING", "APPROVED"] },
      ...(trimmedName && {
        name: { contains: trimmedName, mode: "insensitive" },
      }),
      ...(hasCategoryFilter && {
        categoryAssignments: {
          some: { categoryKey: { in: categoryKeys } },
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
    },
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
      categoryAssignments: { select: { categoryKey: true } },
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
  });

  return stores.map((s) => ({
    slug: s.slug,
    name: s.name,
    countryCode: s.countryCode,
    status: s.status,
    storeType: s.storeType,
    presenceTypes: s.presences.map((p) => p.presenceType),
    categoryKeys: s.categoryAssignments.map((a) => a.categoryKey),
    importCountryCodes: s.importCountries.map((country) => country.countryCode),
    contactChannels: s.contactChannels.map((channel) => ({
      type: channel.type,
      value: channel.value,
    })),
    receivesOrders: s.receivesOrders,
    hasStock: s.hasStock,
    averageRating: s.averageRating,
    reviewCount: s.reviewCount,
  }));
}
