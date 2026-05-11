---
title: Módulo Orders — S7
session: 07
phase: A
status: spec-complete
last_updated: 2026-05-10
screens:
  - docs/redesign/screens/order-list.md
  - docs/redesign/screens/order-detail.md
  - docs/redesign/screens/order-create.md
  - docs/redesign/screens/order-edit.md
frd: docs/product/prd-01-collector-mvp/frd-05-order-payment-shipment/frd-05-order-payment-shipment.md
blueprint: docs/product/prd-01-collector-mvp/frd-05-order-payment-shipment/bp-02-order-workspace-and-list-experience/bp-02-order-workspace-and-list-experience.md
---

# Módulo Orders — S7

## Resumen ejecutivo

Este documento es el doc maestro de la Fase A del módulo Orders (S7). Los screen specs en `docs/redesign/screens/order-*.md` describen el contrato funcional por pantalla. Este doc define pantallas, funcionalidades preservadas del FRD, cambios visuales aprobados, propuestas pendientes de aprobación, componentes propios del módulo, y el Handoff completo a Fase B.

**Demo de referencia:** `docs/redesign/_notes/demo-screens.html` — anchors `#s7-orders-*`, `#s7-order-detail-*`, `#s7-order-create-*`, `#s7-order-edit`, `#s7-orders-list-fx-banner`, `#s7-fx-reconciliation-modal`.

**Specs completos (todos spec-complete):**

| Spec                      | Líneas | Fecha      |
| ------------------------- | ------ | ---------- |
| `screens/order-list.md`   | 433    | 2026-05-10 |
| `screens/order-detail.md` | 507    | 2026-05-10 |
| `screens/order-create.md` | 512    | 2026-05-10 |
| `screens/order-edit.md`   | 472    | 2026-05-10 |

---

## Pantallas del módulo

| Screen spec               | Anchors canónicos del demo                                                                                                                                                                                                                          | Descripción                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `screens/order-list.md`   | `#s7-orders-list-loading`, `#s7-orders-list-default`, `#s7-orders-list-empty-initial`, `#s7-orders-list-empty-filtered`, `#s7-orders-list-mobile`                                                                                                   | Lista privada de pedidos con toolbar, filtros, FX banner, expand de ítems, paginación |
| `screens/order-detail.md` | `#s7-order-detail-active`, `#s7-order-detail-cancelled`, `#s7-order-detail-completed-unpaid`, `#s7-order-detail-overdue`, `#s7-order-detail-delete-modal`, `#s7-order-detail-cancel-modal`, `#s7-order-detail-pay-modal`, `#s7-order-detail-mobile` | Detalle de pedido multi-estado: 2 columnas desktop (main + aside sticky)              |
| `screens/order-create.md` | `#s7-order-create-step-1`, `#s7-order-create-step-2`, `#s7-order-create-step-3`, `#s7-order-create-empty-stores`, `#s7-order-create-discrepancy-modal`                                                                                              | Wizard de creación — 3 pasos canónicos                                                |
| `screens/order-edit.md`   | `#s7-order-edit`                                                                                                                                                                                                                                    | Edición all-open (L020): sin stepper, todas las secciones siempre expandidas          |

> **Anchors obsoletos / NO canónicos:** `#s7-order-create-step-1-from-store`, `#s7-order-create-step-3-validation`, `#s7-order-create-step-4`, `#s7-order-create-step-5` pertenecen al wizard de 5 pasos de una iteración supersedida. No usar como referencia de implementación.

---

## Funcionalidades preservadas (mapeadas al FRD)

Las siguientes funcionalidades están representadas en el demo y deben implementarse en Fase B sin alteración funcional. Las que tienen **nota de cambio** están documentadas en la sección §Cambios de comportamiento.

