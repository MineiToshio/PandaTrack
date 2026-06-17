---
title: S4 — Gaps abiertos para sesiones siguientes
status: final S4
session: 04-components
last_updated: 2026-05-02
owner: Sergio Minei
---

# Gaps abiertos — Sesión 4

> Items detectados durante S4 que NO se resolvieron en S4 — quedan registrados con sesión destino y propuesta de resolución. Mismo formato que `atelier-gaps.md` y `store-detail-pendings.md`.
>
> **Total gaps:** 12. **Bloqueantes para S5:** 0.

> **Cierre S13 (2026-06-16).** Los gaps residuales (G1–G8, G10-parte, G12 ya se cerraron en S5/S6/S9) quedaron dispuestos en la auditoría final (ver [`s13-final-audit.md`](./s13-final-audit.md) §7):
>
> - **G9 (lint rules ADR 0006):** ❌ sin lint rule custom — ADR 0006 ya está **enforced por TypeScript** (discriminated union de `StatusChip`). Una regla ESLint sería redundante (over-engineering).
> - **G10 (audit cross-paleta glyph/status):** 👍 **moot por alcance** — solo Velvet vive en `src/`; las 4 paletas alternativas son demo-only. No hay cross-paleta que auditar en la app.
> - **G11 (migración legacy `text-white`):** ✅ **cerrado** — 0 violaciones theme-blind en `src/` (lo que queda son excepciones legítimas OG/email/apple-icon/global-error). Blindado a futuro por la guardia `src/test/design-token-guard.test.ts`.
> - **G13 (sub-token border `1.5px`):** ⏸ **diferido a S14** — aceptar `1.5px` como CSS legítimo (opción a de S4); anotar en `tokens.md` al graduar el sistema.

---

## G1. ProgressBar primitive

**Detectado en:** `screens/dashboard.md` (hero progress 62% gradient accent → accent-warm), `screens/orders-list.md` (% pagado en cada row), `screens/order-detail.md` (% pagado del pedido), `screens/delivery-create.md` (no usa, OK).

**Status S4:** ⏳ no specceado.

**Sesión destino:** **S5** (Navegación y layouts) o **S6** (Dashboard alta fidelidad) — la primitiva es independiente, S5 es lugar natural si entra como parte de la app shell. Si no, S6 cuando se hagan dashboard cards.

**Propuesta de resolución.** Componente Tier 2 `<ProgressBar>` con:

- API: `value: number /* 0-100 */`, `variant?: 'accent' | 'success' | 'warm-gradient' | 'destructive'`, `size?: 'sm' | 'md'`, `label?: string` (sr-only o visible), `striped?: boolean`.
- Recetas:
  - Track: `--surface-elevated` con border `--border`.
  - Fill default: `--accent`.
  - Fill `warm-gradient`: `linear-gradient(to right, var(--accent), var(--accent-warm))` (caso hero del dashboard).
  - Fill `success`: `--success` (caso "100% pagado").
- ARIA: `role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}` + label asociado.
- Motion: transition `width` con `--motion-base` `--ease-out-expressive` cuando el valor actualiza optimisticamente (post-pago).
- Reduce-motion: cambio instantáneo.

---

## G2. Pagination numerada (desktop)

**Detectado en:** ADR 0001 D9 ("desktop paginación clásica con paginador numerado, pageSize 30") + `screens/orders-list.md` § desktop (`« ‹ Página 1 de 2 · 30 por página › »`).

**Status S4:** ⏳ no specceado.

**Sesión destino:** **S5** (Navegación y layouts).

**Propuesta de resolución.** Componente Tier 2 `<Pagination>` con:

- API: `currentPage: number`, `totalPages: number`, `onPageChange: (page: number) => void`, `pageSize?: number`, `showFirstLast?: boolean`.
- Receta visual: `<button>` para cada número con state-layer hover, current state como `<StatusChip variant="accent" />` o link sin underline `--text-primary` `--font-weight-semibold`. Ellipsis `…` cuando `totalPages > N`. First/Last buttons opcional.
- ARIA: `<nav aria-label="Paginación">` + `aria-current="page"` en current.
- Keyboard: arrow keys navigate, Home/End primer/último.

---

## G3. VerifyEmailBanner (sticky shell banner)

**Detectado en:** `screens/dashboard.md` ("VerifyEmailBanner si grace" — sticky sobre el header, warning soft).

**Status S4:** ⏳ no specceado.

**Sesión destino:** **S5** (parte del shell).

**Propuesta de resolución.** Componente Tier 2 `<VerifyEmailBanner>` que vive en el shell (S5):

- Receta: bg `color-mix(in oklch, var(--warning) 14%, var(--surface))`, border-bottom `var(--warning)` 28%, text `--warning-chip-text`, ícono Lucide `mail` 16×16, padding `--space-2 --space-4`, sticky `top: var(--header-h)` con `z-index: var(--z-sticky)`.
- Contenido: copy "Confirma tu email para mantener tu cuenta segura. Te quedan {N} días." + CTA ghost "Enviar de nuevo".
- ARIA: `role="status" aria-live="polite"`.
- Mobile: full-width, ícono opcional oculto si no entra.

