---
title: Pagination
tier: 2
status: spec — S5 (ready for implementation)
last_updated: 2026-05-02
session: 05-app-shell
adrs:
  - ADR 0001 D9 (desktop paginación clásica numerada, pageSize 30; mobile "Cargar más", pageSize 20)
---

# Pagination

## Propósito

Controles de paginación para listas largas. Dos variantes contractualmente distintas per ADR 0001 D9:

- **`classic`** — paginador numerado para desktop (`« ‹ 1 2 3 › »`). pageSize 30.
- **`load-more`** — botón "Cargar más" para mobile. pageSize 20.

El consumer decide qué variant montar según breakpoint. No hay modo responsive interno — el layout padre decide.

Aparece en: `screens/orders-list.md` (desktop + mobile), `screens/stores-list.md` (futuro S6), `screens/deliveries-list.md` (futuro S8).

## API TypeScript

```ts
type PaginationVariant = "classic" | "load-more";

type PaginationClassicProps = {
  variant: "classic";
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Número de páginas numeradas visibles alrededor de la current. Default 2. */
  siblingCount?: number;
  /** Mostrar botones first/last (« »). Default true. */
  showFirstLast?: boolean;
  /** Tamaño de página informativo (no cambia behavior). */
  pageSize?: number;
  /** Texto personalizado "Página X de Y". */
  ariaLabel?: string;
};

type PaginationLoadMoreProps = {
  variant: "load-more";
  /** Si hay más páginas disponibles. Cuando `false` el botón no se renderiza. */
  hasMore: boolean;
  /** Si se está cargando la siguiente página. */
  loading?: boolean;
  onLoadMore: () => void;
  /** Cuántos items se mostraron ya (para copy). */
  loadedCount?: number;
  /** Total de items disponibles (para copy). */
  totalCount?: number;
};

type PaginationProps = PaginationClassicProps | PaginationLoadMoreProps;
```

Reglas TS:

- `variant` discrimina el tipo — TypeScript rechaza props de `classic` en `load-more` y viceversa.
- `currentPage` debe ser ≥1.
- `totalPages` debe ser ≥1.
- `onPageChange` se llama solo cuando la página destino ≠ `currentPage`.

## Variants / Sizes

### `classic`

Layout horizontal `<nav>` con botones de página numerados:

```
«  ‹  1  2  [3]  4  5  ›  »
              ↑ current
```

- Botones `«` (first) y `»` (last): solo cuando `showFirstLast={true}` (default) y `currentPage > 1` / `currentPage < totalPages`.
- Botones `‹` (prev) y `›` (next): siempre visibles; `disabled` en extremos.
- Páginas numéricas: `siblingCount` páginas a cada lado del current + first/last siempre visibles. Ellipsis `…` cuando hay gap.
- Current page: no es link, estado visual diferenciado (accent tinte 14% bg / accent 28% border, `--font-weight-semibold`).

### `load-more`

Un solo botón full-width centrado con copy dinámico. Cuando `hasMore={false}` no renderiza nada.

## Estados visuales

### `classic` — botones de página

| Estado        | Receta CSS (light)                                                                                                                                                                                                    | Receta CSS (dark) |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| idle          | `min-width: 2.5rem; min-height: 2.5rem; background: transparent; color: var(--text-primary); border: 1px solid transparent; border-radius: var(--radius-md);`                                                         | mismo             |
| hover         | overlay `color-mix(in oklch, var(--text-primary) 6%, transparent)`                                                                                                                                                    | mix=8%            |
| pressed       | overlay mix=12%                                                                                                                                                                                                       | 14%               |
| focus-visible | `outline: 2px solid var(--focus-ring); outline-offset: 2px;`                                                                                                                                                          | mismo             |
| current       | `background: color-mix(in oklch, var(--accent) 14%, var(--surface)); border: 1px solid color-mix(in oklch, var(--accent) 28%, var(--surface)); color: var(--text-primary); font-weight: var(--font-weight-semibold);` | mismo patrón      |
| disabled      | `color: var(--text-muted); pointer-events: none;` (no opacity)                                                                                                                                                        | mismo             |
| ellipsis      | `color: var(--text-muted); pointer-events: none; min-width: 2.5rem;`                                                                                                                                                  | mismo             |

### `load-more` — botón

Hereda la receta de `<Button variant="secondary">` (spec `components/Button.md`). Estado loading: `<Lucide loader-2>` animado reemplaza el ícono principal.

## Mobile vs desktop

| Aspecto      | Mobile                                     | Desktop                                               |
| ------------ | ------------------------------------------ | ----------------------------------------------------- |
| Variant rec. | `load-more` (ADR 0001 D9)                  | `classic` (ADR 0001 D9)                               |
| Montaje      | El layout padre monta la variante correcta | El layout padre monta la variante correcta            |
| Tap target   | Botón `load-more` full-width ≥ 44px height | Botones numéricos ≥ 2.5rem (40px) — desktop aceptable |

## Accesibilidad

### `classic`

