import { ROUTES } from "@/lib/constants";

/**
 * The three tabs of the `Progreso` section, and how each maps onto a route.
 *
 * The selection is carried by the PATH, not by a `?tab=` parameter: the album already shipped as
 * `/progress/medals`, with its own medal detail hanging off it, so a query parameter would have
 * given the same panel two addresses and left the detail subview parented to neither. The
 * observable contract `FR-12-30` asks for is unchanged, since the default tab still lives at the
 * bare section URL and an unknown path still falls back to it instead of erroring.
 */
export const PROGRESS_TABS = ["summary", "medals", "ranks"] as const;

export type ProgressTab = (typeof PROGRESS_TABS)[number];

/** The tab the bare section URL opens on. Never written into the URL as a segment of its own. */
export const DEFAULT_PROGRESS_TAB: ProgressTab = "summary";

/** Path segment that identifies each tab, relative to the section root. */
const TAB_SEGMENTS: Readonly<Record<ProgressTab, string>> = {
  summary: "",
  medals: "medals",
  ranks: "ranks",
};

const SEGMENT_TABS: Readonly<Record<string, ProgressTab>> = {
  medals: "medals",
  ranks: "ranks",
};

/**
 * Which tab a pathname selects.
 *
 * Reads the segment after `progress`, so a deeper URL (the medal detail, `/progress/medals/<key>`)
 * keeps its parent tab marked instead of falling back to the default. Anything unrecognised
 * resolves to the default rather than throwing: an unknown tab is a stale link, not an error the
 * collector should be shown a crash for.
 */
export function resolveProgressTab(pathname: string): ProgressTab {
  const segments = pathname.split("/").filter(Boolean);
  const sectionIndex = segments.indexOf("progress");
  if (sectionIndex < 0) return DEFAULT_PROGRESS_TAB;
  const next = segments[sectionIndex + 1];
  if (!next) return DEFAULT_PROGRESS_TAB;
  return SEGMENT_TABS[next] ?? DEFAULT_PROGRESS_TAB;
}

/**
 * `id` of the one region the three tabs swap, shared by the bar's `aria-controls` and the layout
 * element that renders it.
 *
 * One id rather than one per tab: the tabs are routes, so only the selected panel is ever in the
 * document, and giving each tab an id nothing renders would leave every `aria-controls` but one
 * pointing at nothing.
 */
export const PROGRESS_PANEL_ID = "progress-panel";

/** The locale-prefixed href for one tab. The default tab is the bare section URL. */
export function buildProgressTabHref(locale: string, tab: ProgressTab): string {
  const segment = TAB_SEGMENTS[tab];
  return segment ? `/${locale}${ROUTES.progress}/${segment}` : `/${locale}${ROUTES.progress}`;
}
