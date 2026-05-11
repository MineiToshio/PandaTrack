---
title: Order detail
session: 07
status: spec-complete
last_updated: 2026-05-10
demo_anchors:
  - "#s7-order-detail-active"
  - "#s7-order-detail-cancelled"
  - "#s7-order-detail-completed-unpaid"
  - "#s7-order-detail-overdue"
  - "#s7-order-detail-partially-paid"
  - "#s7-order-detail-pay-modal"
  - "#s7-order-detail-delete-modal"
  - "#s7-order-detail-cancel-modal"
  - "#s7-order-detail-mobile"
frd: docs/product/prd-01-collector-mvp/frd-05-order-payment-shipment/frd-05-order-payment-shipment.md
blueprint: docs/product/prd-01-collector-mvp/frd-05-order-payment-shipment/bp-02-order-workspace-and-list-experience/bp-02-order-workspace-and-list-experience.md
prior_spec: docs/redesign/screens/order-detail.md (sesión 02, metodología vieja — sustituido por este archivo)
---

# Order detail

> **Fuente visual de verdad:** `docs/redesign/_notes/demo-screens.html`. Los anchors arriba son la referencia canónica. Este spec describe el contrato funcional, datos, comportamiento e interacción de la pantalla de detalle de pedido. La implementación debe ser reconocible como descendiente del demo aprobado en S7 Fase A.

## 1. Layout

Ruta: `/[locale]/orders/[id]`. Vive dentro del `AppShell` con `Sidebar` en desktop, sin sidebar en mobile (barra de acciones sticky inferior en su lugar).

**Estructura vertical (desktop):**

```
┌──────────────────────────────────────────────────────┐
│  app-topbar (sticky 48px)                            │
│  ← Pedidos > ORD-YYYYMMDD-NN                         │
├──────────────────────────────────────────────────────┤
│  [Overdue alert banner — solo si atrasado]           │
│  ← Pedidos (back-link)                               │
├────────────────────────────────┬─────────────────────┤
│  Main column (≈ 63%)           │  Aside (≈ 37%)       │
│                                │  [sticky top:80px]  │
│  detail-hero                   │  Card "Pagos"        │
│  ┌──────────────────────────┐  │  ├ pay-row × N      │
│  │ avatar + nombre + código │  │  ├ totales           │
│  │ + chip(s) de estado      │  │  └ "Anotar pago"    │
│  │ eyebrow "Tu pedido · CUR"│  │                     │
│  │ Saldo pendiente / Total  │  │  Card "Acciones"    │
│  │ $XXX.XX                  │  │  ├ Crear entrega    │
│  │ de $YYY.YY CURRENCY      │  │  ├ Editar pedido    │
│  │ [progress bar]           │  │  ├ Cancelar pedido  │
│  │ XX% pagado · estimado    │  │  └ Eliminar pedido  │
│  └──────────────────────────┘  │                     │
│                                │  Card "Nota privada"│
│  subcard "Productos" (open)    │  └ textarea autosave│
│  subcard "Historial" (closed)  │                     │
│                                │                     │
└────────────────────────────────┴─────────────────────┘
```

**Estructura vertical (mobile, `< 1024px`):**

```
┌──────────────────────────────────────────┐
│  app-topbar: ← Pedidos > ORD-… [···]    │
├──────────────────────────────────────────┤
│  [overdue alert banner si aplica]        │
│  detail-hero (full width, padding 16px) │
│  subcard "Productos" (open)             │
│  subcard "Pagos" (collapsed)            │
│  subcard "Nota privada" (collapsed)     │
│  [Historial se omite en mobile]         │
├──────────────────────────────────────────┤
│  Sticky action bar (fixed bottom)       │
│  [Pago primary] [Entrega primary] [✎]  │
└──────────────────────────────────────────┘
```

**Anchors del demo:**

| Anchor                              | Descripción                                                     | Condición                                    |
| ----------------------------------- | --------------------------------------------------------------- | -------------------------------------------- |
| `#s7-order-detail-active`           | Estado activo (PARTIALLY_IN_TRANSIT)                            | Normal                                       |
| `#s7-order-detail-cancelled`        | Cancelado — hero muted, Reactivar en acciones                   | `status === CANCELLED`                       |
| `#s7-order-detail-completed-unpaid` | Completo + saldo pendiente — dual chip, color warning en saldo  | `status === COMPLETED` + `hasUnpaidBalance`  |
| `#s7-order-detail-overdue`          | Atrasado — alert banner visible, dual chip en hero              | `expectedDeliveryTo < today` + status activo |
| `#s7-order-detail-partially-paid`   | Pago parcial en curso — progress warning color                  | `paymentPercentage > 0 && < 100`, atrasado   |
| `#s7-order-detail-pay-modal`        | Formulario inline "Anotar pago" expandido dentro del card Pagos | Usuario pulsó "Anotar pago"                  |
| `#s7-order-detail-delete-modal`     | Modal ADR 0008 B destructivo para confirmar eliminación         | Usuario pulsó "Eliminar pedido"              |
| `#s7-order-detail-cancel-modal`     | Modal ADR 0008 B warning para confirmar cancelación             | Usuario pulsó "Cancelar pedido"              |
| `#s7-order-detail-mobile`           | Vista mobile con sticky action bar inferior                     | `< 1024px`                                   |

**back-link:** `"← Pedidos"` — link texto minimal bajo el `app-topbar`, antes del contenido. Ausente de la pantalla de lista (top-level). El `app-topbar` lleva el breadcrumb "Pedidos > ORD-YYYYMMDD-NN".

