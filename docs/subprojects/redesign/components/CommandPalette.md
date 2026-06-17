---
title: CommandPalette
tier: 3
status: spec — no implementado (mounting opt-in S6+)
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0001 (assumption ⌘K aspiracional, ver `_notes/assumptions-s2.md`)
---

# CommandPalette

## Propósito

Paleta de comandos `⌘K` (Mac) / `Ctrl+K` (Win/Linux) — modal centered con search input + grupos de comandos. Aspiracional según assumptions S2; **el spec se cierra en S4 pero el mounting real es opt-in S6+** (no se monta en MVP). Permite saltar a cualquier pantalla, ejecutar acciones globales (Crear pedido, Cambiar tema, Cerrar sesión), buscar pedidos/tiendas/entregas por código, y servir como atajo "power user" del decálogo §10.

## API TypeScript

```ts
import type { ReactNode } from "react";

type CommandItem = {
  /** ID estable para histórico de uso reciente. */
  id: string;
  label: string;
  /** Texto secundario opcional (ej. "Hoy · Pedidos · Crear"). */
  description?: string;
  /** Lucide icon. */
  icon?: ReactNode;
  /** Atajo de teclado mostrado a la derecha. */
  kbd?: string | string[];
  /** Keywords adicionales para fuzzy match (no visibles). */
  keywords?: string[];
  /** Ejecutado al seleccionar — el componente cierra automáticamente después. */
  onSelect: () => void;
};

type CommandGroup = {
  label: string; // heading del grupo, ej. "Crear", "Navegar"
  items: CommandItem[];
};

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Recientes — el componente los muestra cuando query está vacía. */
  recentItems?: CommandItem[];
  /** Groups por contexto — Crear / Navegar / Ajustes / Buscar. */
  groups: CommandGroup[];
  /** Placeholder del search input. Default voice glossary. */
  placeholder?: string;
  /** Atajo global que abre la palette. Default `⌘K`. */
  shortcut?: { mac: string; pc: string };
};
```

## Variants / Sizes

CommandPalette tiene un solo render — modal centered. Sin variants. Tamaño:

| Slot         | Tamaño                                                                        |
| ------------ | ----------------------------------------------------------------------------- |
| Container    | `width: min(--modal-max-w, 100vw - 2 * var(--space-4))`. `max-height: 60svh`. |
| Search input | Full width header. Height ~56px.                                              |
| Results body | scroll vertical interno. `max-height: calc(60svh - 56px)`.                    |

Mobile: ocupa casi todo el viewport (centered). En `< --breakpoint-md`, top sheet alternativa (slide desde arriba) — pero MVP usa el mismo modal centered con padding más reducido.

## Estados visuales

| Estado                          | Receta CSS (light + dark)                                                                                                                                                                                                                                            | Notas                                                                                                                                                             |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `closed`                        | No render.                                                                                                                                                                                                                                                           | Atajo `⌘K`/`Ctrl+K` global (registrado en S6+ como hook `useCommandPaletteShortcut`).                                                                             |
| `open backdrop`                 | `position: fixed; inset: 0; background: var(--surface-overlay); z-index: var(--z-modal-backdrop);`                                                                                                                                                                   | Backdrop scrim. Click cierra.                                                                                                                                     |
| `open container`                | `background: var(--surface-elevated); border-radius: var(--radius-xl); box-shadow: var(--elevation-4); width: var(--modal-max-w); max-width: calc(100vw - 2 * var(--space-4)); max-height: 60svh; z-index: var(--z-command); display: flex; flex-direction: column;` | Compone [`./Modal.md`](./Modal.md) bajo el capó pero z-index `--z-command` (100) > `--z-modal` (80) — la palette puede coexistir con un modal abierto.            |
| `search input`                  | `<Input variant="search">` autofocus con leading icon Lucide `command` (Mac) o `search`. Placeholder voice glossary.                                                                                                                                                 | Border-bottom `1px solid var(--border)` separa input de results.                                                                                                  |
| `results body`                  | `padding: var(--space-1); overflow-y: auto;`                                                                                                                                                                                                                         | Scrollbar nativo o estilizado.                                                                                                                                    |
| `group heading`                 | `.eyebrow` utility (`--text-eyebrow` `--text-muted` `letter-spacing: 0.08em` uppercase mono); padding `--space-2 --space-3`.                                                                                                                                         | Ej. "RECIENTES", "CREAR", "NAVEGAR", "AJUSTES".                                                                                                                   |
| `item idle`                     | `display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); color: var(--text-primary); font-size: var(--text-body); cursor: pointer;`                                                        | Lucide icon leading 18×18. `<Kbd>` alineado a la derecha (margin-inline-start: auto).                                                                             |
| `item active` (keyboard cursor) | `background-color: color-mix(in oklch, var(--accent) var(--state-selected-bg-mix), var(--surface-elevated));` (ya soft).                                                                                                                                             | El "cursor" se mueve con `ArrowUp`/`ArrowDown`. Hover NO se resalta diferente — solo el item activo via keyboard tiene este estado (alineado con Linear/Raycast). |
| `item description`              | `font-size: var(--text-caption); color: var(--text-secondary); margin-top: var(--space-0_5);`                                                                                                                                                                        | Texto secundario tipo "Hoy · Crear · Atajo".                                                                                                                      |
| `empty state`                   | Padding `--space-8 --space-4` centrado. Lucide `search-x` 32×32 `--text-muted`. Texto "Nada con eso. Probá otro término." en `--text-body` `--text-muted`.                                                                                                           | Voice glossary.                                                                                                                                                   |
| `loading` (async search S6+)    | Skeleton de 3 items. `loader-2` Lucide en search input trailing.                                                                                                                                                                                                     | MVP es client-only filter, sin loading. S6+ podría agregar fetch para buscar pedidos por código mono.                                                             |

