---
title: MobilePicker
tier: 3
status: spec — no implementado
last_updated: 2026-05-12
session: 07-orders · S7-A.9 (visual tokens canonizados)
adrs:
  - ADR 0001 D12 (acción inline "Crear nueva tienda" en pickers de tienda)
  - ADR 0008 Extensión 2026-05-11 (adaptive sheet pattern; este componente reusa `<Sheet>` en mobile)
  - ADR 0011 Extensión 2026-05-12 (jerarquía visual idle vs selected; aplica también a fila de picker)
related_screens:
  - docs/redesign/screens/order-create.md §6.2 (Tienda) · §6.3 (Moneda) · §6.4 (Fecha) · §6.X (Tipo de producto)
  - docs/redesign/screens/order-edit.md (picker de tipo de producto)
demo_anchors:
  - "#s7-store-picker-mobile"
  - "#s7-currency-picker-mobile"
  - "#s7-product-type-picker-mobile"
  - "#s7-date-range-picker-mobile"
---

# MobilePicker

> **Status:** spec only — sin implementación en `src/`. Los tokens visuales y comportamiento están **canonizados** vía S7-A.9; cuando llegue Fase B se debe construir respetando este contrato. La fuente visual de verdad es `docs/redesign/_notes/demo-screens.html` (clases `.s7-mob-*`).

## Propósito

`<MobilePicker>` es la versión mobile de `<Combobox>` y `<Select>` searchable. Renderiza una **lista searchable de opciones** dentro de un `<Sheet>` bottom-sheet, con typography compacta y tokens visuales canonizados (icono `--accent-cool` idle, `--accent` selected). Su caso canónico son los pickers del wizard de creación de pedido (Tienda, Moneda, Tipo de producto) y de edición.

**Cuándo NO usarlo:**

- Si el viewport es desktop (`≥ --breakpoint-md`) → usar `<Combobox>` con popover. `<MobilePicker>` queda restringido a mobile por diseño — el orquestador (`<MobilePickerField>` o equivalente) decide vía `useIsMobile()`.
- Si la selección es un rango de fechas con calendar → usar `<DateRangeInput>` que ya define su propio bottom-sheet con grid de mes (caso especial, no es lista de opciones).
- Si la lista tiene >50 opciones sin agrupación → considerar `<CommandPalette>` con scoring por relevancia, no `<MobilePicker>` lineal.

## API TypeScript

```ts
type MobilePickerOption<TValue extends string = string> = {
  /** Valor único de la opción. */
  value: TValue;
  /** Etiqueta visible. */
  label: string;
  /** Subtítulo opcional debajo del label (línea muted, 11.5px). Ej: "4 pedidos · JPY · Última: 28 abr 2026". */
  description?: string;
  /** Icono Lucide o nodo personalizado para la celda izquierda. Tinte automático `--accent-cool` idle. */
  icon?: React.ReactNode;
  /**
   * Avatar alternativo al icon. Si está presente, reemplaza el icono.
   * Caso canónico: store-avatar circular con letra inicial.
   */
  avatar?: React.ReactNode;
  /** Disabled lógico — sin opacity (ADR 0001 D3); excluido del flujo de tab y no clickable. */
  disabled?: boolean;
};

/** Acción inline al pie de la lista — caso canónico "Crear nueva tienda" (ADR 0001 D12). */
type MobilePickerInlineAction = {
  /** Etiqueta del CTA. */
  label: string;
  /** Icono Lucide (default `plus`). */
  icon?: React.ReactNode;
  /** href para navegación con preservación de contexto (ej. `/{locale}/stores/new?returnTo=order-create`). */
  href?: string;
  /** O handler imperativo si no es navegación. */
  onClick?: () => void;
};

type MobilePickerProps<TValue extends string = string> = {
  /** Abierto/cerrado controlado por el padre (típicamente con `useState`). */
  open: boolean;
  /** Notificación de cierre — el padre actualiza `open`. */
  onOpenChange: (open: boolean) => void;
  /** Título del sheet. Ej: "Elegir tienda", "Elegir moneda", "Tipo de producto". */
  title: string;
  /** Opciones a mostrar. Si se filtran por search, el padre filtra y pasa el subset. */
  options: MobilePickerOption<TValue>[];
  /** Valor seleccionado actual. `null` = ninguno. */
  selectedValue: TValue | null;
  /** Notificación de selección — al tap en fila, el sheet se cierra automáticamente. */
  onSelect: (value: TValue) => void;
  /**
   * Si `true`, renderiza search input arriba de la lista.
   * El filtrado lo maneja el padre (`onSearchChange` + filtra `options`).
   * Default: `true` para listas con >5 opciones; el orquestador decide.
   */
  searchable?: boolean;
  /** Notificación de cambio del search input (debounced o no, según consumer). */
  onSearchChange?: (query: string) => void;
  /** Placeholder del search input. Default: i18n `components.mobilePicker.searchPlaceholder`. */
  searchPlaceholder?: string;
  /** Acción inline al pie de la lista — ADR 0001 D12. */
  inlineAction?: MobilePickerInlineAction;
  /**
   * Helper sutil arriba de la lista (debajo del search). Ej. para currency picker:
   * "La moneda base de tu cuenta es **USD**.".
   */
  hint?: React.ReactNode;
  /** Empty state cuando `options.length === 0`. Default: i18n `components.mobilePicker.empty`. */
  emptyLabel?: string;
};
```

