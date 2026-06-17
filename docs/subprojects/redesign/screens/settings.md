---
title: Settings
session: 08
status: spec-complete
last_updated: 2026-05-18
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
frd: docs/product/prd-01-collector-mvp/frd-07-user-account-settings/frd-07-user-account-settings.md
---

# Settings

> **Fuente visual de verdad:** `docs/redesign/_notes/demo-screens.html`. Los anchors listados arriba son la referencia canónica. Este spec describe el contrato funcional, tokens, componentes y comportamiento.
>
> **Reemplaza:** el spec S2 lo-fi que vivía en este mismo archivo. Las decisiones de ADR 0001 D14–D19 siguen vigentes y están integradas.
>
> **Patrón visual:** esta pantalla es el origen del patrón Chip Eyebrow + Top-Accent documentado en `docs/redesign/PLAYBOOK.md §9.17`. Cualquier ajuste a los tonos por card debe sincronizarse con esa sección.

## 1. Layout

Vive dentro del `AppShell`. En desktop el sidebar PUSH ocupa la izquierda. La pantalla de Ajustes es una sola ruta (`/settings`) que renderiza 3 secciones via tabs: Perfil / Cuenta / Preferencias.

### Desktop (≥ 1024px)

```
AppShell (sidebar 240px PUSH)
└── app-content
    ├── app-topbar (48px sticky) — breadcrumb "Inicio / Ajustes" + lang/theme toggles
    └── page-body (px-6 py-8, max-w-screen-xl)
        └── settings-layout (grid 12 cols gap-8)
            ├── settings-nav (cols 1–3, sticky top-[48px])
            │   └── tabs verticales: Perfil / Cuenta / Preferencias
            └── settings-pane (cols 4–12) — pane activo
```

**ADR 0001 D15** — tabs verticales (220px) elegidos sobre accordion. Override explícito de BR-07-01 que decía "sections not tabs".

### Mobile (< 1024px)

```
AppShell (sidebar-width: 0)
└── app-content
    ├── app-topbar (48px sticky) — hamburger + "Ajustes"
    ├── s8-seg-wrap (sticky top-[48px], hidden ≥ 1024px)
    │   └── s8-seg-ctrl (segmented control: Perfil · Cuenta · Prefs)
    └── page-body (px-4 py-4) — pane activo vía is-active
```

Sticky a `top: 48px`, oculto ≥ 1024px via `@media (min-width: 1024px) { .s8-seg-wrap { display: none } }`. El sidebar desktop y el segmented control mobile comparten el mismo handler `[data-settings-tab]` / `[data-settings-pane]`.

## 2. Anchors del demo

| Anchor                                  | Descripción                                                                         | Viewport      |
| --------------------------------------- | ----------------------------------------------------------------------------------- | ------------- |
| `#settings`                             | Perfil tab activa, estado base con `vinyl_hunter`                                   | desktop       |
| `#s8-settings-desktop-account`          | Cuenta tab activa: email + contraseña                                               | desktop       |
| `#s8-settings-desktop-preferences`      | Preferencias tab activa: Interfaz + Coleccionista                                   | desktop       |
| `#s8-settings-modal-username`           | Modal cambiar username (FR-07-33 cooldown chip)                                     | desktop modal |
| `#s8-settings-modal-displayname`        | Modal cambiar nombre visible (maxlength 50, char counter)                           | desktop modal |
| `#s8-settings-modal-avatar`             | Modal subir foto (dropzone, botón "Recortar y confirmar" deshabilitado si vacío)    | desktop modal |
| `#s8-settings-modal-avatar-remove`      | Modal eliminar foto (tone-destructive, "inicial V se usará")                        | desktop modal |
| `#s8-settings-modal-email`              | Modal cambiar email (email nuevo + password actual, tone-warning)                   | desktop modal |
| `#s8-settings-modal-password`           | Modal cambiar contraseña (actual + nueva + confirmar)                               | desktop modal |
| `#s8-settings-modal-currency`           | Modal cambiar moneda base — FR-07-32 two-path footer (tone-warning)                 | desktop modal |
| `#s8-settings-profile-mobile`           | Phone frame: segmented Perfil active, profile card                                  | mobile        |
| `#s8-settings-account-mobile`           | Phone frame: segmented Cuenta active, account card                                  | mobile        |
| `#s8-settings-preferences-mobile`       | Phone frame: segmented Prefs active, Interfaz + Coleccionista cards + cerrar sesión | mobile        |
| `#s8-settings-username-sheet-mobile`    | Bottom sheet: @ prefix input, cooldown chip                                         | mobile sheet  |
| `#s8-settings-displayname-sheet-mobile` | Bottom sheet: name input, char counter                                              | mobile sheet  |
| `#s8-settings-avatar-sheet-mobile`      | Bottom sheet: avatar V preview, picker rows (subir / eliminar)                      | mobile sheet  |
| `#s8-settings-currency-sheet-mobile`    | Bottom sheet: currency picker + warning + FR-07-32 two-path footer (vertical)       | mobile sheet  |