---

## G4. Tab bar inferior mobile (4 destinos + FAB elevado)

**Detectado en:** `screens/dashboard.md`, `orders-list.md` (rendering del shell mobile).

**Status S4:** ⏳ no specceado.

**Sesión destino:** **S5** (parte del shell mobile).

**Propuesta de resolución.** Componente Tier 3 `<TabBar>` (`<MobileTabBar>` quizá para distinguir de `<Tabs>`):

- 4 destinos: Hoy / Pedidos / Tiendas / Ajustes.
- FAB elevado al center (sobre el tab bar) con `--fab-size` (56px).
- Active tab con indicador `--accent`.
- Long-press en FAB abre picker (orden / tienda / entrega) — diferido a S6.
- ARIA: `<nav role="tablist" aria-label="Navegación principal">` + `<button role="tab">`.

Compone `<IconButton>` por tab + `<Button variant="primary" size="lg">` para FAB.

---

## G5. ProgressBar/Pagination/VerifyEmailBanner como `--detail-sidebar-w` token

**Detectado en:** `<DetailSidebar>` documenta width tentativo `--detail-sidebar-w` con fallback `clamp(20rem, 28vw, 24rem)`. NO existe el token aún.

**Status S4:** 🟡 fallback documentado.

**Sesión destino:** **S5**.

**Propuesta de resolución.** Agregar a `tokens.md` §4 (Layout magic numbers) un nuevo token:

```css
--detail-sidebar-w: 21.25rem; /* 340px — alineado con drawer interno de Linear/Notion */
```

Validar en S5 cuando se materialice el shell. Si decide width distinto (320 o 380), actualizar el token y `<DetailSidebar>` lo consume sin cambios.

---

## G6. `--drawer-w-narrow` / `--drawer-w-wide` tokens

**Detectado en:** `<Drawer>` documenta tres widths (`narrow=320px`, `default=var(--drawer-w)=440px`, `wide=560px`). Solo `default` tiene token.

**Status S4:** 🟡 valores literales en spec.

**Sesión destino:** **S5**.

**Propuesta de resolución.** Agregar a `tokens.md` §4:

```css
--drawer-w-narrow: 20rem; /* 320px */
--drawer-w: 27.5rem; /* 440px — ya existe */
--drawer-w-wide: 35rem; /* 560px */
```

Actualizar `<Drawer>` para consumir tokens directos.

---

## G7. `--motion-shell-push` token (sidebar push transition)

**Detectado en:** ADR 0003 D3 documenta sidebar push con "transición de 220ms". Si se define como `--motion-base` (280ms) hay desajuste contra la decisión humana original.

**Status S4:** 🟡 sin token.

**Sesión destino:** **S5**.

**Propuesta de resolución.** Dos opciones:

- (a) Reusar `--motion-base` (280ms) — diferencia 60ms imperceptible, simplifica sistema.
- (b) Crear token `--motion-shell-push: 220ms` — preserva decisión D3 literal.

**Recomendación:** opción (a) — simplificar y revalidar humano en S5.

---

## G8. Skeleton primitive

**Detectado en:** Avatar (loading), Breadcrumbs (label loading), implicado en cualquier componente con async data.

**Status S4:** ⏳ patrón emergente sin spec dedicado.

**Sesión destino:** **S9** (Empty / loading / error states).

**Propuesta de resolución.** Componente Tier 1 `<Skeleton>` con:

- API: `variant?: 'text' | 'circle' | 'rect' | 'card'`, `width?: string`, `height?: string`, `count?: number` (para text multilíneas).
- Recetas: `background: color-mix(in oklch, var(--text-primary) 8%, var(--surface))`, animation pulse `--motion-base ease-in-out infinite alternate` (alterna 8% ↔ 12% mix). Reduce-motion: estático.
- ARIA: `aria-busy="true"` en el contenedor padre.

---

## G9. Lint rules para enforcement de ADR 0006

**Detectado en:** ADR 0006 + audit S4 #4.

**Status S4:** ⏳ no implementado (TS enforcement está en specs, lint S12).

**Sesión destino:** **S12** (Handoff a implementación).

**Propuesta de resolución.** Reglas ESLint custom (plugin `eslint-plugin-pandatrack`):

- `pandatrack/no-info-chip-without-icon-label`: scan JSX `<StatusChip kind="info" />` sin `icon=` o `label=`. Error.
- `pandatrack/no-accent-cool-as-bg-border-text`: scan CSS `var(--accent-cool)` en propiedades `background`, `background-color`, `border-color`, `color` cuando no esté dentro de `<svg>` icon. Error.
- `pandatrack/no-text-white-on-accent`: scan `text-white` Tailwind o `color: white` CSS sobre elementos con `bg-[--accent]` o variant `primary`/`destructive`. Error con sugerencia `var(--text-on-accent)`.
- `pandatrack/no-cat-tokens`: scan `var(--cat-*)` en CSS. Error (ADR 0004).
- `pandatrack/no-italic`: scan Tailwind `italic` class y CSS `font-style: italic`. Warning.

