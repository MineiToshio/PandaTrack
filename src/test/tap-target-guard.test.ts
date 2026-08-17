import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Tap-target regression guard. Two checks, because there are two ways to ship a tap target
 * under the 44×44 minimum:
 *
 *   1. THE RECIPE APPLIED WRONG — padding + a compensating negative margin on a fixed-size box.
 *      Someone reached for the hit area and got geometry that never grows it.
 *   2. NO RECIPE AT ALL — a `<button>` with a fixed box under 44px and no `::before` expansion.
 *      The larger population by far, and the one check (1) is structurally blind to: it keys on
 *      the presence of the wrong fix, so a control nobody ever tried to fix reads as clean.
 *
 * Check (2) is documented below at `findUnexpandedSmallTapTargets`. What follows describes (1).
 *
 * Hand-rolled, zero-dependency check (same shape as `design-token-guard.test.ts`) for a
 * specific antipattern found in `StorePaymentRow.tsx`: `p-*` (or `px-*`/`py-*`/`pt-*`/…)
 * combined with a compensating negative `-m-*` margin, applied to an element that also
 * carries a fixed size (`size-*`, or both `h-*` and `w-*`).
 *
 * That combination never grows the hit area. Tailwind's `size-*` / `h-*`+`w-*` pin the
 * border box, so the padding is consumed inside the box instead of adding to it, and the
 * negative margin only repositions the same fixed box, it does not add hit area outside it.
 * On mobile this silently ships tap targets under the 44×44 minimum (see
 * `docs/design/interface-patterns.md` §12, "Padding does not enlarge a fixed-size box").
 *
 * The fix is to expand the hit area outward with a `::before` pseudo-element, the way
 * `IconButton` (`src/components/core/IconButton.tsx`) and `StorePaymentRow` do:
 * `relative` + `before:absolute before:[inset:-Npx] before:content-['']`.
 *
 * WHERE IT LOOKS: every string and template literal in the file, not `className="…"` alone.
 * The first version anchored on that literal attribute form and was therefore blind to
 * `className={cn(…)}`, which is the form this repo's own coding standards mandate and which
 * `IconButton.tsx` — the component this docstring names as the reference — uses. It was also
 * blind to template literals and to arbitrary values like `size-[28px]`. Scanning every literal
 * costs nothing in false positives: the three utilities have to co-occur in ONE string, and a
 * string that is not a class list does not contain `-m-2`, `p-2` and `size-7` at once.
 *
 * `it("catches …")` below is not decoration. A scanner that quietly stops matching stays green
 * forever, which is the exact failure this guard just had, so the detector is pinned against
 * fixtures of every form it must catch and every near-miss it must not.
 */

const SRC_DIR = join(process.cwd(), "src");

/** A leading Tailwind variant (`md:`, `hover:`, `before:`, `focus-visible:`), never `[color:…]`. */
const VARIANT_PREFIX = /^[a-z0-9][a-z0-9-]*:/;

const NEGATIVE_MARGIN = /^-m[trblxy]?-(?:\d|\[)/;
const PADDING = /^p[trblxy]?-(?:\d|\[)/;
/** `size-7`, `size-[28px]`. */
const FIXED_SIZE = /^size-(?:\d|\[)/;
const FIXED_HEIGHT = /^h-(?:\d|\[)/;
const FIXED_WIDTH = /^w-(?:\d|\[)/;

function baseUtility(token: string): string {
  let rest = token;
  while (VARIANT_PREFIX.test(rest)) rest = rest.slice(rest.indexOf(":") + 1);
  return rest;
}

/** True when one class string pins the box AND pads it AND pulls it back with a negative margin. */
export function isPaddingInsideFixedBox(classString: string): boolean {
  const utilities = classString.split(/\s+/).filter(Boolean).map(baseUtility);
  const has = (pattern: RegExp) => utilities.some((utility) => pattern.test(utility));
  const fixedBox = has(FIXED_SIZE) || (has(FIXED_HEIGHT) && has(FIXED_WIDTH));
  return fixedBox && has(PADDING) && has(NEGATIVE_MARGIN);
}

type Literal = { text: string; line: number };

/**
 * Every string / template literal in the source, with comments skipped so a class list quoted
 * inside a docstring (this file's own, for one) is never read as shipped markup.
 */
function stringLiterals(source: string): Literal[] {
  const literals: Literal[] = [];
  let line = 1;
  let i = 0;

  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];

    if (char === "\n") {
      line += 1;
      i += 1;
    } else if (char === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") i += 1;
    } else if (char === "/" && next === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        if (source[i] === "\n") line += 1;
        i += 1;
      }
      i += 2;
    } else if (char === '"' || char === "'" || char === "`") {
      const openedAt = line;
      let j = i + 1;
      while (j < source.length) {
        if (source[j] === "\\") j += 2;
        else if (source[j] === char) break;
        else {
          if (source[j] === "\n") line += 1;
          j += 1;
        }
      }
      literals.push({ text: source.slice(i + 1, j), line: openedAt });
      i = j + 1;
    } else {
      i += 1;
    }
  }

  return literals;
}

export function findTapTargetAntipatterns(source: string, label: string): string[] {
  return stringLiterals(source)
    .filter((literal) => isPaddingInsideFixedBox(literal.text))
    .map((literal) => `${label}:${literal.line} → ${literal.text.trim()}`);
}

/* -------------------------------------------------------------------------------------------
 * Check 2 — an interactive target under 44px with NO hit-area mechanism at all.
 *
 * KNOWN LIMITS. Each of these is a shape the check deliberately does NOT judge, because judging it
 * statically produces wrong answers, and a guard that cries wolf gets its findings ignored. They are
 * written down so the next person extends the check instead of assuming it already covers them.
 *
 *   1. `min-h-*` / `min-w-*`. A floor is not a box: `min-h-9` renders at 36px only when the content
 *      is shorter than that, and proving the content height needs line-height, font metrics and the
 *      wrapping width. Reading a floor as a box would flag every `min-h-*` control in the repo.
 *      The miss this left open — the "ver tienda" `ViewTransitionLink` in `StoreGroupHeader.tsx`,
 *      36px tall from `min-h-9` — was found and fixed BY HAND, by reading the file, not by this
 *      guard. It carries `before:[inset:-4px_0]` now, and the guard would be just as green if it
 *      did not: nothing here can see it either way. Roughly two dozen other `min-h-*` values under
 *      44px exist in `src/`; whether any of them is an interactive control under the floor has not
 *      been established, and this check will not be the thing that establishes it.
 *   2. Sizes that live in a CSS file rather than a utility. `.mk-theme button` in `globals.css` is
 *      28×26 and drives the public segmented theme toggle, which the landing burger menu renders on
 *      phones. Nothing in the TSX says 26, so no scan of the TSX can see it.
 *   3. Sizes from `style={{}}`, a prop, or any value computed at runtime.
 *   4. Heights derived from text. Only WIDTH is inferred from content, and only for icon-only
 *      controls, where the icon carries its own static size.
 *   5. Overlap between two expansions. The check asks whether a mechanism exists, never whether the
 *      insets fit the clearance — the arithmetic legitimately differs per control, and getting it
 *      wrong is a design review, not a regex.
 *   6. Whether a flagged control renders on a touch viewport at all. `hidden … lg:block` ancestors
 *      are not tracked; that judgement is made by hand and recorded in `DELIBERATELY_SMALL`.
 * ---------------------------------------------------------------------------------------- */

/** WCAG 2.5.8 / the repo's mobile floor, `docs/design/interface-patterns.md` §12. */
const MIN_TAP_TARGET_PX = 44;
/** Tailwind's spacing scale: `size-7` is 7 × 4px. */
const SPACING_STEP_PX = 4;
const ROOT_FONT_SIZE_PX = 16;

/**
 * Comments blanked out (same length, newlines kept) so offsets and line numbers survive. Without
 * this an apostrophe in ordinary prose ("the input's padding") opens a phantom string literal and
 * the tag scanner runs off the end of the element — which is exactly how `PasswordInput.tsx`, a
 * 46px-tall control, first showed up as a 16px-wide one.
 */
function stripComments(source: string): string {
  let out = "";
  let i = 0;
  let quote: string | null = null;

  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];

    if (quote) {
      out += char;
      if (char === "\\") {
        out += next ?? "";
        i += 2;
        continue;
      }
      if (char === quote) quote = null;
      i += 1;
    } else if (char === '"' || char === "'" || char === "`") {
      quote = char;
      out += char;
      i += 1;
    } else if (char === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") {
        out += " ";
        i += 1;
      }
    } else if (char === "/" && next === "*") {
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        out += source[i] === "\n" ? "\n" : " ";
        i += 1;
      }
      out += "  ";
      i += 2;
    } else {
      out += char;
      i += 1;
    }
  }

  return out;
}

