---
title: Order edit
session: 07
status: spec-complete
methodology: §6.quinquies
last_updated: 2026-05-10
demo_anchors:
  - s7-order-edit
  - s7-order-edit-mobile
---

# Pantalla: Editar pedido (`/orders/[id]/edit`)

> Spec §6.quinquies · S7 Fase A · Módulo Órdenes

---

## §1 · Layout

**Ruta:** `/[locale]/orders/[id]/edit`  
**Patrón:** `form-grid` (main column + sticky `form-sidebar`) — **L020 all-open** (sin stepper, todas las secciones siempre expandidas)  
**Demo:** `#s7-order-edit`

### Desktop (≥ 768px)

```
┌─────────────────── app-topbar (sticky 48px) ───────────────────────┐
│ [nav: Pedidos] › ORD-20260428-01 › Editar pedido   [ES]  [☀ tema] │
└────────────────────────────────────────────────────────────────────┘
← ORD-20260428-01                        ← back-link (text, arrow 12px)

┌─ page-heading ─────────────────────────────────────────────────────┐
│  h1  Editar pedido                                                  │
│  span.page-heading-meta  ORD-20260428-01                            │
└────────────────────────────────────────────────────────────────────┘

┌─── form-grid ──────────────────────────────────────────────────────┐
│  ┌─ section-cards (all-open) ────────────────┐  ┌─ form-sidebar ──┐│
│  │                                           │  │  Resumen        ││
│  │  ┌─ Datos del pedido ──────────────────┐  │  │  Tienda: …      ││
│  │  │  Tienda (locked) + Moneda (locked)  │  │  │  Moneda: …      ││
│  │  │  Fecha orden (edit) + Entrega (edit)│  │  │  Fecha: …       ││
│  │  └─────────────────────────────────────┘  │  │  Productos: …   ││
│  │                                           │  │  Total: …       ││
│  │  ┌─ Productos y costos ────────────────┐  │  └─────────────────┘│
│  │  │  Spreadsheet tabla (pre-poblada)    │  │                      │
│  │  │  Añadir producto + shortcuts        │  │                      │
│  │  │  Usar este total                    │  │                      │
│  │  │  Costo total + Tipo de cambio       │  │                      │
│  │  └─────────────────────────────────────┘  │                      │
│  │                                           │                      │
│  │  ┌─ form-footer ───────────────────────┐  │                      │
│  │  │  [Cancelar]  [✓ Guardar cambios]    │  │                      │
│  │  └─────────────────────────────────────┘  │                      │
│  └───────────────────────────────────────────┘                      │
└────────────────────────────────────────────────────────────────────┘
```

### Mobile (< 768px)

Single column. `form-sidebar` colapsa debajo de las `section-cards`. Ambas secciones permanecen expandidas (sin colapsar). El `back-link` aparece bajo el topbar.

### Anchors estructurales del demo

| Sección                  | Demo ID          | Descripción                                        |
| ------------------------ | ---------------- | -------------------------------------------------- |
| Editar pedido (all-open) | `#s7-order-edit` | Única pantalla, L020, todas las secciones abiertas |

### Diferencia visual clave vs. crear

| Aspecto           | Crear                    | Editar                                    |
| ----------------- | ------------------------ | ----------------------------------------- |
| Stepper           | Sí (3 pasos, gating)     | No — all-open (`data-all-open`)           |
| Tienda            | Seleccionable            | Locked (read-only + lock icon)            |
| Moneda            | Seleccionable            | Locked (read-only + lock icon)            |
| Breadcrumb        | `Pedidos › Nuevo pedido` | `Pedidos › ORD-XXXXXX › Editar pedido`    |
| back-link destino | `/orders`                | `/orders/[id]` (el detalle del pedido)    |
| page-heading meta | sin meta                 | `ORD-XXXXXX`                              |
| CTA principal     | "Crear pedido"           | "Guardar cambios"                         |
| CTA cancelar      | N/A (se usa back-link)   | "Cancelar" → modal discard si hay cambios |

---

## §2 · Componentes consumidos

