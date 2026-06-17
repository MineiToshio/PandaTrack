---
title: Combobox
tier: 1
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0001 D12 (crear nueva tienda inline)
  - ADR 0001 D3 (disabled sin opacity)
  - ADR 0006 (icon+label contract — íconos accent-cool requieren label)
---

# Combobox

## Propósito

Atom de formulario searchable con popover de opciones. Caso canónico: `<StoreSelect>` del paso 1 de [`order-create.md`](../screens/order-create.md) y [`delivery-create.md`](../screens/delivery-create.md), con `avatar (32px) + nombre + país` por opción y la acción inline "Crear nueva tienda" (ADR 0001 D12). Soporta selección simple (`mode: 'single'`) o múltiple (`mode: 'multi'`) vía discriminated union — multi renderiza chips arriba del input con remove `x` y borrado del último con `Backspace`.

## API TypeScript

```ts
type ComboboxOption<TValue extends string = string, TMeta = unknown> = {
  /** Identificador único. */
  value: TValue;
  /** Texto principal usado para búsqueda y display. */
  label: string;
  /** Descripción opcional (ej. país, slug). Aparece debajo o inline. */
  description?: string;
  /** Render extra (avatar, ícono Lucide). */
  leading?: ReactNode;
  /** Metadata libre (objeto tienda completo, etc.). */
  meta?: TMeta;
  /** Si `true`, no se puede seleccionar. */
  disabled?: boolean;
};

type ComboboxGroup<TValue extends string = string, TMeta = unknown> = {
  heading: string;
  options: ComboboxOption<TValue, TMeta>[];
};

type ComboboxBaseProps<TValue extends string, TMeta> = {
  id: string;
  name: string;
  options: ComboboxOption<TValue, TMeta>[] | ComboboxGroup<TValue, TMeta>[];
  placeholder?: string;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  size?: "sm" | "md" | "lg";
  /** Callback cuando el usuario tipea en el input de search (controlled o uncontrolled filter). */
  onSearchChange?: (query: string) => void;
  /** Filtro custom (default: matchea `label` case-insensitive sobre `description`). */
  filter?: (option: ComboboxOption<TValue, TMeta>, query: string) => boolean;
  /** Acción inline mostrada al pie del popover (ej. "Crear nueva tienda"). */
  inlineAction?: {
    label: string;
    icon?: ReactNode;
    onClick: () => void;
  };
  /** Mensaje cuando el filtro no devuelve resultados. */
  emptyMessage?: string;
};

type ComboboxSingleProps<TValue extends string, TMeta> =
  ComboboxBaseProps<TValue, TMeta> & {
    mode: "single";
    value: TValue | null;
    onChange: (value: TValue | null, option: ComboboxOption<TValue, TMeta> | null) => void;
  };

type ComboboxMultiProps<TValue extends string, TMeta> =
  ComboboxBaseProps<TValue, TMeta> & {
    mode: "multi";
    value: TValue[];
    onChange: (value: TValue[], options: ComboboxOption<TValue, TMeta>[]) => void;
    /** Tope máximo de selecciones. Cuando se alcanza, las opciones extras se muestran disabled. */
    maxSelected?: number;
  };

type ComboboxProps<TValue extends string = string, TMeta = unknown> =
  | ComboboxSingleProps<TValue, TMeta>
  | ComboboxMultiProps<TValue, TMeta>;
```

## Variants / Sizes

| Variant (`size`) | Uso                                                          | Tokens consumidos                                                |
| ---------------- | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| `sm`             | Filtros densos, tagging inline                               | `--space-2 --space-3` padding, `--text-caption`, height `2rem`   |
| `md` (default)   | Form fields estándar (currency picker con search)            | `--space-3 --space-4` padding, `--text-body`, height `2.5rem`    |
| `lg`             | StoreSelect del wizard (caso canónico)                       | `--space-3 --space-4` padding, `--text-body-lg`, height `2.75rem` |

