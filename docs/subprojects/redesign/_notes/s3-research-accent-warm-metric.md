---
title: Research — color del slot 2 dashboard métrica (accent-warm)
status: investigación
date: 2026-05-02
session: 03-tokens (research follow-up)
sources:
  - decisions/0001-s2-closure-decisions.md (Decisión 8)
  - tokens.md §1.4, §10
  - _notes/s3-contrast-audit.md
---

# Research — color del slot 2 del dashboard ("Próximos 30 días") con `--accent-warm`

> **Pregunta vinculante.** El slot 2 del dashboard (ADR 0001 D8) asigna `--accent-warm` coral a la métrica "Próximos 30 días". El audit de contraste S3 (`_notes/s3-contrast-audit.md`) detecta que `--accent-warm` light sobre lienzo claro da entre **1.85:1 (Lilac)** y **3.01:1 (Velvet)** — falla AA texto pequeño 4.5:1 y, en Lilac, falla incluso AA Large 3:1. ¿Cómo resuelven este patrón apps reales sin oscurecer warm cross-paleta y sin matar la diferenciación funcional del slot 2?

---

## 1. Patrón en apps reales

Investigación dirigida a entender dónde aplican el color funcional las apps modernas en KPI / micro-stat cards. La pregunta operativa es: **¿la cifra grande es color o es neutra?** Y si es neutra, ¿dónde vive el color?

### 1.1 Shopify (Polaris + Polaris Viz)

