---
title: ADR 0004 — Eliminación de la paleta categórica del sistema de tokens
date: 2026-05-02
status: accepted
session: 03-tokens
owner: Sergio Minei
supersedes: direcciones visuales del subproyecto §4.4 "Paleta categórica — RESERVADA" (histórico)
confirmed_by: |
  Research follow-up C (research de paleta categórica del subproyecto, histórico) confirma esta decisión:
  6/6 apps de hobby relevantes (Letterboxd, Goodreads, Discogs, AniList, Untappd, Backloggd)
  no usan color por categoría a pesar de manejar cientos de géneros/estilos. La identidad la
  carga el artwork del ítem o el ícono Lucide canónico. Material 3, Carbon y Cloudscape
  reservan paleta categórica estrictamente para data viz, no para UI general. POPMART/Vivino
  son casos especiales (artwork-heavy / objeto físico literalmente coloreado) que no aplican
  como precedente. Los hues de Atelier §4.4 (`--cat-vinyl: violeta`) eran arbitrarios y
  contradicen la asociación cultural real.
---

# ADR 0004 — Eliminación de la paleta categórica del sistema de tokens

## Contexto

Atelier §4.4 (las direcciones visuales del subproyecto) definió una **paleta categórica de 6 hues** (`--cat-figures`, `--cat-vinyl`, `--cat-manga`, `--cat-anime`, `--cat-cards`, `--cat-plush`) y la dejó **"reservada, no es del sistema visible"**. La intención era tenerla disponible para charts y filtros activos en una futura vista de análisis, sin exponerla como decoración en la UI normal (la identidad de categoría vive en **íconos Lucide** en `--accent-cool`).

Al cerrar Sesión 3 (sistema de tokens dual-mode con Velvet base), una de las decisiones residuales pendientes era **eliminar la paleta categórica reservada o mantenerla**.

## Datos de la decisión

1. **MVP no incluye charts ni vistas analíticas.** Ningún wireframe S2 del subproyecto (histórico) usa tokens `--cat-*`. El demo HTML del subproyecto de rediseño (histórico) tampoco los implementa.
2. **La identidad de categoría ya está resuelta** por íconos Lucide en `--accent-cool` (Atelier §4.9 + ADR 0001 implícito). Cada categoría tiene un Lucide canónico (figures → `shapes`, vinyl → `disc`, manga → `book-open`, anime → `sparkles`, cards → `gallery-thumbnails`, plush → `package`).
3. **Mantener 6 tokens sin uso ni implementación es deuda visual y técnica:**
   - Bloat del archivo de tokens.
   - Riesgo de invocación accidental como decoración (rompiendo la jerarquía Primary / Extra / Reservada).
   - Falsa señal a futuros devs de que la paleta está "lista" cuando no fue calibrada para data-viz real (gama, distinguibilidad en daltonismo, secuencia ordenada para charts numéricos).
4. **V2 charts requerirán un set dedicado.** La paleta `--cat-*` de Atelier era exploratoria; un set real de data-viz necesita validar contra Color Brewer / Viridis / paletas perceptualmente uniformes, considerar daltonismo, y ofrecer una secuencia ordenada (no 6 hues equiespaciados sin orden semántico).

## Decisión

**Eliminar la paleta categórica del sistema de tokens.**

- Los 6 tokens `--cat-*` **no se incluyen** en el sistema de tokens ni en `tokens-css.md`.
- Cualquier referencia en las direcciones visuales del subproyecto §4.4 (sección "Paleta categórica — RESERVADA") queda como **referencia histórica**, no como contrato vinculante.
- La identidad de categoría sigue resuelta por **íconos Lucide en `--accent-cool`** (sin cambio).
- Cuando V2 introduzca charts, se diseñará un set dedicado **`--chart-1`, `--chart-2`, …, `--chart-N`** con paleta calibrada para data-viz (no necesariamente la misma de Atelier §4.4).

## Justificación

1. **Regla Cero del subproyecto.** El diseño actual está muerto y se construye lo que se necesita. La paleta reservada no se necesita en MVP — incluirla es contradecir el principio "promover lo que se usa".
2. **Decálogo §1 (light y dark hermanos).** Los 6 hues `--cat-*` requerirían su propio audit de contraste light/dark en 5 paletas × 2 modos = 60 pares. Trabajo no realizado y no necesario.
3. **Hygiene del sistema.** Cuanto más pequeño el inventario de tokens, más fácil es respetar la **regla de oro** "máximo 3-4 tokens cromáticos visibles por pantalla" (Atelier §4.4 final).

## Costo

- **Trivial.** Sólo eliminar entradas de docs futuras. Ningún componente, query o test depende de `--cat-*` hoy.
- Documentar en el sistema de tokens §2 + §10 que la paleta categórica fue eliminada y que la identidad de categoría vive en íconos.

## Rollback

Si en V2 alguien quiere re-introducir la paleta como tokens semánticos antes de que el data-viz set esté diseñado, se reabre este ADR con justificación específica de la pantalla afectada y se calcula contraste cross-paleta.

## Confianza

**Alto.** No hay arrastre conocido — la paleta nunca llegó al demo ni a los wireframes. La identidad de categoría está resuelta por otra vía y no se pierde.

## Implicancias

- el sistema de tokens §2 documenta la eliminación y enlaza a este ADR.
- el sistema de tokens §10 (jerarquía de uso) marca "Paleta categórica" como **Eliminada** en lugar de **Reservada**.
- las direcciones visuales del subproyecto §4.4 queda como referencia histórica (no se edita; se respeta el principio de no reescribir docs cerrados de S1).
- S6+ alta fidelidad NO debe invocar `--cat-*` aunque la sección histórica de las direcciones visuales del subproyecto lo mencione.
- Cualquier vista futura que necesite agrupar categorías visualmente debe **usar el ícono Lucide canónico** + label, no color.

## Próximos pasos

1. el sistema de tokens §2 documenta la decisión (✅ aplicado en este mismo cierre S3).
2. el sistema de tokens §10 jerarquía de uso (✅ aplicado).
3. Cuando se diseñe la V2 con charts, abrir nuevo ADR `0005-chart-palette-design.md` con calibración data-viz dedicada.
