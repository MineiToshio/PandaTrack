---
title: Toast
tier: 3
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0001 D4 (toast neutral-undo 5s/8s + atajo `Z`)
  - ADR 0001 D6 (overflow `[···]` para destructive irreversible — el toast undo materializa la reversibilidad)
  - ADR 0006 (icon+label contract — chips/icons informativos siempre con texto adyacente)
---

# Toast

## Propósito

Surface primitive para feedback transitorio post-acción. Cubre seis variantes: `neutral-undo` (reversa optimista de mutaciones reversibles — ADR 0001 D4), `achievement` (celebración con mascota y halo `--accent-warm`), y los cuatro status semánticos `success | warning | error | info`. Aparece en [`order-detail.md`](../screens/order-detail.md) (delete pago / cancelar / restaurar pedido), [`orders-list.md`](../screens/orders-list.md) (selección masiva), [`order-create.md`](../screens/order-create.md) (autosave, error de servidor), [`delivery-create.md`](../screens/delivery-create.md) (pre-selección masiva con undo) y dashboard (achievement post-pago full).

## API TypeScript

```ts
import type { ReactNode } from "react";

type ToastDurationUndo = 5000 | 8000;

type ToastPropsNeutralUndo = {
  variant: "neutral-undo";
  /** Mensaje en una sola línea. Aplicar voice glossary §7. */
  message: string;
  /** CTA visible. Default i18n `components.toast.undoLabel` ("Deshacer"). */
  undoLabel?: string;
  /** Handler invocado por click o por atajo `Z` mientras el toast esté visible. */
  onUndo: () => void;
  /**
   * 5000ms para acciones de impacto medio (delete pago, selección masiva, optimistic update simple).
   * 8000ms reservado para delete de pedido entero (ADR 0001 D4 / D6).
   * Default 5000.
   */
  duration?: ToastDurationUndo;
  /** Atajo declarativo. Solo `"Z"` en MVP. Se renderiza como `<Kbd>` desktop, oculto mobile. */
  kbd?: "Z";
};

type ToastPropsAchievement = {
  variant: "achievement";
  /** Copy celebratorio. Una emoji opcional permitida (✨ 🎉 🌱). */
  message: string;
  /** Emoji al final del mensaje. Default `"✨"`. */
  emoji?: string;
  /** Pose de la mascota — solo `"celebrating"` en MVP (principles §6 — mascota escasa). */
  mascot?: "celebrating";
  /** Hold antes del fade-out. Default `var(--motion-slow)` (480ms) post-mount + 800ms hold. */
  duration?: number;
  /**
   * Fuerza de anuncio screen reader. Default `"polite"`.
   * `"assertive"` solo para achievements bloqueantes (ej. colección completa).
   */
  ariaLive?: "polite" | "assertive";
};

type ToastPropsStatus = {
  variant: "success" | "warning" | "error" | "info";
  /** Mensaje principal. */
  message: string;
  /** Detalle opcional en `--text-secondary`. Una línea adicional. */
  description?: string;
  /** Auto-dismiss ms. Default 5000. */
  duration?: number;
};

/** Discriminated union — TS rechaza combinaciones inválidas (ej. `kbd` en `achievement`). */
type ToastProps = ToastPropsNeutralUndo | ToastPropsAchievement | ToastPropsStatus;
```

Reglas TS:

- `variant` discrimina. `onUndo` es obligatorio sólo en `neutral-undo`. `description` no existe en `neutral-undo` ni en `achievement` por construcción.
- El sistema de toasts (queue, mount, dismiss) lo orquesta un `<ToastProvider>` (no specced acá — queda para S12). Cada `<Toast>` es la presentación.

## Variants / Sizes

