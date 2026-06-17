---
title: Popover
tier: 3
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0006 (icon+label contract — popovers que muestran info por color requieren label adyacente; los popovers de este componente son agnósticos al color, pero el contenido lo respeta)
---

# Popover

## Propósito

Surface primitive para overlays anclados a un trigger. Es la base que consume el datepicker de [`DateInput.md`](./DateInput.md), el dropdown de opciones del [`Combobox.md`](./Combobox.md) (resultados de autocomplete), `<DropdownMenu>` y `<OverflowMenu>`, popovers de previsualización (ej. preview de pedido al hover), y cualquier flotante anclado a un elemento DOM o coordenadas. Aparece en [`order-create.md`](../screens/order-create.md) (datepickers, combobox de tienda con resultados), [`orders-list.md`](../screens/orders-list.md) (overflow `[···]` por row), y [`order-detail.md`](../screens/order-detail.md) (overflow del header).

## API TypeScript

```ts
import type { ReactNode } from "react";

type PopoverPlacement =
  | "bottom-start"
  | "bottom-end"
  | "bottom"
  | "top-start"
  | "top-end"
  | "top"
  | "right-start"
  | "right-end"
  | "left-start"
  | "left-end";

type PopoverAnchor = HTMLElement | { x: number; y: number };

type PopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Elemento DOM al que se ancla el popover, o coordenadas absolutas para context menus.
   * Cuando es coordenadas, el popover se posiciona en `(x, y)` sin flip automático sobre un anchor element.
   */
  anchor: PopoverAnchor;
  /**
   * Placement preferido. El sistema hace flip automático a la otra posición si no entra en viewport.
   * Default `"bottom-start"`.
   */
  placement?: PopoverPlacement;
  children: ReactNode;
  /**
   * Offset entre anchor y popover en px. Default `8` (= `var(--space-2)`).
   */
  offset?: number;
  /**
   * Si `true`, el popover hereda el ancho del anchor element (útil en autocomplete). Default `false`.
   */
  matchAnchorWidth?: boolean;
};
```

Reglas TS:

- `anchor` discrimina entre HTMLElement y coordenadas. Cuando es coordenadas, el `placement` flip se desactiva (no hay rect base).
- El consumer aplica el `role` ARIA correcto al popover (ver Accesibilidad). El componente solo provee la surface.

## Variants / Sizes

`<Popover>` no tiene variants visuales — es una surface neutra. Los sizes los controla el consumer vía padding interno y ancho propio. El componente solo declara la receta base de la superficie.

| Slot         | Uso                                                                                        | Tokens consumidos                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Container    | Surface base con border, radius, elevation                                                 | `--surface-elevated`, `--border-strong`, `--radius-lg`, `--elevation-2`                                          |
| Padding interno | El consumer decide. Default sugerido `var(--space-2)` (8px).                            | `--space-2`                                                                                                      |

## Estados visuales

| Estado     | Receta CSS (light)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Receta CSS (dark) | Notas                                                                                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Container  | `position: absolute; background: var(--surface-elevated); border: 1px solid var(--border-strong); border-radius: var(--radius-lg); box-shadow: var(--elevation-2); z-index: var(--z-popover); min-width: <matchAnchorWidth ? anchor.width : auto>; padding: var(--space-2);`                                                                                                                                                                                                                                  | mismo             | Padding default — el consumer puede sobrescribir vía wrapper interno.                                                                                                                                                              |
| Enter      | `opacity: 0; transform: translateY(4px);` → `opacity: 1; transform: translateY(0);` con `--motion-fast` `--ease-emphasis`. La dirección del `translateY` se invierte según `placement` (bottom* → 4px, top* → -4px).                                                                                                                                                                                                                                                                                              | mismo             | Movimiento sutil — el popover "aparece" cerca del anchor.                                                                                                                                                                          |
| Exit       | `opacity: 1 → 0` con `--motion-fast` `--ease-emphasis`. Sin reverse del transform (corte directo).                                                                                                                                                                                                                                                                                                                                                                                                                | mismo             | Más rápido al salir.                                                                                                                                                                                                                |
| Anchor element | El consumer puede agregar `data-popover-active="true"` al trigger para aplicar un state visual extra (ej. background tinted) — opcional, no requerido por la primitiva.                                                                                                                                                                                                                                                                                                                                       | mismo             |                                                                                                                                                                                                                                    |

