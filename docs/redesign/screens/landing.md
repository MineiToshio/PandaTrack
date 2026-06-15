---
title: Landing (go-live)
session: 11
status: html-in-review
last_updated: 2026-06-14
demo_anchors:
  - "#s11-landing"
  - "#s11-landing-mobile"
frd: docs/product/prd-00-pre-release-validation/frd-01-pre-release-landing/frd-01-pre-release-landing.md
module: docs/redesign/modules/landing-onboarding.md
---

# Landing (go-live)

## 1. Propósito y contrato funcional

Puerta pública del collector MVP. Explica el producto a coleccionistas y convierte
a **sign-up** (modo go-live, ver `P-S11-01`). Anónima, sin app-shell, marketing
full-bleed. Reemplaza la landing-waitlist pre-release.

## 2. Variantes y anchors del demo

| Variante                     | Anchor                |
| ---------------------------- | --------------------- |
| Desktop completa             | `#s11-landing`        |
| Móvil (390px) + burger sheet | `#s11-landing-mobile` |

Light + dark vía theme toggle (tokens). Validado en Velvet.

## 3. Layout y estructura

Orden narrativo (preserva FR-01-01, sin la sección waitlist):

1. **Header** (`mk-header`) — logo · nav (Para quién/Funciones/Preguntas, scroll
   interno) · ES/EN · theme · "Iniciar sesión" (ghost) · "Crear cuenta" (primary).
   Burger en <900px. **Sticky top-0 en producción** (en el demo no es sticky para
   no chocar con el `.demo-header`).
2. **Hero** (`mk-hero`) — eyebrow chip · **H1 "Toda tu colección, _bajo control_"**
   (`mk-grad-text` resalta "bajo control"; el titular nombra "colección" en grande
   por decisión de producto, ver módulo) · subtítulo · CTAs ("Crear cuenta gratis"
   primary → sign-up, "Ver cómo funciona" scroll) · trust line · **ventana-producto
   unificada** (ver §6): ribbon "EL VIAJE DE TU COLECCIONABLE" (Tienda→Pedido→Pago→
   Entrega, con el coleccionable viajando) + panel "Tu colección". Glows radiales accent.
3. **User-fit** (`mk-fit-grid`, 3 cards más grandes) — problema del coleccionista;
   index + icon-tile + **bottom bar del color del ícono** (`--tile`), crece a ancho
   completo en hover.
4. **Features** (`mk-feature-grid`, 6 cards, sección `tinted`) — tiendas, pedidos,
   pre-reservas, entregas, avisos, panorama. Icon-tile con accent tint por card.
5. **Banner CTA** (`mk-banner-section`) — **banda full-width** (gradient edge-to-edge,
   no card contenida) → sign-up. Decisión A.2: más impactante ocupando todo el ancho.
6. **FAQ** (`mk-faq`, sección `tinted`) — acordeón, primer item abierto.
7. **Footer** (`mk-footer`) — brand + tagline · columnas (Producto/Cuenta/Legal) ·
   copyright · social.

Full-bleed desktop: helper `mk-bleed` (width 100vw + margin lateral negativo) sólo
en desktop; el frame phone NO lo usa.

## 4. Tokens relevantes

- Texto/superficie/borde: `--text-primary/secondary/muted`, `--surface`,
  `--surface-elevated`, `--background`, `--border`.
- Acento expresivo: `--accent`, `--accent-warm`, `--accent-cool` (gradient de
  headline, glows, icon-tiles, banner).
- Status: `--success` (trust dot, chip Entregado), `--warning` (chip saldo).
- Botones: reusar `.btn primary/ghost` (Fase B: `<Button>` core).

## 5. Estados visuales

- Default (poblada). Hover en cards (lift + border del color del ícono en user-fit). FAQ open/closed.
- Móvil: burger sheet open/closed.
- Sin loading propio (landing estática SSR); los CTAs navegan a `/sign-up` · `/sign-in` (no hay form en la landing).

## 6. Comportamiento e interacción

**Hero visual — ventana-producto unificada (acordado A.2 round 3, respaldado por
deep-research).** Iteraciones descartadas: (1) barra de flujo abstracta con bolita →
"no comunica"; (2) collage de cards sueltas (tienda/pedido/entrega flotando) → seguía
confundiendo ("superficie sin secuencia ni foco", failure mode confirmado por NN/g).
Diseño final = **un solo objeto-héroe (el coleccionable) recorre el ciclo y converge
en un panel**, dentro de UNA ventana limpia:

- **Ribbon "EL VIAJE DE TU COLECCIONABLE"** (`mk-journey`): 4 estaciones
  **Tienda → Pedido → Pago → Entrega** (`mk-journey-step`, cada una `--tile` propio +
  icon-tile + label). Un token (`mk-journey-token`, el coleccionable) viaja izq→der por
  la línea (`mk-journey-line` con fill); cada estación se ilumina (`mk-journey-step`/
  `-pop`) cuando el token llega — **una a la vez**, escalonado (`--s` 0-3, delay
  `--s*1.6s`), loop ~6.4s.
