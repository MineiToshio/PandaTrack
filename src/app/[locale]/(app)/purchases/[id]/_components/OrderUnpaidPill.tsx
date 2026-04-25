import { cn } from "@/lib/styles";

type OrderUnpaidPillProps = {
  label: string;
  className?: string;
};

export default function OrderUnpaidPill({ label, className }: OrderUnpaidPillProps) {
  return (
    <span
      className={cn(
        "border-warning/40 bg-warning/15 text-warning inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
        className,
      )}
    >
      {label}
    </span>
  );
}