| Variant         | Uso                                                                                                                     | Tokens consumidos                                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `neutral-undo`  | Reversa optimista de mutaciones reversibles (delete pago, cancelar pedido, selección masiva). 5s default / 8s pedido.   | `--surface-elevated`, `--border-strong`, `--text-primary`, `--accent`, `--radius-lg`, `--elevation-2`, `--toast-max-w`   |
| `achievement`   | Celebración puntual: pago full, primera tienda, entrega completa. Mascota `celebrating` + emoji + halo `--accent-warm`. | `--surface-elevated`, halo composición ad-hoc (`tokens.md` §6.2), `--ease-bounce`, `--motion-slow`                       |
| `success`       | Confirmación neutra sin reversibilidad ni celebración. Ej. "Guardado".                                                  | `color-mix(--success 14%, ...)` bg, `color-mix(--success 28%, ...)` border, `--success-chip-text`                       |
| `warning`       | Aviso no destructivo. Ej. "Estás cerca del límite".                                                                     | `--warning` derivados análogos (`--warning-chip-text`)                                                                  |
| `error`         | Fallo de servidor o validación cross-form. Ej. "Algo se rompió de este lado. Dale otra vez."                            | `--destructive` derivados análogos (`--destructive-chip-text`)                                                          |
| `info`          | Aviso neutro sin urgencia. Ej. "Volvió la conexión."                                                                    | `--info` derivados análogos (`--info-chip-text`)                                                                        |

Tamaño único: `max-width: var(--toast-max-w)` (352px). En mobile el toast respeta `100vw - var(--space-8)` con `max-width: var(--toast-max-w)` como tope.

## Estados visuales

### `neutral-undo`

Receta base (vinculante — se replica de [`tokens-css.md` §6](../tokens-css.md)).

| Estado     | Receta CSS (light)                                                                                                                                                                                                                                                                                                | Receta CSS (dark) | Notas                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------- |
| `default`  | `background: var(--surface-elevated); border: 1px solid var(--border-strong); color: var(--text-primary); border-radius: var(--radius-lg); box-shadow: var(--elevation-2); padding: var(--space-3) var(--space-4); display: flex; align-items: center; gap: var(--space-3); max-width: var(--toast-max-w);`     | mismo             | Sin ícono decorativo, sin mascota. Copy en `--text-primary` una sola línea.                         |
| CTA        | `color: var(--accent); font-weight: var(--font-weight-medium-body); background: transparent; border: none; cursor: pointer;`                                                                                                                                                                                       | mismo             | Ghost button "Deshacer" (`--accent` indigo cross-paleta).                                           |
| Hover CTA  | overlay `background-color: color-mix(in oklch, var(--accent) var(--state-hover-mix), transparent);`                                                                                                                                                                                                                | overlay mix=8%    | Overlay en `::after` igual que `<Button variant="ghost">`.                                          |
| Focus CTA  | `outline: 2px solid var(--focus-ring); outline-offset: 2px;`                                                                                                                                                                                                                                                       | mismo             | `:focus-visible` clásico.                                                                          |
| Kbd slot   | `<Kbd keys={["Z"]} size="sm" />` alineado a la derecha del CTA. `display: none` en `< --breakpoint-md`.                                                                                                                                                                                                            | mismo             | Mantenido en DOM con `aria-hidden="true"` mobile.                                                  |
| Countdown  | hairline 1px al pie: `height: 1px; background: color-mix(in oklch, var(--accent) 40%, transparent); transform-origin: left; animation: toast-countdown linear forwards; animation-duration: <duration>ms;`                                                                                                         | mismo             | `from { transform: scaleX(1); } to { transform: scaleX(0); }`. Pausa en hover/focus.                |
| Hover/focus container | `.toast:hover .toast__countdown, .toast:focus-within .toast__countdown { animation-play-state: paused; }`                                                                                                                                                                                                | mismo             | Pausa el countdown sin reset — al salir reanuda desde donde quedó.                                  |
| Exit       | `opacity: 1 → 0` + `transform: translateY(0) → translateY(8px)` con `--motion-fast` `--ease-emphasis`.                                                                                                                                                                                                              | mismo             | Mobile: `translateY(0) → translateY(16px)` (sale por abajo).                                        |

### `achievement`

| Estado    | Receta CSS (light)                                                                                                                                                                                                                                                                                                                                              | Receta CSS (dark) | Notas                                                                                                            |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| `default` | `background: var(--surface-elevated); border-radius: var(--radius-lg); padding: var(--space-3) var(--space-4); display: flex; align-items: center; gap: var(--space-3); box-shadow: var(--elevation-3), 0 0 0 1px color-mix(in oklch, var(--accent-warm) 24%, transparent), 0 8px 32px color-mix(in oklch, var(--accent-warm) 14%, transparent);`              | mismo             | Halo coral composición ad-hoc (`tokens.md` §6.2). `--accent-warm` decorativo, no texto.                          |
| Mascota   | sprite 56px (mobile) / 64px (desktop) `celebrating` + emoji al final del copy.                                                                                                                                                                                                                                                                                  | mismo             | Mascota deshabilitada si `prefers-reduced-motion: reduce` (queda en `idle`).                                     |
| Enter     | `transform: scale(0.94) translateY(8px); opacity: 0;` → `scale(1) translateY(0); opacity: 1;` con `--motion-slow` `--ease-bounce`.                                                                                                                                                                                                                              | mismo             | Spring overshoot solo en achievements.                                                                          |
| Exit      | `opacity: 1 → 0` con `--motion-fast` `--ease-emphasis` post-hold de 800ms.                                                                                                                                                                                                                                                                                       | mismo             | Hold total = `duration` prop o default `var(--motion-slow) + 800ms`.                                            |

