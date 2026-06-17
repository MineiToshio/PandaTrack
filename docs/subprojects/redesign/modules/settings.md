---
title: Módulo Settings — S8
session: 08
phase: A
status: spec-complete
last_updated: 2026-05-18
screens:
  - docs/redesign/screens/settings.md
frd: docs/product/prd-01-collector-mvp/frd-07-user-account-settings/frd-07-user-account-settings.md
---

# Módulo Settings — S8

## Resumen ejecutivo

Doc maestro de la Fase A del módulo Settings (S8). El screen spec en `docs/redesign/screens/settings.md` describe el contrato funcional por pantalla y sección. Este doc define pantallas, funcionalidades preservadas del FRD-07, cambios visuales aprobados, propuestas pendientes, y el handoff a Fase B.

**Demo de referencia:** `docs/redesign/_notes/demo-screens.html` — grupo de anchors `S8 · Ajustes` (17 anchors: 3 desktop + 7 modales desktop + 7 mobile).

**Hito visual:** S8 originó el patrón **Chip Eyebrow + Top-Accent border** documentado en `docs/redesign/PLAYBOOK.md §9.17`. El patrón se extendió en S8 Fase B a `order-detail` y `store-detail`. Settings es el origen y la referencia canónica.

**Specs:**

| Spec                  | Estado        | Fecha      |
| --------------------- | ------------- | ---------- |
| `screens/settings.md` | spec-complete | 2026-05-18 |

---

## Pantallas del módulo

| Anchor(s)                               | Descripción                                                             |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `#settings`                             | Desktop · Perfil tab — avatar V, @vinyl_hunter, Vinyl Hunter            |
| `#s8-settings-desktop-account`          | Desktop · Cuenta tab — email verificado + contraseña                    |
| `#s8-settings-desktop-preferences`      | Desktop · Preferencias tab — Interfaz + Coleccionista                   |
| `#s8-settings-modal-username`           | Modal username (FR-07-33: @ prefix, cooldown chip)                      |
| `#s8-settings-modal-displayname`        | Modal display name (maxlength 50, char counter)                         |
| `#s8-settings-modal-avatar`             | Modal subir foto (dropzone, crop deshabilitado si vacío)                |
| `#s8-settings-modal-avatar-remove`      | Modal eliminar foto (tone-destructive)                                  |
| `#s8-settings-modal-email`              | Modal cambiar email (tone-warning, email nuevo + password actual)       |
| `#s8-settings-modal-password`           | Modal cambiar contraseña (actual + nueva + confirmar)                   |
| `#s8-settings-modal-currency`           | Modal cambiar moneda base (FR-07-32 two-path, tone-warning)             |
| `#s8-settings-profile-mobile`           | Mobile · phone frame · segmented Perfil activo                          |
| `#s8-settings-account-mobile`           | Mobile · phone frame · segmented Cuenta activo                          |
| `#s8-settings-preferences-mobile`       | Mobile · phone frame · segmented Prefs activo + cerrar sesión           |
| `#s8-settings-username-sheet-mobile`    | Mobile · bottom sheet · username                                        |
| `#s8-settings-displayname-sheet-mobile` | Mobile · bottom sheet · nombre visible                                  |
| `#s8-settings-avatar-sheet-mobile`      | Mobile · bottom sheet · avatar                                          |
| `#s8-settings-currency-sheet-mobile`    | Mobile · bottom sheet · moneda base (FR-07-32 vertical two-path footer) |

---

## Funcionalidades preservadas (mapeadas al FRD-07)

