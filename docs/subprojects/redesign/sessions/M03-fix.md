---
title: M03-fix — FilterDrawer correcciones finales
date: 2026-05-03
type: fix
status: aplicado
---

# M03-fix — FilterDrawer correcciones finales

## Qué se corrigió

### 1. Bordes del drawer (rectangular en desktop, top-radius en mobile)

M03 original interpretó el cambio al revés (agregó radius al desktop). M03-fix revertió:

- **Desktop:** `border-radius: 0` en las 4 esquinas. Solo `border-left: 1px solid var(--border-strong)`. Panel completamente rectangular anclado al borde derecho del viewport. Alineado al demo HTML (`s6-filter-panel` / `s7-filter-panel`).
- **Mobile:** `border-radius: 20px 20px 0 0` preservado (solo top corners). Solo `border-top: 1px solid var(--border-strong)`.

### 2. Color de fondo

El fondo ya era `var(--surface-elevated)` y es correcto. El fix alineó el esquema de bordes para que el panel se vea "pegado" al viewport en desktop sin borde derecho visible, consistente con el demo.

### 3. Íconos Lucide en chips de categorías

`StoreListingFilters.tsx` pasaba `type: "pills"` sin íconos. M03-fix:

- Añade `PRODUCT_TYPE_ICON_MAP` con íconos por key: `figures→Shapes`, `vinyl→Disc`, `manga→BookOpen`, `anime→Sparkles`, `cards→GalleryThumbnails`, `plush→Package`.
- Fallback: si el key no tiene ícono mapeado, `icon` queda `undefined` y el pill renderiza solo texto (sin romper nada).
- No requirió nueva prop en FilterDrawer — el tipo `pills` ya soporta `icon?: ReactNode`.

### 4. País de tienda + Importa desde → multi-tag autocomplete inline

**Decisión humana explícita (2026-05-03):** apartarse del demo HTML que muestra "input + chips abajo" para país. Usar en cambio el patrón multi-tag inline (tags dentro del input box).

- Nuevo `type: "tag-autocomplete"` añadido a la discriminated union `FilterSection` en FilterDrawer.
- Renderizado delega a `<MultiTagAutocomplete>` (ver §5).
- `StoreListingFilters.tsx`: `countryCodes` e `importCountryCodes` migrados de `type: "autocomplete"` a `type: "tag-autocomplete"`.

## Decisión: componente core vs. legacy reuse

**Decisión:** extracción a core — `src/components/core/MultiTagAutocomplete.tsx`.

**Razón:** FilterDrawer vive en `src/components/modules/` y no puede importar desde rutas escopadas (`stores/_components/share/`). La extracción fue directa (~30 min), el componente es autocontenido. Beneficio adicional: Orders y Deliveries pueden usar el mismo componente cuando necesiten filtros de país/categoría.

`StoreMultiTagAutocomplete` en `stores/_components/share/` se mantiene sin cambios — sigue siendo el componente de formulario (con soporte de `inputName` para form submission).

## Archivos modificados

| Archivo                                                             | Cambio                                                                                                         |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/components/modules/FilterDrawer/FilterDrawer.tsx`              | Bordes rect desktop + top-radius mobile + `FilterTagAutocompleteSection` type + `renderTagAutocompleteSection` |
| `src/components/core/MultiTagAutocomplete.tsx`                      | **Nuevo** — extracción del patrón multi-tag autocomplete                                                       |
| `src/app/[locale]/(app)/stores/_components/StoreListingFilters.tsx` | Íconos en productTypeKeys + tag-autocomplete para país                                                         |
| `docs/redesign/components/FilterDrawer.md`                          | Spec actualizado (bordes, tag-autocomplete type, tabla de values)                                              |
| `docs/redesign/_notes/cross-cutting-changes.md`                     | Nota M03-fix añadida a la fila M03                                                                             |

## Validación

Corrió `npm run type-check && npm run lint && npm run test && npm run validate-build`. Ver resultado en la conversación de cierre.