| Mode      | Uso                                                                 | Notas                                                                                          |
| --------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `single`  | StoreSelect, currency picker con search                             | Una sola opción seleccionada — selección reemplaza la actual.                                  |
| `multi`   | `preferredProductTypeKeys` en settings, futuros multi-tag           | Chips arriba del input; `Backspace` borra el último; `maxSelected` opcional.                   |

## Estados visuales

| Estado            | Receta CSS (light)                                                                                                                                                               | Receta CSS (dark) | Notas                                                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `default` trigger | `background: var(--surface); border: 1px solid var(--border); color: var(--text-primary); border-radius: var(--radius-md); padding: var(--space-3) var(--space-4); display: flex; gap: var(--space-2); align-items: center;`                                                                                                                                                                                                                       | mismo             | Leading icon `search` Lucide 16×16 en `--text-muted`. Trailing `chevron-down`.                                                  |
| `placeholder`     | mismo, valor en `--text-muted`                                                                                                                                                   | mismo             | —                                                                                                                              |
| `focus`           | `border-color: var(--border-strong); outline: 2px solid var(--focus-ring); outline-offset: 2px;`                                                                                  | mismo             | —                                                                                                                              |
| `open`            | mismo `focus` + popover visible. Trigger se transforma en input editable.                                                                                                         | mismo             | Popover usa `--surface-elevated` + `--elevation-2` + `--radius-lg`.                                                            |
| `error`           | `border-color: color-mix(in oklch, var(--destructive) 60%, var(--border-strong));`                                                                                                | mismo             | —                                                                                                                              |
| `disabled`        | `color: var(--text-muted); border-color: var(--border); pointer-events: none;`                                                                                                    | mismo             | Sin `opacity` (ADR 0001 D3).                                                                                                    |
| Opción `hover`    | `background-color: color-mix(in oklch, var(--text-primary) var(--state-hover-mix), transparent);`                                                                                  | mismo             | —                                                                                                                              |
| Opción `selected` | mismo + ícono `check` Lucide trailing en `--accent` (mode `single`)                                                                                                                | mismo             | En multi, las opciones seleccionadas muestran el `check`.                                                                      |
| Opción `disabled` | `color: var(--text-muted); pointer-events: none;`                                                                                                                                  | mismo             | —                                                                                                                              |
| Inline action     | mismo `default` option + ícono `plus` leading en `--accent`, label en `--accent`, divider arriba `1px solid var(--border)`                                                         | mismo             | Pinned al pie del popover. Aparece siempre, también con resultados filtrados.                                                  |
| Empty             | `padding: var(--space-4); color: var(--text-muted); font-size: var(--text-caption); text-align: center;`                                                                           | mismo             | "Nada con eso. Probá otro término."                                                                                            |
| Multi chip        | `background: color-mix(in oklch, var(--accent) var(--state-selected-bg-mix), var(--surface)); border: 1px solid color-mix(in oklch, var(--accent) var(--state-selected-border-mix), var(--surface)); color: var(--accent); border-radius: var(--radius-pill); padding: var(--space-0_5) var(--space-2); gap: var(--space-1);`            | mismo             | Avatar 24px o ícono leading 14×14 + label + botón `x` 14×14 en `currentColor`.                                                  |

## Mobile vs desktop

- Mobile: el popover se transforma en bottom sheet con drag handle Vaul-style cuando `options.length > 6` o cuando aplica el flag `forceSheet`. `--radius-2xl` arriba, `--sheet-max-h` 92svh, slide vertical `--motion-base` `--ease-out-expressive`. El input de search vive arriba del sheet.
- Desktop: popover anclado al trigger con `--elevation-2` y `position: absolute` (Floating UI). `min-width` matchea trigger.
- StoreSelect mobile: las opciones tienen `<StoreAvatar size={32}>` + nombre + país inline (`AR`, `MX`); en desktop se mantiene el mismo layout.
- Trigger min-height: `2.75rem` mobile / `2.5rem` desktop (`md`).

## Accesibilidad

