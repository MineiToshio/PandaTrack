---
title: ADR 0006 — Contrato icon+label para `--info` y `--accent-cool` (mitigación daltonismo)
date: 2026-05-02
status: accepted
session: 03-tokens (research follow-up)
owner: Sergio Minei
refines: sistema de tokens del subproyecto §1.4, §1.5, §10, §12 (histórico)
sources: redesign subproject — S3 colorblind/info research note (historical)
---

# ADR 0006 — Contrato icon+label para `--info` y `--accent-cool`

## Contexto

El sistema de tokens S3 (`docs/design/tokens-css.md`) define dos tokens azulados que pueden coexistir en la misma row:

- `--info` (status semántico, h245 azul franco): chip "Pendiente sin urgencia" + ícono Lucide `clock`.
- `--accent-cool` (acento secundario sereno, h215 azul-gris suave): íconos Lucide de categoría.

ΔE perceptual entre ambos en visión tricromática estándar es suficiente (Δh = 30°). **Pero** en deuteranopia / protanopia (~6% de hombres CIS combinados, ~0.5% de mujeres), ambos colapsan a tonos muy similares — el riesgo de confusión visual es real.

S3 documentó este riesgo en el sistema de tokens §12 y en el red-team del subproyecto, objeción #3 (histórico). Quedó como riesgo abierto hasta validación.

## Datos del research follow-up

Agente B (research de daltonismo/info del subproyecto, histórico) investigó:

- **Brettel/Viénot/Mollon (1997)** — modelo de transformación dichromat: en deutan/protan ambos hues h215 y h245 caen del mismo lado del _neutral point_ (498nm) y se proyectan al mismo cuadrante de la _confusion plane_. Δh = 30° vs Δh = 15° es **estructuralmente irrelevante post-proyección**.
- **5 design systems revisados** (Material Design 3, IBM Carbon, Shopify Polaris, Atlassian Design, GitHub Primer) — **ninguno usa dos hues azules**. Todos resuelven con un solo blue + acento secundario en otra familia cromática (purple, magenta).
- **WCAG 1.4.1 (Use of Color, Level A)** — exige que la información NO se transmita sólo por color. Ícono + label de texto adyacente es mitigación válida y suficiente para usuarios dichromat.

Tres opciones evaluadas y descartadas:

- (b) Mover `--info` a h255-260 (más cerca de violeta) → costos: pisa `--accent` Velvet h290 visualmente, sigue colapsando en deutan/protan.
- (c) Mover `--info` a h195-205 (cyan-teal franco) → costos: pierde semántica "azul informativo", choca con paletas alternativas (Lagoon `--accent` h195).
- (d) Bajar croma de `--accent-cool` a 0.04 (cuasi gris) → costos: mata identidad de íconos de categoría, rompe armonía Velvet.

Conclusión: **mover los hues no resuelve el problema de raíz**. La única solución robusta es **formalizar la mitigación ícono + label como contrato del sistema**, con enforcement técnico esperado en S4/S12.

## Decisión

**Mantener `--info` h245 y `--accent-cool` h215 sin cambios de OKLCH.**

**Formalizar el contrato vinculante "icon + label":**

### Regla 1 — Chip de info SIEMPRE con ícono + label

Cualquier `<StatusChip kind="info">` o equivalente que use el token `--info` (chip background, chip text, ícono) **debe**:

- Renderizar un ícono Lucide identificable (`clock` por default; otros aceptables: `info`, `circle-dashed`, `hourglass`).
- Renderizar un label de texto (no es opcional). Ejemplos: "Pendiente en tienda", "Sin urgencia", "En revisión".
- El ícono y el label son obligatorios — no se permiten chips de info color-only.

### Regla 2 — Íconos de categoría con `--accent-cool` SIEMPRE con label adyacente

Cualquier ícono Lucide de categoría renderizado en `--accent-cool` (`shapes` para figures, `disc` para vinyl, `book-open` para manga, `sparkles` para anime, `gallery-thumbnails` para cards, `package` para plush) **debe**:

- Tener un label de texto **adyacente y legible** (mismo contenedor o muy cerca).
- El label puede ser:
  - El nombre de la categoría ("Vinyl", "Manga", etc.).
  - El nombre del producto que pertenece a esa categoría (cuando el ícono actúa como afijo del producto).
- Nunca renderizar el ícono de categoría aislado sin contexto textual.

### Regla 3 — `--accent-cool` prohibido como background, border o texto

`--accent-cool` se usa **únicamente** como color de ícono o como tinte muy bajo (≤14% mix con `--surface`) en composiciones decorativas no-textuales. **Nunca** como:

- Background de chip.
- Border funcional.
- Color de texto.
- Color de CTA.

Esta restricción evita que `--accent-cool` se confunda visualmente con un chip de status `--info` en deuteranopia/protanopia (ambos serían "azules como fondo de algo").

