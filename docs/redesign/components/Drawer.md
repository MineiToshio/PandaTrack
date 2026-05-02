---
title: Drawer
tier: 3
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0003 D8 (FilterDrawer desktop = drawer derecho 440px, mobile = bottom sheet)
---

# Drawer

## Propósito

Surface primitive para panel lateral desktop. Es la base que consume `<FilterDrawer>` desktop (ADR 0003 D8 — drawer derecho 440px), y cualquier panel lateral futuro (preview de detalle peek, panel de notas, panel de actividad). En mobile, el consumer (no la primitiva) decide hacer fallback a `<Sheet>` — a diferencia de `<Modal>`, esta primitiva NO degrada automáticamente. Aparece en [`orders-list.md`](../screens/orders-list.md) (FilterDrawer derecho) y potencialmente en otros listados con filtros densos.

## API TypeScript

```ts
import type { ReactNode } from "react";

type DrawerSide = "right" | "left";
type DrawerWidth = "narrow" | "default" | "wide";

type DrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lado de entrada. Default `"right"`. */
  side?: DrawerSide;
  /**
   * Ancho del drawer:
   *   `narrow` → `20rem` (320px) — panels compactos, listas de filtros simples.
   *   `default` → `var(--drawer-w)` (440px) — FilterDrawer canónico.
   *   `wide` → `35rem` (560px) — panels con preview o forms.
   * Default `"default"`.
   */
  width?: DrawerWidth;
  /** Título visible en el header. Si está, renderiza header con `<h2>` y close `<IconButton>`. */
  title?: string;
  children: ReactNode;
  /** Si `true`, dim backdrop con `--surface-overlay` y captura click outside. Default `true`. */
  modal?: boolean;
  /** Si `false`, deshabilita Esc + click backdrop + close button. Default `true`. */
  dismissible?: boolean;
};
```

Reglas TS:

- `open` controlado obligatoriamente.
- `modal: false` permite drawers que cohabitan con la página (ej. panel de actividad en GitHub style). En este caso no hay backdrop ni focus trap estricto — solo focus inicial y `Esc` para cerrar.
- `dismissible: false` (raro) bloquea cierre durante mutaciones críticas.

## Variants / Sizes

| Variant (`width`) | Uso                                                                                                | Tokens consumidos                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `narrow`          | Panel compacto (lista de filtros simple, panel de notas pequeño)                                   | `--surface-elevated`, `--radius-xl`, `--elevation-2`, ancho `20rem` (320px)                       |
| `default`         | FilterDrawer canónico (ADR 0003 D8)                                                                | mismos + `var(--drawer-w)` (440px)                                                                |
| `wide`            | Forms laterales, panels con preview                                                                | mismos + `35rem` (560px)                                                                          |

Los anchos `narrow` y `wide` no son tokens del sistema — viven como literales en este componente porque son ajustes del consumer, no contratos de layout. El ancho canónico `default` (440px) sí es token (`--drawer-w`).

## Estados visuales

