---
title: Delivery detail
session: 09
status: spec-complete
last_updated: 2026-06-12
demo_anchors:
  - "#s9-delivery-detail"
  - "#s9-delivery-detail-delivered"
  - "#s9-delivery-detail-cancelled"
  - "#s9-delivery-mark-delivered-modal"
  - "#s9-delivery-cancel-modal"
  - "#s9-delivery-delete-modal"
  - "#s9-delivery-detail-mobile"
  - "#s9-mark-delivered-sheet-mobile"
  - "#s9-delivery-actions-sheet-mobile"
frd: docs/product/prd-01-collector-mvp/frd-08-delivery-management/frd-08-delivery-management.md
blueprint: docs/product/prd-01-collector-mvp/frd-08-delivery-management/bp-01-delivery-management/bp-01-delivery-management.md
---

# Delivery detail

> **Fuente visual de verdad:** `docs/redesign/_notes/demo-screens.html` (anchors arriba). Aprobado en gate humano S9 Fase A (2026-06-12). Paridad estructural con `order-detail.md`; mismo vocabulario §9.17 del PLAYBOOK.

## 1. Layout

```
app-topbar     → breadcrumb "Entregas › DLV-YYYYMMDD-NN" (id en JetBrains Mono)
back-link      → "← Entregas"
detail-grid    → columna principal + aside sticky (Decisión 7 ADR 0003)
```

**Columna principal:** hero + subcard Productos.
**Aside (orden fijo):** Resumen (`cool`) → Acciones (`accent` + `zap`) → Tu nota privada (`warm`). Vocabulario §9.17 congelado.

> ⛔ **Sin card Historial.** BR-08-05 excluye el timeline automático del MVP de entregas (a diferencia de order-detail). No copiarlo por simetría.

## 2. Hero

`detail-hero` con `s8-card-accent` + `view-transition-name: dlv-{humanId}`.

- Head: `StoreAvatar s56` + nombre de tienda + `DLV-…` con botón copiar + chip de estado.
- Eyebrow chip: **"Tu entrega · N productos"** (tone según estado: accent en camino, `tone-success` llegó, `tone-destructive` atenuado cancelada).
- **El dato protagonista es la ventana de llegada, no un monto** (decisión S9-D1): label "Llegada estimada" + rango grande (`detail-hero-amount`) + sub "enviada el {fecha}" + progress temporal de la ventana + caption con costo (`¥3.800 (≈ $24,70 USD)` si hay FX).

**Variantes:**

| Estado | Hero |
| --- | --- |
| `IN_TRANSIT` (`#s9-delivery-detail`) | Ventana ETA + progress + "quedan N días…" |
| `DELIVERED` (`…-delivered`) | "ENTREGA RECIBIDA" uppercase `--success` + "el {receivedDate} · enviada el {fecha}" (paridad con el uppercase paid-in-full de orders) |
| `CANCELLED` (`…-cancelled`) | "ENTREGA CANCELADA" uppercase `--text-muted`, head a opacity 0.8, border-top neutro (sin top-accent), nota "Los N productos volvieron a Listo en tienda" |

## 3. Productos (subcard `cool`, expandida por defecto)

Agrupados por **pedido origen** (FR-08-18): label mono uppercase "DESDE `ORD-…` · {fecha}" — el `ORD-…` es link al detalle del pedido — seguido de `item-row`s con chip de estado del producto (`s7-istate`: En camino / Entregado / Listo en tienda según el estado de la entrega).

## 4. Acciones (matriz por estado — FR-08-26/27)

| Estado | Primary | Resto |
| --- | --- | --- |
| `IN_TRANSIT` | **Marcar como llegada** (`package-check`) | Editar entrega (ghost) · Cancelar entrega (ghost) · Eliminar entrega (destructive-ghost) |
| `DELIVERED` | **Reabrir entrega** (`rotate-ccw`) | Editar y Eliminar **disabled** + helper "Reabre la entrega para editarla o eliminarla." (BR-08-04 / BR-08-07) |
| `CANCELLED` | **Reabrir entrega** | Eliminar entrega (habilitado) + helper "Al reabrir, los productos vuelven a En camino." |

