---
title: Checkbox
tier: 1
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0001 D3 (disabled sin opacity)
---

# Checkbox

## Propósito

Atom de formulario para selección booleana de un ítem o para "select-all" de un grupo (con estado `indeterminate`). Caso canónico: paso 2 de [`delivery-create.md`](../screens/delivery-create.md) donde cada producto tiene un `<Checkbox>` y cada grupo de orden tiene un "select-all" que pasa a `indeterminate` cuando solo algunos están marcados. También aparece en [`settings.md`](../screens/settings.md) (preferencias `mfa` toggle alternativo, opt-ins futuros) — preferir `<Switch>` para preferencias on/off.

## API TypeScript

```ts
type CheckboxState = boolean | "indeterminate";

type CheckboxProps = {
  /** Identificador único para `<Label for>` o `aria-labelledby`. */
  id: string;
  /** Nombre del campo en el form (cuando se enviá el form). */
  name?: string;
  /** Estado actual. `boolean` o `"indeterminate"`. */
  checked: CheckboxState;
  /** Cambio de estado. Cuando estaba `indeterminate`, el toggle pasa a `true` (semántica estándar). */
  onChange: (checked: boolean) => void;
  /** Bloqueo lógico — sin opacity (ADR 0001 D3). */
  disabled?: boolean;
  /** Marca obligatoriedad (legal, terms, etc.). */
  required?: boolean;
  /** Tamaño. Default `md` (20×20). `sm` para listas densas (16×16). */
  size?: "sm" | "md";
  /** Etiqueta inline opcional. Si está presente, click en el label togglea. */
  label?: string;
  /** Helper neutro debajo. */
  helperText?: string;
  /** Mensaje de error mapeado por el `<Form>`. */
  error?: string;
  /** Atributo HTML `value` cuando se usa dentro de un form nativo. */
  value?: string;
};
```

## Variants / Sizes

| Variant (`size`) | Uso                                                       | Tokens consumidos                                                      |
| ---------------- | --------------------------------------------------------- | ---------------------------------------------------------------------- |
| `sm`             | Listas densas, tabla                                      | `1rem` × `1rem` box, ícono Lucide `12×12`, padding clickable 36×36     |
| `md` (default)   | Form fields estándar (delivery products, terms accept)    | `1.25rem` × `1.25rem` box, ícono Lucide `14×14`, padding clickable 44×44 |

## Estados visuales

| Estado            | Receta CSS (light)                                                                                                                                                                                              | Receta CSS (dark) | Notas                                                                                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `unchecked`       | `width: 1.25rem; height: 1.25rem; background: var(--surface); border: 1.5px solid var(--border-strong); border-radius: var(--radius-sm);`                                                                       | mismo             | Borde 1.5px para presencia funcional ≥3:1 (`--border-strong`).                                                                                                                       |
| `hover`           | `background-color: color-mix(in oklch, var(--text-primary) var(--state-hover-mix), transparent);` aplicado como overlay                                                                                          | mismo             | El overlay vive en el padding clickable, no dentro del box.                                                                                                                          |
| `focus`           | `outline: 2px solid var(--focus-ring); outline-offset: 2px;`                                                                                                                                                     | mismo             | Visible siempre en `:focus-visible`.                                                                                                                                                  |
| `checked`         | `background: var(--accent); border-color: var(--accent);` + ícono Lucide `check` 14×14 en `var(--text-on-accent)`                                                                                                  | mismo             | `--text-on-accent` es oscuro en dark (no `text-white` hardcoded).                                                                                                                    |
| `indeterminate`   | mismo `checked` pero el ícono es una barra horizontal `horizontal-line`: `<svg><rect x="3" y="9" width="14" height="2" rx="1" fill="currentColor"/></svg>` en `var(--text-on-accent)`                              | mismo             | ARIA `aria-checked="mixed"`. Implementar como `<svg>` inline o ícono Lucide `minus`.                                                                                                  |
| `disabled`        | `color: var(--text-muted); border-color: var(--border); pointer-events: none;` (el box pierde fill cuando estaba checked: `background: var(--surface);` + ícono en `var(--text-muted)`)                          | mismo             | Sin `opacity` (ADR 0001 D3).                                                                                                                                                          |
| `error`           | `border-color: color-mix(in oklch, var(--destructive) 60%, var(--border-strong));`                                                                                                                                | mismo             | Mensaje en `<ErrorMessage>` debajo.                                                                                                                                                  |

