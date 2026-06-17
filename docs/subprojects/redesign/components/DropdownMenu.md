---
title: DropdownMenu
tier: 3
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0001 D6 (overflow [···] para destructive irreversible)
  - ADR 0001 D17 (menú contextual sobre mascota: ocultar / theme / settings)
---

# DropdownMenu

## Propósito

Primitiva genérica de menú contextual: lista de acciones disparadas por un trigger (button, icon button). Aparece en el menú de usuario del sidebar footer, en el `LangToggle`, en el menú contextual de la mascota panda (ADR 0001 D17), en el sort dropdown de orders list, en cualquier menú de acciones secundarias. Para el caso especializado del overflow `[···]` del header de detalle (ADR 0001 D6), usar [`./OverflowMenu.md`](./OverflowMenu.md), que es una variant pre-configurada de DropdownMenu.

## API TypeScript

```ts
import type { ReactNode } from "react";

type MenuItemDefault = {
  type: "item";
  label: string;
  icon?: ReactNode; // Lucide
  onSelect: () => void;
  kbd?: string | string[];
  variant?: "default" | "destructive";
  disabled?: boolean;
};

type MenuItemSeparator = { type: "separator" };

type MenuItemHeading = { type: "heading"; label: string };

type MenuItemSubmenu = {
  type: "submenu";
  label: string;
  icon?: ReactNode;
  items: MenuItem[];
  disabled?: boolean;
};

type MenuItem = MenuItemDefault | MenuItemSeparator | MenuItemHeading | MenuItemSubmenu;

type DropdownMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** El trigger — el componente le aplicará anchor + ARIA. */
  trigger: ReactNode;
  /** Items del menú. */
  items: MenuItem[];
  /** Default `bottom-start`. */
  placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end" | "right-start" | "left-start";
  /** Aria-label cuando no hay heading inicial. */
  ariaLabel?: string;
};
```

## Variants / Sizes

DropdownMenu tiene un solo render visual; lo que varía son los `MenuItem` types (discriminated union arriba). Variants de item:

| Item type   | Uso                                                                              | Tokens                                                            |
| ----------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `item`      | Acción ejecutable. Default: text `--text-primary`. Destructive: `--destructive`. | hover state-layer; padding `--space-2 --space-3`                  |
| `separator` | Divider entre grupos                                                             | `1px solid var(--border)`; margin `--space-1` vertical            |
| `heading`   | Título de grupo en eyebrow                                                       | `.eyebrow` utility, padding `--space-1 --space-3`, `--text-muted` |
| `submenu`   | Item con `chevron-right` que abre submenu lateral                                | mismo `item` + chevron Lucide 14×14 alineado derecha              |

Sizes de menú: por contenido. `min-width: 12rem` (~192px), `max-width: 20rem` (~320px). Padding interno container: `--space-1`.

## Estados visuales

| Estado                   | Receta CSS (light + dark)                                                                                                                                                                                                                              | Notas                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `menu container`         | `background: var(--surface-elevated); border: 1px solid var(--border-strong); border-radius: var(--radius-lg); box-shadow: var(--elevation-2); padding: var(--space-1); min-width: 12rem; max-width: 20rem; z-index: var(--z-popover);`                | Compone [`./Popover.md`](./Popover.md) bajo el capó.                                                    |
| `item idle`              | `display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); color: var(--text-primary); font-size: var(--text-body); font-weight: var(--font-weight-regular); cursor: pointer;` | Lucide icon leading 16×16 en `currentColor`. Kbd alineado a la derecha (`margin-inline-start: auto`).   |
| `item hover/focus`       | `background-color: color-mix(in oklch, var(--text-primary) var(--state-hover-mix), transparent);`                                                                                                                                                      | Hover y focus usan el mismo state layer (alineado con keyboard nav).                                    |
| `item destructive idle`  | `color: var(--destructive-chip-text);` (light) / `color: var(--destructive);` (dark, ya alias). Icon hereda `currentColor`.                                                                                                                            | Para acciones como "Eliminar pedido". Texto debe pasar 4.5:1 — ya validado por chip-text alias.         |
| `item destructive hover` | `background-color: color-mix(in oklch, var(--destructive) 8%, transparent); color: var(--destructive-chip-text);`                                                                                                                                      | Mix 8% destructive sobre transparent — visible pero no alarmante.                                       |
| `item disabled`          | `color: var(--text-muted); pointer-events: none;` (sin opacity)                                                                                                                                                                                        | ADR 0001 D3.                                                                                            |
| `item with kbd`          | Kbd `<Kbd>` componente reusado. Color hereda `var(--text-muted)`.                                                                                                                                                                                      | Kbd visible solo desktop (`display: none` mobile). Mobile no tiene atajos físicos.                      |
| `submenu chevron`        | Lucide `chevron-right` 14×14 en `--text-muted`, alineado derecha.                                                                                                                                                                                      | Submenu abre lateralmente a la derecha (o izquierda si no entra) con `--motion-fast` `--ease-emphasis`. |
| `separator`              | `height: 1px; background: var(--border); margin: var(--space-1) 0; border: 0;`                                                                                                                                                                         | Divider sutil.                                                                                          |
| `heading`                | Aplica utility `.eyebrow` (uppercase mono `--text-eyebrow` `--text-muted` `letter-spacing: 0.08em`); padding `--space-1 --space-3`.                                                                                                                    | Título de grupo. No focuseable.                                                                         |