/**
 * Tag names worth opening at all. Deliberately a closed set: scanning EVERY `<Name` in a `.tsx`
 * file also picks up a stray `x <y && …` comparison, and a closed set makes that harmless.
 *
 * - `button` is a target unconditionally.
 * - `a` / `Link` / `ViewTransitionLink` are targets when they navigate (`href`). A bare `<a>` with
 *   no href is a link anchor, not a control.
 * - the container tags are targets only when they carry `role="button"`, EXCEPT `label`, which is
 *   also a target when it wraps a checkbox or radio input. That is the shape a custom-painted
 *   checkbox takes in this repo (`PendingProductSelectToggle`): a real `<input>` kept `sr-only`
 *   inside a `<label>` that carries the whole visible box. The label IS the hit area there, and
 *   every earlier version of this guard was structurally blind to it — `label` only counted with a
 *   literal `role="button"`, which such a control never has, and `input` was never scanned at all.
 * - `IconButton` is not a target itself — it owns its hit area — but a CALLER can shrink it from
 *   the outside, which is checked separately below.
 */
const TAG_ALWAYS_INTERACTIVE = new Set(["button"]);
const TAG_INTERACTIVE_WHEN_HREF = new Set(["a", "Link", "ViewTransitionLink"]);
const TAG_INTERACTIVE_WHEN_ROLE_BUTTON = new Set(["div", "span", "li", "label", "td", "tr", "section", "article", "p"]);
/** Components that ship their own `::before` expansion, mapped to the px it ADDS per axis. */
const HIT_AREA_COMPONENTS = new Map([["IconButton", 12]]); // `before:[inset:-6px]` → 6px each side.

const SCANNED_TAGS = new Set([
  ...TAG_ALWAYS_INTERACTIVE,
  ...TAG_INTERACTIVE_WHEN_HREF,
  ...TAG_INTERACTIVE_WHEN_ROLE_BUTTON,
  ...HIT_AREA_COMPONENTS.keys(),
]);

type OpenTag = Literal & { name: string; selfClosing: boolean; end: number };

/** Every OPENING tag of a scanned name, brace-balanced so `className={cn(…)}` is captured whole. */
function openTags(source: string): OpenTag[] {
  const tags: OpenTag[] = [];
  const opener = /<([A-Za-z][A-Za-z0-9_.]*)(?=[\s/>])/g;
  let match: RegExpExecArray | null;

  while ((match = opener.exec(source))) {
    if (!SCANNED_TAGS.has(match[1])) continue;
    const start = match.index;
    let depth = 0;
    let quote: string | null = null;
    let i = start;

    for (; i < source.length; i += 1) {
      const char = source[i];
      if (quote) {
        if (char === "\\") i += 1;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") quote = char;
      else if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;
      else if (char === ">" && depth === 0) break;
    }

    tags.push({
      name: match[1],
      text: source.slice(start, i + 1),
      selfClosing: source[i - 1] === "/",
      end: i + 1,
      line: source.slice(0, start).split("\n").length,
    });
  }

  return tags;
}

/** The markup between an opening tag and its matching close, or `""` when self-closing. */
function tagChildren(source: string, tag: OpenTag): string {
  if (tag.selfClosing) return "";
  const open = new RegExp(`<${tag.name}(?=[\\s/>])`, "g");
  const close = new RegExp(`</${tag.name}\\s*>`, "g");
  let depth = 1;
  let cursor = tag.end;

  while (depth > 0 && cursor < source.length) {
    open.lastIndex = cursor;
    close.lastIndex = cursor;
    const nextOpen = open.exec(source);
    const nextClose = close.exec(source);
    if (!nextClose) return "";
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth += 1;
      cursor = nextOpen.index + nextOpen[0].length;
      continue;
    }
    depth -= 1;
    if (depth === 0) return source.slice(tag.end, nextClose.index);
    cursor = nextClose.index + nextClose[0].length;
  }

  return "";
}