| FR / BR     | Descripción                                                                                      | Pantalla(s)                                          | Nota                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `FR-05-01`  | `Order` como entidad principal de la workspace del coleccionista                                 | todos                                                | —                                                                                         |
| `FR-05-02`  | Un pedido pertenece a exactamente una tienda                                                     | `order-create`, `order-detail`                       | —                                                                                         |
| `FR-05-03`  | Identificador human-readable: `ORD-YYYYMMDD-NN`                                                  | todos                                                | —                                                                                         |
| `FR-05-04`  | Fecha de orden requerida, prefill = fecha actual al crear                                        | `order-create` §6                                    | —                                                                                         |
| `FR-05-05`  | Rango de entrega estimada (from/to) opcional                                                     | `order-create`, `order-edit`                         | —                                                                                         |
| `FR-05-06`  | Un pedido puede tener uno o más ítems                                                            | `order-create` paso 2                                | —                                                                                         |
| `FR-05-07`  | Cada ítem almacena nombre y cantidad                                                             | `order-create` §6.5                                  | —                                                                                         |
| `FR-05-08`  | Cantidad por ítem por defecto = 1, requerida                                                     | `order-create` §6.5                                  | —                                                                                         |
| `FR-05-08a` | Regla unidad atómica: hint cuando qty > 1                                                        | `order-create` §6.5                                  | Hint existe en i18n (`form.itemsSplitDeliveryHint`); verificar que se renderice en paso 2 |
| `FR-05-09`  | Precio unitario por ítem: opcional                                                               | `order-create` §6.5                                  | —                                                                                         |
| `FR-05-10`  | Tipo de producto por ítem: opcional, del catálogo compartido                                     | `order-create` §6.5                                  | —                                                                                         |
| `FR-05-11`  | Total del pedido: requerido                                                                      | `order-create` §7                                    | —                                                                                         |
| `FR-05-12`  | Total derivado = Σ qty × precio de ítems con precio                                              | `order-create` §6.6                                  | —                                                                                         |
| `FR-05-13`  | Modal discrepancia cuando Σ ≠ total ingresado                                                    | `order-create` §6.9                                  | ⚠️ Cambio de comportamiento — ver §Cambios de comportamiento                              |
| `FR-05-14`  | Moneda del pedido: seleccionada por el usuario                                                   | `order-create` paso 1                                | —                                                                                         |
| `FR-05-15`  | Moneda por defecto = moneda base del usuario                                                     | `order-create` §6.3                                  | —                                                                                         |
| `FR-05-16`  | Tipo de cambio requerido cuando moneda ≠ base                                                    | `order-create` §6.7, `order-edit` §6.7               | —                                                                                         |
| `FR-05-17`  | Añadir y eliminar registros de pago                                                              | `order-detail` §6.2                                  | —                                                                                         |
| `FR-05-18`  | Pago: monto + fecha                                                                              | `order-detail` §6.2                                  | —                                                                                         |
| `FR-05-19`  | Pago no puede superar el saldo pendiente                                                         | `order-detail` §7                                    | —                                                                                         |
| `FR-05-20`  | Vista detalle: pagado / pendiente / porcentaje                                                   | `order-detail` §1 (Pagos card)                       | —                                                                                         |
| `FR-05-21`  | Nota privada inline editable; guardar vacío = limpiar                                            | `order-detail` §6.4                                  | —                                                                                         |
| `FR-05-22`  | Historial automático de eventos, solo lectura                                                    | `order-detail` (historial, read-only)                | —                                                                                         |
| `FR-05-23`  | Acción primaria "Crear entrega" + affordance secundaria                                          | `order-detail` §6, Acciones card                     | —                                                                                         |
| `FR-05-24`  | Eliminar bloqueado cuando ítem está en entrega activa                                            | `order-detail` §6.6                                  | —                                                                                         |
| `FR-05-25`  | Cancelar bloqueado cuando ítem está en entrega activa                                            | `order-detail` §6.5                                  | —                                                                                         |
| `FR-05-26`  | Filtros de lista: estado, pago, tienda, fecha, tipo de cambio                                    | `order-list` FilterDrawer                            | —                                                                                         |
| `FR-05-27`  | Filtros persisten en URL + chips removibles                                                      | `order-list` §6                                      | —                                                                                         |
| `FR-05-28`  | Ordenar por fecha más antigua por defecto                                                        | `order-list` §6.2                                    | ⚠️ Cambio de comportamiento — ver §Cambios de comportamiento                              |
| `FR-05-29`  | Card de lista muestra: tienda, fecha, estado, entrega, total, progreso pago                      | `order-list` (OrderCard)                             | —                                                                                         |
| `FR-05-30`  | Señal visual de pedido vencido (overdue)                                                         | `order-list` (estado overdue), `order-detail`        | —                                                                                         |
| `FR-05-31`  | Card expande para mostrar ítems                                                                  | `order-list` §6.4 (chevron)                          | —                                                                                         |
| `FR-05-32`  | Estado del pedido es derivado, no editado directamente                                           | `BR-05-03`                                           | —                                                                                         |
| `FR-05-33`  | Estado de pago distinto al estado de fulfillment                                                 | `order-detail`                                       | —                                                                                         |
| `FR-05-34`  | Todo entregado → `COMPLETED` aunque tenga saldo pendiente                                        | `order-detail`                                       | —                                                                                         |
| `FR-05-35`  | `COMPLETED` con saldo pendiente muestra señal "impago"                                           | `order-list`, `order-detail`                         | —                                                                                         |
| `FR-05-36`  | Filtro "Solo con actualización de moneda pendiente"                                              | `order-list` FilterDrawer (FX switch)                | —                                                                                         |
| `FR-05-37`  | Elegibilidad FX: pedidos desde inicio del mes actual                                             | `order-list` FX banner                               | —                                                                                         |
| `FR-05-38`  | Reconciliación FX en masa (agrupada por par de monedas)                                          | `order-list` FX banner CTA → `FxReconciliationModal` | Aprobado en S7-A. Demo: `#s7-fx-reconciliation-modal`                                     |
| `BR-05-10`  | Pagos pueden eliminarse; resumen recalcula inmediatamente                                        | `order-detail` §6.3                                  | Actualización optimista + undo toast 5s                                                   |
| `BR-05-11`  | Cambio de tienda solo si pedido `OPEN` sin entregas                                              | `order-edit` §6.2, `order-edit` §12 nota 8           | —                                                                                         |
| `BR-05-15`  | Cancelar elimina `OrderPayment` records                                                          | `order-detail` §6.5, modal cancel                    | —                                                                                         |
| `BR-05-16`  | Cancel y Delete requieren modal de confirmación que nombra el pedido + menciona pagos si existen | `order-detail` §5.4, §5.5                            | —                                                                                         |
| `BR-05-17`  | `CANCELLED` puede volver a `OPEN` sin precondiciones; pagos no se restauran                      | `order-detail` §6.5                                  | —                                                                                         |