`prefers-reduced-motion: reduce` — translate desactivado, solo opacity fade `--motion-fast`.

## Mobile vs desktop

`<Popover>` funciona en ambos viewports. La diferencia clave:

| Aspecto              | `< --breakpoint-md` (mobile)                                                                              | `≥ --breakpoint-md` (desktop)                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Placement            | Auto-flip respeta los bordes del viewport. En mobile, los popovers tienden a aparecer fullwidth o casi.   | Auto-flip estándar.                                                                      |
| Trigger              | Tap (no hover) — los popovers que se abren con hover desktop deben tener tap fallback en mobile          | Hover, focus, o click según consumer                                                     |
| Combobox/DateInput   | Considerar `<Sheet>` full-screen en lugar de `<Popover>` para listas largas (decisión del consumer)        | `<Popover>` natural                                                                       |
| OverflowMenu         | Popover funciona bien — el menú es corto                                                                  | Popover natural                                                                          |
| Min-width            | El popover respeta `min(anchor.width, viewport - margin)`                                                 | Igual                                                                                    |

## Accesibilidad

- Rol ARIA: el componente NO declara `role` por default. **El consumer lo aplica** según uso:
  - `role="listbox"` — combobox de autocomplete.
  - `role="menu"` — DropdownMenu / OverflowMenu (los items con `role="menuitem"`).
  - `role="dialog"` — popover interactivo (ej. mini-form, datepicker).
  - Sin role — popover decorativo de info (raro).
- `aria-expanded="true"` en el trigger cuando el popover está open.
- `aria-controls` en el trigger apuntando al `id` del popover container.
- `aria-haspopup` en el trigger según el `role` (`menu`, `listbox`, `dialog`).
- Focus management:
  - Al abrir: el componente NO mueve focus por default. El consumer decide (combobox mantiene focus en el input; menu lo mueve al primer item; dialog lo mueve al primer focusable).
  - Al cerrar: focus regresa al trigger.
- Keyboard:
  - `Esc`: cierra el popover (siempre — `dismissible` implícito).
  - `Tab`: depende del consumer. En menu → atrapa o cycla; en combobox → mantiene focus en el input.
  - Las flechas, Home, End, type-to-search → responsabilidad del consumer (ver `DropdownMenu.md`, `Combobox.md`).
- Dismiss outside click: por default sí, capturando click en `document`. El consumer puede deshabilitar para casos específicos.
- `prefers-reduced-motion`: translate desactivado, solo opacity.

## Motion

| Qué se anima       | Token de duración             | Token de easing            | Notas                                                                                |
| ------------------ | ----------------------------- | -------------------------- | ------------------------------------------------------------------------------------ |
| Enter              | `--motion-fast` (150ms)       | `--ease-emphasis`          | Opacity 0 → 1 + translateY 4px → 0 (dirección depende de placement).                  |
| Exit               | `--motion-fast` (150ms)       | `--ease-emphasis`          | Solo opacity. Corte directo del transform.                                            |
| Reposition (flip)  | `--motion-fast`               | `--ease-emphasis`          | Si el popover flippea por scroll/resize, transition de `top`/`left`.                  |
| `prefers-reduced-motion` | `--motion-fast`         | `--ease-emphasis`          | Sin transform. Solo opacity.                                                         |

## Copy default + i18n

`<Popover>` es una surface primitiva sin copy propio. El consumer maneja todo el copy interno con sus propias claves i18n (ej. `components.combobox.empty`, `components.dropdownMenu.heading`). No hay claves específicas a `popover` en el catálogo.

## Edge cases

