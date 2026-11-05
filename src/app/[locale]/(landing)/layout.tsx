import { setRequestLocale } from "next-intl/server";
import { isLocale } from "@/types/locale";
import Header from "./_components/Menu/Header";

export default async function LandingLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  setRequestLocale(locale);

  return (
    <div className="mk-public">
      <Header />
      {children}
    </div>
  );
}
