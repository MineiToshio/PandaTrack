---
id: FDD-07
type: FDD
slug: user-settings
title: User Settings — Feature Design Document
status: ACTIVE
parent: FRD-07
last_updated: 2026-06-16
prototype: ./prototype/user-settings.html
design_system: ../../../design/README.md
demo_anchors:
  - "#settings"
  - "#s8-settings-desktop-account"
  - "#s8-settings-desktop-preferences"
  - "#s8-settings-modal-username"
  - "#s8-settings-modal-displayname"
  - "#s8-settings-modal-avatar"
  - "#s8-settings-modal-avatar-remove"
  - "#s8-settings-modal-email"
  - "#s8-settings-modal-password"
  - "#s8-settings-modal-currency"
  - "#s8-settings-profile-mobile"
  - "#s8-settings-account-mobile"
  - "#s8-settings-preferences-mobile"
  - "#s8-settings-username-sheet-mobile"
  - "#s8-settings-displayname-sheet-mobile"
  - "#s8-settings-avatar-sheet-mobile"
  - "#s8-settings-currency-sheet-mobile"
---

# FDD-07 · User Settings — Feature Design Document

> **What this document is.** The FDD is "the prototype in words": the durable, text
> form of the visual and interaction design for FRD-07, so the feature's design is
> reconstructible without depending on the disposable `docs/redesign/` workshop. It
> pairs with the self-contained prototype at [`./prototype/user-settings.html`](./prototype/user-settings.html)
> (the pixel truth) and is governed by the design system in
> [`docs/design/`](../../../design/README.md) (the system rules).
>
> **Three-source rule.** This document **references** the design system for system-wide
> rules (tokens, components, motion, states, copy voice), **describes** what is specific
> to User Settings, and **cites the prototype** for the exact pixel. When this FDD and the
> design system disagree on a system-wide rule, `docs/design/` wins. When this FDD and the
> prototype disagree on a Settings-specific visual, the prototype wins until this FDD is
> corrected in the same change.
>
> **Language.** Prose is English (repository docs convention); user-facing copy is quoted
> verbatim in Spanish (`es` is the default locale). The `en` equivalents live in
> `src/i18n/locales/en/settings.json`.

---

## 1. Overview & screens covered

User Settings is the self-service identity-and-preferences workspace: one route
(`/{locale}/settings`) where an authenticated collector manages who they are inside the
private shell (avatar, username, display name), how they sign in (email, password), and the
minimum preferences that personalize the MVP (interface, country, base currency, collected
categories, monthly budget). It is the **only non-domain workspace** in the collector app —
there is no list/detail/wizard grammar here — and its design problem is the inverse of the
domain screens: instead of one noun in many lifecycle states, it is **many small,
unrelated controls that must read as one calm page.**

Two design constraints define the feature:

1. **One route, three panes, no extra navigation** (`FR-07-30`, `BR-07-01`). The original
   "sections, not tabs" wording is superseded by ADR 0001 D15: the switcher is **vertical
   tabs on desktop** and a **sticky segmented control on mobile** — in-page panes, never
   separate routes. The intent (a single settings surface, no deep navigation) is preserved.
2. **Sensitive edits are isolated into modals, not bundled into a form save** (`BR-07-13`).
   Every consequential change — username (rate-limited), display name, avatar, email,
   password, base currency — opens its own focused overlay; the page body never carries a
   single "Save profile" button that mixes safe and unsafe writes.

Settings is also the **origin of the Chip-Eyebrow + Top-Accent section-header pattern**
(now [interface-patterns.md §7](../../../design/interface-patterns.md)): every section card
carries a tinted eyebrow pill plus a 2px top border in a per-section semantic tone, so a
returning user reads section identity (Perfil / Cuenta / Interfaz / Coleccionista) by color
and icon before reading any label.

### Screens in this FDD

