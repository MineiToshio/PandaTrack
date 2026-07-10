# Audit 2026-07 — Improvement Plan

**Date:** 2026-07-10
**Origin:** Multi-agent repository audit (10 audit agents → consolidated findings) run against branch `staging`.
**Owner of this document:** engineering execution reference. It is the operational source of truth for landing the audit fixes. It plans work only; it changes no product scope on its own.

This plan groups the consolidated findings into implementation **batches** (B1–B10) organized into execution **waves**. Each batch is a self-contained unit of work sized for one implementer, with an explicit owner of any shared file to prevent merge conflicts across parallel worktrees.

## How to read a batch

- **Findings covered:** the audit IDs the batch resolves.
- **Risk:** low / medium / high — regression risk of the change itself, used to pick validation scope.
- **Acceptance criteria:** verifiable conditions that must hold when the batch is done.
- **Validation:** commands required by `.agents/rules/validation-checklist.mdc` for the batch's risk class. "Full" = `npm run test` → `npm run type-check` → `npm run lint` → `npm run validate-build`, plus any named Playwright spec.
- **Product behavior:** if checked, the batch changes product behavior and MUST update the owning `docs/product` doc in the same change (per `AGENTS.md` §4).
- **Model:** suggested implementer tier (opus for correctness/data/security-critical or multi-file reasoning; sonnet for mechanical, config, and presentational work).

## Summary table

| Batch | Wave | Objective                               | Findings                                                                                   | Risk   | Product behavior | Model  |
| ----- | ---- | --------------------------------------- | ------------------------------------------------------------------------------------------ | ------ | ---------------- | ------ |
| B1    | 0    | Security dependency upgrades            | SEC-A-1, SEC-A-2, DX-5                                                                     | High   | No               | opus   |
| B2    | 1    | Money correctness core                  | DATA-1, MONEY-1, MONEY-3, MONEY-6, SEC-A-6, SEC-B-2 (orders), DX-2 (partial)               | High   | No               | opus   |
| B3    | 1    | Input boundaries & action hardening     | SEC-B-1, SEC-A-4, SEC-B-3, SEC-B-4, SEC-B-5, MONEY-5, SEC-B-6, SEC-B-2 (deliveries/stores) | High   | No               | opus   |
| B4    | 1    | Data layer: pagination, N+1, indexes    | DATA-2, DATA-4, DATA-5, DATA-6, DATA-11                                                    | High   | No               | opus   |
| B6    | 1    | Monitoring & defense-in-depth config    | SEC-A-3, SEC-A-5                                                                           | Medium | No               | sonnet |
| B7    | 1    | Performance quick wins                  | PERF-1, PERF-2, PERF-3, PERF-5                                                             | Medium | No               | sonnet |
| B8    | 1    | Theming, i18n hardcode & analytics gaps | UI-1, UI-2, BP-3, UI-5, UI-6                                                               | Low    | No               | sonnet |
| B9    | 1    | Docs & rules alignment                  | DOC-1, DOC-2, BP-4, DX-3, ARCH-6, ARCH-5                                                   | Low    | No               | sonnet |
| B5    | 2    | Delivery FX-pending flag                | MONEY-2                                                                                    | High   | **Yes**          | opus   |
| B10   | 2    | Mechanical hygiene sweep                | BP-1, BP-2, BP-9, DX-7, BP-5, BP-7, .DS_Store cleanup                                      | Medium | No               | sonnet |

---

## Wave 0 — sequential, solo

### B1 — Security dependency upgrades

- **Objective:** Close the known-vulnerable dependency advisories before any feature work merges on top.
- **Findings:** SEC-A-1, SEC-A-2, DX-5.
- **Scope:**
  - **SEC-A-1** — Upgrade `better-auth` from `1.6.10` to `>1.6.12` (advisory: account takeover via OAuth account auto-linking). The current config in `src/lib/auth/auth.ts:93-99` is in the vulnerable configuration; after the upgrade, re-verify the account-linking options against the patched defaults and tighten if the advisory requires it.
  - **SEC-A-2** — Upgrade `next` from `16.1.6` to the patched `16.x` release (CVEs: middleware/authorization bypass).
  - **DX-5** — Run `npm audit fix` for non-breaking transitive advisories only. Do NOT take major bumps here (those are deferred, DX-6).
- **Affected files:** `package.json`, `package-lock.json`, and `src/lib/auth/auth.ts` only if the patched advisory requires a config change.
- **Risk:** High (auth + framework version bump).
- **Acceptance criteria:**
  - `better-auth` resolved version is `> 1.6.12`; `next` is on the patched `16.x`.
  - `npm audit` reports no remaining High/Critical advisories reachable from production dependencies (or each remaining one is explicitly listed here as deferred with reason).
  - Auth sign-in / sign-out still work end-to-end.
