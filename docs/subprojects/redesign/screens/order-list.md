---
title: Order list
session: 07
status: spec-complete
last_updated: 2026-05-12
demo_anchors:
  - "#s7-orders-list-loading"
  - "#s7-orders-list-default"
  - "#s7-orders-list-fx-banner"
  - "#s7-fx-reconciliation-modal"
  - "#s7-orders-list-empty-initial"
  - "#s7-orders-list-empty-filtered"
  - "#s7-orders-list-filters-open"
  - "#s7-orders-list-mobile"
  - "#s7-orders-list-loading-mobile"
  - "#s7-orders-list-empty-initial-mobile"
  - "#s7-orders-list-empty-filtered-mobile"
  - "#s7-orders-list-filters-mobile"
  - "#s7-fx-reconciliation-mobile"
frd: docs/product/prd-01-collector-mvp/frd-05-order-payment-shipment/frd-05-order-payment-shipment.md
blueprint: docs/product/prd-01-collector-mvp/frd-05-order-payment-shipment/bp-02-order-workspace-and-list-experience/bp-02-order-workspace-and-list-experience.md
---

# Order list

> **Fuente visual de verdad:** `docs/redesign/_notes/demo-screens.html`. Los anchors arriba son la referencia canónica. Este spec describe el contrato funcional + tokens + componentes consumidos + comportamiento. Cualquier implementación debe ser reconocible como descendiente del demo aprobado en S7 Fase A.

## 1. Layout

Vive dentro del `AppShell` (`src/components/modules/AppShell.tsx`). En desktop el `Sidebar` PUSH ocupa la izquierda; en mobile la navegación primaria es el drawer del topbar (burger button).

**Estructura vertical (desktop y mobile):**

```
┌─────────────────────────────────────────────────────┐
│  app-topbar (sticky 48px)                           │
│  ← Header.tsx — título "Pedidos", sin breadcrumb    │
├─────────────────────────────────────────────────────┤
│  page-heading                                       │
│  <h1>Pedidos</h1>  <span>5 activos · 1 cerrado</span>│
├─────────────────────────────────────────────────────┤
│  toolbar: [Buscador] [Filtrar] [Ordenar] [Nuevo]   │
├─────────────────────────────────────────────────────┤
│  filter-chips row (solo si hay filtros activos)     │
├─────────────────────────────────────────────────────┤
│  FX banner (solo si pendingFxCount > 0)             │
├─────────────────────────────────────────────────────┤
│  <card padding:4px>                                 │
│    orders-table-head (desktop) / invisible (mobile) │
│    [order-row × N] (expandible en desktop)          │
│    [s7-order-card × N] (card vertical en mobile)   │
│    "Mostrando A–B de N pedidos" (desktop)           │
│    load-more-wrap (mobile) / desktop-pagination     │
│  </card>                                            │
└─────────────────────────────────────────────────────┘
```

**Anchors del demo:**

| Anchor                           | Descripción                                         | Condición                         |
| -------------------------------- | --------------------------------------------------- | --------------------------------- |
| `#s7-orders-list-loading`        | Skeleton — toolbar deshabilitado, 3 cards pulsantes | SSR en curso / primera carga      |
| `#s7-orders-list-default`        | Lista poblada, filtro default "Solo activas" activo | Estado normal                     |
| `#s7-orders-list-empty-initial`  | Sin ningún pedido creado                            | `totalCount === 0`, sin filtros   |
| `#s7-orders-list-empty-filtered` | Sin resultados con filtros activos                  | `totalCount === 0` con filtros    |
| `#s7-orders-list-filters-open`   | FilterDrawer superpuesto (right panel)              | Usuario pulsó "Filtrar" (desktop) |
| `#s7-orders-list-mobile`         | Cards verticales, topbar burger-drawer nav          | `< 1024px`                        |
| `#s7-orders-list-filters-mobile` | FilterDrawer en bottom-sheet (drag handle + sticky) | Usuario pulsó "Filtrar" (mobile)  |

**page-heading:** Aparece entre `app-topbar` y el toolbar. En loading: el meta-span es un skeleton. En empty-initial: solo el `<h1>` sin span meta. En empty-filtered: "0 resultados". **No aparece en mobile** — en mobile el `app-topbar` ya provee el título de la página.

**Back-link:** No aplica — la lista de pedidos es pantalla top-level (el nav item activo "Pedidos" ya ubica al usuario). El `app-topbar` no lleva breadcrumb.

## 2. Componentes consumidos