## Mobile vs desktop

- **Desktop** (`≥ --breakpoint-md`): atajo `⌘K`/`Ctrl+K` registra global. Modal centered con `width: var(--modal-max-w)` (512). Cursor keyboard prominente.
- **Mobile** (`< --breakpoint-md`): atajo de teclado físico inexistente — la entrada típica es por search button del header (no canónico en MVP) o por gesto. El componente sigue funcionando pero `<Kbd>` se oculta en mobile (display: none).

## Accesibilidad

- Container: `role="dialog"` + `aria-modal="true"` + `aria-label="Paleta de comandos"`.
- Search input: `role="combobox"` + `aria-expanded={hasResults}` + `aria-controls={listboxId}` + `aria-activedescendant={activeItemId}`.
- Results body: `role="listbox"` + `id={listboxId}`.
- Items: `role="option"` + `aria-selected={isActive}` + `id={itemId}`.
- Group heading: `<div role="presentation">` con texto eyebrow (no `<h>` semántico — preferimos listbox flat con headings visuales).
- Keyboard:
  - `Esc`: cierra.
  - `ArrowDown`/`ArrowUp`: mueve cursor entre items (saltea headings y separadores).
  - `Home`/`End`: primer/último item.
  - `Enter`: ejecuta item activo.
  - `Tab`: cierra (no atrapa foco — palette debe sentirse efímera).
  - `⌘K`/`Ctrl+K`: toggle (abre o cierra).
- Focus al abrir: search input.
- Focus al cerrar: vuelve al elemento que tenía foco antes de abrir (si todavía existe en DOM).
- `prefers-reduced-motion`: enter sin scale (solo opacity), exit igual.

## Motion

- Backdrop enter: opacity 0→1 con `--motion-fast` `--ease-emphasis`.
- Container enter: opacity 0→1 + scale 0.96→1 con `--motion-base` `--ease-out-expressive`.
- Item active state: bg transition `--motion-fast` `--ease-emphasis` (cursor follow rápido).
- Exit: opacity 1→0 con `--motion-fast`. Sin scale.
- `prefers-reduced-motion`: enter/exit opacity-only.

## Copy default + i18n

| Clave i18n sugerida                                 | Valor ES (voice glossary aplicado) |
| --------------------------------------------------- | ---------------------------------- |
| `components.commandPalette.placeholder`             | "¿Qué querés hacer?"               |
| `components.commandPalette.empty.title`             | "Nada con eso."                    |
| `components.commandPalette.empty.description`       | "Probá otro término."              |
| `components.commandPalette.groupRecent`             | "RECIENTES"                        |
| `components.commandPalette.groupCreate`             | "CREAR"                            |
| `components.commandPalette.groupNavigate`           | "NAVEGAR"                          |
| `components.commandPalette.groupSettings`           | "AJUSTES"                          |
| `components.commandPalette.commonItems.newOrder`    | "Nuevo pedido"                     |
| `components.commandPalette.commonItems.newDelivery` | "Nueva entrega"                    |
| `components.commandPalette.commonItems.toggleTheme` | "Cambiar tema"                     |
| `components.commandPalette.commonItems.signOut`     | "Cerrar sesión"                    |
| `components.commandPalette.shortcutHint`            | "Atajo {kbd}"                      |
| `components.commandPalette.openHint`                | "Abrí esta paleta con {kbd}"       |

## Edge cases

