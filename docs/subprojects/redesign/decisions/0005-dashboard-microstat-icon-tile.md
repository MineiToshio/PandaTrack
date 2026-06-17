---
title: ADR 0005 — Patrón canónico de micro-stat card del dashboard (icon-tile + cifra neutra)
date: 2026-05-02
status: accepted
session: 03-tokens (research follow-up)
owner: Sergio Minei
refines: decisions/0001-s2-closure-decisions.md (Decisión 8)
sources:
  - _notes/s3-research-accent-warm-metric.md
  - _notes/s3-contrast-audit.md
confirmed_by: |
  Research follow-up B (daltonismo `_notes/s3-research-colorblind-info.md`), C (paleta categórica
  `_notes/s3-research-categorical-palette.md`) y D (text-muted outdoor `_notes/s3-research-text-muted-outdoor.md`)
  confirman que ninguna decisión cross-research entra en conflicto con este patrón. El uso de
  los 4 tiles cromáticos (indigo / coral / ámbar / verde) es robusto bajo simulación de
  daltonismo gracias a la dualidad glyph + label fija (ADR 0006).
---

# ADR 0005 — Patrón canónico de micro-stat card del dashboard

## Contexto

ADR 0001 Decisión 8 asigna 4 colores funcionales a los 4 micro-stats del dashboard:

| Slot | Métrica                | Color asignado    |
| ---- | ---------------------- | ----------------- |
| 1    | Este mes               | `--accent` indigo |
| 2    | Próximos 30 días       | `--accent-warm`   |
| 3    | Atrasado (condicional) | `--warning` ámbar |
| 4    | Llega esta semana      | `--success` verde |

Al cerrar Sesión 3 se descubrió que **`--accent-warm` light no pasa AA texto pequeño** (4.5:1) sobre el lienzo claro en ninguna paleta — Velvet 3.01:1, Lilac 1.85:1 (FAIL incluso AA Large 3:1). Si la cifra del slot 2 toma color warm, rompe contraste.

Tres caminos posibles:

- (a) Oscurecer `--accent-warm` cross-paleta hasta L≈0.45-0.50 → destruye el carácter "coral cálido vibrante" + fragmenta el token cross-paleta.
- (b) Cifra neutra (`--text-primary`) + decorador asociado con el color funcional.
- (c) Chip warm soft envolviendo el label + cifra neutra debajo.

Una pasada de research (`_notes/s3-research-accent-warm-metric.md`) revisó 11 apps reales (Shopify Polaris, IBM Carbon, Material 3, Tailwind UI Stats, Plausible, Robinhood, Apple Health, YNAB, Cash App, Dell Design System, Power BI canónico) y 6+ artículos de research (Refactoring UI, WCAG 2.2, Smashing, phData, insightsoftware, Datarocks). **Convergencia masiva** en el patrón: la cifra grande es texto neutro; el color funcional vive en un decorador asociado (badge, tile, ring, sparkline, ícono). Robinhood es excepción explícita por polaridad binaria semántica (sube/baja) — caso que NO aplica a "Próximos 30 días" (planeación neutra).

## Decisión

