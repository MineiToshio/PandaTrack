---
title: DateInput
tier: 1
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0001 D3 (disabled sin opacity)
---

# DateInput

## Propósito

Atom de formulario para captura de una fecha vía popover con calendar grid. Aparece en el paso 2 de [`order-create.md`](../screens/order-create.md) (`orderDate`, `expectedDeliveryFrom/To`) y en el paso 3 de [`delivery-create.md`](../screens/delivery-create.md) (`deliveryDate ≤ hoy`, `expectedArrivalFrom/To`). Locale-aware (`es-AR` default, `en-US` futuro), keyboard navigable, formato display "DD MMM YYYY" (ej. `12 abr 2026`).

## API TypeScript

```ts
type DateInputProps = {
  /** Identificador único para `<Label for>`. */
  id: string;
  /** Nombre del campo en el form. */
  name: string;
  /** Valor en ISO date string `"YYYY-MM-DD"` o `null` si no hay valor. */
  value: string | null;
  /** Cambio de selección (emite ISO date string). */
  onChange: (value: string | null) => void;
  /** Callback de blur — para validación post-blur. */
  onBlur?: () => void;
  /** Placeholder con voice glossary aplicado. Default "¿Para cuándo?". */
  placeholder?: string;
  /** Helper neutro debajo. */
  helperText?: string;
  /** Mensaje de error mapeado por el `<Form>`. */
  error?: string;
  /** Bloqueo lógico — sin opacity (ADR 0001 D3). */
  disabled?: boolean;
  /** Marca el campo como obligatorio. */
  required?: boolean;
  /** Tamaño. Default `md`. */
  size?: "sm" | "md" | "lg";
  /** Fecha mínima seleccionable (ISO `YYYY-MM-DD`). */
  min?: string;
  /** Fecha máxima seleccionable (ISO `YYYY-MM-DD`, ej. `today` para `deliveryDate`). */
  max?: string;
  /** Locale para el formato de display y header del calendar. Default `es-AR`. */
  locale?: "es-AR" | "en-US";
};
```

## Variants / Sizes

| Variant (`size`) | Uso                                                        | Tokens consumidos                                                |
| ---------------- | ---------------------------------------------------------- | ---------------------------------------------------------------- |
| `sm`             | Filtros densos (date range en filter drawer)               | `--space-2 --space-3` padding, `--text-caption`, height `2rem`   |
| `md` (default)   | Form fields estándar                                       | `--space-3 --space-4` padding, `--text-body`, height `2.5rem`    |
| `lg`             | Wizard `expectedDelivery` desktop                          | `--space-3 --space-4` padding, `--text-body-lg`, height `2.75rem` |

## Estados visuales

| Estado            | Receta CSS (light)                                                                                                                                    | Receta CSS (dark) | Notas                                                                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default` trigger | `background: var(--surface); border: 1px solid var(--border); color: var(--text-primary); border-radius: var(--radius-md); padding: var(--space-3) var(--space-4); display: inline-flex; gap: var(--space-2); align-items: center;`                                                                                                                                                                                                                       | mismo             | Trailing icon `calendar` Lucide 16×16 en `--text-muted`. `font-variant-numeric: tabular-nums` en el valor display.                                       |
| `placeholder`     | mismo, valor en `--text-muted` (ej. "¿Para cuándo?")                                                                                                  | mismo             | —                                                                                                                                                        |
| `focus`           | `border-color: var(--border-strong); outline: 2px solid var(--focus-ring); outline-offset: 2px;`                                                       | mismo             | —                                                                                                                                                        |
| `open`            | mismo `focus` + popover visible con calendar grid                                                                                                     | mismo             | Popover usa `--surface-elevated` + `--elevation-2` + `--radius-lg`.                                                                                       |
| `error`           | `border-color: color-mix(in oklch, var(--destructive) 60%, var(--border-strong));`                                                                    | mismo             | —                                                                                                                                                        |
| `disabled`        | `color: var(--text-muted); border-color: var(--border); pointer-events: none;`                                                                        | mismo             | Sin `opacity` (ADR 0001 D3).                                                                                                                              |
| Día `default`     | `background: transparent; color: var(--text-primary); border-radius: var(--radius-md);`                                                                | mismo             | 36×36 mobile / 32×32 desktop. Tap target ≥44 con padding clickable.                                                                                       |
| Día `today`       | mismo + `border: 1px solid var(--accent);`                                                                                                             | mismo             | Marca el día actual sin selección.                                                                                                                        |
| Día `hover`       | `background-color: color-mix(in oklch, var(--text-primary) var(--state-hover-mix), transparent);`                                                       | mismo             | —                                                                                                                                                        |
| Día `focus`       | `outline: 2px solid var(--focus-ring); outline-offset: 2px;`                                                                                            | mismo             | Foco ARIA en grid via `aria-activedescendant`.                                                                                                            |
| Día `selected`    | `background: var(--accent); color: var(--text-on-accent); font-weight: var(--font-weight-semibold);`                                                  | mismo             | `--text-on-accent` es oscuro en dark (no `text-white` hardcoded).                                                                                         |
| Día `disabled`    | `color: var(--text-muted); pointer-events: none;`                                                                                                       | mismo             | Cuando cae fuera de `min`/`max` o fuera del mes activo.                                                                                                  |
| Día fuera del mes | `color: var(--text-muted);`                                                                                                                             | mismo             | Días "leak" del mes anterior/siguiente para grid completo. No clickeables.                                                                                |

Receta del calendar (CSS):

```css
.dateinput-popover {
  background: var(--surface-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-2);
  padding: var(--space-3);
  z-index: var(--z-popover);
  display: grid;
  gap: var(--space-2);
}