## 3. Secciones del pane

Cada card consume el patrón Chip Eyebrow + Top-Accent (PLAYBOOK §9.17) con tono dedicado:

| Card          | Tono              | Eyebrow chip            | Top border 2px   |
| ------------- | ----------------- | ----------------------- | ---------------- |
| Perfil        | `accent` (purple) | `<user>` Perfil         | `s8-card-accent` |
| Cuenta        | `cool` (teal)     | `<shield>` Cuenta       | `s8-card-cool`   |
| Interfaz      | `cool` (teal)     | `<monitor>` Interfaz    | `s8-card-cool`   |
| Coleccionista | `warm` (coral)    | `<heart>` Coleccionista | `s8-card-warm`   |

### 3.1 Perfil — Tu identidad pública

| Fila              | Valor demo      | CTA / Flujo                                                        |
| ----------------- | --------------- | ------------------------------------------------------------------ |
| Avatar            | Inicial "V"     | "Subir foto" → `modal-avatar` / "Eliminar" → `modal-avatar-remove` |
| Nombre de usuario | `@vinyl_hunter` | "Cambiar" → `modal-username` (FR-07-33 cooldown visible)           |
| Nombre visible    | "Vinyl Hunter"  | "Cambiar" → `modal-displayname` (maxlength 50)                     |

**Avatar fallback:** clase `s8-avatar-hero` — 56×56 circular con `linear-gradient(135deg, --accent → --accent-warm)` + glow shadow + texto blanco. Aplica también en mobile (Perfil card) y en sheet de avatar (preview).

**Cooldown note (FR-07-33):** debajo del username el hint se renderiza como `s8-cooldown-chip` — pill con `--warning` tint 12% + ícono `clock-3`. Copy: "Próximo cambio en {days} días." Cuando expira el cooldown el chip desaparece (NO se muestra permanentemente). El modal repite el chip en el cuerpo con la fecha exacta ("Próximo cambio: 22 may 2026").

### 3.2 Cuenta — Email, contraseña y acceso

| Fila       | Valor demo                           | CTA / Flujo                                             |
| ---------- | ------------------------------------ | ------------------------------------------------------- |
| Email      | `vinyl@pandatrack.dev`               | chip `success` "Verificado" + "Cambiar" → `modal-email` |
| Contraseña | "Última actualización hace 3 meses." | "Cambiar" → `modal-password`                            |

**No incluye:**

- ❌ Toggle MFA — se pospone a S9+.
- ❌ Fila "Sesiones activas" — removida del pane en S8 Fase A (decisión usuario, 2026-05-18). La capability sigue disponible en backend; reintroducir cuando exista UX dedicada para gestión multi-dispositivo.

### 3.3 Preferencias — Interfaz + Coleccionista

**Card Interfaz** (tono `cool`, eyebrow `<monitor>` Interfaz):

| Fila   | Valor demo                      | Control                                                     |
| ------ | ------------------------------- | ----------------------------------------------------------- |
| Tema   | "Light, dark o el del sistema." | Segmented buttons Light / Dark / Sistema (default: Sistema) |
| Idioma | "Cómo se muestran los textos."  | Segmented buttons Español / English (default: Español)      |

**Renames vs S2:**

- ❌ Card "Apariencia" → ✅ "Interfaz" (ícono `monitor`) — el alcance ahora incluye idioma además del tema, "Apariencia" se sentía limitado a estética.
- ❌ "Tema y densidad" → ✅ "Tema e idioma".
- ❌ Fila "Densidad de listas" — removida del scope S8 (decisión usuario, 2026-05-18). FR-07-31 queda postergado hasta que se valide la necesidad real con usuarios reales.

**Card Coleccionista** (tono `warm`, eyebrow `<heart>` Coleccionista):

