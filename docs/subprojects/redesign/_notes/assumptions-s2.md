---
title: S2 — Supuestos asumidos durante el diseño de wireframes
session: 02
last_updated: 2026-05-01
status: closed (post-research resolution)
resolved_by: ../decisions/0001-s2-closure-decisions.md
---

# S2 — Supuestos asumidos durante los wireframes lo-fi

> **Estado post-cierre (2026-05-01).** Tras la pasada de research con 5 agentes en paralelo, los supuestos clave se resolvieron en [`decisions/0001-s2-closure-decisions.md`](../decisions/0001-s2-closure-decisions.md). La leyenda de estado por supuesto:
>
> - ✅ **Confirmed** — el supuesto se mantiene tal como estaba.
> - ⚙️ **Changed** — la decisión final difiere; ver ADR.
> - ⏳ **Pending validation** — depende de pruebas humanas (`s2-validation-plan.md`).
>
> **Resumen del cierre:**
>
> | Bloque          | Confirmed | Changed | Pending validation |
> | --------------- | --------- | ------- | ------------------ |
> | Transversales   | 4         | 1       | 0                  |
> | Dashboard       | 3         | 1       | 1                  |
> | Orders list     | 3         | 2       | 1                  |
> | Order detail    | 4         | 2       | 0                  |
> | Order create    | 5         | 0       | 1                  |
> | Delivery create | 4         | 1       | 1                  |
> | Settings        | 5         | 1       | 1                  |
> | **Total**       | **28**    | **8**   | **5**              |
>
> Los 8 supuestos cambiados tienen recetas concretas en el ADR; los 5 pending validation se resuelven en paralelo a S3 con las pruebas humanas.

Documenta los supuestos que el agente tomó por su cuenta cuando el contrato funcional, la dirección Atelier o el decálogo dejaban un grado de libertad. Cada supuesto incluye el origen y la decisión sugerida para validación humana antes de S3.

## Cómo usarlo

- Si un supuesto se confirma → mover a `decisions/` o anotar en el wireframe afectado y borrar de aquí.
- Si un supuesto se rechaza → reabrir el wireframe afectado y re-iterar.
- Mantener este archivo en `_notes/`; no migra a `screens/`.

---

## Supuestos transversales

| #   | Supuesto                                                                                                                                                                                                                      | Wireframe afectado                   | Resolución sugerida                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------- |
| T1  | Se mantiene la convención `view-transition-name: order-{humanId}` como contrato vinculante entre `/orders` y `/orders/[id]` (y origen alternativo desde dashboard).                                                           | dashboard, orders-list, order-detail | Elevar a ADR en `decisions/` antes de S6.                                                     |
| T2  | El componente `<StoreAvatar>` reusable existe en S4 con sizes 24/32/40/56, recibe `{ store, size }`, y aplica internamente la receta única §4.4 (logo si existe → letra inicial sobre tinte indigo si no).                    | todos                                | Confirmar en S4 cuando se diseñe el inventario de componentes core.                           |
| T3  | El shell `(app)/layout` mantiene **sidebar 240px desktop** + **tab bar inferior mobile con 4 destinos máximo + FAB elevado** + **bubble idle del panda 56×56 en esquina inferior derecha** (default ON, opt-out en settings). | todos                                | Confirmar en S5 (Navegación y layouts) — el wireframe no rediseña el shell, asume que existe. |
| T4  | El locale default es `es`. Todas las claves i18n propuestas en §9 de cada wireframe se entregan primero en `es` y luego en `en` (paridad), nunca traducidas literal — reinterpretadas según glosario `principles.md §7`.      | todos                                | Confirmar en S2.5 (catálogo i18n consolidado).                                                |
| T5  | El theme toggle (light/dark/system) vive en el shell para acceso rápido, y en `settings → preferences` como fuente de verdad persistente (`localStorage["theme"]`).                                                           | settings, shell                      | Confirmar en S5.                                                                              |

## Supuestos por pantalla

### Dashboard

