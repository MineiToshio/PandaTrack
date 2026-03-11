export const APP_NAME = "PandaTrack";
export const EMAIL_FROM_NAME = APP_NAME;

export const THEME_STORAGE_KEY = "theme";

/** Path segments for app routes (no locale prefix). Use with `/${locale}${ROUTES.xyz}` for links. */
export const ROUTES = {
  home: "",
  terms: "/terms",
  privacy: "/privacy",
  signUp: "/sign-up",
  signIn: "/sign-in",
  verifyEmailStatus: "/verify-email",
  verifyEmailGate: "/verify-email-required",
  dashboard: "/dashboard",
  purchases: "/purchases",
  payments: "/payments",
  shipments: "/shipments",
  budget: "/budget",
} as const;

/** Query param for referral links (e.g. waitlist share). Value used in share/copy link. */
export const REFERRAL_QUERY_KEY = "ref";
export const REFERRAL_VALUE_WAITLIST = "waitlist";

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
      SHARE_LINK_CLICKED: "waitlist_share_link_clicked",
      SHARE_NATIVE_CLICKED: "waitlist_share_native_clicked",
      SHARE_COPY_LINK_CLICKED: "waitlist_share_copy_link_clicked",
    },
  },
  AUTH: {
    SIGNUP_SUBMITTED: "auth_signup_submitted",
    SIGNUP_SUCCESS: "auth_signup_success",
    SIGNUP_FAILED: "auth_signup_failed",
    SIGNIN_SUBMITTED: "auth_signin_submitted",
    SIGNIN_SUCCESS: "auth_signin_success",
    SIGNIN_FAILED: "auth_signin_failed",
    GOOGLE_SIGNIN_CLICKED: "auth_google_signin_clicked",
    SIGNOUT: "auth_signout",
    VERIFY_BANNER_SHOWN: "auth_verify_banner_shown",
    VERIFY_EMAIL_SENT: "auth_verify_email_sent",
    VERIFY_EMAIL_FAILED: "auth_verify_email_failed",
    PRIVATE_ACCESS_BLOCKED_UNVERIFIED: "auth_private_access_blocked_unverified",
    VERIFY_EMAIL_RESEND_CLICKED: "auth_verify_email_resent_clicked",
  },
} as const;
