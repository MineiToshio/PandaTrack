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
      appLayout: (await import(`./locales/${locale}/app-layout.json`)).default,
      stores: (await import(`./locales/${locale}/stores.json`)).default,
      storeListing: (await import(`./locales/${locale}/storeListing.json`)).default,
      countries: (await import(`./locales/${locale}/countries.json`)).default,
      storeCategories: (await import(`./locales/${locale}/storeCategories.json`)).default,
    },
  };
});
