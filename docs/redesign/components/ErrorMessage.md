---
title: ErrorMessage
tier: 1
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs: []
---

# ErrorMessage

## Propósito

Atom primitiva de form. Mensaje de error con ícono Lucide `alert-circle` leading, asociado vía `aria-describedby` al control padre. Reemplaza al `<HelperText>` cuando el control tiene `error`. Aparece tras blur o submit (validación post-blur — principle §3) en cualquier campo del wizard de [`order-create.md`](../screens/order-create.md), [`delivery-create.md`](../screens/delivery-create.md), [`settings.md`](../screens/settings.md). Se anuncia con `role="alert"` `aria-live="polite"`.

## API TypeScript

```ts
type ErrorMessageProps = {
  /** ID único — usado por `aria-describedby` del control asociado. */
  id: string;
  /** Texto del error en español, voice glossary aplicado. */
  children: ReactNode;
  /** Tamaño. Default `md` (`--text-caption`). */
  size?: "sm" | "md";
};
```

## Variants / Sizes

| Variant (`size`) | Uso                                                       | Tokens consumidos                                                                |
| ---------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `sm`             | Filtros densos                                            | `--text-eyebrow`, ícono `12×12`                                                  |
| `md` (default)   | Form fields estándar                                      | `--text-caption`, ícono `14×14`                                                  |

## Estados visuales

| Estado    | Receta CSS (light)                                                                                                                                                                                                                                                  | Receta CSS (dark) | Notas                                                                                                                  |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `default` | `display: inline-flex; align-items: flex-start; gap: var(--space-1); margin-top: var(--space-1); color: var(--destructive-chip-text); font-family: var(--font-sans); font-size: var(--text-caption); line-height: var(--text-caption--line-height); letter-spacing: var(--text-caption--letter-spacing);` | `color: var(--destructive);` | El ícono `alert-circle` Lucide 14×14 hereda `currentColor`.                                                            |

Receta base (CSS):

```css
.error-message {
  display: inline-flex;
  align-items: flex-start;
  gap: var(--space-1);
  margin-top: var(--space-1);
  color: var(--destructive-chip-text);
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
  letter-spacing: var(--text-caption--letter-spacing);
}

:root[data-theme="dark"] .error-message {
  color: var(--destructive);
}

.error-message__icon {
  flex: 0 0 auto;
  width: 0.875rem; /* 14px */
  height: 0.875rem;
  margin-top: 0.0625rem; /* 1px alineación visual con la línea base */
  color: currentColor;
}

.error-message--sm {
  font-size: var(--text-eyebrow);
  line-height: var(--text-eyebrow--line-height);
}

.error-message--sm .error-message__icon {
  width: 0.75rem;
  height: 0.75rem;
}
```

## Mobile vs desktop

- Mismo tamaño visual en ambos.
- Posición debajo del control con `margin-top: var(--space-1)`.

## Accesibilidad

- Rol ARIA: `role="alert"` con `aria-live="polite"` para que screen readers anuncien el error sin interrumpir.
- Atributos requeridos: el `id` se asocia vía `aria-describedby` del control padre. El control padre debe agregar `aria-invalid="true"`.
- Keyboard: no interactúa con teclado (es solo lectura).
- Screen reader: anuncia el contenido cuando aparece. Si el error existe desde el render inicial (server-error mapping), se anuncia al focear el control; si aparece dinámicamente tras blur, se anuncia inmediatamente.
- `prefers-reduced-motion`: sin cambios (la aparición es directa, sin animación).

## Motion

- Aparición: `opacity: 0 → 1` con `--motion-fast` `--ease-emphasis`. Sin transform/scale (evita ruido visual en errores).
- Desaparición (cuando el usuario corrige): `opacity: 1 → 0` con `--motion-fast` `--ease-emphasis`.
- Bajo `prefers-reduced-motion`: corte directo sin transición.

## Copy default + i18n

