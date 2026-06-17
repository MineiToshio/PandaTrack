---
title: S10 — Estados transversales (empty / loading / error)
session: 10-cross-cutting-states
type: foundational A+B
status: ✅ cerrada (2026-06-13) — implementada y validada, sin commitear (commit de Sergio)
last_updated: 2026-06-13
owner: Sergio Minei
adrs:
  - ADR 0013 — Cross-cutting state system (skeleton / empty / error)
---

# S10 — Estados transversales (empty / loading / error)

Sesión foundational A+B con **gate humano** entre fases. No agrega pantallas de producto: unifica
y eleva a sistema los estados que aparecían ad-hoc en cada módulo (Tiendas S6, Órdenes S7, Entregas S9)
y diseña por primera vez los estados de error con identidad de rediseño.

## Fase A (docs + demo) — aprobada en el gate

- **Auditoría** de empties/loadings/errors actuales → `screens/cross-cutting-states.md` §1.
- **Demo** extendido (`_notes/demo-screens.html`): dropdown nuevo "S10 · Estados" + 12 secciones
  (skeleton-anatomy, detail/form loading, empty-anatomy, route-error, section-error, 404, offline + 4 mobiles),
  light+dark+390px, verificadas en preview.
- **Specs**: `screens/cross-cutting-states.md` (auditoría + 3 familias + contratos + i18n + a11y + handoff),
  **ADR 0013**, reglas nuevas al **PLAYBOOK §10**.
- Gate: Sergio aprobó visualmente ("ok, si implementa todo").

## Fase B (implementación) — cerrada

### Skeleton (loading)

- **`.skeleton` canónico** en `globals.css`: shimmer `linear-gradient` con mezcla neutra `oklab` sobre
  `--text-primary` (6/12/6 %), `1.4s linear infinite`, keyframe `skeleton-shimmer`; `prefers-reduced-motion`
  → relleno estático 9 %. Supersede las 3 recetas ad-hoc (2 pulse React + 2 shimmer demo).
- **`<Skeleton>`** (`src/components/core/Skeleton.tsx`): átomo `variant text|circle|rect|pill` + `lines`, `aria-hidden`.
- Migrados al átomo: `OrderListLoadingSkeleton`, `DeliveryListLoadingSkeleton`, `StoreListingGridSkeleton`
  (este último además corrige el bug `animate-pulse` sin `motion-safe`).
- **`OrderDetailLoadingSkeleton`** nuevo + `orders/[id]/loading.tsx` (antes retornaba `null`).

### Empty

- **`<EmptyState>`** extendido (aditivo, sin breaking change): `iconTone` +`warning`/`destructive`,
  `appearance` +`page` (full-page error/404/offline), `eyebrow`, `role`, `headingAs` +`h1`.
- `OrderCreateEmptyStores` consolidado sobre `EmptyState card` (era ad-hoc).
- `StoreEmptyStateBox` **eliminado** (dead code — sin consumidores; el `compact` planeado se descartó).

### Error

- `error.tsx` rediseñado sobre `EmptyState page` destructive (mantiene Sentry `tags.area` + `digest`).
- `global-error.tsx` rediseñado self-contained (inline styles + SVG, sin tokens/i18n; excepción documentada).
- **`not-found.tsx`** nuevo (app) — `EmptyState page` neutral (404 no es error).
- **`<SectionError>`** nuevo (`src/components/modules/SectionError.tsx`): §9.17 chip+top-accent, retry
  `router.refresh()`, `tone` destructive/warning (offline), `role=alert`, no captura Sentry. Reusable;
  sin consumidor de producción todavía (la arquitectura fetch-por-página no tiene región falible aislada).

### i18n (es+en)

- `appLayout.error` (+`eyebrow`/`goHome`) + `appLayout.notFound`; `components.sectionError` + `components.skeleton.loading`.

## Verificación visual (preview, app real, login dev)

4 boundaries reales confirmadas + demo:

- **Skeleton de detalle** (orders/[id]/loading) — render en vivo durante navegación.
- **404** (`not-found.tsx`) vía id de pedido inexistente — neutral, Compass, "ERROR 404".
- **Empty sin-resultados** (orders `?q=…` sin match) — `EmptyState card` neutral.
- **Error de ruta** (`error.tsx`) vía throw temporal (revertido) — destructive, "Algo se rompió de nuestro lado".

