import { cva } from "class-variance-authority";

/**
 * CVA variant recipe for Button and link-as-button patterns.
 * Consumed directly by buttonVariants() callers (pagination, filters, anchor links).
 *
 * Disabled state uses token colors without opacity (ADR 0001 D3).
 * Focus ring uses --focus-ring (Velvet accent, S3 tokens).
 * text-on-accent is dark in dark mode — never use text-white (ADR 0001 D14).
 */
export const buttonVariants = cva(
  [
    // Layout + typography
    "relative isolate inline-flex items-center justify-center gap-2",
    "rounded-[var(--radius-md)] font-medium",
    "[font-family:var(--font-sans)] [font-weight:var(--font-weight-medium-body)]",
    // Transitions — includes transform for hover lift
    "transition-[background-color,color,border-color,outline-color,box-shadow,transform]",
    "[transition-duration:var(--motion-fast)] [transition-timing-function:var(--ease-emphasis)]",
    // Reduced motion: disable transform (keep color transitions)
    "motion-reduce:transition-[background-color,color,border-color,outline-color,box-shadow]",
    // Focus
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
    "focus-visible:[outline-color:var(--focus-ring)]",
    // Cursor
    "cursor-pointer",
    // State layer via ::after (applies hover/pressed overlay on all variants)
    "after:absolute after:inset-0 after:rounded-[inherit] after:pointer-events-none",
    "after:transition-[background-color] after:[transition-duration:var(--motion-fast)]",
    "after:[transition-timing-function:var(--ease-emphasis)]",
    // Disabled — no opacity, use muted tokens (ADR 0001 D3)
    "disabled:pointer-events-none disabled:[color:var(--text-muted)] disabled:[border-color:var(--border)]",
    "disabled:[background:var(--surface-elevated)] disabled:shadow-none",
    // ARIA disabled (for <a> elements)
    "aria-disabled:pointer-events-none aria-disabled:opacity-100",
  ],
  {
    variants: {
      variant: {
        primary: [
          // Transparent 1px border preserves border-box parity with bordered variants
          // (secondary, ghost, outline) so primary + ghost CTAs at the same `size` render
          // at exactly the same outer height/width.
          "[background:var(--accent)] [color:var(--text-on-accent)] [border:1px_solid_transparent] shadow-[var(--elevation-1)]",
          "hover:after:[background:color-mix(in_oklch,var(--text-primary)_var(--state-hover-mix),transparent)]",
          "hover:-translate-y-px hover:shadow-[var(--elevation-2)]",
          "motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-[var(--elevation-1)]",
          "active:after:[background:color-mix(in_oklch,var(--text-primary)_var(--state-pressed-mix),transparent)]",
          "active:translate-y-0 active:shadow-[var(--elevation-1)]",
        ],
        secondary: [
          "[background:var(--surface-elevated)] [color:var(--text-primary)] [border:1px_solid_var(--border-strong)]",
          "hover:after:[background:color-mix(in_oklch,var(--text-primary)_var(--state-hover-mix),transparent)]",
          "hover:-translate-y-px hover:shadow-[var(--elevation-2)]",
          "motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none",
          "active:after:[background:color-mix(in_oklch,var(--text-primary)_var(--state-pressed-mix),transparent)]",
          "active:translate-y-0 active:shadow-none",
        ],
        ghost: [
          "bg-transparent [color:var(--text-primary)] [border:1px_solid_var(--border-strong)]",
          "hover:after:[background:color-mix(in_oklch,var(--text-primary)_var(--state-hover-mix),transparent)]",
          "hover:-translate-y-px",
          "motion-reduce:hover:translate-y-0",
          "active:after:[background:color-mix(in_oklch,var(--text-primary)_var(--state-pressed-mix),transparent)]",
          "active:translate-y-0",
        ],
        // Kept for backward compatibility — visually equivalent to secondary with accent border
        outline: [
          "[background:var(--surface-elevated)] [color:var(--text-primary)]",
          "[border:1px_solid_color-mix(in_oklch,var(--accent)_40%,var(--border))]",
          "hover:after:[background:color-mix(in_oklch,var(--text-primary)_var(--state-hover-mix),transparent)]",
          "hover:-translate-y-px hover:shadow-[var(--elevation-2)]",
          "motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none",
          "active:after:[background:color-mix(in_oklch,var(--text-primary)_var(--state-pressed-mix),transparent)]",
          "active:translate-y-0 active:shadow-none",
        ],
        // Kept for backward compatibility — inline hyperlink style
        link: [
          "[color:var(--accent)] bg-transparent border-0 shadow-none",
          "hover:[color:var(--accent)] underline-offset-4 hover:underline",
          "disabled:[color:var(--text-muted)]",
        ],
        /**
         * Tonal accent — soft accent background (12 %) with accent-colored text.
         * Use for additive / in-section actions ("Add channel", "Add address")
         * that need accent-color energy without competing with the primary CTA.
         * Matches the visual language of the logo-upload pill.
         */
        tonal: [
          "[background:color-mix(in_oklch,var(--accent)_12%,transparent)] [color:var(--accent)]",
          "hover:after:[background:color-mix(in_oklch,var(--accent)_var(--state-hover-mix),transparent)]",
          "hover:-translate-y-px",
          "motion-reduce:hover:translate-y-0",
          "active:after:[background:color-mix(in_oklch,var(--accent)_var(--state-pressed-mix),transparent)]",
          "active:translate-y-0",
        ],
        // New S4 variants
        destructive: [
          // See `primary` note: transparent border keeps border-box parity with bordered variants.
          "[background:var(--destructive)] [color:var(--text-on-accent)] [border:1px_solid_transparent] shadow-[var(--elevation-1)]",
          "hover:after:[background:color-mix(in_oklch,var(--text-primary)_var(--state-hover-mix),transparent)]",
          "hover:-translate-y-px hover:shadow-[var(--elevation-2)]",
          "motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-[var(--elevation-1)]",
          "active:after:[background:color-mix(in_oklch,var(--text-primary)_var(--state-pressed-mix),transparent)]",
          "active:translate-y-0 active:shadow-[var(--elevation-1)]",
        ],
        "destructive-ghost": [
          // Destructive-tinted outline (see the Velvet design system at `docs/design/`):
          //   border-color: color-mix(in oklch, var(--destructive) 28%, transparent)
          "bg-transparent [color:var(--destructive)] [border:1px_solid_color-mix(in_oklch,var(--destructive)_28%,transparent)]",
          "hover:after:[background:color-mix(in_oklch,var(--destructive)_var(--state-hover-mix),transparent)]",
          "hover:-translate-y-px",
          "motion-reduce:hover:translate-y-0",
          "active:after:[background:color-mix(in_oklch,var(--destructive)_var(--state-pressed-mix),transparent)]",
          "active:translate-y-0",
        ],
      },
      size: {
        sm: [
          "min-h-8 px-[var(--space-3)]",
          "[font-size:var(--text-caption)] [line-height:var(--text-caption--line-height)]",
        ],
        md: [
          // 44px tap target on mobile, 40px on desktop (md+)
          "min-h-11 px-[var(--space-4)]",
          "md:min-h-10",
          "[font-size:var(--text-body)] [line-height:var(--text-body--line-height)]",
        ],
        lg: [
          "min-h-12 px-[var(--space-5)]",
          "[font-size:var(--text-body-lg)] [line-height:var(--text-body-lg--line-height)]",
        ],
        /** Tight link-style — pair with `variant: "link"` only. */
        link: ["h-auto min-h-0 p-0 leading-tight tracking-tight"],
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  },
);
