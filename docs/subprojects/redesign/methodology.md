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

#### Fase A.1 — Extensión del demo HTML + bootstrap del spec

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

**En paralelo, bootstrappea los specs markdown** con estructura mínima (no esperan a A.3):

- `docs/redesign/screens/<screen>.md` por cada pantalla con: frontmatter, layout (referenciando los anchors del demo), componentes consumidos (tabla con `<ComponentName>` + spec link + props clave), datos consumidos (modelo Prisma + query), estados visuales conocidos, y stubs marcados `// PENDING A.2/A.3` para las secciones que se completan después (comportamiento e interacción, validaciones, i18n, accesibilidad detallada, edge cases, anti-patrones).
- `docs/redesign/modules/<module>.md` (doc maestro) con: frontmatter, resumen ejecutivo (1 párrafo), tabla de pantallas + anchors, lista inicial de funcionalidades preservadas (mapping al FRD), y stubs `// PENDING A.2/A.3` para cambios visuales aplicados, cambios de comportamiento, propuestas funcionales `P-SX-NN`, componentes propios del módulo, y handoff brief.

El spec inicial es **el contrato técnico que viaja con el HTML**, no una formalización post-hoc. Su función en A.1 es: dejar visible qué componentes se asume consumir, qué pantallas existen, y qué estados se piensan cubrir — para que el humano lo audite junto con el HTML desde la primera ronda.

Al terminar, devuelve al humano: **"demo extendido en `_notes/demo-screens.html` + specs bootstrappeados en `screens/<screen>.md` y `modules/<module>.md`. Abrí el HTML en el browser, leé los specs en paralelo, y revisá las pantallas X, Y, Z. Iterá conmigo hasta aprobación visual — los specs se actualizan en cada iteración estructural."**

#### Fase A.2 — Iteración visual del HTML + actualización quirúrgica del spec

El humano abre el HTML, ve las pantallas, decide. Itera con el agente:

- "No me gusta que la card tenga X, cambiala por Y."
- "Falta mostrar el contador de Z."
- "El estado empty de esta pantalla se ve frío, agregale la mascota sleeping."

El agente edita `_notes/demo-screens.html` y, **en el mismo turno**, actualiza los specs markdown afectados según este criterio:

- **Cambios estructurales** (componente nuevo, sección nueva, pantalla nueva, estado nuevo, comportamiento nuevo, token cambiado, prop cambiada) → actualizar `screens/<screen>.md` y/o `modules/<module>.md` correspondiente en el mismo turno. Reflejar en la tabla de componentes consumidos, en estados visuales, en notas de comportamiento, etc.
- **Cambios cosméticos puros** (color de un border que ya estaba, padding ajustado, gap entre elementos, tamaño de fuente dentro de un componente ya documentado) → solo HTML, sin tocar el spec. Mencionarlo en el mensaje de cierre del turno para que el humano sepa que el spec sigue vigente.

Devuelve "iteración Nº lista. HTML: [resumen]. Specs actualizados: [paths o 'ninguno — solo cosmético']". Si en una ronda dudás si el cambio es estructural o cosmético, tratá como estructural (actualizá el spec, el costo extra es bajo).

**Cero React durante esta sub-fase.** Tokens chicos por iteración (decenas de líneas de HTML+CSS+spec por turno). Feedback humano inmediato y visual.

#### Fase A.3 — Aprobación visual + completar specs + handoff

Cuando el humano dice "aprobado visualmente", los specs ya existen y están en sync con el HTML (bootstrappeados en A.1, actualizados quirúrgicamente en cada iteración estructural de A.2). En A.3 el agente NO arranca de cero — completa los stubs marcados `// PENDING A.2/A.3` que quedaron pendientes:

1. **Completá los specs de pantalla** (`docs/redesign/screens/<screen>.md`) con las secciones que requieren visión completa post-iteración: comportamiento e interacción detallado (tabla obligatoria — ver §"Cobertura completa de specs" abajo), validaciones Zod + reglas post-blur, i18n keys propuestas (clave + ES + slot), accesibilidad (focus management, ARIA, keyboard), edge cases acordados, anti-patrones surgidos durante la iteración, notas para Fase B.
2. **Completá el doc maestro** (`docs/redesign/modules/<module>.md`) con: tabla "Cambios visuales aplicados en Fase A (aprobados)", tabla "Cambios de comportamiento e interacción aplicados", "Propuestas de cambio funcional" `P-SX-NN` con decisión humana pendiente, inventario de componentes consumidos (descripción de USO no replicación de spec — L043), cláusula de spec vigente (mini-sesiones cross-cutting abiertas que afecten al módulo — L045).
3. **Iterá el doc maestro con el humano** si hay cambios funcionales `P-SX-NN` que aprobar/rechazar (los visuales ya están aprobados).
4. Cuando humano apruebe todo, escribí la sección **"Handoff a Fase B"** en el doc maestro con: archivos a crear/modificar, componentes a consumir, tokens a usar, decisiones cerradas, edge cases, copy aprobada (i18n), anti-patrones, preguntas abiertas, validación esperada, **comportamiento crítico para Fase B**.
5. Cerrá Fase A.

El spec markdown sigue siendo **el contrato técnico** y va de la mano del HTML aprobado: el HTML es la fuente de verdad visual, el markdown es la fuente de verdad funcional + comportamental + estructural.

##### Cobertura completa de specs de Fase A módulo

**Contexto.** Durante S6 se detectó que los specs de Fase A se sesgaban a "describir el visual" pero el rediseño SIEMPRE genera **cambios comportamentales** (autosave, debounce, optimistic updates, atajos, gestos, validación post-blur, etc.). Si la Fase A no los captura explícitamente, Fase B improvisa o copia el comportamiento viejo del FRD, generando inconsistencia.

Los specs de Fase A módulo deben ser **autosuficientes para implementación**. Un agente de Fase B leyendo solo `modules/<name>.md` + `screens/*.md` + `components/*.md` debe poder implementar el módulo completo **sin volver al FRD original** salvo casos puntuales.

###### Estructura obligatoria del spec de pantalla

Cada `screens/<screen>.md` debe incluir como secciones obligatorias:

1. **Layout** — estructura visual referenciando el HTML aprobado (anchor del demo).
2. **Componentes consumidos** — tabla con cada componente + spec + props clave.
3. **Datos consumidos** — qué viene del modelo (Prisma) + qué query.
4. **Server actions invocadas** — link a `_actions/` actuales o nuevas.
5. **Estados visuales** — default / loading / empty / error / variantes específicas.
6. **Comportamiento e interacción** — **sección crítica nueva**, ver desglose abajo.
7. **Validaciones** — Zod + reglas post-blur.
8. **i18n keys propuestas** — tabla con clave + ES + slot.
9. **Accesibilidad** — focus management, ARIA, keyboard.
10. **Edge cases acordados** — lista enumerada con comportamiento esperado.
11. **Anti-patrones** — qué no hacer + por qué.
12. **Notas para Fase B** — info técnica adicional.

###### Sección "Comportamiento e interacción" — qué debe cubrir

Esta sección documenta TODO lo que la pantalla hace cuando el usuario interactúa, incluyendo cosas que el FRD no necesariamente especifica pero que el rediseño introduce. Items obligatorios a evaluar:

- **Estados interactivos** — hover, focus, active, disabled, loading. Qué cambia visualmente y qué CSS state activa.
- **Triggers de eventos** — qué pasa con click, type, blur, scroll, submit. Especialmente importante para campos editables.
- **Autosave / debounce / throttle** — si aplica, especificar:
  - Trigger (typing, blur, intervalo).
  - Tiempo de debounce (ej. 300ms sin cambios).
  - Indicador visual (ej. "Guardado hace X" en `--text-muted`).
  - Manejo de errores (retry, toast).