| #   | Supuesto                                                                                                                                                                                                                    | Resolución sugerida                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| D1  | Existe un FRD futuro de KPIs que define qué métricas se muestran en el hero y los 4 micro-stats. El wireframe asume: **monto total restante, próximo pago, entregas en tránsito, pre-órdenes activas, vencidos, llegando**. | Validar con humano si los 4 micro-stats elegidos (pagado/próximo/vencidos/llegando) son los definitivos. |
| D2  | Walking de la mascota usa `localStorage["mascot:lastWalkAt"]` para cooldown 8min cross-tab.                                                                                                                                 | Validar en S6 cuando se implemente la mascota real.                                                      |
| D3  | El toggle "Mostrar mascota" agrega un campo a `preferences` schema (no en S2 — se asume que S3 lo añadirá).                                                                                                                 | Reabrir en S3 cuando se diseñe el sistema de tokens + datos.                                             |
| D4  | `⌘K` queda como tooltip "próximamente" hasta que se implemente command palette en S5+.                                                                                                                                      | Confirmar.                                                                                               |
| D5  | Stub de `/deliveries/[id]` puede caer al estado de "error en bento individual" si no carga.                                                                                                                                 | Confirmar comportamiento con humano.                                                                     |

### Orders list

| #   | Supuesto                                                                                                                                    | Resolución sugerida                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| OL1 | **Densa** es la densidad por default; **Cómoda** es opt-in persistido en `localStorage["orders.density"]`.                                  | Confirmar default.                                                                                 |
| OL2 | **Sort default** = "Más recientes" (`orderDate desc`).                                                                                      | Confirmar.                                                                                         |
| OL3 | Filtros NO se persisten cross-session por default (se limpian al cerrar tab); URL los persiste sólo durante navegación dentro de la sesión. | Validar con power users.                                                                           |
| OL4 | Mobile usa **infinite scroll con sentinel**; desktop usa **paginación clásica `pageSize 30`**.                                              | Confirmar.                                                                                         |
| OL5 | Avatar fallback usa **una sola letra** (la primera del nombre en mayúsculas), no las dos primeras.                                          | Confirmar — la receta §4.4 dice "letra inicial" en singular, pero hay precedente de "MX" en mocks. |
| OL6 | Sin tiendas → variante del empty state principal (no modal bloqueante, no full-page gate).                                                  | Confirmar.                                                                                         |

### Order detail

| #   | Supuesto                                                                                                                                                                         | Resolución sugerida            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| OD1 | Pagos NO paginan — pedidos típicos tienen <20 pagos (validar con datos reales en S3).                                                                                            | Validar con datos productivos. |
| OD2 | Historial es colapsable y NO carga por default (lazy on expand).                                                                                                                 | Confirmar.                     |
| OD3 | Layout desktop = 2-col dentro de `max-w-6xl` (main 1-8, sidebar sticky 9-12 con Resumen + Acciones + Nota). Mobile colapsa todo single-column.                                   | Confirmar layout.              |
| OD4 | "Crear entrega desde este pedido" es un CTA en sidebar de Acciones que prefilea `/deliveries/new?sourceOrderId=`. Alternativa rechazada: CTA en sub-card Items con preselección. | Confirmar ubicación.           |
| OD5 | Lifecycle (cancel/reactivate/delete) vive en sub-card "Acciones" colapsada por default. Alternativa rechazada: menú overflow `[···]` en header (peor discoverability).           | Confirmar.                     |
| OD6 | Autosave de nota privada usa throttle 1.5s on blur para evitar request storm.                                                                                                    | Validar timing.                |

### Order create

