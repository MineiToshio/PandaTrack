"use client";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import AuthFormLayout from "./AuthFormLayout";
import EmailPasswordForm from "./EmailPasswordForm";
import { authClient } from "@/lib/auth/auth-client";
import { POSTHOG_EVENTS } from "@/lib/constants";

type SignInFormProps = {
  callbackURL: string;
  signUpHref: string;
  forgotPasswordHref: string;
};

export default function SignInForm({ callbackURL, signUpHref, forgotPasswordHref }: SignInFormProps) {
  const locale = useLocale();
  const t = useTranslations("auth.signIn");
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
      footerLinkHref={signUpHref}
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
        passwordAuxiliaryHref={forgotPasswordHref}
        passwordAuxiliaryLabel={t("forgotPassword")}
        passwordAutoComplete="current-password"
        onSubmit={handleSubmit}
      />
    </AuthFormLayout>
  );
}
