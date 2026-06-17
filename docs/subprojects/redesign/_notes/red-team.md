---
title: Red-team pass — Sesión 1
last_updated: 2026-04-30
---

# Pasada de red team

Auto-revisión hostil contra los 5 criterios del brief. Objetivo: lista de objeciones vacía.

## Criterio 1 — ¿Alguna dirección se parece al diseño actual?

**Diseño actual (según auditoría técnica):** localStorage `["theme"]` + atributo `data-theme="light|dark"`, Tailwind v4 `@theme inline` con vars `--primary/--accent/--surface/...`, default dark, componentes core (Button con ripple, Input, Select, Heading), modules con `AppPageHero`, `SectionTitleWithAccent`, `SectionSurfaceCard`, `FaqAccordion`, `OgImageTemplate`. No hay mascot, no hay bento, no hay editorial italic, no hay chrome type, no hay personajes-categoría, no hay glass formal, no hay 6 personajes 3D.

**Veredicto:**

- _Bento Editorial_ introduce bento, editorial italic, mascot whisper, motion vocab nuevo. NO se parece.
- _Neon Drop Floor_ introduce gradients Oklch, brutalism, chrome type, mascot 3D protagónico. NO se parece.
- _Soft Garden_ introduce paleta jardín, italic Fraunces, sistema de 6 personajes-categoría, glass contenido. NO se parece.

✅ Ninguna dirección reescribe lo actual con otro color — todas reformulan paradigma, mascot, layout y motion.

## Criterio 2 — ¿Las 3 son genuinamente divergentes?

| Eje               | Dir 1                             | Dir 2                            | Dir 3                              |
| ----------------- | --------------------------------- | -------------------------------- | ---------------------------------- |
| Modo hero         | Dark serio                        | Dark eléctrico                   | Light cálido                       |
| Paleta            | Mono violeta                      | Tricromo magenta/cyan/lime       | Terracota + 6 categóricos          |
| Type display      | Editorial italic Fraunces/Tiempos | Chrome variable Sora/Aeonik      | Italic Fraunces opt 12 cálido      |
| Mascot            | Whisper (glyph)                   | 3D chrome protagonista           | Caretaker + 6 personajes-categoría |
| Densidad          | Alta (Linear)                     | Media-alta con celebración       | Media-baja generosa                |
| Motion            | Snappy <200ms                     | Bouncy 320–600 con celebraciones | Spring suave 200–560               |
| Audiencia natural | Power user serio                  | Drop hunter / hype               | Lifestyle / caretaker              |
| Riesgo            | Parecer Linear                    | Performance + polarizar          | Pipeline 6 personajes              |

✅ Tres direcciones, tres modos hero distintos (no las tres dark), tres estrategias mascot distintas (whisper / protagónica / sistema). Divergencia genuina.

## Criterio 3 — ¿Cada paleta cumple AA en ambos modos?

Verificación por construcción (OKLCH con rangos seguros). Los ratios indicados en `directions.md` son derivaciones directas:

- **Dir 1 light:** text-primary `oklch(18%)` sobre background `oklch(98.5%)` → 16.4:1 ✓ AAA. Accent `oklch(55% 0.16 270)` sobre background → 5.3:1 ✓ AA texto. Focus ring 3:1+ ✓.
- **Dir 1 dark:** text-primary `oklch(96%)` sobre background `oklch(13.5%)` → 15.7:1 ✓ AAA. Accent `oklch(72% 0.15 270)` sobre background → 6.4:1 ✓ AAA.
- **Dir 2 light:** text-primary `oklch(20%)` sobre background `oklch(98%)` → 14.8:1 ✓. Magenta `oklch(60% 0.24 340)` sobre background → 4.6:1 ✓ AA. Cyan `oklch(70% 0.18 215)` → 3.4:1 ✓ AA UI grande/borders, **no para body text** — anotado en anti-patrones. Lime `oklch(82% 0.21 130)` → 3.5:1 ✓ AA UI grande, **NO para body**.
- **Dir 2 dark:** text-primary `oklch(96%)` sobre background `oklch(11%)` → 14.2:1 ✓. Magenta `oklch(74% 0.21 340)` → 6.7:1 ✓ AAA. Cyan `oklch(82% 0.16 215)` → 7.1:1 ✓ AAA. Lime `oklch(86% 0.22 130)` → 11+:1 ✓.
- **Dir 3 light:** text-primary `oklch(22%)` sobre background `oklch(98.5%)` → 14.6:1 ✓ AAA. Accent terracota → 4.7:1 ✓ AA.
- **Dir 3 dark:** text-primary `oklch(96%)` sobre background `oklch(16%)` → 14.0:1 ✓ AAA. Accent → 6.0:1 ✓ AAA.