---

## G10. Audit cruzado de contraste glyph sobre status base (cross-paleta)

**Detectado en:** Red team #15 — `<Stepper>` check sobre `--success` cross-paleta.

**Status S4:** 🟡 no auditado (S3 audit cubrió pares text/background, no glyph/status).

**Sesión destino:** **S6** (cuando Stepper se mount con paletas alternativas) o **S12** (audit antes de implementar).

**Propuesta de resolución.** Audit table específica:

- `--text-on-accent` sobre `--success` en cada paleta light + dark (5 paletas × 2 modos = 10 pares).
- Mismo para `--success` (verde verde) glyph en chip-text con bg `color-mix(--success 14%, surface)`.

Si algún par falla, fallback documentado: `color: var(--surface)` o subir size del check a 18px (AA Large 3:1).

---

## G11. Migración legacy `text-white` masiva pre-S12

**Detectado en:** Red team #11 + `<Button>` Notas S12 + `tokens-css.md` §11 nota #8.

**Status S4:** ⏳ flagged.

**Sesión destino:** **S12** (Handoff a implementación).

**Propuesta de resolución.** Pre-implementación de `<Button>` y `<IconButton>` en `src/components/`:

1. Correr `rg "text-white|color: white|bg-white" src/components/` — generar reporte.
2. Por cada match, decidir:
   - Si está sobre `--accent` o `--destructive` → migrar a `var(--text-on-accent)`.
   - Si está sobre fondos custom → revisar contraste manualmente.
3. Anotar en CHANGELOG `_notes/s12-button-migration.md`.

Tests: snapshot test de Button rendered en light/dark con todas las variants para detectar regresión visual.

---

## G12. EmptyState wrapper hero size mapping

**Detectado en:** Audit S4 §7 — `<EmptyState>` usa `64px / 40px` literales en wrapper hero del icon (filtered/error).

**Status S4:** 🟡 valores literales (mapping a tokens existe pero no aplicado).

**Sesión destino:** **S6** o **S9** (cuando se haga hi-fi de empty states).

**Propuesta de resolución.** Refactor del spec:

- `64×64` wrapper → `width: var(--space-16); height: var(--space-16);`.
- Ícono `40×40` → `width: var(--space-10); height: var(--space-10);`.

Verificar visualmente en hi-fi que el ratio se mantiene (60% ícono dentro del wrapper). Si se ve raro, sub-tokens custom.

---

## G13. Sub-token de border `1.5px` (Checkbox)

**Detectado en:** Audit §7 — Checkbox unchecked usa `border: 1.5px solid var(--border-strong)` para presencia funcional ≥3:1.

**Status S4:** 🟡 sub-pixel literal aceptado.

**Sesión destino:** **S12** (decisión técnica de implementación).

**Propuesta de resolución.** Dos opciones:

- (a) Aceptar `1.5px` como caso especial documentado en `tokens.md` §1.2 (el sistema ya tiene `--space-px` = `1px` y `--space-0_5` = `2px`). Cualquier sub-pixel intermedio es legítimo CSS y no necesita token.
- (b) Crear `--border-checkbox` token específico = `1.5px`. Probable overkill.

**Recomendación:** opción (a). Anotar excepción en `tokens.md` §1.2 cuando se aplique S12.

---

## Resumen ejecutivo

| Gap                                  | Tipo                 | Sesión destino | Bloqueante S5? |
| ------------------------------------ | -------------------- | -------------- | -------------- |
| G1. ProgressBar primitive            | componente nuevo     | S5/S6          | No             |
| G2. Pagination                       | componente nuevo     | S5             | No             |
| G3. VerifyEmailBanner                | componente del shell | S5             | No             |
| G4. Tab bar inferior mobile          | componente del shell | S5             | No             |
| G5. `--detail-sidebar-w`             | token nuevo          | S5             | No             |
| G6. `--drawer-w-narrow/-wide`        | tokens nuevos        | S5             | No             |
| G7. `--motion-shell-push`            | token (o reuso)      | S5             | No             |
| G8. Skeleton primitive               | componente nuevo     | S9             | No             |
| G9. Lint rules ADR 0006              | tooling              | S12            | No             |
| G10. Audit glyph/status cross-paleta | audit consolidado    | S6/S12         | No             |
| G11. Migración legacy text-white     | tooling              | S12            | No             |
| G12. EmptyState wrapper sizes        | refactor menor       | S6/S9          | No             |
| G13. Sub-token border 1.5px          | doc tokens.md        | S12            | No             |

**Total gaps:** 13. **Bloqueantes para S5:** 0. Todos resolubles en sesión destino sin afectar el catálogo S4.
