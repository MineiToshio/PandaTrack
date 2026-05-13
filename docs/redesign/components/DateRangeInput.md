---
title: DateRangeInput
tier: 1
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0001 D3 (disabled sin opacity)
---

# DateRangeInput

## Propósito

Atom de formulario para captura de un rango `from` / `to` coordinados. Aparece en el paso 2 de [`order-create.md`](../screens/order-create.md) (`expectedDeliveryFrom/To`) y en el paso 3 de [`delivery-create.md`](../screens/delivery-create.md) (`expectedArrivalFrom/To`). En desktop renderiza dos `<DateInput>` lado a lado con un divider mínimo; en mobile colapsan en stack vertical. El segundo input keyboard-salta automáticamente al primero seleccionar.

## API TypeScript

```ts
type DateRangeValue = {
  from: string | null;
  to: string | null;
};

/** Set canónico de quick-range presets (S7-A.9). Renderizados como `.filter-pill` arriba del calendar. */
type DateRangePresetKey = "next7Days" | "next30Days" | "next60Days" | "thisMonth" | "nextMonth";

type DateRangeInputProps = {
  /** Identificador base — se usa como prefijo para `from`/`to` (ej. `expected-delivery-from`). */
  id: string;
  /** Nombre base del campo en el form (ej. `expectedDelivery`). El form recibe `expectedDeliveryFrom` y `expectedDeliveryTo`. */
  name: string;
  /** Valor combinado `{ from, to }`. */
  value: DateRangeValue;
  /** Cambio de selección. Emite el rango completo. */
  onChange: (value: DateRangeValue) => void;
  /** Callback de blur del rango (cuando ambos quedan completos o el usuario sale del último). */
  onBlur?: () => void;
  /** Placeholder del input `from`. Default "desde". */
  fromPlaceholder?: string;
  /** Placeholder del input `to`. Default "hasta". */
  toPlaceholder?: string;
  /** Helper neutro debajo del rango completo. */
  helperText?: string;
  /** Mensaje de error mapeado por el `<Form>`. */
  error?: string;
  /** Bloqueo lógico — sin opacity (ADR 0001 D3). */
  disabled?: boolean;
  /** Marca el rango como obligatorio (ambos `from` y `to`). */
  required?: boolean;
  /** Tamaño. Default `md`. */
  size?: "sm" | "md" | "lg";
  /** Fecha mínima global (aplica a `from`). */
  min?: string;
  /** Fecha máxima global (aplica a `to`). */
  max?: string;
  /** Locale. Default `es-AR`. */
  locale?: "es-AR" | "en-US";
  /**
   * Quick-range presets renderizados arriba del calendar grid como `.filter-pill` chips.
   * Cada preset, al tap, prellena el rango (`from = today` y `to = today + N días`, o boundaries
   * del mes para `thisMonth` / `nextMonth`). El preset cuyo rango coincida con la selección actual
   * lleva `.is-active`. Default canónico (S7-A.9): los 5 keys en orden.
   * Pasar `[]` para ocultar la fila de presets. Labels resueltos vía i18n
   * (`orders.create.dateRange.preset.*`) con versión corta (desktop popup 262px) vs larga
   * con prefijo "Próximos" (mobile full-sheet).
   */
  presets?: DateRangePresetKey[];
};
```

## Variants / Sizes

Igual que `<DateInput>`. El size se propaga a ambos sub-inputs.

| Variant (`size`) | Uso                             | Tokens consumidos                               |
| ---------------- | ------------------------------- | ----------------------------------------------- |
| `sm`             | Filtros densos en filter drawer | `--space-2 --space-3` padding, `--text-caption` |
| `md` (default)   | Form fields estándar            | `--space-3 --space-4` padding, `--text-body`    |
| `lg`             | Wizard expectedDelivery         | `--space-3 --space-4` padding, `--text-body-lg` |

## Estados visuales

El rango compone dos `<DateInput>` y suma estos estados de coordinación:

