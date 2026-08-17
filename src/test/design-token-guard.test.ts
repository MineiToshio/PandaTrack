import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Design-token regression guard (S13 — final redesign audit).
 *
 * Hand-rolled, zero-dependency check (no ESLint plugin, no stylelint) that fails the
 * suite if either rule the redesign cares about regresses:
 *
 *  A. Theme-blind Tailwind utility classes (`text-white`, `bg-black`, `bg-blue-500`, …)
 *     in component markup. App UI must use semantic theme tokens, not literal colors.
 *
 *  B'. A RAW status token used as a text `color`. `--warning` / `--info` / `--success` /
 *     `--destructive` are calibrated as chip FILLS; the calibrated status-TEXT values are the
 *     `--{status}-chip-text` aliases (`docs/design/visual-foundations.md` § Status color as text).
 *     On `--surface` in the light theme the raw tokens land at 2.46 / 3.83 / 3.61 / 5.09 : 1, so
 *     three of the four do not reach AA as text at all. See the map below for how the debt is held.
 *
 *  B. L074 — `color-mix(in oklch, var(--<neutral>) …)` that resolves to an OPAQUE color.
 *     Mixing a low-chroma NEUTRAL token in the oklch color space collapses the hue to `none`
 *     (→ salmon drift). Those mixes must use `oklab`. High-chroma accent/status tokens may stay
 *     in oklch. The check covers BOTH the CSS spacing (`in oklch, var(--…)`) and the Tailwind
 *     arbitrary-value spelling (`in_oklch,var(--…)`) — the underscore form was previously a blind
 *     spot. Neutral tints over `transparent` (the documented hover/pressed/selected overlays,
 *     visual-foundations.md) are intentionally excluded: an overlay near full transparency carries
 *     no perceptible hue to drift, so only opaque neutral mixes are flagged.
 *
 * Legitimate hardcoded colors (OG images, transactional emails, the catastrophic
 * `global-error` fallback, brand SVG marks) live outside Tailwind `className`s / token
 * mixes, so they are not matched by these checks.
 */

const SRC_DIR = join(process.cwd(), "src");

const THEME_BLIND_CLASS =
  /\b(?:text|bg|border|ring|divide|fill|stroke|from|via|to)-(?:white|black)\b|\b(?:text|bg|border|ring|divide|fill|stroke|from|via|to)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;

