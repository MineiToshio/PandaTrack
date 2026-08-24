export const APP_NAME = "PandaTrack";
export const EMAIL_FROM_NAME = APP_NAME;

export const THEME_STORAGE_KEY = "pandatrack-theme";

/** Local storage key for private app sidebar expanded/collapsed preference. */
export const APP_SHELL_SIDEBAR_STORAGE_KEY = "appShellSidebarExpanded";

/**
 * Cookie holding the collector's last chosen Orders list view ("store" | "order"). Read
 * server-side (`orders/page.tsx`) so the default view survives a fresh load with no flash, written
 * client-side by the view toggle on change.
 */
export const ORDER_LIST_VIEW_COOKIE_NAME = "pandatrack-orders-view";

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
  progress: "/progress",
  progressMedals: "/progress/medals",
  progressRanks: "/progress/ranks",
  admin: "/admin",
  adminAudit: "/admin/audit",
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

/** Selectable page-size options for the desktop list pagination control (orders/deliveries/stores). */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

/** Default page size applied when no `perPage` param is present or it falls outside `PAGE_SIZE_OPTIONS`. */
export const DEFAULT_PAGE_SIZE = 25;

/**
 * Open-report count at which the public store detail shows the derived report notice. One report is
 * enough because the notice makes no accusation: it states that a report exists and has not been
 * reviewed yet, and a single reader may be the only one who noticed a real problem.
 */
export const STORE_REPORT_NOTICE_THRESHOLD = 1;

/**
 * Open-report count at which a store's individual report rows collapse into a single report-cluster
 * row in the moderation inbox. A store at or above this many open reports reads as one store-level
 * decision, not several separate reports.
 *
 * Deliberately a separate constant from {@link STORE_REPORT_NOTICE_THRESHOLD}: the public notice
 * answers "should the buyer be informed" and this one answers "does the queue need one decision
 * instead of several", so they must stay independently movable.
 */
export const STORE_REPORT_CLUSTER_THRESHOLD = 2;

/**
 * How long an interaction has to settle before a live-recalculating money panel announces its
 * running total.
 *
 * Shared by the store payment sheet's allocation panel and the order detail's breakdown panel: both
 * rewrite several amounts per keystroke, so an undebounced `aria-live` region reads one total per
 * character. Two surfaces with the same mechanism, one number, or they drift.
 */
