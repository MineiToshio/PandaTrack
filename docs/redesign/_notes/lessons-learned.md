---
title: Lecciones aprendidas — subproyecto rediseño
last_updated: 2026-05-05
status: vivo
owner: Sergio Minei
---

# Lecciones aprendidas — subproyecto rediseño

Diario estructurado de aprendizajes operativos que aparecieron durante la ejecución del subproyecto. Cada lección con origen, síntoma, causa raíz, solución, regla derivada, y dónde se aplica permanentemente.

El **playbook accionable** vive en `docs/redesign/PLAYBOOK.md`. Esto es la bitácora con contexto histórico — útil para entender por qué cada regla existe, no para consultar al implementar (para eso, leer el playbook).

## Convención

Cada entrada:

```markdown
## L0XX — Título corto

- **Origen:** sesión / problema concreto.
- **Síntoma:** qué se vio mal en la app o en el proceso.
- **Causa raíz:** por qué pasó.
- **Solución aplicada:** qué se hizo para resolverlo.
- **Regla derivada:** lo que cualquier sesión futura debe respetar.
- **Dónde vive ahora:** cursor rule, spec, código, playbook, ADR.
- **Verificable por:** cómo confirmar que la regla se aplica.
```

---

## L001 — El demo HTML no es referencia opcional, es contrato visual base

- **Origen:** S6 Fase A v1 (revertida).
- **Síntoma:** el agente de Fase A propuso "Linear-style denso" para las cards de tienda en lugar del grid de cards bonitas que muestra el demo HTML. La implementación posterior heredó ese spec defectuoso y quedó completamente diferente al demo aprobado en S2.
- **Causa raíz:** el demo HTML estaba tratado como "referencia visual opcional" en specs y prompts. Sin contrato vinculante, el agente decidió un patrón distinto.
- **Solución aplicada:** se revirtió S6 entera. Se formalizó `methodology.md` §6.quater: el demo es borrador visual base; cualquier implementación debe ser "claramente reconocible como descendiente del demo". Y §6.quinquies: HTML-first iteration para módulos.
- **Regla derivada:** la implementación debe verse como evolución directa del demo, no como una "alternativa razonable".
- **Dónde vive ahora:** `methodology.md` §6.quater + §6.quinquies; `PLAYBOOK.md` §5 workflow obligatorio.
- **Verificable por:** comparar la pantalla implementada lado a lado con el anchor del demo. Si un humano viendo ambas dice "esto es otra cosa", la implementación falló.

## L002 — Los specs de Fase A se sesgaban a visual y omitían comportamiento

- **Origen:** S6 Fase A v2.
- **Síntoma:** el spec de "nota privada de tienda" decía cómo se veía el textarea pero no que era autosave con debounce. Implementación quedó con botón "Guardar" manual.
- **Causa raíz:** los specs describían layout y componentes pero no comportamientos comportamentales (autosave, debounce, optimistic, gestos, atajos).
- **Solución aplicada:** sección obligatoria nueva en cada spec de pantalla: **"Comportamiento e interacción"** + sección obligatoria nueva en doc maestro: **"Cambios de comportamiento e interacción aplicados"**. Formalizado en `methodology.md` §6.quinquies "Cobertura completa de specs".
- **Regla derivada:** cualquier cambio comportamental respecto al FRD debe estar documentado en el spec, con tabla "original / nuevo / razón / ¿requiere ADR?".
- **Dónde vive ahora:** `methodology.md` §6.quinquies sub-sección "Cobertura completa".
- **Verificable por:** revisar que cada `screens/*.md` tenga la sección "Comportamiento e interacción" cubierta.

## L003 — Modal canónico único: prohibir forks ad-hoc

- **Origen:** M01 (mini-sesión correctiva del catálogo).
- **Síntoma:** el componente Modal del catálogo se veía plano vs el patrón Semantic Depth aprobado.
- **Causa raíz:** sin regla explícita, los agentes podían reusar el Modal viejo o crear dialog ad-hoc con Portal+div.
- **Solución aplicada:** triple cobertura — JSDoc reforzado al top de `Modal.tsx` declarando que es el único; cursor rule `.cursor/rules/modal-canonical-pattern.mdc` con `alwaysApply: true`; spec `components/Modal.md` con bloque ⚠️ destacado; demo HTML legacy `.report-modal*` actualizado al canon visual.
- **Regla derivada:** un solo modal en la app. Extender no forkear. Prohibido Portal+div ad-hoc. Prohibido copiar visual de modals viejos del demo.
- **Dónde vive ahora:** `Modal.tsx` JSDoc; cursor rule `modal-canonical-pattern.mdc`; spec `components/Modal.md`; ADR 0008; PLAYBOOK §1.
- **Verificable por:** grep de `<Portal>` + `<div>` con role=dialog ad-hoc → debe ser 0.

## L004 — `acceptEdits` permission mode es el sweet spot para implementación

- **Origen:** sesiones de Fase B múltiples.
- **Síntoma:** modo default pedía aprobación humana cada Edit/Write, lentísimo. Modo `bypassPermissions` peligroso (puede correr migrations sin OK).
- **Causa raíz:** falta de claridad sobre qué modo usar para implementación segura pero ágil.
- **Solución aplicada:** documentado en `methodology.md` y comunicado por el coordinador en cada prompt de Fase B: usar `acceptEdits` (Edits/Writes auto, Bash con confirmación humana). La migration de Prisma o cualquier comando destructivo sigue requiriendo OK explícito.
- **Regla derivada:** Fase B siempre con `acceptEdits`. Default solo para sesiones de docs / Fase A.
- **Dónde vive ahora:** prompts de Fase B del coordinador; PLAYBOOK §5.
- **Verificable por:** prompt incluye encabezado `Permission mode: acceptEdits`.

## L005 — Reportes de cierre falsos eran patrón frecuente

- **Origen:** M02, M03, S6-B varias iteraciones.
- **Síntoma:** el agente reportaba "M02 cerrado, hover lift implementado" y al verificar el código, el cambio NO estaba aplicado.
- **Causa raíz:** el agente actualizaba el spec en docs pero olvidaba aplicar al código real. O aplicaba parcialmente. Sin verificación post-cambio, el reporte mentía.
- **Solución aplicada:** formalizado en `methodology.md` §6.quinquies "Cinco mecanismos obligatorios de Fase B" — específicamente: TodoWrite granular + verificación visual incremental + reportes incrementales + auditoría comparativa + gate de cierre estricto. **Después de cada Edit, leer el archivo y pegar snippet exacto en el reporte.** Si no podés pegar snippet, no marques completed.
- **Regla derivada:** verificación post-Edit obligatoria. Snippet exacto en reportes, no descripciones.
- **Dónde vive ahora:** `methodology.md` §6.quinquies; PLAYBOOK §6.
- **Verificable por:** revisar reportes de Fase B futuros — deben incluir snippets de archivos modificados.

