---
title: Textarea
tier: 1
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0001 D3 (disabled sin opacity)
---

# Textarea

## Propósito

Atom de formulario para captura de texto multilínea. Aparece en el paso 5 de [`order-create.md`](../screens/order-create.md) (nota opcional, máx 2000) y en la nota privada del detail sidebar de pedidos/entregas. Soporta autosize opcional, contador de caracteres visible cuando hay `maxLength` y el contrato de helper/error idéntico al de `<Input>`.

## API TypeScript

```ts
type TextareaProps = {
  /** Identificador único para `<Label for>` y server-error mapping. */
  id: string;
  /** Nombre del campo en el form. */
  name: string;
  /** Valor controlado. */
  value: string;
  /** Cambio de valor (no dispara validación). */
  onChange: (value: string) => void;
  /** Callback de blur — dispara autosave throttle 1.5s en notas privadas (orquesta el padre). */
  onBlur?: () => void;
  /** Placeholder con voice glossary aplicado. */
  placeholder?: string;
  /** Helper neutro (ej. "Solo tú la ves"). Reemplazado por `error` cuando existe. */
  helperText?: string;
  /** Mensaje de error mapeado por el `<Form>`. */
  error?: string;
  /** Bloqueo lógico — sin opacity (ADR 0001 D3). */
  disabled?: boolean;
  /** Estado de carga (ej. autosave en curso). */
  loading?: boolean;
  /** Marca el campo como obligatorio para `<Label>` adjunta. */
  required?: boolean;
  /** Filas mínimas visibles (default `3`). */
  minRows?: number;
  /** Filas máximas antes de scroll interno (default `8`). */
  maxRows?: number;
  /** Si `true`, crece dinámicamente con el contenido entre `minRows` y `maxRows`. Default `true`. */
  autosize?: boolean;
  /** Contador `current/maxLength` visible cuando `maxLength` está definido. */
  maxLength?: number;
};
```

## Variants / Sizes

| Variant     | Uso                                                                          | Tokens consumidos                                                                |
| ----------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `default`   | Nota de pedido, nota de entrega, nota privada en detail sidebar              | `--space-3 --space-4` padding, `--text-body`, `--surface`, `--border`            |

No hay sub-sizes — la altura la controla `minRows`/`maxRows` o `autosize`.

## Estados visuales

