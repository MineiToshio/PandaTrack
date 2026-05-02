---
title: PandaTrack Redesign — Subproyecto
last_updated: 2026-05-02
owner: Sergio Minei
---

> **Estado actual:** Sesión 4 ✅ done — catálogo completo de **47 componentes core** specceados en 4 tiers (atoms 17 / molecules 10 / organisms 17 / form orchestration 3) con plantilla obligatoria, discriminated unions TS para enforcement de ADR 0005 + 0006, 0 bloqueantes, 18 objeciones de red team evaluadas.
>
> - **6 wireframes lo-fi** en `screens/`.
> - **7 ADRs cerrados:** [`0001`](./decisions/0001-s2-closure-decisions.md) (19 decisiones de cierre S2 — gaps Atelier, lifecycle, micro-stats, paginación), [`0002`](./decisions/0002-status-chip-mapping.md) (mapeo de estados de pedido/entrega a chips visuales contra el schema real), [`0003`](./decisions/0003-demo-decisions.md) (8 decisiones del demo: **Velvet** como paleta primaria, theme toggle sin `system`, sidebar push, header con breadcrumbs, wizard accordion, sidebar derecha consistente, filter drawer), [`0004`](./decisions/0004-categorical-palette-removal.md) (eliminación de la paleta categórica), [`0005`](./decisions/0005-dashboard-microstat-icon-tile.md) (patrón canónico icon-tile + cifra neutra para micro-stat cards del dashboard — refina ADR 0001 D8), [`0006`](./decisions/0006-color-blindness-icon-label-contract.md) (contrato vinculante ícono+label para `--info` y `--accent-cool` — mitigación daltonismo ortogonal al color), [`0007`](./decisions/0007-text-muted-outdoor-code-mono-reassignment.md) (reasignación del code mono identificador `PT-XXXXXX` de `--text-muted` a `--text-secondary` para robustez outdoor).
> - **Sistema de tokens completo** en [`tokens.md`](./tokens.md) (Velvet default + 4 alternativas, light + dark, todos AA). Mapping a Tailwind v4 `@theme` propuesto en [`tokens-css.md`](./tokens-css.md) (no aplicado al repo — eso es S12). Audit exhaustivo en [`_notes/s3-contrast-audit.md`](./_notes/s3-contrast-audit.md). Red team en [`_notes/s3-red-team.md`](./_notes/s3-red-team.md).
> - **Demo HTML self-contained** funcionando en [`_notes/demo-screens.html`](./_notes/demo-screens.html) (10 pantallas, 5 paletas, light + dark, responsive). Ver [`_notes/demo-screens-readme.md`](./_notes/demo-screens-readme.md) para guía operacional. Algunos valores del demo se ajustaron en S3 por AA — ver `_notes/s3-contrast-audit.md` §6.
> - **Pendings registrados** para pantallas derivadas (Detalle de tienda, listas, etc.) en [`_notes/store-detail-pendings.md`](./_notes/store-detail-pendings.md).
> - **Catálogo de componentes** en [`components.md`](./components.md) con cobertura wireframe + ADR + matriz tokens. **47 specs** en [`components/<Name>.md`](./components/) (uno por componente) con API TypeScript, estados visuales light + dark, accesibilidad, motion, copy default + claves i18n, edge cases, anti-patrones, ejemplos.
> - **Próximo gate humano:** ejecutar las 5 validaciones de [`_notes/s2-validation-plan.md`](./_notes/s2-validation-plan.md). Luego lanzar **Sesión 5 — Navegación y layouts** consumiendo los componentes (especialmente `<Breadcrumbs>`, `<ThemeToggle>`, `<LangToggle>`, `<MascotBubble>` para el shell + `<DetailSidebar>` para pantallas de detalle).

# PandaTrack Redesign — Memoria del subproyecto

Subproyecto de rediseño visual y de experiencia COMPLETO de PandaTrack para una audiencia 18–25 años. Reemplaza la identidad y los patrones de UI actuales sin reusar nada del diseño vigente. Conserva únicamente el contrato funcional (qué hace cada flujo). Cubre 12 sesiones que producen artefactos en este folder; cualquier conversación nueva debe poder reconstruir contexto leyendo estos archivos en orden.

## Reglas duras del subproyecto