| Estado     | Receta CSS (light)                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Receta CSS (dark) | Notas                                                                                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backdrop (cuando `modal: true`) | `position: fixed; inset: 0; background: var(--surface-overlay); z-index: calc(var(--z-drawer) - 1);`                                                                                                                                                                                                                                                                                                                                                                                | mismo             | Click dismiss si `dismissible`. Fade-in con `--motion-base` `--ease-emphasis`. Sin backdrop si `modal: false`.                                                                                                          |
| Container (right) | `position: fixed; top: 0; right: 0; bottom: 0; width: <width>; max-width: 100vw; background: var(--surface-elevated); border-radius: var(--radius-xl) 0 0 var(--radius-xl); box-shadow: var(--elevation-2); z-index: var(--z-drawer); display: flex; flex-direction: column;`                                                                                                                                                                                                              | mismo             | Solo border-radius en el lado interior (izquierdo cuando `side="right"`).                                                                                                                                              |
| Container (left)  | `position: fixed; top: 0; left: 0; bottom: 0; width: <width>; max-width: 100vw; background: var(--surface-elevated); border-radius: 0 var(--radius-xl) var(--radius-xl) 0; box-shadow: var(--elevation-2); z-index: var(--z-drawer); display: flex; flex-direction: column;`                                                                                                                                                                                                                | mismo             | Border-radius en el lado interior (derecho cuando `side="left"`).                                                                                                                                                      |
| Header     | `display: flex; align-items: center; justify-content: space-between; padding: var(--space-5) var(--space-6); border-bottom: 1px solid var(--border);`                                                                                                                                                                                                                                                                                                                                       | mismo             | `<h2>` consume `--text-subtitle` + `--text-primary`. Close `<IconButton>` Lucide `x` con `aria-label`. Solo si `title` está presente.                                                                                  |
| Body       | `flex: 1; overflow-y: auto; padding: var(--space-5) var(--space-6);`                                                                                                                                                                                                                                                                                                                                                                                                                       | mismo             | Scroll independiente.                                                                                                                                                                                                  |
| Enter (right) | `transform: translateX(100%);` → `translateX(0);` con `--motion-base` `--ease-out-expressive`. Backdrop fade `0 → 1` (si modal).                                                                                                                                                                                                                                                                                                                                                          | mismo             | Slide horizontal desde la derecha.                                                                                                                                                                                     |
| Enter (left)  | `transform: translateX(-100%);` → `translateX(0);` con `--motion-base` `--ease-out-expressive`.                                                                                                                                                                                                                                                                                                                                                                                            | mismo             | Slide desde la izquierda.                                                                                                                                                                                              |
| Exit       | reverse del enter con `--motion-fast` `--ease-emphasis`.                                                                                                                                                                                                                                                                                                                                                                                                                                  | mismo             |                                                                                                                                                                                                                        |

`prefers-reduced-motion: reduce` — slide horizontal desactivado, solo opacity fade con `--motion-fast`. Backdrop fade reducido a `--motion-fast`.

## Mobile vs desktop

`<Drawer>` es **desktop-first por diseño**. La primitiva NO degrada automáticamente en `< --breakpoint-md` (a diferencia de `<Modal>`). El consumer orquesta el switch:

```tsx
// FilterDrawer orquesta el switch
const isDesktop = useMediaQuery("(min-width: 48rem)");

return isDesktop ? (
  <Drawer open={open} onOpenChange={setOpen} title="Filtrar">
    <FilterPanelContent />
  </Drawer>
) : (
  <Sheet open={open} onOpenChange={setOpen} title="Filtrar" size="md">
    <FilterPanelContent />
  </Sheet>
);
```

Esto se documenta porque es **deliberado** — los drawers no siempre tienen sentido en mobile (un drawer derecho de 320px en mobile 360px se ve apretado). El consumer decide caso por caso.

| Aspecto       | `< --breakpoint-md` (mobile)                                                       | `≥ --breakpoint-md` (desktop)                              |
| ------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Uso recomendado | Hacer fallback manual a `<Sheet>` desde el componente orquestador                 | Patrón nativo (drawer canónico)                            |
| Ancho mobile  | `100vw` con `max-width: 100vw` si por alguna razón se monta                        | Según `width` prop (320 / 440 / 560px)                     |
| Padding body  | `var(--space-4)` (sugerido si se usa)                                              | `var(--space-5)` `var(--space-6)`                          |

## Accesibilidad

- Rol ARIA: `role="dialog"` + `aria-modal="true"` en el container cuando `modal: true`. Cuando `modal: false`, `role="region"` con `aria-label` (no atrapa focus, no tiene backdrop).
- `aria-labelledby` apunta al `<h2>` del header. Sin `title`, requerir `aria-label` por consumer.
- Focus trap: solo cuando `modal: true`. Mover focus al primer focusable del body (o al close `<IconButton>`).
- Return focus: regresar al trigger al cerrar.
- Keyboard:
  - `Tab` / `Shift+Tab`: focus trap si modal, normal si no-modal.
  - `Esc`: cierra si `dismissible`.
  - Enter / Space en CTAs: nativos.
- Screen reader: anuncia `title` al abrir. Close `<IconButton>` con `aria-label` desde `components.drawer.close` ("Cerrar").
- `prefers-reduced-motion`: slide horizontal desactivado, solo opacity fade `--motion-fast`.

