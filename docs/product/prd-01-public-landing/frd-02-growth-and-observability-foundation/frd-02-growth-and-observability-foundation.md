---
id: FRD-02
type: FRD
slug: growth-and-observability-foundation
title: Growth and Observability Foundation
status: ACTIVE
parent: PRD-01
children:
  - BP-01
last_updated: 2026-06-16
source_features:
  - FEAT-0002
  - FEAT-0003
implementation_status: IMPLEMENTED
---

# FRD-02 Growth and Observability Foundation

## Overview

This FRD captures the public-phase instrumentation and runtime-observability baseline that made the landing measurable and debuggable.

It combines:

- PostHog analytics for meaningful public interactions
- Sentry runtime monitoring across client, server, edge, and global boundaries

## Current State

### Implemented

- PostHog client initialized in `src/instrumentation-client.ts` with a delegated click listener (`data-ph-event`/`data-ph-props`), a first-party `/ingest` proxy in `next.config.ts`, and a `posthog-node` server client in `src/lib/analytics/posthog-server.ts`
- Sentry initialized across three runtimes: client (`src/instrumentation-client.ts`), server (`sentry.server.config.ts`), and edge (`sentry.edge.config.ts`); loaded by `src/instrumentation.ts` via the Next.js `register()` hook
- `Sentry.captureRequestError` wired via `onRequestError` export in `instrumentation.ts` (captures all server/edge request errors)
- `Sentry.captureRouterTransitionStart` wired via `onRouterTransitionStart` export in `instrumentation-client.ts` (client navigation traces)
- `global-error.tsx` captures root-layout render failures with `Sentry.captureException`; `(app)/error.tsx` captures app-shell subtree failures with `area: "app_shell"` tag
- `POSTHOG_EVENTS` constants in `src/lib/constants.ts` cover 185 events across 12 categories; `FEATURE_FLAGS` in the same file holds runtime PostHog feature flags
- Server-side capture via `getPostHogClient()` is used by Server Actions in stores, orders, deliveries, and auth (password recovery, verification) — see "PostHog Capture Pattern" below
- `src/lib/analytics/posthogDataAttributes.ts` provides `getPosthogDataAttributes()` and `serializePosthogProps()` helpers for declarative `data-ph-event`/`data-ph-props` attributes on React elements

### Removed during go-live (commit `db1847b`, 2026-06-15)

The pre-release waitlist and its associated analytics were removed when the landing switched to the go-live sign-up funnel. `FR-02-02` and `FR-02-03` are therefore superseded: the waitlist submit/success/fail events no longer exist in `POSTHOG_EVENTS.LANDING`, the `submitWaitlist` server action was deleted, and user identification at waitlist time is replaced by identification at sign-up time (owned by `FR-02-01` and the `AUTH` event category). The events `waitlist_submitted`, `waitlist_success`, `waitlist_failed`, `waitlist_share_link_clicked`, `waitlist_share_native_clicked`, and `waitlist_share_copy_link_clicked` have been removed from the codebase.

## Functional Requirements

- `FR-02-01`: Public CTA and interaction events must be measurable through centralized PostHog event names defined in `POSTHOG_EVENTS` (`src/lib/constants.ts`).
- `FR-02-02`: ~~Waitlist submit, success, and failure outcomes must be captured as analytics events.~~ **Superseded** — waitlist removed 2026-06-15; sign-up conversion is now tracked via `AUTH.SIGNUP_SUBMITTED` / `AUTH.SIGNUP_SUCCESS` / `AUTH.SIGNUP_FAILED`.
- `FR-02-03`: ~~Successful waitlist submits must identify the user by email for segmentation.~~ **Superseded** — waitlist removed 2026-06-15; user identity for segmentation is established at sign-up/sign-in time through client-side PostHog calls in the auth forms.
- `FR-02-04`: Runtime exceptions must be capturable in client, server, and edge execution contexts.
- `FR-02-05`: Global App Router errors must be captured through the product error boundary path.
- `FR-02-06`: Instrumentation must remain non-blocking for normal user interactions.

