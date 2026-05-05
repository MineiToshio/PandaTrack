---
id: M03
title: FilterDrawer — revamp completo
date: 2026-05-03
status: cerrado
type: mini-sesión correctiva (Tipo 2)
depends_on: M02
---

# M03 — FilterDrawer: revamp completo

## Qué corrió

Sesión correctiva del componente `<FilterDrawer>` detectando cuatro gaps vs el borrador visual
(`#s6-stores-list-filters-open`):

1. Header icon usaba `--text-secondary` en lugar de `--accent`.
2. Drag handle de mobile (barra pill) siempre oculto — `hidden md:hidden` → corregido a `block md:hidden`.
3. Pills demasiado grandes: `px-3 py-1.5 text-sm` (14px/12px padding) → `py-[5px] px-[10px] [font-size:var(--text-caption)]` (13px/5px–10px).
4. Pills selected con base `transparent` en `color-mix` → se rompe en dark mode; corregido a `var(--surface)`.

Además se agregó el tipo de sección `autocomplete` (solicitado en S6-A: países de tienda e importación), y se migró `StoreListingFilters` de `pills-search` → `autocomplete` para `countryCodes` e `importCountryCodes`.

## Cambios visuales aplicados

| Elemento             | Antes                        | Después                                              |
| -------------------- | ---------------------------- | ---------------------------------------------------- |
| Header icon color    | `--text-secondary`           | `--accent`                                           |
| Mobile drag handle   | siempre oculto               | `block md:hidden`                                    |
| Pill size            | `px-3 py-1.5 text-sm`        | `py-[5px] px-[10px] [font-size:var(--text-caption)]` |
| Pill idle background | `transparent`                | `var(--surface-elevated)`                            |
| Pill selected base   | `color-mix(...,transparent)` | `color-mix(...,var(--surface))`                      |

## Nueva API: `autocomplete` section type

```ts
export type FilterAutocompleteSection = {
  id: string;
  label: string;
  type: "autocomplete";
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  emptyMessage?: string;
};
```

Comportamiento:

- Valores seleccionados aparecen como `<Chip variant="accent">` con botón X de remoción.
- Input de búsqueda filtra las opciones disponibles inline.
- Al hacer clic en un pill de opción, se agrega como chip y desaparece de la lista.
- Si la búsqueda no tiene resultados, muestra `emptyMessage ?? "No matches."`.

## Migración en `StoreListingFilters`

| Sección              | Antes                  | Después                                                                                             |
| -------------------- | ---------------------- | --------------------------------------------------------------------------------------------------- |
| `countryCodes`       | `type: "pills-search"` | `type: "autocomplete"` con `placeholder: tStores("redesign.filter.countrySearchPlaceholder")`       |
| `importCountryCodes` | `type: "pills-search"` | `type: "autocomplete"` con `placeholder: tStores("redesign.filter.importCountrySearchPlaceholder")` |

Claves i18n nuevas en `es` y `en`:

- `redesign.filter.countrySearchPlaceholder`
- `redesign.filter.importCountrySearchPlaceholder`

## Tests escritos

22 tests en `src/components/modules/FilterDrawer/_tests/FilterDrawer.test.tsx`:

- **open/closed state** (2): renders when open, renders nothing when closed.
- **pills section** (5): renderiza opciones, aria-checked inicial, toggle on/off, deselect.
- **switches section** (2): renderiza, llama onChange al toggle.
- **autocomplete section** (7): renderiza input + opciones, add chip + onChange, chips con X, remove X, filtrado por búsqueda, empty message.
- **footer** (3): applyCountLabel con resultsCount, onApply, onClear.
- **a11y** (3): aria-modal + aria-labelledby, Escape → onOpenChange(false), backdrop click → onOpenChange(false), close button → onOpenChange(false).

Todos pasan: 433 total, 12 skipped.

## Auditoría comparativa vs demo HTML (`#s6-stores-list-filters-open`)