| Componente                           | Spec / origen                                                          | Props clave                                       | Uso específico                                                                    |
| ------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------- |
| `Header`                             | `src/components/modules/AppShell/Header.tsx`                           | `title`, `breadcrumb`                             | topbar; breadcrumb "Pedidos › ORD-XXXXXX › Editar pedido"                         |
| `back-link` (patrón CSS)             | `docs/redesign/PLAYBOOK.md §5.3`                                       | —                                                 | `← ORD-XXXXXX` con arrow-left 12px; destino `/orders/[id]`                        |
| `page-heading` (patrón CSS)          | `docs/redesign/PLAYBOOK.md §5.2`                                       | —                                                 | `h1 "Editar pedido"` + `span.page-heading-meta "ORD-XXXXXX"`                      |
| `OrderForm`                          | `src/app/[locale]/(app)/orders/_components/share/OrderForm.tsx`        | `action`, `initialOrder`, `mode="edit"`           | Contenedor de form con `useActionState`; wrappea las 2 secciones                  |
| `OrderItemsGrid`                     | `src/app/[locale]/(app)/orders/_components/share/OrderItemsGrid.tsx`   | `items[]`, `currency`, `onChange`, `errors`       | Tabla spreadsheet pre-poblada con ítems existentes (incluye `id` por fila)        |
| `DateRangePicker` ⚠️                 | **nuevo componente** — ver `order-create.md §12 nota 2`                | `from`, `to`, `onChange`                          | Trigger + calendar para fecha aprox. de entrega (editable)                        |
| `DiscrepancyModal`                   | `src/app/[locale]/(app)/orders/_components/share/DiscrepancyModal.tsx` | `entered`, `calculated`, `onBack`, `onSaveAnyway` | Modal warning si suma ítems ≠ totalCost al guardar                                |
| Modal discard (ADR 0008 B)           | patrón canónico `docs/redesign/decisions/0008-modal-pattern.md`        | `title`, `message`, `onConfirm`, `onCancel`       | Variante warning "¿Salir sin guardar?" al cancelar/navegar con cambios pendientes |
| `section-card` all-open (patrón CSS) | demo: `div.section-card.section-card-wizard[data-all-open]`            | `data-step`                                       | Cabecera estática (no botón); siempre expandida; icono en lugar de número         |

---

## §3 · Datos consumidos

### Servidor (Server Component, `[id]/edit/page.tsx`)

```ts
// Pedido existente con sus ítems
const order = await getOrderById(id, userId);
// → Order { id, humanReadableId, storeId, orderDate,
//            expectedDeliveryFrom, expectedDeliveryTo,
//            currencyCode, exchangeRate, totalCost,
//            items: OrderItem[] { id, name, quantity, unitPrice,
//                                 productTypeKey, position } }

// Tiendas disponibles (para el componente, aunque el campo esté locked)
const stores = await getOrderableStores();

// Tipos de producto activos
const productTypeKeys = await listActiveStoreProductTypeKeys(prisma);

// Moneda base del usuario (para FX)
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { baseCurrencyCode: true },
});
```

Si `getOrderById` devuelve `null` → `notFound()`.

### `initialOrder` pasado al `OrderForm`

```ts
{
  id: order.id,
  humanReadableId: order.humanReadableId,   // "ORD-20260428-01"
  storeId: order.storeId,
  orderDate: order.orderDate,               // Date
  expectedDeliveryFrom: order.expectedDeliveryFrom,  // Date | null
  expectedDeliveryTo: order.expectedDeliveryTo,      // Date | null
  currencyCode: order.currencyCode,
  exchangeRate: order.exchangeRate != null ? Number(order.exchangeRate) : null,
  totalCost: order.totalCost,               // number (minor units)
  items: order.items,                       // OrderItem[] con id
}
```

---

## §4 · Server actions invocadas

| Acción            | Archivo                                                  | Cuándo se invoca                                             | Retorno                                                                  |
| ----------------- | -------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `editOrderAction` | `src/app/[locale]/(app)/orders/_actions/orderActions.ts` | Click "Guardar cambios", después de pasar validación cliente | `{ success: true, orderId }` o `{ success: false, error, fieldErrors? }` |

### Firma relevante