- **Validation:** Full + `npm run test:e2e -- e2e/auth.spec.ts`.
- **Product behavior:** No.
- **Model:** opus.
- **Why solo / Wave 0:** touches `package.json` / lockfile; a lockfile conflict against any Wave 1 branch is expensive to resolve. All later waves branch from the post-B1 tree.

---

## Wave 1 — parallel (isolated git worktrees)

All Wave 1 batches branch from the merged B1 tree. File-ownership boundaries below are mandatory to keep worktrees conflict-free.

### B2 — Money correctness core

- **Objective:** Make the money/FX write paths atomic, correctly validated, and race-safe.
- **Findings:** DATA-1, MONEY-1, MONEY-3, MONEY-6, SEC-A-6, SEC-B-2 (orders portion), DX-2 (partial).
- **Scope:**
  - **DATA-1 (critical)** — In `src/app/[locale]/(app)/settings/_actions/preferencesActions.ts:123-140`, the base-currency change and `flagOrdersForFxReconciliation` run as two separate transactions; a failure between them leaves inconsistent money state. Collapse them into a single `prisma.$transaction`.
  - **MONEY-1** — `orderFxActions.ts:9-19` uses a lax inline schema for the exchange rate. Replace it by importing and reusing `exchangeRateSchema` from `src/lib/orders/orderValidation.ts:29-33`.
  - **MONEY-3** — `orderPaymentMutations.ts:40-80` has a read-then-write race on payment aggregation. Guard it with `isolationLevel: Serializable` (or `SELECT … FOR UPDATE`) plus a bounded retry on serialization failure.
  - **MONEY-6** — In `src/lib/orders/paymentSummary.ts`, clamp `remainingAmount` (≥ 0) and `paymentPercentage` (0–100) so overpayment / rounding cannot produce negative or > 100% values.
  - **SEC-A-6** — Move the inline `prisma.order.updateMany` from `orderFxActions.ts:39` into the orders data layer (`src/lib/data/orders/`) as a named mutation, and call it from the action. **(Reassigned to B2 — see note below.)**
  - **SEC-B-2 (orders portion)** — Add `.max()` bounds to array inputs in `src/lib/orders/orderValidation.ts`.
  - **DX-2 (partial)** — New unit tests for these paths: payment-add race guard (logic), FX schema reuse, `paymentSummary` clamps, and settings-action atomicity (via mocked transaction).
- **File ownership:** B2 is the **exclusive owner** of `src/lib/orders/orderValidation.ts` and `src/app/.../orderFxActions.ts` this wave. B3 may only _import_ from `orderValidation.ts`, never edit it.
- **Affected files:** `settings/_actions/preferencesActions.ts`, `orderFxActions.ts`, `orderPaymentMutations.ts`, `src/lib/orders/paymentSummary.ts`, `src/lib/orders/orderValidation.ts`, `src/lib/data/orders/*`, new test files.
- **Risk:** High.
- **Acceptance criteria:**
  - Base-currency change + FX reconciliation flag commit or roll back together (single transaction).
  - `orderFxActions` validates the rate with the shared `exchangeRateSchema`; no inline rate schema remains.
  - Concurrent payment additions cannot double-count; the mutation retries on serialization failure.
  - `paymentSummary` never returns negative remaining or a percentage outside 0–100.
  - No `prisma.*` call remains inline in `orderFxActions.ts`.
  - New unit tests cover each of the above and pass.
- **Validation:** Full.
- **Product behavior:** No (correctness of existing behavior; no user-facing contract change).
- **Model:** opus.

### B3 — Input boundaries & action hardening

- **Objective:** Enforce auth, Zod validation, and safe parsing at every server-action / query boundary that currently trusts input.
- **Findings:** SEC-B-1, SEC-A-4, SEC-B-3, SEC-B-4, SEC-B-5, MONEY-5, SEC-B-6, SEC-B-2 (deliveries/stores portion).
- **Scope:**
  - **SEC-B-1 + SEC-A-4** — `getDuplicateCandidates.ts` runs with no `getSession`, no Zod input parsing, and calls `src/queries/store.ts:44-104` `findMany` with no `take` limit. Add session auth, a Zod input schema, and a bounded `take`.
  - **SEC-B-3** — IDs passed to `orderLifecycleActions.ts` / `orderItemActions.ts` are not Zod-validated. Validate them (e.g. cuid/uuid schema) before use.
  - **SEC-B-4** — `locale` is used unvalidated in `redirect()` at `orderLifecycleActions.ts:55` and `deliveryLifecycleActions.ts:127`. Validate against `routing.locales` before redirecting.
  - **SEC-B-5 + MONEY-5** — `parseDecimalToMinorUnits` uses lax `parseFloat` in `orderActions.ts:14-19`, `createDeliveryAction.ts`, `editDeliveryAction.ts`. Replace with a strict decimal regex that rejects malformed / multi-dot / exponent input.
  - **SEC-B-6** — `productTypeKey` accepts arbitrary strings with no max length or catalog check. Constrain with `.max()` and validate against `isStoreProductTypeKey`.
  - **SEC-B-2 (deliveries/stores portion)** — Add `.max()` bounds to array inputs in `deliveryValidation.ts` and `createStoreSchema.ts`.
