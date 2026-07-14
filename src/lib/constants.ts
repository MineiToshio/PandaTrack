export const APP_NAME = "PandaTrack";
export const EMAIL_FROM_NAME = APP_NAME;

export const THEME_STORAGE_KEY = "pandatrack-theme";

/** Local storage key for private app sidebar expanded/collapsed preference. */
export const APP_SHELL_SIDEBAR_STORAGE_KEY = "appShellSidebarExpanded";

/** Height of the verification email banner (px) for layout offset. Used so the fixed sidebar starts below it. */
export const VERIFICATION_BANNER_HEIGHT_PX = 56;

/** Max width for collector shell content column (main + top header row). */
export const APP_SHELL_CONTENT_MAX_WIDTH_CLASSNAME = "max-w-6xl";

/**
 * Collector shell main column: one shared max width and padding for all `(app)` routes.
 * Applied on `<main>` in `AppLayout`. Do not wrap pages in another `mx-auto max-w-*` container.
 */
export const APP_SHELL_MAIN_CLASSNAME = `mx-auto flex min-h-0 min-w-0 w-full ${APP_SHELL_CONTENT_MAX_WIDTH_CLASSNAME} flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-8`;

/**
 * Reading-width rail for form-heavy flows (store create/edit, etc.) inside the shell main region.
 */
export const APP_SHELL_FORM_RAIL_CLASSNAME = "mx-auto w-full max-w-3xl";

/** Path segments for app routes (no locale prefix). Use with `/${locale}${ROUTES.xyz}` for links. */
export const ROUTES = {
  home: "",
  terms: "/terms",
  privacy: "/privacy",
  signUp: "/sign-up",
  signIn: "/sign-in",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  verifyEmailStatus: "/verify-email",
  verifyEmailGate: "/verify-email-required",
  dashboard: "/dashboard",
  stores: "/stores",
  storesNew: "/stores/new",
  orders: "/orders",
  ordersNew: "/orders/new",
  deliveries: "/deliveries",
  deliveriesNew: "/deliveries/new",
  payments: "/payments",
  budget: "/budget",
  settings: "/settings",
} as const;

/**
 * `returnTo` query value: resume order creation after settings or `/stores/new`.
 * Use with the `returnTo` search param (same key as `AUTH_RETURN_TO_PARAM`).
 */
export const RETURN_TO_ORDER_CREATE = "order-create";

export const CONTACT_INFO = {
  email: "panda.d.collector@gmail.com",
  tiktok: "https://www.tiktok.com/@pandadcollector",
  whatsapp: "https://whatsapp.com/channel/0029VbAil5KBVJl1UttAWe2j",
} as const;

/** Support address referenced in security and account notification emails. */
export const SUPPORT_CONTACT_EMAIL = "hello@pandatrack.app";

export const CLOUDFLARE_ASSET_ROUTES = {
  STORE_LOGOS: "store-logos",
  STORE_LOGOS_PENDING: "store-logos/pending",
  USER_IMAGES: "user-images",
} as const;