## Mobile vs desktop

- **Desktop** (`≥ --breakpoint-md`): popover anchor al trigger con flip automático. Kbd visible.
- **Mobile** (`< --breakpoint-md`): el componente puede degradar a `<Sheet>` para menús con muchos items (>5) — esta decisión es del consumidor vía prop opcional `mobileVariant?: 'popover' | 'sheet'`. Default `popover`. Para casos como "Más opciones" del header (overflow), `sheet` ofrece tap targets más grandes.

## Accesibilidad

- Container: `role="menu"` + `aria-orientation="vertical"` + `aria-label` (si no hay heading dominante).
- Item: `role="menuitem"` + `tabindex={-1}` (solo el item con focus actual tiene tabindex 0). Submenu: `role="menuitem" aria-haspopup="menu" aria-expanded={isSubmenuOpen}`.
- Trigger: `aria-haspopup="menu" aria-expanded={open}` + `aria-controls={menuId}`.
- Keyboard:
  - `Tab`/`Shift+Tab`: cierra menú (foco vuelve al trigger).
  - `ArrowDown`/`ArrowUp`: navega items.
  - `ArrowRight`: abre submenu (si hay) o no hace nada.
  - `ArrowLeft`: cierra submenu y vuelve al item padre.
  - `Home`: primer item.
  - `End`: último.
  - `Enter`/`Space`: activa item.
  - `Esc`: cierra menú, foco vuelve al trigger.
  - Type-to-search: focus al primer item cuyo label empieza con la letra escrita (timeout 500ms para reset).
- Focus management: al abrir, foco al primer item enfocable (no separator/heading). Al cerrar, foco vuelve al trigger.
- Click outside cierra.
- `prefers-reduced-motion`: menu enter/exit sin scale, solo opacity con `--motion-fast`.

## Motion

- Enter: opacity 0→1 + translateY 4→0 con `--motion-fast` `--ease-emphasis`.
- Exit: opacity 1→0 con `--motion-fast`. Sin translate.
- Submenu: enter desde el lado correspondiente (translateX 4→0 right side). Mismo timing.
- `prefers-reduced-motion`: opacity-only sin translate.

## Copy default + i18n

El consumidor provee labels. Convenciones para items frecuentes:

| Clave i18n sugerida                             | Valor ES (voice glossary)  |
| ----------------------------------------------- | -------------------------- |
| `components.dropdownMenu.commonItems.edit`      | "Editar"                   |
| `components.dropdownMenu.commonItems.delete`    | "Eliminar"                 |
| `components.dropdownMenu.commonItems.share`     | "Compartir"                |
| `components.dropdownMenu.commonItems.copy`      | "Copiar"                   |
| `components.dropdownMenu.commonItems.duplicate` | "Duplicar"                 |
| `components.dropdownMenu.empty`                 | "Sin opciones disponibles" |

## Edge cases

1. **Items vacíos** (`items.length === 0`): renderiza placeholder "Sin opciones disponibles" en `--text-muted` `--text-caption` con padding generoso, no abre menú vacío.
2. **Submenu en mobile**: en mobile `popover` mode, submenu abre como nuevo Sheet sobre el actual. En `sheet` mode, navega in-place reemplazando contenido (con back arrow header).
3. **Item async** (loading): no hay variant `loading` en el item — el consumidor cierra el menu y muestra loading state en el trigger (Button loading).
4. **Menú clipea con viewport**: `@floating-ui` aplica flip + shift automático.
5. **Item con submenu disabled**: chevron sigue visible pero no abre. Tab/ArrowRight no hace nada.
6. **Long-press mobile (custom)**: el padre puede invocar `<DropdownMenu>` desde long-press (caso mascota panda ADR 0001 D17 — el trigger es el sprite mismo). El componente no implementa long-press detection; el padre lo hace y dispara `onOpenChange(true)`.