- **Optimistic updates** — si la mutación afecta state visible, especificar update local + revert si server falla. Aplicar `optimistic-client-updates.mdc`.
- **Atajos de teclado** — `⌘K`, `Esc`, `Z` para undo, navegación con flechas, etc.
- **Gestos mobile** — swipe (izquierda / derecha), long-press, pull-to-refresh, drag-to-reorder.
- **Validación inline** — cuándo se dispara (post-blur, on-submit), cómo se muestra el error, dónde se enfoca el cursor en caso de error de submit.
- **Confirmaciones** — cuándo se requiere modal de confirm vs cuándo se aplica directo (lifecycle por reversibilidad — ADR 0001 D6).
- **Loading states** — spinners, skeletons, disabled state durante mutación.
- **Empty states** — qué se muestra cuando no hay datos, qué CTA si aplica, mascota si aplica.
- **Focus management** — qué se enfoca al abrir un modal/sheet, al cerrar, al cambiar de paso de wizard, después de submit exitoso.
- **Keyboard shortcuts** que conviven con browser defaults (ej. `Z` para undo conflicta con `Cmd+Z` nativo — documentar resolución).

Si un comportamiento del rediseño **difiere del FRD original** (ej. nota con autosave en lugar de botón guardar), documentar:

- Comportamiento original (1 línea).
- Comportamiento nuevo propuesto.
- Razón del cambio.
- Si requiere actualización del FRD: SÍ (con ADR) / NO (es solo comportamiento, FR sigue siendo el mismo).

###### Estructura obligatoria del doc maestro

Cada `modules/<name>.md` debe incluir, además de las secciones ya formalizadas en §6.quinquies (funcionalidades preservadas, cambios visuales, componentes propios, etc.), una **sección nueva obligatoria**:

**"Cambios de comportamiento e interacción aplicados"**

Tabla con cada cambio comportamental detectado durante la iteración:

| Comportamiento           | Pantalla / componente | Original (FRD)         | Nuevo (rediseño)                                         | Razón                                                      | Requiere ADR?                      |
| ------------------------ | --------------------- | ---------------------- | -------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------- |
| Autosave de nota privada | store-detail sidebar  | Botón "Guardar" manual | Autosave 300ms post-cambio + indicator "Guardado hace X" | Reduce fricción, alinea con apps modernas (Notion, Linear) | No (FR no cambia, solo el trigger) |
| Validación de form       | wizard creación       | On-change inmediata    | Post-blur + on-submit                                    | Principle §3 (validación que ayuda no que regaña)          | No                                 |
| Cancelar pedido          | order-detail acciones | Confirm modal genérico | Toast neutral-undo 8s                                    | ADR 0001 D4 + D6 (reversibilidad)                          | No (ya hay ADR)                    |

Si algún cambio requiere ADR (cambia funcionalidad, no solo comportamiento), levantarlo durante Fase A y resolverlo antes de cerrar el doc maestro.

###### Sección obligatoria en Handoff brief

Además del inventario de componentes core consumidos + cláusula de spec vigente, agregar:

**"Comportamiento crítico para Fase B"**

Lista de comportamientos no obvios que la implementación debe respetar. Sirve como checklist explícita para el agente de Fase B. Ejemplo:

```
- Autosave de nota: debounce 300ms, indicator "Guardado hace Xs"
  con `Date.now() - lastSavedAt`. Sin spinner durante typing.
  En error, toast destructive con CTA "Reintentar".
- Wizard step navigation: bolitas clickeables hacia atrás siempre.
  Hacia adelante solo si paso actual está válido.
- Filter drawer apply: optimistic update del listado + URL params,
  sin esperar server. Revert si server falla con toast warning.
- Swipe izquierda en row mobile: revela acciones rápidas con
  `--accent` indigo. Cancelable con tap fuera del row.
```

###### Trigger del agente de Fase A

Durante la iteración del HTML (Fase A.2), el agente debe **proactivamente** identificar comportamientos donde el rediseño difiere del FRD original. No esperar a que el humano los pida. Si el HTML muestra un campo de texto con auto-resize, el agente pregunta: "¿hacemos autosave de este campo? ¿con qué debounce? ¿qué indicator visual?".

