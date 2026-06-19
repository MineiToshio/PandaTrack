---
title: ADR 0014 — Sistema de motion + política de View Transitions
date: 2026-06-15
status: accepted
session: 12-motion-voice (Fase A) — decisiones del gate resueltas 2026-06-15 (Sergio delegó las decisiones técnicas a Claude)
owner: Sergio Minei
trigger: S12 eleva el movimiento a sistema sobre S1–S11. Cierra los gaps del research (curvas M3/Apple con nombre, timings de tracking) y resuelve que la view-transition list→detail está stageada pero INERTE (sin trigger). Define la política de cableado con el caveat del componente React canary.
updates: redesign subproject — motion-system spec + PLAYBOOK (§ motion) + principles §4 (operacionalizada, no reemplazada; historical)
related: ADR 0001 D4 (toast neutral-undo) · D5 (firma view-transition) · D7 (view-transition de orden), ADR 0013 (skeleton shimmer / reduced-motion), principios de diseño del subproyecto §4 (histórico), borradores de elevación/motion y research de motion-voice del subproyecto (histórico), .agents/rules/optimistic-client-updates.mdc
---

# ADR 0014 — Sistema de motion + política de View Transitions

## Contexto

Hasta S11, el movimiento se construyó por sesión: tokens de duración/easing definidos en S3
(`globals.css` §1, alineados con los principios de diseño del subproyecto §4, histórico), microinteracciones agregadas ad-hoc por módulo
(count-roll en S7, toast neutral-undo en S7/S9, shimmer en S10, spring de modal en M01). No había una
**spec de sistema** que: (a) pusiera nombre M3/Apple a las curvas para auditar uso, (b) congelara la
regla transform/opacity y la cobertura `prefers-reduced-motion` como contrato, (c) resolviera el estado
de la view-transition list→detail.

El barrido de la app (S12 Fase A) encontró dos hechos clave:

1. **La view-transition list→detail está stageada pero INERTE.** Orders/Deliveries tienen
   `view-transition-name` CSS (`order-{id}`, `dlv-{id}`) + el bloque global `::view-transition-group(*)`
   con `--ease-vt-signature`. Pero `next.config.ts` `experimental` solo tiene `serverActions`; **no hay**
   `experimental.viewTransition`, ni `startViewTransition`, ni el componente React `<ViewTransition>`, ni
   librería. **Nada dispara la transición en la navegación → el morph no ocurre.** Stores ni siquiera
   tiene nombre asignado.
2. **El research bendice un camino con caveat.** El insumo (A3) propone
   `experimental.viewTransition: true` + React `<ViewTransition name>`, pero **verifica** que ese
   componente es **canary/experimental** (jun 2026), con riesgo de cambio de API.

REGLA CERO de S12: respetar las primitivas existentes, construir la capa expresiva encima.

## Decisión

### D1 — Taxonomía de motion: aditiva sobre las primitivas existentes

1. **Se conservan verbatim** los tokens de `globals.css` §1: duraciones `--motion-fast/base/slow`
   (150/280/480 ms) y easings `--ease-emphasis`, `--ease-out-expressive`, `--ease-bounce`,
   `--ease-vt-signature`. El signature **no se duplica** y sigue siendo exclusivo de view-transitions.
2. **Crosswalk M3 / Apple HIG documentado** (no son tokens nuevos): `--ease-emphasis` = M3 _Standard_;
   `--ease-out-expressive` = M3 _Emphasized decelerate_ ≈ SwiftUI `.smooth`; `--ease-bounce` = M3
   _Emphasized_ con overshoot ≈ SwiftUI `.bouncy`. Cierra el gap #1 del research. Detalle en
   la spec de motion del subproyecto §1.2 (histórico).
3. **Reglas duras congeladas:** animar **solo** `transform`/`opacity`; **nunca** props de layout
   (`width`/`height`/`top`/`left`); INP ≤ 200 ms p75.
4. **`prefers-reduced-motion` con política "reduced ≠ none":** el bloque global (`globals.css` §12) es el
   piso; cada superficie de la capa expresiva ships su `motion-safe:`/`motion-reduce:` explícito (no se
   apoya solo en el piso). En particular, la VT bajo reduced-motion hace **cross-fade ~150 ms**, no el
   corte a 0.01 ms.
5. **Propuestas aditivas para el gate** (no se aplican sin OK de Sergio): `--motion-instant: 100ms`
   (tramo de feedback discreto del research) y, opcional, `--ease-accelerate` (M3 _emphasized-accelerate_)
   para exits.

### D2 — Política de View Transitions list→detail

1. **Cablear el trigger que falta**, no inventar la convención: el contrato de nombres (`order-{id}`,
   `dlv-{id}`; **+ `store-{slug}`** para cerrar el gap) y la firma `--ease-vt-signature` (280 ms) se
   **conservan** (ADR 0001 D5).
2. **Camino preferido (Opción A): CSS names + wrapper `startViewTransition`.** Mantener los
   `view-transition-name` CSS y envolver `router.push` en `document.startViewTransition()` (vía
   `<Link onNavigate>` / hook `useViewTransitionRouter`). **Mantiene el componente React canary fuera del
   path.**
3. **Camino alternativo (Opción B, research A3): `experimental.viewTransition` + React
   `<unstable_ViewTransition>`.** Documentado, pero con el **⚠️ caveat canary** explícito.
4. **Gate doble + degradación graciosa:** detrás del flag de Next **y** de un feature flag de runtime
   (PostHog); sin soporte de browser o flag off → navegación normal, la app funciona igual. **No es
   dependencia dura.**
