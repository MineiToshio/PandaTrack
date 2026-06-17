---
title: Delivery list
session: 09
status: spec-complete
last_updated: 2026-06-12
demo_anchors:
  - "#deliveries"
  - "#s9-deliveries-list-loading"
  - "#s9-deliveries-list-empty"
  - "#s9-deliveries-list-empty-filtered"
  - "#s9-deliveries-list-mobile"
frd: docs/product/prd-01-collector-mvp/frd-08-delivery-management/frd-08-delivery-management.md
blueprint: docs/product/prd-01-collector-mvp/frd-08-delivery-management/bp-01-delivery-management/bp-01-delivery-management.md
---

# Delivery list

> **Fuente visual de verdad:** `docs/redesign/_notes/demo-screens.html`. Los anchors arriba son la referencia canónica. Este spec describe el contrato funcional + componentes + comportamiento. La implementación debe ser reconocible como descendiente del demo aprobado en S9 Fase A (gate humano 2026-06-12).

## 1. Layout

Paridad estructural con `order-list.md` (S7). Vive en el `AppShell`; desktop con sidebar PUSH, mobile con topbar canónico `[☰] + título`.

```
app-topbar (sticky)            → título "Entregas" (desktop, sin breadcrumb)
page-heading                   → <h1>Entregas</h1> + meta "3 en camino · 24 recibidas"
orders-toolbar                 → búsqueda · FilterTriggerButton (M05) · sort · [+ Nueva entrega]
orders-filter-chips            → chips removibles de filtros activos (default: "En camino")
card (lista tabular)           → head + rows expandibles + paginación
```

**Columnas desktop:** `[avatar] · Entrega / Tienda · Productos · Estado · Costo · Llegada est. · [expand]`.

- `Entrega / Tienda`: nombre de tienda en bold + `DLV-YYYYMMDD-NN · enviada {fecha}` en `<MonoCode>` + secundario.
- `Llegada est.`: rango compacto ("llega 15–22 may" / "esperada 25–30 abr"). **Si DELIVERED: muestra "Recibida {fecha}"** (FR-08-31). Si CANCELLED: "—".
- Filas DELIVERED a `opacity:0.75`, CANCELLED a `opacity:0.6` (paridad con COMPLETED en orders).

## 2. Componentes consumidos

| Componente | Origen | Notas |
| --- | --- | --- |
| `FilterTriggerButton` | `src/components/core/FilterTriggerButton/` | variant `label` desktop / `icon-only` mobile, badge = count de chips (M05) |
| `FilterDrawer` | `src/components/modules/FilterDrawer/` | config de §6.3 |
| `StatusChip` | core | mapping §5.5 |
| `StoreAvatar` | core | s32 desktop / s40 mobile |
| `MonoCode` | core | IDs `DLV-*` |
| Paginación / Cargar más | patrón S7 | desktop paginación numérica, mobile botón "Cargar más" (ADR 0001) |

Las filas expandibles y cards mobile siguen los patrones route-local de orders (`OrderListRow`/`s7-mob-card`). **Fase B debe evaluar promoción a `share/` vs duplicación route-local** (regla `project-structure.mdc`), porque la anatomía es casi idéntica.

## 3. Datos consumidos

`getDeliveriesForList(userId, filters, page)` (a crear en Fase B sobre el data layer WO-01):
store (nombre+avatar), `humanReadableId`, `deliveryDate`, `expectedArrivalFrom/To`, `status`, `receivedDate`, `cost`+`currencyCode`, `productCount`, items para expansión (nombre, qty, tipo).

## 4. Estados visuales

### 4.1 Default (`#deliveries`)
Lista poblada. Orden default **más antiguas → más nuevas** (`deliveryDate ASC`, FR-08-30). Página de 30.

### 4.2 Loading (`#s9-deliveries-list-loading`)
Skeleton de tabla (3 filas con shimmer `s7-mob-skel`), toolbar skeleton, `aria-busy="true"`. SSR-delivered: no usar fake client fallback (`react-next-components.mdc`).

