---
title: Módulo Orders — S7
session: 07
phase: A (en curso)
status: html-in-progress
last_updated: 2026-05-09
screens:
  - docs/redesign/screens/order-list.md
  - docs/redesign/screens/order-detail.md
  - docs/redesign/screens/order-create.md
frd: docs/product/prd-01-collector-mvp/frd-05-order-payment-shipment/frd-05-order-payment-shipment.md
blueprint: docs/product/prd-01-collector-mvp/frd-05-order-payment-shipment/bp-02-order-workspace-and-list-experience/bp-02-order-workspace-and-list-experience.md
---

# Módulo Orders — S7

## Resumen ejecutivo

Este documento cubre la Fase A del módulo Orders (S7). El demo HTML está en iteración visual (A.2). Los screen specs en `docs/redesign/screens/order-*.md` describen el contrato funcional por pantalla. Este doc maestro define pantallas, funcionalidades preservadas, cambios aplicados en Fase A, propuestas pendientes de aprobación, componentes propios del módulo, y el Handoff a Fase B (pendiente de completar en A.3).

**Demo de referencia:** `docs/redesign/_notes/demo-screens.html` — anchors `#s7-orders-*`, `#s7-order-detail-*`, `#s7-order-create-*`, `#s7-order-edit`.

---

## Pantallas del módulo

| Screen spec               | Anchors del demo                                                                                                                                                                                                                                                                                           | Descripción                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `screens/order-list.md`   | `#s7-orders-list-loading`, `#s7-orders-list-default`, `#s7-orders-list-empty-initial`, `#s7-orders-list-empty-filtered`, `#s7-orders-list-filters-open`, `#s7-orders-list-mobile`                                                                                                                          | Lista privada de pedidos         |
| `screens/order-detail.md` | `#s7-order-detail-active`, `#s7-order-detail-cancelled`, `#s7-order-detail-completed-unpaid`, `#s7-order-detail-overdue`, `#s7-order-detail-partially-paid`, `#s7-order-detail-delete-modal`, `#s7-order-detail-cancel-modal`, `#s7-order-detail-mobile`                                                   | Detalle de pedido (multi-estado) |
| `screens/order-create.md` | `#s7-order-create-step-1`, `#s7-order-create-step-1-from-store`, `#s7-order-create-step-2`, `#s7-order-create-step-3`, `#s7-order-create-step-3-validation`, `#s7-order-create-step-4`, `#s7-order-create-step-5`, `#s7-order-create-empty-stores`, `#s7-order-create-discrepancy-modal`, `#s7-order-edit` | Wizard creación / edición        |

> **Nota:** `docs/redesign/screens/order-detail.md` y `docs/redesign/screens/order-create.md` están pendientes de bootstrap en esta misma sesión A.2. Los anchors listados son la fuente canónica.

---

## Funcionalidades preservadas (mapeadas al FRD)

<!-- PENDING A.3: completar tabla FR/BR desde frd-05-order-payment-shipment.md + bp-02 -->

Las siguientes funcionalidades están representadas en el demo y deben implementarse en Fase B sin alteración funcional:

| FR / BR  | Descripción                                                                                  | Pantalla(s)                          |
| -------- | -------------------------------------------------------------------------------------------- | ------------------------------------ |
| FR-05-xx | Lista de pedidos privada del usuario autenticado, paginada                                   | `order-list`                         |
| FR-05-xx | Búsqueda por nombre de tienda / código de pedido                                             | `order-list` toolbar                 |
| FR-05-xx | Filtros: Estado, Pago, Tienda (tag-autocomplete), Fecha de creación, Tipo de cambio (switch) | `order-list` FilterDrawer            |
| FR-05-xx | Vista expandible de ítems en lista (chevron por fila)                                        | `order-list` filas                   |
| FR-05-xx | FX banner: alerta de tipo de cambio desactualizado con acción directa                        | `order-list` FX banner               |
| FR-05-xx | Estados de pedido: Abierto, Parcialmente en camino, Completo, Cancelado, Atrasado            | `order-list`, `order-detail`         |
| FR-05-xx | Detalle de pedido con ítems, pagos, estados individuales, nota privada                       | `order-detail`                       |
| FR-05-xx | Modales de confirmación: Eliminar pedido, Cancelar pedido                                    | `order-detail` modales               |
| FR-05-xx | Wizard de creación (5 pasos): Tienda → Ítems → Pagos → Envío → Revisión                      | `order-create`                       |
| FR-05-xx | Entrada desde tienda (step-1 pre-seleccionado con tienda)                                    | `#s7-order-create-step-1-from-store` |
| FR-05-xx | Validación de discrepancia de importe en pagos (modal de confirmación)                       | `#s7-order-create-discrepancy-modal` |
| FR-05-xx | Estado vacío sin tiendas al crear pedido                                                     | `#s7-order-create-empty-stores`      |
| FR-05-xx | Edición de pedido existente (wizard en modo edit)                                            | `#s7-order-edit`                     |

