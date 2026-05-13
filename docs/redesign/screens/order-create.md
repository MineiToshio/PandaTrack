---
title: Order create
session: 07
status: spec-complete
methodology: §6.quinquies
last_updated: 2026-05-12
demo_anchors:
  - s7-order-create-step-1
  - s7-order-create-step-2
  - s7-order-create-step-3
  - s7-order-create-empty-stores
  - s7-order-create-discrepancy-modal
  - s7-order-create-mobile
  - s7-order-create-step-2-mobile
  - s7-order-create-step-3-mobile
  - s7-order-create-add-product-mobile
  - s7-order-create-discrepancy-mobile
  - s7-order-create-empty-stores-mobile
  - s7-store-picker-mobile
  - s7-currency-picker-mobile
  - s7-product-type-picker-mobile
  - s7-date-range-picker-mobile
supersedes: order-create.md (session 02 — old 5-step wireframe)
---

# Pantalla: Crear pedido (`/orders/new`)

> Spec §6.quinquies · S7 Fase A · Módulo Órdenes

---

## §1 · Layout

**Ruta:** `/[locale]/orders/new`  
**Patrón:** `form-grid` (main column + sticky `form-sidebar`)  
**Demo:** `#s7-order-create-step-1` (paso 1), `#s7-order-create-step-2` (paso 2), `#s7-order-create-step-3` (paso 3)

### Desktop (≥ 768px)

```
┌─────────────────── app-topbar (sticky 48px) ──────────────────────┐
│ [nav: Pedidos] › Nuevo pedido          [ES]  [☀ tema]             │
└───────────────────────────────────────────────────────────────────┘
← Pedidos                              ← back-link (text, arrow 12px)

┌─ page-heading ────────────────────────────────────────────────────┐
│  h1  Nuevo pedido                                                  │
└───────────────────────────────────────────────────────────────────┘

[stepper: ①Datos  ②Productos y costos  ③Confirmar]

┌─── form-grid ─────────────────────────────────────────────────────┐
│  ┌─ section-cards (wizard) ──────────────────┐  ┌─ form-sidebar ─┐│
│  │                                           │  │  Resumen       ││
│  │  [paso activo expandido]                  │  │  Tienda: —     ││
│  │  [pasos completados: collapsed/expandible]│  │  Moneda: —     ││
│  │  [pasos futuros: locked collapsed]        │  │  Fecha: —      ││
│  │                                           │  │  Productos: —  ││
│  │  [wizard-actions: ← Atrás  Continuar →]  │  │  Total: —      ││
│  └───────────────────────────────────────────┘  └────────────────┘│
└───────────────────────────────────────────────────────────────────┘
```

### Mobile (< 768px)

Single column.

**Topbar (static shell, ContentHeader.tsx).** Patrón canónico S7-A.6: `[☰ hamburger]` + breadcrumb `Pedidos` (link) + chevron-sep + título "Nuevo pedido". Sin `X cancelar` en el topbar — esa acción se reubicó como back-link en page content. **Sin `page-heading`** (el topbar ya muestra el título).

**Back-link en page content.** Inmediatamente debajo del topbar: `<a class="s7-mob-back-link"><i lucide="arrow-left"/> Pedidos</a>`. Reemplaza la `X` que vivía en topbar-right. Da una salida del wizard explícita y thumb-reachable. El stepper compacto va debajo.

El wizard ocupa el viewport completo sin nav bar inferior — el sticky footer del CTA no tiene interferencia.

**Stepper compacto en mobile** (no 3-pill stepper): texto "Paso X de 3 · {nombre paso}" + barra de progreso horizontal de 3 segmentos (segmento active en `var(--accent)`, próximos en `var(--border)`). Ahorra ~40px verticales vs el stepper de pills.

**Pasos no activos** (cuando el user está en paso 1, los pasos 2 y 3 aparecen colapsados pero **NO en `opacity:0.5`** — usar patrón `locked/gated` con icono `lock` 14px a la derecha + `aria-disabled="true"`, sin opacity, color muted en numeral y title "Disponible al continuar"). El patrón comunica "estos pasos existen pero aún no son accesibles" sin romper contraste AA.

**Sticky footer CTA** (`safe-area-inset-bottom` respetado, `min-height: 44px` per HIG):

- Paso 1: solo `[Continuar →]` primary full-width.
- Paso 2: `[← Atrás (ghost flex 0)]` + `[Continuar → (primary flex:1)]`.
- Paso 3: `[← Atrás (ghost flex 0)]` + `[Crear pedido ✓ (primary flex:1)]`.

**Sidebar Resumen** omitido en paso 1 (las 5 filas vacías "—" son ruido sin valor). Aparece **solo en paso 3** como parte del resumen del summary-list (no como aside aparte). En paso 2, el subtotal calculado se muestra inline arriba del campo Costo total ("Total calculado: $X" + botón "Usar este total").

**Pickers mobile** (Tienda, Moneda, Tipo de producto, Fecha aprox. de entrega): NO son popovers como desktop. Cada uno abre un **bottom sheet** (o full-screen sheet para calendarios) dedicado — ver §5.X y §6.X correspondientes.

### Anchors estructurales del demo

