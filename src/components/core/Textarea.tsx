import { cn } from "@/lib/styles";
import { forwardRef } from "react";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: boolean;
};

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, error, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:ring-offset-background flex min-h-[100px] w-full rounded-md border px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        error && "border-destructive focus-visible:ring-destructive",
        className,
      )}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";

export default Textarea;