---

## Cambios de comportamiento respecto al FRD

Los siguientes cambios de comportamiento se introducen en el redesign S7. Todos están documentados con tabla explícita en el spec de cada pantalla.

| ID    | FR afectado | Comportamiento FRD                                                              | Comportamiento redesign                                                           | Razón                                                                                            | Spec donde se documenta |
| ----- | ----------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------- |
| CB-01 | `FR-05-28`  | Ordenar por fecha más antigua por defecto                                       | Ordenar por más recientes por defecto                                             | Los coleccionistas priorizan gestionar pedidos recientes; los más antiguos suelen estar cerrados | `order-list.md §6.2`    |
| CB-02 | `FR-05-13`  | Modal discrepancia con 3 opciones: mantener ingresado / usar calculado / volver | Modal discrepancia con 2 opciones: "Volver y corregir" / "Guardar de todos modos" | El total ingresado es siempre autoritativo; ofrecer reemplazarlo automáticamente crea confusión  | `order-create.md §6.9`  |

---

## Cambios visuales y de UX aplicados en Fase A (aprobados)

Los siguientes cambios están confirmados e implementables en Fase B sin aprobación adicional:

### Lista de pedidos (`order-list`)

1. **Tabla 7 columnas con grid canónico** (L059, L060, L063). Columnas: Avatar → Pedido/Tienda → Productos → Estado → Total → % Pago → Chevron. Headers centrados excepto columna principal. Chevron como columna de grid en desktop.
2. **Barra de progreso alineada izquierda + % con ancho fijo** (L060). `justify-content: flex-start`; porcentaje con `min-width: 3.2ch`. Elimina desplazamiento visual al cambiar de 0% a 100%.
3. **Ícono por tipo de producto en ítems expandidos** (L061). Mapping desde `getStoreProductTypeIcon`.
4. **Paginación canónica** (L062). Mobile: "Cargar más". Desktop: numérica con flechas. Igual que Stores.
5. **`FilterTriggerButton` M05** con badge de filtros activos y estado active tintado.
6. **FilterDrawer — Tienda como tag-autocomplete** (L064, §9.12). Input de búsqueda + tags dismissibles. Sin pills preset.
7. **FilterDrawer — Tipo de cambio como Switch** (L064). `filter-switch-row` + `button.switch`. No checkbox.
8. **FX banner inline** con `role="status"` + `aria-live="polite"` + CTA "Actualizar ahora". _(P-S7-01 define el flujo de la actualización — pendiente aprobación.)_
9. **Modales ADR 0008** (`modal-canonical-pattern.mdc`).
10. **Sort default "Más recientes"** (CB-01). Ver §Cambios de comportamiento.