5. **Safari spot-check obligatorio** antes de habilitar. Soporte verificado: Chrome/Edge 111+, Safari
   18.0+, Firefox 144+ (~88.6 %). _Refutado:_ los cutoffs "Safari 18.2 / Edge 125".

### Gate — resoluciones (2026-06-15)

Sergio delegó las decisiones técnicas a Claude ("decide lo más adecuado para nuestro caso"). Resoluciones finales:

- **D1 §5 — `--motion-instant: 100ms`: SÍ** (aditivo, snappy en mobile, cero riesgo). **`--ease-accelerate`: NO** (se difiere; restraint + vocabulario reducido).
- **D2 — View Transitions: Opción A** (CSS names + wrapper `startViewTransition`, feature-flag gateado, fallback gracioso, `store-{slug}`, reduced-motion cross-fade, spot-check Safari). El `<ViewTransition>` canary de React **no** se usa.
- **Stagger de lista: NO** (listas instantáneo, restraint Linear) → se **elimina** el keyframe muerto `order-item-animate`. **`button-ripple`** también se elimina (dead code).
- **Showcases en el demo HTML: NO** — el motion se entrega real en Fase B (review con `npm run dev`).

## Alternativas consideradas

### A1. Cablear directo con el componente React `<ViewTransition>` (research A3) como camino único

- **Pros:** es el camino que el research documenta; React gestiona los nombres.
- **Cons:** el componente es **canary/experimental**; la API puede romper en un upgrade de React/Next.
  Convertirlo en el único camino lo vuelve dependencia dura de algo inestable.
- **Por qué no:** se adopta como **Opción B** (alternativa documentada), no como camino único. El
  preferido (A) reusa lo stageado sin el canary.

### A2. No cablear la VT — dejar la navegación sin morph

- **Pros:** cero riesgo, cero superficie nueva.
- **Cons:** desperdicia la infraestructura ya stageada (nombres + firma + bloque global) y un patrón que
  el rediseño convencionó desde ADR 0001. La comprensión "de dónde vino este detalle" se pierde.
- **Por qué no:** el morph list→detail es comprensión, no decoración. Se cablea, pero gateado y con fallback.

### A3. Agregar muchos tokens nuevos (un easing/duración por superficie)

- **Pros:** control fino por caso.
- **Cons:** rompe el vocabulario reducido de los principios de diseño del subproyecto §4 (histórico); cada componente con su easing = el
  anti-patrón que el sistema evita.
- **Por qué no:** la taxonomía es **aditiva y mínima** (a lo sumo `--motion-instant` + opcional
  `--ease-accelerate`), con crosswalk documentado sobre lo existente.

## Consecuencias

### Positivas

- El movimiento deja de ser folklore por sesión: tokens con nombre M3/Apple, reglas duras congeladas,
  cobertura reduced-motion como contrato, y un mapa por superficie (animar vs quedarse quieto).
- La VT list→detail pasa de **inerte** a **cableada-pero-segura** (gateada, con fallback, sin canary en el
  path preferido). Stores entra al patrón con `store-{slug}`.
- Cierra los gaps del research (#1 curvas con nombre, #4 timings de tracking: undo 5 s/8 s, lifecycle de
  progress, count-roll 600 ms).
- Detecta y agenda deuda real: keyframes muertos (`button-ripple`, `order-item-animate`), `transition-all`
  y `width` animado en Toast/progress, faltantes de `motion-reduce`.

### Negativas / límites

- **El componente `<ViewTransition>` de React es canary** (Opción B). Mitigado por preferir Opción A +
  gate doble + fallback, pero si en el futuro se elige B, el riesgo de API se asume conscientemente.
- **Migrar `width` → `scaleX`** (countdown del toast, fill de progress) puede cambiar sutilmente el render
  (border-radius/sub-pixel). Requiere verificación visual.
- **El piso global de reduced-motion enmascara** faltantes de cobertura per-componente: hay que verificar
  cada superficie nueva con el flag del SO activo, no confiar solo en el piso.
- La voz/copy (voice library) es subjetiva: el sistema reduce el espacio de decisión, el gate humano sigue
  siendo árbitro.

## Rollout notes

- **Fase A (esta sesión):** specs + ADR + PLAYBOOK. Sin tocar `src/` salvo (opcional) showcases CSS en el
  demo. Gate humano.
- **Fase B — ✅ implementada (2026-06-15):** el orden de la spec de motion del subproyecto §8.1 (histórico) se ejecutó en 6
  chunks — VT Opción A detrás de flag (componente `src/components/core/ViewTransitionLink.tsx`, triple-gate:
  automatización / dev-preview / flag PostHog `list-detail-view-transitions`), cleanup de keyframes muertos,
  `--motion-instant`, `scaleX` en el countdown del toast + el progress fill, ventanas undo centralizadas
  (4s/5s/8s), `motion-reduce` explícitos, y neutralización del drift dialectal en i18n. **Sin** stagger de
  lista ni `--ease-accelerate` (decisiones del gate). Validación verde (test/type-check/lint/build/e2e);
  review visual + spot-check Safari pendientes de Sergio.
- **Monitoring:** si se habilita la VT con feature flag PostHog, observar errores de navegación (Sentry) +
  el flag de evaluación; poder apagarlo sin redeploy.

## References

- Spec: `docs/design/motion.md`
- Voice: `docs/design/ux-copy.md`
- Insumo: investigación de motion + voice del subproyecto de rediseño (histórico)
- Origen de tokens: borradores de elevación/motion del subproyecto de rediseño · principios de diseño del subproyecto §4 (histórico)
- ADR 0001 D4/D5/D7 (toast undo, firma VT, view-transition de orden)
- ADR 0013 (skeleton shimmer / reduced-motion estático)
- `.agents/rules/optimistic-client-updates.mdc`