| Componente                     | Ruta fuente                                                          | Props clave                                                        | Uso específico en esta pantalla                                                                                                                                                                                                                                                                                 |
| ------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Header`                       | `src/components/modules/Header.tsx`                                  | `breadcrumb=undefined`, `title="Pedidos"`                          | Topbar fijo 48px. No lleva breadcrumb porque es pantalla top-level. El título "Pedidos" va como `app-topbar-title`.                                                                                                                                                                                             |
| `FilterTriggerButton` (M05)    | `src/components/core/FilterTriggerButton.tsx`                        | `count={activeFilterCount}`, `onClick={openDrawer}`                | Botón "Filtrar" del toolbar. El badge numérico refleja cuántos filtros activos hay (excluyendo el default "Solo activas").                                                                                                                                                                                      |
| `FilterDrawer`                 | `src/components/modules/FilterDrawer/FilterDrawer.tsx`               | `sections=[estado, pago, tienda, fecha, fx]`, `onApply`, `onReset` | Panel de filtros. **Responsive canónico (ADR 0003 D8):** desktop (≥768px) `side drawer` derecho 440px con `border-left` + slide-from-right. Mobile (<768px) `bottom-sheet` con drag handle 4×36px + top-corners `--radius-2xl` + sticky footer respetando `safe-area-inset-bottom` + slide-up. Secciones en §6. |
| `MultiTagAutocomplete`         | `src/components/core/MultiTagAutocomplete.tsx`                       | `options={userStores}`, `showSearchIcon={true}`                    | Sección "Tienda" del FilterDrawer (tipo `tag-autocomplete`). Chips de tiendas seleccionadas aparecen dentro del contenedor del input, no debajo (L064 / §9.12).                                                                                                                                                 |
| `Select`                       | `src/components/core/Select.tsx`                                     | `value={sortBy}`, `onChange={updateSort}`                          | Dropdown "Ordenar por" en el toolbar. Opciones definidas en §6 / PLAYBOOK §9.13.                                                                                                                                                                                                                                |
| `Button`                       | `src/components/core/Button.tsx`                                     | `variant="primary"`, `variant="ghost"`                             | CTA "Nuevo pedido" (primary + `plus`), "Cargar más" (ghost + `chevron-down`), "Limpiar filtros" (ghost + `x`).                                                                                                                                                                                                  |
| `Input`                        | `src/components/core/Input.tsx`                                      | `type="search"`, `placeholder=...`                                 | Buscador del toolbar. Placeholder: `"Código o producto (ORD-20260428-01, Evangelion OST…)"`. Busca código de pedido OR nombre de producto. Tienda no va aquí.                                                                                                                                                   |
| `EmptyState`                   | `src/components/core/EmptyState.tsx`                                 | `mascotVariant`, `title`, `description`, `cta`                     | Estado sin pedidos (initial) y sin resultados (filtered). Dos variantes con copy diferente — ver §5.                                                                                                                                                                                                            |
| `MascotBubble`                 | `src/components/core/MascotBubble.tsx`                               | `variant="sleeping"` / `variant="confused"`                        | Dentro de `EmptyState`. Sleeping para empty-initial; confused para empty-filtered.                                                                                                                                                                                                                              |
| `Pagination`                   | `src/components/core/Pagination.tsx`                                 | `page`, `totalPages`, `totalCount`, `pageSize`                     | Desktop: paginación numérica con `«‹›»` + conteo. Mobile: "Cargar más". Canónico L062 / §9.11.                                                                                                                                                                                                                  |
| `OrderListContent` (local)     | `src/app/[locale]/(app)/orders/_components/OrderListContent.tsx`     | `orders`, `totalCount`, `page`                                     | Wrapper del bloque tabla + paginación. Contiene la lógica de expand/collapse de filas.                                                                                                                                                                                                                          |
| `OrderCard` (local)            | `src/app/[locale]/(app)/orders/_components/OrderCard.tsx`            | `order: OrdersListPageItem`                                        | Fila de tabla expandible (desktop) / card vertical (mobile). Contiene avatar, cols, expand toggle, ítems inline.                                                                                                                                                                                                |
| `OrderListFilterChips` (local) | `src/app/[locale]/(app)/orders/_components/OrderListFilterChips.tsx` | `filters`, `onRemove`                                              | Fila de filter-chips dismissibles debajo del toolbar.                                                                                                                                                                                                                                                           |
| `OrderListEmptyState` (local)  | `src/app/[locale]/(app)/orders/_components/OrderListEmptyState.tsx`  | `variant: "initial" \| "filtered"`                                 | Wrapper del EmptyState con copy específica de Orders.                                                                                                                                                                                                                                                           |

## 3. Datos consumidos

**Query principal:** `getOrdersList(userId, filters)` — `src/lib/data/orders/orderQueries.ts`

```ts
// Filtros de entrada
type OrdersListPageFilters = {
  nameQuery?: string; // busca en OrderItem.name (substring insensitive)
  productTypeKeys?: string[];
  storeId?: string;
  statuses?: OrderStatus[];
  dateFrom?: Date;
  dateTo?: Date;
  page: number;
  pageSize: number; // default 30 (ver §12 — discrepancia con código actual)
};

// Resultado
type OrdersListPageResult = {
  orders: OrdersListPageItem[]; // ver campos abajo
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
};

// Ítem de lista
type OrdersListPageItem = {
  id: string;
  orderDate: Date;
  expectedDeliveryFrom: Date | null;
  expectedDeliveryTo: Date | null;
  currencyCode: string;
  totalCost: number;
  status: OrderStatus;
  store: { id: string; name: string; slug: string };
  itemCount: number;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    deliveryState: ItemDeliveryState;
  }>;
  paidAmount: number;
  paymentPercentage: number; // 0–100
  hasUnpaidBalance: boolean;
};
```

**Prisma models involucrados:** `Order`, `OrderItem`, `OrderPayment`, `Store`, `DeliveryItem`.

**Query auxiliar pendiente (Fase B):** `pendingFxCount` — número de órdenes del usuario con tipo de cambio desactualizado (FR-05-36). No existe todavía en `orderQueries.ts`. Fase B debe añadir esta query o derivarla como campo adicional del resultado de `getOrdersList`. Ver §12 y P-S7-03 en `modules/orders.md`.

**Código de pedido:** El FRD define formato `ORD-YYYYMMDD-NN` (`FR-05-03`). La generación ocupa en la mutación de creación, no en la query.

**Default de filtros:** Al cargar sin params de URL, `parseOrderListingParams` aplica `DEFAULT_ACTIVE_STATUSES` = `[OPEN, PARTIALLY_IN_TRANSIT, IN_TRANSIT, PARTIALLY_DELIVERED]`, que se traduce en el chip "Solo activas". Los pedidos cancelados y completados no aparecen por defecto.

## 4. Server actions invocadas

Esta pantalla es de **solo lectura**. No invoca server actions.

- **Filtros / búsqueda / sort:** cambios en URL params via `router.push` / `buildOrderListFilterUrl`. El Server Component re-fetches al recibir los nuevos params.
- **Navegación a detalle:** `href="/[locale]/orders/[id]"` — link estático.
- **Navegación a crear:** `href="/[locale]/orders/new"` — link estático.
- **"Actualizar tipos de cambio" (FX banner):** abre `FxReconciliationModal` (WO-07, reconciliación masiva por par de monedas). El banner actúa como trigger; la reconciliación invoca `updateExchangeRatesAction` dentro del modal. El banner no invoca acciones directamente desde esta pantalla.
- **"Limpiar filtros":** llama a `buildOrderListFilterUrl` con filtros vacíos → `router.replace`.

## 5. Estados visuales

### 5.1 Loading (`#s7-orders-list-loading`)

`aria-busy="true"` en el contenedor principal. `page-heading-meta` es un skeleton rectangular (`class="skel"`, `width:110px; height:14px; border-radius:4px`). Toolbar: todos los controles con `disabled`. Tabla reemplazada por 3 cards skeleton (`class="s7-order-card"`): cada una con avatar-placeholder (40×40px, `border-radius:10px`) + 2–3 barras de texto pulsantes + 1–2 chips pulsantes. Paginación no aparece. Skeleton usa `class="skeleton"` + `animation: pulse`.

