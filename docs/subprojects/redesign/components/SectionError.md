---
title: SectionError
tier: 2
status: implementado
last_updated: 2026-06-13
session: 10-cross-cutting-states
adrs:
  - ADR 0013
---

# SectionError

## Propósito

Componente de módulo para el error de **sección** (ADR 0013 D3): una región (card / lista) falló al cargar mientras el resto de la página vive. Patrón **nuevo** introducido en S10 — distinto del error de ruta (full-page `error.tsx`, icon-well destructive) y del 404 (`not-found.tsx`, tono neutral). `"use client"` porque expone un botón de reintento. Vocabulario visual congelado en `PLAYBOOK §9.17` (Chip-Eyebrow + Top-Accent).

Implementación shipeada: [`src/components/modules/SectionError.tsx`](../../../src/components/modules/SectionError.tsx).

## API TypeScript

```ts
type SectionErrorTone = "destructive" | "warning";

type SectionErrorProps = {
  /** Mensaje context-specific (qué sección falló + que el resto de la página funciona). Requerido. */
  message: string;
  /** `destructive` para fallos de carga (default), `warning` para offline transitorio. */
  tone?: SectionErrorTone;
  /** Label del chip-eyebrow. Default: i18n por tono. */
  title?: string;
  /** Label del botón de retry. Default: i18n. */
  retryLabel?: string;
  /** Handler de retry. Default: `router.refresh()` (re-corre los Server Components). */
  onRetry?: () => void;
  className?: string;
};
```

Reglas TS:

- `message` es obligatorio — siempre context-specific (no un mensaje genérico): nombra la región que falló y deja claro que el resto de la pantalla sigue operativa.
- Defaults i18n por tono: `destructive` → `components.sectionError.title` ("No se pudo cargar"); `warning` → `components.sectionError.offline.title` ("Sin conexión"). `retryLabel` → `components.sectionError.retry` ("Reintentar").

## Variants / Sizes

| Tone (`tone`)           | Uso                                | Ícono Lucide    | Top-accent token |
| ----------------------- | ---------------------------------- | --------------- | ---------------- |
| `destructive` (default) | Fallo de carga de la región        | `TriangleAlert` | `--destructive`  |
| `warning`               | Offline transitorio (reintentable) | `WifiOff`       | `--warning`      |

## Estados visuales

| Estado    | Receta CSS                                                                                                                                                                                                                                                                  | Notas                                                                                                   |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `default` | Card `background: var(--surface-elevated)`, `border: 1px solid var(--border)`, `border-radius: var(--radius-xl)`, `padding: var(--space-5)` (`p-5`), `border-top: 2px solid color-mix(in oklch, var(--destructive\|--warning) 55%, transparent)`. Stack vertical `gap-2.5`. | Top-accent en `oklch` (tokens de status cromáticos). Chip-eyebrow + mensaje + retry apilados al inicio. |
| `chip`    | `<Eyebrow variant="chip" tone={tone} icon={TriangleAlert\|WifiOff}>` con el title.                                                                                                                                                                                          | Reutiliza el vocabulario §9.17 — mismo par tono+ícono que el resto del sistema.                         |
| `message` | `max-width: 54ch; font-size: var(--text-body); line-height: 1.5; color: var(--text-secondary);`                                                                                                                                                                             | Mensaje legible, ancho acotado.                                                                         |
| `retry`   | `<Button variant="ghost" size="sm">` con `leadingIcon={<RotateCw size={15} />}`.                                                                                                                                                                                            | Retry default = `router.refresh()`; override vía `onRetry`.                                             |

## Accesibilidad

- **Rol ARIA:** `role="alert"` + `aria-live="polite"` en el contenedor — el screen reader anuncia el fallo de la región sin interrumpir.
- El botón de retry hereda la accesibilidad del `<Button>` (foco visible, label textual).
- Los íconos (`TriangleAlert` / `WifiOff` / `RotateCw`) son decorativos (`aria-hidden`); el significado vive en el title del chip y en el `message`.

## Sentry

**No captura.** Es presentación pura (ADR 0013 D6): la captura única vive en el fetch fallible que origina el render de `<SectionError>`. Nunca duplicar capturas (`sentry-error-handling.mdc`).

## Tokens consumidos

- `--destructive` / `--warning` (top-accent 55 % + chip-eyebrow por tono)
- `--surface-elevated`, `--border`
- `--text-secondary` (mensaje)
- `--radius-xl`
- `--font-mono` (heredado del chip-eyebrow)

## Anti-patrones

1. **Usar `<SectionError>` como error de ruta full-page**: el error de ruta es `error.tsx` con icon-well destructive y `reset()`. SectionError es para una región dentro de una página viva.
2. **Capturar a Sentry desde el componente**: la captura es del fetch fallible, no de la presentación (ADR 0013 D6).
3. **Mensaje genérico** ("Algo salió mal"): `message` debe ser context-specific y dejar claro que el resto de la pantalla funciona.
4. **`destructive` para un estado no-error** (p. ej. offline transitorio): usar `tone="warning"`.
5. **Mascota en el error**: prohibida en errores/confirmaciones (`PLAYBOOK §10.7`).
6. **Top-accent en `oklab`**: los tokens de status son cromáticos → `color-mix(in oklch, …)`.

## Ejemplos de uso

```tsx
// Una card del dashboard falló; el resto de la pantalla vive
<SectionError message="No pudimos cargar tus pagos próximos. El resto del panel funciona." />

// Offline transitorio, retry custom
<SectionError
  tone="warning"
  message="Sin conexión. Revisá tu red y reintentá."
  onRetry={handleManualRefetch}
/>
```

## ADRs aplicables

- [ADR 0013 — Cross-cutting state system](../decisions/0013-cross-cutting-state-system.md): D3 (SectionError como patrón nuevo §9.17 destructive, retry = `router.refresh()`), D6 (sin captura Sentry).

## Dependencias

- [`Eyebrow.md`](./Eyebrow.md) — `variant="chip"` con `tone` + `icon` (§9.17).
- [`Button.md`](./Button.md) — `variant="ghost" size="sm"` con `leadingIcon` para el retry.

## Consumidores actuales

Ninguno todavía. La arquitectura de datos a nivel página no tiene hoy una región fallible de forma independiente; el componente se shipea como primitiva reutilizable lista para la primera que aparezca.

## Demo

Anchor `#s10-section-error` (`_notes/demo-screens.html`).
