---
title: Label
tier: 1
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs: []
---

# Label

## Propósito

Atom primitiva de form. Se asocia a un `<Input>`, `<Textarea>`, `<Select>`, `<Combobox>`, `<DateInput>`, `<DateRangeInput>`, `<Checkbox>`, `<Radio>` o `<Switch>` mediante `for` (HTML) / `htmlFor` (React). Aparece en TODOS los pasos de [`order-create.md`](../screens/order-create.md), [`delivery-create.md`](../screens/delivery-create.md) y [`settings.md`](../screens/settings.md). Soporta marca de obligatoriedad (asterisco `--accent`) y marca de opcionalidad ("(opcional)" en `--text-muted`).

## API TypeScript

```ts
type LabelProps = {
  /** ID del control al que apunta. Mapea a `htmlFor`. */
  for: string;
  /** Contenido del label (texto). */
  children: ReactNode;
  /** Marca el campo como obligatorio (asterisco `--accent`). */
  required?: boolean;
  /** Si `true`, agrega "(opcional)" en `--text-muted` al final. Mutuamente excluyente con `required`. */
  optional?: boolean;
  /** Si el control asociado está disabled. Cambia el color a `--text-secondary`. */
  disabled?: boolean;
  /** Tamaño. Default `md` (`--text-body`). */
  size?: "sm" | "md";
};
```

## Variants / Sizes

| Variant (`size`) | Uso                                                       | Tokens consumidos                                                |
| ---------------- | --------------------------------------------------------- | ---------------------------------------------------------------- |
| `sm`             | Filtros densos, edición inline                            | `--text-caption`, `--font-weight-medium`, `--text-muted` para optional |
| `md` (default)   | Form fields estándar                                      | `--text-body`, `--font-weight-medium`, `--text-muted` para optional |

## Estados visuales

| Estado     | Receta CSS (light)                                                                                                                       | Receta CSS (dark) | Notas                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------- |
| `default`  | `color: var(--text-primary); font-family: var(--font-sans); font-size: var(--text-body); line-height: var(--text-body--line-height); font-weight: var(--font-weight-medium); display: inline-flex; align-items: center; gap: var(--space-1);`                                                          | mismo             | `--font-weight-medium-body` para auto-ajuste óptico por modo (500 light / 480 dark).            |
| `required` | mismo + asterisco `*` después del texto en `color: var(--accent)`                                                                         | mismo             | El asterisco vive como `<span aria-hidden="true">*</span>` para no anunciarlo dos veces.        |
| `optional` | mismo + `(opcional)` después del texto en `color: var(--text-muted); font-size: var(--text-caption);`                                    | mismo             | Visible solo cuando el form lo amerita (rompe la convención de marcar todo opcional).           |
| `disabled` | `color: var(--text-secondary);`                                                                                                          | mismo             | Sin opacity (ADR 0001 D3 generalizado). El control asociado igualmente queda en `--text-muted`. |

Receta base (CSS):

```css
.label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  margin-bottom: var(--space-2);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  font-weight: var(--font-weight-medium-body);
}

.label--sm {
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
}

.label--disabled {
  color: var(--text-secondary);
}

.label__required {
  color: var(--accent);
}

.label__optional {
  color: var(--text-muted);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-regular);
}
```

## Mobile vs desktop

- Mismo tamaño visual en ambos (no escala). El gap entre label e input se mantiene en `--space-2` (8px).
- El asterisco / "(opcional)" aparecen inline; no rompen línea en labels cortos.

## Accesibilidad

- Rol ARIA: native `<label>` con `for` (rol implícito).
- Atributos requeridos: `for` apuntando al `id` del control. Si el componente asocia con `aria-labelledby`, el label debe tener su propio `id`.
- Keyboard: clic en el label foca el control asociado (comportamiento nativo).
- Screen reader: el label se anuncia junto con el control. El asterisco `*` vive con `aria-hidden="true"` para que el SR no diga "asterisco"; la obligatoriedad viaja vía `aria-required` del control. El "(opcional)" se anuncia como texto.
- `prefers-reduced-motion`: no aplica.

## Motion

Ninguno. El label no se anima.

## Copy default + i18n

| Clave i18n sugerida                       | Valor ES                                  |
| ----------------------------------------- | ----------------------------------------- |
| `components.label.optional.suffix`        | "(opcional)"                              |
| `components.label.required.suffix`        | "(obligatorio)" — solo screen reader      |
| `components.label.required.markerAria`    | "obligatorio"                             |

## Edge cases

1. **`required` y `optional` al mismo tiempo**: prohibido por TypeScript (validar en el spec — discriminated union no aplica acá pero el componente puede asegurar `required ? !optional : true` en runtime).
2. **Label muy largo**: hace wrap natural; el asterisco / "(opcional)" se mantienen inline al final.
3. **Multiple `<Label>` apuntando al mismo `for`**: no soportado — un control = un label.
4. **Label sin `for`**: prohibido. Si el control no tiene `id` accesible, usar `<Label>` como `<span>` y enlazar con `aria-labelledby`.
5. **Locale `en-US`**: "(optional)" se traduce a "(optional)"; el componente no asume.
6. **Click en el label cuando el control está disabled**: ignorado.

## Anti-patrones

1. **Placeholder en lugar de label**: el placeholder se evapora al tipear; siempre acompañar de `<Label>`.
2. **Asterisco rojo `--destructive`**: usar `--accent` (rojo es status de error, no marca de obligatoriedad).
3. **`(opcional)` en `--accent`**: usar `--text-muted` (es metadata neutral).
4. **Label en mayúsculas como eyebrow**: el eyebrow es otro componente (`<Eyebrow>`); el label es body weight medium.
5. **Wrappear todo en `<label>` y eliminar el `for`**: válido para checkboxes/radios con label inline, pero requiere que el control esté DENTRO del `<label>`. Documentar caso por caso.

## Ejemplos de uso

```tsx
// Order create · paso 1 · label del store combobox
<Label for="order-store" required>
  Tienda
</Label>
<Combobox id="order-store" {...} />

// Order create · paso 5 · nota opcional
<Label for="order-note" optional>
  Nota
</Label>
<Textarea id="order-note" {...} />

// Settings · profile · username con label disabled durante edit-saving
<Label for="settings-username" required disabled={saving}>
  Usuario
</Label>
```

## Tokens consumidos

- `--text-primary`, `--text-secondary`, `--text-muted`
- `--accent`
- `--font-sans`
- `--text-body`, `--text-caption`
- `--font-weight-medium`, `--font-weight-medium-body`, `--font-weight-regular`
- `--space-1`, `--space-2`

## ADRs aplicables

Ninguno directo. La regla de "disabled sin opacity" (ADR 0001 D3) se generaliza acá vía `--text-secondary`.

## Dependencias

Ninguna. Es atom puro.

## Notas para S12 (implementación)

1. El componente puede aceptar `as: "label" | "span"` para soportar el caso `aria-labelledby`. MVP: solo `<label>` nativo.
2. Validar la regla `required + optional` en runtime con un `console.warn` en dev. En prod fallar silently y priorizar `required`.
3. Los identificadores i18n son convenciones — no implementadas en S4. S12 las cablea a next-intl.
4. Si el control asociado vive dentro de un `<fieldset>`/`<legend>` (ej. radiogroup), reusar `<Label>` como `<legend>` con prop `as="legend"`. MVP: separado.
