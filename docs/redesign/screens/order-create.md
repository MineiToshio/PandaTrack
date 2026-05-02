---
title: Order create
session: 02
status: lo-fi-wireframe + post-closure updates
last_updated: 2026-05-01
post_closure_adr: ../decisions/0001-s2-closure-decisions.md
---

# Order create

> **Addendum post-S2 (2026-05-01)** — Decisiones aplicadas tras research, ver [`ADR 0001`](../decisions/0001-s2-closure-decisions.md):
>
> - Decisión 12 / OC2: la UI **bloquea submit con 0 items** (aplica `items.min(1)` aunque el schema lo permita opcional). Pedidos sin items son datos incompletos.
> - Decisión 12 / OC3: el step indicator es **navegable libremente** (clickable hacia adelante y atrás) con scroll spy que resalta el paso del viewport. Sin gating estricto.
> - Decisión 12 / OC4: el autosave es **local-only** en `localStorage` por `userId`. El indicador del footer dice **"Guardado en este navegador, hace Ns"** (no sólo "Guardado, hace Ns") para que el usuario sepa que el draft no es cross-device. Server drafts pasan a FRD futuro.
> - Decisión 5: la view-transition al success usa convención `order-{humanId}` (vinculante).
> - Patrones de input pre-llenado (Decisión 2) aplican si el flujo se usa con query params en el futuro.

## 1. Propósito y contrato funcional

Pantalla `/[locale]/orders/new` para anotar un pedido nuevo. Implementa la fila #12 del [`functional-inventory.md`](../functional-inventory.md) (sección B.3) más su sub-flujo 12.a (modal de discrepancia cuando Σ items ≠ totalCost). El schema base es `orderCreateSchema` (sección D del inventory): `storeId`, `orderDate`, `expectedDeliveryFrom/To`, `currencyCode`, `exchangeRate`, `totalCost` en cents, `items[]` dinámicos (name, quantity, unitPrice, productTypeKey, position) y `note` opcional. Acciones: seleccionar tienda, fechas, moneda + tipo de cambio, total, agregar/eliminar/reordenar items, calcular total automáticamente como suma `qty × unitPrice`, submit, cancelar. Permisos: `verified` (sesión + email verificado). **Gate**: si el usuario no tiene tiendas, esta vista no renderiza el form sino un empty state con CTA hacia `/stores/new?returnTo=order-create` (deep link de retorno) — el flujo no permite anotar un pedido huérfano.

## 2. Wireframe mobile (360px)