## Review adversarial (mecanismo 4)

Workflow de 6 dimensiones × verificación adversarial (21 agentes): **11 hallazgos confirmados, 4 descartados**.
Todos corregidos:

- a11y: los 3 skeletons de lista recibieron `aria-label` localizado (`components.skeleton.loading`) en su
  contenedor `aria-busy`; el de Stores reemplazó su `aria-label` hardcodeado en español por i18n.
- docs: reconciliados spec/ADR/PLAYBOOK con lo shipped (`s10-skel`→`.skeleton`, `compact` descartado →
  `page`, `StoreEmptyStateBox` deleted, `notFound.*`→`appLayout.notFound.*`); `EmptyState.md` reescrito al
  API real; creados `components/Skeleton.md` + `SectionError.md`; JSDoc de `EmptyState.tsx` corregido.

## Validación

- `npm run test` → **548 passed**, 12 skipped (536 previos + 12 nuevos: Skeleton, EmptyState, SectionError).
- `npm run type-check` ✅ · `npm run lint` ✅ (0 errores) · `npm run validate-build` ✅.
- e2e: **no aplica re-run** — S10 toca _estados_ (loading/empty/error), no los _flujos_ que cubren los specs
  (`auth`, `deliveries`, `stores`, `store-listing`, `settings`, `landing`, `app-layout`); ninguno asserta
  sobre skeletons/empties/boundaries.

## Decisiones cerradas (ver ADR 0013)

1. Skeleton = **shimmer** (no pulse); clase `.skeleton` (demo prototipó `.s10-skel`).
2. `EmptyState` = primitiva del bloque centrado (empty `card` + error full-page `page`).
3. `SectionError` = patrón nuevo (§9.17 destructive + retry).
4. Tonos congelados: firstrun `accent` / noresults `neutral` / route+section error `destructive` / 404 `neutral` / offline `warning`.
5. Mascota prohibida en errores; no montada en empties (slot `visual` reservado).
6. Sentry una sola captura (`SectionError` no captura).
7. `compact` descartado + `StoreEmptyStateBox` eliminado (refinamiento de Fase B sobre el plan A).

## Para Fase B futura / heads-up

- **`orders/[id]/loading.tsx`**: el `null` anterior era deliberado para preservar la view-transition
  list→detail (`viewTransitionName: order-{id}`). S10 lo reemplazó por el skeleton de detalle (decisión del
  spec aprobado). Si en preview la transición compartida se siente peor que el skeleton, revertir a `null`
  es trivial. **Decisión de Sergio.**
- `<SectionError>` queda listo para la primera región que haga fetch independiente y pueda fallar.

## Archivos (desde git status)

**src/**: `globals.css`, `components/core/Skeleton.tsx` (+test), `components/modules/EmptyState.tsx`,
`components/modules/SectionError.tsx` (+test EmptyState/SectionError), `error.tsx`, `global-error.tsx`,
`(app)/not-found.tsx`, `orders/[id]/loading.tsx` + `OrderDetailLoadingSkeleton.tsx`,
`orders/_components/OrderListLoadingSkeleton.tsx`, `orders/loading.tsx`, `orders/page.tsx`,
`orders/_components/share/OrderCreateEmptyStores.tsx`, `deliveries/_components/DeliveryListLoadingSkeleton.tsx`,
`deliveries/loading.tsx`, `deliveries/page.tsx`, `stores/_components/StoreListingGridSkeleton.tsx` +
`StoreListingGridWrapper.tsx`, `stores/_components/share/StoreEmptyStateBox.tsx` (borrado),
`i18n/locales/{es,en}/app-layout.json` + `components.json`.

**docs/redesign/**: `screens/cross-cutting-states.md` (nuevo), `decisions/0013-cross-cutting-state-system.md`
(nuevo), `components/Skeleton.md` + `SectionError.md` (nuevos), `components/EmptyState.md` (reescrito),
`components.md`, `PLAYBOOK.md` (§10), `_notes/demo-screens.html`, `README.md`, este session log.