Token de skeleton: `color-mix(in oklch, var(--text-primary) 10%, transparent)` — se define globalmente, no hardcoded por componente.

### 5.2 Default / lista poblada (`#s7-orders-list-default`)

Tabla con `orders-table-head` (7 columnas: vacía / Pedido·Tienda / Productos / Estado / Total / % Pago / vacía). Headers: centrados excepto "Pedido / Tienda" que es `text-align: left` (L063 / §9.11).

**Fila de tabla (`order-row`):**

- Col 1: `store-avatar s32` — inicial del store, 32px.
- Col 2: `col-store` — `<strong>` nombre tienda + `<small>` código ORD-YYYYMMDD-NN + fecha.
- Col 3: `col-product` — N productos (número `num`).
- Col 4: `col-status` — chip de estado (ver tabla de mapping en §5.5).
- Col 5: `col-total num` — total con moneda (tabular-nums).
- Col 6: `col-progress` — barra mini (60px×3px) + porcentaje `num` (`min-width:3.2ch`).
- Col 7: `expand-toggle` — botón `aria-label="Ver productos"`, `data-expand-btn`.
- Col mobile extra: `mobile-extra` (visible solo `< 1024px`) — chips compactos + meta.

**Filas expandidas:** el área `.order-items` contiene hasta 5 ítems con ítem-icon + nombre + subtipo + estado-ítem + cantidad + precio. Si hay más de 5: "+ N más…" en muted. CTA "Abrir detalle →" al final.

**Órdenes completadas:** `opacity: 0.75` en el `order-row` entero — señala que están cerradas sin ocultarlas.

**FX banner:** visible cuando `pendingFxCount > 0`. Color `info`, `role="status"`, `aria-live="polite"`, icono `refresh-cw`.

**Paginación desktop:** "Mostrando A–B de N pedidos" (12px muted, `text-align:center`) + botones `«‹[1][2]›»` con `gap:4px`. Paginación mobile: "Cargar más" centrado. Canónico L062.

**Chips de filtros activos:** fila `orders-filter-chips` debajo del toolbar. Cada chip = un filtro activo. En default: "Solo activas ×". Badge en `FilterTriggerButton` = número de chips.

### 5.3 Empty initial (`#s7-orders-list-empty-initial`)

`page-heading` con solo `<h1>Pedidos</h1>` (sin meta count). Toolbar activo (solo CTA "Nuevo pedido" funcional, filtros y buscador visualmente activos). No aparecen chips. `EmptyState` con `MascotBubble` `sleeping` + título + descripción + CTA primary "Anotar primer pedido". Sin tabla, sin paginación.

### 5.4 Empty filtered (`#s7-orders-list-empty-filtered`)

`page-heading-meta` = "0 resultados". Toolbar activo con chips visibles. `EmptyState` con `MascotBubble` `confused` + título + descripción + CTA ghost "Limpiar filtros". Sin tabla, sin paginación.

### 5.5 Mapping de chips de estado (lista tabular)

El chip en la columna "Estado" muestra el estado visual **del pedido** con la siguiente jerarquía de display (no confundir con la derivación de `BR-05-02`):

| Condición                                            | Chip                     | Ícono            | Color   |
| ---------------------------------------------------- | ------------------------ | ---------------- | ------- |
| `CANCELLED`                                          | Cancelado                | `ban`            | neutral |
| `COMPLETED` + impago                                 | Completo + badge warning | `package-check`  | success |
| `COMPLETED`                                          | Completo                 | `package-check`  | success |
| `status != COMPLETED` + `expectedDeliveryTo < today` | Atrasado Nd              | `alert-triangle` | warning |
| `IN_TRANSIT`                                         | En camino                | `truck`          | info    |
| `PARTIALLY_IN_TRANSIT`                               | Parcialmente en camino   | `truck`          | info    |
| `PARTIALLY_DELIVERED`                                | Parcialmente entregado   | `truck`          | info    |
| `OPEN` + `paymentPercentage === 100`                 | Pagado                   | `check-circle`   | success |
| `OPEN`                                               | Abierto                  | `clock`          | neutral |

"Atrasado Nd" = `Math.ceil((today - expectedDeliveryTo) / 86400000)` días. Solo aplica cuando el pedido no está `COMPLETED` ni `CANCELLED` y `expectedDeliveryTo !== null`.

Barra de progreso % Pago: `var(--accent)` pago parcial normal, `var(--warning)` atrasado o impago con saldo, `var(--success)` 100%.

### 5.6 FilterDrawer abierto (`#s7-orders-list-filters-open`)

Fondo al 35% opacity + `pointer-events:none`. Drawer superpuesto a la derecha. Secciones (en orden):

1. **Estado** — pills multi-select: "Activas" (grupo), "Abierto", "En camino", "Completo", "Cancelado". OR dentro de sección.
2. **Pago** — pills multi-select: "Pagado", "Pago parcial", "Impago", "Atrasado". OR dentro de sección.
3. **Tienda** — `MultiTagAutocomplete`, `showSearchIcon={true}`. Chips dentro del área de input.
4. **Fecha de creación** — date range: `<input type="date">` "Desde" + `<input type="date">` "Hasta". Labels 12px muted.
5. **Tipo de cambio** — `filter-switch-row` + `<Switch>`: "Solo con actualización pendiente". Default: `off`.

Footer: botón ghost "Limpiar" + botón primary `flex:1` "Aplicar filtros" (ícono `check`). Lógica: OR dentro de familia, AND entre familias.

### 5.7 Mobile (`#s7-orders-list-mobile`)

`--sidebar-width:0px`. Sin sidebar.

**Topbar (static shell, ContentHeader.tsx).** Patrón canónico S7-A.6: `[☰ hamburger]` + título "Pedidos" (14px/600). Sin filter trigger, sin "Nuevo" en el header — esas acciones contextuales viven en el page content (search action row, abajo).

**Page action row sticky bajo el topbar** (`.s7-mob-search-wrap`, `position: sticky; top: 48px`, `display: flex; gap: 8px; padding: 10px 12px`, backdrop blur). Una sola fila horizontal con:

- `<SearchInput>` (`flex:1`, placeholder "Código o producto (ORD-20260428-01, OST…)"),
- `[FilterTriggerButton M05 icon-only con badge]` (`flex-shrink:0`),
- `[+ Nuevo (primary sm)]` (`flex-shrink:0`).

