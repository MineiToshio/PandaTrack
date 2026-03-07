import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import { isLocale } from "@/types/locale";

export default getRequestConfig(async ({ requestLocale }) => {
  // This typically corresponds to the `[locale]` segment
  let locale = await requestLocale;

  // Ensure that a valid locale is used
  if (!locale || !isLocale(locale)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: {
      // Load locale data per file structure
      common: (await import(`./locales/${locale}/common.json`)).default,
      landing: (await import(`./locales/${locale}/landing.json`)).default,
      terms: (await import(`./locales/${locale}/terms.json`)).default,
      privacy: (await import(`./locales/${locale}/privacy.json`)).default,
      auth: (await import(`./locales/${locale}/auth.json`)).default,
      dashboard: (await import(`./locales/${locale}/dashboard.json`)).default,
    },
  };
});
