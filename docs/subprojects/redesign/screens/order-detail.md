---
title: Order detail
session: 07
status: spec-complete
last_updated: 2026-05-12
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
  - "#s7-order-detail-overdue-mobile"
  - "#s7-order-detail-cancelled-mobile"
  - "#s7-order-detail-completed-unpaid-mobile"
  - "#s7-order-detail-pay-mobile"
  - "#s7-order-detail-delete-mobile"
  - "#s7-order-detail-cancel-mobile"
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

El formulario se expande **dentro del card Pagos** al pulsar "Anotar pago" — el resto de la página permanece visible (el usuario puede ver el saldo pendiente mientras llena el monto). Campos:

- `amount` — `<Input type="number">` con símbolo de currency prefijo. `min=0.01`. Validación: amount > 0 y amount ≤ `remainingAmount`.
- `currency` — `<Select>` (default: currency del pedido, no editable en este flujo simple).
- **Quick-picks debajo del input de monto (S7-A.7, paridad desktop+mobile):** dos chips `.filter-pill` que prellenan el monto:
  - **"Saldo pendiente ($X)"** → setea el monto a `order.remainingAmount`.
  - **"Mitad ($X/2)"** → setea el monto a `order.remainingAmount / 2`.
  - Ambos cálculos sobre **saldo pendiente**, NO sobre monto total del pedido. Esto evita que "Mitad" sugiera valores mayores al saldo actual cuando ya hay pagos previos.
- `paymentDate` — `<Input type="date">` con `max={today}`. Default: hoy.
- `note` — `<textarea>` opcional, 2 rows, placeholder "Ej.: Pago final, transferencia SEPA…".

CTA: "Guardar pago" (primary) + "Cancelar" (ghost). El formulario se cierra al confirmar o cancelar. Optimistic: la row aparece inmediatamente con motion slide-from-top. Si server falla: slide-out con tinte `var(--destructive) 14%` + toast revert.

> **Decisión de quick-picks (S7-A.7):** 2 chips fijos (no 3). Investigación de patrones de quick-picks en apps de pago (Venmo, Splitwise, Klarna, Apple Pay, Stripe Checkout, PayPal Pay Later) + NN/g choice-paralysis convergen en "2–3 chips máximo". Tres chips (10%, 25%, "Seña") fueron evaluados y descartados: 10%/25% del saldo son valores poco accionables; "Seña" (30–50% del total) solo aplica al primer pago y confunde en pagos subsiguientes. Si en el futuro se quiere preset "Seña" condicional (solo `paymentsCount === 0`), abrir cross-cutting change separado.

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

`--sidebar-width:0px`. Sin sidebar.

**Topbar (static shell, ContentHeader.tsx).** Patrón canónico aplicado en S7-A.6 (ADR 0011): `[☰ hamburger icon-button]` + breadcrumb `Pedidos` (link) + chevron-sep + título `ORD-…` (font mono, 14px/600, truncate). Sin back-arrow, sin `⋯`, sin acciones contextuales del lado derecho. El header es estático cross-route — las acciones de página viven en el page content. Esto refleja la implementación real de `src/app/[locale]/(app)/_components/AppLayout/ContentHeader.tsx`.

**Back-link en page content.** Inmediatamente debajo del topbar, padding 8px 16px 0: `<a class="s7-mob-back-link"><i lucide="arrow-left"/> Pedidos</a>`. Da una acción "volver" en zona thumb-reachable (el breadcrumb del header está en zona difícil). Estándar mobile detail-screen post-iOS HIG.

**Hero:** full width, padding 16px. Mismo contenido que desktop pero compacto. Jerarquía invertida vs desktop: "**Saldo pendiente**" como label primario (no "Total") con cifra grande en `--warning` cuando hay saldo, `--destructive` cuando impago. Tap-to-copy en el código `ORD-…` (botón inline con icono `copy` 11px).

**Subcards (defaults state-aware, S7-A.7):**