```
┌──────────────────────────────────────────┐
│ ← Volver        Anotar pedido       [ⓘ] │  header sticky 56px
├──────────────────────────────────────────┤
│                                          │
│  ●───────●───────○───────○───────○       │  step indicator full-width
│  1       2       3       4       5       │  flex-1 cada tramo, no max-w
│  Tienda  Fechas  Items   Costos  Listo   │  Caption 11px text-secondary
│                                          │
├──────────────────────────────────────────┤
│ ┌──────────────────────────────────────┐ │
│ │ PASO 1 · TIENDA                      │ │  eyebrow mono text-muted
│ │ ¿Dónde lo compraste?                 │ │  Display 19pt text-primary
│ │ Buscá la tienda o suma una nueva.    │ │  helper Body 13 text-secondary
│ │                                      │ │
│ │ ┌──────────────────────────────────┐ │ │  combobox active border-accent
│ │ │ 🔍  Buscar tienda…               │ │ │
│ │ └──────────────────────────────────┘ │ │
│ │                                      │ │
│ │ ┌──────────────────────────────────┐ │ │
│ │ │[A] Akiba Records   AR  ✓         │ │ │  avatar tinte indigo + check
│ │ ├──────────────────────────────────┤ │ │
│ │ │[M] Mercado MX      MX            │ │ │
│ │ ├──────────────────────────────────┤ │ │
│ │ │ + Crear nueva tienda             │ │ │  ghost link, abre sheet
│ │ └──────────────────────────────────┘ │ │
│ └──────────────────────────────────────┘ │  section card radius-xl 20px pad
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ PASO 2 · FECHAS                      │ │
│ │ ¿Cuándo y para cuándo?               │ │
│ │                                      │ │
│ │ Día del pedido                       │ │  label text-secondary 13
│ │ ┌──────────────────────────────────┐ │ │
│ │ │ 2026-05-01                       │ │ │  date input native mobile
│ │ └──────────────────────────────────┘ │ │
│ │                                      │ │
│ │ Llegada esperada (rango)             │ │
│ │ ┌────────────┐  ┌────────────────┐   │ │
│ │ │ Desde      │  │ Hasta          │   │ │  range picker 2 fields
│ │ └────────────┘  └────────────────┘   │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ PASO 3 · ITEMS                       │ │
│ │ ¿Qué te traes?                       │ │
│ │                                      │ │
│ │ ┌──────────────────────────────────┐ │ │
│ │ │ ⋮⋮  [💿 disc]  Vinyl repress   ✕ │ │ │  drag handle 24px + Lucide
│ │ │     qty 1  ·  $24,00              │ │ │  teal icon, text-secondary
│ │ ├──────────────────────────────────┤ │ │
│ │ │ ⋮⋮  [📖 book-open]  Volumen 4 ✕ │ │ │
│ │ │     qty 2  ·  $9,50               │ │ │
│ │ └──────────────────────────────────┘ │ │
│ │                                      │ │
│ │ + Agregar item                       │ │  ghost button text-accent
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ PASO 4 · COSTOS                      │ │
│ │ ¿Cuánto pagaste?                     │ │
│ │                                      │ │
│ │ Moneda          Tipo de cambio       │ │
│ │ ┌────────┐     ┌──────────────────┐  │ │
│ │ │ USD ▾ │     │ 1.00             │  │ │
│ │ └────────┘     └──────────────────┘  │ │
│ │                                      │ │
│ │ Total pagado                         │ │
│ │ ┌────────────────────┐  ┌──────────┐ │ │
│ │ │ $43.00             │  │Calcular  │ │ │  ghost btn → suma items
│ │ └────────────────────┘  └──────────┘ │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ PASO 5 · NOTA (opcional)             │ │
│ │ Algo que quieras recordar.           │ │
│ │                                      │ │
│ │ ┌──────────────────────────────────┐ │ │
│ │ │                                  │ │ │  textarea
│ │ │                                  │ │ │
│ │ └──────────────────────────────────┘ │ │
│ │                            0 / 2000  │ │  counter text-muted
│ └──────────────────────────────────────┘ │
│                                          │
├──────────────────────────────────────────┤
│  Guardado, hace 4s          [Cancelar]   │  footer sticky autosave + ghost
│                          [Anotar pedido] │  CTA primario indigo full-width
└──────────────────────────────────────────┘

VARIANTE — sheet bottom Resumen (tap en [ⓘ] del header):

┌──────────────────────────────────────────┐
│              ───── (handle)              │  Vaul-style drag handle
│                                          │
│  Resumen                                 │  Display 19pt
│                                          │
│  Tienda          [A] Akiba Records       │  attribute → value rows
│  Día del pedido  2026-05-01              │  text-secondary → text-primary
│  Llegada         2026-06-10 → 2026-06-20 │
│  Items           2 productos              │
│  Total           $43,00 USD              │  tabular-nums
│                                          │
│  ─────────────────────────────────────   │
│                                          │
│  Atajos                                  │
│  Enviar          ⌘ + Enter (kbd)          │
│  Cancelar        Esc                     │
│  Agregar item    +                       │
│                                          │
└──────────────────────────────────────────┘
```

