---
title: ADR 0002 — Mapeo de estados (Order / Delivery / OrderItem) a chips visuales
date: 2026-05-02
status: accepted
session: post-S2 (accepted — implemented in StatusChip, shipped S7)
owner: Sergio Minei
---

# ADR 0002 — Mapeo de estados a chips visuales

## Contexto

Los wireframes lo-fi de S2 del subproyecto (histórico) usan chips de status con copy mock: "Activo", "Aún no llega", "Pagado", "Atrasado N días". Al revisar el demo del subproyecto de rediseño (histórico) con feedback humano, varios de esos chips no se mapean limpiamente al modelo de Prisma. "Activo" no existe como estado, "Aún no llega" es semánticamente débil, "Pagado" y "Atrasado" son derivados (no enum values).

Este ADR formaliza el mapeo entre los enums reales del schema (`prisma/schema.prisma`) y la representación visual en chips.

## Modelo real (prisma/schema.prisma)

### `OrderStatus`

```
OPEN
PARTIALLY_IN_TRANSIT
IN_TRANSIT
PARTIALLY_DELIVERED
COMPLETED
CANCELLED
```

### `DeliveryStatus`

```
IN_TRANSIT
DELIVERED
CANCELLED
```

### `OrderItemDeliveryState`

```
NONE
ARRIVED_AT_STORE
IN_TRANSIT
DELIVERED
```

## Decisión 1 — Mapeo de `OrderStatus` a chip principal

| Enum value             | Copy `es`              | Variant chip      | Ícono Lucide    |
| ---------------------- | ---------------------- | ----------------- | --------------- |
| `OPEN`                 | Abierto                | `neutral`         | `clock`         |
| `PARTIALLY_IN_TRANSIT` | Parcialmente en camino | `info`            | `truck`         |
| `IN_TRANSIT`           | En camino              | `info`            | `truck`         |
| `PARTIALLY_DELIVERED`  | Llegó parcialmente     | `success` (suave) | `package-open`  |
| `COMPLETED`            | Completo               | `success`         | `package-check` |
| `CANCELLED`            | Cancelado              | `neutral`         | `ban`           |

> **Enmienda 2026-06-12** — la versión original de esta tabla usaba `package` para los estados en camino y `check-circle` para `COMPLETED`. El playbook §9.13 (S7-A.2, L065) lo declaró anti-patrón: `package` confunde "paquete físico" con "estado de orden" y `check-circle` confunde "pagado" con "entregado" (`check-circle` queda reservado para el estado de pago "Pagado"). Los filter pills de Orders y `describeOrderListChip` ya implementaban `truck`/`package-check`; esta enmienda alinea la tabla (y `<StatusChip kind="orderStatus">`) con ese mapeo para que el mismo estado use el mismo ícono en toda superficie.

**Reglas:**

- El chip principal de un pedido se calcula a partir de `OrderStatus` puro, no derivados.
- En `dark` mode los chips usan los mismos tokens (success/info/warning/destructive) que ya respetan a11y.

## Decisión 2 — Estados derivados como chip secundario

Algunos estados no son enum del schema, son derivados a runtime. Se renderizan como **chip secundario** al lado del chip principal de status, no lo reemplazan.

| Estado derivado  | Condición                                                                 | Copy `es`       | Variant chip  |
| ---------------- | ------------------------------------------------------------------------- | --------------- | ------------- |
| **Pagado**       | `paidAmount === totalCost`                                                | Pagado          | `success`     |
| **Pago parcial** | `0 < paidAmount < totalCost`                                              | N% pagado       | `accent` soft |
| **Sin pagar**    | `paidAmount === 0`                                                        | Sin pagar       | `neutral`     |
| **Atrasado**     | `expectedDeliveryTo < now` y `OrderStatus !== COMPLETED && !== CANCELLED` | Atrasado N días | `warning`     |

**Regla de prioridad cuando varios derivados aplican:**

1. `Atrasado` siempre se muestra si aplica (es el más urgente para el coleccionista).
2. `Pagado` se muestra si llegó a 100% (es ancla emocional positiva).
3. Los demás (`Sin pagar`, `Pago parcial`) viven en la barra de progreso de pago, no como chip.

## Decisión 3 — Mapeo de `DeliveryStatus` a chip

| Enum value   | Copy `es` | Variant chip | Ícono          |
| ------------ | --------- | ------------ | -------------- |
| `IN_TRANSIT` | En camino | `info`       | `truck`        |
| `DELIVERED`  | Llegó     | `success`    | `check-circle` |
| `CANCELLED`  | Cancelada | `neutral`    | `ban`          |

**Estado derivado adicional:**

| Estado       | Condición                                                   | Copy            | Variant chip |
| ------------ | ----------------------------------------------------------- | --------------- | ------------ |
| **Atrasada** | `DeliveryStatus === IN_TRANSIT` y `expectedArrivalTo < now` | Atrasada N días | `warning`    |