## Implementation Architecture

This is an infrastructure FRD with no dedicated UI routes. The implementation spans several cross-cutting files rather than a single feature slice.

### PostHog Capture Pattern

Two capture paths are used throughout the app:

- **Declarative (client):** Any element decorated with `data-ph-event` / `data-ph-props` attributes is captured by a single delegated `click` listener registered at app boot in `src/instrumentation-client.ts`. Helpers in `src/lib/analytics/posthogDataAttributes.ts` (`getPosthogDataAttributes`, `serializePosthogProps`) make it ergonomic to set these attributes in React components. This is the default pattern for simple CTA and navigation clicks.
- **Imperative server-side:** Server Actions that own conversion outcomes call `getPostHogClient()` from `src/lib/analytics/posthog-server.ts` and use `posthog-node` to fire events server-side. Callsites span stores (create, edit, review save/delete, note, report, product-type request), orders (`orderActions`, `orderLifecycleActions`, `orderNoteActions`, `orderPaymentActions`, `orderItemActions`), deliveries (`createDeliveryAction`, `editDeliveryAction`, `deliveryLifecycleActions`, `deliveryNoteActions`), and auth (password recovery, email verification). This path is used when the client cannot be trusted as the final source of truth for the outcome (e.g., the server action may fail after the client already saw a loading state).

The PostHog client uses a first-party reverse proxy (`/ingest`) configured in `next.config.ts` (`rewrites()`) so requests route through the app domain and are less likely to be blocked by ad-blockers. The `posthog.init()` call in `src/instrumentation-client.ts` also sets `capture_exceptions: true`, so PostHog captures client-side exceptions in parallel with Sentry (dual exception capture). It is configured with `api_host: "/ingest"`, `ui_host: "https://us.posthog.com"`, and `defaults: "2025-11-30"`; the `/ingest` proxy requires `skipTrailingSlashRedirect: true` in `next.config.ts` so PostHog's trailing-slash API requests are not redirected.

The server client exposes `shutdownPostHog()` (in `src/lib/analytics/posthog-server.ts`) to flush buffered events, but no runtime hook currently calls it; server-side captures rely on the client's `flushAt: 1` / `flushInterval: 0` configuration to flush immediately instead.

### PostHog Feature Flags

`FEATURE_FLAGS` in `src/lib/constants.ts` holds runtime PostHog feature flag keys. Currently: `LIST_DETAIL_VIEW_TRANSITIONS` (`"list-detail-view-transitions"`) gates the shared-element View Transitions for list → detail navigation (ADR 0014 D2). Flags are evaluated client-side via `posthog.isFeatureEnabled()`.

### Sentry Architecture

Four hooks cover all execution contexts:

