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

## Packet routing index (use this first)

Use this index to identify which packet to read/update before implementation. Do not scan all packets by default.

| Feature     | Area                                     | Primary code paths / signals                                                                              |
| ----------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `FEAT-0001` | Pre-release landing + waitlist           | `src/app/[locale]/(landing)/**`, waitlist components/actions, landing CTA-to-waitlist behavior            |
| `FEAT-0002` | Analytics (PostHog)                      | `src/lib/constants.ts` (`POSTHOG_EVENTS`), `src/lib/posthog*`, `data-ph-event`, analytics capture logic   |
| `FEAT-0003` | Monitoring (Sentry)                      | `src/instrumentation*.ts`, `sentry.*.config.ts`, `src/app/global-error.tsx`                               |
| `FEAT-0004` | SEO foundation                           | `src/lib/seo.ts`, `src/app/sitemap.ts`, `src/app/robots.ts`, metadata generation, canonical/OG URL logic  |
| `FEAT-0005` | i18n foundation                          | `src/i18n/**`, `src/proxy.ts`, locale routing, translation namespaces                                     |
| `FEAT-0006` | Privacy page                             | `src/app/[locale]/privacy/**`, `src/i18n/locales/*/privacy.json`                                          |
| `FEAT-0007` | Terms page                               | `src/app/[locale]/terms/**`, `src/i18n/locales/*/terms.json`                                              |
| `FEAT-0008` | Auth core + authorization + verify email | auth routes (`/sign-up`, `/sign-in`), session/guards/protected routes, provider linking, verify lifecycle |
| `FEAT-0009` | Forgot/reset password                    | password recovery routes/actions, reset token flow, recovery email delivery                               |

### Selection rule

- Pick the packet with strongest path/signal match as primary.
- If needed, include at most 2 related packets.
- If still ambiguous, ask the user which packet is authoritative.

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
