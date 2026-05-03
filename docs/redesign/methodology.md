---
title: Metodología de ejecución del subproyecto
last_updated: 2026-05-02
status: vigente desde post-S4
owner: Sergio Minei
---

# Metodología de ejecución (post-S4)

Este documento define **cómo se ejecuta el subproyecto de rediseño desde la Sesión 5 en adelante**. Reemplaza el modelo "todo en docs primero, implementación al final en S12" del plan original.

Las sesiones S1-S4 se ejecutaron con el modelo viejo (docs autónomos sin implementación). Este documento aplica a partir de **S3 Fase B y S4 Fase B en adelante**.

## 1. Principios

1. **Feedback visual rápido.** El humano necesita ver progreso real en la app, no leer markdown. Cada sesión cierra con código aplicado a `src/` y visible con `npm run dev`.
2. **Documentación primero, implementación después — pero por sesión, no por proyecto.** Cada sesión es un mini-ciclo completo de docs → implementación.
3. **Funcionalidades son intocables salvo aprobación explícita.** Cualquier cambio funcional respecto al FRD/Blueprint/Work Order de una sección se **propone** en el doc, nunca se aplica unilateralmente.
4. **Coexistencia aceptada.** Entre sesiones la app va a tener estados intermedios feos (sidebar nuevo + páginas viejas). Es el precio del feedback rápido.
5. **El humano es la única autoridad de scope.** El coordinador (este chat) es la única fuente de verdad sobre qué sesión sigue, qué prompt usar, y en qué tipo de conversación.

## 2. Estructura de cada sesión

Cada sesión tiene dos fases:

```
Fase A — Documentación
  └── Investigación + propuesta + iteración con humano
  └── Output: doc en docs/redesign/ aprobado por humano

Gate humano (explícito)

Fase B — Implementación
  └── Aplicación a src/ siguiendo el doc aprobado
  └── Validación: npm run test, type-check, lint, validate-build
  └── Output: working tree con cambios, sin commit
  └── Humano revisa con npm run dev y commitea cuando aprueba
```

## 3. Tipos de sesión

Cada sesión cae en uno de tres tipos. El tipo determina cómo se manejan las dos fases (misma conversación o separadas) y qué nivel de iteración tiene Fase A.

### Tipo 1 — Foundational (1 prompt, 1 conversación)

**Características.** Fase A es autónoma (specs derivados de tokens/ADRs ya aprobados, sin iteración con humano). Fase B sigue inmediatamente.

**Aplica a:** S5 (navegación + layouts), S9 (estados transversales), S11 (motion + voice), S12 (audit final), S13 (reemplazo `docs/design/`).

**Flujo:**

```
Una conversación nueva:
  ├── Fase A: agente produce specs autónomos.
  ├── Agente reporta "specs listas, ¿implemento?".
  ├── Humano confirma o pide ajustes.
  ├── Fase B: agente implementa, valida, reporta.
  └── Humano revisa con npm run dev y commitea.
```

### Tipo 2 — Foundational B-only (1 prompt, 1 conversación, solo Fase B)

**Características.** La Fase A ya se ejecutó en una sesión anterior (S3 y S4). Solo falta Fase B.

**Aplica a:** S3 Fase B, S4 Fase B (split en sub-batches).

**Flujo:**

```
Una conversación nueva:
  ├── Lectura: doc producido en Fase A previa.
  ├── Implementación.
  ├── Validación.
  └── Humano revisa y commitea.
```

### Tipo 3 — Módulo (2 prompts, 2 conversaciones, con Handoff brief)

**Características.** Fase A es **iterativa de verdad**: el agente investiga FRD/Blueprint/Work Order de la sección, propone, el humano itera con varias rondas hasta aprobar. Fase B se hace en conversación nueva para mantener contexto limpio.

**Aplica a:** S6 (Tiendas), S7 (Órdenes), S8 (Entregas), S10 (Onboarding + Landing).

