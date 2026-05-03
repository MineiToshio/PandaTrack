import { cn } from "@/lib/styles";

type ProgressBarVariant = "accent" | "success" | "warm-gradient" | "destructive";
type ProgressBarSize = "sm" | "md";

type ProgressBarProps = {
  value?: number;
  indeterminate?: boolean;
  variant?: ProgressBarVariant;
  size?: ProgressBarSize;
  label: string;
  className?: string;
};

const trackSizes: Record<ProgressBarSize, string> = {
  sm: "h-1",
  md: "h-2",
};

const fillColors: Record<ProgressBarVariant, string> = {
  accent: "bg-primary",
  success: "bg-success",
  "warm-gradient": "bg-gradient-to-r from-accent-warm to-primary",
  destructive: "bg-destructive",
};

export default function ProgressBar({
  value,
  indeterminate = false,
  variant = "accent",
  size = "md",
  label,
  className,
}: ProgressBarProps) {
  const isIndeterminate = indeterminate || value === undefined;
  const clampedValue = isIndeterminate ? 0 : Math.min(100, Math.max(0, value));

  return (
    <div
      role="progressbar"
      aria-valuenow={isIndeterminate ? undefined : clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("bg-border w-full overflow-hidden rounded-full", trackSizes[size], className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none",
          fillColors[variant],
          isIndeterminate && "animate-progress-indeterminate w-1/3",
        )}
        style={isIndeterminate ? undefined : { width: `${clampedValue}%` }}
      />
    </div>
  );
}