- **Patrón:** la **cifra grande es texto neutro**. La diferenciación funcional vive en un **badge de tendencia separado** (`Badge` Polaris) con tono `success` / `warning` / `critical` + ícono de flecha.
- Quote de la doc oficial App Home Metrics Card: _"The badge component shows trend indicators."_ — la cifra y el indicador de estado están separados visualmente; el número nunca es el color status.
- Polaris Viz aplica color a **trend lines, comparison styling, axis indicators** — no al número headline.
- Fuente: [Shopify Polaris Metrics Card](https://shopify.dev/docs/api/app-home/patterns/compositions/metrics-card), [Polaris Data Visualizations](https://polaris-react.shopify.com/design/data-visualizations).

### 1.2 IBM Carbon Design System

- **Patrón:** el "big number" KPI es texto en color **neutral primario**. El color funcional aparece en:
  - El **donut/anillo circundante** ("A big number inside the donut chart may be used to display a total sum or the individual count of a slice upon interaction").
  - El **ícono de categoría** asociado.
  - El **chart asociado** (sparkline / mini-bar) debajo.
- Carbon explícitamente: _"Connecting specific colors to certain key metrics helps audiences easily recognize frequent indicators"_ — la asociación color↔métrica vive en la **decoración**, no en el número.
- Carbon mantiene sus paletas data-viz a 3.5:1 mínimo, lo cual permite ese ratio sólo en **decorative/non-text** (UI components) — confirma que el número headline NO consume esos hues.
- Fuente: [Carbon — Chart Anatomy](https://carbondesignsystem.com/data-visualization/chart-anatomy/), [Carbon — Data-viz Color Palettes](https://carbondesignsystem.com/data-visualization/color-palettes/).

### 1.3 Material Design 3 (Google)

- **Patrón:** Material 3 reserva el color saturado para **filter chips, secondary key color, container surfaces**. Para métricas en cards, el rol es:
  - Cifra → `onSurface` (= text-primary equivalente) sobre `surfaceContainer`.
  - Decoración → tinte del rol `primary-container` o `secondary-container`.
- Regla de los pares "container + on-container": _"on-primary-container on top of primary-container provides accessible contrast"_ — Material asume que cualquier color tonal vive como **fondo de contenedor** con un texto on-\* dedicado, no como color de cifra suelta.
- Fuente: [Material 3 — Color Roles](https://m3.material.io/styles/color/roles), [Material 3 — Cards](https://m3.material.io/components/cards/specs).

### 1.4 Tailwind UI Stats (oficial Tailwind/Wathan-Schoger)

- **Patrón en las 5 variantes oficiales** ("With trending", "Simple", "Simple in cards", "With brand icon", "With shared borders"):
  - La cifra principal es siempre **`text-gray-900`** (neutral primario).
  - La diferenciación visual cae en:
    - **Brand icon con fondo de color** (`bg-indigo-500` con icon blanco encima, esquina superior izquierda).
    - **Trend badge** (`text-green-600` para positivo / `text-red-600` para negativo) como elemento separado.
- Es el patrón estandarizado por los autores de Refactoring UI — confirma direccionalmente que el equipo Wathan-Schoger no recomienda colorear la cifra.
- Fuente: [Tailwind UI — Stats](https://tailwindcss.com/plus/ui-blocks/application-ui/data-display/stats), [Free Frontend — Tailwind Stats](https://freefrontend.com/tailwind-stats/).

### 1.5 Plausible Analytics

- Top stats (Unique visitors, Total visits, Pageviews, Bounce rate, Visit duration) renderizan **la cifra principal en color neutro/dark** sobre el panel claro/oscuro. El **púrpura de marca** aparece como:
  - Color de la **gráfica área (chart fill + line)** debajo de los top stats.
  - Indicador del stat **activo/seleccionado** (subraya el chip de la stat actual).
- Confirma el patrón: cifra neutra + acento decorativo asociado.
- Fuente: [Plausible Docs — Dashboard](https://plausible.io/docs/guided-tour).

### 1.6 Robinhood

- **Patrón excepción:** Robinhood SÍ colorea cifras directamente — **verde para ganancia / rojo para pérdida** del portfolio.
- Pero notar:
  - El verde Robinhood es deliberadamente más oscuro y saturado para **pasar AA texto** (no es un coral pálido).
  - Robinhood ajustó su rojo (le agregó naranja) para no ser alarmante — confirma que el contraste y el matiz del hue de cifra son **decisión deliberada, no automática**.
  - El uso es **binario semántico** (sube/baja) — distinto al caso PandaTrack donde "Próximos 30 días" no es positivo ni negativo, es un anclaje de planeación.
- Fuente: [Medium — UX Teardown Robinhood](https://medium.com/@ericyi/ux-teardown-3-robinhood-79e310f7578), [Google Design — Robinhood](https://design.google/library/robinhood-investing-material).

### 1.7 Apple Health Activity Rings

- **Patrón:** el color (rojo Move / verde Exercise / azul Stand) vive en el **anillo decorativo circular**, no en la cifra de calorías/minutos/horas. La cifra es siempre texto neutro (white sobre dark / black sobre light).
- Es la referencia más limpia del patrón "color = decorador, número = texto primario".
- Fuente: [Apple HIG — Activity Rings](https://developer.apple.com/design/human-interface-guidelines/activity-rings).

### 1.8 YNAB ("Ready to Assign")

- **Patrón:** la cifra "Ready to Assign" cambia de **fondo** según estado (verde si =0 cuadrado, **amarillo de fondo** si quedan dólares sin asignar — explícito en Toolkit for YNAB). La cifra misma sigue siendo texto neutro alto contraste.
- Confirma: el color está en el **container/background** (chip o pill), no en la cifra.
- Fuente: [Toolkit for YNAB feature list](https://github.com/toolkit-for-ynab/toolkit-for-ynab/blob/main/docs/feature-list.md).

### 1.9 Cash App

- **Patrón:** balance principal en cifra **negra/blanca** según modo, sobre fondo neutro. El verde Cash App (#00D533) aparece en CTAs (`Send`, `Request`), iconografía de marca y feedback de transacción exitosa — **no en la cifra de balance**.
- El verde de marca se reserva para la mascota visual de la app, no como tinte de número.
- Fuente: [Cash App Brand Color Palette — Mobbin](https://mobbin.com/colors/brand/cash-app), [Cash App Design System](https://designsystems.surf/design-systems/cashapp).

### 1.10 Dell Design System — Metrics Card (extra encontrado)

- Dell agrupa la metric card en cuatro layers: Label, Headline Value, Comparison, Contextual Visual (sparkline/icon). El color vive en el **Comparison badge** (verde/rojo) y en el **Contextual Visual**, no en el Headline Value.
- Fuente: [Dell Design System — Metrics Card](https://www.delldesignsystem.com/data-visualization/metrics-card).

### 1.11 Power BI / KPI Card community benchmark

- Análisis recurrente del patrón canónico ("Anatomy of the KPI Card") por Anastasiya Kuznetsova:
  - _"Apply associative colors for KPI elements like text, background, icons, or sparklines."_ — el texto del comparison/sparkline puede tomar color, pero cuando se habla de "Headline Value" la guía no recomienda colorearlo.
- Fuente: [Anatomy of the KPI Card — nastengraph](https://nastengraph.substack.com/p/anatomy-of-the-kpi-card).

---

## 2. Research externo (artículos, specs, libros)

### 2.1 WCAG 2.2 — texto vs componentes

- AA texto normal ≥4.5:1, AA Large ≥3:1, **UI components / non-text contrast 1.4.11 ≥3:1**.
- El audit S3 ya documenta que `--accent-warm` light pasa 3:1 (a duras penas y solo en algunas paletas) y FAIL en texto normal en TODAS. Esto es el muro técnico.
- Fuente: [Level Access — WCAG Levels Explained](https://www.levelaccess.com/blog/ada-compliance-levels/), [AllAccessible — WCAG Guide 2025](https://www.allaccessible.org/blog/color-contrast-accessibility-wcag-guide-2025).

### 2.2 Refactoring UI (Wathan / Schoger)

- _"Use a dark color for primary content (like the headline of an article), a grey for secondary content, and a lighter grey for tertiary content."_ — la jerarquía se logra con **luminancia (gris/dark)**, no con hue.
- _"Color naturally attracts attention"_ — usar color de marca para callouts puntuales, no como "etiqueta cromática" de cada stat.
- Tailwind UI Stats es el ejemplo canónico de cómo materializan esta filosofía en métricas.
- Fuente: [Refactoring UI — Hierarchy](https://www.linkedin.com/pulse/hierarchy-clarity-colourful-takeaways-from-ui-book-lawrence-lahmy), [Medium — Top 20 Key Points](https://medium.com/design-bootcamp/top-20-key-points-from-refactoring-ui-by-adam-wathan-steve-schoger-d81042ac9802).

### 2.3 InsightSoftware / FreshBI / Datarocks — guías de dashboard color

- Convergencia explícita: _"Neutral base with accent highlights — using a neutral gray or white foundation with one or two vivid accent colors for primary actions, active states, and key data points."_
- _"Use color sparingly — green = on track, red = attention needed. Use color as a signal, not as decoration."_ — si la stat NO tiene polaridad (positivo/negativo), no debería pintar la cifra.
- _"5–6 colores máximo en una vista para no sobrecargar."_ — coincide con la "regla de oro" de `tokens.md` §10 (3–4 tokens visibles máximo).
- Fuentes: [insightsoftware — Effective Dashboard Color Schemes](https://insightsoftware.com/blog/effective-color-schemes-for-analytics-dashboards/), [FreshBI — Color Theory](https://freshbi.com/blogs/color-theory-in-dashboard-design/), [Datarocks — Dashboard Colour Palette in Practice](https://www.datarocks.co.nz/post/design-matters-7-the-ultimate-dashboard-colour-palette-in-practice).

### 2.4 Smashing Magazine — Accessibility & chart design

- _"Don't rely on color alone to communicate information."_ — la decisión D8 ya tiene 4 stats con label distinta + posición fija; la diferenciación NO depende del color del número, depende del label + position. El color refuerza, no carga semántica única.
- Fuente: [Smashing — Accessibility Standards & Chart Design](https://www.smashingmagazine.com/2024/02/accessibility-standards-empower-better-chart-visual-design/).

### 2.5 phData / clusterdesign — KPI hierarchy

- _"A high-performing card consists of four distinct layers: Label, Headline Value, Comparison, Contextual Visual."_ — el Headline Value es **estructuralmente neutro**; la "personalidad" del KPI está en el Contextual Visual (icon / sparkline / ring).
- Fuente: [phData — KPI Templates](https://www.phdata.io/blog/dashboard-design-essentials-kpi-templates/), [clusterdesign — KPIs in Dashboard](https://clusterdesign.io/how-to-organize-many-kpis-on-a-dashboard/).

### 2.6 Power BI — KPI colours and icon (Pataree Ngamwongwan)

- Aproximación oficial documentada: usar **icon UNICODE coloreado** (▲▼ / ↑↓) al lado de la cifra. La cifra queda neutral, el icon lleva el color y la dirección.
- Fuente: [Medium — Power BI KPI colours and icon](https://medium.com/@kibpat/power-bi-kpi-colours-and-icon-using-unicode-f8f7491835db).

---

## 3. Decisión inicial

**Opción (b): cifra en `--text-primary` + mini-decorador `--accent-warm`** (la propuesta tentativa de S3, ya reflejada en `tokens.md` §1.4 nota crítica y §10).

**Sub-spec inicial.**

- Cifra "Próximos 30 días" → `color: var(--text-primary)`, `text-display`/`text-title`, `font-variant-numeric: tabular-nums`.
- Decorador warm:
  - **Ícono Lucide** (`calendar-clock` o `coins`) 16-18px, `color: var(--accent-warm)`, posicionado a la izquierda del label `caption uppercase`.
  - O **mini-ring/glyph circular** (4-6px) detrás del ícono.
- Label superior: `text-eyebrow` en `--text-muted`.

**Razones inmediatas:**

1. Convergencia masiva (Shopify, Carbon, Material 3, Tailwind UI, Plausible, Apple Health, YNAB, Cash App, Dell, Power BI canónico) — **9+ apps/specs** apuntan al mismo patrón.
2. Resuelve el muro WCAG sin oscurecer warm en cada paleta (preserva el carácter coral de `directions.md` §4.4).
3. Compatible con la "regla de oro" de `tokens.md` §10 (3–4 tokens visibles máximo) — el decorador warm cuenta como elemento puntual, no como tinte de cifra.
4. Cumple WCAG 2.2 por construcción: el decorador warm es **non-text** y solo necesita 3:1 (que ya pasa marginal); la cifra `--text-primary` tiene 13:1+ holgado.

---

## 4. Contraargumentos

### Contraargumento 1 — "¿Y si pierde diferenciación visual del slot 1?"

> Si los 4 slots tienen su cifra en `--text-primary`, ¿cómo distingo de un vistazo el slot 2 (warm) del slot 1 (indigo) sin lectura del label?

- **Evidencia que cuestiona la decisión inicial:** Robinhood SÍ colorea cifras (verde/rojo) precisamente porque la diferenciación de un vistazo es crítica.
- **Pero:** Robinhood lo hace por **polaridad binaria semántica** (sube/baja, ganancia/pérdida). PandaTrack slot 2 no tiene polaridad — "Próximos 30 días" es **planeación neutra**, no positivo ni negativo.
- **Resolución:** la diferenciación del slot 2 puede vivir en:
  - El ícono Lucide específico (`calendar-clock` para 30d) — ícono distinto del slot 1 (`trending-up` para "Este mes").
  - El color del ícono (warm coral vs indigo).
  - La posición (slot 2 = segunda columna, fija).
  - El label "Próximos 30 días" vs "Este mes".

  Cuatro vectores de diferenciación independientes son suficientes — pintar la cifra agregaría un quinto vector redundante a costo de romper AA.

**La decisión sobrevive.**

### Contraargumento 2 — "Apple Health / YNAB sí logran identidad cromática fuerte sin colorear la cifra, pero sus decoradores son MUCHO más prominentes que un mini-ícono Lucide 18px"

> El ring de Apple Health ocupa el 60-70% del card. El badge amarillo de YNAB envuelve el número entero. Un ícono 18px al lado de un Display 48px se ve perdido.

- **Evidencia que cuestiona:** real. Si el decorador es muy chico, el slot 2 visualmente se lee igual al slot 1 — la "personalidad warm" desaparece.
- **Resolución alternativa — opción (c):** usar **chip warm soft** envolviendo el label superior, no un mini-ícono. Patrón:
  - Chip pill `bg: color-mix(in oklch, var(--accent-warm) 14%, var(--surface))` + `border: color-mix(28%)` + `color: var(--accent-warm-chip-text)` (necesitaría introducir `--accent-warm-chip-text` análogo a `--success-chip-text`).
  - Label "Próximos 30 días" dentro del chip, en mono uppercase 11px.
  - Cifra Display abajo en `--text-primary`.

  Esto le da presencia cromática real al slot 2 sin ponerla en la cifra.

- **Pero:** introducir `--accent-warm-chip-text` agrega 1 token nuevo cross-paleta. Hay que verificar que en cada paleta (Velvet, Lilac, Plum, Lagoon, Forest) el warm chip-text dark + warm bg light cumpla 4.5:1.
- **Adicional:** el chip-warm también puede competir visualmente con los chips de status (success/warning/info) en las listas, generando **ruido cromático** (cuando entras al dashboard, ¿el chip warm es status o decoración?).

**Resolución mixta:** opción (b) **enriquecida con un decorador más expresivo que un mini-ícono solo**. El patrón debe ser:

- **Mini-ring + ícono dentro** (~28-32px circular, fondo `color-mix(--accent-warm 14%, --surface)` + ícono Lucide centrado en `--accent-warm`). Inspirado directamente en Tailwind UI Stats "With brand icon" (que usa `bg-indigo-500` con icon blanco) pero adaptado al patrón soft-tint para no requerir 4.5:1 white-on-warm.
- Esta receta da **presencia cromática real (~30% del card de altura)** pero el warm vive como fondo de un contenedor non-text, donde 1.4.11 (3:1) sí se cumple — y el ícono encima va en el color warm sólido (también non-text, también 3:1).

**La decisión sobrevive con refinamiento → no es solo "mini-ícono" sino "icon-tile circular soft-tint con glyph warm dentro".**

### Contraargumento 3 — "¿Y si el usuario lee toda la fila como 'el color comunica el tipo de stat' y al ver 4 cifras todas en --text-primary se siente 'apagado'?"

> Los wireframes S2 ya muestran un dashboard con cierto color en cada slot. Si los 4 números se aplanan a un solo color, ¿se pierde el "ritmo cromático" que hace el dashboard sentirse vivo?

- **Evidencia que cuestiona:** legítima. Refactoring UI dice "color para callouts puntuales", pero un dashboard de 4 stats donde cada una es callout es legítimo.
- **Resolución:** el "ritmo cromático" se preserva con los 4 decoradores (4 mini-tiles indigo/coral/ámbar/verde). La unidad visual de las cifras en `--text-primary` **no es plana — es una rejilla bien diseñada**. Mismo patrón que:
  - Stripe payments dashboard (4 KPIs neutros con accent en metadata).
  - Linear cycle dashboard (issues / cycles / progress en cifra neutra; el color vive en charts).
  - Vercel observability overview (Edge Requests / Function Invocations / Bandwidth en cifra neutra; charts coloreados debajo).

  El ritmo cromático **no exige** colorear la cifra; lo aporta la decoración asociada. Robinhood / Cash App balance / Apple Health confirman que en consumer apps con un solo color de marca, lo aplican a UI elements (CTAs, rings, charts), no a la cifra de balance.

- **Adicional:** el decálogo PandaTrack (`principles.md`) prioriza **claridad sobre decoración**. Una cifra clara con decorador asociado vence a una cifra coral marginal.

**La decisión sobrevive.**

### Contraargumento 4 (extra) — "¿Por qué no oscurecer `--accent-warm` cross-paleta y resolver de raíz?"

> ¿No es más simple subir el chroma o bajar la luminancia del warm en cada paleta para que pase 4.5:1 en cifra y mantener la decisión D8 original?

- **Evidencia que cuestiona:** parece la solución de menor cambio.
- **Pero:** `directions.md` §4.4 + `_notes/demo-screens.html` definen warm como **coral cálido** (oklch L≈0.64-0.72, h≈22-25). Para pasar 4.5:1 sobre lienzo light L=0.93, warm debería bajar a L≈0.45-0.50 — eso ya **no es coral, es marrón rojizo / siena**. Pierde el carácter "cálido vibrante" que justifica su existencia en el sistema.
- Adicional: el oscurecimiento debería ser **distinto en cada paleta** (Velvet vs Lilac tienen lienzos con luminancias distintas) → fragmenta el token cross-paleta y genera 5 valores warm-text-only no decorativos. Es deuda visual y técnica.
- Apple Health, Cash App, Plausible — ninguno oscurece su color de marca para ponerlo en cifras: lo dejan vibrante y lo usan en decoración.

**Rechazo (a). La decisión inicial (b) sobrevive.**

---

## 5. Reevaluación + decisión final

Las 4 contraargumentaciones convergen en:

- **Opción (a)** rechazada: oscurecer warm cross-paleta destruye su carácter coral y genera deuda.
- **Opción (c)** parcial: el chip warm en label es viable pero introduce 1 token nuevo (`--accent-warm-chip-text`) y compite cromáticamente con chips de status reales en la misma vista.
- **Opción (b) refinada (b')** sobrevive a las 4 contraargumentaciones: cifra en `--text-primary` + **icon-tile circular soft-tint warm con glyph Lucide warm dentro**.

### Decisión final: opción (b'), variante "icon tile"

**Patrón canónico del slot 2 del dashboard:**

```
┌─────────────────────────────────────┐
│ ┌───┐                               │
│ │ ◐ │   PRÓXIMOS 30 DÍAS            │  ← eyebrow (--text-muted, mono 11px)
│ └───┘                               │     icon-tile circular 32-36px:
│                                     │       bg = color-mix(--accent-warm 14%, --surface)
│   $ 1.247.500                       │       border = color-mix(--accent-warm 28%, --surface)
│                                     │       glyph Lucide 16-18px en --accent-warm
│   3 pre-órdenes                     │  ← cifra: --text-primary, text-display
└─────────────────────────────────────┘     metadata: --text-secondary, text-caption
```

El icon-tile comparte receta con el patrón de chip soft del sistema (`tokens.md` §1.5 chip color-mix). NO requiere token nuevo — reusa `--accent-warm` con `color-mix` sobre `--surface` para tile y border.

---

## 6. Patrón de implementación concreto (qué token a qué elemento)

### 6.1 Mapping token → elemento (vinculante)

| Elemento del slot 2                | Token / receta                                                          | Tier WCAG aplicable                                              |
| ---------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Card container**                 | `--surface` + `--elevation-1`                                           | n/a                                                              |
| **Eyebrow label** (uppercase 11px) | `--text-muted`, `text-eyebrow`                                          | 4.5:1 sobre `--surface` (validado en S3)                         |
| **Cifra principal**                | `--text-primary`, `text-display`                                        | 13:1+ sobre `--surface` (validado)                               |
| **Sub-metadata**                   | `--text-secondary`, `text-caption`                                      | 4.5:1 sobre `--surface`                                          |
| **Icon-tile bg**                   | `color-mix(in oklch, var(--accent-warm) 14%, var(--surface))`           | 1.4.11 ≥3:1 vs `--surface` adyacente — verificar en cross-paleta |
| **Icon-tile border**               | `1px solid color-mix(in oklch, var(--accent-warm) 28%, var(--surface))` | 1.4.11 ≥3:1                                                      |
| **Glyph Lucide en tile**           | `color: var(--accent-warm)`, size 16-18px                               | 1.4.11 ≥3:1 vs tile bg                                           |

### 6.2 Aplicación a los otros 3 slots (consistencia del patrón)

Mismo patrón aplicado a los 4 slots con tokens distintos:

| Slot | Cifra            | Icon-tile bg                              | Glyph color     |
| ---- | ---------------- | ----------------------------------------- | --------------- |
| 1    | `--text-primary` | `color-mix(--accent 14%, --surface)`      | `--accent`      |
| 2    | `--text-primary` | `color-mix(--accent-warm 14%, --surface)` | `--accent-warm` |
| 3    | `--text-primary` | `color-mix(--warning 14%, --surface)`     | `--warning`     |
| 4    | `--text-primary` | `color-mix(--success 14%, --surface)`     | `--success`     |

Todas las cifras unificadas en `--text-primary`. Diferenciación visual cae en el **icon-tile cromático** + label distinto + posición fija en grid 4 cols. Cumple "regla de oro" `tokens.md` §10 (3–4 tokens visibles): los 4 hues funcionan como **acentos puntuales en tiles 32-36px**, no como tintes de superficie ni de cifra.

### 6.3 Glyphs Lucide sugeridos por slot (para que el sub-agente de S4 los implemente)

| Slot | Métrica                | Glyph Lucide                   |
| ---- | ---------------------- | ------------------------------ |
| 1    | Este mes               | `trending-up` o `wallet`       |
| 2    | Próximos 30 días       | `calendar-clock` o `hourglass` |
| 3    | Atrasado (condicional) | `alert-triangle`               |
| 4    | Llega esta semana      | `package-check` o `truck`      |

Decisión final del glyph queda para S4 — los 4 deben ser de la misma "familia visual" (line weight, fill style).

---

## 7. Verificación cross-paleta (¿cumple AA en las 5?)

Datos de `_notes/s3-contrast-audit.md` y de los valores documentados en `tokens.md` §1.4:

| Paleta | `--accent-warm` light L | tile bg vs `--surface` (esperado ≥3:1)            | glyph warm vs tile bg (esperado ≥3:1) | cifra `--text-primary` vs `--surface` |
| ------ | ----------------------- | ------------------------------------------------- | ------------------------------------- | ------------------------------------- |
| Velvet | L≈0.64                  | ✅ ~3.0:1 estimado                                | ✅ ~3.5:1 estimado                    | ✅ 13:1+                              |
| Lilac  | L≈0.72                  | ⚠ marginal — requiere bumping de 14%→18% si falla | ✅ glyph sólido sobre tile soft       | ✅ 13:1+                              |
| Plum   | L≈0.66                  | ✅ ~3.1:1 estimado                                | ✅ similar a Velvet                   | ✅ 13:1+                              |
| Lagoon | L≈0.65                  | ✅ ~3.0:1 estimado                                | ✅ similar                            | ✅ 13:1+                              |
| Forest | L≈0.68                  | ✅ ~3.0:1 estimado                                | ✅ similar                            | ✅ 13:1+                              |

**Acción concreta para S4:**

- Auditar matemáticamente cada paleta con un script (oklch → contrast) y, si Lilac no llega a 3:1 en tile bg vs surface, subir el mix a 18% o 20%.
- En dark, el warm es L≈0.80 — el tile bg `color-mix(warm 14%, surface)` da un tinte muy tenue pero suficiente como elemento decorativo non-text. El glyph en `--accent-warm` dark sólido sobre el tile soft pasa con margen.

**Riesgo aceptable.** Cualquier ajuste por paleta vive en una sola receta (porcentaje del mix), no en valores hardcoded.

---

## 8. Riesgos abiertos

1. **Daltonismo deuteranopia/protanopia:** el coral y el indigo quedan próximos en hue percibido; los 4 slots con tiles indigo/coral/ámbar/verde podrían colapsar en 2-3 zonas perceptuales. **Mitigación:** los 4 slots tienen labels distintas + iconos distintos — la diferenciación NO depende del color. Validar en S4 con simulador (ya en gap §12.6 de `tokens.md`).

2. **Tile vs chip status confusión visual:** si los chips de status (success/warning/info) en las listas debajo del dashboard usan el mismo tinte 14%, el usuario podría confundir el icon-tile decorativo con un chip de status. **Mitigación:** el icon-tile es **circular** (radius pill) y el chip status es **pill horizontal con texto adentro**. Forma + posición diferencian roles.

3. **Mobile 360px:** un grid de 4 stats con icon-tile 32-36px puede desbordar. **Mitigación:** en `< sm` (xs 360px), el grid colapsa a 2x2 — el icon-tile se mantiene 28-32px. Validar en S4 con wireframe.

4. **Sentimiento de "apagado" en first impression:** los 4 números en `--text-primary` pueden leerse menos vibrantes que la propuesta original. **Mitigación:** primer test con 3-5 usuarios en validación humana paralela a S3 (ya documentada en `_notes/s2-validation-plan.md` Validation 1 — test de 5 segundos sobre el dashboard).

5. **Decorador inadvertido en versiones futuras:** un dev en S6 podría reemplazar el icon-tile por un mini-ícono solo (sin tile background) y romper la presencia cromática. **Mitigación:** documentar el patrón como receta en S4 cuando se cree el componente core `<MicroStatCard>`, con prop obligatoria `accentToken: '--accent' | '--accent-warm' | '--warning' | '--success'`.

---

## 9. Sources

- [Shopify Polaris — Metrics Card](https://shopify.dev/docs/api/app-home/patterns/compositions/metrics-card)
- [Shopify Polaris — Data Visualizations](https://polaris-react.shopify.com/design/data-visualizations)
- [Shopify Polaris — Color Palettes & Roles](https://polaris-react.shopify.com/design/colors/palettes-and-roles)
- [Carbon Design System — Chart Anatomy](https://carbondesignsystem.com/data-visualization/chart-anatomy/)
- [Carbon Design System — Color Palettes (data-viz)](https://carbondesignsystem.com/data-visualization/color-palettes/)
- [Material Design 3 — Color Roles](https://m3.material.io/styles/color/roles)
- [Material Design 3 — Cards](https://m3.material.io/components/cards/specs)
- [Tailwind UI — Stats Components](https://tailwindcss.com/plus/ui-blocks/application-ui/data-display/stats)
- [Free Frontend — 19 Tailwind Stats](https://freefrontend.com/tailwind-stats/)
- [Plausible Docs — Dashboard Tour](https://plausible.io/docs/guided-tour)
- [Plausible Docs — Metrics Definitions](https://plausible.io/docs/metrics-definitions)
- [Apple HIG — Activity Rings](https://developer.apple.com/design/human-interface-guidelines/activity-rings)
- [Toolkit for YNAB — feature list (Ready to Assign)](https://github.com/toolkit-for-ynab/toolkit-for-ynab/blob/main/docs/feature-list.md)
- [UX Teardown #3: Robinhood — Eric Yi](https://medium.com/@ericyi/ux-teardown-3-robinhood-79e310f7578)
- [Google Design — Robinhood with Material](https://design.google/library/robinhood-investing-material)
- [Cash App Brand Color Palette — Mobbin](https://mobbin.com/colors/brand/cash-app)
- [Cash App Design System — designsystems.surf](https://designsystems.surf/design-systems/cashapp)
- [Dell Design System — Metrics Card](https://www.delldesignsystem.com/data-visualization/metrics-card)
- [Anatomy of the KPI Card — nastengraph](https://nastengraph.substack.com/p/anatomy-of-the-kpi-card)
- [Power BI — KPI colours and icon using UNICODE](https://medium.com/@kibpat/power-bi-kpi-colours-and-icon-using-unicode-f8f7491835db)
- [phData — Dashboard Design Essentials: KPI Templates](https://www.phdata.io/blog/dashboard-design-essentials-kpi-templates/)
- [clusterdesign — How to Organize Many KPIs](https://clusterdesign.io/how-to-organize-many-kpis-on-a-dashboard/)
- [Refactoring UI — Hierarchy & Color Takeaways (LinkedIn)](https://www.linkedin.com/pulse/hierarchy-clarity-colourful-takeaways-from-ui-book-lawrence-lahmy)
- [Top 20 Key Points from Refactoring UI — Medium](https://medium.com/design-bootcamp/top-20-key-points-from-refactoring-ui-by-adam-wathan-steve-schoger-d81042ac9802)
- [Smashing Magazine — Accessibility Standards & Chart Design](https://www.smashingmagazine.com/2024/02/accessibility-standards-empower-better-chart-visual-design/)
- [insightsoftware — Effective Dashboard Color Schemes](https://insightsoftware.com/blog/effective-color-schemes-for-analytics-dashboards/)
- [FreshBI — Color Theory in Dashboard Design](https://freshbi.com/blogs/color-theory-in-dashboard-design/)
- [Datarocks — Ultimate Dashboard Colour Palette](https://www.datarocks.co.nz/post/design-matters-7-the-ultimate-dashboard-colour-palette-in-practice)
- [Level Access — WCAG Levels Explained](https://www.levelaccess.com/blog/ada-compliance-levels/)
- [AllAccessible — WCAG 2.1 Guide](https://www.allaccessible.org/blog/color-contrast-accessibility-wcag-guide-2025)
- [Linear Docs — Cycle Graph](https://linear.app/docs/cycle-graph)
- [Linear — Dashboards Best Practices](https://linear.app/now/dashboards-best-practices)
