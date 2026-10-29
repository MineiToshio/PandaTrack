import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const removedGroupKeys = [
  "clean",
  "openRange",
  "split",
  "sourceQuoteSealed",
  "sourceQuoteNotNameable",
  "splitIntoAction",
  "splitDoubt",
  "editCollapsedHint",
];
const root = process.cwd();

describe("review regression: presentation contracts", () => {
  it.each(["es", "en"])(
    "removes unused group messages while retaining evidence and split action copy in %s",
    (locale) => {
      const group = JSON.parse(readFileSync(resolve(root, `src/i18n/locales/${locale}/imageIntake.json`), "utf8"))
        .review.group;
      for (const key of removedGroupKeys) expect(group, key).not.toHaveProperty(key);
      for (const key of ["sealed", "notNameable", "splitAction"]) expect(group[key]).toEqual(expect.any(String));
    },
  );

  it("removes unused intake arrival and reveal CSS including their keyframes", () => {
    const css = readFileSync(resolve(root, "src/app/globals.css"), "utf8");
    expect(css).not.toMatch(/intake-(rise-in|reveal)/);
  });

  it("documents both disclosure analytics events and their expanded boolean", () => {
    const frd = readFileSync(
      resolve(root, "docs/product/prd-02-collector-app/frd-11-order-image-intake/frd-11-order-image-intake.md"),
      "utf8",
    );
    const requirement = frd.split("\n").find((line) => line.startsWith("- `FR-11-88`:"))!;
    expect(requirement).toContain("image_intake_group_evidence_toggled");
    expect(requirement).toContain("image_intake_group_rows_toggled");
    expect(requirement).toContain("expanded");
    expect(requirement).toContain("boolean");
  });
});
