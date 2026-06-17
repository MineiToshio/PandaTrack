---
title: FilterTriggerButton
tier: 1
status: implementado
last_updated: 2026-05-09
session: M05-filter-trigger-button
adrs: []
---

# FilterTriggerButton

## Propósito

Botón trigger del `FilterDrawer` con soporte de estado active + badge count. Cuando hay ≥1 filtro del drawer aplicado, el botón cambia de estado neutro a fondo tinted accent + badge inline con el número de filtros activos. Diseñado para uso cross-módulo en listados con `FilterDrawer` (Stores, Orders, Deliveries).

## API TypeScript

```ts
interface FilterTriggerButtonProps {
  /** Cantidad de filtros del drawer actualmente aplicados. Excluye el search query. */
  appliedCount: number;
  onClick: () => void;
  /**
   * "label"     — botón ghost completo con texto + badge inline. Default.
   * "icon-only" — botón ícono compacto para topbar mobile; requiere aria-label.
   */
  variant?: "label" | "icon-only";
  /** Label traducida. Default "Filtrar". */
  label?: string;
  /** Obligatorio cuando variant="icon-only". */
  "aria-label"?: string;
  disabled?: boolean;
  className?: string;
}
```

## Variantes

| Variant     | Cuándo usar                                               | Tap target |
| ----------- | --------------------------------------------------------- | ---------- |
| `label`     | Toolbar desktop + mobile in-toolbar. Default.             | ≥44px      |
| `icon-only` | Topbar del shell en mobile cuando el espacio es limitado. | 44×44px    |

## Estado neutral (appliedCount = 0)

- **label:** `Button variant="ghost" size="md"` estándar. Sin badge. Sin inline style override.
- **icon-only:** botón con solo el ícono `<SlidersHorizontal>`. Sin badge. Sin tint.

## Estado active (appliedCount ≥ 1)

- **Fondo:** `color-mix(in oklch, var(--accent) 10%, transparent)`
- **Color texto/ícono:** `var(--accent)`
- **Border:** `color-mix(in oklch, var(--accent) 28%, transparent)`
- **Badge label:** número inline al final del label. `background: var(--accent)`, `color: var(--text-on-accent)`, `border-radius: 999px`, `font-size: 10px`, `font-weight: 700`.
- **Badge icon-only:** número absoluto en esquina superior derecha. `min-w: 14px`, `font-size: 9px`. Si count > 9 muestra "9+".

Implementación: los 3 valores del estado active se aplican como inline `style` sobre el `<Button ghost>` (inline style gana sobre clases CVA — mismo patrón del demo HTML). No hay conflicto con el hover overlay que usa `::after`.

## Light / Dark

- Los tokens `--accent`, `--text-on-accent`, `--border-strong` y la fórmula `color-mix` funcionan en ambos modos sin cambios.
- Verificar que el botón pintado contraste visualmente sobre `--background` en dark (L013: `--surface-elevated` da Δ6% perceptible; el tint 10% de accent tiene Δ similar). Pasar en ambos modos.

## Mobile vs Desktop

| Contexto           | Variant     | Notas                                                     |
| ------------------ | ----------- | --------------------------------------------------------- |
| In-toolbar (S6)    | `label`     | Mismo botón en mobile y desktop. Texto visible siempre.   |
| Topbar shell (S7+) | `icon-only` | Ícono en topbar; texto label en toolbar oculto en mobile. |

## Accesibilidad

- `label` variant: el texto del botón es el accessible name. El badge tiene `aria-hidden="true"` (decorativo). Los filter chips arriba del listado transmiten la información de "filtros activos" a screen readers.
- `icon-only` variant: el `aria-label` (prop obligatoria) es el accessible name. El badge tiene `aria-hidden="true"`.
- Tap target: `min-h-11` en mobile (≥44px), `w-11` en icon-only (44px). Cumple ADR 0001 tap target.
- Focus visible: `outline` con `--focus-ring` en ambas variantes.

## Motion

Sin animaciones propias. La transición `background-color` / `color` se hace via las clases de transición base del `Button ghost` CVA (fast duration, ease-emphasis). `prefers-reduced-motion` heredado del Button.

## Copy + i18n

El componente NO gestiona i18n internamente. El consumidor pasa el `label` ya traducido y el `aria-label` para icon-only.

| Prop         | Responsabilidad  | Ejemplo ES          |
| ------------ | ---------------- | ------------------- |
| `label`      | Consumidor (t()) | `"Filtrar"`         |
| `aria-label` | Consumidor (t()) | `"Filtrar pedidos"` |

El badge count es un número — no requiere traducción.

## Edge cases

- `appliedCount = 0`: estado neutro, sin badge.
- `appliedCount > 9`: badge muestra "9+" para mantener compacidad.
- `disabled=true`: pointer-events none, color muted. La inline style de active se aplica también (aceptable — no hay estado disabled+active en la práctica).

## Anti-patrones

- ❌ Pasar el count incluyendo el search query. El search tiene su propio feedback visual en el input.
- ❌ Usar `Button ghost` directo con className override para el estado active. Usar este componente.
- ❌ Contar opciones granulares dentro de un grupo de filtros. 1 chip = 1 unidad independientemente de cuántas opciones tenga.
- ❌ Crear icon-only sin `aria-label`. TypeScript no lo enforza hoy; validar en code review.

## Ejemplos

```tsx
// Stores listing — label variant
<FilterTriggerButton
  appliedCount={drawerAppliedCount}
  onClick={() => setDrawerOpen(true)}
  label={tListing("s6.toolbar.filter")}
/>

// Orders — icon-only para topbar mobile
<FilterTriggerButton
  variant="icon-only"
  appliedCount={drawerAppliedCount}
  onClick={() => setDrawerOpen(true)}
  aria-label={t("toolbar.filterIconLabel")}
/>
```

`drawerAppliedCount` = suma de longitudes de arrays de filtros del drawer (product types, countries, presence, flags, etc.) — sin incluir el query string.

## Tokens usados

| Token                              | Uso                                          |
| ---------------------------------- | -------------------------------------------- |
| `--accent`                         | Color texto, badge background, border active |
| `--text-on-accent`                 | Color texto del badge                        |
| `--border-strong`                  | Border neutral (heredado de Button ghost)    |
| `--radius-md`                      | Border-radius del botón                      |
| `--focus-ring`                     | Outline de focus                             |
| `--text-primary`                   | Color ícono/texto neutral (heredado)         |
| `--text-muted`                     | Color disabled (heredado)                    |
| `--motion-fast`, `--ease-emphasis` | Transición de color (heredado de Button)     |
| `color-mix(... var(--accent) 10%)` | Fondo active tinted                          |
| `color-mix(... var(--accent) 28%)` | Border active tinted                         |

## ADRs relacionados

- ADR 0001 D3: disabled sin opacity — respetado (colores muted en lugar de opacity).
- ADR 0003 D7: FilterDrawer unificado cross-app — este botón es el trigger canónico.

## Dependencias

- `src/components/core/Button/Button.tsx` (label variant)
- `lucide-react` — `SlidersHorizontal`
- `src/lib/styles` — `cn()`

## Notas S12

- Evaluar enforcement TypeScript de `aria-label` obligatorio cuando `variant="icon-only"` (hoy es `?: string`).
- Si se agrega un tercer variant o se cambia la fórmula del count, actualizar este spec y el PLAYBOOK §3.