---

## Cambios visuales aplicados en Fase A (aprobados)

<!-- PENDING A.3: completar con todos los cambios confirmados por Sergio en A.2 -->

Los siguientes cambios están confirmados por la iteración A.2 y son implementables en Fase B sin aprobación adicional:

1. **Tabla de 7 columnas con grid canónico** (L059, L060, L063). Avatar → Pedido/Tienda → Productos → Estado → Total → % Pago → Chevron. Headers centrados excepto columna principal. Chevron como columna de grid en desktop.
2. **Barra de progreso alineada a la izquierda + % con ancho fijo** (L060). `justify-content: flex-start`; porcentaje con `min-width: 3.2ch`. Evita desplazamiento visual entre 0% y 100%.
3. **Ícono por tipo de producto en ítems expandidos** (L061). Mapping desde `getStoreProductTypeIcon`.
4. **Paginación canónica** (L062). Mobile: "Cargar más". Desktop: numérica con flechas. Igual que stores.
5. **FilterTriggerButton M05** con badge de filtros activos y estado activo tintado.
6. **FilterDrawer — Tienda como tag-autocomplete** (L064, §9.12). Input de búsqueda + tags dismissibles. Sin pills preset.
7. **FilterDrawer — Tipo de cambio como Switch** (L064). `filter-switch-row` + `button.switch`. No checkbox.
8. **FX banner inline** con `role="status"` + `aria-live="polite"` + CTA "Actualizar ahora".
9. **Modales ADR 0008** (`modal-canonical-pattern.mdc`): `#s7-order-detail-delete-modal`, `#s7-order-detail-cancel-modal`, `#s7-order-create-discrepancy-modal`.

---

## Propuestas de cambio funcional (requieren aprobación explícita antes de Fase B)

<!-- PENDING A.3: revisar y completar con Sergio -->

| ID      | Propuesta                                                                                               | Origen   |
| ------- | ------------------------------------------------------------------------------------------------------- | -------- |
| P-S7-01 | FX banner "Actualizar ahora": ¿actualización masiva o una a una? El demo muestra link pero no el flujo. | Demo A.2 |
| P-S7-02 | Ordenamiento de lista: ¿por fecha de creación desc solamente, o permitir ordenar por total / estado?    | Demo A.2 |

---

## Componentes propios del módulo

Estos componentes son específicos del módulo Orders. Fase B los crea en `src/app/[locale]/(app)/orders/_components/`.

<!-- PENDING A.3: completar inventario con todos los componentes identificados en los anchors de detalle y create -->

| Componente          | Descripción                                                                                         | Pantallas que lo usan                 |
| ------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `OrderRow`          | Fila de tabla expandible: avatar tienda + cols de datos + chevron + ítems colapsables               | `order-list`                          |
| `OrderItemRow`      | Fila de ítem dentro del expand: icono tipo + nombre + estado ítem + qty + precio                    | `order-list` (expand), `order-detail` |
| `OrderStatusChip`   | Chip de estado del pedido con colores semánticos (info, warning, success, neutral)                  | `order-list`, `order-detail`          |
| `FxBanner`          | Banner inline de alerta de tipo de cambio desactualizado con CTA de actualización                   | `order-list`                          |
| `ProgressCell`      | Celda de barra de progreso + porcentaje con ancho fijo (L060)                                       | `order-list`                          |
| `OrderFilterDrawer` | FilterDrawer del módulo con las 5 secciones canónicas (Estado, Pago, Tienda, Fecha, Tipo de cambio) | `order-list`                          |

---

## Handoff a Fase B

<!-- PENDING A.3: completar con rutas App Router, i18n keys, tokens, decisiones cerradas, edge cases, copy aprobada, validación esperada -->

### Archivos a crear / modificar

**Rutas y páginas (App Router):**

```
src/app/[locale]/(app)/orders/
  page.tsx                        ← Lista de pedidos
  [id]/
    page.tsx                      ← Detalle de pedido
    edit/
      page.tsx                    ← Wizard en modo edición
  new/
    page.tsx                      ← Wizard de creación
```

**Componentes del módulo (nuevos):**

```
src/app/[locale]/(app)/orders/_components/
  OrderRow.tsx
  OrderItemRow.tsx
  OrderStatusChip.tsx
  FxBanner.tsx
  ProgressCell.tsx
  OrderFilterDrawer.tsx
```

### Componentes core a consumir

<!-- PENDING A.3: completar inventario completo similar a stores.md -->