## L006 — Cambios fuera de docs/redesign/ requieren flag previo

- **Origen:** S6 Fase A: el agente modificó FRD `frd-04-store-domain.md` (agregó FR-04-33/34) sin flag. El humano lo notó post-facto.
- **Síntoma:** cambios silenciosos a archivos fuera del scope del subproyecto (FRD, cursor rules, schema).
- **Causa raíz:** el agente trataba "necesito agregar funcionalidad nueva" como autorización para tocar el FRD. Sin regla explícita.
- **Solución aplicada:** `methodology.md` §7.alpha — cualquier modificación fuera de `docs/redesign/` requiere flag previo en chat con formato fijo. Excepción: durante Fase B, `src/` y `prisma/` se pueden tocar según handoff brief. ADR 0009 retroactivo formalizó la decisión sobre `isPrivate`.
- **Regla derivada:** flag explícito antes de tocar FRDs, cursor rules, schema, configuración.
- **Dónde vive ahora:** `methodology.md` §7.alpha.
- **Verificable por:** `git status` post-sesión — archivos fuera de `docs/redesign/` y `src/`/`prisma/` (cuando aplique) deben corresponder a flags aprobados.

## L007 — Pills/chips con tokens incorrectos: `--border` vs `--border-strong`

- **Origen:** S6 Fase B + M03-fix múltiple.
- **Síntoma:** chips/pills se veían con borde de otro color que el demo. Diferencia sutil pero notoria.
- **Causa raíz:** el agente se confundía entre `--border` (divisores internos) y `--border-strong` (borders perimetrales destacados). Aplicaba el wrong en cada slot.
- **Solución aplicada:** documentado en PLAYBOOK §2 con regla clara — `--border` para divisores; `--border-strong` para borders destacados. Y receta CSS exacta de cada slot del FilterDrawer en el cursor rule.
- **Regla derivada:** antes de elegir entre `--border` y `--border-strong`, mirar el demo HTML del componente equivalente.
- **Dónde vive ahora:** PLAYBOOK §2 "Borders".
- **Verificable por:** auditoría visual contra demo.

## L008 — Cache de Next puede esconder cambios aplicados

- **Origen:** múltiples rounds de S6-B.
- **Síntoma:** humano hacía hard reload del browser y seguía viendo código viejo. Conclusión incorrecta: "el agente no aplicó el cambio".
- **Causa raíz:** Next cachea builds en `.next/`. Hard reload del browser solo limpia cache del cliente, no del server.
- **Solución aplicada:** ritual estándar para verificar cambios visuales: matar server, `rm -rf .next`, `npm run dev`, hard reload.
- **Regla derivada:** antes de reportar "el agente no aplicó el cambio", limpiar `.next/`.
- **Dónde vive ahora:** PLAYBOOK §6 (paso de verificación visual incremental).
- **Verificable por:** humano confirma que rebuilteó antes de reportar fallo.

## L009 — Stepper top y eyebrows son cosas distintas

- **Origen:** S6 wizard creación.
- **Síntoma:** el stepper top mostraba "PASO 1 · TIPO" cuando debería mostrar solo "Tipo". El eyebrow de la section card sí decía "PASO 1 · TIPO" — corrupción cross-purpose.
- **Causa raíz:** el agente reusó la i18n key `step1.eyebrow` para el label del stepper. Las dos cosas (eyebrow del card vs label del top stepper) son diferentes y necesitan keys separados.
- **Solución aplicada:** agregadas keys `step1.shortLabel` ... `step5.shortLabel` (ES + EN). El stepper top consume `shortLabel`. El eyebrow de la section card sigue consumiendo `eyebrow`.
- **Regla derivada:** stepper top y section card eyebrow son diferentes. Keys separados.
- **Dónde vive ahora:** `i18n/locales/es/stores.json` y `en/stores.json` — patrón replicable para Orders/Deliveries wizards.
- **Verificable por:** los stepper top de cada wizard en la app no muestran "PASO N · ".

## L010 — Demo HTML del FilterDrawer "tag-autocomplete" se aparta deliberadamente del demo base

- **Origen:** S6 Fase A, M03.
- **Síntoma:** demo HTML muestra "input search + chips abajo" para país. Humano prefiere "multi-tag inline" (legacy `StoreMultiTagAutocomplete`).
- **Causa raíz:** el demo del FilterDrawer mostraba el patrón `pills-search` (input + lista de pills). Pero la UX legacy de la app tenía multi-tag autocomplete inline, que el humano prefería.
- **Solución aplicada:** se introdujo `tag-autocomplete` como nuevo type del FilterDrawer. País + Importa desde lo usan. Documentado en `components/FilterDrawer.md` y reflejado en demo HTML.
- **Regla derivada:** cuando una decisión humana se aparta del demo, **documentar explícitamente** en el spec del módulo + agregar el type/variant correspondiente al componente core. NO dejar el demo "ganando" tácitamente.
- **Dónde vive ahora:** `FilterDrawer.tsx`, `components/FilterDrawer.md`, PLAYBOOK §1.
- **Verificable por:** `tag-autocomplete` aparece en la discriminated union de `FilterSection`.

## L011 — Status de tienda NO se muestra en directorio público

- **Origen:** S6 audit listado de tiendas.
- **Síntoma:** la implementación mostraba chip "Pendiente" en directory público. El humano decidió que no debe verse ahí.
- **Causa raíz:** decisión humana implícita en S2 que nunca se documentó explícitamente.
- **Solución aplicada:** decisión humana explícita 2026-05-03 en cross-cutting-changes (entrada S6.1) — directorio público filtra a APPROVED, status visible solo en detalle.
- **Regla derivada:** filtros de visibilidad que se basan en estado de moderación deben estar explícitos en el spec del listado.
- **Dónde vive ahora:** `cross-cutting-changes.md` S6.1; modules/stores.md handoff.
- **Verificable por:** query del listado `/stores` filtra `status = APPROVED`.

