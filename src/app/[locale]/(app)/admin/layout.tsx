import { redirect } from "next/navigation";
import { AdminAccessError, requireAdmin } from "@/lib/auth/auth-server";
import { ROUTES } from "@/lib/constants";

type AdminLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

/**
 * Authorization boundary for the admin space. Runs `requireAdmin()` server-side; an authorized
 * administrator renders the children inside the inherited collector App Shell chrome. A refused
 * caller is translated from the expected `AdminAccessError` into a redirect to the collector
 * dashboard, so no moderation surface is ever rendered for a non-administrator. Nav visibility is
 * presentation only; this gate is the real security boundary.
 */
export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  const { locale } = await params;

  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AdminAccessError) {
      redirect(`/${locale}${ROUTES.dashboard}`);
    }
    throw error;
  }

  return <>{children}</>;
}