| #   | Supuesto                                                                                                                                                                                           | Resolución sugerida                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| OC1 | Las **5 section cards** son: Tienda, Fechas, Items, Costos, Nota.                                                                                                                                  | Confirmar set y orden.                                          |
| OC2 | Items mínimo recomendado por UI = 1 (no 0), aunque el schema lo permita; el form sugiere agregar al menos 1 antes del submit.                                                                      | Validar — ¿bloqueo al submit con 0 items?                       |
| OC3 | Step indicator es navegable libremente hacia atrás (no secuencial estricto), pero hacia adelante sólo si los pasos previos están válidos.                                                          | Confirmar comportamiento.                                       |
| OC4 | Autosave es **local-only** en `localStorage` por `userId` (no server drafts). Decisión por simplicidad — server drafts requieren modelo adicional.                                                 | Validar — si se quiere cross-device draft, requiere FRD aparte. |
| OC5 | Modal de discrepancia 12.a usa **bottom sheet en mobile / center modal en desktop** con tres CTAs: "Usar ingresado" / "Usar calculado" / "Volver". Sin estado destructive — es decisión, no error. | Confirmar tono.                                                 |
| OC6 | Combobox de tienda permite atajo "Crear nueva tienda" inline que abre sheet lateral sin perder el form actual.                                                                                     | Validar UX — ¿el sheet conserva el draft del form principal?    |

### Delivery create

| #   | Supuesto                                                                                                                                                                                       | Resolución sugerida                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| DC1 | Las **4 section cards** son: Tienda, Productos, Costos, Resumen.                                                                                                                               | Confirmar set y orden.                                                          |
| DC2 | Si entra con `sourceOrderId`, el step indicator arranca en paso 2 (Productos) con paso 1 marcado done; combobox de tienda se muestra read-only con badge.                                      | Confirmar UX del prefill.                                                       |
| DC3 | Productos del `sourceOrder` vienen **pre-seleccionados** por default; el user puede deseleccionar uno a uno o por grupo.                                                                       | Validar default — algunos prefieren "vacío y selecciono lo que voy a entregar". |
| DC4 | Estado producto NONE = chip `--warning / 14%` "Aún no llega"; ARRIVED_AT_STORE = chip `--success / 14%` "Listo en tienda". Riesgo de tono alarmante registrado en gap #1 de `atelier-gaps.md`. | Validar tono con humano (Validation #4 del plan).                               |
| DC5 | Toast con undo aparece tras select-all de ≥10 items para mitigar selección accidental masiva.                                                                                                  | Confirmar threshold (10 items) y duración (5s).                                 |
| DC6 | "Split shipment" (entregar sólo algunos productos de varias órdenes) se infiere de la selección, sin UI explícita "modo split".                                                                | Validar discoverability.                                                        |

### Settings

| #   | Supuesto                                                                                                                                                 | Resolución sugerida                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| S1  | Desktop usa **Opción A: tabs verticales** (cols 1-3) + contenido a la derecha (cols 4-12) por consistencia con apps SaaS premium (Linear/Vercel/Stripe). | Confirmar — Opción B (cards stackeadas igual que mobile) sigue siendo viable. |
| S2  | Cada fila edita **inline** (no modal) salvo casos sensibles: avatar (cropper) y currency change (destructivo).                                           | Confirmar.                                                                    |
| S3  | El toggle **"Mostrar mascota"** vive en `Preferences` (con la ironía explícita de que el toggle de la mascota está donde la mascota no aparece).         | Confirmar ubicación.                                                          |
| S4  | El **theme toggle** vive **en ambos lugares**: shell (acceso rápido) y settings → preferences (fuente de verdad persistente).                            | Confirmar.                                                                    |
| S5  | Cooldown del username (30d) se comunica en chip `--warning` visible con timer "{days} días", no escondido en tooltip.                                    | Confirmar — la transparencia es deliberada (anti-frustración).                |
| S6  | MFA enrolment es flujo aparte (sheet/modal) que no entra en wireframe lo-fi de S2.                                                                       | Confirmar — MFA queda fuera del scope S2 explícitamente.                      |
| S7  | "Cerrar sesión en todos los dispositivos" es ghost destructive al pie de la sección Account (si la capability existe).                                   | Confirmar si existe la capability — si no, se omite.                          |

---

## Resolución post-research (2026-05-01)

Resolución por ID. Las recetas concretas viven en [`decisions/0001-s2-closure-decisions.md`](../decisions/0001-s2-closure-decisions.md).

### Transversales

