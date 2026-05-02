---
title: Dashboard
session: 02
status: lo-fi-wireframe + post-closure updates
last_updated: 2026-05-01
post_closure_adr: ../decisions/0001-s2-closure-decisions.md
---

# Dashboard

> **Addendum post-S2 (2026-05-01)** — Decisiones aplicadas tras research, ver [`ADR 0001`](../decisions/0001-s2-closure-decisions.md):
>
> - Decisión 8: los **4 micro-stats del hero cambian** de `Pagado / Próximo / Vencidos / Llegando` al set homogéneo en marco temporal:
>   1. **Este mes** — total pagado en el mes corriente · color `--accent` indigo
>   2. **Próximos 30 días** — suma de pagos esperados en ventana 30d · color `--accent-warm` coral
>   3. **Atrasado** _(condicional)_ — sólo si > 0; cuando = 0 el slot muta a "Tiendas activas" · color `--warning` ámbar
>   4. **Llega esta semana** — count de productos esperados en ventana 7d · color `--success` verde
> - Decisión 5: el view-transition desde row de pre-órdenes usa `order-{humanId}` (vinculante).
> - Decisión 11: el toggle de densidad de listas se refleja en `settings → preferences` con campo `preferredDensity` (S3+).
> - Decisión 14: el theme toggle del shell usa `localStorage["theme"]` con default `system`, sincronizado con settings.
> - Decisión 17: long-press en la bubble panda mobile / right-click desktop abre menú contextual ("Ocultar mascota", "Cambiar tema", "Configuración").
> - La validación humana 1 (test de 5 segundos) confirma o rechaza el nuevo set de micro-stats antes de S6.

## 1. Propósito y contrato funcional

El Dashboard es el hub privado del coleccionista: la primera pantalla que ve al entrar y la que debe responder en menos de un segundo a "¿qué tengo que pagar pronto, qué está por llegar y cómo va mi colección?". Es el único lugar de la app donde la mascota panda puede pasear y donde concentramos los KPIs cross-feature (orders, deliveries, payments) en un bento grid editorial.

Este wireframe implementa la fila #11 del inventario funcional (sección B.2): ver [`../functional-inventory.md`](../functional-inventory.md). La pantalla pasa de placeholder estático actual a un bento de KPIs + feed de actividad, conservando intacto el contrato de auth (`verified`) y el shell del layout `(app)` (sidebar + content header + max-w-6xl).

**Datos clave que muestra (en orden de jerarquía visual):**

- Total restante a pagar across todas las pre-órdenes activas (hero, display 56pt).
- 4 micro-stats: pagado, próximo (este mes), vencidos, llegando.
- Próximo pago concreto: tienda + monto + días restantes.
- 6 categorías con count y total acumulado.
- 3 entregas en tránsito (stub deliveries hoy, lista real cuando exista FRD).
- 5 pre-órdenes activas con código mono + tienda + total + chip status.
- Activity feed de 6–8 eventos (pago, entrega, creación) con timestamps relativos.

**Acciones disponibles desde el dashboard:**

- Navegar a `/orders`, `/deliveries`, `/stores`, `/settings` desde sidebar.
- Tap en row de pre-orden → view-transition canónica a `/orders/[id]`.
- Tap en row de categoría → `/orders?productType=X` (filtro pre-aplicado).
- FAB / botón "Nuevo pedido" abre `/orders/new`.
- "Anotar pago" inline en card de próximo pago — invoca `addPaymentAction` sin salir del dashboard.
- Toggle bubble panda (visible/oculta) desde settings.

**Permisos:** `verified` (sesión + email verificado o en grace 6 días). El verify-banner sticky del shell sigue activo cuando aplique.

## 2. Wireframe mobile (360px)

