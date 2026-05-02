---
title: Input
tier: 1
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0001 D2 (field-as-attribute para inputs pre-llenados — no usar `disabled` simulando bloqueo)
  - ADR 0001 D3 (disabled sin opacity)
  - ADR 0006 (icon+label contract — relevante cuando un input expone íconos accent-cool)
---

# Input

## Propósito

Atom de formulario para captura de texto en una sola línea. Aparece en los pasos 1, 2 y 4 de [`order-create.md`](../screens/order-create.md), en el paso 1, 3 (search) y 4 de [`delivery-create.md`](../screens/delivery-create.md), y en cada fila editable de [`settings.md`](../screens/settings.md) (username, displayName, email, password, budget). Cubre los 7 tipos nativos más usados (`text`, `number`, `email`, `password`, `search`, `tel`, `url`) con afijos visuales, contador de caracteres, helper y mensaje de error.

## API TypeScript

```ts
type InputType = "text" | "number" | "email" | "password" | "search" | "tel" | "url";
type InputSize = "sm" | "md" | "lg";

type InputBaseProps = {
  /** Identificador único para `label[for]` y mapping a errores del servidor. */
  id: string;
  /** Nombre del campo en el form (server action). */
  name: string;
  /** Valor controlado. */
  value: string;
  /** Cambio de valor (no dispara validación — la validación es post-blur). */
  onChange: (value: string) => void;
  /** Callback de blur — el form pide validación acá. */
  onBlur?: () => void;
  /** Placeholder con voice glossary aplicado (ej. "¿Qué tienda?", "Pongan un número"). */
  placeholder?: string;
  /** Tamaño del control. Default `md`. */
  size?: InputSize;
  /** Texto neutro debajo del input. Reemplazado por `error` cuando existe. */
  helperText?: string;
  /** Mensaje de error mapeado por el `<Form>` (ADR 0001 + principle §3 server-error mapping). */
  error?: string;
  /** Bloqueo lógico — sin opacity (ADR 0001 D3). Usar `field-as-attribute` cuando el bloqueo viene de prefill. */
  disabled?: boolean;
  /** Estado de carga (validación remota o autocomplete). */
  loading?: boolean;
  /** Marca el campo como obligatorio para `<Label>` adjunta. */
  required?: boolean;
  /** Ícono Lucide en el slot leading. Decorativo — necesita label adyacente vía `<Label>` (ADR 0006). */
  leadingIcon?: ReactNode;
  /** Ícono Lucide en el slot trailing. Si es interactivo (botón), debe exponer `aria-label`. */
  trailingIcon?: ReactNode;
  /** Texto fijo izquierdo (ej. "$", "@", "https://"). No editable, parte del visual. */
  prefix?: string;
  /** Texto fijo derecho (ej. "USD", "/mes"). No editable. */
  suffix?: string;
  /** Contador de caracteres `current / max`. Solo visible cuando `maxLength` está definido. */
  maxLength?: number;
  /** Atributo nativo `autocomplete` (ej. "email", "current-password"). */
  autoComplete?: string;
  /** Atributo nativo `inputmode` cuando `type="number"` necesita teclado decimal. */
  inputMode?: "text" | "decimal" | "numeric" | "tel" | "search" | "email" | "url";
};

type InputTextProps = InputBaseProps & {
  type: "text" | "email" | "search" | "tel" | "url";
};

type InputNumberProps = InputBaseProps & {
  type: "number";
  /** Mínimo aceptable. */
  min?: number;
  /** Máximo aceptable. */
  max?: number;
  /** Paso de incremento. */
  step?: number;
};

type InputPasswordProps = InputBaseProps & {
  type: "password";
  /** Toggle eye/eye-off para mostrar/ocultar (default `true`). */
  revealable?: boolean;
};

type InputProps = InputTextProps | InputNumberProps | InputPasswordProps;
```

## Variants / Sizes