1. **Regla Cero — el diseño actual está muerto.** No "mejoramos" lo existente; partimos de cero. `docs/design/` actual se ignora salvo para registrar qué patrones NO heredamos.
2. **Light y dark son ciudadanos de primera clase.** Cada token, superficie, gradiente, ilustración, sombra y chart se piensa para ambos modos en paralelo. WCAG 2.2 AA verificado en los dos. Toggle explícito (light/dark/system) con persistencia.
3. **Audiencia 18–25.** Mobile-first real, motion con propósito, personalidad, gestos, atajos en desktop. Cuando dudes, elige lo más ligero, visual y divertido.
4. **Cada flujo funcional documentado en `functional-inventory.md` debe seguir siendo posible.** Mismo qué, distinto cómo.
5. **Restricciones técnicas se respetan.** Tokens semánticos, `cn()`, semantic HTML, next-intl, theme-aware. No estética.

## Cómo leer este folder en una conversación nueva (5 minutos)

> **Atajo para próximos agentes:** si tu tarea toca el demo HTML, leé directo [`_notes/demo-screens-readme.md`](./_notes/demo-screens-readme.md) — tiene el contexto operacional sintetizado.

### Lectura mínima recomendada

1. Este `README.md` — propósito, reglas, estado.
2. **`tokens.md`** — sistema de tokens vivo (Velvet default + 4 alternativas, light + dark). **Reemplaza la paleta provisional de `directions.md` §4.4.**
3. **`tokens-css.md`** — mapping a Tailwind v4 `@theme` propuesto. No aplicado al repo (eso es S12).
4. **`components.md`** — catálogo de los 47 componentes core con cobertura wireframe + ADR + matriz tokens. **Si necesitás detalle de un componente específico, abrí `components/<Name>.md`.**
5. **`decisions/0004-categorical-palette-removal.md`** — eliminación de `--cat-*` del sistema. Cualquier referencia histórica en `directions.md` §4.4 queda como referencia, no contrato.
6. **`decisions/0003-demo-decisions.md`** — 8 decisiones consolidadas del demo (Velvet, sidebar, header, wizard, sidebar derecha, filter drawer). **Más actualizado que `direction-chosen.md`.**
7. **`decisions/0002-status-chip-mapping.md`** — mapeo de enums de Prisma (`OrderStatus`, `DeliveryStatus`, `OrderItemDeliveryState`) a chips visuales.
8. **`decisions/0001-s2-closure-decisions.md`** — 19 decisiones de cierre de S2 (gaps Atelier, lifecycle, micro-stats, paginación, etc.).
9. `principles.md` — decálogo UX/UI que rige todas las decisiones (incluye glosario de voice §7).
10. `functional-inventory.md` — qué pantallas y flujos existen (contrato funcional).

### Si vas a tocar el demo HTML

11. **`_notes/demo-screens-readme.md`** — guía operacional del demo: convenciones, atributos, cómo extender, reglas de oro.
12. **`_notes/demo-screens.html`** — el demo en sí (10 pantallas, 5 paletas, light + dark). **Nota S3:** el demo es referencia visual, no contrato AA — los valores que fallaban WCAG fueron ajustados en `tokens.md`.
13. **`_notes/store-detail-pendings.md`** — pendings registrados de pantallas derivadas que aún no tienen wireframe formal.

### Auditorías + red teams

14. **`_notes/s4-compliance-audit.md`** — audit del catálogo S4 (8 dimensiones: plantilla, ADR, tokens, wireframes, a11y, voice, tokens-only, discriminated unions). 0 bloqueantes.
15. **`_notes/s4-red-team.md`** — 18 objeciones hostiles del cierre S4, 0 bloqueantes pendientes.
16. **`_notes/s4-gaps.md`** — 13 gaps abiertos para S5/S6/S9/S12.
17. **`_notes/s3-contrast-audit.md`** — audit exhaustivo 188 pares de contraste (5 paletas × 2 modos), 100% pass AA.
18. **`_notes/s3-red-team.md`** — 15 objeciones hostiles del cierre S3, 0 bloqueantes pendientes.
19. **`_notes/s2-red-team.md`** — pasada hostil del cierre S2.

### Contexto histórico / referencias

