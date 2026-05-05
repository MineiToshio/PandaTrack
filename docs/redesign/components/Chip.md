---
title: Chip
tier: 1
status: implementado
last_updated: 2026-05-03
session: M02-core-components-audit
adrs:
  - ADR 0001 D3 (disabled sin opacity)
---

# Chip

## Propósito

Píldora genérica para etiquetar, categorizar o mostrar atributos sin semántica de estado de dominio. Usar para tags de selección múltiple (autocomplete), categorías de tienda, filtros activos removibles, y cualquier etiqueta de clasificación libre.

Para estados de dominio (orden, entrega, pago) usar `<StatusChip>` — tiene lógica interna de resolución variant/icon/copy y discriminated union por `kind`.

## API TypeScript

```ts
type ChipVariant = "success" | "warning" | "destructive" | "info" | "accent" | "neutral";
type ChipSize = "sm" | "md";

type ChipProps = {
  variant?: ChipVariant; // Default "neutral"
  icon?: ReactNode; // Leading icon — caller controla tamaño (12px recomendado)
  size?: ChipSize; // Default "md"
  className?: string;
  children: ReactNode; // Label o contenido compuesto (ej. label + botón X para removibles)
};
```

## Variantes de color

| Variant       | Background                                                       | Border                                                           | Color                          | Uso típico                                          |
| ------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------ | --------------------------------------------------- |
| `success`     | `color-mix(in oklch, var(--success) 14%, var(--background))`     | `color-mix(in oklch, var(--success) 28%, var(--background))`     | `var(--success-chip-text)`     | Tags positivos, confirmados                         |
| `warning`     | `color-mix(in oklch, var(--warning) 14%, var(--background))`     | `color-mix(in oklch, var(--warning) 28%, var(--background))`     | `var(--warning-chip-text)`     | Tags de atención, próximos a vencer                 |
| `destructive` | `color-mix(in oklch, var(--destructive) 14%, var(--background))` | `color-mix(in oklch, var(--destructive) 28%, var(--background))` | `var(--destructive-chip-text)` | Tags de error, rechazados                           |
| `info`        | `color-mix(in oklch, var(--info) 14%, var(--background))`        | `color-mix(in oklch, var(--info) 28%, var(--background))`        | `var(--info-chip-text)`        | Tags informativos, en progreso                      |
| `accent`      | `color-mix(in oklch, var(--accent) 14%, var(--background))`      | `color-mix(in oklch, var(--accent) 28%, var(--background))`      | `var(--text-primary)`          | Tags seleccionados, activos (ej. autocomplete tags) |
| `neutral`     | `var(--surface-elevated)`                                        | `1px solid var(--border-strong)`                                 | `var(--text-secondary)`        | Tags sin semántica de color                         |

Las bases de `color-mix` usan `var(--background)` (no `transparent`) para coherencia cross-theme en dark mode.

## Tamaños

| Size | Font                    | Padding                   | Gap           | Uso                                                         |
| ---- | ----------------------- | ------------------------- | ------------- | ----------------------------------------------------------- |
| `md` | `--text-caption` (12px) | `3px 9px`                 | `--space-1_5` | Default. Directorio de tiendas, autocomplete tags, filtros. |
| `sm` | `--text-mono`           | `--space-0_5` `--space-2` | `--space-1_5` | Chips ultra-densos dentro de tablas o listas compactas.     |

Border-radius: `var(--radius-pill)` (999px — píldora full).

## Ícono leading

El prop `icon` acepta cualquier `ReactNode`. El ícono se envuelve en `<span aria-hidden="true">` — el accessible name del chip debe venir de `children` (label texto). Tamaño recomendado para `md`: 12px (`size={12}` en Lucide). Para `sm`: 10px.

```tsx
<Chip variant="success" icon={<CheckCircle size={12} aria-hidden />}>
  Confirmado
</Chip>
```

## Chip removible (con botón X)

Para chips removibles (ej. tags en `<StoreMultiTagAutocomplete>`), el botón X va dentro de `children`. No hay prop específica `onRemove` — el chip es un contenedor puro.

```tsx
<Chip variant="accent">
  {option.label}
  <button
    type="button"
    onClick={() => removeOption(option.value)}
    className="cursor-pointer rounded p-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:[outline-color:var(--focus-ring)]"
    aria-label={`Quitar ${option.label}`}
  >
    <X size={12} aria-hidden />
  </button>
</Chip>
```

## Relación con StatusChip

|                       | `<Chip>`                                | `<StatusChip>`                                   |
| --------------------- | --------------------------------------- | ------------------------------------------------ |
| Propósito             | Etiqueta genérica de clasificación      | Estado de dominio (orden, entrega, pago)         |
| API                   | `variant`, `icon?`, `size?`, `children` | discriminated union sobre `kind`                 |
| Copy                  | Lo provee el consumer en `children`     | Lo resuelve internamente desde `useTranslations` |
| Icon                  | Opcional, cualquier tamaño              | Siempre presente (ADR 0006), 14px                |
| Exporta `ChipVariant` | ✅                                      | ✅ (re-usa el mismo tipo)                        |

## Tokens consumidos

- `--success`, `--warning`, `--destructive`, `--info`, `--accent`
- `--success-chip-text`, `--warning-chip-text`, `--destructive-chip-text`, `--info-chip-text`
- `--text-primary`, `--text-secondary`
- `--surface-elevated`, `--border-strong`
- `--background`
- `--radius-pill`
- `--font-sans`, `--font-weight-medium`
- `--text-caption`, `--text-mono`
- `--space-0_5`, `--space-1_5`, `--space-2`

## Ejemplos de uso

```tsx
// Tag de categoría — directorio de tiendas
<Chip variant="accent">Figuras</Chip>

// Tag con ícono
<Chip variant="success" icon={<CheckCircle size={12} aria-hidden />}>
  Verificado
</Chip>

// Tag removible en autocomplete
<Chip variant="accent">
  Argentina
  <button type="button" onClick={handleRemove} aria-label="Quitar Argentina">
    <X size={12} aria-hidden />
  </button>
</Chip>
```

## Consumidores conocidos

- `src/app/[locale]/(app)/stores/_components/share/StoreMultiTagAutocomplete.tsx` — tags de países/categorías seleccionados.
