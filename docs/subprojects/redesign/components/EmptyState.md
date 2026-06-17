---
title: EmptyState
tier: 2
status: implementado
last_updated: 2026-06-13
session: 06-stores (creado) · 10-cross-cutting-states (extendido)
adrs:
  - ADR 0013 — Cross-cutting state system (skeleton / empty / error)
---

# EmptyState

> ⚠️ Spec reescrito en S10 (Fase B) para reflejar el componente shipped. La API S4 original
> (`variant: general|filtered|error`, `size`, `cta`, mascota en `general`) **ya no existe**.

## Propósito

Primitiva canónica del **bloque centrado** (ADR 0013). Cubre dos familias:

- **Empty** de lista/flujo: card dashed con icon-well, título, subtítulo y CTAs (`appearance="card"`), o el bloque centrado sin chrome (`appearance="plain"`, legacy).
- **Estado full-page** de error/404/offline: bloque centrado a viewport con icon-well grande + eyebrow mono opcional (`appearance="page"`). Consumido por `error.tsx` y `not-found.tsx`.

El mismo componente sirve a ambas familias cambiando `appearance` + `iconTone`. Voz: `docs/design/ux-copy.md` (declarativo, cálido, forward-looking).

Archivo: `src/components/modules/EmptyState.tsx`.

## API TypeScript

```ts
import type { ReactNode } from "react";

type EmptyStateIconTone = "neutral" | "accent" | "warning" | "destructive";
type EmptyStateAppearance = "plain" | "card" | "page";

type EmptyStateProps = {
  /** `plain` (legacy centrado), `card` (canónico de lista), `page` (full-page error/404/offline). Default `plain`. */
  appearance?: EmptyStateAppearance;
  /** Slot decorativo sobre el título (mascota futura, ilustración). Tiene prioridad sobre `icon`. */
  visual?: ReactNode;
  /** Ícono Lucide pre-dimensionado dentro del icon-well. Canónico: `card` → 28px, `page` → 32px. */
  icon?: ReactNode;
  /** Tono del icon-well. `neutral`/`accent` para empties; `warning`/`destructive` para estados de error. */
  iconTone?: EmptyStateIconTone;
  /** Eyebrow mono opcional sobre el título (estados `page`, ej. "Error 404"). */
  eyebrow?: ReactNode;
  /** Título — corto y directo. */
  title: string;
  /** Subtítulo / copy de apoyo opcional. */
  subtitle?: ReactNode;
  /** CTAs opcionales (Buttons). */
  actions?: ReactNode;
  /** Nivel de heading. Lista bajo un `h1` usa `h2`; estados `page` usan `h1`. Default `h3`. */
  headingAs?: "h1" | "h2" | "h3";
  /** Rol ARIA del root (ej. `alert` en error de ruta, `status` en offline). */
  role?: string;
  className?: string;
};
```

## Appearances

| Appearance | Chrome                                                                             | Icon-well | Uso                                                                 |
| ---------- | ---------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------- |
| `card`     | Card dashed `--surface-elevated`, `--radius-2xl`, centrado, `px-6 py-12`.          | 64px      | Empty canónico de lista/flujo (Orders, Deliveries, Stores, create). |
| `page`     | Bloque centrado a viewport (`min-h-[58vh]`), sin card; eyebrow mono + título `h1`. | 72px      | Error de ruta (`error.tsx`), 404 (`not-found.tsx`), offline.        |
| `plain`    | Bloque centrado `max-w-md` sin chrome ni icon-well.                                | —         | Legacy / consumidores existentes.                                   |

## Tonos del icon-well

Mezcla neutra en `oklab` (L074: oklch deriva el hue a rosa en neutros); tonos cromáticos en `oklch`.

