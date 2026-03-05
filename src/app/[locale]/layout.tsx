import { routing } from "@/i18n/routing";
import { isLocale } from "@/types/locale";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { Metadata } from "next";
import "../globals.css";
import { logoFont, regularFont, secondaryFont } from "@/lib/fonts";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { getSiteUrl } from "@/lib/seo";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description: "Track your collection efficiently",
};

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

/** Explicit default og:image for this locale so Facebook gets a non-inferred og:image. Pages override with their segment image. */
export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const baseUrl = getSiteUrl();
  const imageUrl = `${baseUrl.replace(/\/$/, "")}/${locale}/opengraph-image`;
  return {
    openGraph: {
      images: [imageUrl],
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  // Ensure that the incoming `locale` is valid
  if (!isLocale(locale)) {
    notFound();
  }

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  var key = 'theme';
  var stored = localStorage.getItem(key);
  if (stored === 'light' || stored === 'dark') {
    document.documentElement.setAttribute('data-theme', stored);
  }
})();
            `.trim(),
          }}
        />
      </head>
      <body className={`${regularFont.variable} ${secondaryFont.variable} ${logoFont.variable} antialiased`}>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>{children}</ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