| Variant (`size`) | Uso                                                                 | Tokens consumidos                                                |
| ---------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `sm`             | Inputs de cabecera dentro de tabla, edición inline densa            | `--space-2 --space-3` padding, `--text-caption`, height `2rem`   |
| `md` (default)   | Form fields estándar (orders, deliveries, settings)                 | `--space-3 --space-4` padding, `--text-body`, height `2.5rem`    |
| `lg`             | Inputs hero (search global, comboboxes principales del wizard)      | `--space-3 --space-4` padding, `--text-body-lg`, height `2.75rem` |

Tipo del input (`type`):

| `type`     | Uso                                                              | Notas                                                                          |
| ---------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `text`     | Default — username, displayName, item name, item search          | —                                                                              |
| `number`   | Cantidad, monto, exchangeRate, budgetAmount                      | `font-variant-numeric: tabular-nums` activado por default (decálogo §9).        |
| `email`    | Auth, settings · email                                           | `autoComplete="email"`, `inputMode="email"`.                                   |
| `password` | Auth, settings · contraseña                                      | Toggle eye/eye-off Lucide (`revealable`); `autoComplete="current-password"`.   |
| `search`   | Search de tienda (combobox), search de productos en `delivery-create` | Leading icon `search` Lucide. Submit con Enter dispara filtro.            |
| `tel`      | (futuro) confirmación 2FA por SMS                                | `inputMode="tel"`.                                                             |
| `url`      | Link de tracking opcional (no MVP)                               | `inputMode="url"`.                                                             |

## Estados visuales

| Estado     | Receta CSS (light)                                                                                                                                 | Receta CSS (dark)                                                                                                                                 | Notas                                                                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `default`  | `background: var(--surface); border: 1px solid var(--border); color: var(--text-primary); border-radius: var(--radius-md);`                         | mismo                                                                                                                                              | Padding `var(--space-3) var(--space-4)`. Min-height `2.75rem` mobile / `2.5rem` (`md`) desktop para tap target ≥44 mobile.              |
| `focus`    | `border-color: var(--border-strong); outline: 2px solid var(--focus-ring); outline-offset: 2px;`                                                   | mismo                                                                                                                                              | El `outline` reemplaza box-shadow para no chocar con elevación. Caret usa `caret-color: var(--accent)`.                                |
| `filled`   | mismo que `default`; el valor en `--text-primary` indica completitud                                                                               | mismo                                                                                                                                              | No se cambia el border al "completar".                                                                                                 |
| `error`    | `border-color: color-mix(in oklch, var(--destructive) 60%, var(--border-strong));`                                                                 | mismo, usando `--destructive` dark                                                                                                                 | El mensaje de error se renderiza con `<ErrorMessage>` debajo.                                                                          |
| `disabled` | `color: var(--text-muted); border-color: var(--border); pointer-events: none;`                                                                     | mismo                                                                                                                                              | Sin `opacity` (ADR 0001 D3). Si el bloqueo viene de prefill, usar `field-as-attribute` (ADR 0001 D2) en lugar de `disabled`.            |
| `loading`  | mismo `default` + spinner `loader-2` Lucide en slot trailing animado `--motion-base` infinito linear                                                | mismo                                                                                                                                              | El input mantiene foco; `aria-busy="true"` en el wrapper.                                                                              |

Receta base (CSS):

```css
.input {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-height: 2.75rem; /* mobile tap target */
  padding-inline: var(--space-4);
  padding-block: var(--space-3);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}

@media (min-width: 48rem) {
  .input--md { min-height: 2.5rem; }
}

.input:focus-visible {
  border-color: var(--border-strong);
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.input--error {
  border-color: color-mix(in oklch, var(--destructive) 60%, var(--border-strong));
}

.input--disabled {
  color: var(--text-muted);
  border-color: var(--border);
  pointer-events: none;
}

.input[type="number"] {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}
```

## Mobile vs desktop

