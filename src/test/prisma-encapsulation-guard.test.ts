import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Prisma-encapsulation regression guard.
 *
 * `.agents/rules/prisma-data-layer.mdc` requires every `prisma.<model>.<method>(...)` call to live
 * inside `src/lib/data/**` (plus `src/lib/prisma.ts` itself and the BetterAuth adapter wiring in
 * `src/lib/auth/auth.ts`). Pages, layouts, Server Actions, route handlers, React components, and
 * hooks must delegate to a data-layer query/mutation function instead of importing the Prisma
 * singleton directly. This scan catches the shape the rule's own bad example shows: a page or
 * action reaching into `@/lib/prisma` for a one-off `findUnique`/`count` instead of a named query
 * function.
 *
 * A green run here is not proof the data layer is well-organized, only that nothing under
 * `src/app`, `src/components`, or `src/hooks` imports the Prisma client directly. Tests are
 * allowed to import `prisma` for setup/assertions (per the rule) and are excluded from the scan.
 */

const SCAN_DIRS = ["src/app", "src/components", "src/hooks"];

const PRISMA_IMPORT = /from\s+["']@\/lib\/prisma["']|require\(\s*["']@\/lib\/prisma["']\s*\)/;

function isTestPath(path: string): boolean {
  return /\.test\.[tj]sx?$/.test(path) || /(?:^|\/)(?:_tests|__tests__)(?:\/|$)/.test(path);
}

function collect(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collect(full));
    } else if (/\.(ts|tsx)$/.test(full) && !isTestPath(full)) {
      out.push(full);
    }
  }
  return out;
}

function findDirectPrismaImports(): string[] {
  const hits: string[] = [];

  for (const dir of SCAN_DIRS) {
    const dirPath = join(process.cwd(), dir);
    for (const file of collect(dirPath)) {
      const source = readFileSync(file, "utf8");
      if (PRISMA_IMPORT.test(source)) {
        const relative = file.slice(file.indexOf(dir));
        hits.push(relative);
      }
    }
  }

  return hits;
}

describe("prisma-encapsulation guard", () => {
  it("has no direct @/lib/prisma import under src/app, src/components, or src/hooks", () => {
    const hits = findDirectPrismaImports();
    expect(
      hits,
      "Prisma queries must live in src/lib/data/**. Move the query into a data-layer function " +
        `and import that instead:\n${hits.join("\n")}`,
    ).toEqual([]);
  });

  it("actually scanned a nonzero number of files (self-check against a silently empty scan)", () => {
    let total = 0;
    for (const dir of SCAN_DIRS) {
      total += collect(join(process.cwd(), dir)).length;
    }
    expect(total).toBeGreaterThan(100);
  });

  it("still detects the violation shape via a fixture (proves the scan is not vacuously green)", () => {
    const fixtureBad = `
      import { prisma } from "@/lib/prisma";

      export default async function SettingsPage() {
        const user = await prisma.user.findUnique({ where: { id: "x" } });
        return user;
      }
    `;
    const fixtureGood = `
      import { getSettingsPageSnapshot } from "@/lib/data/user-settings/userSettingsQueries";

      export default async function SettingsPage() {
        const snapshot = await getSettingsPageSnapshot("x");
        return snapshot;
      }
    `;

    expect(PRISMA_IMPORT.test(fixtureBad)).toBe(true);
    expect(PRISMA_IMPORT.test(fixtureGood)).toBe(false);
  });
});