| Estado               | Receta CSS (light)                                                                                                  | Receta CSS (dark) | Notas                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------- |
| `default`            | dos `<DateInput>` lado a lado en `display: flex; gap: var(--space-3); align-items: center;` con divider entre ambos | mismo             | Divider: `1px` height `1.5rem` `background: var(--border);` o un guión "→" en `--text-muted` `--text-caption`. |
| `from selected only` | `from` filled, `to` placeholder. Cuando el usuario abre `to`, su popover ya parte en el mes de `from`.              | mismo             | El `to` aplica `min` dinámico igual a `from + 1 día` para evitar rango inválido.                               |
| `from > to inválido` | Ambos inputs `error` borde `color-mix(in oklch, var(--destructive) 60%, var(--border-strong))`                      | mismo             | El `<ErrorMessage>` debajo dice "Hasta tiene que venir después de desde."                                      |
| `disabled`           | Los dos sub-inputs heredan `disabled`                                                                               | mismo             | Sin `opacity` (ADR 0001 D3).                                                                                   |
| `error`              | Los dos sub-inputs heredan `error` border                                                                           | mismo             | El error es del rango, no de cada input por separado.                                                          |

Receta del wrapper (CSS):

```css
.daterangeinput {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}

.daterangeinput__divider {
  flex: 0 0 auto;
  width: 1px;
  height: 1.5rem;
  background: var(--border);
}

@media (max-width: calc(48rem - 1px)) {
  .daterangeinput {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
  }
  .daterangeinput__divider {
    display: none;
  }
}
```

## Mobile vs desktop

- Mobile (`< --breakpoint-md`): los dos `<DateInput>` colapsan en stack vertical (`flex-direction: column`); divider invisible. Cada uno con `min-height: 2.75rem`.
- Desktop (`≥ --breakpoint-md`): lado a lado con divider; cada `<DateInput>` ocupa `flex: 1 1 0`.
- Tap target ≥ 44×44 garantizado por el `<DateInput>` interno.

## Accesibilidad

- Rol ARIA: el wrapper es `role="group"` con `aria-labelledby` apuntando al `<Label>` del rango. Cada `<DateInput>` mantiene su `role="combobox"`.
- Atributos requeridos:
  - `id` base genera `id-from` y `id-to` para los sub-inputs.
  - `aria-required="true"` en el `role="group"` cuando `required`.
  - `aria-invalid="true"` en el `role="group"` cuando `error`.
  - `aria-describedby` apunta al `<HelperText>`/`<ErrorMessage>` del grupo.
- Keyboard:
  - `Tab` enfoca `from`; segundo `Tab` salta a `to`.
  - Al seleccionar fecha en `from` con `Enter`, foco automático salta al trigger de `to` (sin abrir su popover; el usuario decide).
  - `Esc` en cualquiera cierra su popover.
- Focus management: cada `<DateInput>` maneja su trap; el wrapper no atrapa foco.
- Screen reader: anuncia "Llegada esperada, rango" via `<Label>`. Al seleccionar `from`, anuncia "Desde 12 de abril, falta hasta".
- `prefers-reduced-motion`: hereda de `<DateInput>`.

## Motion

- Heredada de `<DateInput>` para apertura/cierre del popover.
- Salto automático de foco `from → to`: sin animación (corte directo).
- Bajo `prefers-reduced-motion`: sin cambios respecto a default (no hay animación propia del wrapper).

## Copy default + i18n

| Clave i18n sugerida                           | Valor ES                                  |
| --------------------------------------------- | ----------------------------------------- |
| `components.dateRangeInput.from.placeholder`  | "desde"                                   |
| `components.dateRangeInput.to.placeholder`    | "hasta"                                   |
| `components.dateRangeInput.divider.aria`      | "hasta"                                   |
| `components.dateRangeInput.group.aria`        | "Rango de fechas"                         |
| `components.dateRangeInput.error.invalid`     | "Hasta tiene que venir después de desde." |
| `components.dateRangeInput.error.outOfBounds` | "Fuera del rango permitido."              |

## Edge cases

