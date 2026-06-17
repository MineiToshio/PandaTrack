---
title: Radio
tier: 1
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0001 D3 (disabled sin opacity)
---

# Radio

## Propósito

Atom de formulario para selección única dentro de un grupo de opciones mutuamente excluyentes (3-7 opciones). Aparece en el modal de discrepancia del paso 4 de [`order-create.md`](../screens/order-create.md) ("¿Cuál dejamos? Total ingresado / Sumatoria de items"), en el modal de cambio de moneda en [`settings.md`](../screens/settings.md), y en futuras preferencias con < 5 opciones cerradas. Para listas con > 7 opciones usar `<Select>` o `<Combobox>`.

## API TypeScript

```ts
type RadioOption<TValue extends string = string> = {
  /** Identificador único usado en `value`. */
  value: TValue;
  /** Texto principal visible. */
  label: string;
  /** Descripción opcional debajo del label. */
  description?: string;
  /** Si `true`, esta opción no es seleccionable. */
  disabled?: boolean;
};

type RadioGroupProps<TValue extends string = string> = {
  /** Identificador base del grupo (usado como prefijo `id-{value}`). */
  id: string;
  /** Nombre del campo en el form. */
  name: string;
  /** Valor seleccionado, o `null` si no hay selección. */
  value: TValue | null;
  /** Cambio de selección. */
  onChange: (value: TValue) => void;
  /** Lista de opciones (3-7). */
  options: RadioOption<TValue>[];
  /** Helper neutro debajo del grupo. */
  helperText?: string;
  /** Mensaje de error mapeado por el `<Form>`. */
  error?: string;
  /** Bloqueo lógico del grupo entero — sin opacity (ADR 0001 D3). */
  disabled?: boolean;
  /** Marca el grupo como obligatorio. */
  required?: boolean;
  /** Tamaño del círculo. Default `md` (20×20). */
  size?: "sm" | "md";
  /** Orientación. Default `vertical`. */
  orientation?: "vertical" | "horizontal";
};
```

## Variants / Sizes

| Variant (`size`) | Uso                                                             | Tokens consumidos                                                |
| ---------------- | --------------------------------------------------------------- | ---------------------------------------------------------------- |
| `sm`             | Filtros densos                                                  | círculo `1rem`, dot `0.375rem`, padding clickable 36×36          |
| `md` (default)   | Form fields estándar (modales de decisión)                      | círculo `1.25rem`, dot `0.5rem`, padding clickable 44×44         |

| Orientation  | Uso                                              | Notas                                                                  |
| ------------ | ------------------------------------------------ | ---------------------------------------------------------------------- |
| `vertical`   | Default, modales y forms                         | Cada radio en su línea con `gap: var(--space-3)`.                      |
| `horizontal` | Filtros simples (ej. orden ascendente / descendente) | `display: inline-flex; gap: var(--space-4);` — solo cuando 2-3 options. |

## Estados visuales

| Estado            | Receta CSS (light)                                                                                                                                                                                              | Receta CSS (dark) | Notas                                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `unchecked`       | círculo: `width: 1.25rem; height: 1.25rem; background: var(--surface); border: 1.5px solid var(--border-strong); border-radius: var(--radius-pill);`                                                            | mismo             | Border 1.5px ≥3:1.                                                                                                                          |
| `hover`           | overlay `background-color: color-mix(in oklch, var(--text-primary) var(--state-hover-mix), transparent);` aplicado al wrapper clickable                                                                          | mismo             | Hover sobre el row completo (círculo + label).                                                                                              |
| `focus`           | `outline: 2px solid var(--focus-ring); outline-offset: 2px;`                                                                                                                                                     | mismo             | El outline rodea el wrapper completo cuando el radio tiene label inline.                                                                    |
| `checked`         | círculo: `border-color: var(--accent); background: var(--surface);` + dot interno `0.5rem × 0.5rem` `border-radius: var(--radius-pill); background: var(--accent);`                                              | mismo             | El dot está centrado.                                                                                                                       |
| `disabled`        | círculo: `border-color: var(--border); background: var(--surface);` + label en `var(--text-muted); pointer-events: none;`                                                                                        | mismo             | Si `checked` y `disabled`, el dot queda en `var(--text-muted)`. Sin `opacity` (ADR 0001 D3).                                                 |
| `error`           | círculo: `border-color: color-mix(in oklch, var(--destructive) 60%, var(--border-strong));` aplicado a TODOS los radios del grupo                                                                                | mismo             | Mensaje en `<ErrorMessage>` debajo del grupo.                                                                                               |

