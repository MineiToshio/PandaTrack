---
title: Sheet
tier: 3
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0003 D8 (FilterDrawer mobile = bottom sheet con drag handle)
  - ADR 0001 D4 (toast neutral-undo cohabita con sheet — `--z-toast` 90 > `--z-sheet` 60)
---

# Sheet

## Propósito

Surface primitive para bottom sheet mobile. Es la base que consume `<FilterDrawer>` mobile (ADR 0003 D8), el modal de discrepancia mobile de [`order-create.md`](../screens/order-create.md) (sub-flujo 12.a), confirm sheets de cancel/delete/reactivate de [`order-detail.md`](../screens/order-detail.md), el sheet de Resumen+Atajos de order-create, y el sheet inline "Crear nueva tienda" desde el combobox de tienda. También es el fallback automático que `<Modal>` ejecuta en `< --breakpoint-md` (ver `Modal.md`).

## API TypeScript

```ts
import type { ReactNode } from "react";

type SheetSize = "sm" | "md" | "lg" | "full";

type SheetProps = {
  /** Estado controlado del sheet. */
  open: boolean;
  /** Callback cuando el usuario cierra (drag down, click backdrop, Esc, IconButton x). */
  onOpenChange: (open: boolean) => void;
  /** Título visible en el header. Si está, el sheet renderiza header con `<h2>` y close `<IconButton>` x. */
  title?: string;
  /** Contenido. */
  children: ReactNode;
  /**
   * Tamaño por max-height:
   *   `sm` → `min(40svh, var(--sheet-max-h))`
   *   `md` → `min(60svh, var(--sheet-max-h))`
   *   `lg` → `min(80svh, var(--sheet-max-h))`
   *   `full` → `var(--sheet-max-h)` (92svh)
   * Default `md`.
   */
  size?: SheetSize;
  /** Drag handle 4×40 visible arriba. Default `true`. */
  showHandle?: boolean;
  /** Si `false`, deshabilita Esc + click backdrop + drag-to-dismiss. Default `true`. */
  dismissible?: boolean;
};
```

Reglas TS:

- `open` controlado obligatoriamente. No hay modo uncontrolled.
- `dismissible: false` se reserva para flujos críticos (ej. confirm de delete sin escape silencioso). Cuando `false`, el header no renderiza el close `<IconButton>`.

## Variants / Sizes

| Variant (`size`) | Uso                                                                                                            | Tokens consumidos                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `sm`             | Confirm cancel/delete/reactivate breve, sheet de copy + 2 CTAs                                                  | `--surface-elevated`, `--radius-2xl`, `--elevation-3`, `min(40svh, var(--sheet-max-h))`                        |
| `md` (default)   | FilterDrawer mobile, modal de discrepancia mobile, confirm con detail extra                                     | mismos + `min(60svh, var(--sheet-max-h))`                                                                      |
| `lg`             | "Crear nueva tienda" inline, sheet de Resumen+Atajos extenso                                                    | mismos + `min(80svh, var(--sheet-max-h))`                                                                      |
| `full`           | Combobox full-screen mobile (lista larga con search), formularios extensos                                      | mismos + `var(--sheet-max-h)` (92svh)                                                                          |

## Estados visuales

