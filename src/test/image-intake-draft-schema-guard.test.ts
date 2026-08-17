import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { maskComments } from "./i18nGuardParsing";

/**
 * Image-intake draft-schema guard: the model never gets to propose a split.
 *
 * `imageIntakeDraftSchema` is the contract the extraction's answer is parsed against, and the same
 * contract the review screen's draft is re-parsed against on the way back in. ADR 0028 draws the
 * line this guard patrols: a breakdown is a DECLARATION BY THE COLLECTOR, not a reading. The moment
 * the draft contract can carry allocations, a model response can carry them too, and the whole
 * distinction between "what the chat said" and "what the collector decided" collapses into one
 * payload nobody can tell apart afterwards.
 *
 * The breakdown declared on the review screen therefore travels as a SEPARATE argument of the save
 * action, in `src/lib/imageIntake/intakeBreakdownContract.ts`, and this file's job is to keep it
 * out of the draft.
 *
 * Two notes on how it is written, both learned the hard way:
 *
 *   - Comments are masked before scanning, because the file legitimately says "the deterministic
 *     breakdown" in prose. A guard that goes red on its own explanatory comment gets deleted.
 *   - `breakdown` itself is NOT a banned token for the same reason. What is banned are the three
 *     names an actual allocation field would have to use to be one.
 *
 * This boundary had no automated guard at all until now. `image-intake-response-schema-guard`
 * looked like it covered it and does not: it only checks that `IMAGE_INTAKE_RESPONSE_SCHEMA`'s
 * keywords are ones the Gemini endpoint accepts.
 */

const REPO_ROOT = process.cwd();
const DRAFT_SCHEMA_PATH = join(REPO_ROOT, "src", "lib", "imageIntake", "draftSchema.ts");

/** The three names a declared allocation cannot be expressed without. */
const ALLOCATION_TOKEN_PATTERN = /allocation|orderItemId|amountMinor/i;

describe("image intake draft schema guard", () => {
  it("keeps every allocation vocabulary out of the draft contract", () => {
    const source = maskComments(readFileSync(DRAFT_SCHEMA_PATH, "utf8"));

    const offenders = source
      .split("\n")
      .map((line, index) => ({ line, number: index + 1 }))
      .filter(({ line }) => ALLOCATION_TOKEN_PATTERN.test(line))
      .map(({ line, number }) => `draftSchema.ts:${number}: ${line.trim()}`);

    expect(
      offenders,
      "imageIntakeDraftSchema is the model's own contract: it must never carry an allocation, an " +
        "orderItemId, or an amountMinor. A breakdown is the collector's declaration (ADR 0028), so " +
        "it rides beside the draft as its own argument of the save action " +
        "(src/lib/imageIntake/intakeBreakdownContract.ts), never inside the shape a model answers.\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("still scans a file that exists and still recognizes the shape it bans", () => {
    // A guard whose target moved, or whose pattern quietly stopped matching, is green forever.
    const source = readFileSync(DRAFT_SCHEMA_PATH, "utf8");
    expect(source).toContain("imageIntakeDraftSchema");
    expect(ALLOCATION_TOKEN_PATTERN.test("  allocations: z.array(allocationSchema),")).toBe(true);
    expect(ALLOCATION_TOKEN_PATTERN.test("  orderItemId: z.string(),")).toBe(true);
    expect(ALLOCATION_TOKEN_PATTERN.test("  amountMinor: z.number().int(),")).toBe(true);
    // And that masking is what keeps the prose legal, rather than a hole in the pattern.
    expect(maskComments("// the deterministic allocation engine\nconst a = 1;")).not.toMatch(ALLOCATION_TOKEN_PATTERN);
  });
});
