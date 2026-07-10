/**
 * Integration tests for store queries: createStore and findDuplicateCandidates.
 * Run when DATABASE_URL is set; seed must have been run (countries and store product types).
 */

import { prisma } from "@/lib/prisma";
import {
  findDuplicateCandidates,
  getPublicStoreReviews,
  getPublicStoresListing,
  getStoreBySlug,
  getStoreViewerContext,
} from "../storeQueries";
import { createStore, upsertStoreNote, upsertStoreReview } from "../storeMutations";
import { runSeed } from "../../../../../prisma/seed";
import { createTestUserData } from "@/test/createTestUserData";
import { describe, expect, it } from "vitest";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe("store queries", () => {
  it.skipIf(!hasDatabase)("createStore creates store with presences and product type assignments", async () => {
    await runSeed(prisma);

    const user = await prisma.user.create({
      data: createTestUserData({
        id: `test-store-create-${Date.now()}`,
        email: `test-store-${Date.now()}@example.com`,
        name: "Test User",
      }),
    });

    try {
      const result = await createStore({
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
      expect(store?.searchName).toBe("integration test store");
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

  it.skipIf(!hasDatabase)(
    "createStore persists business logoUrl and exposes it in the public detail read model",
    async () => {
      await runSeed(prisma);

      const user = await prisma.user.create({
        data: createTestUserData({
          id: `test-store-logo-${Date.now()}`,
          email: `store-logo-${Date.now()}@example.com`,
          name: "Logo User",
        }),
      });

      try {
        const { id, slug } = await createStore({
          name: "Logo Ready Store",
          storeType: "BUSINESS",
          countryCode: "PE",
          presenceTypes: ["ONLINE"],
          productTypeKeys: ["figures"],
          createdByUserId: user.id,
          status: "APPROVED",
          approvedByUserId: user.id,
          logoUrl: "https://cdn.example.com/store-logos/store-123.webp?v=abc123def456",
        });

        const [persistedStore, detailStore] = await Promise.all([
          prisma.store.findUnique({ where: { id } }),
          getStoreBySlug(slug),
        ]);

        expect(persistedStore?.logoUrl).toBe("https://cdn.example.com/store-logos/store-123.webp?v=abc123def456");
        expect(detailStore?.logoUrl).toBe("https://cdn.example.com/store-logos/store-123.webp?v=abc123def456");
      } finally {
        await prisma.store.deleteMany({ where: { createdByUserId: user.id } });
        await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      }
    },
  );

  it.skipIf(!hasDatabase)("createStore with APPROVED sets approvedByUserId and approvedAt", async () => {
    await runSeed(prisma);

    const user = await prisma.user.create({
      data: createTestUserData({
        id: `test-store-admin-${Date.now()}`,
        email: `admin-${Date.now()}@example.com`,
        name: "Admin User",
      }),
    });

    try {
      const result = await createStore({
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
      data: createTestUserData({
        id: `test-dup-${Date.now()}`,
        email: `dup-${Date.now()}@example.com`,
        name: "Dup Test",
      }),
    });

    try {
      const created = await createStore({
        name: "Unique Manga Shop",
        storeType: "BUSINESS",
        countryCode: "ES",
        presenceTypes: ["ONLINE"],
        productTypeKeys: ["manga"],
        createdByUserId: user.id,
        status: "PENDING",
      });

      const candidates = await findDuplicateCandidates("manga", 5);
      expect(candidates.some((c) => c.id === created.id && c.name === "Unique Manga Shop")).toBe(true);

      const empty = await findDuplicateCandidates("xyznonexistent", 5);
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
        data: createTestUserData({
          id: `test-listing-${Date.now()}`,
          email: `listing-${Date.now()}@example.com`,
          name: "Listing Test",
        }),
      });

      try {
        const a = await createStore({
          name: "Alpha Manga Shop",
          storeType: "BUSINESS",
          countryCode: "ES",
          presenceTypes: ["ONLINE"],
          productTypeKeys: ["manga"],
          createdByUserId: user.id,
          status: "APPROVED",
          approvedByUserId: user.id,
        });
        const b = await createStore({
          name: "Beta Comics Store",
          storeType: "BUSINESS",
          countryCode: "US",
          presenceTypes: ["PHYSICAL"],
          productTypeKeys: ["comics"],
          createdByUserId: user.id,
          status: "PENDING",
        });

        const all = await getPublicStoresListing({});
        expect(all.length).toBeGreaterThanOrEqual(2);
        expect(all.map((s) => s.slug).sort()).toContain(a.slug);
        expect(all.map((s) => s.slug).sort()).toContain(b.slug);

        const byName = await getPublicStoresListing({ nameQuery: "Alpha" });
        expect(byName.some((s) => s.slug === a.slug)).toBe(true);
        expect(byName.some((s) => s.slug === b.slug)).toBe(false);

        const byProductType = await getPublicStoresListing({ productTypeKeys: ["manga"] });
        expect(byProductType.some((s) => s.slug === a.slug)).toBe(true);

        const byCountry = await getPublicStoresListing({ countryCodes: ["US"] });
        expect(byCountry.some((s) => s.slug === b.slug)).toBe(true);

        const byPresence = await getPublicStoresListing({ presenceTypes: ["PHYSICAL"] });
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
      data: createTestUserData({
        id: `test-detail-${Date.now()}`,
        email: `detail-${Date.now()}@example.com`,
        name: "Detail Test",
      }),
    });

    try {
      const { slug } = await createStore({
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

      const store = await getStoreBySlug(slug);
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
      data: createTestUserData({
        id: `test-person-${Date.now()}`,
        email: `person-${Date.now()}@example.com`,
        name: "Person Test",
      }),
    });

    try {
      const { slug } = await createStore({
        name: "Person Seller",
        storeType: "PERSON",
        countryCode: "MX",
        presenceTypes: ["ONLINE"],
        productTypeKeys: ["figures"],
        createdByUserId: user.id,
        status: "APPROVED",
        approvedByUserId: user.id,
      });

      const store = await getStoreBySlug(slug);
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
      data: createTestUserData({
        id: `test-review-${Date.now()}`,
        email: `review-${Date.now()}@example.com`,
        name: "Review Author",
      }),
    });
    const secondUser = await prisma.user.create({
      data: createTestUserData({
        id: `test-review-peer-${Date.now()}`,
        email: `review-peer-${Date.now()}@example.com`,
        name: "Other Reviewer",
      }),
    });

    try {
      const { id: storeId } = await createStore({
        name: "Review Aggregate Store",
        storeType: "BUSINESS",
        countryCode: "ES",
        presenceTypes: ["ONLINE"],
        productTypeKeys: ["manga"],
        createdByUserId: user.id,
        status: "APPROVED",
        approvedByUserId: user.id,
      });

      await upsertStoreReview({
        storeId,
        userId: secondUser.id,
        overallRating: 4,
        comment: "Reliable shipping",
      });

      await upsertStoreReview({
        storeId,
        userId: user.id,
        overallRating: 4,
        comment: "Helpful service",
      });

      await upsertStoreReview({
        storeId,
        userId: user.id,
        overallRating: 3.5,
        comment: "Updated after a poor follow-up\nWith a second line",
      });

      const [store, reviews] = await Promise.all([
        prisma.store.findUnique({ where: { id: storeId } }),
        getPublicStoreReviews(storeId, user.id),
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

  it.skipIf(!hasDatabase)(
    "getPublicStoreReviews pins the viewer review first when it is not among the most recently updated reviews",
    async () => {
      await runSeed(prisma);

      const viewer = await prisma.user.create({
        data: createTestUserData({
          id: `test-review-pin-viewer-${Date.now()}`,
          email: `pinned-viewer-${Date.now()}@example.com`,
          name: "Pinned Viewer",
        }),
      });

      const otherUsers = await Promise.all(
        [1, 2, 3, 4, 5].map((index) =>
          prisma.user.create({
            data: createTestUserData({
              id: `test-review-pin-other-${Date.now()}-${index}`,
              email: `pinned-other-${Date.now()}-${index}@example.com`,
              name: `Other Reviewer ${index}`,
            }),
          }),
        ),
      );

      try {
        const { id: storeId } = await createStore({
          name: "Pinned Review Store",
          storeType: "BUSINESS",
          countryCode: "ES",
          presenceTypes: ["ONLINE"],
          productTypeKeys: ["manga"],
          createdByUserId: viewer.id,
          status: "APPROVED",
          approvedByUserId: viewer.id,
        });

        await upsertStoreReview({
          storeId,
          userId: viewer.id,
          overallRating: 3,
          comment: "Oldest updated review from viewer",
        });

        const viewerReviewRow = await prisma.storeReview.findUnique({
          where: { storeId_userId: { storeId, userId: viewer.id } },
        });
        if (!viewerReviewRow) {
          throw new Error("Expected viewer review row");
        }

        await prisma.storeReview.update({
          where: { id: viewerReviewRow.id },
          data: {
            updatedAt: new Date("2020-01-01T00:00:00.000Z"),
          },
        });

        for (const [index, otherUser] of otherUsers.entries()) {
          await upsertStoreReview({
            storeId,
            userId: otherUser.id,
            overallRating: 4,
            comment: `Other review slot ${index + 1}`,
          });

          const row = await prisma.storeReview.findUnique({
            where: { storeId_userId: { storeId, userId: otherUser.id } },
          });
          if (!row) {
            throw new Error("Expected other review row");
          }

          await prisma.storeReview.update({
            where: { id: row.id },
            data: {
              updatedAt: new Date(`2024-06-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`),
            },
          });
        }

        const reviews = await getPublicStoreReviews(storeId, viewer.id, 5);

        expect(reviews).toHaveLength(5);
        expect(reviews[0]?.isViewerReview).toBe(true);
        expect(reviews[0]?.comment).toBe("Oldest updated review from viewer");
        expect(reviews.map((review) => review.comment)).toEqual([
          "Oldest updated review from viewer",
          "Other review slot 5",
          "Other review slot 4",
          "Other review slot 3",
          "Other review slot 2",
        ]);
      } finally {
        await prisma.store.deleteMany({ where: { createdByUserId: viewer.id } });
        for (const otherUser of otherUsers) {
          await prisma.user.delete({ where: { id: otherUser.id } }).catch(() => {});
        }
        await prisma.user.delete({ where: { id: viewer.id } }).catch(() => {});
      }
    },
  );

  it.skipIf(!hasDatabase)("upsertStoreNote keeps notes private to the viewer context", async () => {
    await runSeed(prisma);

    const user = await prisma.user.create({
      data: createTestUserData({
        id: `test-note-${Date.now()}`,
        email: `note-${Date.now()}@example.com`,
        name: "Note Owner",
      }),
    });

    try {
      const { id: storeId, slug } = await createStore({
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

      await upsertStoreNote({
        storeId,
        userId: user.id,
        content: privateNoteContent,
      });

      const [viewerContext, publicStore] = await Promise.all([
        getStoreViewerContext(storeId, user.id),
        getStoreBySlug(slug),
      ]);

      expect(viewerContext.note?.content).toBe(privateNoteContent);
      expect(JSON.stringify(publicStore)).not.toContain(privateNoteContent);
    } finally {
      await prisma.store.deleteMany({ where: { createdByUserId: user.id } });
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    }
  });
});
