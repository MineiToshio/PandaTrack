---
title: FieldGroup
tier: 4
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0001 D2 (field-as-attribute para inputs pre-llenados)
  - ADR 0001 D3 (disabled sin opacity)
---

# FieldGroup

## Propósito

Tier 4 que agrupa `<Label>` + control (Input/Textarea/Select/Combobox/DateInput/Checkbox/Radio/Switch) + `<HelperText>` o `<ErrorMessage>` en un único bloque coherente. Cabe el wiring ARIA (`htmlFor`, `aria-describedby`, `aria-invalid`, `aria-required`) y consume `FormContext` (cuando vive dentro de un `<Form>`) para auto-mapear errores del servidor al campo correspondiente. Aparece en TODOS los pasos de [`order-create.md`](../screens/order-create.md), [`delivery-create.md`](../screens/delivery-create.md) y [`settings.md`](../screens/settings.md). Reduce repetición de boilerplate y centraliza la regla "error tiene prioridad sobre helper".

## API TypeScript

```ts
import type { ReactNode } from "react";

type FieldGroupProps = {
  /**
   * Nombre del campo. Debe coincidir con el `id` del control hijo (`<Input id={name}>`)
   * y con la key del schema Zod del `<Form>` padre. Se usa para auto-pull del error
   * mapeado desde `FormContext.errors[name]`.
   */
  name: string;
  /** Label del campo. Acepta string o ReactNode (cuando hay tooltip/info inline). */
  label: ReactNode;
  /** Marca el campo como obligatorio. Mutuamente exclusivo con `optional`. */
  required?: boolean;
  /** Marca el campo como opcional. Mutuamente exclusivo con `required`. */
  optional?: boolean;
  /** Texto de ayuda neutro. Se oculta cuando hay `error`. */
  helperText?: string;
  /**
   * Override manual del error. Si está, gana sobre el error del `FormContext`.
   * Útil para casos sin `<Form>` padre o validación custom.
   */
  error?: string;
  /**
   * Tamaño del label y mensajes (`sm` para filtros densos, `md` por default).
   */
  size?: "sm" | "md";
  /** El control de input. */
  children: ReactNode;
};
```

## Variants / Sizes

| Variant (`size`) | Uso                                                         | Tokens consumidos                              |
| ---------------- | ----------------------------------------------------------- | ---------------------------------------------- |
| `sm`             | Filtros densos, edición inline en sub-cards                  | `<Label size="sm">`, `<HelperText size="sm">`, `<ErrorMessage size="sm">` |
| `md` (default)   | Form fields estándar (orders, deliveries, settings)          | `<Label size="md">`, `<HelperText size="md">`, `<ErrorMessage size="md">` |

## Estados visuales

| Estado     | Receta CSS (light)                                                                                                                                                                            | Receta CSS (dark) | Notas                                                                                                                              |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `default`  | `display: flex; flex-direction: column; gap: var(--space-2); margin-block-end: var(--space-4);`                                                                                                | mismo             | Gap label↔control = `--space-2` (8px). Gap control↔helper/error = `--space-1` (4px) — aplicado por el propio `<HelperText>`/`<ErrorMessage>` con `margin-top`. |
| `error`    | mismo + el control hijo recibe `aria-invalid="true"` + `border-color: color-mix(in oklch, var(--destructive) 60%, var(--border-strong));` (delegado al control).                              | mismo             | El `<ErrorMessage>` reemplaza visualmente al `<HelperText>`. Aparece con fade `--motion-fast` `--ease-emphasis`.                   |
| `disabled` | El control hijo recibe `disabled={true}` y aplica `color: var(--text-muted); border-color: var(--border); pointer-events: none;` (sin opacity, ADR 0001 D3). El label cambia a `--text-secondary`. | mismo             | El `<FieldGroup>` no propaga `disabled` automáticamente; el control individual lo recibe.                                          |
| `required` | El `<Label>` muestra asterisco `*` en `--accent`; el control hijo recibe `aria-required="true"`.                                                                                              | mismo             | La marca visual es responsabilidad del `<Label>`; el `<FieldGroup>` solo propaga la prop.                                          |
| `optional` | El `<Label>` muestra "(opcional)" en `--text-muted` `--text-caption`.                                                                                                                          | mismo             | Idem — visual delegado a `<Label>`.                                                                                                |

