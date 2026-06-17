---
title: Select
tier: 1
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0001 D3 (disabled sin opacity)
---

# Select

## Propósito

Atom de formulario para elegir un valor entre 1 y ~15 opciones predefinidas (categorías cerradas). Aparece en el paso 4 de [`order-create.md`](../screens/order-create.md) (`currencyCode`), en el paso 4 de [`delivery-create.md`](../screens/delivery-create.md) (`currencyCode`), y en [`settings.md`](../screens/settings.md) (`preferredCountryCode`, `baseCurrencyCode`, `budgetResetDayOfMonth`). Para casos searchable o con avatar+meta usar `<Combobox>`. Para conjuntos > 15 opciones usar `<Combobox>` o `<Sheet>` mobile.

## API TypeScript

```ts
type SelectOption = {
  /** Identificador único usado en `value`. */
  value: string;
  /** Texto visible. */
  label: string;
  /** Descripción opcional debajo del label en el popover. */
  description?: string;
  /** Si `true`, la opción se muestra deshabilitada (ej. moneda no disponible). */
  disabled?: boolean;
};

type SelectGroup = {
  /** Encabezado del grupo en el popover. */
  heading: string;
  options: SelectOption[];
};

type SelectProps = {
  /** Identificador único para `<Label for>`. */
  id: string;
  /** Nombre del campo en el form. */
  name: string;
  /** Valor seleccionado actualmente. `null` si no hay selección. */
  value: string | null;
  /** Cambio de selección. */
  onChange: (value: string) => void;
  /** Lista plana o agrupada. La agrupada renderiza `heading` mono uppercase. */
  options: SelectOption[] | SelectGroup[];
  /** Placeholder mostrado cuando `value === null`. */
  placeholder?: string;
  /** Helper neutro debajo. */
  helperText?: string;
  /** Mensaje de error mapeado por el `<Form>`. */
  error?: string;
  /** Bloqueo lógico — sin opacity (ADR 0001 D3). */
  disabled?: boolean;
  /** Tamaño. Default `md`. */
  size?: "sm" | "md" | "lg";
  /** Marca el campo como obligatorio para `<Label>` adjunta. */
  required?: boolean;
  /** Render personalizado de la opción dentro del popover (ej. bandera + label). */
  renderOption?: (option: SelectOption) => ReactNode;
  /** Render personalizado del valor seleccionado en el trigger. */
  renderValue?: (option: SelectOption) => ReactNode;
};
```

## Variants / Sizes

| Variant (`size`) | Uso                                              | Tokens consumidos                                                |
| ---------------- | ------------------------------------------------ | ---------------------------------------------------------------- |
| `sm`             | Filtros densos, inline edit                      | `--space-2 --space-3` padding, `--text-caption`, height `2rem`   |
| `md` (default)   | Form fields estándar                             | `--space-3 --space-4` padding, `--text-body`, height `2.5rem`    |
| `lg`             | Selects principales (currency en wizard)         | `--space-3 --space-4` padding, `--text-body-lg`, height `2.75rem` |

## Estados visuales

| Estado            | Receta CSS (light)                                                                                                                                                                  | Receta CSS (dark) | Notas                                                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default` trigger | `background: var(--surface); border: 1px solid var(--border); color: var(--text-primary); border-radius: var(--radius-md); padding: var(--space-3) var(--space-4); display: inline-flex; align-items: center; gap: var(--space-2);`                                                              | mismo             | Trailing icon `chevron-down` Lucide 16×16 en `--text-muted`. Min-height `2.75rem` mobile / `2.5rem` desktop (`md`).                                              |
| `placeholder`     | mismo `default`, valor en `--text-muted`                                                                                                                                            | mismo             | Aparece cuando `value === null`.                                                                                                                                |
| `focus`           | `border-color: var(--border-strong); outline: 2px solid var(--focus-ring); outline-offset: 2px;`                                                                                    | mismo             | El popover abre con `--motion-fast` `--ease-out-expressive` (origin top).                                                                                       |
| `open`            | mismo `focus` + `chevron-down` rotado `180deg` con `transition: transform var(--motion-fast) var(--ease-emphasis)`                                                                  | mismo             | Popover usa `--surface-elevated` + `--elevation-2` + `--radius-lg`.                                                                                             |
| `error`           | `border-color: color-mix(in oklch, var(--destructive) 60%, var(--border-strong));`                                                                                                  | mismo             | —                                                                                                                                                              |
| `disabled`        | `color: var(--text-muted); border-color: var(--border); pointer-events: none;`                                                                                                      | mismo             | Sin `opacity` (ADR 0001 D3).                                                                                                                                    |
| Opción `hover`    | `background-color: color-mix(in oklch, var(--text-primary) var(--state-hover-mix), transparent);`                                                                                   | mismo             | Inside del popover.                                                                                                                                            |
| Opción `selected` | `background-color: color-mix(in oklch, var(--accent) var(--state-selected-bg-mix), var(--surface)); color: var(--text-primary);` + ícono `check` Lucide trailing en `--accent`      | mismo             | Solo una opción seleccionada a la vez (mode single).                                                                                                            |
| Opción `disabled` | `color: var(--text-muted); pointer-events: none;`                                                                                                                                   | mismo             | —                                                                                                                                                              |

Receta del popover (CSS):

```css
.select-popover {
  background: var(--surface-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-2);
  padding: var(--space-1);
  min-width: var(--trigger-width); /* matchea ancho del trigger */
  max-height: 18rem;
  overflow-y: auto;
  z-index: var(--z-popover);
}