**Flujo:**

```
Conversación A (módulo):
  ├── Agente investiga (impl. actual + FRD + Blueprint + Work Order).
  ├── Agente propone (super resumen en chat + doc detallado en repo).
  ├── Humano itera con feedback ("cambia X, no Y, agrega Z").
  ├── Agente actualiza doc, devuelve nuevo super resumen.
  ├── Iteran hasta que humano apruebe.
  └── Último paso obligatorio del prompt: agente escribe sección
      "Handoff a Fase B" en el doc del módulo con TODO lo que
      la implementación necesita saber.

Conversación B (implementación, fresh):
  ├── Lectura: doc del módulo (incluyendo Handoff brief).
  ├── Implementación.
  ├── Validación.
  └── Humano revisa y commitea.
```

## 4. El Handoff brief

Es la sección final obligatoria del doc de cada módulo, escrita al final de Fase A. Su función es **traducir la discusión de Fase A en un contrato implementacional** que un agente fresco puede ejecutar sin leer la conversación previa.

Estructura mínima:

```markdown
## Handoff a Fase B

### Archivos a crear / modificar

Lista de paths exactos en `src/` con qué se hace en cada uno.

### Componentes a consumir

Lista de `<ComponentName>` con link a `components/<Name>.md`.

### Tokens a usar

Mapping de cada elemento UI al token semántico que lo define.

### Decisiones cerradas durante la iteración

Decisiones tomadas en Fase A que no están en el resto del doc.
Cada una con justificación corta.

### Edge cases acordados

Lista de cómo se comportan los casos límite acordados con humano.

### Copy aprobada

Tabla con clave i18n + valor ES (EN se deja para S12).

### Anti-patrones surgidos durante la discusión

Cosas que no hay que hacer, descubiertas durante la iteración.

### Preguntas abiertas

Si quedaron. La implementación NO asume — pregunta o falla.

### Validación esperada

Comandos a correr al final + criterio pass/fail.
```

## 5. Branch y commits

- **Branch única `redesign`.** Es donde está actualmente el repo y donde vive todo el trabajo.
- **Los agentes NO commitean.** Implementan, dejan el working tree con cambios, reportan.
- **El humano commitea.** Revisa con `git diff` y `npm run dev`, decide si commitear el cambio en `redesign`.
- **Cuando todas las sesiones cierren** (incluyendo S13), el humano hace `redesign → staging` (no producción todavía).

## 6. Validación al cierre de cada Fase B

Comandos obligatorios:

- `npm run test` — unit + integration.
- `npm run type-check`.
- `npm run lint`.
- `npm run validate-build`.

Comandos condicionales:

- `npm run test:e2e` cuando la sesión toca un flujo con cobertura Playwright existente, o un flujo crítico cuyo comportamiento depende de routing/redirects/forms en browser real.
- `npm run build` solo si la sesión simula deploy completo (requiere DB con migraciones — raro en este subproyecto).

Si algo falla, no se cierra la sesión hasta arreglarlo.

## 6.bis Reglas duras de implementación (cross-sesión)

Estas reglas aplican a **todas las sesiones de implementación (Fase B)** y deben replicarse en cada prompt que el coordinador entregue:

1. **Código en inglés, docs en español.** Todo identificador, comentario, log, mensaje de error y string developer-facing en `src/` debe estar en inglés. La documentación en `docs/redesign/` queda en español. Los strings user-facing van por `next-intl` con clave i18n + valor ES (EN se completa en S12). Esta regla ya está en `AGENTS.md` §4 Language and copy — el coordinador la refuerza en cada prompt para que no se pierda.

