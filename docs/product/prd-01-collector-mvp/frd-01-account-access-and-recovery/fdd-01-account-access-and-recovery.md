---
id: FDD-01
type: FDD
slug: account-access-and-recovery
title: Account Access & Recovery — Feature Design Document
status: ACTIVE
parent: FRD-01
last_updated: 2026-06-16
prototype: ./prototype/account-access-and-recovery.html
design_system: ../../../design/README.md
demo_anchors:
  - "#s11-sign-up"
  - "#s11-sign-in"
  - "#s11-sign-in-error"
  - "#s11-forgot-password"
  - "#s11-reset-password"
  - "#s11-verify-email"
  - "#s11-verify-email-required"
  - "#s11-sign-in-mobile"
---

# FDD-01 · Account Access & Recovery — Feature Design Document

> **What this document is.** The FDD is "the prototype in words": the durable, text
> form of the visual and interaction design for FRD-01, so the feature's design is
> reconstructible without depending on the redesign subproject. It
> pairs with the self-contained prototype at [`./prototype/account-access-and-recovery.html`](./prototype/account-access-and-recovery.html)
> (the pixel truth) and is governed by the design system in
> [`docs/design/`](../../../design/README.md) (the system rules).
>
> **Three-source rule.** This document **references** the design system for system-wide
> rules (tokens, components, motion, states, copy voice), **describes** what is specific
> to Account Access & Recovery, and **cites the prototype** for the exact pixel. When this
> FDD and the design system disagree on a system-wide rule, `docs/design/` wins. When this
> FDD and the prototype disagree on an auth-specific visual, the prototype wins until this
> FDD is corrected in the same change.
>
> **Language.** Prose is English (repository docs convention); user-facing copy is quoted
> verbatim in Spanish (`es` is the default locale). The `en` equivalents live in the auth
> namespaces under `src/i18n/locales/en/`.

---

## 1. Overview & screens covered

Account Access & Recovery is the **public, anonymous on-ramp** into the collector
workspace: sign-up, sign-in (with its error state), password recovery (forgot → reset),
and the email-verification lifecycle (sent + the day-7 blocking gate). It is the one
collector-adjacent surface that lives **outside the app shell** — there is no PUSH
`Sidebar`, no breadcrumb topbar, no content rail. Instead it is a **focused-card layout**:
a slim public minibar over a single centered card floated on an accent glow.

The primary design constraint is **trust at first contact**. A returning user must
recognize the same Velvet system (tokens, type ramp, accent, theme + language controls)
while a first-time visitor sees nothing but the next decision: one card, one form, one
primary action. Everything that is not the form is demoted — the card is the protagonist,
the chrome is a whisper.

This is a **presentation-only** layer over an already-IMPLEMENTED feature. Flow and
acceptance criteria are unchanged from [`frd-01-account-access-and-recovery.md`](./frd-01-account-access-and-recovery.md);
the redesign only restyles the six screens. The one UX guard added (no AC change) is the
**repeat-password match** on the reset screen.

### Screens in this FDD

| #   | Screen                            | Route (App Router)          | Prototype anchor             |
| --- | --------------------------------- | --------------------------- | ---------------------------- |
| 1   | Sign-up (crear cuenta)            | `/{locale}/sign-up`         | `#s11-sign-up`               |
| 2   | Sign-in (iniciar sesión)          | `/{locale}/sign-in`         | `#s11-sign-in`               |
| 3   | Sign-in · error                   | `/{locale}/sign-in`         | `#s11-sign-in-error`         |
| 4   | Forgot password (olvidé)          | `/{locale}/forgot-password` | `#s11-forgot-password`       |
| 5   | Reset password (restablecer)      | `/{locale}/reset-password`  | `#s11-reset-password`        |
| 6   | Verify email · sent               | `/{locale}/verify-email`    | `#s11-verify-email`          |
| 7   | Verify email · required (day-7)   | `/{locale}/(app)` gate      | `#s11-verify-email-required` |
| 8   | Mobile · sign-in (representative) | `/{locale}/sign-in` (390px) | `#s11-sign-in-mobile`        |