.select-option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  cursor: pointer;
}

.select-option-group-heading {
  padding: var(--space-2) var(--space-3) var(--space-1) var(--space-3);
  font-family: var(--font-mono);
  font-size: var(--text-eyebrow);
  letter-spacing: var(--text-eyebrow--letter-spacing);
  text-transform: uppercase;
  color: var(--text-muted);
}
```

## Mobile vs desktop

- Mobile (`< --breakpoint-md`): el popover puede transformarse en bottom sheet cuando supere ~6 opciones, con `--radius-2xl` arriba y handle Vaul-style. Si ≤ 6 opciones, queda como popover anclado al trigger.
- Desktop: popover anclado al trigger con `--elevation-2` y `position: absolute`.
- Trigger: `min-height: 2.75rem` mobile / `2.5rem` desktop (`md`).

## Accesibilidad

- Rol ARIA: `role="combobox"` en el trigger con `aria-haspopup="listbox"` y `aria-expanded`. El popover es `role="listbox"`. Cada opción es `role="option"` con `aria-selected`.
- Atributos requeridos:
  - `id` enlazado con `<Label for>`.
  - `aria-controls` apuntando al `id` del listbox.
  - `aria-activedescendant` reflejando la opción enfocada con teclado.
  - `aria-invalid="true"` cuando `error`.
  - `aria-required="true"` cuando `required`.
- Keyboard:
  - Trigger cerrado: `Enter` / `Space` / `ArrowDown` abren el popover y enfocan la primera opción (o la seleccionada si existe).
  - Popover abierto: `ArrowUp`/`ArrowDown` navegan, `Home`/`End` saltan a primera/última, type-to-select por prefijo de letra (timeout 500ms acumula).
  - `Enter` selecciona y cierra. `Esc` cierra sin cambiar valor. `Tab` cierra y avanza al próximo focus.
- Focus management: al abrir, foco al item activo (no al trigger). Al cerrar, foco vuelve al trigger.
- Screen reader: anuncia "{label}, opción seleccionada, X de N" al navegar.
- `prefers-reduced-motion`: la apertura del popover queda como `display: block` sin animación de `transform`/`opacity`.

## Motion

- Apertura del popover: `transform: scaleY(0.98) translateY(-4px) → scaleY(1) translateY(0)` + `opacity: 0 → 1` con `--motion-fast` (150ms) `--ease-out-expressive`. Origin: top center anclado al trigger.
- Cierre: inverso `--motion-fast` `--ease-emphasis`.
- Rotación del chevron: `--motion-fast` `--ease-emphasis`.
- Bajo `prefers-reduced-motion`: corte directo `opacity` only `--motion-fast`.

## Copy default + i18n

| Clave i18n sugerida                       | Valor ES                                |
| ----------------------------------------- | --------------------------------------- |
| `components.select.placeholder.default`   | "Elegí una opción"                      |
| `components.select.placeholder.currency`  | "Moneda"                                |
| `components.select.placeholder.country`   | "País"                                  |
| `components.select.empty`                 | "Sin opciones todavía."                 |
| `components.select.triggerAria.collapsed` | "Abrir lista"                           |
| `components.select.triggerAria.expanded`  | "Cerrar lista"                          |

## Edge cases

1. **`value` no coincide con ninguna `option`**: trigger muestra `placeholder` como si fuera `null`, sin error visible (el padre debe manejar la inconsistencia).
2. **Lista vacía** (`options.length === 0`): popover muestra empty state "Sin opciones todavía." en `--text-muted` `--text-caption`.
3. **Type-to-select sin match**: no cambia el highlight; sin error visible.
4. **Popover desbordando viewport**: anclar arriba del trigger en lugar de abajo (Floating UI flip). Mantener mismo `--motion-fast` y origin invertido.
5. **Lista con > 18rem (`max-height`)**: scroll interno con barra fina; el item enfocado siempre se mantiene visible (`scrollIntoView({ block: 'nearest' })`).
6. **Disabled options al type-to-select**: se saltan automáticamente.
7. **Cambio de opción con teclado mientras open**: `Enter` confirma; `Esc` revierte y cierra.
8. **Submit del form padre con `Enter` desde el trigger cerrado**: NO submitea — `Enter` abre el popover (comportamiento estándar combobox).

## Anti-patrones

1. **Usar `<Select>` para listas searchable o > 15 opciones**: usar `<Combobox>`.
2. **`<Select>` sin `<Label>`**: rompe accesibilidad y voice glossary (no usar placeholder como label).
3. **`opacity: 0.5` para disabled options**: tokens semánticos (ADR 0001 D3).
4. **Animar el popover con `--motion-base`** (280ms): demasiado lento para un control simple. Usar `--motion-fast` (150ms).
5. **Trigger sin `chevron-down`**: el usuario debe saber que es expandible.
6. **`aria-label` redundante con el `<Label>`**: solo uno; preferir `<Label>` explícito.

## Ejemplos de uso

```tsx
// Order create · paso 4 · moneda
<Select
  id="order-currency"
  name="currencyCode"
  value={currency}
  onChange={setCurrency}
  options={[
    { value: "USD", label: "USD — Dólar" },
    { value: "ARS", label: "ARS — Peso" },
    { value: "EUR", label: "EUR — Euro" },
  ]}
  placeholder="Moneda"
  required
  size="md"
