---
title: Sesión 08 — Módulo Settings (Fase A — demo + specs + color uplift)
date: 2026-05-18
status: ✅ done (A.1 + A.2 + uplift visual)
type: Módulo Fase A
---

## Qué corrió

S8 Fase A construyó el módulo lite **Settings**: 1 ruta (`/settings`) con 3 paneles (Perfil / Cuenta / Preferencias), 7 modales desktop, 7 sheets mobile y refactor del `#settings` original. El demo HTML, los specs maestros y el patrón visual cross-module **Chip Eyebrow + Top-Accent** quedaron cerrados en una sola sesión continua.

## Entregables

### Demo HTML — 17 anchors nuevos + #settings refactoreado

`docs/redesign/_notes/demo-screens.html`:

- **Desktop (3):** `#settings` (refactor), `#s8-settings-desktop-account`, `#s8-settings-desktop-preferences`.
- **Modales desktop (7):** `username`, `displayname`, `avatar`, `avatar-remove`, `email`, `password`, `currency`.
- **Mobile (7):** `profile-mobile`, `account-mobile`, `preferences-mobile`, `username-sheet-mobile`, `displayname-sheet-mobile`, `avatar-sheet-mobile`, `currency-sheet-mobile`.

Todos navegables vía dropdown `S8 · Ajustes` del demo navbar y vía hash directo.

### Specs

| Doc                                 | Estado          |
| ----------------------------------- | --------------- |
| `docs/redesign/screens/settings.md` | spec-complete   |
| `docs/redesign/modules/settings.md` | spec-complete   |
| `docs/redesign/PLAYBOOK.md §9.17`   | patrón canónico |

### Patrón visual nuevo (cross-module)

**Chip Eyebrow + Top-Accent border** — par visual coordinado por tono semántico:

- Eyebrow se renderiza como pill tintada (`color-mix` del token 9–14%) con ícono lucide leading.
- La card lleva `border-top: 2px solid color-mix(token 55%)` con el mismo token.
- Tonos: `accent` / `cool` / `warm` / `success` / `warning` / `destructive`.
- **Vocabulario cross-module congelado** — labels recurrentes (`Acciones`, `Tu nota privada`, `Reseñas`, `Productos`, `Historial`, `Pagos`, `Tu pedido · {curr}`, `Categorías`, `Canales de contacto`, `Direcciones`) tienen tono+ícono fijo en todo el redesign.

Implementación: clases CSS `s8-eyebrow-chip`, `s8-card-accent/cool/warm/success/warning/destructive` (extensión a state tonals: `success`, `warning`, `destructive` agregada en Fase B).

El patrón nació en Settings y se extendió a `order-detail` (×4 variantes) y `store-detail` (×3 variantes) en S8 Fase B uplift.

### Otros uplifts visuales S8

- **`s8-avatar-hero`** — avatar fallback de letra inicial con `linear-gradient(135deg, --accent → --accent-warm)` + glow shadow. Aplica en pane Perfil desktop, perfil mobile, sheet de avatar.
- **`s8-cooldown-chip`** — pill warning tint + ícono `clock-3` para FR-07-33 cooldown. Reemplaza texto muted plano en pane Perfil + modal + sheet.
- **`s8-modal-icon-gradient`** — radial gradient `color-mix` sobre todos los `m01b-icon-circle` de S8.

## Decisiones aprobadas

| Decisión                                               | Detalle                                                                                                   |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| ADR 0001 D15 vigente                                   | Tabs verticales 220px en desktop, override de BR-07-01 "sections not tabs"                                |
| Segmented control mobile                               | Patrón nuevo en S8: 3 botones sticky bajo topbar, oculto ≥ 1024px                                         |
| FR-07-32 two-path                                      | Modal/sheet currency: "Guardar y actualizar tipos de cambio" (primary) + "Guardar sin actualizar" (ghost) |
| FR-07-33 cooldown chip vivo                            | 7 días entre cambios; chip visible solo durante cooldown activo (ADR 0001 D18)                            |
| Card "Apariencia" → "Interfaz"                         | Rename + ícono `palette` → `monitor`. Scope ampliado a tema + idioma                                      |
| Densidad de listas → **deferred**                      | FR-07-31 removido del scope S8. Recuperar en S9+ si emerge necesidad                                      |
| Sesiones activas → **deferred**                        | FR-07-40 removido del pane Cuenta. Capability BetterAuth sigue activa pero sin UX dedicada                |
| Idioma promovido a control visible                     | FR-07-23 deja de ser preferencia silente; segmented Español / English en card Interfaz                    |
| Patrón Chip Eyebrow + Top-Accent canónico cross-module | PLAYBOOK §9.17                                                                                            |
| Avatar gradient `s8-avatar-hero`                       | Componente reutilizable s40 / s56 / s72                                                                   |

