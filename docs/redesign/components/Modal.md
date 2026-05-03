---
title: Modal
tier: 3
status: spec — no implementado
last_updated: 2026-05-03
session: 04-components
adrs:
  - ADR 0001 D4 (toast neutral-undo cohabita por encima — `--z-toast` 90 > `--z-modal` 80)
  - ADR 0001 D6 (delete pedido entero requiere confirm modal previo)
  - ADR 0006 (icon+label contract — los CTAs siempre llevan label, ningún CTA color-only)
  - ADR 0008 (Modal Enhancement — Semantic Depth: icon-circle tonal, backdrop blur, spring animation, radius 20px)
---

# Modal

## Propósito

Surface primitive para diálogos centrados desktop con fallback automático a `<Sheet>` mobile. Cubre el modal de discrepancia de [`order-create.md`](../screens/order-create.md) (sub-flujo 12.a — Σ items ≠ totalCost), confirm de "Eliminar pedido" en [`order-detail.md`](../screens/order-detail.md) (ADR 0001 D6), confirm "Descartar cambios" en formularios dirty, y cualquier flujo que requiera atención focalizada con backdrop. En `< --breakpoint-md` degrada automáticamente a `<Sheet>` (composición — el componente decide internamente).

## API TypeScript

```ts
import type { ReactNode } from "react";

type ModalSize = "md" | "lg";

type ModalAction = {
  /** Etiqueta del botón. Aplicar voice glossary §7. */
  label: string;
  /** Handler. */
  onClick: () => void;
  /**
   * Sólo aplica al `primaryAction`. Default `"primary"`.
   * `"destructive"` para confirms de delete (ej. "Eliminar pedido").
   */
  variant?: "primary" | "destructive";
  /** Estado loading — el botón muestra spinner y bloquea el modal. */
  loading?: boolean;
};

type ModalTone = "default" | "destructive" | "warning" | "info";

type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Título visible — obligatorio. Aria-labelledby lo apunta. */
  title: string;
  /**
   * Texto corto debajo del título en `--text-secondary` (ADR 0008).
   * Se muestra en el header, en la misma zona del icon-circle.
   * Antes llamado `description` — alias deprecado, eliminar en S12.
   */
  subtitle?: string;
  /**
   * Ícono de Lucide a mostrar en el header dentro del icon-circle 48px (ADR 0008).
   * Requerido cuando se usa `tone`. Sin `icon`, el header muestra solo título + close.
   */
  icon?: React.ComponentType<{ className?: string }>;
  /**
   * Tono semántico del icon-circle (ADR 0008). Determina fondo + color del ícono.
   * - `"destructive"` → rojo (confirm de delete, acciones irreversibles)
   * - `"warning"`     → ámbar (reportes, alertas, discrepancias)
   * - `"info"`        → azul (informativos, estados, ayuda)
   * - `"default"`     → accent (forms, listas, acciones neutras)
   * Default: `"default"`.
   */
  tone?: ModalTone;
  /** Cuerpo del modal. */
  children: ReactNode;
  /**
   * Tamaño:
   *   `md` → 460px (ADR 0008 — antes 512px)
   *   `lg` → `--modal-max-w-lg` (768px)
   * Default `md`.
   */
  size?: ModalSize;
  /** CTA primario — botón visualmente principal. */
  primaryAction?: ModalAction;
  /** CTA secundario — botón secondary alineado a la izquierda del primary. */
  secondaryAction?: { label: string; onClick: () => void };
  /** CTA terciario — botón ghost a la izquierda extrema (ej. "Volver"). */
  tertiaryAction?: { label: string; onClick: () => void };
  /** Si `false`, deshabilita Esc + click backdrop + close button. Default `true`. */
  dismissible?: boolean;
};
```

Reglas TS:

- `title` es obligatorio (no opcional). Sin título no hay modal accesible.
- `primaryAction.variant: "destructive"` es el switch para confirms de delete (ej. modal de "Eliminar pedido"). Cuando se usa, el `<Button>` interno usa variant `destructive` (rojo sólido cross-paleta).
- En el caso del modal de discrepancia, ningún CTA es destructive — los tres son no-destructivos: "Usar ingresado" (primary), "Usar calculado" (secondary), "Volver" (tertiary ghost). Ver Edge cases #1.