Requirements traced throughout: `FR-01-01 … FR-01-12`, `BR-01-01 … BR-01-07`,
`AC-01-01 … AC-01-05` (see [`frd-01-account-access-and-recovery.md`](./frd-01-account-access-and-recovery.md)).
Account destructive-action (sign-out) styling is governed by
[ADR 0012](../../../design/decisions/0012-account-destructive-action-styling.md); note the
prototype shows a sign-out footer on the day-7 gate but the shipped gate omits it (see §2.7);
cross-cutting states by [ADR 0013](../../../design/decisions/0013-cross-cutting-state-system.md).

---

## 2. Layout & structure per screen

Auth does **not** use the collector App Shell (PUSH `Sidebar` + `Header`). It uses the
**public chrome + focused card** instead. The shared scaffold is identical across all
eight screens; only the card body changes.

### 2.1 The shared scaffold (`mk-public` → `mk-minibar` → `auth-wrap` → `auth-card`)

Top to bottom, every screen wraps the card in:

```
mk-public mk-bleed
  mk-minibar (slim public header)   brand "P · PandaTrack" · spacer · ES/EN · theme
  auth-wrap (centered flex column)
    auth-glow (accent halo, aria-hidden)
    auth-card (max-width ~408px)
```

- **Minibar** (`mk-minibar` → `mk-minibar-inner`): the only chrome. A `mk-brand`
  home link (`mk-brand-mark` "P" + wordmark), a spacer, then `mk-utils` — the `mk-lang`
  ES/EN toggle and the `mk-theme` light/dark group. It is deliberately lighter than the
  landing header: no nav, no marketing CTAs. Note for parity: on the **landing** header
  the "Iniciar sesión" CTA is rendered `variant="secondary"` (filled, equal visual weight
  to "Crear cuenta") — see the redesign subproject's landing-onboarding copy (historical);
  inside the auth cards the primary action is always the form CTA, not a header button.
- **`auth-wrap`**: a centered flex column that vertically anchors the card; on mobile its
  padding tightens to `28px 16px 40px` (prototype `#s11-sign-in-mobile`).
- **`auth-glow`** (`aria-hidden="true"`): a purely decorative accent halo above the card —
  the only ornamental element; it carries no information and is invisible to AT.
- **`auth-card`**: the focused surface (`--surface`, ~408px max width). Anatomy per card:
  optional `auth-back` link → `auth-head` (`<h1>` + sub) → optional `auth-google` +
  `auth-divider` → `auth-field`s → primary `auth-submit` → optional `auth-note` and
  `auth-foot`.

### 2.2 Sign-up (`#s11-sign-up`)

`auth-head` `"Crea tu cuenta"` + sub `"Empieza a organizar tu colección. Es gratis."` →
the multicolor `auth-google` button → `auth-divider` `"o con tu email"` → Email field →
Password field (`auth-input-wrap` + `auth-eye` toggle) with helper `"Mínimo 8 caracteres."`
→ a terms `auth-check` (`"Acepto los Términos y la Política de privacidad."`) — presentational only, uncontrolled, with no `required` attribute and no submit-blocking validation →
primary `"Crear cuenta"` → `auth-foot` `"¿Ya tienes cuenta? Inicia sesión"` (FR-01-01,
FR-01-02, BR-01-03).

### 2.3 Sign-in (`#s11-sign-in`) and its error variant (`#s11-sign-in-error`)

Same skeleton as sign-up minus the terms checkbox: head `"Bienvenido de nuevo"` /
`"Inicia sesión para seguir con tu colección."`, Google, divider, Email, Password. The
password field's label row is a flex pair — `<label>Contraseña` on the left, an inline
`auth-link` `"¿La olvidaste?"` on the right (→ forgot-password). Primary `"Iniciar sesión"`,
`auth-foot` `"¿No tienes cuenta? Crea una gratis"` (FR-01-05).

**Error variant** (`#s11-sign-in-error`) is the same card with a **top error banner**
(`auth-form-error`, `role="alert"`, `alert-circle` icon) carrying
`"Email o contraseña incorrectos. Revisa los datos e inténtalo de nuevo."`, and **both
inputs in `.input.is-error` + `aria-invalid="true"`**. This is the canonical auth error
treatment: one banner at the top of the card, fields tinted, no toast.

