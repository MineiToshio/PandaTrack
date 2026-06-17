---
title: S16 — Alineación funcional docs/product ↔ implementación (rebuild-complete)
last_updated: 2026-06-16
owner: Sergio Minei
status: done (docs + cambios de `src/` autorizados por Sergio, sin commitear — Sergio commitea)
scope: mayormente docs (alinear docs/product a la implementación); incluye cambios de `src/` autorizados por Sergio durante la sesión — ver §"Contradicciones código↔doc"
---

# S16 — Functional alignment: docs/product ↔ implementación

## Objetivo

Que `docs/product/` (FRDs + blueprints + work orders) sea un spec **funcional rebuild-complete**
de lo realmente implementado. Vara dura: si mañana se borra todo `src/` (y `docs/redesign/`),
cualquiera reconstruye TODA la funcionalidad —pantallas, flujos, reglas, estados, errores—
leyendo solo `docs/product/` + `docs/design/` + los FDD/prototipos de S15.

Encaje: S15 capturó el **diseño** por FRD (FDD = cómo se ve, prototype = el pixel). S16 captura
lo **funcional**: qué HACE cada pantalla. El FRD referencia su FDD para lo visual y no lo re-describe.

Autoridad: **el código es la fuente de verdad** de qué existe; el doc se actualiza para reflejarlo.
Ante un conflicto donde el código _contradiga_ una regla de negocio documentada (no solo la describa
incompleta), se para y se consulta (posible bug, no gap de doc).

## Definición de "rebuild-complete" (el bar por FRD)

- Cada ruta/pantalla con su propósito, datos cargados (queries), acciones, estados, validaciones.
- Cada server action / mutation / query: comportamiento, inputs, errores, efectos laterales
  (ej. re-derivación de `OrderStatus` al mutar entregas).
- Cada regla de negocio enforced en código, capturada como BR.
- Cada transición de lifecycle/estado documentada (matriz de estados).
- Cada edge case manejado en código, documentado.
- Acceptance criteria reflejan el comportamiento REALMENTE implementado.

## Método (replicable por FRD)

1. Leer el spec actual: FRD + blueprint + WOs + el delta-audit ya reconciliado (no repetir).
2. Mapear la implementación como autoridad (agente Explore exhaustivo sobre data layer, rutas,
   schema, Zod, server actions, analytics).
3. **Verificar en código** los puntos donde doc e impl divergen (no confiar solo en el mapa):
   leer los archivos clave (params de URL, mutaciones/guards, constants de eventos).
4. Clasificar gaps (exactitud vs completitud) y llenar hasta rebuild-complete, sin tocar `src/`.

### Nivel de detalle acordado (gate Sergio, 2026-06-16)

Vara **exhaustiva**. Cada FRD UI-bearing incluye, además de FR/BR/AC actualizados:

- **Screens and Data Contract** — por ruta: propósito, datos cargados (nombres de query),
  acciones/server-actions, estados (loading/empty/empty-filtered/error/guards).
- **State Model** — matriz de transiciones de lifecycle + estados de producto + regla de
  re-derivación de estado padre.
- **Error Contract** y **Analytics** — "lo que mejor encaje por FRD": se concentra en el FRD
  (spec rebuild-able) cuando ahí es donde falta; los WOs/BP referencian, sin duplicar.

El visual NO se re-describe: el FRD referencia su FDD (`fdd-XX-<slug>.md`).

## Pasada 1 — Piloto FRD-08 (Entregas) ✅

FRD-08 ya estaba muy bien (construido desde el FRD, auditado en S9 + delta-frd08). Sin
contradicciones código↔regla. Los gaps fueron de **completitud y exactitud de contrato**.

### Gaps resueltos

**Exactitud (código contradecía el doc):**

- A1 — BP-01 + WO-03…07 marcados `PLANNED` pese a estar shipeados → `IMPLEMENTED`.
- A2 — WO-01: tabla de schema con refs FR desplazadas (cost/currency/fx/arrival/note apuntaban a
  FR-08-06/07/09/10/25) → corregidas a FR-08-07/08/10/11/26.
- A3 — WO-07: contrato de URL con params inexistentes (`shippingDateFrom/To`,
  `expectedArrivalFrom/To`, `expectedArrivalPreset`) → reescrito a los reales
  (`q, status, store, product, overdue, arrivalFrom/To, shippedFrom/To, sort, page`).

**Completitud (comportamiento en código, ausente del spec):**

- B1 — Sort de usuario (4 opciones: oldest/recent/eta-asc/store-asc) → nuevo `FR-08-35`,
  `AC-08-07`, contrato de lista en BP.
- B2 — Guard reopen-cancelado (`PRODUCTS_IN_OTHER_DELIVERY`): bloquea reabrir si un producto se
  re-asignó a otra entrega activa → nuevo `BR-08-08`, nota en `FR-08-23`, `AC-08-06`.
- B3 — Modelo de interacción del lifecycle (mark/cancel = confirm + optimista; reopen = directo +
  undo neutral; delete = awaited + redirect) → sección "Lifecycle Interaction Model".