**Patrón canónico del slot 2 (y por extensión, los 4 slots) del dashboard:** opción **(b') refinada — cifra neutra `--text-primary` + icon-tile circular soft-tint con glyph Lucide del color funcional dentro**.

### Receta visual del card

```
┌─────────────────────────────────────┐
│ ┌───┐                               │
│ │ ◐ │   PRÓXIMOS 30 DÍAS            │  ← eyebrow uppercase mono 11px en --text-muted
│ └───┘                               │     icon-tile circular 32-36px:
│                                     │       bg = color-mix(--accent-warm 14%, --surface)
│   $ 1.247.500                       │       border = color-mix(--accent-warm 28%, --surface)
│                                     │       glyph Lucide 16-18px en --accent-warm
│   3 pre-órdenes                     │  ← cifra: --text-primary, text-display, tabular-nums
└─────────────────────────────────────┘     metadata: --text-secondary, text-caption
```

### Mapping token → elemento (vinculante)

| Elemento del card              | Token / receta                                                             | Tier WCAG aplicable                             |
| ------------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------- |
| Card container                 | `--surface` + `--elevation-1`                                              | n/a                                             |
| Eyebrow label (uppercase 11px) | `--text-muted`, `text-eyebrow`                                             | 4.5:1 sobre `--surface` (validado en S3)        |
| **Cifra principal**            | **`--text-primary`, `text-display`, `font-variant-numeric: tabular-nums`** | **13:1+ sobre `--surface` (validado)**          |
| Sub-metadata                   | `--text-secondary`, `text-caption`                                         | 4.5:1 sobre `--surface`                         |
| Icon-tile bg                   | `color-mix(in oklch, var(<accent>) 14%, var(--surface))`                   | 1.4.11 ≥3:1 (non-text)                          |
| Icon-tile border               | `1px solid color-mix(in oklch, var(<accent>) 28%, var(--surface))`         | 1.4.11 ≥3:1                                     |
| Glyph Lucide en tile           | `color: var(<accent>)`, size 16-18px                                       | 1.4.11 ≥3:1 vs tile bg (sólido sobre soft tint) |

`<accent>` = `--accent` para slot 1, `--accent-warm` para slot 2, `--warning` para slot 3, `--success` para slot 4.

### Aplicación a los 4 slots

| Slot | Métrica                | Cifra            | Icon-tile bg                              | Glyph color     | Glyph Lucide sugerido          |
| ---- | ---------------------- | ---------------- | ----------------------------------------- | --------------- | ------------------------------ |
| 1    | Este mes               | `--text-primary` | `color-mix(--accent 14%, --surface)`      | `--accent`      | `wallet` o `trending-up`       |
| 2    | Próximos 30 días       | `--text-primary` | `color-mix(--accent-warm 14%, --surface)` | `--accent-warm` | `calendar-clock` o `hourglass` |
| 3    | Atrasado (condicional) | `--text-primary` | `color-mix(--warning 14%, --surface)`     | `--warning`     | `alert-triangle`               |
| 4    | Llega esta semana      | `--text-primary` | `color-mix(--success 14%, --surface)`     | `--success`     | `package-check` o `truck`      |

Los 4 glyphs deben ser de la misma familia visual (line weight, fill style). Decisión final del glyph queda para S4.

## Justificación

1. **Convergencia masiva** (11+ apps + 6+ artículos): el patrón "cifra neutra + decorador asociado" es estándar de facto en KPI cards modernas.
2. **Resuelve WCAG por construcción** sin tocar `--accent-warm` cross-paleta — el warm vive como **non-text** (icon-tile bg + glyph), donde el mínimo es 1.4.11 ≥3:1, no 4.5:1.
3. **Preserva el carácter "coral cálido vibrante"** del `--accent-warm` (`directions.md` §4.4 + ADR 0003 D1) sin oscurecerlo a marrón rojizo.
4. **Diferenciación del slot 2** queda asegurada por 4 vectores independientes:
   - El glyph Lucide específico (distinto del slot 1).
   - El color del glyph y del tile (warm vs indigo).
   - La posición fija (segunda columna).
   - El label "Próximos 30 días".
     Pintar la cifra agregaría un 5to vector redundante a costo de romper AA.
5. **Compatible con regla de oro** `tokens.md` §10 ("máx 3-4 tokens cromáticos visibles por pantalla"): los 4 hues funcionan como acentos puntuales en tiles 32-36px, no como tintes de superficie ni de cifra.
6. **Decálogo §9 ("dato como héroe")**: la cifra es lo más legible posible — `--text-primary` da 13:1+, vs warm que da 3.01:1 marginal.
7. **Decálogo §1 (light + dark hermanos)**: el tile soft-tint funciona idénticamente en ambos modos por la receta `color-mix` con `--surface` actual de la paleta.

## Cómo refina ADR 0001 D8

ADR 0001 D8 dice "Color: `--accent-warm` coral" para el slot 2. Esta era una asignación abstracta que no especificaba **a qué elemento** se aplicaba el color.

ADR 0005 **interpreta y materializa** la decisión D8:

- "Color funcional del slot 2 = `--accent-warm`" se interpreta como **color del decorador** (icon-tile bg via `color-mix 14%` + glyph sólido).
- La cifra del slot va en `--text-primary`.
- El patrón se generaliza a los 4 slots para coherencia visual.

Esto **no contradice** D8 — la enriquece con la receta concreta. ADR 0001 D8 sigue siendo válido como contrato del **set de 4 micro-stats con sus 4 colores funcionales asignados**; ADR 0005 define **cómo se aplica cada color** en cada card.

## Confianza

**Alto.** 11 apps + 6 artículos + 4 contraargumentos resueltos. La decisión sobrevivió a:

1. "¿Pierde diferenciación visual del slot 1?" → resuelto: 4 vectores independientes de diferenciación (glyph, color, posición, label).
2. "¿El icon-tile 32px es muy chico vs Apple Health Rings?" → refinamiento del patrón a tile circular soft-tint con glyph adentro (no sólo mini-ícono al lado).
3. "¿Se siente apagado con 4 cifras neutras?" → el ritmo cromático lo aportan los 4 tiles, no las cifras (referencias: Stripe, Linear, Vercel KPIs).
4. "¿Por qué no oscurecer `--accent-warm` cross-paleta?" → destruye el carácter coral + genera deuda visual fragmentada.

## Costo

- **Bajo.** El patrón se materializa en S4 cuando se cree el componente core `<MicroStatCard>` con prop obligatoria `accentToken: '--accent' | '--accent-warm' | '--warning' | '--success'`.
- No requiere tokens nuevos (reusa `--accent`, `--accent-warm`, `--warning`, `--success`, `--surface`, `--text-primary`, `--text-secondary`, `--text-muted`, `--text-eyebrow`).

## Rollback

Si validación humana paralela a S3 (Validation #1 — test de 5 segundos sobre el dashboard) muestra que <70% de usuarios identifican "tracking de pagos/colección", reabrir y considerar:

- Subir el mix del icon-tile bg de 14% a 20% para más presencia cromática.
- Sumar sparkline mini debajo de la cifra (al estilo Stripe).
- Considerar opción (c) — chip warm envolviendo el label superior.

## Riesgos abiertos

1. **Daltonismo (deuteranopia/protanopia):** los 4 tiles indigo/coral/ámbar/verde podrían colapsar a 2-3 zonas perceptuales. Mitigación: los 4 slots tienen labels y glyphs distintos — la diferenciación NO depende del color. Validar en S4 con simulador (gap §12 de `tokens.md`).
2. **Confusión tile vs chip status:** el icon-tile decorativo y los chips de status (success/warning/info) usan ambos `color-mix 14%`. Mitigación: el icon-tile es **circular**; los chips status son **pill horizontales con texto**. Forma + posición diferencian roles.
3. **Mobile 360px:** un grid de 4 stats con icon-tile 32-36px puede desbordar. Mitigación: `< sm` colapsa a 2x2; el icon-tile baja a 28-32px.
4. **Lilac warm tile bg vs `--surface`:** Lilac warm L=0.72 puede dar marginal 2.x:1 en tile soft. Mitigación: si en cross-paleta validation alguna paleta no llega a 3:1, subir mix a 18% o 20% para esa paleta — la receta lo permite sin tocar el token.
5. **Regresión silenciosa:** un dev en S6 podría reemplazar el icon-tile por un mini-ícono solo. Mitigación: el componente core `<MicroStatCard>` en S4 fija la receta; cualquier desviación requiere ADR.

## Próximos pasos

1. `tokens.md` §1.4 + §10 actualizados con la regla "icon-tile circular soft-tint" como **patrón canónico** del `--accent-warm` (✅ aplicado en este cierre).
2. `tokens-css.md` §10 nuevo — receta vinculante del icon-tile (✅ aplicado).
3. S4 implementa `<MicroStatCard>` con prop `accentToken` y la receta del icon-tile + cifra `--text-primary` + label + glyph.
4. S6 cuando haga alta fidelidad del dashboard, valida visualmente el ritmo cromático.
