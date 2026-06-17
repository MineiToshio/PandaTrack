---
title: FormFooter
tier: 4
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0001 D12 (autosave local "Guardado en este navegador, hace Ns")
  - ADR 0001 D3 (disabled sin opacity)
---

# FormFooter

## Propósito

Tier 4 sticky bottom de los formularios PandaTrack. Combina CTA primaria + secundaria opcional + `helperText` (típicamente el indicador de autosave "Guardado en este navegador, hace 4s" — ADR 0001 D12 OC4). Aparece al pie de [`order-create.md`](../screens/order-create.md), [`delivery-create.md`](../screens/delivery-create.md) y [`settings.md`](../screens/settings.md). Se asocia al `<Form>` padre por `id` para que el botón submit dispare la validación + submit del wrapper. Lee `lastSavedAt` y `isSubmitting` del `FormContext` cuando vive dentro de un `<Form>`.

## API TypeScript

```ts
import type { ReactNode } from "react";

type FormFooterAction = {
  /** Copy del botón. Voice glossary aplicado (ej. "Crear pedido", "Guardar", "Anotar pago"). */
  label: string;
  /** `submit` cuando dispara el submit del `<Form>` padre vía atributo `form="<id>"`. Default `submit`. */
  type?: "submit" | "button";
  /** Handler explícito. Requerido cuando `type === "button"`. */
  onClick?: () => void;
  /** Estado de carga. Muestra spinner `loader-2` en el slot leading. */
  loading?: boolean;
  /** Bloqueo lógico. Sin opacity (ADR 0001 D3). */
  disabled?: boolean;
  /** ID del `<form>` al que apunta (atributo HTML `form`). Default: el padre `<Form>` lo inyecta vía contexto. */
  formId?: string;
};

type FormFooterSecondaryAction = {
  label: string;
  /** Siempre `button` — secondary nunca dispara submit. */
  onClick: () => void;
  /** Estado de carga (ej. mientras se hace `confirm` antes de cancelar). */
  loading?: boolean;
  /** Bloqueo lógico. */
  disabled?: boolean;
};

type FormFooterProps = {
  primaryAction: FormFooterAction;
  secondaryAction?: FormFooterSecondaryAction;
  /**
   * Texto auxiliar a la izquierda. Cuando vive dentro de un `<Form>` con autosave,
   * se rellena automáticamente con "Guardado en este navegador, hace Ns" leyendo
   * `lastSavedAt` del contexto. Permite override manual.
   */
  helperText?: string;
  /** Override del posicionamiento. Default `sticky`. `inline` = sin sticky, fluye con el form. */
  position?: "sticky" | "inline";
};
```

## Variants / Sizes

| Variant (`position`) | Uso                                                                                                   | Tokens consumidos                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `sticky` (default)   | Forms largos con scroll interno (`order-create`, `delivery-create`).                                  | `--surface`, `--border`, `--space-4`, `--space-6`, `--z-sticky`     |
| `inline`             | Forms cortos en modal o sheet donde el footer no debe pegarse al viewport (`settings` modal de email). | `--surface`, `--border`, `--space-4`, `--space-6`                   |

## Estados visuales

| Estado          | Receta CSS (light)                                                                                                                                                                                                                                            | Receta CSS (dark) | Notas                                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default`       | `background: var(--surface); border-top: 1px solid var(--border); padding: var(--space-4) var(--space-6); display: flex; align-items: center; justify-content: space-between; gap: var(--space-4);`                                                            | mismo             | El semantic element es `<footer>`. Cuando `position: "sticky"` se agrega `position: sticky; bottom: 0; z-index: var(--z-sticky);`.                                   |
| `sticky-mobile` | mismo + `padding-bottom: max(var(--space-4), env(safe-area-inset-bottom));` para respetar home indicator iOS.                                                                                                                                                  | mismo             | Mobile (`< --breakpoint-md`).                                                                                                                                        |
| `submitting`    | El primaryAction muestra spinner + `aria-busy="true"`. El ancho del botón se preserva (no shrink).                                                                                                                                                            | mismo             | El secondaryAction queda activo (permite cancelar el flujo si el padre lo soporta).                                                                                  |
| `helperOnly`    | Cuando hay solo `helperText` sin acciones (raro — sólo modo lectura). Padding reducido.                                                                                                                                                                       | mismo             | No es estado típico; documentado por completitud.                                                                                                                    |

Receta base (CSS):

```css
.form-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-6);
  background: var(--surface);
  border-top: 1px solid var(--border);
}