| Item                    | Demo HTML                                                      | Implementación                                                            | Estado                                 |
| ----------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------- |
| Header icon color       | `color: var(--accent)`                                         | `[color:var(--accent)]`                                                   | ✅                                     |
| Header icon size        | `18×18px`                                                      | `size={18}`                                                               | ✅                                     |
| Mobile drag handle      | `display:none` / `@media <768px: block`                        | `block md:hidden`                                                         | ✅                                     |
| Drag handle dimensiones | `36×4px, border-radius:999px, background:var(--border-strong)` | `w-9 h-[4px] rounded-full [background:var(--border-strong)]`              | ✅                                     |
| Desktop width           | `min(440px, 92vw)`                                             | `md:w-[440px]`                                                            | ✅                                     |
| Mobile max-height       | `88vh`                                                         | `92svh`                                                                   | ≈ (svh = safe viewport, ligera mejora) |
| Mobile border-radius    | `20px 20px 0 0`                                                | `[border-top-left-radius:20px][border-top-right-radius:20px]`             | ✅                                     |
| Desktop border-radius   | `none`                                                         | `md:[border-top-left-radius:20px][border-bottom-left-radius:20px]`        | ✅ (Velvet refinement)                 |
| Drawer background       | `var(--surface)`                                               | `var(--surface-elevated)`                                                 | ≈ (elevación deliberada)               |
| Header padding          | `16px 22px 14px`                                               | `px-5 py-4` (20/16px)                                                     | ≈                                      |
| Body padding            | `18px 22px`                                                    | `px-5 py-5` (20/20px)                                                     | ≈                                      |
| Footer background       | `var(--surface-elevated)`                                      | `[background:var(--surface-elevated)]`                                    | ✅                                     |
| Section label style     | `11px mono, uppercase, --text-muted, letter-spacing 0.06em`    | `[font-family:var(--font-mono)][font-size:var(--text-eyebrow)] uppercase` | ✅                                     |
| Pill padding            | `5px 10px`                                                     | `py-[5px] px-[10px]`                                                      | ✅                                     |
| Pill border-radius      | `999px`                                                        | `rounded-full`                                                            | ✅                                     |
| Pill idle background    | `var(--surface-elevated)`                                      | `[background:var(--surface-elevated)]`                                    | ✅                                     |
| Pill selected fill      | `solid var(--accent)`                                          | `color-mix tint (Velvet softened)`                                        | ✅ (decisión de diseño documentada)    |
| Autocomplete section    | inline search + pills                                          | chips + search + pills                                                    | ✅ (enhanced)                          |
| Footer buttons          | ghost "Limpiar" + primary "Aplicar"                            | mismos                                                                    | ✅                                     |
| Backdrop blur           | `blur(8px)`                                                    | `[backdrop-filter:blur(8px)]`                                             | ✅                                     |
| Close button            | topbar-iconbtn con X                                           | `<IconButton>` con `aria-label`                                           | ✅                                     |
| aria-modal              | presente                                                       | `aria-modal="true"`                                                       | ✅                                     |
| Escape key              | — (estático)                                                   | implementado                                                              | ✅                                     |
| Focus trap              | — (estático)                                                   | implementado                                                              | ✅                                     |

Desviaciones aceptadas: drawer usa `--surface-elevated` (más elevación que `--surface`); pill selected usa tint en lugar de fill sólido — ambas son decisiones del sistema Velvet, no defectos.

## Validación

| Comando                  | Resultado                                 |
| ------------------------ | ----------------------------------------- |
| `npm run type-check`     | ✅ 0 errores                              |
| `npm run lint`           | ✅ 0 errores (12 warnings pre-existentes) |
| `npm run test`           | ✅ 433 passed, 12 skipped                 |
| `npm run validate-build` | ✅ build limpio, 45+ routes generadas     |

## Working tree state

Sin commits — working tree con cambios según el contrato de la sesión.

Archivos modificados:

- `src/components/modules/FilterDrawer/FilterDrawer.tsx` — rewrite completo
- `src/components/modules/FilterDrawer/_tests/FilterDrawer.test.tsx` — nuevo
- `src/app/[locale]/(app)/stores/_components/StoreListingFilters.tsx` — migración autocomplete
- `src/i18n/locales/es/stores.json` — claves countrySearchPlaceholder / importCountrySearchPlaceholder
- `src/i18n/locales/en/stores.json` — mismas claves en inglés
- `docs/redesign/components/FilterDrawer.md` — spec actualizada
- `docs/redesign/_notes/cross-cutting-changes.md` — M03 → ✅ aplicado

## Risks / next

- El tipo `pills-search` sigue en la unión `FilterSection` para retrocompatibilidad; si no hay uso real se puede eliminar en una limpieza futura.
- El apply button no tiene `flex:1` como en el demo (que lo estira a ancho completo) — pendiente decidir si se quiere ese patrón en la sesión de cierre S6.1.
- Próximos pasos: S5.1 (sidebar color fix), luego S6.1 (listado de tiendas correctivo final).