```
┌──────────────────────────────────────┐  ← header sticky
│ ☰  PandaTrack            🔔  👤      │   surface, border-bottom
├──────────────────────────────────────┤
│ [VerifyEmailBanner si grace]         │   warning soft
├──────────────────────────────────────┤
│                                      │
│  TUS PRE-ÓRDENES                     │  ← eyebrow mono uppercase
│  text-muted, mono 11/16              │     tracking +0.08em
│                                      │
│  $1.247,80                           │  ← display 40 → clamp 56
│  text-primary, display 700           │     tabular-nums
│  -0.03em tracking                    │
│                                      │
│  restante en 8 pre-órdenes activas   │  ← Body-L, text-secondary
│                                      │
│  ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░  62%       │  ← progress 4px height
│  gradient accent → accent-warm       │     surface-elevated track
│                                      │
│  ┌───────────┬───────────┐           │  ← micro-stats 2x2 grid
│  │ Pagado    │ Próximo   │           │     surface card, radius-lg
│  │ $812 ✦    │ $185 ✦    │           │     accent / accent-warm
│  ├───────────┼───────────┤           │
│  │ Vencidos  │ Llegando  │           │
│  │ $0 ✦      │ 2 ✦       │           │     warning / success
│  └───────────┴───────────┘           │
│                                      │
├══════════════════════════════════════┤  ← scroll fold #1 ─────────
│                                      │
│  PRÓXIMO PAGO                        │  ← eyebrow
│                                      │
│  ┌──────────────────────────────┐    │  ← card surface
│  │ ◎ Mercado MX                 │    │     avatar 40 (logo o letra
│  │   PT-002418       en 4 días  │    │     indigo-tinted)
│  │                              │    │
│  │   $185,00                    │    │  ← display 32, accent-warm
│  │                              │    │
│  │   [  Anotar pago  ]          │    │  ← CTA primario indigo
│  │                              │    │     min-height 44px
│  └──────────────────────────────┘    │
│                                      │
├══════════════════════════════════════┤  ← scroll fold #2 ─────────
│                                      │
│  ENTREGAS EN TRÁNSITO                │  ← eyebrow
│                                      │
│  ┌──────────────────────────────┐    │
│  │ ◎ AmiAmi  · 📦 figures       │    │  ← row 64px touch
│  │   PT-DEL-9301   ✓ en camino  │    │     ícono Lucide teal
│  ├──────────────────────────────┤    │     chip success soft
│  │ ◎ HMV     · 💿 vinyl         │    │
│  │   PT-DEL-9298   ✓ enviado    │    │
│  ├──────────────────────────────┤    │
│  │ ◎ TCG.cl  · 🃏 cards         │    │
│  │   PT-DEL-9272   ✓ enviado    │    │
│  └──────────────────────────────┘    │
│                                      │
│  PRE-ÓRDENES ACTIVAS                 │
│                                      │
│  ◎ Mercado MX     PT-002418   $300   │  ← rows 40px desktop /
│    figures · 60% pagado              │     doble línea mobile
│  ◎ AmiAmi         PT-002411   $480   │
│    figures · 100%  ●                 │     chip success-soft
│  ◎ Crunchyroll    PT-002405   $120   │
│    anime · 0%                        │
│                                      │
│  [ ver todas → ]                     │  ← link teal
│                                      │
├══════════════════════════════════════┤  ← scroll fold #3 ─────────
│                                      │
│  ACTIVIDAD                           │
│                                      │
│  ⊕ Anotaste $50 en PT-002418         │  ← círculo accent-warm
│    hace 2h                           │
│  ⊕ Llegó PT-002390                   │  ← círculo success
│    ayer                              │
│  ⊕ Creaste PT-002418                 │  ← círculo accent-cool
│    hace 3d                           │
│                                      │
└──────────────────────────────────────┘
                                  ╭────╮
                                  │ 🐼 │  ← bubble idle 56×56
                                  ╰────╯     fixed bottom-right
                                             halo accent-cool
┌──────────────────────────────────────┐
│  📊      📦       🛍       ⚙        │  ← tab bar inferior 4 dest
│ Inicio  Pedidos  Tiendas  Ajustes    │     surface, border-top
└──────────────────────────────────────┘     active = accent
        ╔═══════════╗
        ║    +      ║   ← FAB elevado, accent indigo, 56×56
        ╚═══════════╝     translate-y -28px sobre tab bar
```

**Notas mobile:**

- **Una decisión por viewport:** el hero monetario es la primera pantalla; todo lo demás se difiere por scroll.
- **Tab bar inferior con 4 destinos** (Inicio / Pedidos / Tiendas / Ajustes) heredado del decálogo §10. "Entregas" se accede desde dashboard rows o desde drawer.
- **FAB elevado** (+) abre `/orders/new` directamente; long-press abriría picker (orden / tienda / entrega) en S3.
- **Bubble panda idle 56×56** en esquina inferior derecha — el walking strip NO existe en mobile (regla estricta §4.10).
- **Tap targets ≥44px** en todas las rows y CTA. Las micro-stats 2×2 se calibran a 88×72.
- **Scroll natural**, sin parallax ni sticky-internal; sólo el header del shell es sticky.