**No hay `page-heading`** — el `detail-hero` actúa como heading visual de la página. Añadir un `<h1>` separado sería redundante con el nombre de tienda + código del hero.

## 2. Componentes consumidos

| Componente                                     | Ruta fuente                                              | Props clave                                                 | Uso específico en esta pantalla                                                                                                                                          |
| ---------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Header`                                       | `src/components/modules/Header.tsx`                      | `breadcrumb=[{label:"Pedidos",href}]`, `title={order.code}` | Topbar con breadcrumb "Pedidos" clicable + título "ORD-YYYYMMDD-NN".                                                                                                     |
| `BackNavLink`                                  | `src/components/core/BackNavLink.tsx` — **NO usar aquí** | —                                                           | Ver §11 anti-patrones. El back-link en esta pantalla usa el patrón `back-link` de demo (texto minimal), no el pill de `BackNavLink`.                                     |
| `Modal` (ADR 0008 B)                           | `src/components/core/Modal.tsx`                          | `variant="destructive"` / `variant="warning"`               | Para confirm de Eliminar y Cancelar. Canónico ADR 0008 (`.cursor/rules/modal-canonical-pattern.mdc`).                                                                    |
| `Button`                                       | `src/components/core/Button.tsx`                         | varios variants                                             | CTA "Anotar pago" (accent), "Crear entrega" (primary), "Editar pedido" (ghost), "Cancelar pedido" (ghost), "Eliminar pedido" (destructive-ghost), "Reactivar" (primary). |
| `Textarea`                                     | `src/components/core/Textarea.tsx`                       | `maxLength={2000}`, `rows={3}`                              | Campo de nota privada. Autosave on blur.                                                                                                                                 |
| `Input` (number)                               | `src/components/core/Input.tsx`                          | `type="number"`, `min={0.01}`                               | Campo de monto en formulario inline de pago.                                                                                                                             |
| `Input` (date)                                 | `src/components/core/Input.tsx`                          | `type="date"`, `max={today}`                                | Campo de fecha en formulario inline de pago.                                                                                                                             |
| `Toast` / Sonner                               | `src/components/core/Toast.tsx`                          | `variant="neutral-undo"`                                    | Toast de undo tras borrar pago (5s). Toast de achievement tras pago completo.                                                                                            |
| `MascotBubble`                                 | `src/components/core/MascotBubble.tsx`                   | `variant="celebrating"`                                     | Solo en achievement post-pago completo dentro del toast. Nunca en estado de error o cancellación.                                                                        |
| `OrderDetailHero` (local, a crear o verificar) | `src/app/[locale]/(app)/orders/[id]/_components/`        | `order`, `isOverdue`, `overduedays`                         | Hero card con avatar, código, chips, eyebrow, cifra de saldo, progress bar.                                                                                              |
| `OrderItemsSubcard` (local)                    | `src/app/[locale]/(app)/orders/[id]/_components/`        | `items`, `orderId`                                          | Subcard "Productos" con lista de ítems + link "Crear entrega con estos productos".                                                                                       |
| `OrderPaymentsPanel` (local)                   | `src/app/[locale]/(app)/orders/[id]/_components/`        | `payments`, `totalCost`, `remainingAmount`, `orderId`       | Card "Pagos" con lista + formulario inline + "Anotar pago". Sticky en desktop.                                                                                           |
| `OrderActionsPanel` (local)                    | `src/app/[locale]/(app)/orders/[id]/_components/`        | `eligibility`, `orderId`                                    | Card "Acciones" con botones condicionales según `eligibility`.                                                                                                           |
| `OrderNotePanel` (local)                       | `src/app/[locale]/(app)/orders/[id]/_components/`        | `note`, `orderId`                                           | Card "Nota privada" con textarea + autosave.                                                                                                                             |
| `OrderHistorySubcard` (local)                  | `src/app/[locale]/(app)/orders/[id]/_components/`        | `history[]`                                                 | Subcard "Historial" colapsada por defecto. Solo visible en desktop (se omite en mobile).                                                                                 |
| `CancellationReasonCallout` (local)            | `src/app/[locale]/(app)/orders/[id]/_components/`        | `reason`                                                    | Callout con motivo de cancelación. Solo renderizado si `cancellationReason !== null`.                                                                                    |

## 3. Datos consumidos

**Query principal:** `getOrderDetail(orderId, userId)` — `src/lib/data/orders/orderQueries.ts`

```ts
// Resultado completo del detalle
type OrderDetailFull = {
  id: string;
  code: string; // ORD-YYYYMMDD-NN
  orderDate: Date;
  expectedDeliveryFrom: Date | null;
  expectedDeliveryTo: Date | null;
  currencyCode: string;
  exchangeRate: number | null;
  totalCost: number;
  status: OrderStatus;
  cancellationReason: string | null;
  privateNote: string | null;
  store: { id: string; name: string; slug: string };
  items: OrderItemWithDeliveryState[]; // ver §3.1
  payments: Array<{
    id: string;
    amount: number;
    paymentDate: Date;
  }>;
  history: Array<{
    id: string;
    event: string;
    createdAt: Date;
  }>;
  paidAmount: number;
  remainingAmount: number;
  paymentPercentage: number; // 0–100
  hasUnpaidBalance: boolean;
  eligibility: {
    canEdit: boolean; // false si CANCELLED
    canCancel: boolean; // false si COMPLETED o CANCELLED
    canReactivate: boolean; // true solo si CANCELLED
    canDelete: boolean; // false si tiene delivery items activos (FR-05-24)
    canCreateDelivery: boolean; // false si CANCELLED
  };
};

