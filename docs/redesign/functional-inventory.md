---
title: Inventario funcional — contrato del rediseño
last_updated: 2026-04-30
status: final S1
---

# Contrato funcional inviolable

Este documento define **qué hace** cada superficie de PandaTrack hoy. Es el contrato que cualquier dirección visual del rediseño debe seguir respetando: mismo qué, distinto cómo. Estética, color, tipografía, layout, motion son libres; flujos, datos, validaciones, permisos y estados son intocables.

Síntesis de auditoría con 4 sub-agentes Explore que cubrieron rutas públicas, rutas privadas, formularios + schemas + flujos multi-paso, y mecánica de tema/i18n/layouts/componentes core.

---

## A. Mapa de rutas

### Public + auth (sin sesión o con sesión sin email verificado)

```
src/app/[locale]/
├── (landing)/
│   └── page.tsx                       Landing pública con waitlist
├── (auth)/
│   ├── sign-in/page.tsx
│   ├── sign-up/page.tsx
│   ├── forgot-password/page.tsx
│   ├── reset-password/page.tsx
│   ├── verify-email/page.tsx
│   ├── verify-email/confirm/page.tsx
│   └── verify-email-required/page.tsx
├── privacy/page.tsx
└── terms/page.tsx
```

### Privadas (sesión + email verificado o en grace 6 días)

```
src/app/[locale]/(app)/
├── layout.tsx                          Shell con sidebar + content header + verify banner
├── dashboard/page.tsx                  Placeholder actual
├── orders/
│   ├── page.tsx                        Listado paginado + filtros
│   ├── new/page.tsx                    Creación con items + costos
│   ├── pre-orders/page.tsx             Placeholder futuro
│   └── [id]/
│       ├── page.tsx                    Detalle read-only con secciones
│       └── edit/page.tsx               Edición full-form
├── deliveries/
│   ├── page.tsx                        Placeholder futuro
│   ├── new/page.tsx                    Creación desde productos elegibles
│   └── [id]/page.tsx                   Detalle stub mínimo
├── stores/
│   ├── page.tsx                        Listado público + filtros
│   ├── new/page.tsx                    Creación con logo + canales + direcciones
│   └── [slug]/
│       ├── page.tsx                    Detalle público + viewer context
│       └── edit/page.tsx               Edición o ChangeRequest
└── settings/page.tsx                   3 secciones colapsables
```

---

## B. Tabla funcional

Convenciones: cada fila es una superficie. "Auth" = `none` (público), `session` (sesión), `verified` (sesión + email), `owner` (creador del recurso), `admin`. Sub-flujos multistep aparecen indentados.

### B.1 Marketing y autenticación

| #   | Path                                     | Propósito                                 | Datos clave                                                            | Acciones                                                     | Estados                                                             | Auth           |
| --- | ---------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------- | -------------- |
| 1   | `/[locale]`                              | Landing con propuesta de valor + waitlist | Hero, features, FAQ, formulario waitlist (email + nombre + comentario) | Scroll, anchor jumps, submit waitlist, share post-success    | idle / submitting / error / success                                 | none           |
| 2   | `/[locale]/sign-in`                      | Login email+password o Google OAuth       | email, password, callbackURL                                           | submit, OAuth Google, link a sign-up, link a forgot-password | idle / submitting / error / success                                 | none           |
| 3   | `/[locale]/sign-up`                      | Registro email+password o Google          | email, password, callbackURL                                           | submit, OAuth, link a sign-in                                | idle / submitting / `USER_ALREADY_EXISTS` / success                 | none           |
| 4   | `/[locale]/forgot-password`              | Solicitud de reset por email              | email + cooldown localStorage                                          | submit, link a sign-in                                       | idle / submitting / cooldown / success / error                      | none           |
| 5   | `/[locale]/reset-password?token=…`       | Establecer nueva contraseña con token     | token, password                                                        | submit, link a forgot/sign-in si inválido                    | ready / invalid / submitting / success                              | token          |
| 6   | `/[locale]/verify-email?error=…`         | Estado de verificación                    | sesión, error param, returnTo                                          | resend, link a sign-in                                       | grace / blocked / TOKEN_EXPIRED / INVALID_TOKEN / verified→redirect | none / session |
| 7   | `/[locale]/verify-email/confirm?token=…` | Endpoint que confirma y redirige          | token                                                                  | (auto)                                                       | processing → redirect                                               | token          |
| 8   | `/[locale]/verify-email-required`        | Gate bloqueante post-grace                | sesión, snapshot de verificación                                       | resend, copia código manual                                  | blocked / submitting / success                                      | session        |
| 9   | `/[locale]/privacy`                      | Política de privacidad                    | secciones i18n                                                         | scroll, link a inicio                                        | static                                                              | none           |
| 10  | `/[locale]/terms`                        | Términos de servicio                      | secciones i18n                                                         | scroll, link a inicio                                        | static                                                              | none           |

