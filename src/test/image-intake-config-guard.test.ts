import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { EXTRACTION_REQUEST_TIMEOUT_MS, EXTRACTION_TOTAL_BUDGET_MS } from "@/lib/imageIntake/extractionEngine";

/**
 * Order image intake config guard.
 *
 * Fixed configuration facts this feature depends on, checked directly against their source files
 * (or, for the manifest, against its real evaluated output) rather than against
 * `src/lib/imageIntake/**` behavior (that boundary is covered by `image-intake-no-persistence-guard.test.ts`):
 *
 * 1. `next.config.ts` caps Server Action request bodies at 4 MB, one MB under Vercel's own 4.5 MB
 *    platform ceiling. Vercel's ceiling wins first if this is ever raised past it: the caller
 *    would see a raw, unreadable 413 instead of this feature's own validation error, for every
 *    submission Vercel rejects before the action even runs.
 * 2. `.env.example` documents every env var this feature reads, and none of them under a
 *    `NEXT_PUBLIC_` name: `GEMINI_API_KEY` is the one shared production credential (ADR 0020), and
 *    `NEXT_PUBLIC_` inlines a variable into the client bundle.
 * 3. `src/app/manifest.ts`'s `share_target` accept list never lists `image/heic`: the in-app picker
 *    already rejects HEIC because the canvas compression step cannot decode it, and the Android
 *    share sheet must refuse the same files up front instead of accepting a share the flow can
 *    only fail afterwards.
 */

const REPO_ROOT = process.cwd();
const NEXT_CONFIG_PATH = join(REPO_ROOT, "next.config.ts");
const ENV_EXAMPLE_PATH = join(REPO_ROOT, ".env.example");
const INTAKE_PAGE_PATH = join(REPO_ROOT, "src/app/[locale]/(app)/orders/new/image/page.tsx");

/**
 * Hosting ceiling for a single function invocation on the current plan. The route may declare any
 * budget up to this; past it the platform refuses the deployment rather than honouring the number.
 */
const PLATFORM_MAX_DURATION_SECONDS = 60;

const REQUIRED_ENV_EXAMPLE_KEYS = [
  "GEMINI_API_KEY",
  "IMAGE_INTAKE_PAID_TIER_CONFIRMED",
  "IMAGE_INTAKE_MODEL_ID",
  "IMAGE_INTAKE_SPEND_ALERT_USD",
  "IMAGE_INTAKE_SPEND_HARD_STOP_USD",
  "IMAGE_INTAKE_ALERT_EMAIL",
];