### Regla 4 — Enforcement técnico esperado en S4/S12

El componente core `<StatusChip>` (S4) debe:

- Tipar el prop `kind` como discriminated union; cuando `kind === 'info'`, exigir prop `icon` (no opcional) e `label` (no opcional).
- TypeScript debe rechazar `<StatusChip kind="info" />` sin esos props.

El sistema de linting (S12) debe:

- Rechazar uso de `var(--accent-cool)` en propiedades CSS `background`, `background-color`, `border-color`, `color` (no íconos), `fill` cuando no esté dentro de un SVG icon-only.

## Justificación

1. **Razón estructural (Brettel/Viénot):** mover los hues no resuelve la confusión post-proyección. La única mitigación robusta es ortogonal al color.
2. **Convergencia con design systems:** ningún sistema mainstream (Material, Carbon, Polaris, Atlassian, Primer) acepta dos azules cercanos como tokens. Todos resuelven con un solo blue + accent en otra familia. El sistema PandaTrack es la excepción — y la asume con un contrato.
3. **WCAG 1.4.1 cumplido:** ícono + label es mitigación suficiente para Level A. El sistema queda compliant.
4. **Costo mínimo:** los wireframes S2 ya usaban íconos + labels en chips de status (ADR 0002 documenta `<StatusChip>` con `icon` por enum). El contrato formaliza algo que ya estaba implícito.
5. **Enforcement técnico:** TypeScript + lint elevan el contrato de "convención" a "imposible de violar accidentalmente". Sin esto, un dev en S6 podría renderizar un chip de info color-only y romper la mitigación.

## Plan de validación humana (informativo, no bloqueante)

1. **Chrome DevTools color vision deficiency emulator:** abrir el demo del subproyecto de rediseño (histórico) en cada paleta + modo, activar emulator deutan/protan/tritan/achromatopsia, validar que el chip "Pendiente en tienda" sigue siendo identificable como status pendiente y que los íconos de categoría siguen leyéndose como categoría (no como status).
2. **Sim Daltonism (macOS) + Coblis (web):** cross-check del paso anterior con segunda herramienta.
3. **Test con usuario real con deuteranopia / protanopia:** programado para S6+ alta fidelidad. Si el usuario reporta que confunde "Pendiente" con un ícono de categoría, escalar revisitando la posición visual o introduciendo patrón visual adicional (rayas, fondo punteado, peso tipográfico distinto del label).

## Confianza

**Alto.** La decisión está respaldada por:

- 1 modelo perceptual canónico (Brettel/Viénot 1997, citado >5000 veces).
- 5 design systems convergentes.
- 1 estándar WCAG (1.4.1) cumplido por construcción.
- Costo de implementación trivial (TS types + lint).

## Costo

- **Trivial.** Sólo enforcement técnico en S4/S12. No requiere cambio de tokens, no requiere cambio de paletas, no requiere cambio de wireframes (los wireframes ya usaban íconos + labels).

## Rollback

Si validación humana en S6+ con usuario dichromat real reporta confusión persistente a pesar del contrato:

- Considerar rayas / patrón de fondo distintivo en el chip de info (visual adicional ortogonal al color).
- Considerar pasar `--accent-cool` a un cuasi-gris (h220 croma 0.04) — sacrificando identidad cromática por seguridad.
- Considerar mover los íconos de categoría de `--accent-cool` a `--text-secondary` (perdiendo el matiz "informativo / categórico" pero eliminando ambigüedad cromática).

Estas alternativas se evalúan sólo si el contrato falla en uso real.

## Implicancias

1. el sistema de tokens §1.4 (acentos) — sumar regla "`--accent-cool`: nunca background, border, texto, CTA. Sólo color de ícono o tinte ≤14%."
2. el sistema de tokens §1.5 (status) — sumar regla "Chip de info SIEMPRE con ícono + label, nunca color-only."
3. el sistema de tokens §10 — ya documenta "`--accent-cool` (azul-gris suave h215) — Sólo color de íconos Lucide de categoría". Reforzar con explicit "siempre con label adyacente".
4. el sistema de tokens §12 — cerrar el riesgo abierto de daltonismo (gap 6) marcándolo como **mitigado por contrato ADR 0006**.
5. El red-team del subproyecto, objeción #3 (histórico) — actualizar con cierre.
6. S4 — componente core `<StatusChip>` consume el contrato vía discriminated union TypeScript.
7. S12 — sumar lint rule `no-accent-cool-as-bg` o equivalente.

## Próximos pasos

1. Aplicar regulaciones a el sistema de tokens §1.4, §1.5, §10, §12 (✅ aplicado en este mismo cierre).
2. Actualizar el red-team del subproyecto, objeción #3 (histórico) (✅ aplicado).
3. S4 implementa `<StatusChip>` con TypeScript discriminated union enforce.
4. S12 implementa lint rule.