Las 3 acciones contextuales del listado quedan en la zona de page chrome, no en el shell. Mantiene paridad con `ContentHeader.tsx` (header inmutable cross-route) y resuelve discoverability de filter + Nuevo en thumb zone.

Filter chips dismissibles debajo del action row (mismo patrón que desktop). FX banner compacto con CTA tonal "Actualizar tipos de cambio" stacked (no inline). Cards verticales `.s7-order-card` con: store-avatar + nombre + código-fecha + chip estado + barra progreso (`--accent-cool` para items expandidos) + meta "N productos · X% pagado · $total". **Tap en card → navega al detalle**. Al pie de cada card, **expand-chevron row** (`.s7-mob-card-expand-row`): barrita centrada con chevron-down + texto "Ver productos" — tap en chevron → expande inline mostrando los N items (sin truncar) con icon (`--accent-cool`) + name + qty + price. Una segunda tap en chevron (rotado 180° + texto "Ocultar productos") → colapsa. Paginación "Cargar más" canónica al pie (L062), con conteo "Mostrando A–B de N" encima del botón.

### 5.7.bis Loading mobile (`#s7-orders-list-loading-mobile`)

Skeleton card-style en mobile (no table-format como desktop). Mismo topbar (☰ + "Pedidos") + search action row con placeholders shimmer:

- Search action row: 3 skeletons en línea (input full-flex + filter button + Nuevo button), todos con shimmer.
- 4 skeleton cards: cada una con avatar circular (40×40) + 2 líneas de texto (name + meta) + 1 placeholder de chip + barra de progreso + placeholder de total.
- Animación `s7-skel-shimmer` 1.4s linear infinite.

### 5.7.ter Empty initial mobile (`#s7-orders-list-empty-initial-mobile`)

Estado vacío sin filtros (user no tiene pedidos creados). Container `.s7-mob-empty`:

- Topbar canónico (☰ + "Pedidos"). Search action row oculto (no hay nada que buscar/filtrar; el CTA primary del empty cubre la acción "Anotar primer pedido").
- Center: icon `package-open` 28px en círculo 64×64 con `--text-primary` 5% bg.
- Title 16px/600 "Aún no tenés pedidos".
- Body 13px/secondary "Cuando hagas tu primer pedido a una tienda, vas a verlo acá con su estado, pagos y entregas." (max-width 280px).
- CTA único: "Anotar primer pedido" primary full-width (canónico desktop, copy alineado). Title "Aún no hay pedidos" + body "Anota tu primer pedido y empieza a seguir tus compras desde aquí." (sin voseo argentino).

### 5.7.quater Empty filtered mobile (`#s7-orders-list-empty-filtered-mobile`)

Estado vacío con filtros activos (no hay match). Topbar canónico (☰ + "Pedidos"). En lugar del search action row habitual, se renderiza solo el FilterTriggerButton en estado active (badge "3") alineado a la derecha (sin search input ni Nuevo CTA — el primer paso esperado del usuario es ajustar filtros). Chips dismissibles debajo (3 ejemplos: "Cancelados", "Solaris Books", "Marzo 2026"). Body usa `.s7-mob-empty`:

- Icon `search-x` 28px.
- Title "Sin resultados".
- Body "No hay pedidos que coincidan con los filtros activos. Probá quitar alguno o cambiar el rango."
- CTA único "Limpiar filtros" (ghost + icon `x`) — alineado con desktop. Title "Sin resultados" + body "Ningún pedido coincide con los filtros actuales. Prueba ajustando o limpiando los filtros." Re-abrir el FilterDrawer es alternativa via tap en chip del header — no se necesita CTA secundaria inventada.

### 5.9 FX Reconciliación mobile (`#s7-fx-reconciliation-mobile`)

Cuando el user toca el CTA "Actualizar tipos de cambio" del FX banner, abre un **full-screen sheet** (no bottom sheet — el contenido es demasiado complejo para 50% del viewport). Implementado con `<Modal>` canónico (ADR 0008 Extensión 2026-05-11 — caso de excepción full-screen).

Estructura:

- Header `.s7-mob-fullsheet-head`: `← back-arrow` + título "Actualizar FX" + counter "N pedidos".
- Body `.s7-mob-fullsheet-body`: 1 párrafo de instrucción + grupos por par de monedas (cards con border 1px). Cada grupo: header con eyebrow (par de monedas, ej "JPY → ARS") + count "X pedidos" + chip de status (`warning` si "Sin actualizar", `success` si "Listo"). Body del grupo: input numérico + botón "Hoy" tonal (Frankfurter API). Collapsible "Ver pedidos afectados (N)" con lista de ORD codes y montos.
- Footer sticky: Cancelar + Aplicar a N pedidos primary full-width.

### 5.8 FilterDrawer abierto en mobile (`#s7-orders-list-filters-mobile`)

`<FilterDrawer>` renderizado como **bottom-sheet canónico** (ADR 0003 D8). Anclado al borde inferior del viewport, animación slide-up 280ms, backdrop blur 8px + tint oklch calibrado para light/dark.

Estructura vertical de arriba hacia abajo:

1. **Drag handle** — 4×36px pill, `border-radius:999px`, `background:var(--border-strong)`, `margin: 8px auto 4px`. Solo se muestra en mobile (oculto con `md:hidden`).
2. **Header** — `padding: 12px 22px 14px`, `border-bottom: 1px solid var(--border)`. Icono `sliders-horizontal` 18px en `var(--accent)` + título "Filtrar pedidos" 15px/600 + `IconButton ghost` X a la derecha.
3. **Body scrollable** — `padding: 18px 22px`, `overflow-y:auto`, `flex:1`. Contiene **6 secciones de filtro** (parity total con desktop tras S7-A.5):
   - **Estado del pedido** (5 pills + iconos): Activas (`activity`) · Abierto (`clock`) · En camino (`truck`) · Completo (`package-check`) · Cancelado (`ban`). Singular, mismos pills que desktop.
   - **Estado de pago** (4 pills + iconos): Pagado (`check-circle`) · Pago parcial (`circle-dot`) · Impago (`x-circle`) · Atrasado (`alert-triangle`).
   - **Tienda** (tag-autocomplete con search + chips dismissibles inline).
   - **Fecha del pedido** (par de inputs `Desde` + `Hasta` con `type="date"` nativo — parity con desktop; reemplaza al trigger único "Cualquier fecha" anterior).
   - **Ordenar por** (selector con 5 opciones canónicas — agregado en S7-A.5, antes faltaba en mobile): Más recientes · Más antiguas · Tienda A–Z · % Pago: menor · Total: mayor.
   - **FX desactualizado** (switch + label "Solo con actualización pendiente" + subtitle "Pedidos que necesitan refrescar el tipo de cambio").