| Clave i18n sugerida                                   | Valor ES                                                              |
| ----------------------------------------------------- | --------------------------------------------------------------------- |
| `components.errorMessage.required`                    | "Falta este dato"                                                     |
| `components.errorMessage.invalidEmail`                | "Email inválido"                                                      |
| `components.errorMessage.invalidNumber`               | "Pongan un número, e.g. 123,45"                                       |
| `components.errorMessage.outOfRange`                  | "Fuera del rango permitido"                                           |
| `components.errorMessage.dateInvalid`                 | "Hasta tiene que venir después de desde."                             |
| `components.errorMessage.usernameTaken`               | "Ya está en uso. Probá otro."                                         |
| `components.errorMessage.usernameCooldown`            | "Podrás cambiarlo en {days} días."                                    |
| `components.errorMessage.passwordTooShort`            | "Necesita al menos {min} caracteres"                                  |
| `components.errorMessage.serverGeneric`               | "Algo se rompió de este lado. Dale otra vez."                         |

## Edge cases

1. **Error muy largo (multi-línea)**: hace wrap con el ícono manteniéndose en la primera línea (alignment `flex-start`).
2. **Error con copy declarativo del servidor**: el padre pasa el string mapeado al campo (principle §3 server-error mapping). El componente NO traduce.
3. **Error tras submit con multiple campos en error**: cada `<ErrorMessage>` se anuncia independientemente; el primer error en el DOM recibe foco automático (orquestado por `<Form>`).
4. **Error que se resuelve mientras el usuario tipea**: el padre emite `error: undefined` después del próximo blur válido. El componente desaparece con fade.
5. **Error con link inline (ej. "...ajusta la fecha")**: permitido. El link usa `--accent` y `font-weight-medium` por encima del color destructive del padre — el contraste lo garantiza el link, no el wrapper.
6. **Error sin contenido (`children` vacío)**: el componente NO renderiza nada (return `null`). Evita íconos huérfanos.
7. **Tone diferente** (warning, info): NO soportado — usar `<StatusChip>` u `<HelperText tone="success">`. El `<ErrorMessage>` es solo destructive.

## Anti-patrones

1. **Tone "warning" en `<ErrorMessage>`**: usar `<StatusChip kind="info">` o componente dedicado. El error es destructive only.
2. **Mensajes genéricos** ("Algo salió mal"): voice glossary — usar "Algo se rompió de este lado. Dale otra vez."
3. **Mensajes corporativos** ("Por favor ingrese un valor válido"): usar "Pongan un número, e.g. 123,45".
4. **`role="alert"` con `aria-live="assertive"`**: interrumpe al usuario; usar `polite`.
5. **Animar aparición con scale/transform**: agresivo en errores; usar opacity only.
6. **Borrar el contenido tipeado del control al mostrar error**: rompe principle §3.
7. **Color `--destructive` directo en light**: rompe contraste; usar `--destructive-chip-text`.

## Ejemplos de uso

```tsx
// Username taken
<Label for="settings-username" required>Usuario</Label>
<Input id="settings-username" {...} aria-describedby="settings-username-error" aria-invalid={true} />
<ErrorMessage id="settings-username-error">Ya está en uso. Probá otro.</ErrorMessage>

// Date range invalid
<Label for="expected-delivery">Llegada esperada</Label>
<DateRangeInput id="expected-delivery" {...} aria-describedby="expected-delivery-error" />
<ErrorMessage id="expected-delivery-error">Hasta tiene que venir después de desde.</ErrorMessage>

// Server-mapped error
<ErrorMessage id="store-id-error">No te dejaron crear pedidos en esta tienda.</ErrorMessage>
```

## Tokens consumidos

- `--destructive`, `--destructive-chip-text`
- `--font-sans`
- `--text-caption`, `--text-eyebrow`
- `--space-1`
- `--motion-fast`
- `--ease-emphasis`

## ADRs aplicables

Ninguno directo. Refleja la voz del decálogo §3 (validación post-blur) y voice glossary §7.

## Dependencias

Ninguna. Es atom puro. El ícono `alert-circle` viene de `lucide-react`.

## Notas para S12 (implementación)

1. El componente expone `id` para que el `<Form>` lo asocie. El padre maneja `aria-invalid` del control y el `aria-describedby` apuntando al `id` del error.
2. El swap `<HelperText>` ↔ `<ErrorMessage>` lo orquesta el `<Form>`; el `<Input>` solo expone `error?: string`.
3. La aparición/desaparición con fade es opcional. Si la auditoría a11y pide corte directo, removerla en S12.
4. El ícono `alert-circle` puede importarse directo de `lucide-react`. No envolverlo en un componente intermedio.
5. Para errores multi-control (ej. discrepancia de Σ items vs total), usar un componente Tier 2 `<FormError>` que apunte a múltiples campos.
