---
title: Módulo Entregas — S9
session: 09
status: fase-b-complete
last_updated: 2026-06-12
frd: docs/product/prd-01-collector-mvp/frd-08-delivery-management/frd-08-delivery-management.md
blueprint: docs/product/prd-01-collector-mvp/frd-08-delivery-management/bp-01-delivery-management/bp-01-delivery-management.md
---

# Módulo Entregas — S9

Doc maestro de la Fase A del módulo Entregas. Los screen specs (`screens/delivery-list.md`, `screens/delivery-detail.md`, `screens/delivery-create.md`) describen el contrato por pantalla; este doc define el alcance del módulo, las decisiones de la iteración, y el handoff a Fase B.

**Gate humano:** demo aprobado el 2026-06-12 tras 2 rounds de iteración ("en grandes rasgos me gusta cómo ha quedado").

## Resumen ejecutivo

Rediseño end-to-end del módulo Entregas: lista (con filtros, sort, estados), detalle (3 variantes de lifecycle), crear (2 entry points + empty de elegibilidad), editar, 3 modales de lifecycle y 5 pantallas mobile. 19 anchors en el demo (`S9 · Entregas` en el navbar + índice maestro). Paridad estructural y de vocabulario con el módulo Órdenes (S7) + patrón Chip Eyebrow + Top-Accent (§9.17).

**Ventaja vs S7:** el data layer ya existe (WO-01/WO-02 implementados: schema Prisma, `deliveryState.ts`, eligibility queries, `createDelivery`, schemas Zod de todas las mutaciones). Fase B es mayormente UI + server actions de lifecycle.

## Pantallas del módulo

| Pantalla | Ruta                              | Anchors                                                                         | Spec                            |
| -------- | --------------------------------- | ------------------------------------------------------------------------------- | ------------------------------- |
| Lista    | `/deliveries`                     | `#deliveries`, `#s9-deliveries-list-{loading,empty,empty-filtered}`, `…-mobile` | `screens/delivery-list.md`      |
| Detalle  | `/deliveries/[id]`                | `#s9-delivery-detail{,-delivered,-cancelled,-mobile}` + 3 modales + 2 sheets    | `screens/delivery-detail.md`    |
| Crear    | `/deliveries/new[?sourceOrderId]` | `#delivery-create`, `#s9-delivery-create-{standalone,empty,mobile}`             | `screens/delivery-create.md`    |
| Editar   | `/deliveries/[id]/edit`           | `#s9-delivery-edit`                                                             | `screens/delivery-create.md` §7 |

## Funcionalidades preservadas (mapeadas al FRD-08)

Todos los FR del FRD-08 quedan cubiertos por el demo: creación (FR-08-04..11, 15..20, 34), lista (FR-08-28..33), detalle + nota (FR-08-25, 26, 27), lifecycle (FR-08-13, 14, 21, 22, 23, 24, 25) y las BR-08-01..07. Mapping detallado por pantalla en cada spec.

**Verificación clave:** el detalle NO tiene card Historial — BR-08-05 lo excluye del MVP (diferencia deliberada con order-detail).

## Decisiones de diseño cerradas en Fase A

| ID    | Decisión                              | Detalle                                                                                                                                                                                                                      |
| ----- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S9-D1 | Hero del detalle = ventana de llegada | El dato protagonista de una entrega es **cuándo llega**, no un monto. Rango ETA grande + progress temporal + costo como caption. DELIVERED/CANCELLED usan uppercase status (paridad paid-in-full S7).                        |
| S9-D2 | Eyebrow del hero                      | "Tu entrega · N productos" (extensión del vocabulario congelado "Tu pedido · USD").                                                                                                                                          |
| S9-D3 | Reabrir sin modal                     | Reabrir no es destructiva → ejecuta directo con toast neutral-undo (ADR 0001 D4). Marcar llegada / Cancelar / Eliminar sí llevan modal (la primera por el input de fecha, las otras por confirmación).                       |
| S9-D4 | Tienda fija en edición                | La tienda no se cambia en edit (los productos dependen de ella); el escape es eliminar y recrear. Helper explícito en pantalla.                                                                                              |
| S9-D5 | Atajo sin kbd-chip en CTA             | Feedback humano R2: el CTA de submit va limpio; el atajo como texto plano "o presiona ⌘ Enter" + card Atajos. Aplica a create y edit. **Candidato a regla cross-app en Fase B** (order-create aún usa kbd-chip en el botón). |
| S9-D6 | Grupos de otros pedidos expandidos    | En from-order, los pedidos adicionales elegibles se muestran expandidos y desmarcados (no colapsados) para que "sumar de otros pedidos" sea descubrible.                                                                     |
| S9-D7 | Profundidad mobile acotada            | 5 pantallas mobile core. Sin variantes mobile de delivered/cancelled, filter full-sheet ni edit mobile — derivan de los patrones S7 si Fase B las necesita.                                                                  |
| S9-D8 | View-transition                       | `view-transition-name: dlv-{humanId}` fila/card → hero (extensión de la convención de orders).                                                                                                                               |

## Componentes propios del módulo (candidatos React, Fase B)

