"use client";

import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import Button from "@/components/core/Button/Button";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { authClient } from "@/lib/auth/auth-client";

type SignOutButtonProps = {
  locale: string;
  label: string;
  className?: string;
};

export default function SignOutButton({ locale, label, className }: SignOutButtonProps) {
  const router = useRouter();

  const handleSignOut = () => {
    posthog.capture(POSTHOG_EVENTS.AUTH.SIGNOUT, { locale });
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push(`/${locale}${ROUTES.signIn}`);
        },
      },
    });
    router.refresh();
  };

  return (
    <Button type="button" variant="secondary" className={className} onClick={handleSignOut}>
      {label}
    </Button>
  );
}