### `success | warning | error | info`

| Estado    | Receta CSS (light)                                                                                                                                                                                                                                                                                                                                                       | Receta CSS (dark)                                                                                                                                                                          | Notas                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `default` | `background: color-mix(in oklch, var(--<status>) 14%, var(--background)); border: 1px solid color-mix(in oklch, var(--<status>) 28%, var(--background)); color: var(--<status>-chip-text); border-radius: var(--radius-lg); box-shadow: var(--elevation-2); padding: var(--space-3) var(--space-4); display: flex; align-items: flex-start; gap: var(--space-3);`        | mismo (en dark `--<status>-chip-text` resuelve a `--<status>` base — ver `tokens.md` §1.5)                                                                                                  | Status cumple ≥4.5:1 sobre el bg @14% via alias `chip-text` (light) / base (dark).                                |
| Ícono     | Lucide Glyph 18px en `currentColor` (i.e. `--<status>-chip-text`). Mapping: `success → check-circle`, `warning → alert-triangle`, `error → x-circle`, `info → clock`.                                                                                                                                                                                                       | mismo                                                                                                                                                                                      | ADR 0006: el ícono junto con `message` cumple el contrato icon+label.                                            |
| Description | `color: var(--text-secondary); font-size: var(--text-caption); line-height: var(--text-caption--line-height);`                                                                                                                                                                                                                                                          | mismo                                                                                                                                                                                      | Opcional. Una línea extra.                                                                                       |
| Enter     | `opacity: 0 → 1` + `translateY(8px) → 0` con `--motion-base` `--ease-out-expressive`.                                                                                                                                                                                                                                                                                     | mismo                                                                                                                                                                                      | Mobile: entra desde abajo (`translateY(16px) → 0`).                                                              |
| Exit      | `opacity: 1 → 0` + `translateY(0) → 8px` con `--motion-fast` `--ease-emphasis` al cumplir `duration` (default 5000ms).                                                                                                                                                                                                                                                    | mismo                                                                                                                                                                                      |                                                                                                                  |

### Reglas comunes a todas las variants

- `position: fixed; z-index: var(--z-toast);` (`90` — por encima de modal `80`, debajo de command palette `100` y tooltip `110`).
- Posición: `bottom-center` mobile (`bottom: calc(var(--space-4) + safe-area-inset-bottom); left: 50%; transform: translateX(-50%);`); `bottom-right` desktop (`bottom: var(--space-4); right: var(--space-4);`).
- `prefers-reduced-motion: reduce` — todas las transitions caen a `opacity` con `--motion-fast` `--ease-emphasis`. Spring (`--ease-bounce`) se reemplaza por `--ease-emphasis`. Mascota queda en `idle`.

## Mobile vs desktop

| Aspecto              | `< --breakpoint-md` (mobile)                                                                       | `≥ --breakpoint-md` (desktop)                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Posición             | `bottom-center` con `safe-area-inset-bottom` respetada                                             | `bottom-right` con offset `var(--space-4)`                                                       |
| Ancho                | `calc(100vw - var(--space-8))` con tope `--toast-max-w`                                            | `var(--toast-max-w)` fijo                                                                        |
| `<Kbd>` slot         | `display: none` + `aria-hidden="true"` (no hay teclado físico — el atajo `Z` lo escucha la página) | Visible alineado a la derecha del CTA "Deshacer"                                                  |
| Atajo `Z`            | Sigue activo si hay teclado externo conectado (no se desactiva por viewport)                       | Activo siempre que el toast esté visible y el foco no esté en un input editable                  |
| Stack de múltiples   | Stack vertical con gap `var(--space-2)`, máximo 3 visibles, los siguientes se enfilan en queue     | Stack vertical con gap `var(--space-3)`, máximo 4 visibles                                       |
| Mascota achievement  | 56px                                                                                               | 64px                                                                                             |