## L012 — Las pantallas full-screen del demo NO son modals

- **Origen:** M03-fix.
- **Síntoma:** el agente confundió `#s6-store-create-duplicate-detected` y `#s6-store-create-category-request` (que son flujos de pantalla completa con app-shell) con modals reales.
- **Causa raíz:** la nomenclatura del demo no era explícita sobre qué es flujo vs qué es overlay.
- **Solución aplicada:** documentado en cursor rule de modal — el único modal real legacy era `.report-modal*`, ya mapeado al canon. Las pantallas full-screen del demo no son modals.
- **Regla derivada:** verificar el markup del demo (¿tiene `app-shell`? → es flujo; ¿tiene `role=dialog` con overlay? → es modal real).
- **Dónde vive ahora:** `.cursor/rules/modal-canonical-pattern.mdc`.
- **Verificable por:** lectura del rule.

---

## L013 — Surface vs surface-elevated en dark mode (3% vs 6% luminosity)

- **Origen:** S6 — refactor de WizardStep en dark mode.
- **Síntoma:** las cards del wizard se veían "muy planas" sobre el canvas dark.
- **Causa raíz:** `--background` (oklch 10%) y `--surface` (oklch 13%) tienen apenas 3% de diferencia de luminosidad — invisible al ojo. `--surface-elevated` (oklch 16%) da 6% de separación.
- **Solución:** cambiar a `--surface-elevated` para cards que viven directamente sobre canvas en dark mode.
- **Regla derivada:** antes de elegir entre `--surface` y `--surface-elevated`, calcular Δ luminosity. <5% es invisible visualmente. Para cards sobre canvas en dark mode, default a `--surface-elevated`.
- **Dónde vive:** PLAYBOOK §2 Tokens.
- **Cross-módulo:** sí. Aplica a cualquier card en dark mode.

## L014 — Card que contiene Input/Textarea: backgrounds distintos

- **Origen:** S6 — rediseño de "Tu nota privada".
- **Síntoma:** textarea se "perdía" dentro del card que la contiene.
- **Causa raíz:** ambos usaban `--surface-elevated`. Mismo color = invisible.
- **Solución:** card en `--surface`, input en `--surface-elevated`.
- **Regla derivada:** convención del proyecto — input siempre `--surface-elevated`, card que lo contiene debe ser `--surface` (Card variant `outlined`, no `elevated`).
- **Dónde vive:** PLAYBOOK §2 Tokens.
- **Cross-módulo:** sí. Notes en orders, comentarios en deliveries, settings forms.

## L015 — Border consistency entre variants de un componente

- **Origen:** S6 — alturas de botones en footer de edit.
- **Síntoma:** botón ghost medía 30px y primary 32px aunque ambos `size="sm"`.
- **Causa raíz:** ghost/secondary/outline tienen `border: 1px solid`, primary/destructive no. Con `box-sizing: border-box`, el border come 2px del área de contenido.
- **Solución:** `[border:1px_solid_transparent]` a primary/destructive. Border invisible pero iguala el accounting.
- **Regla derivada:** cuando dos variants conviven lado a lado, todas deben tener el mismo grosor de borde, transparente cuando no se ve. Aplica a Chip, IconButton, Badge.
- **Dónde vive:** PLAYBOOK §1 Componentes (Button), §4 Anti-patterns.
- **Cross-módulo:** sí. Aplica a cualquier sistema de variants.

## L016 — Backward-compat al rediseñar componente core con consumidores

- **Origen:** S6 — Modal canónico ADR 0008 con 5+ consumidores legacy.
- **Síntoma:** reescribir wholesale rompía consumidores en cascada.
- **Causa raíz:** API nueva (`open`/`onOpenChange`/`subtitle`/`primaryAction`) ≠ API legacy (`isOpen`/`onClose`/`description`).
- **Solución:** API aditiva — aceptar AMBOS sets de props (alias de los legacy a los nuevos). Migración de consumidores se hace sesión por sesión.
- **Regla derivada:** primer commit de redesign de componente con consumidores en producción es API-aditivo. Nunca breaking change de API en la misma PR que cambia el visual.
- **Dónde vive:** PLAYBOOK §1 Componentes (sub-sección "Redesign de componente con consumidores").
- **Cross-módulo:** sí. Sheet, FilterDrawer, DetailSidebar, WizardAccordion seguirán este patrón.

## L017 — Wizard orchestrator: lista explícita de steps (no `Children.count`)

- **Origen:** S6 — Stepper rendereado fuera del Accordion necesitaba acceso al activeStep.
- **Síntoma:** total de steps no respetaba steps condicionales (BUSINESS=5 vs PERSON=4).
- **Causa raíz:** asumir `totalSteps = Children.count` rompe con conditional rendering.
- **Solución:** prop `steps?: StepperStep[]` al WizardAccordion. Cuando se pasa, usa `steps.length` como total.
- **Regla derivada:** orquestadores wizard nunca asumen `totalSteps = Children.count`. Aceptar lista explícita como source-of-truth.
- **Dónde vive:** spec WizardAccordion + PLAYBOOK §1.
- **Cross-módulo:** sí. Orders (5 pasos), Deliveries (4 con prefill).

## L018 — Wizard con form único: `keepBodyMounted=true` por default

- **Origen:** S6 — uncontrolled inputs en step 4 perdían valor al llegar al step 5.
- **Síntoma:** `new FormData(form)` no capturaba inputs de steps colapsados.
- **Causa raíz:** `<WizardStep>` solo rendereaba body cuando `isActive`. El form único pierde inputs uncontrolled fuera del DOM.
- **Solución:** prop `keepBodyMounted=true` (default) que mantiene body en DOM con `hidden` + `aria-hidden` cuando step no activo.
- **Regla derivada:** wizard que use form único necesita `keepBodyMounted=true`. Solo lazy-mount cuando body es muy pesado y se admite perder estado.
- **Dónde vive:** spec WizardAccordion + PLAYBOOK §1.
- **Cross-módulo:** sí. Orders, Deliveries con rows uncontrolled.

## L019 — Modal sin footer requiere `bodyClassName="pb-6"`