| FR         | Descripción                                                                                    | Pantalla(s)                                     | Nota                                              |
| ---------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------- |
| `FR-07-01` | El usuario puede editar su `displayName` (max 50 chars)                                        | `modal-displayname`, `displayname-sheet-mobile` | —                                                 |
| `FR-07-02` | El usuario puede editar su `username` (unique, regex, blocked words)                           | `modal-username`, `username-sheet-mobile`       | —                                                 |
| `FR-07-03` | Validación debounced de disponibilidad de username (300ms)                                     | `modal-username`                                | PENDING — no representado aún en demo S8          |
| `FR-07-04` | Avatar: upload + crop circular                                                                 | `modal-avatar`, `avatar-sheet-mobile`           | Crop pendiente de spec en A.3                     |
| `FR-07-05` | Avatar fallback: inicial del displayName sobre tinte accent                                    | `#settings`, todos los mobile                   | Inicial "V" con gradient `s8-avatar-hero`         |
| `FR-07-06` | El usuario puede eliminar su avatar (vuelve a fallback inicial)                                | `modal-avatar-remove`                           | tone-destructive                                  |
| `FR-07-10` | El usuario puede cambiar su email (requiere password actual + verificación en nuevo email)     | `modal-email`                                   | tone-warning, flow post-cambio en pending         |
| `FR-07-11` | El usuario puede cambiar su password                                                           | `modal-password`                                | actual + nueva + confirmar                        |
| `FR-07-20` | Preferencias: `preferredCountryCode`                                                           | Pane Preferencias                               | Argentina · AR en demo; modal en A.3              |
| `FR-07-21` | Preferencias: `baseCurrencyCode` — cambio dispara flujo de confirmación                        | `modal-currency`, `currency-sheet-mobile`       | FR-07-32 two-path (ver §Cambios)                  |
| `FR-07-22` | Preferencias: `preferredProductTypeKeys` multi-select                                          | Pane Preferencias (chips)                       | Vinyl / Manga / Figuras / Anime / Cards / Plush   |
| `FR-07-23` | Preferencias: `preferredLanguageCode` (ES / EN)                                                | Card Interfaz                                   | **Promovido a UI explícita en S8** — ver §Cambios |
| `FR-07-24` | Preferencias: `budgetAmount` + `budgetResetDayOfMonth`                                         | Card Coleccionista                              | Input monetario + select día 1–31                 |
| `FR-07-30` | Preferencias: tema `light / dark / system` (ADR 0001 D14)                                      | Card Interfaz                                   | Segmented 3 opciones                              |
| `FR-07-32` | Currency change: two-path — "Guardar y actualizar tipos de cambio" vs "Guardar sin actualizar" | `modal-currency`, `currency-sheet-mobile`       | **Ver §Cambios de comportamiento**                |
| `FR-07-33` | Username cooldown de 7 días entre cambios                                                      | `modal-username`, `username-sheet-mobile`       | **Ver §Cambios de comportamiento**                |

---

## Funcionalidades fuera de scope S8 (postponed)

| FR            | Descripción                                                | Razón / Reemplazo                                                                                                                             |
| ------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `FR-07-31`    | Preferencias: densidad de listas `dense / comfortable`     | **Removida del scope S8 (2026-05-18).** Pendiente validar necesidad real con usuarios. Recuperar en S9+ si emerge la demanda.                 |
| `FR-07-40`    | Sesiones activas visibles + acción "Cerrar otras sesiones" | **Removida del pane Cuenta en S8 (2026-05-18).** La capability sigue en BetterAuth; reintroducir cuando exista UX dedicada multi-dispositivo. |
| MFA toggle    | Activación de segundo factor                               | Postponed a S9+. Flow completo (QR + verificación) requiere doc propio.                                                                       |
| Mascot toggle | Toggle "Mostrar mascota" (ADR 0001 D17)                    | Pending visual demo. Vive en card Coleccionista o Interfaz — definir en A.3.                                                                  |

---

## Cambios de comportamiento

### FR-07-32 — Currency change two-path (aprobado S8 Fase A)

El spec S2 original describía un único CTA "Confirmar cambio". S8 Fase A aprobó el patrón **two-path**:

- **Path A** — "Guardar y actualizar tipos de cambio": cambia la moneda base Y re-fetches los FX rates vigentes para todos los pedidos elegibles del mes actual. Es la acción más común para un cambio deliberado.
- **Path B** — "Guardar sin actualizar": cambia solo la preferencia de moneda. Los FX rates de pedidos existentes permanecen sin cambios. Útil cuando el usuario solo quiere cambiar la moneda de display.

**Desktop:** footer 3 botones horizontales (Cancelar / Guardar sin actualizar / Guardar y actualizar).
**Mobile:** footer vertical stacked (primario arriba, ghost debajo) — convención mobile estándar.

Ambos caminos muestran el warning box sobre datos históricos no convertidos.

### FR-07-33 — Username cooldown (7 días, antes 30 días)

Spec S2 documentaba cooldown de 30 días. S8 Fase A adoptó **7 días** (alineado al FRD-07 vigente). Comunicación en tres puntos:

1. Hint visible en pane Perfil bajo el username: chip `s8-cooldown-chip` con copy "Próximo cambio en N días."
2. Subtítulo del modal/sheet: "El cambio es posible cada 7 días · quedan N días"
3. Chip inline en cuerpo del modal: "Próximo cambio: DD mes YYYY" (fecha exacta)

Cuando el cooldown expira el chip **desaparece** (ADR 0001 D18) — NO se mantiene permanentemente.

El botón "Guardar" del modal permanece deshabilitado mientras el cooldown esté activo (`aria-disabled="true"`).

