"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import AuthFormLayout from "./AuthFormLayout";
import EmailPasswordForm from "./EmailPasswordForm";
import { authClient } from "@/lib/auth/auth-client";
import { POSTHOG_EVENTS } from "@/lib/constants";

type SignUpFormProps = {
  callbackURL: string;
  signInHref: string;
};

export default function SignUpForm({ callbackURL, signInHref }: SignUpFormProps) {
  const locale = useLocale();
  const t = useTranslations("auth.signUp");
  const tErrors = useTranslations("auth.errors");
  const tAuth = useTranslations("auth");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

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
    posthog.capture(POSTHOG_EVENTS.AUTH.SIGNUP_SUBMITTED, { locale });

    const { data, error: signUpError } = await authClient.signUp.email({
      email: emailTrimmed,
      password: passwordTrimmed,
      name: "",
      callbackURL,
    });

    setIsPending(false);

    if (signUpError) {
      posthog.capture(POSTHOG_EVENTS.AUTH.SIGNUP_FAILED, {
        locale,
        error_code: signUpError.code ?? "unknown",
      });
      const message =
        signUpError.code === "USER_ALREADY_EXISTS"
          ? tErrors("userAlreadyExists")
          : (signUpError.message ?? tErrors("generic"));
      setError(message);
      return;
    }

    if (data) {
      posthog.capture(POSTHOG_EVENTS.AUTH.SIGNUP_SUCCESS, { locale });
      router.push(callbackURL);
    }
  };

  return (
    <AuthFormLayout
      title={t("title")}
      googleVariant="signUp"
      callbackURL={callbackURL}
      footerLinkHref={signInHref}
      footerLinkLabel={t("linkToSignIn")}
      dividerLabel={tAuth("dividerOr")}
    >
      <EmailPasswordForm
        idPrefix="signup"
        email={email}
        password={password}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        error={error}
        isPending={isPending}
        submitLabel={t("submit")}
        emailLabel={t("email")}
        passwordLabel={t("password")}
        passwordAutoComplete="new-password"
        onSubmit={handleSubmit}
      />
    </AuthFormLayout>
  );
}
