---
title: "S5 — App Shell Navigation and Layouts"
date: 2026-05-02
status: completed
branch: redesign
---

# S5 — App Shell Navigation and Layouts

## Objetivo

Implementar el shell navegacional del área `(app)`: sidebar colapsable PUSH, header sticky con breadcrumbs, mobile tab bar, FAB contextual, mascota idle bubble, y componentes de utilidad (ProgressBar, Pagination, FAB). El AppLayout existente fue refactorizado para usar el mecanismo PUSH real en lugar del float overlay anterior.

## Fase A — Specs (docs)

Creados en `docs/redesign/components/`:

- `Sidebar.md` — 3 estados (expanded/collapsed/hover-expanded), PUSH, motion tokens
- `Header.md` — breadcrumbs izq + lang/theme der, frosted glass, sin avatar
- `MobileTabBar.md` — 4 tabs + slot FAB central elevado, fixed bottom
- `FAB.md` — acción contextual por ruta, FabAction type
- `VerifyEmailBanner.md` — warning tint, sessionStorage dismiss
- `ProgressBar.md` — variants, indeterminate
- `Pagination.md` — classic + load-more
- `layouts/app-shell.md` — master layout: grid, z-index, tokens, dependencias

Actualizados: `ThemeToggle.md`, `LangToggle.md`, `Breadcrumbs.md`, `MascotBubble.md`.

## Fase B — Implementación

### CSS tokens (`src/app/globals.css`)

- `--mobile-tab-bar-h: 4rem` — altura del tab bar mobile
- `--z-fab: 38` — z-index del FAB (entre mascot 35 y popover 40)
- `@keyframes progress-indeterminate` + `.animate-progress-indeterminate` — para ProgressBar indeterminate

### Nuevos hooks

- `src/hooks/useSidebarState.ts` — versión shared con `floatingOpen` / `setFloatingOpen` para el mecanismo PUSH

### Nuevos core components (`src/components/core/`)

| Componente        | Descripción                                                                          |
| ----------------- | ------------------------------------------------------------------------------------ |
| `ThemeToggle.tsx` | Toggle light/dark canónico para el shell (reemplaza el de `(landing)`)               |
| `LangToggle.tsx`  | Selector de locale canónico para el shell (reemplaza el de `(landing)`)              |
| `Breadcrumbs.tsx` | Nav con `<ol>` + `aria-current="page"`, ellipsis mobile                              |
| `ProgressBar.tsx` | Server component, variants (accent/success/warm-gradient/destructive), indeterminate |
| `Pagination.tsx`  | Discriminated union `variant: "classic" \| "load-more"`                              |
| `FAB.tsx`         | Botón de acción flotante, `position: "fixed" \| "elevated"`                          |

### Nuevos module components (`src/components/modules/`)

| Componente         | Descripción                                                                 |
| ------------------ | --------------------------------------------------------------------------- |
| `Sidebar.tsx`      | PUSH sidebar: single `<aside>`, width transitions, `floatingOpen` como prop |
| `Header.tsx`       | Sticky header: usa core LangToggle + ThemeToggle (no `(landing)`)           |
| `MobileTabBar.tsx` | 5-col grid: 4 tabs + slot FAB central elevado, solo mobile                  |
| `MascotBubble.tsx` | Bubble idle fixed esquina, context menu "Ocultar / Cambiar tema / Ajustes"  |

### Utils

- `src/app/[locale]/(app)/_utils/fabAction.ts` — `getFabAction(pathname, locale): FabAction | null`

### AppLayout refactor (`AppLayout.tsx`)

- Usa `useSidebarState` de `@/hooks/` (no la copia local)
- Usa el nuevo `Sidebar` (PUSH real, `floatingOpen` como prop)
- Usa el nuevo `Header` (core toggles, no `(landing)`)
- Agrega `MobileTabBar` con `fabAction` contextual
- Agrega `MascotBubble` con visibilidad desde `localStorage`
- Mecanismo PUSH: `--sidebar-current-w` CSS var en el wrapper + `lg:pl-[var(--sidebar-current-w)]` en el content div
- Padding bottom mobile: `max-lg:pb-[var(--mobile-tab-bar-h)]` en `<main>`
- Skip link: `<a href="#main-content">` antes del sidebar
- `id="app-nav-drawer"` agregado al `AppNavDrawer` (para `aria-controls` del burger button)