- **Origen:** S6 — modal de governance sin acciones, texto inferior pegado al borde.
- **Causa raíz:** `Modal.tsx` aplica `pb-1` al body por default asumiendo que footer aporta los 20px restantes.
- **Solución:** pasar `bodyClassName="pb-6"` cuando no hay actions. (Mejora futura: detectar `hasFooter` automático.)
- **Regla derivada:** Modal sin `primaryAction`/`secondaryAction` debe pasar `bodyClassName="pb-6"`.
- **Dónde vive:** PLAYBOOK §3 Patrones (Modal info sin actions).
- **Cross-módulo:** sí.

## L020 — Wizard layout: progressive disclosure (create) vs all-open (edit)

- **Origen:** S6 — humano rechazó wizard linear para edit ("entrar bloqueado en paso 1 disabled es complicado").
- **Causa raíz:** crear y editar tienen UX fundamentalmente distintos. Crear es onboarding guiado; editar es cirujano (entra a cambiar UNA cosa).
- **Solución:** prop `layout: "wizard" | "all-open"` al WizardAccordion. En `all-open` todos los paneles renderizan body siempre, header se vuelve estático sin chevron, sin botones step-level. Stepper top oculto.
- **Regla derivada:** no asumir que wizard usado en flow A (creación) sirve igual en flow B (edición). Exponer `layout` desde el inicio.
- **Dónde vive:** PLAYBOOK §1 Componentes (Wizard layouts).
- **Cross-módulo:** sí. Orders/Deliveries edit, Onboarding revisit.

## L021 — Crear/Editar misma UI = un componente con `mode` discriminated union

- **Origen:** S6 — CreateStoreForm + EditStoreForm tenían 80%+ código duplicado divergente (1232 + 696 LOC).
- **Síntoma:** "se ve completamente diferente" entre crear y editar; micro-divergencias acumuladas.
- **Solución:** componente `StoreForm.tsx` con `mode: "create" | "directEdit" | "changeRequest"` discriminated union. Wrappers route-level de ~20 LOC. Net: -428 LOC.
- **Regla derivada:** cuando dos rutas comparten 80%+ de UI y solo difieren en (a) submit action y (b) reglas de bloqueo, NO crear archivos separados. Discriminated union desde el inicio.
- **Dónde vive:** PLAYBOOK §3 Patrones (Crear/Editar unificado).
- **Cross-módulo:** sí. Orders, deliveries, profiles.

## L022 — Select vs SearchSelect: criterio de cantidad

- **Origen:** S6 — agente reescribió Select asumiendo "todos con buscador" pero el sort tenía 3 opciones.
- **Causa raíz:** sobre-diseño. Búsqueda inline en lista de 3 opciones es ruido.
- **Solución:** regla explícita: <7 opciones fijas → `Select` simple. Lista larga o dinámica → `SearchSelect`. Multi-select con tags inline → `MultiTagAutocomplete`.
- **Regla derivada:** elegir según cantidad y dinamismo, no "por consistencia".
- **Dónde vive:** PLAYBOOK §1 Componentes (Select / Combobox).
- **Cross-módulo:** sí. Filtros, sort, status, country pickers.

## L023 — ChannelRow `valueLines` para campos multi-línea (direcciones)

- **Origen:** S6 — direcciones largas se truncaban con elipsis.
- **Causa raíz:** ChannelRow aplicaba `truncate` al value. Bien para URLs/emails; mal para direcciones donde el dato debe verse completo.
- **Solución:** prop opcional `valueLines?: string[]`. Renderiza cada línea como `<span class="block">` con `overflow-wrap: anywhere`.
- **Regla derivada:** campos cuyo valor pierde sentido si se trunca (direcciones, descripciones largas) → multi-línea con wrap, no truncate. URLs/handles sí truncar.
- **Dónde vive:** spec ChannelRow + PLAYBOOK §1.
- **Cross-módulo:** sí. Envíos en deliveries, sucursales en orders.

## L024 — StarRating component compartido (NO ad-hoc)

- **Origen:** S6 — múltiples lugares construían el rating ad-hoc, mezclando char `★`/`☆` con Lucide Star.
- **Causa raíz:** sin componente compartido, cada consumidor armaba su propia receta inconsistente.
- **Solución:** crear `<StarRating value={number|null} size>`. Filled = `--accent`, empty = `--text-muted` opacity 50%. Round half-stars.
- **Regla derivada:** cualquier display de rating numérico se acompaña SIEMPRE de las 5 estrellas visuales. Un solo componente compartido. Promover a `core/` en cuanto haya consumidores en otros módulos.
- **Dónde vive:** PLAYBOOK §1 Componentes.
- **Cross-módulo:** sí. Orders muestra rating de tienda donde se compró.

## L025 — Separadores entre filas: `border-top + first-of-type`, no `border-bottom + last-child`

- **Origen:** S6 — SummaryStatRow dejaba border-bottom suelto cuando un Button posterior rompía `:last-child`.
- **Causa raíz:** `last-child` se rompe en cuanto hay un elemento posterior heterogéneo.
- **Solución:** `border-top + [&:first-of-type]:[border-top:0]`. Robusto sin importar qué le siga.
- **Regla derivada:** para separadores entre filas que conviven con CTA u otros elementos en el mismo padre flex, usar siempre `border-top + first-of-type`.
- **Dónde vive:** PLAYBOOK §3 Patrones (Listas con separadores).
- **Cross-módulo:** sí. Cualquier lista con CTA al final.

## L026 — Alineación de altura entre controles: `min-h + items-center + line-height`, NUNCA `py`

- **Origen:** S6 — toolbar con sort select de 48px y otros controles de 44px.
- **Causa raíz:** `Select.SIZE_CLASSES.md` incluía `py-[var(--space-3)]`. Button/SearchInput no tienen `py` — solo `min-h-11 md:min-h-10` + `flex items-center`.
- **Solución:** quitar `py` del Select, agregar `[line-height:var(--text-...--line-height)]`.
- **Regla derivada:** para alinear altura entre controles del repo, usar `min-h-* + items-center + line-height`. Nunca `py` vertical. Si un control mide más que sus pares con mismo `size`, sospechar `py` redundante.
- **Dónde vive:** PLAYBOOK §3 Patrones (Toolbar).
- **Cross-módulo:** sí. Cualquier toolbar mixto.

## L027 — Grid con columna condicional + extremo derecho: usar `flex justify-between`

