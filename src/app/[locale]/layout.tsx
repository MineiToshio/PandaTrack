import { routing } from "@/i18n/routing";
import { isLocale } from "@/types/locale";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { Metadata } from "next";
import "../globals.css";
import { interFont, logoFont, monoFont, regularFont, secondaryFont } from "@/lib/fonts";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { getSiteUrl } from "@/lib/seo";
import { APP_NAME } from "@/lib/constants";

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
    metadataBase: new URL(baseUrl),
    title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
    description: "Track your collection efficiently",
    openGraph: {
      images: [imageUrl],
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/** Inline script that runs before hydration to set data-theme on <html>,
 *  preventing a flash of wrong theme. Reads pandatrack-theme from localStorage;
 *  defaults to prefers-color-scheme inference. */
const themeInitScript = `(function(){
  var THEME_KEY='pandatrack-theme';
  var el=document.documentElement;
  try{
    var theme=localStorage.getItem(THEME_KEY);
    if(theme!=='light'&&theme!=='dark'){
      theme=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
    }
    el.dataset.theme=theme;
  }catch(e){
    el.dataset.theme='light';
  }
})();`;

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${interFont.variable} ${monoFont.variable} ${regularFont.variable} ${secondaryFont.variable} ${logoFont.variable} antialiased`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>{children}</ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
