import { cn } from "@/lib/styles";
import { type VariantProps, cva } from "class-variance-authority";
import type { ReactNode } from "react";

const iconBoxVariants = cva("flex shrink-0 items-center justify-center rounded-xl transition-shadow duration-300", {
  variants: {
    size: {
      sm: "h-10 w-10",
      md: "h-12 w-12",
    },
    variant: {
      muted: "bg-muted",
      filled: "text-white",
      soft: "",
    },
  },
  defaultVariants: {
    size: "md",
    variant: "muted",
  },
});

type IconBoxProps = {
  children: ReactNode;
  accentClassName?: string;
  className?: string;
} & VariantProps<typeof iconBoxVariants>;

export default function IconBox({ children, accentClassName, className, size, variant }: IconBoxProps) {
  return (
    <div className={cn(iconBoxVariants({ size, variant }), accentClassName, className)} aria-hidden>
      {children}
    </div>
  );
}