## Anatomía visual (canonizada S7-A.9)

```text
┌──────────────────────────── Bottom sheet (max-height: 85vh) ─┐
│ ▭ drag handle (4×36px)                                       │
│                                                              │
│ Elegir tienda                                       [×]      │  ← .s7-mob-sheet-title 15px/600
│                                                              │
│ 🔍 Buscar tienda…                                            │  ← .orders-search
│                                                              │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ [S] Solaris Books & Records                       [✓]  │   │  ← .s7-mob-picker-row.is-selected
│ │     7 pedidos · USD · Última: 28 abr 2026              │   │     bg accent 8%, border accent 30%
│ │                                                        │   │
│ │ [⊙] Anime Corner Europe                                │   │  ← .s7-mob-picker-row (idle)
│ │     3 pedidos · EUR                                    │   │     icono accent-cool, bg cool 8%
│ │                                                        │   │
│ │ [⊙] HMV Japan                                          │   │
│ │     5 pedidos · JPY                                    │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                              │
│ ────────────────────────────────────────────────────────     │  ← divider sutil
│                                                              │
│ [+ Crear nueva tienda]  (inlineAction)                       │  ← btn ghost sm
└──────────────────────────────────────────────────────────────┘
```

## Tokens visuales (canon S7-A.9)

| Token                   | Valor                                                                                                                  | Aplicación                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Sheet container         | `<Sheet>` con `max-height: 85vh` y `padding-bottom: env(safe-area-inset-bottom)`                                       | Bottom sheet base                         |
| Drag handle             | `.s7-mob-sheet-handle` 4×36px                                                                                          | Affordance de drag-to-dismiss             |
| Title                   | `.s7-mob-sheet-title` 15px/600, color `--text-primary`                                                                 | Header del sheet                          |
| Search input            | `.orders-search` con icono `search` 14px                                                                               | Filtrado client-side                      |
| Row container           | `.s7-mob-picker-row` — min-height 44px, padding 8px 10px, gap 10px, border-radius 8px, border 1px transparent          | Touch target HIG mínimo                   |
| Row hover               | bg `color-mix(in oklch, var(--text-primary) 4%, transparent)`                                                          | Idle hover                                |
| Row selected            | bg `color-mix(in oklch, var(--accent) 8%, transparent)` + border `color-mix(in oklch, var(--accent) 30%, transparent)` | Estado seleccionado                       |
| Icon container          | 24×24, border-radius 6px, bg `color-mix(in oklch, var(--accent-cool) 8%, transparent)`, color `--accent-cool`          | **Idle** — alineado con filter-pill icons |
| Icon container selected | bg `color-mix(in oklch, var(--accent) 14%, transparent)`, color `--accent`                                             | **Selected** — diferenciación visual      |
| Icon SVG inner          | `width: 13px; height: 13px`                                                                                            | Override del default Lucide ~16px         |
| Label                   | font-size 13px, color `--text-primary`, truncate con ellipsis                                                          | Texto principal                           |
| Description             | font-size 11.5px, color `--text-muted`, truncate                                                                       | Línea secundaria opcional                 |
| Check icon              | 15×15px, color `--accent`                                                                                              | Indicador de selección                    |
| Inline action divider   | `border-top: 1px solid var(--border)`, margin-top 12px, padding-top 12px                                               | Separa lista de CTA                       |
| Inline action button    | `btn ghost sm` width 100%                                                                                              | CTA "Crear nueva tienda" etc.             |

## Variants / Sizes

`<MobilePicker>` **no tiene size variants**. La única medida es la canonizada en S7-A.9 (compact mobile). Si se necesita una versión más densa o más espaciada, abrir cross-cutting change para evaluar.

## Estados visuales