```ts
export async function editOrderAction(
  orderId: string, // bound via .bind(null, order.id) en el Server Component
  _prev: OrderActionResult | null,
  formData: FormData,
): Promise<OrderActionResult>;

// FormData keys enviadas (storeId y currencyCode se envían pero son ignorados
// por el backend si el pedido ya existe con valores distintos — schema opcional):
// storeId               string (enviado como readonly, no modificable)
// orderDate             string (YYYY-MM-DD)
// expectedDeliveryFrom  string | null
// expectedDeliveryTo    string | null
// currencyCode          string (enviado como readonly)
// totalCost             string (número entero, minor units)
// exchangeRate          string | null
// items                 string (JSON con id opcional por fila)
```

### Comportamiento del upsert de ítems

El `editOrderAction` recibe `items[]` con el campo `id` opcional:

- Filas con `id`: upsert (actualiza la fila existente)
- Filas sin `id`: insert (nueva fila)
- Filas que estaban en `initialOrder.items` pero no en el FormData: delete

---

## §5 · Estados visuales

### 5.1 Estado inicial (sin cambios)

- Ambas secciones expandidas simultáneamente
- Sección 1 — "Datos del pedido":
  - Header estático (no es botón): `step-num` con icono `info` (gris muted), eyebrow "Datos del pedido", h3 `"{storeName} · {currencyCode}"`
  - Tienda: display locked (fondo semitransparente, borde `--border`, opacity 0.7, icono `lock` 13px, `aria-disabled="true"`) con store-avatar + nombre
  - Helper: "La tienda no se puede cambiar una vez creado el pedido."
  - Moneda: display locked (mismo estilo) con código + nombre
  - Helper: "La moneda no se puede cambiar una vez creado el pedido."
  - Fecha de orden: `<input type="date">` editable, pre-relleno
  - Fecha aprox. de entrega: DateRangePicker trigger, editable, pre-relleno (o placeholder si null)
- Sección 2 — "Productos y costos":
  - Header estático: `step-num` con icono `shopping-cart` (gris muted), eyebrow "Productos y costos", h3 "Ítems y total del pedido"
  - Tabla pre-poblada con los ítems del pedido (cada fila con su `id` interno)
  - Costo total: pre-relleno con `totalCost` del pedido (en la moneda del pedido)
  - Tipo de cambio: pre-relleno con `exchangeRate` o vacío
- Form footer: "Cancelar" (ghost) + "Guardar cambios" (primary + icono `check`)
- Sidebar "Resumen": valores del pedido actuales, todos en `--warning` (contexto edición)

### 5.2 Con cambios pendientes

- Campos editados muestran su nuevo valor
- Sidebar actualiza reactivamente (ver §6.8)
- Form footer: igual (no hay indicador de "cambios sin guardar" explícito — el sidebar en warning ya comunica el contexto)

### 5.3 Error de validación inline

- Mismo patrón que `order-create.md §5.5`:
  - Campos con error: borde `--destructive`, label con icono `alert-circle`, `aria-invalid="true"`
  - Costo total inválido: mensaje inline bajo el campo
- CTA "Guardar cambios" deshabilitado (`opacity: 0.5; cursor: not-allowed`) mientras hay errores activos

### 5.4 Modal discrepancia (si suma ≠ total)

- Mismo patrón que `order-create.md §5.6` — variante warning ADR 0008 B
- Disparado al clic en "Guardar cambios" si hay discrepancia (ver §6.6)

### 5.5 Modal discard (cancelar con cambios pendientes)

- Variante **warning** del modal ADR 0008 B
- Título: `orders.edit.discardTitle` ("¿Salir sin guardar?")
- Mensaje: `orders.edit.discardMessage` ("Los cambios que hiciste no se guardarán.")
- Botones: `orders.edit.discardCancel` "Quedarse" (ghost, cierra modal) + `orders.edit.discardConfirm` "Salir" (primary, navega al detalle)

### 5.6 Submitting

- "Guardar cambios" → spinner + texto `orders.edit.submitting` ("Guardando…")
- Todos los campos editables deshabilitados
- `useActionState` maneja estado `pending`

### 5.7 Éxito

- Redirección a `/orders/[id]` (el detalle del pedido editado)
- Toast `orders.edit.successToast` ("Pedido guardado")

### 5.8 Error de servidor

- Toast de error con mensaje del namespace `orders.error.*`
- El form vuelve a ser interactivo

---

