---
title: FilterDrawer
tier: 3
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0003 D8 (filter drawer unificado mobile sheet / desktop drawer)
  - ADR 0002 (enums de filtros — orderStatus / deliveryStatus)
  - ADR 0001 D3 (disabled sin opacity)
---

# FilterDrawer

## Propósito

Drawer único de filtros para listas — bottom sheet en mobile, drawer derecho en desktop. Aplica a [`/orders`](../screens/orders-list.md), `/deliveries` y `/stores`. Configurable de forma declarativa con secciones tipadas (pills, pills-search, icon-pills, date-range, switches). Footer sticky con conteo de resultados en vivo y CTAs `Limpiar` / `Aplicar`. Respeta los enums vinculantes de [ADR 0002](../decisions/0002-status-chip-mapping.md) para filtros de estado.

## API TypeScript

```ts
type FilterPillsSection = {
  id: string;
  label: string;
  type: "pills";
  options: Array<{ value: string; label: string }>;
  /** Default `true`. Si `false`, pills funcionan como single-select (radio-like). */
  multi?: boolean;
};

type FilterPillsSearchSection = {
  id: string;
  label: string;
  type: "pills-search";
  options: Array<{ value: string; label: string }>;
  /** Placeholder del search inline. Default voice glossary. */
  placeholder?: string;
};

type FilterIconPillsSection = {
  id: string;
  label: string;
  type: "icon-pills";
  options: Array<{
    value: string;
    label: string;
    /** Nombre del ícono Lucide (ej. `disc`, `book-open`). El componente resuelve a ReactNode. */
    icon: string;
  }>;
};

type FilterDateRangeSection = {
  id: string;
  label: string;
  type: "date-range";
};

type FilterSwitchesSection = {
  id: string;
  label: string;
  type: "switches";
  options: Array<{ value: string; label: string }>;
};

type FilterSection =
  | FilterPillsSection
  | FilterPillsSearchSection
  | FilterIconPillsSection
  | FilterDateRangeSection
  | FilterSwitchesSection;

type FilterConfig = {
  sections: FilterSection[];
};

type FilterDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Título del drawer ("Filtrar pedidos", "Filtrar entregas", "Filtrar tiendas"). */
  title: string;
  config: FilterConfig;
  /** Estado controlado: `{[sectionId]: unknown}` — el shape depende del tipo de sección. */
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  /** Cierra y commitea el filtro al consumer. */
  onApply: () => void;
  /** Vacía todas las secciones. */
  onClear: () => void;
  /** Conteo de resultados actuales. Se actualiza en vivo conforme `values` cambia. */
  resultsCount: number;
};
```

### Shape de `values` por tipo de sección

| `type`           | Shape de `values[id]`                                        |
| ---------------- | ------------------------------------------------------------ |
| `pills`          | `string[]` (multi) o `string \| null` (single)               |
| `pills-search`   | `string[]`                                                   |
| `icon-pills`     | `string[]`                                                   |
| `date-range`     | `{ from: string \| null; to: string \| null }` (ISO YYYY-MM-DD) |
| `switches`       | `string[]` (ids de switches en `on`)                         |

## Variants / Sizes

| Variant (responsive) | Uso                                                                   | Tokens consumidos                                                                                        |
| -------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Bottom sheet (`< md`) | Mobile filter sheet con drag handle y slide vertical.                 | `--sheet-max-h`, `--radius-2xl` arriba, `--z-sheet`, `--motion-base`, `--ease-out-expressive`.            |
| Side drawer (`≥ md`)  | Desktop drawer derecho ancho `--drawer-w` (440px).                    | `--drawer-w`, `--radius-xl` izq, `--z-drawer`, `--elevation-2`, `--motion-base`, `--ease-out-expressive`. |

No hay variant cromática — el drawer mantiene fondo `--surface-elevated` en ambos modos.

## Estados visuales

