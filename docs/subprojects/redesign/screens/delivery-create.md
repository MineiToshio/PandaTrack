---
title: Delivery create & edit
session: 09
status: spec-complete
last_updated: 2026-06-14
demo_anchors:
  - "#delivery-create"
  - "#s9-delivery-create-standalone"
  - "#s9-delivery-create-empty"
  - "#s9-delivery-edit"
  - "#s9-delivery-create-mobile"
frd: docs/product/prd-01-collector-mvp/frd-08-delivery-management/frd-08-delivery-management.md
blueprint: docs/product/prd-01-collector-mvp/frd-08-delivery-management/bp-01-delivery-management/bp-01-delivery-management.md
---

# Delivery create & edit

> **Fuente visual de verdad:** `docs/redesign/_notes/demo-screens.html` (anchors arriba). Aprobado en gate humano S9 Fase A (2026-06-12).
>
> **Nota de linaje:** este spec reemplaza el wireframe lo-fi S2 que vivía en este archivo. Decisiones del addendum ADR 0001 que sobreviven: el prefill de tienda usa **field-as-attribute** (D2 — intacta); las section cards gated del layout S2 evolucionaron a **pasos colapsados del wizard accordion** (ADR 0003 D5 las supersede); el chip "Aún no llega" `--info` quedó superseded por el mapping completo de ADR 0002. La edición comparte estructura y vive en este mismo spec (§7) — el módulo no amerita doc separado tipo order-edit.

## 1. Estructura común

```
app-topbar   → breadcrumb "Entregas › Nueva entrega" (o DLV-… en edición)
back-link    → "← Volver al pedido" (from-order) / "← Entregas" (standalone) / "← Volver a la entrega" (edit)
page-heading → h1 + meta contextual
stepper      → 4 pasos: Tienda · Productos · Datos de la entrega · Confirmar
form-grid    → wizard accordion + form-sidebar (solo Resumen)
```

Wizard accordion canónico: un paso expandido a la vez, "Continuar" SIEMPRE habilitado + validación inline al click (PLAYBOOK §3).

> **Iteración humana R3 (2026-06-14):** se retiró la card "Atajos" del aside (los atajos `/`, `A`, `Space` no aportaban y confundían; paridad con order-create que no la tiene). El único atajo que sobrevive es **⌘/Ctrl + Enter para enviar**, como texto plano junto al CTA del paso 4 (igual que orders).

## 2. Entry points (FR-08-15 / FR-08-16)

### 2.1 Desde pedido (`#delivery-create`) — `/deliveries/new?sourceOrderId={id}`

- Paso 1 **done** con `field-as-attribute` (ADR 0001 D2): badge "↳ Desde ORD-…" + tienda + botón Cambiar.
- Paso 2 activo: productos del pedido origen **pre-seleccionados**; los demás pedidos elegibles de la misma tienda aparecen como grupos adicionales **expandidos y desmarcados** (iteración humana R2: la opción de sumar de otros pedidos debe ser visible, no colapsada).
- Back-link "Volver al pedido".
- Entry points reales en order-detail: botón primary "Crear entrega" del aside Acciones + link "Crear entrega con estos productos" al pie del subcard Productos (ambos cableados en el demo S7).

### 2.2 Standalone (`#s9-delivery-create-standalone`) — `/deliveries/new`

- Paso 1 activo: **combobox de tienda** con dropdown abierto, búsqueda con fold de acentos. **Solo lista tiendas con ≥1 producto elegible** (FR-08-17), cada opción muestra "N productos sin entregar". Helper: "Solo aparecen tiendas con productos pendientes de entrega. Las tiendas sin pedidos abiertos no se listan."
- **Componente canónico compartido** (iteración humana R3, 2026-06-14): el campo usa `components/modules/StoreCombobox` — el mismo combobox que order-create (`OrderStoreField` pasa a ser su adaptador). El adaptador de entregas (`DeliveryStoreField`) inyecta el meta "productos sin entregar" y omite el escape hatch "crear tienda" (una tienda inelegible no se arregla aquí). Variante mobile vía `MobilePicker`, igual que orders.
- Al elegir tienda se cargan los productos elegibles del paso 2. **Cambiar de tienda invalida todo lo elegido aguas abajo**: limpia la selección de productos y su búsqueda (FR-08-34), resetea los datos del paso 3 y borra los checks "done" de los pasos 2-4 para reiniciarlos desde cero (no tiene sentido conservar productos de otra tienda).

### 2.3 Sin productos elegibles (`#s9-delivery-create-empty`)

Si no existe ninguna tienda con elegibles: empty state con icono `package-x`, título "Sin productos elegibles" y el copy FRD ("No hay productos de pedidos disponibles… ya están entregados, ya están en otra entrega o aún no están disponibles."). CTAs: `[Ver mis pedidos]` primary + `[Volver a entregas]` ghost.

## 3. Paso 2 · Productos (FR-08-04 / 04a / 18 / 19 / 34)

- Grupos colapsables por pedido origen: header `ORD-… · {fecha} · N elegibles` + toggle "Todo" (select-all por pedido).
- Checkbox binario por `OrderItem` (unidad atómica de envío — sin selector de cantidad, FR-08-04a). Cada row: icon-tile de tipo + nombre + chip de estado (`Listo en tienda` / `Pendiente en tienda`) + qty read-only.
- Búsqueda client-side case/accent-insensitive; grupos sin matches se ocultan; empty inline si nada coincide.
- Nota fija: "Puedes sumar productos de cualquier pedido de esta tienda. Los ya entregados o en otra entrega activa no aparecen acá." (FR-08-19: los inelegibles NO se muestran deshabilitados — directamente no aparecen).
- Footer del paso: contador "N productos seleccionados" + "Deshacer". Validación: ≥1 producto (FR-08-04).
- **Recuperación ante elegibilidad obsoleta (R3):** la lista elegible es un snapshot del render; un producto puede dejar de ser elegible entre la carga y el submit (entró a otra entrega, o la página se reabrió desde caché). Si `createDelivery` devuelve `PRODUCT_NOT_ELIGIBLE`, ahora reporta los `ineligibleProductIds`; el wizard **nombra** los productos afectados, los **quita** de la selección, refresca la elegibilidad (`router.refresh`) y devuelve al usuario al paso 2 — en vez del banner muerto "no elegible". Responde al "¿cuáles?" y al "¿por qué me los muestran?" del usuario.

