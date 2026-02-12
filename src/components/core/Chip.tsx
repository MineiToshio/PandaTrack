import { cn } from "@/lib/styles";

type ChipProps = {
  children: string;
  className?: string;
};

export default function Chip({ children, className }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-muted/50 px-3 py-1 text-sm text-muted-foreground",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      {children}
    </span>
  );
}