## 3. Wireframe desktop (≥1024px)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ Sidebar 240px │ ContentHeader: Pedidos / Anotar pedido                                       │
│               ├──────────────────────────────────────────────────────────────────────────────│
│               │ max-w-6xl, px-8, py-10                                                       │
│               │                                                                              │
│               │   ●───────────●───────────○───────────○───────────○                          │
│               │   1           2           3           4           5                          │
│               │   Tienda      Fechas      Items       Costos      Listo                      │
│               │   (full-width step indicator, flex-1 entre círculos, accent halo en activo)  │
│               │                                                                              │
│               │ ┌──────────────────────────────────────────┐ ┌────────────────────────────┐ │
│               │ │ cols 1-8                                  │ │ cols 9-12 sticky top-24    │ │
│               │ │                                           │ │                            │ │
│               │ │ ┌─────────────────────────────────────┐  │ │ ┌────────────────────────┐ │ │
│               │ │ │ PASO 1 · TIENDA                     │  │ │ │ RESUMEN                │ │ │
│               │ │ │ ¿Dónde lo compraste?                │  │ │ │                        │ │ │
│               │ │ │ Buscá la tienda o suma una nueva.   │  │ │ │ Tienda                 │ │ │
│               │ │ │                                     │  │ │ │ [A] Akiba Records      │ │ │
│               │ │ │ ┌─────────────────────────────────┐ │  │ │ │ Día del pedido         │ │ │
│               │ │ │ │ 🔍  Buscar tienda…              │ │  │ │ │ 2026-05-01             │ │ │
│               │ │ │ └─────────────────────────────────┘ │  │ │ │ Llegada                │ │ │
│               │ │ │ [A] Akiba Records  AR  ✓            │  │ │ │ 06-10 → 06-20          │ │ │
│               │ │ │ [M] Mercado MX     MX               │  │ │ │ Items                  │ │ │
│               │ │ │ + Crear nueva tienda                │  │ │ │ 2 productos            │ │ │
│               │ │ └─────────────────────────────────────┘  │ │ │ Total                  │ │ │
│               │ │                                           │ │ │ $43,00 USD             │ │ │
│               │ │ ┌─────────────────────────────────────┐  │ │ │  (Display tabular-nums)│ │ │
│               │ │ │ PASO 2 · FECHAS                     │  │ │ └────────────────────────┘ │ │
│               │ │ │ ¿Cuándo y para cuándo?              │  │ │                            │ │
│               │ │ │                                     │  │ │ ┌────────────────────────┐ │ │
│               │ │ │ Día del pedido    Llegada (rango)   │  │ │ │ ATAJOS                 │ │ │
│               │ │ │ [date]            [from] → [to]     │  │ │ │                        │ │ │
│               │ │ └─────────────────────────────────────┘  │ │ │ Enviar       ⌘+Enter   │ │ │
│               │ │                                           │ │ │ Cancelar     Esc       │ │ │
│               │ │ ┌─────────────────────────────────────┐  │ │ │ Command palette ⌘+K    │ │ │
│               │ │ │ PASO 3 · ITEMS                      │  │ │ │ Agregar item +         │ │ │
│               │ │ │ ¿Qué te traes?                      │  │ │ │  (kbd: mono 11 surface)│ │ │
│               │ │ │                                     │  │ │ └────────────────────────┘ │ │
│               │ │ │ ⋮⋮ [💿] Vinyl repress   1 × $24    ✕ │  │ │                            │ │
│               │ │ │ ⋮⋮ [📖] Volumen 4       2 × $9,50  ✕ │  │ │                            │ │
│               │ │ │                                     │  │ │                            │ │
│               │ │ │ + Agregar item                      │  │ │                            │ │
│               │ │ └─────────────────────────────────────┘  │ │                            │ │
│               │ │                                           │ │                            │ │
│               │ │ ┌─────────────────────────────────────┐  │ │                            │ │
│               │ │ │ PASO 4 · COSTOS                     │  │ │                            │ │
│               │ │ │ Moneda  USD▾   Cambio  1.00         │  │ │                            │ │
│               │ │ │ Total $43,00            [Calcular]  │  │ │                            │ │
│               │ │ └─────────────────────────────────────┘  │ │                            │ │
│               │ │                                           │ │                            │ │
│               │ │ ┌─────────────────────────────────────┐  │ │                            │ │
│               │ │ │ PASO 5 · NOTA (opcional)            │  │ │                            │ │
│               │ │ │ [textarea]                  0/2000  │  │ │                            │ │
│               │ │ └─────────────────────────────────────┘  │ │                            │ │
│               │ └──────────────────────────────────────────┘ └────────────────────────────┘ │
│               │                                                                              │
│               ├──────────────────────────────────────────────────────────────────────────────│
│               │ Guardado, hace 4s                   [Cancelar]      [Anotar pedido]          │  footer sticky
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

Comportamientos clave del desktop:

- **Tienda**: combobox con búsqueda local, render row con avatar 32px (tinte indigo 14% + letra inicial indigo si no hay logo), nombre + countryCode mono. Atajo "Crear nueva tienda" abre sheet lateral inline para no perder el form.
- **Fechas**: `orderDate` date picker; `expectedDeliveryFrom/To` range picker (popover único). Validación post-blur: `to ≥ from`.
- **Items**: lista vertical con drag-handle 24px (`grip-vertical` de Lucide), name input flexible, qty number compacto, unitPrice money input (cents), productType combobox con ícono Lucide en `--accent-cool`. Botón ghost "Agregar item" abre fila nueva al final con focus en `name`. Posición = orden visual.
- **Costos**: `currencyCode` select (las 3-letter codes válidas), `exchangeRate` decimal input (post-blur valida 0.01-99999.99), `totalCost` money input. Botón "Calcular" hace `Σ qty × unitPrice` y reemplaza valor mostrando un highlight `--accent / 14%` 280ms.
- **Discrepancia al submit**: si hay items con unitPrice y el total ingresado difiere de la suma → modal centrado.
- **Nota**: textarea max 2000 con counter `--text-muted` que sube a `--warning` >1900.

## 4. Tokens invocados

- **Lienzo**: `--background` (canvas), `--surface` (las 5 section cards en plano, sin tinte cromático per §4.13), `--surface-elevated` (cards del sidebar Resumen + Atajos, sheets mobile, modal de discrepancia).
- **Bordes**: `--border` (dividers entre filas de items), `--border-strong` (input borders, outline de section cards en dark, kbd borders).
- **Texto**: `--text-primary` (valores activos, cifras del Resumen, item names), `--text-secondary` (labels de form, helpers de section card, productType inline meta), `--text-muted` (eyebrow `PASO N · …`, autosave timestamp del footer, counter del textarea, code mono de kbd).
- **Acentos**: `--accent` (CTA primario "Anotar pedido", step activo con halo glow, focus ring vía `--focus-ring`, active state del combobox de tienda, active state de productType chip en items, avatar fallback tinte 14% + letra), `--accent-cool` (íconos Lucide de productType en items y en empty state mascota), `--accent-warm` (NO se usa en este form — no hay métrica "próximo pago" ni achievement).
- **Status**: `--success` (step done con check, indicador "Guardado, hace Ns" en footer cuando autosave acaba de commitear), `--warning` (validación inline soft post-blur cuando rango de fechas se ve raro pero no inválido — ej. >2 años en el futuro; counter del textarea >1900 chars), `--destructive` (validación inline error post-submit, ghost de "Eliminar item" en items, border-left 2px de section card con error).
- **Focus**: `--focus-ring` (`outline 2px solid + offset 2px` en cualquier `:focus-visible`).
- **Elevation**: `elevation-2` para section cards en light; en dark, `--surface` flat + `--border-strong` 1px + glow indigo 6% en card del paso activo. **Modal de discrepancia**: `--surface-elevated` + `elevation-3` (light) o glow indigo borde superior (dark).

**Gaps detectados**: ninguno bloqueante en este wireframe — el patrón §4.13 cubre todo. Si en S3 los items con drag-handle requieren un token específico de "row pressed during drag" (que no está cubierto por hover/pressed state layers genéricos), se anotará en `../_notes/atelier-gaps.md`. Por ahora no se anota nada.

## 5. Estados