- B4 — Contrato de errores tipados por mutación → sección "Error Contract" + BP lifecycle contract.
- B5 — Analytics: FRD sin sección de eventos → sección "Analytics" con los 17 eventos reales.
- B6 — reopen limpia `receivedDate`; `DELIVERED` deja Edit deshabilitado → notas en FR/contrato.

**Vara exhaustiva (S16-bar):**

- Sección "Screens and Data Contract" (list / detail / create / edit) con queries, acciones, estados.
- Sección "State Model" (matriz `DeliveryStatus` + `OrderItemDeliveryState` + re-derivación de orden).

### Archivos tocados (docs-only, sin commitear)

- `frd-08-delivery-management.md` (FR-08-35, BR-08-08, AC-08-06/07, Lifecycle Interaction Model,
  Error Contract, Analytics, Screens and Data Contract, State Model)
- `bp-01-delivery-management.md` (status, lifecycle/error/sort contracts, filter URL params)
- `wo-01` (refs FR), `wo-03…07` (status `IMPLEMENTED`), `wo-07` (URL contract)

## Pasada 2 — todos los FRDs restantes (workflow multi-agente)

3 rondas: (1) auditoría+aplicación en paralelo (1 agente/FRD, código=autoridad, vara exhaustiva);
(2) verificación adversarial por FRD; (3) remediación de las inexactitudes que la verificación
encontró + pasada final manual para los 2 majors. La primera ronda, además de cerrar gaps,
**introdujo algunas claims incorrectas** (paths, params, undo, etc.) que la verificación cazó y la
remediación corrigió contra el código. Lección: doc-alignment necesita el paso verify-vs-código,
no solo el de escribir.

## Mapa rebuild-complete (final)

Total: **62 archivos docs cambiados** (+2223/−762) + **cambios de `src/` autorizados por Sergio** (surface del flag FX stale-rate en detalle/edición de pedidos + `orderQueries`/i18n/e2e; FAQ accordion a disclosures múltiples) — ver §"Contradicciones código↔doc". Sin commitear.

| FRD           | Módulo                         | Estado S16                                       |
| ------------- | ------------------------------ | ------------------------------------------------ |
| PRD-01 FRD-08 | Delivery management            | ✅ rebuild-complete (piloto)                     |
| PRD-01 FRD-05 | Order / payment / shipment     | ✅ rebuild-complete (full + remediado 2×)        |
| PRD-01 FRD-04 | Store domain                   | ✅ rebuild-complete (full + remediado 2×)        |
| PRD-01 FRD-03 | Collector app shell            | ✅ rebuild-complete (full)                       |
| PRD-01 FRD-07 | User settings                  | ✅ rebuild-complete (full)                       |
| PRD-01 FRD-01 | Account access & recovery      | ✅ rebuild-complete (spec 12→23 FR)              |
| PRD-00 FRD-04 | Public legal transparency      | ✅ rebuild-complete (full)                       |
| PRD-00 FRD-03 | Public web platform foundation | ✅ rebuild-complete (era stub)                   |
| PRD-00 FRD-02 | Growth & observability         | ✅ verificado (catálogo eventos 116→111, 8 cat.) |
| PRD-01 FRD-02 | Testing & quality baseline     | ✅ verificado (7 specs E2E + config)             |
| PRD-00 FRD-01 | Pre-release landing            | ✅ SUPERSEDED documentado (go-live S11)          |
| PRD-01 FRD-06 | Dashboard & reminders          | ✅ documentado PLACEHOLDER (sin FDD aún)         |

## Contradicciones código↔doc — resolución (gate de Sergio, 2026-06-16)

> Esta ronda incluyó **2 cambios pequeños en `src/`** autorizados por Sergio (S16 deja de ser
> puramente docs-only): el guard de ruta de edit de pedidos y un fix de copy del hero cancelado.

1. **FX reconciliation — RESUELTO + IMPLEMENTADO (Sergio eligió "tracking por pedido", flag,
   base-change-triggered, sin nag mensual).** Se agregó la columna `Order.needsExchangeRateUpdate`
   (migración `20260616230000_...`). `buildFxPendingWhere` ahora = `needsExchangeRateUpdate:true ∧
currency≠base ∧ status≠CANCELLED` (se quitó el scope mensual/`startOfCurrentMonth`). Se prende vía
   `flagOrdersForFxReconciliation(userId,newBase)` al cambiar la moneda base (solo flag, sin tocar
   rates; cableado en `updateCurrencyAction`). Se apaga al crear (rate fresco), al editar reingresando
   el rate (`editOrder`), y al reconciliar (`updateExchangeRatesAction`). Converge: reconciliar saca al
   pedido del set; cancelados quedan flaggeados y reaparecen al reactivar. Test nuevo
   `fxReconciliationFlag.test.ts` (3 casos). Docs revertidos al modelo flag (FRD-05/07, BP-02, WO-05,
   WO-07). Validación full verde. **E2E `e2e/orders.spec.ts`** cubre el flujo completo (cambiar base →
   flag → banner/fxPending → reconciliar en el modal → se limpia); pasa. **Indicadores FX por pedido —
   IMPLEMENTADOS (follow-up post-gate):** chip `warning` en el hero del detalle (`detail.hero.chipFxPending`,
   oculto en cancelados) + warning inline en el campo FX del edit (`form.exchangeRateOutdatedWarning`),
   ambos leen el flag (en `getOrderById`/`getOrderDetail`); el e2e FX afirma ambos.