### 2.4 Forgot password (`#s11-forgot-password`)

Adds an `auth-back` link (`arrow-left` + `"Volver a iniciar sesión"`) above the head.
Head `"¿Olvidaste tu contraseña?"` / `"Escribe tu email y te enviaremos un enlace para
crear una nueva."` → single Email field → primary `"Enviar enlace"` → an `auth-note`
(`info` icon) carrying the **neutral, anti-enumeration** message
`"Por tu seguridad, siempre mostramos este mensaje, exista o no una cuenta con ese email."`
(FR-01-09, BR-01-07, AC-01-04).

### 2.5 Reset password (`#s11-reset-password`)

Head `"Crea una nueva contraseña"` / `"Elige una contraseña que no uses en otro sitio."`
→ **two** password fields, each its own `auth-input-wrap` + `auth-eye`: `"Nueva
contraseña"` (helper `"Mínimo 8 caracteres."`) and `"Repetir contraseña"` → primary
`"Guardar contraseña"`. The **repeat-password match** is the only UX addition over the
functional FRD: the CTA validates the two fields agree before submitting (no AC change).
Token validity (60 min, single-use) is a backend contract — FR-01-10, BR-01-06, AC-01-05.

### 2.6 Verify email · sent (`#s11-verify-email`)

A **status card** (no form): an `auth-status-icon` at the top in the **default accent**
tone wrapping a `mail-check` glyph → head `"Revisa tu correo"` with the address bolded in
the sub (`"Te enviamos un enlace de verificación a <strong>…</strong>. Ábrelo para activar
tu cuenta."`) → a **ghost** action `"Reenviar enlace"` → `auth-note` (`info`)
`"¿No lo ves? Revisa spam o promociones. El enlace vence en 60 minutos."` → `auth-foot`
`"Volver a iniciar sesión"` (FR-01-06, FR-01-07).

### 2.7 Verify email · required, day-7 gate (`#s11-verify-email-required`)

Same status-card skeleton, but the `auth-status-icon` carries **`tone-warning`** with a
`shield-alert` glyph — this is the blocking gate, not a friendly nudge. Head
`"Verifica tu email para continuar"` / `"Pasaron los 7 días de prueba. Verifica
<strong>…</strong> para seguir usando PandaTrack."` → **primary** (not ghost) action
`"Reenviar enlace de verificación"` → `auth-foot` `"Cerrar sesión"`. This screen renders
**in place of the app shell** when an unverified email/password account crosses the seven-day
grace window (AC-01-03, BR-01-05). The prototype's footer "Cerrar sesión" is an account-exit
action whose styling follows [ADR 0012](../../../design/decisions/0012-account-destructive-action-styling.md).
Shipped divergence: the live gate omits this footer — it renders only the status card + resend,
with no sign-out control (the `verifyGate.signOut` i18n key is unused).

---

## 3. Visual treatment

Account Access & Recovery introduces **no new tokens, palettes, surfaces, or type ramps.**
It consumes the Velvet system as-is. This section records only how auth _applies_ the
system; the definitions live in
[visual-foundations.md](../../../design/visual-foundations.md) and
[tokens-css.md](../../../design/tokens-css.md).

### 3.1 Color roles

| Role in auth                               | Token / class                              | Where                                                             |
| ------------------------------------------ | ------------------------------------------ | ----------------------------------------------------------------- |
| Primary CTA (submit / resend on gate)      | `--accent` (Button primary, `btn primary`) | every card's `auth-submit`                                        |
| Card surface                               | `--surface`                                | `auth-card`                                                       |
| Input / Google surface                     | `--surface-elevated`                       | `.input`, `auth-google`                                           |
| Field borders                              | `--border` / `--border-strong`             | inputs, dividers                                                  |
| Focus ring · links · glow · status default | `--accent`                                 | input focus, `auth-link`, `auth-glow`, default `auth-status-icon` |
| Form / field error                         | `--destructive`                            | `auth-form-error`, `.input.is-error`, inline `auth-error`         |
| Day-7 gate status icon                     | `--warning` (`tone-warning`)               | `auth-status-icon` on `#s11-verify-email-required`                |
| Verification "ok" tone (reserved)          | `--success` (`tone-success`)               | success status states                                             |
| Account exit (sign-out copy)               | `--destructive`                            | sign-out per ADR 0012 (gate footer in prototype only; see §2.7)   |