- Rol ARIA: `role="combobox"` en el wrapper trigger. Input interno con `aria-autocomplete="list"`, `aria-controls={listboxId}`, `aria-expanded`, `aria-activedescendant`.
- Listbox del popover: `role="listbox"`, multiseleccionable cuando `mode="multi"` (`aria-multiselectable="true"`).
- Cada opción: `role="option"` con `aria-selected`. Acción inline: `role="option"` con `aria-label="Crear nueva tienda"`.
- Chips multi: cada chip es `role="button"` con `aria-label="Eliminar {label}"` para el `x`. La fila completa de chips tiene `role="list"` con `role="listitem"` por chip.
- Atributos requeridos:
  - `id` enlazado con `<Label for>`.
  - `aria-invalid="true"` cuando `error`.
  - `aria-required="true"` cuando `required`.
- Keyboard:
  - Trigger cerrado: `Enter` / `Space` / `ArrowDown` / cualquier tecla letra abren el popover; la tecla letra arranca el filtro.
  - Popover abierto: `ArrowUp`/`ArrowDown` navegan, `Home`/`End` saltan, `Enter` selecciona, `Esc` cierra sin cambiar (multi: vacía la query, no la selección).
  - `Tab` cierra el popover y avanza.
  - Mode multi: `Backspace` con input vacío elimina el último chip.
- Focus management: foco se mantiene en el input de search durante la navegación (no se mueve a las opciones); el `aria-activedescendant` indica la opción enfocada.
- Screen reader: anuncia "X resultados" al filtrar via `aria-live="polite"` discreto.
- `prefers-reduced-motion`: apertura sin transform, solo opacity `--motion-fast`.

## Motion

- Apertura del popover: `transform: scaleY(0.98) translateY(-4px) → scaleY(1) translateY(0)` + `opacity: 0 → 1` con `--motion-fast` `--ease-out-expressive`.
- Apertura del sheet mobile: `translateY(100%) → translateY(0)` con `--motion-base` `--ease-out-expressive`.
- Filtro: las opciones aparecen/desaparecen con fade `--motion-fast` `--ease-emphasis`. Sin layout animation (evita jitter).
- Chip add/remove: scale `0.95 → 1` + opacity `0 → 1` con `--motion-fast` `--ease-out-expressive`.
- Bajo `prefers-reduced-motion`: solo opacity, sin transform; chips remove sin scale.

## Copy default + i18n

| Clave i18n sugerida                            | Valor ES                                       |
| ---------------------------------------------- | ---------------------------------------------- |
| `components.combobox.placeholder.store`        | "Buscar tienda…"                               |
| `components.combobox.placeholder.search`       | "Buscar"                                       |
| `components.combobox.empty.default`            | "Nada con eso. Probá otro término."            |
| `components.combobox.empty.action`             | "Crear nueva tienda"                           |
| `components.combobox.results.aria`             | "{n} resultados"                               |
| `components.combobox.chip.removeAria`          | "Eliminar {label}"                             |
| `components.combobox.maxSelected`              | "Llegaste al tope"                             |
| `components.combobox.triggerAria.collapsed`    | "Abrir lista"                                  |
| `components.combobox.triggerAria.expanded`     | "Cerrar lista"                                 |

## Edge cases

1. **`onSearchChange` con backend remoto**: el padre orquesta el debounce y vuelve a pasar `options` filtradas; el componente NO re-filtra cuando `onSearchChange` está provisto.
2. **Crear nueva tienda inline (ADR 0001 D12)**: la `inlineAction` dispara un sheet/modal de creación. Cuando el usuario crea, el padre debe agregar la nueva tienda a `options` y seleccionarla automáticamente vía `onChange`.
3. **Multi con `maxSelected` alcanzado**: las opciones no seleccionadas pasan a `disabled`, helperText muestra "Llegaste al tope".
4. **Selección de opción `disabled`**: ignora el evento; sin error.
5. **Backspace en multi con chips y query no vacía**: borra el caracter de la query, no el chip. Solo borra chip cuando input está vacío.
6. **Valor `null` en single**: trigger muestra placeholder.
7. **Filtro custom devuelve 0 resultados pero hay `inlineAction`**: el inlineAction se mantiene visible; útil para "crear lo que estás escribiendo".
8. **Cambio de `mode` en runtime**: prohibido (discriminated union exige una decisión por instancia). El padre debe desmontar y montar de nuevo si necesita switchear.
9. **Lista virtualizada (> 200 items)**: el componente expone interfaz simple; la virtualización (si hace falta) es responsabilidad del consumer en S12.
10. **Sheet mobile abierto + click en backdrop**: cierra sin cambiar selección.

