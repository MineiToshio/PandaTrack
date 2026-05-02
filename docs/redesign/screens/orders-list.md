---
title: Orders list
session: 02
status: lo-fi-wireframe + post-closure updates
last_updated: 2026-05-01
post_closure_adr: ../decisions/0001-s2-closure-decisions.md
---

# Orders list

> **Addendum post-S2 (2026-05-01)** — Decisiones aplicadas tras research, ver [`ADR 0001`](../decisions/0001-s2-closure-decisions.md):
>
> - Decisión 9: en mobile la paginación cambia de **infinite scroll con sentinel** a **botón explícito "Cargar más"** al pie de la lista. `pageSize 20` mobile, `pageSize 30` desktop con paginador numerado clásico. El sentinel rompía scroll restoration y entraba en conflicto con view-transitions.
> - Decisión 10: el background del swipe izquierda ("Anotar pago") cambia de **`--success` verde** a **`--accent` indigo**. Verde queda reservado al toast de pago full (achievement). Indigo mapea a "acción primaria del flujo".
> - Decisión 5: cada row declara `view-transition-name: order-{humanId}` (delegación dinámica — sólo la row clickeada/focused) — convención vinculante.
> - Decisión 4: tras swipe action exitoso, toast usa variant **`neutral-undo`** 5s.
> - Decisión 11: el toggle densa/cómoda persiste en `localStorage["orders.density"]` y se reflejará en `preferences.preferredDensity` cuando S3 actualice el schema.

## 1. Propósito y contrato funcional

El listado de pedidos es la vista de inventario operativa del coleccionista: responde "qué tengo abierto, qué está cerca de llegar, qué me debe atención" en una sola superficie densa y filtrable. Hereda el contrato de la fila #12 de [`functional-inventory.md` §B.3](../functional-inventory.md) sin cambiar shape de datos ni server actions: cada row muestra `humanId` (`PT-XXXXXX`), tienda (logo + nombre + país implícito), fecha de orden, ventana de entrega esperada (`from–to`), `totalCost + currencyCode`, porcentaje pagado y estado lifecycle (`ACTIVE` / `CANCELLED` con sub-estados derivados como "100% pagado", "atrasado N días"). Acciones visibles: filtrar por nombre/tienda/productType/estado/rango de fechas, paginar (`pageSize 30`), abrir detalle con view-transition canónica §4.8, y FAB primario "Nuevo pedido" que navega a `/orders/new` con gate "Necesitas una tienda primero" si el usuario no tiene tiendas. Permisos: `verified` (sesión + email confirmado o en grace 6 días). Owner-only por construcción del query.

## 2. Wireframe mobile (360px)

Lista densa de 2 líneas por row, swipe-actions nativos, filtros en bottom sheet Vaul con stops 0.4 / 0.9. La densidad respeta §5 del decálogo: info clave en línea 1 + meta en línea 2, padding vertical 14px para que el tap target efectivo de la row entera supere 44px aunque el texto sea apretado.

