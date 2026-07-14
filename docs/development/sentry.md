# Sentry Implementation Notes

## Purpose

Technical reference for error monitoring setup in PandaTrack.

## Current architecture

- Client init: `src/instrumentation-client.ts`
- Server init: `sentry.server.config.ts`
- Edge init: `sentry.edge.config.ts`
- Runtime registration: `src/instrumentation.ts`
- Build-time plugin config: `next.config.ts` (source-map upload only: `org`, `project`, no DSN)

The Sentry runtime init files and framework hooks are owned by PRD-01 FRD-02 (growth and observability foundation). The route-level failure contract and the capture-point inventory below are owned by PRD-02 FRD-10 (error experience hardening).

## Capture points

Every unexpected failure is captured exactly once. A 404, an offline state, and an expected/validation failure are never captured.

### Framework hooks (PRD-01 FRD-02)

- `onRequestError` (`src/instrumentation.ts`, `Sentry.captureRequestError`): server and edge request errors that are not caught by application code.
- `onRouterTransitionStart` (`src/instrumentation-client.ts`, `Sentry.captureRouterTransitionStart`): client navigation instrumentation.

### Route-level boundaries (PRD-02 FRD-10)

- `src/app/[locale]/error.tsx` (`area: "public_shell"`): render/runtime errors in the public, auth, and legal segments (`(auth)`, `(landing)`, `privacy`, `terms`). One `Sentry.captureException(error, { tags: { area: "public_shell" }, extra: { digest } })` in a `useEffect`. Also the backstop if `(app)/error.tsx` itself throws.
- `src/app/[locale]/(app)/error.tsx` (`area: "app_shell"`, owned by FRD-03): render/runtime errors in the authenticated subtree. One `Sentry.captureException(error, { tags: { area: "app_shell" }, extra: { digest } })` in a `useEffect`.
- `src/app/global-error.tsx`: catastrophic root-layout render failure. One bare `Sentry.captureException(error)` in a `useEffect`. Self-contained (inline styles, inline SVG, bilingual inline copy, no next-intl, no theme tokens).

### Non-capturing surfaces (by contract)

- `src/app/[locale]/not-found.tsx` and `src/app/[locale]/(app)/not-found.tsx`: neutral 404 surfaces, no capture. A missing page is not an error (`BR-10-01`).
- `src/app/[locale]/[...rest]/page.tsx`: catch-all that calls `notFound()` so any unmatched `/{locale}` URL renders the on-brand localized 404 instead of the framework default. No capture.
- `src/app/[locale]/layout.tsx`: an invalid locale prefix (for example `/foo`) is `redirect()`-ed to the default locale rather than captured. A layout cannot render its own segment's `not-found`, and there is no root layout to host a root `not-found`, so the redirect keeps the visitor on an on-brand surface. Redirect is control flow, not an error, and is not captured.
- `SectionError`: region-level failure while the page lives; it never captures. The fallible fetch that produced it captures in its own `try/catch`.

### Server Actions

Mutating Server Actions (`src/app/**/_actions/*.ts`) follow the discriminated-result contract: they return `{ ok: false; error: <code> }` (or the `success`-keyed variant) for expected failures without throwing, and capture only unexpected failures once with redacted, PII-safe context before returning the generic error. Data-layer modules (`src/lib/data/**`) convert expected in-transaction throws into discriminated results inside the module and re-throw only genuinely unexpected errors to the action layer, which captures them. Control-flow signals (`redirect()` / `notFound()`) are re-thrown (via the `NEXT_REDIRECT` guard or `unstable_rethrow`) before any capture, so they are never reported as errors.

## Guardrails

- Avoid duplicate captures for the same failure path.
- Do not include secrets or sensitive payloads in context.
- Capture unexpected errors; handle expected validation errors without noisy reporting.
- Route/global boundaries capture render failures; framework hooks are not re-captured manually unless meaningful product context is added.

## Configuration policy

Resolutions for the previously open hardening items (reviewed and applied in PRD-02 FRD-10 · BP-01 · WO-03, coordinated with the PRD-01 FRD-02 config owner):

- **DSN externalization (resolved).** The DSN is a public identifier (it ships in the client bundle), not a secret. The three init files read it from the environment: `src/instrumentation-client.ts` reads `NEXT_PUBLIC_SENTRY_DSN`; `sentry.server.config.ts` and `sentry.edge.config.ts` read `SENTRY_DSN` then fall back to `NEXT_PUBLIC_SENTRY_DSN`. All three keep the current project DSN as an inline fallback so init never breaks when the variable is unset. Both keys are documented in `.env.example`. `next.config.ts` never contained a DSN (only `org`/`project` for source-map upload).
- **`sendDefaultPii` (resolved, `false`).** All three init files set `sendDefaultPii: false`, matching the FRD-10 privacy stance and PRD-01 FRD-02 `BR-02-04` (no PII in captures). Enabling it would attach request headers, including session cookies, to captured events. No code depends on default PII.
- **`tracesSampleRate` (recorded, `1`).** Kept at `1` in all three init files. Acceptable at the current pre-launch traffic level, where full traces are useful and volume is low. Revisit and lower before a wider launch once real traffic volume is known (tracked as an FRD-10 extension point and PRD-01 FRD-02 open question).
