import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { ROUTES } from "@/lib/constants";
import { resolveAuthEntryContext } from "../_utils/authEntryContext";
import SignInForm from "../_components/SignInForm";

type SignInPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ returnTo?: string }>;
};

export default async function SignInPage({ params, searchParams }: SignInPageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const { callbackURL, alternativeHref } = resolveAuthEntryContext({
    locale,
    returnTo: resolvedSearchParams.returnTo,
    alternativePath: ROUTES.signUp,
  });
  const session = await getSession();

  if (session) {
    redirect(callbackURL);
  }

  return <SignInForm callbackURL={callbackURL} signUpHref={alternativeHref} />;
}