.dateinput-popover__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: var(--font-sans);
  font-size: var(--text-body);
  font-weight: var(--font-weight-medium-body);
  color: var(--text-primary);
}

.dateinput-popover__weekday {
  font-family: var(--font-mono);
  font-size: var(--text-eyebrow);
  letter-spacing: var(--text-eyebrow--letter-spacing);
  text-transform: uppercase;
  color: var(--text-muted);
  text-align: center;
}

.dateinput-popover__day {
  width: 2.25rem;
  height: 2.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  font-variant-numeric: tabular-nums;
}
```

## Mobile vs desktop

- Mobile: el popover puede transformarse en bottom sheet (drag handle Vaul-style). Días 36×36 con padding clickable extendido a 44×44 efectivo.
- Desktop: popover anclado al trigger con `--elevation-2`. Días 32×32.
- Trigger min-height: `2.75rem` mobile / `2.5rem` desktop (`md`).
- Header del popover: chevron-left/right Lucide para mes anterior/siguiente, tap area 32×32 desktop / 44×44 mobile.

## Accesibilidad

- Rol ARIA: trigger es `role="combobox"` con `aria-haspopup="dialog"` y `aria-expanded`. Popover es `role="dialog"` con `aria-label` "Selector de fecha". Grid es `role="grid"` con `role="row"` por semana y `role="gridcell"` por día.
- Atributos requeridos:
  - `id` enlazado con `<Label for>`.
  - `aria-invalid="true"` cuando `error`.
  - `aria-required="true"` cuando `required`.
  - `aria-activedescendant` apuntando al `id` del día enfocado.
  - Cada día con `aria-label` "Lunes 12 de abril de 2026" (locale-aware) y `aria-selected` cuando coincide con `value`.
- Keyboard:
  - Trigger cerrado: `Enter` / `Space` / `ArrowDown` abren el popover y enfocan `value` (o `today` si `value === null`).
  - Popover abierto:
    - `ArrowLeft`/`ArrowRight`: día anterior/siguiente.
    - `ArrowUp`/`ArrowDown`: semana anterior/siguiente.
    - `PageUp`/`PageDown`: mes anterior/siguiente.
    - `Shift+PageUp`/`Shift+PageDown`: año anterior/siguiente.
    - `Home`/`End`: primer/último día de la semana visible.
    - `Enter`/`Space`: selecciona y cierra.
    - `Esc`: cierra sin cambiar.
    - `Tab`: cierra y avanza al próximo focus.
- Focus management: foco al popover al abrir; foco al trigger al cerrar. Trap dentro del popover mientras está abierto.
- Screen reader: anuncia "Mes de abril 2026" al cambiar mes via `aria-live="polite"` discreto. Anuncia `aria-label` completo del día al navegar.
- `prefers-reduced-motion`: apertura sin transform; corte directo opacity `--motion-fast`.

## Motion

- Apertura del popover: `transform: scaleY(0.98) translateY(-4px) → scaleY(1) translateY(0)` + `opacity: 0 → 1` con `--motion-fast` `--ease-out-expressive`.
- Cambio de mes: el grid cambia con fade `--motion-fast` `--ease-emphasis`. Sin transform-x.
- Selección de día: scale `0.95 → 1` en el día seleccionado con `--motion-fast` `--ease-out-expressive`.
- Bajo `prefers-reduced-motion`: solo opacity, sin transform/scale.

## Copy default + i18n

| Clave i18n sugerida                          | Valor ES                                  |
| -------------------------------------------- | ----------------------------------------- |
| `components.dateInput.placeholder.default`   | "¿Para cuándo?"                           |
| `components.dateInput.popover.label`         | "Selector de fecha"                       |
| `components.dateInput.popover.prevMonth`     | "Mes anterior"                            |
| `components.dateInput.popover.nextMonth`     | "Mes siguiente"                           |
| `components.dateInput.popover.today`         | "Hoy"                                     |
| `components.dateInput.popover.clear`         | "Limpiar"                                 |
| `components.dateInput.error.outOfRange`      | "Fuera del rango permitido"               |
| `components.dateInput.weekday.short`         | "lun, mar, mié, jue, vie, sáb, dom"       |

## Edge cases

1. **Locale `es-AR`**: semana arranca en lunes; formato display "12 abr 2026"; weekday short minúsculas.
2. **Locale `en-US`**: semana arranca en domingo; formato display "Apr 12, 2026"; weekday short capitalizado.
3. **`value` fuera de `[min, max]`**: popover muestra el valor pero deshabilitado; helperText o error según lo decida el `<Form>`.
4. **`min > max`**: configuración inválida — el componente NO valida; el padre debe enviar configuración consistente.
5. **Cambio de zona horaria**: el componente trabaja en local time; el padre normaliza a UTC en submit si hace falta.
6. **Selección de hoy con `max = today`**: válido. El día `today` lleva borde `--accent` y al seleccionarse se vuelve sólido.
7. **Pegar fecha en el trigger**: no aplicable — el trigger no es input editable. Usar el popover.
8. **Año < 1900 o > 2100**: el componente acepta cualquier rango; el `<Form>` debe validar bounds razonables.
9. **Día seleccionado en mes diferente al actualmente visible**: al abrir, el popover salta al mes del `value`.
10. **Sheet mobile abierto + back gesture**: cierra sin cambiar.

## Anti-patrones

1. **Placeholder "Selecciona una fecha"**: usar voice glossary "¿Para cuándo?" (principle §7).
2. **Animar el grid con `transform-x` al cambiar mes**: produce desorientación. Usar fade.
3. **`opacity: 0.5` para días disabled**: tokens semánticos (ADR 0001 D3).
4. **`text-white` hardcoded en día seleccionado**: usar `--text-on-accent`.
5. **Header sin chevrons clickeables**: rompe affordance.
6. **Validación on-change** (rojo al elegir día). Solo post-blur o post-submit.
7. **Tap target < 44×44 mobile** en días: extender padding clickable.

## Ejemplos de uso

```tsx
// Order create · paso 2 · día del pedido
<DateInput
  id="order-date"
  name="orderDate"
  value={orderDate}
  onChange={setOrderDate}
  placeholder="¿Para cuándo?"
  max={today}
  required
  size="md"
  locale="es-AR"