| Sección                     | Demo ID                                | Descripción                                                                                             |
| --------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Paso 1 — Datos              | `#s7-order-create-step-1`              | Tienda + Moneda + Fechas                                                                                |
| Paso 2 — Productos y costos | `#s7-order-create-step-2`              | Spreadsheet + total + FX                                                                                |
| Paso 3 — Confirmar          | `#s7-order-create-step-3`              | Resumen + CTA crear                                                                                     |
| Empty stores gate           | `#s7-order-create-empty-stores`        | Sin tiendas: empty state en step-1                                                                      |
| Modal discrepancia          | `#s7-order-create-discrepancy-modal`   | Warning modal 2 botones                                                                                 |
| **Mobile Paso 1**           | `#s7-order-create-mobile`              | Wizard mobile en paso 1 (form completo)                                                                 |
| **Mobile Paso 2**           | `#s7-order-create-step-2-mobile`       | Wizard mobile paso 2 (productos list + add + **FX field + Hoy button**, parity con desktop tras S7-A.5) |
| **Mobile Paso 3**           | `#s7-order-create-step-3-mobile`       | Wizard mobile paso 3 (confirm review)                                                                   |
| **Mobile Añadir producto**  | `#s7-order-create-add-product-mobile`  | Bottom sheet de form de producto sobre paso 2                                                           |
| **Mobile Discrepancia**     | `#s7-order-create-discrepancy-mobile`  | Bottom sheet alertdialog 2 opciones                                                                     |
| **Mobile Sin tiendas**      | `#s7-order-create-empty-stores-mobile` | Empty state mobile con CTA "Crear tienda"                                                               |
| **Mobile Picker Tienda**    | `#s7-store-picker-mobile`              | Bottom sheet con search + lista de tiendas                                                              |
| **Mobile Picker Moneda**    | `#s7-currency-picker-mobile`           | Bottom sheet con search + lista de monedas                                                              |
| **Mobile Picker Tipo**      | `#s7-product-type-picker-mobile`       | Bottom sheet con search + lista de tipos                                                                |
| **Mobile Picker Fecha**     | `#s7-date-range-picker-mobile`         | Full-screen sheet con calendario + presets                                                              |

> **NOTA metodológica:** El demo también contiene secciones `#s7-order-create-step-3-validation` y `#s7-order-create-step-1-from-store`. Estas secciones son **OLD — supersedidas** (pertenecen al wizard de 5 pasos de una iteración anterior). El wizard canónico es **3 pasos** (Datos → Productos y costos → Confirmar). Las secciones step-4 y step-5 del demo también pertenecen a la iteración obsoleta.

---

## §2 · Componentes consumidos

| Componente                  | Spec / origen                                                             | Props clave                                       | Uso específico                                                   |
| --------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------- |
| `Header`                    | `src/components/modules/AppShell/Header.tsx`                              | `title`, `breadcrumb`                             | topbar sticky; breadcrumb "Pedidos › Nuevo pedido"               |
| `back-link` (patrón CSS)    | `docs/redesign/PLAYBOOK.md §5.3`                                          | —                                                 | `← Pedidos` con arrow-left 12px; vuelve a `/orders`              |
| `page-heading` (patrón CSS) | `docs/redesign/PLAYBOOK.md §5.2`                                          | —                                                 | `h1 "Nuevo pedido"` sin meta-text                                |
| `StepperBar` ⚠️             | **nuevo componente** — ver §12 nota 1                                     | `steps[]`, `currentStep`, `completedSteps[]`      | Indicador de 3 pasos arriba del form-grid                        |
| `OrderStoreSelect`          | `src/app/[locale]/(app)/orders/_components/share/OrderStoreSelect.tsx`    | `value`, `onChange`, `stores[]`, `disabled`       | Combobox tienda en paso 1; con store-avatar y clear-X            |
| `OrderCurrencySelect`       | `src/app/[locale]/(app)/orders/_components/share/OrderCurrencySelect.tsx` | `value`, `onChange`, `disabled`                   | Select moneda en paso 1; auto-fill desde país de tienda          |
| `DateRangePicker` ⚠️        | **nuevo componente** — ver §12 nota 2                                     | `from`, `to`, `onChange`, `placeholder`           | Trigger button + calendar popup para entrega estimada            |
| `OrderItemsGrid`            | `src/app/[locale]/(app)/orders/_components/share/OrderItemsGrid.tsx`      | `items[]`, `currency`, `onChange`, `errors`       | Tabla spreadsheet de productos en paso 2                         |
| `OrderEmptyState`           | `src/app/[locale]/(app)/orders/_components/share/OrderEmptyState.tsx`     | —                                                 | Gate: sin tiendas disponibles                                    |
| `DiscrepancyModal`          | `src/app/[locale]/(app)/orders/_components/share/DiscrepancyModal.tsx`    | `entered`, `calculated`, `onBack`, `onSaveAnyway` | Modal warning 2 botones (ver §6.9 y §12 nota 3)                  |
| `OrderForm`                 | `src/app/[locale]/(app)/orders/_components/share/OrderForm.tsx`           | `action`, `initialData`, `mode="create"`          | Contenedor de form con `useActionState`; wrappea todos los pasos |
| `section-card` (patrón CSS) | demo: `div.section-card.section-card-wizard`                              | `data-step`, `is-active`, `is-done`               | Cada paso del wizard                                             |

---

## §3 · Datos consumidos

### Servidor (Server Component, `new/page.tsx`)

```ts
// Tiendas del usuario para el combobox
const stores = await getStoresByUser(userId);
// → Store[] { id, name, countryCode, defaultCurrencyCode, avatarLetter }

// storeId desde searchParams (contexto "desde tienda")
const prefilledStoreId = searchParams?.storeId ?? null;
```

