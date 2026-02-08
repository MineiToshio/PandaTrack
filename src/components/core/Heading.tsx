import { cn } from "@/lib/styles";
import { VariantProps, cva } from "class-variance-authority";
import { HTMLAttributes, forwardRef } from "react";

const headingVariants = cva("text-black font-bold leading-tight tracking-tighter", {
  variants: {
    size: {
      lg: "text-5xl md:text-6xl lg:text-7xl",
      md: "text-4xl md:text-5xl lg:text-6xl",
      sm: "text-2xl md:text-3xl lg:text-4xl",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

type HeadingProps = HTMLAttributes<HTMLHeadingElement> &
  VariantProps<typeof headingVariants> & {
    as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  };

const Heading = forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ className, size, children, as = "h2", ...props }, ref) => {
    const Element = as;
    return (
      <Element ref={ref} {...props} className={cn(headingVariants({ size, className }))}>
        {children}
      </Element>
    );
  },
);

Heading.displayName = "Heading";

export default Heading;
