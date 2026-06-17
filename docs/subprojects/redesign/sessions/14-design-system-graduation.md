---
title: S14 — Graduación del sistema Velvet a docs/design/
session: 14
type: meta · docs-only (sin demo, sin tocar src/ salvo un comentario de referencia)
status: ✅ done
last_updated: 2026-06-16
owner: Sergio Minei
branch: redesign
---

# S14 — Graduación del sistema de diseño

Última sesión foundational del subproyecto antes de las de cierre (S15–S17). **No agrega features ni toca implementación.** Toma el sistema Velvet —que vivía en `docs/redesign/`, el taller temporal— y lo **gradúa** a `docs/design/`, el hogar permanente que AGENTS.md y las reglas de diseño señalan como fuente de verdad. Resultado: `docs/design/` pasa a ser el estándar oficial para construir UI nueva, **sin depender de `docs/redesign/`**.

`docs/redesign/` no se borró ni se movió (eso es S17); en S14 solo se leyó como fuente.

## Paso 0 — estructura acordada (gate de Sergio)

Antes de volcar contenido se acordó la forma. Decisiones:

1. **Modular, no monolito** (se respeta la decisión previa de `docs/design/` y `file-organization.md`): se reescriben los 4 archivos existentes + se agregan `motion.md`, `states.md` y `components.md`.
2. **ADRs → `docs/design/decisions/`** (co-localizados con el sistema que gobiernan).
3. **PLAYBOOK → ambos:** se gradúa como doc accionable aparte (`docs/design/PLAYBOOK.md`, capa operativa) **y** cada doc de tópico lleva su propio bloque inline de reglas+anti-patterns. Defense-in-depth, sin duplicar el spec.
4. **motion.md y states.md** archivos propios.
5. **Componentes:** `components.md` normativo (mapa: tiers + cuándo-usar + ruta canónica en `src/` + tokens/ADR + anti-patterns), no las ~60 specs. La conformidad "al 100%" se garantiza con el triángulo **components.md + PLAYBOOK + reglas cursor (`alwaysApply`)**; el código es la autoridad del componente construido. Las 60 specs quedan en `docs/redesign/components/` como referencia histórica (archivo S17).

## Qué quedó en `docs/design/`

| Archivo                 | Contenido                                                                                                                                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `README.md`             | Reescrito: entrada + carácter Velvet + decálogo + guía de selección de archivo + cómo se enforce el sistema + mapa de variables fuente.                                                                                                                                                                |
| `visual-foundations.md` | Tokens Velvet destilados: color light+dark con notas AA, tipografía (**Zilla = solo logo**), spacing, radius (**nota del 1.5px del Checkbox**), superficies/elevación, gradients/wash, formato numérico.                                                                                               |
| `tokens-css.md`         | Contrato literal de variables CSS, espejo de `src/app/globals.css` (header reencuadrado: ya está aplicado, no es propuesta; se siguió el CSS vivo donde difería del doc de taller).                                                                                                                    |
| `interface-patterns.md` | Layout/shell PUSH, hero/section-title, estados de interacción, botones, navegación, modales adaptive (ADR 0008), formularios/wizard, **§9.17 Chip-Eyebrow + Top-Accent con las dos familias de slot** (accent "tus cosas" / cool "recap de datos", congelado), status chips, toasts, responsive, a11y. |
| `motion.md`             | Taxonomía de tokens, regla transform/opacity, reduced-motion, View Transitions (Opción A), microinteracciones (ADR 0014).                                                                                                                                                                              |
| `states.md`             | empty/loading/error: skeleton vs spinner vs nada, tiers de error, ownership de Sentry, política de mascota (ADR 0013).                                                                                                                                                                                 |
| `ux-copy.md`            | Voice library (4 pilares) + matriz tono-por-contexto + do/don't + español neutro + patrones de copy + glosario.                                                                                                                                                                                        |
| `components.md`         | Mapa normativo: patrones canónicos a nunca reinventar, Tier 1 (core) y Tier 2 (modules) con ruta canónica por componente, regla de reuso, anti-patterns.                                                                                                                                               |
| `PLAYBOOK.md`           | Capa operativa graduada (workflow obligatorio + anti-patterns + self-audit), refs internas re-apuntadas, header reencuadrado como doc permanente.                                                                                                                                                      |
| `decisions/`            | ADRs 0001–0014 graduados (contenido íntegro) + `README.md` índice.                                                                                                                                                                                                                                     |

## Dónde se graduaron los ADRs

