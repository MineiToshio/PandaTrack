/**
 * Integration tests for store queries: createStore and findDuplicateCandidates.
 * Run when DATABASE_URL is set; seed must have been run (countries and store categories).
 */

import { prisma } from "@/lib/prisma";
import { createStore, findDuplicateCandidates, getPublicStoresListing, getStoreBySlug } from "../store";
import { runSeed } from "../../../prisma/seed";
import { describe, expect, it } from "vitest";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe("store queries", () => {
  it.skipIf(!hasDatabase)("createStore creates store with presences and category assignments", async () => {
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
        categoryKeys: ["manga", "comics"],
        createdByUserId: user.id,
        status: "PENDING",
      });

      expect(result.slug).toMatch(/^integration-test-store-[a-f0-9]{6}$/);
      expect(result.id).toBeDefined();

      const store = await prisma.store.findUnique({
        where: { id: result.id },
        include: { presences: true, categoryAssignments: true },
      });
      expect(store).not.toBeNull();
      expect(store?.name).toBe("Integration Test Store");
      expect(store?.status).toBe("PENDING");
      expect(store?.presences).toHaveLength(2);
      expect(store?.presences.map((p) => p.presenceType).sort()).toEqual(["ONLINE", "PHYSICAL"]);
      expect(store?.categoryAssignments.map((a) => a.categoryKey).sort()).toEqual(["comics", "manga"]);
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
        categoryKeys: ["figures"],
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
        categoryKeys: ["manga"],
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
          categoryKeys: ["manga"],
          createdByUserId: user.id,
          status: "APPROVED",
          approvedByUserId: user.id,
        });
        const b = await createStore(prisma, {
          name: "Beta Comics Store",
          storeType: "BUSINESS",
          countryCode: "US",
          presenceTypes: ["PHYSICAL"],
          categoryKeys: ["comics"],
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

        const byCategory = await getPublicStoresListing(prisma, { categoryKeys: ["manga"] });
        expect(byCategory.some((s) => s.slug === a.slug)).toBe(true);

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
        categoryKeys: ["manga"],
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
        categoryKeys: ["figures"],
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
});