// §3.1: Item con estado de entrega
type OrderItemWithDeliveryState = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number | null;
  productTypeKey: string | null;
  deliveryState: ItemDeliveryState; // PENDING | IN_TRANSIT | ARRIVED | DELIVERED
};
```

**Modelo Prisma:** `Order`, `OrderItem`, `OrderPayment`, `OrderHistory`, `Store`, `DeliveryItem`, `Delivery`.

**Permisos:** la query filtra por `userId` — un no-propietario recibe `null` y la página renderiza 404 (o redirect a lista). Nunca exponer detalles de pedidos ajenos.

**`isOverdue`:** derivado en el componente o query: `order.status not in [COMPLETED, CANCELLED] && order.expectedDeliveryTo !== null && order.expectedDeliveryTo < today`.

**`overdueDays`:** `Math.ceil((today - order.expectedDeliveryTo) / 86400000)`.

## 4. Server actions invocadas

| Acción                                             | Archivo                             | Cuándo se invoca                            | Resultado                                           |
| -------------------------------------------------- | ----------------------------------- | ------------------------------------------- | --------------------------------------------------- |
| `addPaymentAction(orderId, {amount, paymentDate})` | `_actions/orderPaymentActions.ts`   | Click "Guardar pago" en formulario inline   | Optimistic add de la row; revalidate en server      |
| `deletePaymentAction(paymentId, orderId)`          | `_actions/orderPaymentActions.ts`   | Click × en pay-row                          | Optimistic remove + neutral-undo toast 5s           |
| `saveOrderNoteAction(orderId, rawNote)`            | `_actions/orderNoteActions.ts`      | Blur del textarea (throttle 1.5s)           | Muestra "Guardada hace 0s" → counter                |
| `cancelOrderAction(orderId)`                       | `_actions/orderLifecycleActions.ts` | Confirm en modal "Cancelar pedido"          | Redirect a detalle (misma página, estado CANCELLED) |
| `deleteOrderAction(orderId, locale)`               | `_actions/orderLifecycleActions.ts` | Confirm en modal "Eliminar pedido"          | Redirect a lista de pedidos                         |
| `reactivateOrderAction(orderId)`                   | `_actions/orderLifecycleActions.ts` | Click "Reactivar pedido" (CANCELLED → OPEN) | Recargar detalle con estado OPEN                    |

**Nota:** `createDelivery` no se invoca desde aquí — el link "Crear entrega con estos productos" y el botón "Crear entrega" navegan a `/deliveries/new?sourceOrderId=` (pantalla propia).

## 5. Estados visuales

### 5.1 Activo / en tránsito (`#s7-order-detail-active`)

**Hero:** avatar 56px + nombre tienda + código ORD-YYYYMMDD-NN + chip de estado (ej. `info` "Parcialmente en camino"). Eyebrow "Tu pedido · {currency}". Label "Saldo pendiente" + cifra grande `num` + "de {total} {currency}". Progress bar (color `var(--accent)` para pago normal). "XX% pagado · entrega estimada {date}".

**Subcards:** Productos (open) + Historial (closed).

**Aside:** card Pagos (sticky) + card Acciones [Crear entrega (primary), Editar (ghost), Cancelar (ghost), Eliminar (destructive-ghost)] + card Nota privada.

### 5.2 Cancelado (`#s7-order-detail-cancelled`)

**Hero:** `opacity:0.75` en el `detail-hero`. Chip neutral "Cancelado" (`ban`). Label "Total" (no "Saldo pendiente"). "Sin pagos registrados" si no hay pagos.

**Callout de cancelación:** bloque `role="note"` con ícono `ban` + "Motivo de cancelación" + texto del motivo. Solo renderizado cuando `cancellationReason !== null`.

**Subcards items:** `opacity:0.6` en `.subcard-body-inner`.

**Aside Pagos:** solo texto "Sin pagos registrados." (sin botón "Anotar pago" — no se puede pagar un pedido cancelado).

**Aside Acciones:** [Reactivar pedido (primary)] [Editar pedido (ghost, disabled)] [Crear entrega (ghost, disabled)] [Eliminar pedido (destructive-ghost)]. Editar y Crear entrega tienen `disabled`, `aria-disabled="true"`, `opacity:0.45`, tooltip explicativo.

### 5.3 Completo + saldo pendiente (`#s7-order-detail-completed-unpaid`)

**Hero:** dual chip: `success` "Completo" (`package-check`) + `warning` "Saldo pendiente" (`alert-triangle`). Cifra hero con `color:var(--warning)`. Progress bar con `background:var(--warning)`. "XX% pagado · entregado {mes año}".

**Aside Acciones:** [Crear entrega (primary)] [Editar pedido (ghost)] [Eliminar pedido (destructive-ghost)]. **Sin "Cancelar"** — un pedido completo no puede cancelarse.

### 5.4 Atrasado (`#s7-order-detail-overdue`)

**Overdue alert banner:** aparece entre el `app-topbar` y el `back-link`. `role="alert"`. Contenido: ícono `clock` + "Atrasado N días" (bold, `color:var(--warning)`) + "Estimado el {fecha} · aún sin entrega confirmada" (`color:var(--text-secondary)`). Background: `color-mix(in oklch, var(--warning) 10%, var(--surface))`. Border: `color-mix(in oklch, var(--warning) 35%, transparent)`.

**Hero:** dual chip: chip de status (ej. `info` "En camino") + `warning` "Atrasado Nd" (`alert-triangle`). Progress bar con `background:var(--warning)` si impago.

