---
title: Delivery create
session: 02
status: lo-fi-wireframe + post-closure updates
last_updated: 2026-05-01
post_closure_adr: ../decisions/0001-s2-closure-decisions.md
---

# Delivery create

> **Addendum post-S2 (2026-05-01)** — Decisiones aplicadas tras research, ver [`ADR 0001`](../decisions/0001-s2-closure-decisions.md):
>
> - Decisión 1: chip "Aún no llega" usa **`--info`** (token nuevo, hue 230 azul-cyan), NO `--warning`. Reservar `--warning` para atrasado/vencido.
> - Decisión 2: combobox de tienda con `?sourceOrderId=` se renderiza como **field-as-attribute** (wrapper `surface-elevated` + badge mono `↳ DESDE PT-XXXXXX` + valor + link ghost "Cambiar"), NO como input editable bloqueado.
> - Decisión 3: section cards 3 y 4 cuando `empty_no_eligible` se mantienen visibles al 100% (eyebrow + title intactos), contenido reemplazado por ícono `lock` 24px + copy "Selecciona una tienda primero." en `--text-muted`. Sin opacity.
> - Decisión 4: toast tras select-all masivo usa variant **`neutral-undo`** (5s, ghost CTA "Deshacer", atajo `Z`).
> - Decisión 13: prefill arranca en **paso 2** con paso 1 marcado done; productos del `sourceOrder` vienen **pre-seleccionados todos**; usuario puede deseleccionar uno a uno o por grupo.

## 1. Propósito y contrato funcional

Pantalla `/[locale]/deliveries/new?sourceOrderId=` para anotar una entrega contra productos elegibles de pedidos activos. Es la fila #18 del [functional-inventory](../functional-inventory.md) y respeta el schema `deliveryCreateSchema`: `storeId` (req, prefill cuando viene `sourceOrderId`), `deliveryDate` (≤ hoy), `expectedArrivalFrom/To`, `cost` (cents ≥0), `currencyCode`, `exchangeRate`, `productIds` (≥1 de items en orders `ACTIVE` con estado `NONE` o `ARRIVED_AT_STORE`). El flujo es: seleccionar tienda → cargar orders elegibles y filtrar productos por foldSearchText → seleccionar productos por orden con select-all por grupo → llenar fechas/costo/moneda → submit. Permisos: usuario con email verificado.

Dos ramas de entrada:

- **Desde detalle de orden** con `sourceOrderId=PT-XXXXXX`: la tienda viene pre-fijada (no editable), los productos del pedido origen vienen pre-seleccionados (con opción de deselección rápida), el step indicator arranca en paso 2.
- **Desde listado `/deliveries` con FAB "Anotar entrega"**: paso 1 abierto, todo a elegir.

Acciones primarias: seleccionar tienda · togglear productos por grupo · seleccionar todo el grupo · llenar fechas y costos · submit. Salidas: redirect a `/deliveries/[id]` (success) o errores inline mapeados al campo (validation_errors / products_error).

## 2. Wireframe mobile (360px)

Paso 1 abierto, sin `sourceOrderId`, scroll vertical. Sheet bottom Vaul-style para combobox de tienda y para search de productos. Footer sticky con autosave + CTA primario "Anotar entrega".

