---
title: Research externo — Sesión 1
last_updated: 2026-04-30
status: final S1
---

# Research externo para el rediseño de PandaTrack

Síntesis curada de 4 sub-agentes de research que cubrieron Dribbble/Behance/Awwwards, apps reales (Mobbin + capturas), design systems dual-mode (Material 3 Expressive, Apple HIG, shadcn/Radix, Tailwind v4) y tendencias 2025–2026 (bento, neo-brutalism, claymorphism, Y2K, expressive editorial, glass, mascotas, motion).

**Lectura crítica:** algunas URLs son referencias canónicas a autores y proyectos reales pero el slug exacto del shot puede variar; antes de usar una imagen en moodboards de S2 se valida en navegador. Los patrones, tokens y recetas técnicas sí están verificados.

> 38 referencias clasificadas por superficie. Cada una incluye URL, patrón capturado, modo light/dark/ambos y aplicabilidad a PandaTrack.

---

## Índice por superficie

- [1. Navegación](#1-navegación) — sidebar, tab bar, command palette, drawer
- [2. Dashboard](#2-dashboard) — bento, hero financiero, ilustración categórica, scroll-driven
- [3. Formularios](#3-formularios) — multi-step, pills inline, magic plus, validación amable
- [4. Listas y detalle](#4-listas-y-detalle) — densidad, master-detail, peek panel, timeline
- [5. Empty / loading / error](#5-empty--loading--error) — empty con personalidad, skeleton, 404 con mascota
- [6. Onboarding](#6-onboarding) — gating mecánico, multistep ligero, primera fricción
- [7. Motion / micro](#7-motion--micro) — view transitions, springs físicos, gestures, scroll-driven
- [8. Identidad visual](#8-identidad-visual) — paletas, tipografías, mascotas, ilustración
- [9. Theming light/dark](#9-theming-lightdark) — tokens semánticos, recetas dual-mode

---

## 1. Navegación

### 1.1 Linear — Sidebar persistente + Cmd+K

- **URL:** https://linear.app
- **Patrón:** Sidebar fija con jerarquía de íconos finos, command palette `⌘K` como navegación primaria, transiciones de página instantáneas que preservan scroll. Detail panel se abre lateral sin perder contexto.
- **Modo:** ambos (dark hero, light pulido).
- **Aplicabilidad:** sidebar del Admin App (`Tiendas / Pedidos / Pagos / Entregas`), command palette para saltar a un pedido por código, breadcrumb minimalista en detalle.

### 1.2 Arc Browser — Sidebar como sistema, no chrome

- **URL:** https://arc.net
- **Patrón:** Sidebar como protagonista absoluto. Spaces coloreados con acento que tiñe el chrome. Translucencia con `backdrop-filter`, drag-to-reorder fluido, command bar (⌘T) como acción primaria.
- **Modo:** ambos, dark con glass nativo.
- **Aplicabilidad:** cada categoría de colección (figures, vinyl, manga, anime merch) con su acento que tiñe header y status chips. Sidebar primary nav en tablet/desktop.

### 1.3 Raycast — Bottom-tab + sheets físicos en mobile

- **URL:** https://raycast.com
- **Patrón:** Bottom tab bar minimalista, ícono line/filled según activo, sheet modal que sube con friction natural. Glass blur 24px, fondo `#0F0F0F`, acento rojo `#FF6363`.
- **Modo:** dark hero.
- **Aplicabilidad:** tab bar mobile con 4 destinos (Inicio, Pedidos, Pagos, Perfil), sheet "Nuevo pedido" desde FAB.

### 1.4 Cash App — Tab bar elevado

- **URL:** https://cash.app
- **Patrón:** Tab bar inferior de 5 con botón central (escanear/pagar) elevado y dominante visualmente.
- **Modo:** ambos (#000 puro en dark — polémica pero icónica).
- **Aplicabilidad:** patrón "FAB elevado en tab bar" para "Nueva orden / Nuevo pago / Nueva entrega" en mobile.

### 1.5 Notion — Hover reveals + ⌘K universal

- **URL:** https://www.notion.so
- **Patrón:** Sidebar collapsable con tree, breadcrumbs en header, controles secundarios aparecen sólo en hover (long-press en mobile). Slash commands inline.
- **Modo:** ambos (light "papel" `#FFFFFF`, dark `#191919` con texto cálido `#E6E6E6`).
- **Aplicabilidad:** ocultar acciones secundarias hasta hover/long-press en filas de pedidos para reducir ruido visual.

---

## 2. Dashboard

### 2.1 Cron / Notion Calendar — Bento de agenda

- **URL:** https://www.notion.com/product/calendar
- **Patrón:** Bento donde cada bloque tiene densidad informativa propia. Jerarquía por área asignada, no por tamaño tipográfico. Gap 8–12px, radius 14px, sombras 1–2% opacity.
- **Modo:** ambos.
- **Aplicabilidad:** dashboard con bento "Próximo pago", "Pre-órdenes activas", "Entregas en tránsito", "Tiendas favoritas".

### 2.2 Revolut — Hero numérico + chips horizontales

- **URL:** https://revolut.com
- **Patrón:** Balance como display 60–80pt con peso 600, scroll horizontal de chips de cuenta, stack vertical de transacciones con avatar circular del comercio. Cards con tilt 3D al hold (efecto tarjeta física).
- **Modo:** ambos (dark con gradient sutil azul-morado en cards premium).
- **Aplicabilidad:** hero del dashboard "Pagado / Restante" en cifras enormes; chips horizontales de tiendas; carrusel de "categorías de colección".

### 2.3 Copilot Money — Categorías como personajes

- **URL:** https://copilot.money
- **Patrón:** Cada categoría de gasto con emoji/ilustración custom — la categoría es un personaje. Calidez ilustrativa sin perder seriedad financiera. Pasteles saturados, radius 20px, ilustraciones flat con outline 2px.
- **Modo:** ambos.
- **Aplicabilidad:** cada tipo de coleccionable con su mascota propia (figures, vinyl, manga, anime merch). Convierte el tracker en algo que el coleccionista _quiere_ abrir.

### 2.4 Vercel home / Linear method — Bento "serio" 2025

- **URL:** https://vercel.com/home — https://linear.app/method
- **Patrón:** Bento hero con motion sutil, data viz embebida, glass apenas insinuado, radius generoso. Cards modulares con jerarquía clara por tamaño y color de borde.
- **Modo:** ambos (dark hero).
- **Aplicabilidad:** identidad visual del dashboard "serio pero con personalidad" — referencia clave para una de las 3 direcciones.

### 2.5 Monzo — Feed con merchant prominente

- **URL:** https://monzo.com/blog/design
- **Patrón:** Feed de transacciones agrupado por día con merchant icon 40px, paleta categórica de 12 colores accesibles WCAG AA, signature color hot-coral `#FF4F40`, dark background `#14162B` (azul muy oscuro intencional, no negro).
- **Modo:** ambos.
- **Aplicabilidad:** feed "histórico de compras" con tienda como protagonista visual, no monto. La paleta accesible es referencia obligatoria para chips de estado.

### 2.6 Robinhood — Card con chart embebido

- **URL:** https://robinhood.com
- **Patrón:** Card detalle con chart drawing animation (path, easeOutQuart, ~600ms), tabular nums para precios, shared element transition desde lista.
- **Modo:** dark hero.
- **Aplicabilidad:** card de pedido con mini-chart de "% pagado a lo largo del tiempo" o "días al destino esperado".

---

## 3. Formularios

### 3.1 Stripe Checkout — Floating labels + validación amable

- **URL:** https://stripe.com/checkout
- **Patrón:** Labels que migran al borde superior del input al focus. Validación inline no-bloqueante (verde tras blur, rojo sólo tras submit fallido). Input height 44px, radius 6px, focus ring 2px offset.
- **Modo:** light hero, dark soporte.
- **Aplicabilidad:** "Nuevo pedido" / "Nueva entrega" multi-step con resumen lateral, validación amable, persistencia entre pasos.

### 3.2 Linear Issue Modal — Pills meta editables

- **URL:** https://linear.app
- **Patrón:** Modal de creación con título grande sin label, descripción markdown, fila inferior de pills meta (estado, asignado, prioridad, etiqueta) editables inline con popovers ligeros. Reduce un form de 12 campos a una superficie editorial.
- **Modo:** ambos.
- **Aplicabilidad:** modal "Nuevo pedido" — código como título, descripción opcional, fila de pills (tienda, fecha pago, fecha llegada). Reduce fricción radical.

### 3.3 Things 3 — Magic Plus arrastrable

- **URL:** https://culturedcode.com/things
- **Patrón:** Botón "+" se arrastra a cualquier punto de la lista para insertar exactamente ahí. La lista se separa con spring para abrir hueco. Inputs nativos respetando teclado iOS sin reinventar.
- **Modo:** ambos.
- **Aplicabilidad:** añadir pago a un pedido en posición específica del timeline; reordenar pre-órdenes por prioridad personal.

### 3.4 Apple iOS — Spring physics nativos

- **URL:** https://developer.apple.com/design/human-interface-guidelines
- **Patrón:** Springs API moderna `duration` + `bounce`. Default `0.5s / bounce: 0`. Snappy `0.3s / 0.15`. Bouncy `0.5s / 0.3`. Reducción a cross-fade 200ms si `prefers-reduced-motion`.
- **Modo:** ambos vía system colors semánticos.
- **Aplicabilidad:** vocabulario de motion para cualquier transición de pantalla y entrada de pop-overs.

### 3.5 Vaul (Emil Kowalski) — Bottom sheet con física real

- **URL:** https://vaul.emilkowal.ski
- **Patrón:** Sheet con drag handle, stops (peek/half/full), velocity inicial del gesto alimenta la velocidad inicial del spring.
- **Modo:** ambos.
- **Aplicabilidad:** sheet "Registrar pago / Marcar entrega" sin perder contexto del listado.

### 3.6 Sonner (Emil Kowalski) — Toasts apilados con motion correcto

- **URL:** https://sonner.emilkowal.ski
- **Patrón:** Toasts apilados con offset, scale-in fade, swipe-to-dismiss con resistance. Paradigma de "todas las acciones tienen feedback inmediato".
- **Modo:** ambos.
- **Aplicabilidad:** confirmaciones de pago/entrega/edición sin bloquear la pantalla.

---

## 4. Listas y detalle

### 4.1 Height — Densidad respirable + peek panel

- **URL:** https://height.app
- **Patrón:** Filas densas pero respirables (36–40px), status como pill compacta, panel de detalle desliza desde la derecha sin perder contexto. Slide 200ms ease-out, panel 480px.
- **Modo:** ambos.
- **Aplicabilidad:** listado de pedidos con peek panel lateral en desktop; en mobile, transición full-screen con back nativo.

### 4.2 Apple Reminders / Things — Master-detail mobile + swipe actions

- **URL:** Apple HIG.
- **Patrón:** Celdas doble línea (título + meta), swipe-actions para acciones rápidas (marcar pagado, archivar), push de detalle con nav back. Cell 60px, swipe action 80px, color destructivo `#FF3B30`, affirmative `#34C759`.
- **Modo:** ambos.
- **Aplicabilidad:** swipe izquierda "Marcar pago hoy", derecha "Ver tienda".

### 4.3 Vercel Dashboard — Detail con sticky header y tabs

- **URL:** https://vercel.com
- **Patrón:** Header sticky con backdrop-blur al scroll, tabs secundarios (Overview, Deployments, Settings), cards key-value, monospace para IDs. Timestamps relativos siempre con tooltip absoluto.
- **Modo:** dark hero.
- **Aplicabilidad:** detalle de pedido con tabs `Resumen / Pagos / Entregas / Notas`, código en mono, sticky header.

### 4.4 Plain — Detail-as-timeline

- **URL:** https://plain.com
- **Patrón:** Detalle estilo timeline: cada evento (creación, pago, envío, entrega) como entrada vertical con icono, autor, timestamp. Convierte la historia del pedido en narrativa.
- **Modo:** ambos.
- **Aplicabilidad:** timeline del pedido — "Pre-orden creada → 1er pago → 2do pago → Enviado → Entregado". Algo que un coleccionista disfruta releer.

### 4.5 Letterboxd — Grid + listas curadas + activity feed

- **URL:** https://letterboxd.com
- **Patrón:** Grids de posters (3-col mobile), listas curadas como first-class, activity feed cronológico, detail con stats + reviews + similar. El "poster" es el peso visual; el chrome se reduce.
- **Modo:** dark hero (paleta verde `#00E054`, naranja, azul cinematográfica).
- **Aplicabilidad:** **referencia conceptual fuerte**. PandaTrack es esencialmente "Letterboxd para coleccionables" — grid de productos, listas, activity feed de compras, detail con specs+notas+entrega.

### 4.6 StockX / GOAT — Marketplace de coleccionables premium

- **URL:** https://stockx.com — https://goat.com
- **Patrón:** GOAT con tratamiento editorial superior — hero imagery cinematográfica, mucho whitespace, type display dramático en banners. StockX más denso con price ticker tipo bolsa.
- **Modo:** ambos (light default e-commerce, dark con greys cálidos).
- **Aplicabilidad:** estética premium para detalle de producto en una pre-orden. Mejor referencia que e-commerce genérico.

---

## 5. Empty / loading / error

### 5.1 Linear empty states — Ilustración geométrica + copy declarativo

- **URL:** https://linear.app
- **Patrón:** Ilustración monocromática del acento, max-width 320px de copy, CTA primario claro. Nunca culpa al usuario por estar vacío.
- **Modo:** ambos.
- **Aplicabilidad:** "Aún no tienes pre-órdenes — añade la primera para ver tus pagos próximos" con ilustración panda contextual.

### 5.2 Stripe Dashboard skeletons — Geometría exacta del contenido

- **URL:** https://dashboard.stripe.com
- **Patrón:** Skeletons que respetan exactamente la geometría final, shimmer 1.5s, cero layout shift al hidratar.
- **Modo:** ambos (`#1A1A1A` dark / `#F0F0F1` light).
- **Aplicabilidad:** skeletons de cards del dashboard, filas de lista, detalle.

### 5.3 GitHub 404 — Mascota en escenario contextual

- **URL:** https://github.com/404
- **Patrón:** Mascot (Octocat) en escenario contextual al error. Convierte un momento frustrante en beat de marca memorable. Ilustración 240–320px, copy primario 24px.
- **Modo:** ambos.
- **Aplicabilidad:** 404/500/"tienda no encontrada" con panda en escenarios distintos (perdido, durmiendo, buscando con lupa).

### 5.4 Framer — Loading transitions con shared element

- **URL:** https://framer.com
- **Patrón:** Card crece de lista a detalle (shared element), spring physics con bounce ligero, micro-interacciones en hover/tap. Spring stiffness 260 damping 26, duration 280–360ms.
- **Modo:** ambos.
- **Aplicabilidad:** transición de card de pedido a vista detalle con shared element del código + estado pill.

---

## 6. Onboarding

### 6.1 BeReal — Gating mecánico

- **URL:** https://bsky.app
- **Patrón:** "Para ver lo de tus amigos, primero postea lo tuyo". Mecánica de progreso bloqueado por acción.
- **Modo:** dark.
- **Aplicabilidad:** futuro feature social ("para ver wishlist de amigos, agrega tu primera pre-orden").

### 6.2 Duolingo — Path gamificado vertical

- **URL:** https://duolingo.com
- **Patrón:** Nodes circulares conectados con curva, mascot Duo prominente con states (idle, celebrating, sad), Lottie animations 400–800ms con bounce.
- **Modo:** light hero.
- **Aplicabilidad:** **moderar** — en exceso se siente infantil para coleccionables premium. Aplicar sólo en momentos celebratorios (entrega completada, colección al 100%).

### 6.3 Apple iOS welcome flows — Una idea por pantalla

- **URL:** Apple HIG.
- **Patrón:** Multi-step lineal con type grande, espaciado generoso, una decisión por step. Progress bar superior compacto.
- **Modo:** ambos.
- **Aplicabilidad:** onboarding de PandaTrack — locale → currency → primer país → primeros tipos de producto → "agregar primera tienda".

---

## 7. Motion / micro

### 7.1 View Transitions API — Spec actual

- **URL:** https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API + https://developer.chrome.com/docs/web-platform/view-transitions/cross-document
- **Patrón:** `document.startViewTransition()` + `view-transition-name: nombre` por elemento. Crossfade automático y morph entre rutas. Cross-document soportado en Chromium estable.
- **Modo:** ambos.
- **Aplicabilidad:** card de pedido en lista → detalle con shared element. El motion más alto-impacto/bajo-costo de 2026.

### 7.2 Scroll-driven animations CSS

- **URL:** https://developer.mozilla.org/en-US/docs/Web/CSS/animation-timeline
- **Patrón:** `animation-timeline: scroll()` y `view()` en CSS puro. Sin JS, sin libs.
- **Modo:** ambos.
- **Aplicabilidad:** header del dashboard que colapsa, totales animados al entrar en viewport, paralaje sutil 4–12px.

### 7.3 CSS `linear()` easing — Springs en CSS puro

- **URL:** https://linear-easing-generator.netlify.app
- **Patrón:** `transition: transform 0.5s linear(0, 0.0009 1.92%, ..., 1)`. Aprobado en todos los browsers modernos en 2024.
- **Modo:** ambos.
- **Aplicabilidad:** entradas de menus, sheets, toasts, cards activos sin libs JS.

### 7.4 Rauno Freiberg — Microinteracciones con física

- **URL:** https://rauno.me
- **Patrón:** Easings, durations, anticipation, overshoot, secondary motion. Referencia obligada de la cultura Linear/Vercel.
- **Modo:** ambos.
- **Aplicabilidad:** vocabulario fino de motion para botones, toggles, dialogs, drag-to-reorder.

### 7.5 Motion (ex Framer Motion) — Library standard

- **URL:** https://motion.dev
- **Patrón:** Springs `stiffness 300–500, damping 25–35` para UI standard. Stagger 30–60ms entre items. View Transitions wrapper.
- **Modo:** ambos.
- **Aplicabilidad:** stack JS para animaciones complejas, gestures, shared layout.

---

## 8. Identidad visual

### 8.1 Mascot system — Linny (Linear), Duo (Duolingo), butterfly (Bluesky)

- **URLs:** https://linear.app — https://duolingo.com — https://bsky.app
- **Patrón:** Linny aparece raro (easter egg), Duo es transversal, butterfly aparece en empty states. Espectro entre "sticker omnipresente" y "easter egg". El balance correcto para Gen Z: presente con personalidad, no constante.
- **Modo:** light/dark con re-render (rim light en dark, no inversión simple).
- **Aplicabilidad:** panda como sistema con poses, expresiones, paleta. Aparece en empty states, transiciones críticas, achievements. Fuera de eso, sólo huella en el grid.

### 8.2 Stripe Press / Brian Lovin / mds.is — Editorial expresivo

- **URLs:** https://press.stripe.com — https://brianlovin.com — https://mds.is
- **Patrón:** Type-driven, asimetría sobre grilla rigurosa, espaciado generoso, jerarquía con espacio más que con peso.
- **Modo:** ambos.
- **Aplicabilidad:** detalle de pedido / entrega como "vista de lectura" donde número total, días restantes, % pagado son héroes tipográficos.

### 8.3 Gumroad / Manifesto — Neo-brutalism comercial

- **URLs:** https://gumroad.com — https://manifesto.so
- **Patrón:** Bordes negros chunky, sombra offset dura, paleta saturada, tipografía contundente.
- **Modo:** light hero (en dark se reemplaza sombra dura por doble-borde o inset glow).
- **Aplicabilidad:** badges de estado (`PAGADO`, `EN CAMINO`, `PENDIENTE`) en mono uppercase, CTAs primarios con sombra offset.

### 8.4 Spline / Vercel illustrations — Claymorphism 3D soft

- **URLs:** https://spline.design — https://vercel.com
- **Patrón:** 3D blender con luz cálida, soft shadows color marca diluidas, paleta limitada. En dark requiere rim light, no sólo invertir fondo.
- **Modo:** ambos con dos lighting setups distintos.
- **Aplicabilidad:** mascot panda 3D con estados emocionales — durmiendo, cargando paquete, celebrando. Empty states con paquete/ticket/hucha 3D.

### 8.5 Frank Body / chrome type / Y2K revival

- **URLs:** Pinterest "y2k ui" — https://www.are.na/search/blocks?q=y2k%20ui
- **Patrón:** Gradientes largos en Oklch/P3, glow controlado, grano texture, tipografía variable display, iconografía 3D chrome.
- **Modo:** dark nativo (en light la paleta se desatura a lavanda pastel).
- **Aplicabilidad:** splash/loaders, achievements, tema opcional desbloqueable como recompensa.

### 8.6 Apple Liquid Glass / Raycast / Arc — Glass contenido

- **URLs:** https://developer.apple.com/visionos — https://raycast.com — https://arc.net
- **Patrón:** `backdrop-filter: blur(20px) saturate(180%)`, tinte sólido al 40–60% debajo del blur. En dark requiere bordes 1px de luz (inner glow blanco 8–15% opacidad).
- **Modo:** ambos.
- **Aplicabilidad:** sheet de acción rápida, floating tab bar mobile, toasts inline.

### 8.7 POPMART — Drops, blind boxes, countdowns

- **URL:** https://popmart.com
- **Patrón:** Audiencia exacta de PandaTrack. Carouseles de drops, countdowns para lanzamientos, blind box reveal con confeti+escala+sonido+haptic. Paleta candy en light.
- **Modo:** light hero, dark no priorizado.
- **Aplicabilidad:** countdown para pre-órdenes, "drop incoming" para nuevas tiendas, blind box reveal aspiracional para "entrega misteriosa".

---

## 9. Theming light/dark

### 9.1 Material 3 Expressive — HCT + state layers + tonal elevation

- **URL:** https://m3.material.io
- **Recetas clave:**
  - `primary` = tone 40 (light) / tone 80 (dark); `on-primary` = tone 100 / tone 20.
  - 5 niveles de surface containers: lowest, low, base, high, highest. En dark cada nivel sube ~3–4% L sin sombra.
  - State layers: hover 8%, focus 10%, pressed 10%, dragged 16% del `on-surface`.
  - Spatial spring default `stiffness 700, damping 30`. Effects ease `cubic-bezier(0.2, 0, 0, 1)`.
- **Aplicabilidad:** receta canónica de tokens dual-mode + state layers para PandaTrack.

### 9.2 Apple HIG — System colors semánticos + materials

- **URL:** https://developer.apple.com/design/human-interface-guidelines/materials
- **Recetas:**
  - `label` 1.0 / `secondaryLabel` rgba(60,60,67,0.6) light; rgba(235,235,245,0.6) dark.
  - 5 materials: regular/thin/thick/ultraThin/ultraThick.
  - `systemBackground` `#FFFFFF`/`#000000`, `secondary` `#F2F2F7`/`#1C1C1E`, `tertiary` `#FFFFFF`/`#2C2C2E`.
- **Aplicabilidad:** Web equivalente con CSS vars + `backdrop-filter` + capas tinted.

### 9.3 shadcn/ui + Radix — Convención HSL + data-state

- **URL:** https://ui.shadcn.com
- **Recetas:**
  - Tokens HSL sin función: `--background: 0 0% 100%;` usado con `hsl(var(--background))` y alpha modulation.
  - Set canónico: `background/foreground`, `card/card-foreground`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, `radius`.
  - `data-state="open|closed|active|inactive"` como hook de estilo. `tailwindcss-animate` para `data-[state=open]:animate-in fade-in-0 zoom-in-95`.
  - Theme switch vía clase `.dark` en `<html>` (no media query) para permitir override manual y persistencia.
- **Aplicabilidad:** convención adoptable casi tal cual para PandaTrack.

### 9.4 Tailwind CSS v4 — `@theme` + OKLCH + `color-mix()`

- **URL:** https://tailwindcss.com (docs v4)
- **Recetas:**
  - Bloque `@theme` reemplaza `tailwind.config.js`. Cualquier `--color-*` se vuelve utility automática.
  - **OKLCH** como espacio recomendado: `oklch(70% 0.15 250)` para azules, percepualmente uniforme.
  - `color-mix(in oklch, var(--color-primary) 12%, transparent)` reemplaza opacities precomputadas → **state layers M3-style sin duplicar tokens**.
  - `@variant dark (&:where(.dark, .dark *));` para activar `dark:` con clase.
- **Aplicabilidad:** stack técnico ideal para implementar las paletas de las 3 direcciones en S3.

### 9.5 Producción dual-mode — Linear / Vercel / Stripe / Primer

- **Patrón común a los cuatro:**
  - Ninguno usa `#000` puro en dark — todos añaden 4–8% L y un tinte cromático sutil.
  - Borders en dark son `rgba(255,255,255,0.06–0.10)` (alpha sobre superficie real) para mejor integración.
  - Accent se aclara ~8–12% L en dark para mantener contraste sin perder identidad cromática.
- **Linear:** dark `#08090A`, surface `#1C1C1F`, elevated `#222326`, accent azul desaturado `oklch(60% 0.04 250)`. Page transitions slide horizontal 280ms `cubic-bezier(0.32, 0.72, 0, 1)`.
- **Vercel/Geist:** scale `--ds-gray-100..1000`, borders ultra sutiles, monospace Geist Mono.
- **Stripe Dashboard:** light bg `#F6F9FC` (off-white para reducir glare), surface `#FFFFFF`, accent `#635BFF`. Dark bg `#0A0E27`, accent `#7A73FF`.
- **GitHub Primer Dark Dimmed:** `#22272e` (no el `#0d1117` del Dark default) para reducir fatiga visual.
- **Aplicabilidad:** la regla "dark ≠ negro puro" es inviolable para PandaTrack. Las 3 direcciones la respetan.

### 9.6 Linear — Dark mode oscuro pero no negro

- **URL:** https://linear.app
- **Receta:** `#08090A` fondo, `#1C1D1F` surface, evita vibración cromática con accent desaturado, transitions 80–150ms con `cubic-bezier(0.4, 0, 0.2, 1)`.
- **Aplicabilidad:** referencia para "expressive editorial" — la dirección "seria" debe tomar este enfoque.

---

## Patrones convergentes (agregados)

1. **Animaciones sub-200ms** (Linear, Raycast, Arc) — snappiness > polish lento.
2. **Dark mode ≠ negro puro** (Notion, Linear, Monzo); excepción Cash/Robinhood. Para PT sugerencia inicial `#0A0A0C` o `#111114`.
3. **Tabular nums para todo número** (Cash, Robinhood, Monzo, StockX) — imprescindible para montos.
4. **Inter o sans geométrica con carácter** (Aeonik / Cash Sans) — Inter es la opción segura.
5. **Bottom sheet con stops** (Revolut, Things, Vaul) > full-screen modal para detalles que mantienen contexto.
6. **⌘K aspiracional** (Linear, Raycast, Notion, Arc) para power users.
7. **Feed cronológico con merchant prominente** (Monzo, Strava, Letterboxd) para historial.
8. **Listas largas → densidad alta + hover reveals** (Linear, Notion). 32–40px row height.
9. **Color por categoría con paleta accesible WCAG AA** (Monzo es el gold standard).
10. **Microcelebraciones en momentos clave** (Duolingo, POPMART, Cash) — entrega completada, colección 100%.
11. **View Transitions API + scroll-driven animations** son el motion stack 2026 sin libs pesadas.
12. **Mascot system con dos lighting setups, no inversión flat.**
13. **Glass requiere tinte sólido + bordes de luz en dark** para no desaparecer.
14. **Brutalism aplica a CTAs y celebraciones, no a tablas densas.**

---

## Riesgos detectados (a tomar en cuenta en directions)

- **Productivity-first sesgo:** Linear, Vercel, Notion, Things son "herramientas de oficina". Si la dirección sale toda de ahí, PandaTrack se sentirá enterprise. Compensar con calidez Copilot Money / Plain / POPMART.
- **Mascot infantil:** Duolingo a tope cae en cringe para 18–25 con coleccionables premium. Reservar mascot a momentos puntuales con empatía explícita.
- **Glass + brutalism juntos** chocan filosóficamente. Las direcciones no los mezclan en la misma superficie.
- **Y2K mal calibrado** = template Wix 2003. La diferencia entre retro-futuro 2026 y kitsch está en grano controlado, gradientes en Oklch/P3, type variable.
- **Bento sin jerarquía** = nada importante. Una card debe ser claramente el héroe.
- **3D pesado** vía Spline runtime mata performance mobile mid-tier; exportar assets PNG/WebP/Lottie.