1. **`from = to` (mismo día)**: válido. Útil para ETA estimada de un solo día.
2. **`from` cambia y queda mayor que `to` actual**: el componente pone `to = null` automáticamente; emite `onChange({ from: nuevo, to: null })`.
3. **`to` se setea antes que `from`**: permitido — el componente reordena en `onChange` si detecta `from > to` y emite mensaje de error.
4. **`from` está fuera de `[min, max]`**: hereda el comportamiento de `<DateInput>`; el padre debe validar globalmente.
5. **`required` con uno de los dos `null`**: el `<Form>` lo trata como error; el grupo recibe `aria-invalid`.
6. **Auto-foco a `to` después de seleccionar `from`**: el componente NO abre el popover de `to` automáticamente — el usuario decide cuándo. Solo enfoca el trigger.
7. **Mobile stack y gesto back**: cada `<DateInput>` cierra su sheet/popover; el orden vertical no rompe el flow.
8. **Pegar rango en clipboard tipo "12/04/2026 - 20/04/2026"**: NO soportado; el padre puede agregar parser si hace falta.

## Anti-patrones

1. **Un solo input que muestre `from - to` como string editable**: rompe accesibilidad y no permite navegación independiente.
2. **Calendar de 2 meses lado a lado para rango**: pesa mobile, fuera de scope MVP. Posible futuro.
3. **`opacity: 0.5` para disabled**: tokens semánticos (ADR 0001 D3).
4. **Animar el reorder cuando `from > to`**: produce confusión. Usar fade del `<ErrorMessage>`.
5. **Auto-abrir el popover de `to` al cerrar `from`**: invasivo; respetar la decisión del usuario.
6. **Placeholder "Seleccione una fecha de inicio"**: voice glossary — usar "desde" / "hasta".

## Ejemplos de uso

```tsx
// Order create · paso 2 · expectedDelivery range
<DateRangeInput
  id="expected-delivery"
  name="expectedDelivery"
  value={{ from: deliveryFrom, to: deliveryTo }}
  onChange={({ from, to }) => {
    setDeliveryFrom(from);
    setDeliveryTo(to);
  }}
  fromPlaceholder="desde"
  toPlaceholder="hasta"
  min={orderDate ?? undefined}
  size="md"
  locale="es-AR"
/>

// Filter drawer · rango opcional para filtros de fecha
<DateRangeInput
  id="filter-dates"
  name="filterDates"
  value={range}
  onChange={setRange}
  helperText="Sin filtro si dejas vacío."
  size="sm"
/>
```

## Tokens consumidos

- `--border`
- `--text-muted`, `--destructive`
- `--space-2`, `--space-3`
- `--breakpoint-md`
- (heredados de `<DateInput>`) — el resto

## ADRs aplicables

- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md) (D3 disabled sin opacity)

## Dependencias

- [`./DateInput.md`](./DateInput.md) — composición canónica.
- [`./Label.md`](./Label.md)
- [`./HelperText.md`](./HelperText.md)
- [`./ErrorMessage.md`](./ErrorMessage.md)

## Notas para S12 (implementación)

1. El reorder automático cuando `from > to` puede emitirse como warning en consola en dev; en prod el componente arregla silenciosamente.
2. El `<Label>` del grupo usa `<fieldset>` + `<legend>` opcional para mejor screen reader. MVP: `<div role="group" aria-labelledby>`.
3. ~~Pendiente decidir si el componente soporta `presets`~~ **Resuelto S7-A.9 (2026-05-12):** quick-range presets son canónicos en `DateRangePicker` para ambos viewports. Set canónico: `7 días · 30 días · 60 días · Este mes · Próximo mes`. Labels cortos en desktop (popup 262px, font-size 11px, gap 4px, separados del calendar por `border-bottom`); labels largos con prefijo "Próximos" en mobile (full-sheet con espacio disponible). El preset cuyo rango coincida con la selección actual lleva `.is-active`. Demo anchors: `#s7-date-range-picker` (desktop) y `#s7-date-range-picker-mobile` (mobile). Spec funcional: `screens/order-create.md` §6.4.
4. El form padre recibe `expectedDeliveryFrom` y `expectedDeliveryTo` (sufijos `From`/`To` del nombre base). Documentar la convención en el `<Form>` spec (Tier 2).
5. Validar con tester real que el flujo de stack mobile no confunde — probar la primera vez en S6.