4. **Footer sticky** — `padding: 14px 22px`, `border-top: 1px solid var(--border)`, `background: var(--surface-elevated)`, `padding-bottom: env(safe-area-inset-bottom)`. Botón ghost "Limpiar" (flex 0) + botón primary `flex:1` "Aplicar (N)" con icono `check`.

Contenedor: `max-height: 92svh`, `border-top: 1px solid var(--border-strong)`, `border-top-left-radius / border-top-right-radius: 20px` (`--radius-2xl`), `box-shadow: 0 -8px 32px color-mix(...var(--text-primary) 22%...)` (shadow hacia arriba).

**No es un `<Modal>`.** Aunque visualmente comparte algunos elementos (backdrop blur, top-corners, drag handle), arquitectónicamente es un `<FilterDrawer>` hand-rolled con su propio comportamiento responsive (sin Vaul, sin compartir código con el `<Modal>` canónico). El `<Modal>` canónico es para decisiones discretas (confirm, alert, form corto); el `<FilterDrawer>` es para refinement de lista. Coherencia visual sin acoplamiento arquitectónico.

Referencia visual: demo HTML anchor `#s7-orders-list-filters-mobile`. Implementación en `src/components/modules/FilterDrawer/FilterDrawer.tsx` (líneas 360-395).

## 6. Comportamiento e interacción

### 6.1 Búsqueda

- Campo `type="search"` con placeholder `"Código o producto (ORD-20260428-01, Evangelion OST…)"`.
- Busca: código de pedido (match exacto o prefijo sobre el campo `code`) **OR** nombre de producto (substring insensitive sobre `OrderItem.name`).
- **"Tienda" no va en el buscador** — vive exclusivamente en el FilterDrawer (§9.12 / §9.13). Tener tienda en ambos lugares crea estado conflictivo y duplica el filtrado.
- Debounce: 300ms antes de pushear a URL. Evita requests por cada keystroke.
- Al cambiar el valor: reset de `page` a `1` en la URL.
- Vaciar el campo: elimina el param `q` de la URL, vuelve a todos los resultados.

### 6.2 Sort

- `<Select>` "Ordenar por" en el toolbar. Default visible: "Más recientes". Opciones y valores en PLAYBOOK §9.13.
- Cambio inmediato: `router.push` con `sort=` en URL. Reset `page=1`.
- **Comportamiento diferente del FRD:** `FR-05-28` define "oldest first" como default. El rediseño aprobado usa "Más recientes" (newest first). Razón: los coleccionistas priorizan sus órdenes más recientes. Ver tabla en §6 de `modules/orders.md`.

### 6.3 FilterDrawer — abrir / aplicar / cerrar / limpiar

- **Abrir:** click en `FilterTriggerButton`. El drawer hace `focus()` en el primer control interactivo al abrirse. Fondo del contenido: `opacity:0.35`, `pointer-events:none`.
- **Aplicar:** click "Aplicar filtros" → codifica filtros en URL params → `router.push` → drawer se cierra → foco regresa al `FilterTriggerButton`.
- **Cerrar sin aplicar:** click fuera del drawer o `Escape` → drawer se cierra sin cambiar URL → foco regresa al `FilterTriggerButton`.
- **Limpiar:** botón "Limpiar" dentro del drawer limpia los controles del drawer sin cerrar ni actualizar URL. "Aplicar" posterior aplica el estado limpio.
- **Focus trap:** mientras el drawer está abierto, `Tab` / `Shift+Tab` cicla solo entre los controles del drawer. No escapa al fondo.

### 6.4 Filter chips — dismiss

- Click en ×/X de un chip: elimina ese filtro de la URL → `router.replace` → lista se actualiza.
- El badge del `FilterTriggerButton` se actualiza en consecuencia.
- "Solo activas" es un chip especial que representa el default. Descartarlo elimina `statuses` de la URL, mostrando todas las órdenes.

### 6.5 Expand / collapse de fila (desktop)

- Click en el botón `expand-toggle` (chevron) o click en cualquier área del `order-row` **excepto** links y botones internos → toggle expand/collapse.
- El chevron rota 180° al expandir (`transition: transform 200ms`).
- `aria-expanded` del botón alterna entre `"true"` / `"false"`.
- La altura del `.order-items` anima con `max-height` + `overflow:hidden` (evitar `height:auto` sin animación).
- El chevron está anclado al `align-self: start` en desktop (L059 / §9.11) — NO vertical-center.
- Solo una fila puede estar expandida a la vez o múltiples — no hay restricción de exclusividad (el demo no especifica exclusividad, así que se permiten varias abiertas).
- En mobile: **no hay expand**. Tap en card → `router.push` a `/orders/[id]`.

### 6.6 "Cargar más" (mobile) / paginación (desktop)

- Mobile: click en "Cargar más" → append de la siguiente página al array en memoria (infinite scroll append, no reemplaza). `aria-busy` mientras carga.
- Desktop: click en número de página / flechas → `router.push` con `page=N`. Scroll al top de la lista.

### 6.7 FX banner

Demo: `#s7-orders-list-fx-banner` (banner) · `#s7-fx-reconciliation-modal` (modal al que abre).

- Visible cuando `pendingFxCount > 0`.
- **Copy:** "Tienes **N** pedido/pedidos con el tipo de cambio desactualizado. Actualízalos para que tus reportes reflejen tu moneda base actual."
- **CTA:** botón `tonal` (variant secundaria — tinted accent) con ícono `refresh-cw` en `--accent`. Label: "Actualizar tipos de cambio". Al pulsar abre `FxReconciliationModal`.
- Ícono leading del banner: `refresh-cw` en `--accent` (no `--info` — alineado con el tono del botón).
- `role="status"`, `aria-live="polite"` — se anuncia cuando aparece/desaparece sin interrumpir el flujo.

### 6.8 "Nuevo pedido"

