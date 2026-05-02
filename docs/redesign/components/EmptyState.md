---
title: EmptyState
tier: 2
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs: []
---

# EmptyState

## Propósito

Bloque centrado que comunica "aquí no hay nada todavía" o "tu filtro no devolvió resultados" o "algo se rompió". Aparece como hero del [`dashboard.md`](../screens/dashboard.md) cuando el usuario no tiene pedidos (mascota sleeping + CTA "Sumá tu primer pedido"), en el listado filtrado del [`orders-list.md`](../screens/orders-list.md) cuando filtros no matchean (ícono `search-x`, sin mascota), en errores 500 (ícono `alert-circle` en `--destructive`, sin mascota). Voice glossary cumple §7 principios — declarativo cálido, nunca corporativo.

## API TypeScript

```ts
import type { ReactNode } from "react";

type EmptyStateVariant = "general" | "filtered" | "error";
type EmptyStateSize = "sm" | "md" | "lg";

type EmptyStateCta = {
  label: string;
  href?: string;
  onClick?: () => void;
  /** Default `primary`. */
  variant?: "primary" | "ghost";
};

type EmptyStateProps = {
  /** Default `general`. Determina hero default + tono visual. */
  variant?: EmptyStateVariant;
  /** Hero visual: mascota sleeping (general), ícono Lucide (filtered/error), illustration. Si no se provee, el componente cae al default por variant. */
  hero?: ReactNode;
  /** Título principal. Voice glossary aplicado. */
  title: string;
  /** Descripción opcional. Body 15px, una a dos líneas máximo. */
  description?: string;
  /** CTA opcional. */
  cta?: EmptyStateCta;
  /** Tamaño. Default `md`. `lg` para hero pages, `sm` para empty inline en peek panels. */
  size?: EmptyStateSize;
};
```

## Variants / Sizes

| Variant     | Hero default                                                                | Uso                                                       |
| ----------- | --------------------------------------------------------------------------- | --------------------------------------------------------- |
| `general`   | `<MascotBubble variant="sleeping">` (decálogo §6 + directions.md §4.10)     | Empty hero — usuario sin pedidos / sin pre-órdenes / sin tiendas |
| `filtered`  | Ícono Lucide `search-x` 40px en `--text-muted`                              | Lista filtrada con 0 resultados — NO mascota (no es momento ceremonial) |
| `error`     | Ícono Lucide `alert-circle` 40px en `--destructive`                         | Error 500 — NO mascota (no celebra)                       |

| Size        | Padding                            | Hero size              | Title size           |
| ----------- | ---------------------------------- | ---------------------- | -------------------- |
| `sm`        | `var(--space-6)`                   | 24-32px                | `--text-body-lg`     |
| `md` (def)  | `var(--space-12)` mobile / `var(--space-16)` desktop | 40-56px | `--text-subtitle`    |
| `lg`        | `var(--space-16)` mobile / `var(--space-24)` desktop | 80-120px (mascot) | `--text-title`     |

## Estados visuales

| Estado    | Receta CSS (light)                                                                                                                                                                                                       | Receta CSS (dark) | Notas                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- | ---------------------------------------------------------------------------------------------- |
| `default` | `display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-4); padding: var(--space-12) var(--space-4); text-align: center;`                                                  | mismo             | Mobile padding `--space-12`; desktop `--space-16`. Centrado vertical + horizontal.             |
| `general` hero | mascot bubble 80-120px en `--lg`, 56px en `--md`. La mascota aporta el tono cálido — sin ícono adicional.                                                                                                            | mismo (mascot tiene dual lighting) | Single mascot expression: `sleeping`.                                                          |
| `filtered` hero | `<svg>` Lucide `search-x` 40px en `--text-muted`. Wrapper circular `var(--surface-elevated)` 64×64 con border `var(--border)` para respiro.                                                                            | mismo             | Sin mascota — empty filtrado no celebra.                                                       |
| `error` hero | `<svg>` Lucide `alert-circle` 40px en `--destructive`. Wrapper circular `color-mix(in oklch, var(--destructive) 8%, var(--background))` 64×64 con border `color-mix(in oklch, var(--destructive) 24%, var(--background))`. | mismo             | Sin mascota — error no celebra.                                                                |

Receta base CSS:

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  padding: var(--space-12) var(--space-4);
  text-align: center;
  max-width: var(--container-max-w-prose);
  margin-inline: auto;
}

@media (min-width: 48rem) {
  .empty-state {
    padding: var(--space-16) var(--space-4);
  }
}

.empty-state--lg {
  padding: var(--space-16) var(--space-4);
}

@media (min-width: 48rem) {
  .empty-state--lg {
    padding: var(--space-24) var(--space-4);
  }
}

.empty-state--sm {
  padding: var(--space-6);
}

.empty-state__hero {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.empty-state__hero--icon {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-pill);
  background: var(--surface-elevated);
  border: 1px solid var(--border);
}