- **File ownership:** B3 must NOT edit `src/lib/orders/orderValidation.ts` (owned by B2). If a shared schema is needed there, import it. B3 owns `deliveryValidation.ts`, `createStoreSchema.ts`, and the store query/action files it touches.
- **Affected files:** `getDuplicateCandidates.ts`, `src/queries/store.ts`, `orderLifecycleActions.ts`, `orderItemActions.ts`, `deliveryLifecycleActions.ts`, `orderActions.ts`, `createDeliveryAction.ts`, `editDeliveryAction.ts`, `deliveryValidation.ts`, `createStoreSchema.ts`, plus new tests for the parser and duplicate-candidates auth.
- **Risk:** High.
- **Acceptance criteria:**
  - `getDuplicateCandidates` rejects unauthenticated calls, parses its input with Zod, and caps the query result count.
  - Invalid IDs are rejected before any DB access in the lifecycle/item actions.
  - An unsupported `locale` never reaches `redirect()`.
  - `parseDecimalToMinorUnits` rejects malformed decimals (unit tests prove it).
  - `productTypeKey` outside the catalog or over the max length is rejected.
  - All string-array inputs across deliveries/stores schemas have a `.max()` bound.
- **Validation:** Full.
- **Product behavior:** No.
- **Model:** opus.

### B4 — Data layer: pagination, N+1, indexes

- **Objective:** Fix a paging correctness bug, an N+1 write loop, and add the compound indexes the hot list queries need.
- **Findings:** DATA-2, DATA-4, DATA-5, DATA-6, DATA-11.
- **Scope:**
  - **DATA-2 (high)** — In `src/lib/data/orders/orderQueries.ts:497-555`, the `paymentStates` filter breaks pagination unless the sort is `payment-asc` (the filter is applied post-fetch on a single page). Force the full-fetch-then-filter path whenever a payment-state filter is present, regardless of sort, so page counts and boundaries are correct.
  - **DATA-4** — `persistDerivedOrderStatuses` in `deliveryMutations.ts:27-57` issues per-order queries (N+1). Replace with a single batched `findMany` and a batched update.
  - **DATA-5 / DATA-6 / DATA-11** — Add compound indexes via an **additive** migration following `.agents/rules/prisma-migration-workflow.mdc` (4-step definition of done: SQL written + `prisma migrate deploy` + `prisma generate` + `type-check` passes):
    - `Order`: `@@index([userId, orderDate])`, `@@index([userId, status])`
    - `Delivery`: `@@index([userId, deliveryDate])`
    - `OrderItem`: `@@index([userId, deliveryState])`
- **File ownership:** B4 owns `prisma/schema.prisma` this wave (only additive `@@index` lines). B5 (Wave 2) edits `schema.prisma` after B4 merges — see wave ordering.
- **Affected files:** `src/lib/data/orders/orderQueries.ts`, `deliveryMutations.ts`, `prisma/schema.prisma`, new migration under `prisma/migrations/`, new pagination tests.
- **Risk:** High.
- **Acceptance criteria:**
  - Orders list paginated with a payment-state filter returns correct totals and non-overlapping pages under every sort option (unit/integration test proves it).
  - `persistDerivedOrderStatuses` issues a constant number of queries independent of order count.
  - Migration is additive-only (no drops/alters), applies cleanly via `migrate deploy`, and `prisma generate` + `type-check` pass.
- **Validation:** Full + `npm run test:e2e -- e2e/orders.spec.ts`.
- **Product behavior:** No.
- **Model:** opus.

### B6 — Monitoring & defense-in-depth config

- **Objective:** Stop shipping PII to Sentry and close the private-route gap in the proxy.
- **Findings:** SEC-A-3, SEC-A-5.
- **Scope:**
  - **SEC-A-3** — Set `sendDefaultPii: false` in `sentry.server.config.ts:18`, `sentry.edge.config.ts:19`, and `src/instrumentation-client.ts:28`. Verify no required debugging context is lost; if a specific safe field is genuinely needed, attach it explicitly instead of enabling default PII.
  - **SEC-A-5** — Add `stores` and `settings` to `PRIVATE_ROUTE_PREFIXES` in `src/proxy.ts:22-27` so those routes require auth like the rest of `(app)`.