/>

// Delivery create · paso 3 · fecha de entrega ≤ hoy
<DateInput
  id="delivery-date"
  name="deliveryDate"
  value={deliveryDate}
  onChange={setDeliveryDate}
  placeholder="¿Cuándo llegó?"
  max={today}
  required
  helperText="No puede ser después de hoy."
/>
```

## Tokens consumidos

- `--surface`, `--surface-elevated`
- `--border`, `--border-strong`
- `--text-primary`, `--text-muted`, `--text-on-accent`
- `--accent`, `--focus-ring`
- `--destructive`, `--destructive-chip-text`
- `--font-sans`, `--font-mono`
- `--text-body`, `--text-body-lg`, `--text-caption`, `--text-eyebrow`
- `--space-1`, `--space-2`, `--space-3`, `--space-4`
- `--radius-md`, `--radius-lg`
- `--elevation-2`
- `--motion-fast`
- `--ease-out-expressive`, `--ease-emphasis`
- `--z-popover`, `--z-sheet`
- `--state-hover-mix`
- `--font-weight-medium-body`, `--font-weight-semibold`
- `--breakpoint-md`

## ADRs aplicables

- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md) (D3 disabled sin opacity)

## Dependencias

- [`./Label.md`](./Label.md)
- [`./HelperText.md`](./HelperText.md)
- [`./ErrorMessage.md`](./ErrorMessage.md)
- (Tier 1) [`./DateRangeInput.md`](./DateRangeInput.md) — composición de dos `<DateInput>` para rangos.

## Notas para S12 (implementación)

1. Librería sugerida para date math: `date-fns` (tree-shakable). NO usar Moment.
2. `Intl.DateTimeFormat` para el header del mes y los `aria-label` de día (locale-aware sin diccionarios).
3. La rendering del calendar grid evita libs externas (datepicker propio); usa `useReducer` para state del mes visible.
4. Floating UI (`@floating-ui/react`) para anchor + flip + portal del popover. Mobile: detectar breakpoint y usar `<Sheet>` (Tier 4) cuando aplique.
5. Validar en S12 si la app define una zona horaria global (UTC vs local) y refinar la normalización en `onChange`.
6. El trigger NO debe ser un input nativo — usar `<button type="button">` para evitar problemas de form submission.
7. Pendiente: ¿soporte para "Hoy" botón inline al pie del popover? MVP: no; agregable en futuro.