.empty-state__hero--icon > svg {
  width: 40px;
  height: 40px;
  color: var(--text-muted);
}

.empty-state__hero--error {
  background: color-mix(in oklch, var(--destructive) 8%, var(--background));
  border-color: color-mix(in oklch, var(--destructive) 24%, var(--background));
}

.empty-state__hero--error > svg {
  color: var(--destructive);
}

.empty-state__title {
  font-family: var(--font-display);
  font-weight: var(--font-weight-title);
  font-size: var(--text-subtitle);
  line-height: var(--text-subtitle--line-height);
  letter-spacing: var(--text-subtitle--letter-spacing);
  color: var(--text-primary);
  margin: 0;
}

.empty-state__description {
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  color: var(--text-secondary);
  max-width: 36ch;
  margin: 0;
}

.empty-state__cta {
  margin-top: var(--space-2);
}
```

## Mobile vs desktop

- **Padding:** mobile `--space-12`; desktop `--space-16` para `md`. Para `lg`, mobile `--space-16`, desktop `--space-24`. Para `sm`, igual cross-viewport.
- **Hero mascota:** mobile 56-80px; desktop 80-120px (`lg`). El componente mascot es responsive interno.
- **Title:** `--text-subtitle` cross-viewport; `lg` escala a `--text-title`.
- **Description:** `--text-body` con `max-width: 36ch` para prose legible.
- **CTA:** stack debajo del título + descripción.

## Accesibilidad

- Rol ARIA: el wrapper es `<div role="status">` cuando se renderiza tras una mutación (filtro aplicado → 0 resultados); `<div>` neutral cuando es estado inicial.
- Atributos:
  - `aria-live="polite"` para `filtered` cuando aparece tras una mutación (filtros que se aplican y devuelven empty).
  - `aria-live="assertive"` para `error` (anuncio prioritario).
- Keyboard: el CTA recibe foco si Tab navega al bloque. El hero (mascot/ícono) no es focusable.
- Focus management: cuando el empty aparece tras una acción del usuario, mover foco al CTA si existe (post-mount via `useEffect`).
- Screen reader:
  - Lee título → descripción → CTA en orden.
  - Mascot va con `aria-hidden="true"`; el title ya da el contexto emocional.
  - Ícono `search-x` / `alert-circle` va con `aria-hidden="true"`.
- `prefers-reduced-motion`: la mascot sleeping reduce su breathing animation a fade puro; el icon hero se renderiza sin animación.
- Contraste: title `--text-primary` ≥13:1 sobre `--background`. Description `--text-secondary` ≥6:1. Ícono filtered `--text-muted` ≥4.5:1 (validado S3).

## Motion

- **Aparición:** fade-in opacity 0→1 en `--motion-base` `--ease-emphasis`. Hero puede tener slight scale `0.96→1` en `--motion-base` `--ease-out-expressive`.
- **Mascot sleeping breathing:** loop interno del componente mascot (definido en spec separado, fuera de S4 tier 2).
- **Cambio de variant (e.g. error → general post-recovery):** crossfade `--motion-base` `--ease-emphasis`.
- Bajo `prefers-reduced-motion`: solo opacity, sin scale.

## Copy default + i18n

| Clave i18n sugerida                              | Valor ES                                                |
| ------------------------------------------------ | ------------------------------------------------------- |
| `components.emptyState.general.orders.title`     | "Sin pedidos todavía. Suma uno y arrancamos."           |
| `components.emptyState.general.orders.cta`       | "Sumar pedido"                                          |
| `components.emptyState.general.preorders.title`  | "Sin pre-órdenes todavía. Suma una y empezamos."        |
| `components.emptyState.general.stores.title`     | "Vamos por tu primera tienda."                          |
| `components.emptyState.general.stores.cta`       | "Crear tienda"                                          |
| `components.emptyState.general.deliveries.title` | "Sin entregas todavía. Cuando llegue algo, lo anotamos." |
| `components.emptyState.filtered.orders.title`    | "Nada con esos filtros. ¿Quitamos alguno?"              |
| `components.emptyState.filtered.orders.cta`      | "Limpiar filtros"                                       |
| `components.emptyState.filtered.search.title`    | "Nada con eso. Probá otro término."                     |
| `components.emptyState.error.generic.title`      | "Algo se rompió de este lado."                          |
| `components.emptyState.error.generic.description`| "Dale otra vez. Si sigue, avisanos."                    |
| `components.emptyState.error.generic.cta`        | "Reintentar"                                            |

EN se deja para S12.

## Edge cases

1. **`general` sin `cta`:** se renderiza solo mascota + título. Anti-patrón si el contexto pide acción — siempre proveer CTA en empty primario.
2. **`filtered` sin `description`:** funciona solo con título — el copy "Nada con esos filtros. ¿Quitamos alguno?" ya implica la siguiente acción.
3. **`error` con CTA "Reintentar":** el handler dispara refetch. Si falla 3 veces, padre debe escalar a "Contactar soporte" en CTA secundario.
4. **`hero` custom (e.g. illustration de empty calendar):** soportado — sobrescribe el default por variant.
5. **`size: sm` dentro de un peek panel:** padding reducido `--space-6` para no romper el panel. Title cae a `--text-body-lg` para densidad.
6. **`description` con link inline (e.g. "Suma una o [importá las que tenés](/import)"):** soportado via ReactNode — el title acepta solo string, la description ReactNode.
7. **CTA con `onClick` async (e.g. retry):** el padre maneja loading state externamente. El componente no tiene estado loading propio.
8. **Empty state dentro de modal:** padding se reduce a `--space-8` automáticamente — opcional, padre puede forzar via clase modificadora.
9. **Mascot sleeping en dark mode:** el componente mascot tiene dual lighting (rim light obligatorio en dark). El empty state solo lo invoca.
10. **Empty state durante carga (skeleton vs empty):** mientras loading, mostrar skeleton — empty state NO durante loading.

## Anti-patrones

1. **Mascota en `filtered`:** no es momento ceremonial. Mascot solo en `general` (decálogo §6).
2. **Mascota en `error`:** la mascot no celebra cuando algo se rompe. Ícono `alert-circle` `--destructive`.
3. **Copy corporativo ("No se encontraron resultados"):** voice glossary §7 prohíbe.
4. **Emoji en error:** voice glossary — emoji solo en momentos celebratorios (✨ 🎉 🌱), nunca en error.
5. **`opacity: 0.5` en hero:** rompe AA (icon en `--text-muted` ya da el tono).
6. **CTA sin label claro ("Click here"):** voice glossary — CTAs descriptivos.
7. **Empty state oculta el filter bar (`filtered`):** el filter bar/rail debe permanecer visible para que el usuario pueda quitar filtros uno a uno.
8. **Title >12 palabras:** voice glossary §7 — una idea por línea.

## Ejemplos de uso

```tsx
// Dashboard hero · usuario sin pedidos
<EmptyState
  variant="general"
  size="lg"
  title="Sin pedidos todavía. Suma uno y arrancamos."
  description="Anotá tu primer pedido y vemos tus pagos, fechas y entregas en un solo lugar."
  cta={{ label: "Sumar pedido", href: "/orders/new", variant: "primary" }}