## 3. Wireframe desktop (≥1024px)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ┌─────────┐  ┌──────────────────────────────────────────────────────────────┐  │
│ │ Sidebar │  │ Content Header: Dashboard            [⌘K]  [theme]  [user▾] │  │
│ │ 240px   │  └──────────────────────────────────────────────────────────────┘  │
│ │         │  ┌──────────────────────────────────────────────────────────────┐  │
│ │ 📊 Hub  │  │                  main · max-w-6xl · px-8 py-10               │  │
│ │ 📦 Ped. │  │  ┌─ row 1 ─────────────────────────────────────────────────┐ │  │
│ │ 🚚 Ent. │  │  │ HERO  cols 1-7                  │ NEXT PAY  cols 8-12   │ │  │
│ │ 🛍 Tnd. │  │  │ surface-elevated, radius-xl     │ surface, radius-xl    │ │  │
│ │ ⚙ Set. │  │  │                                 │                       │ │  │
│ │         │  │  │ TUS PRE-ÓRDENES                 │ PRÓXIMO PAGO          │ │  │
│ │ ─────   │  │  │                                 │                       │ │  │
│ │ 🐼 Pan  │  │  │ $1.247,80   <display 56pt>      │ ◎ Mercado MX          │ │  │
│ │  ON     │  │  │ restante en 8 pre-órdenes       │   PT-002418           │ │  │
│ │         │  │  │                                 │   en 4 días           │ │  │
│ │         │  │  │ ▓▓▓▓▓▓▓▓░░░░░░ 62%              │                       │ │  │
│ │         │  │  │ accent → accent-warm gradient   │ $185,00 (warm)        │ │  │
│ │         │  │  │                                 │                       │ │  │
│ │         │  │  │ ┌──┬──┬──┬──┐                   │ [  Anotar pago  ]     │ │  │
│ │         │  │  │ │812│185│ 0 │ 2 │                │                       │ │  │
│ │         │  │  │ │pag│prx│ven│llg│                │                       │ │  │
│ │         │  │  │ └──┴──┴──┴──┘                   │                       │ │  │
│ │         │  │  └─────────────────────────────────┴───────────────────────┘ │  │
│ │         │  │                                                              │  │
│ │         │  │  ┌─ row 2 ─────────────────────────────────────────────────┐ │  │
│ │         │  │  │ CATEGORÍAS  cols 1-6        │ ENTREGAS  cols 7-12       │ │  │
│ │         │  │  │ surface, radius-xl          │ surface, radius-xl        │ │  │
│ │         │  │  │ ⬡ figures · 12 · $620       │ ◎ AmiAmi   📦 ✓ camino   │ │  │
│ │         │  │  │ ⬡ vinyl   · 04 · $180       │ ◎ HMV      💿 ✓ enviado  │ │  │
│ │         │  │  │ ⬡ manga   · 08 · $94        │ ◎ TCG.cl   🃏 ✓ enviado  │ │  │
│ │         │  │  │ ⬡ anime   · 03 · $215       │                           │ │  │
│ │         │  │  │ ⬡ cards   · 07 · $98        │ [ ver todas → ]           │ │  │
│ │         │  │  │ ⬡ plush   · 02 · $40        │                           │ │  │
│ │         │  │  │ íconos Lucide teal          │                           │ │  │
│ │         │  │  └─────────────────────────────┴───────────────────────────┘ │  │
│ │         │  │                                                              │  │
│ │         │  │  ┌─ row 3 ─────────────────────────────────────────────────┐ │  │
│ │         │  │  │ PRE-ÓRDENES  cols 1-7        │ ACTIVIDAD  cols 8-12     │ │  │
│ │         │  │  │ surface, radius-xl           │ surface, radius-xl       │ │  │
│ │         │  │  │ rows 40px densas             │ timeline vertical        │ │  │
│ │         │  │  │ ◎ MercMX  PT-…418  $300 60%  │ ⊕ pago $50 hace 2h       │ │  │
│ │         │  │  │ ◎ AmiAmi  PT-…411  $480 100% │ ⊕ llegó PT-…390 ayer     │ │  │
│ │         │  │  │ ◎ Crunch  PT-…405  $120 0%   │ ⊕ creaste PT-…418 3d     │ │  │
│ │         │  │  │ ◎ HMV     PT-…398  $260 75%  │ ⊕ pago $80 4d            │ │  │
│ │         │  │  │ ◎ TCG.cl  PT-…392  $90 100%  │ ⊕ llegó PT-…388 5d       │ │  │
│ │         │  │  │ [ ver todas → ]              │ ⊕ pago $40 6d            │ │  │
│ │         │  │  └──────────────────────────────┴──────────────────────────┘ │  │
│ │         │  └──────────────────────────────────────────────────────────────┘  │
│ │         │                                                                    │
│ │         │  ┌──────────────────────────────────────────────────────────────┐  │
│ │         │  │  WALKING STRIP — 80px alto · sólo /dashboard · sólo desktop  │  │
│ │         │  │       🐼 →  →  →  →  →  →  →  →  →  →                        │  │
│ │         │  └──────────────────────────────────────────────────────────────┘  │
│ │         │                                                                    │
│ └─────────┘                                                                    │
│                                                                       ╭────╮   │
│                                                                       │ 🐼 │   │  ← bubble 56×56
│                                                                       ╰────╯   │     fixed
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Notas desktop:**

- **Bento grid 12 cols / gap-6** heredado de directions §4.12. Tres rows: hero+next-pay, categorías+entregas, pre-órdenes+activity.
- **Sidebar 240px sticky** del shell `(app)` con sus 5 destinos + toggle de mascota.
- **Walking strip 80px** entre las 3 rows del bento y el footer del documento. Sólo visible en `/dashboard`. La mascota entra desde derecha cada ≥8min con ≥30s idle del usuario.
- **Bubble panda 56×56** fixed esquina inferior derecha, persiste en todas las pantallas privadas.
- **3–4 colores visibles:** indigo (CTA + progress + avatar), coral (próximo pago + métrica + half del gradient), teal (íconos categoría + ícono creación feed), success (entregas / 100% pagado).

## 4. Tokens invocados

Todos los tokens vienen de Atelier (directions.md §4.4). No se inventa ninguno. Cuando un token tiene comportamiento distinto en light/dark, se anota.