## Bugs encontrados durante la sesión (todos resueltos)

1. **IDs mobile con `-mobile-` en el medio** — selector CSS `section[id$="-mobile"]` no matcheaba. Renombré los 7 anchors a `s8-settings-{tab}-mobile`. Cubre L070.
2. **`showScreen` con NodeList stale** — `screens` capturado en script-time no incluía las secciones S8 (parseadas después del `<script>`). Fix: query dentro de `showScreen`. → Nueva lección **L073**.
3. **Secciones S8 fuera de `<main>`** — pegadas al final del body después de filter-drawer, panda-bubble y script. Renderizaban al final del documento con espacio en blanco arriba; íconos lucide saltaban después del paint inicial. Fix: mover bloque dentro de `<main>` con script Python. → Nueva lección **L072**.
4. **`@media (min-width: 768px)` desktop grid leaking en phone frame** — `settings-row` aplicaba grid `180px 1fr auto` dentro del frame de 390px. Fix: override `section[id$="-mobile"].is-active .settings-row { grid-template-columns: 1fr !important }`. Cubre L066.
5. **Currency icon-circle dim en algunos modales** — los `<i data-lucide>` se reemplazan por `<svg>` después del paint, causando flicker. Mitigado al mover S8 dentro de `<main>` (lucide procesa antes del primer paint visible).
6. **"Figures" en lugar de "Figuras"** — copy fix en 2 spots de S8.

## Lessons learned agregadas

- **L072** — Secciones `.screen` fuera de `<main>` se renderizan al final del documento.
- **L073** — `querySelectorAll` capturado en script-time pierde elementos del DOM posteriores al script.

## Iteraciones humano-AI relevantes

- **Densidad y Sesiones activas removidas** — pedido humano post-A.2 review. Razonamiento: ambas son features sin uso validado; el coleccionista MVP no las pide explícitamente y las pantallas se sienten más limpias sin ellas. Documentado como "deferred" en `modules/settings.md §Fuera de scope`.
- **Estandarización del top-border cross-card** — pedido humano: "por que solo las secciones del tab de preferencias tiene un border top de colores? Hay que estandarizar todo." Resolución: aplicar el patrón a Perfil (`accent`) y Cuenta (`cool`) también. Esto cristalizó el patrón como cross-module y motivó §9.17 del PLAYBOOK.
- **Idioma agregado al card Interfaz** — humano pidió promover el toggle a control visible (FR-07-23 dejó de ser silente).
- **Color uplift segunda pasada** — humano notó pantallas "muy planas". Investigación de tokens disponibles (`--accent`, `--accent-warm`, `--accent-cool`) llevó a crear `s8-avatar-hero` (gradient), `s8-cooldown-chip`, `s8-modal-icon-gradient`. Sin inventar colores nuevos.
- **Extensión cross-module aprobada** — humano pidió evaluar si el patrón S8 aplicaba en `order-detail`/`store-detail`. Auditoría manual identificó 7 pantallas ganadoras (4 order-detail variants + 3 store-detail variants), 5 zonas anti-pattern (lists, wizard step cards, modales, filter drawer interno, sidebar sticky de wizards). El otro agente ejecutó la extensión en Fase B uplift.

## Mini-sesiones / cross-cutting abiertas

Ninguna bloqueante. Propuestas para FRD-07 alignment (P-S8-01 a P-S8-08) listadas en `modules/settings.md §Propuestas pendientes`. Se procesan en sesión dedicada de actualización de docs/product.

## Prerequisitos cerrados / pendientes para Fase B

- ✅ Demo aprobado visualmente por humano.
- ✅ Specs `screens/settings.md` y `modules/settings.md` con scope final.
- ✅ Patrón Chip Eyebrow + Top-Accent en PLAYBOOK §9.17.
- ⏳ FRD-07 alignment (propuestas P-S8-01 a P-S8-08 abiertas para sesión próxima).
- ⏳ Avatar cropper UX detallado (P-S8-07).
- ⏳ Mascot toggle ubicación final (P-S8-05).

## Validación

Todos los HTMLs verificados visualmente en preview server (Claude Preview MCP, port 5500) — light y dark theme, viewports desktop (1440px) y phone frame simulado (390px).

Sin código React tocado en esta sesión. Fase B implementación de Settings + uplift cross-module quedó para sesión separada.

---

# Fase B — Settings implementación + uplift cross-module (cierre 2026-06-12)

## Qué corrió