- Desktop: botón primary en el toolbar.
- Mobile: botón primary sm en el `app-topbar-right`.
- Ambos: `href="/[locale]/orders/new"`.

### 6.9 "Abrir detalle" (dentro de fila expandida)

- Link `btn link sm` al final del bloque de ítems de una fila expandida.
- `href="/[locale]/orders/[id]"`.
- View transition: `view-transition-name: order-{code}` en cada `order-row` — permite transición animada al detalle.

### 6.10 Atajos de teclado

| Tecla             | Contexto             | Acción                                         |
| ----------------- | -------------------- | ---------------------------------------------- |
| `/`               | Fuera de inputs      | Focus al buscador                              |
| `Escape`          | FilterDrawer abierto | Cerrar drawer, foco a FilterTriggerButton      |
| `Escape`          | Buscador con foco    | Limpiar búsqueda                               |
| `Enter`           | Buscador             | Aplicar búsqueda inmediatamente (sin debounce) |
| `Space` / `Enter` | `expand-toggle`      | Toggle expand de fila                          |

### 6.11 Gestos mobile

- **Tap en `☰` (hamburger del topbar)** → abre el drawer de navegación principal de la app (responsabilidad del AppShell, no de esta pantalla). El topbar es estático cross-route (`ContentHeader.tsx`); las acciones contextuales del listado (filter, Nuevo) viven en el search action row del page content (§5.7).
- **Tap en `.s7-order-card`** → navega al detalle (`/orders/[id]`). View transition con `view-transition-name: order-{dbId}` (L074).
- **Tap en `.s7-mob-card-expand-row`** (chevron al pie de cada card) → expande inline mostrando los N items del pedido. Segunda tap → colapsa. NO interrumpe la navegación del card — el chevron tiene su propio tap area con `stopPropagation`. Anim: max-height transition 200ms.
- **Pull-to-refresh** → comportamiento del browser nativo (no custom). Si se quiere implementar custom (PWA con `display:standalone`), usar [react-pull-to-refresh](https://www.npmjs.com/package/react-pull-to-refresh) o similar — fuera de scope de Fase B Parte 1.
- **Swipe horizontal en `.s7-order-card`** → no implementado en Fase B (potencial Fase 2: swipe-right = "Anotar pago", swipe-left = "Cancelar"). Si en el futuro se implementa, usar el patrón canónico de iOS Mail / Gmail.
- **Long-press en `.s7-order-card`** → no implementado en Fase B (potencial alternativa al chevron expand para usuarios power).

## 7. Validaciones

Esta pantalla no tiene formularios de escritura. Las únicas validaciones son de input del FilterDrawer:

- **Fecha "Desde" / "Hasta":** si `dateFrom` > `dateTo` → mostrar error inline debajo del campo "Hasta": `"La fecha de fin debe ser posterior al inicio"`. Aplicar en el blur del campo "Hasta" o al intentar aplicar filtros.
- **Buscador:** sin validación. El campo acepta cualquier texto libre. Si no hay resultados, muestra el estado `empty-filtered`.
- Los parámetros de URL son parseados/sanitizados por `parseOrderListingParams` (en `src/app/[locale]/(app)/orders/_utils/orderListingParams.ts`). Valores inválidos en URL son ignorados silenciosamente (caen al default).

## 8. i18n keys

Namespace principal: `orderListing`. Muchas claves ya existen — tabla completa de claves relevantes para el rediseño:

| Clave i18n                                 | ES propuesto (demo)                                                                                                                                                   | Clave existente?                                      | Cambio?                                    |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------ |
| `orderListing.hero.title`                  | `"Pedidos"`                                                                                                                                                           | ✅ `hero.title`                                       | Sin cambio                                 |
| `orderListing.heading.meta`                | `"{active} activos · {closed} cerrado"`                                                                                                                               | ❌ nueva                                              | Añadir — para `page-heading-meta`          |
| `orderListing.heading.metaPlural`          | `"{active} activos · {closed} cerrados"`                                                                                                                              | ❌ nueva                                              | Pluralización del cerrado                  |
| `orderListing.heading.zeroResults`         | `"0 resultados"`                                                                                                                                                      | ❌ nueva                                              | Para empty-filtered                        |
| `orderListing.hero.newOrder`               | `"Nuevo pedido"`                                                                                                                                                      | ✅                                                    | Sin cambio                                 |
| `orderListing.filters.openButton`          | `"Filtrar"`                                                                                                                                                           | ✅                                                    | Sin cambio                                 |
| `orderListing.filters.dialogTitle`         | `"Filtrar pedidos"`                                                                                                                                                   | ✅                                                    | Sin cambio                                 |
| `orderListing.filters.apply`               | `"Aplicar filtros"`                                                                                                                                                   | ✅                                                    | Sin cambio                                 |
| `orderListing.filters.reset`               | `"Limpiar"`                                                                                                                                                           | ✅ (valor: "Restablecer")                             | Cambio: "Limpiar"                          |
| `orderListing.filters.storeLabel`          | `"Tienda"`                                                                                                                                                            | ✅                                                    | Sin cambio                                 |
| `orderListing.filters.dateFromLabel`       | `"Desde"`                                                                                                                                                             | ✅                                                    | Sin cambio                                 |
| `orderListing.filters.dateToLabel`         | `"Hasta"`                                                                                                                                                             | ✅                                                    | Sin cambio                                 |
| `orderListing.filters.fxPendingLabel`      | `"Solo con actualización pendiente"`                                                                                                                                  | ❌ nueva                                              | Para el switch de FX en drawer             |
| `orderListing.search.placeholder`          | `"Código o producto (ORD-20260428-01, Evangelion OST…)"`                                                                                                              | ❌ nueva (actual en filters.namePlaceholder difiere)  | Reemplaza `namePlaceholder`                |
| `orderListing.sort.label`                  | `"Ordenar por"`                                                                                                                                                       | ❌ nueva                                              | Para el aria-label del Select              |
| `orderListing.sort.newest`                 | `"Más recientes"`                                                                                                                                                     | ❌ nueva                                              | Default sort label                         |
| `orderListing.sort.oldest`                 | `"Más antiguas"`                                                                                                                                                      | ❌ nueva                                              |                                            |
| `orderListing.sort.storeAZ`                | `"Tienda A–Z"`                                                                                                                                                        | ❌ nueva                                              |                                            |
| `orderListing.sort.paymentAsc`             | `"% Pago: menor"`                                                                                                                                                     | ❌ nueva                                              |                                            |
| `orderListing.sort.totalDesc`              | `"Total: mayor"`                                                                                                                                                      | ❌ nueva                                              |                                            |
| `orderListing.chips.soloActivas`           | `"Solo activas"`                                                                                                                                                      | ✅                                                    | Sin cambio                                 |
| `orderListing.chips.remove`                | `"Quitar filtro {label}"`                                                                                                                                             | ✅                                                    | Sin cambio                                 |
| `orderListing.card.expand`                 | `"Ver productos"`                                                                                                                                                     | ✅ (valor: "Mostrar artículos")                       | Cambio: "Ver productos" — más conciso      |
| `orderListing.card.collapse`               | `"Ocultar productos"`                                                                                                                                                 | ✅ (valor: "Ocultar artículos")                       | Cambio: "Ocultar productos"                |
| `orderListing.card.items`                  | `"{count, plural, one {# producto} other {# productos}}"`                                                                                                             | ✅ (usa "artículo")                                   | Cambio: "producto" (canónico del glosario) |
| `orderListing.card.overdue`                | `"Atrasado {days}d"`                                                                                                                                                  | ❌ nueva                                              | Para el chip "Atrasado Nd"                 |
| `orderListing.card.moreItems`              | `"+ {count} más…"`                                                                                                                                                    | ❌ nueva                                              | Para truncación de ítems en expand         |
| `orderListing.card.openDetail`             | `"Abrir detalle"`                                                                                                                                                     | ❌ nueva                                              | CTA al final de expand                     |
| `orderListing.card.itemState.transit`      | `"En camino"`                                                                                                                                                         | ✅ (valor: "En tránsito")                             | Cambio: "En camino" — más natural          |
| `orderListing.card.itemState.pending`      | `"Pendiente en tienda"`                                                                                                                                               | ❌ nueva                                              | Estado de ítem en tienda aún               |
| `orderListing.card.itemState.arrived`      | `"Listo en tienda"`                                                                                                                                                   | ❌ nueva                                              | Ítem llegó a la tienda                     |
| `orderListing.card.itemState.delivered`    | `"Entregado"`                                                                                                                                                         | ✅                                                    | Sin cambio                                 |
| `orderListing.empty.noOrders.title`        | `"Aún no hay pedidos"`                                                                                                                                                | ✅ (valor: "Todavía no tienes pedidos")               | Cambio de copy                             |
| `orderListing.empty.noOrders.description`  | `"Anota tu primer pedido y empieza a seguir tus compras desde aquí."`                                                                                                 | ✅ (diferente)                                        | Cambio de copy                             |
| `orderListing.empty.noOrders.cta`          | `"Anotar primer pedido"`                                                                                                                                              | ✅ (valor: "Nuevo pedido")                            | Cambio de copy                             |
| `orderListing.empty.noResults.title`       | `"Sin resultados"`                                                                                                                                                    | ✅ (valor: "No encontramos pedidos con esos filtros") | Cambio de copy                             |
| `orderListing.empty.noResults.description` | `"Ningún pedido coincide con los filtros actuales. Prueba ajustando o limpiando los filtros."`                                                                        | ✅ (diferente)                                        | Cambio de copy                             |
| `orderListing.empty.noResults.cta`         | `"Limpiar filtros"`                                                                                                                                                   | ✅ (valor: "Restablecer")                             | Cambio de copy                             |
| `orderListing.fx.banner`                   | `"Tienes {count, plural, one {# pedido} other {# pedidos}} con el tipo de cambio desactualizado. Actualízalos para que tus reportes reflejen tu moneda base actual."` | ❌ nueva                                              | Copy completo del FX banner (WO-07)        |
| `orderListing.fx.cta`                      | `"Actualizar tipos de cambio"`                                                                                                                                        | ❌ nueva (reemplaza `fx.update`)                      | Botón tonal del FX banner                  |
| `orderListing.pagination.showing`          | `"Mostrando {start}–{end} de {total} pedidos"`                                                                                                                        | ✅ (estructura diferente)                             | Revisar formato                            |
| `orderListing.pagination.loadMore`         | `"Cargar más"`                                                                                                                                                        | ❌ nueva                                              | Botón mobile                               |

## 9. Accesibilidad

- `aria-busy="true"` en el contenedor principal durante loading. Filas skeleton con `aria-hidden="true"`.
- `FilterDrawer`: `role="dialog"`, `aria-modal="true"`, `aria-label={t('filters.dialogTitle')}`. Focus trap activo mientras esté abierto. Al cerrar: foco regresa al `FilterTriggerButton`.
- Switch en FilterDrawer: `<button role="switch">` + `aria-pressed` + `aria-label` descriptivo.
- Chevron expand: `aria-label={t('card.expand')} / {t('card.collapse')}` + `aria-expanded` que alterna.
- FX banner: `role="status"` + `aria-live="polite"`.
- Buscador: `aria-label="Buscar pedidos"`.
- CTA "Nuevo pedido": texto explícito, no solo ícono.
- `page-heading` `<h1>`: única en la página, correctamente jerarquizada bajo el `<header>` del `app-topbar`.
- Filas de tabla: `role="row"` en los headers, `role="rowgroup"` implícito en el wrapper. Al expandir, los ítems están dentro del flujo DOM de la fila.
- Chips de filtros activos: `aria-label="Filtros activos"` en el contenedor. Cada chip con ×: `aria-label={t('chips.remove', {label: chipLabel})}`.
- Paginación: `aria-label="Paginación de pedidos"` en el nav. Página activa: `aria-current="page"`.
- Keyboard: `/` hace focus al buscador. `Escape` cierra drawer / limpia buscador. `Enter` en buscador aplica sin debounce.

## 10. Edge cases acordados

1. **Pedido con `expectedDeliveryTo: null`** — no muestra "Atrasado". El chip de estado vuelve al estado derivado normal. La columna de progreso sigue funcionando.
2. **Pedido con `itemCount: 0`** — columna muestra "0 productos". No se muestra expand (no hay ítems). El botón chevron aparece deshabilitado o no se renderiza.
3. **Pedido con más de 5 ítems en expand** — muestra los primeros 5 + `"+ N más…"` en muted. El CTA "Abrir detalle" lleva al listado completo.
4. **Múltiples monedas en la misma lista** — cada fila muestra su moneda propia (`currencyCode`). No hay conversión al base currency en la columna Total. La barra de progreso % siempre es porcentaje (moneda-agnóstico).
5. **Pedido completado con saldo pendiente** — chip "Completo" (`package-check`, success) + barra de progreso con `var(--warning)`. El chip de estado es el de completado pero la barra revela el impago visual. `opacity:0.75` en la fila.
6. **Cancelado con filtros "Solo activas"** — no aparece (excluido por `DEFAULT_ACTIVE_STATUSES`). Solo visible si el usuario activa el filtro "Cancelado" explícitamente.
7. **`pendingFxCount === 0`** — FX banner no aparece en el DOM. No ocupa espacio.
8. **Lista con más de 30 pedidos** — paginación activa. Desktop: muestra "Mostrando 1–30 de N pedidos". Mobile: botón "Cargar más" visible.
9. **URL con `page=` mayor al `totalPages`** — `parseOrderListingParams` debe coercionar a la última página disponible. Sin error 404.
10. **Filter chip "Solo activas" + búsqueda sin resultados** — muestra empty-filtered con los 3 chips activos (Solo activas + los del buscador). El usuario puede limpiar individualmente o con "Limpiar filtros".
11. **`storeId` inválido en URL** — ignorado silenciosamente por `parseOrderListingParams`. La lista carga sin filtro de tienda.

## 11. Anti-patrones

- **No usar `disc-3` ni `sparkles` para tipos de producto** — siempre derivar de `getStoreProductTypeIcon(item.productTypeKey)` y mostrar `Box` cuando `productTypeKey === null`. (L061)
- **No poner "Tienda" en el buscador del toolbar** — vive exclusivamente en el FilterDrawer. Tener tienda en ambos lados crea estado conflictivo. (§9.13)
- **No usar `package` para "En camino"** — confunde estado de paquete físico con estado de orden. Usar `truck`. (L065 / §9.13)
- **No usar `check-circle` para "Completo"** — ese ícono es para "Pagado". "Completo" usa `package-check`. (L065 / §9.13)
- **No centrar el chevron con `top:50%` en mobile** — al expandir, el `top:50%` se calcula sobre la altura total de la fila expandida, desplazando el chevron. Anclar al top. (L059)
- **No poner la barra de progreso justificada a la derecha** — la barra define la arista izquierda fija. El número con `min-width:3.2ch` va a continuación. `justify-content: flex-start`. (L060)
- **No asumir que el item count ya existe en `getOrdersList`** — la query expone `items.length` como `itemCount`. No hacer una query separada solo para el count.
- **No renderizar el chip de tienda seleccionada fuera del input de `MultiTagAutocomplete`** — los chips van dentro del contenedor bordeado del input, no debajo. (L064 / §9.12)
- **No hardcodear el page size a 20** — ver §12, el tamaño debe ser 30 (alineado con la demo) y configurable desde `orderListingParams.ts`.
- **No usar `eyebrow` ni `subtitle` debajo del `app-topbar`** — el patrón de heading de sección es `page-heading` con `<h1>` + `<span class="page-heading-meta">` (S7-A aprobado).

## 12. Notas para Fase B

1. **Page size:** `ORDER_LIST_PAGE_SIZE` en `src/app/[locale]/(app)/orders/_utils/orderListingParams.ts` es `20`. El demo muestra "30 por página". Alinear a `30` antes de implementar la paginación visual.

2. **Default sort:** La implementación actual ordena `orderBy: { orderDate: "asc" }` (oldest first), alineado con `FR-05-28`. El rediseño aprobado usa "Más recientes" como default visible. Fase B debe:
   - Cambiar el default de `parseOrderListingParams` a `createdAt DESC` cuando `sort` param no está en URL.
   - Actualizar `getOrdersList` para soportar los 5 criterios de sort: `createdAt DESC/ASC`, `store.name ASC`, `paymentPercentage ASC`, `totalCost DESC`.
   - Nota: esto es un cambio de comportamiento respecto a `FR-05-28`. Registrado en `modules/orders.md` tabla de cambios.

3. **`pendingFxCount`:** Fase B debe añadir el campo `pendingFxCount: number` a `OrdersListPageResult` mediante un `prisma.order.count({ where: { userId, needsExchangeRateUpdate: true } })` en paralelo con `getOrdersList` (`Promise.all`). Decisión cerrada en S7-A (P-S7-03 resuelto — ver `modules/orders.md`).

4. **`ItemDeliveryState` → copy:** Los valores de `deriveItemDeliveryState` deben mapearse a los nuevos labels aprobados: "En camino" (in_transit), "Pendiente en tienda" (open/pending), "Listo en tienda" (arrived), "Entregado" (delivered). Verificar que `deriveItemDeliveryState` ya produce el estado `arrived` / si hay que añadirlo.

5. **Componentes locales existentes a refactorizar:**
   - `OrderCard.tsx` — actualizar a la nueva estructura de 7 columnas + expand pattern aprobado.
   - `OrderListEmptyState.tsx` — actualizar copy a la aprobada en §8.
   - `OrderListFilters.tsx` — añadir secciones "Pago" y "Tipo de cambio" (actualmente no existen).
   - `OrderListFilterChips.tsx` — mantener, solo actualizar claves i18n.
   - `OrderListContent.tsx` — añadir FX banner condicionado a `pendingFxCount`.

6. **`page-heading`:** Añadir el nuevo bloque `<div className="page-heading">` con `<h1>` + meta span al `src/app/[locale]/(app)/orders/page.tsx`. El meta "N activos · N cerrado" requiere computar `activeCount` y `closedCount` desde `totalCount` + `cancelledCount`. Puede ser un segundo `prisma.order.count` con filtro `COMPLETED` + `CANCELLED`.

7. **View transitions:** cada `order-row` / `s7-order-card` lleva `style={{ viewTransitionName: "order-${order.id}" }}` para la transición animada al detalle. Asegurarse de que `order-detail` declara el mismo `viewTransitionName`.

8. **`/` shortcut:** el atajo de teclado para enfocar el buscador puede registrarse en un `useEffect` en `OrderListContent`. Asegurarse de que no dispara cuando el foco está en un input.

9. **Comportamiento crítico a preservar:** la query actual (`getOrdersList`) filtra por `userId` — garantizar que este filtro no se rompa al refactorizar.
