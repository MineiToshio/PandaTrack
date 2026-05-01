import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";
import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";
import { cn, TINTED_SURFACE_GRADIENT_STOPS } from "@/lib/styles";

type AppPageHeroProps = {
  eyebrow?: ReactNode;
  /** Decorative entity icon shown above the title in lieu of a text eyebrow. */
  eyebrowIcon?: LucideIcon;
  /** Accessible label for `eyebrowIcon` when used purely decoratively, omit to hide from a11y tree. */
  eyebrowIconLabel?: string;
  title: ReactNode;
  description: ReactNode;
  /** Optional trailing column (e.g. primary CTA) inside a responsive flex row. */
  aside?: ReactNode;
  className?: string;
};

export default function AppPageHero({
  eyebrow,
  eyebrowIcon: EyebrowIcon,
  eyebrowIconLabel,
  title,
  description,
  aside,
  className,
}: AppPageHeroProps) {
  const main = (
    <div className="min-w-0">
      <div className="space-y-3">
        {EyebrowIcon ? (
          <span
            className="bg-primary/15 text-primary ring-primary/15 inline-flex size-12 items-center justify-center rounded-2xl ring-1 ring-inset"
            role={eyebrowIconLabel ? "img" : undefined}
            aria-label={eyebrowIconLabel}
            aria-hidden={eyebrowIconLabel ? undefined : true}
          >
            <EyebrowIcon className="size-6" aria-hidden />
          </span>
        ) : eyebrow ? (
          <span className="bg-primary/15 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
            <Sparkles className="size-3.5" aria-hidden />
            {eyebrow}
          </span>
        ) : null}
        <Heading as="h1" size="sm" className="text-text-title">
          {title}
        </Heading>
      </div>
      <Typography size="sm" className="text-text-muted mt-3.5 max-w-2xl sm:mt-4">
        {description}
      </Typography>
    </div>
  );

  return (
    <header
      className={cn(
        "border-border/70 rounded-2xl border bg-linear-to-br p-5 shadow-sm sm:p-6",
        TINTED_SURFACE_GRADIENT_STOPS,
        className,
      )}
    >
      {aside ? (
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
          {main}
          {aside}
        </div>
      ) : (
        main
      )}
    </header>
  );
}
