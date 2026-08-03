/**
 * The trends grid template, shared by the real chart grid and its loading placeholder so the two
 * can never drift apart.
 *
 * The column count is derived from a minimum card width rather than from viewport breakpoints,
 * because the container also narrows when the app sidebar expands: a viewport rule handed a tablet
 * two 320px plots, exactly the cramping this layout exists to fix. `min(100%, …)` keeps a single
 * card from overflowing a container narrower than the floor. 460px of card leaves ~428px of plot,
 * enough for twelve 12px month labels; past that the axis thins its own labels rather than
 * colliding. The page's `max-w-6xl` content column means this never resolves to three columns,
 * which is the intent. See `docs/design/interface-patterns.md` § 15.
 */
export const TRENDS_GRID_CLASS = "grid gap-[18px] grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))]";