## §6 · Comportamiento e interacción

### 6.1 All-open — sin gating de pasos

A diferencia del wizard de creación, el edit no tiene pasos. Ambas secciones están siempre expandidas. El usuario puede editar cualquier campo sin secuencia. Solo el submit final valida todos los campos juntos.

### 6.2 Tienda — campo locked

- Renderiza como un `<div>` no interactivo con `aria-disabled="true"` (no `<input>`, no `<button>`)
- Fondo `color-mix(--text-primary 4%, transparent)`, borde `--border`, `opacity: 0.7`
- Store-avatar (28px) + nombre de la tienda + icono `lock` (13px, color muted) alineado a la derecha
- Helper bajo el campo: "La tienda no se puede cambiar una vez creado el pedido."
- El `storeId` se incluye en el FormData como campo oculto (para que el action tenga el valor si lo necesita), pero el backend no lo modifica

### 6.3 Moneda — campo locked

- Mismo patrón visual que la tienda locked (§6.2)
- Muestra "JPY — Yen japonés" (código + nombre localizado)
- Helper: "La moneda no se puede cambiar una vez creado el pedido."
- El `currencyCode` se incluye como campo oculto en el FormData

### 6.4 Fechas — campos editables

- **Fecha de orden:** `<input type="date">` editable, pre-relleno con el valor actual
- **Fecha aprox. de entrega:** DateRangePicker trigger + calendar popup, pre-relleno con el rango actual (o placeholder si no hay)
- Ambos campos siguen las mismas reglas de validación que en create (ver `order-create.md §7`)

### 6.5 Tabla de productos (spreadsheet)

Mismo componente `OrderItemsGrid` que en create, pero pre-poblado con `initialOrder.items`.

Diferencias clave respecto a create:

- Cada fila incluye el `id` del `OrderItem` (se serializa en el JSON `items` del FormData)
- El upsert en el backend actualiza filas existentes (por `id`), inserta filas nuevas (sin `id`), y elimina las que se borraron del array
- El usuario puede añadir, editar, reordenar y eliminar ítems libremente

### 6.6 "Usar este total" y discrepancia

Mismo comportamiento que `order-create.md §6.6` y `§6.9`:

- "Usar este total" rellena el Costo total con la suma calculada
- Al clic en "Guardar cambios": si al menos un ítem tiene precio **y** la suma difiere del total ingresado → dispara la modal de discrepancia (2 opciones: "Volver y corregir" / "Guardar de todos modos")

### 6.7 Tipo de cambio — "Hoy"

Mismo comportamiento que `order-create.md §6.7`:

- Botón "Hoy" llama Frankfurter API
- Solo visible/relevante si la moneda del pedido difiere de la moneda base del usuario

### 6.8 Sidebar Resumen — actualizaciones reactivas

El sidebar muestra los valores actuales del form y se actualiza conforme el usuario edita:

| Campo     | Se actualiza cuando                                 |
| --------- | --------------------------------------------------- |
| Tienda    | No cambia (locked)                                  |
| Moneda    | No cambia (locked)                                  |
| Fecha     | Al modificar fecha de orden                         |
| Productos | Al añadir/editar/eliminar ítems (muestra "N ítems") |
| Total     | Al modificar Costo total                            |

Los valores del sidebar aparecen en `--warning` para comunicar el contexto de edición activa (no indica necesariamente que los valores son distintos al estado guardado).

### 6.9 Cancelar — detección de cambios pendientes

Al hacer clic en "Cancelar" del form-footer (o al usar el back-link `← ORD-XXXXXX`):

- Si el form **no tiene cambios** respecto a `initialOrder`: navegar directamente a `/orders/[id]`
- Si el form **tiene cambios pendientes**: mostrar modal discard (§5.5)
  - "Quedarse" → cierra modal, permanece en el form
  - "Salir" → navega a `/orders/[id]` descartando cambios

La detección de cambios se realiza comparando el estado actual del form con `initialOrder` (shallow comparison de los campos principales: orderDate, expectedDeliveryFrom/To, totalCost, exchangeRate, items).

### 6.10 Redirección en éxito

```
editOrderAction → { success: true, orderId } → router.push(`/orders/${orderId}`)
```