/>

// Settings · presupuesto · día del mes (1-31, agrupado)
<Select
  id="budget-reset-day"
  name="budgetResetDayOfMonth"
  value={day}
  onChange={setDay}
  options={[
    {
      heading: "Inicio de mes",
      options: Array.from({ length: 10 }, (_, i) => ({
        value: String(i + 1),
        label: `Día ${i + 1}`,
      })),
    },
    {
      heading: "Mitad de mes",
      options: Array.from({ length: 10 }, (_, i) => ({
        value: String(i + 11),
        label: `Día ${i + 11}`,
      })),
    },
  ]}
  placeholder="Día del mes"
/>
```

## Tokens consumidos

- `--surface`, `--surface-elevated`
- `--border`, `--border-strong`
- `--text-primary`, `--text-muted`
- `--accent`, `--focus-ring`
- `--destructive`, `--destructive-chip-text`
- `--font-sans`, `--font-mono`
- `--text-body`, `--text-body-lg`, `--text-caption`, `--text-eyebrow`
- `--space-1`, `--space-2`, `--space-3`, `--space-4`
- `--radius-md`, `--radius-lg`, `--radius-2xl`
- `--elevation-2`
- `--motion-fast`
- `--ease-out-expressive`, `--ease-emphasis`
- `--z-popover`
- `--state-hover-mix`, `--state-selected-bg-mix`
- `--breakpoint-md`

## ADRs aplicables

- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md) (D3 disabled sin opacity)

## Dependencias

- [`./Label.md`](./Label.md)
- [`./HelperText.md`](./HelperText.md)
- [`./ErrorMessage.md`](./ErrorMessage.md)

## Notas para S12 (implementación)

1. La librería de positioning (anchor + flip + viewport collision) sugerida: `@floating-ui/react`. Mantener portal para evitar clipping por `overflow: hidden` ancestros.
2. El sheet bottom mobile (cuando opciones > 6) lo puede orquestar el mismo componente con un breakpoint check, o delegarse a un `<SheetSelect>` futuro. MVP: popover en ambos formatos.
3. Type-to-select usa `useEffect` con `setTimeout` para reset del buffer (500ms). Evitar libs.
4. La prop `renderOption` permite customizar (banderas país, etc.) sin sub-componente; mantener sin `<SelectOption>` aparte.
5. El nombre `aria-activedescendant` debe ser único por instancia; generar con `useId()`.
6. El `min-width: var(--trigger-width)` se setea por JS midiendo el trigger al abrir.