| #   | Screen                       | Route                | Prototype anchor                        |
| --- | ---------------------------- | -------------------- | --------------------------------------- |
| 1   | Profile pane (default)       | `/{locale}/settings` | `#settings`                             |
| 2   | Account pane                 | `/{locale}/settings` | `#s8-settings-desktop-account`          |
| 3   | Preferences pane             | `/{locale}/settings` | `#s8-settings-desktop-preferences`      |
| 4   | Modal · change username      | (settings overlay)   | `#s8-settings-modal-username`           |
| 5   | Modal · change display name  | (settings overlay)   | `#s8-settings-modal-displayname`        |
| 6   | Modal · upload avatar + crop | (settings overlay)   | `#s8-settings-modal-avatar`             |
| 7   | Modal · remove avatar        | (settings overlay)   | `#s8-settings-modal-avatar-remove`      |
| 8   | Modal · change email         | (settings overlay)   | `#s8-settings-modal-email`              |
| 9   | Modal · change password      | (settings overlay)   | `#s8-settings-modal-password`           |
| 10  | Modal · change base currency | (settings overlay)   | `#s8-settings-modal-currency`           |
| 11  | Mobile · Profile pane        | `/{locale}/settings` | `#s8-settings-profile-mobile`           |
| 12  | Mobile · Account pane        | `/{locale}/settings` | `#s8-settings-account-mobile`           |
| 13  | Mobile · Preferences pane    | `/{locale}/settings` | `#s8-settings-preferences-mobile`       |
| 14  | Mobile · username sheet      | (settings overlay)   | `#s8-settings-username-sheet-mobile`    |
| 15  | Mobile · display-name sheet  | (settings overlay)   | `#s8-settings-displayname-sheet-mobile` |
| 16  | Mobile · avatar sheet        | (settings overlay)   | `#s8-settings-avatar-sheet-mobile`      |
| 17  | Mobile · currency sheet      | (settings overlay)   | `#s8-settings-currency-sheet-mobile`    |

Requirements traced throughout: `FR-07-01 … FR-07-34`, `BR-07-01 … BR-07-18`,
`AC-07-01 … AC-07-14` (see [`frd-07-user-settings.md`](./frd-07-user-settings.md)). The
single-route-with-tabs decision is governed by ADR 0001 D15; the modal grammar by
[ADR 0008](../../../design/decisions/0008-modal-enhancement.md); the destructive-action
styling (remove avatar) by [ADR 0012](../../../design/decisions/0012-account-destructive-action-styling.md).

---

## 2. Layout & structure per screen

All screens live inside the collector **App Shell** (PUSH `Sidebar` + `Header` topbar +
content column) — see [interface-patterns.md → Layout & app shell](../../../design/interface-patterns.md).
The shell is system chrome and is **not** redefined here. Note that the canonical account
trigger (avatar + username + the `Settings` / `Sign out` / Privacy / Terms menu, `FR-07-02`,
`BR-07-03`/`BR-07-04`) lives in the **lower shell**, owned by FRD-03; this FDD covers the
settings content column only.

### 2.1 Settings page shell (`#settings`)

The page is a single route (`SettingsShell`) rendering a left navigation rail and a single
active pane. Vertical rhythm, top to bottom:

```
app-topbar (sticky)     breadcrumb "Inicio / Ajustes" + lang/theme toggles
page-body               max-w-screen-xl, px-6 py-8
  settings-layout       12-col grid, gap-8
    settings-nav        cols 1–3, sticky top-[48px]  (SettingsNav vertical tabs)
    settings-pane       cols 4–12  (the active pane)
```

`settings-nav` is a vertical `tablist` (`settings-tabs` → `settings-tab` buttons: **Perfil ·
Cuenta · Preferencias**); the active tab carries `--accent` 12% background + `--accent` text.
Desktop and mobile share one handler contract: `[data-settings-tab]` on the trigger,
`[data-settings-pane]` on the target (so the segmented control and the rail drive the same
panes). Only one pane is mounted/visible at a time via `is-active`.

### 2.2 Section cards — the Chip-Eyebrow + Top-Accent grammar