### Detalle de pedido (`order-detail`)

11. **Layout `detail-grid` 2 columnas desktop** (main column: detail-hero + subcards; aside sticky: Pagos + Acciones + Nota privada).
12. **`detail-hero` card** como heading del detalle (reemplaza `page-heading`). Muestra: breadcrumb back-link, eyebrow, `h1` con nombre de tienda, fecha, status chips, FX badge.
13. **`back-link` patrón minimalista** (`← Pedidos`). No usar `BackNavLink` pill en esta pantalla.
14. **"Anotar pago" inline expand** dentro de la card Pagos — no abre modal separado. (Decisión D6.)
15. **Nota privada: autosave on-blur** con throttle 1.5s, indicador "Guardada hace Ns". No es optimista (espera confirmación del servidor). (Decisión D7.)
16. **Reactivar pedido sin modal de confirmación** — acción reversible, disparo directo. (Decisión D8.)
17. **Delete pago — undo toast 5s** con acción neutral `Z`. Update optimista inmediato.
18. **View transition** `view-transition-name: order-{id}` en `order-row` (lista) y `detail-hero` (detalle). Usa DB id, no humanReadableId.
19. **Modal cancelar — campo motivo textarea opcional** (se guarda como `cancellationReason`).

### Crear / editar pedido (`order-create`, `order-edit`)

20. **Wizard de creación — 3 pasos** (no 5): Datos → Productos y costos → Confirmar. Stepper con gating hacia adelante; navegación libre hacia atrás.
21. **Edición all-open — L020** (sin stepper). Todas las secciones siempre expandidas. Tienda y Moneda locked con icono `lock`. (Decisión D9.)
22. **Discrepancy modal — 2 opciones** (no 3): "Volver y corregir" + "Guardar de todos modos". (CB-02 / Decisión D10.)
23. **"Usar este total" button** bajo la tabla de ítems en paso 2 y en edición. Rellena el campo Costo total con la suma derivada.
24. **Frankfurter API "Hoy"** en tipo de cambio. Llamada desde cliente, sin API key, timeout 5s.
25. **Sidebar Resumen reactivo** en creación y edición. Se actualiza en tiempo real conforme el usuario completa campos.

---

## Propuestas de cambio funcional

Las propuestas marcadas ⏳ requieren decisión explícita antes de implementar en Fase B.

| ID      | Propuesta                                                                                                                                                                                                                                                                                                   | Origen                     | Estado                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-S7-01 | FX banner CTA: ¿actualización masiva (FxReconciliationModal) o individual?                                                                                                                                                                                                                                  | Demo A.2                   | ✅ cerrado — masiva (WO-07). Demo: `#s7-fx-reconciliation-modal`                                                                                                                                                                                                                                                                                                                                                          |
| P-S7-02 | Ordenamiento de lista: ¿permitir ordenar por Total o Estado además de fecha? El demo muestra 5 opciones en el select: Más recientes / Más antiguas / Tienda A–Z / % Pago: menor / Total: mayor. Todas las opciones excepto "Más recientes" y "Más antiguas" no tienen cobertura en `getOrdersList` todavía. | Demo A.2                   | ✅ cerrado (2026-05-10) — implementar las 5 opciones en Fase B. Extender `OrdersListParams` con sort enum (`recent` \| `oldest` \| `store-asc` \| `payment-asc` \| `total-desc`) y agregar `orderBy` correspondientes en `getOrdersList`. Tienda A–Z requiere `orderBy: { store: { name: "asc" } }`. % Pago: menor requiere campo derivado o computación post-query. Total: mayor usa `orderBy: { totalAmount: "desc" }`. |
| P-S7-03 | **`pendingFxCount` gap:** `getOrdersList` no devuelve este campo.                                                                                                                                                                                                                                           | `order-list.md §12 nota 3` | ✅ cerrado — añadir campo a `getOrdersList` vía `Promise.all` con `prisma.order.count({ where: { userId, needsExchangeRateUpdate: true } })`                                                                                                                                                                                                                                                                              |
| P-S7-04 | **Código de pedido — formato:** `ORD-YYYYMMDD-NN` vs `PT-XXXXXX`.                                                                                                                                                                                                                                           | Session memory             | ✅ cerrado — `ORD-YYYYMMDD-NN` es el formato definitivo (alineado con `FR-05-03` y producción)                                                                                                                                                                                                                                                                                                                            |

