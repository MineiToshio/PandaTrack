import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/constants";
import { ACCEPTED_IMAGE_MIME_TYPES } from "@/lib/imageIntake/constants";
import { SHARE_TARGET_ACTION_PATH, SHARE_TARGET_FILES_FIELD } from "@/lib/pwa/shareStash";

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
    /**
     * Puts PandaTrack in the Android share sheet for images, so a screenshot goes straight from
     * the chat into the intake flow. The POST is answered by the service worker (`public/sw.js`),
     * which stashes the files and redirects into the app: the original file is uncompressed and
     * would breach the request ceiling if it were posted to the server as is.
     *
     * The accept list deliberately excludes `image/heic`, matching the in-app picker: an iOS HEIC
     * photo cannot be decoded by the canvas compression step, so accepting it here would only
     * produce a failure after the user already committed to the share.
     */
    share_target: {
      action: SHARE_TARGET_ACTION_PATH,
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        files: [
          {
            name: SHARE_TARGET_FILES_FIELD,
            accept: [...ACCEPTED_IMAGE_MIME_TYPES],
          },
        ],
      },
    },
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
