---
title: Sesión 03 — Sistema de tokens dual-mode
date: 2026-05-02
status: ✅ done
duration: una corrida desatendida (5 sub-agentes diseño paralelo + consolidación + audit + red team)
---

# S03 — Sistema de tokens dual-mode (Velvet base)

## Qué corrió

1. **Paso 0 — Reconstrucción de contexto.** Lectura en orden de `README.md`, los 3 ADRs (`0001`, `0002`, `0003`), `principles.md`, `directions.md` §4 (Atelier), `direction-chosen.md`, `_notes/atelier-gaps.md`, los 6 wireframes de S2 (extracción de tokens invocados vía grep), `_notes/demo-screens-readme.md`, `_notes/demo-screens.html` (lines 1-220 — definiciones CSS de Velvet + 4 paletas alternativas), `_notes/assumptions-s2.md`, `sessions/02-screens.md`, `_notes/s2-validation-plan.md`. No se detectaron contradicciones nuevas que requirieran un `_notes/s3-conflicts.md`.
2. **Fase 1 — Diseño base de tokens (paralelo).** Se lanzaron **5 sub-agentes `general-purpose` en un solo mensaje**, uno por área independiente. Cada sub-agente recibió un brief auto-contenido (ADR 0001, ADR 0003, tokens de partida del demo HTML, reglas duras, formato de salida obligatorio con tablas light/dark/uso). Cada uno escribió a un buffer `_notes/s3-draft-<area>.md`.
3. **Fase 2 — Consolidación cross-área.** El agente principal integró los 5 borradores en `tokens.md` aplicando consistencia: mismos nombres semánticos en las 5 paletas, status colors compartidos, state layers con receta única, convención Tailwind v4 `@theme`. Resolvió en el camino las 3 decisiones residuales (paleta categórica, `--accent-cool`, `--surface-warm`) y la nueva regla de uso de `--accent-warm` (decorativo-only para resolver el FAIL Lilac).
4. **Fase 3 — Audit de contraste.** Los sub-agentes α (color Velvet) y ε (paletas alternativas) ya entregaron audits parciales. El agente principal los **consolidó** en `_notes/s3-contrast-audit.md` con tabla exhaustiva de 188 pares (5 paletas × 2 modos × ~19 pares por bloque), método explícito (OKLCH → linear-sRGB → luminancia relativa WCAG 2.x), y tabla de ajustes vs demo. **Resultado: 188/188 pass.** Cero pares con FAIL.
5. **Fase 4 — Mapping a CSS / Tailwind v4.** Producido `tokens-css.md` con: bloque `@theme` único, theme overrides light/dark agnósticos a paleta, las 5 paletas via `data-palette` (Velvet default + Lilac/Plum/Lagoon/Forest), state layers reusables, recetas vinculantes para `<StoreAvatar>` (D16), toast neutral-undo (D4), section card disabled-gated (D3), field-as-attribute (D2), y notas de implementación pendientes para S12.
6. **Fase 5 — Red team.** 15 objeciones hostiles auto-generadas en `_notes/s3-red-team.md`, todas resueltas (0 bloqueantes pendientes). Riesgos abiertos no-bloqueantes documentados al cierre.
7. **ADR adicional.** Se creó `decisions/0004-categorical-palette-removal.md` para formalizar la eliminación de la paleta categórica (decisión residual del prompt que cambia el contrato Atelier §4.4 "Reservada").
8. **Fase 6 — Cierre.** Este archivo + actualización de `README.md`.

## Sub-agentes lanzados (tabla)

Lanzados en paralelo en **un solo mensaje** (5 en total, todos `general-purpose`):