## Anti-patrones

1. **Nunca dos primary actions** en el menú — el menú es para acciones secundarias o destructive. La primary va en el cuerpo / sidebar.
2. **Nunca >12 items** — si tenés más, reorganizá en groups con headings o externaliá a un Drawer/Modal.
3. **Nunca opacity** en disabled (ADR 0001 D3).
4. **Nunca `--accent-cool`** como color de item (ADR 0006).
5. **Nunca destructive sin confirmación** para acciones irreversibles — el item dispara confirm modal/sheet (responsabilidad del consumidor) o usa toast neutral-undo (responsabilidad del consumidor).
6. **Nunca mezclar items de selección con items de acción** — si necesitás multi-select, usá Checkbox dentro del menú (variant separada `MenuItemCheck` no incluida en MVP — agregar en S6+ si emerge use case).

## Ejemplos de uso

```tsx
// Menú de usuario en sidebar footer
<DropdownMenu
  open={open}
  onOpenChange={setOpen}
  trigger={<Avatar user={session.user} size={40} />}
  ariaLabel="Menú de cuenta"
  items={[
    { type: "heading", label: "Sergio Minei" },
    { type: "item", label: "Configuración", icon: <Settings />, onSelect: () => router.push("/settings") },
    { type: "item", label: "Cambiar tema", icon: <Sun />, kbd: "T", onSelect: toggleTheme },
    { type: "separator" },
    { type: "item", label: "Cerrar sesión", icon: <LogOut />, variant: "destructive", onSelect: signOut },
  ]}
/>

// Menú contextual de la mascota panda (ADR 0001 D17)
<DropdownMenu
  open={open}
  onOpenChange={setOpen}
  trigger={<MascotBubble variant="idle" position="bubble" />}
  ariaLabel="Opciones de la mascota"
  items={[
    { type: "item", label: "Ocultar mascota", icon: <EyeOff />, onSelect: hideMascot },
    { type: "item", label: "Cambiar tema", icon: <Moon />, onSelect: toggleTheme },
    { type: "item", label: "Configuración", icon: <Settings />, onSelect: () => router.push("/settings") },
  ]}
/>
```

## Tokens consumidos

`--surface-elevated`, `--border`, `--border-strong`, `--text-primary`, `--text-muted`, `--destructive`, `--destructive-chip-text`, `--font-weight-regular`, `--text-body`, `--text-eyebrow`, `--text-caption`, `--font-mono`, `--space-1`, `--space-2`, `--space-3`, `--radius-md`, `--radius-lg`, `--elevation-2`, `--z-popover`, `--motion-fast`, `--ease-emphasis`, `--state-hover-mix`.

## ADRs aplicables

- [`../decisions/0001-s2-closure-decisions.md`](../decisions/0001-s2-closure-decisions.md) D6 (acciones irreversibles), D17 (menú contextual mascota).
- [`../decisions/0006-color-blindness-icon-label-contract.md`](../decisions/0006-color-blindness-icon-label-contract.md) (no usar `--accent-cool`).

## Dependencias

Compone [`./Popover.md`](./Popover.md) (anchor + flip), [`./Kbd.md`](./Kbd.md) (item kbd), [`./Sheet.md`](./Sheet.md) (mobile fallback opcional). Acepta cualquier `trigger`. Para overflow header → [`./OverflowMenu.md`](./OverflowMenu.md).

## Notas para S12 (implementación)

- Considerar `@radix-ui/react-dropdown-menu` como base headless (provee submenu, type-to-search, ARIA, keyboard).
- Para mobile sheet variant, reutilizar `<Sheet>` y mapear items a un layout vertical más espaciado (padding `--space-3 --space-4`).
- Type-to-search: matching case-insensitive del label, sin diacritics.
- Submenu collision: si no hay espacio a la derecha, abre a la izquierda automáticamente.
- Persistencia de focus en submenu: al cerrar submenu, foco vuelve al item padre, no al trigger principal.