- Toast `orders.edit.successToast` ("Pedido guardado") visible en la pantalla de detalle
- No hay view transition específica para el edit → detail (solo redirect estándar)

---

## §7 · Validaciones

### 7.1 Cliente (al submit)

| Campo                | Regla cliente                                                         |
| -------------------- | --------------------------------------------------------------------- |
| Fecha de orden       | Requerido; formato fecha válido                                       |
| Fecha entrega rango  | Si `to` < `from`: error inline                                        |
| Nombre ítem          | Requerido por fila existente                                          |
| Cantidad ítem        | Entero ≥ 1                                                            |
| Precio unitario ítem | Opcional; si se ingresa, advertencia si = 0 (no bloquea)              |
| Al menos 1 ítem      | Requerido al guardar (aplica misma regla que en create, ADR 0001 OC2) |
| Costo total          | Requerido; debe ser > 0                                               |
| Tipo de cambio       | Opcional; si ingresado: 0.01–99999.99, máx 2 decimales                |

### 7.2 Servidor (`orderEditSchema`)

| Campo                     | Regla Zod                                                              |
| ------------------------- | ---------------------------------------------------------------------- |
| `storeId`                 | `string().cuid()` opcional (no modificable)                            |
| `orderDate`               | `coerce.date()` opcional                                               |
| `currencyCode`            | `string().length(3)` + `isAllowedCollectorBaseCurrency()` opcional     |
| `totalCost`               | `number().int().min(1).max(999_999_999)` opcional                      |
| `exchangeRate`            | `number().min(0.01).max(99_999.99).multipleOf(0.01)` nullable opcional |
| `expectedDeliveryFrom/To` | `coerce.date()` nullable opcional; cross-field: `to >= from`           |
| `items[].id`              | `string().cuid()` opcional (existente si fila pre-existía)             |
| `items[].name`            | `string().min(1).max(500)`                                             |
| `items[].quantity`        | `number().int().min(1)`                                                |
| `items[].unitPrice`       | `number().int().min(0)` nullable opcional                              |
| `items[].position`        | `number().int().min(1)`                                                |

Los `fieldErrors` se mapean a mensajes inline bajo cada campo afectado.

---

## §8 · i18n keys

Namespace: `orders` (`src/i18n/locales/{locale}/orders.json`)

| Key                             | Existente / nueva                    | Cambio requerido en Fase B                                       |
| ------------------------------- | ------------------------------------ | ---------------------------------------------------------------- |
| `edit.title`                    | existente                            | Sin cambio (`"Editar pedido · {humanReadableId}"`)               |
| `edit.backToOrder`              | existente                            | Sin cambio (`"Volver al pedido"`)                                |
| `edit.heroEyebrow`              | existente                            | Sin cambio (`"Editar pedido"`)                                   |
| `edit.submit`                   | existente                            | Sin cambio (`"Guardar cambios"`)                                 |
| `edit.submitting`               | existente                            | Sin cambio (`"Guardando…"`)                                      |
| `edit.successToast`             | existente                            | Sin cambio (`"Pedido guardado"`)                                 |
| `edit.discardTitle`             | existente                            | Sin cambio (`"¿Salir sin guardar?"`)                             |
| `edit.discardMessage`           | existente                            | Sin cambio (`"Los cambios que hiciste no se guardarán."`)        |
| `edit.discardConfirm`           | existente                            | Sin cambio (`"Salir"`)                                           |
| `edit.discardCancel`            | existente                            | Sin cambio (`"Quedarse"`)                                        |
| `edit.sectionDatosTitle`        | **nueva**                            | Eyebrow de sección 1: `"Datos del pedido"`                       |
| `edit.sectionProductosTitle`    | **nueva**                            | Eyebrow de sección 2: `"Productos y costos"`                     |
| `edit.sectionProductosSubtitle` | **nueva**                            | H3 sección 2: `"Ítems y total del pedido"`                       |
| `edit.summaryTitle`             | **nueva**                            | Título sidebar: `"Resumen"` (o reutilizar `create.summaryTitle`) |
| `form.storeLockedHelper`        | **nueva**                            | `"La tienda no se puede cambiar una vez creado el pedido."`      |
| `form.currencyLockedHelper`     | **nueva**                            | `"La moneda no se puede cambiar una vez creado el pedido."`      |
| `form.orderDateLabel`           | existente                            | Sin cambio                                                       |
| `form.deliveryRangeLabel`       | existente                            | Sin cambio                                                       |
| `form.deliveryRangePlaceholder` | existente                            | Sin cambio                                                       |
| `form.totalCostLabel`           | existente                            | Sin cambio                                                       |
| `form.exchangeRateLabel`        | existente                            | Sin cambio                                                       |
| `form.fxTodayButton`            | **nueva** (ver `order-create.md §8`) | `"Hoy"`                                                          |
| `form.fxTodayError`             | **nueva** (ver `order-create.md §8`) | Error FX fetch                                                   |
| `form.calculatedTotal`          | **nueva** (ver `order-create.md §8`) | `"Total calculado desde ítems: {total}"`                         |
| `form.useCalculatedTotal`       | **nueva** (ver `order-create.md §8`) | `"Usar este total"`                                              |
| `form.addItemButton`            | existente                            | Revisar unificación con demo (ver `order-create.md §12 nota 5`)  |
| `discrepancyModal.*`            | existente → cambios                  | Ver `order-create.md §8` — mismos cambios aplican aquí           |
| `validation.*`                  | existente                            | Sin cambios                                                      |
| `error.*`                       | existente                            | Sin cambios; agregar `error.STORE_CHANGE_BLOCKED` si no existe   |