2. **Solo Velvet en la app.** La paleta única implementada en `src/` es Velvet. Las 4 paletas alternativas (Lilac, Plum, Lagoon, Forest) viven **únicamente** en el demo HTML (`_notes/demo-screens.html`) y en la documentación (`tokens.md`, `tokens-css.md`) como referencia futura. **No** se incluyen en `globals.css`, **no** hay `data-palette` switching, **no** hay `setPalette/getPalette`, **no** hay localStorage de paleta. Cuando más adelante se quiera agregar una segunda paleta, se re-introduce el mecanismo en ese momento.

3. **Theme toggle (light/dark) sí está activo.** Esa parte sí se implementa: `data-theme`, `setTheme/getTheme`, persistencia en `localStorage["pandatrack-theme"]`, inferencia inicial de `prefers-color-scheme`. Solo light y dark, sin `system` (ADR 0003 D2).

## 6.quater El demo HTML como borrador visual base (cross-sesión)

El demo HTML en [`_notes/demo-screens.html`](./_notes/demo-screens.html) es el **borrador visual base** del subproyecto. Cumple un rol específico que se aclara acá para evitar confusiones:

### Qué es el demo

- Un **draft visual completo** de las pantallas críticas, con paletas vivas (Velvet + 4 alternativas), light + dark, responsive.
- La encarnación visual de la dirección Atelier: densidad, eyebrows mono, accent tints, micro-decoradores, vibe coleccionista cálida pero seria.
- El estándar mínimo de "personalidad visual" que cualquier implementación debe heredar.

### Qué NO es el demo

- **No es contrato pixel-perfect.** La implementación no tiene que ser idéntica al demo.
- **No es completo.** El demo deliberadamente omite filtros completos, paginación, estados empty/loading/error, validaciones, datos reales, accesibilidad, edge cases. Todo eso lo agrega la implementación.
- **No es la única fuente.** El FRD/Blueprint/Work Orders son la fuente funcional; el demo es la fuente visual base.

### Regla vinculante

Cualquier implementación de Fase B (módulo o foundational) cuya pantalla equivalente exista en el demo debe **ser claramente reconocible como descendiente del demo**:

1. **Hereda la vibe visual.** Densidad, paleta aplicada con personalidad, eyebrows mono uppercase, accent tints en avatares e icon-tiles, micro-decoradores, calidez Atelier. **Esto no se negocia.**
2. **Agrega lo que el demo no muestra.** Filtros, paginación, estados, datos reales, validaciones, accesibilidad, edge cases — toda la sustancia funcional que el demo simplifica.
3. **Adapta cuando los datos o el flujo lo exigen.** La adaptación se nota como evolución del demo, no como ruptura.

### Prueba cualitativa al cerrar Fase B

Alguien que vio solo el demo y entra a la implementación final debe sentir que entró a **"la versión completa de lo mismo"**, no a una app distinta. Si la respuesta probable es "esto no parece lo del demo" → la Fase B falló y se itera.

### Cómo se aplica en cada prompt de Fase B

- **Paso 0 obligatorio:** abrir y revisar el demo HTML. Identificar qué pantalla(s) del demo corresponden a la sección a implementar.
- **Plan corto:** explicitar qué elementos de vibe visual del demo se van a heredar (paleta aplicada, densidad, accent tints, eyebrows, micro-decoradores).
- **Auto-check al cierre:** comparar mentalmente la implementación contra el demo. Si la respuesta a "¿se ve como descendiente del demo?" es no, no cerrar.

### Cuándo el demo no aplica

Pantallas o componentes que el demo no cubre (ej. estados de loading detallados, modales de confirm muy específicos, edge cases de forms) usan los **patrones del demo** (tokens, eyebrows, accent uses, microdetalles) como guía indirecta — no requieren correspondencia 1:1.

## 6.quinquies HTML-first iteration para sesiones de módulo (cross-sesión)

**Contexto.** El primer intento de S6 (Stores) falló parcialmente porque el spec markdown de Fase A no transmitió la vibe visual del demo. Codex implementó "técnicamente correcto pero estéticamente plano". El costo fue alto: una sesión completa de Codex perdida + horas de iteración para revertir.