### 5.5 Formulario inline "Anotar pago" (`#s7-order-detail-pay-modal`)

El formulario se expande **dentro del card Pagos** al pulsar "Anotar pago" — el resto de la página permanece visible (el usuario puede ver el saldo pendiente mientras llena el monto). Dos campos en columna (mobile) o fila (desktop):

- `amount` — `<Input type="number">` con símbolo de currency prefijo. `min=0.01`. Validación: amount > 0 y amount ≤ `remainingAmount`.
- `paymentDate` — `<Input type="date">` con `max={today}`. Default: hoy.

CTA: "Guardar pago" (primary) + "Cancelar" (ghost). El formulario se cierra al confirmar o cancelar. Optimistic: la row aparece inmediatamente con motion slide-from-top. Si server falla: slide-out con tinte `var(--destructive) 14%` + toast revert.

### 5.6 Modal "Eliminar pedido" (`#s7-order-detail-delete-modal`)

Fondo al 35% opacity + `pointer-events:none`. Modal ADR 0008 B variante destructiva:

- Header: ícono `trash-2` en `tone-destructive` circle + título "Eliminar pedido" + subtítulo "Esta acción no se puede deshacer" + botón X close.
- Body: "¿Seguro que quieres eliminar el pedido **ORD-YYYYMMDD-NN · {Tienda}**? Se eliminarán también los pagos y el historial asociados. Las entregas vinculadas no se verán afectadas."
- Footer: "Cancelar" (ghost) + "Eliminar pedido" (destructive).

Al confirmar: redirect inmediato a lista de pedidos. Sin undo.

### 5.7 Modal "Cancelar pedido" (`#s7-order-detail-cancel-modal`)

Modal ADR 0008 B variante warning:

- Header: ícono `ban` en `tone-warning` + título "Cancelar pedido" + subtítulo "El pedido quedará archivado como Cancelado".
- Body: "Podrás reactivarlo más adelante desde el detalle del pedido. Los pagos y el historial se conservan." + campo textarea opcional "Motivo (opcional)".
- Footer: "Volver" (ghost) + "Cancelar pedido" (warning variant).

El motivo se guarda como `cancellationReason` en el pedido y aparece en el callout de la variante cancelled.

### 5.8 Mobile (`#s7-order-detail-mobile`)

`--sidebar-width:0px`. Sin sidebar, sin `MobileTabBar` (hidden). Topbar lleva breadcrumb + `[···]` (más acciones) a la derecha.

**Sticky action bar** (fija al fondo, `z-index:30`, border-top, `var(--surface-elevated)`):

- `[Pago (primary flex:1)]` `[Entrega (primary flex:1)]` `[✎ (ghost icon-only)]`

**Hero:** full width, padding 16px. Mismo contenido que desktop pero compacto.

**Subcards:** Productos (open), Pagos (collapsed — se expande al pulsar, lleva formulario dentro), Nota privada (collapsed). Historial **no se muestra en mobile** (información de baja prioridad, accesible vía desktop).

## 6. Comportamiento e interacción

### 6.1 Subcard collapse / expand

- Click en el botón `subcard-toggle` (header completo, incluyendo eyebrow + count + chevron) → toggle.
- `aria-expanded` en el botón alterna. Altura de `.subcard-body` se anima con `max-height` + `overflow:hidden` (280ms).
- Chevron rota 180° al abrir (150ms).
- Estado inicial: Productos = **open**, Historial = **closed**. En mobile: Pagos = **closed**, Nota privada = **closed**.

### 6.2 "Anotar pago" — formulario inline

- Click "Anotar pago" → el formulario aparece dentro del card Pagos (debajo de los pagos existentes), con `slide-from-bottom` 200ms.
- El card Pagos NO scrollea a modal — el contenido del resto de la página sigue visible para que el usuario pueda ver el saldo pendiente mientras llena el monto (decisión de diseño: contexto adyacente es relevante).
- Focus va al campo `amount` al abrir.
- `Escape` cierra el formulario si no hay datos. Si hay datos: confirm inline ("¿Descartar cambios?").
- Envío con "Guardar pago": optimistic update (row aparece con slide-from-top, resumen se actualiza). Server action en paralelo. Si falla: revert con tinte `var(--destructive) 14%` + toast de revert.
- Pago full (amount === remainingAmount exactamente): toast achievement con `MascotBubble` celebrating + copy "¡Cubierto!".
- `⌘+Enter` / `Ctrl+Enter` confirma el formulario si está abierto y válido.

### 6.3 Eliminar pago (pay-row)

- Click en × del `pay-row`: optimistic remove (row desaparece con fade 200ms). Summary actualiza inmediatamente.
- Toast neutral-undo "Pago eliminado · Deshacer" con 5s. Atajo `Z` para deshacer.
- Server action `deletePaymentAction` se invoca en paralelo al remove.
- Si server falla dentro de los 5s: row reaparece con tinte `var(--destructive) 14%` + toast de error.
- Si server falla después de 5s (undo ya expirado): error toast sin revert (data inconsistency — raro, registrar en Sentry).
- **Mobile:** swipe izquierda sobre pay-row → revela botón delete. Long-press también revela la acción.

### 6.4 Nota privada — autosave

- Textarea de 3 líneas mínimo. `maxLength=2000`. Counter `{n}/2000` en muted debajo.
- **Autosave on blur** con throttle 1.5s — si el usuario vuelve a blur antes de 1.5s del último save, el timer se resetea.
- Al guardar exitoso: indicador "Guardada hace 0s" (con ícono `check-circle` success 13px) aparece debajo del textarea. El counter va incrementando "hace 1s", "hace 2s"… hasta desaparecer a los ~60s.
- Guardar nota vacía (`value.trim() === ""`) → llama `saveOrderNoteAction(orderId, null)` → borra la nota.
- Error en save: inline "No se pudo guardar" en `var(--destructive)` + retry automático en 3s.
- El contenido de la nota **no es optimistic** — se espera confirmación del servidor antes de actualizar el indicador.