- Mobile (`< --breakpoint-md`, 768px): `min-height: 2.75rem` para garantizar tap target ≥44. Leading/trailing icon clickable extiende padding interno a 44×44.
- Desktop (`≥ --breakpoint-md`): `size="md"` baja a `2.5rem`. `size="lg"` mantiene `2.75rem`.
- Contador de caracteres aparece a la derecha del helper en mobile y como overlay sutil dentro del input en desktop cuando hay espacio. En ambos casos consume `--text-caption` `--text-muted`.

## Accesibilidad

- Rol ARIA: native `<input>` (rol implícito).
- Atributos requeridos:
  - `id` enlazado con `<Label>` mediante `for`.
  - `aria-invalid="true"` cuando `error` está presente.
  - `aria-describedby` apuntando al `<HelperText>` o `<ErrorMessage>` correspondiente.
  - `aria-busy="true"` cuando `loading`.
  - `aria-required="true"` cuando `required`.
- Keyboard: `Tab` enfoca, `Shift+Tab` retrocede, `Enter` submit del form padre. En `type="search"`, `Esc` limpia el contenido.
- Focus management: outline visible siempre `2px solid var(--focus-ring)` con `outline-offset: 2px` (decálogo §8). Nunca suprimir el outline nativo.
- Screen reader: el `<ErrorMessage>` es `role="alert"` `aria-live="polite"` (ver `ErrorMessage.md`).
- `prefers-reduced-motion`: el spinner `loader-2` reduce a `animation-duration: 0.01ms` con un fade estático (decálogo §8).

## Motion

- Color/border transitions: `transition: border-color var(--motion-fast) var(--ease-emphasis), color var(--motion-fast) var(--ease-emphasis);`.
- Spinner loading: rotación `--motion-base` infinito `linear`. Reducido a estado estático bajo `prefers-reduced-motion`.
- Eye toggle (`type="password"`): swap de ícono `eye` ↔ `eye-off` con `transition: opacity var(--motion-fast) var(--ease-emphasis)`.

## Copy default + i18n

| Clave i18n sugerida                            | Valor ES                                  |
| ---------------------------------------------- | ----------------------------------------- |
| `components.input.placeholder.search`          | "Buscar"                                  |
| `components.input.placeholder.email`           | "tu@email.com"                            |
| `components.input.placeholder.amount`          | "Pongan un número, e.g. 123,45"           |
| `components.input.placeholder.username`        | "@tuusuario"                              |
| `components.input.passwordToggle.show`         | "Ver contraseña"                          |
| `components.input.passwordToggle.hide`         | "Ocultar contraseña"                      |
| `components.input.counter.format`              | "{current} / {max}"                       |
| `components.input.loading.aria`                | "Buscando…"                               |
| `components.input.search.clearAria`            | "Limpiar búsqueda"                        |
| `components.input.required.marker`             | "obligatorio"                             |

## Edge cases

1. **Prefill con `sourceOrderId`** (delivery-create): NO renderizar como `<Input disabled>`. Usar `field-as-attribute` (ADR 0001 D2). Este componente NO cubre ese patrón; lo cubre `<FieldAttribute>` (Tier 2).
2. **Valor numérico con coma decimal en `es-AR`**: el componente normaliza coma → punto antes de emitir `onChange`; preserva la vista con coma. Helper sugerido: "Pongan un número, e.g. 123,45".
3. **Pegado de texto con caracteres invisibles**: trim de `​`, `‌`, `‍` antes de emitir `onChange` (anti-spoof).
4. **`maxLength` excedido por paste**: trunca en cliente al pegar; muestra contador en `--destructive-chip-text` durante 2s con `--motion-fast` `--ease-emphasis`.
5. **Validación remota lenta** (username availability): el `loading` se mantiene hasta resolución; el form padre orquesta debounce.
6. **Error del servidor mapeado a campo**: `error` recibe el copy declarativo en español. Nunca limpiar el valor tipeado (principle §3).
7. **Autofill del navegador**: respetar el `:autofill` styling nativo o sobrescribir con `box-shadow: inset 0 0 0 1000px var(--surface)` para evitar el amarillo Chrome.
8. **`type="password"` con `revealable: false`**: no renderiza el toggle (caso flujos de signup donde la confirmación es por re-tipeo).
9. **Long-press en mobile sobre password**: respetar comportamiento nativo (paste menu); el toggle eye sigue accesible.