| Estado     | Receta CSS (light)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Receta CSS (dark) | Notas                                                                                                                                                                                                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backdrop   | `position: fixed; inset: 0; background: var(--surface-overlay); z-index: calc(var(--z-sheet) - 1);`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | mismo             | Scrim modal. Click en backdrop dismiss si `dismissible`. Fade-in con `--motion-base` `--ease-emphasis`.                                                                                                                                                                                              |
| Container  | `position: fixed; left: 0; right: 0; bottom: 0; background: var(--surface-elevated); border-radius: var(--radius-2xl) var(--radius-2xl) 0 0; box-shadow: var(--elevation-3); z-index: var(--z-sheet); max-height: <size>; display: flex; flex-direction: column;`                                                                                                                                                                                                                                                                                                                                                                                | mismo             | Sólo top-radius. `bottom: 0` con `padding-bottom: env(safe-area-inset-bottom)` para iPhone X+.                                                                                                                                                                                                       |
| Drag handle | `width: 2.5rem (40px); height: 0.25rem (4px); background: var(--text-muted); border-radius: var(--radius-pill); margin: var(--space-3) auto var(--space-2);`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | mismo             | Centrado horizontal. Sólo si `showHandle: true`.                                                                                                                                                                                                                                                     |
| Header     | `display: flex; align-items: center; justify-content: space-between; padding: var(--space-2) var(--space-5) var(--space-3); border-bottom: 1px solid var(--border);`                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | mismo             | Solo si `title` está. `<h2>` consume `--text-subtitle` + `--text-primary`. El close `<IconButton>` lleva ícono Lucide `x` con `aria-label="Cerrar"`.                                                                                                                                                |
| Body       | `flex: 1; overflow-y: auto; padding: var(--space-5);` (mobile) / `padding: var(--space-6);` (desktop)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | mismo             | Scroll independiente. El header queda sticky por estructura (no `position: sticky` salvo que la lista del body sea muy larga).                                                                                                                                                                       |
| Enter      | container: `transform: translateY(100%);` → `translateY(0);` con `--motion-base` `--ease-out-expressive`. Backdrop: `opacity: 0 → 1` con `--motion-base` `--ease-emphasis`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | mismo             | Slide vertical desde abajo.                                                                                                                                                                                                                                                                          |
| Exit       | container: `translateY(0) → translateY(100%)` con `--motion-fast` `--ease-emphasis`. Backdrop: `opacity: 1 → 0`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | mismo             | Más rápido al salir (perceptual: cierre = barato).                                                                                                                                                                                                                                                   |
| Drag drag  | mientras el usuario arrastra: `transform: translateY(<dragOffset>px);` sin transition. Si soltó por debajo del 50% del alto del sheet, completa el `translateY(100%)` exit. Si no, vuelve a `translateY(0)` con `--motion-fast` `--ease-emphasis`.                                                                                                                                                                                                                                                                                                                                                                                                | mismo             | Stops 50% / 100%. Drag-to-dismiss requiere `dismissible: true` y se enrutar al touch/pointer del drag handle o del header. El body no captura drag (para no bloquear scroll vertical).                                                                                                              |
| Disabled scroll | mientras el sheet está open: `body { overflow: hidden; }` para evitar scroll de fondo. Restaurar al cerrar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | mismo             | Scroll-lock estándar de modals.                                                                                                                                                                                                                                                                      |

`prefers-reduced-motion: reduce` — slide vertical desactivado, solo opacity fade en enter/exit con `--motion-fast` `--ease-emphasis`. Drag-to-dismiss sigue funcional (es input del usuario, no animación auto).

## Mobile vs desktop

`<Sheet>` es **mobile-only por diseño**. En `≥ --breakpoint-md` los consumers que necesitan el patrón "panel modal" usan:

- `<Modal>` (centered desktop, hereda de Sheet en mobile via composición — ver `Modal.md`).
- `<Drawer>` (panel lateral desktop, no degrada — ver `Drawer.md`).

Si un consumer monta `<Sheet>` directamente en desktop, igual funciona (slide-up desde abajo, ancho 100vw) pero NO es el patrón recomendado. Esa decisión la toma el componente orquestador (ej. `<FilterDrawer>` decide entre `<Drawer>` y `<Sheet>` según breakpoint con `useMediaQuery`).

| Aspecto       | `< --breakpoint-md`                                                                                                       | `≥ --breakpoint-md`                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Activación    | Patrón nativo                                                                                                             | Posible pero desaconsejado — usar `<Modal>` o `<Drawer>`                                           |
| Ancho         | `100vw`                                                                                                                   | Si se usa: `100vw` (raro)                                                                          |
| Padding body  | `var(--space-5)` (20px)                                                                                                   | `var(--space-6)` (24px)                                                                            |
| Drag handle   | Visible si `showHandle`                                                                                                   | Visible (no varía por breakpoint)                                                                  |

## Accesibilidad

- Rol ARIA: `role="dialog"` + `aria-modal="true"` en el container. `aria-labelledby` apunta al `id` del `<h2>` cuando `title` está; cuando no, requerir `aria-label` (typescript no lo enforce, pero el consumer lo asume).
- Focus trap: al abrir, mover focus al primer elemento focusable del body (o al close `<IconButton>` si solo hay contenido estático). Tab cycla dentro del sheet. Shift+Tab al primer elemento vuelve al último.
- Return focus: al cerrar, regresar focus al elemento que disparó el sheet (consumer pasa la ref del trigger; el provider lo conserva).
- Keyboard:
  - `Tab` / `Shift+Tab`: navegación dentro del sheet (focus trap).
  - `Esc`: cierra si `dismissible`. No cierra si `dismissible: false`.
  - `Enter` / `Space` en CTA: handlers nativos.
- Screen reader: anuncia el `title` al abrir (via `aria-labelledby`). El close `<IconButton>` lleva `aria-label` desde `components.sheet.close` ("Cerrar"). Drag handle es decorativo — `aria-hidden="true"`.
- `prefers-reduced-motion`: slide vertical desactivado. Drag-to-dismiss sigue activo (gesto del usuario, no animación). Backdrop fade reducido a `--motion-fast`.