16. **`direction-chosen.md`** — dirección visual original (Bento Atelier post-S1). **Nota:** el `data-palette="velvet"` del ADR 0003 reemplaza el Indigo original como primario.
17. `directions.md` §4 — Bento Atelier en detalle (paleta, type, motion, mascota, voice). §1-§3 son direcciones descartadas. **Nota S3:** la sección §4.4 paleta provisional + §4.4 paleta categórica son referencia histórica — los tokens vivos están en `tokens.md`.
18. **`screens/*.md`** — wireframes lo-fi de las 6 pantallas críticas (S2): `dashboard.md` → `orders-list.md` → `order-detail.md` → `order-create.md` → `delivery-create.md` → `settings.md`. Cada uno lleva addendum al inicio que apunta al ADR 0001.
19. **`_notes/atelier-gaps.md`** — bitácora de los 4 huecos del sistema (todos ✅ resueltos por ADR 0001).
20. **`_notes/s2-validation-plan.md`** — las 5 pruebas humanas que se corren en paralelo a S3.
21. **`_notes/research-*.md`** — 5 documentos de research que alimentaron ADR 0001 (status colors, form patterns, toasts/lifecycle, dashboard/lists, settings/avatar).
22. **`_notes/assumptions-s2.md`** — 41 supuestos con su estado final (Confirmed/Changed/Pending).
23. **`_notes/s3-draft-*.md`** — 5 borradores intermedios de S3 (color, typography, spacing, elevation-motion, palettes). Conservados como bitácora; los valores finales viven en `tokens.md`.
24. `directions-comparison.md` — tabla comparativa entre las 4 direcciones de S1 (referencia histórica).
25. `research.md` — referencias externas que alimentaron las direcciones.
26. `_notes/demo.html` — demo HTML antiguo del **dashboard** en las 4 direcciones (S1, ya superado por `demo-screens.html`).
27. `_notes/demo-form.html` — demo HTML antiguo del **formulario "Nueva tienda"** en las 4 direcciones (S1, ya superado).
28. `_notes/iteration-history.md` — bitácora cronológica de las 3 revisiones de S1.
29. `sessions/NN-*.md` — log cronológico de cada sesión.

## Mapa de archivos

