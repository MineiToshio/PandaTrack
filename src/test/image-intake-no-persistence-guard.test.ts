import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve as resolvePathAbs, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Order image intake no-persistence guard.
 *
 * The image-intake feature separates producing an order draft from persisting one: extraction
 * modules turn a photo into a draft, the review screen renders it for a human to check, and only a
 * separate save action ever writes the order tables. This guard is the automated version of that
 * boundary: extraction and persistence must never be reachable from one file, so the review
 * screen's human confirmation can never be skipped by accident. This is a hand-rolled,
 * zero-dependency check (same pattern as `em-dash-copy-guard.test.ts`) that fails loudly the
 * moment that boundary is crossed, either by
 * importing a real mutation, calling `prisma.order*` directly, using raw SQL to write the same
 * tables, leaking the shared Gemini API key into client-bundled code, or letting a Server Action
 * skip its own identity check.
 *
 * Every check below runs against every file in its scanned directory: there is no basename
 * exemption. `mapDraftToOrderCreate.ts` (the one file allowed to shape a confirmed draft into
 * order/payment mutation *input types*) is not special-cased out of these checks; it simply never
 * matches any of the banned patterns, because its only imports are draft/order *type and schema*
 * modules, never `@/lib/prisma`, a mutation module, or a raw model write. If a legitimate future
 * change to that file needs an import that trips one of these patterns, the fix is to move the
 * persistence-shaped code to where persistence is allowed (the save action), not to carve a
 * basename exception back into this guard.
 */

const REPO_ROOT = process.cwd();
const IMAGE_INTAKE_DIR = join(REPO_ROOT, "src", "lib", "imageIntake");
const IMAGE_INTAKE_DATA_DIR = join(REPO_ROOT, "src", "lib", "data", "imageIntake");
const SRC_DIR = join(REPO_ROOT, "src");
const SRC_TEST_DIR = join(REPO_ROOT, "src", "test");
const NEXT_CONFIG_PATH = join(REPO_ROOT, "next.config.ts");
const GUARD_FILE_PATH = join(REPO_ROOT, "src", "test", "image-intake-no-persistence-guard.test.ts");

// The one file allowed to import both the extraction action and the save action: the client
// coordinator that owns the review screen's "extract, let the user confirm, then save" sequence.
// See the co-location check below for why this is the sole exception rather than a relaxed rule.
const IMAGE_INTAKE_SCREEN_PATH = join(
  REPO_ROOT,
  "src",
  "app",
  "[locale]",
  "(app)",
  "orders",
  "new",
  "image",
  "_components",
  "ImageIntakeScreen.tsx",
);

// Target module paths, resolved once and compared by absolute path (never by the specifier's own
// spelling). Extension-free on purpose: a resolved import specifier never carries `.ts`/`.tsx`
// either, so comparing both sides bare is what makes `@/lib/prisma`, `../../../../lib/prisma`, and
// (from a file already inside src/lib/) a shallow `../prisma` all resolve to the same value.
const PRISMA_SINGLETON_MODULE_PATH = join(REPO_ROOT, "src", "lib", "prisma");
const EXTRACTION_ENGINE_MODULE_PATH = join(IMAGE_INTAKE_DIR, "extractionEngine");
const GEMINI_PROVIDER_MODULE_PATH = join(IMAGE_INTAKE_DIR, "geminiProvider");
const VALIDATE_UPLOAD_MODULE_PATH = join(IMAGE_INTAKE_DIR, "validateUpload");
const DRAFT_SCHEMA_MODULE_PATH = join(IMAGE_INTAKE_DIR, "draftSchema");
const ORDERS_ACTIONS_DIR = join(REPO_ROOT, "src", "app", "[locale]", "(app)", "orders", "_actions");
const EXTRACT_ACTION_MODULE_PATH = join(ORDERS_ACTIONS_DIR, "imageIntakeExtractAction");
const SAVE_ACTION_MODULE_PATH = join(ORDERS_ACTIONS_DIR, "imageIntakeSaveAction");
const ORDERS_MUTATIONS_DIR = join(REPO_ROOT, "src", "lib", "data", "orders");
const DELIVERIES_MUTATIONS_DIR = join(REPO_ROOT, "src", "lib", "data", "deliveries");