`docs/design/decisions/0001..0014.md` (copia fiel — `docs/redesign/decisions/` permanece hasta S17) + `docs/design/decisions/README.md` con índice, resúmenes de una línea y leyenda de estados. Los cross-refs internos entre ADRs y a otros docs de taller quedan como están (su re-apuntado interno es parte del barrido exhaustivo de S17).

## Reglas / referencias re-apuntadas

- `.cursor/rules/design-system-playbook.mdc` → `docs/design/PLAYBOOK.md` + lista de "related sources" partida en **permanente** (`docs/design/`) vs **histórica** (`docs/redesign/`).
- `.cursor/rules/modal-canonical-pattern.mdc` → `docs/design/components.md` + `docs/design/decisions/0008` + `interface-patterns.md`; spec profunda y demo HTML marcadas como referencia histórica.
- `.cursor/rules/ui-libs-policy.mdc` → `docs/design/decisions/0010` (×2).
- `docs/tooling/cursor/rules.md` → descripción del playbook re-apuntada a `docs/design/PLAYBOOK.md`.
- `AGENTS.md` §Styling → mención de PLAYBOOK + components.md + decisions/ (ya apuntaba a `docs/design/`).
- `src/app/globals.css` cabecera → `docs/design/tokens-css.md` (único toque en `src/`, solo comentario de referencia).
- `docs/README.md` → sección Design completada con los 10 nuevos/actualizados.

## Qué queda explícitamente fuera de S14

- **S15:** prototipos HTML por FRD + FDDs (no se hicieron acá).
- **S16:** alineación funcional de FRDs / Work Orders / blueprints.
- **S17:** barrido total y exhaustivo de referencias a `docs/redesign/` (incl. cross-refs internos de los ADRs, `demo-screens.html`, las ~60 specs por componente) + archivado/borrado de `docs/redesign/`.

## Segunda pasada de revisión (2026-06-16)

Pasada adversarial completa (8 revisores en paralelo, 1 por doc + meta), por ser el paso de mayor impacto futuro. Resultado:

- **Corrección de valores literales: 100% exacta.** Los 27 valores light + 27 dark de Velvet en `tokens-css.md` coinciden carácter a carácter con `src/app/globals.css` (incl. `@theme`, state-layers en `oklab`, keyframes, view-transition, reduced-motion). Las 5 paletas y la nota de "Velvet shipea un-scoped" verificadas. `visual-foundations.md` spot-checks de color/spacing/radius sin contradicciones. Las 3 decisiones de S13 confirmadas correctas.
- **Completitud de componentes:** los 85 componentes de `src/components/{core,modules}` están mapeados o son internos legítimos; 0 rutas rotas; citas ADR correctas.
- **Hallazgos arreglados:** (1) **status de ADR 0002 y 0013** `proposed`→`accepted` en los graduados (ambas decisiones ya shipeadas — StatusChip S7, cross-cutting states S10 — el índice ya las daba accepted; reconciliado, originales de redesign se reconcilian en S17); (2) `visual-foundations.md` ganó una sección **"Layout primitives: z-index, breakpoints, motion"** con punteros a `tokens-css.md`/`interface-patterns.md`/`motion.md` (cerraba el gap de "fuente de verdad que omitía esos tokens"); (3) `last_updated` del README de redesign 2026-06-15→2026-06-16.
- **Hallazgos aceptados sin cambio (minor):** nits de atribución en `ux-copy.md` (no cita el glosario de 15 pares de `principles.md`) — el espíritu está completamente preservado y citar `docs/redesign/` reintroduciría dependencia; se dejan.
- **Observación fuera de scope (no tocada, docs-only):** `src/app/globals.css` tiene declaraciones duplicadas de color en el bloque `@theme inline` (redundancia pre-existente inofensiva por cascada); limpieza de `src/` es ajena a S14.

## Validación

Docs-only → política 1 del validation-checklist (sin comandos de app). Verificaciones hechas: links markdown internos de `docs/design/` resueltos (0 rotos, re-auditado tras los arreglos), las 14 ADRs en `accepted` coinciden con el índice, referencias `docs/redesign/` restantes en `docs/design/` son todas históricas intencionales, todas las rutas de componentes de `components.md` existen en `src/`, `docs/tooling/cursor/rules.md` consistente con las reglas tocadas, y las tres decisiones de S13 reflejadas (Zilla = solo logo · §9.17 dos familias de slot · 1.5px Checkbox).

**Agentes no commitean.** Sergio revisa y commitea.
