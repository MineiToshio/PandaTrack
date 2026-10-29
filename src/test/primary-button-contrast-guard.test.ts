import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buttonVariants } from "@/components/core/Button/buttonVariants";

type Rgb = [number, number, number];
type Color = { rgb: Rgb; alpha: number };
type Theme = "light" | "dark";

const MIN_TEXT_CONTRAST = 4.5;
const MIN_UI_CONTRAST = 3;
const SURFACE_TOKENS = ["--background", "--surface", "--surface-elevated"] as const;
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function themeTokens(theme: Theme): Map<string, string> {
  const tokens = new Map<string, string>();
  const blocks = css.matchAll(/(:root(?:\[data-theme="(light|dark)"\])?)\s*\{([^}]+)\}/g);
  for (const [, , blockTheme, body] of blocks) {
    if (blockTheme && blockTheme !== theme) continue;
    for (const [, name, value] of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
      tokens.set(name, value.trim());
    }
  }
  return tokens;
}

function tokenValue(tokens: Map<string, string>, name: string): string {
  const value = tokens.get(name);
  if (!value) throw new Error(`Missing color token: ${name}`);
  const alias = value.match(/^var\((--[\w-]+)\)$/);
  return alias ? tokenValue(tokens, alias[1]) : value;
}

// CSS Color 4 OKLCH -> Oklab -> linear sRGB matrices, with sRGB channel clipping.
// Keep full precision until the WCAG luminance calculation (no rounded hex colors).
// https://www.w3.org/TR/css-color-4/#color-conversion-code
function parseColor(value: string): Color {
  const match = value.match(/^oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/);
  if (!match) throw new Error(`Unsupported contrast-guard color: ${value}`);
  const lightness = Number(match[1]) / 100;
  const chroma = Number(match[2]);
  const hue = (Number(match[3]) * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear: Rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const rgb = linear.map((channel) => {
    const encoded = channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;
    return Math.max(0, Math.min(1, encoded));
  }) as Rgb;
  return { rgb, alpha: match[4] === undefined ? 1 : Number(match[4]) };
}

function composite(foreground: Rgb, background: Rgb, alpha: number): Rgb {
  return foreground.map((channel, index) => channel * alpha + background[index] * (1 - alpha)) as Rgb;
}

function luminance(rgb: Rgb): number {
  const linear = rgb.map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(first: Rgb, second: Rgb): number {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05) / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

describe("solid button contrast guard", () => {
  it("calibrates WCAG contrast against black/white and the sRGB transfer-function breakpoint", () => {
    expect(contrast([0, 0, 0], [1, 1, 1])).toBeCloseTo(21, 5);
    expect(contrast([0.5, 0.5, 0.5], [1, 1, 1])).toBeCloseTo(3.97665, 4);
    expect(luminance([0.04045, 0.04045, 0.04045])).toBeCloseTo(0.0031308, 7);
    for (const channel of parseColor("oklch(100% 0 0)").rgb) {
      expect(channel).toBeCloseTo(1, 7);
    }
  });

  describe.each(["primary", "destructive"] as const)("%s variant", (variant) => {
    const classes = buttonVariants({ variant });
    function classToken(pattern: RegExp): string {
      const match = classes.match(pattern);
      if (!match) throw new Error(`${variant} button recipe no longer matches ${pattern}`);
      return match[1];
    }

    describe.each<Theme>(["light", "dark"])("%s theme", (theme) => {
      const tokens = themeTokens(theme);
      const color = (name: string): Color => parseColor(tokenValue(tokens, name));
      const fill = color(classToken(/(?:^| )\[background:var\((--[\w-]+)\)\]/)).rgb;
      const text = color(classToken(/(?:^| )\[color:var\((--[\w-]+)\)\]/)).rgb;

      it.each(["rest", "hover", "active"])("keeps %s text >=4.5:1 and the fill boundary >=3:1", (state) => {
        let overlay = text;
        let alpha = 0;
        if (state !== "rest") {
          const overlayToken = classToken(
            new RegExp(`${state}:after:\\[background:color-mix\\(in_oklch,var\\((--[\\w-]+)\\)`),
          );
          const mixToken = classToken(new RegExp(`${state}:after:[^ ]+_var\\((--[\\w-]+)\\)`));
          overlay = color(overlayToken).rgb;
          alpha = parseFloat(tokenValue(tokens, mixToken)) / 100;
        }
        const renderedFill = composite(overlay, fill, alpha);
        // ::after is painted above both the fill and the label. Also check an uncovered
        // label so moving content above the overlay cannot silently invalidate the guard.
        const renderedText = composite(overlay, text, alpha);
        const textRatio = Math.min(contrast(renderedText, renderedFill), contrast(text, renderedFill));
        expect(textRatio, `${theme}/${state}: text contrast ${textRatio.toFixed(3)}:1`).toBeGreaterThanOrEqual(
          MIN_TEXT_CONTRAST,
        );
        for (const surface of SURFACE_TOKENS) {
          const ratio = contrast(renderedFill, color(surface).rgb);
          expect(ratio, `${theme}/${state}: boundary on ${surface} ${ratio.toFixed(3)}:1`).toBeGreaterThanOrEqual(
            MIN_UI_CONTRAST,
          );
        }
      });

      it("keeps the composited focus outline >=3:1 on every adjacent surface", () => {
        const ring = color(classToken(/focus-visible:\[outline-color:var\((--[\w-]+)\)\]/));
        for (const surface of SURFACE_TOKENS) {
          const background = color(surface).rgb;
          const renderedRing = composite(ring.rgb, background, ring.alpha);
          const ratio = contrast(renderedRing, background);
          expect(ratio, `${theme}: focus on ${surface} ${ratio.toFixed(3)}:1`).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
        }
      });
    });
  });

  it.each<Theme>(["light", "dark"])("keeps the legacy eyebrow text >=4.5:1 in %s", (theme) => {
    const tokens = themeTokens(theme);
    const foreground = parseColor(tokenValue(tokens, "--eyebrow-fg")).rgb;
    const canvas = parseColor(tokenValue(tokens, "--background")).rgb;
    const recipe = tokenValue(tokens, "--eyebrow-bg");
    const match = recipe.match(/^color-mix\(in oklch, var\((--[\w-]+)\) ([\d.]+)%, transparent\)$/);
    if (!match) throw new Error(`Unsupported eyebrow background: ${recipe}`);
    const tint = parseColor(tokenValue(tokens, match[1])).rgb;
    const background = composite(tint, canvas, Number(match[2]) / 100);
    const ratio = contrast(foreground, background);
    expect(ratio, `${theme}: eyebrow text ${ratio.toFixed(3)}:1`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });
});
