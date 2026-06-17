---
title: OverflowMenu
tier: 3
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0001 D6 (acciones irreversibles destructivas viven en overflow [···] del header de detalle)
  - ADR 0001 D4 (toast neutral-undo 8s para delete de pedido entero)
---

# OverflowMenu

## Propósito

Variant pre-configurada de [`./DropdownMenu.md`](./DropdownMenu.md) para el caso canónico del **overflow `[···]` del content header** en pantallas de detalle (ADR 0001 D6). Aloja acciones secundarias y, exclusivamente, **acciones irreversibles destructivas** (`Eliminar pedido`, `Eliminar entrega`, `Eliminar tienda`). Las reversibles (Editar, Cancelar pedido, Reactivar) viven en el slot `Acciones` del [`./DetailSidebar.md`](./DetailSidebar.md), no aquí. Esta separación por reversibilidad es vinculante (ADR 0001 D6).

## API TypeScript

```ts
import type { ReactNode } from "react";

type OverflowMenuItem =
  | {
      type: "item";
      label: string;
      icon?: ReactNode;
      onSelect: () => void;
      variant?: "default" | "destructive";
      kbd?: string | string[];
      disabled?: boolean;
    }
  | { type: "separator" }
  | { type: "heading"; label: string };

type OverflowMenuProps = {
  /** Items del menú. Se recomienda separator antes de cada destructive. */
  items: OverflowMenuItem[];
  /** Aria-label del trigger. Default "Más opciones". */
  triggerLabel?: string;
  /** Placement preferido. Default `bottom-end` (alineado a la derecha del trigger). */
  placement?: "bottom-end" | "bottom-start" | "top-end" | "top-start";
};
```

El trigger es **fijo**: `<IconButton>` con Lucide `more-horizontal` (mobile) / `more-vertical` (desktop) — el componente decide cuál renderizar según breakpoint. No es configurable, para mantener consistencia visual cross-pantallas de detalle.

## Variants / Sizes

OverflowMenu no expone variants — es la composición canónica de DropdownMenu para overflow. Internamente usa el shape `MenuItem` de DropdownMenu (subset). Lo único que difiere es:

- Trigger forzado a IconButton con `more-horizontal`/`more-vertical`.
- Placement default `bottom-end`.
- En mobile, mobileVariant default `sheet` (acciones mobile suelen necesitar tap targets más grandes — convención del overflow del header de detalle).

## Estados visuales

Hereda todos los estados de [`./DropdownMenu.md`](./DropdownMenu.md). Refuerza:

| Estado                          | Receta CSS                                                                                                                        | Notas                                                                                                                                |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `trigger idle`                  | `<IconButton variant="ghost" size="md" icon={<MoreHorizontal />} label="Más opciones">` mobile / `<MoreVertical />` desktop.      | Tap target ≥44×44 mobile.                                                                                                            |
| `trigger active` (menu open)    | hereda IconButton state-layer + foco visible. `aria-expanded="true"`.                                                             |                                                                                                                                      |
| `item destructive irreversible` | `color: var(--destructive-chip-text)` (light) / `var(--destructive)` (dark). Hover bg `color-mix(--destructive 8%, transparent)`. | Después de seleccionar, el consumidor abre confirm modal + dispara toast neutral-undo 8s (ADR 0001 D4) para delete de pedido entero. |

## Mobile vs desktop

- **Desktop** (`≥ --breakpoint-md`): trigger `more-vertical` (alineado al patrón de menús contextuales). Popover anchor bottom-end.
- **Mobile** (`< --breakpoint-md`): trigger `more-horizontal`. Click abre `<Sheet>` con drag handle, no popover. Tap targets ≥44×44 (cada item con padding `--space-3 --space-4`). Sheet auto-altura por contenido.

## Accesibilidad

- Trigger IconButton ya provee `aria-label="Más opciones"` (i18n `components.overflowMenu.triggerLabel`).
- Menu hereda toda la accesibilidad de DropdownMenu (`role="menu"`, keyboard navigation, focus management, click-outside).
- Item destructive: el componente añade `aria-describedby` apuntando a un `<span class="sr-only">` con texto "Acción destructiva. Necesitarás confirmar." si el consumer no override.
- `prefers-reduced-motion`: heredado de DropdownMenu / Sheet.

## Motion

Heredada de DropdownMenu (popover desktop) y Sheet (mobile). `--motion-fast` enter/exit popover; `--motion-base` slide vertical sheet.

## Copy default + i18n

| Clave i18n sugerida                                  | Valor ES (voice glossary aplicado)           |
| ---------------------------------------------------- | -------------------------------------------- |
| `components.overflowMenu.triggerLabel`               | "Más opciones"                               |
| `components.overflowMenu.commonItems.deleteOrder`    | "Eliminar pedido"                            |
| `components.overflowMenu.commonItems.deleteDelivery` | "Eliminar entrega"                           |
| `components.overflowMenu.commonItems.deleteStore`    | "Eliminar tienda"                            |
| `components.overflowMenu.commonItems.duplicate`      | "Duplicar"                                   |
| `components.overflowMenu.commonItems.export`         | "Exportar"                                   |
| `components.overflowMenu.commonItems.copyId`         | "Copiar ID"                                  |
| `components.overflowMenu.destructiveSrHint`          | "Acción destructiva. Vas a confirmar antes." |

