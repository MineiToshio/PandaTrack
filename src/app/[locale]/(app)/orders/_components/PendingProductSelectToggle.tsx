"use client";

import { useRef } from "react";
import { Check, Package } from "lucide-react";
import { cn } from "@/lib/styles";

export type PendingProductSelectToggleProps = {
  itemId: string;
  /**
   * Accessible name of the control, "Seleccionar {producto}". The product name is plain text right
   * beside it, but it cannot BE the label: it shares a two-line block with the link into the order,
   * and a `<label>` wrapping an `<a>` is invalid and swallows the link's click.
   */
  label: string;
  checked: boolean;
  /** False for a product already travelling in another delivery: it cannot enter a new one. */
  selectable: boolean;
  /** Why an unselectable product cannot be marked, for a pointer user. */
  disabledReason?: string;
  /**
   * True once the group has an active selection. The affordance then stays painted on every tile
   * instead of waiting for hover, so the columns read as selectable while a selection is live.
   */
  armed: boolean;
  /** `card` is the mobile tile (36px + hit-area expansion), `row` the desktop one (32px). */
  variant: "row" | "card";
  onToggle: (itemId: string, shiftKey: boolean) => void;
};

/** 100ms + the emphasis curve: the "Toggle" recipe in `docs/design/motion.md`. */
const GLYPH_TRANSITION =
  "transition-opacity [transition-duration:var(--motion-instant)] [transition-timing-function:var(--ease-emphasis)] motion-reduce:transition-none";

const LAYER = "col-start-1 row-start-1";

/**
 * The pending-product tile of the "Por tienda" view, which is both the row's icon and its
 * selection control.
 *
 * The `Package` glyph it replaces carried no information (the same icon for every product, already
 * `aria-hidden`), which is exactly why it is free to become a control: nothing is lost, and the
 * geometry does not move. It is a real `<input type="checkbox">` kept `sr-only` inside its
 * `<label>`, so `Space` works with no key handling of ours, the name and the checked state are
 * announced natively, and the painting is entirely ours.
 *
 * Three glyphs share one grid cell and only their opacity crosses, never their position: rest (the
 * package, filling the tile), affordance (an empty checkbox) and selected (a filled accent
 * checkbox).
 *
 * THE BOX AND THE PAINT ARE TWO DIFFERENT SIZES, on purpose. The `<label>`'s box (32px on desktop,
 * 36px + the hit-area expansion on touch) is load-bearing twice over: the column-header strip
 * indents its master checkbox by exactly that box so "Producto" stays over the product names, and
 * on touch it is what carries the 44px target. What is PAINTED inside it does not have to be that
 * big, and at 32px the selected state was a solid block of accent four times the area of a
 * checkbox — the same footprint as the package icon, but nothing like its weight. So the two
 * checkbox faces are painted at 16px, the exact box, radius, border and 10px check of
 * `Checkbox size="sm"` (`src/components/core/Checkbox.tsx`), which is the control that heads this
 * very column and the one in the mobile "Marcar todo" strip. Same object, same size, everywhere.
 * The tile keeps its box; only the ink shrinks (32² = 1024px² of accent down to 16² = 256px²).
 */
export default function PendingProductSelectToggle({
  itemId,
  label,
  checked,
  selectable,
  disabledReason,
  armed,
  variant,
  onToggle,
}: PendingProductSelectToggleProps) {
  // A click on a `<label>` reaches the input as a synthetic click whose modifier keys are not
  // reliably carried, so the range modifier is read off the mousedown on the label itself and
  // handed to `onChange`, which is the one place both pointer and `Space` funnel through. Touch
  // produces a compatibility mousedown with `shiftKey: false`, which is the right answer there.
  //
  // A mousedown is not a promise of a toggle, so `onChange` cannot be the only place that clears
  // it: Shift + press, drag off the tile and release produces no `change` at all, and the flag
  // would then still be up when this tile is next activated. Two more writers keep it honest, both
  // AFTER the click a completed press would have produced (`mouseup` fires before `click`, so
  // clearing there would cancel every range): leaving the label aborts the press, and a keydown
  // states its own modifier instead of inheriting a pointer's.
  const shiftRef = useRef(false);

  if (!selectable) {
    // Deliberately not a disabled checkbox: it could never become enabled from here, so in the tab
    // order it would be pure noise. The row's own state chip ("En camino") already states the
    // reason in text, which is what assistive tech reads; `title` covers the pointer user.
    return (
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-[var(--radius-md)] [color:var(--text-muted)]",
          variant === "card" ? "h-9 w-9" : "h-8 w-8",
        )}
        title={disabledReason}
        aria-hidden
      >
        <Package width={14} height={14} />
      </span>
    );
  }

  return (
    <label
      onMouseDown={(event) => {
        shiftRef.current = event.shiftKey;
      }}
      onMouseLeave={() => {
        shiftRef.current = false;
      }}
      className={cn(
        "group relative grid shrink-0 cursor-pointer place-items-center rounded-[var(--radius-md)] select-none",
        // Hit area, mobile: the 36px tile plus 4px per side reaches the 44px touch floor. The
        // desktop tree is `hidden lg:block`, so it never renders below `lg` and its expansion is
        // dropped there, the same place every other expansion in this view drops it.
        //
        // The two boxes are written out here as literals rather than hoisted into a `box` variable
        // on purpose: the tap-target guard reads the class strings that sit inside the tag, and a
        // hoisted constant is invisible to it, which is how an undersized control ships green.
        "before:absolute before:[inset:-4px] before:content-[''] lg:before:inset-0",
        "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:[outline-color:var(--focus-ring)]",
        variant === "card" ? "h-9 w-9" : "h-8 w-8",
      )}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        aria-label={label}
        // `Space` activates a checkbox from its keydown, so the key event that is about to produce
        // the toggle carries the modifier for it. Reading it here makes the keyboard path state its
        // own intent rather than inherit whatever a previous pointer press left behind.
        onKeyDown={(event) => {
          shiftRef.current = event.shiftKey;
        }}
        onChange={() => {
          onToggle(itemId, shiftRef.current);
          shiftRef.current = false;
        }}
      />

      <span
        aria-hidden
        className={cn(
          LAYER,
          "grid h-full w-full place-items-center rounded-[var(--radius-md)] [color:var(--accent-cool)] [background:color-mix(in_oklch,var(--accent-cool)_10%,transparent)]",
          GLYPH_TRANSITION,
          armed ? "opacity-0" : "opacity-100 group-hover:opacity-0 peer-focus-visible:opacity-0",
          "peer-checked:opacity-0",
        )}
      >
        <Package width={14} height={14} />
      </span>

      <span
        aria-hidden
        className={cn(
          LAYER,
          "size-4 rounded-[var(--radius-sm)] [border:1.5px_solid_var(--border-strong)]",
          GLYPH_TRANSITION,
          armed ? "opacity-100" : "opacity-0 group-hover:opacity-100 peer-focus-visible:opacity-100",
          "peer-checked:opacity-0",
        )}
      />

      <span
        aria-hidden
        className={cn(
          LAYER,
          "grid size-4 place-items-center rounded-[var(--radius-sm)] [color:var(--text-on-accent)] [background:var(--accent)] [border:1.5px_solid_var(--accent)]",
          GLYPH_TRANSITION,
          "opacity-0 peer-checked:opacity-100",
        )}
      >
        <Check width={10} height={10} />
      </span>
    </label>
  );
}
