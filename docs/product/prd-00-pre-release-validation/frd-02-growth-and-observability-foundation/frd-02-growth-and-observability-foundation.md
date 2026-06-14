---
id: FRD-02
type: FRD
slug: growth-and-observability-foundation
title: Growth and Observability Foundation
status: ACTIVE
parent: PRD-00
children:
  - BP-01
last_updated: 2026-06-13
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

## Functional Requirements

- `FR-02-01`: Public CTA and interaction events must be measurable through centralized PostHog event names.
- `FR-02-02`: Waitlist submit, success, and failure outcomes must be captured as analytics events.
- `FR-02-03`: Successful waitlist submits must identify the user by email for segmentation.
- `FR-02-04`: Runtime exceptions must be capturable in client, server, and edge execution contexts.
- `FR-02-05`: Global App Router errors must be captured through the product error boundary path.
- `FR-02-06`: Instrumentation must remain non-blocking for normal user interactions.

## Confirmed Implementation Signals

- `POSTHOG_EVENTS` constants exist and are reused by analytics helpers
- server-side PostHog capture supports waitlist and auth flows
- Sentry integration files and global error hooks exist in the app
- The centralized `POSTHOG_EVENTS` taxonomy grew during the redesign (S5–S9) beyond the original landing/waitlist/auth examples to cover the private app: it now spans seven module categories (`LANDING`, `AUTH`, `APP_SHELL`, `SETTINGS`, `ORDER`, `DELIVERY`, `STORE`). Naming and enforcement conventions (declarative `data-ph-event` / `data-ph-props` for simple clicks, a two-level module → action naming hierarchy, and snake_case non-PII properties) are owned by `.cursor/rules/posthog-events.mdc`. This FRD keeps the centralization principle (`FR-02-01`) as the contract; `src/lib/constants.ts` remains the source of truth for the exact set. The snapshot below is a point-in-time enumeration for traceability.

## PostHog Event Taxonomy (snapshot 2026-06-13)

`src/lib/constants.ts` `POSTHOG_EVENTS` — **116 events across 7 categories**. This is a snapshot for product traceability; the code is authoritative if it diverges.

| Category    | Count | Events                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LANDING`   | 13    | `hero_cta_clicked`, `banner_cta_clicked`, `header_cta_clicked`, `mobile_menu_opened`, `mobile_menu_nav_clicked`, `faq_item_toggled`, `social_link_clicked`, `waitlist_submitted`, `waitlist_success`, `waitlist_failed`, `waitlist_share_link_clicked`, `waitlist_share_native_clicked`, `waitlist_share_copy_link_clicked`                                                                                                                                                                                                                                                                                                                                                                        |
| `AUTH`      | 21    | `auth_signup_submitted`, `auth_signup_success`, `auth_signup_failed`, `auth_signin_submitted`, `auth_signin_success`, `auth_signin_failed`, `auth_forgot_password_submitted`, `auth_forgot_password_email_sent`, `auth_forgot_password_email_failed`, `auth_forgot_password_failed`, `auth_reset_password_viewed`, `auth_reset_password_submitted`, `auth_reset_password_success`, `auth_reset_password_failed`, `auth_google_signin_clicked`, `auth_signout`, `auth_verify_banner_shown`, `auth_verify_email_sent`, `auth_verify_email_failed`, `auth_private_access_blocked_unverified`, `auth_verify_email_resent_clicked`                                                                      |
| `APP_SHELL` | 10    | `app_shell_sidebar_toggled`, `app_shell_nav_clicked`, `app_shell_drawer_opened`, `app_shell_account_menu_toggled`, `app_shell_account_menu_item_clicked`, `app_shell_theme_changed`, `app_shell_locale_changed`, `app_shell_mascot_hidden`, `app_shell_mascot_shown`, `app_shell_placeholder_cta_clicked`                                                                                                                                                                                                                                                                                                                                                                                          |
| `SETTINGS`  | 9     | `settings_account_email_change_modal_opened`, `settings_account_email_change_submitted`, `settings_account_password_change_submitted`, `settings_account_password_set_submitted`, `settings_profile_username_saved`, `settings_profile_display_name_saved`, `settings_profile_avatar_uploaded`, `settings_profile_avatar_removed`, `settings_preferences_saved`                                                                                                                                                                                                                                                                                                                                    |
| `ORDER`     | 24    | `order_created`, `order_edited`, `order_create_discarded`, `order_discrepancy_modal_opened`, `order_discrepancy_resolved`, `order_note_saved`, `order_note_deleted`, `order_payment_added`, `order_payment_deleted`, `order_cancelled`, `order_deleted`, `order_reactivated`, `order_create_delivery_clicked`, `order_view_store_clicked`, `order_detail_more_menu_opened`, `orders_list_filtered`, `orders_list_filter_chip_removed`, `orders_list_filters_reset`, `orders_list_card_expanded`, `orders_list_card_collapsed`, `orders_list_page_changed`, `order_item_marked_arrived`, `order_item_reverted_pending`, `order_detail_sticky_primary_clicked`                                       |
| `DELIVERY`  | 17    | `delivery_create_flow_opened`, `delivery_created`, `delivery_edit_flow_opened`, `delivery_edited`, `deliveries_list_filtered`, `deliveries_list_filter_chip_removed`, `deliveries_list_filters_reset`, `deliveries_list_card_expanded`, `deliveries_list_card_collapsed`, `delivery_marked_delivered`, `delivery_reopened`, `delivery_cancelled`, `delivery_deleted`, `delivery_note_saved`, `delivery_note_deleted`, `delivery_detail_sticky_primary_clicked`, `delivery_detail_actions_sheet_opened`                                                                                                                                                                                             |
| `STORE`     | 22    | `store_created`, `store_duplicate_suggestions_shown`, `store_duplicate_submit_modal_shown`, `store_searched`, `store_governance_summary_opened`, `store_governance_summary_continue_change_request_clicked`, `store_report_opened`, `store_report_submitted`, `store_product_type_request_opened`, `store_product_type_request_submitted`, `store_change_request_edit_entered`, `store_change_request_submitted`, `store_change_request_noop_discarded`, `store_logo_upload_started`, `store_logo_upload_succeeded`, `store_logo_upload_failed`, `store_logo_removed`, `store_review_saved`, `store_review_write_clicked`, `store_review_edit_clicked`, `store_review_deleted`, `store_note_saved` |

## Acceptance Criteria

### `AC-02-01`

- Given a visitor interacts with key public CTAs
- When the interaction occurs
- Then the corresponding PostHog event is emitted through the shared naming model.

### `AC-02-02`

- Given a waitlist submission succeeds or fails
- When the server action completes
- Then analytics capture the correct outcome event.

### `AC-02-03`

- Given an unexpected runtime error occurs
- When the relevant boundary executes
- Then Sentry receives the exception without blocking the user path.

## Linked Blueprint

- `docs/product/prd-00-pre-release-validation/frd-02-growth-and-observability-foundation/bp-01-growth-and-observability-foundation/bp-01-growth-and-observability-foundation.md`
