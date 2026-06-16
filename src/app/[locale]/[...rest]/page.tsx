import { notFound } from "next/navigation";

/**
 * Catch-all for any unmatched path under `/[locale]`. Next's App Router only renders a
 * segment's `not-found.tsx` when `notFound()` is thrown — a bare unmatched URL otherwise
 * falls through to the framework default 404. This route turns those misses into a
 * `notFound()` so they render the on-brand, localized `[locale]/not-found.tsx` inside the
 * locale layout (theme + i18n). Specific routes and route groups take priority over it.
 */
export default function CatchAllNotFound() {
  notFound();
}