const PRISMA_MODULE_STRING = "@/lib/prisma";

const SKIPPED_DIR_NAMES = new Set(["_tests", "__tests__", "node_modules"]);

/**
 * Every quoted specifier in `content`, resolved to an absolute filesystem path (extension-free)
 * when it is an `@/`-aliased or relative module reference. This is what makes every module-identity
 * check below immune to how the evasion spells the specifier: the `@/` alias, a relative path of
 * any depth, or a same-directory relative path all resolve to the exact same absolute path once run
 * through `path.resolve`, so a check written against that one absolute path catches all of them
 * without enumerating each spelling. Matched as a bare quoted string (no `from`/`import(`/`require(`
 * prefix required) so a dynamic `import(...)` or a `require(...)` is covered the same way a static
 * `import ... from` is.
 *
 * Bare package specifiers ("react", "@sentry/nextjs") resolve to nothing useful here and are simply
 * never equal to one of this guard's target paths, so they fall out of every check for free.
 */
function resolveImportedSpecifiers(filePath: string, content: string): string[] {
  const specifierPattern = /["']([^"']+)["']/g;
  const resolved: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = specifierPattern.exec(content)) !== null) {
    const specifier = match[1];
    if (specifier.startsWith("@/")) {
      resolved.push(resolvePathAbs(SRC_DIR, specifier.slice(2)));
    } else if (specifier.startsWith(".")) {
      resolved.push(resolvePathAbs(dirname(filePath), specifier));
    }
  }
  return resolved;
}

/** True when `content` (from `filePath`) imports exactly `targetModulePath`, by any specifier form. */
function importsModule(filePath: string, content: string, targetModulePath: string): boolean {
  return resolveImportedSpecifiers(filePath, content).includes(targetModulePath);
}

/** True when `content` (from `filePath`) imports any module inside (or exactly at) `targetDir`. */
function importsModuleUnder(filePath: string, content: string, targetDir: string): boolean {
  return resolveImportedSpecifiers(filePath, content).some(
    (resolvedPath) => resolvedPath === targetDir || resolvedPath.startsWith(targetDir + sep),
  );
}

/**
 * True when `content` (from `filePath`) imports any `*Mutations` module directly inside
 * `src/lib/data/orders/` or `src/lib/data/deliveries/`: `orderMutations`, `orderPaymentMutations`,
 * `deliveryMutations`, or any future sibling. Matched by the resolved module's own directory and
 * basename suffix rather than by name, so a new mutation file needs no update here to stay covered.
 */
function importsOrderOrDeliveryMutationModule(filePath: string, content: string): boolean {
  return resolveImportedSpecifiers(filePath, content).some((resolvedPath) => {
    const parentDir = dirname(resolvedPath);
    return (
      (parentDir === ORDERS_MUTATIONS_DIR || parentDir === DELIVERIES_MUTATIONS_DIR) &&
      basename(resolvedPath).endsWith("Mutations")
    );
  });
}

// Raw SQL escape hatches. Any of these bypasses the Prisma model layer entirely, so a call like
// `db.$executeRawUnsafe("INSERT INTO orders ...")` writes the orders table without ever matching
// a `prisma.order.` pattern.
const rawSqlMethodPattern = /\$(executeRawUnsafe|queryRawUnsafe|executeRaw|queryRaw)\b/;

// Order/delivery model access, matched on the model-name segment itself rather than requiring the
// literal `prisma.` prefix: `const db = prisma; db.order.create(...)` and `tx.order.create(...)`
// (inside a `$transaction` callback) both reach the same table and must both be caught.
const orderModelAccessPattern = /\b\w+\.(order|orderItem|orderPayment|delivery|deliveryOrderItem)\./;

// The one raw SQL statement this domain is allowed to run: the advisory lock `recordImageIntakeUsage`
// takes before reading the spend ledger's aggregate (see imageIntakeMutations.ts for why). Anything
// else raw is a potential direct table write masquerading as ledger bookkeeping.
const ADVISORY_LOCK_MARKER = "pg_advisory_xact_lock";

function isTsSourceFile(path: string): boolean {
  return (path.endsWith(".ts") || path.endsWith(".tsx")) && !path.endsWith(".d.ts");
}