const OKLCH_OVER_NEUTRAL =
  /color-mix\(\s*in[\s_]oklch\s*,\s*var\(--(?:surface|surface-elevated|background|foreground|text-primary|text-secondary|text-muted|text-body|text-title|border|border-strong)\)[^,]*,[\s_]*(?!transparent\b)/;

const RAW_STATUS_AS_TEXT = /\[color:var\(--(?:warning|info|success|destructive)\)\]/;

/**
 * The pre-existing debt for scan B', held as a per-file expected-hit count with a ZERO budget
 * everywhere else. Not a blanket allowance: the count is exact, so a NEW raw-status label inside an
 * already-listed file fails just as loudly as one in a fresh file, and a fixed file must be lowered
 * or removed here (the test says so). `expectedRawStatusHits` is also self-verified below — an entry
 * whose file is gone, or that no longer matches, fails rather than quietly rotting into a rubber
 * stamp.
 *
 * Why a map instead of fixing all 46 in one pass: the audited surface is the orders list, where the
 * same delay read 8.42:1 on one view and 2.46:1 one toggle away (ADR 0030 §8). Those five files
 * (`ArrivalMeta`, `OrdersTable`, `OrderCard`, `orderListStatusChip`, `orderItemDeliveryChip`) are
 * deliberately absent from this map and therefore at zero. The rest is real, unaudited debt of three
 * different shapes — chip recipes whose label rides the raw token, icons (a graphical object, 3:1
 * under WCAG 1.4.11 rather than 4.5:1), and `--destructive` copy, which is the one raw token that
 * does clear AA as text (5.09:1). Each needs its own contrast measurement before it moves, which is
 * a separate change; what this map buys today is that the number can only go DOWN.
 */
const expectedRawStatusHits: Record<string, number> = {
  "src/app/[locale]/(app)/admin/_components/reviews/ChangeRequestReview.tsx": 2,
  "src/app/[locale]/(app)/admin/_components/reviews/FieldDiff.tsx": 4,
  "src/app/[locale]/(app)/admin/_components/reviews/ReportCard.tsx": 1,
  "src/app/[locale]/(app)/dashboard/_components/DashboardFxPartialNotice.tsx": 1,
  "src/app/[locale]/(app)/dashboard/_components/DashboardKpiInfoTooltip.tsx": 1,
  "src/app/[locale]/(app)/deliveries/[id]/_components/MarkDeliveredModal.tsx": 1,
  "src/app/[locale]/(app)/deliveries/_components/share/DeliveryCreateWizard.tsx": 3,
  "src/app/[locale]/(app)/deliveries/_components/share/DeliveryDataFields.tsx": 4,
  "src/app/[locale]/(app)/deliveries/_components/share/DeliveryEditForm.tsx": 1,
  "src/app/[locale]/(app)/deliveries/_components/share/DeliveryProductsPicker.tsx": 1,
  "src/app/[locale]/(app)/orders/_components/FxReconciliationModal.tsx": 3,
  "src/app/[locale]/(app)/orders/_components/share/DiscrepancyModal.tsx": 1,
  "src/app/[locale]/(app)/orders/_components/share/OrderAddProductSheet.tsx": 1,
  "src/app/[locale]/(app)/orders/_components/share/OrderCreateForm.tsx": 8,
  "src/app/[locale]/(app)/orders/_components/share/OrderEditForm.tsx": 6,
  "src/app/[locale]/(app)/orders/_components/share/OrderItemsGrid.tsx": 3,
  "src/app/[locale]/(app)/orders/new/image/_components/IntakeReviewScreen.tsx": 3,
  "src/app/[locale]/(app)/orders/new/image/_components/StoreResolutionSection.tsx": 3,
  "src/app/[locale]/(app)/settings/_components/AvatarModal.tsx": 1,
  "src/app/[locale]/(app)/settings/_components/AvatarRemoveModal.tsx": 1,
  "src/app/[locale]/(app)/settings/_components/CooldownChip.tsx": 1,
  "src/app/[locale]/(app)/settings/_components/EmailModal.tsx": 1,
  "src/app/[locale]/(app)/settings/_components/PasswordModal.tsx": 1,
  "src/app/[locale]/(app)/settings/_components/PasswordRules.tsx": 2,
  "src/app/[locale]/(app)/settings/_components/PreferencesAutosaveIndicator.tsx": 2,
  "src/app/[locale]/(app)/settings/_components/SettingsPrefsPane.tsx": 1,
  "src/app/[locale]/(app)/stores/[slug]/_components/StoreGovernanceSummaryModal.tsx": 6,
  "src/app/[locale]/(app)/stores/_components/share/DuplicateAlertInline.tsx": 2,
  "src/app/[locale]/(app)/stores/_components/share/StoreForm/StoreFormStepCatalog.tsx": 2,
  "src/app/[locale]/(app)/stores/_components/share/StoreForm/StoreFormStepIdentity.tsx": 2,
  "src/app/[locale]/(app)/stores/_components/share/StoreHero.tsx": 1,
  "src/app/[locale]/(app)/stores/_components/share/StoreProductTypeRequestModal.tsx": 2,
  "src/components/core/Button/buttonVariants.ts": 1,
  "src/components/core/Eyebrow.tsx": 6,
  "src/components/core/FieldErrorMsg.tsx": 1,
  "src/components/core/ProvenanceValue.tsx": 1,
  "src/components/core/Radio.tsx": 1,
  "src/components/core/Stepper.tsx": 1,
  "src/components/modules/AsideSummary/AsideSummary.tsx": 1,
  "src/components/modules/EmptyState.tsx": 2,
  "src/components/modules/Modal/Modal.types.ts": 4,
  "src/components/modules/PrivateNoteCard.tsx": 2,
  "src/components/modules/QuickArrival/QuickArrivalModal.tsx": 1,
  "src/components/modules/StorePaymentSheet/StorePaymentAllocationPanel.tsx": 2,
  "src/components/modules/StorePaymentSheet/StorePaymentPanel.tsx": 3,
  "src/components/modules/WizardAccordion/WizardStep.tsx": 2,
};

function isTestPath(path: string): boolean {
  return /\.test\.[tj]sx?$/.test(path) || /(?:^|\/)(?:_tests|__tests__)(?:\/|$)/.test(path);
}

function collect(dir: string, extensions: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collect(full, extensions));
    } else if (extensions.some((ext) => full.endsWith(ext)) && !isTestPath(full)) {
      out.push(full);
    }
  }
  return out;
}