## Anti-patrones

1. **Usar `<Combobox>` para listas cerradas de < 8 opciones sin search**: usar `<Select>`.
2. **Activar `mode: 'multi'` con `maxSelected: 1`**: usar `mode: 'single'`.
3. **`opacity: 0.5` para disabled options**: tokens semánticos (ADR 0001 D3).
4. **Inline action sin ícono y sin label distinguible**: el patrón `+ Crear nueva tienda` es reconocible; quitarle ícono o label rompe affordance.
5. **Animar layout de chips con `transition`**: produce jitter al filtrar. Solo animar enter/exit, no reordenamiento.
6. **Filter case-sensitive**: por default case-insensitive sobre `label` y `description`.
7. **Borrar la query del input al seleccionar en single**: aceptable. En multi: limpiar la query siempre tras add.

## Ejemplos de uso

```tsx
// Order create · paso 1 · StoreSelect (canónico)
<Combobox<StoreId, Store>
  id="order-store"
  name="storeId"
  mode="single"
  value={storeId}
  onChange={(value, option) => {
    setStoreId(value);
    setStoreMeta(option?.meta ?? null);
  }}
  options={stores.map((store) => ({
    value: store.id,
    label: store.name,
    description: store.country,
    leading: <StoreAvatar size={32} store={store} />,
    meta: store,
  }))}
  placeholder="Buscar tienda…"
  inlineAction={{
    label: "Crear nueva tienda",
    icon: <PlusIcon size={16} />,
    onClick: openStoreCreateSheet,
  }}
  emptyMessage="Nada con eso. Probá otro término."
  required
  size="lg"
/>

// Settings · preferredProductTypeKeys (multi)
<Combobox<ProductTypeKey>
  id="preferred-product-types"
  name="preferredProductTypeKeys"
  mode="multi"
  value={selected}
  onChange={setSelected}
  options={productTypes}
  placeholder="Categorías favoritas"
  maxSelected={6}
  helperText="Hasta 6 categorías. Se priorizan en sugerencias."
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
- `--space-0_5`, `--space-1`, `--space-2`, `--space-3`, `--space-4`
- `--radius-md`, `--radius-lg`, `--radius-2xl`, `--radius-pill`
- `--elevation-2`
- `--motion-fast`, `--motion-base`
- `--ease-out-expressive`, `--ease-emphasis`
- `--z-popover`, `--z-sheet`
- `--state-hover-mix`, `--state-selected-bg-mix`, `--state-selected-border-mix`
- `--sheet-max-h`
- `--breakpoint-md`

## ADRs aplicables

- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md) (D12 crear nueva tienda inline, D3 disabled sin opacity)
- [ADR 0006 — Color blindness icon+label contract](../decisions/0006-color-blindness-icon-label-contract.md)

## Dependencias

- [`./Label.md`](./Label.md)
- [`./HelperText.md`](./HelperText.md)
- [`./ErrorMessage.md`](./ErrorMessage.md)
- (Tier 2) `<StoreAvatar>` — leading slot del caso canónico.

## Notas para S12 (implementación)

1. Floating UI (`@floating-ui/react`) sugerido para anchor + flip + viewport collision. Portal obligatorio.
2. Virtualización con `@tanstack/react-virtual` solo si `options.length > 200`. MVP no virtualiza.
3. La discriminated union `mode: 'single' | 'multi'` debe rechazar mezclar callbacks (`onChange` con shape diferente). Probar en S12 con `tsc --strict`.
4. El sheet bottom mobile reusa el `<Sheet>` (Tier 4); MVP puede inlinear el comportamiento.
5. Filter default usa `Intl.Collator` con `sensitivity: 'base'` para acentos en `es-AR`.
6. La acción inline puede recibir `divider: 'top' | 'bottom'` futuro si hace falta separar grupos. MVP fijo en bottom con divider top.