The **Google brand button** (`auth-google`) is the deliberate exception: its multicolor
logo (`#4285F4` / `#34A853` / `#FBBC05` / `#EA4335`) is a fixed brand asset and is
**exempt from theming** — it must not be recolored for light/dark parity. The button
chrome around it (surface, border, label) follows the system; the four-color glyph does not.

### 3.2 Typography

- Card headings use the `<h1>` ramp (`auth-head h1`); the supporting line is secondary text.
- Field labels (`auth-label`), helper text (`auth-help`), and the neutral note
  (`auth-note`) use the small/secondary ramp.
- The verified email address is **bolded inline** (`<strong>`) inside the verify subs to
  anchor the user's eye on "which inbox".
- No `MonoCode` / identifier typography is used on auth — there are no `ORD-…` / `DLV-…`
  identifiers on this surface.

### 3.3 Shape, radius & elevation

Standard system values, no overrides: the card at the standard radius, inputs and the
Google button at the input radius, the status-icon a fully-rounded tonal disc. Elevation is
border-led per the system; the only "lift" is the decorative `auth-glow` halo behind the
card, which is ornament, not a shadow token. Light + dark are both first-class (the minibar
exposes the theme toggle on every screen).

---

## 4. Components consumed

In the prototype these are hand-rolled (`auth-*` classes); **in Phase B they map to the
existing catalog** — see [components.md](../../../design/components.md). Auth is an
**assembly of existing primitives**; the anti-pattern (workshop §9) is to keep the
hand-rolled inputs/button instead of reusing core components.

| Prototype element                       | Catalog component (Phase B)       | Role in FRD-01                                           |
| --------------------------------------- | --------------------------------- | -------------------------------------------------------- |
| `mk-minibar` (brand · lang · theme)     | public minibar (`Logo` + toggles) | the only chrome; outside the app shell                   |
| `.input` (email/text)                   | `Input`                           | email and single-line fields                             |
| `auth-input-wrap` + `auth-eye`          | `PasswordInput`                   | password fields with visibility toggle (`eye`/`eye-off`) |
| `btn primary full` / `btn ghost full`   | `Button` (primary / ghost)        | submit and resend CTAs                                   |
| `auth-google` (multicolor SVG)          | `GoogleSignInButton`              | OAuth entry; brand logo theming-exempt                   |
| `auth-check`                            | `Checkbox`                        | terms acceptance on sign-up                              |
| `auth-form-error` (`role="alert"`)      | form error banner                 | top-of-card error on sign-in                             |
| `auth-status-icon` (tonal disc)         | tonal status icon                 | verify-sent (accent) / day-7 (warning)                   |
| `auth-back` / `auth-link` / `auth-foot` | `Link` / `ViewTransitionLink`     | back, "¿la olvidaste?", footer navigation                |
| `auth-note`                             | inline note                       | neutral anti-enumeration / verify hints                  |

New (Phase B) wiring lives under `src/app/[locale]/(auth)/*` with shared
`_components/AuthFormLayout`, `AuthStatusCard`, `*Form`, `GoogleSignInButton`,
`PasswordInput` — these are implementation contracts, not new design surfaces. Auth must
not fork the catalog (ADR 0010, [ui-libs-policy](../../../design/components.md)).

---

## 5. Interactions & states

### 5.1 Cross-cutting states

Owned by the system — see [states.md](../../../design/states.md) and
[ADR 0013](../../../design/decisions/0013-cross-cutting-state-system.md). Auth instances:

- **Default / focus**: fields show the system focus ring in `--accent`; initial focus lands
  on the first field of each card.
- **Submit in progress**: the primary button enters a disabled + spinner state during the
  Better Auth round-trip (Google included).
- **Error**: the canonical auth error is the **top banner + tinted fields** treatment
  (§2.3), not a toast.
- **Status (no form)**: verify-sent and the day-7 gate are status cards driven entirely by
  the tonal `auth-status-icon` (accent vs `tone-warning`).