---

## Decisiones cerradas durante la iteración S7-A

| #   | Decisión                                                                       | Justificación                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Chevron de expand = columna de grid en desktop (no `position: absolute`)       | `absolute; top: 50%` se desplaza al crecer la fila; `static; align-self: start` elimina el problema (L059)                                                                                                   |
| D2  | Estado antes de Total en columnas de la tabla                                  | El chip de estado contextualiza el monto; juntos forman una unidad semántica (L060)                                                                                                                          |
| D3  | Tienda en FilterDrawer = tag-autocomplete, no pills preset                     | Las tiendas son datos dinámicos del usuario; pills hardcodeadas no escalan (L064, §9.12)                                                                                                                     |
| D4  | Tipo de cambio en FilterDrawer = Switch, no checkbox                           | Regla general: boolean UI → toggle; checkbox reservado para listas de selección múltiple (L064)                                                                                                              |
| D5  | % Pago: barra alineada izquierda, número con `min-width: 3.2ch`                | Sin `min-width`, valores distintos (0%–100%) desplazan el inicio de la barra (L060)                                                                                                                          |
| D6  | "Anotar pago" se expande inline dentro de la card Pagos, no abre modal         | El inline expand es más fluido y mantiene el contexto del detalle; el modal añadiría una capa innecesaria                                                                                                    |
| D7  | Nota privada: autosave on-blur con throttle 1.5s, NO optimista                 | La nota es texto largo; el riesgo de mostrar contenido incorrecto si el servidor falla supera el beneficio de feedback inmediato                                                                             |
| D8  | Reactivar pedido sin modal de confirmación                                     | Reactivar es reversible (puede cancelarse de nuevo); añadir un modal a una acción no-destructiva añade fricción innecesaria                                                                                  |
| D9  | Edición all-open (L020): sin stepper, todas las secciones expandidas           | En edición el usuario ya conoce el pedido; el stepper es apropiado para la creación progresiva, no para editar campos conocidos                                                                              |
| D10 | Modal discrepancia 2 opciones ("Volver y corregir" / "Guardar de todos modos") | El campo Costo total es siempre el valor autoritativo del pedido; la opción "usar el calculado automáticamente" puede generar confusión cuando el total incluye envío o impuestos no reflejados en los ítems |

---

## Componentes propios del módulo

Componentes específicos del módulo Orders. Fase B los crea en `src/app/[locale]/(app)/orders/_components/`.

### Componentes de lista (`order-list`)

| Componente              | Descripción                                                                                        | Archivo esperado                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `OrderCard`             | Fila de tabla expandible: avatar tienda + 7 cols + chevron + ítems colapsables                     | `_components/OrderCard.tsx` _(ya existe)_              |
| `OrderStatusBadge`      | Chip de estado del pedido con colores semánticos (info, warning, success, neutral)                 | `_components/share/OrderStatusBadge.tsx` _(ya existe)_ |
| `FxBanner`              | Banner inline de alerta FX con copy WO-07 + botón `tonal` "Actualizar tipos de cambio"             | `_components/FxBanner.tsx`                             |
| `FxReconciliationModal` | Modal masivo de reconciliación: grupos por par de monedas, inputs numéricos, defer por campo vacío | `_components/FxReconciliationModal.tsx`                |
| `OrderListFilters`      | FilterDrawer del módulo: Estado, Pago, Tienda (tag-autocomplete), Fecha, FX switch                 | `_components/OrderListFilters.tsx` _(ya existe)_       |
| `OrderListFilterChips`  | Chips removibles de filtros activos bajo la toolbar                                                | `_components/OrderListFilterChips.tsx` _(ya existe)_   |
| `OrderUnpaidPill`       | Pill "Impago" visible en lista y detalle cuando COMPLETED con saldo pendiente                      | `_components/share/OrderUnpaidPill.tsx` _(ya existe)_  |