- **Empty (gate "sin tiendas")**: full-page card centrada con mascota `sleeping` 96px sobre `--accent-cool / 24%` rounded, copy "Necesitas una tienda primero. Te ayudamos.", helper "Vamos a crearla y volvemos acá", CTA primario indigo "Crear tienda" → navega a `/stores/new?returnTo=order-create` (la ruta de stores create lee este param y redirige de vuelta tras success). El form NO se renderiza.
- **Ready** (form vacío con tiendas): step 1 activo con halo glow, sección Tienda con foco lógico en el combobox (`autoFocus` solo en desktop), sidebar Resumen muestra placeholders `—` en `--text-muted` con la frase "Sin datos todavía" arriba. Footer CTA "Anotar pedido" deshabilitado hasta que `storeId` y `orderDate` validen.
- **Submitting**: footer CTA con spinner Lucide `loader-2` rotando 1s linear y label "Anotando…" (`--text-muted`). Form completo en `aria-busy=true`. Section cards en `pointer-events: none` con overlay `--text-primary / 4%`. Inputs mantienen su contenido (no se vacían).
- **Validation_errors** (post-submit): scroll suave al primer campo con error (sin foco automático del DOM — sólo `scrollIntoView({ behavior: 'smooth', block: 'center' })`). Inline error rojo bajo el campo con copy declarativo del glosario. Ej. fecha inválida: "La fecha de entrega no puede ser anterior a la de orden — ajusta la fecha o cambia el orden." Section card afectada con `border-left: 2px solid var(--destructive)`. Server `fieldErrors` se mapean al campo correspondiente.
- **Discrepancia modal** (sub-flujo 12.a): bottom sheet en mobile (Vaul-style con drag handle), modal centrado en desktop (`--surface-elevated` + `elevation-3`). Copy: "Tu suma no cuadra con el total. ¿Cuál dejamos?" Layout interno con dos columnas Display tabular-nums lado a lado:

  ```
  Tu suma                    Lo que ingresaste
  $43,00                     $48,00
  ```

  3 acciones: ghost "Volver" (cierra y vuelve al form), ghost "Usar calculado" (sustituye `totalCost` por la suma y reenvía), primario indigo "Usar ingresado" (deja el total tal cual y reenvía). Ningún token destructivo — es decisión, no error.

- **Success**: toast Sonner-style con copy "Pedido anotado. PT-XXXXXX listo." (`--success` icon `check-circle`), redirect a `/orders/[id]` con view-transition canónica §4.8 (avatar + código + chip status se materializan en el detalle, 280ms, spring overshoot 0.05). **Sin mascota celebrating** — no es achievement, es completion de tarea.
- **Error de servidor (no validation, ej. 500)**: inline alert `--destructive / 14%` background dentro de la primera section card afectada con copy "Algo se rompió de este lado. Dale otra vez." Si el error es de la submit completa (sin field), se muestra full-width sobre el footer. Mascota `idle` con ojos cerrados sólo si la página completa rompe (error boundary).
- **Edit** (no aplica directo aquí): la vista `/[id]/edit` reusa este mismo wireframe con `initialValues` precargados, scroll/focus stable post-mutation, y modal "Descartar cambios" si dirty al cancelar. Esa pantalla tiene su propio doc.

## 6. Motion y view transitions

- **Section cards**: stagger 40ms entre las 5 al montar la vista, fade-in opacity 0→1 + translate-y 4px→0, `--motion-base 280ms`, `--ease-out-expressive`.
- **Step indicator**: el círculo del paso activo escala 0→1 + accent fill al avanzar/retroceder; la línea conectora completa transiciona de `--border` a `--accent` en `--motion-base`. El check del estado done aparece con `--motion-fast` y `--ease-emphasis`.
- **Combobox tienda y productType**: hover sutil `--text-primary / 6%` state layer; click → micro-pulso del border accent 200ms. La fila active del combobox abre dropdown con scale 0.98→1 + fade en `--motion-fast`.
- **Items list**: agregar item slide-in desde abajo + fade en `--ease-out-expressive` 280ms; eliminar slide-out (height collapse) + tinte `--destructive / 14%` 200ms antes de removerse del DOM.
- **Botón "Calcular"**: el campo `totalCost` recibe highlight pulse `--accent / 14%` background 280ms al actualizarse.
- **Discrepancia modal**: enter scale 0.96→1 + opacity 0→1 + backdrop fade en `--motion-base`; focus trap; exit reverse en `--motion-fast`.
- **Submit success → redirect**: view-transition canónica §4.8 (firma propia 280ms spring overshoot 0.05). El avatar de la tienda en el sidebar Resumen mantiene su tinte indigo continuo durante el morph hacia el header del detalle. El código mono `PT-XXXXXX` crece de 11px (Resumen) a 13px (header detalle) sin re-render. Chip status hace micro-pausa 40ms entre los 120-160ms del path.
- **Autosave indicator footer**: fade del estado `Guardando…` → `Guardado, hace 0s` en `--motion-fast`; el contador de segundos sube cada 1s con `font-variant-numeric: tabular-nums` para no saltar.
- **`prefers-reduced-motion: reduce`**: todas las animaciones se reducen a fade 150ms; sin stagger, sin springs, sin overshoot, sin walking de mascota.