## Anti-patrones

1. **Usar `disabled` cuando el valor viene pre-llenado por contexto.** Romper a `field-as-attribute` (ADR 0001 D2).
2. **`opacity: 0.5` para disabled.** Usa tokens semánticos (ADR 0001 D3).
3. **Validación on-change** (ej. red mientras escribís el email). Solo on-blur o on-submit (principle §3).
4. **Limpiar input tras error 500.** Conservar el valor tipeado siempre.
5. **`text-white` hardcoded en el caret o en placeholders dark**. Usar `--text-primary` y `--text-muted`.
6. **Borrar el contador al exceder maxLength.** El contador queda visible en rojo para que el usuario corrija.
7. **Suprimir el outline de focus** ("se ve más limpio"). Decálogo §8 lo prohíbe.
8. **Placeholder como label**. El placeholder se evapora al tipear; siempre acompañar de `<Label>`.

## Ejemplos de uso

```tsx
// Settings · username con validación remota
<Input
  id="settings-username"
  name="username"
  type="text"
  value={username}
  onChange={setUsername}
  onBlur={validateAvailability}
  prefix="@"
  loading={checking}
  error={availabilityError}
  helperText={!availabilityError ? "Cambios cada 30 días" : undefined}
  required
  size="md"
  autoComplete="username"
/>

// Order create · paso 4 · total con calcular ghost externo
<Input
  id="order-total"
  name="totalCost"
  type="number"
  value={total}
  onChange={setTotal}
  prefix="$"
  suffix="USD"
  inputMode="decimal"
  step={0.01}
  min={0}
  helperText="Pongan un número, e.g. 123,45"
  required
/>
```

## Tokens consumidos

- `--background`, `--surface`
- `--border`, `--border-strong`
- `--text-primary`, `--text-muted`
- `--destructive`, `--destructive-chip-text`
- `--accent` (caret)
- `--focus-ring`
- `--font-sans`, `--font-mono` (cuando se renderiza un identificador, vía `<MonoCode>` interno)
- `--text-body`, `--text-body-lg`, `--text-caption`
- `--space-2`, `--space-3`, `--space-4`
- `--radius-md`
- `--motion-fast`, `--motion-base`
- `--ease-emphasis`
- `--breakpoint-md`

## ADRs aplicables

- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md) (D2 field-as-attribute, D3 disabled sin opacity)
- [ADR 0006 — Color blindness icon+label contract](../decisions/0006-color-blindness-icon-label-contract.md)

## Dependencias

- [`./Label.md`](./Label.md) — atom adjunto que provee el `for` semántico.
- [`./HelperText.md`](./HelperText.md) — slot debajo del input.
- [`./ErrorMessage.md`](./ErrorMessage.md) — reemplaza `HelperText` en estado error.
- (Tier 2) `<FieldAttribute>` — alternativa cuando aplica ADR 0001 D2.
- (Tier 2) `<Form>` — orquesta blur/submit y el server-error mapping.

## Notas para S12 (implementación)

1. La normalización de coma decimal → punto vive en un util `normalizeDecimal(value, locale)` en `src/lib/format`. No baked-in al componente.
2. El comportamiento `:autofill` sobrescrito (`box-shadow: inset 0 0 0 1000px var(--surface)`) requiere prueba en Safari 16; si falla usar `-webkit-text-fill-color: var(--text-primary)`.
3. `inputMode` se infiere automáticamente cuando `type` es `email` / `tel` / `url` / `number`; sólo se sobrescribe explícitamente para `decimal`.
4. La librería de spinner `loader-2` se importa directo de `lucide-react`; no envolver en componente intermedio.
5. Pendiente decidir si `prefix`/`suffix` aceptan `ReactNode` o solo `string`; este spec los limita a `string` para evitar abuso.
6. La validación remota (debounce 300ms en username) la orquesta el form padre, no el `<Input>`.