Implementación React/Next completa del módulo Settings + uplift §9.17 a `order-detail` y `store-detail`. El grueso del código se implementó y commiteó previamente (`e1678a9` settings redesign, `4eb7d74` uplift orders/dashboard/deliveries, `4f235fc` limpieza de core components); el cierre de sesión auditó la implementación contra el handoff, corrigió gaps y completó la validación obligatoria.

## Entregado (vs handoff de Fase A)

- ✅ `page.tsx` refactor → `SettingsShell` + `SettingsNav` (tabs verticales desktop + segmented control mobile, `role=tablist/tab`) + 3 panes (`SettingsProfilePane` / `SettingsAccountPane` / `SettingsPrefsPane`).
- ✅ 7 modales adaptive (M06): `UsernameModal` (cooldown FR-07-33), `DisplayNameModal`, `AvatarModal` (cropper), `AvatarRemoveModal`, `EmailModal`, `PasswordModal` (rules + strength meter), `CurrencyModal` (two-path FR-07-32).
- ✅ Server actions: `profileActions` (username availability/save + displayName + avatar save/remove), `accountCredentialsActions` (email change, change/set password), `preferencesActions` (savePreferences autosave, updateCurrency con `saveFxRates`, updateLanguage).
- ✅ Cooldown FR-07-33: `src/lib/auth/usernameChangeCooldown.ts` (7 días, server-side) + `CooldownChip` visible solo durante cooldown activo.
- ✅ Avatar cropper (P-S8-07): **extraído `<ImageCropper>` compartido** a `src/components/modules/ImageCropper/` (`CropperBody` + `useImageCropperState`, react-easy-crop) — `shape="round"` en AvatarModal, `shape="rect"` en `StoreLogoField` (reuso real).
- ✅ Password rules (P-S8-08): BetterAuth solo aplica min 8 (sin política custom en `auth.ts`) → display ajustado a esa única regla + strength meter, per la cláusula "si difieren, ajustar el display".
- ✅ `<Eyebrow variant="chip">` + `<SectionCard topAccent>` (M07) consumidos en los 3 panes; uplift verificado en order-detail y store-detail con vocabulario congelado (`Acciones` accent+rayo, `Tu nota privada` warm, `Pagos` success, etc.).
- ✅ i18n es+en estructuralmente idénticos.
- ✅ Deferred respetados: sin densidad (FR-07-31), sin sesiones activas (FR-07-40).

## Fixes del cierre (2026-06-12)

1. **9 tests obsoletos arreglados** (3 archivos): mock de `@/lib/app-url` sin `getPublicSiteUrl` en `auth.test.ts`; `AppNavDrawer.test.tsx` mockeaba `SignOutButton` que `ShellAccountMenu` ya no usa (ahora `authClient.signOut` + `useRouter`); `orderListingParams.test.ts` asumía default de statuses auto-aplicado (decisión nueva: el default vive en el href del nav, parse deja `statuses: []`).
2. **Categorías favoritas sin traducir** — `SettingsPrefsPane` renderizaba la key cruda (`key.replace(/_/g," ")`); fix: `useTranslations("storeProductTypes")` como el resto de la app.
3. **Autosave indicator** — "Guardado hace 121s" sin tope; pasados 60s cae al label plano "Guardado".
4. **4 componentes legacy muertos eliminados**: `SettingsProfileSection`, `SettingsAccountSection`, `SettingsPreferencesSection`, `AvatarField` (0 referencias).
5. **`e2e/settings.spec.ts` creado** (3 tests): tabs + panes + **flujo crítico FR-07-32** (modal two-path, guardar sin actualizar, fila actualizada). Gotchas: `SegmentedToggle` expone `role=radio` (no button); regex amplios tipo `/tema/` matchean nodos ocultos (p. ej. "Sistema") — usar roles.

## Validación

- `npm run test` ✅ (486 passed) · `npm run type-check` ✅ · `npm run lint` ✅ (0 errores) · `npm run validate-build` ✅.
- `npx playwright test e2e/settings.spec.ts` ✅ (3/3, incluye FR-07-32) — corrido con `PLAYWRIGHT_PORT` apuntando al dev server activo (`reuseExistingServer`).
- Verificación visual en preview (light + dark, desktop + 390px): 3 panes, segmented control mobile, bottom sheets Vaul, cropper circular con zoom, password rule con check verde, cooldown chip oculto sin cooldown activo, two-path footer, optimistic close del CurrencyModal con fila actualizada, consistencia §9.17 en order-detail y store-detail.

## Pendientes que NO bloquean (heredados)

- FRD-07 alignment (P-S8-01..04) — sesión dedicada post-Fase B (Round 2 del delta audit).
- Mascot toggle demo visual (P-S8-05) · MFA flow (P-S8-06, S9+).