| Hook file                       | Scope                 | How wired                                                                                                                                                           |
| ------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/instrumentation-client.ts` | Browser client        | Runs on page load; also exports `onRouterTransitionStart = Sentry.captureRouterTransitionStart`                                                                     |
| `src/instrumentation.ts`        | Node.js server + edge | Next.js `register()` hook; conditionally loads `sentry.server.config.ts` or `sentry.edge.config.ts`; exports `onRequestError = Sentry.captureRequestError`          |
| `sentry.server.config.ts`       | Node.js server        | Sentry init with `tracesSampleRate: 1`, `enableLogs: true`, `sendDefaultPii: false`; DSN read from `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` with a built-in fallback |
| `sentry.edge.config.ts`         | Edge runtime          | Same config as server                                                                                                                                               |

Two error boundaries add product context:

- `src/app/global-error.tsx`: catastrophic root-layout failure. Captures via `Sentry.captureException(error)` in a `useEffect`. Renders a minimal self-contained fallback (no theme, no fonts, no next-intl — hardcoded Spanish copy, per ADR 0013).
- `src/app/[locale]/(app)/error.tsx`: app-shell subtree failure. Captures via `Sentry.captureException(error, { tags: { area: "app_shell" }, extra: { digest: error.digest } })`. Renders a full localized `EmptyState` with retry and go-home actions.

Route-level error-surface coverage beyond these two boundaries (the locale-level `public_shell` boundary and the error-capture discipline audit) is owned by **FRD-10 Error Experience Hardening** ([frd-10-error-experience-hardening](../../prd-02-collector-app/frd-10-error-experience-hardening/frd-10-error-experience-hardening.md)). Sentry initialization, hooks, and configuration remain owned by this FRD.

Session Replay is enabled on the client with `replaysSessionSampleRate: 0.1` (10% of sessions) and `replaysOnErrorSampleRate: 1.0` (100% of sessions with an error).

The Sentry webpack plugin (`withSentryConfig` in `next.config.ts`) uploads source maps with `widenClientFileUpload: true` for readable production stack traces. Debug logging is stripped from the bundle via `treeshake.removeDebugLogging: true`, and `automaticVercelMonitors: true` enables automatic instrumentation of Vercel Cron Monitors.

#### Configuration policy note (2026-07-14, coordinated with FRD-10 · BP-01 · WO-03)

The Sentry configuration hardening items were reviewed and resolved during the FRD-10 error-contract audit, which touches these FRD-02-owned init files:

- **DSN externalization (applied here):** the three init files now read the DSN from `NEXT_PUBLIC_SENTRY_DSN` (client) and `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` (server and edge), keeping the current project DSN as an inline fallback so init never breaks when the variable is unset. Both keys are documented in `.env.example`. The DSN is a public identifier that ships in the client bundle, not a secret. `next.config.ts` holds only `org`/`project` for source-map upload, never the DSN.
- **`sendDefaultPii: false` (confirmed):** already flipped to `false` in commit `1b40070` (2026-07-10) to satisfy `BR-02-04`; this doc's references are corrected to match. Enabling it would attach request headers, including session cookies, to captured events.
- **`tracesSampleRate: 1` (kept):** acceptable at current pre-launch traffic; revisit and lower before a wider launch (see Open Questions in FRD-10).

The capture-point inventory of record lives in `docs/development/sentry.md`.

## PostHog Event Taxonomy (snapshot 2026-08-13)

`src/lib/constants.ts` `POSTHOG_EVENTS` — **185 events across 12 categories**. This is a snapshot for product traceability; the code is authoritative if it diverges. The naming enforcement rules (declarative `data-ph-event` / `data-ph-props` for simple clicks, two-level `module_action` naming, snake_case non-PII properties) are defined in `.agents/rules/posthog-events.mdc`.

| Category | Count | Events |
| -------- | ----- | ------ |
| `LANDING` | 8 | `hero_cta_clicked`, `banner_cta_clicked`, `header_cta_clicked`, `header_nav_clicked`, `mobile_menu_opened`, `mobile_menu_nav_clicked`, `faq_item_toggled`, `social_link_clicked` |
| `AUTH` | 21 | `auth_signup_submitted`, `auth_signup_success`, `auth_signup_failed`, `auth_signin_submitted`, `auth_signin_success`, `auth_signin_failed`, `auth_forgot_password_submitted`, `auth_forgot_password_email_sent`, `auth_forgot_password_email_failed`, `auth_forgot_password_failed`, `auth_reset_password_viewed`, `auth_reset_password_submitted`, `auth_reset_password_success`, `auth_reset_password_failed`, `auth_google_signin_clicked`, `auth_signout`, `auth_verify_banner_shown`, `auth_verify_email_sent`, `auth_verify_email_failed`, `auth_private_access_blocked_unverified`, `auth_verify_email_resent_clicked` |
| `APP_SHELL` | 7 | `app_shell_sidebar_toggled`, `app_shell_nav_clicked`, `app_shell_drawer_opened`, `app_shell_account_menu_toggled`, `app_shell_account_menu_item_clicked`, `app_shell_theme_changed`, `app_shell_locale_changed` |
| `SETTINGS` | 9 | `settings_account_email_change_modal_opened`, `settings_account_email_change_submitted`, `settings_account_password_change_submitted`, `settings_account_password_set_submitted`, `settings_profile_username_saved`, `settings_profile_display_name_saved`, `settings_profile_avatar_uploaded`, `settings_profile_avatar_removed`, `settings_preferences_saved` |
| `ORDER` | 33 | `order_created`, `order_edited`, `order_create_discarded`, `order_discrepancy_modal_opened`, `order_discrepancy_resolved`, `order_note_saved`, `order_note_deleted`, `order_payment_added`, `order_payment_deleted`, `order_cancelled`, `order_deleted`, `order_reactivated`, `order_create_delivery_clicked`, `order_view_store_clicked`, `order_detail_more_menu_opened`, `orders_list_filtered`, `orders_list_filter_chip_removed`, `orders_list_filters_reset`, `orders_list_card_expanded`, `orders_list_card_collapsed`, `orders_list_expanded_all`, `orders_list_collapsed_all`, `orders_list_page_changed`, `order_item_marked_arrived`, `order_item_reverted_pending`, `order_detail_sticky_primary_clicked`, `order_split_merge_modal_opened`, `order_create_method_selector_opened`, `order_create_method_selected`, `orders_list_view_changed`, `orders_list_store_group_expanded`, `orders_list_store_group_collapsed`, `order_created_with_advance` |
| `IMAGE_INTAKE` | 23 | `image_intake_opened`, `image_intake_submitted`, `image_intake_succeeded`, `image_intake_failed`, `image_intake_global_budget_blocked`, `image_intake_result_confirmed`, `image_intake_completed_manually_clicked`, `image_intake_store_matched`, `image_intake_store_ambiguity_resolved`, `image_intake_store_created_inline`, `image_intake_share_target_received`, `image_intake_share_resumed_after_auth`, `image_intake_group_split`, `image_intake_group_merged`, `image_intake_category_set`, `image_intake_reference_link_opened`, `image_intake_product_sheet_hint_shown`, `image_intake_product_sheet_requested`, `image_intake_quota_blocked`, `image_intake_quota_overflow_shown`, `image_intake_quota_exhausted_shown`, `image_intake_admin_quota_override_set`, `image_intake_photo_zoom_opened` |
| `DELIVERY` | 21 | `delivery_create_flow_opened`, `delivery_created`, `delivery_edit_flow_opened`, `delivery_edited`, `deliveries_list_filtered`, `deliveries_list_filter_chip_removed`, `deliveries_list_filters_reset`, `deliveries_list_card_expanded`, `deliveries_list_card_collapsed`, `deliveries_list_expanded_all`, `deliveries_list_collapsed_all`, `delivery_marked_delivered`, `delivery_quick_arrival_opened`, `delivery_quick_arrival_logged`, `delivery_reopened`, `delivery_cancelled`, `delivery_deleted`, `delivery_note_saved`, `delivery_note_deleted`, `delivery_detail_sticky_primary_clicked`, `delivery_detail_actions_sheet_opened` |
| `STORE` | 37 | `store_created`, `store_duplicate_suggestions_shown`, `store_duplicate_submit_modal_shown`, `store_searched`, `store_governance_summary_opened`, `store_governance_summary_continue_change_request_clicked`, `store_report_opened`, `store_report_submitted`, `store_product_type_request_opened`, `store_product_type_request_submitted`, `store_change_request_edit_entered`, `store_change_request_submitted`, `store_change_request_noop_discarded`, `store_logo_zoom_opened`, `store_logo_upload_started`, `store_logo_upload_succeeded`, `store_logo_upload_failed`, `store_logo_removed`, `store_review_saved`, `store_review_write_clicked`, `store_review_edit_clicked`, `store_review_deleted`, `store_note_saved`, `store_approved`, `store_removed`, `store_report_resolved`, `store_report_dismissed`, `store_change_request_applied`, `store_change_request_rejected`, `store_product_type_request_approved`, `store_product_type_request_rejected`, `store_payment_sheet_opened`, `store_payment_allocations_opened`, `store_payment_registered`, `store_payment_deleted`, `store_payment_breakdown_opened`, `store_payments_all_loaded` |
| `NAVIGATION` | 1 | `view_transition_navigated` |
| `NOTIFICATIONS` | 8 | `pwa_install_prompt_shown`, `pwa_installed`, `notifications_enabled`, `notifications_disabled`, `notification_type_toggled`, `notification_test_sent`, `notification_dispatch_run`, `notification_store_rejected_sent` |
| `DASHBOARD` | 14 | `dashboard_cash_zone_viewed`, `dashboard_reconcile_cta_clicked`, `dashboard_obligation_orders_cta_clicked`, `dashboard_budget_zone_viewed`, `dashboard_configure_budget_cta_clicked`, `dashboard_spend_zone_viewed`, `dashboard_range_preset_selected`, `dashboard_range_custom_applied`, `dashboard_activity_zone_viewed`, `dashboard_activity_tab_changed`, `dashboard_activity_item_cta_clicked`, `dashboard_collection_zone_viewed`, `dashboard_top_store_cta_clicked`, `dashboard_product_type_segment_clicked` |
| `ADMIN` | 3 | `admin_space_entered`, `admin_audit_viewed`, `admin_inbox_item_opened` |

**Defined but unwired (no callsites in `src/` outside tests, verified 2026-08-13):** 15 event names exist in `POSTHOG_EVENTS` but are never captured.

| Event | Why it is still declared |
| ----- | ------------------------ |
| the whole `SETTINGS` namespace (9): `settings_account_email_change_modal_opened`, `settings_account_email_change_submitted`, `settings_account_password_change_submitted`, `settings_account_password_set_submitted`, `settings_profile_username_saved`, `settings_profile_display_name_saved`, `settings_profile_avatar_uploaded`, `settings_profile_avatar_removed`, `settings_preferences_saved` | The settings screens ship without analytics. `SettingsNotificationsSection.tsx` imports `POSTHOG_EVENTS` but only uses `NOTIFICATIONS.*`, so no `SETTINGS.*` name reaches a `capture` call. |
| `ORDER.CREATE_DISCARDED` (`order_create_discarded`) | The create form has no discard-tracking callsite. |
| `ORDER.DETAIL_MORE_MENU_OPENED` (`order_detail_more_menu_opened`) | The overflow menu it was named for was replaced by the actions card / mobile actions card, which do not emit it. |
| `ORDER.LIST_PAGE_CHANGED` (`orders_list_page_changed`) | Pagination navigates via links; no capture is attached. |
| `IMAGE_INTAKE.INTAKE_OPENED` (`image_intake_opened`) | FRD-11 is still in flight; the screen entry point does not capture it yet. |
| `IMAGE_INTAKE.COMPLETED_MANUALLY_CLICKED` (`image_intake_completed_manually_clicked`) | Same: the "complete manually" escape hatch is not instrumented. |
| `STORE.REVIEW_WRITE_CLICKED` (`store_review_write_clicked`) | Only the *edit* counterpart (`store_review_edit_clicked`) is wired, in `StorePublicReviewsSection.tsx`. |

They are counted in the totals above but emit nothing until a callsite is added.

Two corrections against the previous (2026-06-16) snapshot, both verified against the code:

- `ORDER.VIEW_STORE_CLICKED` (`order_view_store_clicked`) was listed as unwired. It **is** emitted, declaratively, from `src/app/[locale]/(app)/orders/[id]/_components/OrderActionsCard.tsx` (`posthogEvent={POSTHOG_EVENTS.ORDER.VIEW_STORE_CLICKED}` with `posthogProps={{ source: "actions_card" }}`).
- `APP_SHELL.MASCOT_SHOWN` (`app_shell_mascot_shown`) and `app_shell_mascot_hidden` were listed as declared. Both were **deleted** from `POSTHOG_EVENTS` together with the `MascotBubble` component and no longer exist.

## Business Rules

- `BR-02-01`: `POSTHOG_EVENTS` in `src/lib/constants.ts` is the single source of truth for event names. No string literals for PostHog events are allowed outside this object.
- `BR-02-02`: Server-side PostHog capture is reserved for conversion outcomes where the server action is the authoritative source of truth. Simple clicks and UI interactions use the declarative `data-ph-event` pattern.
- `BR-02-03`: Sentry capture of unexpected errors must not duplicate reporting. Each catch boundary must capture once; errors caught by the framework hooks (`onRequestError`, `onRouterTransitionStart`) must not be recaptured manually unless enriching with product context.
- `BR-02-04`: Neither PostHog events nor Sentry captures may include free-text note content, raw user-generated strings, or other PII. Sentry runs with `sendDefaultPii: false` so request headers and session cookies are not attached to captured events.
- `BR-02-05`: The PostHog ingest proxy (`/ingest`) must remain configured in `next.config.ts` so the client-side SDK does not send events directly to `us.posthog.com` from the browser.

## Acceptance Criteria

### `AC-02-01`

- Given a visitor interacts with key public CTAs
- When the interaction occurs
- Then the corresponding PostHog event is emitted through the shared naming model.

### `AC-02-02`

- ~~Given a waitlist submission succeeds or fails / When the server action completes / Then analytics capture the correct outcome event.~~ **Superseded** — waitlist removed 2026-06-15. The equivalent criterion is: given a sign-up form is submitted and the outcome resolves, when the server action completes, then `AUTH.SIGNUP_SUCCESS` or `AUTH.SIGNUP_FAILED` is emitted.

### `AC-02-03`

- Given an unexpected runtime error occurs
- When the relevant boundary executes
- Then Sentry receives the exception without blocking the user path.

## Test Coverage

This FRD is infrastructure; there are no dedicated route-level E2E tests. Coverage is exercised through the following existing specs:

### Unit tests

- `src/lib/analytics/posthogDataAttributes.test.ts`: covers `serializePosthogProps` (undefined passthrough, serialization) and `getPosthogDataAttributes` (missing event returns `{}`, both attributes returned when present).
- `src/lib/auth/_tests/authPasswordRecovery.test.ts`: verifies `getPostHogClient().capture()` is called with the correct `POSTHOG_EVENTS.AUTH.*` constants for password-recovery outcomes (email sent, email failed, forgot-password failed).
- `src/lib/auth/_tests/authVerification.test.ts`: verifies server-side `POSTHOG_EVENTS.AUTH.VERIFY_EMAIL_SENT` and `VERIFY_EMAIL_FAILED` captures.
- `src/app/[locale]/(auth)/_components/_tests/ForgotPasswordForm.test.tsx`: verifies client-side `posthog.capture` calls for `AUTH.FORGOT_PASSWORD_SUBMITTED`, `AUTH.FORGOT_PASSWORD_FAILED`, and `AUTH.FORGOT_PASSWORD_EMAIL_SENT` through form interaction.
- `src/app/[locale]/(auth)/_components/_tests/ResetPasswordForm.test.tsx`: verifies client-side `posthog.capture` calls for `AUTH.RESET_PASSWORD_VIEWED`, `AUTH.RESET_PASSWORD_SUBMITTED`, `AUTH.RESET_PASSWORD_SUCCESS`, and `AUTH.RESET_PASSWORD_FAILED`.

### E2E coverage (indirect)

No dedicated analytics/Sentry E2E spec exists. The `e2e/landing.spec.ts` and `e2e/auth.spec.ts` suites exercise the flows that emit the LANDING and AUTH events, but they do not assert on PostHog or Sentry calls.

## Linked Blueprint

- `docs/product/prd-01-public-landing/frd-02-growth-and-observability-foundation/bp-01-growth-and-observability-foundation/bp-01-growth-and-observability-foundation.md`
