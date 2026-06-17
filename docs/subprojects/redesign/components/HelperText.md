---
title: HelperText
tier: 1
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0001 D18 (chip warning de cooldown 30 días — caso adyacente con `<HelperText>`)
---

# HelperText

## Propósito

Atom primitiva de form. Mensajes neutros debajo de cualquier control (input, textarea, select, combobox, dateinput, checkbox, radio, switch, group de radios). Aparece en [`order-create.md`](../screens/order-create.md) (ej. "Pongan un número, e.g. 123,45"), [`delivery-create.md`](../screens/delivery-create.md) (ej. "Tipo de cambio aplicado a tu moneda base"), y [`settings.md`](../screens/settings.md) (ej. "Cambios cada 30 días" tras el username — ADR 0001 D18). Cuando hay error, lo reemplaza `<ErrorMessage>`.

## API TypeScript

```ts
type HelperTextProps = {
  /** ID único — usado por `aria-describedby` del control asociado. */
  id: string;
  /** Contenido (texto o ReactNode con énfasis mínimo). */
  children: ReactNode;
  /** Tamaño. Default `md` (`--text-caption`). */
  size?: "sm" | "md";
  /** Alineación. Default `start`. `end` se usa para contadores de caracteres. */
  align?: "start" | "end";
  /** Tono. Default `neutral`. `success` se usa cuando el padre quiere refuerzo positivo (ej. "Disponible." en username). */
  tone?: "neutral" | "success";
};
```

## Variants / Sizes

| Variant (`size`) | Uso                                            | Tokens consumidos                                     |
| ---------------- | ---------------------------------------------- | ----------------------------------------------------- |
| `sm`             | Filtros densos, edición inline                 | `--text-eyebrow`, `--text-muted`                      |
| `md` (default)   | Form fields estándar                           | `--text-caption`, `--text-muted`                      |

| Tone      | Uso                                                                | Tokens consumidos                                                |
| --------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `neutral` | Default — guía, formato, info contextual                           | `--text-muted`                                                   |
| `success` | Validación remota positiva ("Disponible.", "Email confirmado.")    | `--success-chip-text` (light) / `--success` (dark)               |

## Estados visuales

| Estado    | Receta CSS (light)                                                                                                                            | Receta CSS (dark) | Notas                                                                                          |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------- |
| `neutral` | `color: var(--text-muted); font-family: var(--font-sans); font-size: var(--text-caption); line-height: var(--text-caption--line-height); margin-top: var(--space-1);`                                                                                                                              | mismo             | El margin-top respeta la separación del control de `var(--space-1)` (4px).                      |
| `success` | `color: var(--success-chip-text);`                                                                                                            | `color: var(--success);` | Sin ícono — el `<HelperText>` es solo texto. Si requiere ícono, usar `<StatusChip kind="success">`. |
| `align-end` | `text-align: end;`                                                                                                                            | mismo             | Para contadores: "0 / 2000".                                                                    |

Receta base (CSS):

```css
.helper-text {
  margin-top: var(--space-1);
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
  letter-spacing: var(--text-caption--letter-spacing);
}

.helper-text--sm {
  font-size: var(--text-eyebrow);
  line-height: var(--text-eyebrow--line-height);
}

.helper-text--success {
  color: var(--success-chip-text);
}

:root[data-theme="dark"] .helper-text--success {
  color: var(--success);
}

.helper-text--end {
  text-align: end;
}
```

## Mobile vs desktop

- Mismo tamaño visual en ambos. Posición debajo del control con `margin-top: var(--space-1)` (4px).
- Cuando hay contador alineado a la derecha y helper a la izquierda al mismo tiempo, el padre los renderiza en una fila `display: flex; justify-content: space-between;`.

## Accesibilidad

- Rol ARIA: ninguno especial. El `id` del `<HelperText>` se asocia vía `aria-describedby` del control padre.
- Screen reader: se anuncia tras el label y antes del valor del control.
- `prefers-reduced-motion`: no aplica.

## Motion

Ninguno. El cambio de helper a error (cuando aparece) lo orquesta el padre con un swap de componentes — no transición CSS.

Bajo `prefers-reduced-motion`: sin cambios (no hay animación).

## Copy default + i18n