## Accesibilidad

- Rol ARIA:
  - `neutral-undo`: `role="status"` + `aria-live="polite"` (no interrumpe SR; se anuncia "Borrado. Deshacer.").
  - `achievement`: `role="status"` + `aria-live="polite"` por default; `"assertive"` cuando se requiere atención prioritaria (raro — celebración puntual).
  - `success | warning | info`: `role="status"` + `aria-live="polite"`.
  - `error`: `role="alert"` + `aria-live="assertive"` (errores requieren anuncio inmediato).
- `aria-atomic="true"` para que SR lea el toast completo cuando cambia.
- CTA "Deshacer" es un `<button>` nativo con `aria-label` derivado del copy completo (ej. `aria-label="Deshacer borrar pago"` si el consumer lo provee). Default = `undoLabel`.
- Atajo `Z`:
  - Lo escucha el `<ToastProvider>` (S12). Activo solo cuando hay `neutral-undo` visible.
  - **Edge case `Z` collision:** cuando el foco está dentro de un `<input>`, `<textarea>`, `<select>`, o cualquier elemento con `contentEditable`, el atajo NO debe interceptar — deja que el browser ejecute su undo nativo (`document.execCommand("undo")` / Ctrl+Z). El `<ToastProvider>` chequea `event.target.matches("input, textarea, [contenteditable], select")` y en ese caso no llama `onUndo` ni `preventDefault`.
- Keyboard:
  - `Tab`: enfoca el CTA "Deshacer". Solo el CTA es focusable; el contenedor no.
  - `Enter` / `Space` sobre el CTA: dispara `onUndo`.
  - `Esc`: cierra el toast actual sin ejecutar undo (consumer puede sobrescribir).
- Focus management: cuando el toast aparece NO roba focus (sería disruptivo). El SR lo anuncia via `aria-live`.
- `prefers-reduced-motion`:
  - `--ease-bounce` → `--ease-emphasis`.
  - Slide vertical desactivado — solo opacity fade con `--motion-fast`.
  - Mascota queda en pose estática `idle`.
  - Countdown hairline sigue activa (es información, no decoración) pero la animación CSS sigue declarada — el hairline se desplaza linealmente.

## Motion

| Qué se anima               | Token de duración                                  | Token de easing            | Notas                                                                                          |
| -------------------------- | -------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------- |
| Enter (`neutral-undo`, status) | `--motion-base` (280ms)                            | `--ease-out-expressive`    | Slide-up 8/16px + fade.                                                                        |
| Enter (`achievement`)      | `--motion-slow` (480ms)                            | `--ease-bounce`            | Spring overshoot 1.04. Único con `--ease-bounce`.                                              |
| Exit (todas)               | `--motion-fast` (150ms)                            | `--ease-emphasis`          | Solo opacity + slide reverse.                                                                  |
| Countdown hairline         | `duration` prop (5000ms o 8000ms)                  | `linear`                   | `transform: scaleX(1) → scaleX(0)`. Pausa en hover/focus.                                       |
| `prefers-reduced-motion`   | `--motion-fast`                                    | `--ease-emphasis`          | Slide vertical desactivado. Mascota `idle`. Countdown sigue.                                    |

## Copy default + i18n

| Clave i18n sugerida                                  | Valor ES (voice glossary aplicado)                      |
| ---------------------------------------------------- | ------------------------------------------------------- |
| `components.toast.undoLabel`                         | "Deshacer"                                              |
| `components.toast.commonMessages.deleted`            | "Borrado"                                               |
| `components.toast.commonMessages.saved`              | "Guardado"                                              |
| `components.toast.commonMessages.errorGeneric`       | "Algo se rompió de este lado. Dale otra vez."           |
| `components.toast.commonMessages.cancelled`          | "Cancelado"                                             |
| `components.toast.commonMessages.restored`           | "Restaurado"                                            |
| `components.toast.commonMessages.copied`             | "Copiado al portapapeles"                               |
| `components.toast.commonMessages.connectionBack`     | "Volvió la conexión"                                    |
| `components.toast.achievementSample`                 | "Pieza nueva en tu colección."                          |
| `components.toast.achievementPaymentFull`            | "¡Cubierto! Una pre-orden menos."                       |
| `components.toast.kbdHint`                           | "Atajo: Z"                                              |