```
┌──────────────────────────────────────────┐
│ ☰  PandaTrack          🔔  ◐  [SM]      │ ← app shell header (sidebar drawer)
├──────────────────────────────────────────┤
│  PEDIDOS                          24     │ ← eyebrow mono uppercase + count
│  ┌──────────────┐  ┌────────┐  [⇅ Sort]  │
│  │ 🔎 Buscar…   │  │ ⚲ Filt.│           │ ← search input + filter icon-button
│  └──────────────┘  └────────┘            │   (abre bottom sheet)
│                                          │
│  Activos · Tienda Mercado MX · Vinyl     │ ← chips de filtros activos (scroll-x)
│  [×]            [×]              [×]     │
├──────────────────────────────────────────┤
│ ┌──────────────────────────────────────┐ │
│ │ ╭──╮  Mercado MX        $1.240,00 USD│ │ ← row 1 — línea 1
│ │ │ M│  PT-002418  💿                  │ │   avatar 40px tinte indigo 14%
│ │ ╰──╯  ─────────────────────  [60%──] │ │   ícono Lucide disc en teal
│ │       Pedido 12 abr · llega 18–22 may│ │ ← línea 2 meta muted
│ │                              [Activo]│ │   chip status (text + color)
│ └──────────────────────────────────────┘ │
│ ┌──────────────────────────────────────┐ │
│ │ ╭──╮  Surugaya          ¥18.400 JPY  │ │
│ │ │ S│  PT-002417  📚                  │ │
│ │ ╰──╯  ─────────────────────  [100%─] │ │
│ │       Pedido 09 abr · llegó 28 abr   │ │
│ │                            [Pagado] ✓│ │ ← chip success (texto + check)
│ └──────────────────────────────────────┘ │
│ ┌──────────────────────────────────────┐ │
│ │ ╭──╮  AmiAmi            $89,50 USD   │ │
│ │ │ A│  PT-002416  ✨                  │ │
│ │ ╰──╯  ─────────────────────  [40%──] │ │
│ │       Pedido 02 abr · esperado 15 may│ │
│ │                       [Atrasado 3d]  │ │ ← chip warning (texto + ícono)
│ └──────────────────────────────────────┘ │
│ ┌──────────────────────────────────────┐ │
│ │ ╭──╮  CDJapan           ¥6.200 JPY   │ │
│ │ │ C│  PT-002415  💿                  │ │
│ │ ╰──╯  ─────────────────────  [0%───] │ │
│ │       Pedido 28 mar · esperado jun   │ │
│ │                              [Activo]│ │
│ └──────────────────────────────────────┘ │
│ ⋯ (scroll continúa con más rows densas) │
│                                          │
│  ──────────  Cargando más…  ──────────   │ ← infinite scroll trigger sentinel
│                                          │
├──────────────────────────────────────────┤
│  🏠     📦     🚚     🏪     ⚙          │ ← tab bar inferior del shell
│ Hoy   Pedidos Entregas Tiendas Ajustes   │   (pedidos = active)
└──────────────────────────────────────────┘
                                       ┌──┐
                                       │ +│ ← FAB indigo, 56px, esquina
                                       └──┘   inferior derecha sobre tab bar

╔══════════════════════════════════════════╗
║ Bottom sheet Vaul (stop 0.9) al tocar ⚲ ║
╠══════════════════════════════════════════╣
║   ─── (drag handle)                      ║
║   Filtros                       [Limpiar]║
║                                          ║
║   Estado                                 ║
║   ( ) Todos  (●) Activos  ( ) Cancelados║
║   ( ) 100% pagado     ( ) Atrasados      ║
║                                          ║
║   Tienda                              ▾  ║ ← combobox con search interno
║   [Mercado MX  ×] [Surugaya  ×]          ║
║                                          ║
║   Tipo de producto                       ║
║   [💿 Vinyl] [📚 Manga] [✨ Anime]       ║ ← chips Lucide+label, multi-select
║   [🎴 Cards] [🎁 Plush] [📦 Figures]     ║
║                                          ║
║   Rango de fechas (orden)                ║
║   ┌──────────────┐  ┌──────────────┐     ║
║   │ Desde        │  │ Hasta        │     ║
║   └──────────────┘  └──────────────┘     ║
║                                          ║
║   ┌────────────────────────────────────┐ ║
║   │     Aplicar (24 resultados)        │ ║ ← CTA primario indigo sticky
║   └────────────────────────────────────┘ ║
╚══════════════════════════════════════════╝

Swipe izquierda sobre row:
┌──────────────────────────────────┬───────┐
│ row deslizada parcialmente       │  💵   │ ← acción verde, threshold 80px
│ (avatar, código, total visible)  │ Pago  │   release abre sheet de pago
└──────────────────────────────────┴───────┘   rápido (amount + date)

Swipe derecha sobre row:
┌───────┬──────────────────────────────────┐
│  🏪   │ row deslizada parcialmente       │ ← acción teal, navega a tienda
│ Tienda│                                  │
└───────┴──────────────────────────────────┘
```

**Decisión de paginación mobile:** infinite scroll con sentinel (`IntersectionObserver`) en lugar de botón "Cargar más". Razón: el gesto natural en mobile es scroll continuo y el dataset esperado (decenas a pocos cientos por usuario) no justifica friction extra. El sentinel muestra skeleton de 3 rows mientras carga; al finalizar muestra "No hay más pedidos" como estado terminal sutil en `--text-muted`. Riesgo registrado en §10 para usuarios power con 1000+ pedidos.

## 3. Wireframe desktop (≥1024px)

