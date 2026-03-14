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
  createdAt: Date;
  presenceTypes: StorePresenceType[];
  categoryKeys: string[];
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
 * Returns a public, active store by slug for the store detail page.
 * Pending stores are included so they can be discovered in-app while moderation is ongoing.
 */
export async function getStoreBySlug(db: PrismaClient, slug: string): Promise<StoreDetail | null> {
  const store = await db.store.findFirst({
    where: {
      slug,
      visibility: "PUBLIC",
      isActive: true,
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
      createdAt: true,
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
    },
  });

  if (!store) {
    return null;
  }

  return {
    id: store.id,
    slug: store.slug,
    name: store.name,
    description: store.description,
    status: store.status,
    storeType: store.storeType,
    countryCode: store.countryCode,
    createdAt: store.createdAt,
    presenceTypes: store.presences.map((presence) => presence.presenceType),
    categoryKeys: store.categoryAssignments.map((assignment) => assignment.categoryKey),
  };
}