| Fila                 | Valor demo                                                         | CTA / Flujo                                      |
| -------------------- | ------------------------------------------------------------------ | ------------------------------------------------ |
| País                 | "Argentina · AR"                                                   | "Cambiar" (no modal en este release — inline)    |
| Moneda base          | "USD · Aplicada a totales y resúmenes."                            | "Cambiar" → `modal-currency` (FR-07-32 two-path) |
| Categorías favoritas | Chips multi-select Vinyl / Manga / Figuras / Anime / Cards / Plush | Toggle inline (active: tint accent 10%)          |
| Presupuesto mensual  | `$300,00` + reset día `01`                                         | Inline edit (input numérico + select día 1–31)   |

**Mobile extra:** botón "Cerrar sesión" al pie de Preferencias en mobile (ghost destructive, full width). Desktop no lo muestra — la sesión se cierra desde el menú de usuario del sidebar.

## 4. Flujo FR-07-32 — Cambiar moneda base (two-path)

El cambio de moneda base NO convierte datos históricos. El flujo requiere confirmación explícita sobre qué hacer con los tipos de cambio existentes.

### Desktop — Modal centrado (`#s8-settings-modal-currency`, tone-warning)

Footer de 3 botones horizontales:

1. `btn ghost` "Cancelar" — cierra sin cambios.
2. `btn tonal` "Guardar sin actualizar" — cambia moneda base, preserva FX rates existentes.
3. `btn primary` "Guardar y actualizar tipos de cambio" — cambia moneda base + re-fetches FX rates para pedidos elegibles del mes actual.

### Mobile — Bottom sheet (`#s8-settings-currency-sheet-mobile`, max-height 88svh)

Footer vertical (mobile UX: acción principal primero, secundaria debajo):

1. `btn primary` full-width "Guardar y actualizar tipos de cambio".
2. `btn ghost` full-width "Guardar sin actualizar".

Ambas versiones incluyen el warning box: "Cambiar la moneda base **no convierte** tus pedidos anteriores. Los totales históricos seguirán en su moneda original hasta que los actualicés manualmente."

## 5. Modal pattern (desktop) y Sheet pattern (mobile)

**Desktop:** todos los sub-flujos usan el patrón `m01b` (ADR 0008 canónico):

- `m01b-icon-circle` con tone semántico + `m01b-header` + `m01b-body` + `m01b-footer`.
- Tones: `tone-default` (username, displayname, avatar-upload, password), `tone-warning` (email, currency), `tone-destructive` (avatar-remove).
- **Uplift S8:** el `icon-circle` lleva además `s8-modal-icon-gradient` (radial gradient `color-mix` del token tonal 10→28%) para reforzar la jerarquía visual.
- Cierre: botón X + backdrop click + Esc.

**Mobile:** todos los sub-flujos usan `s7-mob-sheet` (bottom sheet canónico de S7):

- `s7-mob-sheet-handle` + título + `s7-mob-sheet-body` (scrollable) + `s7-mob-sheet-footer`.
- Backdrop `s7-mob-backdrop` semitransparente con blur.

## 6. Tokens invocados

| Token                         | Uso                                                                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `--surface`                   | Page bg, segmented control wrap, section cards base                                                                                       |
| `--surface-elevated`          | Segmented control pill bg, modales, bottom sheets                                                                                         |
| `--border`                    | Divisores entre filas, borde de currency rows idle                                                                                        |
| `--border-strong`             | Borde de inputs, drag handle, segmented control                                                                                           |
| `--text-primary`              | Valores de cada fila, título de sección                                                                                                   |
| `--text-secondary`            | Labels de fila, subtítulos                                                                                                                |
| `--text-muted`                | Char counter, hints neutros                                                                                                               |
| `--accent`                    | Tab activa (bg 12% + color), segmented btn activo, CTA primario, eyebrow chip default, top-border `s8-card-accent`, avatar gradient start |
| `--accent-cool`               | Eyebrow chip Cuenta/Interfaz, top-border `s8-card-cool`                                                                                   |
| `--accent-warm`               | Eyebrow chip Coleccionista, top-border `s8-card-warm`, avatar gradient end                                                                |
| `--success`                   | Chip "Verificado" del email                                                                                                               |
| `--warning`                   | `s8-cooldown-chip` (FR-07-33), tone-warning de email/currency modal, warning box bg/border                                                |
| `--destructive`               | Botón "Eliminar foto", tone-destructive del avatar-remove modal, "Cerrar sesión" mobile                                                   |
| `color-mix(--accent 8%, ...)` | Currency row seleccionada bg, segmented control btn activo bg                                                                             |

## 7. Interacciones y accesibilidad

