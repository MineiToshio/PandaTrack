---
title: Order list
session: 07
status: html-in-progress
last_updated: 2026-05-09
demo_anchors:
  - "#s7-orders-list-loading"
  - "#s7-orders-list-default"
  - "#s7-orders-list-empty-initial"
  - "#s7-orders-list-empty-filtered"
  - "#s7-orders-list-filters-open"
  - "#s7-orders-list-mobile"
frd: docs/product/prd-01-collector-mvp/frd-05-order-payment-shipment/frd-05-order-payment-shipment.md
blueprint: docs/product/prd-01-collector-mvp/frd-05-order-payment-shipment/bp-02-order-workspace-and-list-experience/bp-02-order-workspace-and-list-experience.md
---

# Order list

> **Fuente visual de verdad:** `docs/redesign/_notes/demo-screens.html`. Los anchors arriba son la referencia canónica. Este spec describe el contrato funcional + tokens + componentes consumidos. Cualquier implementación debe ser reconocible como descendiente del demo.

## 1. Propósito y contrato funcional

Lista privada de pedidos del usuario autenticado (`/[locale]/orders`). Permite buscar, filtrar, paginar y ver un preview expandible de los ítems de cada pedido. Desde aquí el usuario crea nuevos pedidos y accede al detalle de cada uno.

Datos clave: lista paginada de `Order` (código PT-XXXXXX, tienda, fecha de creación, cantidad de productos, estado, total en moneda original, porcentaje pagado). El estado y el porcentaje pagado son las columnas de mayor densidad de información. Permisos: privado — solo el `userId` propietario ve sus pedidos.

<!-- PENDING A.3: completar con referencias FR-05-XX del FRD -->

## 2. Variantes y anchors del demo

| Anchor                           | Descripción                                      | Condición                       |
| -------------------------------- | ------------------------------------------------ | ------------------------------- |
| `#s7-orders-list-loading`        | Skeleton (filas pulsantes en tabla)              | SSR en curso / primera carga    |
| `#s7-orders-list-default`        | Lista poblada, sin filtros (solo "Solo activas") | Estado normal                   |
| `#s7-orders-list-empty-initial`  | Sin órdenes creadas aún                          | `totalCount === 0`, sin filtros |
| `#s7-orders-list-empty-filtered` | Sin resultados con filtros activos               | `totalCount === 0` con filtros  |
| `#s7-orders-list-filters-open`   | FilterDrawer superpuesto (right panel)           | Usuario pulsó "Filtrar"         |
| `#s7-orders-list-mobile`         | Vista mobile: tabla colapsada + card compacta    | `< 1024px`                      |

## 3. Layout y estructura

Vive dentro del `AppShell` con `Sidebar` izquierda y `MobileTabBar` inferior en mobile.

**Topbar:** título "Pedidos" + contador contextual derecha (`5 activos · 1 cerrado`). Usa `Header` como contenedor.

**Toolbar:** fila horizontal con cuatro elementos en orden: buscador → `FilterTriggerButton` → `Select` de ordenamiento → CTA `Nuevo pedido`.

- **Buscador** (`Input` tipo search): busca por **código de pedido** (PT-XXXXXX, match exacto o prefijo) **OR** **nombre de producto** (substring sobre `OrderItem.name`). "Tienda" NO está en el scope del buscador — vive únicamente en el FilterDrawer (`tag-autocomplete`). Tener tienda en ambos lugares crearía estado conflictivo y duplicaría el filtrado. Placeholder: `"Código o producto (ORD-20260428-01, Evangelion OST…)"`. Ver PLAYBOOK §9.13.
- **`FilterTriggerButton`** (M05 canónico): badge = cantidad de filtros activos.
- **`Select` "Ordenar por"** (`src/components/core/Select`): opciones y default definidos en PLAYBOOK §9.13. Default: `Más recientes` (`createdAt DESC`). Otras: `Más antiguas`, `Tienda A–Z`, `% Pago: menor`, `Total: mayor`.
- **CTA `Nuevo pedido`** (primary + icono `plus`).

**FX banner:** alerta inline (`role="status"`, `aria-live="polite"`) con icono `refresh-cw` + copy "N pedidos con tipo de cambio desactualizado · Actualizar ahora" (link acción). Visible cuando `pendingFxCount > 0`. Color `info`.

**Chips de filtros activos:** fila de `filter-chip` dismissibles debajo del toolbar. Cada chip representa un filtro activo (Estado, Tienda, etc.). Badge del `FilterTriggerButton` = cantidad de chips visibles.

**Tabla de pedidos:** 7 columnas en desktop, grid responsivo. Columnas (L060 canónico): Avatar → Pedido/Tienda → Productos → Estado → Total → % Pago → Chevron. Los headers de columna siguen L063: `text-align: center` en todos excepto "Pedido / Tienda" (`text-align: left`). Cada fila es expandible (chevron anclado al top, `position: static` en desktop — L059).

