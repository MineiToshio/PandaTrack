import type { ReactNode } from "react";
import Heading from "@/components/core/Heading";
import { cn } from "@/lib/styles";

const TITLE_CLASS = "min-w-0 leading-tight";

type StoreSectionLabelProps = {
  children: ReactNode;
  id?: string;
  className?: string;
  /** Use `h2` for page section titles; `h3` for secondary blocks; `div` when a heading is not appropriate. */
  as?: "h2" | "h3" | "div";
};

export default function StoreSectionLabel({ children, id, className, as = "div" }: StoreSectionLabelProps) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <span className="from-primary to-highlight h-3.5 w-1 shrink-0 rounded-full bg-linear-to-b" aria-hidden />
      {as === "div" ? (
        <div id={id} className={cn(TITLE_CLASS, "text-text-title text-lg font-semibold tracking-tighter")}>
          {children}
        </div>
      ) : (
        <Heading as={as} size="xs" id={id} className={cn(TITLE_CLASS, "text-text-title")}>
          {children}
        </Heading>
      )}
    </div>
  );
}