| #   | Área                                               | Slug del draft                        | Tokens definidos                                                                              | Notas clave                                                                                                                                                        |
| --- | -------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| α   | Color Velvet light + dark + state layers + status  | `_notes/s3-draft-color.md`            | 19 tokens core + 4 chip-text aliases + 4 state-layer recipes                                  | Ajustó 8 valores vs demo por AA (text-muted L 0.54→0.46, border-strong L 0.74→0.58, info h230→245, etc.). Cerró 3 decisiones residuales. Auto-audit interno.       |
| β   | Typography                                         | `_notes/s3-draft-typography.md`       | 3 familias + 9 tiers de escala + 7 pesos + features por tier + utilities (.numeric, .eyebrow) | Decisión cerrada: Inter Variable + Inter Display + JetBrains Mono Variable. Geist descartado. Comportamiento dark con peso ajustado.                               |
| γ   | Spacing + radius + breakpoints + z-index           | `_notes/s3-draft-spacing.md`          | 17 spacing + 13 layout magic numbers + 7 radius + 6 breakpoints + 13 z-index                  | Promovió layout magic numbers (sidebar/drawer/header/modal widths) a tokens semánticos para evitar literales sueltos. Z-index scale completa hasta tooltip 110.    |
| δ   | Elevation + motion                                 | `_notes/s3-draft-elevation-motion.md` | 4 elevation × 2 modos + 3 duraciones + 4 easings (incl. `--ease-vt-signature` aislado)        | Recetas dark sin sombra real (composición tono + borde + highlight inset + glow accent). Halo achievement como composición ad-hoc, no token.                       |
| ε   | Paletas alternativas (Lilac, Plum, Lagoon, Forest) | `_notes/s3-draft-palettes.md`         | 4 paletas × 14 tokens × 2 modos = 112 valores                                                 | Recalculó borders + texts por hue del lienzo (el demo usaba h≈75 cálido en todas las paletas). Ajustó Lilac accent L 0.60→0.58 y Lagoon accent L 0.58→0.50 por AA. |

Síntesis: el agente principal hizo la pasada de consolidación cross-área, audit consolidado, mapping CSS, red team y cierre.

## Hallazgos clave

1. **El demo HTML no era contrato AA.** Varios valores del demo (text-muted L=0.54, border-strong L=0.74, borders dark con alpha 0.07/0.14, info h230) **fallaban WCAG AA** o estaban perceptualmente comprometidos. S3 los ajustó manteniendo la intención visual del demo. Documentado en `_notes/s3-contrast-audit.md` §6.
2. **`--info` h230 era indistinguible de `--accent-cool` h215** en escenarios cotidianos (chip de info + ícono de categoría en la misma row). S3 movió `--info` a h245 para Δh=30 y agregó la regla operativa "chip de info siempre con ícono `clock` + label" para no depender solo de color.
3. **`--text-on-accent` dark debe ser oscuro, no blanco** — `--accent` dark (L 0.74) sobre blanco da 2.55:1 (FAIL). Romper el patrón mental "botón dark = texto blanco" requiere disciplina en S4 (componente Button) y auditoría en S12 (legacy `text-white` hardcoded).
4. **`--accent-warm` no puede ser color de texto sobre lienzo en paletas claras.** Lilac warm L=0.72 sobre background L=0.975 da 2.46:1 — falla incluso AA Large 3:1. Resuelto reformulando la regla de uso: `--accent-warm` es **decorativo-only** (halo, mini-decorador, tinte de chip soft con texto en `--text-primary`). El "color del slot 2 dashboard" del ADR 0001 D8 se reinterpreta como color del decorador, no de la cifra.
5. **Las 4 paletas alternativas requieren borders + text recalculados al hue del lienzo de cada paleta.** El demo aplicaba un muted h≈75 cálido a todas, generando desarmonía cromática (gris-amarillento sobre fondo lila/plum/turquesa). Recalc por paleta resuelve sin cambiar L.
6. **La paleta categórica nunca se usó en la app real** (cero invocaciones en wireframes S2, cero en demo). Mantenerla "reservada" era deuda técnica. ADR 0004 la elimina formalmente; data-viz V2 diseñará `--chart-1..N` con paleta dedicada.
7. **`--surface-warm` también queda eliminado** — Velvet ya es plomo-violeta cálido, una "warm extra" sería imperceptible y rompería la jerarquía background → surface → surface-elevated. Cuando una sub-card requiera diferenciación cálida se resuelve con state-layer `accent-warm` 14%, no con un cuarto nivel de surface.
8. **La firma view-transition canónica** (ADR 0001 D5) se materializa como **token aislado** `--ease-vt-signature` con regla "sólo `::view-transition-*`, nunca fuera". Auditable por grep.
9. **Las paletas alternativas pueden tener `--accent-cool` con hues distintos** (Velvet h215, Lilac h165, Plum h220, Lagoon h250, Forest h250) sin romper el sistema, siempre que: (a) no colapsen con `--info`, (b) cumplan AA mínimo 3:1 para ícono. Lilac h165 (verde-aguamarina) está deliberadamente fuera del cluster azul — es decisión de marca.

