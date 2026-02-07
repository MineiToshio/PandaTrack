import { cn } from "@/lib/styles";
import { VariantProps, cva } from "class-variance-authority";
import { HTMLAttributes, forwardRef } from "react";

const typographyVariants = cva("", {
  variants: {
    size: {
      "2xs": "text-xs sm:text-xs",
      xs: "text-xs sm:text-sm",
      sm: "text-sm sm:text-base",
      md: "text-base sm:text-lg",
      lg: "text-lg sm:text-xl",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

type TypographyProps = HTMLAttributes<HTMLParagraphElement> &
  VariantProps<typeof typographyVariants> & {
    as?: "p" | "span";
  };

const Typography = forwardRef<HTMLParagraphElement, TypographyProps>(
  ({ className, size, children, as = "p", ...props }, ref) => {
    const Element = as;
    return (
      <Element ref={ref} {...props} className={cn(typographyVariants({ size, className }))}>
        {children}
      </Element>
    );
  },
);

Typography.displayName = "Paragraph";

export default Typography;
