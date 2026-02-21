/**
 * Loads fonts for OG image generation. ImageResponse supports ttf, otf, woff (not woff2).
 * 1) Load from node_modules/@fontsource (woff) so fonts are ready before ImageResponse runs.
 * 2) Fallback: public/fonts/ then Google.
 */

import path from "node:path";
import fs from "node:fs/promises";

/** Compatible with next/og ImageResponse FontOptions (weight must be 100-900). */
export type OgFontDescriptor = {
  name: string;
  data: ArrayBuffer;
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style: "normal" | "italic";
};

export const OG_FONT_NAMES = {
  logo: "Zilla Slab Highlight",
  title: "Roboto Condensed",
  body: "Open Sans",
} as const;

export type OgFontsResult = {
  fonts: OgFontDescriptor[];
  loaded: { logo: boolean; title: boolean; body: boolean };
};

/** Paths relative to node_modules (latin subset). */
const FONTSOURCE_PATHS: Array<{ relPath: string; name: string; weight: 400 | 600 | 700 }> = [
  {
    relPath: "@fontsource/zilla-slab-highlight/files/zilla-slab-highlight-latin-700-normal.woff",
    name: OG_FONT_NAMES.logo,
    weight: 700,
  },
  {
    relPath: "@fontsource/roboto-condensed/files/roboto-condensed-latin-400-normal.woff",
    name: OG_FONT_NAMES.title,
    weight: 400,
  },
  {
    relPath: "@fontsource/roboto-condensed/files/roboto-condensed-latin-700-normal.woff",
    name: OG_FONT_NAMES.title,
    weight: 700,
  },
  {
    relPath: "@fontsource/open-sans/files/open-sans-latin-400-normal.woff",
    name: OG_FONT_NAMES.body,
    weight: 400,
  },
  {
    relPath: "@fontsource/open-sans/files/open-sans-latin-600-normal.woff",
    name: OG_FONT_NAMES.body,
    weight: 600,
  },
];

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  const ab = new ArrayBuffer(buffer.length);
  new Uint8Array(ab).set(buffer);
  return ab;
}

/**
 * Load from node_modules/@fontsource (synchronous feel: read from disk, no network).
 * All fonts are read before returning so ImageResponse gets them ready.
 */
async function loadFromFontsource(): Promise<OgFontDescriptor[]> {
  const cwd = process.cwd();
  const results: OgFontDescriptor[] = [];
  for (const { relPath, name, weight } of FONTSOURCE_PATHS) {
    try {
      const filePath = path.join(cwd, "node_modules", relPath);
      const buffer = await fs.readFile(filePath);
      results.push({
        name,
        data: bufferToArrayBuffer(buffer),
        weight,
        style: "normal",
      });
    } catch {
      // package or file missing
    }
  }
  return results;
}

/** Fallback: public/fonts/ (if download-og-fonts was run). */
const PUBLIC_FONT_FILES: Array<{ file: string; name: string; weight: 400 | 600 | 700 }> = [
  { file: "zilla-slab-highlight-700.woff", name: OG_FONT_NAMES.logo, weight: 700 },
  { file: "roboto-condensed-400.woff", name: OG_FONT_NAMES.title, weight: 400 },
  { file: "roboto-condensed-700.woff", name: OG_FONT_NAMES.title, weight: 700 },
  { file: "open-sans-400.woff", name: OG_FONT_NAMES.body, weight: 400 },
  { file: "open-sans-600.woff", name: OG_FONT_NAMES.body, weight: 600 },
];

async function loadFromPublic(): Promise<OgFontDescriptor[]> {
  const dir = path.join(process.cwd(), "public", "fonts");
  const results: OgFontDescriptor[] = [];
  for (const { file, name, weight } of PUBLIC_FONT_FILES) {
    try {
      const buffer = await fs.readFile(path.join(dir, file));
      results.push({ name, data: bufferToArrayBuffer(buffer), weight, style: "normal" });
    } catch {
      // skip
    }
  }
  return results;
}

const LEGACY_USER_AGENT = "Mozilla/5.0 (Windows NT 6.1; rv:52.0) Gecko/20100101 Firefox/52.0";

async function fetchGoogleFont(
  familyParam: string,
  displayName: string,
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900,
): Promise<OgFontDescriptor | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${familyParam}:wght@${weight}&display=swap`;
    const cssRes = await fetch(cssUrl, {
      headers: { "User-Agent": LEGACY_USER_AGENT },
    });
    const css = await cssRes.text();
    const urlMatch = css.match(/url\((https:\/\/[^)]+\.(woff2|woff|ttf))\)/);
    if (!urlMatch) return null;
    const fontUrl = urlMatch[1];
    const format = urlMatch[2];
    if (format === "woff2") return null;
    const fontRes = await fetch(fontUrl);
    if (!fontRes.ok) return null;
    const data = await fontRes.arrayBuffer();
    return { name: displayName, data, weight, style: "normal" };
  } catch {
    return null;
  }
}

/**
 * Loads all OG fonts. Uses @fontsource in node_modules first (woff on disk, no race).
 * Then public/fonts/, then Google. Ensures fonts are fully loaded before returning.
 */
export async function getOgFonts(): Promise<OgFontsResult> {
  let fonts = await loadFromFontsource();
  if (fonts.length === 0) {
    fonts = await loadFromPublic();
  }
  if (fonts.length === 0) {
    const results = await Promise.all([
      fetchGoogleFont("Zilla+Slab+Highlight", OG_FONT_NAMES.logo, 700),
      fetchGoogleFont("Roboto+Condensed", OG_FONT_NAMES.title, 400),
      fetchGoogleFont("Roboto+Condensed", OG_FONT_NAMES.title, 700),
      fetchGoogleFont("Open+Sans", OG_FONT_NAMES.body, 400),
      fetchGoogleFont("Open+Sans", OG_FONT_NAMES.body, 600),
    ]);
    fonts = results.filter((r): r is OgFontDescriptor => r !== null);
  }
  const loaded = {
    logo: fonts.some((f) => f.name === OG_FONT_NAMES.logo),
    title: fonts.some((f) => f.name === OG_FONT_NAMES.title),
    body: fonts.some((f) => f.name === OG_FONT_NAMES.body),
  };
  return { fonts, loaded };
}

/** @deprecated Use getOgFonts() and OG_FONT_NAMES. */
export async function getOgLogoFont(): Promise<OgFontDescriptor | null> {
  const { fonts } = await getOgFonts();
  return fonts.find((f) => f.name === OG_FONT_NAMES.logo) ?? null;
}

export const LOGO_FONT_NAME = OG_FONT_NAMES.logo;