Receta base (CSS):

```css
.field-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-block-end: var(--space-4);
}

.field-group__messages {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
```

> Nota: el `gap: var(--space-2)` separa label↔control. El `--space-1` que separa control↔helper/error vive en el propio `<HelperText>` / `<ErrorMessage>` (`margin-top: var(--space-1)`), no en el FieldGroup, para que cuando el componente de error desaparezca el espacio colapse limpio.

## Mobile vs desktop

- Mismo layout vertical en ambos. El gap entre fields al apilar (`margin-block-end: var(--space-4)`) es constante.
- Cuando el padre quiere fields en grid (ej. fila con dos campos lado a lado en desktop, stack en mobile), el padre aplica el grid sobre los `<FieldGroup>` y mantiene el `margin-block-end` consistente. El `<FieldGroup>` no decide layout horizontal.
- Tap target del control hijo: el control individual garantiza `min-height: 2.75rem` mobile (decálogo §8). El `<FieldGroup>` no agrega padding extra.

## Accesibilidad

- Rol ARIA: contenedor neutral (`<div>`). No emite rol propio para no contaminar el árbol semántico — el `<Label>` + control nativo + `<ErrorMessage role="alert">` ya forman la unidad accesible.
- Atributos requeridos:
  - `<Label htmlFor={name}>` enlaza al control hijo (`<Input id={name}>`). El `<FieldGroup>` valida en dev que el child tenga `id={name}` (advertencia console).
  - `aria-describedby` del control apunta al `id` del helper o error según corresponda. Patrón:
    - Helper id: `${name}-helper`.
    - Error id: `${name}-error`.
    - Sólo uno aparece a la vez (error tiene prioridad).
  - `aria-invalid="true"` en el control cuando hay error (propagado por `<FieldGroup>` al child via cloneElement o por el control que ya lee del contexto).
  - `aria-required="true"` en el control cuando `required`.
- Keyboard:
  - `Tab` enfoca el control (el label no es focusable).
  - Click en el label foca el control (comportamiento nativo `<label>`).
  - El resto del keyboard handling lo aporta el control.
- Focus management: el outline visible (decálogo §8) lo aporta el control.
- Screen reader:
  - Al focar el control, el screen reader lee: label + estado (required/optional) + valor + helper o error.
  - El `<ErrorMessage role="alert" aria-live="polite">` se anuncia dinámicamente cuando aparece (responsabilidad del propio `<ErrorMessage>`).
- `prefers-reduced-motion`: no aplica al FieldGroup; los hijos manejan sus propias reducciones.

## Motion

- El swap `<HelperText>` ↔ `<ErrorMessage>` se anima con fade `--motion-fast` `--ease-emphasis` en el `<ErrorMessage>` (entrada) y corte directo del `<HelperText>` (sale primero). Bajo `prefers-reduced-motion`: corte directo en ambos.
- El `<FieldGroup>` mismo no anima (no hay scale, no hay slide). El layout cambia por aparición/desaparición del mensaje secundario.

## Copy default + i18n

| Clave i18n sugerida                              | Valor ES                                                |
| ------------------------------------------------ | ------------------------------------------------------- |
| `components.fieldGroup.requiredAsterisk.aria`    | "obligatorio"                                           |
| `components.fieldGroup.optionalSuffix`           | "(opcional)"                                            |

> El copy de `label`, `helperText` y `error` lo provee el padre o el server. El `<FieldGroup>` solo aporta los marcadores de required/optional vía `<Label>` (que tiene su propio set de claves i18n — ver [`./Label.md`](./Label.md)).

## Edge cases

