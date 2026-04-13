import type { ReactNode } from "react";
import Heading from "@/components/core/Heading";
import { cn } from "@/lib/styles";

const TITLE_CLASS = "min-w-0 leading-tight";

export type SectionTitleWithAccentProps = {
  children: ReactNode;
  id?: string;
  className?: string;
  /** Use `h2` for major page sections; `h3` for subsections; `div` when a heading is not appropriate. */
  as?: "h2" | "h3" | "div";
};

/** Section title row with leading accent bar for in-page sections in the collector shell. */
export default function SectionTitleWithAccent({ children, id, className, as = "div" }: SectionTitleWithAccentProps) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <span className="from-primary to-highlight h-3.5 w-1 shrink-0 rounded-full bg-linear-to-b" aria-hidden />
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