## Variants / Sizes

| Variant (`size`) | Uso                                                                             | Tokens consumidos                                                                   |
| ---------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `md` (default)   | Confirm de delete/cancel/reactivate, modal de discrepancia, "Descartar cambios" | `--surface-elevated`, `--radius-2xl` (20px), `--modal-max-w` (460px) — ver ADR 0008 |
| `lg`             | Forms multi-step embebidos, configuraciones extensas con preview lado a lado    | mismos + `--modal-max-w-lg` (768px)                                                 |

En `< --breakpoint-md`, ambos sizes degradan a `<Sheet size="md">` (o `lg` si el contenido lo justifica — el componente lo decide por size prop).

## Estados visuales

> **ADR 0008 (2026-05-03):** estructura visual actualizada. Overlay unificado con `backdrop-filter: blur(8px)`. Header con icon-circle 48px tonal. Footer con `border-top`. `border-radius: 20px`. Spring animation. Ver `decisions/0008-modal-enhancement.md`.

### Desktop (`≥ --breakpoint-md`)

| Estado      | Receta CSS (light)                                                                                                                                                                                                                                                                                                         | Receta CSS (dark)                                                                                                                                              | Notas                                                                                                                                                                                               |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overlay     | `position: fixed; inset: 0; z-index: var(--z-modal); display: flex; align-items: center; justify-content: center; padding: 16px; background: oklch(12% 0.010 50 / 0.35); backdrop-filter: blur(8px);`                                                                                                                      | `background: oklch(4% 0.015 265 / 0.62); backdrop-filter: blur(8px);` (resto igual)                                                                            | Overlay único = backdrop + contenedor. `--z-modal` = 80. Click en overlay dismiss si `dismissible`. `backdrop-filter` requiere `-webkit-backdrop-filter` alias en Safari.                           |
| Card        | `background: var(--surface-elevated); border: 1px solid var(--border-strong); border-radius: 20px; overflow: hidden; width: 100%; max-width: <size>; max-height: calc(100vh - 80px); display: flex; flex-direction: column;` + `box-shadow: 0 14px 28px oklch(20% 0.020 50 / 0.10), 0 2px 6px oklch(20% 0.020 50 / 0.06);` | `box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 1px var(--border-strong), 0 0 24px color-mix(in oklch, var(--accent) 5%, transparent);` (resto igual) | `border-radius: 20px` = `--radius-2xl`. Card es hijo directo del overlay flex — se centra por el flex del overlay, no por `transform: translate(-50%,-50%)`.                                        |
| Header      | `display: flex; align-items: flex-start; gap: 16px; padding: 24px 24px 0;`                                                                                                                                                                                                                                                 | mismo                                                                                                                                                          | Fila: [icon-circle 48px] + [header-text: [row: `<h2>` + close] + [`<p subtitle>`]]. Sin `border-bottom` — la separación visual la da el padding generoso.                                           |
| Icon circle | `width: 48px; height: 48px; border-radius: 24px; display: flex; align-items: center; justify-content: center;` + tone background (ver tabla tones)                                                                                                                                                                         | mismo (los tones ya incluyen `var(--surface-elevated)` en el mix, funciona en dark)                                                                            | Ícono interior: 20px, `stroke-width: 1.75`. Presente solo cuando `icon` prop está definida. Sin `icon` → header vuelve a layout simple [title + close].                                             |
| Tones       | `tone-destructive`: `background: color-mix(in oklch, var(--destructive) 14%, var(--surface-elevated)); color: var(--destructive);` / `tone-warning`: `…var(--warning)…` / `tone-info`: `…var(--info)…` / `tone-default`: `…var(--accent)…`                                                                                 | mismo                                                                                                                                                          | El 14% de mezcla da un fondo tonal suave. ADR 0006 cumplido: el ícono lleva siempre `title` como label de a11y + el texto del header actúa como label visible.                                      |
| Body        | `flex: 1; overflow-y: auto; padding: 16px 24px 4px;`                                                                                                                                                                                                                                                                       | mismo                                                                                                                                                          | Scroll independiente cuando el contenido excede `max-height`.                                                                                                                                       |
| Footer      | `display: flex; justify-content: flex-end; gap: 8px; padding: 12px 24px 20px; border-top: 1px solid var(--border);`                                                                                                                                                                                                        | mismo                                                                                                                                                          | Sin `background: var(--surface)` diferencial — el footer usa el mismo `--surface-elevated` de la card. El divider `border-top` es la separación visual. Tertiary a la izquierda (ver Edge case #1). |
| Enter card  | `opacity: 0; transform: scale(0.96);` → `opacity: 1; transform: scale(1);` con `animation: modal-spring 280ms linear(0, 0.5, 0.85, 0.97, 1) both`                                                                                                                                                                          | mismo                                                                                                                                                          | Spring sintético — equivale a `--ease-out-expressive` con peso de aterrizaje. Overlay: `opacity: 0 → 1` con `200ms cubic-bezier(0.2, 0, 0, 1)`.                                                     |
| Exit card   | `opacity: 1; transform: scale(1);` → `opacity: 0; transform: scale(0.96);` con `--motion-fast` `--ease-emphasis`                                                                                                                                                                                                           | mismo                                                                                                                                                          | Más rápido al salir. Overlay: `opacity: 1 → 0`.                                                                                                                                                     |
| Scroll-lock | `body { overflow: hidden; padding-right: <scrollbar-width>; }` mientras open                                                                                                                                                                                                                                               | mismo                                                                                                                                                          | Evita layout shift por desaparición de scrollbar.                                                                                                                                                   |

### Mobile (`< --breakpoint-md`) — fallback a `<Sheet>`

El componente compose `<Sheet size="md">` (o `lg` si el modal está en `lg`). Drag handle visible, slide-up desde abajo, mismo overlay con `backdrop-filter: blur(8px)` (Sheet también usa blur — ADR 0008 extendido a mobile), mismos handlers. El layout de header/body/footer del modal se reusa dentro del sheet. Footer queda sticky al fondo del sheet.

## Mobile vs desktop

| Aspecto         | `< --breakpoint-md` (mobile)                       | `≥ --breakpoint-md` (desktop)                                |
| --------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| Forma           | Bottom sheet (composición con `<Sheet>`)           | Modal centered absoluto                                      |
| Animación       | Slide-up vertical (`<Sheet>`)                      | Scale 0.96 → 1 + fade                                        |
| Drag-to-dismiss | Sí (heredado de `<Sheet>`)                         | No — solo Esc, backdrop click, close button                  |
| Padding interno | `--space-5` body, `--space-4` `--space-5` footer   | `--space-5` `--space-6` body, `--space-4` `--space-6` footer |
| Tope de ancho   | `100vw`                                            | `var(--modal-max-w)` (md) o `var(--modal-max-w-lg)` (lg)     |
| Footer layout   | Stack vertical `fullWidth` botones, primary arriba | Side-by-side, primary a la derecha extrema                   |

## Accesibilidad

- Rol ARIA: `role="dialog"` + `aria-modal="true"` en el container. `aria-labelledby` apunta al `<h2>` del header. `aria-describedby` apunta al `description` cuando existe.
- Focus trap: al abrir, mover focus al primer elemento focusable del body. Si no hay elementos focusables, focus al close `<IconButton>` (si existe) o al primary CTA. Tab cycla dentro del modal.
- Return focus: al cerrar, regresa al elemento que disparó el modal.
- Keyboard:
  - `Tab` / `Shift+Tab`: focus trap.
  - `Esc`: cierra si `dismissible`. No cierra si `dismissible: false`.
  - `Enter` en input dentro del body: el consumer decide si dispara primary action (form-like) o noop. El componente NO captura Enter global.
  - CTAs: `Enter` / `Space` nativos.
- Screen reader: anuncia `title` + `description` al abrir. Close `<IconButton>` lleva `aria-label` desde `components.modal.close` ("Cerrar").
- `prefers-reduced-motion`:
  - Enter scale desactivado, solo opacity fade con `--motion-fast`.
  - Mobile (sheet): slide vertical desactivado, solo opacity.
  - Backdrop fade reducido a `--motion-fast`.

## Motion

| Qué se anima             | Token de duración                            | Token de easing         | Notas                                                                                       |
| ------------------------ | -------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------- |
| Enter container          | `--motion-base` (280ms)                      | `--ease-out-expressive` | Scale 0.96 → 1 + opacity 0 → 1 (desktop). Slide vertical en mobile (heredado de `<Sheet>`). |
| Exit container           | `--motion-fast` (150ms)                      | `--ease-emphasis`       | Scale 1 → 0.96 + opacity 1 → 0.                                                             |
| Backdrop fade            | `--motion-base` enter / `--motion-fast` exit | `--ease-emphasis`       | `opacity 0 ↔ 1`.                                                                            |
| `prefers-reduced-motion` | `--motion-fast`                              | `--ease-emphasis`       | Sin scale, sin slide. Solo opacity.                                                         |

## Copy default + i18n

| Clave i18n sugerida                            | Valor ES (voice glossary aplicado)               |
| ---------------------------------------------- | ------------------------------------------------ |
| `components.modal.close`                       | "Cerrar"                                         |
| `components.modal.discrepancy.title`           | "Tu suma no cuadra con el total. ¿Cuál dejamos?" |
| `components.modal.discrepancy.summedFromItems` | "Tu suma"                                        |
| `components.modal.discrepancy.enteredTotal`    | "Lo que ingresaste"                              |
| `components.modal.discrepancy.useEntered`      | "Usar ingresado"                                 |
| `components.modal.discrepancy.useSummed`       | "Usar calculado"                                 |
| `components.modal.discrepancy.back`            | "Volver"                                         |
| `components.modal.confirmDelete.title`         | "¿Borrar este pedido?"                           |
| `components.modal.confirmDelete.description`   | "No se puede deshacer."                          |
| `components.modal.confirmDelete.cta`           | "Eliminar"                                       |
| `components.modal.confirmDelete.cancel`        | "Cancelar"                                       |
| `components.modal.discardChanges.title`        | "¿Descartar cambios?"                            |
| `components.modal.discardChanges.description`  | "Lo que escribiste se va."                       |
| `components.modal.discardChanges.cta`          | "Descartar"                                      |
| `components.modal.discardChanges.cancel`       | "Volver"                                         |

EN se deja para S12.

## Edge cases

1. **Modal de discrepancia (sub-flujo 12.a de order-create)**: tres CTAs sin destructive. Layout interno en el body con dos columnas Display tabular-nums lado a lado:
   - Columna A: "Tu suma" eyebrow + cifra calculada (`Σ items.qty × items.unitPrice`).
   - Columna B: "Lo que ingresaste" eyebrow + `totalCost` ingresado por el usuario.
   - Footer: `tertiaryAction` "Volver" (ghost) izquierda, `secondaryAction` "Usar calculado" centro, `primaryAction` "Usar ingresado" (sin variant destructive) derecha.
   - Copy del title: "Tu suma no cuadra con el total. ¿Cuál dejamos?"
2. **Confirm delete pedido entero (ADR 0001 D6)**: `primaryAction.variant: "destructive"` + `secondaryAction` "Cancelar". Post-confirm, dispara toast `neutral-undo` 8s con kbd `Z`. El modal cierra y el toast aparece encima del shell.
3. **Modal sobre toast existente**: válido — toast queda visible (`--z-toast` 90 > `--z-modal` 80). El backdrop del modal NO oscurece el toast (el toast tiene z-index superior).
4. **Modal con form interno**: `Enter` dentro de un input dispara `onSubmit` del form si existe. El consumer wrap el body con `<form onSubmit={handleSubmit}>`. El componente NO captura Enter global.
5. **`primaryAction.loading: true`**: el primary CTA muestra spinner `loader-2`, queda `pointer-events: none`. El resto del modal queda interactivamente bloqueado (overlay invisible o cursor `wait`). Esc sigue funcional para cancelar (consumer decide si abortar la mutation).
6. **Sin acciones (modal informativo)**: válido. Footer no se renderiza. El usuario cierra con close `<IconButton>`, Esc, o backdrop click.
7. **Description larga (>2 líneas)**: legible pero recomendado mover a body. La description del header está pensada para subtítulo corto.
8. **Mobile fallback con `dismissible: false`**: el `<Sheet>` interno pierde drag-to-dismiss y el handle se atenúa visualmente. CTAs siguen funcionales.
9. **Body overflow vertical**: scroll independiente. El header y footer quedan visibles. Validar que el footer no quede tapado por safe-area-inset-bottom en iPhone X+.
10. **Reapertura inmediata**: si el consumer cierra y reabre el mismo modal en <100ms, la animación de exit se aborta y el enter arranca desde el estado actual (no resetea a scale 0.96). Validar que no haya flash visual.
11. **Modal con tertiary action solo (sin secondary)**: layout válido. Tertiary izquierda, primary derecha, espacio entre con `space-between`.
12. **Modal sobre Drawer abierto**: válido — `--z-modal` (80) > `--z-drawer` (50). El modal tapa el drawer hasta cerrarse.

## Anti-patrones

1. **Modal sin `title`**: rompe a11y (no hay `aria-labelledby`). Obligatorio por TS.
2. **Modal con CTA destructive sin confirm previo**: el modal mismo es el confirm — no debería abrir otro modal anidado. Si necesitás doble confirm, replantear UX.
3. **Modal `lg` con poco contenido**: rompe la jerarquía visual. Usar `md` por default; `lg` solo si el contenido lo justifica (preview lado a lado, lista larga).
4. **Overlay con alpha arbitraria**: no usar valores de opacidad random para el backdrop. Usar los oklch literales calibrados de ADR 0008: `oklch(12% 0.010 50 / 0.35)` light, `oklch(4% 0.015 265 / 0.62)` dark. `--surface-overlay` fue eliminado en M01 (ver implicancias ADR 0008).
5. **Esc deshabilitado sin razón crítica**: viola WCAG 2.1.2. Solo `dismissible: false` durante mutaciones en flight con confirm explícito.
6. **Focus trap sin return focus**: rompe la continuidad keyboard.
7. **Modales anidados (modal sobre modal)**: prohibido. Si el flujo lo necesita, usar wizard interno o replantear.
8. **Padding hardcoded en lugar de tokens**: rompe la regla "sin literales raw".
9. **Slide vertical en desktop**: solo mobile (heredado de `<Sheet>`). Desktop usa scale + fade.
10. **Modal `dismissible: false` sin loading state visible**: el usuario queda atrapado sin pista. Si bloqueás cierre, mostrar spinner o mensaje "Procesando…" (con copy del glosario, no "Procesando" — buscar "Buscando…" o "Guardando…").

## Ejemplos de uso

```tsx
// Modal de discrepancia (sub-flujo 12.a — order-create)
<Modal
  open={isDiscrepancyOpen}
  onOpenChange={setDiscrepancyOpen}
  title="Tu suma no cuadra con el total. ¿Cuál dejamos?"
  primaryAction={{
    label: "Usar ingresado",
    onClick: () => applyEnteredTotal(),
  }}
  secondaryAction={{
    label: "Usar calculado",
    onClick: () => applySummedTotal(),
  }}
  tertiaryAction={{
    label: "Volver",
    onClick: () => setDiscrepancyOpen(false),
  }}
>
  <div className="grid grid-cols-2 gap-4">
    <div>
      <Eyebrow>Tu suma</Eyebrow>
      <Display tabular>{formatCurrency(summedFromItems)}</Display>
    </div>
    <div>
      <Eyebrow>Lo que ingresaste</Eyebrow>
      <Display tabular>{formatCurrency(enteredTotal)}</Display>
    </div>
  </div>
</Modal>

// Confirm delete pedido (ADR 0001 D6)
<Modal
  open={isDeleteOpen}
  onOpenChange={setDeleteOpen}
  title="¿Borrar este pedido?"
  description="No se puede deshacer."
  primaryAction={{
    label: "Eliminar",
    variant: "destructive",
    onClick: handleDelete,
    loading: isDeleting,
  }}
  secondaryAction={{
    label: "Cancelar",
    onClick: () => setDeleteOpen(false),
  }}
/>
```

## Tokens consumidos

- `--surface-elevated`, `--border-strong`, `--border`
- `--text-primary`, `--text-secondary`, `--text-muted`
- `--radius-2xl` (20px — confirmar en tokens.md al inicio de S12)
- `--modal-max-w` (460px para `md`), `--modal-max-w-lg` (768px para `lg`)
- `--accent`, `--destructive`, `--warning`, `--info` (tones del icon-circle)
- `--motion-fast`, `--motion-base`
- `--ease-emphasis`, `--ease-out-expressive`
- `--z-modal` (80)
- `--breakpoint-md`
- Valores hardcoded aprobados (ADR 0008): backdrop oklch literales, spring easing `linear(0, 0.5, 0.85, 0.97, 1)`, icon-circle `color-mix` 14%

Tokens **eliminados** vs S4: `--surface-overlay`, `--radius-xl`, `--elevation-3`, `--z-modal-backdrop`, `--space-*` (reemplazados por literales calibrados del demo — se formalizarán en S12).

## ADRs aplicables

- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md): D4 (toast cohabita por encima — `--z-toast: 90 > --z-modal: 80`; el confirm delete dispara toast neutral-undo 8s post-cierre del modal), D6 (irreversibles requieren confirm modal previo).
- [ADR 0006 — Color blindness icon-label contract](../decisions/0006-color-blindness-icon-label-contract.md): los CTAs siempre llevan label de texto — ningún CTA es color-only. El icon-circle del header cumple: el ícono es decorativo (aria-hidden), la semántica la da el `title` del modal.
- [ADR 0008 — Modal Enhancement · Semantic Depth](../decisions/0008-modal-enhancement.md): overlay unificado con blur, icon-circle 48px tonal, border-radius 20px, footer border-top, spring animation. Referencia visual: secciones `m01-vb-*` del demo HTML.

