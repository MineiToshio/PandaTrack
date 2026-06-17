---
title: "M01 — Modal Enhancement (mini-sesión correctiva)"
date: 2026-05-03
status: completed
type: correctiva (cross-cutting Tipo 2)
branch: redesign
---

# M01 — Modal Enhancement

## Origen

Detectado durante la sesión S6 (Módulo Tiendas). El componente `<Modal>` fue clasificado como cross-cutting change **Tipo 2** (cambio mayor de componente core) en `_notes/cross-cutting-changes.md`. El diagnóstico: modal plano, sin señal semántica, sin identidad Atelier.

## Sub-fases

### M01.1 — Research

Referentes estudiados: Linear, Vercel, Stripe Dashboard, Apple HIG, Material 3, Polaris (Shopify), Carbon (IBM), Cash App, Notion, Things 3.

Hallazgos principales:

- **Patrón dominante (B2B/SaaS):** icon-circle tonal + título en línea + subtitle + divider footer → Stripe, Polaris, Carbon.
- **Patrón editorial (tools):** solo tipografía, sin íconos → Linear, Plain.
- **Patrón hero (consumer/brand):** ícono centrado + halo + eyebrow + hairline accent → Apple HIG.
- **Backdrop blur** es estándar cross-industria para capas de atención focalizada.
- **Spring animation** (linear/spring easing) reemplaza al scale mecánico cúbico en productos 2024+.

### M01.2 — Exploración en demo HTML

Se implementaron **3 versiones × 6 casos de uso = 18 secciones** en `_notes/demo-screens.html` (`m01-va-*`, `m01-vb-*`, `m01-vc-*`):

**Casos de uso:**

| ID          | Caso              | Tono        | Lucide icon      |
| ----------- | ----------------- | ----------- | ---------------- |
| destructive | Eliminar tienda   | destructive | `trash-2`        |
| warning     | Reportar tienda   | warning     | `flag`           |
| decision    | Discrepancia      | info        | `alert-triangle` |
| info        | Estados de tienda | info        | `info`           |
| form        | Editar reseña     | default     | `star`           |
| list        | Tiendas similares | default     | `store`          |

**Versiones exploradas:**

- **A — Editorial Quiet:** sin íconos, título 22px, padding 28px. Tono comunicado solo por CTA. Referentes: Linear / Plain / Stripe.
- **B — Semantic Depth:** icon-circle 48px tonal + título + subtitle + close en fila flex. `border-top` footer. Referentes: Stripe Dashboard / Polaris / Carbon.
- **C — Atelier Hero:** hairline 2px acento, eyebrow mono 10px, ícono centrado 40px con halo radial. `--m01c-tone` inline. Referentes: Apple HIG + firma PandaTrack.

**Constrains universales aplicados en las 3 versiones:**

- `border-radius: 20px` en todos los modales
- `backdrop-filter: blur(8px)` + tint oklch calibrado (light y dark)
- Overlay `position: fixed; inset: 0; z-index: 90` en el demo (→ `--z-modal: 80` en implementación)
- Spring animation: `linear(0, 0.5, 0.85, 0.97, 1)` 280ms
- A11y: `role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-label` en close
- `prefers-reduced-motion` fallback: solo opacity, sin scale

### M01.3 — Revisión humana

Humano revisó las 18 secciones en light + dark + 5 paletas. Decisión: **Versión B (Semantic Depth)**.

### M01.4 — Documentación (este cierre)

Documentos creados o actualizados:

| Archivo                               | Cambio                                                                             |
| ------------------------------------- | ---------------------------------------------------------------------------------- |
| `decisions/0008-modal-enhancement.md` | ADR nuevo — registra decisión Version B, spec visual aprobada                      |
| `components/Modal.md`                 | Actualizado: API TypeScript (icon, tone, subtitle), estados visuales, tokens, ADRs |
| `_notes/cross-cutting-changes.md`     | M01 → `✅ aplicado` + referencia a ADR 0008                                        |
| `sessions/M01-modal-enhancement.md`   | Este archivo                                                                       |
| `README.md`                           | ADR 0008 añadido a tabla de ADRs y sesiones                                        |

## Decisión adoptada

**Versión B — Semantic Depth.** Ver especificación completa en [ADR 0008](../decisions/0008-modal-enhancement.md).

Resumen de cambios visuales vs spec S4:

| Aspecto        | S4 (anterior)                                           | M01 (aprobado)                                                  |
| -------------- | ------------------------------------------------------- | --------------------------------------------------------------- |
| Overlay        | backdrop `--surface-overlay` plano + container separado | Overlay unificado con `backdrop-filter: blur(8px)` + tint oklch |
| Border-radius  | `--radius-xl` (16px)                                    | 20px (`--radius-2xl`)                                           |
| Header         | `<h2>` + description + close                            | Icon-circle 48px tonal + título + subtitle + close (fila flex)  |
| Footer         | `border-top` + `background: var(--surface)`             | `border-top` solo — mismo `--surface-elevated` que el body      |
| Animation      | scale cubic + opacity                                   | Spring `linear(0, 0.5, 0.85, 0.97, 1)` 280ms                    |
| max-width `md` | 512px                                                   | 460px                                                           |

## Referencia visual

Secciones `m01-vb-*` del demo HTML: `_notes/demo-screens.html`. Navegar al grupo "M01 · Modal" → versión B (6 secciones). Light + dark + paletas disponibles.