| `iconTone`    | Color                                        | Uso canónico                    |
| ------------- | -------------------------------------------- | ------------------------------- |
| `neutral`     | `--text-secondary` sobre `--text-primary` 5% | Sin resultados (filtrado), 404. |
| `accent`      | `--accent` 10%                               | Empty de primera vez (invitar). |
| `warning`     | `--warning` 13%                              | Offline / atención transitoria. |
| `destructive` | `--destructive` 12%                          | Error de ruta.                  |

## Dos clases de empty (referencia cross-módulo)

Una sola anatomía (`card`), cambia tono + copy. Demo `#s10-empty-anatomy`.

- **Primera vez:** `iconTone="accent"`, ícono contextual (`PackageOpen`/`Truck`/`Store`), CTA primary (verbo + objeto).
- **Sin resultados:** `iconTone="neutral"`, ícono `SearchX`, CTA ghost "Limpiar filtros".

## Accesibilidad

- `card`/`plain`: el título es heading del outline (lista bajo `h1` → `h2`); icon-well decorativo `aria-hidden`.
- `page`: título `h1`; pasar `role="alert"` (error de ruta) o `role="status"` (offline). Focus management lo aporta el boundary.
- Icon-well siempre `aria-hidden`; el ícono Lucide se pasa con `aria-hidden`.

## Mascota

S10 **no monta mascota** (ADR 0013 D5; `MascotBubble` desmontado, assets pendientes). El slot `visual` queda reservado para una futura mascota _sleeping_ en empty-hero cuando los assets existan. La mascota está **prohibida** en estados de error (anti-patrón `directions.md` §4.10).

## Consumidores

`OrderListEmptyState`, `DeliveryListEmptyState`, `DeliveryCreateEmptyState`, `OrderCreateEmptyStores` (todos `card`); `error.tsx` (`page` destructive), `not-found.tsx` (`page` neutral). `StoreEmptyStateBox` fue eliminado (dead code) en S10.

## Anti-patrones

1. **Mascota en error / confirmaciones** — prohibido (§4.10).
2. **`destructive` para un 404** — un 404 no es un error; usar `neutral`.
3. **Copy corporativo** ("No se encontraron resultados") — voz `ux-copy.md`.
4. **Empty oculta el filter bar** en sin-resultados — debe seguir visible para limpiar filtros.
5. **`opacity` para atenuar** el icon-well — usar el `color-mix` del tono.

## Ejemplos de uso

```tsx
// Empty de lista · primera vez (accent)
<EmptyState
  appearance="card"
  headingAs="h2"
  iconTone="accent"
  icon={<PackageOpen width={28} height={28} />}
  title={t("empty.noOrders.title")}
  subtitle={t("empty.noOrders.description")}
  actions={<Button as="a" href={ctaHref} variant="primary">{t("empty.noOrders.cta")}</Button>}
/>

// Error de ruta full-page (page · destructive) — error.tsx
<EmptyState
  appearance="page"
  role="alert"
  headingAs="h1"
  iconTone="destructive"
  icon={<TriangleAlert width={32} height={32} aria-hidden />}
  eyebrow={t("eyebrow")}
  title={t("title")}
  subtitle={t("description")}
  actions={<><Button onClick={reset}>{t("retry")}</Button><Button as="a" href={home} variant="ghost">{t("goHome")}</Button></>}
/>
```

## Tokens consumidos

- `--surface-elevated`, `--border` (card / dashed)
- `--text-primary`, `--text-secondary`, `--text-muted`
- `--accent`, `--warning`, `--destructive` (icon-well tones, oklch); `--text-primary` (neutral well, oklab)
- `--radius-2xl` (card), `--radius-lg`
- `--text-title`, `--text-subtitle`, `--text-body`, `--text-eyebrow`, `--font-mono`

## ADRs aplicables

- ADR 0013 — Cross-cutting state system: D2 (EmptyState como primitiva del bloque centrado + tonos extendidos + `page`), D5 (mascota excluida).

## Dependencias

- `<Button>` para CTAs. Iconos `lucide-react`. Demo: `#s10-empty-anatomy`, `#s10-route-error`, `#s10-not-found`.
