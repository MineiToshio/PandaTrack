export const APP_NAME = "PandaTrack";

export const THEME_STORAGE_KEY = "theme";

/** Path segments for app routes (no locale prefix). Use with `/${locale}${ROUTES.xyz}` for links. */
export const ROUTES = {
  home: "",
  terms: "/terms",
  privacy: "/privacy",
} as const;

export const CONTACT_INFO = {
  email: "panda.d.collector@gmail.com",
  tiktok: "https://www.tiktok.com/@pandadcollector",
  whatsapp: "https://whatsapp.com/channel/0029VbAil5KBVJl1UttAWe2j",
} as const;

export const POSTHOG_EVENTS = {
  LANDING: {
    HERO_CTA_CLICKED: "hero_cta_clicked",
    BANNER_CTA_CLICKED: "banner_cta_clicked",
    HEADER_CTA_CLICKED: "header_cta_clicked",
    MOBILE_MENU_OPENED: "mobile_menu_opened",
    MOBILE_MENU_NAV_CLICKED: "mobile_menu_nav_clicked",
    FAQ_ITEM_TOGGLED: "faq_item_toggled",
    SOCIAL_LINK_CLICKED: "social_link_clicked",
    WAITLIST: {
      SUBMITTED: "waitlist_submitted",
      SUCCESS: "waitlist_success",
      FAILED: "waitlist_failed",
    },
  },
} as const;