| Estado               | Visual                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| Idle                 | Row con icono `--accent-cool`, sin border, sin check                                                      |
| Hover                | bg `--text-primary 4%`, mismo icono                                                                       |
| Selected             | bg `--accent 8%`, border `--accent 30%`, icono `--accent`, check derecha                                  |
| Disabled             | `cursor: not-allowed`, sin opacity (ADR 0001 D3), `aria-disabled="true"`, no responde a click ni keyboard |
| Empty (sin opciones) | Center: `EmptyState` minimal con icon + `emptyLabel`                                                      |
| Loading              | Skeleton de 3-5 rows con `s7-mob-skel` (igual altura que row real)                                        |

## Mobile vs desktop

`<MobilePicker>` es **mobile-only por diseño**. El orquestador (`<StoreSelect>`, `<CurrencySelect>`, etc.) debe:

1. Detectar viewport con `useIsMobile()` (matchMedia `(max-width: 767px)`, SSR-safe).
2. Mobile: renderizar `<MobilePicker>` como `<Sheet>` que se abre on tap del trigger.
3. Desktop: renderizar `<Combobox>` como popover (mismo data model `options`).

Esto sigue el mismo patrón que `<Modal>` adaptive (ADR 0008 Extensión 2026-05-11). El padre maneja un solo `selectedValue` + un solo `onChange`; el componente adaptive elige el chrome correcto.

## Acción inline (ADR 0001 D12)

Caso canónico: **"Crear nueva tienda"** en el store-picker mid-wizard. Reglas:

- Posicionada al pie de la lista, debajo de las opciones, separada por divider sutil.
- `inlineAction.href` debe incluir `returnTo` cuando aplique (constante canónica `RETURN_TO_ORDER_CREATE = "order-create"`).
- El consumer (no este componente) implementa el back-link respect + success redirect al wizard origen — ver `screens/order-create.md` §6.2 + FRD-05 WO-04 lines 110-117, 155-177, 287-296.
- Al tap, el sheet se cierra automáticamente antes de navegar (evita stuck-state si el user vuelve con back).

## Accesibilidad

- Container: `role="dialog"` `aria-modal="true"` + `aria-labelledby` apuntando al `id` del título.
- Lista: `role="listbox"` + `aria-label` (i18n).
- Row: `role="option"` + `aria-selected` (bool del estado).
- Search input: `<Input type="search">` con `aria-label` (i18n `components.mobilePicker.searchPlaceholder`).
- Disabled rows: `aria-disabled="true"`, excluidas de `arrow-down/up` y `Enter`.
- Focus trap: al abrir el sheet, focus al search input si `searchable`, sino al row seleccionado, sino al primer row.
- Keyboard:
  - `Tab` / `Shift+Tab`: navegación dentro del sheet (focus trap heredado de `<Sheet>`).
  - `Esc`: cierra (si `dismissible` del Sheet).
  - `ArrowDown` / `ArrowUp`: navegación entre rows con `aria-activedescendant`.
  - `Enter` / `Space` en row: selecciona + cierra.
- Return focus: al cerrar, regresa focus al trigger.

## Motion

- Sheet slide-up: heredado de `<Sheet>` (280ms cubic-bezier estándar).
- Row hover/active: 120ms ease en `background-color` y `border-color`.
- Selected → idle transition: 120ms (matches hover).

## Copy default + i18n

| Key                                         | Default ES     | Notas                                                                                      |
| ------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------ |
| `components.mobilePicker.searchPlaceholder` | "Buscar…"      | El consumer puede override con string más específico ("Buscar tienda…", "Buscar moneda…"). |
| `components.mobilePicker.empty`             | "Sin opciones" | Empty state default.                                                                       |
| `components.mobilePicker.close`             | "Cerrar"       | aria-label del botón × en el header del sheet.                                             |
| `components.mobilePicker.cancel`            | "Cancelar"     | aria-label del Esc / drag-to-dismiss (anuncio SR).                                         |

Las labels de las opciones (`option.label`, `option.description`) son responsabilidad del consumer y deben venir ya localizadas.

## Edge cases

1. **Lista vacía + searchable + query activo**: mostrar empty con mensaje "Sin resultados para «{query}»" (override del `emptyLabel` por el consumer).
2. **Lista vacía + sin search**: mostrar empty con `emptyLabel` + opcional `inlineAction` (ej. picker de tienda con cero tiendas → CTA "Crear primera tienda" en lugar de "Crear nueva tienda").
3. **Selección actual no está en `options`**: caso de filtros activos. El sheet muestra todas las opciones filtradas; el `selectedValue` se pinta visible solo si está en la lista. Al cerrar sin cambiar selección, el valor previo se preserva.
4. **Opción con label muy largo**: truncate con ellipsis (CSS `.s7-mob-picker-label` `overflow:hidden;text-overflow:ellipsis;white-space:nowrap`).
5. **Más de 50 opciones**: rendimiento OK con virtualización opcional; evaluar `react-window` si la lista supera ~100. Para el MVP, lista plana.
6. **Tap rápido en 2 opciones consecutivas**: la primera tap dispara `onSelect` y cierra el sheet; la segunda tap pega en el backdrop o en el row colapsado — no debe disparar selección. El sheet maneja focus trap durante el cierre.