### FR-07-23 — Idioma promovido a UI explícita (S8 Fase A)

FRD-07 declaraba `preferredLanguageCode` como preferencia almacenada. S8 lo promueve a **control visible** en la card Interfaz junto al tema. Justificación: el usuario coleccionista latam alterna entre ES (nativo) y EN (catálogos internacionales de productos) y quería un toggle visible sin tener que navegar a settings de browser.

Rename del card: "Apariencia" (S2) → **"Interfaz"** (S8). Ícono: `palette` (S2) → **`monitor`** (S8). El nuevo nombre abarca mejor "tema + idioma + futuras opciones de presentación".

### ADR 0001 D15 — Tabs verticales desktop (override BR-07-01)

FRD-07 BR-07-01 especificaba "sections not tabs" para desktop. ADR 0001 D15 aprobó explícitamente **tabs verticales (220px)** como override. Justificación: el patrón Vercel/Linear/Stripe es el modelo mental del usuario target; secciones como accordion generan friction con ≥ 3 grupos de campos.

### Segmented control mobile (nuevo en S8)

Spec S2 no documentaba navegación mobile interna. S8 adopta el **segmented control** (3 botones en pill-container, sticky bajo topbar) como patrón iOS/Android-native equivalente al tab switcher. Oculto ≥ 1024px. JS handler unificado `[data-settings-tab]` sincroniza sidebar desktop + segmented mobile.

### Patrón visual Chip Eyebrow + Top-Accent (S8 origen → cross-module)

S8 originó el patrón documentado en `PLAYBOOK.md §9.17`. Asignación de tonos por card:

| Card          | Tono              | Eyebrow chip            |
| ------------- | ----------------- | ----------------------- |
| Perfil        | `accent` (purple) | `<user>` Perfil         |
| Cuenta        | `cool` (teal)     | `<shield>` Cuenta       |
| Interfaz      | `cool` (teal)     | `<monitor>` Interfaz    |
| Coleccionista | `warm` (coral)    | `<heart>` Coleccionista |

El patrón se extendió a `order-detail` y `store-detail` en S8 Fase B (ver PLAYBOOK §9.17 para tabla cross-module completa).

### Avatar hero gradient (S8)

El avatar fallback de letra inicial usa `s8-avatar-hero` — circular 56×56 con `linear-gradient(135deg, --accent → --accent-warm)` + glow shadow + texto blanco. Aplica en pane Perfil (desktop + mobile) y sheet de avatar (preview "Foto actual").

### Cooldown chip (S8)

El hint "Próximo cambio en N días." se renderiza como pill `s8-cooldown-chip` con `--warning` tint 12% + ícono `clock-3`. Más presencia visual que texto muted plano, comunica restricción temporal sin alarmar.

### Modal icon-circle gradient (S8)

Todos los `m01b-icon-circle` de modales S8 llevan además clase `s8-modal-icon-gradient` con radial gradient `color-mix` del token tonal (10→28%). Refuerza la jerarquía visual del header del modal sin romper el patrón m01b canónico.

---

## Propuestas resueltas (decisión humana 2026-05-19)

Todas las propuestas listadas como `⏳ pendiente` quedan resueltas antes de iniciar Fase B. La decisión consolidada está abajo:

| ID      | Propuesta                                                              | Decisión final (2026-05-19)                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-S8-01 | Documentar FR-07-32 two-path en FRD-07 como canónico                   | ✅ aprobado — FR-07-32 two-path (cambio de moneda con `saveFxRates: boolean`) queda canónico. Fase B implementa `CurrencyModal` con footer two-path + server action `updateCurrency({ saveFxRates })`. FRD-07 se actualiza en sesión dedicada post-Fase B (no bloquea).                                                                                                                                                                                                       |
| P-S8-02 | Documentar FR-07-23 (idioma) como control visible en Interfaz          | ✅ aprobado — Idioma queda visible como control del card "Interfaz" junto a Tema. UX consistente con el toggle de Tema. FRD-07 se actualiza post-Fase B (no bloquea).                                                                                                                                                                                                                                                                                                         |
| P-S8-03 | Marcar FR-07-31 (densidad) como **deferred** en FRD-07                 | ✅ aprobado — diferido. No entra en S8 Fase B.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| P-S8-04 | Marcar FR-07-40 (sesiones activas visible) como **deferred** en FRD-07 | ✅ aprobado — diferido. Account pane queda sin sección "Sesiones activas". Capability backend sigue activa.                                                                                                                                                                                                                                                                                                                                                                   |
| P-S8-05 | Mascot toggle (ADR 0001 D17): demostrar visualmente en demo HTML       | ⏳ no bloquea Fase B — visual-only, queda como tarea decorativa post-implementación.                                                                                                                                                                                                                                                                                                                                                                                          |
| P-S8-06 | MFA flow completo (QR + verificación)                                  | ✅ diferido — mover a S9+ con doc propio. Fuera de scope S8.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| P-S8-07 | Avatar cropper UX (drag + zoom + circular preview)                     | ✅ aprobado — el cropper del `AvatarModal` debe ser **exactamente igual al de `StoreLogoField`** (`src/app/[locale]/(app)/stores/_components/share/StoreLogoField/StoreLogoField.tsx`): drag para reposicionar + zoom con slider + preview circular + crop final. Reusar la lógica de cropper de tienda; adaptar a circular preview en lugar de cuadrado. Verificar si conviene extraer `<ImageCropper>` a `src/components/modules/` como componente compartido en esta fase. |
| P-S8-08 | Password rules display (longitud / mayúsculas / números)               | ✅ aprobado — `PasswordModal` muestra inline las reglas (mínimo 8 caracteres, al menos 1 mayúscula, al menos 1 número) con check verde por regla al cumplirse. Confirmar con BetterAuth las reglas reales aplicadas; si difieren, ajustar el display.                                                                                                                                                                                                                         |

---

## Componentes propios del módulo (Fase B)

| Componente / clase demo | CSS / clase                                           | Descripción                                                                            | Candidato React                                          |
| ----------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------- | --- | ----- |
| Segmented control       | `.s8-seg-wrap` / `.s8-seg-ctrl` / `.s8-seg-btn`       | Sticky tab switcher mobile. `is-active` con accent tint.                               | `<SettingsSegmentedControl />`                           |
| Eyebrow chip            | `.s8-eyebrow-chip` + `tone-*`                         | Pill tintada con ícono + texto uppercase. Cross-module via `<Eyebrow variant="chip">`. | Reutilizar `<Eyebrow>` core                              |
| Top-accent card         | `.s8-card-accent` / `.s8-card-cool` / `.s8-card-warm` | Top border 2px tintado coordinado con eyebrow.                                         | Prop `topAccent` en `<SectionCard>`                      |
| Avatar hero gradient    | `.s8-avatar-hero` (s40 / default 56 / s72)            | Circular con gradient `--accent → --accent-warm` + glow shadow.                        | `<UserAvatarHero size={40                                | 56  | 72}>` |
| Cooldown chip           | `.s8-cooldown-chip`                                   | Pill warning tint + clock-3 icon.                                                      | `<CooldownChip days={N}>` o `<CooldownChip date="..."/>` |
| Modal icon gradient     | `.s8-modal-icon-gradient` + `tone-*`                  | Radial gradient sobre el `m01b-icon-circle`. Aplicar como prop opcional al Modal.      | Prop `iconGradient` en `<Modal>`                         |
| Currency picker row     | `.s8-currency-row` + `.is-selected`                   | Row clickeable con code + name + check accent.                                         | Reutilizar pattern `s7-mob-picker-row`                   |
| Modal warning box       | `.s8-modal-warning`                                   | Warning inline con bg/border `--warning` tinted + icono `triangle-alert`.              | Reutilizar patrón `<AlertInline tone="warning">`         |
| Avatar dropzone         | `.s8-avatar-dropzone`                                 | Drop target dashed border + ícono + copy.                                              | `<AvatarDropzone>`                                       |

---

## Handoff a Fase B

### Archivos React a crear / modificar

