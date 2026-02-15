export const APP_NAME = "PandaTrack";

export const CONTACT_INFO = {
  email: "panda.d.collector@gmail.com",
  tiktok: "https://www.tiktok.com/@pandadcollector",
} as const;

export const POSTHOG_EVENTS = {
  LANDING: {
    CTA_CLICKED: "cta_clicked",
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