Receta base (CSS):

```css
.checkbox {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  min-height: 2.75rem; /* tap target padding clickable */
  padding-block: var(--space-2);
}

.checkbox__box {
  width: 1.25rem;
  height: 1.25rem;
  background: var(--surface);
  border: 1.5px solid var(--border-strong);
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background var(--motion-fast) var(--ease-emphasis), border-color var(--motion-fast) var(--ease-emphasis);
}

.checkbox--checked .checkbox__box,
.checkbox--indeterminate .checkbox__box {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--text-on-accent);
}

.checkbox:focus-visible .checkbox__box {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.checkbox--disabled {
  pointer-events: none;
}
.checkbox--disabled .checkbox__box {
  background: var(--surface);
  border-color: var(--border);
  color: var(--text-muted);
}

.checkbox__label {
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}
```

## Mobile vs desktop

- Mobile: padding clickable extiende el área a 44×44 incluso con box visual de 20×20 o 16×16 (decálogo §8).
- Desktop: tap area puede ser 32×32 visual, pero el padding clickable se mantiene en ≥36×36.
- Label inline: tipografía `--text-body` mobile / desktop. En listas densas usar `size="sm"` y `--text-caption`.

## Accesibilidad

- Rol ARIA: `role="checkbox"` (preferir `<button role="checkbox">` por encima del `<input type="checkbox">` para custom styling controlado). `aria-checked` puede ser `"true" | "false" | "mixed"`.
- Atributos requeridos:
  - `id` enlazado con `<Label for>` o el componente expone su propio `label` interno.
  - `aria-checked="mixed"` cuando `checked === "indeterminate"`.
  - `aria-invalid="true"` cuando `error`.
  - `aria-required="true"` cuando `required`.
  - `aria-describedby` apuntando a `<HelperText>`/`<ErrorMessage>`.
- Keyboard: `Space` togglea. `Enter` no togglea (semántica estándar). Foco visible siempre.
- Focus management: el outline rodea el wrapper completo (box + label inline) cuando hay label.
- Screen reader: anuncia "Casilla, marcado" / "Casilla, sin marcar" / "Casilla, parcialmente marcado".
- `prefers-reduced-motion`: la transición background/border se mantiene a `--motion-fast` (es pequeña). El check Lucide aparece sin animación.

## Motion

- Toggle (un → check): background y border transitan en `--motion-fast` `--ease-emphasis`. El ícono `check` aparece con scale `0.6 → 1` + opacity `0 → 1` en `--motion-fast` `--ease-out-expressive`.
- Toggle (check → indeterminate): swap del ícono `check` por la barra horizontal con fade `--motion-fast` `--ease-emphasis`.
- Bajo `prefers-reduced-motion`: solo opacity, sin scale/transform.

## Copy default + i18n

| Clave i18n sugerida                            | Valor ES                                  |
| ---------------------------------------------- | ----------------------------------------- |
| `components.checkbox.aria.checked`             | "Marcado"                                 |
| `components.checkbox.aria.unchecked`           | "Sin marcar"                              |
| `components.checkbox.aria.indeterminate`       | "Parcialmente marcado"                    |
| `components.checkbox.selectAll.label`          | "Todo"                                    |
| `components.checkbox.required.marker`          | "obligatorio"                             |

## Edge cases