Ver §Inventario de componentes core consumidos por este módulo (pendiente A.3).

### Decisiones cerradas durante la iteración

| #   | Decisión                                                     | Justificación                                                                                                        |
| --- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| D1  | Chevron de expand = columna de grid en desktop (no absoluto) | Posición `absolute; top: 50%` se desplaza al crecer la fila. `static; align-self: start` elimina el problema (L059). |
| D2  | Estado antes de Total en columnas                            | El chip de estado contextualiza el monto; juntos forman una unidad semántica (L060).                                 |
| D3  | Tienda en FilterDrawer = tag-autocomplete, no pills          | Las tiendas son datos dinámicos del usuario. Pills hardcoded no escalan (L064, §9.12).                               |
| D4  | Tipo de cambio = Switch, no checkbox                         | Regla general: boolean UI → toggle. Checkbox reservado para casos específicos (L064).                                |
| D5  | % Pago: barra alineada a izquierda con ancho de número fijo  | Sin `min-width` en el %, distintos valores (0%→100%) desplazan el inicio de la barra.                                |

### Preguntas abiertas

<!-- PENDING A.3 -->

1. **P-S7-01, P-S7-02**: aprobación requerida antes de Fase B (ver §Propuestas).
2. **Pantallas faltantes de bootstrap**: `screens/order-detail.md` y `screens/order-create.md` pendientes.
3. **FR-05-XX references**: los números de FR exactos deben mapearse desde `frd-05-order-payment-shipment.md` en A.3.

### Validación esperada al cierre de Fase B

```bash
npm run test
npm run type-check
npm run lint
npm run validate-build
npm run test:e2e      # e2e/orders.spec.ts (crear si no existe)
```

---

## Inventario de componentes core consumidos por este módulo

<!-- PENDING A.3: completar tabla similar a stores.md con todos los core components identificados en los 24 anchors -->

| Componente            | Propósito en el módulo                                       |
| --------------------- | ------------------------------------------------------------ |
| `AppShell`            | Contenedor base con sidebar + content area                   |
| `Sidebar`             | Navegación lateral izquierda                                 |
| `MobileTabBar`        | Navegación inferior en mobile                                |
| `Header`              | Topbar con título y contador contextual                      |
| `FilterDrawer`        | Panel de filtros de la lista (right panel / Sheet en mobile) |
| `FilterTriggerButton` | M05 canónico: botón Filtrar con badge de filtros activos     |
| `Switch`              | Toggle "Solo con actualización pendiente" en FilterDrawer    |
| `Pagination`          | Paginación numérica desktop; "Cargar más" en mobile          |
| `EmptyState`          | Estado vacío (sin órdenes / sin resultados con filtros)      |
| `MascotBubble`        | Mascota en estado vacío                                      |
| `Modal`               | Delete modal, cancel modal, discrepancy modal (ADR 0008)     |
| `Button`              | CTAs primarios y secundarios en todo el módulo               |
| `Input`               | Search toolbar, inputs en wizard y FilterDrawer              |
| `WizardAccordion`     | Contenedor acordeón del wizard de creación/edición           |
| `Toast`               | Feedback post-submit de creación/edición                     |

---

## Cláusula de spec vigente (cross-cutting safety)

El agente de Fase B lee el spec vigente de cada componente core al momento de implementar, **no asume el spec de hoy**. Cualquier mini-sesión cross-cutting (M0X, SN.X) que actualice un componente listado en el inventario se aplica automáticamente.

### Mini-sesiones cross-cutting conocidas en curso al cierre de S7 Fase A

| ID   | Componente afectado         | Descripción                                                                        | Estado al cierre Fase A | Impacto en Fase B                                                                           |
| ---- | --------------------------- | ---------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------- |
| M01  | `Modal`                     | Enhancement visual: depth, motion, layered design. Ver `cross-cutting-changes.md`. | 🟡 abierto              | Esperar M01 antes de implementar los tres modales del módulo si aún no ha cerrado.          |
| S6.1 | `FilterDrawer`              | Patrón canónico del FilterDrawer (secciones, footer, Sheet en mobile).             | 🟡 abierto              | Usar el spec actualizado de FilterDrawer al iniciar Fase B.                                 |
| S6.2 | `FilterTriggerButton` (M05) | Componente M05 con active state + badge. Ya cerrado.                               | ✅ cerrado              | Usar `FilterTriggerButton` canónico desde `src/components/modules/FilterTriggerButton.tsx`. |
| S6.3 | `Pagination`                | Patrón canónico (L062): desktop numérica + mobile "Cargar más".                    | 🟡 abierto              | Leer spec actualizado de Pagination al iniciar Fase B.                                      |
