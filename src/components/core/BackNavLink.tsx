import Link, { type LinkProps } from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/core/Button/buttonVariants";
import { cn } from "@/lib/styles";

export type BackNavLinkProps = LinkProps & {
  children: ReactNode;
  className?: string;
  /**
   * `text`: text-link back control (default, canonical — matches demo Orders `.back-link`).
   *   Subtle muted text, arrow-left icon 12px, no background/border/shadow.
   * `pill`: legacy floating pill with backdrop blur (still available, e.g. order detail header).
   * `button`: same geometry and tokens as `Button` outline `md` for form footers next to submit.
   */
  appearance?: "text" | "pill" | "button";
};

export default function BackNavLink({ children, className, appearance = "text", ...linkProps }: BackNavLinkProps) {
  if (appearance === "text") {
    return (
      <Link
        {...linkProps}
        className={cn(
          "text-text-muted hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background inline-flex items-center gap-1.5 px-0 py-0.5 text-[13px] no-underline transition-colors focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          className,
        )}
      >
        <ArrowLeft className="size-3 shrink-0" aria-hidden />
        {children}
      </Link>
    );
  }

  const isButtonAppearance = appearance === "button";

  return (
    <Link
      {...linkProps}
      className={cn(
        buttonVariants({
          variant: isButtonAppearance ? "outline" : "ghost",
          size: isButtonAppearance ? "md" : "sm",
        }),
        isButtonAppearance ? "gap-1.5" : "bg-background/70 gap-1.5 rounded-full shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      <ArrowLeft className="size-4" aria-hidden />
      {children}
    </Link>
  );
}