### 5.2 Validation behavior

- Validation runs **post-blur and on-submit**; the error clears the moment the user
  re-engages the field (workshop §6).
- On a submit that fails validation, focus moves to the **first invalid field**.
- **Password eye** toggles `type` between `password` and `text`, swaps the icon
  (`eye` ↔ `eye-off`), and updates its `aria-label` accordingly. The prototype wires this
  with `data-s11-eye`; Phase B gets it from `PasswordInput`.

### 5.3 The sign-in error variant (`#s11-sign-in-error`)

The single, deliberate error mock. On failed sign-in: the `auth-form-error` banner
(`role="alert"`) appears at the top of the card with
`"Email o contraseña incorrectos. Revisa los datos e inténtalo de nuevo."`, both fields
take `.input.is-error` + `aria-invalid="true"`, and focus returns to the email field. The
message is intentionally **generic** (no "this email doesn't exist") — same anti-enumeration
spirit as forgot-password.

### 5.4 Flow-specific behaviors

- **Google** (FR-01-02, FR-01-12): launches the existing Better Auth OAuth redirect; an
  existing account links by matching email rather than duplicating (BR-01-04).
- **Forgot password** (FR-01-09, BR-01-07, AC-01-04): the response is **always neutral** —
  the same `auth-note` regardless of whether the email exists, so account existence is never
  leaked.
- **Reset password** (FR-01-10, FR-01-11, BR-01-06, AC-01-05): the two password fields must
  match before the CTA submits; the token is time-limited (60 min) and single-use. Success
  routes the user back to sign-in with updated credentials.
- **Resend verification** (FR-01-07): on both verify screens the resend action carries an
  anti-spam **cooldown** with inline/toast feedback.
- **Day-7 gate** (AC-01-03, BR-01-05): once the grace window closes, the private app layout
  renders `#s11-verify-email-required` instead of the shell until the email is verified.
- There is **no first-run wizard and no preference prefill** — onboarding is purely this
  on-ramp (workshop anti-pattern §9; FRD-07 alignment).

Motion is system-level and inherited unchanged — see [motion.md](../../../design/motion.md)
and [ADR 0014](../../../design/decisions/0014-motion-system-and-view-transitions.md).

---

## 6. Copy & voice

Voice is constant and tone is per-surface — see [ux-copy.md](../../../design/ux-copy.md).
Auth keeps the canonical glossary (`cuenta ↔ account`, `pedido ↔ order`,
`tienda ↔ store`) — see [glossary.md](../../glossary.md). Strings live in the auth
namespaces under `src/i18n/locales/{es,en}/`.

Key strings (es), by surface and tone:

| Surface              | Tone                | String                                                                                               |
| -------------------- | ------------------- | ---------------------------------------------------------------------------------------------------- |
| Sign-up head         | inviting            | `"Crea tu cuenta"` / `"Empieza a organizar tu colección. Es gratis."`                                |
| Sign-in head         | warm-welcoming      | `"Bienvenido de nuevo"` / `"Inicia sesión para seguir con tu colección."`                            |
| Google button        | neutral             | `"Continuar con Google"`                                                                             |
| Email divider        | quiet               | `"o con tu email"`                                                                                   |
| Password helper      | concrete            | `"Mínimo 8 caracteres."`                                                                             |
| Terms checkbox       | factual             | `"Acepto los Términos y la Política de privacidad."`                                                 |
| Sign-in error banner | corrective, generic | `"Email o contraseña incorrectos. Revisa los datos e inténtalo de nuevo."`                           |
| Forgot head          | reassuring          | `"¿Olvidaste tu contraseña?"` / `"Escribe tu email y te enviaremos un enlace para crear una nueva."` |
| Forgot neutral note  | trust-building      | `"Por tu seguridad, siempre mostramos este mensaje, exista o no una cuenta con ese email."`          |
| Reset head           | guiding             | `"Crea una nueva contraseña"` / `"Elige una contraseña que no uses en otro sitio."`                  |
| Reset CTA            | decisive            | `"Guardar contraseña"`                                                                               |
| Verify-sent head     | calm                | `"Revisa tu correo"`                                                                                 |
| Verify-sent note     | helpful             | `"¿No lo ves? Revisa spam o promociones. El enlace vence en 60 minutos."`                            |
| Day-7 gate head      | firm, not alarming  | `"Verifica tu email para continuar"`                                                                 |
| Day-7 gate sub       | explanatory         | `"Pasaron los 7 días de prueba. Verifica … para seguir usando PandaTrack."`                          |