| Estado            | Receta CSS (light)                                                                                                                                                       | Receta CSS (dark)                                                                                                                                          | Notas                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Backdrop          | `background: var(--surface-overlay); position: fixed; inset: 0; z-index: var(--z-modal-backdrop);` *(reutiliza scrim modal porque el drawer es modal)*                  | mismo                                                                                                                                                       | Click en backdrop → `onOpenChange(false)`.                                                                                          |
| Sheet (mobile)    | `background: var(--surface-elevated); border-radius: var(--radius-2xl) var(--radius-2xl) 0 0; max-height: var(--sheet-max-h); box-shadow: var(--elevation-3);`            | mismo + composición de `--elevation-3` dark                                                                                                                 | Drag handle 4×40 `--text-muted` `--radius-pill` arriba con padding `--space-2`.                                                     |
| Drawer (desktop)  | `background: var(--surface-elevated); border-radius: var(--radius-xl) 0 0 var(--radius-xl); width: var(--drawer-w); height: 100vh; box-shadow: var(--elevation-2);`        | mismo + composición dark                                                                                                                                    | Anclado a la derecha, slide horizontal.                                                                                             |
| Header            | `padding: var(--space-4) var(--space-5); display: flex; align-items: center; gap: var(--space-3); border-bottom: 1px solid var(--border);`                                | mismo                                                                                                                                                       | Ícono Lucide `sliders-horizontal` 20×20 en `--text-secondary` + título `--text-subtitle` en `--text-primary`. IconButton `x` a la derecha. |
| Body              | `padding: var(--space-4) var(--space-5); overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: var(--space-6);`                                          | mismo                                                                                                                                                       | Cada sección tiene su propio header eyebrow + control.                                                                              |
| Footer (sticky)   | `padding: var(--space-3) var(--space-5); border-top: 1px solid var(--border); display: flex; justify-content: space-between; gap: var(--space-3); background: var(--surface-elevated);` | mismo                                                                                                                                                       | Ghost `Limpiar` izq, primary `Aplicar (N resultados)` der.                                                                          |
| Pill idle         | StatusChip `neutral`: `background: var(--surface); border: 1px solid var(--border-strong); color: var(--text-secondary);`                                                  | mismo                                                                                                                                                       | Tap target ≥ 44×44 mobile.                                                                                                          |
| Pill selected     | `background: color-mix(in oklch, var(--accent) var(--state-selected-bg-mix), var(--surface)); border: 1px solid color-mix(in oklch, var(--accent) var(--state-selected-border-mix), var(--surface)); color: var(--accent);` | mismo                                                                                                                                                       | Patrón `state-selected` de tokens-css §4.                                                                                            |
| Icon-pill (idle)  | mismo `pill idle` + ícono Lucide 16×16 en `--accent-cool` leading + label `--text-secondary`. **`--accent-cool` requiere label adyacente** (ADR 0006).                     | mismo                                                                                                                                                       | El ícono nunca aparece sin label.                                                                                                    |
| Icon-pill (selected) | mismo `pill selected` + ícono mantiene su color `--accent-cool`                                                                                                          | mismo                                                                                                                                                       | El selected state lo da el bg+border, no el color del ícono.                                                                         |
| Switch row        | `display: flex; align-items: center; justify-content: space-between; padding: var(--space-2) 0;` con `<Switch>` Tier 1 + `<Label>` Tier 1                                | mismo                                                                                                                                                       | Tap target del switch ≥ 44×44.                                                                                                       |
| Date-range row    | Dos `<DateInput>` Tier 1 lado a lado con label `Desde` / `Hasta` arriba                                                                                                   | mismo                                                                                                                                                       | En mobile `< xs` se stackea vertical.                                                                                                |
| Pills-search input | `<Input variant="search">` Tier 1 + lista filtrable de pills debajo                                                                                                       | mismo                                                                                                                                                       | Filtro case-insensitive sobre `label`.                                                                                                |
| Disabled (state)  | `color: var(--text-muted); border-color: var(--border); pointer-events: none;` (sin `opacity`)                                                                            | mismo                                                                                                                                                       | ADR 0001 D3.                                                                                                                          |
| Focus visible     | `outline: 2px solid var(--focus-ring); outline-offset: 2px;` en cualquier control interactivo                                                                             | mismo                                                                                                                                                       | —                                                                                                                                    |

## Mobile vs desktop

- **`< --breakpoint-md`:** bottom sheet con drag handle 4×40 (`--text-muted`, `--radius-pill`) en el header. Slide vertical `translateY(100%) → translateY(0)` con `--motion-base` `--ease-out-expressive`. `max-height: var(--sheet-max-h)` (92svh). `z-index: var(--z-sheet)`. Cierre por swipe down si la posición de scroll del body está en top, o por click en backdrop. El header sticky superior del sheet absorbe el drag handle.
- **`≥ --breakpoint-md`:** drawer derecho width `--drawer-w` (440px). Slide horizontal `translateX(100%) → translateX(0)` con `--motion-base` `--ease-out-expressive`. `border-radius: var(--radius-xl) 0 0 var(--radius-xl)`. `z-index: var(--z-drawer)`. Sin drag handle; cierre via X, Esc o click en backdrop.