## Anti-patrones

1. **Renderizar `<MobilePicker>` en desktop sin viewport check**: rompe la jerarquía adaptive. Usar `<Combobox>` en desktop.
2. **Icono idle en color `--text-muted` o `--text-primary`**: rompe la coherencia visual establecida en S7-A.9. **Siempre `--accent-cool`** para idle (paridad con filter-pill icons). Selected pasa a `--accent`.
3. **Min-height del row < 44px**: viola HIG iOS minimum touch target. El canónico es 44px exactos.
4. **`inlineAction` sin `href` ni `onClick`**: no debe renderizarse. Si no hay acción, omitir la prop.
5. **`searchable: true` con <3 opciones**: el search input es ruido. Default a `false` o el consumer decide por longitud.
6. **Trigger del picker en el sticky bottom action bar**: viola la regla single-purpose del sticky bar (ADR 0011 Extensión §2). El picker se abre desde un field del form, no desde un CTA primario.

## Ejemplos de uso

```tsx
// En orders/new/_components/OrderStoreField.tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MobilePicker } from "@/components/modules/MobilePicker";
import { useIsMobile } from "@/hooks/useIsMobile";

export function OrderStoreField({ stores, selectedStoreId, onSelect, locale }: Props) {
  const t = useTranslations("orders.create");
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = stores.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));

  if (!isMobile) {
    return <OrderStoreCombobox /* desktop variant */ />;
  }

  return (
    <MobilePicker
      open={open}
      onOpenChange={setOpen}
      title={t("storePicker.title")}
      options={filtered.map((s) => ({
        value: s.id,
        label: s.name,
        description: t("storePicker.meta", { count: s.orderCount, currency: s.currency }),
        avatar: <StoreAvatar name={s.name} size={24} />,
      }))}
      selectedValue={selectedStoreId}
      onSelect={onSelect}
      searchable={stores.length > 5}
      onSearchChange={setQuery}
      inlineAction={{
        label: t("storePicker.createNew"),
        href: `/${locale}/stores/new?returnTo=order-create`,
      }}
    />
  );
}
```

## Tokens consumidos

- `--accent`, `--accent-cool`, `--text-primary`, `--text-muted`, `--border`, `--surface-elevated`
- `--space-2` (8px), `--space-2-5` (10px), `--space-3` (12px) — padding/gap
- `--radius-md` (8px), `--radius-sm` (6px) — row + icon container
- `--text-13` / `--text-11-5` (si tokens existen; fallback a `font-size` literal por ahora)

## ADRs aplicables

- **ADR 0001 D12** — Acción inline "Crear nueva tienda" en pickers. Aplica al `inlineAction` prop.
- **ADR 0008 Extensión 2026-05-11** — Adaptive sheet pattern. Este componente vive en mobile; en desktop el padre delega a `<Combobox>`.
- **ADR 0011 Extensión 2026-05-12** — Jerarquía visual idle (color cool) vs selected (color accent). Aplica al icon container.

## Dependencias

- `<Sheet>` — container base (drag handle, backdrop, focus trap, slide-up motion).
- `<Input type="search">` — para el search input cuando `searchable`.
- Lucide icons — para `search`, `x`, `check`, `plus` (default del inlineAction).
- `useIsMobile()` hook (ya existe en `src/hooks/`).

## Notas para implementación (Fase B)

1. **No es prioridad de Fase B Parte 1** (listado de pedidos). Es prioridad de **Fase B Parte 3** (crear pedido wizard) cuando se aborde el form de orden con tienda/moneda/tipo selección.
2. La canonización visual (S7-A.9) implica que cualquier divergencia del demo HTML `.s7-mob-picker-*` debe ser justificada en cross-cutting-changes. No improvisar.
3. Migración futura: si `<Combobox>` desktop también adopta el adaptive pattern (popover desktop + sheet mobile internamente), `<MobilePicker>` se puede absorber dentro de `<Combobox>` como detalle de implementación interno. Por ahora son dos componentes separados (`<Combobox>` desktop + `<MobilePicker>` mobile) con un orquestador padre que decide cuál renderizar — más simple y testeable.
4. El demo HTML usa `data-screen-link` para navegación; el componente real usa `<Link>` de Next.js para `inlineAction.href`.
5. Filtrado: el padre filtra y pasa `options` ya filtradas. `<MobilePicker>` no implementa fuzzy search internamente — eso queda para el consumer si lo necesita.
