"use client";

import { ButtonHTMLAttributes, MouseEvent, forwardRef } from "react";
import { cva, VariantProps } from "class-variance-authority";
import { cn } from "@/lib/styles";
import { LucideIcon } from "lucide-react";

export const iconButtonVariants = cva(
  "disabled:pointer-events-none disabled:opacity-50 transition-colors cursor-pointer h-8 w-8 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
  {
    variants: {
      variant: {
        standard:
          "flex items-center justify-center rounded-md border border-transparent text-foreground hover:bg-muted hover:border-border",
        outline:
          "border flex justify-center items-center rounded-lg bg-muted text-foreground border-border hover:bg-surface-2 disabled:text-muted disabled:bg-muted",
      },
      size: {
        sm: "h-9 w-9",
        md: "h-10 w-10",
        lg: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "standard",
      size: "md",
    },
  },
);

type IconButtonProps = VariantProps<typeof iconButtonVariants> & {
  Icon: LucideIcon;
  className?: string;
  iconClassName?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ Icon, className, iconClassName, variant, size, disabled, onClick, type, ...buttonProps }, ref) => {
    const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      e.preventDefault();
      onClick?.(e);
    };

    const iconSizeClassName = size === "lg" ? "h-6 w-6" : size === "sm" ? "h-4 w-4" : "h-5 w-5";

    return (
      <button
        ref={ref}
        type={type ?? "button"}
        className={cn("group/icon-button", iconButtonVariants({ variant, size }), className)}
        onClick={handleClick}
        disabled={disabled}
        {...buttonProps}
      >
        <Icon
          className={cn("text-foreground group-hover/icon-button:text-foreground", iconSizeClassName, iconClassName)}
        />
      </button>
    );
  },
);

IconButton.displayName = "IconButton";

export default IconButton;
