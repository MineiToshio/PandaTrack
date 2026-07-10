import { Inter, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";

/* ── New design system fonts ── */

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  axes: ["opsz"], // activates Inter Display optical cut at large sizes
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

/* ── Legacy fonts — kept for backward compatibility ── */

const robotoCondensed = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/roboto-condensed/files/roboto-condensed-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/roboto-condensed/files/roboto-condensed-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-secondary",
});

const zilla = localFont({
  src: "../../node_modules/@fontsource/zilla-slab-highlight/files/zilla-slab-highlight-latin-700-normal.woff2",
  variable: "--font-logo",
});

export { inter as interFont, jetbrainsMono as monoFont, robotoCondensed as secondaryFont, zilla as logoFont };