- **Origen:** S6 — StoreCard footer con `grid-cols-[auto_auto_1fr]` rompía cuando middle column era condicional.
- **Causa raíz:** CSS Grid no "reserva" slots para hijos condicionales. Si hay 2 hijos en grid de 3 columnas, ocupan slots 1 y 2; el slot 3 queda vacío.
- **Solución:** `flex justify-between` con grupos: izquierda agrupa rating + orders, derecha `shrink-0` con stars.
- **Regla derivada:** cuando una columna es condicional Y otro hijo debe quedar siempre en extremo, usar flex con `justify-between` o `[grid-column-start:N]` explícito.
- **Dónde vive:** PLAYBOOK §3 Patrones (Card layouts) + §4 Anti-patterns.
- **Cross-módulo:** sí. Cualquier card con secciones condicionales y elemento de extremo.

## L028 — Cards en listing grid: `flex` SIEMPRE con `flex-wrap` para meta inline

- **Origen:** S6 — chip "Pendiente de revisión" overflowaba cards estrechas en grid 3-col.
- **Causa raíz:** flex-row sin wrap. Chip más ancho que el espacio restante = overflow visible.
- **Solución:** `overflow-hidden` defensivo + chip en fila propia + `min-w-0 truncate` en nombre/país.
- **Regla derivada:** en cards de listing (grids 1/2/3-col), nunca flex sin `flex-wrap` para meta inline. Chips que pueden crecer van en fila propia.
- **Dónde vive:** PLAYBOOK §3 Patrones + §4 Anti-patterns.
- **Cross-módulo:** sí. OrderCard, DeliveryCard.

## L029 — Wrapper `APP_SHELL_FORM_RAIL_CLASSNAME`: NO duplicar (max-w-6xl ya viene del shell)

- **Origen:** S6 — humano dijo "el listado se ve chiquito + el wizard ocupa mucho espacio".
- **Causa raíz:** dos width tokens en el shell: `APP_SHELL_CONTENT_MAX_WIDTH_CLASSNAME = "max-w-6xl"` (aplicado por el `<main>`) y `APP_SHELL_FORM_RAIL_CLASSNAME = "max-w-3xl"` (rail de lectura). Yo asumí que las páginas debían usar el form-rail.
- **Solución:** eliminar el wrapper form-rail. Páginas heredan max-w-6xl del shell. Para create/edit con aside Resumen: `<form>` con `grid lg:grid-cols-[1fr_18rem]` dentro del max-w-6xl.
- **Regla derivada:** nunca duplicar wrapper de width dentro de páginas `(app)`. Form-rail solo cuando NO hay aside (settings simples, auth flows).
- **Dónde vive:** PLAYBOOK §2 Tokens (Layout magic numbers) + §4 Anti-patterns.
- **Cross-módulo:** sí. Orders, Deliveries hereda la regla.

## L030 — Flex con label + text node + ancho limitado: usar bloque

- **Origen:** S6 — fila "Importa de · Japón · Corea" se truncaba a "Importad, JPKRWS" en cards estrechas.
- **Causa raíz:** `flex;gap:4px` con label `<span>` + text node = dos flex items independientes con `min-width:auto`. Bajo ancho insuficiente, ambos se comprimen y el texto desaparece sin overflow visible.
- **Solución:** cambiar a bloque (eliminar flex, usar `margin-top + line-height`). Label y texto fluyen como inline content que envuelve.
- **Regla derivada:** nunca `display:flex;gap:N` para filas que combinan `<span>` label + text node de contenido variable en contenedores estrechos. Usar bloque o `flex-wrap:wrap` con `min-width:0`.
- **Dónde vive:** PLAYBOOK §4 Anti-patterns.
- **Cross-módulo:** sí. Cualquier card con metadatos label + valores variables.

## L031 — Modals con secciones "personal" + "comunidad": simetría estructural

- **Origen:** S6 — modal Reportes y sugerencias confundía al humano.
- **Causa raíz:** asimetría — reportes en dos `SectionGroup` hermanos; change-requests en UN solo `SectionGroup` con paneles internos. El cerebro entrenado por la primera estructura lee la segunda como repetición.
- **Solución:** partir change-requests en dos SectionGroups hermanos también, simétrico a reportes.
- **Regla derivada:** cuando un modal tiene secciones "personal" + "comunidad" para varios temas, todas deben usar el mismo patrón estructural. No mezclar "dos secciones hermanas" con "una sección que contiene dos paneles".
- **Dónde vive:** PLAYBOOK §3 Patrones (Modal con secciones múltiples).
- **Cross-módulo:** sí. Cualquier modal de governance.

## L032 — Modals con form: NO envolver cada label+input en caja decorativa

- **Origen:** S6 — modal "Solicitar nueva categoría" se veía "feo" con cajas tintadas alrededor de cada campo.
- **Causa raíz:** sobre-decoración. El gap del flex column ya separa los campos.
- **Solución:** eliminar wrappers, dejar solo label (bold) + counter + input/textarea directamente.
- **Regla derivada:** en modales con formulario, no envolver cada par `<label>+<input>` en caja decorativa. Las cajas con border y tint solo se justifican para bloques semánticamente diferenciados (preview de entidad), no campos individuales.
- **Dónde vive:** PLAYBOOK §3 Patrones (Modal con form) + §4 Anti-patterns.
- **Cross-módulo:** sí.

## L033 — Subcard toggle no duplica info ya prominente en body

- **Origen:** S6 — header de toggle de Reseñas mostraba "92 · 4.7 ★" y el body tenía rating block 38px.
- **Causa raíz:** redundancia visual.
- **Solución:** eliminar el text del header del toggle.
- **Regla derivada:** header del toggle muestra count/resumen solo cuando su ausencia justificaría mirar el header para orientarse. Si el body ya tiene la info prominente, el toggle no la necesita.
- **Dónde vive:** PLAYBOOK §3 Patrones (Subcards).
- **Cross-módulo:** sí.

## L034 — Campos sin botón save visible en demo = autosave por default

- **Origen:** S6 — humano dijo "la nota privada en el HTML autosave, mío tiene botón save".
- **Causa raíz:** demo HTML estático no muestra el comportamiento obvio — solo el indicador final "Guardada hace Xm".
- **Solución:** reescribir StoreNoteForm con autosave: textarea controlled + `useTransition` + debounce 800ms en change + persist on blur + indicador 3-state.
- **Regla derivada:** cuando un campo en el demo NO tiene botón save visible, es autosave por default. Buscar "guardado automático" / "autosave" en el handoff. UX default: nota privada → autosave; comentario en review → manual submit.
- **Dónde vive:** PLAYBOOK §3 Patrones (Notas / autosave).
- **Cross-módulo:** sí. Orders va a tener nota privada por pedido con el mismo patrón.

