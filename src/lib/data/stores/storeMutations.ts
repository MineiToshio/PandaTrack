import type { StorePresenceType, StoreStatus, StoreContactChannelType } from "../../../../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { generateStoreSlug } from "@/lib/store/slug";
import { normalizeStoreName } from "@/lib/store/duplicateMatch";
import type { StoreViewerNote } from "./storeQueries";

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

export interface CreateStoreInput {
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  sellerType: "RETAILER" | "PERSON" | "PROXY";
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

export interface PersistedStoreReview {
  id: string;
  overallRating: number;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
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

export interface DeleteStoreReviewInput {
  reviewId: string;
  userId: string;
}

export interface DeleteStoreReviewResult {
  slug: string;
}

/**
 * Creates a store and its presences, product type assignments, contact channels, addresses, and import countries
 * in a single transaction. Slug is generated from name; caller must ensure countryCode and productTypeKeys exist
 * in catalogs.
 */
export async function createStore(input: CreateStoreInput): Promise<{ id: string; slug: string }> {
  const slug = generateStoreSlug(input.name);
  const presenceTypes = [...new Set(input.presenceTypes)];
  const productTypeKeys = [...new Set(input.productTypeKeys)];
  const contactChannels = input.contactChannels ?? [];
  const addresses = input.addresses ?? [];
  const importCountryCodes = [...new Set(input.importCountries ?? [])];

  const store = await prisma.store.create({
    data: {
      slug,
      name: input.name.trim(),
      searchName: normalizeStoreName(input.name),
      description: input.description?.trim() || null,
      logoUrl: input.logoUrl ?? null,
      sellerType: input.sellerType,
      countryCode: input.countryCode,
      status: input.status,
      createdByUserId: input.createdByUserId,
      approvedByUserId: input.approvedByUserId ?? null,
      approvedAt: input.status === "APPROVED" ? new Date() : null,
      hasStock: input.hasStock ?? null,
      receivesOrders: input.receivesOrders ?? null,
      isPrivate: input.isPrivate === true && input.sellerType === "PERSON" ? true : false,
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

export async function upsertStoreReview(input: UpsertStoreReviewInput): Promise<PersistedStoreReview> {
  const trimmedComment = input.comment?.trim() || null;
  const RATING_PERSISTENCE_TOLERANCE = 0.001;

  return prisma.$transaction(async (tx) => {
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

/**
 * Deletes a store review owned by the given user and updates the store's review stats.
 * Returns the store slug for path revalidation. Returns null if the review was not found or not owned by the user.
 */
export async function deleteStoreReview(input: DeleteStoreReviewInput): Promise<DeleteStoreReviewResult | null> {
  const review = await prisma.storeReview.findFirst({
    where: {
      id: input.reviewId,
      userId: input.userId,
    },
    select: { storeId: true },
  });

  if (!review) {
    return null;
  }

  return prisma.$transaction(async (tx) => {
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
export async function updateStoreLogoUrl(storeId: string, logoUrl: string | null): Promise<void> {
  await prisma.store.update({
    where: { id: storeId },
    data: { logoUrl },
  });
}

/**
 * Deletes a store row by id. Used for best-effort rollback when a multi-step create flow fails
 * after the row has been inserted (e.g. logo upload failure).
 */
export async function deleteStoreById(storeId: string): Promise<void> {
  await prisma.store.delete({ where: { id: storeId } });
}

export async function upsertStoreNote(input: UpsertStoreNoteInput): Promise<StoreViewerNote> {
  const trimmedContent = input.content.trim();

  return prisma.$transaction(async (tx) => {
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
