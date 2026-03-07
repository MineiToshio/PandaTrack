import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { ROUTES } from "@/lib/constants";
import SignUpForm from "../_components/SignUpForm";

type SignUpPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function SignUpPage({ params }: SignUpPageProps) {
  const { locale } = await params;
  const session = await getSession();

  if (session) {
    redirect(`/${locale}${ROUTES.dashboard}`);
  }

  return <SignUpForm />;
}
