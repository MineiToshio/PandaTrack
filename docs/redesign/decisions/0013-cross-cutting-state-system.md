---
title: ADR 0013 — Cross-cutting state system (skeleton / empty / error)
date: 2026-06-13
status: proposed
session: 10-cross-cutting-states (Fase A) — pasa a `accepted` al aprobar el gate visual
owner: Sergio Minei
trigger: S10 unifica los estados empty/loading/error que aparecían ad-hoc en cada módulo (S6/S7/S9) y diseña por primera vez los estados de error con identidad de rediseño; cierra el gap G8 (Skeleton primitive) de s4-gaps.md
updates: docs/redesign/screens/cross-cutting-states.md, docs/redesign/PLAYBOOK.md, docs/redesign/_notes/demo-screens.html (dropdown S10)
related: ADR 0001 D3 (disabled sin opacity), ADR 0008 (Modal canonical — confirm overlays ≠ states), ADR 0006 (icon+label contract), §9.17 PLAYBOOK (Chip-Eyebrow + Top-Accent), gap G8 + G12 (s4-gaps.md)
---

# ADR 0013 — Cross-cutting state system (skeleton / empty / error)

## Contexto

Hasta S9, cada módulo resolvió sus estados transversales por su cuenta:

- **Empty:** existía el canónico `EmptyState` (S6) y 4 consumidores lo usaban bien, pero 3 empties
  divergieron (`OrderCreateEmptyStores` ad-hoc; `StoreEmptyStateBox` caja compacta; `StoreEmptyCatalogTag`
  tag de catálogo).
- **Loading:** sin primitiva. Tres recetas distintas de skeleton (`OrderListLoadingSkeleton` y
  `DeliveryListLoadingSkeleton` con `--text-primary` mix + pulse; `StoreListingGridSkeleton` con
  `--border` + pulse **sin `motion-safe`**), más dos recetas de shimmer en el demo (`.skeleton`,
  `.s7-mob-skel`). No había skeleton de detalle ni de formulario.
- **Error:** `error.tsx` con componentes legacy (sin identidad rediseño); `global-error.tsx` con la página
  default de Next; **sin** `not-found.tsx`; **sin** patrón de error a nivel de sección con retry. El demo
  no tenía ninguna pantalla de error.

S10 es una sesión foundational: no agrega producto, eleva estos estados a un **sistema** que deriva de
primitivas canónicas y es reconocible como descendiente del demo (PLAYBOOK §6.quater de la metodología).

## Decisión

Tres familias de estado, cada una derivada de una primitiva, con un vocabulario de tono compartido.

### D1 — Skeleton canónico (loading)

1. **Un solo átomo** (componente `<Skeleton>`): `linear-gradient` shimmer con mezcla neutra
   sobre `--text-primary` (6 % → 12 % → 6 %), `background-size: 200% 100%`, `animation 1.4s linear infinite`.
   La clase CSS shipped es **`.skeleton`** (keyframe `skeleton-shimmer`); el demo la prototipó como `.s10-skel`.
2. **Animación = shimmer, no pulse.** Unifica el demo (que ya usa shimmer) y el React (que usaba pulse).
   Razón: el demo es la fuente de verdad visual y el shimmer lee como "cargando" con más vida.
3. **`prefers-reduced-motion: reduce` → relleno estático** (mix 9 %, sin animación). Obligatorio (corrige el
   bug de `StoreListingGridSkeleton`, que animaba sin `motion-safe`).
4. **Relleno con `--text-primary` mix, no `--border`** — mantiene contraste consistente sobre canvas,
   `--surface` y `--surface-elevated` (en dark `--border` se aplana).
5. **Composiciones canónicas:** `list-row`, `card`, `detail-hero` (nuevo), `form` (nuevo). Las ad-hoc migran.
6. **a11y:** el átomo es `aria-hidden`; el contenedor lleva `aria-busy="true"` + `aria-label`/`aria-live`.
7. **No fake client fallback** (`react-next-components.mdc`): skeletons vía `loading.tsx` / `<Suspense>`
   para trabajo server; spinner solo para acciones cortas que el usuario dispara; nada en mutaciones optimistas.

### D2 — `EmptyState` como primitiva del bloque centrado (empty + error full-page)

1. `EmptyState` se extiende de forma **aditiva** (sin breaking change — L016):
   - `iconTone: neutral | accent | warning | destructive`.
   - `appearance: plain | card | page` (`page` = estado full-page de error/404/offline).
2. **Dos clases de empty, una anatomía:** primera-vez (`accent`, CTA primary) vs sin-resultados-filtrados
   (`neutral`, CTA ghost "Limpiar"). Es la referencia única cross-módulo.
3. El bloque centrado full-page (route error, 404, offline) **reusa la misma anatomía** con tonos
   `destructive`/`warning`/`neutral`.
4. **Consolidación:** `OrderCreateEmptyStores` → `EmptyState card`. `StoreEmptyStateBox` resultó dead code
   (sin consumidores) → eliminado. `StoreEmptyCatalogTag` queda como **excepción** (empty a nivel chip, no región).

### D3 — `SectionError` (error de sección con retry — patrón nuevo)