#### Fase B — Implementación React

El agente abre el HTML aprobado **en cada paso de implementación** como referencia visual concreta + el handoff brief como contrato funcional. Implementa React. Cero ambigüedad visual porque el HTML es la verdad pixel-perfect-ish (no exacto, pero la vibe es vinculante).

##### Cinco mecanismos obligatorios de Fase B

**Contexto.** Durante S6 Fase B se detectó que la implementación quedaba incompleta y con discrepancias visuales vs el HTML del demo. Causa raíz: el agente avanzaba sin checklist activa, sin verificación visual incremental, sin reportes de progreso intermedio y sin auditoría comparativa final. El esfuerzo / thinking budget no era el problema — la metodología sí.

Toda Fase B de módulo (S6, S7, S8, S10) y toda Fase B foundational compleja (S5, S11) **debe** incluir estos cinco mecanismos. El coordinador los embebe en cada prompt de Fase B.

**1. TodoWrite granular obligatorio.**

El agente usa `TodoWrite` con un item por unidad de trabajo:

- Cada componente core pull-based (1 item).
- Cada componente propio del módulo (1 item).
- Cada pantalla refactorizada (1 item).
- Migration Prisma (1 item).
- Cada server action ajustado (1 item).
- Cada query ajustado (1 item).
- i18n keys (1 item agregable).
- Tests por componente con branching / discriminated union (1 item por componente con tests).
- Auditoría comparativa final (1 item).

El item activo está siempre en `in_progress`. Los completados pasan a `completed` en el mismo turno en que se cierran. Sin TodoWrite el agente pierde track y deja items sin terminar.

**2. Verificación visual incremental contra HTML del demo.**

Después de implementar **cada pantalla completa** (no cada componente — cada pantalla refactorizada), el agente:

1. Abre el HTML del demo en el anchor correspondiente (ej. `#s6-stores-list-default`).
2. Lista los elementos visuales clave del HTML (estructura, accent chips, hover states, eyebrows mono, bordes con `--radius-*`, micro-decoradores, etc.).
3. Compara con su implementación React.
4. Lista gaps visuales (elementos del HTML que la implementación no tiene o tiene distinto).
5. Itera la implementación hasta cerrar gaps significativos.
6. Solo cuando la coincidencia visual es razonable, marca la pantalla como `completed` en TodoWrite y avanza.

**3. Reportes incrementales en chat (no solo al final).**

Cada vez que el agente cierra un grupo de items (un componente core + sus tests, o una pantalla refactorizada con su verificación visual), devuelve un mini-update ≤80 palabras:

```
PROGRESO: [X de Y items]
Acabo de cerrar: [item]
Verificación visual vs HTML: [pass / gap arreglado]
Validación local: [type-check pass / pendiente / falla]
Siguiente: [próximo item]
```

Esto permite al humano detectar desviaciones temprano e interrumpir si hace falta.

**4. Auditoría comparativa exhaustiva antes de cerrar.**

Antes de marcar la Fase B como cerrada, el agente ejecuta auditoría sistemática contra el handoff brief del módulo (`modules/<name>.md §12`):

| Item del handoff                             | Verificación                                           | Resultado           |
| -------------------------------------------- | ------------------------------------------------------ | ------------------- |
| A. Inventario de componentes core consumidos | Cada uno tiene consumidor real en `src/`?              | ✅/❌ por item      |
| B. Componentes propios del módulo            | Cada uno implementado en path correcto?                | ✅/❌ por item      |
| C. Pantallas                                 | Cada anchor del demo HTML tiene contraparte funcional? | ✅/❌ por anchor    |
| D. Funcionalidades preservadas               | Cada FR mapeado funciona?                              | ✅/❌ por FR        |
| E. Decisiones cerradas durante iteración     | Cada una aplicada?                                     | ✅/❌ por decisión  |
| F. Edge cases acordados                      | Cubiertos?                                             | ✅/❌ por edge case |
| G. Copy aprobada                             | Agregada a i18n?                                       | ✅/❌               |
| H. Anti-patrones                             | Evitados?                                              | ✅/❌               |