| Token                       | Dónde se invoca en este wireframe                                                                                                                                                                                                                                                                                                                   | Light vs dark                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `--background`              | Lienzo del shell (atrás del bento).                                                                                                                                                                                                                                                                                                                 | Light `#F8F9FB` papel limpio; dark `#0C0E13` lienzo profundo.                   |
| `--surface`                 | Card de Próximo pago, Categorías, Entregas, Pre-órdenes, Activity feed.                                                                                                                                                                                                                                                                             | Light `#FFFFFF` con shadow-1; dark `#13151C` flat con border 1px.               |
| `--surface-elevated`        | Card hero (cols 1-7 row 1), avatar fallback background, tab bar mobile.                                                                                                                                                                                                                                                                             | Light shadow real elevation-2; dark sube +3% L + glow indigo 6% en card activa. |
| `--border`                  | Dividers entre rows de pre-órdenes, separator del activity feed, border de tab bar mobile.                                                                                                                                                                                                                                                          | Light `oklch(91% …)`; dark `rgba(255,255,255,0.07)`.                            |
| `--border-strong`           | Outline del avatar de tienda, outline de chips status, edge de Anotar pago en estado normal.                                                                                                                                                                                                                                                        | 4.5:1 inviolable en ambos modos.                                                |
| `--text-primary`            | Cifras hero ($1.247,80), nombre tienda, body de rows, label "Próximo pago" cuando es valor activo.                                                                                                                                                                                                                                                  | Light tinta casi negra; dark al 96% L (no 100%) para reducir vibración.         |
| `--text-secondary`          | Subtítulo "restante en 8 pre-órdenes activas", labels micro-stats, meta de feed, copy de chips, label "tienda · ícono"; ítem activo del sidebar lo eleva a primary.                                                                                                                                                                                 | 8.4:1 / 9.4:1 verificado.                                                       |
| `--text-muted`              | Eyebrow uppercase ("TUS PRE-ÓRDENES", "PRÓXIMO PAGO", "ACTIVIDAD"), código mono `PT-002418`, timestamps relativos ("hace 2h", "ayer", "en 4 días").                                                                                                                                                                                                 | 5.5:1 / 6.0:1 — cumple AA en texto pequeño 11–13px.                             |
| `--accent` (indigo)         | CTA primario "Anotar pago", progress bar primer half, avatar fallback (background tinte 14% + letra indigo + border tinte 28%), focus ring de cualquier control, ítem activo del sidebar, valor de micro-stat "Pagado".                                                                                                                             | Light `#5E5EE0`; dark `#9B9CF7` (~+8% L).                                       |
| `--accent-warm` (coral)     | Cifra "$185,00" del próximo pago, valor micro-stat "Próximo", second half del gradient del progress hero, ícono `circle-dollar-sign` del activity feed para eventos de pago.                                                                                                                                                                        | Light `#E07F5C`; dark `#F39E80`. Sólo donde hay función.                        |
| `--accent-cool` (teal)      | Color por defecto de íconos Lucide de categoría (`disc`, `book-open`, `sparkles`, etc.) en la card de Categorías y en row meta de pre-órdenes/entregas, ícono `plus-circle` del activity feed para eventos de creación, halo del bubble panda (`color-mix(--accent-cool 16%, --surface)`), background del empty state hero (`--accent-cool / 24%`). | Light `#3FAFB6`; dark `#67D0D7` con glow 12% del bubble en dark.                |
| `--success`                 | Chip "✓ en camino / enviado" en entregas (background `--success / 14%`, text + border `--success`), valor micro-stat "Llegando", chip "100% pagado" en pre-órdenes, ícono `package-check` del activity feed.                                                                                                                                        | Light `#3CA77B`; dark +8% L.                                                    |
| `--warning`                 | Valor micro-stat "Vencidos" cuando >0, chip "atrasado N días" si aparece, fondo soft del verify banner cuando aplica.                                                                                                                                                                                                                               | Light `#D89A3C`; dark `oklch(82% …)`.                                           |
| `--destructive`             | Reservado para empty/error states de un bento individual (ícono `alert-circle`) y para botón de delete inline si se ofrece (no en el happy path del dashboard).                                                                                                                                                                                     | Light `oklch(54% …)`; dark `oklch(70% …)`.                                      |
| `--focus-ring`              | Cualquier `:focus-visible` (CTA, rows tappable, avatar como link, micro-stat hover).                                                                                                                                                                                                                                                                | `outline: 2px solid --focus-ring; outline-offset: 2px`.                         |
| Paleta categórica `--cat-*` | **NO se renderiza en este dashboard.** Reservada para charts/filtros activos futuros. La categoría se identifica por ícono Lucide teal, nunca por color de fondo o dot.                                                                                                                                                                             | Existe en tokens, no aparece visible.                                           |

**Comportamiento elevation:**

- En **light**: cards con `elevation-1` (rows densas) y hero/next-pay con `elevation-2` (shadow real suave).
- En **dark**: sin shadow real; elevación por `--surface-elevated` (+3% L) + `border-strong` 1px + `inset 0 1px 0 rgba(255,255,255,0.04)`. Card activa (hover de bento) suma glow indigo 6% en borde superior.

