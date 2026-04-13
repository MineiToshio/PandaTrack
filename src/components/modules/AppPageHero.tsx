import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";
import { cn, TINTED_SURFACE_GRADIENT_STOPS } from "@/lib/styles";

type AppPageHeroProps = {
  eyebrow: ReactNode;
  title: ReactNode;
  description: ReactNode;
  /** Optional trailing column (e.g. primary CTA) inside a responsive flex row. */
  aside?: ReactNode;
  className?: string;
};

export default function AppPageHero({ eyebrow, title, description, aside, className }: AppPageHeroProps) {
  const main = (
    <div className="space-y-2">
      <span className="bg-primary/15 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
        <Sparkles className="size-3.5" aria-hidden />
        {eyebrow}
      </span>
      <Heading as="h1" size="sm" className="text-text-title">
        {title}
      </Heading>
      <Typography size="sm" className="text-text-muted max-w-2xl">
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