## Motion

| Qué se anima       | Token de duración             | Token de easing            | Notas                                                                                       |
| ------------------ | ----------------------------- | -------------------------- | ------------------------------------------------------------------------------------------- |
| Enter container    | `--motion-base` (280ms)       | `--ease-out-expressive`    | `translateY(100% → 0)`                                                                       |
| Exit container     | `--motion-fast` (150ms)       | `--ease-emphasis`          | `translateY(0 → 100%)`                                                                       |
| Backdrop fade      | `--motion-base` enter / `--motion-fast` exit | `--ease-emphasis` | `opacity 0 ↔ 1`                                                                              |
| Drag interaction   | Sin transition mientras drag  | —                          | Snap-back con `--motion-fast` `--ease-emphasis` si no superó el threshold 50%.               |
| `prefers-reduced-motion` | `--motion-fast`         | `--ease-emphasis`          | Solo opacity, sin transform. Drag sigue funcional.                                          |

## Copy default + i18n

| Clave i18n sugerida                  | Valor ES (voice glossary aplicado) |
| ------------------------------------ | ---------------------------------- |
| `components.sheet.close`             | "Cerrar"                           |
| `components.sheet.dragHandle.label`  | "Tirá para cerrar"                 |

EN se deja para S12.

## Edge cases

1. **Drag handle con `showHandle: false`**: el sheet aún es dismissable por click backdrop, Esc, y close `<IconButton>` (si `title` está). El gesto drag-to-dismiss sigue activo en el header.
2. **Sin `title` y sin handle**: el sheet renderiza solo body. Sigue siendo dismissable por backdrop + Esc. Útil para sheets minimalistas donde el contenido lleva su propio header.
3. **Body más alto que `max-height`**: scroll vertical interno con `overflow-y: auto`. Validar que no haya scroll horizontal inesperado.
4. **Body con scroll cerca del top**: cuando el usuario arrastra desde el handle hacia abajo, el sheet se cierra. Cuando arrastra desde el body cerca del top con scroll en 0, también puede cerrar (pull-to-dismiss). Cuando hay scroll > 0 en el body, el drag inicial scrollea el contenido — no cierra el sheet hasta volver a scroll 0.
5. **`dismissible: false` durante submit**: el sheet bloquea cierre mientras una acción está en flight. Visualmente: close `<IconButton>` ocultado o `disabled`, `Esc` no responde, click backdrop no cierra. Liberar al success/fail.
6. **Múltiples sheets apilados**: NO permitido. El segundo sheet reemplaza al primero (consumer responsabiliza la queue). Si necesitás stack, replantear UX.
7. **Sheet con form interno y validación blur**: el focus al cerrar vuelve al trigger original, no al input que falló (UX clásica). El consumer puede sobrescribir el return focus si quiere.
8. **Toast aparece sobre sheet**: válido — `--z-toast` (90) > `--z-sheet` (60). El toast queda visible por encima del sheet sin disrupción.
9. **Safe-area-inset-bottom en iPhone X+**: container respeta `padding-bottom: env(safe-area-inset-bottom)`. El body se extiende hasta el límite, pero el contenido no queda oculto bajo el home indicator.
10. **Orientation change mid-drag**: el drag se cancela (snap-back automático). El nuevo viewport recalcula `max-height`.
11. **Long-press en drag handle**: no abre menú contextual (decorativo). El gesto solo responde a drag.

## Anti-patrones

1. **Usar `<Sheet>` directamente en desktop**: rompe el patrón mobile-first. Usar `<Modal>` (que internamente cae a `<Sheet>` en mobile).
2. **Backdrop sin `--surface-overlay`**: rompe la consistencia cromática del sistema. El token tiene alpha calibrada para ambos modos.
3. **Drag handle con `pointer-events: none`**: rompe el gesto. El handle es interactivo aunque sea visualmente sutil.
4. **`Esc` deshabilitado sin razón**: WCAG 2.1.2 (No Keyboard Trap). `dismissible: false` solo se justifica para flows críticos con confirm explícito.
5. **Focus trap sin return focus**: rompe la continuidad keyboard. El consumer / provider debe conservar la ref del trigger.
6. **Slide horizontal en sheet**: rompe la convención mobile (sheets bajan, drawers entran lateralmente). Si necesitás horizontal, usar `<Drawer>` con `<Sheet>` fallback.
7. **`role="dialog"` sin `aria-labelledby` ni `aria-label`**: rompe SR. El sheet siempre necesita nombre accesible.
8. **Scroll-lock olvidado**: el body de la página se sigue scrolleando detrás del sheet, lo cual rompe la sensación modal y duplica scroll surfaces.
9. **Animación enter sin spring (`--ease-out-expressive`)**: pierde el carácter expressive del sistema (`tokens.md` §7.2). Linear o `--ease-emphasis` se ven planos.
10. **Múltiples sheets apilados visibles**: rompe la jerarquía mental. Si el flow lo necesita, replantear UX.

