import { cn } from "@/lib/styles";
import { VariantProps, cva } from "class-variance-authority";
import { LabelHTMLAttributes, forwardRef } from "react";

/**
 * Label typography and sizes align with Typography so form labels feel consistent
 * with the rest of the design system.
 */
const labelVariants = cva("block font-medium", {
  variants: {
    size: {
      "2xs": "text-xs sm:text-xs",
      xs: "text-xs sm:text-sm",
      sm: "text-sm sm:text-base",
      md: "text-base sm:text-lg",
      lg: "text-lg sm:text-xl",
    },
    color: {
      foreground: "text-foreground",
      title: "text-text-title",
    },
    spacing: {
      default: "mb-1.5",
      tight: "mb-0",
    },
  },
  defaultVariants: {
    size: "sm",
    color: "foreground",
    spacing: "default",
  },
});

type LabelProps = LabelHTMLAttributes<HTMLLabelElement> & VariantProps<typeof labelVariants>;

const Label = forwardRef<HTMLLabelElement, LabelProps>(({ className, size, color, spacing, ...props }, ref) => (
  <label ref={ref} className={cn(labelVariants({ size, color, spacing, className }))} {...props} />
));

Label.displayName = "Label";

export default Label;