`Atrasada` reemplaza al chip `En camino` cuando aplica (es información más urgente).

## Decisión 4 — Mapeo de `OrderItemDeliveryState` a chip

Este enum aplica al estado de cada **item del pedido** respecto a entregas. Se ve principalmente en:

- Sub-card "Items" del Detalle de pedido.
- Lista de productos elegibles en `/deliveries/new`.

| Enum value         | Copy `es`           | Variant chip | Ícono           |
| ------------------ | ------------------- | ------------ | --------------- |
| `NONE`             | Pendiente en tienda | `neutral`    | `clock`         |
| `ARRIVED_AT_STORE` | Listo en tienda     | `success`    | `check-circle`  |
| `IN_TRANSIT`       | En camino           | `info`       | `truck`         |
| `DELIVERED`        | Entregado           | `success`    | `package-check` |

**Notas:**

- En `/deliveries/new` los items elegibles son `NONE` o `ARRIVED_AT_STORE`. Los demás no aparecen.
- `ARRIVED_AT_STORE` es el sweet spot para anotar entregas (la tienda física ya tiene el producto, listo para despachar).
- Reemplaza el placeholder "Aún no llega" que confundía sin agregar valor.

## Decisión 5 — Variant `neutral` del chip

Hoy el sistema de chips de Atelier (S1 + ADR 0001) tiene 4 variants: `success`, `warning`, `destructive`, `info`. Se necesita una **5ta variant `neutral`** para los estados sin urgencia ni valor cromático (`OPEN`, `CANCELLED`, `NONE`).

Spec de `neutral`:

- Background: `var(--surface-elevated)`
- Border: `var(--border-strong)` 1px
- Text: `var(--text-secondary)`
- Ícono: `var(--text-muted)` (o `var(--text-secondary)` cuando el chip está activo en filtros)

Cumple a11y: 4.5:1 sobre `--surface` por construcción del color-mix.

## Decisión 6 — Filtros en lista de pedidos / entregas

Los filtros del filter drawer/sheet usan los enums reales con copy `es`:

**Filtros pedidos:**

- Estado del pedido (multi-select): `OPEN`, `PARTIALLY_IN_TRANSIT`, `IN_TRANSIT`, `PARTIALLY_DELIVERED`, `COMPLETED`, `CANCELLED`.
- Pago (multi-select, derivado): `Sin pagar`, `Pago parcial`, `Pagado`, `Atrasado`.
- Tienda (combobox).
- Categorías de producto (multi-select chips).
- Rango de fechas — fecha de pedido.
- Rango de fechas — llegada esperada.

**Filtros entregas:**

- Estado (multi-select): `IN_TRANSIT`, `DELIVERED`, `CANCELLED`.
- Solo atrasadas (toggle, derivado).
- Tienda (combobox).
- Rango de fechas — fecha de entrega.
- Rango de fechas — ETA.

## Razones para cerrar este ADR ahora

- Los wireframes lo-fi de S2 quedaron con copy placeholder. Sin ADR explícito, cada implementación puede inventar copy distinto y romper consistencia cross-pantalla (lista, detalle, dashboard, activity feed, toasts).
- El demo visual exposo "Activo" y "Aún no llega" como chips, copy que no se mapea a enum.
- Cuando se conecten queries reales en S6+, el componente `<StatusChip kind="orderStatus" value={enumValue} />` necesita el contrato cerrado de qué copy y qué variant le toca a cada enum.

## Implicancias en código

- **Componente core S4:** `<StatusChip>` con discriminated union por `kind` (`orderStatus | deliveryStatus | itemDeliveryState | derived`).
- **i18n:** las strings van a `src/i18n/locales/{es,en}/status.json` con keys tipadas `status.order.OPEN`, `status.delivery.DELIVERED`, etc.
- **Helpers de derivación:** `lib/status/derive.ts` exporta `isOverdue(order)`, `paymentBucket(order)`, `deliveryOverdueDays(delivery)`.

## Rollback

Si la validación humana en S6 muestra que "Parcialmente en camino" es muy largo en mobile, se acorta a "Parcial · en camino" o se reemplaza por ícono + tooltip. Idem para "Llegó parcialmente".

## Próximos pasos

1. Aplicado al demo: el demo del subproyecto de rediseño (histórico) ya usa este mapeo en lista de Pedidos, lista de Entregas, Detalle de pedido, productos en Nueva entrega y filtros del drawer.
2. Pendiente: actualizar los wireframes lo-fi del subproyecto (listas de pedidos y nueva entrega, histórico) para usar copy de este ADR (en lugar de "Activo"/"Aún no llega" placeholder).
3. Pendiente para S4: implementar `<StatusChip>` core con este contrato.