- **File ownership:** No overlap with B2. **SEC-A-6 was moved out of B6 into B2** (rationale below), so B6 does not touch `orderFxActions.ts` or the orders data layer.
- **Affected files:** `sentry.server.config.ts`, `sentry.edge.config.ts`, `src/instrumentation-client.ts`, `src/proxy.ts`.
- **Risk:** Medium (routing/auth surface + monitoring config).
- **Acceptance criteria:**
  - `sendDefaultPii` is `false` in all three Sentry configs.
  - Unauthenticated requests to `stores` and `settings` routes are redirected/blocked like other private routes.
- **Validation:** Full (proxy is routing/auth behavior). Include `npm run test:e2e -- e2e/auth.spec.ts` if it exercises private-route redirects.
- **Product behavior:** No.
- **Model:** sonnet.

### B7 — Performance quick wins

- **Objective:** Remove redundant per-request work and unused asset weight.
- **Findings:** PERF-1, PERF-2, PERF-3, PERF-5.
- **Scope:**
  - **PERF-1** — `getCollectorPreferencesSnapshot` is called 3× per request (`(app)` layout, `dashboard/page`, `getDashboardData`). Wrap with React `cache()` for intra-request memoization.
  - **PERF-2** — `listCountryCodes` / `listActiveStoreProductTypeKeys` have no caching. Wrap with React `cache()` for intra-request dedupe (cross-request `unstable_cache` is deferred, optional).
  - **PERF-3** — `regularFont` (Open Sans, 4 weights) is loaded but never used (`src/lib/fonts.ts:21-45`, root layout `:71`, `globals.css:152`). Remove it after re-verifying zero references across `src/`.
  - **PERF-5** — `Avatar.tsx:56` uses a raw `<img>`; migrate to `next/image` (remote patterns already configured).
- **Affected files:** `src/lib/fonts.ts`, root `layout.tsx`, `globals.css`, `Avatar.tsx`, the preferences/country/product-type query modules.
- **Risk:** Medium (touches shared query utilities and root layout font loading).
- **Acceptance criteria:**
  - Each wrapped function executes at most once per request (verified by test or logging).
  - No reference to `regularFont` / Open Sans remains anywhere in `src/`; build has no unused-font warning.
  - Avatar renders via `next/image` with correct sizing and no layout shift.
- **Validation:** Full (shared utilities + layout + build behavior).
- **Product behavior:** No.
- **Model:** sonnet.

### B8 — Theming, i18n hardcode & analytics gaps

- **Objective:** Fix theme desync, a missing design token, a hardcoded-Spanish skeleton, and two missing analytics events.
- **Findings:** UI-1, UI-2, BP-3, UI-5, UI-6.
- **Scope:**
  - **UI-1** — Tailwind `dark:` variants are out of sync with the app's `data-theme` system in `FilterDrawer.tsx:558`, `ModalDialog.tsx:134,151`, `ModalSheet.tsx:65`, `Sheet.tsx:130`. Convert to the `[data-theme="dark"]` selector approach used by the design system.
  - **UI-2** — Token `--shadow-3` does not exist (6 usages, 3 without fallback). Define it as an alias of `--shadow-elevation-3` in `globals.css` (or migrate usages to the canonical token — pick the one consistent with `docs/design/tokens-css.md`).
  - **BP-3** — Hardcoded Spanish strings in `OrderListLoadingSkeleton.tsx:48-52`. Move to i18n keys in both `es` and `en` locale files.
  - **UI-5 / UI-6** — Missing PostHog tracking on desktop `HeaderNav` and the Sign In button. Use existing `POSTHOG_EVENTS` constants or add a new constant in `src/lib/constants.ts` (no inline event strings).
- **Affected files:** the four overlay components, `globals.css`, `OrderListLoadingSkeleton.tsx`, `src/i18n/locales/{es,en}/*.json`, `HeaderNav`, Sign In button, possibly `src/lib/constants.ts`.
- **Risk:** Low (presentational + additive analytics).
- **Acceptance criteria:**
  - The four overlays render correctly in both light and dark under the `data-theme` toggle (the design-token guard test in `npm run test` passes).
  - `--shadow-3` resolves to a defined value; no unresolved-token usage remains.
  - Loading skeleton renders localized copy in both locales; no hardcoded Spanish.
  - Desktop nav and Sign In fire a centralized PostHog event on click.
- **Validation:** `npm run test` + `npm run type-check` + `npm run lint` (the design-token guard runs under test).
- **Product behavior:** No.
- **Model:** sonnet.

### B9 — Docs & rules alignment