.form-footer--sticky {
  position: sticky;
  bottom: 0;
  z-index: var(--z-sticky);
}

@media (max-width: 47.999rem) {
  .form-footer--sticky {
    padding-bottom: max(var(--space-4), env(safe-area-inset-bottom));
  }
}

.form-footer__helper {
  flex: 1 1 auto;
  min-width: 0;
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
  letter-spacing: var(--text-caption--letter-spacing);
}

.form-footer__actions {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
}
```

## Mobile vs desktop

- Desktop (`≥ --breakpoint-md`): full width al pie del form. `helperText` a la izquierda, acciones a la derecha (`secondaryAction` ghost antes de `primaryAction`). Sticky con `bottom: 0` cuando aplica.
- Mobile (`< --breakpoint-md`):
  - Sticky con `padding-bottom: max(var(--space-4), env(safe-area-inset-bottom))` para respetar el home indicator iOS.
  - El `helperText` puede colapsar a una línea superior (stack vertical) cuando el ancho es insuficiente para que conviva con dos botones legibles. Heurística: si `< --breakpoint-xs` (384px), `flex-direction: column; align-items: stretch;` con helperText arriba (`text-align: start`) y acciones debajo full-width (`primaryAction` ocupa todo el ancho; `secondaryAction` queda como link ghost arriba a la izquierda del helperText).
  - Touch target: `primaryAction` y `secondaryAction` heredan `min-height: 2.75rem` del `<Button>` (≥44px tap target).

## Accesibilidad

- Rol ARIA: native `<footer>` semántico dentro del `<form>`.
- Atributos requeridos:
  - `primaryAction` con `type="submit"` debe incluir `form={formId}` cuando vive fuera del DOM del `<form>` (caso sticky en sheet/modal con portal). Cuando está dentro del DOM del form, el atributo es opcional pero recomendado para claridad.
  - `aria-busy="true"` en el `primaryAction` durante `loading` (lo aporta `<Button loading>`).
- Keyboard:
  - `Tab` enfoca primero `secondaryAction` luego `primaryAction` (orden visual = orden DOM).
  - `Enter` dentro de un `<Input>` del `<Form>` padre dispara submit equivalente al click en `primaryAction` (manejo nativo del form).
  - `Esc` no se intercepta.
- Focus management: el outline visible (decálogo §8) lo aporta cada `<Button>` hijo.
- Screen reader:
  - El `helperText` se lee como texto del footer al navegar.
  - `lastSavedAt` no se anuncia automáticamente cada throttle (sería ruido); el screen reader lo anuncia cuando el usuario navega al elemento del helper.
  - El `primaryAction` durante `loading` anuncia "Guardando…" vía `aria-busy` + `aria-label` opcional (delegado a `<Button>`).
- `prefers-reduced-motion`: ningún cambio (el footer no anima).

## Motion

- Aparición/desaparición del `helperText` (cuando autosave actualiza `lastSavedAt`): fade `--motion-fast` `--ease-emphasis`.
- Spinner del `primaryAction` en `loading`: `--motion-base` infinito linear (delegado a `<Button>`).
- Bajo `prefers-reduced-motion`: corte directo en cada caso.

## Copy default + i18n

| Clave i18n sugerida                           | Valor ES                                   |
| --------------------------------------------- | ------------------------------------------ |
| `components.formFooter.cancel.default`        | "Cancelar"                                 |
| `components.formFooter.save.default`          | "Guardar"                                  |
| `components.formFooter.submit.default`        | "Listo"                                    |
| `components.formFooter.discard.default`       | "Descartar"                                |
| `components.formFooter.helper.savingAria`     | "Guardando borrador…"                      |
| `components.formFooter.helper.savedFormat`    | "Guardado en este navegador, {time}"       |

> Los copy de `primaryAction.label` y `secondaryAction.label` los provee el padre (cada pantalla decide su microcopy). Las claves arriba son **defaults sugeridos** cuando el padre no aporta otra cosa. La clave `helper.savedFormat` interpola con la salida de `components.form.autosave.relativeTime` (definida en [`./Form.md`](./Form.md)).

## Edge cases

1. **Sin `secondaryAction`**: el `primaryAction` se alinea a la derecha; el `helperText` queda a la izquierda con `flex: 1`. En mobile <`--breakpoint-xs`, el primaryAction va full-width y el helperText arriba.
2. **`primaryAction.disabled = true`**: el botón usa `--text-muted` + `--border` (sin opacity, ADR 0001 D3). El submit por `Enter` queda bloqueado por el `<Form>` padre (no por el footer).
3. **`primaryAction.loading = true` Y `disabled = true`**: prioridad visual al loading (spinner visible). El click queda bloqueado.
4. **`helperText` muy largo** (ej. mensaje de error inline): el `helperText` hace truncate con `text-overflow: ellipsis` en una línea desktop y wrap a dos líneas en mobile. Si el copy supera 2 líneas, el padre debe mover el mensaje al inline alert del `<Form>` (`formError`).
5. **Footer dentro de un sheet con scroll interno**: el sticky funciona dentro del scroll container (no del viewport). El `<Sheet>` debe tener `overflow-y: auto` y el footer queda al pie del sheet.
6. **Footer fuera del DOM del `<form>`** (portal de modal): `primaryAction.formId` debe coincidir con el `id` del `<form>` para que el `<button form={formId} type="submit">` funcione. El padre `<Form>` inyecta este valor por contexto cuando es posible.
7. **Mobile keyboard abierto**: el sticky bottom queda por encima del keyboard nativo (responsabilidad del browser). Si el sheet contenedor tiene `--sheet-max-h: 92svh`, el footer permanece accesible.
8. **`secondaryAction.onClick` con confirmación pendiente** (ej. cancelar con cambios sin guardar): el padre orquesta el `<Modal>` de confirm; el footer solo dispara el callback. Mientras el modal está abierto, `secondaryAction.loading` puede activarse para feedback.
9. **Theme switch durante `submitting`**: las superficies del footer cambian con el theme; el spinner mantiene su color (currentColor del botón).
10. **Sin `helperText` ni autosave**: el slot helper queda vacío; `flex: 1` lo ocupa con espacio en blanco — los botones quedan a la derecha.

## Anti-patrones

1. **Botones full-width en desktop**: rompe la jerarquía visual; usa right-aligned con secondaryAction ghost.
2. **`opacity: 0.5` para `disabled`**: rompe ADR 0001 D3. Usa `--text-muted` + `--border` vía `<Button disabled>`.
3. **`primaryAction` y `secondaryAction` con el mismo peso visual**: rompe decálogo §2 (una decisión por pantalla). El primary es solid, el secondary ghost.
4. **Texto del primary en mayúsculas o con suffix decorativo**: voice glossary — natural, breve, directo ("Crear pedido", no "CREAR PEDIDO" ni "Crear pedido →").
5. **Hardcodear `bottom: 56px` para esquivar tab bar mobile**: usar `env(safe-area-inset-bottom)` y respetar el contexto. Si el sheet contenedor maneja el safe-area, el footer no necesita compensar.
6. **`z-index` arbitrario**: usar `--z-sticky` (10). No competir con `--z-modal` (80) ni con `--z-toast` (90).
7. **Anunciar `lastSavedAt` cada autosave**: ruido para screen readers. El helper se anuncia bajo demanda al navegar al elemento.
8. **Mostrar 3 acciones (primary + secondary + tertiary)**: rompe decálogo §2. Si una pantalla pide 3 acciones, mover la tercera al overflow `[···]` del header (ADR 0001 D6).
9. **`type="submit"` sin un `<Form>` padre**: el botón no hace nada útil. Usar `type="button"` + `onClick` explícito.
10. **Mezclar `helperText` con copy de error**: el error a nivel de form vive en el inline alert sobre el footer (ver `<Form>`); el helper del footer es para metadata neutra (autosave timestamp, last-edit hint).

## Ejemplos de uso

```tsx
// Order create — sticky con autosave (lastSavedAt viene de useFormContext)
<FormFooter
  primaryAction={{ label: "Crear pedido", type: "submit", loading: isSubmitting }}
  secondaryAction={{ label: "Cancelar", onClick: () => router.back() }}
  // helperText auto-rellenado por <Form> con "Guardado en este navegador, hace 4s"