| Archivo                                                       | Contenido                                                                                                                                                                                                                  |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                                                   | Índice y memoria viva del subproyecto.                                                                                                                                                                                     |
| `research.md`                                                 | 30+ referencias externas clasificadas por superficie y modo.                                                                                                                                                               |
| `principles.md`                                               | Decálogo UX/UI accionable para audiencia 18–25 (incluye glosario voice §7).                                                                                                                                                |
| `functional-inventory.md`                                     | Tabla plana de rutas → propósito → datos → acciones → estados (contrato inviolable).                                                                                                                                       |
| `directions.md`                                               | **4 direcciones** creativas completas (paleta, type, motion, sample). §4 es Atelier.                                                                                                                                       |
| `directions-comparison.md`                                    | Tabla comparativa puntuada lado a lado de las 4 direcciones.                                                                                                                                                               |
| `direction-chosen.md`                                         | Dirección original elegida (Bento Atelier post-S1). El primario Indigo fue reemplazado por **Velvet** vía ADR 0003.                                                                                                        |
| `screens/dashboard.md`                                        | **S2** — Wireframe lo-fi del Dashboard (mobile + desktop + estados).                                                                                                                                                       |
| `screens/orders-list.md`                                      | **S2** — Wireframe lo-fi del listado de pedidos.                                                                                                                                                                           |
| `screens/order-detail.md`                                     | **S2** — Wireframe lo-fi del detalle de pedido (target view-transition canónica).                                                                                                                                          |
| `screens/order-create.md`                                     | **S2** — Wireframe lo-fi de creación de pedido. **Nota ADR 0003 D6:** ya no incluye paso "Nota".                                                                                                                           |
| `screens/delivery-create.md`                                  | **S2** — Wireframe lo-fi de creación de entrega (4 section cards + productos agrupados).                                                                                                                                   |
| `screens/settings.md`                                         | **S2** — Wireframe lo-fi de ajustes (3 secciones: Profile, Account, Preferences).                                                                                                                                          |
| `decisions/0001-s2-closure-decisions.md`                      | **S2-post** — ADR con 19 decisiones de cierre de S2 (gaps Atelier, lifecycle, micro-stats, paginación, etc.).                                                                                                              |
| `decisions/0002-status-chip-mapping.md`                       | **post-S2** — ADR de mapeo de enums (`OrderStatus`, `DeliveryStatus`, `OrderItemDeliveryState`) a chips visuales contra el schema real.                                                                                    |
| `decisions/0003-demo-decisions.md`                            | **post-S2-demo** — ADR con 8 decisiones del demo: **Velvet** como paleta primaria, theme sin `system`, sidebar push, header con breadcrumbs, wizard accordion, sidebar derecha consistente, filter drawer.                 |
| `decisions/0004-categorical-palette-removal.md`               | **S3** — ADR de eliminación de la paleta categórica (`--cat-*`); identidad de categoría sigue resuelta por íconos Lucide en `--accent-cool`. Charts V2 usarán set dedicado `--chart-*`. Confirmado por research follow-up. |
| `decisions/0005-dashboard-microstat-icon-tile.md`             | **S3 follow-up** — ADR del patrón canónico icon-tile + cifra `--text-primary` para micro-stat cards del dashboard. Refina ADR 0001 D8. Resuelve fail cross-paleta de `--accent-warm`.                                      |
| `decisions/0006-color-blindness-icon-label-contract.md`       | **S3 follow-up** — ADR del contrato vinculante "ícono + label obligatorio" para `--info` y `--accent-cool`. Mitigación daltonismo ortogonal al color (Brettel/Viénot). Enforcement TS en S4 + lint en S12.                 |
| `decisions/0007-text-muted-outdoor-code-mono-reassignment.md` | **S3 follow-up** — ADR de reasignación del code mono identificador (`PT-XXXXXX`) de `--text-muted` a `--text-secondary` por robustez outdoor mobile. Sin cambio de tokens, sólo regla de uso.                              |
| `_notes/s3-research-accent-warm-metric.md`                    | **S3 follow-up** — research del agente A (11 apps + 6 artículos) sobre color del slot 2 del dashboard. Fundamenta ADR 0005.                                                                                                |
| `_notes/s3-research-colorblind-info.md`                       | **S3 follow-up** — research del agente B (Brettel/Viénot 1997 + 5 design systems) sobre daltonismo info vs accent-cool. Fundamenta ADR 0006.                                                                               |
| `_notes/s3-research-categorical-palette.md`                   | **S3 follow-up** — research del agente C (6+ apps de hobby + 3+ design systems data-viz). Confirma ADR 0004.                                                                                                               |
| `_notes/s3-research-text-muted-outdoor.md`                    | **S3 follow-up** — research del agente D (apps outdoor-heavy + APCA + OLED brightness). Fundamenta ADR 0007 + refina Validation #4.                                                                                        |
| `tokens.md`                                                   | **S3** — sistema de tokens completo (Velvet default + 4 alternativas, light + dark, status compartidos, reglas de uso, decisiones residuales, gaps S4).                                                                    |
| `tokens-css.md`                                               | **S3** — mapping a CSS custom properties + Tailwind v4 `@theme` propuesto. **No aplicado al repo** — eso es S12. Incluye recetas de `<StoreAvatar>`, toast neutral-undo, section card gated, field-as-attribute.           |
| `components.md`                                               | **S4** — catálogo overview de los 47 componentes core. Mapa por tier, cobertura wireframe, cobertura ADR, matriz tokens × componentes, componentes diferidos.                                                              |
| `components/<Name>.md` (47 archivos)                          | **S4** — un archivo por componente con plantilla obligatoria de 15 secciones (API TypeScript, variants, estados light + dark, mobile vs desktop, a11y, motion, copy + i18n, edge cases, anti-patrones, ejemplos, tokens, ADRs, dependencias, notas S12). |
| `_notes/s4-shared-brief.md`                                   | **S4** — brief operativo compartido para sub-agentes con plantilla obligatoria, reglas duras, tokens, ADRs resumidos, voice glossary, comportamientos transversales.                                                       |
| `_notes/s4-compliance-audit.md`                               | **S4** — audit de cumplimiento del catálogo (8 dimensiones: plantilla, ADR, tokens, wireframes, a11y, voice, tokens-only, discriminated unions). 0 bloqueantes, 12 notas menores documentadas.                            |
| `_notes/s4-red-team.md`                                       | **S4** — 18 objeciones hostiles del catálogo. 0 bloqueantes pendientes, 4 mayores resueltas con cambios al spec, 8 menores aceptadas con riesgo controlado.                                                                |
| `_notes/s4-gaps.md`                                           | **S4** — 13 gaps abiertos para sesiones siguientes (S5: 4, S6: 3, S9: 1, S12: 5).                                                                                                                                          |
| `_notes/s3-contrast-audit.md`                                 | **S3** — audit exhaustivo 188 pares de contraste (5 paletas × 2 modos), 100% pass AA. Tabla de ajustes vs demo HTML.                                                                                                       |
| `_notes/s3-red-team.md`                                       | **S3** — 15 objeciones hostiles del cierre S3, 0 bloqueantes pendientes, 5 menores con riesgo controlado.                                                                                                                  |
| `_notes/s3-draft-color.md`                                    | **S3** — borrador α de tokens core de color Velvet (consolidado en `tokens.md`).                                                                                                                                           |
| `_notes/s3-draft-typography.md`                               | **S3** — borrador β de tipografía (consolidado en `tokens.md` §3).                                                                                                                                                         |
| `_notes/s3-draft-spacing.md`                                  | **S3** — borrador γ de spacing + radius + breakpoints + z-index (consolidado).                                                                                                                                             |
| `_notes/s3-draft-elevation-motion.md`                         | **S3** — borrador δ de elevation + motion (consolidado).                                                                                                                                                                   |
| `_notes/s3-draft-palettes.md`                                 | **S3** — borrador ε de las 4 paletas alternativas (consolidado).                                                                                                                                                           |
| `_notes/demo-screens.html`                                    | **post-S2-demo** — Demo HTML self-contained con 10 pantallas, 5 paletas, light + dark, responsive.                                                                                                                         |
| `_notes/demo-screens-readme.md`                               | **post-S2-demo** — Guía operacional del demo: convenciones, atributos, cómo extender, reglas de oro. Lectura obligatoria si vas a iterar el demo.                                                                          |
| `_notes/store-detail-pendings.md`                             | **post-S2-demo** — Pendings registrados de pantallas derivadas (Detalle de tienda, Lista de tiendas, Sumar tienda, Lista de entregas) que aún no son formales.                                                             |
| `_notes/atelier-gaps.md`                                      | **S2** — 4 huecos del sistema Atelier ✅ todos resueltos por ADR 0001.                                                                                                                                                     |
| `_notes/s2-red-team.md`                                       | **S2** — Pasada hostil contra los 6 wireframes; objeciones vacías al cierre.                                                                                                                                               |
| `_notes/s2-validation-plan.md`                                | **S2** — Plan ejecutivo de las 5 validaciones humanas requeridas antes de S6.                                                                                                                                              |
| `_notes/assumptions-s2.md`                                    | **S2** — 41 supuestos: 28 ✅ Confirmed / 8 ⚙️ Changed / 5 ⏳ Pending validation.                                                                                                                                           |
| `_notes/research-status-colors.md`                            | **S2-post** — Research del gap #1 (token `--info` para "pendiente sin urgencia").                                                                                                                                          |
| `_notes/research-form-patterns.md`                            | **S2-post** — Research de gaps #2/#3 + decisiones de orders/deliveries create.                                                                                                                                             |
| `_notes/research-toasts-lifecycle.md`                         | **S2-post** — Research del gap #4 + lifecycle del pedido + entry-points "Crear entrega".                                                                                                                                   |
| `_notes/research-dashboard-lists.md`                          | **S2-post** — Research de los 4 micro-stats + paginación + swipe + densidad.                                                                                                                                               |
| `_notes/research-settings-avatar.md`                          | **S2-post** — Research de settings layout + spec del componente `<StoreAvatar>`.                                                                                                                                           |
| `_notes/demo.html`                                            | **S1** — Demo HTML antiguo del dashboard en las 4 direcciones (ya superado por `demo-screens.html`).                                                                                                                       |
| `_notes/demo-form.html`                                       | **S1** — Demo HTML antiguo del formulario "Nueva tienda" en las 4 direcciones (ya superado).                                                                                                                               |
| `_notes/iteration-history.md`                                 | Bitácora cronológica de iteraciones de S1 (rev 1, rev 2…).                                                                                                                                                                 |
| `_notes/assumptions.md`                                       | Supuestos generales del subproyecto (heredado de S1).                                                                                                                                                                      |
| `_notes/red-team.md`                                          | Pasada de revisión hostil de S1.                                                                                                                                                                                           |
| `sessions/01-research.md`                                     | Cierre de S1: research + auditoría + 4 direcciones.                                                                                                                                                                        |
| `sessions/02-screens.md`                                      | Cierre de S2: 6 wireframes + red team + plan de validación + post-closure ADR.                                                                                                                                             |
| `sessions/03-tokens.md`                                       | Cierre de S3: tokens dual-mode + audit contraste + paletas alternativas + 4 ADRs (0004-0007).                                                                                                                              |
| `sessions/04-components.md`                                   | Cierre de S4: 47 componentes core specceados + audit + red team + gaps.                                                                                                                                                    |