```
┌──────────────────────────────────────────────┐
│ ←  Anotar entrega                    ⓘ  ✕    │  header 56px
├──────────────────────────────────────────────┤
│                                              │
│  ●─────────○─────────○─────────○             │  step indicator full-width
│  1         2         3         4             │  4 círculos · líneas flex:1
│  Tienda   Productos  Costos    Listo         │  activo: --accent + halo
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ DESDE                                    │ │  card section · radius-xl
│ │ Tienda                                   │ │  surface plano · padding 20
│ │ ¿De qué tienda viene esta entrega?       │ │  helper --text-secondary
│ │                                          │ │
│ │ ┌────────────────────────────────────┐   │ │
│ │ │ ◯  Buscar tienda…           ⌄      │   │ │  combobox · abre sheet
│ │ └────────────────────────────────────┘   │ │  border-strong
│ │                                          │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ QUÉ LLEGA                                │ │
│ │ Productos                                │ │
│ │ Marca lo que viene en esta entrega.      │ │
│ │                                          │ │
│ │ ┌────────────────────────────────────┐   │ │
│ │ │ 🔍  Buscar producto                │   │ │  search · abre sheet mobile
│ │ └────────────────────────────────────┘   │ │
│ │                                          │ │
│ │ ┌────────────────────────────────────┐   │ │  grupo orden · accordion
│ │ │ PT-002418 · 3 items   ☐ Todo  ⌃    │   │ │  header surface-elevated
│ │ ├────────────────────────────────────┤   │ │
│ │ │ ☑ 💿 Aphex Twin — Selected…   ×1  │   │ │  ícono Lucide teal
│ │ │   Listo en tienda                  │   │ │  chip --success 14%
│ │ ├────────────────────────────────────┤   │ │
│ │ │ ☐ 📖 Berserk Vol. 17          ×1  │   │ │
│ │ │   Aún no llega                     │   │ │  chip --info 14% (post-ADR)
│ │ ├────────────────────────────────────┤   │ │
│ │ │ ☐ ✨ Llavero Chainsaw Man     ×2  │   │ │
│ │ │   Aún no llega                     │   │ │
│ │ └────────────────────────────────────┘   │ │
│ │                                          │ │
│ │ ┌────────────────────────────────────┐   │ │
│ │ │ PT-002507 · 2 items   ☐ Todo  ⌃    │   │ │  segundo grupo (colapsado)
│ │ └────────────────────────────────────┘   │ │
│ │                                          │ │
│ │ 1 producto seleccionado                  │ │  meta --text-muted
│ └──────────────────────────────────────────┘ │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ CUÁNDO Y CUÁNTO                          │ │
│ │ Fechas y costo                           │ │
│ │                                          │ │
│ │ Fecha de entrega                         │ │
│ │ ┌────────────────────────────────────┐   │ │
│ │ │ ¿Para cuándo?              📅      │   │ │  ≤ hoy
│ │ └────────────────────────────────────┘   │ │
│ │                                          │ │
│ │ ETA mínima — máxima                      │ │
│ │ ┌──────────────┐  ┌──────────────────┐   │ │
│ │ │ desde   📅   │  │ hasta       📅   │   │ │  range opcional
│ │ └──────────────┘  └──────────────────┘   │ │
│ │                                          │ │
│ │ Costo de envío                           │ │
│ │ ┌──────────────┐  ┌────────┐  ┌──────┐   │ │
│ │ │ 0,00         │  │ USD ⌄  │  │ 1,00 │   │ │  cost · currency · TC
│ │ └──────────────┘  └────────┘  └──────┘   │ │
│ │ Tipo de cambio aplicado a tu moneda base │ │  helper
│ └──────────────────────────────────────────┘ │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ RESUMEN                                  │ │
│ │ Listo para anotar                        │ │
│ │ ─────────────────────────────────────    │ │
│ │ Productos              1                 │ │  attribute → value
│ │ Costo envío            $12,50 USD        │ │
│ │ En tu base             $12,50 USD        │ │
│ │ Fecha de entrega       —                 │ │
│ └──────────────────────────────────────────┘ │
│                                              │
├──────────────────────────────────────────────┤
│ Guardado, hace 4s     [Cancelar] [Anotar ✓] │  footer sticky
└──────────────────────────────────────────────┘
```

## 3. Wireframe desktop (≥1024px)

