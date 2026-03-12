import { getTranslations } from "next-intl/server";
import { buildAuthAlternativeHref } from "@/lib/auth/authRedirect";
import { ROUTES } from "@/lib/constants";
import ResetPasswordForm from "../_components/ResetPasswordForm";

type ResetPasswordPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    error?: string;
    token?: string;
    returnTo?: string;
  }>;
};

export default async function ResetPasswordPage({ params, searchParams }: ResetPasswordPageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const t = await getTranslations({ locale, namespace: "auth.resetPassword" });
  const signInHref = buildAuthAlternativeHref(ROUTES.signIn, locale, resolvedSearchParams.returnTo);
  const forgotPasswordHref = buildAuthAlternativeHref(ROUTES.forgotPassword, locale, resolvedSearchParams.returnTo);
  const initialState =
    resolvedSearchParams.error === "INVALID_TOKEN" || !resolvedSearchParams.token ? "invalid" : "ready";

  return (
    <ResetPasswordForm
      token={resolvedSearchParams.token}
      signInHref={signInHref}
      forgotPasswordHref={forgotPasswordHref}
      initialState={initialState}
      invalidDescription={t("invalidDescription")}
    />
  );
}