**Lección.** Iterar visualmente en React es caro (cada iteración cuesta tokens significativos por re-render mental, refactor, validación). Iterar visualmente en HTML extendiendo el demo es barato (tokens chicos, feedback humano inmediato visualmente).

### Regla vinculante para sesiones de módulo (S6, S7, S8, S10)

Cada Fase A de módulo se descompone en cuatro sub-fases:

#### Fase A.0 — Investigación

El agente lee:

- FRD + Blueprint + Work Orders del módulo en `docs/product/`.
- Implementación actual del módulo en `src/`.
- ADRs aplicables.
- Specs de componentes core ya disponibles (`docs/redesign/components/`).
- Tokens y reglas vivas (`tokens.md`, `methodology.md`).

#### Fase A.1 — Extensión del demo HTML

El agente extiende `docs/redesign/_notes/demo-screens.html` con:

- Las pantallas del módulo (si ya existen en el demo, las refactorea con el nuevo entendimiento del FRD).
- **Variantes faltantes que el demo original no muestra:**
  - Filtros expandidos (drawer abierto con secciones reales).
  - Paginación con datos dummy realistas.
  - Estados empty / loading / error.
  - Validaciones inline de forms (success post-blur, error inline).
  - Edge cases visuales acordados con el FRD.
- **Datos dummy realistas** (no "Lorem ipsum" — usar nombres de tiendas reales del nicho coleccionista, países, categorías, etc.).
- Variantes mobile + desktop completas en cada pantalla nueva.
- Respeta toda la infraestructura del demo: tokens CSS existentes, componentes HTML existentes, paletas, theme toggle.

Al terminar, devuelve al humano: **"demo extendido en `_notes/demo-screens.html`. Abrí el archivo en el browser y revisá las pantallas X, Y, Z. Iterá conmigo hasta aprobación visual."**

#### Fase A.2 — Iteración visual del HTML

El humano abre el HTML, ve las pantallas, decide. Itera con el agente:

- "No me gusta que la card tenga X, cambiala por Y."
- "Falta mostrar el contador de Z."
- "El estado empty de esta pantalla se ve frío, agregale la mascota sleeping."

El agente edita `_notes/demo-screens.html` y devuelve "iteración Nº lista, abrí de nuevo y revisá".

**Cero React durante esta sub-fase.** Tokens chicos por iteración (decenas de líneas de HTML+CSS por turno). Feedback humano inmediato y visual.

#### Fase A.3 — Aprobación visual + spec markdown

Cuando el humano dice "aprobado visualmente", el agente:

1. Escribe el spec markdown en `docs/redesign/screens/<screen>.md` describiendo el HTML aprobado (qué + cómo + tokens + componentes consumidos + estados).
2. Escribe el doc maestro en `docs/redesign/modules/<module>.md` con la lista de funcionalidades preservadas (mapeadas al FRD) + cambios visuales aplicados + cambios de UX propuestos pendientes de aprobación funcional.
3. Itera el doc maestro con el humano si hay cambios funcionales que aprobar/rechazar (los cambios visuales ya están aprobados — solo quedan los funcionales).
4. Cuando humano aprueba todo, escribe la sección **"Handoff a Fase B"** en el doc maestro.
5. Cierra Fase A.

El spec markdown queda **subordinado al HTML aprobado** — el HTML es la fuente de verdad visual, el markdown es la fuente de verdad funcional + el contrato técnico de implementación.

#### Fase B — Implementación React

El agente abre el HTML aprobado **en cada paso de implementación** como referencia visual concreta + el handoff brief como contrato funcional. Implementa React. Cero ambigüedad visual porque el HTML es la verdad pixel-perfect-ish (no exacto, pero la vibe es vinculante).

### Trade-off económico