### B.2 Dashboard y navegación

| #   | Path                  | Propósito                                                                     | Datos clave                                                                      | Acciones                               | Estados                                             | Auth     |
| --- | --------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------- | -------- |
| 11  | `/[locale]/dashboard` | Hub privado del usuario (hoy placeholder, en rediseño = bento de KPIs y feed) | Nombre usuario, próximo pago, entregas en tránsito, pre-órdenes activas, totales | navegar a secciones, crear nuevo (FAB) | static (hoy) / data-loaded / empty / error (futuro) | verified |

### B.3 Orders (pedidos)

| #    | Path                          | Propósito                                            | Datos clave                                                                                                                                                                                                | Acciones                                                                                                                                 | Estados                                                                                                                                            | Auth             |
| ---- | ----------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 12   | `/[locale]/orders`            | Listado paginado de pedidos del usuario              | Lista (pageSize 30): humanId, tienda, fecha orden, fecha entrega esperada (rango), totalCost + currency, % pagado, estado lifecycle. Filtros: nombre, tienda, productType, estado, rango fechas            | filtrar (sidebar), paginar, abrir detalle, "Nuevo pedido" (FAB)                                                                          | empty / loading / success / error / filtering                                                                                                      | verified         |
| 13   | `/[locale]/orders/new`        | Crear pedido                                         | storeId (req), orderDate (req), expectedDeliveryFrom/To (rango), currencyCode, exchangeRate, totalCost (cents), items dinámicos, note                                                                      | seleccionar tienda, fechas, moneda + tipo cambio, total, agregar/eliminar/editar items, calcular total automáticamente, submit, cancelar | empty (sin tiendas) / ready / submitting / validation_errors / success / error                                                                     | verified         |
| 12.a | — sub-flujo discrepancia      | Si Σ items ≠ totalCost mostrar modal de confirmación | suma items, total ingresado                                                                                                                                                                                | "Usar ingresado" / "Usar calculado" / "Volver"                                                                                           | open / closed                                                                                                                                      | verified         |
| 14   | `/[locale]/orders/[id]`       | Detalle read-only del pedido                         | humanId, tienda, fechas, currency + exchange rate, totalCost, items (nombre, qty, unitPrice, productType), pagos, historial cambios, nota privada, eligibility flags (canCancel, canDelete, canReactivate) | ver items, agregar/eliminar pago, guardar nota, cancelar/reactivar/eliminar pedido, crear entrega desde items, link a editar             | success / error / note_unsaved / payments_editing / payments_adding / payments_deleting / history_collapsed / cancelling / deleting / reactivating | verified + owner |
| 14.a | — Pagos (sección colapsable)  | Lista de pagos + form inline                         | amount, paymentDate (≤ hoy), summary (paid, remaining, %)                                                                                                                                                  | "Agregar pago" abre form, validar ≤ remaining, optimistic add, optimistic delete                                                         | collapsed / expanded / form_open / adding / deleting / error                                                                                       | verified + owner |
| 14.b | — Notas (inline)              | Textarea max 2000 chars                              | text                                                                                                                                                                                                       | guardar empty borra, autosave on blur                                                                                                    | view / editing / saving / error                                                                                                                    | verified + owner |
| 14.c | — Historial (colapsable)      | Eventos del pedido con timestamp y meta              | createdAt, payments, status changes                                                                                                                                                                        | scroll, expand/collapse                                                                                                                  | collapsed / expanded                                                                                                                               | verified + owner |
| 14.d | — Lifecycle                   | Acciones destructivas y reversibles                  | eligibility                                                                                                                                                                                                | cancel → CANCELLED, reactivate → ACTIVE, delete (si sin pagos ni entregas) → redirect /orders                                            | confirming / submitting / success / error                                                                                                          | verified + owner |
| 15   | `/[locale]/orders/[id]/edit`  | Edición full-form (mismo dataset que new)            | initial values pre-llenados                                                                                                                                                                                | mismos que new + descartar (con confirm si dirty)                                                                                        | dirty / submitting / success / validation_errors / discard_modal                                                                                   | verified + owner |
| 16   | `/[locale]/orders/pre-orders` | Placeholder futuro                                   | —                                                                                                                                                                                                          | —                                                                                                                                        | static                                                                                                                                             | verified         |

