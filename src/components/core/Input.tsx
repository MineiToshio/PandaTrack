import { cn } from "@/lib/styles";
import { forwardRef } from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  error?: boolean;
};

const Input = forwardRef<HTMLInputElement, InputProps>(({ className, error, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:ring-offset-background flex h-10 w-full rounded-md border px-3 py-2 text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        error && "border-destructive focus-visible:ring-destructive",
        className,
      )}
      {...props}
    />
  );
});

Input.displayName = "Input";

export default Input;