### 6.5 Acciones de lifecycle

- **"Crear entrega":** navega a `/deliveries/new?sourceOrderId={id}`. Solo disponible si `eligibility.canCreateDelivery`.
- **"Editar pedido":** navega a `/orders/[id]/edit`. Solo disponible si `eligibility.canEdit`.
- **"Cancelar pedido":** abre modal ADR 0008 B warning. `Escape` cierra sin acción. "Volver" cierra. "Cancelar pedido" confirma → `cancelOrderAction` → reload con status CANCELLED.
- **"Reactivar pedido":** click directo sin modal (acción reversible: si el usuario arrepiente, puede volver a cancelar desde el estado OPEN). `reactivateOrderAction` → reload con status OPEN.
- **"Eliminar pedido":** abre modal ADR 0008 B destructivo. `Escape` cierra sin acción. "Cancelar" cierra. "Eliminar pedido" confirma → `deleteOrderAction` → redirect a lista.

### 6.6 Botones deshabilitados (cancelled)

"Editar pedido" y "Crear entrega" cuando `eligibility.canEdit === false` o `eligibility.canCreateDelivery === false`: `disabled`, `aria-disabled="true"`, `opacity:0.45`, `cursor:not-allowed`, tooltip/`title` explicando el motivo.

### 6.7 Copiar código de pedido (mobile)

Tap en el span `.id` (el código ORD-YYYYMMDD-NN) → `navigator.clipboard.writeText(order.code)` → haptic feedback (si disponible) → toast "Código copiado" 2s.

### 6.8 Atajos de teclado (desktop)

| Tecla     | Acción                                                                    |
| --------- | ------------------------------------------------------------------------- |
| `E`       | Navega a `/orders/[id]/edit` (si `canEdit`)                               |
| `P`       | Expande subcard Pagos + abre formulario + foco en campo `amount`          |
| `N`       | Expande subcard Nota privada + foco en textarea                           |
| `J` / `K` | Navega entre subcards expandidas (foco en header de cada una)             |
| `⌘+Enter` | Envía formulario de pago si está abierto y válido                         |
| `Escape`  | Cierra modals abiertos / cierra formulario inline / limpia confirmaciones |
| `Z`       | Deshace delete de pago durante el toast de 5s                             |

### 6.9 Gestos mobile

- **Pull-to-refresh:** recarga el detalle completo.
- **Swipe izquierda en pay-row:** revela botón de delete.
- **Long-press en pay-row:** alternativa al swipe para revelar delete.
- **Tap en código ORD-** en el hero: copia al clipboard.

### 6.10 View transition (lista → detalle)

**Nombre vinculante:** `view-transition-name: order-{order.id}` — declarado en la `order-row` de la lista Y en el `detail-hero`. El ID de base de datos es el valor usado (no el código legible) para garantizar unicidad absoluta.

La lista usa `style={{ viewTransitionName: "order-" + order.id }}` en el `order-row`. El detalle usa el mismo en el `detail-hero`. Cualquier divergencia en el nombre → transición cae a fade plain sin error visible — difícil de detectar en testing.

### 6.11 Mascota

- **`celebrating`** 64px: solo en toast de achievement (pago completo que cierra el saldo). Nunca durante delete/cancel/reactivate.
- **Idle bubble:** sigue visible en esquina inferior derecha (gestión del AppShell, no de esta pantalla).
- **No mascota en estados de error ni en empty de pagos** — empty de subcard usa ícono Lucide `circle-dollar-sign` neutro.

## 7. Validaciones

### 7.1 Formulario de pago (inline)

Validación post-blur y pre-submit:

| Campo         | Regla                            | Error inline                                  |
| ------------- | -------------------------------- | --------------------------------------------- |
| `amount`      | Requerido, número positivo (> 0) | "El monto debe ser mayor a cero"              |
| `amount`      | ≤ `remainingAmount` (FR-05-19)   | "No puede ser mayor a {remaining} restantes." |
| `paymentDate` | Requerido                        | "La fecha es requerida"                       |
| `paymentDate` | ≤ hoy (no fecha futura)          | "La fecha no puede ser futura."               |

Validación Zod en `orderPaymentActions.ts` — se aplica también server-side como segunda barrera.

### 7.2 Formulario de cancelación

- `cancellationReason`: opcional, max 500 chars. Sin validación bloqueante.

### 7.3 Nota privada

- `privateNote`: max 2000 chars. El textarea tiene `maxLength=2000`. Error suave si se llega al límite (counter rojo).

### 7.4 Eligibility guards

- Delete: si `eligibility.canDelete === false` → botón "Eliminar pedido" está deshabilitado con tooltip "Desvincula los ítems de las entregas activas primero." (FR-05-24).
- Cancel: si `eligibility.canCancel === false` → botón "Cancelar pedido" está deshabilitado (FR-05-25).

## 8. i18n keys

Namespace: `orders` (existente), con subnivel `detail.*`.