EN se deja para S12.

## Edge cases

1. **Atajo `Z` con input focused**: el provider chequea el `target` del keydown. Si es un input editable o `contentEditable`, NO intercepta (deja al browser hacer undo nativo). El toast sigue visible y reactivable por click en "Deshacer".
2. **Múltiples toasts `neutral-undo` apilados**: solo el más reciente captura `Z`. El resto sigue dismissable por timeout o click. Nunca apilar más de 3 (mobile) / 4 (desktop) — el provider hace queue de los excedentes.
3. **Hover prolongado**: el countdown queda pausado indefinidamente. Si el usuario sale del toast pasados 30s, reanuda desde donde quedó. Esto es deliberado — respeta intención del usuario.
4. **Achievement durante navegación**: si el toast achievement aparece y el usuario navega, sigue visible en la nueva pantalla hasta cumplir `duration`. El provider sobrevive a route changes.
5. **`error` sin reversibilidad**: usar variant `error`, no `neutral-undo`. El toast `error` no tiene CTA ni undo — solo informa.
6. **Toast sobre modal abierto**: `--z-toast` (90) > `--z-modal` (80). El toast aparece encima del modal sin oscurecerlo. ARIA `role="status"` se anuncia al SR sin cerrar el modal.
7. **`description` con dos líneas**: no permitido. El componente trunca con ellipsis. Si necesitás más texto, escalar a banner inline en la pantalla, no toast.
8. **Mobile sin teclado físico (mayoría de casos)**: el atajo `Z` queda inerte. El kbd slot está oculto. La única forma de undo es tap en "Deshacer".
9. **Countdown 8s para selección masiva**: NO. La regla ADR 0001 D4 reserva 8s solo para "delete de pedido entero". Selección masiva = 5s.
10. **Achievement con `aria-live="assertive"`**: solo cuando el achievement bloquea el flujo (ej. colección 100% completa). Por default `polite` para no interrumpir lectura SR en curso.
11. **Optimistic update revert**: cuando el server falla post-toast `neutral-undo`, el provider muestra un segundo toast `error` con copy "No se pudo borrar. Volví a poner todo." (clave `components.toast.optimisticRevertGeneric`). Esta clave se documenta acá pero la lógica del revert vive en el provider (S12).

## Anti-patrones

1. **`neutral-undo` con duración custom fuera de 5000/8000**: rompe el contrato ADR 0001 D4. La discriminated union lo previene en TS.
2. **Achievement con error o destructive**: la mascota celebrating durante delete viola principles §6 ("nunca celebra pérdidas"). Si el flow es destructivo, usar `neutral-undo`.
3. **Toast con CTA `destructive`**: el toast no es lugar para confirmar acciones destructivas (eso es modal). El CTA siempre es reversa, no avance.
4. **Mascota en variants no-achievement**: prohibido. Solo `achievement` lleva mascota celebrating.
5. **`text-white` o `color: white` hardcoded en achievement**: el copy va en `--text-primary` (no sobre `--accent` sólido — el bg achievement es `--surface-elevated`).
6. **Atajo `Z` interceptado con input focused**: rompe el undo nativo del browser. Edge case explícito en accesibilidad.
7. **Stack > 4 toasts visibles**: ruido visual. El provider hace queue.
8. **Toast achievement con `--ease-emphasis`**: pierde el spring celebratorio. Solo `--ease-bounce` cumple la promesa de `tokens.md` §7.2.
9. **Countdown sin pausa en hover**: viola ADR 0001 D4 (pausa explícita). El usuario debe poder leer sin que el toast se le esfume.
10. **`role="alert"` en `success`**: rompe la jerarquía SR. `success` es informativo, no urgente — debe ser `polite`.

## Ejemplos de uso

```tsx
// Delete pago — neutral-undo 5s
toast({
  variant: "neutral-undo",
  message: "Borraste el pago.",
  onUndo: () => restorePayment(paymentId),
  duration: 5000,
  kbd: "Z",
});

// Delete pedido entero — neutral-undo 8s (ADR 0001 D4)
toast({
  variant: "neutral-undo",
  message: "Borraste el pedido.",
  onUndo: () => restoreOrder(orderId),
  duration: 8000,
  kbd: "Z",
});

// Pago full — achievement
toast({
  variant: "achievement",
  message: "¡Cubierto! Una pre-orden menos.",
  emoji: "✨",
  mascot: "celebrating",
});

// Error de servidor
toast({
  variant: "error",
  message: "Algo se rompió de este lado. Dale otra vez.",
  description: "Si sigue, escribinos.",
});
```

