/**
 * Integration tests for store queries: createStore and findDuplicateCandidates.
 * Run when DATABASE_URL is set; seed must have been run (countries and store product types).
 */

import { prisma } from "@/lib/prisma";
import {
  createStore,
  findDuplicateCandidates,
  getPublicStoreReviews,
  getPublicStoresListing,
  getStoreBySlug,
  getStoreViewerContext,
  upsertStoreNote,
  upsertStoreReview,
} from "../store";
import { runSeed } from "../../../prisma/seed";
import { describe, expect, it } from "vitest";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe("store queries", () => {
  it.skipIf(!hasDatabase)("createStore creates store with presences and product type assignments", async () => {
    await runSeed(prisma);

    const user = await prisma.user.create({
      data: {
        id: `test-store-create-${Date.now()}`,
        name: "Test User",
        email: `test-store-${Date.now()}@example.com`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    try {
      const result = await createStore(prisma, {
        name: "Integration Test Store",
        description: "For tests",
        storeType: "BUSINESS",
        countryCode: "ES",
        presenceTypes: ["ONLINE", "PHYSICAL"],
        productTypeKeys: ["manga", "comics"],
        createdByUserId: user.id,
        status: "PENDING",
      });

      expect(result.slug).toMatch(/^integration-test-store-[a-f0-9]{6}$/);
      expect(result.id).toBeDefined();

      const store = await prisma.store.findUnique({
        where: { id: result.id },
        include: { presences: true, productTypeAssignments: true },
      });
      expect(store).not.toBeNull();
      expect(store?.name).toBe("Integration Test Store");
      expect(store?.status).toBe("PENDING");
      expect(store?.presences).toHaveLength(2);
      expect(store?.presences.map((p) => p.presenceType).sort()).toEqual(["ONLINE", "PHYSICAL"]);
      expect(store?.productTypeAssignments.map((assignment) => assignment.productTypeKey).sort()).toEqual([
        "comics",
        "manga",
      ]);
    } finally {
      await prisma.store.deleteMany({ where: { createdByUserId: user.id } });
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    }
  });

  it.skipIf(!hasDatabase)("createStore with APPROVED sets approvedByUserId and approvedAt", async () => {
    await runSeed(prisma);

    const user = await prisma.user.create({
      data: {
        id: `test-store-admin-${Date.now()}`,
        name: "Admin User",
        email: `admin-${Date.now()}@example.com`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    try {
      const result = await createStore(prisma, {
        name: "Admin Created Store",
        storeType: "PERSON",
        countryCode: "US",
        presenceTypes: ["ONLINE"],
        productTypeKeys: ["figures"],
        createdByUserId: user.id,
        status: "APPROVED",
        approvedByUserId: user.id,
      });

      const store = await prisma.store.findUnique({ where: { id: result.id } });
      expect(store?.status).toBe("APPROVED");
      expect(store?.approvedByUserId).toBe(user.id);
      expect(store?.approvedAt).toBeInstanceOf(Date);
    } finally {
      await prisma.store.deleteMany({ where: { createdByUserId: user.id } });
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    }
  });

  it.skipIf(!hasDatabase)("findDuplicateCandidates returns stores matching name query", async () => {
    await runSeed(prisma);

    const user = await prisma.user.create({
      data: {
        id: `test-dup-${Date.now()}`,
        name: "Dup Test",
        email: `dup-${Date.now()}@example.com`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    try {
      const created = await createStore(prisma, {
        name: "Unique Manga Shop",
        storeType: "BUSINESS",
        countryCode: "ES",
        presenceTypes: ["ONLINE"],
        productTypeKeys: ["manga"],
        createdByUserId: user.id,
        status: "PENDING",
      });

      const candidates = await findDuplicateCandidates(prisma, "manga", 5);
      expect(candidates.some((c) => c.id === created.id && c.name === "Unique Manga Shop")).toBe(true);

      const empty = await findDuplicateCandidates(prisma, "xyznonexistent", 5);
      expect(empty.length).toBe(0);
    } finally {
      await prisma.store.deleteMany({ where: { createdByUserId: user.id } });
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    }
  });

  it.skipIf(!hasDatabase)(
    "getPublicStoresListing returns PUBLIC PENDING/APPROVED stores and applies filters",
    async () => {
      await runSeed(prisma);

      const user = await prisma.user.create({
        data: {
          id: `test-listing-${Date.now()}`,
          name: "Listing Test",
          email: `listing-${Date.now()}@example.com`,
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      try {
        const a = await createStore(prisma, {
          name: "Alpha Manga Shop",
          storeType: "BUSINESS",
          countryCode: "ES",
          presenceTypes: ["ONLINE"],
          productTypeKeys: ["manga"],
          createdByUserId: user.id,
          status: "APPROVED",
          approvedByUserId: user.id,
        });
        const b = await createStore(prisma, {
          name: "Beta Comics Store",
          storeType: "BUSINESS",
          countryCode: "US",
          presenceTypes: ["PHYSICAL"],
          productTypeKeys: ["comics"],
          createdByUserId: user.id,
          status: "PENDING",
        });

        const all = await getPublicStoresListing(prisma, {});
        expect(all.length).toBeGreaterThanOrEqual(2);
        expect(all.map((s) => s.slug).sort()).toContain(a.slug);
        expect(all.map((s) => s.slug).sort()).toContain(b.slug);

        const byName = await getPublicStoresListing(prisma, { nameQuery: "Alpha" });
        expect(byName.some((s) => s.slug === a.slug)).toBe(true);
        expect(byName.some((s) => s.slug === b.slug)).toBe(false);

        const byProductType = await getPublicStoresListing(prisma, { productTypeKeys: ["manga"] });
        expect(byProductType.some((s) => s.slug === a.slug)).toBe(true);

        const byCountry = await getPublicStoresListing(prisma, { countryCodes: ["US"] });
        expect(byCountry.some((s) => s.slug === b.slug)).toBe(true);

        const byPresence = await getPublicStoresListing(prisma, { presenceTypes: ["PHYSICAL"] });
        expect(byPresence.some((s) => s.slug === b.slug)).toBe(true);
      } finally {
        await prisma.store.deleteMany({ where: { createdByUserId: user.id } });
        await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      }
    },
  );

  it.skipIf(!hasDatabase)("getStoreBySlug returns isActive and BUSINESS-only fields for business stores", async () => {
    await runSeed(prisma);

    const user = await prisma.user.create({
      data: {
        id: `test-detail-${Date.now()}`,
        name: "Detail Test",
        email: `detail-${Date.now()}@example.com`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    try {
      const { slug } = await createStore(prisma, {
        name: "Business With Contact",
        storeType: "BUSINESS",
        countryCode: "ES",
        presenceTypes: ["ONLINE"],
        productTypeKeys: ["manga"],
        createdByUserId: user.id,
        status: "APPROVED",
        approvedByUserId: user.id,
        contactChannels: [{ type: "EMAIL", value: "test@example.com" }],
      });

      const store = await getStoreBySlug(prisma, slug);
      expect(store).not.toBeNull();
      expect(store?.isActive).toBe(true);
      expect(store?.storeType).toBe("BUSINESS");
      expect(store?.contactChannels).toHaveLength(1);
      expect(store?.contactChannels?.[0].type).toBe("EMAIL");
      expect(store?.contactChannels?.[0].value).toBe("test@example.com");
    } finally {
      await prisma.store.deleteMany({ where: { createdByUserId: user.id } });
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    }
  });

  it.skipIf(!hasDatabase)("getStoreBySlug does not return contactChannels or addresses for PERSON stores", async () => {
    await runSeed(prisma);

    const user = await prisma.user.create({
      data: {
        id: `test-person-${Date.now()}`,
        name: "Person Test",
        email: `person-${Date.now()}@example.com`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    try {
      const { slug } = await createStore(prisma, {
        name: "Person Seller",
        storeType: "PERSON",
        countryCode: "MX",
        presenceTypes: ["ONLINE"],
        productTypeKeys: ["figures"],
        createdByUserId: user.id,
        status: "APPROVED",
        approvedByUserId: user.id,
      });

      const store = await getStoreBySlug(prisma, slug);
      expect(store).not.toBeNull();
      expect(store?.storeType).toBe("PERSON");
      expect(store?.contactChannels).toBeUndefined();
      expect(store?.addresses).toBeUndefined();
      expect(store?.logoUrl).toBeUndefined();
    } finally {
      await prisma.store.deleteMany({ where: { createdByUserId: user.id } });
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    }
  });

  it.skipIf(!hasDatabase)("upsertStoreReview updates the existing review and store aggregates", async () => {
    await runSeed(prisma);

    const user = await prisma.user.create({
      data: {
        id: `test-review-${Date.now()}`,
        name: "Review Author",
        email: `review-${Date.now()}@example.com`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const secondUser = await prisma.user.create({
      data: {
        id: `test-review-peer-${Date.now()}`,
        name: "Other Reviewer",
        email: `review-peer-${Date.now()}@example.com`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    try {
      const { id: storeId } = await createStore(prisma, {
        name: "Review Aggregate Store",
        storeType: "BUSINESS",
        countryCode: "ES",
        presenceTypes: ["ONLINE"],
        productTypeKeys: ["manga"],
        createdByUserId: user.id,
        status: "APPROVED",
        approvedByUserId: user.id,
      });

      await upsertStoreReview(prisma, {
        storeId,
        userId: secondUser.id,
        overallRating: 4,
        comment: "Reliable shipping",
      });

      await upsertStoreReview(prisma, {
        storeId,
        userId: user.id,
        overallRating: 4,
        comment: "Helpful service",
      });

      await upsertStoreReview(prisma, {
        storeId,
        userId: user.id,
        overallRating: 3.5,
        comment: "Updated after a poor follow-up\nWith a second line",
      });

      const [store, reviews] = await Promise.all([
        prisma.store.findUnique({ where: { id: storeId } }),
        getPublicStoreReviews(prisma, storeId, user.id),
      ]);

      expect(store?.reviewCount).toBe(2);
      expect(store?.averageRating).toBeCloseTo(3.75);
      expect(reviews).toHaveLength(2);
      expect(reviews[0]?.isViewerReview).toBe(true);
      expect(reviews[0]?.overallRating).toBe(3.5);
      expect(reviews[0]?.comment).toBe("Updated after a poor follow-up\nWith a second line");
      expect(reviews[0]?.authorName).toBe("Review Author");
      expect(reviews[1]?.isViewerReview).toBe(false);
    } finally {
      await prisma.store.deleteMany({ where: { createdByUserId: user.id } });
      await prisma.user.delete({ where: { id: secondUser.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    }
  });

  it.skipIf(!hasDatabase)("upsertStoreNote keeps notes private to the viewer context", async () => {
    await runSeed(prisma);

    const user = await prisma.user.create({
      data: {
        id: `test-note-${Date.now()}`,
        name: "Note Owner",
        email: `note-${Date.now()}@example.com`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    try {
      const { id: storeId, slug } = await createStore(prisma, {
        name: "Private Note Store",
        storeType: "BUSINESS",
        countryCode: "MX",
        presenceTypes: ["ONLINE"],
        productTypeKeys: ["figures"],
        createdByUserId: user.id,
        status: "APPROVED",
        approvedByUserId: user.id,
      });

      const privateNoteContent = "Only I should see this reminder.";

      await upsertStoreNote(prisma, {
        storeId,
        userId: user.id,
        content: privateNoteContent,
      });

      const [viewerContext, publicStore] = await Promise.all([
        getStoreViewerContext(prisma, storeId, user.id),
        getStoreBySlug(prisma, slug),
      ]);

      expect(viewerContext.note?.content).toBe(privateNoteContent);
      expect(JSON.stringify(publicStore)).not.toContain(privateNoteContent);
    } finally {
      await prisma.store.deleteMany({ where: { createdByUserId: user.id } });
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    }
  });
});