/** Recursively collects source files under `dir`, skipping test folders. Returns `[]` if `dir` does not exist yet. */
function collectSourceFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    if (SKIPPED_DIR_NAMES.has(entry)) continue;
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(full));
    } else if (isTsSourceFile(full)) {
      files.push(full);
    }
  }
  return files;
}

/**
 * All of `src/`, minus `src/test/` (this guard's own suite, and the other hand-rolled guards next
 * to it: none of them are feature code and none should be able to trip a feature-shaped check).
 * `_tests` and `__tests__` are already excluded by `collectSourceFiles` itself. Used by checks that
 * must not be foldered to a specific feature directory, because the evasion they close is a file
 * placed anywhere else in `src/` on purpose.
 */
function collectFullSrcFilesExcludingGuardSuite(): string[] {
  return collectSourceFiles(SRC_DIR).filter((path) => !path.startsWith(SRC_TEST_DIR + sep));
}

function relativePath(path: string): string {
  return path.slice(REPO_ROOT.length + 1);
}

function readFiles(paths: string[]): { path: string; content: string }[] {
  return paths.map((path) => ({ path, content: readFileSync(path, "utf8") }));
}

/**
 * Every semicolon-terminated statement in `content` that invokes a raw SQL method. Splitting on
 * `;` is a simplification (it would mis-split a statement containing a literal semicolon inside a
 * string), but no raw SQL call in this domain does that, and it keeps this guard readable in the
 * same hand-rolled style as the rest of the file.
 */
function statementsWithRawSql(content: string): string[] {
  return content.split(";").filter((statement) => rawSqlMethodPattern.test(statement));
}