- **Productos** — `is-open` siempre. Lista todos los N items sin truncar con "+ N más".
- **Pagos** — `is-open` por default cuando `saldo > 0` (activo/atrasado/impago). Surfacea el historial + total pagado + saldo pendiente sin que el usuario tenga que expandir manualmente. Cuando `saldo = 0` (cancelado o pagado completo, casos sin acción esperada), pasa a `collapsed` mostrando solo el resumen en el header. Internamente la card **NO contiene botón "Anotar pago"** — la acción canónica vive en la sticky bar al pie del scroll (Option Z: single source of truth). Si no hay pagos registrados, el body de la card muestra un mensaje guía: _"Sin pagos registrados aún. Usá [Pagar saldo / Anotar pago] abajo para anotar el primero."_ — el bold corresponde al label del primary CTA del estado.
- **Nota privada** — `collapsed` siempre. La textarea expandida es voluminosa y la interacción es de baja frecuencia. El indicador "✓ Guardada" en el header cubre la necesidad informativa ("no perdí mi nota") sin requerir expand. Patrón Apple HIG: contenido "sometimes relevant" detrás de accordion.
- **Historial** — **no se muestra en mobile en ningún estado** (decisión S7-A.8, información de baja prioridad accesible vía desktop). Incluye cancelled: el subtitle + campo "Motivo" cubren el contexto necesario en mobile.

**Card "Acciones" inline (ADR 0011).** Al final del scroll del page content, antes de la sticky action bar: card `.s7-mob-actions-card` con título eyebrow "Acciones" y lista de filas tap-able. Patrón Apple HIG (Calendar event edit, Reminders, Contacts): un solo grupo, fila destructiva al final en rojo, con divider sutil arriba.

Filas para estado activo (y atrasado/impago, mismo subset):

1. `pencil` Editar pedido → navega a `/pedidos/[id]/editar`
2. `ban` Cancelar pedido → abre bottom sheet `#s7-order-detail-cancel-mobile`
3. (divider sutil — CSS via `::before`)
4. `trash-2` (destructive, rojo) Eliminar pedido → abre `#s7-order-detail-delete-mobile`

> **Cancelar es semi-destructivo pero reversible** (el pedido pasa a estado `cancelled`, se puede reactivar). Por eso vive como fila neutra del menú, no en zona destructiva. Solo Eliminar (irreversible) lleva el color rojo + divider. Patrón Linear-style (Archive vs Delete).

**Sticky action bar single-purpose con jerarquía single-primary (S7-A.7)** (fija al fondo via flex-column del `.app-shell`, `border-top`, `var(--surface-elevated)`, `backdrop-filter: blur(10px)`, `padding-bottom: calc(N + env(safe-area-inset-bottom))`). Contiene **solo los CTAs primarios del estado**, sin `[Más]`.

**Reglas de jerarquía visual:**

- **Un solo botón primary por sticky bar** (`.btn.primary` — solid `var(--accent)` + `oklch(99% 0 0)` text). El secundario usa el variant tonal (`.btn.accent` — `color-mix(in oklch, var(--accent) 10%, transparent)` bg + `var(--accent)` text/border 28%). Mismo color hue, distintas weights — coexisten sin competir.
- **Primary a la DERECHA**, secundario a la izquierda (Apple HIG Toolbars + Material 3 Dialogs + Gutenberg reading-gravity end + thumb zone right-handed users — research S7-A.7).
- **Primary = la acción de mayor frecuencia esperada** según FRD priorities + lifecycle del pedido. Pago > Entrega en este producto (FRD prioridad 3 vs 4; típicamente 2–3 pagos vs 1–2 entregas por pedido).

**Mapping por estado:**

| Estado    | Secundario (izquierda, tonal `.btn.accent`) | Primary (derecha, `.btn.primary`)                       |
| --------- | ------------------------------------------- | ------------------------------------------------------- |
| Activo    | `[Crear entrega]` (icon `truck`)            | `[Anotar pago]` (icon `circle-dollar-sign`)             |
| Atrasado  | `[Entrega]` (icon `truck`)                  | `[Pagar saldo]` (icon `circle-dollar-sign`)             |
| Impago    | —                                           | `[Saldar $X]` (single button, no secundario)            |
| Cancelado | —                                           | `[Reactivar pedido]` (single button, icon `rotate-ccw`) |