**Filas expandibles:** al pulsar el chevron, la fila muestra los ítems del pedido: icono de tipo de producto (ver §3.1), nombre, subtipo, estado individual del ítem (En camino / Pendiente / Listo en tienda / Entregado), cantidad, precio. CTA "Abrir detalle" al final de los ítems.

**Paginación:** canónico = `#s6-stores-list-default` (L062). Mobile: "Cargar más". Desktop: numérica con flechas + conteo "Mostrando A–B de N pedidos".

### 3.1 Íconos de tipo de producto en filas expandibles

Fuente canónica: `src/lib/catalog/storeProductTypeIcons.ts` — `getStoreProductTypeIcon(key)`.

Cada ítem muestra a la izquierda el ícono Lucide correspondiente a su `productTypeKey`. Si el ítem no tiene tipo asignado (`productTypeKey === null`), se usa el ícono por defecto `Tag` (`data-lucide="tag"`).

Al hacer hover sobre el ícono, aparece un tooltip nativo (`title`) con el label en español del tipo. La implementación debe pasar `title={t('productTypes.' + productTypeKey)}` (o el equivalente i18n) al contenedor del ícono. Para ítems sin tipo: `title={t('productTypes.none')}`.

**Mapping completo** (key → ícono Lucide → `data-lucide`):

| `productTypeKey`    | Ícono Lucide        | `data-lucide`        | Label ES            |
| ------------------- | ------------------- | -------------------- | ------------------- |
| `albums`            | `Music`             | `music`              | Álbumes / Vinilo    |
| `art_books`         | `Palette`           | `palette`            | Arte y libretas     |
| `books`             | `BookOpenText`      | `book-open-text`     | Libros              |
| `book_accessories`  | `BookMarked`        | `book-marked`        | Accesorios de libro |
| `comics`            | `BookImage`         | `book-image`         | Cómics              |
| `figures`           | `Shapes`            | `shapes`             | Figuras             |
| `funkos`            | `Package`           | `package`            | Funkos              |
| `funko_accessories` | `Tag`               | `tag`                | Accesorios Funko    |
| `home_video`        | `Film`              | `film`               | Vídeo doméstico     |
| `light_novels`      | `ScrollText`        | `scroll-text`        | Light Novels        |
| `manga`             | `BookOpen`          | `book-open`          | Manga               |
| `merchandise`       | `ShoppingBag`       | `shopping-bag`       | Merchandising       |
| `music`             | `Disc`              | `disc`               | Música              |
| `signatures`        | `Signature`         | `signature`          | Firmas              |
| `trading_cards`     | `GalleryThumbnails` | `gallery-thumbnails` | Trading Cards       |
| `video_games`       | `Gamepad2`          | `gamepad-2`          | Videojuegos         |
| _(sin tipo)_        | `Box`               | `box`                | Producto (sin tipo) |

El ícono por defecto para ítems sin `productTypeKey` es `Box` (`data-lucide="box"`), no el `Tag` que usa `getStoreProductTypeIcon` internamente — `Tag` está reservado para `funko_accessories`. En la implementación, renderizar `<Box />` cuando `productTypeKey === null` y `<Icon />` (resultado de `getStoreProductTypeIcon`) cuando está definido.

**Anti-patrón:** usar `disc-3` (vinilo detallado no existe en el map), `sparkles` u otros íconos no definidos en `STORE_PRODUCT_TYPE_ICON_MAP`. Siempre derivar el ícono de `getStoreProductTypeIcon(item.productTypeKey)` y mostrar `Box` cuando el tipo es `null`.

El mismo contrato aplica en la sección Productos del detalle de pedido — ver `order-detail.md` §3.1 (pendiente bootstrap).

<!-- PENDING A.3: completar con detalles de columnas, grid CSS, progressive disclosure, link de item a detalle -->

## 4. Variante: loading (skeletons)

`aria-busy="true"` en el contenedor tabla. Filas skeleton: 6 filas pulsantes replicando la estructura de la tabla (store-avatar placeholder + 5 columnas de barras gris). Toolbar con `Input` y botones deshabilitados.

<!-- PENDING A.3: detallar tokens de skeleton -->

## 5. Variante: lista poblada

Datos demo representativos:

- Solaris Books & Records — PT-000123 — 4 productos — Parcialmente en camino (`info`) — $1.240,00 USD — 60%
- Anime Corner Europe — PT-000118 — 2 productos — Atrasado 8d (`warning`) — €320,00 — 0%
- HMV Japan — PT-000115 — 6 productos — Parcialmente en camino (`info`) — ¥24.500 — 33%
- Mandarake — PT-000109 — 1 producto — Completo (`success`) — ¥18.000 — 100%

La columna `% Pago` usa: mini barra de progreso (60px × 3px) + porcentaje con `min-width: 3.2ch; text-align: right` (L060). La barra cambia de color según el estado: `var(--accent)` para pagado parcial, `var(--warning)` para atrasado/impago, `var(--success)` para completo.

