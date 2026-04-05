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
      <div className="relative">
        <Input
          ref={ref}
          {...props}
          type={isVisible ? "text" : "password"}
          error={error}
          disabled={disabled}
          className={cn("pr-11", className)}
        />
        <button
          type="button"
          className="text-text-muted hover:text-foreground focus-visible:ring-ring absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none"
          onClick={handleToggleVisibility}
          aria-label={isVisible ? t("hide") : t("show")}
          title={isVisible ? t("hide") : t("show")}
          disabled={disabled}
        >
          {isVisible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      </div>
    );
  },
);

PasswordInput.displayName = "PasswordInput";

export default PasswordInput;
