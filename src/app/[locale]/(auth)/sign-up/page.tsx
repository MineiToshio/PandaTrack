import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { ROUTES } from "@/lib/constants";
import { resolveAuthEntryContext } from "../_utils/authEntryContext";
import SignUpForm from "../_components/SignUpForm";

type SignUpPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ returnTo?: string }>;
};

export default async function SignUpPage({ params, searchParams }: SignUpPageProps) {
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

  return <SignUpForm callbackURL={callbackURL} signInHref={alternativeHref} />;
}