## Sesiones (estado)

| #   | Nombre                                    | Estado          | Archivo                                                 |
| --- | ----------------------------------------- | --------------- | ------------------------------------------------------- |
| 01  | Research + Auditoría + 4 direcciones      | ✅ done (rev 2) | `sessions/01-research.md`                               |
| 02  | Wireframes de pantallas críticas          | ✅ done         | `sessions/02-screens.md` + `screens/`                   |
| 03  | Sistema de tokens dual-mode               | ✅ done         | `sessions/03-tokens.md` + `tokens.md` + `tokens-css.md` |
| 04  | Componentes core (botones, inputs, cards) | ✅ done         | `sessions/04-components.md` + `components.md` + `components/<Name>.md` (47) |
| 05  | Navegación y layouts                      | 🟡 next         | —                                                       |
| 06  | Dashboard alta fidelidad                  | ⏳ pending      | —                                                       |
| 07  | Flujos de creación/edición de orden       | ⏳ pending      | —                                                       |
| 08  | Flujos de pagos y entregas                | ⏳ pending      | —                                                       |
| 09  | Listas, detalles, empty/loading/error     | ⏳ pending      | —                                                       |
| 10  | Onboarding + landing                      | ⏳ pending      | —                                                       |
| 11  | Motion, microinteracciones, voice         | ⏳ pending      | —                                                       |
| 12  | Handoff a implementación                  | ⏳ pending      | —                                                       |

