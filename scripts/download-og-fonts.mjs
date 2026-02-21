#!/usr/bin/env node
/**
 * Downloads OG fonts (woff) from Google Fonts into public/fonts/.
 * Run once: node scripts/download-og-fonts.mjs
 * Google returns woff for legacy User-Agent; ImageResponse does not support woff2.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "public", "fonts");

const LEGACY_UA =
  "Mozilla/5.0 (Windows NT 6.1; rv:52.0) Gecko/20100101 Firefox/52.0";

const FONTS = [
  { param: "Zilla+Slab+Highlight", file: "zilla-slab-highlight-700.woff", weight: 700 },
  { param: "Roboto+Condensed", file: "roboto-condensed-400.woff", weight: 400 },
  { param: "Roboto+Condensed", file: "roboto-condensed-700.woff", weight: 700 },
  { param: "Open+Sans", file: "open-sans-400.woff", weight: 400 },
  { param: "Open+Sans", file: "open-sans-600.woff", weight: 600 },
];

async function download(familyParam, weight) {
  const url = `https://fonts.googleapis.com/css2?family=${familyParam}:wght@${weight}&display=swap`;
  const res = await fetch(url, { headers: { "User-Agent": LEGACY_UA } });
  const css = await res.text();
  const m = css.match(/url\((https:\/\/[^)]+\.(woff2|woff|ttf))\)/);
  if (!m) return null;
  const [, fontUrl, format] = m;
  if (format === "woff2") return null;
  const fontRes = await fetch(fontUrl);
  if (!fontRes.ok) return null;
  return fontRes.arrayBuffer();
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  for (const { param, file, weight } of FONTS) {
    const data = await download(param, weight);
    if (data) {
      await fs.writeFile(path.join(OUT_DIR, file), Buffer.from(data));
      console.log("OK", file);
    } else {
      console.warn("SKIP (woff2 only?)", file);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
