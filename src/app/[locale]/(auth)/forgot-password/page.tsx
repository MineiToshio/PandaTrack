import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/auth-server";
import { ROUTES } from "@/lib/constants";
import { resolveAuthEntryContext } from "../_utils/authEntryContext";
import ForgotPasswordForm from "../_components/ForgotPasswordForm";

type ForgotPasswordPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ returnTo?: string }>;
};

export default async function ForgotPasswordPage({ params, searchParams }: ForgotPasswordPageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const { callbackURL, alternativeHref } = resolveAuthEntryContext({
    locale,
    returnTo: resolvedSearchParams.returnTo,
    alternativePath: ROUTES.signIn,
  });
  const session = await getSession();

  if (session) {
    redirect(callbackURL);
  }

  return <ForgotPasswordForm signInHref={alternativeHref} />;
}
