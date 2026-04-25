import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "relative overflow-hidden bg-primary text-primary-foreground hover:bg-primary/90",
        secondary:
          "bg-muted text-text-title hover:bg-muted/80 border border-border transition-transform active:scale-[0.98]",
        outline: "border border-primary text-primary hover:bg-primary/10 transition-transform active:scale-[0.98]",
        ghost: "text-primary hover:bg-primary/10",
        /** In-app “hyperlink” look: `text-link` / `text-link-hover`, no background, no underline (use in headers/rail, not for `<a href>`). */
        link: "text-link [text-decoration-line:none] hover:[text-decoration-line:none] border-0 bg-transparent shadow-none hover:bg-transparent hover:text-link-hover",
      },
      size: {
        sm: "h-9 px-3",
        md: "h-10 px-4",
        lg: "h-12 px-5",
        /** Tight, no min height — pair with `variant: "link"` only. */
        link: "h-auto min-h-0 p-0 leading-tight tracking-tight",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);