| Modelo         | Costo si sale bien   | Costo si falla                                   |
| -------------- | -------------------- | ------------------------------------------------ |
| Sin HTML-first | X                    | 2X-3X (rehacer React caro)                       |
| Con HTML-first | X + 30% (HTML extra) | X + 30% (HTML aprobado, React siempre sale bien) |

El 30% del HTML-first se paga siempre. El 100%+ del re-trabajo React se paga solo si falla. Empíricamente con S6 ya falló una vez, entonces el HTML-first ya pagó su costo.

### Cuándo NO aplica

- **Sesiones foundational chicas** (S9 estados transversales, S11 motion choreography): el demo HTML existente cubre los patrones; extenderlo agrega poco. Estas sesiones pueden saltar Fase A.1+A.2 y trabajar directo con specs markdown + el demo existente como referencia.
- **S12 (audit final)** y **S13 (reemplazo `docs/design/`)**: meta-trabajo, no requiere visual.

### Convención del HTML

El `_notes/demo-screens.html` es **el único** HTML del subproyecto. No se crean HTMLs separados. Cuando un módulo extiende el demo, las pantallas nuevas se suman al mismo archivo siguiendo la convención existente (sections con `id="<screen>"`, navegación lateral, paletas, theme toggle reusados).

Cualquier convención del demo está documentada en `docs/redesign/_notes/demo-screens-readme.md` — el agente debe respetarla.

## 6.ter Workflow obligatorio de cursor rules (cross-sesión)

Cada sesión de implementación (Fase B) **debe** seguir el workflow definido en `docs/tooling/cursor/rules.md` antes de tocar código:

1. Leer `docs/tooling/cursor/rules.md` (índice operacional).
2. Identificar las reglas que aplican al alcance de la sesión:
   - **Always-read baseline** (siempre): `coding-standards.mdc`, `english-code-only.mdc`, `validation-checklist.mdc`, `theme-light-dark.mdc`, `testing-strategy.mdc`, `docs-and-standards.mdc`.
   - **Scenario-based** según lo que toque la sesión (ver tabla §"Scenario-based rules" del índice).
3. Leer cada `.cursor/rules/*.mdc` identificada.
4. Listar en chat (antes de implementar) las reglas leídas y cómo se van a aplicar.
5. Tratar las reglas como **constraints inviolables**, no sugerencias.
6. Re-chequear si el alcance cambia durante la sesión (ej. UI + backend, implementación + docs).

Si una regla no está en el índice pero la sesión la necesita, el agente la propone para sumar al índice como parte del cierre.

**El coordinador embebe este workflow como Paso 0.5 obligatorio en cada prompt de Fase B.** El agente no avanza a implementación hasta que listó las reglas en chat.

**Reglas de referencia adicionales** (no son `.mdc` pero son fuente de verdad):

- `docs/development/file-organization.md` — qué subfolder usar.
- `docs/design/README.md` y archivos en `docs/design/` — sistema de diseño actual (queda deprecated cuando S13 cierre, pero hasta entonces sigue vigente para cosas no cubiertas por `docs/redesign/`).
- `docs/product/glossary.md` — terminología canónica ES↔EN.

## 7. Regla dura: funcionalidades intocables

**Cambios visuales / de patrón / de orden / de control (input ↔ select)** → el agente los aplica en la propuesta directamente, los justifica.

**Cambios funcionales (agregar / quitar / mover features)** → el agente los **propone** en el doc + super resumen, nunca los aplica sin aprobación explícita del humano. Si tiene duda si algo es funcional o visual, lo trata como funcional (conservador).

Cualquier sesión de módulo (S6, S7, S8, S10) debe leer el FRD/Blueprint/Work Order correspondiente antes de proponer y debe listar explícitamente las funcionalidades preservadas en el doc.

## 7.bis Paralelización para acelerar tiempo calendario