## Tokens consumidos

- `--surface-elevated`, `--background`
- `--border-strong`
- `--text-primary`, `--text-secondary`, `--text-muted`
- `--accent`, `--accent-warm`
- `--success`, `--warning`, `--destructive`, `--info` y aliases `--*-chip-text`
- `--focus-ring`
- `--state-hover-mix`
- `--radius-lg`
- `--elevation-2`, `--elevation-3`
- `--toast-max-w`
- `--space-2`, `--space-3`, `--space-4`, `--space-8`
- `--font-weight-medium-body`
- `--text-caption`, `--text-eyebrow`
- `--motion-fast`, `--motion-base`, `--motion-slow`
- `--ease-emphasis`, `--ease-out-expressive`, `--ease-bounce`
- `--z-toast`
- `--breakpoint-md`

## ADRs aplicables

- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md): D4 (toast neutral-undo, 5s/8s, CTA ghost `--accent`, atajo `Z`, hairline countdown, posición bottom-center mobile / bottom-right desktop, `aria-live="polite"`), D6 (la reversibilidad del lifecycle se materializa en el undo de este toast).
- [ADR 0006 — Color blindness icon-label contract](../decisions/0006-color-blindness-icon-label-contract.md): los íconos Lucide de las variants status acompañan al copy (`message`) — el contrato icon+label se cumple por construcción.

## Dependencias

- [`Kbd.md`](./Kbd.md) — el slot `kbd` renderiza un `<Kbd keys={["Z"]} size="sm" />` desktop.
- [`Button.md`](./Button.md) — el CTA "Deshacer" del `neutral-undo` reusa la receta `<Button variant="ghost" size="sm">` con tokens accent.
- Lucide icons (`check-circle`, `alert-triangle`, `x-circle`, `clock`) consumidos por las variants status.
- Mascota `celebrating` (asset MVP — render diferido a S6 según `tokens.md` §11.4).

## Notas para S12 (implementación)

1. **`<ToastProvider>` no specced acá**. La cola, mount/unmount, y handler global del atajo `Z` viven en un provider en `src/components/modules/`. El brief solo define la presentación. Decidir librería base: Sonner (recomendado por research-toasts-lifecycle) o implementación propia.
2. **Atajo `Z` global con detección de input focused**. Implementar en el provider con `useEffect` listener `keydown` en `document`. Chequear `event.target.matches("input, textarea, [contenteditable], select")` antes de hacer `preventDefault` y llamar `onUndo`. Si hay múltiples `neutral-undo` activos, solo el más reciente recibe el atajo.
3. **Countdown CSS `animation-play-state` en hover/focus**. Ya implementado vía CSS puro — no requiere JS. Validar en Safari (soporta `animation-play-state` desde iOS 13.4).
4. **`prefers-reduced-motion`**. Desactiva `--ease-bounce` en achievement y desactiva slide vertical en enter/exit. La mascota debe recibir el flag para quedar en pose `idle` (responsabilidad del componente sprite).
5. **Mascota render**. Pixel art vs hi-res render diferido a S6 (`tokens.md` §11.4). Asset placeholder en MVP — el componente acepta cualquier render que respete el size 56/64.
6. **Posición safe-area-inset-bottom mobile**. Cuando el dispositivo tiene home indicator (iPhone X+), el toast respeta `env(safe-area-inset-bottom)` para no quedar oculto.
7. **Stacking de múltiples toasts**. Implementar `transform: translateY` por toast según índice, con stagger fade-in. Cap visual en 3-4 simultáneos; el resto queue.
8. **Achievement durante navegación**. El provider vive en root layout — sobrevive a `useRouter().push`. Validar que view-transitions del shell no rompen el toast (probable que el provider deba estar fuera del view-transition root).
9. **`role="alert"` vs `role="status"`**. Validar con NVDA / VoiceOver que `error` con `assertive` no genera duplicación cuando además se renderiza un campo con `aria-invalid` en la misma página.
10. **i18n `components.toast.optimisticRevertGeneric`**. Definir copy + variants para casos específicos (delete failed, update failed) en S5+ cuando se materialice el catálogo de mutaciones.
