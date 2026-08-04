/**
 * The section-card chrome the order forms are built from: a bordered elevated card, a circular
 * bullet holding a Lucide icon, a mono uppercase eyebrow, a subtitle-sized heading, and a body
 * indented to clear the bullet.
 *
 * Extracted from `OrderEditForm`, which owned the only copy, when the image-intake review screen
 * became the second surface built out of the same sections. The strings are shared rather than the
 * markup: `OrderEditForm` has no test coverage, so moving its JSX would be an unverifiable change to
 * a screen this work has no other reason to touch. Sharing the class strings keeps both screens
 * pinned to one definition with a diff that cannot alter either one's structure.
 */
export const ORDER_SECTION_CARD_CLASS =
  "[border-radius:var(--radius-xl)] [background:var(--surface-elevated)] [border:1px_solid_var(--border)] [box-shadow:inset_0_0_0_1px_color-mix(in_oklch,var(--accent)_10%,transparent)]";

export const ORDER_SECTION_BULLET_CLASS =
  "inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full [background:color-mix(in_oklch,var(--text-primary)_6%,transparent)] [border:1px_solid_var(--border-strong)] [color:var(--text-muted)]";

export const ORDER_SECTION_EYEBROW_CLASS =
  "block [font-family:var(--font-mono)] [font-size:var(--text-eyebrow)] [font-weight:var(--font-weight-mono)] [letter-spacing:0.06em] [color:var(--text-muted)] uppercase";

export const ORDER_SECTION_HEADING_CLASS =
  "mt-0.5 [font-size:var(--text-subtitle)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]";

export const ORDER_SECTION_BODY_CLASS = "flex flex-col gap-4 p-4 md:pt-5 md:pr-5 md:pb-5 md:pl-[3.75rem]";

export const ORDER_SECTION_HEADER_CLASS = "flex items-start gap-3 px-4 pt-4 md:px-5 md:pt-5";

/**
 * Compact section header, used where the sections are not steps.
 *
 * The order forms number their sections and reserve a left rail for the bullet, which is right
 * there: the collector is walking a sequence. The image-intake review screen is not a sequence, it
 * is one screen of an order that already exists, so the "PASO N" eyebrow was inventing an order
 * that does not exist and the rail was spending 3.75rem of every row to hold a 28px circle. Here the
 * icon sits inline with the title and the body starts at the card's own padding.
 */
export const ORDER_SECTION_COMPACT_HEADER_CLASS = "flex items-center gap-[var(--space-2)] px-4 pt-4 md:px-5 md:pt-5";

export const ORDER_SECTION_COMPACT_ICON_CLASS = "flex-shrink-0 [color:var(--text-muted)]";

export const ORDER_SECTION_COMPACT_BODY_CLASS = "flex flex-col gap-4 p-4 md:px-5 md:pt-4 md:pb-5";