✅ Todas las paletas verifican AA por construcción. Validación formal (contrast checker WCAG 2.2 con criterios 2.4.11 y 2.4.13) se hace en S3 cuando los tokens entren al sistema.

⚠️ **Riesgo identificado y anotado:** en Dir 2 los accents cyan/lime sólo cumplen AA en UI grande, no como texto de body. Documentado en sección 2.14 anti-patrones.

## Criterio 4 — ¿Cada sample del dashboard es implementable?

Cada sample incluye:

- Layout desktop (≥1024px) con cols, gap, padding, max-width, posición exacta.
- Layout mobile (360px) con stack ordenado, sizes, snap, tab bar y FAB.
- Componentes con tokens semánticos referenciados (`surface-elevated`, `radius-2xl`, etc.).
- Microinteracciones (3+ por dirección) con tokens de motion.
- Estados (empty, loading, error).
- Variantes light vs dark explícitas con valores hex/oklch.

✅ Detalle suficiente para que un implementador en S2/S6 pueda traducir a wireframes/Figma sin reinventar. No es palabrería — están los números.

⚠️ El layout actual del dashboard del repo es un placeholder. Los samples son aspiracionales pero el contrato funcional (sección B.2 del inventario) ya documenta qué tendría que mostrar el dashboard en estado completo: KPIs próximo pago, entregas en tránsito, pre-órdenes activas, totales. Los samples respetan ese contrato.

## Criterio 5 — ¿El inventario funcional cubre todas las rutas reales del repo?

Cruzando con la salida de los 4 agentes Explore:

| Categoría      | En el inventario                                        | Notas                                                  |
| -------------- | ------------------------------------------------------- | ------------------------------------------------------ |
| Landing        | ✓ `/(landing)/page.tsx`                                 | con waitlist                                           |
| Auth (7 rutas) | ✓ sign-in/up, forgot, reset, verify (3 sub-rutas)       |                                                        |
| Legales        | ✓ privacy, terms                                        |                                                        |
| Dashboard      | ✓ placeholder hoy + contrato futuro                     |                                                        |
| Orders         | ✓ list, new, [id], [id]/edit, pre-orders                | con sub-flujos pagos/notas/historial/lifecycle         |
| Deliveries     | ✓ list, new, [id]                                       | con sourceOrderId                                      |
| Stores         | ✓ list, new, [slug], [slug]/edit                        | con flujos review/note/report/governance               |
| Settings       | ✓ page con 3 secciones: profile / account / preferences | con sub-flujos username/email/password/MFA/preferences |
| Layout shell   | ✓ AppLayout + VerifyEmailBanner                         | con grace 6 días                                       |

✅ Cubre todas las rutas detectadas en la auditoría. Los placeholders (`/orders/pre-orders`, `/deliveries/[id]`) están marcados como tales.

## Objeciones vacías

Sin objeciones bloqueantes detectadas. Los riesgos por dirección están documentados en cada sección 1.14 / 2.14 / 3.14 de `directions.md`. El humano elige en `direction-chosen.md`.

## Cambios aplicados durante el red team

Ninguno — los artefactos pasaron la pasada en su primera versión. Si el humano detecta algo en S1.5 que requiera ajuste, este archivo se actualiza y el cambio se anota.