describe("image intake config guard", () => {
  it('caps next.config.ts Server Action bodySizeLimit at exactly "4mb"', () => {
    const content = readFileSync(NEXT_CONFIG_PATH, "utf8");

    expect(
      content.includes('bodySizeLimit: "4mb"'),
      'next.config.ts must set bodySizeLimit: "4mb" exactly on experimental.serverActions. ' +
        "Vercel's own platform ceiling is 4.5 MB: raising this past it means a submission Vercel " +
        "rejects surfaces as a raw, unreadable 413 instead of this feature's own upload validation " +
        "error.",
    ).toBe(true);
  });

  it("documents every image intake env var in .env.example, with no NEXT_PUBLIC_ GEMINI variable", () => {
    const content = readFileSync(ENV_EXAMPLE_PATH, "utf8");

    const missingKeys = REQUIRED_ENV_EXAMPLE_KEYS.filter((key) => !new RegExp(`^${key}=`, "m").test(content));

    expect(
      missingKeys,
      ".env.example must declare every image intake env var so a fresh setup does not silently " +
        `run without them: ${REQUIRED_ENV_EXAMPLE_KEYS.join(", ")}.\n` +
        `Missing: ${missingKeys.join(", ")}`,
    ).toEqual([]);

    const nextPublicGeminiMatch = content.match(/NEXT_PUBLIC_[A-Z0-9_]*GEMINI[A-Z0-9_]*/);

    expect(
      nextPublicGeminiMatch,
      "No .env.example variable name may combine NEXT_PUBLIC_ with GEMINI: Next.js inlines " +
        `NEXT_PUBLIC_ variables into the client bundle. Found: ${nextPublicGeminiMatch?.[0]}`,
    ).toBeNull();
  });

  it("gives the intake route a server time budget the extraction can actually finish inside", () => {
    const content = readFileSync(INTAKE_PAGE_PATH, "utf8");
    const declared = content.match(/^export const maxDuration = (\d+)/m);

    expect(
      declared,
      "The intake page must export `maxDuration`. Extraction measures at 20 to 40 seconds against " +
        "the live provider, while the hosting default is 10: without this export the function is " +
        "killed mid-call on every submission, so the feature cannot succeed in production even " +
        "once, and each attempt orphans its ledger reservation as PENDING against the collector's " +
        "monthly bag.",
    ).not.toBeNull();

    const maxDurationSeconds = Number(declared?.[1]);

    expect(
      maxDurationSeconds,
      `The intake route's maxDuration (${maxDurationSeconds}s) exceeds the plan ceiling of ` +
        `${PLATFORM_MAX_DURATION_SECONDS}s, which the platform refuses rather than honours.`,
    ).toBeLessThanOrEqual(PLATFORM_MAX_DURATION_SECONDS);

    // The engine's own retry budget has to land INSIDE the route's, with room to settle the ledger
    // and answer. Reversed, a submission is killed by the platform exactly when it is retrying,
    // which is the one moment the ledger has an open reservation to settle.
    expect(
      EXTRACTION_TOTAL_BUDGET_MS,
      `EXTRACTION_TOTAL_BUDGET_MS (${EXTRACTION_TOTAL_BUDGET_MS}ms) must stay strictly under the ` +
        `intake route's maxDuration (${maxDurationSeconds}s). These two numbers are a pair: the ` +
        "engine may only spend time the route is allowed to stay alive for.",
    ).toBeLessThan(maxDurationSeconds * 1000);

    // A single attempt must fit too, or the very first call is killed before its own timeout fires.
    expect(
      EXTRACTION_REQUEST_TIMEOUT_MS,
      `EXTRACTION_REQUEST_TIMEOUT_MS (${EXTRACTION_REQUEST_TIMEOUT_MS}ms) must fit inside ` +
        `EXTRACTION_TOTAL_BUDGET_MS (${EXTRACTION_TOTAL_BUDGET_MS}ms).`,
    ).toBeLessThanOrEqual(EXTRACTION_TOTAL_BUDGET_MS);
  });

  it("declares a share_target whose accept list never lists image/heic", () => {
    // Calls the real manifest() function rather than regexing src/app/manifest.ts's source text:
    // the accept list is spread in from ACCEPTED_IMAGE_MIME_TYPES (src/lib/imageIntake/constants.ts),
    // so a source-text scan of manifest.ts alone would never see the literal type strings and would
    // pass even if HEIC were added to that constant.
    const manifestValue = manifest();

    expect(
      manifestValue.share_target,
      "src/app/manifest.ts must declare a share_target block: it is what puts PandaTrack in the " +
        "Android share sheet for images, and public/sw.js's POST handler depends on it existing.",
    ).toBeDefined();

    const fileEntries = manifestValue.share_target?.params.files;
    const acceptedTypes = (Array.isArray(fileEntries) ? fileEntries : fileEntries ? [fileEntries] : []).flatMap(
      (entry) => entry.accept ?? [],
    );

    expect(
      acceptedTypes.some((type) => /heic/i.test(type)),
      "src/app/manifest.ts's share_target accept list must not include image/heic: the in-app " +
        "picker already rejects HEIC because the canvas compression step cannot decode it, so " +
        `accepting it from the share sheet would only fail afterwards. Accepted types: ${acceptedTypes.join(", ")}`,
    ).toBe(false);
  });
});