### No hay query de pedido

Esta pantalla crea un pedido nuevo. No se carga ningún `Order` existente.

### Tipos de producto (catálogo estático)

```ts
// src/lib/catalog/productTypes.ts (ya existe)
type ProductType = {
  key: string; // "MANGA", "MUSIC", "FIGURE", ...
  labelKey: string; // i18n key
  icon: LucideIconName; // "book-open", "disc", "shapes", ...
};
```

El `OrderItemsGrid` ya consume este catálogo internamente.

---

## §4 · Server actions invocadas

| Acción              | Archivo                                                  | Cuándo se invoca                                                    | Retorno                                                                  |
| ------------------- | -------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `createOrderAction` | `src/app/[locale]/(app)/orders/_actions/orderActions.ts` | Click "Crear pedido" en paso 3, después de pasar validación cliente | `{ success: true, orderId }` o `{ success: false, error, fieldErrors? }` |

### Firma relevante

```ts
export async function createOrderAction(
  _prev: OrderActionResult | null,
  formData: FormData,
): Promise<OrderActionResult>;

// FormData keys esperadas:
// storeId               string (cuid)
// orderDate             string (YYYY-MM-DD)
// expectedDeliveryFrom  string | null
// expectedDeliveryTo    string | null
// currencyCode          string (3 chars)
// totalCost             string (número entero, minor units)
// exchangeRate          string | null
// items                 string (JSON serializado)
```

---

## §5 · Estados visuales

### 5.1 Paso 1 — Datos (estado inicial vacío)

- Stepper: paso 1 activo (numerado), pasos 2-3 inactivos
- `section-card` paso 1 expandida, pasos 2-3 colapsadas/bloqueadas
- Campos Tienda y Moneda vacíos; fecha de orden vacía; DateRangePicker muestra placeholder "Ej: 20 jun – 15 jul 2026"
- Sidebar "Resumen": todos los valores en `text-muted` "—"
- CTA único: "Continuar →" (deshabilitado hasta que Tienda, Moneda y Fecha de orden estén completos)

### 5.2 Paso 1 — pre-filled desde contexto tienda (`?storeId=xxx`)

- Campo Tienda muestra la tienda seleccionada en un contenedor accent (fondo `color-mix(accent 7%, surface)`, borde accent 28%) con store-avatar, nombre, país/categoría y badge "↳ DESDE TIENDA"
- Helper "Puedes [cambiar la tienda] si lo necesitas." con link inline underline
- Moneda se auto-selecciona a la moneda por defecto del país de la tienda (si está disponible)
- CTA "Continuar →" habilitado si la moneda ya está seleccionada

### 5.3 Paso 1 — Empty stores gate

- Dentro de la `section-card` paso 1 (stepper visible, 3 pasos, paso 1 activo)
- Empty state: icono `store` 32px + h3 "Sin tiendas aún" + texto muted + botón accent "Crear primera tienda" → `/stores/new`
- Pasos 2 y 3 del stepper visibles pero inaccessibles (`pointer-events: none`, apariencia inactiva)
- No hay CTA "Continuar"

### 5.4 Paso 2 — Productos y costos

- Paso 1 colapsado con `is-done` (mostrando resumen "Solaris Books · JPY · 3 may 2026")
- Spreadsheet vacía o con filas existentes
- Sección inferior: "Total calculado desde ítems: ¥0" + "Usar este total" (deshabilitado si no hay ítems con precio)
- grid-2: Costo total (requerido, vacío) + Tipo de cambio (opcional, vacío)
- CTAs: "← Atrás" (ghost) + "Continuar →" (deshabilitado si totalCost vacío o hay errores en ítems)

### 5.5 Paso 2 — Error de validación inline

- Filas con nombre vacío: label rojo con icono `alert-circle`, input con `border-color: var(--destructive)`, `aria-invalid="true"`
- Filas con precio 0 explícito: label rojo "Precio mayor a 0" (warning cliente; ver §10 edge case 6)
- `section-card` del paso activo: borde coloreado `color-mix(destructive 35%, transparent)`, `step-num` con borde destructive y número "!" en rojo
- Summary en el header del paso: `"2 campos con error"` en `--destructive`
- CTA "Continuar →" deshabilitado con `opacity: 0.5; cursor: not-allowed`

### 5.6 Modal de discrepancia

- Variante **warning** del modal ADR 0008 B
- Título: "Importe no coincide"
- Subtítulo: "La suma de productos difiere del total"
- Cuerpo: comparación en 2 filas ("Suma de productos $X.XXX,00" / "Total ingresado $X.XXX,00") + fila "Diferencia +$XX,00" en `--warning`
- Botones: "Volver y corregir" (ghost) + "Guardar de todos modos" (primary)

### 5.7 Paso 3 — Confirmar

- Pasos 1 y 2 colapsados con `is-done`
- Card `surface-elevated` con grid de resumen: Tienda / Moneda / Fecha / Entrega aprox. (si existe) + divider + "Ítems: N" + divider + "Total del pedido: ¥X.XXX" (font-size 17px, font-weight bold)
- **Card-helper**: "Una vez creado, no podrás cambiar la tienda ni la moneda." (alineado con mobile en S7-A.5; antes desktop decía "Revisa el resumen antes de crear el pedido.").
- **Info banner** (`--info` tint, icon `info`): "El pedido se creará en estado **Abierto**. Podrás registrar pagos y entregas desde el detalle." Portado desde mobile en S7-A.5 para parity.
- Sidebar Resumen: todos los campos rellenados
- CTAs: "← Atrás" (ghost) + "Crear pedido" (primary, icono `check`)

