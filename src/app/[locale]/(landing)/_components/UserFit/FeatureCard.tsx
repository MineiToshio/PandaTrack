import { cn } from "@/lib/styles";
import type { ReactNode } from "react";

type FeatureCardProps = {
  index: string;
  icon: ReactNode;
  accentClassName: string;
  title: string;
  description: string;
  /** Clase para el borde en hover (ej. "hover:border-primary/40") */
  hoverBorderClassName?: string;
  /** Clase para el color del título en hover (ej. "group-hover:text-primary") */
  hoverTitleClassName?: string;
  className?: string;
};

export default function FeatureCard({
  index,
  icon,
  accentClassName,
  title,
  description,
  hoverBorderClassName,
  hoverTitleClassName,
  className,
}: FeatureCardProps) {
  return (
    <article
      className={cn(
        "group bg-card relative flex flex-col overflow-hidden rounded-2xl border-2 border-transparent p-6 shadow-sm",
        "transition-all duration-400 ease-out",
        "hover:scale-[1.04] hover:shadow-xl hover:shadow-black/15",
        "focus-within:scale-[1.04] focus-within:shadow-xl focus-within:shadow-black/15",
        hoverBorderClassName,
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
          "transition-shadow duration-400 ease-out",
          "group-hover:shadow-lg group-hover:shadow-black/25",
          accentClassName,
        )}
      >
        {icon}
      </div>
      <h3
        className={cn(
          "text-text-title mb-2 text-lg font-semibold transition-colors duration-300 ease-out",
          hoverTitleClassName,
        )}
      >
        {title}
      </h3>
      <p className="text-text-body text-sm leading-relaxed">{description}</p>
      <div
        className={cn(
          "mt-4 h-1 w-12 rounded-full transition-[width] duration-300 ease-out group-hover:w-full",
          accentClassName,
        )}
        aria-hidden
      />
    </article>
  );
}