## L035 — Metadata (lastUpdated) va al footer del campo, no en el header del form

- **Origen:** S6 — humano pidió mover "Última actualización" del header del form al final.
- **Causa raíz:** UX — el header es para titular/describir; metadata corresponde al footer del campo, no al título.
- **Solución:** mover Typography con lastUpdated debajo del bloque del textarea con `mt-1.5`.
- **Regla derivada:** metadatos como "última edición" no van en encabezado de form. Van como caption pequeño debajo del campo principal.
- **Dónde vive:** PLAYBOOK §3 Patrones (Forms inline).
- **Cross-módulo:** sí. Notes, comments, descripciones editables.

## L036 — i18n keys: SIEMPRE agregar en es+en mismo cambio + validar JSON.parse

- **Origen:** S6 — bug `MISSING_MESSAGE: stores.detail.reviewCountLabel` (key en componente, no en archivo).
- **Causa raíz:** trabajo previo agregó la key al componente sin actualizar locales.
- **Solución:** agregar en ambos locales en el mismo cambio. Validar con `node -e "JSON.parse(require('fs').readFileSync('...'))"`.
- **Regla derivada:** keys de traducción se agregan SIEMPRE en es+en en el mismo cambio. Validar JSON antes de cerrar. Si aparece MISSING_MESSAGE solo en es (default), revisar también en — casi siempre falta también.
- **Dónde vive:** PLAYBOOK §6 Auto-audit (cierre de Fase B).
- **Cross-módulo:** sí. Aplica a todos los locales del repo.

## L037 — `t(...)` con claves dinámicas: cast `as never` documentado

- **Origen:** S6 — `tCreateRedesign(`channels.validationError.${key}` as never)` para claves compuestas.
- **Causa raíz:** next-intl tipa keys como union literal finito; claves compuestas dinámicamente no pueden verificarse estáticamente.
- **Solución:** usar `as never`. Aceptable cuando: (a) los valores de la clave dinámica son union finito conocido, (b) el fallback en caso de clave faltante NO es silencioso, (c) las claves están todas presentes en archivos i18n.
- **Regla derivada:** documentar inline por qué se usa `as never` para que no parezca descuido.
- **Dónde vive:** PLAYBOOK §3 Patrones (i18n con claves dinámicas).
- **Cross-módulo:** sí. Aparece en validación por subtipo.

## L038 — Antes de crear componente UI: `ls src/components/core/` y `modules/`

- **Origen:** S6 — agente reescribió ControlledSelect sin saber que ya existía SearchSelect.
- **Causa raíz:** asumir el inventario sin verificar.
- **Solución:** ejecutar `ls` antes de crear o modificar.
- **Regla derivada:** antes de modificar o crear cualquier componente UI, ejecutar `ls src/components/core/` y `ls src/components/modules/`. En este repo conviven varios componentes con propósitos similares (Select, SearchSelect, Combobox; Modal, Sheet, Drawer).
- **Dónde vive:** PLAYBOOK §5 Workflow obligatorio.
- **Cross-módulo:** sí.

## L039 — N inconsistencias visuales: leer demo + mapear elementos ANTES de tocar

- **Origen:** S6 — humano listó 7+ inconsistencias y agente fue iterando una por una sin contexto total.
- **Causa raíz:** falta de workflow estricto "leer demo primero".
- **Solución:** abrir todos los anchors relevantes del demo + listar en chat el mapping `elemento del demo → componente del repo + delta detectado`. Después tocar código.
- **Regla derivada:** cuando humano lista N inconsistencias visuales, primer paso NO es fixar la primera. Es leer el demo + mapear. Recién después editar. Esto evita iteraciones múltiples.
- **Dónde vive:** PLAYBOOK §5 Workflow + §6 Auto-audit.
- **Cross-módulo:** sí.

## L040 — Refactors visuales de pantalla: wholesale del shell, NO parcial

- **Origen:** S6 — refactor "quirúrgico" del detalle (StoreHero arriba + SectionSurfaceCard legacy abajo) quedó incoherente.
- **Causa raíz:** sub-estimar costo de coexistencia visual. Las pantallas del demo son Gestalt — cambiar solo el hero rompe la composición.
- **Solución:** reescribir wholesale el shell visual usando StoreHero + StoreSubcards + DetailSidebar. Preservar funcionalidad reusando building-blocks de lógica (StoreNoteForm, StorePublicReviewsSection, StoreReportModal) pero reorganizando shell.
- **Regla derivada:** para refactors visuales de pantalla completa, wholesale rebuild del shell es más barato que refactor parcial. Reusar building-blocks de lógica; layout/chrome SE REESCRIBE. Nunca dejar SectionSurfaceCard legacy + componentes nuevos en la misma pantalla.
- **Dónde vive:** PLAYBOOK §5 Workflow.
- **Cross-módulo:** sí. Orders detail, Deliveries detail.

## L041 — Demo HTML con mutation JS post-render: leer también los scripts

- **Origen:** S6 — agente seguía agregando `<BackNavLink>` redundante en page body porque el demo HTML estático lo muestra ahí, pero el JS final lo mueve a topbar.
- **Causa raíz:** leer solo HTML estático sin scripts.
- **Solución:** leer el script al final del demo (`buildTopbar()` ~línea 8824). Si los breadcrumbs vienen del shell, no duplicar back link en body.
- **Regla derivada:** cuando el demo HTML tiene mutation JS post-render, leer el `<script>` final. Para `.app-topbar`, ver `buildTopbar()`.
- **Dónde vive:** PLAYBOOK §5 Workflow.
- **Cross-módulo:** sí. Aplica a cualquier read del demo.

## L042 — Componentes core de S4/S5 que aparecen en demo: audit visual cada Fase B

- **Origen:** S6 — `<ThemeToggle>` y `<LangToggle>` resultaron desalineados con el demo.
- **Causa raíz:** S5 cerró sin chequear el demo HTML para estos componentes. Specs solo detallaban API, no visual final.
- **Solución:** reemplazar receta con la del demo. Mantener API externa idéntica.
- **Regla derivada:** componentes core de S4/S5 que aparecen en el demo deben ser auditados visualmente en cada Fase B donde aparecen. Si un componente cierra Fase A sin demo binding, marcar TODO en `components.md`.
- **Dónde vive:** PLAYBOOK §5 Workflow + §6 Auto-audit.
- **Cross-módulo:** sí. Header/Breadcrumbs y otros componentes posiblemente afectados.