### 5.8 Submitting

- "Crear pedido" → spinner + texto `orders.create.submitting` ("Guardando…")
- Todos los campos deshabilitados; no se puede navegar entre pasos
- El `useActionState` maneja el estado `pending`

### 5.9 Éxito

- Redirección a `/orders/[id]` del pedido recién creado
- View transition `order-{id}` anima la hero card del detail

### 5.10 Error de servidor

- Toast de error con mensaje del namespace `orders.error.*`
- El form vuelve a ser interactivo en el paso activo

---

## §6 · Comportamiento e interacción

### 6.1 Progresión de pasos (gating)

El wizard usa **gating hacia adelante**: no se puede avanzar al siguiente paso si el actual tiene campos requeridos incompletos.

| Paso  | Requerido para "Continuar"                          |
| ----- | --------------------------------------------------- |
| 1 → 2 | `storeId` + `currencyCode` + `orderDate`            |
| 2 → 3 | `totalCost > 0` + al menos 1 ítem con nombre válido |

La navegación **hacia atrás** (clic en paso completado o botón "← Atrás") es siempre libre. Los pasos completados (`is-done`) son clickeables y re-expanden su card sin perder datos.

### 6.2 Tienda — combobox

- Permite búsqueda por texto (filtra por nombre de tienda)
- Muestra store-avatar (letra inicial, bg color-coded) + nombre
- Botón clear "×" visible cuando hay selección
- Al seleccionar una tienda: si la tienda tiene `defaultCurrencyCode`, auto-rellena el campo Moneda **solo si está vacío** — no sobreescribe elección del usuario
- Si no hay tiendas disponibles → gate §5.3
- **CTA "Crear nueva tienda" inline con preservación de contexto (FRD-05 WO-04; alineado en S7-A.8):**
  - **Ubicación:** desktop combobox lo expone al pie de la lista del dropdown abierto (impl: `OrderStoreSelect.tsx` ~líneas 254-270). Mobile picker `#s7-store-picker-mobile` lo expone al pie del sheet por encima del safe-area-inset (impl ya alineada).
  - **Navegación:** `href="/{locale}/stores/new?returnTo=order-create"` — el `returnTo` es la constante canónica del codebase (`RETURN_TO_ORDER_CREATE = "order-create"`, ver `AUTH_RETURN_TO_PARAM`).
  - **Back-link del CreateStoreForm:** debe detectar `returnTo=order-create` y volver a `/{locale}/pedidos/nuevo` (NO a `/{locale}/tiendas`).
  - **Success redirect del CreateStoreForm:** al crear la tienda con éxito, redirige a `/{locale}/pedidos/nuevo?store={createdStoreId}` (impl: `StoreForm.tsx` líneas 515-521). El `?store` es el query param canónico de preselect en este wizard.
  - **Lectura del param de preselect:** el wizard de pedido reanuda y `OrderForm.tsx` (~línea 128) lee `useSearchParams().get("store")` y autoselecciona esa tienda en el combobox. La moneda default se infiere del `defaultCurrencyCode` de la tienda como en el flujo normal.
  - **Por qué importa:** evita que el usuario pierda el progreso del wizard si se da cuenta a mitad del Paso 1 que su tienda no está en el listado. Patrón canónico del FRD; ya existe en implementación.

### 6.3 Moneda — select

- Despliega lista de monedas permitidas (`isAllowedCollectorBaseCurrency`)
- Muestra "JPY — Yen japonés" (código + nombre localizado vía `orders.currencies.*`)
- Una vez avanzado al paso 2, cambiar de moneda regresando al paso 1 no resetea automáticamente los precios del spreadsheet — Fase B decide si advertir al usuario que los precios son en la nueva moneda
- Helper bajo el select: "La moneda no se puede cambiar una vez creado el pedido."

### 6.4 Fecha aprox. de entrega — DateRangePicker

- Trigger button con icono `calendar-days` y placeholder "Ej: 20 jun – 15 jul 2026"
- Al click → abre calendar popup (`aria-haspopup="dialog"`)
- Selección de rango: clic en fecha inicial → clic en fecha final
- Si solo se selecciona fecha inicial, se guarda `expectedDeliveryFrom` con `expectedDeliveryTo = null`
- Botón para limpiar el rango (elimina ambas fechas)
- Validación: `to` no puede ser anterior a `from`; error inline `orders.validation.deliveryToBeforeFrom`
- **Quick-range presets (S7-A.9, paridad desktop+mobile)**: arriba del calendar grid se muestra una fila de chips `.filter-pill` con presets canónicos:
  - **Desktop popup** (`#s7-date-range-picker`): `7 días · 30 días · 60 días · Este mes · Próximo mes` (labels cortos, font-size 11px, separados del calendar por `border-bottom` 1px).
  - **Mobile full-sheet** (`#s7-date-range-picker-mobile`): mismos 5 presets con labels completos `Próximos 7 días · Próximos 30 días · Próximos 60 días · Este mes · Próximo mes` (más espacio disponible).
  - Cada preset, al tap, prellena el rango `from = today` y `to = today + N días` (o `start/end of month` para "Este mes" / "Próximo mes"). El estado `.is-active` se aplica al preset cuyo rango coincida exactamente con la selección actual del usuario.
  - Las claves i18n correspondientes: `orders.create.dateRange.preset.next7Days`, `preset.next30Days`, `preset.next60Days`, `preset.thisMonth`, `preset.nextMonth`. Versión corta (desktop) vs larga (mobile) se resuelve en el componente.