1. **Sin recientes ni groups poblados**: muestra solo el grupo `groups` provisto. Si está vacío, render empty state con CTA "Empezá escribiendo".
2. **Item con onSelect que abre modal/drawer**: la palette se cierra primero, luego el callback ejecuta. Implementar `await flush()` antes del callback para evitar focus race.
3. **Async search (S6+)**: si el padre provee `onQueryChange`, el componente debe debouncear (250ms) antes de invocar. MVP es client-only filter (case-insensitive sobre `label` + `description` + `keywords`).
4. **Atajo registra global con conflicto**: si la app ya usa `⌘K` para algo, el componente expone prop `shortcut` para customizar. Default seguro.
5. **Scroll de results muy largo**: el listbox tiene `max-height` y scroll vertical interno. Cursor follow (`scrollIntoView({ block: 'nearest' })`) al navegar con flechas.
6. **Item destructive en palette**: NO se incluyen acciones destructive (`Eliminar pedido`) en la palette. Las acciones destructive viven en overflow del header del recurso (ADR 0001 D6) — palette es para acciones constructivas + navegación.
7. **Múltiples palettes abiertas** (no permitido): el atajo toggle previene apertura duplicada.

## Anti-patrones

1. **Nunca acciones destructive irreversibles** en la palette (ADR 0001 D6 — esas viven en overflow del header, con confirm modal).
2. **Nunca >7 grupos** — si tenés más, reorganizá. Recomendado: Recientes + 3-4 groups (Crear, Navegar, Ajustes, Buscar).
3. **Nunca palette modal-blocking** — debe sentirse efímera (Esc cierra inmediato; Tab cierra; click outside cierra).
4. **Nunca usar palette como replacement de search principal** — es atajo power user, no único acceso.
5. **Nunca ejecutar item que requiera input adicional** sin abrir modal de continuación. Item simple = ejecuta y cierra.
6. **Nunca renderizar palette en MVP** — el componente está specced pero el mount real es S6+.

## Ejemplos de uso

```tsx
// Mounting opt-in en S6+ (no MVP)
<CommandPalette
  open={open}
  onOpenChange={setOpen}
  recentItems={recents}
  groups={[
    {
      label: "CREAR",
      items: [
        {
          id: "new-order",
          label: "Nuevo pedido",
          icon: <Plus />,
          kbd: "N",
          onSelect: () => router.push("/orders/new"),
        },
        { id: "new-delivery", label: "Nueva entrega", icon: <Truck />, onSelect: () => router.push("/deliveries/new") },
      ],
    },
    {
      label: "NAVEGAR",
      items: [
        { id: "nav-dashboard", label: "Hoy", icon: <Home />, kbd: ["G", "H"], onSelect: () => router.push("/") },
        {
          id: "nav-orders",
          label: "Pedidos",
          icon: <Package />,
          kbd: ["G", "P"],
          onSelect: () => router.push("/orders"),
        },
      ],
    },
    {
      label: "AJUSTES",
      items: [
        { id: "toggle-theme", label: "Cambiar tema", icon: <Moon />, kbd: "T", onSelect: toggleTheme },
        { id: "sign-out", label: "Cerrar sesión", icon: <LogOut />, onSelect: signOut },
      ],
    },
  ]}
/>
```

## Tokens consumidos

`--surface-elevated`, `--surface-overlay`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent`, `--border`, `--font-weight-regular`, `--text-body`, `--text-caption`, `--text-eyebrow`, `--font-mono`, `--space-0_5`, `--space-1`, `--space-2`, `--space-3`, `--space-4`, `--space-8`, `--radius-md`, `--radius-xl`, `--elevation-4`, `--z-modal-backdrop`, `--z-command`, `--motion-fast`, `--motion-base`, `--ease-emphasis`, `--ease-out-expressive`, `--state-selected-bg-mix`, `--modal-max-w`.

## ADRs aplicables

- [`../decisions/0001-s2-closure-decisions.md`](../decisions/0001-s2-closure-decisions.md) D6 (palette no aloja acciones destructive).
- Assumption en `_notes/assumptions-s2.md` (⌘K aspiracional).

## Dependencias

Compone [`./Modal.md`](./Modal.md) (backdrop + container), [`./Input.md`](./Input.md) variant `search`, [`./Kbd.md`](./Kbd.md) (item kbd). Reusa `<EmptyState>` para estado sin resultados.

## Notas para S12 (implementación)

- **Mounting opt-in S6+**: NO mountar en MVP. Cuando se mount, registrar atajo global con `useEffect` + `keydown` listener en `window` (con cleanup). Usar `useHotkeys` de `react-hotkeys-hook` o equivalente.
- Considerar `cmdk` (`pacocoursey/cmdk`) como base — provee fuzzy matching + keyboard nav + ARIA. Estilo via tokens.
- Fuzzy matching: client-only sobre `label + description + keywords` con score weighting (label match > description match > keyword match).
- Async search S6+: si se agrega, debounce 250ms + cancel previous request + skeleton mientras carga.
- Histórico de uso (recientes): persistir en `localStorage["pandatrack-command-recent"]` los últimos 5 IDs ejecutados, sorteado por timestamp desc.
- Detección de plataforma para mostrar `⌘` vs `Ctrl`: `navigator.platform.includes('Mac')` o `navigator.userAgentData.platform === 'macOS'` con fallback. Implementar en S12 con fallback graceful.
- Considerar también atajo `?` para mostrar help (lista de atajos) — no MVP.