## L043 — Inventario de componentes: describir USO del módulo, no replicar spec

- **Origen:** S6 — impulso natural era describir apariencia del componente en context ("tiene íconos monocromo, padding 24px, footer con 2 botones").
- **Causa raíz:** sin plantilla verbal clara para "referencia" vs "descripción".
- **Solución:** plantilla mental: `[ComponentName] ([spec link]) [tono/variante/tamaño] para [propósito funcional específico del módulo]`. La estructura interna del componente NO aparece.
- **Regla derivada:** Si el agente de Fase B necesita saber cómo funciona el Modal, lee `components/Modal.md`, no el doc del módulo.
- **Dónde vive:** PLAYBOOK §5 Workflow + methodology §6.quinquies.
- **Cross-módulo:** sí. S7, S8, S10 deben seguir esta plantilla.

## L044 — Cierre de A.3: recorrer FRD y listar features visibles en demo sin cobertura

- **Origen:** S6 — features visibles en demo (sort orders, indicador BUSINESS/PERSON, toast post-submit, autosave localStorage) no estaban en el FRD.
- **Causa raíz:** A.1/A.2 agregó elementos para completar la vibe del demo sin verificar si estaban en el FRD.
- **Solución:** al cierre de A.3, recorrer FRD y verificar que cada elemento del demo aprobado tiene cobertura en al menos un FR/BR. Sin cobertura → listar como `P-SX-NN` para decisión humana antes de Fase B.
- **Regla derivada:** no asumir que "está en el demo" implica aprobación de implementación.
- **Dónde vive:** methodology §6.quinquies + PLAYBOOK §6.
- **Cross-módulo:** sí. S7 probablemente tendrá el mismo gap.

## L045 — Cláusula spec vigente: enumerar mini-sesiones cross-cutting abiertas

- **Origen:** S6 — M01 (Modal Enhancement) abierto, 5 modales del módulo dependen.
- **Causa raíz:** no había mecanismo en el handoff que listara componentes con mini-sesiones abiertas.
- **Solución:** al escribir handoff, consultar `cross-cutting-changes.md` y enumerar componentes del inventario con mini-sesiones 🟡 + política (esperar cierre vs implementar y revisar).
- **Regla derivada:** chequear cross-cutting al escribir handoff, no en Fase B.
- **Dónde vive:** methodology §6.quinquies + PLAYBOOK §5.
- **Cross-módulo:** sí.

## L046 — Migration done = SQL + `migrate deploy` + `prisma generate` + type-check pasa

- **Origen:** S6 — humano dijo "asegurate que la migration funcione, no solo el SQL".
- **Causa raíz:** asumir que escribir el archivo era suficiente.
- **Solución:** aplicar `migrate deploy` + `prisma generate` en la misma sesión y verificar output `All migrations have been successfully applied.` antes de cerrar tarea.
- **Regla derivada:** una migration NO está done hasta que: (1) archivo SQL escrito, (2) `migrate deploy` aplicado con éxito, (3) `prisma generate` corrido, (4) type-check pasa con el client regenerado.
- **Dónde vive:** PLAYBOOK §6 Auto-audit + cursor rule `prisma-migration-workflow.mdc`.
- **Cross-módulo:** sí. Cualquier sesión con cambios de schema.

## L047 — `migrate dev` falla en shadow DB: SQL manual + `migrate deploy`

- **Origen:** S6 — `npx prisma migrate dev --name add_is_private_to_store` falló con `P3006` por migration vieja con cast inválido.
- **Causa raíz:** una migration previa del repo tiene cast inválido que falla al replay sobre shadow DB.
- **Solución:** escribir manualmente `prisma/migrations/<ts>_<name>/migration.sql` con ALTER TABLE + CREATE INDEX, aplicar con `npx prisma migrate deploy` (NO usa shadow DB).
- **Regla derivada:** cuando `migrate dev` falle por shadow DB, NO arreglar la migration vieja (out of scope). Path canónico: SQL manual con timestamp posterior + `migrate deploy`.
- **Dónde vive:** PLAYBOOK §3 Patrones (Migrations) + cursor rule `prisma-migration-workflow.mdc`.
- **Cross-módulo:** sí. Cualquier futura sesión que necesite migration mientras el bloqueo persista.

## L048 — `data-scroll-behavior="smooth"` en `<html>` para Next.js App Router

- **Origen:** S6 — console mostraba 6× warning durante navegación.
- **Causa raíz:** Next detecta `scroll-behavior: smooth` en CSS porque interfiere con scroll-restoration.
- **Solución:** agregar `data-scroll-behavior="smooth"` al `<html>` en `[locale]/layout.tsx` y en `global-error.tsx`. El atributo le indica a Next "ya sé que tengo smooth scroll, lo desactivo durante transiciones".
- **Regla derivada:** si `globals.css` tiene `scroll-behavior: smooth`, agregar el attribute a TODOS los `<html>` del proyecto.
- **Dónde vive:** PLAYBOOK §3 Patrones (Next.js config).
- **Cross-módulo:** N/A (config global) pero sí general para Next.js App Router.

## L049 — Roadmap de sesiones es plan, no trigger automático

- **Origen:** S6 — agente generó prompt de handoff apuntando a S7, humano corrigió porque polish de Stores no estaba terminado.
- **Causa raíz:** asumir "módulo cerrado en plan = avanzar al siguiente".
- **Solución:** segundo prompt reflejó polish continuo.
- **Regla derivada:** un módulo no está "listo para avanzar" hasta que humano confirma visualmente contra demo. Roadmap es plan, no trigger. Al generar handoff, preguntar al humano qué hace en la próxima conversación, no inferirlo.
- **Dónde vive:** PLAYBOOK §5 Workflow + methodology §8 Coordinación.
- **Cross-módulo:** sí. Mismo riesgo al cerrar S7, S8.

## L050 — README "sesión vigente" describe estado real, no aspiracional