function scan(files: string[], pattern: RegExp): string[] {
  const hits: string[] = [];
  for (const file of files) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      if (pattern.test(line)) {
        hits.push(`${file.replace(SRC_DIR, "src")}:${index + 1} → ${line.trim()}`);
      }
    });
  }
  return hits;
}

function countByFile(files: string[], pattern: RegExp): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const file of files) {
    const hits = readFileSync(file, "utf8")
      .split("\n")
      .filter((line) => pattern.test(line)).length;
    if (hits > 0) counts[file.replace(SRC_DIR, "src")] = hits;
  }
  return counts;
}

describe("design-token guard", () => {
  it("has no theme-blind Tailwind utility classes in components", () => {
    const hits = scan(collect(SRC_DIR, [".tsx"]), THEME_BLIND_CLASS);
    expect(hits, `Use semantic theme tokens instead of literal colors:\n${hits.join("\n")}`).toEqual([]);
  });

  it("has no color-mix(in oklch) over neutral tokens (L074)", () => {
    const hits = scan(collect(SRC_DIR, [".tsx", ".ts", ".css"]), OKLCH_OVER_NEUTRAL);
    expect(hits, `Neutral-token mixes must use oklab, not oklch (L074):\n${hits.join("\n")}`).toEqual([]);
  });

  /**
   * The single line this feature could not otherwise protect. Flipping `ArrivalMeta`'s
   * `--warning-chip-text` back to `--warning` takes the delay from 8.42:1 to 2.46:1 and left the
   * whole suite green, on a decision this feature had already got wrong twice (once with `--info`,
   * once with `--warning`).
   */
  it("uses the --{status}-chip-text alias, not the raw status token, for text color", () => {
    const found = countByFile(collect(SRC_DIR, [".tsx", ".ts"]), RAW_STATUS_AS_TEXT);

    // `.ts` is scanned as well as `.tsx`: two of the tone maps already live in plain modules
    // (`Modal.types.ts`, `buttonVariants.ts`), so a `.tsx`-only scan would be evaded by moving one.
    expect(
      found,
      "A status colour used as TEXT takes `--{status}-chip-text`; the raw token is a chip FILL " +
        "(light, on --surface: --warning 2.46:1, --success 3.61:1, --info 3.83:1). " +
        "If a hit here is deliberate, add it to `expectedRawStatusHits` WITH its measured contrast; " +
        "if you fixed one, lower or delete its entry. See docs/design/visual-foundations.md.",
    ).toEqual(expectedRawStatusHits);
  });

  /**
   * The map is only worth its noise if every line of it still describes the repository. An entry
   * for a deleted or renamed file would silently shrink the guard's coverage; this refuses that.
   * (Zero-count and over-count drift are already caught by the equality above.)
   */
  it("keeps every raw-status exemption pointing at a file that still exists", () => {
    const missing = Object.keys(expectedRawStatusHits).filter(
      (path) => !existsSync(join(SRC_DIR, path.replace(/^src\//, ""))),
    );

    expect(missing, `Stale entries in \`expectedRawStatusHits\`:\n${missing.join("\n")}`).toEqual([]);
  });
});
