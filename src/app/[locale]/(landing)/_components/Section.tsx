import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";
import { cn } from "@/lib/styles";
import type { ReactNode } from "react";

type SectionProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  headingId?: string;
  sectionId?: string;
  ariaLabelledby?: string;
  background?: ReactNode;
  className?: string;
};

export default function Section({
  children,
  title,
  subtitle,
  headingId,
  sectionId,
  ariaLabelledby,
  background,
  className,
}: SectionProps) {
  const hasHeader = title != null && subtitle != null && headingId != null;

  return (
    <section
      id={sectionId}
      aria-labelledby={ariaLabelledby ?? (hasHeader ? headingId : undefined)}
      className={cn("bg-background text-foreground w-full px-4 py-16 md:px-6 md:py-24 lg:px-8", className)}
    >
      {background}
      <div className="relative mx-auto max-w-6xl">
        {hasHeader && (
          <header className={cn("mx-auto max-w-3xl text-center", "mb-12 md:mb-16")}>
            <Heading
              as="h2"
              id={headingId}
              size="md"
              className="text-text-title text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl"
            >
              {title}
            </Heading>
            <Typography size="md" className="text-text-body mt-4 leading-relaxed md:text-lg">
              {subtitle}
            </Typography>
          </header>
        )}
        {children}
      </div>
    </section>
  );
}