### Componentes de detalle (`order-detail`)

| Componente         | Descripción                                                                                | Archivo esperado                        |
| ------------------ | ------------------------------------------------------------------------------------------ | --------------------------------------- |
| `DetailHero`       | Card hero del detalle: back-link, eyebrow, h1 tienda, fecha, status chips, FX badge        | `[id]/_components/DetailHero.tsx`       |
| `OrderItemsCard`   | Sección ítems del detalle: lista de ítems con icono tipo + nombre + estado + qty + precio  | `[id]/_components/OrderItemsCard.tsx`   |
| `PaymentsCard`     | Sección pagos: resumen pagado/pendiente/%, barra de progreso, lista de pagos + form inline | `[id]/_components/PaymentsCard.tsx`     |
| `ActionsCard`      | Tarjeta aside sticky de acciones: Editar, Cancelar, Eliminar, Reactivar (según estado)     | `[id]/_components/ActionsCard.tsx`      |
| `PrivateNoteCard`  | Textarea de nota privada con autosave on-blur + indicador de guardado                      | `[id]/_components/PrivateNoteCard.tsx`  |
| `CancelOrderModal` | Modal confirmación cancelar (warning ADR 0008 B) con campo motivo opcional                 | `[id]/_components/CancelOrderModal.tsx` |
| `DeleteOrderModal` | Modal confirmación eliminar (destructive ADR 0008 B)                                       | `[id]/_components/DeleteOrderModal.tsx` |

### Componentes compartidos entre módulos (share/)

| Componente                | Descripción                                              | Archivo                                                                                  |
| ------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `OrderForm`               | Contenedor wizard create/edit con `useActionState`       | `_components/share/OrderForm.tsx` _(ya existe)_                                          |
| `OrderItemsGrid`          | Tabla spreadsheet de ítems con teclado, drag, calc total | `_components/share/OrderItemsGrid.tsx` _(ya existe, 538 líneas)_                         |
| `OrderStoreSelect`        | Combobox de tienda con store-avatar                      | `_components/share/OrderStoreSelect.tsx` _(ya existe)_                                   |
| `OrderCurrencySelect`     | Select de moneda con nombre localizado                   | `_components/share/OrderCurrencySelect.tsx` _(ya existe)_                                |
| `OrderEmptyState`         | Empty state "sin tiendas" gate en create                 | `_components/share/OrderEmptyState.tsx` _(ya existe)_                                    |
| `DiscrepancyModal`        | Modal warning 2-opción discrepancia total                | `_components/share/DiscrepancyModal.tsx` _(ya existe — refactor a 2 opciones en Fase B)_ |
| `OrderItemsShortcutsHelp` | Hint de atajos de teclado en la tabla                    | `_components/share/OrderItemsShortcutsHelp.tsx` _(ya existe)_                            |

### Componentes nuevos (no existen todavía)

| Componente        | Descripción                                          | Nota                                               |
| ----------------- | ---------------------------------------------------- | -------------------------------------------------- |
| `StepperBar`      | Indicador de 3 pasos para el wizard create           | Crear en `src/components/modules/` (reusable)      |
| `DateRangePicker` | Trigger button + calendar popup para rango de fechas | Evaluar `react-day-picker` o implementación propia |

---

## Inventario de componentes core consumidos