## Motion

| Qué se anima       | Token de duración                            | Token de easing            | Notas                                                                                |
| ------------------ | -------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------ |
| Enter container    | `--motion-base` (280ms)                      | `--ease-out-expressive`    | `translateX(±100% → 0)` según side.                                                  |
| Exit container     | `--motion-fast` (150ms)                      | `--ease-emphasis`          | Reverse del enter.                                                                   |
| Backdrop fade      | `--motion-base` enter / `--motion-fast` exit | `--ease-emphasis`          | `opacity 0 ↔ 1`. Solo si `modal: true`.                                              |
| `prefers-reduced-motion` | `--motion-fast`                         | `--ease-emphasis`          | Sin slide. Solo opacity.                                                             |

## Copy default + i18n

| Clave i18n sugerida          | Valor ES (voice glossary aplicado) |
| ---------------------------- | ---------------------------------- |
| `components.drawer.close`    | "Cerrar"                           |

EN se deja para S12.

## Edge cases

1. **`modal: false` sin backdrop**: el drawer cohabita con la página. El usuario puede seguir interactuando con el contenido detrás. No hay focus trap — Tab sale del drawer naturalmente. Útil para panels de actividad / notas siempre visibles.
2. **`modal: false` + `dismissible: false`**: rara combinación. El drawer queda fijo en pantalla hasta que el consumer lo controle programáticamente. Caso de uso: panel de monitoreo crítico.
3. **`narrow` width en viewport ancho**: el drawer se ve "perdido" lateralmente. Considerar usar `default` o repensar como popover/dropdown.
4. **`wide` width en `--breakpoint-md` exacto**: 560px ocupa ~73% del viewport 768px. Validar que el usuario aún ve algo del contenido detrás (si `modal: false`) o que el backdrop comunica claramente el modal lock.
5. **Drawer con form interno y validación**: el consumer maneja el form. El drawer solo provee la surface. Submit dentro del drawer puede mantener el drawer abierto (consumer decide).
6. **Toast aparece sobre drawer**: válido — `--z-toast` (90) > `--z-drawer` (50). Toast queda visible por encima.
7. **Modal aparece sobre drawer**: válido — `--z-modal` (80) > `--z-drawer` (50). El modal tapa parcialmente el drawer. Al cerrar el modal, focus vuelve al drawer.
8. **Drawer derecho con sidebar expandido (desktop)**: el sidebar (`--z-sidebar` 20) queda detrás del drawer. El usuario puede tener sidebar visible + drawer + contenido principal. Validar que la jerarquía se mantenga clara.
9. **Drawer izquierdo en mobile sin fallback**: el consumer monta `<Drawer side="left">` directamente. El drawer ocupa hasta `100vw` (`max-width: 100vw`). No es el patrón recomendado pero funciona.
10. **Resize del viewport mientras el drawer está open**: el drawer mantiene su `width` prop. Si pasa de desktop a mobile, el consumer típicamente cierra el drawer y reabre como sheet (lógica del consumer, no de la primitiva).
11. **Header sin `title` y `modal: false`**: drawer "raw" sin chrome. Útil para casos custom donde el body provee su propio header. En este caso el consumer debe asegurar `aria-label` en el container.

## Anti-patrones

1. **`<Drawer>` directo en mobile sin orquestación**: rompe UX mobile. La primitiva NO degrada — el consumer debe orquestar.
2. **Backdrop sin `--surface-overlay`**: rompe consistencia.
3. **Esc deshabilitado sin razón**: viola WCAG 2.1.2.
4. **Focus trap activo cuando `modal: false`**: rompe la cohabitación. Solo `modal: true` activa el trap.
5. **`width` literal en consumer**: rompe la regla de tokens. Usar las tres variants `narrow | default | wide`.
6. **Drawer sin `title` y sin `aria-label`**: rompe a11y SR.
7. **Animación slide vertical en drawer**: contradice la convención (drawers entran lateralmente, sheets bajan). Si necesitás vertical, usar `<Sheet>`.
8. **Border-radius en los 4 lados**: rompe la receta canónica (solo el lado interior tiene radius).
9. **`--z-drawer` arbitrario**: usar siempre el token. Custom z-index rompe la stacking order del sistema.
10. **Dos drawers simultáneos del mismo lado**: rompe stacking. El consumer queue.