Tone rule for this FRD: **errors and confirmations carry no mascot** (decálogo #6); auth is
a trust surface, so copy stays plain and the only "personality" is the welcoming sign-in
head. `en` strings are the locale equivalents of the above.

---

## 7. Responsive

Mobile-first; desktop is extra room (decálogo #10). Breakpoint behavior is the system's —
see [interface-patterns.md → Responsive](../../../design/interface-patterns.md). Auth
specifics:

- The card is intrinsically responsive: at `max-width ~408px` it already fits a phone, so
  there is **one card design across breakpoints** — no separate mobile card body.
- **Mobile representative** (`#s11-sign-in-mobile`, 390px frame): the minibar height tightens
  to `56px` with `16px` side padding and the ES/EN toggle is dropped from the minibar (theme
  toggle kept); the `auth-wrap` padding becomes `28px 16px 40px`. The card content is
  identical to desktop sign-in.
- Tap targets stay ≥44px (inputs, eye toggle, buttons) per the workshop accessibility
  agreement.
- The decorative `auth-glow` scales with the wrap and never clips the card or causes
  horizontal overflow.

---

## 8. Accessibility (FRD-01 specifics)

Baseline is WCAG 2.2 AA in both themes (decálogo #8). System-wide a11y rules live in
[interface-patterns.md → Accessibility](../../../design/interface-patterns.md). What
matters specifically here (all forms, all anonymous):

- **Labels**: every field has an associated `<label>` (`htmlFor`/`id`); the password
  label-row keeps the `<label>` even when it shares a row with the "¿La olvidaste?" link.
- **Error wiring**: invalid inputs carry `aria-invalid="true"` and are described by the
  inline/banner error via `aria-describedby`; the top banner uses `role="alert"` so it is
  announced.
- **Focus management**: initial focus on the first field; on a failed submit, focus moves to
  the first invalid field.
- **Password eye**: a real `<button>` with a **dynamic `aria-label`** (`"Mostrar
contraseña"` ↔ "Ocultar contraseña") that tracks the visibility state.
- **Status cards**: verify-sent and the day-7 gate keep a real `<h1>`; the tonal
  `auth-status-icon` is `aria-hidden` (decoration), so meaning is carried by the heading +
  body, never by color/icon alone.
- **Landmark + decoration**: the card sits in a `<main>` landmark; `auth-glow` is
  `aria-hidden="true"`.
- **Google brand button**: its SVG is `aria-hidden`; the accessible name comes from the
  visible `"Continuar con Google"` label.
- **Contrast** verified in light + dark, including the `is-error` field tint and the
  `tone-warning` gate icon.

---

## 9. Sources & provenance

- **Pixel truth**: [`./prototype/account-access-and-recovery.html`](./prototype/account-access-and-recovery.html)
  (self-contained; opens standalone in light + dark; default palette Velvet). Anchors:
  `#s11-sign-up`, `#s11-sign-in`, `#s11-sign-in-error`, `#s11-forgot-password`,
  `#s11-reset-password`, `#s11-verify-email`, `#s11-verify-email-required`,
  `#s11-sign-in-mobile`.
- **System rules**: [`docs/design/`](../../../design/README.md) — visual-foundations,
  tokens-css, interface-patterns, components, motion, states, ux-copy, and ADRs
  0010/0012/0013/0014.
- **Functional contract**: [`frd-01-account-access-and-recovery.md`](./frd-01-account-access-and-recovery.md)
  and its linked blueprint.
- **Glossary**: [glossary.md](../../glossary.md) (`cuenta ↔ account`, `pedido ↔ order`,
  `tienda ↔ store`).
- **Workshop raw material (historical)**: distilled from the redesign subproject; see git history. This FDD + the prototype are the durable record.
