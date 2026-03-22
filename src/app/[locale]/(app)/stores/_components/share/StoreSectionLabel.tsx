import type { ReactNode } from "react";
import Typography from "@/components/core/Typography";
import { cn } from "@/lib/styles";

type StoreSectionLabelProps = {
  children: ReactNode;
  id?: string;
  className?: string;
};

export default function StoreSectionLabel({ children, id, className }: StoreSectionLabelProps) {
  return (
    <div id={id} className={cn("flex min-w-0 items-center gap-2", className)}>
      <span className="from-primary to-highlight h-3.5 w-1 shrink-0 rounded-full bg-linear-to-b" aria-hidden />
      <Typography size="xs" className="text-text-muted min-w-0">
        {children}
      </Typography>
    </div>
  );
}
