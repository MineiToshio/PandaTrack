import Heading from "@/components/core/Heading";
import IconBox from "@/components/core/IconBox";
import Typography from "@/components/core/Typography";
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
      <div className="mt-4 w-fit max-w-full">
        <Heading as="h3" size="xs" className="text-text-title">
          {title}
        </Heading>
        <div
          className={cn(
            "mt-1 h-0.5 w-10 rounded-full transition-[width] duration-300 ease-out group-hover:w-full",
            titleBarClassName,
          )}
          aria-hidden
        />
      </div>
      <Typography size="sm" className="text-text-body mt-2 leading-relaxed">
        {description}
      </Typography>
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