### 6.5 Tabla de productos (spreadsheet)

Delega completamente al componente `OrderItemsGrid`. Comportamiento documentado en `src/app/[locale]/(app)/orders/_components/share/OrderItemsGrid.tsx` (538 líneas).

Resumen de columnas visibles:

| Col                       | Tipo                    | Min-width | Observaciones                |
| ------------------------- | ----------------------- | --------- | ---------------------------- |
| grip-handle               | `<span>` (drag)         | 24px      | Drag-and-drop para reordenar |
| Nombre                    | `<input type="text">`   | 160px     | Requerido por fila           |
| Cant.                     | `<input type="number">` | 52px      | Mínimo 1; entero             |
| Precio unit. `{currency}` | `<input type="number">` | 110px     | Opcional; null si vacío      |
| Tipo                      | `<button>` dropdown     | 110px     | Icono + label + chevron-down |
| ×                         | `<button>`              | 28px      | Eliminar fila                |

Atajos de teclado (mostrados en hint bajo la tabla):

| Atajo       | Acción                      |
| ----------- | --------------------------- |
| `Ctrl⇧↑↓←→` | Navegar entre celdas        |
| `Ctrl⇧↵`    | Insertar fila debajo        |
| `Alt⇧↑↓`    | Reordenar fila arriba/abajo |
| `Ctrl⇧⌫`    | Eliminar fila activa        |

En mobile: el grid compacta a tarjetas (comportamiento existente del componente).

### 6.6 "Usar este total"

- Siempre visible bajo la tabla, separado por un `<hr>`
- Muestra: "Total calculado desde ítems: ¥X.XXX" (Σ qty × unitPrice de ítems con precio)
- Botón "Usar este total" (accent sm): rellena el campo "Costo total" con el valor calculado
- Deshabilitado si la suma es 0 (ningún ítem tiene precio)
- El cálculo es **no-binding**: el usuario puede editar manualmente el campo después de usarlo

### 6.7 Tipo de cambio — "Hoy" (Frankfurter API)

- Botón "Hoy" (accent) junto al input de tipo de cambio
- Al click: `GET https://api.frankfurter.app/latest?from={currencyCode}&to={baseCurrency}` (gratuito, sin API key)
- En loading: spinner en el botón, campo deshabilitado
- En éxito: rellena el input con la tasa devuelta
- En error de red / timeout: toast inline bajo el campo `orders.form.fxTodayError`
- Solo visible/relevante si el pedido es en moneda distinta a la base del usuario
- El campo acepta hasta 2 decimales (`exchangeRateSchema.multipleOf(0.01)`)

### 6.8 Sidebar Resumen — actualizaciones reactivas

| Campo     | Se actualiza cuando                                     |
| --------- | ------------------------------------------------------- |
| Tienda    | Al seleccionar tienda en paso 1                         |
| Moneda    | Al seleccionar moneda en paso 1                         |
| Fecha     | Al completar fecha de orden en paso 1                   |
| Productos | Al añadir/modificar ítems en paso 2 (muestra "N ítems") |
| Total     | Al modificar campo Costo total en paso 2                |

### 6.9 Modal de discrepancia — lógica de disparo

La modal se muestra al intentar avanzar de paso 2 a paso 3 **si y solo si**:

1. Al menos un ítem tiene `unitPrice` rellenado, **Y**
2. Σ (qty × unitPrice) **difiere** del valor en "Costo total" ingresado manualmente

Opciones del modal:

- **"Volver y corregir"** (ghost): cierra modal, regresa foco al campo Costo total en paso 2
- **"Guardar de todos modos"** (primary): avanza al paso 3 conservando el `totalCost` ingresado (no se reemplaza con el derivado)

> **Diferencia de comportamiento respecto al FRD:**
>
> | Aspecto                  | FRD FR-05-13 original                                    | Redesign demo S7-A                                     | Razón                                                                                                                | ¿ADR?                     |
> | ------------------------ | -------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------- |
> | Opciones de discrepancia | 3 opciones: mantener ingresado / usar calculado / volver | 2 opciones: volver y corregir / guardar de todos modos | Simplifica la decisión; el campo Costo total es siempre autoritativo; el calculado es ayuda, no reemplazo automático | No — decisión de UX menor |
>
> La i18n existente tiene 3 keys en `discrepancyModal` (`keepEntered`, `useCalculated`, `goBack`). **Fase B debe adaptar a 2** (`goBack` → "Volver y corregir", nuevo key `saveAnyway`). Ver §12 nota 3.

### 6.10 Empty stores gate

Si `stores.length === 0` al cargar la página:

- El Server Component pasa `stores = []` al form
- El paso 1 muestra `OrderEmptyState` (icono `store`, "Sin tiendas aún", botón "Crear primera tienda" → `/stores/new`)
- El stepper muestra 3 pasos pero pasos 2-3 con `pointer-events: none`
- No se renderiza ningún campo de formulario

### 6.11 Contexto "desde tienda" (ADR 0001 D2)

Cuando la URL incluye `?storeId=<cuid>`:

- El Server Component verifica que la tienda exista y pertenezca al usuario
- Si válido: pasa `prefilledStoreId` al `OrderForm`; el paso 1 muestra la tienda en estilo "desde tienda" (fondo accent, badge "↳ DESDE TIENDA")
- Helper con link para cambiarla inline
- Moneda auto-rellena si `defaultCurrencyCode` disponible
- Si el storeId no existe o no pertenece al usuario: se ignora; paso 1 vacío