### B.4 Deliveries (entregas)

| #   | Path                                      | Propósito                                                                            | Datos clave                                                                                                                                                                                                  | Acciones                                                                                                                                                        | Estados                                                                                                     | Auth             |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------- |
| 17  | `/[locale]/deliveries`                    | Listado de entregas (placeholder hoy, en rediseño = lista paginada similar a orders) | id, humanId, deliveryDate, expectedArrival (rango), cost+currency, store, productCount                                                                                                                       | filtrar, paginar, abrir detalle, "Nueva entrega"                                                                                                                | empty / loading / success / error                                                                           | verified         |
| 18  | `/[locale]/deliveries/new?sourceOrderId=` | Crear entrega desde productos elegibles                                              | storeId (req, prefill si sourceOrder), deliveryDate (≤hoy), expectedArrivalFrom/To, cost (cents, ≥0), currencyCode, exchangeRate, productIds (≥1 de items en orders ACTIVE con estado NONE/ARRIVED_AT_STORE) | seleccionar tienda → orden → productos (checkboxes agrupados por orden con select-all), llenar fechas/costo/moneda, búsqueda foldSearchText sobre items, submit | empty (sin productos elegibles) / ready / submitting / validation_errors / products_error / success / error | verified         |
| 19  | `/[locale]/deliveries/[id]`               | Detalle de entrega                                                                   | id, humanId, deliveryDate, productos                                                                                                                                                                         | back a /deliveries                                                                                                                                              | success                                                                                                     | verified + owner |

### B.5 Stores (tiendas — mixto público/privado)

| #   | Path                             | Propósito                                     | Datos clave                                                                                                                                                                                                                                                                                                                   | Acciones                                                                                                                                                                                                                                                         | Estados                                                                                                           | Auth                                                              |
| --- | -------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 20  | `/[locale]/stores`               | Listado público paginado                      | name, country, presenceTypes, productTypes, hasStock, receivesOrders, importCountries, governance status, review aggregate                                                                                                                                                                                                    | filtrar (nombre, productType, country, importCountry, presence, hasStock, receivesOrders), paginar, abrir detalle, "Nueva tienda" (si verified)                                                                                                                  | empty / loading / success / error / filtering                                                                     | none (browse)                                                     |
| 21  | `/[locale]/stores/[slug]`        | Detalle público + viewer context              | identidad tienda, contactos, direcciones, productTypes, importCountries, reviews públicas + agregado, nota privada (si session), reporte privado (si session), governance summary (admin)                                                                                                                                     | leer reviews, crear/editar/eliminar review (rating + comentario), guardar nota privada, reportar tienda (modal + categoría), editar tienda (si admin o owner+PENDING), crear orden desde tienda (returnTo)                                                       | success / review_editing / review_submitting / note_editing / note_saving / reporting / report_submitting / error | none (public) / session (review/note/report) / admin (governance) |
| 22  | `/[locale]/stores/new?returnTo=` | Crear tienda con logo + canales + direcciones | storeType (BUSINESS/PERSON), name, description, countryCode, presenceTypes (multi), hasStock, receivesOrders, productTypeKeys (≥1), importCountries (multi), contactChannels (dinámico: type + value + label, validación por type), addresses (dinámico: country + line + city + reference + isPrimary), logo (upload + crop) | llenar form, agregar/quitar contact channels y addresses, upload+crop logo, detectar duplicados (onBlur de name) y modal de confirmación al submit, submit (PENDING para users / APPROVED para admin), redirigir a `/orders/new?store=` si returnTo=order-create | ready / submitting / validation_errors / duplicate_modal / logo_uploading / logo_cropping / success / error       | verified                                                          |
| 23  | `/[locale]/stores/[slug]/edit`   | Editar tienda directa o como ChangeRequest    | mismos campos que new + status                                                                                                                                                                                                                                                                                                | submit directo (admin) o crea StoreChangeRequest (owner si PENDING), gestionar logo (keep/replace/remove), agregar/quitar canales y direcciones                                                                                                                  | ready / submitting / change_request_mode / success / validation_errors / error                                    | admin OR (owner AND store.status=PENDING)                         |