---

## §9 · Accesibilidad

- **Campos locked (Tienda, Moneda):** `aria-disabled="true"` en el contenedor; NO usar `<input disabled>` (no hay campo de texto) — el contenedor es un `<div>` con la información visual. Incluir texto visible descriptivo ("La tienda no se puede cambiar...").
- **Formulario:** mismas reglas que `order-create.md §9` — `<label>` asociados, `aria-invalid`, `aria-describedby` en errores.
- **Section headers (all-open):** los headers de sección no son botones (no son expandibles/colapsables) — usar `<div>` semántico, no `<button>`.
- **DateRangePicker:** mismas reglas que `order-create.md §9`.
- **Tabla spreadsheet:** mismas reglas que `order-create.md §9`.
- **Modal discard:** patrón ADR 0008 B — `role="dialog"`, `aria-modal="true"`, foco inicial en "Quedarse" (acción menos destructiva), `Escape` ejecuta "Quedarse".
- **Modal discrepancia:** mismas reglas que `order-create.md §9`.
- **CTA "Guardar cambios" deshabilitado:** atributo `disabled` nativo.
- **Anuncio de éxito:** el toast de éxito debe tener `role="status"` o anunciarse via `aria-live="polite"`.

---

## §10 · Edge cases

1. **Order no encontrado o de otro usuario:** `getOrderById` retorna `null` → `notFound()` en el Server Component → página 404.
2. **Order cancelado o completado accedido via URL directa:** El Server Component no bloquea el acceso por status; la UI muestra los campos editables normalmente. Si el backend tiene restricciones (ej. no editar pedidos cancelados), el `editOrderAction` debe retornar el error apropiado.
3. **Red caída durante submit:** `editOrderAction` captura con Sentry, retorna `{ success: false, error: "server_error" }`; toast error, form interactivo.
4. **Ítem existente eliminado del grid:** el ítem desaparece del array `items` en el FormData → el backend lo borra. Si el ítem tiene un delivery asociado, el backend retorna `error: "ITEM_HAS_LIVE_DELIVERY"`.
5. **Ítem con `unitPrice = 0` explícito:** mismo comportamiento que en create — no bloquea submit.
6. **Frankfurter API indisponible:** toast inline, usuario ingresa manualmente.
7. **Cambios mínimos (solo fecha):** el submit es válido aunque solo cambien las fechas; ítems y totalCost se reenvían sin modificar.
8. **`orderDate` anterior a la fecha de creación del pedido:** no hay restricción de negocio; el schema lo acepta.
9. **Back-link clicado con form sin cambios:** navega directamente sin modal discard.
10. **Back-link clicado con form con cambios:** dispara modal discard (§5.5), mismo comportamiento que "Cancelar".
11. **Browser back/forward con cambios pendientes:** idealmente interceptar con `beforeunload` o el equivalente de Next.js; si no se puede interceptar, los cambios se pierden silenciosamente (acceptable degradation).
12. **`exchangeRate` previamente guardado con más de 2 decimales:** si el valor existente en DB tiene más de 2 decimales (bug de datos históricos), truncar al mostrar en el input para evitar que el schema rechace el submit.