### 6.12 Redirección en éxito

```
createOrderAction → { success: true, orderId } → router.push(`/orders/${orderId}`)
```

- View transition: `view-transition-name: order-create-confirm` en la card de confirmación del paso 3; `view-transition-name: order-{id}` en la `.detail-hero` del destino
- Si la navegación falla: toast de error, form permanece interactivo

### 6.13 Gestos mobile

- **Tap en field Tienda** (paso 1) → abre `#s7-store-picker-mobile` (bottom sheet con search + lista de tiendas con avatar + meta). Selección cierra el sheet y rellena el field.
- **Tap en field Moneda** (paso 1) → abre `#s7-currency-picker-mobile` (bottom sheet con search + lista de monedas). La moneda base del user aparece marcada con check + label "Moneda base · Sin tipo de cambio". Resto requieren FX.
- **Tap en field Fecha del pedido** (paso 1) → invoca `<input type="date">` nativo del SO (iOS date wheel / Android calendar picker). NO custom sheet — el picker nativo es más rápido y familiar.
- **Tap en field Fecha aprox. de entrega** (paso 1) → abre `#s7-date-range-picker-mobile` (full-screen sheet con calendar 2 meses + quick presets "Próximos 7/30/60 días, Este/Próximo mes" + range visualization en banner highlighted).
- **Tap en pill de Tipo de producto** (paso 2 — fila de productos): abre `#s7-product-type-picker-mobile` (bottom sheet con search + lista de tipos con icon Lucide + label).
- **Tap en `+ Añadir producto`** (paso 2): abre `#s7-order-create-add-product-mobile` (bottom sheet con form: Nombre, Tipo de producto, Cantidad, Precio unitario opcional + helper "Si dejás el precio vacío, podés agregarlo más tarde").
- **Tap en `pencil` edit de un producto existente** (paso 2): abre el mismo bottom sheet de Añadir producto pero con campos prefilled — modo edición.
- **Discrepancia detectada al "Continuar"** desde paso 2: abre `#s7-order-create-discrepancy-mobile` (bottom sheet alertdialog con icon `alert-triangle` warning + comparación ¥30.000 ingresado vs ¥15.800 calculado + panel "¿Por qué puede pasar?" + 2 botones "Volver y corregir" / "Guardar de todos modos"). 2 opciones, NO 3 (CB-02).
- **Tap en `X` del topbar mobile** → confirma con browser dialog nativo si hay cambios sin guardar; si confirma, navega a `/orders` (lista).
- **Drag-to-dismiss en bottom sheets**: pickers (Tienda/Moneda/Tipo) y Add product permiten drag down para cerrar. Discrepancy alertdialog NO permite drag-dismiss accidental.
- **Pull-to-refresh** en cualquier paso: comportamiento nativo del browser. NO recomendado durante el flujo de creación (perdés state del form).
- **Tap en step locked** (paso 2 o 3 estando en paso 1) → toast informativo "Completá el paso anterior para continuar". NO navega.

---

## §7 · Validaciones

### 7.1 Cliente (por paso, antes de avanzar)

| Campo                | Regla cliente                                                        |
| -------------------- | -------------------------------------------------------------------- |
| Tienda               | Requerido para avanzar del paso 1                                    |
| Moneda               | Requerido para avanzar del paso 1                                    |
| Fecha de orden       | Requerido; formato fecha válido                                      |
| Fecha entrega rango  | Si `to` < `from`: error inline                                       |
| Nombre ítem          | Requerido por fila existente                                         |
| Cantidad ítem        | Entero ≥ 1                                                           |
| Precio unitario ítem | Opcional; si se ingresa, advertencia si = 0 (no bloquea — ver §10.6) |
| Al menos 1 ítem      | Requerido para avanzar del paso 2 (ADR 0001 OC2)                     |
| Costo total          | Requerido; > 0 para avanzar del paso 2                               |
| Tipo de cambio       | Opcional; si se ingresa: 0.01–99999.99, máx 2 decimales              |

### 7.2 Servidor (`orderCreateSchema`)

| Campo                     | Regla Zod                                                              |
| ------------------------- | ---------------------------------------------------------------------- |
| `storeId`                 | `string().cuid()` requerido                                            |
| `orderDate`               | `coerce.date()` requerido                                              |
| `currencyCode`            | `string().length(3)` + `isAllowedCollectorBaseCurrency()`              |
| `totalCost`               | `number().int().min(1).max(999_999_999)` requerido                     |
| `exchangeRate`            | `number().min(0.01).max(99_999.99).multipleOf(0.01)` nullable opcional |
| `expectedDeliveryFrom/To` | `coerce.date()` nullable opcional; cross-field: `to >= from`           |
| `items[].name`            | `string().min(1).max(500)`                                             |
| `items[].quantity`        | `number().int().min(1)`                                                |
| `items[].unitPrice`       | `number().int().min(0)` nullable opcional                              |
| `items[].position`        | `number().int().min(1)`                                                |

Los `fieldErrors` del servidor se mapean a mensajes inline bajo cada campo afectado.

---

## §8 · i18n keys

Namespace: `orders` (`src/i18n/locales/{locale}/orders.json`)