/>

// Settings · email change modal — inline (no sticky)
<FormFooter
  position="inline"
  primaryAction={{ label: "Confirmar", type: "submit", loading: confirming }}
  secondaryAction={{ label: "Cancelar", onClick: closeModal }}
/>

// Delivery create — primary sin secondary, helper manual
<FormFooter
  primaryAction={{ label: "Crear entrega", type: "submit", disabled: !hasItems }}
  helperText="Se enviará desde tu tienda."
/>
```

## Tokens consumidos

- `--surface`
- `--border`
- `--text-muted`, `--text-primary`
- `--font-sans`
- `--text-caption`
- `--space-3`, `--space-4`, `--space-6`
- `--z-sticky`
- `--motion-fast`
- `--ease-emphasis`
- `--breakpoint-md`, `--breakpoint-xs`

## ADRs aplicables

- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md) (D3 disabled sin opacity, D12 autosave copy "Guardado en este navegador, hace Ns")

## Dependencias

- [`./Form.md`](./Form.md) — provee el contexto con `lastSavedAt` y `isSubmitting`; el footer lee de ahí cuando no recibe overrides.
- [`./Button.md`](./Button.md) — `primaryAction` y `secondaryAction` se renderizan como `<Button>` (variant `primary` y `ghost` respectivamente).

## Notas para S12 (implementación)

1. **Auto-pull de `lastSavedAt`**: cuando el footer vive dentro de un `<Form>` con autosave y no recibe `helperText`, hace `useFormContext()` y formatea `lastSavedAt` con `components.form.autosave.localPrefix` + `components.form.autosave.relativeTime`. Si recibe `helperText` explícito, gana el explícito.
2. **Timer relativo**: el footer corre un `setInterval(1000)` mientras `lastSavedAt` está definido para refrescar el "hace Ns". Pausa cuando el documento está oculto (`visibilitychange`) para no consumir batería.
3. **`formId` injection**: el `<Form>` provee `formId` por contexto. El footer lo pasa al `<Button>` cuando `primaryAction.type === "submit"` y `formId` no está en props. Esto soporta el caso "footer renderizado vía portal fuera del `<form>` DOM" (modal con header sticky + body scrollable + footer sticky).
4. **Stack a column en `< --breakpoint-xs`**: usar container queries cuando estén disponibles; mientras tanto, media query.
5. **Analytics**: el `primaryAction` y `secondaryAction` heredan tracking de `<Button>` (data-ph-event). El footer no agrega eventos propios.
6. **Tertiary action gating**: si una pantalla intenta agregar una tercera acción, el linter (S12) emite warning y sugiere mover al overflow del header (ADR 0001 D6).
7. **`safe-area-inset-bottom` fallback**: en browsers que no soportan `env()`, `max(var(--space-4), env(safe-area-inset-bottom))` resuelve a `var(--space-4)` por la spec CSS. Verificado en Safari 15+.
8. **No usar `<Toolbar>` rol ARIA**: el footer no es toolbar (no agrupa controles relacionados de manipulación), es un cluster de acciones de submit. `<footer>` semántico basta.