---

## §11 · Anti-patrones

- ❌ **No convertir los campos locked en `<input disabled>`** — renderizar como `<div>` read-only semántico con `aria-disabled` para evitar que el DOM tenga valores mutables que puedan enviarse accidentalmente.
- ❌ **No mostrar un stepper** en el edit — L020 all-open es intencional; no copiar el wizard de create.
- ❌ **No usar el patrón `BackNavLink`** (pill) como back-link — usar el patrón `back-link` minimalista (texto + arrow-left 12px).
- ❌ **No omitir la detección de cambios pendientes** al "Cancelar" — siempre verificar si hay cambios antes de navegar; si los hay, mostrar modal discard.
- ❌ **No redirigir a `/orders`** (la lista) en éxito — redirigir a `/orders/[id]` (el detalle del pedido editado).
- ❌ **No permitir que `storeId` o `currencyCode` sean modificables** desde el formulario aunque se pasen en el FormData — el backend debe ignorar o validar que no cambiaron.
- ❌ **No mostrar la modal discard** si el usuario hace clic en "Cancelar" sin haber modificado ningún campo — navegar directamente.
- ❌ **No copiar la lógica de los section-card headers del edit como botones colapsables** — en all-open los headers son estáticos (no son `<button>`).
- ❌ **No recargar el pedido** desde el servidor después de un error de submit — mantener el estado del formulario para que el usuario no pierda cambios.

---

## §12 · Notas para Fase B

1. **`OrderForm mode="edit"` — adaptar al all-open:** El `OrderForm` existente probablemente implementa el wizard de 5 pasos. La prop `mode="edit"` ya existe en el componente. Verificar si `mode="edit"` ya implementa el comportamiento all-open o si hay que añadirlo. El atributo `data-all-open` en el `div.section-cards` controla este comportamiento en el demo.

2. **Section headers estáticos:** En edit, los headers de las `section-card` son estáticos (no son `<button>`). Implementar un variant del componente `section-card` o condicionalmente renderizar el header como `<div>` vs `<button>` según `mode`.

3. **Detección de cambios — implementación:** Comparar `form state` con `initialOrder` en el cliente. Opciones:
   - `useFormState` + comparación custom en el componente
   - Librería `react-hook-form` ya existente en el proyecto (si aplica)
   - Escuchar `beforeunload` del browser como fallback
     Priorizar que el botón "Cancelar" del footer y el `back-link` usen la misma lógica.

4. **Campos locked — UX del contenedor:** El demo muestra los campos locked con `opacity: 0.7`. Considerar si se agrega un tooltip al hover sobre el icono `lock` explicando por qué está bloqueado (mejora accesibilidad para usuarios que no lean el helper text). Esto es opcional para Fase B.

5. **Toast de éxito — persistir entre rutas:** El toast "Pedido guardado" debe mostrarse en la pantalla de destino (`/orders/[id]`), no en la pantalla de edit antes de redirigir. Implementar via flash message (cookie temporal, URL query param, o estado del router de Next.js). Verificar el patrón usado en el módulo Tiendas (S6) para consistencia.

6. **`exchangeRate` en el edit:** Si `exchangeRate` existe en el pedido, pre-rellenar el input. Si es `null`, dejar el input vacío. Al guardar con el campo vacío, enviar `null` (limpiar el tipo de cambio). Verificar que el backend acepte `null` en el schema opcional.

7. **Ítems sin precio en edit:** Si `initialOrder.items` tiene filas con `unitPrice = null`, renderizar el campo precio vacío (no `0`). El `0` y `null` tienen significados distintos en el modelo de datos.

8. **`error.STORE_CHANGE_BLOCKED`** — verificar existencia en `orders.error.*` y en el `editOrder` mutation del backend. El mensaje "Solo puedes cambiar la tienda si el pedido está abierto y sin envíos." ya existe en `orders.json` pero la UI no ofrece esta opción, por lo que el error no debería dispararse normalmente.