| Key                              | Existente / nueva | Cambio requerido en Fase B                                                                |
| -------------------------------- | ----------------- | ----------------------------------------------------------------------------------------- |
| `create.title`                   | existente         | Sin cambio                                                                                |
| `create.backToList`              | existente         | Sin cambio                                                                                |
| `create.submit`                  | existente         | Sin cambio (`"Crear pedido"`)                                                             |
| `create.submitting`              | existente         | Sin cambio                                                                                |
| `create.successToast`            | existente         | Sin cambio                                                                                |
| `create.stepDatos`               | **nueva**         | `"Datos"`                                                                                 |
| `create.stepProductos`           | **nueva**         | `"Productos y costos"`                                                                    |
| `create.stepConfirmar`           | **nueva**         | `"Confirmar"`                                                                             |
| `create.stepBack`                | **nueva**         | `"Atrás"`                                                                                 |
| `create.stepContinue`            | **nueva**         | `"Continuar"`                                                                             |
| `create.summaryTitle`            | **nueva**         | `"Resumen"`                                                                               |
| `create.summaryItems`            | **nueva**         | `"{count, plural, one {# ítem} other {# ítems}}"`                                         |
| `create.confirmTotalLabel`       | **nueva**         | `"Total del pedido"`                                                                      |
| `form.storeLabel`                | existente         | Sin cambio                                                                                |
| `form.storePlaceholder`          | existente         | Sin cambio                                                                                |
| `form.storeClearLabel`           | existente         | Sin cambio                                                                                |
| `form.currencyLabel`             | existente         | Sin cambio                                                                                |
| `form.orderDateLabel`            | existente         | Sin cambio                                                                                |
| `form.deliveryRangeLabel`        | existente         | Sin cambio                                                                                |
| `form.deliveryRangePlaceholder`  | existente         | Sin cambio                                                                                |
| `form.totalCostLabel`            | existente         | Sin cambio                                                                                |
| `form.totalCostCalculateLabel`   | existente         | Sin cambio (`"Calcular"`)                                                                 |
| `form.exchangeRateLabel`         | existente         | Sin cambio                                                                                |
| `form.exchangeRateHelper`        | existente         | Sin cambio (`"{from} → {to}"`)                                                            |
| `form.fxTodayButton`             | **nueva**         | `"Hoy"`                                                                                   |
| `form.fxTodayError`              | **nueva**         | `"No se pudo obtener la tasa. Ingresa manualmente."`                                      |
| `form.addItemButton`             | existente         | Revisar: demo dice "+ Añadir producto"; code dice "Agregar artículo" — unificar en Fase B |
| `form.calculatedTotal`           | **nueva**         | `"Total calculado desde ítems: {total}"`                                                  |
| `form.useCalculatedTotal`        | **nueva**         | `"Usar este total"`                                                                       |
| `form.fromStoreContext`          | **nueva**         | `"↳ DESDE TIENDA"`                                                                        |
| `form.changeStore`               | **nueva**         | `"cambiar la tienda"`                                                                     |
| `discrepancyModal.title`         | existente         | Actualizar: `"Importe no coincide"` (era `"Total diferente al calculado"`)                |
| `discrepancyModal.description`   | existente         | Actualizar: mostrar tabla comparativa (suma vs ingresado)                                 |
| `discrepancyModal.goBack`        | existente         | Actualizar: `"Volver y corregir"` (era `"Volver"`)                                        |
| `discrepancyModal.saveAnyway`    | **nueva**         | `"Guardar de todos modos"`                                                                |
| `discrepancyModal.keepEntered`   | existente         | **DEPRECAR** (reemplazado por `saveAnyway`)                                               |
| `discrepancyModal.useCalculated` | existente         | **DEPRECAR** (opción eliminada en redesign)                                               |
| `emptyState.title`               | existente         | Sin cambio                                                                                |
| `emptyState.description`         | existente         | Sin cambio                                                                                |
| `emptyState.cta`                 | existente         | Sin cambio                                                                                |
| `validation.*`                   | existente         | Sin cambios                                                                               |
| `error.*`                        | existente         | Sin cambios                                                                               |

---

## §9 · Accesibilidad

- **Stepper:** `role="tablist"` o list implícita; `aria-current="step"` en paso activo; pasos completados con `aria-label="Paso N completado: {label}"`; pasos futuros con `aria-disabled="true"`.
- **`section-card` del wizard:** botón-header con `aria-expanded` + `aria-controls`; pasos futuros con `aria-disabled="true"`.
- **Formulario:** todos los `<label>` asociados via `for`/`id`. Errores con `aria-invalid="true"` + `aria-describedby` apuntando al mensaje de error.
- **DateRangePicker:** trigger con `aria-haspopup="dialog"` + `aria-expanded`; popup con `role="dialog"`, `aria-label`, foco trasladado al abrirse; `Escape` cierra.
- **Tabla spreadsheet:** `role="grid"`, celdas con `role="gridcell"`, inputs con `aria-label` descriptivo ("Nombre del producto", "Cantidad", "Precio unitario").
- **Botón "Crear primera tienda":** label claro, no necesita `aria-label` adicional.
- **Modal discrepancia:** patrón ADR 0008 B — `role="dialog"`, `aria-modal="true"`, foco inicial en botón primario, `Escape` ejecuta "Volver y corregir".
- **"Usar este total":** `title` attribute describe la acción; accesible via Tab.
- **CTA deshabilitados:** usar atributo `disabled` nativo en `<button>` y `<input>` (no solo `aria-disabled`); cursor `not-allowed`.