### B.6 Settings

| #    | Path                 | Propósito                         | Datos clave                                                                                                          | Acciones                                                                                                                                                  | Estados                                                                                                                 | Auth     |
| ---- | -------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------- |
| 24   | `/[locale]/settings` | 3 secciones colapsables           | Profile, Account, Preferences                                                                                        | (ver sub-flujos)                                                                                                                                          | per-section                                                                                                             | verified |
| 24.a | — Profile            | Username + display name + avatar  | username (unique, regex, blocked words, cooldown 30d), displayName (max 50), avatar (upload + crop)                  | guardar username (debounced availability + cooldown), guardar displayName, subir/recortar/eliminar avatar                                                 | viewing / editing / submitting / availability_checking / available / taken / sameAsCurrent / cooldown / success / error | verified |
| 24.b | — Account            | Email, password, MFA capabilities | email + verified flag, password capabilities (canChange, canSet)                                                     | cambiar email (newEmail + currentPassword → envía verificación), cambiar password (current + new), set password (new si canSet), MFA toggle si capability | viewing / email_editing / password_editing / mfa_enabling / submitting / success / error / cooldown                     | verified |
| 24.c | — Preferences        | Collector preferences             | preferredCountryCode, baseCurrencyCode, preferredProductTypeKeys, budgetAmount (cents), budgetResetDayOfMonth (1–31) | seleccionar país, moneda (con confirmación modal de cambio), productTypes (multi), monto presupuesto, día reset                                           | viewing / editing / currency_change_modal / submitting / success / error                                                | verified |

### B.7 Layout y banner global (app-wide)

| #   | Surface              | Propósito                                              | Datos clave                                                                                                    | Acciones                                                                                                                              | Estados                                         |
| --- | -------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 25  | `(app)/layout` shell | Sidebar + content header + main                        | session, verification snapshot, identity (username, displayName, avatar), preferences, countries, productTypes | toggle sidebar, drawer mobile, navegar entre secciones, abrir account menu, sign-out, toggle tema (light/dark/system), cambiar idioma | verified / banner_grace / banner_blocked        |
| 26  | VerifyEmailBanner    | Banner sticky superior si email no verificado en grace | email, resend cooldown                                                                                         | resend, link a verify-email                                                                                                           | grace / submitting / cooldown / success / error |

---

## C. Server Actions críticos (contrato de mutaciones)

Cualquier rediseño debe invocar estos endpoints lógicos sin cambiar su shape:

| Acción                                                                                                                         | Path                                               | Validación clave                                              | Respuesta                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `createOrderAction`                                                                                                            | `/orders/_actions/orderActions.ts`                 | `orderCreateSchema` (Zod)                                     | `{ success: true, orderId } \| { success: false, error, fieldErrors? }`                                       |
| `editOrderAction`                                                                                                              | `/orders/_actions/orderActions.ts`                 | `orderEditSchema`                                             | igual al anterior                                                                                             |
| `addPaymentAction`                                                                                                             | `/orders/[id]/_actions/orderPaymentActions.ts`     | `orderPaymentCreateSchema` (`amount > 0, paymentDate ≤ now`)  | `{ ok: true, paymentId, paidAmount, remainingAmount, paymentPercentage, payments[] } \| { ok: false, error }` |
| `deletePaymentAction`                                                                                                          | idem                                               | ownership + not deleted                                       | igual con summary                                                                                             |
| `saveOrderNoteAction`                                                                                                          | `/orders/[id]/_actions/orderNoteActions.ts`        | text max 2000                                                 | `{ ok, note?, updatedAt? } \| { ok: false }`                                                                  |
| `cancelOrderAction` / `reactivateOrderAction` / `deleteOrderAction`                                                            | `/orders/[id]/_actions/orderLifecycleActions.ts`   | eligibility flags                                             | `{ ok } \| { ok: false }`                                                                                     |
| `createDeliveryAction`                                                                                                         | `/deliveries/new/_actions/createDeliveryAction.ts` | `deliveryCreateSchema` + currency/exchange consistency        | `{ success: true, deliveryId } \| fieldErrors`                                                                |
| `createStore`                                                                                                                  | `/stores/new/_actions/createStore.ts`              | `createStoreSchema` + slug uniqueness + logo processing       | `{ success: true, storeId, slug, status } \| fieldErrors`                                                     |
| `getDuplicateCandidates` / `getDuplicateCandidatesForSubmit`                                                                   | idem                                               | name + countryCode                                            | `{ candidates[] }`                                                                                            |
| `saveStoreEdit`                                                                                                                | `/stores/[slug]/edit/_actions/saveStoreEdit.ts`    | `editStoreSchema` + permisos                                  | update directo (admin) o `StoreChangeRequest`                                                                 |
| `saveStoreReview` / `deleteStoreReview`                                                                                        | `/stores/[slug]/_actions/*.ts`                     | rating 1–5, no duplicado abierto por user                     | `{ ok } \| { ok: false }`                                                                                     |
| `saveStoreNote`                                                                                                                | idem                                               | text                                                          | `{ ok }`                                                                                                      |
| `saveStoreReport`                                                                                                              | idem                                               | category enum + descripción + no duplicado abierto            | `{ ok }`                                                                                                      |
| `submitChangePasswordAction` / `submitSetPasswordAction` / `submitEmailChangeAction`                                           | `/settings/_actions/accountCredentialsActions.ts`  | password rules + retryAfterIso para rate limit                | `{ ok, retryAfterIso? } \| { ok: false, error }`                                                              |
| `saveUsernameAction` / `saveDisplayNameAction` / `saveAvatarAction` / `removeAvatarAction` / `checkUsernameAvailabilityAction` | `/settings/_actions/profileActions.ts`             | reglas username + cooldown 30d + reserved                     | `{ ok, username? } \| error con retryAfterIso`                                                                |
| `savePreferencesAction`                                                                                                        | `/settings/_actions/preferencesActions.ts`         | currency, country, productTypes activos, budget ≥ 0, día 1–31 | `{ ok }`                                                                                                      |
| Better Auth: `signUp.email`, `signIn.email`, `requestPasswordReset`, `resetPassword`, `verifyEmail`, `resendVerificationEmail` | librería                                           | session/email/token                                           | `{ data, error }`                                                                                             |

---

## D. Schemas Zod (resumen del contrato de datos)

### orderCreateSchema

- `storeId: cuid` (req)
- `orderDate: coerce.date` (req)
- `expectedDeliveryFrom/To: coerce.date | null` (refine: To ≥ From)
- `currencyCode: string(3)` válido en `isAllowedCollectorBaseCurrency`
- `exchangeRate: 0.01–99999.99 multipleOf 0.01 | null`
- `totalCost: int 1..999_999_999` (cents)
- `note: string max 2000 | null`
- `items: { name 1..500, quantity int ≥1, unitPrice int|null, productTypeKey string|null, position int ≥1 }[]`

### orderPaymentCreateSchema

- `orderId: cuid`
- `amount: int 1..999_999_999`
- `paymentDate: date ≤ now`

### deliveryCreateSchema

- `storeId: cuid`
- `deliveryDate: date ≤ now`
- `expectedArrivalFrom/To: date | null` (refine: To ≥ From)
- `cost: int 0..999_999_999`
- `currencyCode + exchangeRate` (consistencia con baseCurrency)
- `productIds: cuid[].min(1)`

### createStoreSchema