2. **Cancelar pedido preserva los pagos (FRD-05) — RESUELTO.** Confirmado por Sergio: preserve-on-cancel
   es lo correcto (borrar-en-cancel era el bug que rompía Reactivar). Doc actualizado (BR-05-15/16/17 sin
   "pending review"). **Bug de copy encontrado y arreglado:** el hero del pedido cancelado afirmaba
   "Sin pagos registrados" / "No payments recorded" incondicionalmente (leftover de la era
   borrar-en-cancel) — `detail.hero.cancelledOn` reducido a solo la fecha (es+en).
3. **Sidebar hover-expand FLOAT vs PUSH (FRD-03) — RESUELTO.** Sergio confirma: FLOAT (lo implementado)
   es lo querido; no se toca `src/`. FDD-03 actualizado: divergencia aceptada (FLOAT supersede el
   PUSH-on-hover del prototipo/ADR 0003). **Docs de diseño reconciliadas (follow-up post-gate):**
   `docs/design/interface-patterns.md` §sidebar e `docs/design/decisions/0003` actualizadas a FLOAT
   (toggle manual = PUSH; hover-expand = FLOAT), con nota de supersesión.
4. **Edit de pedido CANCELLED — RESUELTO (código).** Sergio: primero hay que reactivar para editar.
   Implementado guard de ruta en `orders/[id]/edit/page.tsx` que redirige un pedido `CANCELLED` al
   detalle (paridad con delivery-edit); la mutation ya rechazaba con `ORDER_NOT_EDITABLE` como red de
   seguridad. FRD-05 Screens actualizado. Validación full verde + **E2E `e2e/orders.spec.ts`** verifica
   el guard (pedido cancelado → /edit redirige al detalle; reactivar → /edit vuelve a servir el form);
   pasa. Catálogo E2E de FRD-02 actualizado (8º spec).
5. **Menores (follow-up post-gate):** **FAQ landing — RESUELTO:** Sergio eligió alinear el código al
   FDD → `FaqAccordion` ahora es **multi-open** (varios abiertos a la vez, primer item por default,
   `Set<string>`); e2e `landing.spec.ts` reforzado para afirmarlo. **FR-02-02/03 observabilidad —
   se deja como "superseded"** (decisión de Sergio: mi recomendación; formalizar como "removed" + FR
   de conversión AUTH solo si/ cuando se sincronice GitHub). **Nota de autoridad de prototipos:**
   `frd-design-documentation.mdc` ahora declara el orden implementación → FDD prosa → prototipo (el
   HTML es ayuda visual no-autoritativa, puede divergir).

## Divergencias prototipo (S15) ↔ FDD corregido — para S17

Las correcciones de FDD dejaron prototipos HTML (disposables, S15) desactualizados: store-domain
("Guardar tienda", "Envía a 12 países", reviews 5+5), public-legal (anchor ids placeholder, headings
numerados, header sticky), landing (FAQ multi-open), auth (sign-out en gate). No se tocaron (HTML
generado, disposable). Reconciliar o archivar en S17.

## Pendientes de sincronización GitHub (Project 4 — no forzados)

S16 añade FR/BR/AC nuevos y flips de `implementation_status` que deberían reflejarse en GitHub
Project 4 / issues. La herramienta no permite editar issues desde acá → pendientes:

- **Nuevos requisitos:** FRD-08 (FR-08-35, BR-08-08, AC-08-06/07); FRD-05 (FR-05-39, FR-05-40);
  FRD-04 (FR-04-35); FRD-03 (FR-03-09..12, BR-03-06..08, AC-03-05..07); FRD-07 (FR-07-35/36,
  AC-07-15/16); FRD-01 (FR-01-13..23, BR-01-08..10, AC-01-06..11); FRD-04-PRD00 (FR-04-06..10,
  BR-04-01..05, AC-04-04..06); FRD-03-PRD00 (FR-03-07..11, BR-03-01..07); FRD-02 (FR-02-07,
  BR-02-05/06, AC-02-03).
- **Flips de status a IMPLEMENTED:** FRD-08 WO-03…07 + BP-01; FRD-05 BP-01/BP-02 + WO-04/06/07
  (WO-07 = issue #104); FRD-07 BP-01 + WO-05.
- **Estados especiales:** FRD-06 → PLACEHOLDER; PRD-00 FRD-01 landing BP-01 + WO-02 → SUPERSEDED.

## Validación

Docs-only (categoría 1 del checklist): sin comandos de app requeridos.