- **Marcar como llegada** abre modal/sheet (§5.1). **Reabrir NO lleva modal** (no destructiva, decisión S9-D3): ejecuta directo con toast neutral-undo (ADR 0001 D4).
- Mobile: sticky action bar single-primary (§9.16 + ADR 0011): `[⋯] [Editar accent] [Marcar llegada primary]`; el `⋯` abre el sheet "Más acciones" (`#s9-delivery-actions-sheet-mobile`) con Editar / Cancelar (warning) / Eliminar (destructive).

## 5. Modales (adaptive M06 — desktop dialog / mobile sheet Vaul)

### 5.1 Marcar como llegada (FR-08-22) — `tone-success`
Icono `package-check`. Campo **Fecha de recepción** (date, required, ≤ hoy, default hoy) + info box success: "Los N productos pasarán a Entregado y los pedidos origen se actualizarán. Podrás reabrir la entrega si algo no llegó bien." Footer: Cancelar ghost + CTA `--success` "Marcar como llegada".

### 5.2 Cancelar entrega — `tone-warning`
Icono `ban`. Body: pasa a Cancelada, registro se conserva, productos vuelven a **Listo en tienda** y quedan disponibles; reversible vía reabrir. Footer: Volver ghost + CTA `--warning` "Cancelar entrega".

### 5.3 Eliminar entrega — `tone-destructive` + type-to-confirm
Icono `trash-2`. Body: irreversible, productos vuelven a Listo en tienda, **los pedidos origen no se tocan**. Input "Escribe eliminar para confirmar" gatea el CTA (paridad S7 delete). Solo invocable en `IN_TRANSIT` / `CANCELLED` (BR-08-07).

## 6. Resumen (aside `cool`)

Tienda (link a store-detail) · Fecha de envío · Llegada estimada (o "Fecha de recepción" si DELIVERED) · Costo de envío · Tipo de cambio (solo si moneda ≠ base, formato "1 JPY = 0,0065 USD") · Pedidos origen (`MonoCode`, multivalor).

## 7. Tu nota privada (aside `warm` — FR-08-25 / BR-08-06)

Mismo componente/patrón de orders y stores: textarea única, autosave con debounce ~800ms, indicador "Guardada hace Ns", max 2000 chars, guardar vacío limpia. Placeholder propio: "Escribe una nota o recordatorio para esta entrega…"; helper sugiere tracking/courier.

## 8. Mobile (`#s9-delivery-detail-mobile`)

Topbar canónico con breadcrumb "Entregas › DLV-…". Contenido apilado: hero compacto → Productos agrupados → Resumen → Nota privada. Sticky action bar (§4). Fondo del bar: `color-mix(in oklab, var(--background) 92%, transparent)` + blur — **oklab, no oklch** (lección L074).

## 9. Accesibilidad

Modales `role=dialog`/`alertdialog` + `aria-modal` + labelledby; chips ícono+label (ADR 0006); disabled sin opacity-only (mantener helper textual que explique por qué); botón copiar con `aria-label`; sticky bar no tapa contenido (padding-bottom del main).

## 10. Notas para Fase B

- Estados de producto y derivación de `OrderStatus` ya existen en data layer (WO-01: `deliveryState.ts`, `persistDerivedOrderStatuses`). El detalle solo consume.
- Mutaciones a crear: `markDelivered` (con `receivedDate`), `reopen`, `cancel`, `delete`, `updateNote` — todas optimistas (regla `optimistic-client-updates.mdc`): modal cierra sincrónico, hero/chips se actualizan local, revert + toast en fallo.
- Variantes mobile de DELIVERED/CANCELLED no tienen anchor propio: derivan de la desktop + el patrón mobile IN_TRANSIT (decisión S9 de profundidad mobile; ampliar si Fase B lo necesita).