| Clave i18n                                       | ES (demo/aprobado)                                                                                                                                                    | Cambio?                                              |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `orders.detail.backLink`                         | `"Pedidos"`                                                                                                                                                           | Existente como `backToList` → renombrar              |
| `orders.detail.hero.eyebrow`                     | `"Tu pedido · {currency}"`                                                                                                                                            | Existente como `orders.detail.summary.*`             |
| `orders.detail.hero.saldoPendiente`              | `"Saldo pendiente"`                                                                                                                                                   | ❌ nueva                                             |
| `orders.detail.hero.total`                       | `"Total"`                                                                                                                                                             | ❌ nueva (para cancelados)                           |
| `orders.detail.hero.de`                          | `"de {total} {currency}"`                                                                                                                                             | ❌ nueva                                             |
| `orders.detail.hero.paid`                        | `"{pct}% pagado · entrega estimada {date}"`                                                                                                                           | ❌ nueva                                             |
| `orders.detail.hero.paidNoDate`                  | `"{pct}% pagado"`                                                                                                                                                     | ❌ nueva                                             |
| `orders.detail.hero.paidDelivered`               | `"{pct}% pagado · entregado {period}"`                                                                                                                                | ❌ nueva                                             |
| `orders.detail.overdueBanner.title`              | `"Atrasado {days} días"`                                                                                                                                              | ❌ nueva                                             |
| `orders.detail.overdueBanner.sub`                | `"Estimado el {date} · aún sin entrega confirmada"`                                                                                                                   | ❌ nueva                                             |
| `orders.detail.cancelReason.label`               | `"Motivo de cancelación"`                                                                                                                                             | ❌ nueva                                             |
| `orders.detail.sections.products`                | `"Productos"`                                                                                                                                                         | Existente como `orders.detail.items`                 |
| `orders.detail.sections.history`                 | `"Historial"`                                                                                                                                                         | Existente                                            |
| `orders.detail.sections.payments`                | `"Pagos"`                                                                                                                                                             | Existente                                            |
| `orders.detail.sections.note`                    | `"Tu nota privada"`                                                                                                                                                   | ❌ nueva (actual: `orders.detail.note.*`)            |
| `orders.detail.sections.actions`                 | `"Acciones"`                                                                                                                                                          | ❌ nueva                                             |
| `orders.detail.payment.empty`                    | `"Sin pagos registrados."`                                                                                                                                            | Existente                                            |
| `orders.detail.payment.cta.add`                  | `"Anotar pago"`                                                                                                                                                       | Existente                                            |
| `orders.detail.payment.field.amount.label`       | `"Monto"`                                                                                                                                                             | Existente                                            |
| `orders.detail.payment.field.date.label`         | `"¿Cuándo lo pagaste?"`                                                                                                                                               | Existente                                            |
| `orders.detail.payment.error.exceedsRemaining`   | `"No puede ser mayor a {remaining} restantes."`                                                                                                                       | Existente                                            |
| `orders.detail.payment.error.dateInFuture`       | `"La fecha no puede ser futura."`                                                                                                                                     | Existente                                            |
| `orders.detail.payment.success.partial`          | `"Listo. Te quedan {remaining}."`                                                                                                                                     | Existente                                            |
| `orders.detail.payment.success.full`             | `"¡Cubierto! Una pre-orden menos. ✨"`                                                                                                                                | Existente                                            |
| `orders.detail.payment.totalPaid`                | `"Total pagado"`                                                                                                                                                      | ❌ nueva                                             |
| `orders.detail.payment.saldo`                    | `"Saldo pendiente"`                                                                                                                                                   | ❌ nueva (para aside card)                           |
| `orders.detail.payment.deleted`                  | `"Pago eliminado · Deshacer"`                                                                                                                                         | ❌ nueva (toast undo)                                |
| `orders.detail.note.placeholder`                 | `"Escribe una nota o recordatorio para este pedido…"`                                                                                                                 | Existente                                            |
| `orders.detail.note.savedAt`                     | `"Guardada hace {seconds}s"`                                                                                                                                          | Existente (revisar "Guardada" vs "Guardado")         |
| `orders.detail.note.counter`                     | `"{count}/2000"`                                                                                                                                                      | Existente                                            |
| `orders.detail.actions.createDelivery`           | `"Crear entrega"`                                                                                                                                                     | Existente                                            |
| `orders.detail.actions.edit`                     | `"Editar pedido"`                                                                                                                                                     | Existente                                            |
| `orders.detail.actions.cancel`                   | `"Cancelar pedido"`                                                                                                                                                   | Existente                                            |
| `orders.detail.actions.reactivate`               | `"Reactivar pedido"`                                                                                                                                                  | Existente (revisar "Reactivar" → "Reactivar pedido") |
| `orders.detail.actions.delete`                   | `"Eliminar pedido"`                                                                                                                                                   | Existente                                            |
| `orders.detail.actions.createDeliveryFromItems`  | `"Crear entrega con estos productos"`                                                                                                                                 | ❌ nueva                                             |
| `orders.detail.actions.editDisabledReason`       | `"No disponible para pedidos cancelados"`                                                                                                                             | ❌ nueva (tooltip)                                   |
| `orders.detail.actions.deliveryDisabledReason`   | `"No disponible para pedidos cancelados"`                                                                                                                             | ❌ nueva (tooltip)                                   |
| `orders.detail.actions.deleteDisabledReason`     | `"Desvincula los ítems de las entregas activas primero."`                                                                                                             | ❌ nueva (FR-05-24)                                  |
| `orders.detail.delete.confirm.title`             | `"Eliminar pedido"`                                                                                                                                                   | Existente                                            |
| `orders.detail.delete.confirm.subtitle`          | `"Esta acción no se puede deshacer"`                                                                                                                                  | ❌ nueva                                             |
| `orders.detail.delete.confirm.body`              | `"¿Seguro que quieres eliminar el pedido {code} · {store}? Se eliminarán también los pagos y el historial asociados. Las entregas vinculadas no se verán afectadas."` | ❌ nueva (más detallado que existente)               |
| `orders.detail.delete.confirm.cta`               | `"Eliminar pedido"`                                                                                                                                                   | Existente (revisar)                                  |
| `orders.detail.cancel.confirm.title`             | `"Cancelar pedido"`                                                                                                                                                   | Existente                                            |
| `orders.detail.cancel.confirm.subtitle`          | `"El pedido quedará archivado como Cancelado"`                                                                                                                        | ❌ nueva                                             |
| `orders.detail.cancel.confirm.body`              | `"Podrás reactivarlo más adelante. Los pagos y el historial se conservan."`                                                                                           | Existente (revisar)                                  |
| `orders.detail.cancel.confirm.motivo`            | `"Motivo (opcional)"`                                                                                                                                                 | ❌ nueva                                             |
| `orders.detail.cancel.confirm.motivoPlaceholder` | `"Ej.: La tienda cerró, cambié de opinión…"`                                                                                                                          | ❌ nueva                                             |
| `orders.detail.cancel.confirm.cta`               | `"Cancelar pedido"`                                                                                                                                                   | Existente                                            |
| `orders.detail.chips.overdue`                    | `"Atrasado {days}d"`                                                                                                                                                  | ❌ nueva (para hero chip)                            |
| `orders.detail.chips.unpaidBalance`              | `"Saldo pendiente"`                                                                                                                                                   | ❌ nueva (para hero chip)                            |
| `orders.detail.mobile.moreActions`               | `"Más acciones"`                                                                                                                                                      | ❌ nueva (aria-label del `[···]`)                    |
| `orders.detail.codeCopied`                       | `"Código copiado"`                                                                                                                                                    | Existente como `toast.codeCopied`                    |