Receta base (CSS):

```css
.radio-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.radio-group--horizontal {
  flex-direction: row;
  gap: var(--space-4);
}

.radio {
  position: relative;
  display: inline-flex;
  align-items: flex-start;
  gap: var(--space-2);
  cursor: pointer;
  min-height: 2.75rem; /* tap target padding clickable */
  padding-block: var(--space-2);
}

.radio__circle {
  width: 1.25rem;
  height: 1.25rem;
  background: var(--surface);
  border: 1.5px solid var(--border-strong);
  border-radius: var(--radius-pill);
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: border-color var(--motion-fast) var(--ease-emphasis);
}

.radio--checked .radio__circle {
  border-color: var(--accent);
}

.radio--checked .radio__circle::after {
  content: "";
  width: 0.5rem;
  height: 0.5rem;
  border-radius: var(--radius-pill);
  background: var(--accent);
  transform: scale(1);
  transition: transform var(--motion-fast) var(--ease-out-expressive);
}

.radio:focus-visible .radio__circle {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.radio--disabled {
  pointer-events: none;
}
.radio--disabled .radio__circle {
  border-color: var(--border);
}
.radio--disabled .radio__label {
  color: var(--text-muted);
}

.radio__label {
  display: flex;
  flex-direction: column;
  gap: var(--space-0_5);
}

.radio__label-primary {
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}

.radio__label-description {
  color: var(--text-muted);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
}
```

## Mobile vs desktop

- Mobile: `min-height: 2.75rem`. Padding clickable extiende a 44×44.
- Desktop: padding puede bajar a 36×36 visual, pero ≥36×36 efectivo.
- En mobile la `orientation: horizontal` con > 2 options se permite solo cuando los labels son cortos (< 12 chars); si no, forzar `vertical` por overflow.

## Accesibilidad

- Rol ARIA del grupo: `role="radiogroup"` con `aria-labelledby` apuntando al `<Label>` o título del grupo. `aria-required="true"` cuando `required`. `aria-invalid="true"` cuando `error`.
- Cada radio: `role="radio"` con `aria-checked`. `aria-disabled` cuando `disabled`.
- Atributos requeridos:
  - `id` base genera `id-{value}` para cada radio.
  - `aria-describedby` apunta al `<HelperText>`/`<ErrorMessage>` del grupo.
- Keyboard:
  - `Tab` enfoca el radio seleccionado (o el primero si ninguno seleccionado).
  - `ArrowDown` / `ArrowRight`: siguiente radio (loop al final → primero).
  - `ArrowUp` / `ArrowLeft`: radio anterior (loop al inicio → último).
  - `Space`: selecciona el radio enfocado.
  - `Enter`: selecciona y submit del form (depende del padre).
- Focus management: los radios disabled se saltan en la navegación con flechas.
- Screen reader: anuncia "Radio, marcado, X de N" al navegar.
- `prefers-reduced-motion`: el dot interno aparece sin scale, solo opacity.

## Motion

- Selección: el dot interno aparece con scale `0.6 → 1` + opacity `0 → 1` en `--motion-fast` `--ease-out-expressive`.
- Border del círculo: `transition: border-color var(--motion-fast) var(--ease-emphasis)`.
- Bajo `prefers-reduced-motion`: solo opacity, sin scale.

## Copy default + i18n

