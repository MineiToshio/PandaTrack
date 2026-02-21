# Open Graph (OG) images

Dynamic OG images are generated per route so that when a link is shared (e.g. on social networks), the preview shows a branded image with title and short copy instead of a generic thumbnail.

## How it works

- Next.js [Metadata File Convention](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image): a segment can export an `opengraph-image.tsx` (or `.js`) file that returns an `ImageResponse`. The framework uses it as the `og:image` for that segment.
- We use `next/og` (Satori) to render JSX into a PNG (1200x630). Fonts must be loaded and passed to `ImageResponse` so each text element uses the correct typeface.
- All OG routes use **Node runtime** (`export const runtime = "nodejs"`) so that fonts can be read from disk before the image is generated (no race with async font loading).

## File structure

```
src/
├── app/[locale]/
│   ├── opengraph-image.tsx          # OG for landing (root locale); here to avoid route-group 404
│   ├── terms/opengraph-image.tsx
│   └── privacy/opengraph-image.tsx
├── components/modules/
│   └── OgImageTemplate.tsx          # Shared layout: logo, eyebrow pill, headline, subline
└── lib/
    └── og.ts                        # Font loading (getOgFonts) + image data (getOgImageData) for OG routes
```

- **opengraph-image.tsx** (per segment): awaits `params`, calls `getOgImageData(locale, namespace)`, then returns `new ImageResponse(<OgImageTemplate ... />, { fonts })`. Segment-specific only in the namespace passed to `getOgImageData` (e.g. `"landing"`, `"terms"`, `"privacy"`).
- **og.ts**: font loading (`getOgFonts()` returns `{ fonts, loaded }`) and image data (`getOgImageData(locale, namespace)` loads translations and fonts; returns `{ eyebrow, headline, subline, fontsLoaded, fonts }`) so route handlers stay thin.
- **OgImageTemplate**: receives `eyebrow`, `headline`, `subline`, and `fontsLoaded`. Uses brand colors and gradient background; applies logo font only to the “PandaTrack” logo, title font to eyebrow/headline, body font to subline.

## Copy (i18n)

Each page that has an OG image has three keys in its locale namespace:

- **ogEyebrow**: Short label (e.g. “For collectors”, “Terms”). Shown in a pill above the headline.
- **ogHeadline**: Main line (large, gradient).
- **ogSubline**: Supporting line (body style).

Namespaces and keys:

| Route                 | Namespace | Keys used in opengraph-image           |
| --------------------- | --------- | -------------------------------------- |
| `/[locale]` (landing) | `landing` | `ogEyebrow`, `ogHeadline`, `ogSubline` |
| `/[locale]/terms`     | `terms`   | same                                   |
| `/[locale]/privacy`   | `privacy` | same                                   |

Add or edit these keys in `src/i18n/locales/{en,es}/{landing,terms,privacy}.json` as needed.

## Fonts

ImageResponse (Satori) supports **ttf, otf, woff**. It does **not** support woff2. We use three typefaces:

- **Logo**: Zilla Slab Highlight (700) – only for the “PandaTrack” wordmark.
- **Titles**: Roboto Condensed (400, 700) – eyebrow and headline.
- **Body**: Open Sans (400, 600) – subline.

So that the image is not generated before fonts are ready, we load from disk when possible and pass the resulting array (and `loaded` flags) into `ImageResponse` and the template.

### Load order (`getOgFonts()` in `src/lib/og.ts`)

1. **node_modules/@fontsource**  
   We read woff files from:
   - `@fontsource/zilla-slab-highlight/files/zilla-slab-highlight-latin-700-normal.woff`
   - `@fontsource/roboto-condensed/files/roboto-condensed-latin-400-normal.woff` and `-700-normal.woff`
   - `@fontsource/open-sans/files/open-sans-latin-400-normal.woff` and `-600-normal.woff`  
     These packages are in the repo (devDependencies). This is the primary source.

2. **public/fonts/** (fallback)  
   If no fonts were found from @fontsource (e.g. in a minimal install), we try to read from `public/fonts/` with fixed filenames:
   - `zilla-slab-highlight-700.woff`
   - `roboto-condensed-400.woff`, `roboto-condensed-700.woff`
   - `open-sans-400.woff`, `open-sans-600.woff`  
     You can generate them (when Google returns woff) with:

   ```bash
   npm run download-og-fonts
   ```

   Often Google only returns woff2, so no files are written. In that case you can download woff/ttf from [Google Fonts](https://fonts.google.com/) or [google-webfonts-helper](https://gwfh.mranftl.com/), then place the files in `public/fonts/` with the names above.

3. **Google Fonts (fetch)**  
   If both 1 and 2 yield no fonts, we fetch from Google with a legacy User-Agent to try to get woff/ttf. Many responses are woff2-only, so this fallback often adds nothing.

The template uses `fontsLoaded` so that only when a given family was actually loaded do we set its `fontFamily` to the OG name; otherwise we use system fallbacks (e.g. Georgia for logo, sans-serif for title/body) so Satori does not substitute another loaded font incorrectly.

### Adding or changing fonts

- Font descriptors must match next/og: `name`, `data` (ArrayBuffer), `weight` (100–900), `style` (`"normal"` or `"italic"`).
- In `og.ts`, extend `FONTSOURCE_PATHS` (or `PUBLIC_FONT_FILES` for the fallback) and keep `loaded` in sync with the families you use.
- In `OgImageTemplate`, use the same `name` as in the descriptors for `fontFamily` when `fontsLoaded` is true for that role.

## Adding a new page with an OG image

1. Add the namespace to `OgImageNamespace` in `src/lib/og.ts` (e.g. `"blog"`).
2. Add a route segment (e.g. `src/app/[locale]/blog/opengraph-image.tsx`). In that file: set `runtime = "nodejs"`, await `params`, call `getOgImageData(locale, "blog")`, then return `new ImageResponse(<OgImageTemplate ... />, { fonts })` (same pattern as existing opengraph-image files).
3. In that namespace’s locale files, add `ogEyebrow`, `ogHeadline`, and `ogSubline`.
4. Ensure the segment’s namespace is loaded in `src/i18n/request.ts` (same as for any page with i18n).

Note: `opengraph-image` inside a **route group** (e.g. `(landing)`) can return 404 in Next.js. The landing OG is therefore at `[locale]/opengraph-image.tsx`, not inside `(landing)`.

## Preview

With the dev server running, open:

- Landing: `http://localhost:3000/es/opengraph-image` (or `/en/opengraph-image`)
- Terms: `http://localhost:3000/es/terms/opengraph-image`
- Privacy: `http://localhost:3000/es/privacy/opengraph-image`

Replace `es` with `en` for English copy.