- `<nav aria-label={ariaLabel ?? "Paginación"}>` wrapping.
- Cada botón: `<button aria-label="Ir a la página N">` para páginas numéricas; `aria-label="Página anterior"` / `aria-label="Página siguiente"` para prev/next; `aria-label="Primera página"` / `aria-label="Última página"` para first/last.
- Current: `aria-current="page"` en el botón de la página actual. También `aria-disabled="true"` + `disabled` attribute.
- Ellipsis: `<span aria-hidden="true">…</span>`.
- Keyboard: Tab navega entre botones. Enter/Space activa. Home/End van a first/last si están habilitados.

### `load-more`

- `<button aria-busy={loading}>` en el botón.
- Cuando loading: `aria-label="Cargando más resultados"`.
- Cuando disponible: `aria-label="Cargar más resultados"`.

## Motion

| Qué                     | Token de duración | Token de easing   | Notas                        |
| ----------------------- | ----------------- | ----------------- | ---------------------------- |
| State layer botones     | `--motion-fast`   | `--ease-emphasis` | Hover/pressed.               |
| Botón load-more loading | N/A (loader-2)    | N/A               | Rotación del spinner Lucide. |

## Copy default + i18n

| Clave i18n sugerida                     | Valor ES                        |
| --------------------------------------- | ------------------------------- |
| `components.pagination.prev`            | "Página anterior"               |
| `components.pagination.next`            | "Página siguiente"              |
| `components.pagination.first`           | "Primera página"                |
| `components.pagination.last`            | "Última página"                 |
| `components.pagination.page`            | "Página {current} de {total}"   |
| `components.pagination.goToPage`        | "Ir a la página {page}"         |
| `components.pagination.ellipsis`        | "..."                           |
| `components.pagination.loadMore`        | "Cargar más"                    |
| `components.pagination.loadMoreLoading` | "Cargando..."                   |
| `components.pagination.loadMoreCount`   | "Mostrando {loaded} de {total}" |
| `components.pagination.ariaLabel`       | "Paginación"                    |

EN se completa en S12.

## Edge cases

1. **totalPages = 1**: `classic` no renderiza nada (no hay necesidad de navegar entre páginas).
2. **currentPage = 1**: prev + first `disabled`. No ellipsis izquierdo.
3. **currentPage = totalPages**: next + last `disabled`. No ellipsis derecho.
4. **totalPages muy grande** (100+): ellipsis agrupa. Siempre visible: first, last, current ± siblingCount.
5. **hasMore = false + load-more**: componente no renderiza. El consumer maneja el estado "no hay más".
6. **Click doble en load-more durante loading**: `pointer-events: none` cuando `loading={true}`.
7. **Cambio brusco de totalPages** (resultado filtrado reduce de 10 a 1): si `currentPage > totalPages`, el consumer debe resetear a página 1 antes de pasar el prop.

## Anti-patrones

1. **Infinite scroll como default**: ADR 0001 D9 prohíbe scroll sentinel. Siempre `load-more` o `classic`.
2. **`currentPage` basado en 0**: la API es 1-based para consistencia con UX.
3. **Usar Pagination para tabs**: son cosas distintas. Pagination = listas paginadas.
4. **load-more con botón disabled permanente**: cuando `hasMore={false}` el botón no debe aparecer.
5. **Ocultar con opacity cuando disabled**: usar `pointer-events: none` + `color: var(--text-muted)`.

## Ejemplos de uso

```tsx
// Desktop — classic
<Pagination
  variant="classic"
  currentPage={currentPage}
  totalPages={Math.ceil(total / PAGE_SIZE)}
  onPageChange={setCurrentPage}
  pageSize={PAGE_SIZE}
/>

// Mobile — load-more
<Pagination
  variant="load-more"
  hasMore={hasNextPage}
  loading={isFetching}
  loadedCount={orders.length}
  totalCount={total}
  onLoadMore={loadNextPage}
/>
```

## Tokens consumidos

- `--text-primary`, `--text-muted`
- `--accent` (current state via color-mix 14%/28%)
- `--border` (botón hover border)
- `--focus-ring`
- `--font-weight-semibold`
- `--radius-md` (botones numéricos)
- `--radius-pill` (botón load-more)
- `--space-2`, `--space-3` (padding botones)
- `--motion-fast`
- `--ease-emphasis`
- `--state-hover-mix`, `--state-pressed-mix`

## ADRs aplicables

- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md): D9 (paginación: desktop classic pageSize 30; mobile load-more pageSize 20; prohibición de infinite scroll).

## Dependencias

- `<Button>` ([`Button.md`](./Button.md)) — base del `load-more`.
- Lucide icons: `chevron-left`, `chevron-right`, `chevrons-left`, `chevrons-right`, `loader-2`.

## Notas para S5 (implementación)

1. Implementar como `src/components/core/Pagination.tsx` — atom complejo pero sin estado propio de servidor, va en core.
2. El algoritmo de `siblingCount` para generar el array de páginas con ellipsis: usar una función pura `generatePageRange(current, total, siblingCount)` exportada para testear.
3. Tests: range generation (current=1, middle, last), ellipsis positions, disabled states, ARIA attributes, load-more hasMore=false.
4. No hacer fetch — el componente es presentacional. El consumer maneja el fetching.