El subproyecto es secuencial por dependencias reales (sin tokens no hay atoms, sin atoms no hay layouts, sin layouts no hay módulos). Pero hay una oportunidad limpia para acelerar tiempo calendario sin generar inconsistencias:

**Regla:** mientras una conversación implementa la **Fase B** de una sesión, otra conversación puede iterar la **Fase A (docs)** de la sesión siguiente. El humano no tiene que revisar las dos en simultáneo — alterna entre conversaciones según disponibilidad. Cuando la Fase B cierra, la Fase A de la siguiente ya está aprobada y arranca la Fase B inmediatamente sin esperas.

**Aplica especialmente a sesiones de módulo (S6, S7, S8, S10):** mientras se implementa S6-B (Tiendas), se itera S7-A (Órdenes); mientras se implementa S7-B, se itera S8-A; etc.

**No se paraleliza:**

- **Fase A de módulos distintos al mismo tiempo** (S6-A y S7-A simultáneas). Cada módulo establece patrones que los siguientes heredan; paralelizarlos genera divergencia que después hay que reconciliar.
- **Las 3 pantallas dentro de un módulo** (lista + detalle + crear de Tiendas en simultáneo). Comparten componentes propios del módulo; agentes paralelos crearían versiones divergentes.
- **S11 (Motion) y S12 (Audit)** con cualquier cosa. Por definición son cross-todo y van al final.

**Otra paralelización aceptable:** S10 (Onboarding + Landing) puede correr en paralelo a S6/S7/S8 porque vive fuera del shell `(app)`. Solo requiere S3-B + S4-B + S5 ya cerrados.

**El coordinador es el que decide cuándo proponer paralelización** — la sugiere cuando ve la oportunidad, el humano confirma o pospone.

## 7.ter Cuadro resumen al cambiar de fase

Cada vez que se cierre una sesión y se vaya a iniciar la siguiente, el coordinador entrega un **cuadro resumen** antes del prompt nuevo, con:

- Dónde estamos (sesión cerrada + sesiones cerradas previas).
- Qué se acaba de procesar (artefactos producidos).
- Qué sigue (sesión próxima + tipo + modelo recomendado).
- Qué falta hasta cerrar el subproyecto (sesiones pendientes con orden).
- Si hay paralelización posible activa (qué Fase A se puede iterar en otra conversación).

## 8. Coordinación

El humano vuelve a la conversación del coordinador cada vez que:

- Quiere arrancar el subproyecto o una nueva sesión.
- Terminó una fase / sesión y quiere saber qué sigue.
- Tiene una duda sobre el plan o quiere cambiar algo.

El coordinador, antes de pasar el siguiente prompt:

1. Chequea el estado real del repo (`docs/redesign/`, `src/`, branch `redesign`).
2. Confirma que lo que el humano dijo cerrar está cerrado de verdad.
3. Si algo no cuadra, lo dice antes de avanzar.
4. Confirma qué sesión sigue, en qué tipo de conversación, y pasa el prompt.

Cada prompt que el coordinador entrega lleva un encabezado obligatorio con:

```
═══════════════════════════════════════
Modelo: Sonnet 4.6 | Opus 4.7 | Opus 4.7 1M
Esfuerzo: Medio | Alto
Conversación: NUEVA | Continuación
Tipo: Implementación foundational | Fase A módulo | etc.
═══════════════════════════════════════
```

## 9. Guía de modelo + esfuerzo por tipo de tarea

**Lineup de modelos en el picker de Claude Code (mayo 2026):**

- **Opus 4.7** — el más capaz. "Step-change improvement in agentic coding" sobre Opus 4.6.
- **Opus 4.7 1M** — variante con 1M tokens de contexto. Solo cuando la sesión necesita leer >200k tokens (raro: S12 audit final, S13 extracción cross-todo).
- **Sonnet 4.6** — mejor balance speed + intelligence. Default para casi todo.
- **Haiku 4.5** — el más rápido. Útil para tareas mecánicas chicas.
- **Opus 4.6 (Heredado)** — legacy. No usar salvo razón muy específica.

