---
title: S12 — Insumo de research (Motion + Voice)
last_updated: 2026-06-15
status: insumo para S12 Fase A — NO es el spec; es el fundamento citado
source: deep-research harness (104 agentes, 22 fuentes, 74 claims → 25 verificados → 24 confirmados / 1 refutado)
owner: Sergio Minei
---

# S12 — Research de Motion + Voice (insumo)

> **Naturaleza.** Reporte de deep-research (verificación adversarial 3-votos por claim). Es el **fundamento externo
> citado** para diseñar el spec de motion y la voice library de S12 — NO es el spec. La parte interna (catálogo de
> interacciones de PandaTrack + mapeo a nuestras pantallas) es trabajo de la Fase A.
>
> **Honestidad sobre cobertura:** la base técnica/principios salió fuerte y verificada. Lo que **NO sobrevivió**
> la verificación (ver §Gaps) es justo el comparativo de apps (Linear/Things/Notion/Cash App/Duolingo/Arc), las
> curvas de easing M3/Apple HIG, los specs de emoji/slang para 18–25, y los timings de microinteracción de tracking.
> Esos gaps se cubren con el teardown hands-on + la Fase A.

## Parte A — Motion (verificado, alta confianza)

### A1. Taxonomía de duración (adoptable directo)

- **~100ms** — feedback simple: toggles, checkboxes, count ticks (flip de estado, checkmark de "pagado").
- **200–300ms** — cambios a escala de modal/pantalla. _(El spring de modal actual ya vive acá — se respeta.)_
- **~400ms** — morphs shared-element list→detail (card de pedido → detalle).
- Regla: escala por complejidad y distancia recorrida. Rango global 100–500ms (NN/g + Next.js + M3 convergen).

### A2. Presupuesto de performance (regla dura)

- **Animar SOLO `transform` y `opacity`** (se quedan en el compositor). Nunca `width/height/top/left` (layout).
- Dato: misma animación dropea ~50% de frames con `top/left` vs ~1% con `transform`.
- **INP ≤200ms en p75** (Core Web Vital), nunca >500ms. Handlers de interacción con trabajo corto en main thread.
- Las microinteracciones (count, toggles, progress, success) se expresan vía transform/opacity/scale.

### A3. View Transitions API en Next.js App Router (camino concreto)

- `experimental: { viewTransition: true }` en `next.config.ts`. App Router ya trae React canary (sin install aparte).
- Envolver thumbnail (lista) y hero (detalle) en `<ViewTransition name="...">` con el **mismo `name`** → React auto-morfea
  tamaño/posición. React llama `startViewTransition` solo ("nunca lo hagas vos").
- Soporte ~88.6% (Chrome/Edge 111+, Safari 18.0+, Firefox 144+). **Degrada gracioso**: sin soporte, la app funciona, solo no anima.
- ⚠️ **CAVEAT (verificado):** `<ViewTransition>` de React es **experimental/canary**, no estable (jun 2026). Gatear detrás del flag,
  documentar el riesgo de cambio de API, spot-check en Safari.

### A4. `prefers-reduced-motion` (acción de a11y)

- **Ni React ni el browser lo auto-honran para view transitions** — hay que escribir el `@media (prefers-reduced-motion)` a mano.
- **"reduced ≠ none"** (Chrome/W3C): mantener una animación más sutil que exprese la relación (cross-fade), no matar todo el feedback.
- Encaja con lo que PandaTrack ya tiene (fallbacks reduced-motion en componentes + token de easing signature) → la capa nueva
  de motion/view-transition debe extender esa misma cobertura de media-query, no inventar otra.

## Parte B — Voice (verificado, alta confianza)

### B1. Estructura: voz-constante / tono-variable (modelo Mailchimp)

- **Una voz fija + una matriz tono-por-contexto** que cambia según el estado emocional del lector.
- **Regla dura: claridad > entretenimiento.** Humor solo cuando sale natural; "si dudás, cara seria".
- Mailchimp documenta su voz con 4 pilares enumerables (plainspoken, genuine, translator, dry humor) → da una estructura
  concreta para llenar la nuestra.
