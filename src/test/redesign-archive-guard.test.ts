import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Redesign-archive regression guard (S17 — redesign subproject decoupling).
 *
 * Hand-rolled, zero-dependency check (no ESLint plugin) that keeps the permanent project
 * INDEPENDENT of the redesign subproject. It fails the suite if, outside the preserved
 * archive, a permanent file references the subproject — by path OR by the distinctive
 * filenames of its workshop artifacts:
 *
 *  A. Path tokens: `docs/redesign` (the old location) and `subprojects/redesign`
 *     (a live link into the preserved archive, absolute or relative `../../subprojects/redesign/`).
 *  B. Workshop-artifact filenames: the design subproject's own docs — `demo-screens(.html)`,
 *     `directions.md`, `tokens.md`, `methodology.md`, `principles.md`, `lessons-learned`,
 *     `cross-cutting-changes`, `s4-gaps`, `atelier-gaps`, `voice-library`, `motion-system.md`,
 *     etc., and the `screens/…md`, `modules/…md`, `components/<Name>.md` workshop layout.
 *     None of these are permanent docs (the system graduated to `docs/design/`, e.g. tokens →
 *     `tokens-css.md`, voice → `ux-copy.md`), so a reference to one is a regressed dependency.
 *
 * The redesign subproject was implemented and graduated: its system lives in `docs/design/`,
 * its per-FRD design lives in `docs/product/.../{fdd,prototype}`, and the workshop itself was
 * preserved (not deleted) at `docs/subprojects/redesign/`. The permanent docs/rules/code must
 * be reconstructible from `docs/product/` + `docs/design/` alone and must NOT depend on the
 * subproject. A historical mention in PROSE (e.g. "decided in the redesign subproject") is
 * fine — it names no file/path, so it is not matched. A path or workshop-filename is.
 */

const ROOT = process.cwd();

// Forbidden references outside the preserved archive. `B` is filename-boundary anchored
// (preceded by start-of-line or a non-[a-z0-9_-] char) so it never matches a workshop name
// embedded in a longer permanent filename (e.g. `tokens.md` ≠ `tokens-css.md`,
// `delivery-create.md` ≠ `wo-02-delivery-create.md`).
const FORBIDDEN_PATTERNS: RegExp[] = [
  // A. path tokens
  /docs\/redesign/,
  /subprojects\/redesign/,
  /(^|[^a-z0-9_-])_notes\//,
  // B. distinctive workshop-artifact filenames (NOT generic words like "red-team"/"lessons
  // learned" used in prose — only the actual workshop file stems).
  /(^|[^a-z0-9_-])(demo-screens|cross-cutting-changes\.md|lessons-learned\.md|s4-gaps\.md|atelier-gaps\.md|assumptions-s2\.md|voice-library\.md|iteration-history\.md|directions\.md|methodology\.md|principles\.md|tokens\.md|motion-system\.md)/,
  // B. workshop folder layout (permanent docs use frd-/fdd-/wo-/bp- and components.md, not these).
  // Anchored to a backtick/quote/paren so external URLs containing `components/<Name>.md` (e.g.
  // a Material Design GitHub link) are not matched.
  /(^|[^a-z0-9_-])(screens|modules)\/[a-z][a-z0-9-]*\.md/,
  /[`'"(]components\/[A-Z][A-Za-z0-9]+\.md/,
];

function matchesForbidden(line: string): boolean {
  return FORBIDDEN_PATTERNS.some((pattern) => pattern.test(line));
}

// Roots that may legitimately reference the old token, scanned by allowlist below.
const SCAN_ROOTS = ["docs", "src", ".agents/rules", ".claude"];
const SCAN_FILES = ["AGENTS.md", "CLAUDE.md"];
const SCAN_EXTENSIONS = [".md", ".mdc", ".css", ".ts", ".tsx", ".json", ".html"];

// Minimal allowlist: the preserved subproject folder (its internal cross-references are
// frozen history) and this guard file (which names the token to forbid it).
const ALLOWLIST_PREFIXES = [
  join("docs", "subprojects", "redesign"),
  join("src", "test", "redesign-archive-guard.test.ts"),
];

function isAllowlisted(relPath: string): boolean {
  return ALLOWLIST_PREFIXES.some((prefix) => relPath === prefix || relPath.startsWith(`${prefix}/`));
}

function collect(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collect(full));
    } else if (SCAN_EXTENSIONS.some((ext) => full.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

function scan(): string[] {
  const files: string[] = [];
  for (const root of SCAN_ROOTS) {
    const full = join(ROOT, root);
    if (existsSync(full)) files.push(...collect(full));
  }
  for (const file of SCAN_FILES) {
    const full = join(ROOT, file);
    if (existsSync(full)) files.push(full);
  }

  const hits: string[] = [];
  for (const file of files) {
    const relPath = file.replace(`${ROOT}/`, "");
    if (isAllowlisted(relPath)) continue;
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        if (matchesForbidden(line)) {
          hits.push(`${relPath}:${index + 1} → ${line.trim()}`);
        }
      });
  }
  return hits;
}

describe("redesign-archive guard", () => {
  it("keeps the permanent project independent of the redesign subproject (no path or workshop-file refs)", () => {
    const hits = scan();
    expect(
      hits,
      `Permanent docs/rules/code must not depend on the redesign subproject. ` +
        `Point to the permanent home instead — docs/design/ for system content (tokens → tokens-css.md, ` +
        `voice → ux-copy.md, components → components.md) or the owning FRD's fdd/prototype — and keep at ` +
        `most a path-less, filename-less historical mention in prose:\n${hits.join("\n")}`,
    ).toEqual([]);
  });
});