1. **`required` y `optional` ambos `true`**: en dev, console warn ("`required` y `optional` son mutuamente excluyentes; usando `required`"). En prod, gana `required` silenciosamente.
2. **`error` y `helperText` ambos presentes**: el error tiene prioridad. Solo se renderiza el `<ErrorMessage>`; el `<HelperText>` queda oculto.
3. **`error` cambia de string a `undefined` mientras el usuario corrige**: el `<ErrorMessage>` desaparece con fade y reaparece el `<HelperText>` si existía. El control pierde `aria-invalid`.
4. **`name` no coincide con `id` del child**: en dev, console warn ("`<FieldGroup name='X'>` espera un child con `id='X'`"). En prod, el `<Label htmlFor>` apunta a `name` igual y rompe accesibilidad — falla rápida en dev evita el bug en prod.
5. **Sin `<Form>` padre**: el `<FieldGroup>` funciona stand-alone leyendo solo `error` de props. El `useFormContext()` interno tolera ausencia (returns `undefined` y el componente cae a props).
6. **Child no es un control (es `<div>` decorativo)**: el `<Label htmlFor>` apunta a un id inexistente. En dev se valida con `React.Children.only` + assertion. MVP: documentar que el child debe ser un control con `id={name}`.
7. **Multiple children** (control + tooltip + button "limpiar"): permitido. El `<FieldGroup>` envuelve a todos en un `<div className="field-group__control-row">`. El primer child con `id={name}` recibe el wiring ARIA.
8. **`disabled` propagado del padre**: el `<FieldGroup>` no expone prop `disabled`; el padre la pasa al control individual. El `<Label disabled>` se activa cuando el control está disabled (responsabilidad del padre).
9. **Field-as-attribute (ADR 0001 D2)**: cuando un campo viene pre-llenado por contexto (ej. `storeId` en `delivery-create` con `?sourceOrderId`), NO usar `<FieldGroup>` con `<Input disabled>`. Usar `<FieldAttribute>` (Tier 2) que no tiene label/helper/error — es un bloque distinto.
10. **Server error genérico que aplica a múltiples campos**: el `<FieldGroup>` solo renderiza errors mapeados a `name`. Errors cross-field van al `formError` del `<Form>` (inline alert sobre `<FormFooter>`).
11. **Zod schema rechaza por refinement multi-field** (ej. "fecha hasta debe ser después de fecha desde"): el server / schema mapea a una de las dos keys (convención: la "víctima"); el otro campo queda visualmente neutro.

## Anti-patrones

1. **Wrappear `<FieldGroup>` alrededor de un campo que no tiene label** (ej. botón decorativo): rompe el contrato. Usar `<div>` directo.
2. **Pasar `error` y `helperText` esperando que se rendericen ambos**: el contrato es "uno u otro". Si necesitás dos mensajes simultáneos, repensar la UX (probable que el helperText se reemplace por un tooltip).
3. **`required` por defecto en todos los campos**: voice glossary y patrones SaaS convergen — marcar opcionales explícitamente y dejar required visual sólo donde el costo de equivocarse es alto. (Convención del producto, no del componente.)
4. **`aria-describedby` manual sobre el control**: el `<FieldGroup>` lo wirea automáticamente. Si el padre lo override, prevalece el manual y el del FieldGroup se omite.
5. **`<Label>` con `htmlFor` distinto a `name`**: rompe la accesibilidad (label apunta a un control distinto). En dev se valida.
6. **Usar `<FieldGroup>` para rellenar `helperText` con instrucciones largas multi-párrafo**: rompe la jerarquía. Usar `<Description>` o un bloque informativo separado.
7. **Color del label en `--accent` cuando el campo está focused**: rompe consistencia. El label siempre `--text-primary` (medium); el focus se comunica por el outline del control.

## Ejemplos de uso