## Ejemplos de uso

```tsx
// Confirm cancel pedido — sheet sm con dos CTAs
<Sheet
  open={isCancelOpen}
  onOpenChange={setCancelOpen}
  title="¿Cancelar este pedido?"
  size="sm"
>
  <p className="text-body text-text-secondary mb-4">
    Lo podés reactivar después.
  </p>
  <div className="flex flex-col gap-2">
    <Button variant="destructive-ghost" onClick={handleCancel}>
      Cancelar pedido
    </Button>
    <Button variant="ghost" onClick={() => setCancelOpen(false)}>
      Volver
    </Button>
  </div>
</Sheet>

// FilterDrawer mobile — md con header y body filterable
<Sheet
  open={isFilterOpen}
  onOpenChange={setFilterOpen}
  title="Filtrar pedidos"
  size="md"
>
  <FilterPanelContent />
</Sheet>
```

## Tokens consumidos

- `--surface-elevated`, `--surface-overlay`
- `--text-primary`, `--text-secondary`, `--text-muted`
- `--border`
- `--radius-2xl`, `--radius-pill`
- `--elevation-3`
- `--sheet-max-h`
- `--space-2`, `--space-3`, `--space-5`, `--space-6`
- `--motion-fast`, `--motion-base`
- `--ease-emphasis`, `--ease-out-expressive`
- `--z-sheet`
- `--text-subtitle`
- `--breakpoint-md`

## ADRs aplicables

- [ADR 0003 — Decisiones D5/D7/D8](../decisions/0001-s2-closure-decisions.md): D8 define que `<FilterDrawer>` mobile = bottom sheet con drag handle. Esta primitiva materializa esa decisión.
- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md): D4 (toast cohabita por encima — z-index 90 > 60).

## Dependencias

- [`Modal.md`](./Modal.md) — `<Modal>` cae a `<Sheet>` automáticamente en `< --breakpoint-md`.
- [`Drawer.md`](./Drawer.md) — `<FilterDrawer>` orquesta el switch entre `<Drawer>` y `<Sheet>` según breakpoint.
- [`Button.md`](./Button.md) — los CTAs internos del sheet son `<Button>`.
- Lucide icon `x` para el close `<IconButton>` del header.

## Notas para S12 (implementación)

1. **Drag-to-dismiss gesture**. Implementar con pointer events (compatible mouse + touch). Threshold 50% del alto del sheet para completar dismiss. Snap-back con spring si no supera. Considerar librería `@use-gesture/react` o implementación propia.
2. **Focus trap**. Usar `focus-trap-react` o implementación propia (`useFocusTrap` hook). Validar return focus al trigger después del cierre.
3. **Scroll-lock**. Aplicar `body { overflow: hidden; padding-right: <scrollbar-width>; }` para evitar layout shift. Liberar al cerrar.
4. **Safe-area-inset-bottom**. CSS `env(safe-area-inset-bottom)` ya soportado en iOS 11.2+ y Chrome desktop. Validar Android Chrome real device.
5. **`useMediaQuery` para fallback en Modal/Drawer**. El hook debe ser SSR-safe (default desktop assumption antes de hydrate). Considerar `@react-hook/media-query` o implementación propia con `matchMedia`.
6. **Stack handling**. MVP: solo un sheet visible a la vez. El consumer hace queue. Validar con e2e que abrir un segundo sheet cierra el primero antes de montar.
7. **Animación drag mid-flight**. Cuando el usuario arrastra y suelta, el snap (back o exit) usa `transition` CSS. Cancelar transitions activas antes del nuevo translate para evitar overshoot.
8. **`prefers-reduced-motion`**. Validar en Safari iOS (toggle en Settings > Accessibility > Motion). El media query debe propagarse a la animación CSS sin requerir JS.
9. **Pull-to-dismiss vs scroll del body**. Usar `scrollTop === 0` del body como condición para activar pull-to-dismiss desde el body. Implementar con cuidado para no romper scroll natural.
10. **Backdrop click outside detección**. Capturar el event en el backdrop, no propagar al body. El container del sheet debe stop-propagation.
