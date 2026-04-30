import type { ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import Heading from "@/components/core/Heading";
import { SectionAccentBar } from "@/components/modules/SectionAccentBar";
import { cn } from "@/lib/styles";

const TITLE_CLASS = "min-w-0 leading-tight";

export type SectionTitleWithAccentProps = {
  children: ReactNode;
  id?: string;
  className?: string;
  /** Tailwind classes for the accent bar; defaults to primary→highlight. Ignored when `icon` is provided. */
  accentBarClassName?: string;
  /**
   * Replace the accent bar with a Lucide icon component.
   * Pass the component reference (e.g. `ShoppingBag`), not an element.
   */
  icon?: React.ComponentType<LucideProps>;
  /** Tailwind class for the icon color. Defaults to `text-primary`. */
  iconClassName?: string;
  /** Use `h2` for major page sections; `h3` for subsections; `div` when a heading is not appropriate. */
  as?: "h2" | "h3" | "div";
};

/** Section title row with leading accent bar (or icon) for in-page sections in the collector shell. */
export default function SectionTitleWithAccent({
  children,
  id,
  className,
  accentBarClassName,
  icon: Icon,
  iconClassName = "text-primary",
  as = "div",
}: SectionTitleWithAccentProps) {
  const lead = Icon ? (
    <Icon className={cn("size-4 shrink-0", iconClassName)} aria-hidden />
  ) : (
    <SectionAccentBar className={accentBarClassName} />
  );

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      {lead}
      {as === "div" ? (
        <div id={id} className={cn(TITLE_CLASS, "text-text-title text-lg font-semibold tracking-tighter")}>
          {children}
        </div>
      ) : (
        <Heading as={as} size="xs" id={id} className={cn(TITLE_CLASS, "text-text-title tracking-tighter")}>
          {children}
        </Heading>
      )}
    </div>
  );
}