```tsx
// Order create · paso 1 · campo Tienda con error mapeado por server
<FieldGroup name="storeId" label="Tienda" required>
  <Combobox id="storeId" name="storeId" options={stores} />
</FieldGroup>

// Settings · username con helper neutro y validación remota async
<FieldGroup
  name="username"
  label="Usuario"
  required
  helperText="Cambios cada 30 días"
>
  <Input id="username" name="username" prefix="@" />
</FieldGroup>

// Order create · paso 5 · nota opcional
<FieldGroup name="note" label="Nota" optional helperText="Solo vos la verás.">
  <Textarea id="note" name="note" maxLength={280} />
</FieldGroup>

// Override manual del error (sin <Form> padre)
<FieldGroup
  name="customField"
  label="Custom"
  error={localError}
>
  <Input id="customField" name="customField" />
</FieldGroup>
```

## Tokens consumidos

- `--space-1`, `--space-2`, `--space-4`
- (vía componentes hijos) `--text-primary`, `--text-secondary`, `--text-muted`, `--accent`, `--destructive`, `--destructive-chip-text`, `--border`, `--border-strong`, `--focus-ring`, `--font-sans`, `--text-body`, `--text-caption`, `--motion-fast`, `--ease-emphasis`

## ADRs aplicables

- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md) (D2 field-as-attribute, D3 disabled sin opacity)

## Dependencias

- [`./Label.md`](./Label.md) — render del label con `required` / `optional`.
- [`./HelperText.md`](./HelperText.md) — texto neutro debajo del control.
- [`./ErrorMessage.md`](./ErrorMessage.md) — reemplaza al helper en estado error.
- [`./Form.md`](./Form.md) — provee el contexto con `errors[name]` y `touched`.
- Cualquier control hijo: [`./Input.md`](./Input.md), [`./Textarea.md`](./Textarea.md), [`./Select.md`](./Select.md), [`./Combobox.md`](./Combobox.md), [`./DateInput.md`](./DateInput.md), [`./DateRangeInput.md`](./DateRangeInput.md), [`./Checkbox.md`](./Checkbox.md), [`./Radio.md`](./Radio.md), [`./Switch.md`](./Switch.md).

## Notas para S12 (implementación)

1. **Auto-wiring ARIA**: el `<FieldGroup>` clona el child con `React.cloneElement` para inyectar `aria-describedby`, `aria-invalid`, `aria-required`. Si el child ya tiene `aria-describedby` propio, se concatena con el del FieldGroup separado por espacio.
2. **Validación dev-only de `name === child.props.id`**: usar `useEffect` con `console.warn` cuando `process.env.NODE_ENV !== 'production'`. Evita ruido en prod.
3. **Auto-pull desde `FormContext`**: el `<FieldGroup>` hace `const ctx = useFormContext()` y, si existe, lee `ctx.errors[name]`. La prop `error` directa override.
4. **`required + optional` resolution**: console.warn en dev, prioridad a `required` en runtime. Documentar en `useFormContext` que las dos props son mutuamente excluyentes.
5. **Multiple children**: `React.Children.toArray(children)` y wirear ARIA al primero con `id={name}`. Si ningún child matchea, console.warn y skip wiring.
6. **Estilos inline vs CSS module**: la receta es trivial (flex column + gaps); puede vivir como `cn()` directo en el componente sin necesidad de CSS module dedicado.
7. **Performance**: el componente es liviano; no necesita memo. El `useFormContext` puede causar re-renders si la lib subyacente no optimiza por field — `react-hook-form` tiene `useController` que aísla; si se usa lib interna, considerar selectors.
8. **Field-as-attribute alternativo**: `<FieldAttribute>` (Tier 2 — no en este bloque) cubre el caso de prefill (ADR 0001 D2). El `<FieldGroup>` NO debe usarse con `<Input disabled>` simulando bloqueo.
9. **Cross-field errors**: para refinements multi-field (ej. fecha hasta > fecha desde), el schema Zod debe mapear el error a una de las keys; el `<FieldGroup>` lo recibe normalmente. Para errores que NO son de un campo específico, usar `formError` del `<Form>`.
10. **No envolver en `<fieldset>`**: el `<fieldset>` se reserva para grupos semánticos (radiogroup, checkbox group). Un campo individual no necesita fieldset y agregarlo afecta el layout default del browser.
