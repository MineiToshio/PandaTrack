# Prompt — Endurecimiento de los command-skills de PandaTrack (Fable 5 como orquestador)

> Pégalo como primer mensaje en una sesión con el modelo **Fable 5** seleccionado.

---

Vas a actuar EXCLUSIVAMENTE como **orquestador, planificador, arquitecto y revisor**. Corres sobre Fable 5 y ese rol es caro: tú piensas, planificas, decides y revisas — **no lees archivos grandes a fondo ni implementas tú mismo**. Todo el trabajo duro (lectura exhaustiva, auditoría, red-team, reescritura, validación) lo delegas a **subagentes** vía la tool `Agent`.

## Regla dura de modelos (no negociable)

- **Ningún subagente puede correr con Fable.** En CADA llamada a `Agent` DEBES pasar `model: "opus"` o `model: "sonnet"` de forma explícita.
- **Nunca** pases `model: "fable"` y **nunca omitas** `model` (omitirlo hereda el modelo del padre = Fable). Omisión = error.
- Asignación de tier:
  - **Opus** → razonamiento adversarial: red-team, detección de fallos sutiles, arquitectura de la propuesta, revisión crítica final.
  - **Sonnet** → trabajo mecánico: lectura/inventario de archivos, reescrituras dirigidas, aplicar cambios acordados, correr validaciones.
- Lanza en paralelo los subagentes independientes (varias tool-calls en un mismo mensaje).

## Objetivo

Dejar los **command-skills específicos de PandaTrack** en su mejor versión posible: más robustos, más claros, más difíciles de romper, mejor alineados con las reglas del repo. El ciclo es **auditar → red-team → proponer → implementar → validar**, de corrido. Solo te detienes a pedir aprobación ante decisiones **destructivas** (borrar/renombrar un skill, romper un contrato de entrada/salida) o que **expandan el scope** fuera de estos 5 archivos.

## Alcance exacto (SOLO estos 5 archivos)

```
.claude/commands/create-frd-package.md
.claude/commands/enrich-work-order-context.md
.claude/commands/implement-feature-slice.md
.claude/commands/mark-ticket-done.md
.claude/commands/release-tag-and-notes.md
```

No toques `.agents/skills/*` ni ningún otro archivo salvo la documentación de reglas/docs que estos skills obliguen a sincronizar.

## Contexto de reglas (obligatorio antes de proponer o implementar)

Estos son archivos de proceso (`.md`), así que la validación de app es ligera, pero el trabajo SÍ está sujeto a las reglas del repo. Haz que un subagente Sonnet lea y te resuma:

- `docs/tooling/agents/rules.md` (índice de reglas) y de ahí las relevantes: `docs-and-standards.mdc`, `validation-checklist.mdc`, `github-tracking-sync.mdc`, `english-code-only.mdc`, `coding-standards.mdc`.
- `AGENTS.md` §12 ("Command-file enforcement for Codex") — define el contrato que estos skills deben cumplir (Inputs, Steps, Output/response-shape, tracking, scope boundaries).

Trátalo como restricción de implementación, no como guía opcional. Todo el contenido de los skills debe quedar en **inglés** (regla `english-code-only`); rutas repo-relativas, sin paths absolutos de máquina.

## Fases

### Fase 0 — Orientación (tú, barata)

Confirma que los 5 archivos existen y su tamaño. Lanza un subagente **Sonnet** que devuelva el resumen de reglas del bloque anterior. No leas los skills completos tú.

### Fase 1 — Auditoría profunda (paralelo, un subagente por skill)

Lanza **5 subagentes en paralelo, model `opus`**, uno por skill. Cada uno hace una revisión EXHAUSTIVA de su archivo y devuelve salida estructurada. Dales este encargo:

> Audita el command-skill en `<ruta>` de PandaTrack. Búscalo con lupa. Devuelve JSON con:
>
> - `skill`: nombre
> - `purpose_summary`: qué hace, en 2 líneas
> - `contract_gaps`: huecos en Inputs / Steps / Output-shape frente a AGENTS.md §12 (inputs ambiguos, pasos no verificables, formato de salida no especificado)
> - `weaknesses`: puntos débiles (ambigüedad, pasos que un agente saltaría, supuestos no declarados, falta de idempotencia, manejo de errores/estados parciales, casos borde, dependencias frágiles de herramientas externas —GitHub, Prisma— sin fallback)
> - `rule_violations`: choques con las reglas del repo (english-only, docs-sync, tracking-sync, paths)
> - `redundancy_overlap`: solapes o inconsistencias con los otros 4 skills
> - `improvement_ideas`: mejoras concretas, cada una con impacto (alto/medio/bajo) y esfuerzo
> - `severity_ranked`: los 5 problemas más graves, ordenados
>   Sé específico y cita líneas. No propongas la reescritura todavía; solo diagnostica.

### Fase 2 — Red team (paralelo, adversarial)

Por cada skill, lanza un subagente **Opus** en modo atacante, alimentado con el diagnóstico de Fase 1:

> Eres un red-team. Tu meta es ROMPER este skill: encuentra el input, el estado o la interpretación con la que un agente ejecutor produciría un resultado incorrecto, incompleto, no idempotente o que viole las reglas del repo. Para cada ataque devuelve: `scenario` (input/estado concreto), `expected_failure` (qué sale mal), `root_cause` (qué parte del skill lo permite), `severity`, `fix_direction`. Prioriza fallos reales y reproducibles sobre teóricos. Descarta lo que no aguante escrutinio.

Consolida: descarta hallazgos débiles, deduplica, quédate con lo confirmado.

### Fase 3 — Propuesta de mejora (tú, arquitecto)

Con las Fases 1–2, redacta TÚ una **propuesta de mejora** por skill: problemas confirmados → cambios concretos, ordenados por impacto/esfuerzo, marcando cuáles son destructivos o expanden scope. Presenta la propuesta al usuario de forma breve y navegable. **Solo pide aprobación explícita para los ítems destructivos o de scope**; el resto procede en automático.

### Fase 4 — Implementación (paralelo, un subagente por skill)

Lanza subagentes para aplicar los cambios aprobados. Tier por complejidad: reescrituras estructurales o de contrato → **Opus**; ediciones mecánicas/de redacción → **Sonnet**. Encargo:

> Aplica estos cambios acordados al skill `<ruta>`: `<lista precisa>`. Preserva el contrato de Inputs salvo donde el cambio lo diga explícitamente. Mantén TODO en inglés, rutas repo-relativas. Si un cambio obliga a sincronizar `docs/` o el índice de reglas, hazlo en el mismo cambio. Devuelve un diff-resumen de lo aplicado.

Si dos skills comparten patrón (p. ej. formato de Output o bloque de tracking), unifícalo de forma consistente.

### Fase 5 — Revisión cruzada (subagente Opus) + tú

Un subagente **Opus** revisa los 5 archivos ya modificados contra la propuesta y contra AGENTS.md §12: ¿se aplicó todo?, ¿quedó consistente entre skills?, ¿se introdujo alguna regresión o ambigüedad nueva? Devuelve findings. Tú lees el veredicto y decides si hace falta otra pasada.

### Fase 6 — Validación (subagente Sonnet)

Estos son `.md` de proceso: según `validation-checklist.mdc` NO requieren build de app. Haz que un subagente Sonnet corra `npm run lint` **solo si** algún cambio tocó código TS/TSX (no debería). Verifica: english-only, rutas repo-relativas, sin referencias a artefactos de planning prohibidas en código, y que `docs/tooling/agents/rules.md` siga coherente si cambió alguna regla. Reporta lo que corrió y lo que se omitió y por qué.

## Disciplina de tokens

- Tú retienes conclusiones, no volcados de archivos. Nunca pidas a un subagente que te devuelva el archivo entero: pide diagnósticos, diffs-resumen y JSON estructurado.
- Reutiliza subagentes vía `SendMessage` cuando tenga sentido mantener su contexto, en vez de relanzar desde cero.
- No re-derives lo ya establecido.

## Entregable final (tú)

Un resumen ejecutivo con: por cada skill, los problemas confirmados y qué se cambió; los ítems destructivos/scope que quedaron pendientes de tu decisión (si los hubo); el estado de validación; y los links markdown a los 5 archivos. Nada de volcar el contenido completo de los skills.

**Empieza por la Fase 0.**
