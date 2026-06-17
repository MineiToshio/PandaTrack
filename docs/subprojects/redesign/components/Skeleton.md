---
title: Skeleton
tier: 1
status: implementado
last_updated: 2026-06-13
session: 10-cross-cutting-states
adrs:
  - ADR 0013
---

# Skeleton

## Propósito

Atom canónico de carga (ADR 0013). Render del shimmer compartido para hueco de contenido mientras Next resuelve trabajo **server** de una pantalla con layout predecible (listas, detalle, form), entregado por SSR vía `loading.tsx` / `<Suspense>`. Supersede las recetas ad-hoc por módulo: el demo prototipó el CSS como `.s10-skel`, pero la clase **shipeada** es `.skeleton` en [`globals.css`](../../../src/app/globals.css). Cuándo usar skeleton vs spinner vs nada está congelado en `PLAYBOOK §10.1`: skeleton para trabajo server por ruta, `<Loader2>` spinner solo para acciones cortas que el usuario dispara (submit, búsqueda, autosave), nada en mutaciones optimistas, y **prohibido** el fake client fallback (`dynamic(..., { loading })`) para UI que igual se renderiza SSR.

Implementación shipeada: [`src/components/core/Skeleton.tsx`](../../../src/components/core/Skeleton.tsx).

## API TypeScript

```ts
type SkeletonVariant = "text" | "circle" | "rect" | "pill";

type SkeletonProps = {
  /** Forma. `text` (línea/s), `circle` (avatar), `rect` (bloque), `pill` (chip). Default `rect`. */
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  /** Para `text`: número de líneas apiladas. La última se acorta a 65 %. Ignorado en otras variantes. */
  lines?: number;
  className?: string;
};
```

Reglas TS:

- Sizes numéricos se interpretan como px (`width={120}` → `120px`); strings pasan tal cual (`width="60%"`).
- `lines` solo aplica a `variant="text"`. Con `lines > 1` se renderiza un `<span>` columna; la última línea usa `65%` para leer como párrafo.

## Variants / Sizes

| Variant  | Radio                     | Uso                                                |
| -------- | ------------------------- | -------------------------------------------------- |
| `text`   | `rounded-[4px]`           | Líneas de texto (single o multi-line vía `lines`). |
| `rect`   | `rounded-[6px]` (default) | Bloques, thumbnails, tiles.                        |
| `circle` | `rounded-full`            | Avatares, icon-wells.                              |
| `pill`   | `rounded-full`            | Chips, badges, status placeholders.                |

## Estados visuales

| Estado    | Receta CSS (atom `.skeleton`)                                                                                                                                                                                                                                                                                                                          | Notas                                                                                                                                                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default` | `--skeleton-base: color-mix(in oklab, var(--text-primary) 8%, transparent); --skeleton-highlight: color-mix(in oklab, var(--text-primary) 16%, transparent); background: linear-gradient(90deg, var(--skeleton-base), var(--skeleton-highlight), var(--skeleton-base)); background-size: 200% 100%; animation: skeleton-shimmer 1.4s linear infinite;` | Mezcla neutra sobre `--text-primary` (no `--border`, que se aplana en dark). **Shimmer, no pulse.** `oklab` por L074. **color-mix por custom property, NO como color-stop del gradiente (L079)** — Lightning CSS descarta la regla si no. |
| `reduced` | (`prefers-reduced-motion: reduce`) `animation: none; background: var(--skeleton-base);`                                                                                                                                                                                                                                                                | Relleno estático sin shimmer. Obligatorio.                                                                                                                                                                                                |

## Accesibilidad

- **Contrato de a11y (dividido entre atom y contenedor):**
  - El atom `<Skeleton>` es **`aria-hidden`** — es decoración pura, no comunica información al screen reader.
  - El **contenedor consumidor** posee `aria-busy="true"` + un `aria-label` localizado (`components.skeleton.loading` = "Cargando…").
- No interactivo. Sin foco ni rol semántico propio.
- `prefers-reduced-motion: reduce`: shimmer → relleno estático (ver Estados visuales). El contenedor sigue anunciando el estado de carga.

## Composición

Los skeletons de lista / card / detail-hero / form **componen** este atom (reflejan el layout real que reemplazan para que el shimmer no "salte" al llegar el contenido):

- Las listas densas (`OrderListLoadingSkeleton`, `DeliveryListLoadingSkeleton`, `StoreListingGridSkeleton`) consumen la **clase CSS `.skeleton` directamente** (la receta del atom).
- Los composites nuevos (p. ej. `OrderDetailLoadingSkeleton`) usan el **componente `<Skeleton>`**.
- Ambos caminos son válidos: la clase `.skeleton` **es** el atom que ambos comparten.

## Tokens consumidos

- `--text-primary` (mezcla 8→16→8 % shimmer vía custom props; reduced-motion estático en `--skeleton-base`)
- Border-radius por variante vía literales Tailwind (`rounded-[4px]` / `rounded-[6px]` / `rounded-full`)

## Anti-patrones

1. **Receta de skeleton ad-hoc por módulo**: prohibido (`PLAYBOOK §10.7`). Una sola receta `.skeleton`.
2. **`animate-pulse` (pulse en vez de shimmer)** o pulse sin `motion-safe:`: la receta canónica es shimmer y respeta reduced-motion.
3. **Relleno con `--border`**: se aplana en dark; usar mezcla sobre `--text-primary`.
4. **Fake client fallback** (`dynamic(..., { loading })`) para UI que igual se renderiza SSR: el skeleton no aparece y suma complejidad (`react-next-components.mdc`).
5. **Spinner como fallback de ruta** o skeleton para una acción corta que dispara el usuario: invierte el contrato de `PLAYBOOK §10.1`.
6. **`aria-busy` en el atom**: el estado de carga lo posee el contenedor, no el atom decorativo.

## Ejemplos de uso

```tsx
// Línea de texto multi-línea (última acortada a 65 %)
<Skeleton variant="text" lines={3} />

// Avatar redondo + bloque
<div aria-busy="true" aria-label={t("components.skeleton.loading")}>
  <Skeleton variant="circle" width={40} height={40} />
  <Skeleton variant="rect" width="100%" height={120} />
</div>

// Chip placeholder
<Skeleton variant="pill" width={72} height={24} />
```

## ADRs aplicables

- [ADR 0013 — Cross-cutting state system](../decisions/0013-cross-cutting-state-system.md): skeleton canónico = shimmer, reduced-motion estático, a11y atom/contenedor.

## Dependencias

Ninguna. Atom puro — consume solo tokens y la clase `.skeleton` de `globals.css`.

## Demo

Anchor `#s10-skeleton-anatomy` (`_notes/demo-screens.html`): muestra el atom (4 formas) + las 4 composiciones canónicas.