## 4. Paso 3 · Datos de la entrega (FR-08-05/06/07/08/09/10/11)

| Campo                         | Regla                                                                                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fecha de envío \*             | date, prefill hoy, **solo pasadas o de hoy** (FR-08-05/06)                                                                                               |
| Llegada estimada (opcional)   | rango via DateRangePicker (componente S7); `hasta ≥ desde` (FR-08-11)                                                                                    |
| Costo de envío \*             | ≥ 0, **inicia vacío** (placeholder `0.00`, no un 0 prellenado — el envío casi nunca es gratis; R3); helper "Usa 0 si no tiene costo." (FR-08-07)         |
| Moneda \*                     | select; default = moneda base del usuario (FR-08-09); helper "Tu moneda base es USD."                                                                    |
| Tipo de cambio \* condicional | **Solo se renderiza si moneda ≠ base** (FR-08-10, paridad orders). Helper: "1 JPY = 0,0065 USD. Solo te lo pedimos porque la moneda difiere de tu base." |

El demo muestra ambos lados de la condición: create en JPY (campo visible) y edit en USD (campo ausente).

## 5. Paso 4 · Confirmar

Review **real** (lección M04): summary-list con Tienda / Productos (nombres) / Fecha de envío / Llegada estimada / Costo (con conversión "≈ $X USD" si aplica) + helper "Los N productos pasarán a **En camino** y el pedido origen se actualizará. Cuando confirmes, te llevamos a la entrega."

CTA: `[Crear entrega]` primary **sin chip kbd dentro del botón** — el atajo va como texto plano al lado: "o presiona ⌘ Enter" (iteración humana R2). Es el **único** atajo del flujo (R3): ⌘/Ctrl + Enter envía desde cualquier paso.

Post-submit: redirect a `/deliveries/{id}` (FRD). Productos pasan a `IN_TRANSIT`; `OrderStatus` de los pedidos origen se re-deriva en la misma transacción (data layer WO-01).

## 6. Aside (form-sidebar)

- **Resumen** reactivo (patrón AsideSummary S7): Tienda · Pedidos origen · Productos · Fecha de envío · Llegada est. · Costo envío · "En tu base" (conversión). **Pedidos origen apila un código por línea** (R3): con varios pedidos los `ORD-…` no caben lado a lado y se truncaban; `AsideSummaryRow` acepta `string[]` y los renderiza uno debajo de otro.
- ~~Atajos~~ — card retirada en R3 (ver §1).

## 7. Modo edición (`#s9-delivery-edit`) — FR-08-24 / BR-08-04

`/deliveries/{id}/edit`. **No es wizard**: section cards apiladas y siempre visibles (paridad order-edit), CTA "Guardar cambios" + "Descartar cambios" + texto "o presiona ⌘ Enter".

- **Tienda fija**: field-as-attribute sin acción + helper "La tienda no se puede cambiar: los productos de la entrega dependen de ella. Si te equivocaste de tienda, elimina esta entrega y crea otra."
- **Productos**: ítems actuales marcados con chip "En esta entrega"; al desmarcar uno, la row toma tint `--warning` + aviso inline "Al guardar vuelve a **Listo en tienda**" (FR-08-24). Pueden sumarse elegibles de la tienda (eligibility query con `excludeDeliveryId`).
- **Datos**: mismos campos del paso 3; FX condicional igual.
- **Aside "Resumen de cambios"**: resalta solo lo modificado (paridad order-edit `a89eee7`) — p. ej. "Productos 12 → 11" en `--warning`, "Llegada est. 18 may → 20–24 may" en `--accent` — + nota "1 producto vuelve a Listo en tienda al guardar."
- Solo editable en `IN_TRANSIT` (DELIVERED requiere reabrir primero — BR-08-04; CANCELLED ídem vía reabrir).

## 8. Mobile (`#s9-delivery-create-mobile`)

Topbar canónico + eyebrow compacto "Paso 2 de 4 · Productos" (patrón stepperCompactEyebrow). Field-as-attribute compacto, búsqueda, grupos de productos, sticky footer `[Atrás] [contador] [Continuar →]` con fondo `oklab` + blur (L074). Pickers de fecha/moneda usan `MobilePicker` (S7-A.9).

## 9. Accesibilidad

Labels en todos los campos, asterisco con texto accesible, checks de producto operables por teclado (Space), grupos con `aria-expanded`, validación inline anunciable (`role=alert`), combobox de tienda con `role=combobox/listbox/option`.

## 10. Notas para Fase B

- `DeliveryCreateForm.tsx` y `createDeliveryAction` ya existen (WO-02) — Fase B los **rediseña** sobre esta spec, no parte de cero. Schemas Zod (`deliveryCreateSchema`, `deliveryEditSchema`) ya cubren todas las reglas.
- Form de edición reusa el create como mode dispatcher (paridad con el refactor `e048f43` de OrderForm).
- Autosave de borrador en navegador (form-footer "Guardado en este navegador") queda **fuera de scope** de Fase B salvo pedido humano — el demo no lo promete en S9.
