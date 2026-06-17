---
title: M02/M03 Fix Round 2
date: 2026-05-04
status: applied
---

# M02/M03 Fix Round 2

Correcciones críticas sin las cuales los rounds anteriores no tenían valor real. 7 items aplicados.

## Camino elegido para Select

**Camino A** (fix del `ControlledSelect` existente). Se descartó Camino B/C porque `SearchSelect` legacy usa tokens de Tailwind no-semánticos (`bg-background`, `text-foreground`) incompatibles con el design system Velvet. El rewrite de `ControlledSelect` es limpio y mantiene la API existente intacta.

## Items aplicados

| #   | Item                                                                                                                                                                                                                                                                        | Archivo                          | Verificacion                                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `<Select>` reescrito: toggle open/close, buscador integrado, click-outside via container onBlur, sin check redundante, keyboard nav (flechas/Enter/Esc), aria (role=combobox/listbox, aria-activedescendant)                                                                | `src/components/core/Select.tsx` | Handlers `handleTriggerClick`, `handleContainerBlur`, `handleSearchKeyDown`, `onMouseDown={e.preventDefault()}` en OptionItem — todos presentes en el archivo |
| 2   | FilterDrawer borde exterior: eliminado `[border:none]` que anulaba `border-top` en mobile; añadido `[box-shadow:var(--shadow-3)]`                                                                                                                                           | `FilterDrawer.tsx`               | Linea `"max-h-[92svh] [border-top:1px_solid_var(--border-strong)]"` sin `[border:none]`; `[box-shadow:var(--shadow-3)]` presente                              |
| 3   | FilterDrawer icons en pills: eliminado `[color:var(--accent-cool)]` hardcoded; los iconos heredan el color del padre (text-secondary idle, accent selected)                                                                                                                 | `FilterDrawer.tsx`               | `accent-cool` no aparece en el archivo                                                                                                                        |
| 4   | Mapping completo de iconos por product type: 16 keys reales de la DB (albums, art_books, books, book_accessories, comics, figures, funkos, funko_accessories, home_video, light_novels, manga, merchandise, music, signatures, trading_cards, video_games) + fallback `Tag` | `StoreListingFilters.tsx`        | `getProductTypeIcon` en linea 83; funcion usada en linea 158                                                                                                  |
| 5   | Iconos `Store`/`Globe` en pills de presencia PHYSICAL/ONLINE                                                                                                                                                                                                                | `StoreListingFilters.tsx`        | `icon: <Store size={12}` y `icon: <Globe size={12}` en el array de sections                                                                                   |
| 6   | Banderas emoji en dropdown y tags inline del autocomplete de paises (via `CollectorCountryFlagEmoji`)                                                                                                                                                                       | `StoreListingFilters.tsx`        | `leadingDecoration: <CollectorCountryFlagEmoji countryCode={c.code} />` en `countryOptionsMemo`                                                               |
| 7   | FilterDrawer NO cierra al click fuera: eliminado `onClick={() => onOpenChange(false)}` del backdrop; solo X y Esc cierran                                                                                                                                                   | `FilterDrawer.tsx`               | Backdrop sin `onClick`; `onClick` solo en boton X (linea 426)                                                                                                 |

## Validacion

- `npm run type-check` — limpio
- `npm run lint` — 0 errores (12 warnings pre-existentes en archivos no tocados)
- `npm run test` — 442 passed, 12 skipped; test `closes on backdrop click` actualizado a `does NOT close on backdrop click`
- `npm run validate-build` — build limpio

## No commitee