## Estado actual

- Sesión vigente: **Sesión 4 — Componentes core** ✅ done el 2026-05-02.
- S1 (Research + Auditoría + 4 direcciones) cerrada con rev 1 + rev 2.
- S2 produjo 6 wireframes lo-fi, red team, plan de 5 validaciones humanas, y **ADR 0001** (19 decisiones).
- S3 produjo `tokens.md` (Velvet default + 4 alternativas), `tokens-css.md` (mapping Tailwind v4), audit de contraste 188/188 AA, red team 15 objeciones / 0 bloqueantes, y **ADR 0004** (eliminación de paleta categórica).
- **Post-S2: 2 ADRs adicionales + demo iterado con feedback humano:**
  - **ADR 0002** — Mapeo de enums de Prisma a chips visuales (cierra el gap entre el modelo real y el copy placeholder de los wireframes).
  - **ADR 0003** — 8 decisiones del demo: **Velvet** reemplaza Indigo como primario, theme sin `system`, sidebar push, header con breadcrumbs, wizard accordion, sidebar derecha consistente, filter drawer.
  - **Demo HTML** funcional en `_notes/demo-screens.html` con 10 pantallas, 5 paletas (Velvet default + 4 alternativas), light + dark, responsive.
- **Highlights del ADR 0001:**
  - 4/4 gaps de Atelier resueltos: nuevo token `--info` para "pendiente sin urgencia", patrón **field-as-attribute**, **section card gated sin opacity**, **toast neutral-undo** (5s/8s).
  - Convención `view-transition-name: order-{humanId}` formalizada como contrato vinculante.
  - Lifecycle del pedido reorganizado por reversibilidad (sidebar para reversibles + overflow `[···]` para destructive).
  - 4 micro-stats nuevos del dashboard (Este mes / Próximos 30 días / Atrasado condicional / Llega esta semana).
  - Mobile orders list cambia a botón "Cargar más" (no infinite scroll).
  - Spec final del componente `<StoreAvatar>` (sizes 24/32/40/56, una sola letra).
- **Highlights del ADR 0002 (mapeo de chips):**
  - `OrderStatus`: OPEN → Abierto, IN_TRANSIT → En camino, COMPLETED → Completo, CANCELLED → Cancelado.
  - `DeliveryStatus`: IN_TRANSIT → En camino, DELIVERED → Llegó, CANCELLED → Cancelada.
  - `OrderItemDeliveryState`: NONE → Pendiente en tienda, ARRIVED_AT_STORE → Listo en tienda.
  - Estados derivados (Pagado, Atrasado, Pago parcial) como chip secundario, no reemplazan el principal.
  - Variant `neutral` formalizada como 5ta variant del sistema de chips.
