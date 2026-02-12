import IconBox from "@/components/core/IconBox";
import { cn } from "@/lib/styles";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

type FeatureCardProps = {
  icon: ReactNode;
  accentClassName: string;
  titleBarClassName: string;
  hoverAccentClassName?: string;
  title: string;
  description: string;
  bullets: [string, string];
};

export default function FeatureCard({
  icon,
  accentClassName,
  titleBarClassName,
  hoverAccentClassName,
  title,
  description,
  bullets,
}: FeatureCardProps) {
  return (
    <article
      className={cn(
        "group border-border bg-card relative flex flex-col overflow-hidden rounded-2xl border p-6 shadow-sm",
        "transition-all duration-300 ease-out",
        "hover:border-opacity-80 hover:-translate-y-1 hover:shadow-lg",
        "focus-within:ring-ring focus-within:ring-offset-background focus-within:ring-2 focus-within:ring-offset-2",
        hoverAccentClassName,
      )}
    >
      <IconBox variant="muted" accentClassName={accentClassName}>
        {icon}
      </IconBox>
      <h3 className="text-text-title mt-4 text-lg font-semibold">
        <span className={cn("border-b-2 pb-0.5", titleBarClassName)}>{title}</span>
      </h3>
      <p className="text-text-body mt-2 text-sm leading-relaxed">{description}</p>
      <ul className="mt-4 space-y-2" role="list">
        {bullets.map((bullet, i) => (
          <li key={i} className="text-muted-foreground flex items-center gap-2 text-sm">
            <Check className={cn("h-4 w-4 shrink-0", accentClassName)} aria-hidden />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