## Edge cases

1. **Sin acciones destructive**: el componente sigue funcionando — el overflow puede contener solo "Duplicar", "Exportar", "Copiar ID". No es obligatorio incluir destructive.
2. **Solo una acción destructive**: el separator antes del destructive sigue siendo recomendable visualmente (separar lo "regular" de lo "peligroso").
3. **Múltiples destructive** (raro): el orden los respeta tal como el padre los provee. Recomendación: la más destructiva al final.
4. **Mobile sin trigger visible**: si el header padre oculta el overflow trigger en mobile (rara), las acciones destructive se exponen via long-press en el header — pero **esto NO es responsabilidad de OverflowMenu**. El consumidor diseña esa solución alternativa.
5. **Click outside con confirm modal abierto**: si el delete dispara confirm modal, el overflow ya cerró antes — el modal vive arriba de OverflowMenu en z-index. Esc del modal solo cierra el modal, no reabre el overflow.
6. **Capability flag**: si la acción `Eliminar pedido` requiere capability backend, el padre setea `disabled: true` o no incluye el item. OverflowMenu no consulta capabilities por sí mismo.

## Anti-patrones

1. **Nunca poner acciones primarias** en overflow (ej. "Crear entrega" pertenece al sidebar, no al `[···]` del header).
2. **Nunca poner acciones reversibles** (ej. "Editar" pertenece a sidebar slot Acciones, no al overflow). ADR 0001 D6.
3. **Nunca confirmar inline** dentro del menú — el destructive item DISPARA confirm modal/sheet (responsabilidad del consumidor).
4. **Nunca usar `more-horizontal` mobile y `more-vertical` desktop a la inversa** — la convención mobile = horizontal (más natural de tap), desktop = vertical (alineado al patrón Linear/Notion).
5. **Nunca tooltip permanente** sobre el trigger — el `aria-label` cubre accesibilidad, el tooltip visible añade ruido.

## Ejemplos de uso

```tsx
// Header de /orders/[id] (ADR 0001 D6)
<OverflowMenu
  items={[
    { type: "item", label: "Duplicar", icon: <Copy />, onSelect: handleDuplicate },
    { type: "item", label: "Copiar ID", icon: <Hash />, kbd: ["⌘", "C"], onSelect: handleCopyId },
    { type: "separator" },
    {
      type: "item",
      label: "Eliminar pedido",
      icon: <Trash2 />,
      variant: "destructive",
      onSelect: () => openDeleteConfirmModal(order.id),
    },
  ]}
/>

// Header de /stores/[slug] con capability check
<OverflowMenu
  items={[
    { type: "item", label: "Reportar tienda", icon: <Flag />, onSelect: handleReport },
    { type: "separator" },
    {
      type: "item",
      label: "Eliminar tienda",
      icon: <Trash2 />,
      variant: "destructive",
      disabled: !canDelete, // capability flag
      onSelect: () => openDeleteConfirmModal(store.slug),
    },
  ]}
/>
```

## Tokens consumidos

Heredados de [`./DropdownMenu.md`](./DropdownMenu.md) y [`./IconButton.md`](./IconButton.md). Sumar: `--destructive`, `--destructive-chip-text`.

## ADRs aplicables

- [`../decisions/0001-s2-closure-decisions.md`](../decisions/0001-s2-closure-decisions.md) D6 (acciones irreversibles en overflow), D4 (toast neutral-undo 8s para delete de pedido).
- [`../decisions/0006-color-blindness-icon-label-contract.md`](../decisions/0006-color-blindness-icon-label-contract.md).

## Dependencias

Compone [`./DropdownMenu.md`](./DropdownMenu.md) (interno), [`./IconButton.md`](./IconButton.md) (trigger). Coordina con [`./Toast.md`](./Toast.md) variant `neutral-undo` para los deletes (8s para delete de pedido entero — ADR 0001 D4) — la coordinación la hace el consumidor, no este componente.

## Notas para S12 (implementación)

- Internamente, OverflowMenu es un wrapper de DropdownMenu con trigger fijo + placement default. Implementar como sugar function que llama a DropdownMenu con la configuración predefinida.
- En mobile, abrir como Sheet en lugar de Popover (mobileVariant override). Sheet con drag handle.
- El delete dispara consistentemente: `(1) confirm modal con copy "¿Borrar este pedido? Sus pagos también se van."` → `(2) optimistic local apply` → `(3) server action` → `(4) toast neutral-undo 8s con copy "Borrado"` → `(5) si user clica Deshacer (o Z), revert local + dispatch undo server action`. Documentar este flow en `Form.md` y `Toast.md`.
- Verificar que el trigger `<IconButton>` extiende tap target a 44×44 mobile (regla heredada).
