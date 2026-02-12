import { cn } from "@/lib/styles";

type ChipProps = {
  children: string;
  className?: string;
};

export default function Chip({ children, className }: ChipProps) {
  return (
    <span
      className={cn(
        "border-border bg-muted/50 text-muted-foreground inline-flex items-center rounded-full border px-3 py-1 text-sm",
        "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2",
        className,
      )}
    >
      {children}
    </span>
  );
}