| Archivo                                                               | Acción     | Descripción                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/[locale]/(app)/settings/page.tsx`                            | Refactor   | Eliminar `AppPageHero`, adoptar layout `settings-nav` + `settings-pane`                                                                                                                                                                                    |
| `src/app/[locale]/(app)/settings/_components/SettingsNav.tsx`         | Crear      | Sidebar vertical tabs (desktop) + segmented control (mobile), JS unificado                                                                                                                                                                                 |
| `src/app/[locale]/(app)/settings/_components/SettingsProfilePane.tsx` | Refactor   | Rows: Avatar (hero gradient), Username (cooldown chip), DisplayName                                                                                                                                                                                        |
| `src/app/[locale]/(app)/settings/_components/SettingsAccountPane.tsx` | Refactor   | Rows: Email (chip Verificado), Password. SIN sesiones activas.                                                                                                                                                                                             |
| `src/app/[locale]/(app)/settings/_components/SettingsPrefsPane.tsx`   | Refactor   | Cards: Interfaz (Tema + Idioma) + Coleccionista. SIN densidad.                                                                                                                                                                                             |
| `src/app/[locale]/(app)/settings/_components/UsernameModal.tsx`       | Crear      | m01b tone-default + FR-07-33 cooldown logic + chip                                                                                                                                                                                                         |
| `src/app/[locale]/(app)/settings/_components/DisplayNameModal.tsx`    | Crear      | m01b tone-default, maxlength 50 + char counter                                                                                                                                                                                                             |
| `src/app/[locale]/(app)/settings/_components/AvatarModal.tsx`         | Crear      | m01b tone-default, dropzone + crop circular                                                                                                                                                                                                                |
| `src/app/[locale]/(app)/settings/_components/AvatarRemoveModal.tsx`   | Crear      | m01b tone-destructive                                                                                                                                                                                                                                      |
| `src/app/[locale]/(app)/settings/_components/EmailModal.tsx`          | Crear      | m01b tone-warning                                                                                                                                                                                                                                          |
| `src/app/[locale]/(app)/settings/_components/PasswordModal.tsx`       | Crear      | m01b tone-default                                                                                                                                                                                                                                          |
| `src/app/[locale]/(app)/settings/_components/CurrencyModal.tsx`       | Crear      | m01b tone-warning + FR-07-32 two-path footer                                                                                                                                                                                                               |
| `src/app/[locale]/(app)/settings/_components/UserAvatarHero.tsx`      | Crear      | Componente reutilizable (s40 / s56 / s72) con gradient                                                                                                                                                                                                     |
| `src/app/[locale]/(app)/settings/_components/CooldownChip.tsx`        | Crear      | Componente reutilizable (acepta `days` o `date`)                                                                                                                                                                                                           |
| `src/app/[locale]/(app)/settings/_actions/`                           | Crear      | Server Actions: `updateUsername`, `updateDisplayName`, `updateAvatar`, `deleteAvatar`, `updateEmail`, `updatePassword`, `updateLanguage`, `updateCurrency` (con `saveFxRates: boolean` para FR-07-32), `updateCountry`, `updateCategories`, `updateBudget` |
| `src/components/core/Eyebrow.tsx`                                     | Extender   | Agregar `variant="chip"` + `tone="..."` + `icon={LucideIcon}` per PLAYBOOK §9.17                                                                                                                                                                           |
| `src/components/modules/SectionCard.tsx`                              | Extender   | Agregar prop `topAccent="..."` per PLAYBOOK §9.17                                                                                                                                                                                                          |
| `src/i18n/locales/es/settings.json`                                   | Actualizar | Nuevas claves S8 (ver §8 del screen spec)                                                                                                                                                                                                                  |
| `src/i18n/locales/en/settings.json`                                   | Actualizar | Traducción EN de las nuevas claves                                                                                                                                                                                                                         |

### Prerequisitos de Fase B

1. ✅ Aprobación visual del demo S8 (completado por Sergio en 2026-05-18).
2. ✅ Propuestas P-S8-01 a P-S8-08 resueltas (decisión humana 2026-05-19, ver tabla "Propuestas resueltas" arriba). Actualización del FRD-07 con P-S8-01/02/03/04 se ejecuta en sesión dedicada post-Fase B (no bloquea).
3. ✅ ADR 0001 D14–D19 vigentes.
4. ✅ Patrón Chip Eyebrow + Top-Accent documentado en PLAYBOOK §9.17 e implementado cross-app en M07 (orders + stores + componentes core).
5. ✅ Avatar cropper definido (P-S8-07): reusar lógica de `StoreLogoField` adaptada a preview circular; evaluar extracción a `<ImageCropper>` compartido durante Fase B.
6. ✅ Password rules display definido (P-S8-08): inline en `PasswordModal` con check verde por regla cumplida; reglas a confirmar contra BetterAuth.

### Validación obligatoria al cerrar Fase B

Ver PLAYBOOK §6 ("Cómo verificar tu propio output") + §9.17 ("Verificación post-implementación") + `.cursor/rules/validation-checklist.mdc`. Mínimo:

- `npm run test`, `npm run type-check`, `npm run lint`, `npm run validate-build`.
- `npm run test:e2e` para flow de cambio de moneda (FR-07-32 critical workflow).
- Verificación visual en preview de los 17 anchors S8 — light + dark theme.
- Verificar cooldown chip vivo (mock con date < 7 días) y expirado (chip oculto).
- Verificar que el patrón cross-module sigue consistente: "Acciones" en order-detail, store-detail Y settings se ven con el mismo tono+ícono.