## Decisiones tomadas

### Tokens y paletas

- **Velvet es la paleta default**, valores re-calibrados desde el demo HTML para cumplir AA holgado.
- **4 paletas alternativas** (Lilac, Plum, Lagoon, Forest) con la **misma estructura semántica** (mismos 14 tokens propios + 4 status compartidos + 4 chip-text aliases + 5 elevation/motion + spacing/radius/breakpoint/z-index agnósticos a paleta).
- **`--info` movido a h245** para diferenciarse de `--accent-cool` h215.
- **Status chip-text aliases** (`--success-chip-text`, `--warning-chip-text`, `--destructive-chip-text`, `--info-chip-text`) sumados al sistema; en light tienen valor propio, en dark son aliases del status base.
- **`--text-on-accent` cross-paleta**: blanco en light, oscuro en dark (rompe el patrón mental pero pasa AA).
- **`--surface-overlay`** sumado para scrim modal/sheet/command-palette.

### Decisiones residuales cerradas

- **Paleta categórica → eliminada** (ADR 0004).
- **`--accent-cool` mantenido** con nueva semántica (hue 195 teal → hue 215 azul-gris suave, "informativo no urgente").
- **`--surface-warm` → eliminado** (Velvet ya es cálido; calidez extra vía state-layer `accent-warm`).
- **Pixel art vs AI hi-res mascota** → diferido a S6 (no bloquea tokens).

### Reformulaciones de reglas existentes

- **`--accent-warm`** redefine como **decorativo-only**: halo achievement, tinte chip "accent soft", mini-decorador del slot 2 dashboard. **Nunca** texto sobre lienzo. La interpretación del ADR 0001 D8 ("color `--accent-warm`") es color del **decorador**, no de la cifra (cifra en `--text-primary`).

### Tipografía

- **Stack final:** Inter Variable + Inter Display + JetBrains Mono Variable. Geist descartado (rompe coherencia métrica con Inter body).
- **Token nuevo `--text-eyebrow`** para reemplazar el patrón ad-hoc `text-[11px] uppercase tracking-[0.08em]` de los wireframes.
- **Comportamiento dark:** Display 700→670, Title 600→580, Body medium 500→480 (compensación óptica). Body color hereda `--text-primary` 96% L.

### Layout

- **Layout magic numbers** (sidebar/drawer/header widths, modal max-w, FAB size) promovidos a tokens semánticos. Ningún componente puede declarar literal `240px`, `64px`, `440px`, etc.
- **Z-index scale completa** (13 capas, `--z-base 0` a `--z-tooltip 110`). Toast por encima de modal (90 > 80) intencionalmente.

### Firma view-transition

- **`--ease-vt-signature`** token aislado, sólo para `::view-transition-*`. Duración fija `--motion-base` (280ms). Convención `view-transition-name: order-{humanId}` ya formalizada (ADR 0001 D5).

## Supuestos asumidos

- **Inter Display licencia y alojamiento:** asumido `next/font/local` con archivos variable WOFF2; alternativa Google Fonts con axis `opsz` queda como decisión de S12.
- **Soporte browser de `linear()` timing function:** asumido Chromium 113+, Safari 17.4+, Firefox 112+. Fuera de eso, fallback degrada a `linear` puro (sin overshoot). Validar target oficial en S12.
- **Soporte browser de `color-mix(in oklch, …)` en `box-shadow`:** asumido en navegadores que ya soportan `color-mix`. Validar Safari 16.x si está en target.
- **Tailwind v4 acepta `clamp()` directamente en `--text-*` `@theme`:** asumido. Si falla, mover el clamp a `:root` y referenciar.
- **Theme persistence:** `localStorage["pandatrack-theme"]` (clave producción), inferencia inicial vía `prefers-color-scheme` solo en primera carga (ADR 0003 D2). Inline script en `<head>` antes de hydration para evitar flash de tema incorrecto — implementación a definir en S12.
- **Palette persistence:** demo usa `localStorage["pandatrack-demo-palette"]`. En producción: si el switch es preference real, key `localStorage["pandatrack-palette"]` + sync a `preferences` schema. Si es solo demo, eliminar UI antes de prod. Decisión a S6+ alta fidelidad.
- **Validación de daltonismo** del par `--info` h245 vs `--accent-cool` h215 queda como riesgo abierto para S4 (no bloquea S3 porque la dualidad ícono+color mitiga).

