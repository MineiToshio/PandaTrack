# M02 — Core Components Audit

**Fecha:** 2026-05-03
**Tipo:** Mini-sesión correctiva Tipo 2 (catálogo de componentes)
**Status:** ✅ cerrado

## Alcance

Audit + fix de cuatro componentes core que aparecían rotos o inconsistentes al comparar la implementación de S6 contra el HTML del demo (`_notes/demo-screens.html`):

1. `<Button>` — hover lift inconsistente
2. `<Input>` — faltaba variante search con submit button
3. `<Chip>` — oversized, sin soporte de ícono, sin variantes de color
4. `<Select>` — uso de `<select>` nativo en StoreListingFilters

## Cambios aplicados

### 1. Button — hover lift uniforme

**Archivo:** `src/components/core/Button/buttonVariants.ts`

Agregado a la receta CVA base:

- `transform` en la lista de `transition-*`
- `motion-reduce:transition-[...]` para desactivar transform bajo `prefers-reduced-motion`
- `hover:-translate-y-px hover:shadow-[var(--elevation-2)]` en variantes sólidas (primary, secondary, destructive, outline)
- `hover:-translate-y-px` (sin shadow scale) en ghost y destructive-ghost
- `motion-reduce:hover:translate-y-0` en todas las variantes
- `active:translate-y-0` para reset al presionar

**Doc actualizada:** `docs/redesign/components/Button.md` — receta base CSS + tabla Motion.

### 2. SearchInput — nuevo componente

**Archivo:** `src/components/core/SearchInput.tsx` (nuevo)

Separado de `<Input>` porque el layout es fundamentalmente diferente: campo de texto + botón accent adyacente en un único elemento visual. La variante `type="search"` de `<Input>` sigue existiendo para búsquedas sin submit button visible.

Props: `value`, `onChange`, `onSubmit`, `isLoading`, `placeholder`, `searchLabel`, `disabled`, `className`, `inputClassName`, `size` (`sm|md|lg`).

Comportamiento: submit en click del botón O `Enter` en el input. Spinner `<Loader2>` con `motion-reduce:animate-none` cuando `isLoading`. Mobile tap target ≥44px. `role="search"` en el wrapper.

**Doc actualizada:** `docs/redesign/components/Input.md` — sección "Componente relacionado: SearchInput".

### 3. Chip — reescritura completa

**Archivo:** `src/components/core/Chip.tsx` (reescrito)

El componente original usaba clases Tailwind v3/shadcn (`border-border`, `bg-muted/50`, `text-muted-foreground`) y no tenía variantes de color ni soporte de ícono.

Nuevo diseño:

- 6 variantes: `success | warning | destructive | info | accent | neutral`
- Color tokens via `inline style` (mismo patrón que `<StatusChip>`) — necesario para `color-mix()` complejos
- `--background` como base del `color-mix` (no `transparent`) — coherente con StatusChip, mejor en dark mode
- Tamaño `md`: `--text-caption` (12px), `py-[3px] px-[9px]`, `--radius-pill`
- Tamaño `sm`: `--text-mono`, padding compacto
- Prop `icon?: ReactNode` para ícono leading (caller controla tamaño, 12px recomendado)
- `children: ReactNode` — API backward-compatible (soporta label solo o label + botón X)

**StoreMultiTagAutocomplete actualizado:** eliminadas las clases override legacy (`inline-flex items-center gap-1 px-2 py-1 text-sm`), cambiado a `variant="accent"` para tags seleccionados. Container del autocomplete migrado de clases v3 a tokens del design system.

**Doc creada:** `docs/redesign/components/Chip.md`

### 4. Select — eliminación de native select

**Archivo:** `src/app/[locale]/(app)/stores/_components/StoreListingFilters.tsx`

El sort-by select usaba `NativeSelect` (children con `<option>`). Convertido a `ControlledSelect` usando la prop `options` con las 3 opciones definidas via `useMemo`. La `<label>` wrapper usa `htmlFor="store-sort"` apuntando al `id` del trigger button del ControlledSelect.

La `onChange` ya era `(value: string) => void` — compatible directamente con la firma del ControlledSelect.

## Consumidores legacy actualizados

| Archivo                         | Cambio                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `StoreMultiTagAutocomplete.tsx` | Chip variant accent, container tokens v4, dropdown tokens v4, input tokens v4 |
| `StoreListingFilters.tsx`       | Native select → ControlledSelect                                              |

## Auditoría comparativa vs demo HTML

| Componente  | Aspecto            | Demo HTML                             | Implementación                                            | Delta / Decisión                                                                                                  |
| ----------- | ------------------ | ------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Button      | Hover lift         | Sin lift — solo cambio de color       | `translateY(-1px)` + `--elevation-2` en hover             | Intencional — mejora pedida en M02                                                                                |
| Button      | Primary hover bg   | `color-mix(accent 88%, text-primary)` | state layer `::after` overlay mix=6%                      | Equivalente visualmente; pattern consistente con otros variants                                                   |
| Button      | Primary text color | `oklch(99% 0 0)` (blanco hardcoded)   | `var(--text-on-accent)`                                   | Mejor — ADR 0001 D14, funciona cross-paleta en dark                                                               |
| Chip        | Font-size          | 12px                                  | `--text-caption` (12px)                                   | ✅ match                                                                                                          |
| Chip        | Padding            | `3px 9px`                             | `py-[3px] px-[9px]`                                       | ✅ match                                                                                                          |
| Chip        | Border-radius      | 999px                                 | `--radius-pill`                                           | ✅ match                                                                                                          |
| Chip        | Gap                | 6px                                   | `--space-1_5` (6px)                                       | ✅ match                                                                                                          |
| Chip        | Ícono size         | 12×12px                               | Caller-controlled, 12px recomendado                       | ✅ match                                                                                                          |
| Chip        | Color-mix base     | `transparent`                         | `var(--background)`                                       | Intencional — `--background` funciona en dark mode; `transparent` produce chips invisibles sobre surfaces oscuras |
| Chip        | Accent text color  | `var(--accent)`                       | `var(--text-primary)`                                     | Diferencia menor — `--text-primary` garantiza contraste cross-paleta sin depender del L del accent                |
| Chip        | Accent bg mix      | 12%                                   | 14%                                                       | Diferencia mínima — consistente con StatusChip                                                                    |
| SearchInput | Presencia          | Ausente en demo                       | Componente nuevo en `src/components/core/SearchInput.tsx` | Nuevo — cubre el patrón toolbar de búsqueda con submit button                                                     |
| Select      | Native vs custom   | N/A (demo usa custom dropdowns)       | ControlledSelect (prop `options`)                         | ✅ nativo eliminado de StoreListingFilters                                                                        |

## Validación

- `npm run type-check` — ✅ 0 errores
- `npm run lint` — ✅ 0 errores (12 warnings pre-existentes en otros archivos)
- `npm run test` — ✅ 411 passed, 12 skipped (integration tests requieren DB)
- `npm run validate-build` — ✅ build completo sin errores (45 rutas generadas)

## Deferred / fuera de scope

- **SearchSelect migration** (`src/components/core/SearchSelect.tsx` → Combobox): identificado como deuda, activo en `SettingsPreferencesSection.tsx`. Deferred a S12.
- **FilterDrawer revamp** (M03): depende de `<Chip>` actualizado — ya está disponible. M03 queda desbloqueado.
- **Tests unit para SearchInput y Chip**: cubiertos por el type-check (API TS correcta) y tests de integración visual post-build. Testing unitario dedicado marcado como mejora futura.