type Utility = { variants: string[]; base: string };

/** Splits every string literal inside a tag into `md:`-style variants plus the bare utility. */
function tagUtilities(tagText: string): Utility[] {
  const utilities: Utility[] = [];
  const literal = /(["'`])((?:\\.|(?!\1)[\s\S])*)\1/g;
  let match: RegExpExecArray | null;

  while ((match = literal.exec(tagText))) {
    for (const token of match[2].split(/\s+/).filter(Boolean)) {
      const variants: string[] = [];
      let rest = token;
      while (VARIANT_PREFIX.test(rest)) {
        variants.push(rest.slice(0, rest.indexOf(":")));
        rest = rest.slice(rest.indexOf(":") + 1);
      }
      utilities.push({ variants, base: rest });
    }
  }

  return utilities;
}

/**
 * `--space-*` in px, read from `globals.css` rather than hardcoded, so the table cannot drift away
 * from the tokens the app actually ships. `px-[var(--space-1)]` is how this repo writes padding.
 */
const SPACE_TOKENS_PX: Map<string, number> = (() => {
  const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");
  const tokens = new Map<string, number>();
  for (const [, name, value, unit] of css.matchAll(/(--space-[\w_]+)\s*:\s*(\d+(?:\.\d+)?)(rem|px)?\s*;/g)) {
    tokens.set(name, unit === "px" ? Number(value) : Number(value) * ROOT_FONT_SIZE_PX);
  }
  return tokens;
})();

/** `7` → 28, `[28px]` → 28, `[1.75rem]` → 28, `[var(--space-1)]` → 4. `null` when not static. */
function spacingToPx(value: string): number | null {
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value) * SPACING_STEP_PX;
  const arbitrary = value.match(/^\[(.+)]$/);
  if (!arbitrary) return null;
  const px = arbitrary[1].match(/^(\d+(?:\.\d+)?)px$/);
  if (px) return Number(px[1]);
  const rem = arbitrary[1].match(/^(\d+(?:\.\d+)?)rem$/);
  if (rem) return Number(rem[1]) * ROOT_FONT_SIZE_PX;
  const token = arbitrary[1].match(/^var\((--space-[\w_]+)\)$/);
  if (token) return SPACE_TOKENS_PX.get(token[1]) ?? null;
  return null;
}

/**
 * The box the element is PINNED to at the mobile breakpoint, or `null` per axis when it is free.
 *
 * Only unprefixed utilities count. `md:size-7` pins nothing on a phone, which is where the 44px
 * floor applies, and a variant-prefixed value read as the base box is how a guard starts reporting
 * boxes the user never sees.
 *
 * It matches on the TOKEN, never on a substring: `min-h-10` and `min-w-0` are their own utilities
 * and set no fixed box, so the naive `/h-\d/` search that conflates them with `h-10`/`w-10` — and
 * would flag every `min-h-*` control in the repo — cannot happen here.
 */
function resolveFixedBox(utilities: Utility[]): { height: number | null; width: number | null } {
  let height: number | null = null;
  let width: number | null = null;

  for (const { variants, base } of utilities) {
    if (variants.length > 0) continue;
    const size = base.match(/^size-(.+)$/);
    if (size) {
      const value = spacingToPx(size[1]);
      height ??= value;
      width ??= value;
      continue;
    }
    const h = base.match(/^h-(.+)$/);
    if (h) height ??= spacingToPx(h[1]);
    const w = base.match(/^w-(.+)$/);
    if (w) width ??= spacingToPx(w[1]);
  }

  return { height, width };
}

/** Total horizontal padding, or `null` when any side is not statically resolvable. */
function resolveHorizontalPadding(utilities: Utility[]): number | null {
  let left: number | null = null;
  let right: number | null = null;
  let sawPadding = false;

  for (const { variants, base } of utilities) {
    if (variants.length > 0) continue;
    const match = base.match(/^p[xlr]?-(.+)$/);
    if (!match) continue;
    const axis = base.startsWith("px-") ? "x" : base.startsWith("pl-") ? "l" : base.startsWith("pr-") ? "r" : "all";
    const value = spacingToPx(match[1]);
    sawPadding = true;
    if (value === null) return null;
    if (axis === "l") left ??= value;
    else if (axis === "r") right ??= value;
    else {
      left ??= value;
      right ??= value;
    }
  }

  if (!sawPadding) return 0;
  return (left ?? 0) + (right ?? 0);
}

/**
 * `<Eye className="size-4" />`, `<Icon size={13} />` → 16 / 13. `null` when not static.
 *
 * A ternary between two literals — `size={size === "sm" ? 12 : 14}`, how the date pickers write
 * theirs — resolves to the WIDER branch. That is the sound direction for a check that reports
 * "too small": if even the widest rendering is under the floor, every rendering is, so the finding
 * holds without knowing which branch is live. Reading it as "not static" instead is what hid
 * `DateRangePickerInput`'s clear button, a control identical to `SearchableSelect`'s and 18px wide,
 * from every version of this guard.
 */
function resolveIconWidth(elementText: string): number | null {
  const sizeProp = elementText.match(/\ssize=\{(\d+(?:\.\d+)?)\}/);
  if (sizeProp) return Number(sizeProp[1]);
  const ternarySize = elementText.match(/\ssize=\{[^{}]*\?\s*(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)\s*\}/);
  if (ternarySize) return Math.max(Number(ternarySize[1]), Number(ternarySize[2]));
  const utilities = tagUtilities(elementText);
  const { width } = resolveFixedBox(utilities);
  return width;
}

/**
 * The `className` value as written, or `null` when the tag has none.
 * Brace-balanced, so `className={cn(…, …)}` comes back whole.
 */
function classNameExpression(tagText: string): string | null {
  const at = tagText.search(/\sclassName\s*=/);
  if (at === -1) return null;
  const start = tagText.indexOf("=", at) + 1;
  let i = start;
  while (i < tagText.length && /\s/.test(tagText[i])) i += 1;
  const opener = tagText[i];
  if (opener === '"' || opener === "'" || opener === "`") {
    const close = tagText.indexOf(opener, i + 1);
    return tagText.slice(i, close + 1);
  }
  if (opener !== "{") return null;
  let depth = 0;
  let quote: string | null = null;
  for (let j = i; j < tagText.length; j += 1) {
    const char = tagText[j];
    if (quote) {
      if (char === "\\") j += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return tagText.slice(i, j + 1);
    }
  }
  return null;
}

/**
 * True when every class the element gets is visible right here, as a literal.
 *
 * The content-width check below infers a box from the ABSENCE of a width utility, so it may only
 * run when it can see the whole class list. `className={overflowBtnClass}` in
 * `DeliveryStickyActionBar` is the counter-example that forced this: the shared constant carries
 * `size-11`, the tag itself carries nothing, and reading "no width utility" off the tag reported a
 * correct 44px control as a 20px one. Anything but plain strings inside `cn(…)` is refused,
 * conditionals included — a conditional class can pin a size just as well as a constant.
 */
function hasFullyStaticClassName(tagText: string): boolean {
  const expression = classNameExpression(tagText);
  if (expression === null) return true;
  const withoutStrings = expression.replace(/(["'`])(?:\\.|(?!\1)[\s\S])*\1/g, "");
  return !/[^\s{}(),]/.test(withoutStrings.replace(/\bcn\b/g, ""));
}

/**
 * The natural width of an ICON-ONLY control: padding + the widest icon it renders.
 *
 * Returns `null` — "do not judge" — the moment anything is not statically provable, which is most
 * of the time and by design. It requires (a) at least one self-closing child element, (b) every one
 * of them to resolve to a static width, and (c) the leftovers once those elements are removed to be
 * nothing but whitespace and expression punctuation, where the only identifiers allowed are the ones
 * immediately followed by `?` or `&&` — i.e. conditions. `{label}` renders text of unknown width and
 * is therefore skipped, and so is `{t("x")}`.
 */
function resolveContentWidth(children: string, utilities: Utility[]): number | null {
  const padding = resolveHorizontalPadding(utilities);
  if (padding === null) return null;

  const elements = children.match(/<[A-Za-z][^<>]*\/>/g) ?? [];
  if (elements.length === 0) return null;

  const widths = elements.map(resolveIconWidth);
  if (widths.some((value) => value === null)) return null;

  const leftovers = elements.reduce((rest, element) => rest.replace(element, " "), children);
  if (/[<>]/.test(leftovers)) return null;
  for (const identifier of leftovers.matchAll(/[A-Za-z_$][\w$.]*/g)) {
    const after = leftovers.slice(identifier.index + identifier[0].length).trimStart();
    if (!after.startsWith("?") && !after.startsWith("&&")) return null;
  }
  if (/[^\s{}()?:!&|]/.test(leftovers.replace(/[A-Za-z_$][\w$.]*/g, ""))) return null;

  const border = utilities.some(({ variants, base }) => variants.length === 0 && /^border(?:-\d+)?$/.test(base));
  return padding + Math.max(...(widths as number[])) + (border ? 2 : 0);
}

export type SmallTapTarget = {
  file: string;
  line: number;
  height: number | null;
  width: number | null;
  /** How the undersized box was proved, so the failure message can say what to change. */
  kind: "fixed-box" | "content-width" | "shrunk-component";
  /** The opening tag on one line, so a reader (and the allowlist) can tell WHICH button this is. */
  tag: string;
};

/** `role="button"` written as a literal attribute or as `role={"button"}`. */
function hasRoleButton(tagText: string): boolean {
  return /\srole=(?:"button"|'button'|\{"button"\}|\{'button'\})/.test(tagText);
}

/**
 * A `<label>` whose subtree holds a checkbox or radio `<input>`. Clicking anywhere on such a label
 * activates the control, so the label's own box is the tap target — including when the input is
 * `sr-only` and the label paints the entire thing, which is how this repo writes custom checkboxes.
 */
function wrapsAToggleInput(children: string): boolean {
  return /<input\b[^>]*\stype=(?:"(?:checkbox|radio)"|'(?:checkbox|radio)'|\{"(?:checkbox|radio)"\})/.test(children);
}

/**
 * True when the element grows its hit area with an absolutely positioned pseudo-element.
 *
 * BOTH pseudos count. The recipe in `docs/design/interface-patterns.md` §12 is written with
 * `::before` because `IconButton` uses it, and every earlier version of this check hardcoded that
 * one word — so `OrderItemStateChip`, which has always bought its 47px target with
 * `after:absolute after:-inset-y-3.5` (its `::before` is not free: the chip is a pill and the
 * overlay must paint over the card's own link overlay), was one `size-*` away from being reported
 * as an undersized control that is in fact 44×44. Which pseudo carries the expansion is a free
 * choice of the component; the mechanism is identical.
 */
function hasPseudoHitArea(utilities: Utility[]): boolean {
  return utilities.some(
    ({ variants, base }) => (variants.includes("before") || variants.includes("after")) && base === "absolute",
  );
}

function isInteractive(tag: OpenTag, children: string): boolean {
  if (TAG_ALWAYS_INTERACTIVE.has(tag.name)) return true;
  if (TAG_INTERACTIVE_WHEN_HREF.has(tag.name)) return /\shref[=\s]/.test(tag.text);
  if (tag.name === "label" && wrapsAToggleInput(children)) return true;
  if (TAG_INTERACTIVE_WHEN_ROLE_BUTTON.has(tag.name)) return hasRoleButton(tag.text);
  return false;
}

/**
 * Interactive targets that end up under 44px with no hit-area mechanism, in three shapes:
 *
 *   `fixed-box`        a `size-*` / `h-*`+`w-*` box under 44 and no `before:absolute`. Covers
 *                      `<button>`, navigating `<a>` / `<Link>` / `<ViewTransitionLink>`, and any
 *                      `role="button"` container.
 *   `content-width`    no width utility at all — the box comes out of padding + a fixed-size icon,
 *                      which is how `PasswordInput`'s 24px-wide eye toggle hid from the first
 *                      version of this guard. Only reported when the width is statically provable.
 *   `shrunk-component` a caller narrowing a component that owns its own expansion
 *                      (`<IconButton className="size-6" />`: 24px box + `inset:-6px` = 36, not 44).
 *
 * The mechanism is the only thing checked on `fixed-box`, not the arithmetic of the inset: an
 * absolute `::before` OR `::after` present at all means someone did the sizing deliberately, and
 * the insets legitimately differ per control (`-6px` on `IconButton`'s 32px box, `-11px_-3px` on a
 * 38×22 switch track, `-13px` on an 18px chip). See `hasPseudoHitArea`.
 */
export function findUnexpandedSmallTapTargets(source: string, file: string): SmallTapTarget[] {
  const clean = stripComments(source);

  return openTags(clean).flatMap((tag): SmallTapTarget[] => {
    const utilities = tagUtilities(tag.text);
    const oneLine = tag.text.replace(/\s+/g, " ").trim();
    const report = (kind: SmallTapTarget["kind"], height: number | null, width: number | null) => [
      { file, line: tag.line, height, width, kind, tag: oneLine },
    ];

    const budget = HIT_AREA_COMPONENTS.get(tag.name);
    if (budget !== undefined) {
      const { height, width } = resolveFixedBox(utilities);
      const short = height !== null && height + budget < MIN_TAP_TARGET_PX;
      const narrow = width !== null && width + budget < MIN_TAP_TARGET_PX;
      return short || narrow ? report("shrunk-component", height, width) : [];
    }

    const children = tagChildren(clean, tag);
    if (!isInteractive(tag, children)) return [];
    if (hasPseudoHitArea(utilities)) return [];

    const { height, width } = resolveFixedBox(utilities);
    if (height !== null && height < MIN_TAP_TARGET_PX) return report("fixed-box", height, width);
    if (width !== null && width < MIN_TAP_TARGET_PX) return report("fixed-box", height, width);
    if (width !== null) return [];
    if (!hasFullyStaticClassName(tag.text)) return [];

    const contentWidth = resolveContentWidth(children, utilities);
    if (contentWidth !== null && contentWidth < MIN_TAP_TARGET_PX) {
      return report("content-width", height, contentWidth);
    }
    return [];
  });
}

/**
 * Controls that are pinned under 44px on purpose and stay that way. Keyed by a substring of the
 * tag rather than a line number so the entry cannot silently absorb a NEW small button added to
 * the same file later.
 */
const DELIBERATELY_SMALL: Array<{ file: string; contains: string; because: string }> = [
  {
    file: "src/app/[locale]/(app)/orders/_components/OrdersTable.tsx",
    contains: "order-row-items-",
    because:
      "The table it lives in is `hidden … lg:block`, so this row chevron never renders below 1024px. The 44px floor is the touch floor, and the repo's own recipe drops the expansion from `md:` up.",
  },
  {
    file: "src/app/[locale]/(app)/deliveries/_components/DeliveriesTable.tsx",
    contains: "delivery-row-items-",
    because: "Same `hidden … lg:block` desktop-only table as `OrdersTable`.",
  },
  {
    file: "src/components/modules/Sidebar.tsx",
    contains: 'navigation_level: "primary", viewport: "desktop"',
    because:
      "Primary nav row in the PUSH sidebar, whose root is `hidden … lg:flex`, so this 40px row never renders below 1024px. Below that the same destinations are `AppNavDrawer` rows, which are `h-11 min-h-11`.",
  },
  {
    file: "src/components/modules/Sidebar.tsx",
    contains: 'navigation_level: "admin"',
    because: "Admin nav row in the same `hidden … lg:flex` PUSH sidebar as the primary rows above.",
  },
];

/**
 * Controls whose hit area cannot reach 44×44 by any means, with the specific blocker per entry.
 * Distinct from `DELIBERATELY_SMALL` ("correct as it is") — an entry here means "known defect".
 *
 * **It is empty, and that is the point.** Everything that used to sit here — ten controls across
 * seven components — was not unfixable, only unfixable *by a pseudo-element*: a wrapped chip row,
 * the trailing cluster of a 46px field, a spreadsheet's row pitch, and a toast whose
 * `overflow-hidden` root clipped the pseudo out of hit-testing. All of them were resolved by
 * RESIZING the box for the band where a finger uses it and dropping back to the compact box at the
 * breakpoint where the pointer gets precise, per `docs/design/interface-patterns.md` §12 ("A dense
 * cluster is resized, never expanded"). Two boxes in normal flow cannot overlap, so that fix has no
 * contested band for the later element to steal, which is exactly what the `::before` recipe could
 * not promise in any of these places.
 *
 * So before adding an entry: "a pseudo big enough would eat my neighbour" is the reason to RESIZE,
 * not the reason to be exempt. A real entry has to show that neither a pseudo NOR a bigger box can
 * work — and note that a bigger box may grow into its own parent's padding (`Toast`, `DateInput`)
 * when that padding is dead space rather than another control's clearance.
 *
 * Entries are audited below against the real source, so one cannot outlive the control it names.
 */
const DENSITY_EXCEPTIONS: Array<{ file: string; contains: string; because: string }> = [];

function matches(entries: Array<{ file: string; contains: string }>, file: string, tagLine: string): boolean {
  return entries.some((entry) => entry.file === file && tagLine.includes(entry.contains));
}

function isDeliberatelySmall(file: string, tagLine: string): boolean {
  return matches(DELIBERATELY_SMALL, file, tagLine) || matches(DENSITY_EXCEPTIONS, file, tagLine);
}

function isTestPath(path: string): boolean {
  return /\.test\.[tj]sx?$/.test(path) || /(?:^|\/)(?:_tests|__tests__)(?:\/|$)/.test(path);
}

function collect(dir: string, extensions: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collect(full, extensions));
    } else if (extensions.some((ext) => full.endsWith(ext)) && !isTestPath(full)) {
      out.push(full);
    }
  }
  return out;
}

describe("tap-target guard", () => {
  it("has no padding-inside-a-fixed-size-box tap-target antipattern", () => {
    const hits = collect(SRC_DIR, [".tsx"]).flatMap((file) =>
      findTapTargetAntipatterns(readFileSync(file, "utf8"), file.replace(SRC_DIR, "src")),
    );
    expect(
      hits,
      `Padding inside a fixed-size box (size-*/h-*+w-*) does not grow the tap target; expand the hit area with a ::before pseudo instead (see IconButton.tsx):\n${hits.join("\n")}`,
    ).toEqual([]);
  });

  it("has no interactive target pinned under 44px without a hit-area mechanism", () => {
    const hits = collect(SRC_DIR, [".tsx"])
      .flatMap((file) => findUnexpandedSmallTapTargets(readFileSync(file, "utf8"), file.replace(SRC_DIR, "src")))
      .filter((hit) => !isDeliberatelySmall(hit.file, hit.tag));
    expect(
      hits,
      `An interactive target under ${MIN_TAP_TARGET_PX}px with no hit-area mechanism. Expand it outward with the ::before pseudo (see IconButton.tsx), then check the clearance to the nearest expanded control — two areas closer than the sum of their insets overlap, and the later element in the DOM takes the whole contested band. Watch for an overflow-hidden ancestor, which clips the pseudo away entirely. If it is correct as it is (desktop-only), add it to DELIBERATELY_SMALL; if the pseudo genuinely cannot apply, add it to DENSITY_EXCEPTIONS. Either needs the reason:\n${hits
        .map((hit) => `${hit.file}:${hit.line} → ${hit.height}×${hit.width} — ${hit.tag}`)
        .join("\n")}`,
    ).toEqual([]);
  });

  it("catches the missing mechanism on the real shapes this repo writes buttons in", () => {
    // Every fixture is a real control copied off the repo, minus the fix, so a scanner that stops
    // matching the code as it is actually written fails here instead of going quietly green.
    const forms: Array<[string, string]> = [
      [
        // src/app/[locale]/(app)/orders/[id]/_components/OrderPaymentRow.tsx
        "literal className, size-*",
        `<button type="button" onClick={() => setModalOpen(true)} aria-label={t("detail.payments.deleteLabelDetailed", { amount: amountLabel })} className="text-text-muted grid size-7 shrink-0 cursor-pointer place-items-center rounded-md transition-colors" >`,
      ],
      [
        // src/app/[locale]/(app)/orders/_components/StoreGroupHeader.tsx
        "literal className, h-* + w-*",
        `<button type="button" onClick={onToggleExpand} aria-expanded={isExpanded} className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)]" >`,
      ],
      [
        // src/app/[locale]/(app)/orders/[id]/_components/OrderInlinePaymentForm.tsx
        "cn() call across several strings",
        `<button type="button" onClick={onCancel} className={cn( "grid size-6 place-items-center rounded-md", "[color:var(--text-muted)] hover:[color:var(--text-primary)]", )} >`,
      ],
      [
        // src/app/[locale]/(app)/stores/_components/share/InlineSwitch.tsx
        "arbitrary px values on a non-square track",
        `<button type="button" role="switch" aria-checked={checked} className={cn( "relative h-[22px] w-[38px] flex-shrink-0 rounded-full", checked ? "[background:var(--accent)]" : "[background:var(--border-strong)]", )} >`,
      ],
      [
        // src/app/[locale]/(app)/orders/_components/share/OrderItemStateChip.tsx, minus its
        // `after:absolute`. The box is pinned inside a TERNARY branch of a `cn()` whose other
        // arguments are identifiers — the shape the fixed-box check has to read before
        // `hasFullyStaticClassName` ever gets consulted, and the one this chip is really written in.
        "box pinned inside a ternary branch of cn(), among identifier arguments",
        `<button type="button" disabled={isPending} aria-label={nextStateLabel} className={cn( CHIP_BASE, toneClass, "relative", isQuietLabel ? "size-[18px] justify-center px-0 md:size-auto" : "after:inset-x-0", isPending && "opacity-60", )} >{body}</button>`,
      ],
      [
        // The comment carries an apostrophe, which is what ran the tag scanner off the end of
        // `PasswordInput.tsx` and reported a 46px control as a 16px one.
        "className preceded by a prose comment containing an apostrophe",
        `<button type="button" // Cancels the input's vertical padding.\n className="grid size-6 place-items-center" >`,
      ],
    ];
    for (const [form, source] of forms) {
      expect(findUnexpandedSmallTapTargets(source, "fixture"), form).toHaveLength(1);
    }
  });

  it("catches the shapes a button-tag-only scanner is blind to", () => {
    // One fixture per element kind the guard grew to cover, each copied off a control that really
    // exists in `src/`, so "it compiles" is never mistaken for "it still sees the repo".
    const forms: Array<[string, string, SmallTapTarget["kind"]]> = [
      [
        // src/app/[locale]/(app)/stores/[slug]/_components/StoreDetailContent.tsx
        "navigating <a> with a fixed box",
        `<a href={href} className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)]" aria-label={label} ><Copy size={14} /></a>`,
        "fixed-box",
      ],
      [
        // src/components/modules/Sidebar.tsx
        "next/link with a fixed box",
        `<Link href={href} className={cn("flex h-10 items-center gap-3 rounded-lg")}>{label}</Link>`,
        "fixed-box",
      ],
      [
        // src/app/[locale]/(app)/orders/_components/StoreGroupHeader.tsx uses this component.
        "ViewTransitionLink with a fixed box",
        `<ViewTransitionLink href={storeHref} viewTransitionEntity="store" className="inline-flex h-9 items-center gap-1 px-2">{label}</ViewTransitionLink>`,
        "fixed-box",
      ],
      [
        // src/components/core/DateInput.tsx
        'role="button" on a non-button element',
        `<span role="button" aria-label={t("clear")} onClick={handleClear} className="flex h-6 w-6 items-center" ><X size={14} /></span>`,
        "fixed-box",
      ],
      [
        // src/components/core/PasswordInput.tsx — 16px icon + 2 x 4px padding = 24px wide, and NO
        // width utility anywhere for a box-based check to read.
        "width that comes out of the content, not a class",
        `<button type="button" className="-my-[var(--space-3)] flex h-[2.875rem] items-center px-[var(--space-1)]" aria-label={label} >{isVisible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}</button>`,
        "content-width",
      ],
      [
        // src/components/core/Toast/Toast.tsx — no padding at all, so the box IS the icon.
        "content width with no padding utility",
        `<button type="button" onClick={dismiss} className="text-text-muted shrink-0 cursor-pointer" aria-label={t("dismiss")} ><X size={16} aria-hidden /></button>`,
        "content-width",
      ],
      [
        // src/components/core/DateRangePickerInput.tsx — the icon's size is a ternary between two
        // literals, which every earlier version read as "not static" and therefore never judged.
        // Widest branch 14 + 2 x 2 padding = 18px, the same box as SearchableSelect's clear.
        "content width whose icon size is a ternary between two literals",
        `<button type="button" aria-label={clearLabel} onClick={handleClear} className="rounded p-0.5 [color:var(--text-muted)]" ><X size={size === "sm" ? 12 : 14} aria-hidden /></button>`,
        "content-width",
      ],
      [
        // A caller can undo a component's own expansion from the outside: 24 + 2 x 6 = 36, not 44.
        "IconButton shrunk below its own ::before budget by the caller",
        `<IconButton Icon={X} aria-label={label} className="size-6" />`,
        "shrunk-component",
      ],
      [
        // src/app/[locale]/(app)/orders/_components/PendingProductSelectToggle.tsx, minus its
        // `::before`. A real checkbox kept `sr-only` inside a `<label>` that paints the whole box:
        // the label IS the target, it carries no `role="button"`, and every earlier version of
        // this guard read it as a decorative container and stayed green on a 36px control.
        "label painting a custom checkbox around an sr-only input",
        `<label onMouseDown={handleMouseDown} className={cn("group relative grid shrink-0 cursor-pointer place-items-center rounded-[var(--radius-md)] select-none", variant === "card" ? "h-9 w-9" : "h-8 w-8")}><input type="checkbox" className="peer sr-only" checked={checked} aria-label={label} onChange={handleChange} /><span aria-hidden className="col-start-1 row-start-1" /></label>`,
        "fixed-box",
      ],
    ];
    for (const [form, source, kind] of forms) {
      const hits = findUnexpandedSmallTapTargets(source, "fixture");
      expect(hits, form).toHaveLength(1);
      expect(hits[0].kind, form).toBe(kind);
    }
  });

  it("does not fire on the new element kinds when they are fine", () => {
    const allowed: Array<[string, string]> = [
      // An anchor with no href is a jump target, not a control.
      ["<a> with no href", `<a id="section" className="block h-6 w-6" />`],
      ["<a> big enough", `<a href={href} className="inline-flex size-11 items-center justify-center"><Copy /></a>`],
      // Without `role="button"` a small <span>/<div> is decoration, and flagging those would light
      // up every icon wrapper in the repo.
      ["small <span> with no role", `<span className="flex h-4 w-4 items-center"><X size={14} /></span>`],
      [
        "role that is not button",
        `<span role="presentation" className="flex h-4 w-4 items-center"><X size={14} /></span>`,
      ],
      // The counter-example that forced `hasFullyStaticClassName`: the shared constant carries
      // `size-11`, the tag carries nothing, and judging by absence reported 44px as 20px.
      [
        "className from a variable the tag cannot see (DeliveryStickyActionBar)",
        `<button type="button" onClick={onOpenActionsSheet} className={overflowBtnClass} aria-label={label} ><Ellipsis className="size-5" aria-hidden /></button>`,
      ],
      [
        "className from cn() with a constant (IntakeUploadPanel)",
        `<button type="button" className={cn(REORDER_BUTTON_CLASS, "disabled:pointer-events-none")} aria-label={label} ><ChevronUp className="size-4" /></button>`,
      ],
      [
        "className with a conditional branch that could pin a size",
        `<button type="button" className={cn("flex items-center", compact && "size-11")} aria-label={label} ><X size={16} /></button>`,
      ],
      // Text of unknown width is not a content box this guard can measure. Better silent than wrong.
      ["content that is not only icons", `<button type="button" className="px-2"><X size={16} />{label}</button>`],
      ["text-only content", `<button type="button" className="px-2">{t("save")}</button>`],
      ["icon of unresolvable size", `<button type="button" className="px-2"><X size={iconSize} /></button>`],
      ["padding this guard cannot resolve", `<button type="button" className="px-[3.2%]"><X size={16} /></button>`],
      [
        "content width that already reaches 44",
        `<button type="button" className="flex items-center px-[var(--space-4)]"><X className="size-3" /></button>`,
      ],
      // `size="sm"` is h-8/32px, and 32 + 2 x 6 = 44. The component is fine; only a caller that
      // narrows the BOX from outside is not.
      [
        "IconButton at its own default box",
        `<IconButton Icon={X} aria-label={label} size="sm" className="shrink-0" />`,
      ],
      [
        "IconButton whose className pins nothing",
        `<IconButton Icon={X} aria-label={label} className="ml-2 shrink-0" />`,
      ],
      // The same custom-checkbox label WITH the recipe: the box stays 36px, the pseudo takes it to
      // 44 on touch and drops back from `lg:` up.
      [
        "label painting a custom checkbox, hit area expanded",
        `<label className={cn("group relative grid shrink-0 place-items-center before:absolute before:[inset:-4px] before:content-[''] lg:before:inset-0", "h-9 w-9")}><input type="checkbox" className="peer sr-only" onChange={handleChange} /><span aria-hidden /></label>`,
      ],
      // `Checkbox.tsx`'s own shape: the label pins no box at all, so there is nothing to judge.
      [
        "core Checkbox label, no fixed box on the label itself",
        `<label className={cn("inline-flex cursor-pointer items-center gap-[var(--space-2)] select-none", className)}><span className={cn("relative inline-flex", box)}><input type="checkbox" className="sr-only" /></span></label>`,
      ],
      // A small <label> is the ordinary form label. Flagging those would light up every field.
      ["small <label> with no toggle input inside", `<label className="flex h-4 w-4 items-center">{text}</label>`],
      [
        "small <label> wrapping a text input, not a toggle",
        `<label className="flex h-6 w-6 items-center"><input type="text" onChange={handleChange} /></label>`,
      ],
    ];
    for (const [shape, source] of allowed) {
      expect(findUnexpandedSmallTapTargets(source, "fixture"), shape).toEqual([]);
    }
  });

  it("does not fire on buttons that are already fine", () => {
    const allowed: Array<[string, string]> = [
      [
        // The whole point: IconButton's own shape must read as fixed.
        "::before expansion present",
        `<button className={cn("relative inline-flex h-8 w-8 items-center justify-center before:absolute before:[inset:-6px] before:content-['']")} />`,
      ],
      [
        // `OrderItemStateChip`'s label-less chip: 18px pill + 2 × 13 = 44 on both axes, bought with
        // `::after` because the chip's own paint order has to sit above the card's link overlay.
        // The mechanism is the same one; only the pseudo differs.
        "::after expansion present",
        `<button className={cn("relative inline-flex size-[18px] items-center justify-center after:absolute after:[inset:-13px] after:content-['']")} />`,
      ],
      ["no fixed box at all", `<button className="inline-flex items-center gap-2 px-4 py-2" />`],
      ["fixed box at exactly 44px", `<button className="grid size-11 place-items-center" />`],
      ["fixed box over 44px", `<button className="grid h-12 w-12 place-items-center" />`],
      // The naive `/h-\d/` search reads `min-h-10` as `h-10` and `min-w-0` as `w-0`, which would
      // flag every minimum-height control in the repo. Matching whole tokens is what prevents it.
      [
        "min-h-* / min-w-* are not a fixed box",
        `<button className="inline-flex min-h-10 min-w-0 items-center px-3" />`,
      ],
      ["max-h-* is not a fixed box", `<button className="inline-flex max-h-8 items-center px-3" />`],
      // `size-full`, `h-auto`, `w-[var(--x)]` resolve to no static px, so there is nothing to judge.
      ["non-numeric sizes", `<button className="grid size-full place-items-center" />`],
      ["token-valued size", `<button className="grid h-[var(--control-sm)] w-[var(--control-sm)]" />`],
      // A phone never sees `md:size-7`, and the 44px floor is the touch floor.
      ["small box only from a breakpoint variant", `<button className="grid place-items-center md:size-7" />`],
      [
        "a small icon INSIDE a big button",
        `<button className="grid size-12 place-items-center"><X className="size-4" /></button>`,
      ],
    ];
    for (const [shape, source] of allowed) {
      expect(findUnexpandedSmallTapTargets(source, "fixture"), shape).toEqual([]);
    }
  });

  it("keeps every exempt control both justified and still present in the source", () => {
    // An allowlist nobody re-checks is how a real defect gets parked forever. Each entry must carry
    // a reason AND still match a control that exists, so one that was deleted or already fixed
    // cannot leave a stale exemption behind covering whatever is written there next.
    for (const entry of [...DELIBERATELY_SMALL, ...DENSITY_EXCEPTIONS]) {
      expect(entry.because.length, `${entry.file} needs a reason`).toBeGreaterThan(40);
    }
    for (const entry of [...DELIBERATELY_SMALL, ...DENSITY_EXCEPTIONS]) {
      const hits = findUnexpandedSmallTapTargets(
        readFileSync(join(SRC_DIR, entry.file.replace(/^src\//, "")), "utf8"),
        entry.file,
      );
      expect(
        hits.filter((hit) => hit.tag.includes(entry.contains)),
        `${entry.file} no longer has a small control matching "${entry.contains}" — drop the exemption`,
      ).toHaveLength(1);
    }
  });

  it("catches the antipattern in every form a class string is written in this repo", () => {
    // `cn(...)` first, because that is the form the repo mandates and the form the guard used to
    // miss entirely — including in `IconButton.tsx`, the component named as the fix's reference.
    const forms: Array<[string, string]> = [
      ["cn() call", `<button className={cn("relative grid size-7 -m-2 p-2 place-items-center", className)} />`],
      ["literal attribute", `<button className="grid size-7 -m-2 p-2 place-items-center" />`],
      ["template literal", "<button className={`grid size-7 -m-2 p-2 ${extra}`} />"],
      ["arbitrary values", `<button className={cn("grid size-[28px] -m-[6px] p-[6px]")} />`],
      ["h + w instead of size", `<button className="grid h-7 w-7 -mx-2 px-2" />`],
      ["variant-prefixed", `<button className={cn("md:size-7 md:-m-2 md:p-2")} />`],
    ];
    for (const [form, source] of forms) {
      expect(findTapTargetAntipatterns(source, "fixture"), form).toHaveLength(1);
    }
  });

  it("does not fire on the shapes that are actually correct", () => {
    const allowed: Array<[string, string]> = [
      // The real fix: the box stays fixed, the hit area grows outside it via the pseudo-element.
      [
        "::before expansion",
        `<button className={cn("relative grid size-7 place-items-center before:absolute before:[inset:-8px] before:content-['']")} />`,
      ],
      ["padding with no fixed box", `<button className={cn("flex -mx-2 px-2 gap-2")} />`],
      ["fixed box with no negative margin", `<button className={cn("grid size-7 p-2")} />`],
      ["fixed box with no padding", `<button className={cn("grid size-7 -m-2")} />`],
      ["only one axis pinned", `<button className={cn("h-7 -m-2 p-2")} />`],
      ["arbitrary property values that merely look like utilities", `<span className="[color:var(--text-muted)]" />`],
    ];
    for (const [shape, source] of allowed) {
      expect(findTapTargetAntipatterns(source, "fixture"), shape).toEqual([]);
    }
  });

  it("reads shipped markup only, never a class list quoted inside a comment", () => {
    const source = [
      `// Never write className="grid size-7 -m-2 p-2" here, it does not grow the hit area.`,
      `/* Nor className="grid size-7 -m-2 p-2" in a block comment. */`,
      `const ok = cn("relative grid size-7 before:[inset:-8px]");`,
    ].join("\n");
    expect(findTapTargetAntipatterns(source, "fixture")).toEqual([]);
  });
});