1. **Anchor element fuera del viewport (scrolled)**: el popover se mantiene anclado y puede salir parcialmente del viewport. El consumer puede cerrar al detectar `intersectionObserver` del anchor (decisión consumer, no primitiva).
2. **Anchor coordenadas (context menu)**: cuando `anchor: { x, y }`, el popover se posiciona en `(x + offset, y + offset)`. Sin flip automático (no hay rect base). El consumer es responsable de chequear que `(x, y)` esté dentro del viewport.
3. **Placement flip por viewport**: si `bottom-start` no entra debajo del anchor, el sistema flippea a `top-start` automáticamente. Si tampoco entra arriba, queda forzado en bottom con scroll interno (en cuyo caso el popover debería ser `<Sheet>` o `<Drawer>`).
4. **`matchAnchorWidth: true` con anchor pequeño**: el popover hereda el ancho. Si el contenido es más ancho, overflow horizontal con scrollbar interno (raro — el consumer debe diseñar el contenido para el ancho del anchor).
5. **Multiple popovers anidados**: válido (ej. submenu de DropdownMenu). Cada nivel tiene su propio `<Popover>` con `placement: "right-start"` desde el item parent. El stacking se resuelve por orden de mount (el más reciente tiene mayor z stacked).
6. **Popover sobre modal/drawer/sheet**: válido — `--z-popover` (40) es menor que modal/drawer/sheet. **Pero** los popovers que viven dentro de un modal heredan z stacking del modal automáticamente (gracias al portal o al stacking context). El consumer debe portalear el popover al modal container, no al body.
7. **Popover dentro de `<Drawer modal={false}>`**: el popover funciona. Click outside del popover (pero dentro del drawer) cierra el popover sin cerrar el drawer.
8. **Touch device sin hover**: los popovers que se abren con hover desktop deben tener `onClick` fallback. La primitiva no enfuerza esto — responsabilidad del consumer.
9. **Resize del viewport mientras open**: el popover reposiciona automáticamente (re-evalúa flip). Consumer puede cerrar opcionalmente si lo prefiere.
10. **Anchor desmontado mientras popover open**: el popover queda huérfano. La primitiva debe detectar y cerrar (`useEffect` cleanup que vincula el ref del anchor).
11. **Click dentro del popover**: NO cierra. El consumer puede agregar `onClick` que cierra (ej. al seleccionar un item en menu).

## Anti-patrones

1. **Popover gigante (>80% del viewport)**: usar `<Modal>` o `<Sheet>` en su lugar. Popovers son para contenido compacto.
2. **Popover sin `aria-expanded` en el trigger**: rompe SR. El consumer debe propagar el estado.
3. **Popover decorativo con `role="dialog"`**: rompe SR — no hay diálogo real, solo info pasajera.
4. **Click outside deshabilitado sin razón**: el usuario espera poder cerrar tocando fuera. Solo deshabilitar para flows específicos (ej. confirm crítico embebido en popover, raro).
5. **Animación slide larga (`--motion-base`)**: pierde la sensación "sutil" de popover. Solo `--motion-fast`.
6. **`--z-popover` arbitrario**: usar siempre el token.
7. **Múltiples popovers del mismo trigger simultáneos**: rompe stacking. El trigger maneja toggle.
8. **Popover sin Esc**: viola WCAG 2.1.2.
9. **`matchAnchorWidth: true` con contenido inherentemente ancho** (ej. tabla larga): rompe el contrato. Mejor desactivar y usar ancho propio del contenido.
10. **Anchor coordenadas sin viewport check**: el popover puede aparecer fuera de la pantalla. El consumer debe validar.

## Ejemplos de uso