| Estado     | Receta CSS (light)                                                                                                                                    | Receta CSS (dark) | Notas                                                                                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default`  | `background: var(--surface); border: 1px solid var(--border); color: var(--text-primary); border-radius: var(--radius-md); padding: var(--space-3) var(--space-4); resize: vertical;` | mismo             | `font-family: var(--font-sans); font-size: var(--text-body); line-height: var(--text-body--line-height);`. Resize manual vertical permitido por default.        |
| `focus`    | `border-color: var(--border-strong); outline: 2px solid var(--focus-ring); outline-offset: 2px;`                                                       | mismo             | Idéntico a `<Input>`.                                                                                                                                    |
| `filled`   | mismo `default`; el valor en `--text-primary` indica completitud                                                                                       | mismo             | —                                                                                                                                                        |
| `error`    | `border-color: color-mix(in oklch, var(--destructive) 60%, var(--border-strong));`                                                                     | mismo             | Mensaje en `<ErrorMessage>` debajo. El contador, si existe, queda en `--destructive-chip-text` cuando excede `maxLength`.                                 |
| `disabled` | `color: var(--text-muted); border-color: var(--border); pointer-events: none;`                                                                         | mismo             | Sin `opacity` (ADR 0001 D3).                                                                                                                              |
| `loading`  | mismo `default` + indicador "Guardando…" en footer del helper o spinner `loader-2` 14×14                                                                | mismo             | El padre puede mostrar "Guardado, hace 4s" en `--text-muted` `--text-caption` debajo cuando termina (voice glossary, no "Sus cambios han sido guardados").|

Receta autosize (CSS):

```css
.textarea {
  display: block;
  width: 100%;
  min-height: calc(var(--text-body--line-height) * var(--rows-min) + var(--space-3) * 2);
  max-height: calc(var(--text-body--line-height) * var(--rows-max) + var(--space-3) * 2);
  padding: var(--space-3) var(--space-4);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  resize: vertical;
  overflow-y: auto;
}
```

## Mobile vs desktop

- Mobile: `minRows = 3` por default. `resize` deshabilitado en mobile (`resize: none` en `< --breakpoint-md`) para evitar gestos confusos.
- Desktop: `minRows = 3`, `maxRows = 8`. Resize manual vertical habilitado.
- El contador `0 / 2000` aparece debajo del textarea alineado a la derecha en ambos formatos, en `--text-caption` `--text-muted`.

## Accesibilidad

- Rol ARIA: native `<textarea>` (rol implícito).
- Atributos requeridos:
  - `id` enlazado con `<Label for>`.
  - `aria-invalid="true"` cuando `error` está presente.
  - `aria-describedby` apuntando al `<HelperText>`/`<ErrorMessage>` y al contador.
  - `aria-busy="true"` cuando `loading`.
  - `aria-required="true"` cuando `required`.
- Keyboard: `Tab` enfoca, `Shift+Tab` retrocede. `Enter` inserta nueva línea (no submit). El form submit es vía `Cmd/Ctrl+Enter` desde dentro del textarea (orquestado por el form padre).
- Focus management: outline visible siempre.
- Screen reader: el contador anuncia "X de Y caracteres" via `aria-live="polite"` en updates discretos (cada 50 caracteres o al cruzar 80%/100% del límite).
- `prefers-reduced-motion`: el autosize se mantiene (no es animación, es resize directo). El spinner del estado `loading` reduce a estado estático.

## Motion

- Resize por autosize: ajuste discreto cada keystroke (sin `transition`, salto directo). No se anima `height` para evitar jitter.
- Border/color transitions: `transition: border-color var(--motion-fast) var(--ease-emphasis), color var(--motion-fast) var(--ease-emphasis);`.
- Spinner loading (si aplica): `--motion-base` infinito linear.

## Copy default + i18n

| Clave i18n sugerida                          | Valor ES                                                  |
| -------------------------------------------- | --------------------------------------------------------- |
| `components.textarea.placeholder.note`       | "Algo que quieras recordar."                              |
| `components.textarea.placeholder.privateNote`| "Nota privada — solo tú la ves"                           |
| `components.textarea.counter.format`         | "{current} / {max}"                                       |
| `components.textarea.autosave.saving`        | "Guardando…"                                              |
| `components.textarea.autosave.saved`         | "Guardado, hace {n}s"                                     |

## Edge cases

1. **Autosize alcanza `maxRows`**: el textarea queda con scroll interno; el resize manual sigue habilitado en desktop.
2. **Pegado de bloque grande**: si excede `maxLength`, trunca en cliente al pegar; contador muestra en `--destructive-chip-text` durante 2s con `--motion-fast`.
3. **Autosave throttle 1.5s** en nota privada: lo orquesta el componente padre (no el textarea). El textarea solo emite `onChange` y `onBlur`.
4. **Borrado total (clear empty)**: emitir `onChange("")` y `onBlur` permite "borrar nota privada al guardar vacío" según el flujo actual.
5. **`resize: vertical` con scroll de página**: garantizar que el handle de resize de la esquina inferior derecha funcione sin scrollear la página por accidente.
6. **Saltos de línea en pegado**: `\r\n` se normaliza a `\n` antes de emitir `onChange`.
7. **Texto bidireccional (RTL)**: el `<Textarea>` respeta `dir="auto"` por default para soportar mezcla.
8. **Server-error mapping**: el `error` recibe copy declarativo del servidor; conserva el contenido tipeado.

## Anti-patrones

1. **Animar `height` con `transition`**: produce jitter en autosize. Usar resize directo.
2. **Validación on-change** (rojo mientras escribís). Solo post-blur o post-submit (principle §3).
3. **`opacity: 0.5` para disabled**. Tokens semánticos (ADR 0001 D3).
4. **Borrar contenido tras error 500**. Conservar siempre.
5. **Placeholder como label**. Acompañar siempre de `<Label>`.
6. **Mensaje "Sus cambios han sido guardados"**. Usar voice glossary: "Guardado, hace 4s".

## Ejemplos de uso

```tsx
// Order create · paso 5 · nota opcional con autosize
<Textarea
  id="order-note"
  name="note"
  value={note}
  onChange={setNote}
  placeholder="Algo que quieras recordar."
  maxLength={2000}
  minRows={3}
  maxRows={8}
  autosize
/>

// Detail sidebar · nota privada con autosave 1.5s throttle (padre orquesta)
<Textarea
  id="order-private-note"
  name="privateNote"
  value={privateNote}
  onChange={setPrivateNote}
  onBlur={triggerAutosave}
  placeholder="Nota privada — solo tú la ves"
  helperText={savedAt ? `Guardado, hace ${savedAt}s` : "Solo tú la ves"}
  loading={autosaving}
  maxLength={2000}
/>
```

## Tokens consumidos

- `--surface`
- `--border`, `--border-strong`
- `--text-primary`, `--text-muted`
- `--destructive`, `--destructive-chip-text`
- `--focus-ring`
- `--font-sans`
- `--text-body`, `--text-caption`
- `--space-3`, `--space-4`
- `--radius-md`
- `--motion-fast`, `--motion-base`
- `--ease-emphasis`
- `--breakpoint-md`

## ADRs aplicables

- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md) (D3 disabled sin opacity)

## Dependencias

- [`./Label.md`](./Label.md)
- [`./HelperText.md`](./HelperText.md)
- [`./ErrorMessage.md`](./ErrorMessage.md)

## Notas para S12 (implementación)

1. El autosize se implementa con `useLayoutEffect` midiendo `scrollHeight` tras cada `onChange`. Se evita lib externa para no añadir bundle.
2. El throttle de autosave 1.5s vive en el componente padre (`<DetailSidebar>` slot `NotaPrivada`), no acá.
3. Considerar exponer `ref` para que el padre pueda llamar `focus()` programáticamente (ej. al expandir el detail sidebar).
4. Decidir en S12 si el textarea acepta archivos pegados (drag-and-drop de imagen para futuro). MVP: solo texto.
5. La normalización `\r\n` → `\n` se hace en `onChange` interno antes de emitir al consumidor.