- **Panel "Tu colección"** (`mk-window-body` + `mk-dash-head`): badge "Panel" + 3 stats
  (Gastado / Pendiente `--warning` / En camino) + 2 ítems (figura `package` chip
  "Pre-reserva"; manga `book-open` chip "En camino"). Es el punto de **convergencia**
  (todo se ve y se maneja acá).

**Por qué así (deep-research wf_eee2eca5, 19 claims confirmados):** para un producto
multi-paso desconocido, el visual debe mostrar UN objeto-héroe avanzando por un camino
secuenciado + el dashboard como destino; el movimiento direccional (izq→der) codifica
avance; **una sola cosa se mueve a la vez** (NN/g: motion concurrente diluye atención);
ease-out, transiciones cortas, loop ambiental permitido. Refutado: líneas/trazos como
mecanismo principal (el objeto que viaja lleva la narrativa). Diferenciación: los
competidores (Collectr) solo muestran un screenshot estático — nadie dibuja el flujo.

**Animación:** entrada de la ventana (`mk-window-anim` = `mk-rise` una vez + `mk-float`
ambiental) + loop del token/estaciones. Solo `transform`/`opacity`. **Respeta
`prefers-reduced-motion`** (loops a 1 iteración → estado estático legible). Mismo diseño
en desktop y móvil (las 4 estaciones entran en 390px). Fuentes:
`_notes/research/hero-visual-deep-research.md`.

**Resto de interacciones:**

- **Header:** sticky `top-0` en producción; nav (Para quién/Funciones/Preguntas) hace
  **scroll suave con offset** a las secciones (en el demo `data-s11-scroll`).
- **Burger (móvil):** abre sheet lateral con backdrop; cierra por tap-fuera / Esc / al
  elegir un link; **focus trap** mientras está abierto y **retorno de foco** al botón.
- **FAQ:** acordeón accesible — `aria-expanded`, operable por teclado, primer item
  abierto por defecto (se permite una o varias abiertas; decisión menor de Fase B).
- **CTAs:** "Crear cuenta gratis"/"Crear cuenta" → `/sign-up`; "Iniciar sesión"/"Ya
  tengo cuenta" → `/sign-in`. Sin form en la landing.

## 7. i18n keys propuestas

**Copy investigado (A.2):** todo el copy de la landing se reescribió con investigación
de buenas prácticas de landing (claridad > ingenio para marca desconocida) y voz §7.
H1 = "Toda tu colección, **bajo control**" (se evaluaron 3 opciones; ver módulo).
**Términos canónicos del glosario** aplicados: **pedido**, **entrega**, **pre-reserva**,
**pago**, **tienda** (NO "orden", NO "envío" como nombre de función; "envíos" solo
para el concepto físico de envío partido). Las claves i18n propuestas están en el
copy deck (handoff del módulo).

**Copy aprobada (ES):** la tabla completa clave→ES vive en el **Handoff del módulo**
([modules/landing-onboarding.md](../modules/landing-onboarding.md) §"Copy aprobada") para
no duplicar. Namespace `landing` reescrito a go-live: `hero` (eyebrow/title/subtitle/
ctaPrimary/ctaSecondary/trust/demo._), `header`, `userFit`, `features`, `banner`,
`faqs`, `footer`, `meta`/`og_`. **Se elimina `waitlist`.\*\* EN en S12.

## 8. Accesibilidad acordada

- Landmarks: `<header>` (banner) · `<main>` · `<footer>`; secciones con heading propio.
- Nav con `aria-label`; el orden de tab sigue el visual.
- Burger sheet = dialog: `role="dialog"`/`aria-modal`, focus trap, Esc cierra, retorno de foco.
- FAQ: `aria-expanded` en cada disparador, operable por teclado.
- Hero animado: `prefers-reduced-motion` respetado; la ventana lleva `role="img"` + `aria-label`
  descriptivo; el ribbon/token son `aria-hidden` (decorativos, el mensaje está en copy).
- Contraste del gradient text verificado en light+dark; tap targets ≥44px en móvil.

## 9. Anti-patrones

- No reintroducir el form de waitlist ni el estado share (removidos por go-live).
- No hacer el `mk-header` sticky dentro del demo (choca con `.demo-header`).
- No usar `mk-bleed` dentro del frame phone (`-mobile`).
- El eyebrow chip de marketing es decorativo; no confundir con §9.17 (detalle).

## 10. Notas para Fase B

Archivos React: `src/app/[locale]/(landing)/*` (page, layout, \_components/_).
Reescribir el funnel: quitar Waitlist/_, repuntar CTAs a `/sign-up`. Eventos
PostHog de waitlist → eventos de funnel sign-up. Plan de baja Kit/Sheets/referral.
Ver handoff en [modules/landing-onboarding.md](../modules/landing-onboarding.md).