## Dependencias

- [`Sheet.md`](./Sheet.md) — fallback automático en `< --breakpoint-md`.
- [`Button.md`](./Button.md) — `primaryAction`, `secondaryAction`, `tertiaryAction` se renderizan como `<Button>` con variants `primary` / `secondary` / `ghost` (o `destructive` cuando `primaryAction.variant: "destructive"`).
- Lucide icon `x` para el close `<IconButton>`.

## Notas para S12 (implementación)

1. **Composición con `<Sheet>` mobile**. Implementar como branching interno: el componente lee `useMediaQuery("(min-width: 48rem)")` y renderiza `<Sheet>` con header/body/footer mapeados desde props si mobile, o el modal nativo si desktop. Validar que SSR no flickeé (default desktop o usar CSS-only fallback con `@media`).
2. **CSS-only fallback (alternativa)**. En lugar de JS branching, declarar dos containers (modal + sheet) y mostrarlos con `@media (min-width: var(--breakpoint-md)) { .modal-desktop { display: flex; } .modal-mobile { display: none; } }`. Más complejo de mantener pero evita SSR flicker.
3. **Focus trap**. Mismo approach que `<Sheet>` — `focus-trap-react` o hook propio.
4. **Scroll-lock con scrollbar-width compensation**. Calcular `window.innerWidth - document.documentElement.clientWidth` y aplicar como `padding-right` al body. Restaurar al cerrar.
5. **Return focus**. Conservar ref del trigger via context o prop. Restaurar focus en `useEffect` cleanup.
6. **`primaryAction.loading`**. El `<Button>` interno consume `loading` prop. El modal mismo agrega `aria-busy="true"` al container y opcionalmente bloquea Esc + backdrop click hasta que loading vuelve a `false`.
7. **Form integration**. El consumer wrap children con `<form onSubmit={...}>`. El primary CTA puede ser `type="submit"` (consumer decide). Cuando el primary es submit, el consumer pasa `primaryAction.onClick` que dispara `form.requestSubmit()`.
8. **Backdrop click outside detección**. Capturar el event en el backdrop. El container del modal stop-propagation del click para no cerrar al click interior.
9. **Animación CSS vs Framer Motion**. CSS animations son suficientes y evitan deps. Framer Motion solo si se necesita coordinar animaciones complejas (ej. lista interna que también anima).
10. **`prefers-reduced-motion`**. CSS-only via `@media (prefers-reduced-motion: reduce)`. Sin lógica JS.
11. **Reapertura rápida (<100ms)**. Asegurar que la lógica de mount/unmount permite re-mount inmediato. Si usás Framer Motion, configurar `mode="wait"` o `popLayout` según preferencia visual.
12. **Modal sobre Drawer / Sheet abierto**. Validar con e2e que el stack de focus traps no rompe (cada surface debe trapear su propio scope; al cerrar el modal, focus vuelve al drawer/sheet, no al trigger original del drawer).