Layout dentro de `max-w-6xl`, padding `px-8 py-10`. Columna principal 8 cols · sidebar derecha sticky 4 cols con dos cards consistentes. Patrón section cards heredado de `directions.md` §4.13.

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│  ← Volver a entregas                                                            ⌘K    │
│                                                                                       │
│  ANOTAR ENTREGA                                                                       │
│  Marca qué llegó y de dónde                                                           │
│                                                                                       │
│  ●───────────────●───────────────○───────────────○                                    │
│  1               2               3               4                                    │
│  Tienda          Productos       Costos          Listo                                │
│                                                                                       │
│ ┌─────────────────────────────────────────────┐  ┌──────────────────────────────────┐ │
│ │ DESDE                                       │  │ RESUMEN                          │ │
│ │ Tienda                                      │  │ ──────────────────────────────── │ │
│ │ ¿De qué tienda viene esta entrega?          │  │ Tienda          Mercado MX       │ │
│ │                                             │  │ Pedidos origen  PT-002418        │ │
│ │ ┌────────────────────────────────────────┐  │  │                 PT-002507        │ │
│ │ │ M  Mercado MX                       ⌄ │  │  │ Productos       3                │ │
│ │ │    Pre-llenado desde pedido            │  │  │ Costo envío     $24,80 USD       │ │
│ │ └────────────────────────────────────────┘  │  │ En tu base      $24,80 USD       │ │
│ └─────────────────────────────────────────────┘  │ Fecha de entrega 2026-04-30      │ │
│                                                  │ ETA             —                │ │
│ ┌─────────────────────────────────────────────┐  └──────────────────────────────────┘ │
│ │ QUÉ LLEGA                                   │                                       │
│ │ Productos                                   │  ┌──────────────────────────────────┐ │
│ │ Marca lo que viene en esta entrega.         │  │ ATAJOS                           │ │
│ │                                             │  │ ──────────────────────────────── │ │
│ │ ┌────────────────────────────────────────┐  │  │ Enviar         ⌘ + Enter         │ │
│ │ │ 🔍  Buscar producto              /     │  │  │ Cancelar       Esc               │ │
│ │ └────────────────────────────────────────┘  │  │ Toggle item    Space             │ │
│ │                                             │  │ Select-all     A                 │ │
│ │ ┌────────────────────────────────────────┐  │  │ Buscar         /                 │ │
│ │ │ PT-002418 · 3 items   ☑ Todo       ⌄  │ │  │ Command        ⌘ + K             │ │
│ │ ├────────────────────────────────────────┤  │  └──────────────────────────────────┘ │
│ │ │ ☑ 💿 Aphex Twin — Selected…    ×1     │  │                                       │
│ │ │      Listo en tienda                   │  │                                       │
│ │ ├────────────────────────────────────────┤  │                                       │
│ │ │ ☑ 📖 Berserk Vol. 17           ×1     │  │                                       │
│ │ │      Aún no llega                      │  │                                       │
│ │ ├────────────────────────────────────────┤  │                                       │
│ │ │ ☑ ✨ Llavero Chainsaw Man      ×2     │  │                                       │
│ │ │      Aún no llega                      │  │                                       │
│ │ └────────────────────────────────────────┘  │                                       │
│ │                                             │                                       │
│ │ ┌────────────────────────────────────────┐  │                                       │
│ │ │ PT-002507 · 2 items   ☐ Todo       ⌃  │ │                                       │
│ │ └────────────────────────────────────────┘  │                                       │
│ │                                             │                                       │
│ │ 3 productos seleccionados   ↶ Deshacer    │                                       │
│ └─────────────────────────────────────────────┘                                       │
│                                                                                       │
│ ┌─────────────────────────────────────────────┐                                       │
│ │ CUÁNDO Y CUÁNTO                             │                                       │
│ │ Fechas y costo                              │                                       │
│ │                                             │                                       │
│ │ Fecha entrega   ETA min — max               │                                       │
│ │ [2026-04-30 📅] [— 📅] [— 📅]               │                                       │
│ │                                             │                                       │
│ │ Costo envío    Moneda     TC                │                                       │
│ │ [24,80      ]  [USD ⌄  ]  [1,00      ]      │                                       │
│ │ Aplicado a tu moneda base.                  │                                       │
│ └─────────────────────────────────────────────┘                                       │
│                                                                                       │
│ ┌─────────────────────────────────────────────┐                                       │
│ │ LISTO                                       │                                       │
│ │ Revisa y anota                              │                                       │
│ │ Cuando confirmes, te llevamos a la entrega. │                                       │
│ └─────────────────────────────────────────────┘                                       │
│                                                                                       │
├───────────────────────────────────────────────────────────────────────────────────────┤
│ Guardado, hace 4s                            [Cancelar]  [ Anotar entrega  ⌘↵ ]      │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