### 4.3 Empty inicial (`#s9-deliveries-list-empty`)
Icon-tile `truck` accent + "Sin entregas todavía" + copy FRD ("Sigue cada entrega de tus pedidos, incluso cuando llegan por partes…") + CTAs `[+ Nueva entrega]` primary y `[Ver mis pedidos]` ghost.

### 4.4 Empty filtrada (`#s9-deliveries-list-empty-filtered`)
Icon `search-x` muted + "Sin resultados con estos filtros" + echo del término buscado + CTA ghost `[Limpiar filtros]`. Toolbar y chips permanecen visibles.

### 4.5 Mapping de chips de estado (ADR 0002)

| Estado | Chip | Variant | Ícono |
| --- | --- | --- | --- |
| `IN_TRANSIT` | En camino | `info` | `truck` |
| `IN_TRANSIT` + `expectedArrivalTo < hoy` | **Atrasada Nd** (derivado, reemplaza al base) | `warning` | `alert-circle` |
| `DELIVERED` | Llegó | `success` | `check-circle` |
| `CANCELLED` | Cancelada | `neutral` | `ban` |

### 4.6 Mobile (`#s9-deliveries-list-mobile`)
Topbar canónico; action row con búsqueda + filter trigger icon-only con badge + `[+ Nueva]`; chips removibles; cards verticales `s7-mob-card` (avatar s40, título tienda, `DLV-… · enviada {fecha}`, chip de estado, meta "N productos · llega X–Y" + costo). Tap en card → detalle; tap en expand-row → expansión inline. Footer "Cargar más".

## 5. Comportamiento e interacción

- **Default canónico:** sin params, la URL canonicaliza a `?status=IN_TRANSIT`; chip "En camino" visible y removible (BP-01). El parse NO auto-aplica defaults (paridad con la decisión de orders post-S8: el default vive en el href del nav).
- **Expansión de fila:** lista **plana** de productos, sin agrupar por pedido origen y sin metadata secundaria (FR-08-32) + link "Abrir detalle". La trazabilidad por pedido vive en el detalle.
- **Búsqueda:** código `DLV-*` o nombre de producto, case/accent-insensitive (paridad FR-08-34).
- **Sort:** select con `Más antiguas` (default) · `Más recientes` · `ETA más próxima` · `Tienda A–Z`.
- **FilterDrawer** (FR-08-28/29): Estado (pills multi) · Solo atrasadas (switch) · Llegada estimada (presets: Vence hoy / Próximos 7 días / Próximos 14 días / Este mes — mutuamente excluyentes con el rango manual) · Rango de llegada manual · Tienda (search) · Producto (texto) · Rango de fechas de envío. Filtros persisten en URL como chips removibles.
- **`[+ Nueva entrega]`** → `/deliveries/new` (entry standalone).
- **View-transition:** `view-transition-name: dlv-{humanId}` fila → hero del detalle (convención ADR 0001 extendida a entregas).

## 6. i18n

Namespace `deliveries.*` ya existente (`src/i18n/locales/{es,en}/deliveries.json`); Fase B agrega las keys de lista/filtros/sort/empty-filtered manteniendo glosario (`entrega` ↔ `delivery`, "Llegó", "En camino", "Cancelada", "Atrasada").

## 7. Accesibilidad

Paridad order-list: filas expandibles con `aria-expanded`, chips con ícono+label (ADR 0006), skeleton `aria-busy`, focus visible en toda la toolbar, tap targets ≥44px mobile.

## 8. Notas para Fase B

- El listado real reemplaza el placeholder `AppComingSoonCard` de `/deliveries`.
- `pendingFxCount`-style banner NO aplica a entregas (no hay reconciliación FX masiva en FRD-08).
- Conteo del badge del FilterTrigger = chips visibles del drawer; la búsqueda no incrementa (M05).
