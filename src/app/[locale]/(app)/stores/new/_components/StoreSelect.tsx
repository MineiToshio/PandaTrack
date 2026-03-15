import { cn } from "@/lib/styles";
import { forwardRef } from "react";

type StoreSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const StoreSelect = forwardRef<HTMLSelectElement, StoreSelectProps>(({ className, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={cn(
        "border-input bg-background text-foreground focus-visible:ring-ring block h-10 w-full cursor-pointer rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});

StoreSelect.displayName = "StoreSelect";

export default StoreSelect;