| Candidato                                     | Base demo                               | Notas                                                                                                                                   |
| --------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `DeliveryListRow` / `DeliveryCard` (mobile)   | `.order-row` / `.s7-mob-card` adaptados | Evaluar promoción de los primitives de lista de orders a `share/` antes de duplicar (regla project-structure).                          |
| `DeliveryHero`                                | `.detail-hero` + S9-D1                  | 3 variantes por estado.                                                                                                                 |
| `DeliverySourceOrderGroup`                    | label mono "DESDE ORD-…" + item-rows    | Para el detalle (agrupado). El selector del form ya tiene `product-group` en `DeliveryCreateForm`.                                      |
| `MarkDeliveredModal`                          | `#s9-delivery-mark-delivered-modal`     | Adaptive M06, tone success (token CSS nuevo `.m01b-icon-circle.tone-success` ya en demo).                                               |
| `DeliveryCancelModal` / `DeliveryDeleteModal` | anchors S9                              | Delete con type-to-confirm (paridad `OrderCancelModal`/delete S7).                                                                      |
| `DeliveryActionsSheet`                        | `#s9-delivery-actions-sheet-mobile`     | Overflow del sticky bar (ADR 0011).                                                                                                     |
| Aside de detalle                              | Resumen/Acciones/Nota                   | Reusar `AsideSummary`/patrones del `[id]/_components` de orders. Nota privada: mismo componente con autosave debounce de orders/stores. |

## Inventario core consumido

`Modal` adaptive (M06) · `FilterDrawer` + `FilterTriggerButton` (M05) · `StatusChip` · `StoreAvatar` · `MonoCode` · `Eyebrow variant="chip"` + `SectionCard topAccent` (§9.17) · `DateRangePicker` + `MobilePicker` (S7-A.9) · `WizardAccordion`/section-card-wizard · toast neutral-undo · skeletons.

## Handoff a Fase B

### Pre-requisitos (todos cerrados)

1. ✅ Demo aprobado por humano (2026-06-12, round 2).
2. ✅ Data layer WO-01/WO-02 implementado y commiteado (schema, `deliveryState.ts`, eligibility queries, `createDelivery`, Zod schemas de create/edit/markDelivered/reopen/cancel/delete/note).
3. ✅ Specs spec-complete (list / detail / create&edit).
4. ✅ Sin cambios de modelo de datos requeridos.

### Partes sugeridas (secuenciales, paridad S7 Fase B)

| Parte                       | Scope                                                                                                                                                                                                       | Referencia           |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| **1 · Lista**               | Reemplazar placeholder `/deliveries` con lista + filtros + sort + estados (loading/empty/empty-filtered) + mobile cards.                                                                                    | `delivery-list.md`   |
| **2 · Detalle + lifecycle** | `/deliveries/[id]`: hero 3 variantes, productos agrupados, aside, nota autosave, 4 server actions de lifecycle (markDelivered/reopen/cancel/delete) + modales adaptive + sticky bar mobile + actions sheet. | `delivery-detail.md` |
| **3 · Crear + editar**      | Rediseñar `DeliveryCreateForm` al wizard de la spec (2 entry points + empty elegibilidad + mobile) + modo edit con resumen de cambios.                                                                      | `delivery-create.md` |

### Archivos React a crear / modificar (mapa inicial)

| Archivo                                                                    | Acción                                                                                    |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/app/[locale]/(app)/deliveries/page.tsx`                               | Reemplazar placeholder por lista (Server Component + parse de filtros en URL)             |
| `src/app/[locale]/(app)/deliveries/_components/`                           | `DeliveryListContent`, `DeliveryListFilters`, `DeliveryListRow`, skeleton, empties        |
| `src/app/[locale]/(app)/deliveries/[id]/page.tsx`                          | Reemplazar stub por detalle completo                                                      |
| `src/app/[locale]/(app)/deliveries/[id]/_components/`                      | Hero, grupos de productos, aside, modales, sticky bar, actions sheet                      |
| `src/app/[locale]/(app)/deliveries/[id]/_actions/`                         | `deliveryLifecycleActions.ts` (markDelivered/reopen/cancel/delete), `saveDeliveryNote.ts` |
| `src/app/[locale]/(app)/deliveries/[id]/edit/page.tsx`                     | Nueva ruta de edición                                                                     |
| `src/app/[locale]/(app)/deliveries/new/_components/DeliveryCreateForm.tsx` | Rediseño al wizard spec (mode dispatcher create/edit)                                     |
| `src/queries/deliveries*.ts`                                               | `getDeliveriesForList`, `getDeliveryById` (extender lo de WO-01)                          |
| `src/i18n/locales/{es,en}/deliveries.json`                                 | Keys nuevas de lista/detalle/modales/edit                                                 |

### Validación obligatoria al cerrar Fase B

PLAYBOOK §6 + §9.17 + `validation-checklist.mdc`. Mínimo: `npm run test` + `type-check` + `lint` + `validate-build`; `npm run test:e2e` para el flow crear-entrega-desde-pedido y marcar-llegada (workflows críticos; extender `e2e/deliveries.spec.ts`); verificación visual de los 19 anchors en light + dark + 390px; optimistic UI en todas las mutaciones (modales cierran sincrónico); re-derivación de `OrderStatus` verificada contra un pedido real.

## Propuestas pendientes (no bloquean Fase B)

| ID      | Propuesta                                                                                                              | Estado                                                                                                                                                                                                                                                         |
| ------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-S9-01 | FRD-08 alignment post-Fase B (sort default, presets ETA, copy de empties, S9-D1..D8) — entra en el delta audit Round 2 | ⏳ sesión dedicada                                                                                                                                                                                                                                             |
| P-S9-02 | Unificar S9-D5 (atajo como texto, sin kbd-chip en CTA) hacia order-create                                              | ⏳ pendiente de decisión humana (deliveries ya lo implementa; order-create sigue con kbd-chip)                                                                                                                                                                 |
| P-S9-03 | Promoción de primitives de lista (row/card/toolbar) de orders/\_components a share/                                    | ✅ resuelto en Fase B Parte 1: paginación promovida a `modules/ListPagination` (orders migrado) + `localDate` a `src/lib/`; tabla/cards quedan route-local (columnas divergen — Costo/Llegada vs Total/% Pago — y un genérico quedaría lleno de condicionales) |
