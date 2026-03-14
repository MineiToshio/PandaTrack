import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";
import { cn } from "@/lib/styles";
import { ReactNode } from "react";

type StoreFormSectionCardProps = {
  eyebrow: string;
  title: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
};

export default function StoreFormSectionCard({
  eyebrow,
  title,
  children,
  action,
  className,
}: StoreFormSectionCardProps) {
  return (
    <section className={cn("border-border bg-muted/15 space-y-4 rounded-xl border p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Typography size="xs" className="text-text-muted">
            {eyebrow}
          </Typography>
          <Heading as="h3" size="xs" className="text-text-title">
            {title}
          </Heading>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