Sidebar primaria 240px del shell + main `max-w-6xl` con grid `[260px_1fr]` (filter rail izquierdo + tabla densa). Header con eyebrow mono, count, sort dropdown, view toggle (densa/cómoda) y peek panel toggle. Filas 36px de alto en modo denso, 44px en cómodo.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ ▦ PandaTrack                                                       🔍 ⌘K   🔔  ◐  [SM] │ ← shell header
├──────────┬──────────────────────────────────────────────────────────────────────────────┤
│          │                                                                              │
│  🏠 Hoy  │  PEDIDOS                                                                     │ ← eyebrow mono
│ ▣ Pedidos│  Tus pedidos abiertos                              ⊟ Densa  ⊞ Cómoda  ⌸ Peek │   title + count + view toggle
│  🚚 Entr.│  24 activos · 8 cerrados                                                     │
│  🏪 Tien.│  ──────────────────────────────────────────────────────────────────────────  │
│  ⚙ Ajust.│                                                                              │
│          │ ┌──── filtros (sticky) ────┐  ┌──── lista densa ───────────────────────────┐ │
│          │ │ 🔎 Buscar pedido…        │  │ Pedido       Tienda        Total    Pagado │ │ ← table header sticky
│          │ │                          │  │  Fecha       Producto      Estado   Acción │ │   col labels en mono caption
│          │ │ Estado          ▾        │  │ ──────────────────────────────────────────│ │
│          │ │ ☐ Todos                  │  │ ╭─╮ PT-002418  Mercado MX  $1.240  60% ━━ │ │ ← row 1 (36px denso)
│          │ │ ☑ Activos          (24)  │  │ │M│ 12 abr     💿 Vinyl    [Activo]      ▸│ │   hover state layer 6%/8%
│          │ │ ☐ Cancelados        (3)  │  │ ╰─╯                                       │ │   click → view-transition
│          │ │ ☐ 100% pagado       (12) │  │ ╭─╮ PT-002417  Surugaya    ¥18.400 100% ━│ │
│          │ │ ☐ Atrasados          (2) │  │ │S│ 09 abr     📚 Manga    [Pagado] ✓   ▸│ │
│          │ │                          │  │ ╰─╯                                       │ │
│          │ │ Tienda          ▾        │  │ ╭─╮ PT-002416  AmiAmi      $89,50   40% ━│ │
│          │ │ [+ Agregar tienda]       │  │ │A│ 02 abr     ✨ Anime    [Atrasado 3d]▸│ │ ← warning chip
│          │ │ ☑ Mercado MX             │  │ ╰─╯                                       │ │
│          │ │ ☑ Surugaya               │  │ ╭─╮ PT-002415  CDJapan     ¥6.200    0% ─│ │
│          │ │ ☐ AmiAmi                 │  │ │C│ 28 mar     💿 Vinyl    [Activo]      ▸│ │
│          │ │                          │  │ ╰─╯                                       │ │
│          │ │ Tipo de producto    ▾    │  │ ╭─╮ PT-002414  HMV Japan   ¥4.800   80% ━│ │
│          │ │ [💿] [📚] [✨]           │  │ │H│ 25 mar     ✨ Anime    [Activo]      ▸│ │
│          │ │ [🎴] [🎁] [📦]           │  │ ╰─╯                                       │ │
│          │ │                          │  │ ╭─╮ PT-002413  eBay JP     $32,00   100%━│ │
│          │ │ Rango de fechas     ▾    │  │ │e│ 20 mar     🎴 Cards    [Pagado] ✓   ▸│ │
│          │ │ ┌──────┐  ┌──────┐       │  │ ╰─╯                                       │ │
│          │ │ │Desde │  │Hasta │       │  │ ⋯ 18 rows más visibles (scroll interno)   │ │
│          │ │ └──────┘  └──────┘       │  │ ──────────────────────────────────────────│ │
│          │ │                          │  │ « ‹  Página 1 de 2  · 30 por página  › »  │ │ ← paginación clásica
│          │ │ ┌──────────────────────┐ │  └────────────────────────────────────────────┘ │
│          │ │ │  Limpiar filtros     │ │                                                  │
│          │ │ └──────────────────────┘ │                                  ┌──────────────┐│
│          │ └──────────────────────────┘                                  │  + Nuevo     ││ ← CTA primario
│          │                                                               │    pedido    ││   (también ⌘K → "N")
│          │                                                               └──────────────┘│
└──────────┴──────────────────────────────────────────────────────────────────────────────┘

