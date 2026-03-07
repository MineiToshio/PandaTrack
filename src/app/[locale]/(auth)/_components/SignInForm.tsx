"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import AuthFormLayout from "./AuthFormLayout";
import EmailPasswordForm from "./EmailPasswordForm";
import { authClient } from "@/lib/auth-client";
import { ROUTES } from "@/lib/constants";
import { POSTHOG_EVENTS } from "@/lib/constants";

export default function SignInForm() {
  const locale = useLocale();
  const t = useTranslations("auth.signIn");
  const tErrors = useTranslations("auth.errors");
  const tAuth = useTranslations("auth");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const callbackURL = `/${locale}${ROUTES.dashboard}`;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const emailTrimmed = email.trim();
    const passwordTrimmed = password.trim();
    if (!emailTrimmed || !passwordTrimmed) {
      setError(tErrors("invalidCredentials"));
      return;
    }

    setIsPending(true);
    posthog.capture(POSTHOG_EVENTS.AUTH.SIGNIN_SUBMITTED, { locale });

    const { data, error: signInError } = await authClient.signIn.email({
      email: emailTrimmed,
      password: passwordTrimmed,
      callbackURL,
    });

    setIsPending(false);

    if (signInError) {
      posthog.capture(POSTHOG_EVENTS.AUTH.SIGNIN_FAILED, {
        locale,
        error_code: signInError.code ?? "unknown",
      });
      const message = signInError.message ?? tErrors("invalidCredentials");
      setError(message);
      return;
    }

    if (data) {
      posthog.capture(POSTHOG_EVENTS.AUTH.SIGNIN_SUCCESS, { locale });
      router.push(callbackURL);
    }
  };

  return (
    <AuthFormLayout
      title={t("title")}
      googleVariant="signIn"
      callbackURL={callbackURL}
      footerLinkHref={`/${locale}${ROUTES.signUp}`}
      footerLinkLabel={t("linkToSignUp")}
      dividerLabel={tAuth("dividerOr")}
    >
      <EmailPasswordForm
        idPrefix="signin"
        email={email}
        password={password}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        error={error}
        isPending={isPending}
        submitLabel={t("submit")}
        emailLabel={t("email")}
        passwordLabel={t("password")}
        passwordAutoComplete="current-password"
        onSubmit={handleSubmit}
      />
    </AuthFormLayout>
  );
}
