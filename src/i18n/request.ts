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
      // Load messages per file structure
      common: (await import(`./messages/${locale}/common.json`)).default,
      landing: (await import(`./messages/${locale}/landing.json`)).default,
      terms: (await import(`./messages/${locale}/terms.json`)).default,
      privacy: (await import(`./messages/${locale}/privacy.json`)).default,
    },
  };
});