- **Aplicación PandaTrack:** matriz donde **plata/pagos, acciones destructivas y errores → tono neutro/claro**; mientras
  **empty states, onboarding y toasts de éxito → voz juguetona de coleccionista**.

### B2. Tarea > personalidad en superficies funcionales (Slack)

- La habilidad de completar la tarea manda; el ingenio no debe estorbar. Primero la info de la tarea, después voz/tono.
- **Contracciones + cadencia conversacional** = mecanismo liviano de calidez ("You'll" en vez de "You will").
- **Aplicación:** estado de pago, totales y tracking de envío = claros y task-first; calidez por cadencia; personalidad
  expresiva reservada a momentos de bajo riesgo (pedido completo, pre-orden 100% pagada).

## Gaps — lo que NO se verificó (cubrir en teardown + Fase A)

1. **Curvas de easing M3 (emphasized/standard) + equivalentes Apple HIG.** Tenemos las duraciones y la regla transform/opacity,
   pero no las curvas con nombre para poner junto al token de easing signature. → capturar de los docs M3 en Fase A.
2. **Comparativo de apps (Linear, Things 3, Notion, Cash App, Duolingo, Arc).** NINGÚN claim sobrevivió la verificación —
   las fuentes eran blogs/case-studies que no pasaron el voto adversarial. **Esta es la parte que el research solo no da**
   (lee la web, no usa las apps). → **teardown hands-on de superficies públicas** con browser.
3. **Emoji / slang / inclusividad para 18–25.** Las fuentes de Duolingo salieron "unreliable". → teardown + criterio en Fase A.
4. **Timings de microinteracción de tracking** (ventana de undo del toast, lifecycle de la barra de progreso). → definir en el spec.

## Teardown hands-on (browser, 2026-06-15) — cubre el gap #2/#3

Observación directa de superficies públicas (lo que el research no pudo). Cash App quedó **bloqueado** por el
browser (restricción de seguridad) → su voz de plata se cubre con el framework verificado de Mailchimp/Slack.

- **Linear** (`linear.app`) — **motion = comprensión, no decoración.** El hero ES un mockup del producto que se
  anima solo: un issue pasa de Todo→In Progress, un agente "escribe", archivos cambian. El movimiento muestra el
  producto funcionando; el resto es restraint puro. Copy declarativo sin fluff ("The product development system for
  teams and agents"). **Polo confianza/restraint.**
- **Arc** (`arc.net`) — **personalidad al frente.** Cobalt brillante, divisores zigzag tipo papel rasgado, display
  serif mezclado con sans, gradientes, CTA en pill oscuro. Voz cálida con paréntesis ("the Arc DNA you know (and
  love)"). **Polo delight/joven.**
- **Duolingo** (`design.duolingo.com/writing/tone`) — **tono-por-contexto con do/don't concretos** (leído directo):
  éxito → exclamación OK ("Awesome work!", NO "You have successfully passed this level"); error → amigable sin
  exagerar ("Not quite correct. Try again!", NO el frío "Incorrect." ni la sobre-disculpa); sensible → "tone down the
  exuberance… treat it not like content, but like someone's life". Voz constante, tono variable. **Confirma Mailchimp empíricamente.**

**Lectura para PandaTrack:** el espectro Linear↔Arc/Duolingo ES tu matriz tono-por-contexto. Superficies de
**plata / entrega / destructivas → polo Linear** (restraint, motion solo para comprensión: barra de pago que se
llena, flip de estado, morph list→detail). **Empty states / onboarding / éxito → polo Arc/Duolingo** (delight,
exclamación, personalidad de coleccionista). El "delight" se reserva a momentos celebratorios (pedido completo,
pre-orden 100% pagada), nunca sobre superficies de confianza.

## Refutado (no usar)

- Cutoffs de soporte "Safari 18.2 / Edge 125" — falso. Los verificados son Chrome/Edge 111+, Safari 18.0+, Firefox 144+.

## Fuentes primarias

NN/g animation-duration · web.dev animations-guide · Next.js view-transitions · react.dev ViewTransition ·
caniuse view-transitions · Chrome same-document view-transitions · Mailchimp voice-and-tone (+ GitHub style guide) ·
Slack designing/voice-tone.