/>

// Orders list · filtros aplicados, 0 resultados
<EmptyState
  variant="filtered"
  size="md"
  title="Nada con esos filtros. ¿Quitamos alguno?"
  cta={{ label: "Limpiar filtros", onClick: clearFilters, variant: "ghost" }}
/>

// Error 500 page
<EmptyState
  variant="error"
  size="md"
  title="Algo se rompió de este lado."
  description="Dale otra vez. Si sigue, avisanos."
  cta={{ label: "Reintentar", onClick: retry, variant: "primary" }}
/>
```

## Tokens consumidos

- `--background`, `--surface-elevated`
- `--border`
- `--text-primary`, `--text-secondary`, `--text-muted`
- `--destructive`
- `--font-display`, `--font-weight-title`
- `--text-title`, `--text-subtitle`, `--text-body-lg`, `--text-body`
- `--radius-pill`
- `--space-2`, `--space-4`, `--space-6`, `--space-8`, `--space-12`, `--space-16`, `--space-24`
- `--container-max-w-prose`
- `--motion-base`, `--ease-emphasis`, `--ease-out-expressive`
- `--breakpoint-md`

## ADRs aplicables

Ninguno directo. La voice glossary se rige por `principles.md §7`.

## Dependencias

- `<MascotBubble variant="sleeping">` (componente mascot, fuera de S4 tier 2 — vive en spec separado).
- [`./Card.md`](./Card.md) (no dep directa, pero el padre puede envolver el empty en una `<Card>` si lo necesita).
- Iconos `lucide-react` (`search-x`, `alert-circle`, `filter` opcional).
- Botón primary/ghost para el CTA (componente Button, definido en otro spec).

## Notas para S12 (implementación)

1. La selección automática del hero por variant requiere que el componente `<MascotBubble>` exista — definir spec separado en S4 tier 3 o S5.
2. El `description` como ReactNode permite link inline; validar que el `aria-live` no anuncie repetidamente el link.
3. Decidir si el componente exporta sub-componentes (`EmptyState.Hero`, `EmptyState.Title`) para casos custom. MVP: API plana.
4. Para `error` variant, considerar capturar el error en Sentry desde el padre — el componente no orquesta logging.
5. Validar que el `aria-live` no se duplique cuando el empty se renderiza dentro de un panel que ya tiene su propio live region.
6. Para empty inline en peek panels (`size: sm`), validar que la mascota se reduce sin romper proporciones (decisión: `sm` excluye mascota — usar ícono).
7. Considerar prop `onCta` separada del `cta.onClick` para tracking analytics consistente. MVP: el padre tracker en el handler del CTA.