- `storeType: "BUSINESS" | "PERSON"`
- `name: 1..200`, `description: max 2000`
- `countryCode`, `presenceTypes: ("ONLINE"|"PHYSICAL")[]`
- `hasStock`, `receivesOrders: bool`
- `productTypeKeys: min 1`, `importCountries: code[]`
- `contactChannels: { type: enum, value: por type, label?: }[]` (URL para WEBSITE, handle para INSTAGRAM/TIKTOK, URL/ID para FACEBOOK, phone para WHATSAPP/PHONE, email para EMAIL)
- `addresses: { countryCode, addressLine, city?, reference?, isPrimary }[]`
- `logo: file + crop area | null`

### Settings

- username regex + reserved + blockedWords + cooldown 30d
- displayName trim + max + reserved
- email valid + uniqueness + verifyChain
- password min/max length + diff from current
- preferences: currency, country, productTypes activos, budget int ≥0 cents, dayOfMonth 1..31

---

## E. Estados globales documentados (referencia para QA)

- **Order list:** empty, loading, success, error, filtering.
- **Order detail:** success, error, note_saving, note_error, payments_adding, payments_deleting, payments_error, history_viewing, action_cancelling/deleting/reactivating.
- **Delivery create:** empty_no_eligible, loading_products, ready, submitting, validation_error, products_error, success, error.
- **Store list:** empty, loading, success, error, filtering.
- **Store detail:** success, review_editing/submitting, note_editing/saving, reporting/report_submitting, error.
- **Store edit:** ready, submitting, change_request_mode, logo_uploading/cropping, success, validation_errors, error.
- **Settings (per section):** viewing, editing, submitting, success, error + machine state propios (username availability, currency change confirm, MFA enabling, email verifying).
- **Auth (per form):** idle, submitting, error con códigos (`USER_ALREADY_EXISTS`, `invalidCredentials`, `TOKEN_EXPIRED`, `INVALID_TOKEN`), success.

---

## F. Comportamientos transversales que el rediseño debe preservar

1. **Validación dos capas** — cliente + servidor Zod. El servidor es autoridad.
2. **Optimistic updates en pagos y entregas** — UI cambia, server reconcilia, revert con toast si falla.
3. **Modal de discrepancia** en creación de orden cuando suma items ≠ total ingresado.
4. **Detección de duplicados de tienda** onBlur del name + modal de confirmación al submit.
5. **Rate limiting** — forgot-password (cliente, localStorage), username (servidor, 30d), email change (`retryAfterIso`).
6. **Verificación de email** — grace 6 días con banner sticky, blocked redirige a `/verify-email-required`.
7. **Scroll a primer error** en formularios largos + focus sin scroll automático del DOM.
8. **Stabilize scroll/focus** post-mutation para evitar saltos.
9. **PostHog tracking** en cada interacción meaningful (auth, orders, deliveries, stores, settings).
10. **Sentry capture** en flujos críticos sin duplicar ruido.
11. **i18n es y en, todos los namespaces, paridad total.**
12. **Layout `(app)`:** sidebar + content header + main, banner sticky condicional, max-width `max-w-6xl`.
13. **Theme toggle:** persistido en `localStorage["theme"]`, atributo `data-theme="light|dark"` en `<html>`, default dark, respeta `prefers-color-scheme`.

---

## G. Lo que NO se hereda del diseño actual

A partir de S2, todo lo siguiente se reescribe desde cero:

- Paleta `:root` y `:root[data-theme="light"]` actuales (variables `--primary`, `--accent`, `--surface`, etc.).
- `@theme inline` actual con sus mappings.
- Componentes `core/` Button, Input, Select, Heading, etc. en su forma visual actual (la API se evalúa, la implementación visual se reemplaza).
- Componentes `modules/` AppPageHero, SectionTitleWithAccent, SectionSurfaceCard en su forma visual actual.
- Layout AppShell, AppSidebar, ContentHeader en su tratamiento estético.
- Receta actual de gradients, shadows, radius.

Lo que **sí** sobrevive como contrato técnico:

- Convención de tokens semánticos (su set se rediseña, la idea persiste).
- Persistencia de tema con `localStorage["theme"]` y atributo `data-theme`.
- next-intl namespaces y locales `es`/`en`.
- BetterAuth + Prisma data layer.
- Server Actions con shape de respuesta documentada en sección C.
- Schemas Zod (sección D).
