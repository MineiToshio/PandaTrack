# Feature Packets

This folder stores feature-level product and implementation packets.

## Packets

- `FEAT-0001-pre-release-landing.md`: Pre-release landing and waitlist data capture (retroactive documentation).
- `FEAT-0002-analytics-foundation-posthog.md`: Analytics baseline and event model.
- `FEAT-0003-error-monitoring-sentry.md`: Error monitoring baseline across runtimes.
- `FEAT-0004-seo-foundation.md`: SEO baseline (metadata, robots, sitemap, OG).
- `FEAT-0005-i18n-foundation.md`: Locale routing and translation foundation.
- `FEAT-0006-privacy-policy-page.md`: Public privacy policy page.
- `FEAT-0007-terms-of-service-page.md`: Public terms page.
- `FEAT-0008-auth-core-authorization-verify-email.md`: Better Auth core, route protection, Google + email/password, verify lifecycle.
- `FEAT-0009-account-recovery-forgot-reset-password.md`: Forgot/reset password flow with 60-minute token expiration.

## Conventions

- One file per feature: `FEAT-XXXX-short-name.md`

## Versioning and consistency rules

- Treat feature packets as a versioned history of decisions and implementations.
- Use `Status` to indicate lifecycle clearly:
  - `Done`: currently valid packet
  - `Done (Superseded)`: historical packet replaced by a newer one
- When a new packet replaces another, add cross-references in both:
  - New packet: `Supersedes: FEAT-XXXX`
  - Old packet: `Superseded by: FEAT-YYYY`
- Keep only one active packet per product surface at a time (e.g., landing).
- Update `docs/product/README.md` to mark which packet is currently active.

## When to create a new packet vs update existing

- Create a **new** packet when product objective, audience, core flow, or success criteria change significantly.
- Update the **existing** packet for incremental changes that keep the same objective and flow.

## Minimal documentation mode

- Keep one file per feature packet.
- Do not add extra files or subfolders unless they become strictly necessary.