El `config` es idéntico en ambos breakpoints — sólo cambia el chrome. La cantidad y orden de secciones se preserva.

## Accesibilidad

- Rol ARIA: `role="dialog"` + `aria-modal="true"` en el contenedor. `aria-labelledby` apunta al título del header.
- Focus trap obligatorio mientras `open === true`. Foco inicial al primer control interactivo del body (o al botón X si el body está vacío). Al cerrar, foco vuelve al trigger que abrió el drawer (responsabilidad del consumer pasar la ref, S12 puede automatizar via `aria-controls`).
- Atributos requeridos:
  - Cada sección tiene `<fieldset>` con `<legend>` (visualmente eyebrow) o equivalente ARIA.
  - Cada pill: `<button role="checkbox" aria-checked={selected}>` para multi; `role="radio"` con `name` compartido cuando `multi: false`.
  - Switches: `<Switch>` Tier 1 ya cumple `role="switch"` + `aria-checked`.
  - Date-range: dos `<DateInput>` con labels claros `Desde` / `Hasta`.
- Keyboard:
  - `Tab` recorre header (X) → secciones → footer (Limpiar → Aplicar).
  - `Esc` → `onOpenChange(false)`.
  - Pills: `Space` toggle, `ArrowRight/Left` navega dentro del fieldset.
  - Pills-search: foco al input por default; `ArrowDown` baja a la primera pill filtrada.
- Screen reader: el conteo de resultados se anuncia via `aria-live="polite"` cuando cambia (rate limit interno por implementación — anotar en S12).
- `prefers-reduced-motion`: sin animar transform; sólo opacity con `--motion-fast`. El drag handle del sheet sigue clickable pero sin animación de drag visual.

## Motion

- **Apertura sheet (mobile):** `transform: translateY(100%) → translateY(0)` + `opacity: 0 → 1` en el contenedor; backdrop `opacity: 0 → 1`. Curve `--motion-base` `--ease-out-expressive`.
- **Apertura drawer (desktop):** `transform: translateX(100%) → translateX(0)` + `opacity: 0 → 1` con misma curve.
- **Cierre:** reverso con misma duración.
- **Pills toggle:** `background-color` + `border-color` + `color` con `--motion-fast` `--ease-emphasis`. Sin scale.
- **Switches:** `--motion-fast` (Tier 1 spec).
- **Footer count update:** sin animar el número (rompe lectura). Cambia de valor instantáneo. Opcional: subtle `opacity` blink `0.7 → 1` en `--motion-fast` cuando el conteo cambia mucho — decisión S12.
- **Reduced-motion:** sólo opacity con `--motion-fast` `--ease-emphasis`. Drag handle sin scaling.

## Copy default + i18n

| Clave i18n sugerida                                  | Valor ES (voice glossary aplicado)         |
| ---------------------------------------------------- | ------------------------------------------ |
| `components.filterDrawer.title.orders`               | "Filtrar pedidos"                          |
| `components.filterDrawer.title.deliveries`           | "Filtrar entregas"                         |
| `components.filterDrawer.title.stores`               | "Filtrar tiendas"                          |
| `components.filterDrawer.actions.clear`              | "Limpiar"                                  |
| `components.filterDrawer.actions.apply`              | "Aplicar ({count} resultados)"             |
| `components.filterDrawer.actions.applyZero`          | "Aplicar (sin resultados)"                 |
| `components.filterDrawer.actions.close`              | "Cerrar"                                   |
| `components.filterDrawer.search.placeholder`         | "Buscar"                                   |
| `components.filterDrawer.dateRange.from`             | "Desde"                                    |
| `components.filterDrawer.dateRange.to`               | "Hasta"                                    |
| `components.filterDrawer.aria.dialog`                | "Filtros"                                  |
| `components.filterDrawer.aria.resultsLive`           | "{count} resultados"                       |
| `components.filterDrawer.empty.search`               | "Nada con eso. Probá otro término."        |

EN se deja para S12.

## Edge cases