Si cualquier item está ❌ o ⚠️, el agente lo arregla antes de cerrar.

**5. Gate de cierre estricto.**

La Fase B NO está cerrada hasta que TODOS los siguientes son ✅:

- TodoWrite: 100% de items en `completed`.
- Auditoría comparativa (mecanismo 4): 0 gaps.
- Validación: `npm run type-check` ✅, `npm run lint` ✅, `npm run test` ✅, `npm run validate-build` ✅.
- Verificación visual de cada pantalla refactorizada vs HTML del demo: 0 gaps significativos.
- Reporte final con cobertura del handoff brief expresada en % explícito (debe ser 100% o cerca).

Si algo no llega a ✅, el agente no reporta cierre — sigue trabajando hasta que llegue.

##### Por qué subir el thinking / esfuerzo NO resuelve esto

Esfuerzo extra ayuda en problemas de razonamiento abierto (decisiones difíciles, debugging de race conditions, refactor con múltiples constraints en tensión). Para implementación de specs claras, el esfuerzo extra raramente cambia el output. Lo que falla cuando hay implementación incompleta es **ejecución sistemática y verificación**, no profundidad de razonamiento. Las 5 correcciones atacan eso directamente.

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

## 6.sexties Troubleshooting de renderizado CSS (cross-sesión)

Cuando un color, borde, o estilo "no se ve bien" a pesar de que el token parece estar asignado correctamente, consultar:

**`docs/redesign/_notes/troubleshooting-css-rendering.md`**

Cubre dos patrones de bug documentados durante el subproyecto:

1. **Cascade override silencioso (Bug #1):** shorthand Tailwind (`[border:1px_solid]`) en una clase base sobreescribe longhand (`[border-color:var(--token)]`) en una clase de estado porque Tailwind v4 genera ambas reglas con la misma especificidad. Solución: nunca dividir shorthand/longhand entre base y estado — poner el shorthand completo directamente en la clase de estado.

2. **OKLCH vs rgba en dark mode (Bug #2):** tokens definidos con `oklch(L% C H / alpha)` en `globals.css` dan un resultado visualmente diferente al `rgba(r, g, b, alpha)` del demo HTML. Para tokens donde la coincidencia visual exacta con el demo es prioritaria, usar el literal rgba del demo.

El agente debe revisar este doc **antes de intentar re-asignar un token** cuando un estilo no se renderiza como se espera.

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

### 7.alpha Modificaciones fuera de `docs/redesign/` requieren flag previo

**Contexto.** Durante S6 Fase A, el agente modificó dos archivos fuera del subproyecto sin flaggearlo: `.cursor/rules/icons.mdc` (refuerzo de regla, aprobado post-facto) y `docs/product/.../frd-04-store-domain.md` (4 requirements + 2 reglas de negocio nuevos, aprobados post-facto vía ADR 0009). Aunque ambos casos terminaron bien, el patrón es riesgoso porque mete cambios cross-cutting silenciosos.

**Regla.** Cualquier agente del subproyecto que necesite modificar archivos fuera de `docs/redesign/` debe **flaggear el cambio en chat antes de aplicarlo y esperar aprobación humana explícita**.

Aplica a todo lo siguiente:

- `.cursor/rules/*.mdc` — reglas del repo cross-agent.
- `docs/product/**` — FRDs, Blueprints, Work Orders, glossary.
- `docs/development/**`, `docs/tooling/**` — docs de proceso.
- `src/**` durante **Fase A** — esta fase es solo docs / HTML, no código.
- `prisma/**` — schema y migrations.
- `package.json`, configuración del repo.
- Cualquier otro archivo del repo no contenido en `docs/redesign/`.

**Excepción única:** durante **Fase B de implementación**, el agente puede modificar `src/`, `prisma/`, locales y archivos relacionados con el alcance acordado en el handoff brief, sin flag adicional. Eso es lo que la sesión está autorizada a hacer.

**Formato del flag obligatorio antes de aplicar:**

```
═══════════════════════════════════════
FLAG — CAMBIO FUERA DE docs/redesign/

Archivo a modificar: <path>
Tipo de cambio: <descripción>
Motivación: <por qué surge desde esta sesión>
Riesgo: <qué impacta>
Alternativa si lo descartás: <qué hago en su lugar>

¿Aplico / lo descarto / lo postergo a un ADR formal?
═══════════════════════════════════════
```

**Si el agente aplica un cambio fuera de `docs/redesign/` sin flag previo**, el coordinador (o el humano) debe:

1. Detectarlo (review del `git status` antes de cada commit).
2. Decidir aceptar / revertir / formalizar con ADR retroactivo.
3. Anotar en `_notes/cross-cutting-changes.md` como "violación procesal" para tracking.

Esto NO es para penalizar al agente — es para mantener trazabilidad cuando el subproyecto toca cosas externas.

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

## 7.quater Cambios cross-cutting durante una sesión (cross-sesión)

Durante cualquier sesión (módulo o foundational) el agente puede detectar que algo del subproyecto **fuera de su scope actual** necesita cambiar. Ejemplo: estás en S6 implementando Tiendas y descubrís que el `<Modal>` necesita más variantes, o que el sidebar necesita una sección nueva.

### Cuatro tipos de cambios

| Tipo                                          | Ejemplo                                                     | Procedimiento                                                                           |
| --------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **1 — Trivial / cosmético**                   | Padding de un chip, color de un border que está mal por 2px | Inline en sesión actual + nota en session log + actualizar spec del componente afectado |
| **2 — Cambio mayor de componente core**       | API o behavior de Modal, Toast, FilterDrawer, etc.          | ADR + mini-sesión correctiva separada (numerar **M0X** si es del catálogo S4)           |
| **3 — Cambio del shell / layout**             | Sidebar, Header, MobileTabBar, FAB, Breadcrumbs             | ADR + mini-sesión "S5.1, S5.2..." dedicada                                              |
| **4 — Cambio de token / sistema visual base** | Valor de token, regla de uso de acento, jerarquía visual    | ADR + mini-sesión "S3-B.1, S3-B.2..." dedicada                                          |

### Proceso operativo (los 4 pasos)

```
1. PAUSAR la sesión actual mentalmente.

2. CLASIFICAR el cambio (tipos 1/2/3/4).

3. DECIDIR urgencia:
   ¿Bloquea la sesión actual?  → Ejecutar mini-sesión AHORA (paralela
                                  o secuencial según ancho de banda)
   ¿No bloquea?                → Registrar en backlog, ejecutar después

4. EJECUTAR según tipo y REGISTRAR en `_notes/cross-cutting-changes.md`.
```

### Numeración de mini-sesiones correctivas

Para preservar orden cronológico sin romper la numeración principal:

- **M0X** — Mejoras al catálogo de componentes (M01 Modal, M02 Toast, etc.).
- **SN.X** — Revisiones de una sesión previa (S5.1 = primera revisión del shell, S3-B.1 = primera revisión de tokens, etc.).

Cada mini-sesión tiene su session log en `sessions/M0X-<nombre>.md` o `sessions/0N.X-<nombre>.md`.

### Registro obligatorio

Toda mini-sesión correctiva tipo 2/3/4 se registra en `_notes/cross-cutting-changes.md` con:

- ID (M0X o SN.X).
- Fecha.
- Descripción.
- Tipo (1/2/3/4).
- ADR asociado.
- Status (`🟡 abierto` / `✅ aplicado`).

### Trigger de paralelización

Las mini-sesiones correctivas son ideales para correr en paralelo a una sesión principal en curso (Fase A iterativa de un módulo, mientras el agente espera feedback humano). Ver §7.bis.

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
