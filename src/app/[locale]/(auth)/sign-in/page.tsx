import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { ROUTES } from "@/lib/constants";
import SignInForm from "../_components/SignInForm";

type SignInPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function SignInPage({ params }: SignInPageProps) {
  const { locale } = await params;
  const session = await getSession();

  if (session) {
    redirect(`/${locale}${ROUTES.dashboard}`);
  }

  return <SignInForm />;
}