**Niveles de Esfuerzo:** Bajo / Medio / Alto / Extra alto / Max. Es la abstracción de Claude Code sobre el thinking budget; aplica a todos los modelos del picker.

**No existe Sonnet 4.7.** El último Sonnet es 4.6. El último Opus es 4.7. (Verificado contra docs oficiales Anthropic, mayo 2026.)

Recomendación por tipo de tarea:

| Tipo de tarea                                                            | Modelo      | Esfuerzo |
| ------------------------------------------------------------------------ | ----------- | -------- |
| Implementación mecánica (S3-B, S4-B atoms, S12, S13)                     | Sonnet 4.6  | Medio    |
| Implementación de módulo compleja (S5-B, S6-B, S7-B, S8-B, S10-B, S11-B) | Opus 4.7    | Alto     |
| Fase A foundational (specs autónomos: S5-A, S9-A, S11-A, S12-A)          | Sonnet 4.6  | Alto     |
| Fase A módulo (investigación + propuesta + iteración)                    | Sonnet 4.6  | Alto     |
| Audit / red team / compliance                                            | Sonnet 4.6  | Alto     |
| Decisión cross-cutting con múltiples ADRs (raro)                         | Opus 4.7    | Alto     |
| Audit final S12 / extracción S13 si supera 200k tokens                   | Opus 4.7 1M | Alto     |

**Cuándo Opus 4.7 paga la diferencia de precio (~5× vs Sonnet 4.6):**

- Implementación agentic compleja — múltiples archivos, server actions, integración, validación cross-flujo. El "step-change in agentic coding" sobre Opus 4.6 reduce idas-y-vueltas con build/lint/test fallidos.
- Decisiones genuinamente novedosas (raras post-S4 en este subproyecto).

**Cuándo Sonnet 4.6 es estrictamente mejor:**

- Tareas mecánicas donde Opus es overkill (S3-B es exactamente este caso).
- Discusiones iterativas largas donde el costo por turn importa.
- Specs autónomos donde el razonamiento es lectura + síntesis, no decisión novedosa.

**Sobre Extra alto y Max:**

Casi nunca valen la pena. Son token-hungry sin retorno claro para tareas con specs como input. Reservalos para cuando una sesión queda atascada con Alto y necesita un empujón. **No usar por default.** El gasto extra rara vez compensa contra el beneficio marginal.

**Sobre Opus 4.7 1M:**

Solo cuando la sesión va a leer >200k tokens. En este subproyecto eso pasa raramente: S12 (audit final cross-todo `docs/redesign/`), S13 (extracción cross-todo para reemplazar `docs/design/`). Para sesiones normales, Opus 4.7 standard alcanza. Arrancar con standard y escalar a 1M solo si el agente reporta corte de contexto.

## 10. Dashboard fuera del alcance

El módulo **Dashboard** queda **fuera del alcance** de este subproyecto. Razón: el FRD del dashboard no existe, no está claro qué métricas/widgets debe tener, y rediseñar sobre supuestos genera trabajo que se va a tirar.

El dashboard actual sigue funcionando con su versión existente. Cuando S13 cierre y `docs/design/` sea reemplazado por el sistema nuevo, **cualquier rediseño futuro del dashboard usará el sistema documentado en `docs/design/`** (que será el output de este subproyecto). Esa será una sesión post-rediseño cuando el FRD esté definido.

Las referencias al dashboard en S2 (wireframe `screens/dashboard.md`), S3 (`tokens.md` micro-stats) y S4 (`<MicroStatCard>`) **se conservan como referencia** pero no se implementan en este subproyecto.

## 11. Mapa de sesiones renumerado

Ver tabla "Sesiones (estado)" en `README.md` §Sesiones para el mapa actualizado con la renumeración aplicada desde S5.