| Clave i18n sugerida                          | Valor ES                                  |
| -------------------------------------------- | ----------------------------------------- |
| `components.radio.aria.checked`              | "Marcado"                                 |
| `components.radio.aria.unchecked`            | "Sin marcar"                              |
| `components.radio.required.marker`           | "obligatorio"                             |

## Edge cases

1. **`value` no coincide con ninguna `option.value`**: ningún radio queda checked; sin error visible (el padre maneja la inconsistencia).
2. **Todos los `option.disabled = true`**: el grupo no permite selección. El padre debe deshabilitar el `<Form>` submit.
3. **Selección con `disabled` activo**: ignorado.
4. **Cambio de `value` programáticamente**: el dot se anima como en click manual.
5. **Mobile horizontal con labels largos**: usar `flex-wrap: wrap; gap: var(--space-3) var(--space-4);` para que partan en líneas.
6. **`required` sin selección al submit**: el form padre dispara `error` que pinta los círculos en `--destructive` 60%.
7. **`value` cambia pero el radio que era previo está disabled**: la animación corre normal; el visual transita.

## Anti-patrones

1. **Usar `<Radio>` para listas > 7 opciones**: usar `<Select>` o `<Combobox>`.
2. **Usar `<Radio>` para selección on/off**: usar `<Switch>` o `<Checkbox>`.
3. **`opacity: 0.5` para disabled**: tokens semánticos (ADR 0001 D3).
4. **Permitir deselección de radio individual**: la semántica de radiogroup exige que SIEMPRE haya 1 o ningún seleccionado tras submit; deselección manual rompe el modelo.
5. **`text-white` hardcoded en el dot**: usar `--accent` (el dot es del color del accent, no del texto).
6. **Saltar a un radio disabled con flechas**: rompe expectativas keyboard.
7. **Tap target < 44×44 mobile**: rompe decálogo §8.

## Ejemplos de uso

```tsx
// Order create · modal de discrepancia (Σ items ≠ totalCost)
<RadioGroup
  id="discrepancy-resolution"
  name="discrepancyResolution"
  value={resolution}
  onChange={setResolution}
  options={[
    {
      value: "keep-total",
      label: "Dejá el total ingresado",
      description: "$43,00 USD — items quedan como referencia",
    },
    {
      value: "use-sum",
      label: "Usá la suma de items",
      description: "$42,50 USD — total se reescribe",
    },
  ]}
  required
/>

// Settings · cambio de moneda base (modal destructivo)
<RadioGroup
  id="base-currency"
  name="baseCurrencyCode"
  value={currency}
  onChange={setCurrency}
  options={currencies}
  helperText="Cambia cómo se muestran totales históricos."
  size="md"
/>
```

## Tokens consumidos

- `--surface`
- `--border`, `--border-strong`
- `--text-primary`, `--text-muted`
- `--accent`, `--focus-ring`
- `--destructive`
- `--font-sans`
- `--text-body`, `--text-caption`
- `--space-0_5`, `--space-2`, `--space-3`, `--space-4`
- `--radius-pill`
- `--motion-fast`
- `--ease-emphasis`, `--ease-out-expressive`
- `--state-hover-mix`

## ADRs aplicables

- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md) (D3 disabled sin opacity)

## Dependencias

- [`./Label.md`](./Label.md) — para el label del `radiogroup`.
- [`./HelperText.md`](./HelperText.md)
- [`./ErrorMessage.md`](./ErrorMessage.md)

## Notas para S12 (implementación)

1. Implementar como `<div role="radiogroup">` con `<button role="radio">` por opción para custom styling controlado.
2. Roving tabindex: solo el radio "current" tiene `tabindex="0"`, el resto `tabindex="-1"`. Las flechas mueven el tabindex.
3. Si el form requiere submit nativo, agregar `<input type="radio" hidden>` sincronizado por opción.
4. Decidir en S12 si exponer una API "card" cuando los labels son largos con descripciones (ya cubierto por `description` prop); MVP queda con esa prop.
5. El componente NO valida exclusión mutua — el `value` es uno solo, el modelo lo garantiza.