---

## §10 · Edge cases

1. **Usuario sin tiendas al cargar:** renderizar empty state gate (§5.3); Server Component pasa `stores = []` al form.
2. **`storeId` en URL inválido o de otro usuario:** ignorar silenciosamente; paso 1 cargado vacío.
3. **Moneda de la tienda no permitida:** no auto-rellenar; campo Moneda vacío.
4. **Red caída durante submit:** `createOrderAction` captura con Sentry, retorna `{ success: false, error: "server_error" }`; toast error, form interactivo.
5. **Frankfurter API indisponible:** botón "Hoy" falla; toast inline; usuario ingresa manualmente.
6. **Ítem con `unitPrice = 0` explícito:** el schema Zod lo permite (`min(0)`); el cliente muestra advertencia visual pero **no bloquea submit** — el 0 puede ser intencional (ítem de regalo, precio pendiente de confirmar).
7. **Drag-and-drop en mobile:** `OrderItemsGrid` ya maneja fallback a botones de orden en mobile.
8. **Ventana de entrega solo con `from` (sin `to`):** válido; guarda `expectedDeliveryFrom` con `expectedDeliveryTo = null`.
9. **`orderDate` en el futuro:** no restringido por negocio; el schema lo acepta.
10. **Cambiar tienda después de seleccionar moneda:** no sobreescribir la moneda elegida por el usuario al seleccionar nueva tienda.
11. **Submit mientras hay modal abierta:** el overlay bloquea interacción con el form; imposible por diseño.
12. **Doble submit (click rápido):** botón "Crear pedido" se deshabilita al iniciar submit; `useActionState` maneja estado `pending`.

---

## §11 · Anti-patrones

- ❌ **No hacer full-page reload** al navegar entre pasos — el wizard gestiona estado en cliente sin cambio de ruta.
- ❌ **No resetear el form** al cerrar el modal de discrepancia — usuario vuelve al paso 2 con todos los datos intactos.
- ❌ **No sobreescribir la moneda** cuando el usuario selecciona una tienda diferente — solo auto-rellenar si el campo estaba vacío.
- ❌ **No mostrar el sidebar** Resumen como accordion colapsable en mobile — aparece debajo del form-grid sin toggle.
- ❌ **No usar el patrón `BackNavLink`** (pill con fondo surface-elevated) como back-link — usar el patrón `back-link` minimalista (texto + arrow-left 12px).
- ❌ **No copiar el layout de** `#s7-order-create-step-3-validation` ni `#s7-order-create-step-1-from-store` — esas secciones son del wizard de 5 pasos obsoleto.
- ❌ **No hardcodear las monedas** en el select — derivar de `isAllowedCollectorBaseCurrency`.
- ❌ **No permitir avanzar del paso 2 sin al menos 1 ítem** — validación cliente obligatoria aunque `orderCreateSchema.items` sea opcional en Zod (ADR 0001 OC2).
- ❌ **No implementar la opción "Usar el total calculado"** del FRD original — la redesign elimina esa tercera opción del modal de discrepancia (ver §6.9).

---

## §12 · Notas para Fase B

1. **`StepperBar` — componente nuevo:** Crear en `src/components/modules/` (no en `_components` de ruta, para reuso futuro). Props: `steps: { label: string; key: string }[]`, `currentStep: number`, `onStepClick?: (step: number) => void`. Navegación hacia atrás libre; hacia adelante requiere validación del paso actual.

2. **`DateRangePicker` — componente nuevo o librería:** El trigger button + calendar popup no existe como componente en el proyecto. Evaluar `react-day-picker` u otra librería. Exponer `{ from: Date | null; to: Date | null }`. Debe ser totalmente accesible (ver §9). Spec del calendario standalone en demo anchor `#s7-date-range-picker`.

3. **`DiscrepancyModal` — refactor a 2 opciones:** El componente existente implementa las 3 opciones del FRD. Fase B debe refactorizar a 2 (`goBack` = "Volver y corregir", `onSaveAnyway` = "Guardar de todos modos"). Actualizar las i18n keys deprecadas y agregar `saveAnyway`. Verificar que `DiscrepancyModal` no se use en otro contexto antes de modificar su API.

4. **`OrderForm` — refactor de 5 pasos a 3 pasos:** El `OrderForm` existente probablemente implementa el wizard de 5 pasos. La transición a 3 pasos fusiona "Tienda" + "Fechas" en el paso 1, y "Productos" + "Costos" en el paso 2. Evaluar si refactorizar el componente existente o reescribirlo.

5. **`addItemButton` label — unificar:** El i18n existente tiene `"Agregar artículo"` pero el demo muestra `"+ Añadir producto"`. Decidir si alinear el copy al nuevo diseño en Fase B.

6. **View transition name:** El elemento en el paso 3 de confirmación debe tener `view-transition-name: order-create-confirm`. El destino (`order-detail`) usará `view-transition-name: order-{id}`. Verificar que el soporte de View Transitions API esté activo en el proyecto.

7. **Frankfurter API — wrapper:** Crear `src/lib/fx/frankfurter.ts` para encapsular la llamada. La llamada debe hacerse desde el cliente (no bloquea SSR). Timeout máximo: 5 segundos. Manejar CORS y errores de red.

8. **`OrderEmptyState` — verificar copy:** Confirmar que el componente existente usa el copy del redesign (`"Sin tiendas aún"`, `"Crear primera tienda"`). Actualizar si difiere del copy de `orders.emptyState.*`.
