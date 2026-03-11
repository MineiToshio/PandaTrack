"use client";

import { useLocale, useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import { authClient } from "@/lib/auth/auth-client";
import { POSTHOG_EVENTS } from "@/lib/constants";
import posthog from "posthog-js";
import { siGoogle } from "simple-icons";

const GOOGLE_ICON_SIZE = 20;

type GoogleSignInButtonProps = {
  callbackURL: string;
  variant: "signUp" | "signIn";
};

export default function GoogleSignInButton({ callbackURL, variant }: GoogleSignInButtonProps) {
  const locale = useLocale();
  const t = useTranslations(variant === "signUp" ? "auth.signUp" : "auth.signIn");

  const handleClick = () => {
    posthog.capture(POSTHOG_EVENTS.AUTH.GOOGLE_SIGNIN_CLICKED, { locale });
    authClient.signIn.social({
      provider: "google",
      callbackURL,
    });
  };

  return (
    <Button type="button" variant="secondary" className="w-full gap-2" onClick={handleClick}>
      <svg
        viewBox="0 0 24 24"
        width={GOOGLE_ICON_SIZE}
        height={GOOGLE_ICON_SIZE}
        fill="currentColor"
        className="shrink-0"
        aria-hidden
      >
        <path d={siGoogle.path} />
      </svg>
      <span>{t("googleButton")}</span>
    </Button>
  );
}