- "Anotar pago" / "Pagar saldo" / "Saldar $X" abren el bottom sheet `#s7-order-detail-pay-mobile` (ver §5.13 — NO inline expand como desktop).
- "Crear entrega" / "Entrega" navega a `/deliveries/new?sourceOrderId=`.

Anti-patrón cerrado (S7-A.6): la action bar **no contiene** botón `[Más]` ni icono `⋯`. Las acciones secundarias (Editar, Cancelar, Eliminar) viven en la card inline al pie del scroll. Esto cumple tres constraints: (1) la sticky bar queda single-purpose; (2) la jerarquía visual entre primary y secundario no compite; (3) las secundarias son visibles labelled (no escondidas detrás de `⋯`).

### 5.9 Atrasado mobile (`#s7-order-detail-overdue-mobile`)

Mismo layout que §5.8 más:

- **Alert banner** entre topbar y hero: `.s7-mob-alert.is-warning`, icono `clock` en `--warning` 18px, strong "Atrasado N días" + body "Estimado el X · aún sin entrega confirmada. Considerá contactar a la tienda."
- Hero con dual chip (`info` "Pendiente" + `warning` "Atrasado Nd" + `s7-impago-pill` si impago).
- Saldo en `--warning`.
- Card "Acciones" inline al pie del scroll, mismas filas que §5.8: Editar · Cancelar · ─ · Eliminar.
- Sticky action bar single-primary: `[Entrega (tonal `.btn.accent`)]` (izquierda) + `[Pagar saldo (`.btn.primary`)]` (derecha). Misma regla de jerarquía que §5.8.

### 5.10 Cancelado mobile (`#s7-order-detail-cancelled-mobile`)

Mismo layout que §5.8 más:

- Hero con `opacity: 0.78`, avatar greyscale (`filter: grayscale(0.6)`), chip `neutral` "Cancelado".
- "Total del pedido" muteado (`--text-secondary`, **SIN strikethrough** — estandarizado con desktop, ver L075).
- Subtitle "Cancelado el X · Sin pagos registrados" (NO referenciar códigos internos del FRD como BR-05-15 en copy visible).
- Sección "Motivo:" con el `cancellationReason` si existe.
- Subcards: Productos (collapsed, info histórica). **Historial NO se muestra en mobile cancelled** (decisión S7-A.8): el subtitle del hero "Cancelado el X · Sin pagos registrados" + el campo "Motivo" cubren el contexto auditable necesario en mobile; el historial completo de eventos sigue accesible vía desktop. Mantiene la regla general "Historial NO en mobile" (§5.8) sin excepción.
- **Card "Acciones" reducida (S7-A.6 + ADR 0011)**: solo `trash-2` (destructive, rojo) Eliminar pedido. NO Editar (un pedido cancelado no se edita — el flujo es reactivar primero); NO Cancelar (ya está cancelado). Como Eliminar es la única fila, no lleva divider arriba (es first-child de la card).
- Sticky action bar single-primary: `[Reactivar pedido (`.btn.primary`)]` (botón único). Reactivar sin modal por ser acción reversible. Sin `[Más]`.

### 5.11 Completado + Impago mobile (`#s7-order-detail-completed-unpaid-mobile`)

Mismo layout que §5.8 más:

- **Alert banner** entre topbar y hero: `.s7-mob-alert.is-destructive`, icono `x-circle` en `--destructive` 18px, strong "Impago · Pedido completado" + body "Todos los productos fueron entregados pero queda un saldo pendiente de $X. Considerá cobrar o registrar el pago final."
- Hero con dual chip (`success` "Completado" + `s7-impago-pill` "Impago"). Saldo en `--destructive` con cifra grande.
- Progress bar al X% con `background: var(--destructive)`.
- Subtitle "Entregado completo el X".
- Card "Acciones" inline al pie del scroll, mismas filas que §5.8: Editar · Cancelar · ─ · Eliminar.
- Sticky action bar single-primary: `[Saldar $X (`.btn.primary`)]` (botón único, ocupa todo el ancho — no hay secundario porque no hay items pendientes de entrega en este estado). Sin `[Más]`.

### 5.12 (eliminada en S7-A.6) — Bottom sheet "Más acciones"

