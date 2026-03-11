import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { buildVerificationStatusHref } from "@/lib/authRedirect";

type VerifyEmailConfirmPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string; returnTo?: string }>;
};

export default async function VerifyEmailConfirmPage({ params, searchParams }: VerifyEmailConfirmPageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const token = resolvedSearchParams.token;
  const returnTo = resolvedSearchParams.returnTo;

  if (!token) {
    redirect(`${buildVerificationStatusHref(locale, returnTo)}&error=INVALID_TOKEN`);
  }

  const requestHeaders = await headers();
  const callbackURL = buildVerificationStatusHref(locale, returnTo);
  const response = await auth.api.verifyEmail({
    headers: requestHeaders,
    query: {
      token,
      callbackURL,
    },
    asResponse: true,
  });
  const redirectLocation = response.headers.get("location");

  if (redirectLocation) {
    redirect(redirectLocation);
  }

  redirect(callbackURL);
}