Every pane is a stack of `settings-section` cards, each consuming the frozen section-header
pattern ([interface-patterns.md §7](../../../design/interface-patterns.md), origin of the
pattern): an `s8-eyebrow-chip` (mono-uppercase tinted pill with a leading Lucide icon) plus a
2px `top-accent` border in the matching semantic tone. The per-section tone vocabulary is
**frozen** (changing a tone here is a system-wide pattern change, not a local tweak):

| Card          | Tone              | Eyebrow chip (icon · label) | Top border class |
| ------------- | ----------------- | --------------------------- | ---------------- |
| Perfil        | `accent` (purple) | `user` · `PERFIL`           | `s8-card-accent` |
| Cuenta        | `cool` (teal)     | `shield` · `CUENTA`         | `s8-card-cool`   |
| Interfaz      | `cool` (teal)     | `monitor` · `INTERFAZ`      | `s8-card-cool`   |
| Coleccionista | `warm` (coral)    | `heart` · `COLECCIONISTA`   | `s8-card-warm`   |

Inside each card, controls render as `settings-row`s: a label/value stack on the left and a
right-aligned `"Cambiar"` action (`Button ghost`) or inline control. There is no per-row top
accent — homogeneous rows would dilute the section signal (interface-patterns.md §7
anti-patterns).

### 2.3 Profile pane (`#settings`)

Card **Perfil** ("Tu identidad pública" / "Así te ven los demás en la app."), three rows:

- **Avatar** — `s8-avatar-hero`: a 56×56 circular fallback with
  `linear-gradient(135deg, --accent → --accent-warm)` + glow shadow + the white username
  initial ("V" for `@vinyl_hunter` in the demo). Actions: `"Subir foto"` → avatar-upload
  modal; `"Eliminar"` → avatar-remove modal (`FR-07-10`, `FR-07-12`).
- **Nombre de usuario** — `@vinyl_hunter` (mono, `@` prefix), `"Cambiar"` → username modal.
  When a cooldown is active (`FR-07-33`), an `s8-cooldown-chip` renders below the value —
  a `--warning`-tinted pill with a `clock-3` icon and copy `"Próximo cambio en {days} días."`
  The chip **disappears** once the window expires; it is never shown permanently.
- **Nombre visible** — `"Vinyl Hunter"`, `"Cambiar"` → display-name modal (`FR-07-09`,
  maxlength 50).

### 2.4 Account pane (`#s8-settings-desktop-account`)