1. Cuando una **región** (card/lista) falla a cargar pero el resto de la página vive, se usa `<SectionError>`:
   card sobre `--surface-elevated` con el vocabulario **§9.17 Chip-Eyebrow + Top-Accent** en tono
   `destructive` (top-border 2 px + chip eyebrow mono "No se pudo cargar") + mensaje + botón ghost "Reintentar".
2. **Mecánica App Router:** Client Component con retry; el retry default es `router.refresh()` (re-corre los
   Server Components). El consumidor envuelve el fetch fallible en `try/catch` (Server Component) y renderiza
   `<SectionError>` en el `catch`, o acota un error boundary de cliente a esa subárea. La carga sigue siendo SSR.
3. **Variante `tone="warning"` = offline** (transitorio, no error duro).
4. `role="alert"` + `aria-live="polite"`.

### D4 — Tonos de estado (vocabulario congelado)

| Estado                 | Tono          | Ícono Lucide                                  |
| ---------------------- | ------------- | --------------------------------------------- |
| Empty · primera vez    | `accent`      | contextual (`PackageOpen`, `Truck`, `Store`…) |
| Empty · sin resultados | `neutral`     | `SearchX`                                     |
| Error de ruta (full)   | `destructive` | `TriangleAlert`                               |
| Error de sección       | `destructive` | `TriangleAlert`                               |
| 404 not-found          | `neutral`     | `Compass`                                     |
| Offline / sin conexión | `warning`     | `WifiOff`                                     |

Un **404 no es un error** (el contenido no existe / se movió) → `neutral`, no `destructive`. Offline es
**transitorio** → `warning`. Solo el fallo real (server/render/fetch) es `destructive`.

### D5 — Mascota excluida de los estados S10

`MascotBubble` está desmontado (cross-cutting S5.3) y los sprites diferidos (D3-03). Anti-patrón vinculante
(`directions.md` §4.10): **la mascota nunca aparece en errores ni confirmaciones**. Decisión:

- Errores (route / section / 404 / offline): mascota **prohibida**.
- Empties: S10 **no** monta mascota; el icon-well canónico es suficiente. El slot `visual` de `EmptyState`
  queda reservado para una futura mascota _sleeping_ en empty-hero cuando los assets existan. **No bloquea S10.**

### D6 — Ownership de Sentry (sin ruido duplicado)

Cada error se reporta **una sola vez**:

- `error.tsx` captura el render del segmento (con `tags.area` + `extra.digest`); `global-error.tsx` el root.
- Los server actions capturan los suyos (ya implementado).
- `<SectionError>` **no captura** — es presentación; la captura vive en la capa de datos que falló.
- `not-found` y offline **no capturan** (esperado / transitorio).

## Consecuencias

### Positivas

- Empty/loading/error dejan de ser folklore por módulo: una receta de skeleton, una anatomía de empty, un
  sistema de error con tonos definidos. Reconocible como descendiente del demo.
- Cierra G8 (Skeleton primitive) y G12 (EmptyState wrapper sizing) de `s4-gaps.md`.
- Corrige el bug de accesibilidad de `StoreListingGridSkeleton` (animación sin `motion-safe`).
- Da por primera vez un 404 y un error de sección con identidad; reduce el "página default de Next" a un
  fallback catastrófico bien diseñado.

### Negativas / límites

- **Cambio visible de animación** en los skeletons ya shipeados (pulse → shimmer). Es intencional (unificación),
  pero altera Orders/Deliveries/Stores. Se valida en el gate visual del S10.
- `<SectionError>` introduce el patrón pero su cableado a regiones reales que fallan es limitado hoy (no hay
  una región fallible obvia). Fase B crea el componente y lo cablea donde encaje; el resto queda disponible.
- `global-error.tsx` no puede usar i18n (reemplaza el root layout) → copy bilingüe inline, fuera del sistema
  next-intl. Aceptado por ser el fallback catastrófico.

### Refinamientos de Fase B

- El `appearance="compact"` planeado se **descartó**: su único consumidor previsto, `StoreEmptyStateBox`, resultó
  dead code (sin consumidores en `src/`) y se eliminó en vez de consolidar. En su lugar se sumó
  `appearance="page"` (estado full-page de error/404/offline). La unión shipped es `plain | card | page`.
- La clase CSS canónica del skeleton shipeó como **`.skeleton`** (keyframe `skeleton-shimmer`); el demo la
  prototipó como `.s10-skel`. La receta es idéntica.

## Referencias

- Spec: `docs/redesign/screens/cross-cutting-states.md`
- Demo: anchors `#s10-*` en `docs/redesign/_notes/demo-screens.html`
- PLAYBOOK §9.17 (Chip-Eyebrow + Top-Accent), §1 (componentes core)
- `s4-gaps.md` G8 (Skeleton), G12 (EmptyState sizing)
- `react-next-components.mdc` (loading UI vs `next/dynamic`)
- `sentry-error-handling.mdc` (captura sin duplicar)
- `MascotBubble.md` + `directions.md` §4.10 (mascota nunca en errores)
- ADR 0008 (Modal canonical — los overlays de decisión ≠ estados de página)
