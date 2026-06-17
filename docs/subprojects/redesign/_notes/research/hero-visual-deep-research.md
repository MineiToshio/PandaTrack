---
title: Deep research — Hero visual de la landing (cómo comunicar el producto de un vistazo)
session: 11
date: 2026-06-15
run: deep-research wf_eee2eca5-56f (107 agentes, 24 fuentes, 117 claims, 25 verificados, 19 confirmados / 6 refutados)
status: applied (hero A.2 round 3)
---

# Hero visual — cómo comunicar un producto multi-paso de un vistazo (con "wow", sin confusión)

> Pregunta: cómo diseñar el visual/animación del hero para que un visitante que NO
> conoce PandaTrack entienda en ~1 segundo el ciclo **tienda → pedido → pago → entrega
> → dashboard** y sienta "esto es justo lo que necesitaba". El hero previo (collage de
> cards de UI) le generaba confusión al dueño.

## Recomendación aplicada

**Un solo objeto-héroe (el coleccionable) recorre un camino secuenciado y converge en
un dashboard**, dentro de una ventana-producto limpia. Implementado en el demo S11
(`#s11-landing`): ribbon "El viaje de tu coleccionable" (Tienda→Pedido→Pago→Entrega con
el token viajando) + panel "Tu colección". Ver `screens/landing.md §6`.

## Hallazgos confirmados (verificación adversarial 2/3+)

1. **El collage estático confunde** porque muestra "superficie sin secuencia, jerarquía
   ni objeto focal" — failure mode de heros de productos desconocidos. (NN/g)
2. **Arquetipo ganador:** hero con titular + "product peek" animado donde la animación
   muestra el producto/flujo trabajando; justificado específicamente para productos
   workflow/dashboard (como PandaTrack). Centrado (titular + visual debajo) es el patrón
   dominante (Evil Martians, n=100), aunque side-by-side sigue siendo válido.
3. **La animación debe COMUNICAR, no decorar.** Movimiento sutil y con propósito ayuda a
   construir el modelo mental; el gratuito molesta y "se gasta rápido". (NN/g, primaria)
4. **Timing/secuencia:** revelar escalonado, **una sola cosa moviéndose a la vez**
   (motion concurrente diluye la atención); transiciones discretas 100–400ms, ease-out
   (lineal se ve antinatural). Excepción: un loop ambiental puede durar 1–3s+.
5. **Codificar el flujo sin diagrama aburrido:** movimiento direccional (izq→der = avance;
   zoom = entrar al dashboard) + **un único objeto-héroe que avanza** por las etapas. La
   dirección lleva el significado; se siente "viaje", no flowchart.
6. **Diferenciación:** los comparables directos (Collectr, tracker de cartas) usan solo
   un screenshot estático en mockup de teléfono y NO dibujan el flujo end-to-end → hueco
   que PandaTrack puede explotar.
7. **Build:** CSS `@keyframes` + SVG inline, sin libs; solo `transform`/`opacity` (off
   main-thread); gate `prefers-reduced-motion`. Scroll-driven CSS es enhancement opcional
   (no Baseline: Firefox flagged). Entrada escalonada + loop ambiental para el "1 segundo".

## Refutado (NO usar como justificación)

- "Líneas/trazos animados como mecanismo PRINCIPAL para un flujo paso a paso" (0-3) → la
  línea es guía sutil; **el objeto que viaja lleva la narrativa**.
- "Arco story-driven antes/después estilo Notion/Linear" (0-3).
- "Los heros minimalistas estáticos / mucho whitespace ganan" (0-3) → no justificar un
  hero estático en eso.
- Cota dura de timing "≤450ms / ~150ms ideal" (0-3) → usar el rango 100–500ms de NN/g.

## Caveats

- Fuerte (primario): NN/g (motion, timing, propósito) + MDN/Chrome (scroll-driven). El
  arquetipo/tendencias se apoya en blogs de diseño (direccional, no probado con datos de
  conversión). Re-verificar el hero de competidores antes del launch (snapshot dic-2025).
- NO está probado que un hero animado supere a uno estático en CONVERSIÓN para esta
  audiencia; el caso aquí es **comprensión + diferenciación**. Recomendable validar con
  un test de 5 segundos una vez construido.

## Preguntas abiertas (para Fase B / validación)

- Autoplay-loop vs scroll-driven como mecanismo primario (test de 5s).
- Cuán literal el objeto-héroe (figura/manga real viajando) vs estaciones que se iluminan.
- Reducción mobile del flujo end-to-end (validar contra `docs/design/interface-patterns.md`).
- Screens reales de PandaTrack (product-peek) vs flujo ilustrado (costo build + i18n).

## Fuentes (selección)

- NN/g — Animation for UX (purpose): https://www.nngroup.com/articles/animation-purpose-ux/
- NN/g — Animation duration: https://www.nngroup.com/articles/animation-duration/
- Evil Martians — 100 devtool landing pages (2025): https://evilmartians.com/chronicles/we-studied-100-devtool-landing-pages-here-is-what-actually-works-in-2025
- MDN — CSS scroll-driven animations: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations
- Chrome — Scroll-driven animations: https://developer.chrome.com/docs/css-ui/scroll-driven-animations
- Collectr (comparable directo): https://getcollectr.com/
- alfdesigngroup — SaaS hero best practices: https://www.alfdesigngroup.com/post/saas-hero-section-best-practices
- SaaSFrame — 2026 landing trends: https://www.saasframe.io/blog/10-saas-landing-page-trends-for-2026-with-real-examples