Card **Cuenta** ("Email, contraseña y acceso" / "Los cambios sensibles requieren tu
contraseña actual."), two rows — provider-aware (`FR-07-14`…`FR-07-19`):

- **Email** — `vinyl@pandatrack.dev` with a `Chip success` `"Verificado"` and `"Cambiar"` →
  email modal **for credential accounts**. Google / Google-linked accounts render the email
  **read-only with no action button** and a helper pointing to Google (`AC-07-09`).
- **Contraseña** — helper `"Última actualización hace 3 meses."`, `"Cambiar"` → password
  modal. Google-only accounts that have no password instead see a **set-password** affordance
  that transitions to "Change password" after success (`FR-07-18`, `AC-07-10`).

The pane deliberately **omits** an MFA toggle and an "active sessions" row (both deferred —
see the FRD Out of Scope; ADR 0012 context for destructive account styling).

### 2.5 Preferences pane (`#s8-settings-desktop-preferences`)

Two cards.

**Interfaz** (tone `cool`, eyebrow `monitor`, title "Tema e idioma" / "Los cambios son
inmediatos."): two segmented controls —

- **Tema**: Light / Dark (helper `"Light, dark o el del sistema."`).
- **Idioma**: Español / English (helper `"Cómo se muestran los textos."`).

These are **presentation controls, not persisted preferences**: theme lives in the client
`ThemeContext` (no `system` option, per redesign ADR 0003) and language writes the
`NEXT_LOCALE` cookie consumed by next-intl. They mirror the app-shell header toggles owned by
FRD-03 and add no new functional requirement. (The prototype shows a third "Sistema" theme
button as workshop residue; the shipped contract is the two-option model in the FRD note.)

**Coleccionista** (tone `warm`, eyebrow `heart`, title "País, moneda y categorías" /
"Cambiar la moneda base no convierte tus datos anteriores."), four rows:

- **País** — `"Argentina · AR"`, inline change (no modal in this release) — `FR-07-21`.
- **Moneda base** — `"USD · Aplicada a totales y resúmenes."`, `"Cambiar"` → currency modal
  (the only preference gated behind a confirmation flow — `FR-07-20`, `FR-07-32`).
- **Categorías favoritas** — `category-chips`: multi-select `cat-chip` toggles (Vinyl / Manga
  / Figuras / Anime / Cards / Plush); active chips take an `--accent` 10% tint. Heading copy
  asks `"¿Qué tipos de productos coleccionás?"` (`FR-07-22`, `FR-07-23`).
- **Presupuesto mensual** — inline `$300,00` numeric input + a `reset día` select (1–31),
  positive whole units only (`FR-07-24`/`FR-07-25`).

On **mobile only**, a full-width ghost-destructive `"Cerrar sesión"` button sits at the foot
of the Preferences pane; desktop omits it (sign-out lives in the sidebar account menu).

### 2.6 Modals & sheets

Seven sub-flows, each adaptive (desktop centered dialog `m01b` / mobile bottom sheet
`s7-mob-sheet`). Anatomy and behavior in §5.4.

---

## 3. Visual treatment

User Settings introduces **no new tokens, palettes, surfaces, or type ramps.** It consumes
the Velvet system as-is; this section records only how the FRD _applies_ the system. The
definitions live in [visual-foundations.md](../../../design/visual-foundations.md) and
[tokens-css.md](../../../design/tokens-css.md).

### 3.1 Color roles

| Role in this FRD                             | Token / class                                    | Where                                                  |
| -------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| Active tab / segmented button / primary CTA  | `--accent`                                       | SettingsNav active tab, segmented, modal CTAs          |
| Perfil section identity                      | `s8-card-accent` + `s8-eyebrow-chip`             | Profile card top-accent + eyebrow                      |
| Cuenta / Interfaz section identity           | `s8-card-cool` + `s8-eyebrow-chip tone-cool`     | Account & Interface cards                              |
| Coleccionista section identity               | `s8-card-warm` + `s8-eyebrow-chip tone-warm`     | Collector card                                         |
| Avatar fallback                              | `linear-gradient(135deg,--accent→--accent-warm)` | `s8-avatar-hero`                                       |
| Verified email                               | `--success`                                      | `Chip success` "Verificado"                            |
| Username cooldown / email & currency warning | `--warning`                                      | `s8-cooldown-chip`, `tone-warning` modals, warning box |
| Remove avatar (destructive)                  | `--destructive`                                  | avatar-remove modal, mobile "Cerrar sesión"            |
| Active category chip / selected currency row | `color-mix(in oklab, --accent …)`                | `cat-chip.is-active`, `s8-currency-row` selected       |

Status color is **never** carried by color alone: the verified chip is icon + label, the
cooldown chip is `clock-3` + text ([ADR 0006](../../../design/decisions/0006-color-blindness-icon-label-contract.md)).

### 3.2 Typography

- Section titles use the card title ramp; row labels are `--text-secondary`, row values
  `--text-primary`.
- The username (`@vinyl_hunter`) renders in **JetBrains Mono** via `MonoCode`; the `@`
  prefix in the username input is an `input-prefix` span.
- Eyebrow chips use mono uppercase + wide tracking per the system pattern.
- Budget amount and currency codes use the `.num` tabular treatment; the char counter on the
  display-name field is `--text-muted`.

### 3.3 Shape, radius & elevation

Standard system values, no overrides: cards at the standard radius with the 2px top-accent
border, chips/pills fully rounded, border-first elevation. Modals and sheets use the system's
elevated treatment; the modal `m01b-icon-circle` additionally carries the S8 uplift
`s8-modal-icon-gradient` — a radial `color-mix` of the tonal token (10→28%) that reinforces
the icon's semantic tone. This uplift is part of the graduated modal pattern, not a new token.

---

## 4. Components consumed

Everything below already exists in the catalog — see
[components.md](../../../design/components.md). User Settings is an **assembly of existing
components**; it must not fork or reinvent any of them.

| Component                                              | Tier   | Role in FRD-07                                                                                 |
| ------------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------- |
| `Sidebar`, `Header`                                    | module | App shell chrome; lower-shell account menu owned by FRD-03                                     |
| `SettingsShell` / `SettingsNav`                        | module | Single-route layout + vertical tabs (desktop) / segmented (mobile)                             |
| `SegmentedControl`                                     | core   | Mobile pane switcher, theme & language toggles                                                 |
| `Eyebrow` (chip variant) + `SectionCard` (`topAccent`) | core   | Chip-Eyebrow + Top-Accent section headers (interface-patterns §7)                              |
| `Avatar`                                               | core   | `s8-avatar-hero` gradient fallback with username initial                                       |
| `MonoCode`                                             | core   | `@username` identifier                                                                         |
| `StatusChip`                                           | core   | "Verificado" email chip, per [ADR 0002](../../../design/decisions/0002-status-chip-mapping.md) |
| `Button`                                               | core   | "Cambiar" ghost, primary / tonal / destructive-ghost CTAs                                      |
| `Modal` (`ModalDialog` / `ModalSheet`)                 | module | All seven sub-flows — [ADR 0008](../../../design/decisions/0008-modal-enhancement.md)          |
| `TextField` / `Input` (+ `input-prefix`)               | core   | username (@), display name, email, password, budget                                            |
| `CooldownChip`                                         | core   | `s8-cooldown-chip` username rate-limit indicator (`FR-07-33`)                                  |
| `ImageCropper`                                         | module | Avatar upload + circular crop (shared with store logo)                                         |
| `Select`                                               | core   | budget reset day, currency picker                                                              |
| `Checkbox` / chip toggle                               | core   | `cat-chip` category multi-select                                                               |
| `MobilePicker`                                         | module | mobile avatar / currency picker rows (`s7-mob-picker-row`)                                     |
| `Toast`                                                | module | confirmed-save feedback (`src/contexts/ToastContext.tsx`)                                      |

New data needs (Phase B, not design): `updateUsername` (rate-limited), `updateDisplayName`,
avatar upload/remove (R2), `changeEmail`, `setPassword` / `changePassword`,
`updateCurrency({ saveFxRates })`, and autosaving preference actions (country, categories,
budget). These are implementation contracts, not design surfaces.

---

## 5. Interactions & states

### 5.1 Pane switching

Desktop vertical tabs and the mobile segmented control are one `tablist` contract:
`role="tablist"` on the rail/segmented wrap, `role="tab"` + `aria-selected` on each button,
`role="tabpanel"` + `aria-labelledby` on each pane. Both surfaces drive the same panes via
`[data-settings-tab]` / `[data-settings-pane]`; switching cross-fades (150ms, §5.5). Arrow
keys move between tabs (up/down on the desktop rail, left/right on the mobile segmented).

### 5.2 Cross-cutting states

Owned by the system — see [states.md](../../../design/states.md) and
[ADR 0013](../../../design/decisions/0013-cross-cutting-state-system.md). Settings is a
data-light, always-populated workspace, so it carries **no list-empty / list-loading /
filtered-empty mock** — those are domain-workspace states and live in `docs/design`, not
here. The Settings-specific instances of the system states are field-level:

- **Validation (inline)**: username format / availability errors and field-level save errors
  render **below the input**, never as a toast (interface-patterns.md — _Success vs. Error
  Feedback Placement_; FRD Implementation Notes). The username states are
  `available / taken / cooldown` (a `checking` state exists in the type and copy but is
  currently dead code — `UsernameModal` never enters it).
- **Confirmation (toast)**: successful username, display-name, avatar upload/remove, and
  password changes show a transient toast (`ToastContext`).
- **Disabled-by-cooldown**: while `FR-07-33` is active, the username modal save is
  `aria-disabled="true"` with an accessible explanation, not opacity alone.

### 5.3 Provider-aware account controls

The Account pane derives capabilities at runtime from linked auth accounts (FRD
Implementation Notes), so the same pane renders three shapes: credential (email editable +
change password), Google-only (email read-only + **set** password), Google-linked credential
(email read-only — Google rule wins, `FR-07-19`). The design contract is that the **email row
either shows a "Cambiar" action or a read-only helper, never both**.

### 5.4 Modals & sheets (adaptive — desktop `m01b` dialog / mobile `s7-mob-sheet`, ADR 0008)

Desktop dialogs share the `m01b` anatomy: `m01b-icon-circle` (tone + `s8-modal-icon-gradient`)
→ `m01b-header` (title + subtitle + `m01b-close`) → `m01b-body` → `m01b-footer`; close via X,
backdrop, and Esc, with focus trapped and returned to the invoking "Cambiar". Mobile renders
the same flows as `s7-mob-sheet` (handle + scrollable body + footer, `s7-mob-backdrop` blur).

| Flow                              | Tone               | Body                                                                                                            | Footer CTA(s)                                                                        |
| --------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Username (`…-modal-username`)     | `tone-default`     | `@`-prefixed input + repeated `s8-cooldown-chip` with exact date `"Próximo cambio: {date}"` (`FR-07-33`)        | `"Guardar"` (disabled while cooldown active)                                         |
| Display name (`…-displayname`)    | `tone-default`     | free-form input + live char counter (maxlength 50, `aria-describedby`)                                          | `"Guardar"`                                                                          |
| Avatar upload (`…-avatar`)        | `tone-default`     | `s8-avatar-dropzone` ("Arrastrá una imagen aquí…", PNG/JPG/WebP máx 5 MB) → **circular `ImageCropper`** preview | `"Recortar y confirmar"` (disabled until image chosen; confirm persists, `FR-07-10`) |
| Avatar remove (`…-avatar-remove`) | `tone-destructive` | explains the exact image cannot be restored and the initial fallback returns (`FR-07-12`, ADR 0012)             | `"Eliminar foto"` (destructive)                                                      |
| Email (`…-modal-email`)           | `tone-warning`     | new email + **current password** field; explains verification restarts (`FR-07-16`)                             | `"Cambiar email"`                                                                    |
| Password (`…-modal-password`)     | `tone-default`     | current + new + confirm; **inline strength meter + rule checklist** (length/upper/number)                       | `"Guardar contraseña"`                                                               |
| Currency (`…-modal-currency`)     | `tone-warning`     | currency picker + warning box (does **not** convert historical data) — see §5.6                                 | two-path footer (§5.6)                                                               |

> Prototype honesty: the avatar modal currently renders the empty dropzone with a disabled
> `"Recortar y confirmar"` button (the circular `ImageCropper` step is described here but not
> yet drawn in the prototype), and the password modal currently shows three plain inputs
> without the strength meter/rule checklist. Both are the FRD-specified target (`FR-07-10`,
> FRD Phase-B "Password rules inline"); the prototype is the workshop snapshot, this FDD is
> the contract.

### 5.5 Optimistic behavior & motion

Behavior follows the `optimistic-client-updates.mdc` policy and
[motion.md](../../../design/motion.md):

- **Modal/sheet flows close synchronously** on submit (Optimistic Confirmation); the row
  value updates locally and reverts with a toast on failure (the parent coordinator owns
  rollback). Username and avatar changes update the settings pane's local state immediately;
  as implemented they do **not** refresh the **shell identity surface** in-session — the shell
  reflects the new values on the next full load (`FR-07-13`, `AC-07-04`).
- **Presentation toggles are immediate**: theme and language apply on click (theme via
  `ThemeContext`, language via `NEXT_LOCALE` + a localized-route redirect); they are not
  persisted preferences.
- **Pane switch** cross-fades 150ms; modal enter is scale 0.96→1 + backdrop fade; all
  respect `prefers-reduced-motion`.

### 5.6 Currency two-path flow (`FR-07-32`)

Changing the base currency does **not** convert historical data, so the flow forces an
explicit choice. Both surfaces carry the warning box `"Cambiar la moneda base no convierte
tus pedidos anteriores. Los totales históricos seguirán en su moneda original hasta que los
actualicés manualmente."` and two save paths backed by `updateCurrency({ saveFxRates })`:

- **Desktop** (`#s8-settings-modal-currency`, `tone-warning`): a 3-button horizontal footer —
  `"Cancelar"` (ghost) · `"Guardar sin actualizar"` (tonal, Path B) · `"Guardar y
actualizar"` (primary, `refresh-cw`, Path A).
- **Mobile** (`#s8-settings-currency-sheet-mobile`, max-height 88svh): a vertical footer
  with the primary action on top — `"Guardar y actualizar tipos de cambio"` (full-width
  primary) then `"Guardar sin actualizar"` (full-width ghost).

---

## 6. Copy & voice

Voice is constant, tone is per-surface — see [ux-copy.md](../../../design/ux-copy.md). FRD-07
keeps the canonical glossary (`tienda ↔ store`, `pedido ↔ order`) — see
[glossary.md](../../glossary.md). Strings live in `src/i18n/locales/{es,en}/settings.json`.

Key strings (es), by surface and tone:

| Surface                 | Tone              | String                                                                                                                                                      |
| ----------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page title              | neutral           | `"Ajustes"`                                                                                                                                                 |
| Tabs                    | neutral           | `"Perfil"` · `"Cuenta"` · `"Preferencias"`                                                                                                                  |
| Profile card            | warm-possessive   | `"Tu identidad pública"` / `"Así te ven los demás en la app."`                                                                                              |
| Username cooldown chip  | considerate       | `"Próximo cambio en {days} días."`                                                                                                                          |
| Username modal subtitle | considerate       | `"El cambio es posible cada 7 días · quedan {days} días"`                                                                                                   |
| Username modal chip     | concrete          | `"Próximo cambio: {date}"`                                                                                                                                  |
| Account card            | reassuring        | `"Email, contraseña y acceso"` / `"Los cambios sensibles requieren tu contraseña actual."`                                                                  |
| Email verified          | factual           | `"Verificado"`                                                                                                                                              |
| Avatar dropzone         | inviting          | `"Arrastrá una imagen aquí o buscá en tu dispositivo"` · `"PNG · JPG · WebP · máx 5 MB"`                                                                    |
| Interface card          | quiet             | `"Tema e idioma"` / `"Los cambios son inmediatos."`                                                                                                         |
| Collector card          | helpful           | `"País, moneda y categorías"` / `"Cambiar la moneda base no convierte tus datos anteriores."`                                                               |
| Categories prompt       | conversational    | `"¿Qué tipos de productos coleccionás?"`                                                                                                                    |
| Currency warning        | cautionary        | `"Cambiar la moneda base no convierte tus pedidos anteriores. Los totales históricos seguirán en su moneda original hasta que los actualicés manualmente."` |
| Currency save (Path A)  | active            | `"Guardar y actualizar tipos de cambio"`                                                                                                                    |
| Currency save (Path B)  | neutral           | `"Guardar sin actualizar"`                                                                                                                                  |
| Sign out (mobile)       | quiet-destructive | `"Cerrar sesión"`                                                                                                                                           |

Tone rule for this FRD: settings is a **utility surface** — no mascot in confirmations or
errors (decálogo #6); copy stays plain and conversational, and the voseo register (`actualicés`,
`coleccionás`, `buscá`) is intentional for `es`. The `en` locale mirrors the same keys with
neutral, region-agnostic copy.

---

## 7. Responsive

Mobile-first; desktop is extra room (decálogo #10). Breakpoint behavior is the system's — see
[interface-patterns.md → Responsive](../../../design/interface-patterns.md). FRD-07 specifics:

- **Switcher swap** (`< 1024px`): the desktop vertical tab rail is replaced by a **sticky
  segmented control** (`s8-seg-wrap` sticky at `top: 48px`, hidden ≥ 1024px; `s8-seg-ctrl` →
  `s8-seg-btn`: Perfil · Cuenta · Prefs). Both drive the same panes.
- **Panes stack** (`#s8-settings-profile-mobile`, `…-account-mobile`, `…-preferences-mobile`):
  the same section cards render full-width, single column, with the Profile avatar hero and
  Collector controls unchanged; the Preferences pane gains the full-width `"Cerrar sesión"`
  ghost-destructive button at its foot.
- **Modals → sheets**: all sub-flows render as `s7-mob-sheet` (vaul) on mobile — username,
  display-name, avatar (with `s7-mob-picker-row` actions subir / eliminar), and currency
  (`#s8-settings-currency-sheet-mobile`, vertical two-path footer, primary first).
- **Touch targets**: sheet footer buttons keep `min-height: 44px`.

---

## 8. Accessibility (FRD-07 specifics)

Baseline is WCAG 2.2 AA in both themes (decálogo #8). System-wide a11y rules live in
[interface-patterns.md → Accessibility](../../../design/interface-patterns.md). What matters
specifically here:

- **Tablist semantics**: rail and segmented control are `role="tablist"`; tabs expose
  `aria-selected`; panes are `role="tabpanel"` + `aria-labelledby`. Arrow-key navigation
  matches axis (up/down desktop, left/right mobile).
- **Status never by color alone**: the verified email chip and the cooldown chip are both
  icon + label ([ADR 0006](../../../design/decisions/0006-color-blindness-icon-label-contract.md)).
- **Labelled controls & icon-only actions**: every input has an explicit `for`/`id`; each
  `"Cambiar"` carries `aria-label="Cambiar {campo}"` for context beyond the visual label; the
  char counter is wired via `aria-describedby`.
- **Cooldown-disabled save**: when the username modal save is blocked by the seven-day window
  it is `aria-disabled="true"` with an accessible explanation (not opacity alone).
- **Modals**: `role="dialog"` + `aria-modal` + `aria-labelledby`; focus trapped; focus
  returns to the invoking control on close; Esc and backdrop close.
- **Destructive clarity**: the avatar-remove modal states _what is lost_ (the exact image
  cannot be restored, initial fallback returns) rather than relying on red alone (ADR 0012).
- **Inline validation announceable**: username/format and field-save errors render below the
  input and are announceable; success uses a toast that can be announced when relevant.

---

## 9. Sources & provenance

- **Pixel truth**: [`./prototype/user-settings.html`](./prototype/user-settings.html)
  (self-contained; opens standalone in light + dark; default palette Velvet). Enumerated
  S15: 17 sections (3 desktop panes, 7 desktop modals, 3 mobile panes, 4 mobile sheets).
- **System rules**: [`docs/design/`](../../../design/README.md) — visual-foundations,
  tokens-css, interface-patterns (§7 Chip-Eyebrow + Top-Accent), components, motion, states,
  ux-copy, and ADRs 0001/0002/0003/0006/0007/0008/0012/0013.
- **Functional contract**: [`frd-07-user-settings.md`](./frd-07-user-settings.md) and its
  blueprint/work-orders (`BP-01`, `WO-01 … WO-06`).
- **Workshop raw material (disposable)**: `docs/redesign/screens/settings.md` and
  `docs/redesign/_notes/demo-screens.html` (origin of the Chip-Eyebrow + Top-Accent pattern,
  workshop PLAYBOOK §9.17, now graduated to interface-patterns.md §7). These are being
  archived; this FDD + the prototype are the durable record.