| ID  | Estado       | Resolución                                                                                                                                                                                                                 |
| --- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | ✅ Confirmed | Convención `view-transition-name: order-{humanId}` formalizada en **Decisión 5** del ADR. Vinculante.                                                                                                                      |
| T2  | ⚙️ Changed   | Spec final del componente `<StoreAvatar>` definida en **Decisión 16** — sizes `24/32/40/56`, UNA letra (monograma de marca), `object-fit: contain` con padding 12.5% para logos rectangulares, sin status indicator en S2. |
| T3  | ✅ Confirmed | Shell (sidebar 240px desktop + tab bar mobile + bubble panda 56×56) se mantiene. Re-confirmar formalmente en S5.                                                                                                           |
| T4  | ✅ Confirmed | Locale default `es` con paridad `en` reinterpretada (no traducción literal) según glosario `principles.md §7`.                                                                                                             |
| T5  | ✅ Confirmed | Theme toggle dual confirmado en **Decisión 14** — shell + settings con misma fuente de verdad `localStorage["theme"]`, default `system`.                                                                                   |

### Dashboard

| ID  | Estado                  | Resolución                                                                                                                                                                                                |
| --- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | ⚙️ Changed + ⏳ Pending | **Decisión 8** cambia el set: `Pagado / Próximo / Vencidos / Llegando` → `Este mes / Próximos 30 días / Atrasado (condicional) / Llega esta semana`. Validación humana 1 confirma o rechaza el set nuevo. |
| D2  | ✅ Confirmed            | Walking de mascota usa `localStorage["mascot:lastWalkAt"]`. Re-confirmar al implementar en S6.                                                                                                            |
| D3  | ✅ Confirmed            | Toggle "Mostrar mascota" vive en `preferences` (S3 actualiza schema). Confirmado en **Decisión 17** + bonus de menú contextual sobre la mascota.                                                          |
| D4  | ✅ Confirmed            | `⌘K` queda como tooltip "próximamente" hasta S5+.                                                                                                                                                         |
| D5  | ✅ Confirmed            | Stub `/deliveries/[id]` cae al "error en bento individual" si no carga.                                                                                                                                   |

### Orders list

| ID  | Estado                | Resolución                                                                                                                     |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| OL1 | ⚙️ Changed            | Densa default mantenida. **Decisión 11** agrega reflejo en `preferences.preferredDensity` (S3+).                               |
| OL2 | ✅ Confirmed          | Sort default = "Más recientes". Confirmado.                                                                                    |
| OL3 | ⏳ Pending validation | Filtros NO persistidos cross-session se mantiene como default. Validar con power users si solicitan "vistas guardadas" (S4+).  |
| OL4 | ⚙️ Changed            | **Decisión 9** cambia mobile de infinite scroll a botón **"Cargar más"** (`pageSize 20`). Desktop sigue clásica `pageSize 30`. |
| OL5 | ✅ Confirmed          | Una sola letra (monograma) confirmado en **Decisión 16**.                                                                      |
| OL6 | ✅ Confirmed          | "Sin tiendas" como variante del empty state (no modal bloqueante).                                                             |

### Order detail

| ID  | Estado       | Resolución                                                                                                                                                                                                                                                |
| --- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OD1 | ✅ Confirmed | Pagos NO paginan. Re-validar con datos productivos si aparece pedido con >20 pagos.                                                                                                                                                                       |
| OD2 | ✅ Confirmed | Historial colapsable, lazy on expand.                                                                                                                                                                                                                     |
| OD3 | ✅ Confirmed | Layout 2-col desktop confirmado.                                                                                                                                                                                                                          |
| OD4 | ⚙️ Changed   | **Decisión 7** introduce **doble entry-point**: CTA primario en sidebar Acciones + link mono `↳ Crear entrega con estos productos` en footer de la sub-card Items cuando hay items elegibles.                                                             |
| OD5 | ⚙️ Changed   | **Decisión 6** cambia el supuesto: lifecycle separado por reversibilidad. Reversibles (Editar / Crear entrega / Cancelar / Reactivar) en sidebar siempre visibles. Destructiva (`Eliminar pedido`) en menú overflow `[···]` del header con confirm modal. |
| OD6 | ✅ Confirmed | Autosave de nota privada con throttle 1.5s on blur.                                                                                                                                                                                                       |