El ícono del chip de estado es **siempre el mismo** en filter pill, fila de tabla, detalle y mobile card. Mapping canónico en PLAYBOOK §9.13 (L065). Anti-patrón: `package` para "En camino" (usa `truck`), `check-circle` para "Completo" (usa `package-check`).

<!-- PENDING A.3: condiciones de "Atrasado Nd", lógica de cálculo de días, chip compuesto estado+pago -->

## 6. Variante: vacío — sin órdenes (initial)

Usa `EmptyState` con `MascotBubble` en variante `sleeping`. Copy: "Sin pedidos aún" + subtítulo invitando a crear el primero + CTA primary "Nuevo pedido". Toolbar se mantiene activo (con el CTA).

<!-- PENDING A.3: confirmar copy i18n exact -->

## 7. Variante: vacío — con filtros activos

Usa `EmptyState` con `MascotBubble` en variante `confused`. Copy: "Sin resultados" + subtítulo sugiriendo ajustar filtros + CTA ghost "Limpiar filtros". La toolbar permanece activa para ajustar la búsqueda.

<!-- PENDING A.3: confirmar copy i18n exact -->

## 8. Variante: mobile

En mobile (`< 1024px`): la tabla colapsa a cards compactas (MobileTabBar visible en la parte inferior). Cada card muestra: avatar + nombre tienda + código + estado chip + total. Los ítems de la fila colapsada se ocultan; se navega directamente al detalle al pulsar la card. El chevron de expand no aparece en mobile.

<!-- PENDING A.3: confirmar layout mobile exact desde demo anchor #s7-orders-list-mobile -->

## 9. Variante: FilterDrawer abierto

`FilterDrawer` superpuesto. El contenido de fondo queda al 35% opacity + `pointer-events: none`. En desktop: panel derecho estático. En mobile: `Sheet` desde el borde derecho.

Secciones del drawer (en orden, confirmadas en demo):

1. **Estado** — pills multi-select: Activas, Abierto, En camino, Completo, Cancelado. OR dentro de la sección.
2. **Pago** — pills multi-select: Pagado, Pago parcial, Impago, Atrasado. OR dentro de la sección.
3. **Tienda** — `MultiTagAutocomplete` (`src/components/core/MultiTagAutocomplete.tsx`, L064, §9.12). Los chips de tiendas seleccionadas aparecen **dentro** del mismo contenedor bordeado que el input, no debajo. El `FilterDrawer` ya soporta `type: "tag-autocomplete"` — Fase B pasa la sección con `type: "tag-autocomplete"` y la lista de tiendas del usuario como `options`. Sin pills preset. `showSearchIcon={true}` para mostrar el icono `search` a la izquierda del área.
4. **Fecha de creación** — date range con dos `<input type="date">`: "Desde" y "Hasta". Labels 12px muted.
5. **Tipo de cambio** — `filter-switch-row` + `button.switch` (L064): "Solo con actualización pendiente". `aria-pressed="false"` por defecto.

Footer del drawer: botón ghost "Limpiar" + botón primary "Aplicar filtros" (flex: 1, icono `check`). Usa `Button` canónico.

Lógica: OR dentro de familia (Estado, Pago, Tienda), AND entre familias.

## 10. Tokens relevantes

| Elemento           | Token                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------- |
| Tabla surface      | `--surface-elevated` (card wrapper, `padding: 4px`)                                   |
| Progress bar track | `color-mix(in oklch, var(--text-primary) 8%, transparent)`                            |
| Progress bar fill  | `var(--accent)` (parcial) · `var(--warning)` (atrasado) · `var(--success)` (completo) |
| Filter chip accent | `color-mix(in oklch, var(--accent) 10%, transparent)` + border 22%                    |
| FX banner bg       | `color-mix(in oklch, var(--info) 8%, transparent)`                                    |
| Header count text  | `var(--text-muted)`, 13px                                                             |
| Column num text    | `font-variant-numeric: tabular-nums` (clase `num`)                                    |
| % Pago min-width   | `min-width: 3.2ch` en el número de porcentaje                                         |

## 11. Accesibilidad acordada

- `aria-busy="true"` en la tabla durante loading.
- Skeleton filas con `aria-hidden="true"`.
- FilterDrawer con `role="dialog"`, `aria-modal="true"`, `aria-label="Filtrar pedidos"`.
- Switch en filtro con `aria-pressed` + `aria-label` descriptivo.
- Chevron expand con `aria-label="Ver productos"` y `aria-expanded` (toggle al expandir).
- FX banner con `role="status"` + `aria-live="polite"`.
- Filas expandidas: ítems con estado del ítem anunciable cuando cambia.
- CTA "Nuevo pedido" con texto explícito (no solo icono).

<!-- PENDING A.3: completar con keyboard navigation del drawer, focus trap, focus restoration al cerrar -->
