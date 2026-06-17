---
title: M02-fix — Button hover lift + Input search variant (gap closure)
date: 2026-05-03
status: cerrado
type: correctivo
---

# M02-fix — Cierre de gaps de implementación de M02

## Contexto

M02 reportó cierre el 2026-05-03 pero no aplicó dos cambios al código:

1. **Button hover lift** — el spec `Button.md` documentaba `translateY(-1px)` en hover.
2. **Input search variant con submit button** — el spec `Input.md` documentaba `<SearchInput>` con botón accent + loader para el toolbar del directorio de tiendas.

## Auditoría al inicio de M02-fix

| Item                                    | Estado real en `src/`                                                                                          | Acción necesaria |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------- |
| `Button` hover lift                     | ✅ Ya implementado en `buttonVariants.ts` (`hover:-translate-y-px`, `motion-reduce:hover:translate-y-0`)       | Ninguna          |
| `SearchInput` componente                | ✅ Ya existía en `src/components/core/SearchInput.tsx` con `onSubmit`, `isLoading`, `Loader2`, `role="search"` | Ninguna          |
| `StoreListingFilters` usa `SearchInput` | ❌ Usaba `<Input type="search">` con solo leading icon — sin submit button visible                             | Reemplazar       |

El único gap real era que `StoreListingFilters.tsx` no consumía `<SearchInput>`.

## Cambios aplicados

### `src/app/[locale]/(app)/stores/_components/StoreListingFilters.tsx`

- Reemplazó `<Input type="search">` + `<form onSubmit>` por `<SearchInput>`.
- Agregó `useTransition` para cablear `isLoading={isSearchPending}` al `SearchInput`.
- `onSubmit` recibe el `query` string directamente y envuelve el `router.push` en `startSearchTransition`.

### `src/components/core/_tests/SearchInput.test.tsx` (nuevo)

9 tests unitarios:

- Submit por click en botón.
- Submit por `Enter` en el input.
- No submit en teclas no-Enter.
- Muestra `Loader2` cuando `isLoading=true`.
- No muestra spinner cuando `isLoading=false`.
- `aria-busy="true"` en botón cuando loading.
- Sin `aria-busy` cuando no loading.
- Renderiza `role="search"` landmark.
- `aria-label` del botón = `searchLabel`.

## Validación

- `type-check`: ✅ sin errores
- `lint`: ✅ sin errores (12 warnings pre-existentes no relacionados)
- `test`: ✅ 442 passed / 12 skipped (59 files)
- `validate-build`: ✅ build limpio
