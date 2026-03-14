/**
 * Integration tests for store queries: createStore and findDuplicateCandidates.
 * Run when DATABASE_URL is set; seed must have been run (countries and store categories).
 */

import { prisma } from "@/lib/prisma";
import { createStore, findDuplicateCandidates } from "../store";
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
});