> **Anchor eliminado (`#s7-order-detail-actions-mobile`).** El bottom sheet de "Más acciones" gatillado por `⋯` o por outline `[Más]` fue retirado. Las acciones secundarias (Editar, Cancelar, Eliminar) ahora viven inline en la card "Acciones" al pie del scroll del detalle (ver §5.8). Decisión y evidencia en ADR 0011. Numeración conservada para que las referencias §5.13+ no se rompan.

### 5.13 Anotar pago bottom sheet (`#s7-order-detail-pay-mobile`)

**NO es inline expand como desktop §5.5.** En mobile, "Anotar pago" abre un bottom sheet dedicado (`<Modal>` adaptive como `ModalSheet`, ARIA `role="dialog"`):

- Header: título "Anotar pago" + X close.
- Body: panel destacado "Saldo pendiente: $X USD" con border y bg `--warning` al 8% + form fields. Estructura del field `monto *`:
  - `<Input type="number">` con prefijo de currency.
  - **Quick-picks debajo del input (S7-A.7, alineados con desktop §5.5):** dos chips `.filter-pill` — **"Saldo pendiente ($X)"** (prellena `remainingAmount`) y **"Mitad ($X/2)"** (prellena `remainingAmount / 2`). Cálculo siempre sobre saldo pendiente, no sobre total del pedido.

  Seguido por `fecha del pago *` (input `type="date"` con default hoy) y `nota` (opcional).

- Footer: Cancelar (ghost) + Guardar pago (primary).

**Razón del cambio vs inline expand**: en mobile el detalle subcards son collapsed por default, abrir inline-expand dentro de un subcard collapsed es awkward. Mejor un sheet dedicado que mantiene el contexto del pedido (backdrop muestra hero detrás).

### 5.14 Eliminar pedido bottom sheet (`#s7-order-detail-delete-mobile`)

`<Modal>` adaptive renderizado como `ModalSheet`, ARIA `role="alertdialog"`. **Misma estructura que el modal desktop** (`#s7-order-detail-delete-modal`) — solo cambia el contenedor (centered dialog vs bottom sheet). Estructura destructiva:

- Header: icon-circle `destructive` con `trash-2`, título "¿Eliminar pedido?", subtitle "Esta acción no se puede deshacer".
- Body: paragraph "Se eliminarán **ORD-…** y sus **N pagos por $X**. Las entregas vinculadas no se verán afectadas." + **type-to-confirm**: input que requiere escribir literalmente la palabra **`eliminar`** (NO el código ORD — demasiado complejo) para habilitar el botón Eliminar. Patrón Stripe/GitHub adaptado para destructive actions de baja frecuencia + alto impacto.
- Footer: Cancelar (ghost neutral) + Eliminar (destructive, disabled hasta que el input matchee "eliminar").

> **Parity con desktop (S7-A.5)**: el modal desktop también tiene type-to-confirm con "eliminar" — antes el desktop no tenía esa capa de protección. Alineado en ambos viewports.

### 5.15 Cancelar pedido bottom sheet (`#s7-order-detail-cancel-mobile`)

`<Modal>` adaptive renderizado como `ModalSheet`, ARIA `role="alertdialog"`. **Misma estructura que el modal desktop** (`#s7-order-detail-cancel-modal`):

- Header: icon-circle `warning` con `ban` (NO `x-circle` — `ban` es el icono canónico de cancelar per L065). Título "¿Cancelar pedido?".
- Body: paragraph "El pedido pasará a estado **Cancelado**. Los pagos registrados y el historial se conservan. Podrás reactivarlo más adelante desde el detalle del pedido." + textarea opcional "Motivo (opcional)" con placeholder.
- Footer: Volver (ghost neutral) + Cancelar pedido (warning bg, NO destructive — es reversible).

> **Anti-patrón cerrado (S7-A.5)**: el body NO debe contener referencias a códigos del FRD (ej. "BR-05-15"). Esas son referencias internas; el copy visible al usuario debe ser autónomo. Copy alineado con desktop.

## 6. Comportamiento e interacción

### 6.1 Subcard collapse / expand