## Archivos producidos

- `docs/redesign/tokens.md` — sistema de tokens completo (Velvet default + 4 alternativas + status compartidos + reglas de uso + decisiones residuales + gaps S4).
- `docs/redesign/tokens-css.md` — mapping a Tailwind v4 `@theme` + bloques `:root[data-theme=...]` y `:root[data-palette=...]` + state layers + recetas de los componentes referenciados por ADRs.
- `docs/redesign/_notes/s3-contrast-audit.md` — audit exhaustivo 188 pares (5 paletas × 2 modos), 100% pass.
- `docs/redesign/_notes/s3-red-team.md` — 15 objeciones evaluadas, 0 bloqueantes, 5 menores con riesgo controlado.
- `docs/redesign/_notes/s3-draft-color.md` — borrador α (color Velvet).
- `docs/redesign/_notes/s3-draft-typography.md` — borrador β (typography).
- `docs/redesign/_notes/s3-draft-spacing.md` — borrador γ (spacing + radius + breakpoints + z-index).
- `docs/redesign/_notes/s3-draft-elevation-motion.md` — borrador δ (elevation + motion).
- `docs/redesign/_notes/s3-draft-palettes.md` — borrador ε (4 paletas alternativas).
- `docs/redesign/decisions/0004-categorical-palette-removal.md` — ADR de eliminación de paleta categórica.
- `docs/redesign/sessions/03-tokens.md` (este archivo).

Total ~3.500 líneas markdown agregadas en S3.

Actualizado en este cierre:

- `docs/redesign/README.md` — S3 marcada ✅ done, S4 marcada 🟡 next; mapa de archivos actualizado con `tokens.md`, `tokens-css.md`, `_notes/s3-*.md`, `decisions/0004-*.md`, `sessions/03-tokens.md`; sección "Cómo leer este folder" extendida con orden post-S3.

## Lo que NO se hizo (intencionalmente)