```tsx
// DateInput popover (consumer aplica role="dialog" para datepicker interactivo)
<Popover
  open={isOpen}
  onOpenChange={setOpen}
  anchor={inputRef.current}
  placement="bottom-start"
  matchAnchorWidth
>
  <div role="dialog" aria-label="Elegir fecha">
    <Calendar value={value} onChange={handleChange} />
  </div>
</Popover>

// Context menu (anchor por coordenadas, consumer aplica role="menu")
<Popover
  open={contextMenu.open}
  onOpenChange={closeContextMenu}
  anchor={{ x: contextMenu.x, y: contextMenu.y }}
  placement="bottom-start"
>
  <ul role="menu">
    <li role="menuitem" onClick={handleEdit}>Editar</li>
    <li role="menuitem" onClick={handleDelete}>Eliminar</li>
  </ul>
</Popover>

// Combobox results (consumer aplica role="listbox")
<Popover
  open={isResultsOpen}
  onOpenChange={setResultsOpen}
  anchor={inputRef.current}
  placement="bottom-start"
  matchAnchorWidth
>
  <ul role="listbox" aria-label="Tiendas">
    {options.map((opt) => (
      <li role="option" key={opt.value}>{opt.label}</li>
    ))}
  </ul>
</Popover>
```

## Tokens consumidos

- `--surface-elevated`
- `--border-strong`
- `--radius-lg`
- `--elevation-2`
- `--space-2`
- `--motion-fast`
- `--ease-emphasis`
- `--z-popover`

## ADRs aplicables

- [ADR 0006 — Color blindness icon-label contract](../decisions/0006-color-blindness-icon-label-contract.md): los popovers que muestran información por color requieren label de texto adyacente. La primitiva es agnóstica al color, pero el contenido (consumer) lo respeta.

## Dependencias

- [`Combobox.md`](./Combobox.md) — el dropdown de resultados es un `<Popover>` con `role="listbox"`.
- [`DateInput.md`](./DateInput.md), [`DateRangeInput.md`](./DateRangeInput.md) — el calendario popup es un `<Popover>` con `role="dialog"`.
- [`DropdownMenu.md`](./DropdownMenu.md) — `<Popover>` + `role="menu"`.
- [`OverflowMenu.md`](./OverflowMenu.md) — extiende DropdownMenu.
- Librería esperada en S12: [`@floating-ui/react`](https://floating-ui.com/) para positioning, flip, shift, arrow.

## Notas para S12 (implementación)

1. **Librería de positioning**. Recomendado `@floating-ui/react` (sucesor de Popper.js). Provee `useFloating`, `flip`, `shift`, `offset`, `autoUpdate`. Alternativa: implementación propia con `getBoundingClientRect` + viewport math (más liviano pero menos features).
2. **Portal al body**. Por default, portalear al `document.body` para evitar problemas de stacking context con padres con `transform` u `overflow: hidden`. Excepción: dentro de modal/drawer/sheet, portalear al container del modal.
3. **Click outside detection**. Listener en `document` con cleanup. Validar que clicks dentro del popover no disparen close.
4. **Esc handling**. Listener en `document` o en el container del popover. Stop propagation cuidadoso para no cerrar parents (ej. modal contenedor).
5. **Anchor unmounted detection**. Si el anchor element se desmonta, el popover queda huérfano. Usar `IntersectionObserver` o `MutationObserver` para detectar y cerrar.
6. **Auto-update positioning**. `@floating-ui/react` provee `autoUpdate` que escucha scroll y resize. Activar para popovers con vida media >2s. Para popovers cortos (tooltip), opcional.
7. **`matchAnchorWidth` implementación**. Leer `anchor.getBoundingClientRect().width` y aplicarlo como `min-width` y/o `width` al popover. Mantener responsive con `autoUpdate`.
8. **Stacking dentro de modal**. Validar que `--z-popover` (40) bajo `--z-modal` (80) NO impida que el popover dentro del modal se vea. Truco: portalear al container del modal (no al body) para heredar el stacking context.
9. **Touch device hover fallback**. Para popovers de hover (ej. tooltip rich), agregar `onClick` que toggle. Detectar touch via `pointer: coarse` media query.
10. **Animación CSS vs Framer**. CSS animations son suficientes. Si el consumer quiere mount/unmount con animación, usar `useTransition` o equivalente.