- **Objective:** Bring stale docs and one mis-stated rule back in line with the shipped codebase, and record the data-layer direction as an ADR.
- **Findings:** DOC-1, DOC-2, BP-4, DX-3, ARCH-6, ARCH-5.
- **Scope:**
  - **DOC-1 (high)** — Root `README.md` is stale (describes a "landing + waitlist" product, omits `(app)` / `(auth)` route groups from the structure). Rewrite to match the real state.
  - **DOC-2** — Add a note in `docs/product/glossary.md` clarifying "envío" as an attribute vs. an entity.
  - **BP-4** — The rule `.agents/rules/next-intl-translation-apis.mdc` contradicts 35+ async Server Components that correctly use `getTranslations` (because `useTranslations` does not work in async RSC). Update the RULE to recognize async Server Components as a valid `getTranslations` case; update `docs/tooling/agents/rules.md` if the rule scope changes materially.
  - **DX-3** — Add `BETTER_AUTH_EXTRA_ORIGINS` and `NEXT_PUBLIC_APP_URL` to `.env.example`.
  - **ARCH-6** — Write an ADR (`docs/design/decisions/0015-*`) documenting the data-layer decision: current coexistence of `src/queries/` (db-injected, one file per model) and `src/lib/data/<domain>/` (singleton, queries + mutations per domain), and the canonical future direction (per-domain `src/lib/data` for new domains). Update `.agents/rules/project-structure.mdc` and `docs/development/file-organization.md` so they stop documenting only `src/queries`.
  - **ARCH-5** — Add the "Permitted exception" justification (server-derived state) as a short _why_ comment where it is missing: `OrderActionsCard.tsx:48-53`, `DeliveryCreateWizard.tsx:166`, `FxReconciliationModal.tsx:138`.
- **Affected files:** `README.md`, `docs/product/glossary.md`, `.agents/rules/next-intl-translation-apis.mdc`, `docs/tooling/agents/rules.md`, `.env.example`, new `docs/design/decisions/0015-*.md`, `docs/design/README.md` (ADR index), `.agents/rules/project-structure.mdc`, `docs/development/file-organization.md`, the three components (comment-only).
- **Risk:** Low (docs + one comment-only code touch + `.env.example`).
- **Acceptance criteria:**
  - `README.md` accurately reflects the collector-app product and the current route-group structure.
  - The next-intl rule no longer flags correct async-RSC `getTranslations` usage as a violation.
  - `.env.example` lists both new variables with placeholder values.
  - ADR 0015 exists, is linked from `docs/design/README.md`, and `project-structure.mdc` + `file-organization.md` describe both data-layer locations.
- **Validation:** Docs-only per `.agents/rules/validation-checklist.mdc` requires no app validation; run `npm run lint` because the three ARCH-5 comment edits touch `.tsx` files.
- **Product behavior:** No (glossary clarification is a wording note, not a scope change).
- **Model:** sonnet.

---

## Wave 2 — sequential, after Wave 1 merges

### B5 — Delivery FX-pending flag

- **Objective:** Extend the order-level FX-reconciliation pattern to deliveries so a base-currency change flags stale delivery conversions instead of silently showing an outdated rate.
- **Findings:** MONEY-2 (high).
- **Depends on:** **B4** (owns `prisma/schema.prisma` — B5's additive column must layer on B4's index migration) and **B2** (owns the unified base-currency-change `$transaction` in `preferencesActions.ts` — B5 marks the new delivery flag inside that same transaction).
- **Scope:**
  - Add `needsExchangeRateUpdate` to the `Delivery` model via an **additive** migration (follow `.agents/rules/prisma-migration-workflow.mdc`, 4-step DoD).
  - When base currency changes, set the flag inside the same `$transaction` B2 unified.
  - Surface it consistently with the order pattern: exclude/badge the stale conversion in `DeliveryDetailHero.tsx:79` and in `DeliverySummaryCard`.
- **Affected files:** `prisma/schema.prisma`, new migration, `preferencesActions.ts`, `DeliveryDetailHero.tsx`, `DeliverySummaryCard`, delivery data-layer mutation, and the owning `docs/product` deliveries FRD.
- **Risk:** High.
- **Acceptance criteria:**
  - `Delivery.needsExchangeRateUpdate` exists (additive migration applies cleanly; `prisma generate` + `type-check` pass).
  - Changing base currency sets the flag on affected deliveries within one transaction alongside the order flagging.
  - The deliveries UI badges / suppresses stale conversions consistently with orders.
- **Validation:** Full + `npm run test:e2e -- e2e/deliveries.spec.ts`.
- **Product behavior:** **Yes.** Update the deliveries FRD-08 (FRD + blueprint + FDD) in `docs/product` in the same change per `AGENTS.md` §4.
- **Model:** opus.

### B10 — Mechanical hygiene sweep