### Order create

| ID  | Estado                | Resolución                                                                                                                                                                    |
| --- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OC1 | ✅ Confirmed          | 5 section cards (Tienda · Fechas · Items · Costos · Nota) confirmado.                                                                                                         |
| OC2 | ✅ Confirmed          | **Decisión 12 / OC2** — UI bloquea submit con 0 items via `items.min(1)`.                                                                                                     |
| OC3 | ✅ Confirmed          | **Decisión 12 / OC3** — step indicator navegable libremente con scroll spy, sin gating estricto.                                                                              |
| OC4 | ⏳ Pending validation | **Decisión 12 / OC4** — autosave local-only confirmado para MVP, con copy explícito "Guardado en este navegador, hace Ns". Validación humana 3 puede escalar a server drafts. |
| OC5 | ✅ Confirmed          | Modal de discrepancia con 3 CTAs ("Usar ingresado" / "Usar calculado" / "Volver"), sin tono destructive.                                                                      |
| OC6 | ✅ Confirmed          | Atajo "Crear nueva tienda" inline en combobox abre sheet lateral conservando el form draft.                                                                                   |

### Delivery create

| ID  | Estado                  | Resolución                                                                                                                                                 |
| --- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DC1 | ✅ Confirmed            | 4 section cards (Tienda · Productos · Costos · Resumen) confirmado.                                                                                        |
| DC2 | ✅ Confirmed            | **Decisión 13 / DC2** — prefill arranca en paso 2, paso 1 marcado done con check, tienda como **field-as-attribute** (Decisión 2) en el header del paso 2. |
| DC3 | ✅ Confirmed            | **Decisión 13 / DC3** — productos del `sourceOrder` vienen **pre-seleccionados todos**. Toast neutral-undo (Decisión 4) tras deselección masiva.           |
| DC4 | ⚙️ Changed + ⏳ Pending | **Decisión 1** — chip "Aún no llega" usa **`--info`** (token nuevo), NO `--warning`. Validación humana 4 confirma legibilidad bajo sol.                    |
| DC5 | ✅ Confirmed            | Toast neutral-undo (5s default) tras selección masiva ≥10 items. Threshold y duración formalizados en **Decisión 4**.                                      |
| DC6 | ✅ Confirmed            | "Split shipment" se infiere de la selección, sin UI explícita "modo split".                                                                                |

### Settings

| ID  | Estado       | Resolución                                                                                                                                                                                  |
| --- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | ✅ Confirmed | **Decisión 15** — Opción A (tabs verticales cols 1-3 + contenido cols 4-12) confirmada.                                                                                                     |
| S2  | ✅ Confirmed | Edit inline salvo casos sensibles (avatar cropper + currency change).                                                                                                                       |
| S3  | ⚙️ Changed   | **Decisión 17** — toggle "Mostrar mascota" en `preferences` + bonus de descubribilidad: right-click/long-press en la mascota abre menú contextual (Ocultar / Cambiar tema / Configuración). |
| S4  | ✅ Confirmed | Theme toggle dual (shell + settings) con default `system`. Confirmado en **Decisión 14**.                                                                                                   |
| S5  | ⚙️ Changed   | **Decisión 18** — chip warning del cooldown del username aparece **sólo durante el período activo**, no permanente. Cuando termina el cooldown, el input vuelve a estado normal sin chip.   |
| S6  | ✅ Confirmed | MFA enrolment fuera de scope S2.                                                                                                                                                            |
| S7  | ✅ Confirmed | **Decisión 19** — "Cerrar sesión en todos los dispositivos" se muestra siempre que la capability exista en backend, sin condicionar al número de sesiones.                                  |

## Notas

- Los 8 supuestos cambiados están reflejados como addendum al inicio de cada wireframe afectado.
- Los 5 pending validation se ejecutan con las 5 pruebas humanas del [`s2-validation-plan.md`](./s2-validation-plan.md).
- Si una validación humana falla, se reabre el supuesto correspondiente y se anota un nuevo ADR.
- Si todos los supuestos son confirmados sin cambios, este archivo queda como registro histórico.