## Ejemplos de uso

```tsx
// FilterDrawer desktop (ADR 0003 D8)
<Drawer
  open={isFilterOpen}
  onOpenChange={setFilterOpen}
  side="right"
  width="default"
  title="Filtrar pedidos"
>
  <FilterPanelContent />
  <DrawerFooter sticky>
    <Button variant="ghost" onClick={handleClear}>Limpiar</Button>
    <Button variant="primary" onClick={handleApply}>
      Aplicar ({resultCount} resultados)
    </Button>
  </DrawerFooter>
</Drawer>

// Panel de actividad no-modal (cohabita con la página)
<Drawer
  open={isActivityOpen}
  onOpenChange={setActivityOpen}
  side="right"
  width="narrow"
  title="Actividad"
  modal={false}
>
  <ActivityFeed />
</Drawer>
```

## Tokens consumidos

- `--surface-elevated`, `--surface-overlay`
- `--text-primary`
- `--border`
- `--radius-xl`
- `--elevation-2`
- `--drawer-w`
- `--space-5`, `--space-6`
- `--motion-fast`, `--motion-base`
- `--ease-emphasis`, `--ease-out-expressive`
- `--z-drawer`
- `--text-subtitle`
- `--breakpoint-md`

## ADRs aplicables

- [ADR 0003 — Filter drawer mobile/desktop](../decisions/0001-s2-closure-decisions.md): D8 (desktop = drawer derecho 440px = `--drawer-w`, mobile = bottom sheet con drag handle, footer sticky con "Limpiar" + "Aplicar"). Esta primitiva materializa la versión desktop; el consumer (`<FilterDrawer>`) orquesta el switch a `<Sheet>` mobile.

## Dependencias

- [`Sheet.md`](./Sheet.md) — el consumer hace fallback a `<Sheet>` en mobile (no es responsabilidad de esta primitiva).
- [`Button.md`](./Button.md) — botones internos del drawer.
- Lucide icon `x` para el close `<IconButton>`.

## Notas para S12 (implementación)

1. **No degrada automáticamente**. Documentar claramente en código (JSDoc) que `<Drawer>` es desktop-first. El consumer (`<FilterDrawer>`, etc.) usa `useMediaQuery` para decidir entre `<Drawer>` y `<Sheet>`.
2. **`modal: false` no atrapa focus**. Implementar focus trap solo cuando `modal: true`. Cuando `modal: false`, mover focus inicial al primer focusable y dejar Tab natural.
3. **Backdrop click outside detección**. Solo cuando `modal: true`. Capturar event en backdrop, stop-propagation en container.
4. **Scroll-lock**. Solo cuando `modal: true`. Aplicar `body { overflow: hidden; }` igual que en `<Modal>`.
5. **Animación CSS**. Slide horizontal con CSS transitions. Validar que el `transform: translateX()` no genera repaint excesivo (usar `will-change: transform` durante el enter/exit).
6. **`useMediaQuery` SSR-safe**. Si el consumer hace branching client-side, asegurar default consistente entre server y client (usualmente desktop por default + reconciliar en hydration).
7. **`max-width: 100vw`**. Garantía de que el drawer nunca se sale del viewport, especialmente en mobile cuando se monta directamente.
8. **Stack con modal sobre drawer**. Validar que `useFocusTrap` correctamente cede el control al modal y luego lo recupera al cerrar.
9. **Sticky footer dentro del drawer**. El consumer puede agregar un `<DrawerFooter sticky>` que se queda al fondo. Implementación: `position: sticky; bottom: 0; background: var(--surface-elevated); border-top: 1px solid var(--border); padding: var(--space-4) var(--space-6);`. Documentar como subcomponente en S12.
10. **Resize handler**. Si el viewport cambia mientras el drawer está open, el consumer típicamente cierra y reabre. La primitiva no hace nada automático.