| Clave i18n sugerida                          | Valor ES                                              |
| -------------------------------------------- | ----------------------------------------------------- |
| `components.helperText.numberFormat`         | "Pongan un número, e.g. 123,45"                       |
| `components.helperText.usernameCooldown`     | "Cambios cada 30 días"                                |
| `components.helperText.privateNote`          | "Solo tú la ves"                                      |
| `components.helperText.exchangeRate`         | "Tipo de cambio aplicado a tu moneda base"            |
| `components.helperText.usernameAvailable`    | "Disponible."                                         |
| `components.helperText.savedAt`              | "Guardado, hace {n}s"                                 |
| `components.helperText.optionalRange`        | "Sin filtro si dejas vacío."                          |

## Edge cases

1. **Helper presente y error presente**: el padre renderiza `<ErrorMessage>` y oculta `<HelperText>` (no superposición).
2. **Helper con link inline**: permitido — el link consume `--accent` y `font-weight-medium`. Mantener el resto del texto en `--text-muted`.
3. **Helper con énfasis (`<strong>`)**: usar `--font-weight-medium` y `--text-secondary` en lugar de `--text-muted`.
4. **Tone `success` sin ícono**: si el caso requiere ícono (ej. check Lucide), usar un `<StatusChip>` o `<InlineStatus>` (Tier 2) en lugar de helper.
5. **Helper en `align: end`**: solo recomendado para contadores. Combinar con helper neutro a la izquierda en una fila `flex space-between`.
6. **Multiline helper**: hace wrap natural; mantener line-height de `--text-caption`.
7. **Helper como descripción de switch (preferencia)**: permitido — apunta al `id` del switch vía `aria-describedby`.

## Anti-patrones

1. **Usar `<HelperText>` para errores**: usar `<ErrorMessage>` (semántica `role="alert"`).
2. **Color `--text-secondary` para helpers**: usar `--text-muted` (jerarquía documentada en tokens.md §1.3).
3. **Tamaño `--text-body` (15px)**: rompe la jerarquía visual del form. Helpers son siempre `--text-caption` o más pequeños.
4. **Tone `success` con copy ambiguo** (ej. "Listo."): si el copy dice "Listo." sin contexto, no es claro si es helper o feedback. Usar toast.
5. **Animar la aparición del helper con scale/transform**: rompe la lectura. Si aparece dinámicamente (ej. al focear), aparece con `display` directo o con opacity-only `--motion-fast`.
6. **Helpers cargados de jerga corporativa** ("Por favor ingrese un valor válido"): voice glossary — usar "Pongan un número, e.g. 123,45".

## Ejemplos de uso

```tsx
// Order create · paso 4 · total
<Label for="order-total" required>Total pagado</Label>
<Input id="order-total" type="number" {...} aria-describedby="order-total-helper" />
<HelperText id="order-total-helper">Pongan un número, e.g. 123,45</HelperText>

// Settings · username con tone success post-validation
<Label for="settings-username" required>Usuario</Label>
<Input id="settings-username" {...} aria-describedby="settings-username-helper" />
{available && (
  <HelperText id="settings-username-helper" tone="success">Disponible.</HelperText>
)}
{!available && !error && (
  <HelperText id="settings-username-helper">Cambios cada 30 días</HelperText>
)}

// Order create · paso 5 · contador alineado a la derecha + helper neutro a la izquierda
<div className="flex justify-between">
  <HelperText id="note-helper">Algo que quieras recordar.</HelperText>
  <HelperText id="note-counter" align="end">{value.length} / 2000</HelperText>
</div>
```

## Tokens consumidos

- `--text-muted`, `--success-chip-text`, `--success`
- `--font-sans`
- `--text-caption`, `--text-eyebrow`
- `--space-1`

## ADRs aplicables

- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md) (D18 username cooldown — caso de uso del helper text con copy "Cambios cada 30 días")

## Dependencias

Ninguna. Es atom puro.

## Notas para S12 (implementación)

1. El swap `<HelperText>` ↔ `<ErrorMessage>` lo orquesta el `<Form>` (Tier 2) — el `<Input>` solo expone `error?: string` y el `<Form>` decide qué renderizar.
2. Validar accesibilidad: `aria-describedby` apuntando a `<HelperText>` debe funcionar tanto cuando hay solo helper como cuando hay helper + counter (entonces apunta a ambos `id`s separados por espacio).
3. Tone `success` con ícono leading se considera si aparece un caso real distinto de "Disponible." — para MVP queda solo texto.
4. El `tone="success"` en dark usa `--success` directamente porque el contraste sobre `--background` ya es ≥4.5:1.
