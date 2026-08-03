"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import Button from "@/components/core/Button/Button";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { signOutClient } from "@/lib/auth/authSignOut";

type SignOutButtonProps = {
  locale: string;
  label: string;
  className?: string;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  onSignOut?: () => void;
  icon?: ReactNode;
};

export default function SignOutButton({
  locale,
  label,
  className,
  variant = "secondary",
  size = "md",
  onSignOut,
  icon,
}: SignOutButtonProps) {
  const router = useRouter();

  const handleSignOut = () => {
    onSignOut?.();
    posthog.capture(POSTHOG_EVENTS.AUTH.SIGNOUT, { locale });
    void signOutClient({
      onSuccess: () => {
        router.push(`/${locale}${ROUTES.signIn}`);
      },
    });
    router.refresh();
  };

  return (
    <Button type="button" variant={variant} size={size} className={className} onClick={handleSignOut}>
      {icon}
      {label}
    </Button>
  );
}