1. **`resultsCount === 0`:** botón Aplicar muestra `"Aplicar (sin resultados)"` y queda habilitado (el usuario puede aplicar para confirmar el vacío). Alternativa: deshabilitar — anotar como decisión S12 si telemetría lo justifica.
2. **`config.sections` vacío:** body muestra empty state `"No hay filtros disponibles."` en `--text-muted`. Footer mantiene `Limpiar` + `Aplicar` (no-op).
3. **`pills-search` con 0 matches:** muestra empty `"Nada con eso. Probá otro término."`; el input mantiene su valor para que el usuario edite.
4. **`date-range` con `from > to`:** componente NO valida — responsabilidad del consumer en `onApply`. El error se muestra inline bajo el input afectado vía `<ErrorMessage>` cuando el padre lo decide.
5. **Cerrar sin aplicar:** los `values` ya commiteados via `onChange` se preservan en el state del padre. Si el padre los desea descartar al cerrar, debe hacerlo explícitamente en `onOpenChange(false)`.
6. **Open=true pero el contenedor no existe en el DOM (SSR):** componente debe renderizar via portal en client-only (`useEffect` para mount). En SSR retorna `null`.
7. **Múltiples drawers abiertos a la vez:** prohibido — el padre debe gestionar exclusión. El componente NO se defiende.
8. **Cambio de breakpoint mientras open (resize):** transición de sheet a drawer (o viceversa) instantánea — sin animar el switch.
9. **Pills con muchas opciones (> 20):** el contenedor scrollea horizontal en mobile (`overflow-x: auto` con `scroll-snap`); en desktop wrap en múltiples filas con `flex-wrap`. Para listas grandes, recomendar `pills-search`.
10. **Switches con dependencia (ej. "Solo atrasadas" requiere `IN_TRANSIT`):** la dependencia no la maneja el drawer — el padre la valida en `onChange` y deshabilita el switch dependiente.
11. **Reduced-motion + sheet drag:** el drag handle visual queda pero sin gesture animation; cierre via tap en handle equivale a botón X.

## Anti-patrones

1. **Renderizar el drawer inline (sin portal):** rompe stacking en pantallas con sticky headers.
2. **Aplicar `opacity: 0.5` a controls deshabilitados:** ADR 0001 D3.
3. **Usar `--accent-cool` como background o border de pills:** ADR 0006 — sólo color de ícono con label adyacente.
4. **Esconder el footer fuera del viewport mobile:** el footer DEBE ser sticky para que el conteo y los CTAs siempre se vean.
5. **Animar el conteo numérico (counter-up):** entorpece lectura.
6. **Trapear foco fuera del drawer:** rompe a11y.
7. **Reusar el componente para drawers no-modal (ej. info panel):** este es modal por contrato. Para info panels usar otro Tier 3.
8. **Permitir `close on backdrop click` configurable:** el contrato es modal con backdrop dismissible. Si una variante futura quiere comportamiento distinto, crear otro componente.

## Ejemplos de uso

```tsx
// Orders list — 6 filtros (ADR 0003 D8 + ADR 0002)
const ordersConfig: FilterConfig = {
  sections: [
    {
      id: "status",
      label: "Estado del pedido",
      type: "pills",
      multi: true,
      options: [
        { value: "OPEN", label: "Abierto" },
        { value: "PARTIALLY_IN_TRANSIT", label: "Parcialmente en camino" },
        { value: "IN_TRANSIT", label: "En camino" },
        { value: "PARTIALLY_DELIVERED", label: "Llegó parcialmente" },
        { value: "COMPLETED", label: "Completo" },
        { value: "CANCELLED", label: "Cancelado" },
      ],
    },
    {
      id: "payment",
      label: "Pago",
      type: "pills",
      multi: true,
      options: [
        { value: "UNPAID", label: "Sin pagar" },
        { value: "PARTIAL", label: "Pago parcial" },
        { value: "PAID", label: "Pagado" },
        { value: "OVERDUE", label: "Atrasado" },
      ],
    },
    { id: "store", label: "Tienda", type: "pills-search", options: storeOptions },
    {
      id: "categories",
      label: "Categorías de producto",
      type: "icon-pills",
      options: [
        { value: "vinyl", label: "Vinilos", icon: "disc" },
        { value: "manga", label: "Manga", icon: "book-open" },
        { value: "figures", label: "Figuras", icon: "shapes" },
      ],
    },
    { id: "orderDates", label: "Fechas de pedido", type: "date-range" },
    { id: "arrivalDates", label: "Fechas de llegada", type: "date-range" },
  ],
};

<FilterDrawer
  open={open}
  onOpenChange={setOpen}
  title="Filtrar pedidos"
  config={ordersConfig}
  values={filters}
  onChange={setFilters}
  onApply={() => {
    commitFilters(filters);
    setOpen(false);
  }}
  onClear={() => setFilters({})}
  resultsCount={previewCount}
/>;

// Deliveries list — 5 filtros
const deliveriesConfig: FilterConfig = {
  sections: [
    {
      id: "status",
      label: "Estado de la entrega",
      type: "pills",
      multi: true,
      options: [
        { value: "IN_TRANSIT", label: "En camino" },
        { value: "DELIVERED", label: "Llegó" },
        { value: "CANCELLED", label: "Cancelada" },
      ],
    },
    {
      id: "flags",
      label: "Atajos",
      type: "switches",
      options: [{ value: "overdueOnly", label: "Solo atrasadas" }],
    },
    { id: "store", label: "Tienda", type: "pills-search", options: storeOptions },
    { id: "deliveryDates", label: "Fechas de entrega", type: "date-range" },
    { id: "etaDates", label: "Fechas de ETA", type: "date-range" },
  ],
};
```

