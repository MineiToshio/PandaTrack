import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Component inventory guard.
 *
 * Hand-rolled, zero-dependency check that keeps the design-system catalog
 * (`docs/design/components.md`) in lockstep with the real component tree under
 * `src/components/{core,modules}`. It enforces the "reuse before create" rule at
 * the mechanism level: creating a new reusable component now forces the author to
 * register it in the catalog (or the suite fails), which is exactly the moment they
 * are supposed to look for something to reuse.
 *
 * Two directions are checked:
 *
 *  A. Coverage — every catalog-level component (each top-level `.tsx` directly under
 *     `core/` or `modules/`, plus each immediate subdirectory treated as one
 *     component named by its folder) must be named in the catalog. Files inside a
 *     component's own subfolder (`Modal/ModalDialog.tsx`, …) and `_tests/` folders
 *     are internal parts, not separate catalog entries, so they are not scanned.
 *
 *  B. No orphans — every `core/…` / `modules/…` component path the catalog cites
 *     must still resolve to a file or directory on disk.
 */

const COMPONENTS_DIR = join(process.cwd(), "src", "components");
const CATALOG_PATH = join(process.cwd(), "docs", "design", "components.md");

const catalog = readFileSync(CATALOG_PATH, "utf8");

function isTestDir(name: string): boolean {
  return name === "_tests" || name === "__tests__";
}

/** Catalog-level component names for one tier (`core` or `modules`). */
function collectComponents(tier: "core" | "modules"): string[] {
  const dir = join(COMPONENTS_DIR, tier);
  const names: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!isTestDir(entry)) names.push(entry);
    } else if (entry.endsWith(".tsx") && !entry.endsWith(".test.tsx")) {
      names.push(entry.replace(/\.tsx$/, ""));
    }
  }
  return names;
}

function isCataloged(name: string): boolean {
  // Escape is unnecessary for our PascalCase / lowercase folder names.
  return new RegExp(`\\b${name}\\b`).test(catalog);
}

describe("component inventory guard", () => {
  it("catalogs every core & modules component in docs/design/components.md", () => {
    const components = [...collectComponents("core"), ...collectComponents("modules")];
    const missing = components.filter((name) => !isCataloged(name));
    expect(
      missing,
      `These components are not listed in docs/design/components.md. Reuse before create — ` +
        `if a new component is warranted, register it in the catalog:\n${missing.join("\n")}`,
    ).toEqual([]);
  });

  it("has no orphan catalog entries (every referenced component path must exist)", () => {
    const tokens = catalog.match(/\b(?:core|modules)\/[A-Z][A-Za-z0-9]*(?:\.tsx)?/g) ?? [];
    const orphans = [...new Set(tokens)].filter((token) => {
      const base = token.replace(/\.tsx$/, "");
      return !existsSync(join(COMPONENTS_DIR, `${base}.tsx`)) && !existsSync(join(COMPONENTS_DIR, base));
    });
    expect(
      orphans,
      `docs/design/components.md references components that no longer exist. ` +
        `Update the catalog to match the component tree:\n${orphans.join("\n")}`,
    ).toEqual([]);
  });
});