describe("image intake no-persistence guard", () => {
  it("never references @/lib/prisma from src/lib/imageIntake/, in any import form", () => {
    const offenders = readFiles(collectSourceFiles(IMAGE_INTAKE_DIR))
      .filter(({ path, content }) => importsModule(path, content, PRISMA_SINGLETON_MODULE_PATH))
      .map(({ path }) => relativePath(path));

    expect(
      offenders,
      `src/lib/imageIntake/ never persists anything itself: no file in it may reference ` +
        `"${PRISMA_MODULE_STRING}" (static import, dynamic import, require, or a relative path that ` +
        `resolves to the same file). Persistence belongs to the save action.\n` +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("never imports an order or delivery mutation module from src/lib/imageIntake/ or src/lib/data/imageIntake/", () => {
    // Any import from an orders/deliveries mutation module is disallowed here, not just the
    // named create/add functions: neither directory has a legitimate reason to call any mutation
    // in those modules (createOrder, addOrderPayment, createOrderItems, createDelivery included),
    // because saving happens in the dedicated save action.
    const offenders = readFiles([...collectSourceFiles(IMAGE_INTAKE_DIR), ...collectSourceFiles(IMAGE_INTAKE_DATA_DIR)])
      .filter(({ path, content }) => importsOrderOrDeliveryMutationModule(path, content))
      .map(({ path }) => relativePath(path));

    expect(
      offenders,
      "No file under src/lib/imageIntake/ or src/lib/data/imageIntake/ may reference an " +
        "orders/deliveries mutation module (createOrder, addOrderPayment, createOrderItems, " +
        "createDelivery, ...): neither directory ever writes an order or a delivery.\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("never calls raw SQL from src/lib/imageIntake/", () => {
    // Unlike src/lib/data/imageIntake/ (which owns the spend ledger and has one legitimate raw
    // call, the advisory lock), this directory has no ledger access at all, so raw SQL here has no
    // legitimate use: it can only be a direct, un-modeled table write.
    const offenders = readFiles(collectSourceFiles(IMAGE_INTAKE_DIR))
      .filter(({ content }) => rawSqlMethodPattern.test(content))
      .map(({ path }) => relativePath(path));

    expect(
      offenders,
      "No file under src/lib/imageIntake/ may call $executeRaw, $queryRaw, $executeRawUnsafe, or " +
        "$queryRawUnsafe: raw SQL bypasses every other check in this guard, and this directory has " +
        "no ledger access that would ever need it.\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("only runs the advisory-lock raw SQL statement from src/lib/data/imageIntake/", () => {
    // This directory owns the spend ledger and is allowed to touch Postgres directly, but only for
    // the transaction-scoped advisory lock recordImageIntakeUsage takes before summing the ledger
    // (see imageIntakeMutations.ts). Any other raw statement, in particular one that writes to a
    // table by name instead of going through a Prisma model, is the exact "db.$executeRawUnsafe
    // (INSERT INTO orders ...)" evasion this check exists to catch.
    const offenders: string[] = [];
    for (const { path, content } of readFiles(collectSourceFiles(IMAGE_INTAKE_DATA_DIR))) {
      const unguardedStatements = statementsWithRawSql(content).filter(
        (statement) => !statement.includes(ADVISORY_LOCK_MARKER),
      );
      if (unguardedStatements.length > 0) {
        offenders.push(relativePath(path));
      }
    }

    expect(
      offenders,
      `Raw SQL under src/lib/data/imageIntake/ is only allowed for the ${ADVISORY_LOCK_MARKER} ` +
        "advisory lock statement. A raw call that does not include that marker in the same " +
        "statement is a potential direct table write; use the imageIntakeUsage Prisma model " +
        "instead, or move the advisory lock literal so it stays in the same statement as the raw " +
        "call.\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("never references an order/delivery-model write from src/lib/imageIntake/ or src/lib/data/imageIntake/", () => {
    const files = [...collectSourceFiles(IMAGE_INTAKE_DIR), ...collectSourceFiles(IMAGE_INTAKE_DATA_DIR)];

    const offenders = readFiles(files)
      .filter(({ content }) => orderModelAccessPattern.test(content))
      .map(({ path }) => relativePath(path));

    expect(
      offenders,
      "No file under src/lib/imageIntake/ or src/lib/data/imageIntake/ may reference an " +
        "<identifier>.order./.orderItem./.orderPayment./.delivery./.deliveryOrderItem. model " +
        "access, under any identifier (prisma, tx, a renamed alias, ...): the spend ledger these " +
        "directories write is a separate model (imageIntakeUsage).\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("never lets an extraction module/action and an order-persistence module/action share one file", () => {
    // The dangerous shape is one file that can both produce a draft (or talk to the model that
    // produces it) and persist an order, because that skips the human confirmation step the
    // review screen exists for. The confirmation lives in the gap between the two Server Actions:
    // extractOrderFromImagesAction returns a draft, the review screen renders it, and only a
    // second, separate call to saveOrderFromDraftAction ever writes it. A file that can reach both
    // halves makes that human step optional by accident, whether it does so by importing the
    // underlying model/engine modules directly, or by importing the two actions that wrap them.
    //
    // The real save action is deliberately still possible: it may import mapDraftToOrderCreate (a
    // pure structural transform, never a Prisma caller) together with an orders mutation module,
    // because that pair is exactly "take a confirmed draft, shape it, call createOrder" with a
    // human already in the loop.
    //
    // Allowed:     mapDraftToOrderCreate + orderMutations (or any orders/deliveries mutation)
    // Prohibited:  extractionEngine|geminiProvider|imageIntakeExtractAction (module or symbol)
    //              together with orderMutations|prisma|imageIntakeSaveAction (module or symbol)
    // Prohibited:  draftSchema together with prisma (direct, not through a mutation module)
    //
    // Scanned across all of src/ (not just src/app/): the dangerous pair is defined by what a file
    // imports, not by which directory happens to hold it, and a wrapper module placed in
    // src/lib/orders/ or anywhere else is exactly as dangerous as one placed under src/app/.
    //
    // Both sides are matched two ways: by the imported module's resolved identity (covers the `@/`
    // alias, any depth of relative import, and require/dynamic import, all collapsed to the same
    // absolute path by `resolveImportedSpecifiers`) and by the imported symbol's own name (covers a
    // re-export or a barrel file that changes the module path without renaming what it hands out).
    // Either signal alone is enough to call a file "reaches this side".
    const extractActionSymbolPattern = /\bextractOrderFromImagesAction\b/;
    const saveActionSymbolPattern = /\bsaveOrderFromDraftAction\b/;

    function reachesExtractionSide(filePath: string, content: string): boolean {
      return (
        importsModule(filePath, content, EXTRACTION_ENGINE_MODULE_PATH) ||
        importsModule(filePath, content, GEMINI_PROVIDER_MODULE_PATH) ||
        importsModule(filePath, content, EXTRACT_ACTION_MODULE_PATH) ||
        extractActionSymbolPattern.test(content)
      );
    }

    function reachesPersistenceSide(filePath: string, content: string): boolean {
      return (
        importsOrderOrDeliveryMutationModule(filePath, content) ||
        importsModule(filePath, content, PRISMA_SINGLETON_MODULE_PATH) ||
        importsModule(filePath, content, SAVE_ACTION_MODULE_PATH) ||
        saveActionSymbolPattern.test(content)
      );
    }

    const offenders: string[] = [];
    for (const { path, content } of readFiles(collectFullSrcFilesExcludingGuardSuite())) {
      // The one legitimate exception: the "use client" coordinator on the review screen imports
      // both actions on purpose, because the human confirmation happens between the two calls, in
      // its own "review" phase state, not inside either action. It is allowlisted by exact path,
      // not by basename or directory, so nothing else can claim the exemption by imitating its name.
      if (path === IMAGE_INTAKE_SCREEN_PATH) continue;

      const hasExtraction = reachesExtractionSide(path, content);
      const hasPersistence = reachesPersistenceSide(path, content);
      const hasDraftSchema = importsModule(path, content, DRAFT_SCHEMA_MODULE_PATH);

      if (hasExtraction && hasPersistence) {
        offenders.push(
          `${relativePath(path)}: reaches the extraction side (extractionEngine, geminiProvider, ` +
            "imageIntakeExtractAction, or the extractOrderFromImagesAction symbol) and the " +
            "persistence side (an orders/deliveries mutation, @/lib/prisma, imageIntakeSaveAction, " +
            "or the saveOrderFromDraftAction symbol) in the same file",
        );
        continue;
      }
      if (hasDraftSchema && importsModule(path, content, PRISMA_SINGLETON_MODULE_PATH)) {
        offenders.push(`${relativePath(path)}: imports draftSchema together with a direct prisma reference`);
      }
    }

    expect(
      offenders,
      "An extracted order can only be persisted by passing through the confirmation step of the " +
        "normal save flow. A file that can reach both the extraction/model side of image intake and " +
        "the order-persistence side bypasses that human confirmation, whether it does so through the " +
        "underlying modules or through the two Server Actions that wrap them. The legitimate " +
        "save-action wiring goes through mapDraftToOrderCreate plus an orders mutation module, not " +
        "Prisma or the extraction engine directly; the legitimate UI wiring is the allowlisted " +
        "ImageIntakeScreen.tsx coordinator, because its confirmation happens in the review phase " +
        "between the two action calls. If a legitimate new file needs this pair, move the code " +
        "that needs it into (or behind) that coordinator instead of widening this allowlist.\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("never lets GEMINI_API_KEY reach a client-bundled file or a NEXT_PUBLIC_ variable", () => {
    const files = collectSourceFiles(SRC_DIR);
    const offenders: string[] = [];

    for (const path of files) {
      // Skip this guard file itself: its own source necessarily names the strings it scans for.
      if (path === GUARD_FILE_PATH) continue;

      const content = readFileSync(path, "utf8");
      if (!content.includes("GEMINI_API_KEY")) continue;

      if (content.includes("NEXT_PUBLIC_GEMINI_API_KEY")) {
        offenders.push(`${relativePath(path)}: referenced as a NEXT_PUBLIC_ variable`);
        continue;
      }

      if (hasUseClientDirective(content)) {
        offenders.push(`${relativePath(path)}: referenced inside a "use client" file`);
      }
    }

    expect(
      offenders,
      "GEMINI_API_KEY is the one shared production credential for this feature: it must never " +
        "appear in a client-bundled file or under a NEXT_PUBLIC_ name, or Next.js will inline it " +
        "into the browser bundle.\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it('never lets a "use client" file import an image-intake server module', () => {
    // Matched by resolved module identity (see `importsModule`/`importsModuleUnder`), not by the
    // literal `@/` alias string: a relative import to the same file
    // (`../../../lib/imageIntake/geminiProvider`, or a shallower one from a file already nearby)
    // is exactly as dangerous and must not evade this check just because it skips the alias.
    //
    // `src/lib/data/imageIntake/` is matched as a whole directory, not module by module, so a
    // future file added there (a new mutation, a new query) is covered without this list needing
    // an update: everything in that directory is spend-ledger data access, which is exactly as
    // server-only as the three named modules below. This directory match is intentionally scoped
    // to the feature's own data folder, not to `src/lib/data/` as a whole: elsewhere in the app,
    // client components legitimately import *types* from data/query modules (e.g. `import type
    // { OrdersListPageItem } from "@/lib/data/orders/orderQueries"`), and banning that broader
    // pattern here would flag existing, unrelated, correct code instead of this feature's own
    // server-only surface.
    const serverOnlyModuleChecks: { label: string; test: (filePath: string, content: string) => boolean }[] = [
      {
        label: "@/lib/imageIntake/geminiProvider",
        test: (filePath, content) => importsModule(filePath, content, GEMINI_PROVIDER_MODULE_PATH),
      },
      {
        label: "@/lib/imageIntake/extractionEngine",
        test: (filePath, content) => importsModule(filePath, content, EXTRACTION_ENGINE_MODULE_PATH),
      },
      {
        label: "@/lib/imageIntake/validateUpload",
        test: (filePath, content) => importsModule(filePath, content, VALIDATE_UPLOAD_MODULE_PATH),
      },
      {
        label: "src/lib/data/imageIntake/* (spend ledger and quota data access)",
        test: (filePath, content) => importsModuleUnder(filePath, content, IMAGE_INTAKE_DATA_DIR),
      },
    ];

    const offenders: string[] = [];
    for (const path of collectSourceFiles(SRC_DIR)) {
      const content = readFileSync(path, "utf8");
      if (!hasUseClientDirective(content)) continue;

      const importedServerModules = serverOnlyModuleChecks
        .filter(({ test }) => test(path, content))
        .map(({ label }) => label);
      if (importedServerModules.length > 0) {
        offenders.push(`${relativePath(path)}: imports ${importedServerModules.join(", ")}`);
      }
    }

    expect(
      offenders,
      "geminiProvider, extractionEngine, and validateUpload call the Gemini API / decode uploaded " +
        "bytes server-side, and src/lib/data/imageIntake/ touches the spend ledger through Prisma; " +
        'none of them may be imported (by alias or by relative path) from a "use client" file, or the ' +
        "bundler pulls their server-only dependencies (and the code path to the shared API key) " +
        "into the browser bundle.\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("never names a GEMINI env var with the NEXT_PUBLIC_ prefix in src/ or next.config.ts", () => {
    const geminiPublicEnvNamePattern = /NEXT_PUBLIC_[A-Z0-9_]*GEMINI[A-Z0-9_]*/;
    const files = [...collectSourceFiles(SRC_DIR), NEXT_CONFIG_PATH];

    const offenders: string[] = [];
    for (const path of files) {
      if (path === GUARD_FILE_PATH) continue;
      let content: string;
      try {
        content = readFileSync(path, "utf8");
      } catch {
        continue;
      }
      const match = content.match(geminiPublicEnvNamePattern);
      if (match) {
        offenders.push(`${relativePath(path)}: ${match[0]}`);
      }
    }

    expect(
      offenders,
      "Next.js inlines any NEXT_PUBLIC_ variable into the browser bundle. No env var name that " +
        "contains GEMINI may start with NEXT_PUBLIC_, anywhere in src/ or next.config.ts, or the " +
        "shared Gemini credential becomes reachable from client code.\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("never lets next.config.ts define an env: block that exposes GEMINI_API_KEY", () => {
    const content = readFileSync(NEXT_CONFIG_PATH, "utf8");
    // next.config.ts's `env:` option inlines every key it lists into the client bundle for every
    // `process.env.<KEY>` reference in the app, regardless of that key's own name: it does not
    // need a NEXT_PUBLIC_ prefix to leak, which is why this needs its own check instead of relying
    // on the NEXT_PUBLIC_ naming check above.
    const envBlockMatch = content.match(/\benv\s*:\s*\{([^}]*)\}/);
    const envBlockExposesGemini = Boolean(envBlockMatch && envBlockMatch[1].includes("GEMINI"));

    expect(
      envBlockExposesGemini,
      "next.config.ts must not define an env: block that lists GEMINI_API_KEY (or any GEMINI " +
        "name): that option inlines the value into the client bundle for every process.env " +
        "reference in the app, independent of the NEXT_PUBLIC_ naming convention.",
    ).toBe(false);
  });

  it("always gates the quota override action behind requireAdmin", () => {
    // A quota override rewrites another collector's monthly photo allowance from the moderation
    // console. requireAdmin() is the real boundary (the nav entry and the route gate are only
    // presentation), so this file losing that import silently reopens the action to any signed-in
    // user, not just admins.
    const path = join(
      REPO_ROOT,
      "src",
      "app",
      "[locale]",
      "(app)",
      "admin",
      "_actions",
      "setImageIntakeQuotaOverride.ts",
    );
    let content: string;
    try {
      content = readFileSync(path, "utf8");
    } catch {
      throw new Error(
        `${relativePath(path)} was not found. If this action moved, update this guard to point at ` +
          "its new path rather than deleting the check: it exists to keep the quota override behind " +
          "requireAdmin().",
      );
    }

    expect(
      /\brequireAdmin\s*\(/.test(content),
      `${relativePath(path)} must call requireAdmin() before setting a quota override: without it, ` +
        "any signed-in collector could rewrite another account's monthly photo allowance from an " +
        "unlisted route, not just an admin from the moderation console.",
    ).toBe(true);
  });

  it("gates every image-intake Server Action behind getSession() or requireAdmin()", () => {
    // One explicit list rather than a scan: a scan would have to guess which actions belong to this
    // feature, and a hardcoded list makes it obvious when a new image-intake action needs to be
    // added here instead of silently going unchecked. Each entry is a repository-relative path so a
    // failure message stays readable.
    const featureActionRelativePaths = [
      "src/app/[locale]/(app)/orders/_actions/imageIntakeExtractAction.ts",
      "src/app/[locale]/(app)/orders/_actions/imageIntakeSaveAction.ts",
      "src/app/[locale]/(app)/orders/_actions/imageIntakeStoreActions.ts",
      "src/app/[locale]/(app)/admin/_actions/setImageIntakeQuotaOverride.ts",
    ];
    const authCallPattern = /\b(getSession|requireAdmin)\s*\(/;

    const offenders: string[] = [];
    for (const relPath of featureActionRelativePaths) {
      const path = join(REPO_ROOT, ...relPath.split("/"));
      let content: string;
      try {
        content = readFileSync(path, "utf8");
      } catch {
        offenders.push(`${relPath}: file not found (update this guard's list if the action moved or was removed)`);
        continue;
      }
      if (!authCallPattern.test(content)) {
        offenders.push(`${relPath}: calls neither getSession() nor requireAdmin()`);
      }
    }

    expect(
      offenders,
      "Every Server Action in the image-intake feature must check the caller's identity by calling " +
        "getSession() (a signed-in collector) or requireAdmin() (an admin-only action) before doing " +
        "any work: a Server Action is a public HTTP endpoint the moment it exists, whatever UI does " +
        "or does not link to it.\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });
});

/**
 * True when the file's directive prologue (skipping any leading blank lines, line comments, and
 * block comments, single- or multi-line) is exactly "use client". Comments are not statements, so
 * real Next.js tooling allows them before the directive; a detector that only skips blank lines
 * and line comments (and not block comments) misses a directive preceded by a JSDoc-style header,
 * which is a common shape for a file's own doc comment.
 */
function hasUseClientDirective(content: string): boolean {
  let rest = content;

  while (true) {
    rest = rest.trimStart();
    if (rest.startsWith("//")) {
      const newlineIndex = rest.indexOf("\n");
      rest = newlineIndex === -1 ? "" : rest.slice(newlineIndex + 1);
      continue;
    }
    if (rest.startsWith("/*")) {
      const closeIndex = rest.indexOf("*/");
      rest = closeIndex === -1 ? "" : rest.slice(closeIndex + 2);
      continue;
    }
    break;
  }

  return rest.startsWith('"use client"') || rest.startsWith("'use client'");
}
