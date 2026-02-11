import { cn } from "@/lib/styles";
import type { ReactNode } from "react";

type FeatureCardProps = {
  index: string;
  icon: ReactNode;
  accentClassName: string;
  title: string;
  description: string;
  className?: string;
};

export default function FeatureCard({ index, icon, accentClassName, title, description, className }: FeatureCardProps) {
  return (
    <article
      className={cn(
        "border-border bg-card relative flex flex-col overflow-hidden rounded-2xl border p-6 shadow-sm",
        className,
      )}
    >
      <span
        className="text-muted-foreground/20 pointer-events-none absolute top-4 right-4 font-mono text-7xl leading-none font-bold select-none"
        aria-hidden
      >
        {index}
      </span>
      <div
        className={cn(
          "mb-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white",
          accentClassName,
        )}
      >
        {icon}
      </div>
      <h3 className="text-text-title mb-2 text-lg font-semibold">{title}</h3>
      <p className="text-text-body text-sm leading-relaxed">{description}</p>
      <div className={cn("mt-4 h-1 w-12 rounded-full", accentClassName)} aria-hidden />
    </article>
  );
}