## 7. Atajos de teclado (desktop) y gestos (mobile)

**Desktop**:

- `⌘+Enter` (o `Ctrl+Enter` en Windows/Linux) → envía el form.
- `Esc` → cancela; si el form está dirty, abre modal "Descartar cambios" antes de navegar.
- `⌘+K` → abre command palette global.
- `+` (cuando el foco está fuera de inputs textuales) → agrega item nuevo y mueve foco al campo `name` del nuevo item.
- `Tab` → navega lineal por todos los inputs en el orden visual de las section cards (1→5). El sidebar Resumen + Atajos NO entra en el tab order (es read-only informational).

**Mobile**:

- Sheet bottom Vaul-style para Resumen + Atajos accesible desde icon-button `info` (Lucide) en el header — drag-handle visible, swipe-down cierra.
- Date pickers: usar el picker nativo del OS (`<input type="date">`) — más rápido y familiar para el usuario.
- Combobox de tienda: tap abre full-screen sheet con search input fijo arriba y lista scrolleable; el atajo "Crear nueva tienda" siempre visible al fondo del sheet.
- Submit: tap en CTA primario del footer sticky (full-width, target ≥48px).
- Items drag handle: tap-and-hold sobre el `grip-vertical` activa el modo drag (el handle tiene 24×24 hit area mínimo para no chocar con el scroll del page).

## 8. Mascota

La mascota panda aparece sólo en dos puntos de esta vista, siguiendo §4.10:

- **Empty state "sin tiendas"** (gate): estado `sleeping` 96px sobre fondo `--accent-cool / 24%`. Es el único lugar donde participa en el flujo principal.
- **Error 500 / página rota** (error boundary global): estado `idle` 96px con micro-prop "ojos cerrados". No aparece en errores de validación normales.

La bubble idle 56×56 del shell `(app)/layout` sigue presente en la esquina inferior derecha como en cualquier otra pantalla privada.

**NUNCA** durante:

- El flujo del form en estado ready o submitting (regla §4.10: no interrumpe flujos críticos).
- Estados de validation_errors (no celebra, no consuela — se queda fuera).
- El modal de discrepancia (es una decisión del usuario, no celebración ni consuelo).
- El estado success: NO mascota celebrating. Anotar un pedido es task completion, no achievement. La celebración de mascota se reserva para hitos reales (pago full, entrega completa, primera tienda creada en onboarding).

## 9. Voice samples

Strings reales en español. Claves i18n viven en `src/i18n/locales/es/orders.json` (paridad obligatoria con `en/orders.json`).

| Clave i18n                                | Texto                                                                                        |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| `orders.create.gate.noStores.title`       | Necesitas una tienda primero. Te ayudamos.                                                   |
| `orders.create.gate.noStores.helper`      | Vamos a crearla y volvemos acá.                                                              |
| `orders.create.gate.noStores.cta`         | Crear tienda                                                                                 |
| `orders.create.steps.store.title`         | ¿Dónde lo compraste?                                                                         |
| `orders.create.steps.store.helper`        | Buscá la tienda o suma una nueva.                                                            |
| `orders.create.steps.dates.title`         | ¿Cuándo y para cuándo?                                                                       |
| `orders.create.steps.items.title`         | ¿Qué te traes?                                                                               |
| `orders.create.steps.items.add`           | Agregar item                                                                                 |
| `orders.create.steps.costs.title`         | ¿Cuánto pagaste?                                                                             |
| `orders.create.steps.costs.calculate`     | Calcular                                                                                     |
| `orders.create.steps.note.title`          | Algo que quieras recordar.                                                                   |
| `orders.create.cta.submit`                | Anotar pedido                                                                                |
| `orders.create.cta.submitting`            | Anotando…                                                                                    |
| `orders.create.cta.cancel`                | Cancelar                                                                                     |
| `orders.create.discrepancy.title`         | Tu suma no cuadra con el total. ¿Cuál dejamos?                                               |
| `orders.create.discrepancy.useCalculated` | Usar calculado                                                                               |
| `orders.create.discrepancy.useEntered`    | Usar ingresado                                                                               |
| `orders.create.discrepancy.back`          | Volver                                                                                       |
| `orders.create.autosave.savingNow`        | Guardando…                                                                                   |
| `orders.create.autosave.savedAt`          | Guardado, hace {seconds}s                                                                    |
| `orders.create.success.toast`             | Pedido anotado. {humanId} listo.                                                             |
| `orders.create.errors.dateRange`          | La fecha de entrega no puede ser anterior a la de orden — ajusta la fecha o cambia el orden. |
| `orders.create.errors.server`             | Algo se rompió de este lado. Dale otra vez.                                                  |
| `orders.create.errors.discardDirty`       | ¿Descartar este pedido a medias? Lo escrito se pierde.                                       |