- **Tablist:** `role="tablist"` en sidebar nav y segmented control. Buttons `role="tab"` + `aria-selected`. Panes `role="tabpanel"` + `aria-labelledby`. Sync via `[data-settings-tab]` + `[data-settings-pane]`.
- **Keyboard nav:** flechas arriba/abajo navegan entre tabs del sidebar desktop; flechas izquierda/derecha entre botones del segmented mobile.
- **Inputs:** labels explícitos `for` / `id`. Input username con prefix "@" usando `input-prefix` span. Char counter conectado via `aria-describedby`.
- **Modales:** focus trap, cierre con Esc, focus return al CTA que abrió el modal.
- **Botones "Cambiar":** `aria-label="Cambiar {campo}"` para contexto fuera de label visual.
- **Cooldown:** cuando el `Guardar` del modal está deshabilitado por cooldown, debe tener `aria-disabled="true"` + tooltip explicativo accesible.

## 8. i18n — voice samples (es)

| Clave                                          | Valor                                                                                                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `settings.title`                               | "Ajustes"                                                                                                                                                     |
| `settings.tabs.profile`                        | "Perfil"                                                                                                                                                      |
| `settings.tabs.account`                        | "Cuenta"                                                                                                                                                      |
| `settings.tabs.preferences`                    | "Preferencias"                                                                                                                                                |
| `settings.profile.title`                       | "Tu identidad pública"                                                                                                                                        |
| `settings.profile.subtitle`                    | "Así te ven los demás en la app."                                                                                                                             |
| `settings.profile.username.cooldown.chip`      | "Próximo cambio en {days} días."                                                                                                                              |
| `settings.profile.username.modal.subtitle`     | "El cambio es posible cada 7 días · quedan {days} días"                                                                                                       |
| `settings.profile.username.modal.cooldownChip` | "Próximo cambio: {date}"                                                                                                                                      |
| `settings.account.title`                       | "Email, contraseña y acceso"                                                                                                                                  |
| `settings.account.subtitle`                    | "Los cambios sensibles requieren tu contraseña actual."                                                                                                       |
| `settings.account.email.verified`              | "Verificado"                                                                                                                                                  |
| `settings.preferences.interfaz.title`          | "Tema e idioma"                                                                                                                                               |
| `settings.preferences.interfaz.subtitle`       | "Los cambios son inmediatos."                                                                                                                                 |
| `settings.preferences.interfaz.theme.helper`   | "Light, dark o el del sistema."                                                                                                                               |
| `settings.preferences.interfaz.lang.helper`    | "Cómo se muestran los textos."                                                                                                                                |
| `settings.preferences.collector.title`         | "País, moneda y categorías"                                                                                                                                   |
| `settings.preferences.collector.subtitle`      | "Cambiar la moneda base no convierte tus datos anteriores."                                                                                                   |
| `settings.preferences.currency.warning`        | "Cambiar la moneda base **no convierte** tus pedidos anteriores. Los totales históricos seguirán en su moneda original hasta que los actualicés manualmente." |
| `settings.preferences.currency.saveAndUpdate`  | "Guardar y actualizar tipos de cambio"                                                                                                                        |
| `settings.preferences.currency.saveWithout`    | "Guardar sin actualizar"                                                                                                                                      |
| `settings.preferences.signOut.mobile`          | "Cerrar sesión"                                                                                                                                               |

EN locale: aplicar las mismas claves con copy traducido neutro (no AmE/BrE idiomas, mantener lenguaje claro y conversacional como en `principles.md` §7).

## 9. Pendientes (A.2 → Fase B)

- [ ] Validaciones inline del username (debounced availability) — estados `checking / available / taken / cooldown`. Copy ya definido en FRD-07.
- [ ] Avatar upload + crop — interacción dentro del modal (dropzone → preview → crop circular → confirm). El demo muestra el dropzone vacío; falta especificar el flujo del cropper.
- [ ] Email verification flow post-cambio — toast persistente "Te enviamos un link a {newEmail}" + helper info inline.
- [ ] Password rules inline (longitud / mayúsculas / números) — pendiente confirmar reglas con BetterAuth.
- [ ] Theme + density toggles — interacción optimista (cambio inmediato en `localStorage`, persist async via Server Action).
- [ ] Idioma toggle — flow real (next-intl locale switch + redirect a ruta localizada).
- [ ] Categories multi-select — chip toggle states (idle vs active) + Server Action de update.
- [ ] Budget field — input monetario con `font-variant-numeric: tabular-nums` + select día 1–31, Server Action.
- [ ] Mascot toggle — pendiente confirmación de ubicación (ADR 0001 D17 dice Preferencias, falta demo).
- [ ] Motion: tab-switch cross-fade 150ms, modal enter scale 0.96→1 + backdrop fade, `prefers-reduced-motion` fallback.