- **Origen:** S6 — README decía `S7 Fase A 🟡 en iteración` cuando S7 nunca había empezado.
- **Causa raíz:** alguien escribió estado deseado en lugar de estado real. Agente lo leyó como verdad.
- **Solución:** corregido a `S7 próxima (M04 cerrada; commit + gate visual humano pendiente antes de iniciar S7)`.
- **Regla derivada:** "sesión vigente" describe solo trabajo que ya ocurrió o compromisos confirmados. Para "lo que sigue": `próxima: X (requisitos previos: Y)`. Antes de editar, verificar contra `git log`.
- **Dónde vive:** PLAYBOOK §5 Workflow.
- **Cross-módulo:** sí.

## L051 — Session doc: lista archivos desde `git status`, no memoria

- **Origen:** S6 — session doc M04 listó archivos commiteados en sesiones anteriores como si fueran de M04.
- **Causa raíz:** lista construida desde tareas, no desde diff.
- **Solución:** correr `git status` y `git log --oneline -10` antes de listar archivos.
- **Regla derivada:** al redactar session doc, lista de archivos modificados sale de git, nunca de memoria. Separar "modificados en esta sesión" vs "tocados en sesiones previas".
- **Dónde vive:** PLAYBOOK §6 Auto-audit (cierre de sesión).
- **Cross-módulo:** sí.

## L052 — PostToolUse formatter: re-Read si zona estructural

- **Origen:** S6 — hook PostToolUse modificó el archivo después de un Write.
- **Causa raíz:** formatter del repo reformatea archivos al guardar, invalidando snapshot del agente.
- **Solución:** tras aviso de formatter, si el siguiente Edit apunta a zona estructural (imports, types, prettier-sensitive), hacer Read previo. Para zonas claramente intactas, seguir.
- **Regla derivada:** ver el aviso del hook como señal — si la zona del próximo Edit puede haber cambiado de orden/formato, re-Read.
- **Dónde vive:** PLAYBOOK §6.
- **Cross-módulo:** sí. Aplica a todo el repo.

## L053 — Rutas `(app)/*` requieren auth: usar credentials dev

- **Origen:** S6 — `/es/stores` redirige a `/es/sign-in` sin sesión.
- **Causa raíz:** rutas protegidas por auth.
- **Solución:** humano pasó credentials dev guardadas en memoria. Workflow: navegar a `/sign-in`, `preview_fill` email + password, `Array.from(buttons).find(b => b.textContent.includes('Iniciar sesión')).click()`, esperar 2s.
- **Regla derivada:** antes de verificar visualmente cualquier ruta `(app)/*`, asumir que requiere auth. Hacer login antes con las credentials dev.
- **Dónde vive:** PLAYBOOK §5 Workflow + memoria del agente (ya guardada).
- **Cross-módulo:** sí. Aplica a todas las rutas protegidas.

## L054 — `preview_eval` con `window.location.href`: NO encadenar `await` después

- **Origen:** S6 — eval falló con `Inspected target navigated or closed`.
- **Causa raíz:** cuando la página navega, el contexto de evaluación se destruye antes de que el `await` resuelva.
- **Solución:** asignar `window.location.href` y devolver sincrónicamente. Si necesitás esperar, hacer un segundo `preview_eval` separado.
- **Regla derivada:** nunca encadenar `window.location.href = X` y `await new Promise(...)` en el mismo `preview_eval`. Separar en dos llamadas.
- **Dónde vive:** PLAYBOOK §5 Workflow (preview testing).
- **Cross-módulo:** sí.

## L055 — Patrón comunicación humano: "prefiero X, acepto Y si difícil" → implementar X si trivial

- **Origen:** S6 — humano dijo "achicar select es preferible, pero acepto agrandar si es difícil".
- **Causa raíz:** N/A — patrón de comunicación.
- **Solución:** implementar X directo si es trivial, sin pedir confirmación adicional.
- **Regla derivada:** evaluar técnicamente y proceder con preferencia X si es trivial. Confirmación ya implícita.
- **Dónde vive:** PLAYBOOK §5 Workflow (interacción).
- **Cross-módulo:** sí.

## L056 — `dispatchEvent` + React inputs: setter nativo + Event con bubbles

- **Origen:** S6 — testing de duplicate detection con `preview_eval` no disparaba el alert inline.
- **Causa raíz:** React no escucha `Event` nativo emitido por `dispatchEvent` para inputs controlados; necesita setter del prototype.
- **Solución:** `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new Event('input', {bubbles:true}));`. Para blur: `dispatchEvent(new FocusEvent('focusout', {bubbles:true}))` Y `blur`.
- **Regla derivada:** antes de declarar "no funciona" basándose en `preview_eval`, verificar que la simulación de eventos respeta los listeners de React.
- **Dónde vive:** PLAYBOOK §5 Workflow (preview testing).
- **Cross-módulo:** sí. Cualquier test browser-based de formularios.

## L057 — `replace_all` sobre style strings compartidos: extender `old_string`

- **Origen:** S6 — 6 filas "Importa de" + 1 fila "Sin países" compartían el mismo style string. `replace_all` habría roto la fila de icono.
- **Causa raíz:** reutilización de cadena de estilo idéntica para estructuras internas distintas.
- **Solución:** extender `old_string` para incluir contenido adyacente único de cada grupo.
- **Regla derivada:** antes de `replace_all:true` sobre style en HTML, escanear todas las instancias para verificar estructura interna idéntica. Si difiere, extender `old_string`.
- **Dónde vive:** PLAYBOOK §6 Auto-audit (al editar HTML).
- **Cross-módulo:** sí. Aplica a edición masiva del demo HTML.

## L058 — Tests con Portal: usar `screen.*` queries, NO `container.querySelector`

- **Origen:** S6 — tests del Modal nuevo fallaban porque `container.querySelector` devolvía null.
- **Causa raíz:** Modal renderiza vía Portal a `document.body`, no al container del Testing Library.
- **Solución:** usar `screen.getByText` o `document.body.querySelector`.
- **Regla derivada:** cualquier test de componente que use Portal (Modal, Sheet, FilterDrawer, DetailSidebar floating, Toast) debe usar `screen.*` queries.
- **Dónde vive:** PLAYBOOK §6 Auto-audit + spec de cada componente con Portal.
- **Cross-módulo:** sí.

---

## Cómo agregar una lección nueva

1. Numerar `L0XX` siguiendo el orden cronológico.
2. Llenar las 7 secciones del template.
3. Si la regla derivada es replicable cross-app, agregarla al PLAYBOOK.
4. Si justifica un cursor rule nuevo, crearlo y referenciarlo.
5. Si surge de un cambio cross-cutting, cruzar con `_notes/cross-cutting-changes.md`.