| Componente                  | Propósito en el módulo                                       | Pantallas                                    |
| --------------------------- | ------------------------------------------------------------ | -------------------------------------------- |
| `AppShell`                  | Contenedor base: sidebar + content                           | todos                                        |
| `Header` (topbar)           | Topbar sticky 48px con breadcrumb + título                   | todos                                        |
| `Sidebar`                   | Navegación lateral izquierda                                 | todos                                        |
| `MobileTabBar`              | Navegación inferior mobile                                   | todos                                        |
| `FilterTriggerButton` (M05) | Botón "Filtrar" con badge de filtros activos, estado tintado | `order-list`                                 |
| `FilterDrawer`              | Panel de filtros derecho / Sheet en mobile                   | `order-list`                                 |
| `Switch`                    | Toggle booleano (filtro FX en FilterDrawer)                  | `order-list`                                 |
| `Pagination`                | Numérica desktop + "Cargar más" mobile                       | `order-list`                                 |
| `EmptyState`                | Estado vacío con mascota (lista sin pedidos)                 | `order-list`                                 |
| `MascotBubble`              | Mascota en estados vacíos                                    | `order-list`                                 |
| `Modal` (ADR 0008 B)        | Confirm dialogs destructive y warning                        | `order-detail`, `order-create`               |
| `Toast`                     | Feedback post-acciones (crear, editar, errores)              | `order-create`, `order-edit`, `order-detail` |
| `ProgressBar`               | Barra de progreso de pago (% pagado)                         | `order-list`, `order-detail`                 |
| `Button`                    | CTAs primarios, secundarios, ghost                           | todos                                        |
| `Input`                     | Search toolbar, inputs en forms y FilterDrawer               | todos                                        |
| `FAB`                       | Botón flotante "+" en mobile (lista)                         | `order-list` mobile                          |
| `back-link` (patrón CSS)    | Link `← Texto` minimalista con arrow-left 12px               | `order-create`, `order-edit`, `order-detail` |
| `page-heading` (patrón CSS) | `h1` + meta text bajo el topbar                              | `order-list`, `order-create`, `order-edit`   |
| `detail-hero` (patrón CSS)  | Card hero del detalle (reemplaza page-heading en detalle)    | `order-detail`                               |
| `detail-grid` (patrón CSS)  | Layout 2 columnas desktop (main + aside sticky)              | `order-detail`                               |
| `form-grid` (patrón CSS)    | Layout 2 columnas form (section-cards + sidebar resumen)     | `order-create`, `order-edit`                 |

---

## Handoff a Fase B

### Rutas y páginas (App Router) — ya existentes

```
src/app/[locale]/(app)/orders/
  page.tsx                   ← Lista de pedidos
  new/
    page.tsx                 ← Wizard creación (refactor a 3 pasos)
  [id]/
    page.tsx                 ← Detalle de pedido
    edit/
      page.tsx               ← Edición all-open (refactor a L020)
  _actions/
    orderActions.ts          ← createOrderAction, editOrderAction
    orderLifecycleActions.ts ← cancelOrderAction, deleteOrderAction, reactivateOrderAction
    orderPaymentActions.ts   ← addPaymentAction, deletePaymentAction
    orderNoteActions.ts      ← saveOrderNoteAction
  _components/
    share/                   ← Componentes compartidos entre list/detail/create/edit
```

### Archivos a modificar

| Archivo                                  | Cambio                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `_utils/orderListingParams.ts`           | `ORDER_LIST_PAGE_SIZE`: 20 → 30                                                                                                                                                                                                                                                                                          |
| `lib/data/orders/orderQueries.ts`        | `getOrdersList`: sort default `orderDate: "desc"` (era `"asc"`); agregar `pendingFxCount` vía `Promise.all` con `prisma.order.count({ where: { userId, needsExchangeRateUpdate: true } })`; agregar soporte para 5 opciones de sort (`recent` / `oldest` / `store-asc` / `payment-asc` / `total-desc`) — P-S7-02 cerrado |
| `_components/share/DiscrepancyModal.tsx` | Refactor a 2 opciones (eliminar opción "usar calculado")                                                                                                                                                                                                                                                                 |
| `_components/share/OrderForm.tsx`        | Refactor: wizard 5 pasos → 3 pasos para create; all-open para edit                                                                                                                                                                                                                                                       |
| `i18n/locales/{locale}/orders.json`      | Agregar keys nuevas: `create.step*`, `form.fxTodayButton`, `form.calculatedTotal`, `form.useCalculatedTotal`, `form.fromStoreContext`, `form.storeLockedHelper`, `form.currencyLockedHelper`, `discrepancyModal.saveAnyway`, `edit.sectionDatosTitle`, etc.                                                              |
| `i18n/locales/{locale}/orders.json`      | Deprecar keys: `discrepancyModal.keepEntered`, `discrepancyModal.useCalculated`                                                                                                                                                                                                                                          |

### Archivos a crear (nuevos)

