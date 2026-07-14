import { routing } from "@/i18n/routing";
import { isLocale } from "@/types/locale";
import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import type { Metadata, Viewport } from "next";
import "../globals.css";
import { interFont, logoFont, monoFont, secondaryFont } from "@/lib/fonts";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { getSiteUrl } from "@/lib/seo";
import { APP_NAME } from "@/lib/constants";

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

/**
 * `theme-color` mirrors the light and dark Velvet `--accent` tokens (`src/app/globals.css`,
 * documented in `docs/design/visual-foundations.md`), split by `prefers-color-scheme` so the
 * browser chrome tracks the OS appearance. This is the closest static approximation available:
 * unlike the in-app theme toggle, `theme-color` cannot react to the collector's stored preference.
 */
const THEME_COLOR_LIGHT = "#5d33bd";
const THEME_COLOR_DARK = "#ac91ff";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLOR_LIGHT },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLOR_DARK },
  ],
};

/** Explicit default og:image for this locale so Facebook gets a non-inferred og:image. Pages override with their segment image. */
export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const baseUrl = getSiteUrl();
  const imageUrl = `${baseUrl.replace(/\/$/, "")}/${locale}/opengraph-image`;
  const t = await getTranslations({ locale, namespace: "common" });
  return {
    metadataBase: new URL(baseUrl),
    title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
    description: t("meta.description"),
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: APP_NAME,
    },
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
    // A layout cannot render its own segment's not-found boundary and there is no root
    // layout to host a root not-found, so an invalid locale prefix (for example /foo)
    // would fall through to the framework-default 404. Redirecting keeps the visitor on
    // an on-brand localized surface instead.
    redirect(`/${routing.defaultLocale}`);
  }

  const messages = await getMessages();

  return (
    <html lang={locale} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${interFont.variable} ${monoFont.variable} ${secondaryFont.variable} ${logoFont.variable} antialiased`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>{children}</ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