- **Objective:** Repo-wide cleanup that must run last so it sweeps the final merged tree, not a moving target.
- **Findings:** BP-1, BP-2, BP-9, DX-7, BP-5, BP-7, `.DS_Store` cleanup.
- **Scope:**
  - **BP-1** — Remove ~129 planning-artifact references (`FR-XX-NN`, `WO-XX`, `FRD-XX`, `BR-XX-NN`) from code comments across ~52 files; keep the explanatory _why_, drop only the ID (per `AGENTS.md` §4 "Do not reference planning artifacts in source comments").
  - **BP-2** — Translate Spanish phrases quoted in JSDoc to English.
  - **BP-9 + DX-7** — Clear the 31 lint warnings (unused imports/vars, 10 orphaned `eslint-disable`); evaluate `argsIgnorePattern: "^_"` for intentionally-unused args.
  - **BP-5** — Deduplicate `toIso` into `src/lib` (promotion rule).
  - **BP-7** — Type the `any` in `StoreForm/types.ts:27`.
  - **`.DS_Store` cleanup** — Remove tracked `.DS_Store` files under `docs/**` and add a `.gitignore` entry.
- **Affected files:** ~52 comment-bearing source files, JSDoc sites, lint-flagged files, `src/lib` (new/moved `toIso`), `StoreForm/types.ts`, tracked `.DS_Store` files, `.gitignore`.
- **Risk:** Medium (broad multi-file touch; BP-5 and BP-7 change real code).
- **Acceptance criteria:**
  - No `FR-XX-NN` / `WO-XX` / `FRD-XX` / `BR-XX-NN` tokens remain in source comments.
  - `npm run lint` reports zero warnings; no orphaned `eslint-disable` remain.
  - `toIso` has a single definition in `src/lib` and all call sites import it.
  - `StoreForm/types.ts:27` has a concrete type (no `any`).
  - No `.DS_Store` tracked; `.gitignore` excludes it.
- **Validation:** `npm run test` + `npm run type-check` + `npm run lint` + `npm run validate-build` (breadth + BP-5/BP-7 code changes justify build validation).
- **Product behavior:** No.
- **Model:** sonnet.

---

## Execution order & waves

```
Wave 0:  B1  (solo — lockfile owner; everything branches from here)
            │
Wave 1:  ┌──┴──────────────────────────────────────────────┐
         B2   B3   B4   B6   B7   B8   B9   (parallel worktrees)
         └──┬───────────┬──────────────────────────────────┘
            │           │
Wave 2:     └── B5 (needs B2's unified $transaction + B4's schema.prisma)
                B10 (last — sweeps the fully merged tree)
```

### Dependencies

- **B1 → everything.** All later branches start from the merged B1 tree to avoid lockfile conflicts.
- **Wave 1 file-ownership boundaries (must hold to stay conflict-free):**
  - `src/lib/orders/orderValidation.ts` and `orderFxActions.ts` → **B2 only.** B3 imports from `orderValidation.ts`, never edits it.
  - `prisma/schema.prisma` → **B4 only** in Wave 1. B5 edits it in Wave 2 after B4 merges.
  - `deliveryValidation.ts`, `createStoreSchema.ts` → **B3.**
  - Sentry configs + `src/proxy.ts` → **B6.** (No overlap with B2 after SEC-A-6 moved to B2.)
- **B5 → after B2 and B4.** It writes the delivery FX flag inside the base-currency `$transaction` that B2 unifies, and adds a `Delivery` column onto B4's migration baseline.
- **B10 → last.** A repo-wide comment/lint sweep run before other batches merge would immediately go stale; run it once on the final tree.
- **Merge order within Wave 1:** merge B2 before B6/B9 is not required (no shared files), but merge B2 and B4 before starting B5. B8/B9 are low-risk and can merge in any order.

### Note on SEC-A-6 assignment

The orchestrator flagged a coordination risk: both B6 and B2 could touch `orderFxActions.ts`. **Resolution: SEC-A-6 is assigned entirely to B2.** B2 already owns `orderFxActions.ts` and the orders data layer, so moving the inline `prisma.order.updateMany` into `src/lib/data/orders/` is a single-owner change with no cross-worktree handoff. B6 is therefore pure config/monitoring (SEC-A-3, SEC-A-5) and shares no files with any other Wave 1 batch. The rejected alternative — B6 "prepares" a data-layer function that B2 consumes — would create a merge dependency between two otherwise-independent worktrees for no benefit.

---

## Deferred items

Not scheduled in this plan. Each needs an owner decision, carries disproportionate risk, or is out of the audit's remediation scope.