## 10. Riesgos y supuestos

**Supuestos**:

1. Las **5 section cards** son: (1) Tienda, (2) Fechas, (3) Items, (4) Costos, (5) Nota. Difieren del sample §4.13 (Identidad, Canales, etc. de "Nueva tienda") porque ese form es de stores y este es de orders — pero el **patrón** (5 cards + step indicator full-width + sidebar consistente + footer sticky) se reusa idéntico.
2. La nota es opcional pero se mantiene como step 5 visible (no oculta tras un toggle) para conservar el patrón Atelier de "5 secciones" del sample. Si en validación con usuarios se siente forzada, S3 la convierte en collapsible disclosed-by-default.
3. El gate "sin tiendas" reemplaza completamente la vista — no se renderiza ni el step indicator. La razón: los principios §2 ("una pantalla, una decisión") indican que cuando hay un blocker upstream, esa es la única decisión que importa.
4. El autosave guarda draft localmente (localStorage por user) cada N segundos cuando el form está dirty, no en server. La key incluye `userId` para no cruzar drafts entre cuentas en el mismo browser.

**Riesgos**:

1. **Drag-handle en mobile vs scroll**: items con drag puede chocar con scroll vertical de la página. Resolver con drag-handle explícito 24×24 (Lucide `grip-vertical`) que activa drag con `pointerdown` sólo cuando el contacto inicia sobre el handle — el resto de la fila scrollea normal.
2. **Modal de discrepancia ambiguo**: el usuario puede no entender qué columna gana al confirmar. Mitigación: mostrar las dos cifras lado a lado en Display tabular-nums con label claro arriba ("Tu suma" vs "Lo que ingresaste"), y los CTAs nombran explícitamente la fuente de verdad ("Usar calculado" vs "Usar ingresado").
3. **Combobox de tienda con creación inline**: el atajo "Crear nueva tienda" debe abrir un sheet/modal que no destruya el progreso del form. Implementación: el sheet de stores create se monta sobre el form, al success vuelve y rellena `storeId` automáticamente.
4. **Drift visual del patrón Atelier**: si delivery-create en su propio doc usa una variante del patrón (ej. cards en filas distintas, sidebar con otra jerarquía), pierde la firma. Cross-screen concern explícito: delivery-create debe heredar este mismo layout (5 section cards + step indicator + sidebar Resumen+Atajos + footer autosave) aunque su contenido sea distinto.

**Decisiones para input humano antes de S3**:

- ¿Se permite enviar un pedido con **0 items**? Schema dice items opcional pero el flujo típico es ≥1. Supuesto actual: el form sugiere agregar al menos 1 item con un empty state inline en la card "Items" ("Sin items todavía. Suma uno.") pero NO bloquea el submit con 0. Si el equipo prefiere bloquear, se ajusta a `items.min(1)` en S3.
- ¿El step indicator es **navegable hacia atrás libremente** clickeando en círculos done, o sólo paso por paso? Supuesto actual: navegable libre — el usuario puede saltar a cualquier card visitada (todas las cards están visibles a la vez en este multi-step "all-on-page", el step indicator es sólo orientación visual). Si en S3 se decide convertir a multi-paso real (una card visible a la vez), la navegación debe permitir ir atrás libre y adelante sólo con valid.
- ¿El **autosave** se mantiene local-only o también persiste server-side como `OrderDraft`? Supuesto actual: local (localStorage). Server drafts agregan complejidad de modelo y limpieza que excede MVP.