- **Highlights del ADR 0003 (decisiones del demo):**
  - **Paleta primaria: Velvet** — morado profundo light + azul-violeta nocturno dark.
  - Theme toggle: solo `light` y `dark`, sin `system`.
  - Sidebar: logo top + nav medio + user bottom, colapsable con hover-expand modo PUSH.
  - Header: breadcrumbs + idioma + theme. Avatar vive solo en sidebar.
  - Wizard accordion para formularios ≥3 pasos (un paso expandido a la vez).
  - **Nota privada** NO es paso de creación — solo en pantallas de detalle, en sidebar derecho.
  - Sidebar derecho consistente en pantallas de detalle: `Resumen / Acciones / Tu nota privada`.
  - Filter drawer unificado (mobile bottom sheet / desktop drawer derecho).
- **Highlights de S3 (sistema de tokens):**
  - **Velvet como paleta default** + 4 alternativas (Lilac, Plum, Lagoon, Forest) con misma estructura semántica (mismos tokens, valores diferentes).
  - **188/188 pares de contraste pasan WCAG 2.2 AA** (5 paletas × 2 modos × ~19 pares por bloque). Audit en `_notes/s3-contrast-audit.md`.
  - **Ajustes vs demo HTML** documentados (text-muted L 0.54→0.46 en light, border-strong L 0.74→0.58, info h230→245, accents Lilac/Lagoon recalibrados, `--text-on-accent` dark oscuro en lugar de blanco).
  - **Decisiones residuales cerradas:** paleta categórica → eliminada (ADR 0004); `--accent-cool` → mantenido con nueva semántica (h195 teal → h215 azul-gris); `--surface-warm` → eliminado.
  - **`--accent-warm` reformulado** como decorativo-only (resuelve fallo Lilac warm 2.46:1 sin romper simetría cross-paleta).
  - **Stack tipográfico final:** Inter Variable + Inter Display + JetBrains Mono Variable. Token `--text-eyebrow` nuevo.
  - **Layout magic numbers** promovidos a tokens semánticos (sidebar/drawer/header widths, modal max, FAB).
  - **Z-index scale completa** (13 capas) y firma view-transition canónica como token aislado `--ease-vt-signature`.
  - **Recetas vinculantes** en `tokens-css.md` para `<StoreAvatar>`, toast neutral-undo, section card gated, field-as-attribute (los 4 patrones de los ADRs 0001/0003).
- **Highlights de S3 follow-up (research + ADRs 0005-0007):**
  - **4 sub-agentes de investigación lanzados** (apps reales + research académica + design systems): A (`--accent-warm` métrica del dashboard), B (daltonismo `--info` vs `--accent-cool`), C (validar paleta categórica), D (`--text-muted` outdoor mobile).
  - **ADR 0005** — patrón canónico icon-tile circular soft-tint + cifra `--text-primary` para los 4 micro-stat cards del dashboard. Refina ADR 0001 D8. Convergencia 11+ apps (Shopify Polaris, IBM Carbon, Material 3, Tailwind UI, Plausible, Apple Health Rings, YNAB, Cash App, Dell, Power BI canónico). Resuelve fail cross-paleta de Lilac warm 2.46:1.
  - **ADR 0006** — contrato vinculante "ícono + label" para `--info` y `--accent-cool`. Brettel/Viénot/Mollon (1997) demuestra que mover hues no resuelve el problema de daltonismo (h215 y h245 colapsan al mismo cuadrante de la _confusion plane_). Mitigación correcta es ortogonal al color, con enforcement TypeScript en S4 + lint en S12. Cierra el riesgo §12 gap 6 de `tokens.md`.
  - **ADR 0007** — code mono identificador `PT-XXXXXX` se reasigna de `--text-muted` (5.81:1) a `--text-secondary` (6.32:1) por robustez outdoor. Sin tocar tokens, sólo regla de uso. Preserva jerarquía visual muted > secondary.
  - **ADR 0004 confirmado** por research follow-up (6/6 apps de hobby no usan color por categoría).