**Tokens invocados que tienen receta `color-mix()` y no constante:**

- Avatar fallback background = `color-mix(in oklch, var(--accent) 14%, var(--surface-elevated))`.
- Avatar fallback border = `color-mix(in oklch, var(--accent) 28%, var(--border))`.
- State layer hover de rows = `color-mix(in oklch, var(--text-primary) 6%, transparent)` light, `8%` dark.
- Halo bubble panda = `color-mix(in oklch, var(--accent-cool) 16%, var(--surface))`.
- Background empty state hero = `color-mix(in oklch, var(--accent-cool) 24%, var(--surface))`.

**Detección de huecos:** ningún token nuevo es necesario para este wireframe. Todas las recetas se construyen con `color-mix()` sobre tokens primary o extra ya definidos. No se abrió entrada en `../_notes/atelier-gaps.md`.

## 5. Estados

### 5.1 Empty (primera vez sin datos)

El bento se condensa: las 6 cards desaparecen y queda **una sola hero card vacía** ocupando cols 1-12 desktop / full-width mobile. Dentro:

- Glyph mascota panda 96px en estado `sleeping` (3-frame loop 4s lento), centrada.
- Background del glyph: círculo `color-mix(in oklch, var(--accent-cool) 24%, var(--surface))` de 160×160.
- Title: `dashboard.empty.title` → "Sin pre-órdenes todavía. Suma una y empezamos." (Display 22pt, `--text-primary`).
- Helper: `dashboard.empty.helper` → "Anota tu primer pedido y empezamos a ordenar tu colección." (Body, `--text-secondary`).
- CTA primario indigo `--accent`: "Anotar primera pre-orden" (no "Crear orden" — voz directa del glosario §7).

**Nada de métricas falsas a $0,00.** La cifra hero no se muestra cuando no hay pre-órdenes — sería ruido y rompe el principio §9 "el dato como héroe" si el dato es vacío.

### 5.2 Loading

Skeletons que **respetan la geometría exacta** de cada bento card. Reglas:

- Shape de cada skeleton = shape exacto del contenido real (rectángulos de la altura del display, líneas del ancho del subtítulo, círculos del diámetro del avatar).
- Color del skeleton: `color-mix(in oklch, var(--text-primary) 4%, transparent)` light, `6%` dark — sin shimmer agresivo. Pulse muy sutil 1.6s opacidad 100→70→100.
- Mantenemos el chrome del bento (paddings, radius-xl, borders) para que el usuario no perciba "salto" cuando los datos llegan.
- Sin spinner, sin texto "Cargando…". Si la red tarda >3s, un único toast minimal "Buscando…" (de glosario §7 #5) en esquina inferior izquierda, siempre por encima del bubble panda.
- Validar legibilidad del skeleton en dark — el 6% no puede competir con `--surface` (debe verse), ni con texto si por alguna razón hay copy estática alrededor.

### 5.3 Error en bento individual (no global)

Una sola card del bento puede fallar (ej. el activity feed cae mientras el hero responde). En ese caso:

- La card específica muestra ícono Lucide `alert-circle` 24px en `--destructive`, centrado.
- Copy: `dashboard.bento.error` → "Algo se rompió de este lado. Dale otra vez." (del glosario §7 #3, Body, `--text-secondary`).
- Botón ghost (no primario, no destructivo): `dashboard.bento.retry` → "Reintentar" — invoca refetch sólo de esa card.
- **El resto del bento sigue funcionando.** Si falla el activity feed, el hero, próximo pago, categorías, entregas y pre-órdenes siguen con sus datos.
- Si falla el hero (raíz de los KPIs), la card hero muestra el error pero el bento debajo sigue mostrando lo que pudo cargar.

Sentry captura el error sin duplicar ruido; el bubble panda no cambia de estado (no es un evento que merezca peeking ni celebrating).

### 5.4 Success post-acción (anotar pago desde dashboard)

Cuando el usuario presiona "Anotar pago" en la card de próximo pago y el server confirma:

- **Optimistic update inmediato** (ver `optimistic-client-updates.mdc`): la cifra del hero baja al instante, la cifra de la card próximo pago se actualiza al siguiente pago programado, micro-stats se recalculan.
- **Toast Sonner-style** bottom-right (mobile bottom-center) con:
  - Mascota panda 64px estado `celebrating` (one-shot 1.0s, 6–8 frames).
  - Copy: `dashboard.toast.paymentRecorded` → "Listo. Te quedan $X." (glosario §7 #2).
  - Halo `--accent-warm / 14%` radial detrás de la mascota.
  - Hold 800ms + fade 200ms = 1s total visible.
- **Si fue pago full** (cierra una pre-orden): copy escala a `dashboard.achievement.paymentFull` → "¡Cubierto! Una pre-orden menos. ✨" + easing `--ease-bounce`.
- **Si server rechaza** después del optimistic: revert con toast de error declarativo "El pago no se anotó. Probemos otra vez." y mantener el monto tipeado en el form inline.

### 5.5 Edit (inline)

No hay edición inline de KPIs (los KPIs son derivados, no editables). **Sí hay inline edit de "Anotar pago" rápido** desde la card de próximo pago, sin salir del dashboard:

- Tap en CTA "Anotar pago" → la card se transforma in-place en form inline (no modal):
  - Input numeric con tabular-nums, prefilled con el monto restante (`$185,00`).
  - Sub-helper: "máx $185,00" en `--text-muted`.
  - Date picker compacto, default = hoy (la regla `paymentDate ≤ now` del schema).
  - 2 botones: "Cancelar" ghost + "Confirmar" indigo `--accent`.
- **Validación post-blur** (regla §3 del decálogo): el input no se queja mientras escribes; al blur, si `amount > remaining` muestra inline "Máximo $185,00" en `--destructive` debajo del input, sin tachar nada y manteniendo el contenido.
- "Confirmar" dispara `addPaymentAction` con optimistic update (5.4).
- "Cancelar" colapsa el form de vuelta a card normal con motion `--motion-fast`.

## 6. Motion y view transitions

Todas las animaciones usan los 6 tokens de Atelier §4.8. Cualquier valor distinto rompe sistema.

1. **Stagger de bento al cargar** (post-skeleton):
   - 6 cards entran escalonadas con 40ms de delay entre cada una.
   - Cada card: opacity 0→1 + translate-y 4px→0.
   - Duración por card: `--motion-base` (280ms).
   - Easing: `--ease-out-expressive` (linear() spring suave).
   - Total: ~520ms para que todo el bento se asiente.

2. **Hover micro-stats en hero** (sólo desktop):
   - El bloque (label + valor) sube `translate-y -1px`.
   - Su valor cambia color de `--text-primary` al color de status correspondiente (`--accent` para pagado, `--accent-warm` para próximo, `--warning` para vencidos, `--success` para llegando).
   - Duración: `--motion-fast` (150ms).
   - Easing: `--ease-emphasis` (`cubic-bezier(0.2, 0, 0, 1)`).
   - **Sin scale** (decisión §4.12 — el lift -1px ya da feedback suficiente).

3. **View transition canónica list→detail** (regla §4.8):
   - Aplica cuando el usuario tap/click en una row de "Pre-órdenes activas" del dashboard hacia `/orders/[id]`.
   - `view-transition-name: order-{humanId}` en avatar, código mono y chip status de la row (misma convención que `orders-list` y `order-detail`).
   - **Avatar continuo** con su tinte indigo, no parpadea.
   - **Código mono** crece de 11px a 13px sin re-render.
   - **Chip status** hace micro-pausa de 40ms entre los ms 120 y 160 del path — el "tic" memorable.
   - Duración fija: 280ms.
   - Easing: `linear(0, 0.18, 0.5, 0.78, 0.95, 1.02, 1)` — spring overshoot 0.05.
   - **El body de la row hace fade simple**, sólo los 3 elementos identitarios tienen continuidad explícita.

4. **Walking de la mascota** (sólo desktop, sólo `/dashboard`):
   - Frecuencia: cada 8 minutos mínimo.
   - Trigger: ≥30s sin interacción del usuario (mouse, teclado, scroll).
   - Path: entra desde el borde derecho del walking strip, cruza hacia la izquierda en ~6s a velocidad constante (~50px/s).
   - 6–8 frames, loop 0.6s.
   - **Mobile NO pasea, en serio nunca** — la mascota se queda en bubble idle.
   - Respeta `prefers-reduced-motion: reduce` → no pasea.

5. **Achievement pop post-pago full**:
   - Toast Sonner-style desde el borde inferior con `--ease-bounce` (linear() spring bounce 0.18).
   - Mascota panda 64px estado `celebrating` (1s one-shot).
   - Decoration `--accent-warm / 14%` halo radial.
   - Hold 800ms + fade 200ms.
   - El bento de fondo no se anima — la celebración es del toast, no del layout.

6. **`prefers-reduced-motion: reduce`** (regla §4.8):
   - Stagger de bento → fade simple 150ms sin translate-y.
   - Hover micro-stats → cambio de color sin lift.
   - View transition → cross-fade 150ms sin spring ni overshoot.
   - Walking de la mascota → desactivado (queda en idle).
   - Achievement pop → fade-in/fade-out 150ms sin bounce.

## 7. Atajos de teclado (desktop) y gestos (mobile)

### Desktop

- **`N`** abre quick-create de orden (`/orders/new`). Atajo único, sin necesidad de focus en input.
- **`⌘K`** abre command palette aspiracional (S3+, no S2). Reservado en S2 sólo como tooltip "próximamente" en el placeholder visual del header.
- **`J / K`** navegan entre bento cards (foco visible con `--focus-ring`); `Enter` activa la card focused (entra al detalle si la card es lista, ejecuta el CTA si es próximo pago).
- **`G + D`** vuelve al dashboard desde cualquier sección (consistente con shell `(app)`).
- **`Esc`** cancela inline edit del form de "Anotar pago" si está abierto.
- **Tab** sigue el flujo natural: header → bento (top-left primero, row-major) → walking strip → bubble panda toggle (settings reachable via shortcut).

### Mobile

- **Pull-to-refresh real** sobre el contenedor del bento — recarga datos del hero, próximo pago, categorías, entregas, pre-órdenes y activity feed en paralelo.
- **Swipe en row de pre-órdenes**:
  - Izquierda → "Anotar pago" rápido (mismo flow que el inline edit del próximo pago, pre-rellenado con el remaining de esa pre-orden).
  - Derecha → "Ver tienda" (navega a `/stores/[slug]` de la tienda asociada).
- **Long-press en row de pre-órdenes** abre acciones secundarias: "Editar pedido", "Ver detalle", "Cancelar pedido" (con confirm del schema).
- **Tap en bubble panda** alterna entre estado idle y un mini-easter egg (peeking) — el comportamiento conversacional vive en el FRD aparte.
- **Tab bar inferior** funciona con tap simple; el destino activo recibe `--accent` y haptic feedback iOS.

## 8. Mascota

La mascota cumple §4.10 sin desviaciones. Resumen aplicado a esta pantalla:

- **Bubble idle 56×56** en esquina inferior derecha, fixed, siempre visible (salvo opt-out en `/settings`). Estado: `idle` (4–6 frames, 2.4s loop). Background = `color-mix(in oklch, var(--accent-cool) 16%, var(--surface))`. En dark, halo glow 12% del mismo teal para rim light.
- **Walking strip** horizontal de 80px sobre el footer del dashboard, **sólo desktop, sólo `/dashboard`**. Reglas estrictas: ≥8min cooldown entre paseos, ≥30s idle del usuario, ~6s end-to-end (~50px/s constante), entra por la derecha y sale por la izquierda, sin pausas. Estado: `walking` (6–8 frames, 0.6s loop).
- **Empty state hero**: glyph 96px estado `sleeping` (3 frames, 4s loop muy lento) sobre background circular `--accent-cool / 24%`.
- **Achievement** post-pago full: 64px estado `celebrating` (6–8 frames, 1.0s one-shot) en el toast Sonner. Sólo en eventos explícitos (pago full que cierra una pre-orden, hito de colección si se trackea en futuro). **No** se anima en cada pago parcial — eso saturaría.
- **En mobile**: bubble idle sí, walking nunca (regla inviolable §4.10).
- **`prefers-reduced-motion`**: la mascota queda en idle siempre, no pasea, no celebra animado.
- **Opt-out**: toggle "Mostrar la mascota" en `/settings` (default ON, OFF oculta también la bubble idle). El sidebar muestra un mini-status "🐼 Pan ON / OFF" como recordatorio visual; el nombre real se decide antes de S6.

**Lo que la mascota NO hace en este dashboard:**

- No habla en bubbles permanentes (eso es FRD aparte).
- No reacciona a hover de cada card.
- No camina más de una vez cada 8 minutos.
- No interrumpe el inline edit de "Anotar pago".
- No aparece celebrando si el pago fue parcial.

## 9. Voice samples

5 strings reales en español, alineados al glosario `principles.md` §7. Se documentan junto a la clave i18n sugerida bajo `src/i18n/locales/es/dashboard.json` (con un par cayendo en `common.json` por reuso cross-pantalla).

| Clave i18n                          | String `es`                                      | Surface                                                                                                      | Pareo del glosario                                              |
| ----------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `dashboard.hero.eyebrow`            | `TUS PRE-ÓRDENES`                                | Eyebrow del hero monetario en el dashboard.                                                                  | Eyebrow neutro, mono uppercase, `--text-muted`.                 |
| `dashboard.hero.subtitle`           | `restante en {count} pre-órdenes activas`        | Subtítulo Body-L bajo la cifra del hero (`{count}` es 8 en el wireframe).                                    | Tono activo, frase corta, `tú` implícito.                       |
| `dashboard.nextPayment.label`       | `Próximo pago`                                   | Eyebrow de la card de próximo pago.                                                                          | Title funcional, no metafórico.                                 |
| `common.cta.recordPayment`          | `Anotar pago`                                    | CTA primario de la card próximo pago + del inline edit. Compartida con `/orders/[id]` y swipe action mobile. | Glosario §7 #8: "Registrar pago en el sistema" → "Anotar pago". |
| `dashboard.empty.title`             | `Sin pre-órdenes todavía. Suma una y empezamos.` | Title del empty state hero cuando no hay pre-órdenes.                                                        | Glosario §7 #1: empty pre-órdenes.                              |
| `dashboard.toast.paymentRecorded`   | `Listo. Te quedan ${remaining}.`                 | Toast post-anotar pago parcial.                                                                              | Glosario §7 #2: pago registrado.                                |
| `dashboard.achievement.paymentFull` | `¡Cubierto! Una pre-orden menos. ✨`             | Toast achievement cuando un pago cierra una pre-orden completa.                                              | Sweet spot Atelier — un emoji puntual y funcional, máx 1.       |
| `dashboard.bento.error`             | `Algo se rompió de este lado. Dale otra vez.`    | Error de bento individual.                                                                                   | Glosario §7 #3: error 500 honesto.                              |
| `dashboard.bento.retry`             | `Reintentar`                                     | Botón ghost del error de bento.                                                                              | Brevedad sobre ingenio.                                         |

Las claves usan `camelCase` y namespace por superficie (`dashboard.*`) con excepción del CTA reutilizable (`common.cta.recordPayment`). En `en` el copywriter reinterpreta, no traduce ("Listo. Te quedan $X" → "Done. $X to go").

## 10. Riesgos y supuestos

### Supuestos hechos para cerrar el wireframe

1. **El dashboard hoy es placeholder**, sin FRD funcional aprobado. Asumimos que la implementación real recibirá los datos de un FRD futuro de KPIs (`docs/product/frds/dashboard-kpis.md` cuando se cree). Los 4 micro-stats elegidos (pagado / próximo / vencidos / llegando) son mi propuesta con base en el inventario funcional fila #11; su definición exacta requiere validación de producto en S3.
2. **Las "entregas en tránsito"** se muestran sólo si existen — hoy `/deliveries` y su detalle son stubs (filas #17 y #19 del inventario). Asumo que el dashboard puede leer `deliveries` con productos asociados y mostrarlas; si el query no existe, esa card cae al estado de error individual hasta que el query esté.
3. **El walking strip 80px** no compite con ningún otro contenido del dashboard — asumo que cabe como sub-row entre las 3 rows del bento y el footer, sin empujar el viewport. Si el bento se hace muy alto en futuras iteraciones, el walking strip podría requerir reposicionarse.
4. **El opt-out de la mascota** vive en `/settings` (no añadimos sub-flow en este wireframe), agregando un campo nuevo a `preferences` que aún no existe en el schema (`showMascot: bool`, default true). Queda como dependencia de schema para S3.
5. **El inline edit de "Anotar pago"** consume el server action `addPaymentAction` existente (sección C del inventario), respetando el shape de respuesta y la validación `amount ≤ remaining` ya implementada — no requiere cambios de backend.
6. **El comando `⌘K`** se muestra como tooltip "próximamente" en S2; su implementación real es S3+.

### Riesgos de implementación

1. **El walking de la mascota** requiere coordinación entre cooldown (server-side o local timestamp) y detector de idle (`requestIdleCallback` + listener de mouse/keyboard/scroll). Si se hace 100% client-side por sesión, un usuario con múltiples tabs abiertos podría ver paseos solapados en cada tab; recomendación: cooldown timestamp persistido en `localStorage` con clave `mascot:lastWalkAt`.
2. **El bento grid 12 cols** requiere CSS Grid moderno (`grid-template-columns: repeat(12, minmax(0, 1fr))` + `gap-6`) — funciona en todos los navegadores modernos pero exige disciplina al añadir cards en el futuro (cualquier nueva card debe declarar sus `col-span-X` y `row-start-Y`).
3. **El stagger de bento al cargar** puede sentirse lento si el server tarda en responder y los skeletons aparecen 600ms+ — calibrar para que el stagger arranque sólo si los datos están listos antes de mostrar el contenido real. Si el data llega tarde, cross-fade simple 150ms sin stagger.
4. **El sprite sheet de la mascota** debe respetar el budget de 80KB total para los 5 estados — si no se cumple, simplificar `walking` a 4 frames antes de tocar `idle` o `celebrating`.
5. **Tabular nums obligatorio en cifras** (regla §4.5 + §9 decálogo) — verificar que `font-variant-numeric: tabular-nums` esté aplicado a hero, próximo pago, micro-stats, totales por categoría y montos del feed. Sin esto, la cifra hace jitter al actualizar optimistic.
6. **View transition canónica** sólo funciona en navegadores con View Transitions API (Chrome 111+, Safari 18+, Firefox detrás de flag). En navegadores sin soporte, fallback es navegación instantánea — no se rompe nada, pero la firma se pierde.

### Decisiones que requieren input humano antes de S3

1. **Confirmar los 4 micro-stats** del hero — ¿pagado / próximo / vencidos / llegando son los definitivos, o queremos mostrar también "este mes" o "promedio mensual"? Decisión con producto.
2. **Tab bar inferior vs sidebar drawer en mobile** — el wireframe asume tab bar de 4 destinos (decálogo §10). Si producto prefiere sidebar drawer, hay que rehacer el footer mobile. Recomendación: validar con tests reales de S2.
3. **Categorías en mobile** — directions §4.12 dice "lista vertical compacta (no scroll-x)" y este wireframe lo respeta. Confirmar que 6 filas de 36px no se sienten apretadas en 360px.
4. **El nombre de la mascota** (Bento, Ito, Boro, Mochi, Tomo, Kuma) — no bloquea S2 pero el copy del achievement lo necesitará en S6.
5. **Si conservar `showMascot` toggle** o asumir always-on en MVP — afecta scope de `/settings`.
6. **Cross-screen consistency**: el avatar de tienda (logo o letra inicial sobre tinte indigo) debe verse exactamente igual en `dashboard.md`, `orders-list.md`, `order-detail.md`, `delivery-create.md` y en el listado público de `/stores`. Definir el componente reusable `<StoreAvatar>` en S3 con sizes 24/32/40/56 y validar que la receta del color-mix se replica sin drift.