- Click en el botón `subcard-toggle` (header completo, incluyendo eyebrow + count + chevron) → toggle.
- `aria-expanded` en el botón alterna. Altura de `.subcard-body` se anima con `max-height` + `overflow:hidden` (280ms).
- Chevron rota 180° al abrir (150ms).
- **Estado inicial desktop:** Productos = **open**, Historial = **closed**.
- **Estado inicial mobile (state-aware, S7-A.7):** Productos = **open** siempre; **Pagos = open cuando `saldo > 0`** (activo/atrasado/impago), **closed cuando `saldo = 0`** (cancelado, o pagado completo); Nota privada = **closed** siempre. Decisión basada en research NN/g (acordeones esconden discoverability — usar solo para contenido "sometimes relevant"); Pagos es "always relevant" cuando hay acción pendiente. Detalle en §5.8 — Subcards.

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

- **Tap en fila de la card "Acciones"** → navega o abre sheet según corresponda: Editar pedido → `/pedidos/[id]/editar`; Cancelar pedido → bottom sheet `#s7-order-detail-cancel-mobile`; Eliminar pedido → bottom sheet `#s7-order-detail-delete-mobile`. La card vive inline al pie del scroll del detalle (ADR 0011) — no detrás de `⋯`, no detrás de bottom sheet de "Más acciones".
- **Tap en `[Anotar pago]` del action bar** → abre `#s7-order-detail-pay-mobile` (bottom sheet con form). NO inline expand como desktop (ver §5.13 para la razón).
- **Tap en `[Crear entrega]` del action bar** → navega a `/deliveries/new?sourceOrderId=`.
- **Tap en `[Reactivar pedido]` (cancelled)** → ejecuta la acción directamente sin modal (reversible).
- **Tap en `← Pedidos` (back-link en page content)** → navega a `/pedidos`. Está justo debajo del topbar para que el back sea thumb-reachable (el `Pedidos` del breadcrumb del header también funciona pero está en la zona dura).
- **Tap en `☰` (hamburger topbar)** → abre el drawer de navegación principal de la app (responsabilidad del AppShell, no de esta pantalla).
- **Tap en código `ORD-…`** en el hero (botón inline con icono `copy`): copia al clipboard. Feedback: toast 2s "Código copiado" en top de la pantalla mobile.
- **Pull-to-refresh:** recarga el detalle completo. Comportamiento del browser nativo (no custom).
- **Swipe izquierda en pay-row (Pagos subcard expandido):** revela botón `X` delete en el extremo derecho del row. Confirmación: undo-toast 5s (L073) — el delete es optimista, se puede deshacer con tap en "Deshacer" o tecla `Z`.
- **Long-press en pay-row:** alternativa al swipe para revelar delete (UX más accesible para usuarios con motricidad fina limitada). Mismo undo-toast 5s.
- **Subcards collapsed con info crítica en el header:** Pagos colapsado muestra "N pagos · $X restante" (saldo en `--warning` si > 0) en el toggle, así el dato más importante es visible sin expandir. Patrón aplicable a otros subcards con info derivada.
- **Drag-to-dismiss en bottom sheets**: cualquier ModalSheet (Anotar pago, Más acciones, Eliminar, Cancelar) se cierra con drag hacia abajo en el drag handle. Velocity-based (Vaul lo provee). Excepción: `role="alertdialog"` (Eliminar/Cancelar) bloquea drag-dismiss accidental — solo se cierra con botón explícito o X.

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

9. **Mobile sticky action bar:** implementar como `position:fixed; bottom:0; z-index:30` con `padding-bottom: calc(env(safe-area-inset-bottom, 0px) + N)` en el contenido para evitar que el sticky tape sobre el último elemento.

10. **Historial lazy fetch:** si el historial tiene > 50 entradas en producción, considerar fetch lazy al expandir la subcard (no incluir en el payload inicial del SSR). P-S7-04 pendiente de aprobación.

11. **Comportamiento crítico a preservar:**
    - El `userId` siempre debe estar en la query de `getOrderDetailFull` — un non-owner recibe 404.
    - El formulario de pago valida `amount ≤ remainingAmount` también en el server action (segunda barrera de FR-05-19).
    - `deleteOrderAction` redirige a la lista — no recargar el detalle de un pedido eliminado.
    - `reactivateOrderAction` no tiene confirm modal — la acción es reversible (el usuario puede volver a cancelar).