## Tokens consumidos

- `--surface`, `--surface-elevated`, `--surface-overlay`
- `--border`, `--border-strong`
- `--text-primary`, `--text-secondary`, `--text-muted`
- `--accent`, `--accent-cool`
- `--focus-ring`
- `--space-2`, `--space-3`, `--space-4`, `--space-5`, `--space-6`
- `--radius-xl`, `--radius-2xl`, `--radius-pill`
- `--elevation-2`, `--elevation-3`
- `--motion-fast`, `--motion-base`
- `--ease-emphasis`, `--ease-out-expressive`
- `--state-selected-bg-mix`, `--state-selected-border-mix`
- `--drawer-w`, `--sheet-max-h`
- `--z-sheet`, `--z-drawer`, `--z-modal-backdrop`
- `--text-eyebrow`, `--text-subtitle`, `--text-body`, `--text-caption`
- `--breakpoint-md`

## ADRs aplicables

- [ADR 0003 — Decisiones consolidadas del demo visual](../decisions/0003-demo-decisions.md) (D8 filter drawer)
- [ADR 0002 — Status chip mapping](../decisions/0002-status-chip-mapping.md) (enums de filtros)
- [ADR 0001 — Decisiones de cierre de Sesión 2](../decisions/0001-s2-closure-decisions.md) (D3 disabled sin opacity)
- [ADR 0006 — Color blindness icon+label contract](../decisions/0006-color-blindness-icon-label-contract.md) (icon-pills + `--accent-cool` con label adyacente)

## Dependencias

- (Tier 4 pendiente) `<Sheet>` — chrome bottom sheet mobile.
- (Tier 4 pendiente) `<Drawer>` — chrome side drawer desktop. Si MVP comparte un solo Tier 3 (este), inlinear ambas variantes y diferenciar via media query.
- (Tier 2 pendiente) `<StatusChip>` variant `neutral` (idle) y `accent` (selected) — base de pills.
- (Tier 1) [`./Input.md`](./Input.md) — variant `search` para pills-search.
- (Tier 1) [`./DateInput.md`](./DateInput.md) — date-range usa dos.
- (Tier 1) [`./Switch.md`](./Switch.md) — switches.
- (Tier 1) [`./Label.md`](./Label.md) — fieldset legends.
- (Tier 2 pendiente) `<Button>` `variant="ghost"` (Limpiar) y `variant="primary"` (Aplicar).
- (Tier 2 pendiente) `<IconButton>` — close X.

## Notas para S12 (implementación)

1. **Resolución del nombre de ícono Lucide:** el componente recibe `icon: string` en `icon-pills` y lo resuelve a `<LucideIcon name={icon} />`. Validar el set permitido en lint para evitar nombres inválidos.
2. **Live count debounce:** el `resultsCount` que viene del padre puede oscilar mientras el usuario tipea filtros. Sugerencia: el padre usa debounce 200ms antes de pedir el count; el drawer sólo lo refleja.
3. **Focus return on close:** `useEffect` que captura `document.activeElement` antes de open y lo restaura después de close.
4. **Portal target:** `document.body` o `#filter-drawer-root`. Definir en S12.
5. **Drag-to-dismiss en mobile:** opcional MVP. Si se implementa, usar Vaul-style — arrastre debe respetar scroll del body interno (sólo dismiss si scrollTop === 0).
6. **Persistencia de filtros activos:** decisión del padre (URL params, localStorage, etc.). El drawer no persiste.
7. **Test E2E:** Playwright cubre (a) abrir-cerrar via X/Esc/backdrop, (b) toggle de pills, (c) live count update, (d) Aplicar dispara onApply y cierra, (e) Limpiar resetea.
8. **Performance con muchos filtros:** si `config.sections.length > 8`, el body puede sentirse pesado en mobile. Considerar agrupación o tabs internas en una iteración futura.
