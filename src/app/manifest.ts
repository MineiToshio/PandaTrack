import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/constants";

/**
 * Theme and background colors mirrored from the light-mode Velvet design tokens
 * (`--accent` and `--background` in `src/app/globals.css`, documented in
 * `docs/design/visual-foundations.md`). The Web App Manifest spec only accepts a single
 * static color per field, so these values track the light theme; dark-mode browser
 * chrome is separately covered by the `themeColor` media-query pair in the locale
 * layout's `viewport` export.
 */
const MANIFEST_THEME_COLOR = "#5d33bd";
const MANIFEST_BACKGROUND_COLOR = "#e6e6f5";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    start_url: "/",
    scope: "/",
    display: "standalone",
    theme_color: MANIFEST_THEME_COLOR,
    background_color: MANIFEST_BACKGROUND_COLOR,
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