## 9. Accesibilidad

- **`detail-hero`**: el nombre de la tienda es el encabezado semántico principal — implementar como `<h1>` o `<h2>` según la jerarquía de la página. El código ORD- va como `<span>` `aria-label="Código de pedido {code}"` para que los lectores de pantalla lo anuncien en contexto.
- **Overdue alert banner**: `role="alert"` — se anuncia inmediatamente a lectores de pantalla al cargarse la página.
- **Cancellation reason callout**: `role="note"`, `aria-label="Motivo de cancelación"`.
- **Subcards**: cada `subcard-toggle` es un `<button>` con `aria-expanded` + `aria-controls={bodyId}`. El cuerpo tiene `id={bodyId}`.
- **Modals (ADR 0008 B)**: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` al título. Focus trap activo. Al cerrar: foco regresa al botón que lo abrió.
- **Formulario de pago inline**: `aria-label="Formulario de nuevo pago"` en el `<form>`. Labels explícitos para cada campo. Errores con `aria-describedby` hacia el mensaje de error.
- **Pay-row delete button**: `aria-label="Eliminar pago de {amount} del {date}"` — no solo `aria-label="Eliminar pago"` genérico.
- **Botones disabled**: `aria-disabled="true"` además de `disabled`. El tooltip del motivo es accesible via `title` (complementar con `aria-describedby` si se quiere más robusto).
- **Progress bar**: `role="progressbar"`, `aria-valuenow={paymentPercentage}`, `aria-valuemin=0`, `aria-valuemax=100`, `aria-label="{pct}% pagado"`.
- **Textarea de nota**: `aria-label="Tu nota privada"`. El indicador "Guardada hace Ns" tiene `aria-live="polite"`.
- **Toast de undo**: `aria-live="polite"` o `role="status"`. El botón "Deshacer" dentro del toast es focusable con `Tab`.
- **Sticky action bar (mobile)**: `role="toolbar"`, `aria-label="Acciones del pedido"`.
- **Atajos de teclado**: documentar en un `aria-keyshortcuts` en los botones correspondientes para herramientas asistivas.

## 10. Edge cases acordados

1. **Pedido sin `expectedDeliveryTo`** — no aparece "entrega estimada" en el hero. Sin overdue banner. La barra de progreso de pago sigue visible.
2. **Pedido sin items** — no debería ocurrir (el schema requiere `items.min(1)`), pero si llegara: subcard Productos muestra empty inline con ícono `package-open`.
3. **Pedido sin pagos** — card Pagos muestra "Sin pagos registrados." + botón "Anotar pago". Sin summary de totales.
4. **Pago que cubre exactamente el saldo restante** — `amount === remainingAmount` → pago completo → achievement toast con mascota `celebrating`. El hero no cambia de estado hasta que el server confirma (no optimistic en el hero).
5. **Error al cargar el detalle (order no encontrado o no autorizado)** — retornar 404. El page.tsx de Next.js maneja esto con `notFound()`.
6. **`cancellationReason === null` en pedido cancelado** — el callout de motivo NO se renderiza. El hero ya muestra chip "Cancelado".
7. **Múltiples pagos** — la lista no tiene paginación (supuesto: < 20 pagos en uso real). Si excede 20, mostrar todos de todas formas — la UI no colapsa.
8. **Historial con muchas entradas** — subcard Historial colapsada por default. Si hay > 50 entradas, mostrar las 50 más recientes + "Ver más" (P-S7-04, no aprobado aún).
9. **Delete de pedido cuando `canDelete === false`** — el botón está disabled. El modal nunca se abre desde un botón disabled. No hay ruta alternativa para eliminar.
10. **Reactivar → OPEN pero con deliveries canceladas** — el pedido vuelve a OPEN correctamente. Las deliveries canceladas permanecen canceladas y el estado se re-deriva desde los items.
11. **Nota con 2000 chars exactos** — counter muestra "2000/2000" en `var(--destructive)`. El campo acepta el caracter 2000 pero bloquea el 2001 con `maxLength`. Autosave funciona al blur.
12. **View transition falla** (nombre no coincide) — la navegación ocurre normalmente con fade simple. No es un error de runtime, solo pérdida de la transición. Log en dev, silencioso en prod.

## 11. Anti-patrones

- **No usar `BackNavLink` (pill) aquí** — el back-link en detalle de pedido es el patrón `back-link` text-link minimal (← Pedidos), no el pill redondeado de `BackNavLink`. `BackNavLink` es para Store detail / create (diferentes porque tienen hero-image). El detalle de pedido tiene `detail-hero` propio como identidad visual dominante.
- **No abrir "Anotar pago" en modal separado** — el formulario se expande inline dentro del card Pagos. El usuario debe ver el saldo pendiente mientras llena el monto. (Decisión de diseño S7-A aprobada.)
- **No usar `page-heading` (`<h1>` + meta)** — el `detail-hero` ya funciona como heading. Añadir `<h1>` extra sería redundante y rompería la jerarquía de la página.
- **No usar `package-check` para "Cancelado"** — "Cancelado" usa `ban`. `package-check` es exclusivamente para "Completo" (entregado). (L065)
- **No celebrar con mascota en cancel/delete/reactivate** — la mascota `celebrating` solo aparece cuando el usuario completa un pago (logro positivo). No celebra cancelaciones ni eliminaciones.
- **No bloquear toda la UI durante el autosave de nota** — el autosave es silencioso. Solo el indicador debajo del textarea cambia. El resto de la página permanece interactivo.
- **No omitir `aria-disabled` en botones disabled** — `disabled` solo en el atributo no basta para accesibilidad; añadir `aria-disabled="true"` y preservar el botón en el tab order para que el tooltip sea accesible.
- **No hacer el delete de pago irreversible sin undo** — siempre emitir toast neutral-undo con 5s antes de confirmar el delete en el servidor. (Decisión S2 post-closure, ADR 0001 decisión 4.)
- **No asumir que `view-transition-name` es automático** — debe declararse explícitamente tanto en la lista como en el detalle, con el mismo valor `"order-" + order.id`. Diferencias de formato rompen el morph.

## 12. Notas para Fase B

1. **`getOrderDetailFull`:** verificar que la query existente en `src/lib/data/orders/orderQueries.ts` devuelva todos los campos del spec (§3), especialmente `cancellationReason`, `eligibility` flags derivados, e `ItemDeliveryState` con el valor `ARRIVED` (verificar si existe en el enum o solo `IN_TRANSIT`/`DELIVERED`/`PENDING`).

2. **`ItemDeliveryState.ARRIVED`:** el demo muestra "Listo en tienda" (`store` ícono) como estado diferenciado de "En camino". Si el enum actual no tiene `ARRIVED`, Fase B debe añadirlo o mapearlo desde el estado de la delivery (`DELIVERED` en delivery pero item todavía no recogido por el usuario). Decisión de datos: ¿se trackea "listo en tienda" como estado de delivery o de item?

3. **Formulario inline de pago (expansión):** el card Pagos necesita ser un Client Component para manejar el estado open/closed del formulario y el optimistic update. `OrderPaymentsPanel` debe ser `"use client"`.

4. **Optimistic delete de pago:** implementar con `useOptimistic` (React 19+) o con estado local + revalidación. El toast de undo debe poder revertir el estado local si el usuario pulsa "Deshacer" dentro de los 5s.

5. **Autosave de nota:** implementar con `useRef` para el timeout + `useCallback` para el handler de blur. Throttle 1.5s. El server action `saveOrderNoteAction` debe ser idempotente (llamar con el mismo valor no debe crear entradas de historial).

6. **Overdue banner:** derivar `isOverdue` en el Server Component (`page.tsx`) para no enviar lógica de fecha al client. Pasar como prop a los componentes que lo necesiten.

7. **Modals (ADR 0008 B):** usar el `Modal` canónico de `src/components/core/Modal.tsx`. No crear modals ad-hoc. Ver `.cursor/rules/modal-canonical-pattern.mdc`.

8. **Chip "Saldo pendiente" en COMPLETED:** el hero puede mostrar dual chips. El segundo chip `warning` solo aparece cuando `status === COMPLETED && hasUnpaidBalance`. El botón "Cancelar pedido" no aparece cuando status es `COMPLETED`.

9. **Mobile sticky action bar:** no usar `MobileTabBar` en esta pantalla — la barra de acciones es específica de este detalle. Implementar como `position:fixed; bottom:0; z-index:30` con `padding-bottom` en el contenido para evitar que el sticky tape sobre el último elemento.

10. **Historial lazy fetch:** si el historial tiene > 50 entradas en producción, considerar fetch lazy al expandir la subcard (no incluir en el payload inicial del SSR). P-S7-04 pendiente de aprobación.

11. **Comportamiento crítico a preservar:**
    - El `userId` siempre debe estar en la query de `getOrderDetailFull` — un non-owner recibe 404.
    - El formulario de pago valida `amount ≤ remainingAmount` también en el server action (segunda barrera de FR-05-19).
    - `deleteOrderAction` redirige a la lista — no recargar el detalle de un pedido eliminado.
    - `reactivateOrderAction` no tiene confirm modal — la acción es reversible (el usuario puede volver a cancelar).