- **No se ejecutaron las 5 validaciones humanas** del `_notes/s2-validation-plan.md` — son trabajo del humano fuera del agente. Tokens diseñados para no contradecir sus criterios (especialmente Validation #4 sobre `--text-muted` legible en mobile bajo sol).
- **No se diseñaron componentes core** (Button, Input, Card, Chip, Avatar, WizardAccordion, FilterDrawer, DetailSidebar, StatusChip) — eso es S4. `tokens.md` §12 lista los gaps abiertos para S4.
- **No se diseñaron layouts** (sidebar collapsible push, header con breadcrumbs, app shell) — S5. Se aseguró que los tokens los soportan (layout magic numbers, z-index scale).
- **No se hicieron mocks pixel-perfect** ni alta fidelidad — S6+.
- **No se decidió pixel art vs AI hi-res mascota** — diferido a S6.
- **No se aplicó nada al código de la app** — `src/` intacto. Toda la propuesta vive en `docs/redesign/`. La aplicación es S12.
- **No se hicieron commits ni PRs** — humano decide.

## Métricas de la sesión

- **5 sub-agentes** lanzados en paralelo en 1 solo mensaje (β, γ, δ, ε en background; α corrió primero por design para alinear el resto).
- **11 archivos** `.md` producidos (1 tokens + 1 tokens-css + 2 audits/red-team + 5 drafts intermedios + 1 ADR + 1 session log).
- **~3.500 líneas** markdown agregadas.
- **188 pares de contraste** evaluados, 188 pass AA (100%).
- **15 objeciones de red team** evaluadas, 0 bloqueantes pendientes, 5 menores con riesgo controlado.
- **3 decisiones residuales** cerradas (paleta categórica → eliminada, `--accent-cool` → mantenido con nueva semántica, `--surface-warm` → eliminado).
- **1 ADR nuevo** (`0004` paleta categórica eliminada).
- **0 TODOs** en archivos finales.
- **0 emojis** salvo los heredados ✅ 🟡 ⏳.

## Qué necesita la Sesión 4 para arrancar

1. **El humano revisa `tokens.md`, `tokens-css.md`, los 7 ADRs + los 4 informes de research follow-up** (`_notes/s3-research-*.md`) y registra correcciones puntuales o anota desacuerdos.
2. **Ejecutar las 5 validaciones** del `_notes/s2-validation-plan.md` si todavía no se corrieron. **Validation #4 refinada por ADR 0007:** setup split (versión actual vs propuesta) en mid-tier (Pixel 6a) + high-tier (iPhone 15 Pro) bajo sol directo. Plan detallado en `_notes/s3-research-text-muted-outdoor.md` §9.
3. ~~Validación adicional con simulador de daltonismo del par `--info` (h245) vs `--accent-cool` (h215)~~ — **CERRADA por ADR 0006**: el research demostró que mover hues no resuelve (Brettel/Viénot 1997). Mitigación correcta es contrato vinculante "ícono + label" con enforcement TypeScript en `<StatusChip>` y lint en S12. Validación con usuario dichromat real queda para S6+ como confirmación, no bloquea S4.
4. **Lanzar Sesión 4 — Componentes core.** Primera prioridad:
   - `<StoreAvatar>` (ADR 0001 D16, receta lista en `tokens-css.md` §5).
   - `<StatusChip>` (ADR 0002 + ADR 0006): discriminated union con `kind: "info"` que **exige props `icon` y `label`**.
   - `<MicroStatCard>` (ADR 0005, receta en `tokens-css.md` §9): prop `accentToken: '--accent' | '--accent-warm' | '--warning' | '--success'`.
   - `<Button>` (consume `--text-on-accent` correctamente — auditoría de regresión `text-white`).
   - `<WizardAccordion>` (ADR 0003 D5), `<FilterDrawer>` (ADR 0003 D8), `<DetailSidebar>` (ADR 0003 D7).
5. **Auditar `font-bold`/`font-semibold`/`text-white` hardcoded** en componentes legacy si la migración del shell empieza a tocarlos antes de S12.
6. **Si se encuentra que algún token de S3 no soporta una receta de componente real**, abrir gap en `_notes/s4-gaps.md` siguiendo el mismo patrón que `atelier-gaps.md`.

---

## Adendum 2026-05-02 — Research follow-up

Tras cerrar S3 con tokens, el humano pidió que se cerraran los 4 temas residuales con investigación external (apps reales + research académica + design systems) antes de avanzar. Se lanzaron **4 sub-agentes generales con WebSearch + WebFetch** en paralelo.

### Sub-agentes follow-up

| #   | Tema                                                 | Output                                             | Decisión                                                                    | ADR resultante  |
| --- | ---------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------- | --------------- |
| A   | Color del slot 2 dashboard métrica (`--accent-warm`) | `_notes/s3-research-accent-warm-metric.md` (370 L) | Opción (b'): cifra `--text-primary` + icon-tile soft-tint con glyph dentro  | **ADR 0005**    |
| B   | Daltonismo `--info` h245 vs `--accent-cool` h215     | `_notes/s3-research-colorblind-info.md`            | Opción (a): mantener tokens sin cambio, formalizar contrato ícono+label     | **ADR 0006**    |
| C   | Validar paleta categórica (ADR 0004)                 | `_notes/s3-research-categorical-palette.md`        | Opción (a): confirmar ADR 0004 (eliminar)                                   | (confirma 0004) |
| D   | `--text-muted` outdoor mobile readability            | `_notes/s3-research-text-muted-outdoor.md`         | Opción (a) modificada: reasignar code mono `PT-XXXXXX` a `--text-secondary` | **ADR 0007**    |

Total: ~30+ apps revisadas (Shopify Polaris, IBM Carbon, Material 3, Tailwind UI, Plausible, Apple Health, YNAB, Cash App, Robinhood, Dell, Power BI, Letterboxd, Goodreads, Discogs, AniList, Untappd, Backloggd, POPMART, Vivino, Strava, Komoot, AllTrails, Garmin, Citymapper, Linear, Atlassian, Primer, etc.) + research académica (Brettel/Viénot/Mollon 1997, APCA WCAG 3 candidate, Refactoring UI, WCAG 1.4.1 + 2.2 + 1.4.11) + design systems (Material 3, Carbon, Polaris, Cloudscape, Atlassian, Primer, Adobe Spectrum, Tableau, ColorBrewer 2.0).

### Cuestionamiento del agente principal

Cada decisión fue cuestionada antes de aplicar:

- **A:** sobrevivió a 4 contraargumentos del propio agente A (pierde diferenciación, decorador chico, sentimiento apagado, oscurecer warm). Aplicada.
- **B:** la solución es estructural, no se puede esquivar moviendo hues. Coherente con WCAG 1.4.1. Aplicada.
- **C:** 6/6 apps de hobby relevantes confirman; POPMART/Vivino son casos especiales que no aplican. Aplicada.
- **D:** preserva jerarquía visual sin tocar tokens, solo cambia regla de uso del caso outdoor-crítico. Aplicada.

**Coherencia cross-decisión:** las 4 decisiones se cruzan sin contradicción. ADR 0005 usa `--accent-warm` como decorador (consistente con regla nueva D8 reformulada); ADR 0006 con `--accent-cool` como ícono solo (consistente con uso del icon-tile); ADR 0007 actualiza regla de muted/secondary sin afectar cifras del ADR 0005 (que ya van en `--text-primary`).

### Archivos producidos en el follow-up

- `docs/redesign/decisions/0005-dashboard-microstat-icon-tile.md` (ADR nuevo, accepted).
- `docs/redesign/decisions/0006-color-blindness-icon-label-contract.md` (ADR nuevo, accepted).
- `docs/redesign/decisions/0007-text-muted-outdoor-code-mono-reassignment.md` (ADR nuevo, accepted).
- `docs/redesign/_notes/s3-research-accent-warm-metric.md` (370 líneas, 11 apps + 6 artículos).
- `docs/redesign/_notes/s3-research-colorblind-info.md`.
- `docs/redesign/_notes/s3-research-categorical-palette.md`.
- `docs/redesign/_notes/s3-research-text-muted-outdoor.md`.

### Archivos actualizados

- `docs/redesign/tokens.md` — §1.3 (text-secondary code mono + text-muted nunca code mono identificador), §1.4 (accent-warm con icon-tile, accent-cool con label adyacente), §1.5 (info chip con ícono + label obligatorio, comentario sobre Brettel/Viénot), §10 (jerarquía actualizada), §11.1 (confirmación research), §11.2 (confirmación research + ADR 0006), §11.5 nuevo (ADR 0005), §11.6 nuevo (ADR 0007), §12 (gap 6 cerrado, gaps 7-9 nuevos), §13 (Validation #4 refinada).
- `docs/redesign/decisions/0004-categorical-palette-removal.md` — frontmatter `confirmed_by` con notas del research C.
- `docs/redesign/tokens-css.md` — nueva §9 (`<MicroStatCard>` icon-tile receta) y §10 (chip-info con contrato ícono+label TypeScript).
- `docs/redesign/_notes/s3-red-team.md` — objeción #3 cerrada, bloque "Cierre" actualizado con resolución de los 4 temas follow-up.
- `docs/redesign/README.md` — "Estado actual" con 7 ADRs + research follow-up; "Highlights de S3 follow-up" sumados; "Siguiente gate humano" actualizado.

### Métricas del follow-up

- **4 sub-agentes** lanzados en paralelo (1 corrió primero por orden — A 32KB; los 3 siguientes corrieron en paralelo después del reset de límite Anthropic).
- **3 ADRs nuevos** (0005, 0006, 0007).
- **1 ADR confirmado** (0004 con `confirmed_by` actualizado).
- **4 documentos de research** producidos (~80KB total citando 30+ apps + 4+ studies).
- **1 riesgo abierto cerrado** (gap §12 #6 daltonismo).
- **1 validation refinada** (#4 outdoor con setup split).
- **0 bloqueantes** para Sesión 4.