export const TOTALS_ANNOUNCE_DELAY_MS = 700;

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
    LIST_EXPANDED_ALL: "orders_list_expanded_all",
    LIST_COLLAPSED_ALL: "orders_list_collapsed_all",
    LIST_PAGE_CHANGED: "orders_list_page_changed",
    ITEM_MARKED_ARRIVED: "order_item_marked_arrived",
    ITEM_REVERTED_PENDING: "order_item_reverted_pending",
    ITEM_PAID_DECLARED: "order_item_paid_declared",
    ITEM_PAID_UNDECLARED: "order_item_paid_undeclared",
    STICKY_BAR_PRIMARY_CLICKED: "order_detail_sticky_primary_clicked",
    SPLIT_MERGE_MODAL_OPENED: "order_split_merge_modal_opened",
    CREATE_METHOD_SELECTOR_OPENED: "order_create_method_selector_opened",
    CREATE_METHOD_SELECTED: "order_create_method_selected",
    LIST_VIEW_CHANGED: "orders_list_view_changed",
    LIST_STORE_GROUP_EXPANDED: "orders_list_store_group_expanded",
    LIST_STORE_GROUP_COLLAPSED: "orders_list_store_group_collapsed",
    LIST_STORE_UNDETAILED_OPENED: "orders_list_store_undetailed_opened",
    CREATED_WITH_ADVANCE: "order_created_with_advance",
  },
  IMAGE_INTAKE: {
    INTAKE_OPENED: "image_intake_opened",
    EXTRACTION_STARTED: "image_intake_submitted",
    EXTRACTION_SUCCEEDED: "image_intake_succeeded",
    EXTRACTION_FAILED: "image_intake_failed",
    GLOBAL_BUDGET_BLOCKED: "image_intake_global_budget_blocked",
    // Fired when a submission had to be prepared again at a lower encode quality to fit in one
    // request. Worth seeing: it is a silent reduction in what the model receives, and how often the
    // ladder's floor is reached is the signal that would justify revisiting the request budget.
    SUBMISSION_RECOMPRESSED: "image_intake_submission_recompressed",
    ORDER_SAVED_FROM_IMAGE: "image_intake_result_confirmed",
    COMPLETED_MANUALLY_CLICKED: "image_intake_completed_manually_clicked",
    STORE_MATCHED: "image_intake_store_matched",
    STORE_AMBIGUITY_RESOLVED: "image_intake_store_ambiguity_resolved",
    STORE_CREATED_INLINE: "image_intake_store_created_inline",
    SHARE_TARGET_RECEIVED: "image_intake_share_target_received",
    SHARE_RESUMED_AFTER_AUTH: "image_intake_share_resumed_after_auth",
    GROUP_SPLIT: "image_intake_group_split",
    GROUP_MERGED: "image_intake_group_merged",
    CATEGORY_SET: "image_intake_category_set",
    REFERENCE_LINK_OPENED: "image_intake_reference_link_opened",
    PRODUCT_SHEET_HINT_SHOWN: "image_intake_product_sheet_hint_shown",
    PRODUCT_SHEET_REQUESTED: "image_intake_product_sheet_requested",
    QUOTA_BLOCKED: "image_intake_quota_blocked",
    QUOTA_OVERFLOW_SHOWN: "image_intake_quota_overflow_shown",
    QUOTA_EXHAUSTED_SHOWN: "image_intake_quota_exhausted_shown",
    ADMIN_QUOTA_OVERRIDE_SET: "image_intake_admin_quota_override_set",
    PHOTO_ZOOM_OPENED: "image_intake_photo_zoom_opened",
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
    LIST_EXPANDED_ALL: "deliveries_list_expanded_all",
    LIST_COLLAPSED_ALL: "deliveries_list_collapsed_all",
    MARKED_DELIVERED: "delivery_marked_delivered",
    QUICK_ARRIVAL_OPENED: "delivery_quick_arrival_opened",
    QUICK_ARRIVAL_LOGGED: "delivery_quick_arrival_logged",
    STORE_ARRIVAL_LOGGED: "delivery_store_arrival_logged",
    STORE_SELECTION_STARTED: "delivery_store_selection_started",
    REOPENED: "delivery_reopened",
    REOPEN_UNDONE: "delivery_reopen_undone",
    CANCELLED: "delivery_cancelled",
    DELETED: "delivery_deleted",
    NOTE_SAVED: "delivery_note_saved",
    NOTE_DELETED: "delivery_note_deleted",
    STICKY_BAR_PRIMARY_CLICKED: "delivery_detail_sticky_primary_clicked",
    ACTIONS_SHEET_OPENED: "delivery_detail_actions_sheet_opened",
    SETTLEMENT_RETRIED: "delivery_settlement_retried",
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
    LOGO_ZOOM_OPENED: "store_logo_zoom_opened",
    LOGO_UPLOAD_STARTED: "store_logo_upload_started",
    LOGO_UPLOAD_SUCCEEDED: "store_logo_upload_succeeded",
    LOGO_UPLOAD_FAILED: "store_logo_upload_failed",
    LOGO_REMOVED: "store_logo_removed",
    REVIEW_SAVED: "store_review_saved",
    REVIEW_WRITE_CLICKED: "store_review_write_clicked",
    REVIEW_EDIT_CLICKED: "store_review_edit_clicked",
    REVIEW_DELETED: "store_review_deleted",
    NOTE_SAVED: "store_note_saved",
    APPROVED: "store_approved",
    REMOVED: "store_removed",
    REPORT_RESOLVED: "store_report_resolved",
    REPORT_DISMISSED: "store_report_dismissed",
    CHANGE_REQUEST_APPLIED: "store_change_request_applied",
    CHANGE_REQUEST_REJECTED: "store_change_request_rejected",
    PRODUCT_TYPE_REQUEST_APPROVED: "store_product_type_request_approved",
    PRODUCT_TYPE_REQUEST_REJECTED: "store_product_type_request_rejected",
    PAYMENT_SHEET_OPENED: "store_payment_sheet_opened",
    PAYMENT_ALLOCATIONS_OPENED: "store_payment_allocations_opened",
    PAYMENT_ALLOCATION_PARKED: "store_payment_allocation_parked",
    PAYMENT_REGISTERED: "store_payment_registered",
    PAYMENT_DELETED: "store_payment_deleted",
    PAYMENT_BREAKDOWN_OPENED: "store_payment_breakdown_opened",
    PAYMENTS_ALL_LOADED: "store_payments_all_loaded",
    RECONCILIATION_SHEET_OPENED: "store_reconciliation_sheet_opened",
    RECONCILIATION_ADJUSTMENT_CREATED: "store_reconciliation_adjustment_created",
    RECONCILIATION_ADJUSTMENT_DELETED: "store_reconciliation_adjustment_deleted",
  },
  NAVIGATION: {
    VIEW_TRANSITION_NAVIGATED: "view_transition_navigated",
  },
  NOTIFICATIONS: {
    PWA_INSTALL_PROMPT_SHOWN: "pwa_install_prompt_shown",
    PWA_INSTALLED: "pwa_installed",
    NOTIFICATIONS_ENABLED: "notifications_enabled",
    NOTIFICATIONS_DISABLED: "notifications_disabled",
    NOTIFICATION_TYPE_TOGGLED: "notification_type_toggled",
    NOTIFICATION_TEST_SENT: "notification_test_sent",
    NOTIFICATION_DISPATCH_RUN: "notification_dispatch_run",
    NOTIFICATION_STORE_REJECTED_SENT: "notification_store_rejected_sent",
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
    /** "Pagos que no registraste" diagnostic line click (`FR-06-27`, `FR-06-28`, WO-07). */
    UNRECORDED_PAYMENTS_LINK_CLICKED: "dashboard_unrecorded_payments_link_clicked",
  },
  ADMIN: {
    SPACE_ENTERED: "admin_space_entered",
    AUDIT_VIEWED: "admin_audit_viewed",
    INBOX_ITEM_OPENED: "admin_inbox_item_opened",
  },
  /**
   * Collector progression. The namespace exists before its events do, on purpose: the accrual layer
   * fires nothing itself (a point credited server-side is not a user interaction), and the surfaces
   * that DO have something to report, the toast, the album and the progress section, land in later
   * slices and add their keys here rather than inventing a second namespace.
   */
  PROGRESSION: {
    /** The `"Medallas"` album opened. Fired once per mount, client-side: opening it is a view. */
    MEDAL_ALBUM_VIEWED: "medal_album_viewed",
    /** One medal's detail opened. Carries `medal_key`, `rarity` and whether it is unlocked. */
    MEDAL_DETAIL_VIEWED: "medal_detail_viewed",
    /** The `Progreso` section opened. Carries the active tab. */
    PROGRESS_VIEWED: "progress_viewed",
    /** A tab of the section selected. Carries `from_tab` and `to_tab`. */
    PROGRESS_TAB_CHANGED: "progress_tab_changed",
    /** The rank ladder became visible. Carries `current_rank_index`. */
    PROGRESS_RANK_LADDER_VIEWED: "progress_rank_ladder_viewed",
    /** The dashboard's rank widget clicked through. Carries `current_rank_index`. */
    PROGRESS_WIDGET_CLICKED: "progress_widget_clicked",
    /**
     * An unlock toast raised. Carries `medal_key`, `rarity` and `series`.
     *
     * Shown rather than dismissed: the toast auto-dismisses on a fixed timer, so a dismissal event
     * would report the timer, not the reader.
     */
    MEDAL_TOAST_SHOWN: "medal_toast_shown",
    /**
     * One action unlocked more medals than the queue announces one by one, so the whole batch was
     * collapsed into a single toast. Carries `medal_count`, which is what tells a batch of four
     * apart from the ten a migrated history produces on its first credited action.
     */
    MEDAL_BURST_TOAST_SHOWN: "medal_burst_toast_shown",
    /** A rank celebration actually claimed and shown. Server-side; carries `rank_index`. */
    RANK_UP_CELEBRATED: "rank_up_celebrated",
    /** A full-screen medal celebration shown. Carries `medal_key` and `rarity`. */
    MEDAL_CELEBRATED: "medal_celebrated",
    /** Any full-screen celebration closed. Carries `celebration_kind`. */
    CELEBRATION_DISMISSED: "celebration_dismissed",
    /** `"Ocultar mi progresión"` switched on. */
    PROGRESSION_HIDDEN: "progression_hidden",
    /** `"Ocultar mi progresión"` switched back off. */
    PROGRESSION_SHOWN: "progression_shown",
    /** The collector purged their own points history. Carries the deleted row counts. */
    PROGRESSION_LEDGER_PURGED: "progression_ledger_purged",
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