- **Highlights de S4 (catálogo de componentes core):**
  - **47 componentes specceados** en 4 tiers: 17 atoms (form + acción), 10 molecules, 17 organisms (wizard + filter + detail + surface + shell), 3 form orchestration. Catálogo overview en [`components.md`](./components.md), specs detalladas en [`components/<Name>.md`](./components/).
  - **Plantilla obligatoria** de 15 secciones aplicada a 47/47 archivos: API TypeScript, variants, estados light + dark, mobile vs desktop, accesibilidad, motion, copy default + i18n, edge cases, anti-patrones, ejemplos, tokens, ADRs, dependencias, notas S12.
  - **Discriminated unions críticas** (TypeScript enforce de ADRs): `<StatusChip kind="info">` requiere `icon` + `label` (ADR 0006); `<MicroStatCard accentToken>` restringido a `--accent | --accent-warm | --warning | --success` (ADR 0005); `<IconButton label>` obligatorio; `<Combobox mode>`, `<Button as>`, `<MascotBubble variant>`, `<Toast variant>`, `<MenuItem type>`, `<FilterSection type>`, `<Checkbox checked>` indeterminate.
  - **Reglas vinculantes a nivel sistema** materializadas: disabled sin opacity (ADR 0001 D3 cross-componente), `--text-on-accent` oscuro en dark cross-componente (deuda legacy `text-white` flagged para S12), tap target ≥44×44 mobile, focus visible siempre, `prefers-reduced-motion` fallback en 47/47, voice glossary §7 cross-componente (cero violaciones), `--accent-cool` solo como color de ícono con label adyacente (ADR 0006), `<MonoCode>` default `--text-secondary` (ADR 0007).
  - **Cobertura completa de wireframes S2** (6/6) y **ADRs aceptados** (7/7). Componentes adicionales del shell (sidebar, header, ProgressBar, Pagination, VerifyEmailBanner, TabBar, FAB) diferidos a S5 con justificación.
  - **18 objeciones de red team** evaluadas, **0 bloqueantes pendientes**. 4 mayores resueltas con cambios al spec (Toast `Z` vs undo nativo, Combobox tap accidental "Crear nueva tienda", StatusChip info runtime fallback, migración legacy `text-white` registrada para S12). 8 menores aceptadas con riesgo controlado.
  - **13 gaps abiertos** registrados con sesión destino: S5 (4 — ProgressBar, Pagination, VerifyEmailBanner, TabBar; tokens `--detail-sidebar-w`, `--drawer-w-narrow/-wide`, `--motion-shell-push`), S6 (3), S9 (1 — Skeleton), S12 (5 — lint rules, audit cross-paleta, migración legacy).
- **Siguiente gate humano:**
  1. Revisar `components.md`, los 47 specs en `components/`, [`_notes/s4-compliance-audit.md`](./_notes/s4-compliance-audit.md), [`_notes/s4-red-team.md`](./_notes/s4-red-team.md), [`_notes/s4-gaps.md`](./_notes/s4-gaps.md).
  2. Ejecutar las 5 validaciones de [`_notes/s2-validation-plan.md`](./_notes/s2-validation-plan.md). **Validation #4 refinada por ADR 0007:** setup split (versión actual vs propuesta) en mid-tier (Pixel 6a) + high-tier (iPhone 15 Pro) bajo sol directo. Plan detallado en `_notes/s3-research-text-muted-outdoor.md` §9.
  3. Validación con usuario dichromat real del contrato ADR 0006 — programada para S6+ alta fidelidad como confirmación final, **no bloquea S5**.
  4. Lanzar **Sesión 5 — Navegación y layouts** componiendo los componentes specceados en S4. Primera prioridad: app shell (sidebar 240px / 64px collapsable + push, content header con `<Breadcrumbs>` + `<LangToggle>` + `<ThemeToggle>`, `<MobileTabBar>` 4 destinos + FAB elevado, sticky `<VerifyEmailBanner>`), aplicación de la firma view-transition `order-{humanId}` a list rows + detail header, primitivas faltantes del shell (`<ProgressBar>`, `<Pagination>`, `<VerifyEmailBanner>`).

## Regla operativa: rediseño vs FRD/código

Cuando una propuesta del subproyecto **contradiga un FRD aprobado o el código implementado**:

1. **Visual o componente** (color, tipografía, sidebar, drawer, accordion) → rediseño gana, sumar nota al FRD afectado.
2. **Copy / voz** → actualizar `docs/product/glossary.md` en el mismo cambio.
3. **Flujo o reglas de negocio** → actualizar el FRD primero. Si no se puede, re-abrir el ADR del subproyecto.
4. **Modelo de datos / enums** → no es decisión del subproyecto. Escalar antes de implementar.

**Ante ambigüedad o conflicto, parar y consultar antes de implementar** — no aplicar la propuesta hasta que haya acuerdo. Esto vale para agentes y humanos.