| Archivo                                        | Descripción                                                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `src/components/modules/StepperBar.tsx`        | Indicador de pasos wizard (reutilizable)                                                                      |
| Componente `DateRangePicker`                   | Trigger + calendar popup para rango de fechas; evaluar si en `src/components/modules/` o `_components/share/` |
| `orders/[id]/_components/DetailHero.tsx`       | Hero card del detalle                                                                                         |
| `orders/[id]/_components/OrderItemsCard.tsx`   | Sección ítems del detalle                                                                                     |
| `orders/[id]/_components/PaymentsCard.tsx`     | Pagos card con inline expand                                                                                  |
| `orders/[id]/_components/ActionsCard.tsx`      | Aside acciones sticky                                                                                         |
| `orders/[id]/_components/PrivateNoteCard.tsx`  | Textarea nota con autosave                                                                                    |
| `orders/[id]/_components/CancelOrderModal.tsx` | Modal cancelar con motivo                                                                                     |
| `orders/[id]/_components/DeleteOrderModal.tsx` | Modal eliminar                                                                                                |
| `orders/_components/FxBanner.tsx`              | Banner FX inline en lista (copy WO-07, botón `tonal`, ícono `--accent`). Demo: `#s7-orders-list-fx-banner`    |
| `orders/_components/FxReconciliationModal.tsx` | Modal masivo FX: grupos por par de monedas + inputs + defer por vacío. Demo: `#s7-fx-reconciliation-modal`    |
| `src/lib/fx/frankfurter.ts`                    | Wrapper cliente para Frankfurter API (FX "Hoy")                                                               |

### i18n keys a revisar

Ver tablas §8 completas de cada spec:

- `order-list.md §8` — 35 keys (lista)
- `order-detail.md §8` — keys de detalle, pagos, notas, modales
- `order-create.md §8` — wizard create + discrepancyModal refactor
- `order-edit.md §8` — edit form + campos locked

### Validación esperada al cierre de Fase B

```bash
npm run test
npm run type-check
npm run lint
npm run validate-build
npm run test:e2e   # e2e/orders.spec.ts — crear si no existe, o extender coverage existente
```

---

## Preguntas abiertas al cierre de Fase A

1. ~~**P-S7-01**~~ ✅ _Cerrado_ — FxReconciliationModal masiva (WO-07). Demo: `#s7-fx-reconciliation-modal`.
2. ~~**P-S7-02**~~ ✅ _Cerrado (2026-05-10)_ — Implementar las 5 opciones de sort en Fase B. Extender `OrdersListParams` con sort enum (`recent` | `oldest` | `store-asc` | `payment-asc` | `total-desc`) y agregar `orderBy` correspondientes en `getOrdersList`.
3. ~~**P-S7-03**~~ ✅ _Cerrado_ — `pendingFxCount` añadido a `getOrdersList` vía `Promise.all` con `prisma.order.count`.
4. ~~**P-S7-04**~~ ✅ _Cerrado_ — `ORD-YYYYMMDD-NN` es el formato definitivo en todo el UI.
5. **`ItemDeliveryState.ARRIVED`** — El demo de detalle muestra "Listo en tienda" como estado de ítem. Verificar si existe en el enum `ItemDeliveryState` o si Fase B debe añadirlo. (Ver `order-detail.md §12 nota 2`.)

---

## Cláusula de spec vigente (cross-cutting safety)

El agente de Fase B lee el spec vigente de cada componente core **al momento de implementar**, no asume el spec de hoy. Cualquier mini-sesión cross-cutting que actualice un componente listado en el inventario se aplica automáticamente.

### Mini-sesiones cross-cutting conocidas al cierre de S7 Fase A

| ID   | Componente afectado         | Descripción                                                    | Estado     | Impacto en Fase B                                                                 |
| ---- | --------------------------- | -------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------- |
| M01  | `Modal`                     | Enhancement visual: depth, motion, layered design              | 🟡 abierto | Esperar M01 si aún no cerró antes de implementar los modales del módulo           |
| S6.1 | `FilterDrawer`              | Patrón canónico (secciones, footer, Sheet en mobile)           | 🟡 abierto | Usar spec actualizado de FilterDrawer al iniciar Fase B                           |
| S6.2 | `FilterTriggerButton` (M05) | Componente M05 con active state + badge; ya cerrado            | ✅ cerrado | Usar `FilterTriggerButton` desde `src/components/modules/FilterTriggerButton.tsx` |
| S6.3 | `Pagination`                | Patrón canónico (L062): desktop numérica + mobile "Cargar más" | 🟡 abierto | Leer spec actualizado de Pagination al iniciar Fase B                             |