### i18n

Agregados:

- `appLayout.accessibility.primarySidebar` (es/en)
- `appLayout.mobileTabBar.{today,orders,stores,settings}` (es/en)
- `components.pagination.*` — 7 claves (es/en)
- `components.mascotBubble.*` — 7 claves (es/en)

### PostHog events

- `POSTHOG_EVENTS.APP_SHELL.MASCOT_HIDDEN` = `"app_shell_mascot_hidden"`
- `POSTHOG_EVENTS.APP_SHELL.MASCOT_SHOWN` = `"app_shell_mascot_shown"`

## Decisiones de implementación

### PUSH para toggle manual, FLOAT para hover-expand

**Antes (S4 y previo):** el hover-expand del sidebar renderizaba un segundo `<div>` flotante con `z-50` encima del contenido.

**S5 (implementación inicial):** se implementó un único `<aside>` con PUSH real para ambos modos (toggle manual y hover). El content wrapper usaba `--sidebar-current-w` = expanded || floatingOpen → `--sidebar-w-expanded`.

**Post-S5 (corrección):** el hover-expand se revirtió a **float overlay**: cuando el sidebar está collapsed y el usuario hace hover, el `<aside>` anima su ancho pero el content wrapper no cambia. `--sidebar-current-w` permanece en `--sidebar-w-collapsed` mientras `floatingOpen` es true. Solo el toggle manual (`expanded`) desplaza el contenido (PUSH real). El sidebar flotante usa `z-40` y `shadow-[var(--elevation-3)]` para indicar la capa visual.

### ThemeToggle / LangToggle canónicos

Los componentes anteriores en `(landing)/_components/Menu/` importados por `ContentHeader` y `AppNavDrawer` eran una violación de project-structure. En S5 se crean las versiones canónicas en `src/components/core/` que el shell usa directamente.

### Sidebar muestra los 5 nav items

`getPrivateAppNavItems()` excluía Settings (4 items). `getAllNavItems()` devuelve los 5. El sidebar desktop muestra los 5; el MobileTabBar muestra 4 (excluye Entregas, que solo está en desktop).

### MascotBubble — solo idle en S5

Variantes `walking`, `celebrating`, `sleeping` diferidas a S12. Sprite placeholder: `/icon.svg`. Context menu básico: "Cambiar tema" + "Configuración" + "Ocultar mascota".

## Validación

```
npm run type-check  → ✅ 0 errores
npm run lint        → ✅ 0 errores (10 warnings pre-existentes)
npm run test        → ✅ 388 tests pass
npm run validate-build → ✅ build limpio, todas las rutas
```

## Archivos modificados

```
src/app/globals.css                                        ← tokens CSS
src/hooks/useSidebarState.ts                               ← nuevo (shared)
src/components/core/ThemeToggle.tsx                        ← nuevo
src/components/core/LangToggle.tsx                         ← nuevo
src/components/core/Breadcrumbs.tsx                        ← nuevo
src/components/core/ProgressBar.tsx                        ← nuevo
src/components/core/Pagination.tsx                         ← nuevo
src/components/core/FAB.tsx                                ← nuevo
src/components/modules/Sidebar.tsx                         ← nuevo
src/components/modules/Header.tsx                          ← nuevo
src/components/modules/MobileTabBar.tsx                    ← nuevo
src/components/modules/MascotBubble.tsx                    ← nuevo
src/app/[locale]/(app)/_utils/fabAction.ts                 ← nuevo
src/app/[locale]/(app)/_components/AppLayout/AppLayout.tsx ← refactored
src/app/[locale]/(app)/_components/AppLayout/AppNavDrawer.tsx ← id="app-nav-drawer"
src/app/[locale]/(app)/_components/AppLayout/navigationConfig.ts ← getAllNavItems()
src/i18n/locales/es/app-layout.json                        ← nuevas claves
src/i18n/locales/en/app-layout.json                        ← nuevas claves
src/i18n/locales/es/components.json                        ← nuevas claves
src/i18n/locales/en/components.json                        ← nuevas claves
src/lib/constants.ts                                       ← MASCOT_HIDDEN/SHOWN
```