## 4. Tokens invocados

| Token                 | Uso en esta pantalla                                                                                                                                                                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--background`        | Lienzo de la página tras el shell.                                                                                                                                                                                                                                   |
| `--surface`           | Section cards 1–4 (plano, sin tinte, consistente con order-create §4.13).                                                                                                                                                                                            |
| `--surface-elevated`  | Cards sidebar (Resumen + Atajos), sheets bottom mobile (combobox tienda + search productos), header del grupo de productos cuando está expandido.                                                                                                                    |
| `--border`            | Dividers entre items dentro del accordion, separadores del sidebar.                                                                                                                                                                                                  |
| `--border-strong`     | Borde de inputs (combobox, search, fecha, cost, currency, TC), borde de checkboxes en estado normal.                                                                                                                                                                 |
| `--text-primary`      | Nombres de productos, cifras de costo, totales del Resumen, valores de attribute→value.                                                                                                                                                                              |
| `--text-secondary`    | Labels de form, helpers, copy de subtítulos de cards, atributos del Resumen y Atajos.                                                                                                                                                                                |
| `--text-muted`        | Códigos mono `PT-002418`, contador "1 producto seleccionado", autosave timestamp, eyebrow uppercase, helper "Aplicado a tu moneda base".                                                                                                                             |
| `--accent`            | CTA primario "Anotar entrega", step indicator activo + halo glow, focus ring derivado, fill del checkbox checked, estado activo del select-all del grupo.                                                                                                            |
| `--accent-cool`       | Color por defecto de los íconos Lucide de categoría (`disc`, `book-open`, `sparkles`), ícono `info` del icon-button del header mobile (abre sheet del Resumen).                                                                                                      |
| `--success`           | Chip de estado del producto cuando es `ARRIVED_AT_STORE` ("Listo en tienda" — fondo `--success / 14%` + texto + border).                                                                                                                                             |
| `--info` _(post-ADR)_ | Chip de estado del producto cuando es `NONE` ("Aún no llega" — fondo `--info / 14%` + texto `--info` + border `--info / 28%`, con ícono Lucide `clock`, sutil, no alarmante). Token introducido en [ADR 0001 Decisión 1](../decisions/0001-s2-closure-decisions.md). |
| `--warning`           | NO se usa en delivery-create. Reservado para "atrasado/vencido" — no aplica a productos esperando salir de tienda.                                                                                                                                                   |
| `--destructive`       | Inline error de validación post-submit, label de "Eliminar selección" en el menú long-press.                                                                                                                                                                         |
| `--focus-ring`        | `:focus-visible` en combobox, search, checkboxes, selectores y CTAs.                                                                                                                                                                                                 |

**Paleta categórica (`--cat-*`) NO se usa.** La identidad de cada producto vive en su ícono Lucide en `--accent-cool`, igual que el dashboard §4.12.

**Acentos por viewport:** una pantalla cumple la regla de oro §4.4 — `--accent` (CTA + step + checkboxes) + `--accent-cool` (íconos categoría) + 1 status por chip (`--success` para "Listo en tienda" o `--info` para "Aún no llega"). Coral (`--accent-warm`) NO aparece en esta pantalla. `--warning` tampoco — el estado "Aún no llega" no es alarma, usa `--info` per ADR 0001.

Si una decisión visual exige un token nuevo, queda anotado en [`../_notes/atelier-gaps.md`](../_notes/atelier-gaps.md).

## 5. Estados

- **Empty_no_eligible** — no hay productos elegibles para la tienda seleccionada. Section card 2 muestra mascota panda `sleeping` 96px sobre fondo `--accent-cool / 24%` (radius-lg, centrado), copy "No hay productos esperando entrega de esta tienda. Cambia de tienda o crea un pedido nuevo.", dos CTAs ghost: "Cambiar tienda" (re-abre combobox) y "Nuevo pedido" (link a `/orders/new?storeId=…`). Section cards 3 y 4 quedan deshabilitadas (opacidad 0.4, pointer-events none) hasta que haya selección.
- **Loading_products** — tras seleccionar tienda, mientras llegan los items elegibles. La section card 2 reemplaza su contenido por skeletons: 3 grupos placeholder con header (rectángulo mono 90px + count + checkbox) y 4 items por grupo (checkbox + ícono + line + chip). Shimmer `--text-primary / 4%` overlay.
- **Ready** — form lleno y válido. El step indicator avanza al paso correspondiente al campo activo (focus de productos → step 2 con halo, focus de costo → step 3, etc.). El footer CTA queda habilitado cuando `productIds.length ≥ 1` y los campos requeridos válidos.
- **Submitting** — el CTA muestra spinner + label "Anotando entrega…", `aria-busy="true"`, todas las cards en `pointer-events: none` con opacidad 0.85, autosave indicator queda quieto.
- **Validation_errors** (post-submit) — scroll automático al primer campo con error sin robar el foco. Inline errors en `--destructive` con copy declarativo del glosario; ejemplos: "La fecha de entrega no puede ser futura — ajusta la fecha." · "Selecciona al menos un producto." · "El costo no puede ser negativo." · "El tipo de cambio debe ser mayor a 0."
- **Products_error** — falla al cargar los items elegibles. Inline alert dentro de la section card 2 con ícono Lucide `alert-circle` en `--destructive`, copy "No pudimos traer los productos. Dale otra vez." y botón ghost "Reintentar". El resto del form queda en estado normal pero sin posibilidad de avanzar.
- **Success** — toast Sonner-style "Entrega anotada. Te avisamos cuando llegue." (sin mascota celebrating — la entrega anotada NO es la llegada del producto, es una task completion administrativa). Inmediatamente después, view-transition canónica `delivery-X` morfa hacia el hero del detalle `/deliveries/[id]` con la firma propia §4.8 (avatar tienda continuo, código mono crece, micro-pausa de status, spring overshoot 0.05).
- **Edit** — no aplica directo: la entrega no se edita una vez creada. Las correcciones se hacen desde `/deliveries/[id]` con acciones puntuales (anotar llegada, agregar nota privada). Esta pantalla es create-only.

## 6. Motion y view transitions

- **Section cards entrance:** stagger 40ms al montar, fade-in + translate-y 4px, `--motion-base` (280ms) con `--ease-out-expressive`. Mismo patrón que order-create §4.13.
- **Step indicator:** al avanzar de paso, el círculo destino hace scale 0.7→1 + fill `--accent` + halo glow en `--motion-fast`; el círculo done se llena de `--success` con check.
- **Tienda → loading_products:** al seleccionar tienda, la section card 2 hace crossfade 150ms reemplazando el empty/placeholder con los skeletons.
- **Toggle checkbox de item:** micro-pulso del border del checkbox en `--motion-fast` (border crece 1.5px→2px y vuelve), el contador "N seleccionados" del Resumen sidebar actualiza con tabular-nums sin jitter.
- **Select-all del grupo:** stagger sutil 30ms en los checkboxes hijos para sentir cascada (cap a 80ms total max). Si el grupo es grande, el stagger se acorta proporcionalmente.
- **Discrepancia / empty inline:** la mascota `sleeping` hace micro-bobbing loop 4s muy lento (translate-y ±1px). Sólo en este estado.
- **Submit success → redirect:** view-transition canónica §4.8 con `delivery-X` como nombre compartido entre el footer CTA y el hero del detalle (avatar tienda continuo, mono `PT-DEL-XXXX` crece sin re-render, micro-pausa de status).
- **`prefers-reduced-motion: reduce`:** todo cae a fade 150ms · sin stagger · sin springs · sin bobbing de mascota · sin micro-pulso del checkbox.

## 7. Atajos de teclado (desktop) y gestos (mobile)

**Desktop:**

- `⌘ + Enter` — envía el form si es válido (equivale a "Anotar entrega").
- `Esc` — cancela; si el form está dirty, abre confirm "¿Descartar entrega? Lo que escribiste se va.".
- `⌘ + K` — command palette global.
- `Space` — toggle del item con foco.
- `A` — con un grupo enfocado, toggle select-all del grupo (la misma tecla des-selecciona si ya estaba todo).
- `J` / `K` — navegan entre items dentro del grupo expandido.
- `/` — enfoca el search de productos.

**Mobile:**

- Combobox de tienda y search de productos abren **sheet bottom Vaul-style** full-height (no dropdown ni modal).
- Tap area de checkboxes ≥ 44×44px (target a11y §8 de principles).
- **Long-press** sobre el header del grupo abre menú contextual: "Seleccionar todo del grupo" / "Deseleccionar todo del grupo".
- Pull-to-dismiss en sheets cierra sin guardar la búsqueda.

## 8. Mascota

- **Sólo aparece** en `empty_no_eligible` (estado `sleeping` 96px dentro de la section card 2) y en error global de página (no en errors inline ni en `products_error` puntual — ese sólo lleva `alert-circle`).
- **Bubble idle del shell** sigue presente en la esquina inferior derecha (la del layout privado). El user puede ocultarla en settings.
- **NUNCA durante form active.** Sin peeking, sin walking, sin celebrating mientras se está rellenando.
- **NO `celebrating` al success.** Una entrega anotada es task completion administrativa, no la llegada del producto. La celebración con mascota se reserva para "anotar llegada" en una pantalla futura (`/deliveries/[id]` cuando el usuario marca el delivery como recibido). Aquí solo hay un toast neutral.

## 9. Voice samples

Strings reales en español del [glosario §7](../principles.md#7-voice-informal-cómplice-breve-sin-corporativismo-post-rev-3). Claves i18n en `src/i18n/locales/es/deliveries.json`.

| Clave i18n                                  | Copy                                                                                          |
| ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `deliveries.create.title`                   | "Anotar entrega"                                                                              |
| `deliveries.create.subtitle`                | "Marca qué llegó y de dónde."                                                                 |
| `deliveries.create.steps.store`             | "Tienda"                                                                                      |
| `deliveries.create.steps.products`          | "Productos"                                                                                   |
| `deliveries.create.steps.costs`             | "Costos"                                                                                      |
| `deliveries.create.steps.ready`             | "Listo"                                                                                       |
| `deliveries.create.store.helper`            | "¿De qué tienda viene esta entrega?"                                                          |
| `deliveries.create.store.prefilled`         | "Pre-llenado desde pedido"                                                                    |
| `deliveries.create.products.helper`         | "Marca lo que viene en esta entrega."                                                         |
| `deliveries.create.products.selectAll`      | "Seleccionar todo"                                                                            |
| `deliveries.create.search.placeholder`      | "Buscar producto"                                                                             |
| `deliveries.create.status.arrived`          | "Listo en tienda"                                                                             |
| `deliveries.create.status.none`             | "Aún no llega"                                                                                |
| `deliveries.create.empty.noEligible`        | "No hay productos esperando entrega de esta tienda. Cambia de tienda o crea un pedido nuevo." |
| `deliveries.create.empty.cta.changeStore`   | "Cambiar tienda"                                                                              |
| `deliveries.create.empty.cta.newOrder`      | "Nuevo pedido"                                                                                |
| `deliveries.create.error.products.message`  | "No pudimos traer los productos. Dale otra vez."                                              |
| `deliveries.create.error.products.cta`      | "Reintentar"                                                                                  |
| `deliveries.create.cost.helper`             | "Aplicado a tu moneda base."                                                                  |
| `deliveries.create.cta.submit`              | "Anotar entrega"                                                                              |
| `deliveries.create.cta.submitting`          | "Anotando entrega…"                                                                           |
| `deliveries.create.cta.cancel`              | "Cancelar"                                                                                    |
| `deliveries.create.discardConfirm`          | "¿Descartar entrega? Lo que escribiste se va."                                                |
| `deliveries.create.validation.minProducts`  | "Selecciona al menos un producto."                                                            |
| `deliveries.create.validation.dateFuture`   | "La fecha de entrega no puede ser futura — ajusta la fecha."                                  |
| `deliveries.create.validation.costNegative` | "El costo no puede ser negativo."                                                             |
| `deliveries.create.validation.exchangeRate` | "El tipo de cambio debe ser mayor a 0."                                                       |
| `deliveries.create.success.toast`           | "Entrega anotada. Te avisamos cuando llegue."                                                 |
| `deliveries.create.autosave`                | "Guardado, hace {seconds}s"                                                                   |

## 10. Riesgos y supuestos

**Supuestos:**

- 4 section cards (Tienda · Productos · Costos · Resumen). Si entra con `sourceOrderId`, paso 1 está pre-resuelto y el step indicator arranca en paso 2 con paso 1 marcado como done (check + `--success`).
- La tienda pre-fijada por `sourceOrderId` se muestra deshabilitada (no editable) con badge "Pre-llenado desde pedido". Para cambiarla, el usuario debe abandonar el flujo y entrar desde el listado.
- Cuando entra con `sourceOrderId`, los productos del pedido origen vienen pre-seleccionados pero deselectables uno a uno o por grupo (recomendación: confirmar con producto y diseñar para que el usuario lo perciba como "ya marcado, ajusta si hace falta").
- Pre-orders fuera del estado `NONE` o `ARRIVED_AT_STORE` no aparecen en la lista (filtro lo aplica el server, no el cliente).

**Riesgos:**

- **Listas largas de elegibles** — una tienda con muchas órdenes activas puede mostrar 50+ items. Mitigación: cada grupo es un accordion colapsable (default expandido para el primer grupo, colapsado para el resto), search foldSearchText filtra cross-group, y dentro de cada grupo el scroll es contenido (max-h con overflow auto a partir de 8 items).
- **Select-all accidental** — tap involuntario podría seleccionar 50 productos. Mitigación: tras un select-all que afecte ≥10 items mostrar toast con "N productos seleccionados · Deshacer" durante 5s, además del botón ↶ Deshacer inline en el contador del paso 2.
- **Consistencia de moneda** — `currencyCode` + `exchangeRate` requieren validación cliente (formato + ≥0) y server (consistencia con baseCurrency del usuario). Mitigación: helper "Aplicado a tu moneda base" + preview del costo convertido en el Resumen sidebar.
- **Pre-selección invisible** — si el usuario entra con `sourceOrderId` y todos los productos vienen marcados, puede no entender que el form ya está casi listo. Mitigación: el step indicator abre directo en paso 2 con halo, y un banner informativo en card 2 ("Vienen 3 productos pre-seleccionados de PT-002418 · Cambia lo que necesites").

**Decisiones para input humano antes de S3:**

1. **Pre-selección con `sourceOrderId`:** ¿se pre-seleccionan todos los productos del pedido origen al entrar? Recomendación: sí (reduce friction en el caso common path), permitiendo deselección rápida. Alternativa: dejar todo desmarcado y delegar la selección al usuario (más control, más fricción).
2. **UI explícita para split shipment:** ¿el flujo de entregar sólo algunos productos de varias órdenes (split shipment) merece UI dedicada o se infiere de la selección actual? Recomendación: inferir — la presencia de productos de múltiples grupos en la selección ya describe el caso. La sección Resumen sidebar lista los `Pedidos origen` para evidencia. Si en S3 se valida que los usuarios se confunden con split, sumar un chip "Entrega parcial · 2 de 5 items" en el header de cada grupo.
3. **Persistencia del autosave:** ¿se persiste el draft en local storage entre sesiones, o sólo durante la sesión activa? Decisión a tomar con FRD de delivery management.