| ID              | Item                                         | Reason deferred                                                                                                                            |
| --------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DX-1            | `migrate resolve                             |                                                                                                                                            | true` in the build script | Owner decision — requires verifying production DB migration state first. Mitigation: documented here; do not silently swallow migrate failures without confirming the DB baseline. |
| MONEY-4         | Zero-decimal currencies treated as 2-decimal | Product decision — owner must define the intended handling for zero-decimal currencies.                                                    |
| DATA-3          | `take: 1000` cap on a query                  | Out of scope — proper fix is a pagination redesign, larger than a remediation batch.                                                       |
| DATA-8          | `@@unique` on position                       | Risk — a unique position constraint can cause transient collisions during reorder; needs a deferred-constraint or reorder-strategy design. |
| DATA-10         | Explicit `Decimal` precision                 | Not urgent — requires column alteration (non-additive migration); no correctness impact today.                                             |
| ARCH-1 / ARCH-3 | Full migration to a single data layer        | Large — the ADR in B9 fixes the direction; the mechanical migration is a dedicated effort.                                                 |
| ARCH-4          | `StarRating` vs `RatingStars` consolidation  | Non-urgent refactor.                                                                                                                       |
| ARCH-7          | Ad-hoc popover in `OrderItemsGrid`           | Medium refactor, no correctness impact.                                                                                                    |
| DX-4            | e2e / build in CI                            | Owner decision — CI-minute cost tradeoff.                                                                                                  |
| DX-6            | Major bumps (typescript / eslint / lucide)   | Needs a dedicated upgrade cycle; out of B1's non-breaking scope.                                                                           |
| DX-8            | Vitest coverage                              | Adds a dependency; owner decision.                                                                                                         |
| MONEY-7         | Per-line rounding                            | Behavior is already correct — informational note only, no change needed.                                                                   |

```

```

---

## Outcome report (2026-07-10)

Execution completed the same day on branch `staging`, commits `9140d56..264c6f1` (15 commits, local only, not pushed). Every batch passed an adversarial review by a reviewer distinct from its implementer; the money batch (B2) used a two-lens panel and its findings were fixed and re-reviewed until clean.

### Finding → status

| Findings                                                                                                                                                                                          | Status                                                                                                                                                                                          | Landed in                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| SEC-A-1 better-auth account-takeover advisory, SEC-A-2 Next.js middleware-bypass CVEs, DX-5 transitive audit fixes                                                                                | Implemented — 0 critical/high remain in `npm audit --omit=dev`                                                                                                                                  | `00b6e4b`                       |
| SEC-A-3 Sentry `sendDefaultPii`, SEC-A-5 proxy private prefixes                                                                                                                                   | Implemented                                                                                                                                                                                     | `1b40070`                       |
| SEC-B-1/SEC-A-4 unauthenticated duplicate-candidates action + unbounded scan, SEC-B-2 array bounds, SEC-B-3 Zod on lifecycle IDs, SEC-B-4 locale redirect, SEC-B-5/MONEY-5 strict decimal parsing | Implemented                                                                                                                                                                                     | `a2f735a`                       |
| SEC-B-6 `productTypeKey` bound                                                                                                                                                                    | Implemented (length bound; catalog membership was already DB-enforced at write time)                                                                                                            | `603957c`, `d6fda5c`            |
| DATA-1 atomic base-currency change, MONEY-1 canonical FX schema, MONEY-3 payment race (Serializable + retry), MONEY-6 payment-summary clamps, SEC-A-6 Prisma out of the action                    | Implemented                                                                                                                                                                                     | `c9f6e56`                       |
| DATA-2 payment-filter pagination, DATA-4 delivery status N+1, DATA-5/6/11 compound indexes (additive migration, applied)                                                                          | Implemented                                                                                                                                                                                     | `66e8803`                       |
| MONEY-2 delivery FX-pending flag (migration + same-transaction flagging + surfaces + FRD-08/FDD/WO docs)                                                                                          | Implemented                                                                                                                                                                                     | `0722556`                       |
| PERF-1/2 per-request query dedupe, PERF-3 unused font family removed, PERF-5 Avatar → `next/image`                                                                                                | Implemented                                                                                                                                                                                     | `c904d4f`                       |
| UI-1 `dark:` → theme tokens, UI-2 `--shadow-3` → `--shadow-elevation-3`, BP-3 skeleton i18n, UI-5/6 landing analytics events                                                                      | Implemented                                                                                                                                                                                     | `41ae98e`                       |
| DOC-1 README, DOC-2 glossary, BP-4 next-intl rule realigned, DX-3 `.env.example`, ARCH-6 ADR 0015 + structure docs, ARCH-5 non-optimistic justifications                                          | Implemented                                                                                                                                                                                     | `4a54f8f`                       |
| BP-1 planning refs (59 files), BP-2 Spanish JSDoc, BP-5 `toIso` dedupe, BP-7 `any` typed, BP-9/DX-7 lint debt (31 → 4 justified warnings)                                                         | Implemented                                                                                                                                                                                     | `264c6f1`                       |
| DX-2 test gap on money paths                                                                                                                                                                      | Partially implemented — new unit suites for payment race/overpay, FX schema, base-currency atomicity, FX-rate application, pagination, delivery flag; lifecycle/settings actions still untested | `c9f6e56`, `66e8803`, `0722556` |

### Review-driven fixes (found by the adversarial phase, not the audit)

