"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { forwardRef, useState } from "react";
import Input from "@/components/core/Input";
import { cn } from "@/lib/styles";

export type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, "type">;

/**
 * Password field with show/hide toggle. Reuses `Input` error styling (`border-destructive`).
 * Visibility labels come from `auth.passwordVisibility` (show/hide).
 */
const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, error, disabled, ...props }, ref) => {
    const [isVisible, setIsVisible] = useState(false);
    const t = useTranslations("auth.passwordVisibility");

    const handleToggleVisibility = () => {
      setIsVisible((current) => !current);
    };

    return (
      <Input
        ref={ref}
        {...props}
        type={isVisible ? "text" : "password"}
        error={error}
        disabled={disabled}
        className={className}
        trailingIcon={
          <button
            type="button"
            className={cn(
              "text-text-muted hover:text-foreground focus-visible:ring-ring",
              // Full-height hit target inside the bordered field (cancels the input's vertical padding).
              "-my-[var(--space-3)] flex h-[2.875rem] items-center rounded-[var(--radius-md)] px-[var(--space-1)]",
              // The box is 46px tall but only 24px wide (16px icon + 2 x 4px padding), so the hit area
              // is widened outward with the `::before` recipe (`IconButton`) instead of by resizing:
              // 24 + 2 x 10 = 44. Nothing is displaced. To the right the extra 10px lands inside the
              // field's own 16px `px-[var(--space-4)]`; to the left it covers the 8px flex gap plus 2px
              // of the input, which is caret-placement area the user does not aim at.
              "relative before:absolute before:[inset:0_-10px] before:content-['']",
              "transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none",
            )}
            onClick={handleToggleVisibility}
            aria-label={isVisible ? t("hide") : t("show")}
            title={isVisible ? t("hide") : t("show")}
            disabled={disabled}
          >
            {isVisible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        }
      />
    );
  },
);

PasswordInput.displayName = "PasswordInput";

export default PasswordInput;
