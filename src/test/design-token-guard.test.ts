import { readdirSync, readFileSync, statSync } from "node:fs";
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
 *  B. L074 — `color-mix(in oklch, var(--<neutral>) …)`. Mixing a low-chroma NEUTRAL
 *     token in the oklch color space collapses the hue to `none` (→ salmon drift). Those
 *     mixes must use `oklab`. High-chroma accent/status tokens may stay in oklch.
 *
 * Legitimate hardcoded colors (OG images, transactional emails, the catastrophic
 * `global-error` fallback, brand SVG marks) live outside Tailwind `className`s / token
 * mixes, so they are not matched by these checks.
 */

const SRC_DIR = join(process.cwd(), "src");

const THEME_BLIND_CLASS =
  /\b(?:text|bg|border|ring|divide|fill|stroke|from|via|to)-(?:white|black)\b|\b(?:text|bg|border|ring|divide|fill|stroke|from|via|to)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;

const OKLCH_OVER_NEUTRAL =
  /color-mix\(\s*in oklch\s*,\s*var\(--(?:surface|surface-elevated|background|foreground|text-primary|text-secondary|text-muted|text-body|text-title|border|border-strong)\b/;

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

describe("design-token guard", () => {
  it("has no theme-blind Tailwind utility classes in components", () => {
    const hits = scan(collect(SRC_DIR, [".tsx"]), THEME_BLIND_CLASS);
    expect(hits, `Use semantic theme tokens instead of literal colors:\n${hits.join("\n")}`).toEqual([]);
  });

  it("has no color-mix(in oklch) over neutral tokens (L074)", () => {
    const hits = scan(collect(SRC_DIR, [".tsx", ".ts", ".css"]), OKLCH_OVER_NEUTRAL);
    expect(hits, `Neutral-token mixes must use oklab, not oklch (L074):\n${hits.join("\n")}`).toEqual([]);
  });
});