| Fix                                                                                                                                                                                                | Landed in            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| FX schema precision: 2-decimal/0.01-floor made weak-currency pairs (CLP/KRW/JPY) and 6-decimal provider rates unreconcilable — now 6 decimals, floor 0.000001, shared by orders **and** deliveries | `d6fda5c`, `b913662` |
| `savePreferencesAction` side door could change base currency without flagging orders — now routes through the atomic orchestrator                                                                  | `d6fda5c`            |
| Duplicate-store detection: accent-sensitive SQL pre-filter silently skipped stores like "Pokémon" for "pokemon" — replaced with a bounded scan normalized on both sides                            | `d6fda5c`            |
| Archive-guard test raced with transient agent worktrees; ESLint scanned them                                                                                                                       | `ea472dc`, `d6fda5c` |

### Final validation (verified exit codes, merged tree)

- `npm run test`: 724 passed, 12 skipped (integration specs that require a live DB), 0 failed
- `npm run type-check`: clean
- `npm run lint`: 0 errors, 4 warnings (intentional `aria-*` on sole-surface trigger buttons, commented in place)
- `npm run validate-build`: production build succeeds
- `npm run test:e2e`: `auth.spec.ts` 6/6. `orders`/`deliveries` route-protection tests pass; their authenticated cases auto-skip off port 3000, which is occupied by an unrelated local dev server (see below)

### Deferred / owner decisions (in addition to the table above)

- **Duplicate detection at scale**: the bounded-scan fix is exact up to 500 stores; beyond that a persisted normalized-name column (+ index) is the proper fix.
- **ModalDialog dark accent-glow**: the theme fix replaced a bespoke dark shadow with `--shadow-elevation-3`; needs a design sign-off.
- **Local e2e environment**: authenticated Playwright specs require port 3000 (Better Auth trusted origin), which another project's dev server frequently occupies; freeing the port re-enables the full suite.
- **DX-1 build-script `migrate resolve`**: removed in round 2 after the owner confirmed there is no deployed production DB — staging/dev is the only environment, and `prisma migrate status` reported it clean and up to date.

## Round 2 (2026-07-10) — owner decisions

### Context

The owner reviewed the outcome report above and resolved the deferred items. Nothing is deployed to production yet — the staging DB is the only environment — which unblocks DX-1.

### Round 2 batches

| Batch | Wave             | Model                | Scope                                                                                                                                                                                                                                                                                                                  |
| ----- | ---------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1    | A                | sonnet               | Remove the build-script `migrate resolve \|\| true` workaround (DX-1) — unblocked by no-production confirmation.                                                                                                                                                                                                       |
| R2    | A                | opus + 2-lens review | Zero-decimal currency support (MONEY-4) — Chile is an MVP target; storage stays uniform ×100 minor units (no data migration), input/validation/formatting become currency-exponent aware.                                                                                                                              |
| R3    | A                | sonnet               | Restore `ModalDialog` bespoke dark shadow theme-aware; 320px fixed-width checks; authenticated visual smoke of the main app surfaces in both themes, fixing small breakages.                                                                                                                                           |
| R5    | A                | opus                 | Merge `StarRating`/`RatingStars` (ARCH-4), replace the ad-hoc `OrderItemsGrid` popover with an existing primitive (ARCH-7), sweep for other duplicated components, and add a component-inventory guard test + reuse-first workflow reinforcement (owner mandate: prevent component/function duplication structurally). |
| R8    | A                | sonnet               | Unit tests for lifecycle/settings Server Actions (DX-2 remainder) + vitest coverage baseline, no gates (DX-8) — owner wants meaningful coverage, not 100%.                                                                                                                                                             |
| R4    | B                | opus                 | Migrate `src/queries/*` to the canonical `src/lib/data/<domain>/` layer per ADR 0015 (owner approved the full unification).                                                                                                                                                                                            |
| R6    | B                | opus                 | Data-layer debt — DATA-3 (remove the take-1000 in-memory cap via persisted paid-amount enabling SQL sort/filter), DATA-8 (`@@unique` order-item position with safe reorder strategy), DATA-10 (explicit `Decimal` precision) — all unblocked by no-production.                                                         |
| R9    | B                | sonnet               | CI — add production build to the validate workflow and a critical-flow e2e job (auth + orders) with documented repo secrets; owner accepted CI cost for important flows only.                                                                                                                                          |
| R10   | B                | sonnet               | Local authenticated e2e via port 7100 using `BETTER_AUTH_EXTRA_ORIGINS` (gitignored env, credentials never committed) + fix the two known-failing specs (app-layout, stores heading locale).                                                                                                                           |
| R7    | pending owner OK | —                    | Persisted normalized store-name column for duplicate detection — explained to the owner, awaiting confirmation.                                                                                                                                                                                                        |

### Phase 3 (deferred by owner)

Major dependency upgrades (DX-6) as a dedicated later iteration, after round 2 stabilizes.