1. **`indeterminate → click`**: pasa a `true` (semántica HTML estándar). El padre puede sobrescribir si quiere `false`.
2. **`indeterminate` con todos los items hijos marcados manualmente**: el padre debe cambiar a `true`. El componente NO orquesta el grupo.
3. **`indeterminate` con todos desmarcados**: el padre debe cambiar a `false`.
4. **`disabled` y `required` simultáneos**: el form NO puede enviar; mostrar `<ErrorMessage>` si el padre lo decide.
5. **Click en label cuando `disabled`**: ignorado.
6. **Long-press mobile sobre el checkbox**: comportamiento nativo (ningún menú custom). En select-all del delivery-create, el long-press dispara variante de "ranged select" si el padre lo orquesta.
7. **Form nativo HTML5**: si `name` está presente, el componente puede renderizar un `<input type="checkbox" hidden>` sincronizado para que el form submit lo recoja. MVP: opcional.
8. **Tap area extendida que se solapa con vecinos**: en listas densas, asegurar `gap` ≥`--space-2` para evitar misclick.

## Anti-patrones

1. **Usar `<Checkbox>` para preferencias on/off persistentes**: usar `<Switch>` (semántica de "ajuste" vs "selección").
2. **`indeterminate` sin `aria-checked="mixed"`**: rompe accesibilidad.
3. **`opacity: 0.5` para disabled**: tokens semánticos (ADR 0001 D3).
4. **Box visual < 16×16**: rompe affordance y AA.
5. **`text-white` hardcoded en el ícono check**: usar `--text-on-accent`.
6. **Tap target sin padding clickable extendido**: rompe decálogo §8 mobile.
7. **Animar con `--motion-base`** (280ms): demasiado lento para un toggle. Usar `--motion-fast`.

## Ejemplos de uso

```tsx
// Delivery create · paso 2 · select-all del grupo PT-002418
<Checkbox
  id="delivery-group-PT-002418-all"
  checked={groupState} // boolean | "indeterminate"
  onChange={(checked) => {
    if (checked) selectAll(groupId);
    else deselectAll(groupId);
  }}
  label="Todo"
  size="md"
/>

// Delivery create · paso 2 · producto individual
<Checkbox
  id={`product-${productId}`}
  name="productIds"
  value={productId}
  checked={selected.has(productId)}
  onChange={(checked) => toggleProduct(productId, checked)}
  size="md"
/>
```

## Tokens consumidos

- `--surface`
- `--border`, `--border-strong`
- `--text-primary`, `--text-muted`, `--text-on-accent`
- `--accent`, `--focus-ring`
- `--destructive`
- `--font-sans`
- `--text-body`, `--text-caption`
- `--space-2`
- `--radius-sm`
- `--motion-fast`
- `--ease-emphasis`, `--ease-out-expressive`
- `--state-hover-mix`

## ADRs aplicables

- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md) (D3 disabled sin opacity)

## Dependencias

- [`./Label.md`](./Label.md) (cuando se usa `<Label>` externa en lugar de prop `label`)
- [`./HelperText.md`](./HelperText.md)
- [`./ErrorMessage.md`](./ErrorMessage.md)

## Notas para S12 (implementación)

1. Implementar como `<button role="checkbox">` para evitar limitaciones de styling del `<input type="checkbox">`. Si el form requiere submit nativo, agregar un `<input type="checkbox" hidden>` sincronizado.
2. La barra horizontal del estado `indeterminate` puede ser `<MinusIcon size={14} />` de Lucide. Validar que el visual queda balanceado en 20×20.
3. Para "select-all" con shift-click range, el componente expone `onChange` simple; la orquesta vive en `<DeliveryProductGroup>` (Tier 3).
4. La coordinación grupo + items (cambio de estado en cascada) NO es responsabilidad del `<Checkbox>`.
5. Decidir en S12 si exponer `ref` para que el padre pueda llamar `focus()` programáticamente.