export const POSTHOG_EVENTS = {
  LANDING: {
    HERO_CTA_CLICKED: "hero_cta_clicked",
    BANNER_CTA_CLICKED: "banner_cta_clicked",
    HEADER_CTA_CLICKED: "header_cta_clicked",
    HEADER_NAV_CLICKED: "header_nav_clicked",
    MOBILE_MENU_OPENED: "mobile_menu_opened",
    MOBILE_MENU_NAV_CLICKED: "mobile_menu_nav_clicked",
    FAQ_ITEM_TOGGLED: "faq_item_toggled",
    SOCIAL_LINK_CLICKED: "social_link_clicked",
  },
  AUTH: {
    SIGNUP_SUBMITTED: "auth_signup_submitted",
    SIGNUP_SUCCESS: "auth_signup_success",
    SIGNUP_FAILED: "auth_signup_failed",
    SIGNIN_SUBMITTED: "auth_signin_submitted",
    SIGNIN_SUCCESS: "auth_signin_success",
    SIGNIN_FAILED: "auth_signin_failed",
    FORGOT_PASSWORD_SUBMITTED: "auth_forgot_password_submitted",
    FORGOT_PASSWORD_EMAIL_SENT: "auth_forgot_password_email_sent",
    FORGOT_PASSWORD_EMAIL_FAILED: "auth_forgot_password_email_failed",
    FORGOT_PASSWORD_FAILED: "auth_forgot_password_failed",
    RESET_PASSWORD_VIEWED: "auth_reset_password_viewed",
    RESET_PASSWORD_SUBMITTED: "auth_reset_password_submitted",
    RESET_PASSWORD_SUCCESS: "auth_reset_password_success",
    RESET_PASSWORD_FAILED: "auth_reset_password_failed",
    GOOGLE_SIGNIN_CLICKED: "auth_google_signin_clicked",
    SIGNOUT: "auth_signout",
    VERIFY_BANNER_SHOWN: "auth_verify_banner_shown",
    VERIFY_EMAIL_SENT: "auth_verify_email_sent",
    VERIFY_EMAIL_FAILED: "auth_verify_email_failed",
    PRIVATE_ACCESS_BLOCKED_UNVERIFIED: "auth_private_access_blocked_unverified",
    VERIFY_EMAIL_RESEND_CLICKED: "auth_verify_email_resent_clicked",
  },
  APP_SHELL: {
    SIDEBAR_TOGGLED: "app_shell_sidebar_toggled",
    NAV_CLICKED: "app_shell_nav_clicked",
    DRAWER_OPENED: "app_shell_drawer_opened",
    ACCOUNT_MENU_TOGGLED: "app_shell_account_menu_toggled",
    ACCOUNT_MENU_ITEM_CLICKED: "app_shell_account_menu_item_clicked",
    THEME_CHANGED: "app_shell_theme_changed",
    LOCALE_CHANGED: "app_shell_locale_changed",
    MASCOT_HIDDEN: "app_shell_mascot_hidden",
    MASCOT_SHOWN: "app_shell_mascot_shown",
    PLACEHOLDER_CTA_CLICKED: "app_shell_placeholder_cta_clicked",
  },
  SETTINGS: {
    ACCOUNT_EMAIL_CHANGE_MODAL_OPENED: "settings_account_email_change_modal_opened",
    ACCOUNT_EMAIL_CHANGE_SUBMITTED: "settings_account_email_change_submitted",
    ACCOUNT_PASSWORD_CHANGE_SUBMITTED: "settings_account_password_change_submitted",
    ACCOUNT_PASSWORD_SET_SUBMITTED: "settings_account_password_set_submitted",
    PROFILE_USERNAME_SAVED: "settings_profile_username_saved",
    PROFILE_DISPLAY_NAME_SAVED: "settings_profile_display_name_saved",
    PROFILE_AVATAR_UPLOADED: "settings_profile_avatar_uploaded",
    PROFILE_AVATAR_REMOVED: "settings_profile_avatar_removed",
    PREFERENCES_SAVED: "settings_preferences_saved",
  },
  ORDER: {
    CREATED: "order_created",
    EDITED: "order_edited",
    CREATE_DISCARDED: "order_create_discarded",
    DISCREPANCY_MODAL_OPENED: "order_discrepancy_modal_opened",
    DISCREPANCY_RESOLVED: "order_discrepancy_resolved",
    NOTE_SAVED: "order_note_saved",
    NOTE_DELETED: "order_note_deleted",
    PAYMENT_ADDED: "order_payment_added",
    PAYMENT_DELETED: "order_payment_deleted",
    CANCELLED: "order_cancelled",
    DELETED: "order_deleted",
    REACTIVATED: "order_reactivated",
    CREATE_DELIVERY_CLICKED: "order_create_delivery_clicked",
    VIEW_STORE_CLICKED: "order_view_store_clicked",
    DETAIL_MORE_MENU_OPENED: "order_detail_more_menu_opened",
    LIST_FILTERED: "orders_list_filtered",
    LIST_FILTER_CHIP_REMOVED: "orders_list_filter_chip_removed",
    LIST_FILTERS_RESET: "orders_list_filters_reset",
    LIST_CARD_EXPANDED: "orders_list_card_expanded",
    LIST_CARD_COLLAPSED: "orders_list_card_collapsed",
    LIST_PAGE_CHANGED: "orders_list_page_changed",
    ITEM_MARKED_ARRIVED: "order_item_marked_arrived",
    ITEM_REVERTED_PENDING: "order_item_reverted_pending",
    STICKY_BAR_PRIMARY_CLICKED: "order_detail_sticky_primary_clicked",
  },
  DELIVERY: {
    CREATE_FLOW_OPENED: "delivery_create_flow_opened",
    CREATED: "delivery_created",
    EDIT_FLOW_OPENED: "delivery_edit_flow_opened",
    EDITED: "delivery_edited",
    LIST_FILTERED: "deliveries_list_filtered",
    LIST_FILTER_CHIP_REMOVED: "deliveries_list_filter_chip_removed",
    LIST_FILTERS_RESET: "deliveries_list_filters_reset",
    LIST_CARD_EXPANDED: "deliveries_list_card_expanded",
    LIST_CARD_COLLAPSED: "deliveries_list_card_collapsed",
    MARKED_DELIVERED: "delivery_marked_delivered",
    REOPENED: "delivery_reopened",
    CANCELLED: "delivery_cancelled",
    DELETED: "delivery_deleted",
    NOTE_SAVED: "delivery_note_saved",
    NOTE_DELETED: "delivery_note_deleted",
    STICKY_BAR_PRIMARY_CLICKED: "delivery_detail_sticky_primary_clicked",
    ACTIONS_SHEET_OPENED: "delivery_detail_actions_sheet_opened",
  },
  STORE: {
    CREATED: "store_created",
    DUPLICATE_SUGGESTIONS_SHOWN: "store_duplicate_suggestions_shown",
    DUPLICATE_SUBMIT_MODAL_SHOWN: "store_duplicate_submit_modal_shown",
    SEARCHED: "store_searched",
    GOVERNANCE_SUMMARY_OPENED: "store_governance_summary_opened",
    GOVERNANCE_SUMMARY_CONTINUE_CHANGE_REQUEST_CLICKED: "store_governance_summary_continue_change_request_clicked",
    REPORT_OPENED: "store_report_opened",
    REPORT_SUBMITTED: "store_report_submitted",
    PRODUCT_TYPE_REQUEST_OPENED: "store_product_type_request_opened",
    PRODUCT_TYPE_REQUEST_SUBMITTED: "store_product_type_request_submitted",
    CHANGE_REQUEST_EDIT_ENTERED: "store_change_request_edit_entered",
    CHANGE_REQUEST_SUBMITTED: "store_change_request_submitted",
    CHANGE_REQUEST_NOOP_DISCARDED: "store_change_request_noop_discarded",
    LOGO_UPLOAD_STARTED: "store_logo_upload_started",
    LOGO_UPLOAD_SUCCEEDED: "store_logo_upload_succeeded",
    LOGO_UPLOAD_FAILED: "store_logo_upload_failed",
    LOGO_REMOVED: "store_logo_removed",
    REVIEW_SAVED: "store_review_saved",
    REVIEW_WRITE_CLICKED: "store_review_write_clicked",
    REVIEW_EDIT_CLICKED: "store_review_edit_clicked",
    REVIEW_DELETED: "store_review_deleted",
    NOTE_SAVED: "store_note_saved",
  },
  NAVIGATION: {
    VIEW_TRANSITION_NAVIGATED: "view_transition_navigated",
  },
  NOTIFICATIONS: {
    PWA_INSTALL_PROMPT_SHOWN: "pwa_install_prompt_shown",
    PWA_INSTALLED: "pwa_installed",
  },
  DASHBOARD: {
    CASH_ZONE_VIEWED: "dashboard_cash_zone_viewed",
    RECONCILE_CTA_CLICKED: "dashboard_reconcile_cta_clicked",
    OBLIGATION_ORDERS_CTA_CLICKED: "dashboard_obligation_orders_cta_clicked",
    BUDGET_ZONE_VIEWED: "dashboard_budget_zone_viewed",
    CONFIGURE_BUDGET_CTA_CLICKED: "dashboard_configure_budget_cta_clicked",
    SPEND_ZONE_VIEWED: "dashboard_spend_zone_viewed",
    RANGE_PRESET_SELECTED: "dashboard_range_preset_selected",
    RANGE_CUSTOM_APPLIED: "dashboard_range_custom_applied",
    ACTIVITY_ZONE_VIEWED: "dashboard_activity_zone_viewed",
    ACTIVITY_TAB_CHANGED: "dashboard_activity_tab_changed",
    ACTIVITY_ITEM_CTA_CLICKED: "dashboard_activity_item_cta_clicked",
    COLLECTION_ZONE_VIEWED: "dashboard_collection_zone_viewed",
    TOP_STORE_CTA_CLICKED: "dashboard_top_store_cta_clicked",
    PRODUCT_TYPE_SEGMENT_CLICKED: "dashboard_product_type_segment_clicked",
  },
} as const;

/**
 * PostHog runtime feature flags. Gate optional or risky behavior so it can be ramped or
 * killed without a redeploy. Keys must match the PostHog dashboard flag keys exactly.
 */
export const FEATURE_FLAGS = {
  /** List → detail shared-element View Transitions (ADR 0014 D2). Off in prod until ramped. */
  LIST_DETAIL_VIEW_TRANSITIONS: "list-detail-view-transitions",
} as const;