Peek panel (toggle ⌸ en header del listado) — desliza desde la derecha:
┌──────────────────────────────────────────────────────┬────────────────────────────────┐
│ lista densa (se reduce a 60% del ancho)              │  PT-002418 · Mercado MX        │ ← peek panel
│                                                      │  ─────────────────────────     │   surface-elevated
│ ╭─╮ PT-002418  Mercado MX  $1.240  60% ━━ [seleccion│  $1.240,00 USD    60% pagado  │   border-strong
│ │M│ 12 abr     💿 Vinyl    [Activo]                ▸│  Restante $496,00              │
│ ╰─╯ ◀── row activa con state layer 8% indigo        │                                │
│                                                      │  Llega entre 18 y 22 may       │
│ ╭─╮ PT-002417  Surugaya    ¥18.400 100% ━ [Pagado]  │                                │
│ │S│                                                  │  3 productos · 💿 Vinyl        │
│ ╰─╯                                                  │  ┌──────────────────────────┐  │
│                                                      │  │ Abrir detalle completo →│  │ ← navega con
│ ⋯                                                    │  └──────────────────────────┘  │   view-transition §4.8
└──────────────────────────────────────────────────────┴────────────────────────────────┘
```

**Notas desktop:**

- Densa = 36px alto / cómoda = 44px alto. Default densa para usuarios con muchos pedidos; toggle persiste en `localStorage["orders.density"]`.
- Hover state layer `--text-primary / 6%` (light) o `8%` (dark). Sin shadow agregada, sin border highlight.
- Click en row → si peek está activo, abre peek panel; si no, navega a `/orders/[id]` con view-transition canónica.
- Filter rail es sticky (`top: 88px` para librarse del header del shell). Secciones colapsables con chevron Lucide; estado expandido por defecto.
- Sort dropdown ofrece: "Más recientes" (default), "Próximos a llegar", "Más atrasados", "Mayor monto", "Menor monto". Persistencia en URL (`?sort=upcoming`) para shareable views.
- View transition source: cada row declara `view-transition-name: order-{humanId}`; el detalle reusa el mismo nombre en su header. Coordinación cross-screen registrada en §10.

## 4. Tokens invocados

| Token                  | Uso en esta pantalla                                                                                                                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--background`         | Lienzo del listado y filter rail                                                                                                                                                                                |
| `--surface`            | Cards de cada row (light), tabla densa contenedora                                                                                                                                                              |
| `--surface-elevated`   | Bottom sheet Vaul, peek panel lateral, popover de sort dropdown, fondo del avatar fallback (mezclado con `--accent` 14%)                                                                                        |
| `--border`             | Divisor entre rows en modo denso desktop                                                                                                                                                                        |
| `--border-strong`      | Outline del avatar tienda, borde del search input, separador del filter rail                                                                                                                                    |
| `--text-primary`       | Nombre tienda, total monetario, código `PT-XXXXXX`                                                                                                                                                              |
| `--text-secondary`     | Labels de columnas, fecha de orden, helper "Llega entre…", labels de filtros                                                                                                                                    |
| `--text-muted`         | Eyebrow "PEDIDOS", timestamp "Pedido 12 abr", paginación, copia "No hay más pedidos"                                                                                                                            |
| `--accent` (indigo)    | FAB "+ Nuevo pedido", focus ring, chip de filtro activo, letra inicial del avatar fallback (sobre tinte 14%), barra de progreso pagado, CTA primario "Aplicar" del sheet, view-transition continuity del avatar |
| `--accent-cool` (teal) | Ícono Lucide de categoría (`disc`, `book-open`, `sparkles`, `gallery-thumbnails`, `package`, `shapes`) en cada row, ícono `info` de tooltips, swipe-action "Ver tienda"                                         |
| `--success`            | Chip "Pagado" / "100% pagado" (texto + ícono `check`), barra de progreso al 100%                                                                                                                                |
| `--warning`            | Chip "Atrasado N días" (texto + ícono `alert-triangle`), métrica de cuenta de atrasados en el filter rail                                                                                                       |
| `--destructive`        | Chip "Cancelado" (texto + ícono `x-circle`), ícono de error en estado error                                                                                                                                     |
| `--focus-ring`         | Outline 2px en `:focus-visible` de search, chips, rows, FAB                                                                                                                                                     |

**State layers** vía `color-mix(in oklch, var(--text-primary) 6%, transparent)` (light) y `8%` (dark) para hover de rows. Pressed `12%/14%`. La row "activa" del peek panel usa `color-mix(in oklch, var(--accent) 8%, transparent)` para diferenciarse del hover normal sin gritar.

**Confirmación a11y §8:** ningún chip de status es color-only. Todos llevan **texto** ("Activo", "Pagado", "Atrasado 3d", "Cancelado") y todos los chips no neutros llevan además **ícono Lucide** (`check` para success, `alert-triangle` para warning, `x-circle` para destructive). El chip "Activo" neutro lleva sólo texto en `--text-secondary` sobre `surface-elevated` con `border-strong`.

**Sin huecos detectados** en los tokens existentes — no se abre `_notes/atelier-gaps.md` esta vez.

## 5. Estados

- **Empty (primera vez, sin pedidos):** mascota `sleeping` 96px sobre fondo `color-mix(in oklch, var(--accent-cool) 24%, var(--surface))`. Copy h2 "Sin pedidos todavía. Suma una pre-orden y empezamos." en Display 22pt. CTA primario indigo "Nuevo pedido" debajo. **Sin filter bar visible** (no hay nada que filtrar). Si el usuario tampoco tiene tiendas, el CTA muta a "Necesitas una tienda primero. Te ayudamos." que navega a `/stores/new?returnTo=order-create`.
- **Empty filtered (filtros aplicados, 0 resultados):** **NO mascota** (no es momento celebratorio ni hueco real). Card centrada en el espacio del listado con ícono Lucide `search-x` 40px en `--text-secondary`. Copy "Nada con esos filtros. ¿Quitamos alguno?" en Body-L. Botón ghost "Limpiar filtros" debajo. **Filter bar/rail permanece visible** para que el usuario vea qué tiene aplicado y pueda quitar chips uno a uno.
- **Loading (primera carga):** skeleton de filas con la geometría exacta. Mobile: 6 rows visibles, cada una con bloque avatar 40px + barra título 50% ancho + barra meta 70% ancho + barra chip 60px. Desktop: 12 rows en modo denso. Shimmer vía `color-mix(in oklch, var(--text-primary) 4%, transparent)` con `--motion-base 280ms` linear infinite alternate. El filter rail también muestra skeleton de sus secciones colapsables. Sin texto "Cargando…", sólo geometría.
- **Error:** card centrada `surface-elevated`, padding 32px, `radius-xl`. Ícono `alert-circle` 48px en `--destructive` arriba. Title Display 19pt "Algo se rompió de este lado." Body 13pt en `--text-secondary` "Dale otra vez." Botón ghost "Reintentar" con ícono `refresh-cw`. Si el error es 401/403 redirigir al sign-in con `returnTo=/orders` (no es responsabilidad del state UI).
- **Filtering (mientras llega resultado tras aplicar filtro):** chip sutil arriba del listado "Filtrando…" en `--text-muted` con ícono `loader-2` rotando. Las rows existentes se mantienen visibles 200ms (suficiente para conexión rápida); pasados 200ms se reemplazan por skeletons. Cross-fade `--motion-fast`. Esto evita el "flash de skeleton" en redes rápidas.
- **Edit:** la edición full-form ocurre en `/[locale]/orders/[id]/edit` — fuera del scope de esta pantalla. **Pero** la lista soporta una mutación inline: **swipe-action "Anotar pago" en mobile**. Al hacer swipe izquierdo y soltar pasado el threshold (80px), aparece un sheet bottom inline (stop 0.4) con dos campos (`amount` numérico + `paymentDate` date picker default hoy) y CTA "Anotar". Server action `addPaymentAction` con optimistic update — la barra de progreso de la row salta al nuevo % en paralelo. Si falla, revert con toast "No se anotó. Probá de nuevo." En desktop no hay swipe; el usuario abre el peek o el detalle para registrar pago.

## 6. Motion y view transitions

- **Stagger en cards al cargar:** `20ms` entre rows (más rápido que el dashboard porque hay más densidad y un stagger lento se siente "wave"). Fade-in + `translate-y 4px` con `--motion-fast 150ms` y `--ease-emphasis`. Tope: máximo 12 rows con stagger; del 13 en adelante aparecen sin delay para no demorar la primera vista útil.
- **View transition canónica list→detail** (firma §4.8 obligatoria): la row clickeada morfa al header del detalle.
  - Cada row declara `view-transition-name: order-{humanId}` en su contenedor.
  - El detalle declara el mismo nombre en su header.
  - Avatar continuo (sin re-render): el círculo con tinte indigo 14% mantiene posición y color durante 280ms.
  - Código mono crece de 11px → 13px animando `font-size` en el mismo nodo (no fade entre dos copias).
  - Chip de status hace una micro-pausa de 40ms en el medio del path (~140ms del recorrido).
  - Easing `linear()` spring con overshoot 0.05.
  - Duración fija 280ms, no negociable por superficie.
  - Body de la row hace fade simple — sin morph.
- **Filter sheet (mobile):** enter desde abajo `--motion-base 280ms` con `--ease-out-expressive`. Exit `--motion-fast` con `--ease-emphasis`. Drag para cerrar respeta velocidad del gesto (Vaul behavior).
- **Filter rail (desktop) collapse/expand:** `--motion-fast` linear height + opacity en el contenido, chevron rota 180° con misma duración.
- **Swipe action mobile:** drag con resistance threshold 80px; tras release con éxito → la row colapsa con `--motion-fast` y aparece un toast "Pago anotado · Te quedan $X" en `--surface-elevated` con border `--success` 32%.
- **Skeleton → contenido:** cross-fade 150ms (no slide, no scale). Las rows reales aparecen con su stagger normal por encima del skeleton que hace fade-out simultáneo.
- **Sort dropdown:** popover con `--motion-fast` enter, `--ease-emphasis`. Re-orden de las rows usa View Transitions API con `view-transition-name: order-{humanId}` (mismo nombre que el morph al detalle) — es el mismo recurso, distintos consumidores. Las rows se reorganizan visualmente con el spring overshoot 0.05 característico de la firma; no se re-renderiza la fila, sólo cambia su posición.
- **`prefers-reduced-motion: reduce`:** todo se reduce a `fade 150ms`. Se deshabilita la view-transition list→detail (fallback a navegación normal sin morph). Se deshabilita el spring del sort. Stagger desactivado (todas las rows aparecen a la vez).

## 7. Atajos de teclado (desktop) y gestos (mobile)

**Desktop:**

- `J` / `K` — navegan rows abajo / arriba (focus-ring visible). Con peek abierto, también actualizan el contenido del peek.
- `Enter` — abre detalle de la row enfocada (con view-transition).
- `N` — abre `/orders/new` (mismo target que el FAB).
- `F` — enfoca la primera sección del filter rail (`Estado`).
- `/` — enfoca el search input.
- `Esc` — primero cierra peek panel si está abierto; segundo Esc limpia filtros activos; tercer Esc desenfoca.
- `⌘ K` (`Ctrl+K` en Windows/Linux) — abre command palette del shell con scope contextual a "Pedidos" (acciones: nuevo pedido, filtrar por tienda, exportar CSV futuro).
- `D` — toggle densa/cómoda.
- `P` — toggle peek panel.
- `1` / `2` / `3` — saltar a la página 1/2/3 cuando la paginación clásica está activa.

**Mobile:**

- **Pull-to-refresh** desde el top del listado — re-fetch silencioso, indicador de loader Lucide centrado en el tirón.
- **Swipe izquierda** sobre row → "Anotar pago" (background `--success` 24%, ícono `dollar-sign`). Threshold 80px. Release con éxito abre sheet inline.
- **Swipe derecha** sobre row → "Ver tienda" (background `--accent-cool` 24%, ícono `store`). Threshold 80px. Release navega a `/stores/[slug]` de la tienda de esa row.
- **Long-press** sobre row (~500ms) → menú contextual con haptic suave: "Abrir detalle", "Anotar pago", "Ver tienda", "Compartir link" (futuro).
- **Tap en chip de filtro activo** → quita ese filtro con micro-pulso del chip antes de desaparecer.
- **Tap en avatar tienda** → navega a la tienda (igual que swipe derecha, atajo más visible).

## 8. Mascota

- **Empty state inicial** (`sleeping` 96px en fondo `--accent-cool / 24%`, círculo `radius-xl`). Único lugar donde aparece en esta pantalla.
- **Empty filtered:** **no aparece**. Mostrar mascota acá sería celebratorio o decorativo y rompería §6 del decálogo (personalidad puntual, no sticker omnipresente). El usuario no descubrió nada nuevo, sólo aplicó filtros que no matchearon.
- **Bubble idle del shell** (esquina inferior derecha, 56×56, `idle`) sigue presente porque pertenece al `(app)/layout`, no a esta vista en particular. El FAB `+ Nuevo pedido` queda visualmente cerca pero **no se solapa** — el FAB es 56px en bottom-right inset 16px y la bubble se desplaza a inset 88px en mobile cuando ambos coexisten en `/orders` (regla del shell). En desktop la bubble vive sobre el footer, no compite con el FAB.
- **Walking strip:** **no aplica**. El paseo está reservado a `/dashboard` por §4.10 de directions. Esta pantalla es de trabajo concentrado.
- **Achievement celebrating:** **no aparece directo en la lista**. Si un swipe-action de "Anotar pago" cubre el 100% del pedido, el toast de confirmación es sobrio ("Pago anotado · 100% cubierto"); el celebrating se reserva al detalle del pedido (`/orders/[id]`) cuando el usuario completa el pago full desde ahí.

## 9. Voice samples

Strings reales en español alineados al glosario §7 de `principles.md`. Claves i18n en `src/i18n/locales/es/orders.json` (namespace nuevo si no existe).

| Clave i18n                          | Copy `es`                                              |
| ----------------------------------- | ------------------------------------------------------ |
| `orders.list.eyebrow`               | "Pedidos"                                              |
| `orders.list.subtitle`              | "Tus pedidos abiertos"                                 |
| `orders.list.empty.title`           | "Sin pedidos todavía. Suma una pre-orden y empezamos." |
| `orders.list.empty.cta`             | "Nuevo pedido"                                         |
| `orders.list.empty.gateNoStores`    | "Necesitas una tienda primero. Te ayudamos."           |
| `orders.list.filtered.empty`        | "Nada con esos filtros. ¿Quitamos alguno?"             |
| `orders.list.filtered.clearCta`     | "Limpiar filtros"                                      |
| `orders.list.error.title`           | "Algo se rompió de este lado."                         |
| `orders.list.error.body`            | "Dale otra vez."                                       |
| `orders.list.error.retry`           | "Reintentar"                                           |
| `orders.list.search.placeholder`    | "Buscar pedido…"                                       |
| `orders.list.sort.label`            | "Ordenar"                                              |
| `orders.list.sort.recent`           | "Más recientes"                                        |
| `orders.list.sort.upcoming`         | "Próximos a llegar"                                    |
| `orders.list.sort.overdue`          | "Más atrasados"                                        |
| `orders.list.density.compact`       | "Densa"                                                |
| `orders.list.density.comfortable`   | "Cómoda"                                               |
| `orders.list.swipe.recordPayment`   | "Anotar pago"                                          |
| `orders.list.swipe.viewStore`       | "Ver tienda"                                           |
| `orders.list.row.status.active`     | "Activo"                                               |
| `orders.list.row.status.paid`       | "Pagado"                                               |
| `orders.list.row.status.overdue`    | "Atrasado {days}d"                                     |
| `orders.list.row.status.cancelled`  | "Cancelado"                                            |
| `orders.list.row.expectedRange`     | "Llega entre {from} y {to}"                            |
| `orders.list.row.orderedOn`         | "Pedido {date}"                                        |
| `orders.list.pagination.more`       | "Cargando más…"                                        |
| `orders.list.pagination.end`        | "No hay más pedidos."                                  |
| `orders.list.fab.newOrder`          | "Nuevo pedido"                                         |
| `orders.list.toast.paymentRecorded` | "Pago anotado. Te quedan {remaining}."                 |
| `orders.list.toast.paymentFailed`   | "No se anotó. Probá de nuevo."                         |

Las claves de paginación, error y filtros que ya existan en `common.json` (ej. `common.actions.retry`, `common.filters.clear`) se reusan; las específicas del dominio "pedido" viven en `orders.json`.

## 10. Riesgos y supuestos

### Supuestos hechos

- **Densidad por defecto = densa** (36px row). Asumimos que el coleccionista típico tiene 10–80 pedidos abiertos y prefiere ver más a la vez. Validar en S3 con datos reales si la cómoda (44px) debería ser default.
- **Infinite scroll en mobile, paginación clásica en desktop.** Los hábitos son distintos: en mobile el scroll continuo es esperable; en desktop la paginación da control y previsibilidad para usuarios power.
- **Sort default = "Más recientes"** (orderDate desc). Validar contra "Próximos a llegar" — argumentablemente más útil para acción.
- **Filtros NO se persisten cross-session por defecto.** La URL es la fuente de verdad por sesión (sharable), pero no se guarda en perfil. Decisión revisable en §10 abajo.
- **El gate "Necesitas una tienda primero"** se muestra como variante del empty inicial cuando `userStores.count === 0`, no como modal bloqueante. El listado no tiene sentido sin tiendas.
- **El avatar fallback** usa la primera letra del nombre de la tienda en mayúsculas (no las dos primeras). La receta §4.4 habla de "letra inicial" en singular.
- **El código `PT-XXXXXX`** se renderiza con `font-variant-numeric: tabular-nums` en JetBrains Mono 11–13px según viewport (mobile: 11; desktop: 12; detalle: 13). La transición canónica anima el font-size del 11/12 al 13.
- **El chip "Atrasado N días"** se calcula client-side comparando `expectedDeliveryTo` con `now()`. Si `expectedDeliveryTo` es null se omite el cálculo (no atrasado por definición).

### Riesgos

- **Performance de view-transition con 30+ rows simultáneas.** Cada row declara su `view-transition-name` único; el browser snapshot del DOM completo puede pesar en mid-tier mobile. Mitigación: aplicar el `view-transition-name` sólo a la row con focus/hover y a la row clickeada (delegación dinámica). Validar en S3 con device class B (Pixel 6a equivalente).
- **Densidad densa vs tap target 44px en mobile.** El row visible es ~76px (línea 1 14px + línea 2 12px + padding 14px×2 + meta), supera 44px holgado. Pero si el sort/filter chips colapsan en una sola línea pueden quedar bajo 44px. Mitigación: padding vertical mínimo 12px en chips activos.
- **Scroll infinito vs paginación clásica para 1000+ pedidos.** Edge case improbable en MVP pero riesgo real para power users con años de historial. Mitigación futura: virtual list (`@tanstack/virtual`) en desktop cuando count > 100; en mobile evaluar segmentación por año en una vista "Histórico" separada.
- **Coordinación cross-screen del view-transition source.** El `view-transition-name: order-{humanId}` debe estar declarado en EXACTAMENTE el mismo formato en `/orders` (lista) y `/orders/[id]` (detalle). Si el detalle se diseña primero y elige otra convención, la firma se rompe sin error visible. **Decisión:** registrar en `principles.md §4.8` o en un ADR la convención `order-{humanId}` como contrato vinculante. La pantalla `order-detail` debe alinearse a esta convención (cross-screen concern).
- **Filter chips activos pueden saturar el header en mobile** si el usuario aplica 5+ filtros. Mitigación: scroll horizontal de los chips dentro de un row dedicado, con fade `--background → transparent` en los bordes.
- **Swipe-action conflict con el scroll de la lista.** El gesto de swipe horizontal puede interferir con el scroll vertical del listado en dispositivos sensibles. Mitigación: threshold horizontal 24px antes de activar el swipe, y bloqueo del scroll vertical sólo después de cruzar ese umbral.
- **Estado "Filtering…" en redes lentas (>2s).** Mantener rows viejas mientras carga puede confundir si los filtros aplicados ya no matchean lo visible. Mitigación: pasados 200ms reemplazar por skeleton; aceptamos el flash en redes rápidas.

### Decisiones pendientes para input humano antes de S3

1. **¿Sort default = "Más recientes" o "Próximos a llegar"?** Pregunta de research a usuarios reales en S2.
2. **¿Filtros guardables como "vistas"?** (ej. "Mis atrasados", "Próximas 2 semanas") — feature post-MVP pero conviene reservar la arquitectura.
3. **¿Densidad por defecto?** Densa o cómoda — depende de si el primer pedido típico es "explorar" o "auditar".
4. **¿Mostrar moneda base (`baseCurrency`) o moneda original del pedido en el listado?** Hoy mostramos la original; alternativa: convertir a base con tipo de cambio guardado y mostrar ambas en hover. Decisión depende del feature de presupuesto de §B.6.
5. **¿Bulk actions?** (seleccionar múltiples pedidos para cancelar / exportar). Fuera de MVP pero la columna 1 del desktop tiene espacio para checkbox si lo decidimos.
6. **¿Exportar CSV?** Sería un menú "···" en el header del listado. Post-MVP.
7. **¿Mantener "Activo" como chip neutro o subir a `--accent` indigo?** Hoy es neutro para no saturar; revisar con un mock real cuántos chips indigo aparecen simultáneamente.
