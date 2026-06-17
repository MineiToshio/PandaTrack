---
title: S12 — Motion + microinteracciones + voice library
session: 12-motion-voice
type: foundational A+B
status: ✅ Fase A + Fase B done (2026-06-15) — validación verde; review visual + spot-check Safari pendientes de Sergio
last_updated: 2026-06-15
owner: Sergio Minei
adrs:
  - ADR 0014 — Motion system + View Transitions policy
---

# S12 — Motion + microinteracciones + voice library

Sesión foundational A+B con **gate humano** entre fases. No agrega pantallas de producto: define a nivel
**sistema** el lenguaje de movimiento y la voz que se aplican sobre todo lo construido (S1–S11).
**REGLA CERO:** respetar las primitivas existentes, construir la capa expresiva encima.

> **Esta conversación cerró la Fase A** (catálogo + specs). El agente **paró** para el gate de Sergio
> antes de implementar (Fase B). Los agentes no commitean.

## Insumo

- `_notes/s12-motion-voice-research.md` — deep-research verificado (taxonomía de motion + estructura de
  voz) + teardown hands-on (Linear / Arc / Duolingo). Fundamento citado, no el spec.

## Fase A — qué se produjo

| Artefacto      | Path                                                   | Contenido                                                                                                                                                                                                                                                        |
| -------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spec de motion | `screens/motion-system.md`                             | Punto de partida (primitivas vivas), taxonomía de tokens + crosswalk M3/Apple, reglas duras, cobertura reduced-motion, **mapa por superficie (el catálogo)**, plan de View Transitions con caveat canary, patrones de microinteracción, deuda detectada, handoff |
| Voice library  | `screens/voice-library.md`                             | Voz constante (4 pilares) + matriz tono-por-contexto, do/don't por superficie, español neutro (reconciliación con §7), enforceability                                                                                                                            |
| ADR            | `decisions/0014-motion-system-and-view-transitions.md` | D1 taxonomía aditiva · D2 política de View Transitions (gateada, fallback, caveat canary)                                                                                                                                                                        |
| PLAYBOOK       | `PLAYBOOK.md` §11 (motion) + §12 (voice)               | Versión accionable + anti-patrones                                                                                                                                                                                                                               |

## Catálogo — hallazgos clave del barrido de la app

Barrido con 3 agentes (navegación/listas · forms/controles · feedback/overlays) + verificación directa de
los valores críticos.

1. **🔴 La view-transition list→detail está stageada pero INERTE.** Orders/Deliveries tienen
   `view-transition-name` CSS (`order-{id}`, `dlv-{id}`) + el bloque global `::view-transition-group(*)`
   con `--ease-vt-signature`, pero `next.config.ts` **no** tiene `experimental.viewTransition` y **no hay**
   `startViewTransition` / componente React / librería en `src/`. **Nada dispara el morph → no ocurre hoy.**
   **Stores ni siquiera tiene nombre.** → Fase B cablea el trigger (gateado, fallback), agrega `store-{slug}`.
2. **El count-roll ya existe** (`useAnimatedNumber`, 600 ms cubic-out, honra reduced-motion) en
   OrderDetailHero (monto + %). Es el patrón canónico de "count change"; falta extenderlo (delivery hero,
   dashboard futuro).
3. **Toast neutral-undo vivo** con `UNDO_TOAST_DURATION_MS = 5000`. **Drift:** `DEFAULT_DURATION_MS = 4000`
   en el componente — un undo que olvide pasar `duration` cae a 4 s, no a 5 s. Falta cablear el **8 s** de
   deletes enteros.
4. **Deuda transform/opacity:** el countdown del toast y el fill de progress animan `width` (layout). El
   toast usa `transition-all` + `duration-300` hardcoded. → migrar a `scaleX` + tokens.
5. **Keyframes muertos:** `button-ripple` (sin consumidor → eliminar), `order-item-animate` (sin consumidor
   → cablear como stagger acotado o eliminar).
6. **Cobertura reduced-motion incompleta:** Switch track, MascotBubble (hover + menú), StoreCard sin
   `motion-reduce` explícito (los cubre el piso global, conviene explícito). El piso global **enmascara**
   estos faltantes.
7. **Voz mayormente aplicada** (S6–S11). Drift dialectal puntual en `principles.md` §7 ("Dale otra vez") a
   neutralizar en un pase de copy (flag, no fix silencioso).

## Decisiones del gate — RESUELTAS (2026-06-15)

Sergio delegó las decisiones técnicas a Claude ("yo de estas cosas no entiendo; decide lo más adecuado
para nuestro caso"). Resoluciones finales (criterio: restraint Linear + audiencia 18–25 mobile + REGLA CERO):

1. **`--motion-instant: 100ms` → SÍ se agrega.** Aditivo; flips discretos (toggle/checkmark/count) más snappy en mobile; cero riesgo.
2. **`--ease-accelerate` → NO (se difiere).** Restraint + vocabulario reducido; los exits con `--ease-emphasis` funcionan.
3. **View Transitions → Opción A** (CSS names + wrapper `startViewTransition`, feature-flag gateado, fallback gracioso, `store-{slug}`, reduced-motion cross-fade, spot-check Safari). El `<ViewTransition>` canary **no** se usa.
4. **Stagger de lista → NO** (listas instantáneo, restraint Linear). Se **elimina** el keyframe muerto `order-item-animate` (y `button-ripple`).
5. **Showcases en el demo HTML → NO.** El motion se entrega real en Fase B (el owner lo evalúa con `npm run dev`, más fiel que un demo HTML).

## Handoff a Fase B

Detalle en `screens/motion-system.md` §8. Resumen:

- **Orden sugerido:** (1) tokens/cleanup en `globals.css`; (2) View Transitions detrás de flag (Opción A
  primero, spot-check Safari, reduced-motion cross-fade); (3) Toast (`scaleX` + tokens + ventana 8 s);
  (4) progress fill `scaleX`; (5) `motion-reduce` faltantes; (6) opcionales (stagger, popover fade).
- **Riesgo principal:** ⚠️ el `<ViewTransition>` de React es **canary** — preferir Opción A, gate doble,
  fallback gracioso, **no** dependencia dura.
- **Voice Fase B:** audit de `i18n` es/en contra la matriz + neutralización del drift dialectal + paridad en.
- **Validación esperada:** test/type-check/lint/validate-build; e2e de los flujos tocados; verificación
  visual light/dark/mobile **+ con `prefers-reduced-motion` activo** + spot-check Safari para VT.

## Validación Fase A

Trabajo de docs/spec — sin tocar `src/` ni `globals.css` (los showcases quedaron como decisión de gate).
**No se requieren comandos de validación de app** (PLAYBOOK §8 política 1: docs-only). Si en el gate Sergio
pide los showcases en el demo HTML, esa edición se valida con `npm run lint` antes de cerrar.

## Fase B — implementación (cierre 2026-06-15)

Implementada sobre `redesign` en 6 chunks committeables (los agentes no commitean; Sergio revisa con
`npm run dev` y commitea entre chunks). REGLA CERO respetada: la capa expresiva se construyó **sobre** las
primitivas vivas, sin resetear nada.

### Chunks

1. **Tokens + cleanup (`globals.css`).** `--motion-instant: 100ms` agregado. Keyframes muertos
   `button-ripple` y `order-item-in`/`.order-item-animate` eliminados (sin consumidores, verificado por grep
   global). `--ease-accelerate` **no** agregado (diferido, D2).
2. **View Transitions list→detail — Opción A, gateada.** Componente nuevo
   `src/components/core/ViewTransitionLink.tsx` (drop-in de `<Link>`) que envuelve `router.push` en
   `document.startViewTransition` con **triple gate**: nunca bajo automatización (`navigator.webdriver` → e2e
   determinista), ON en dev/preview (revisable con `npm run dev`), y detrás del flag PostHog
   `FEATURE_FLAGS.LIST_DETAIL_VIEW_TRANSITIONS` en producción (kill sin redeploy). Degradación graciosa total
   (modificadores / middle-click / sin soporte de browser / flag-off → navegación nativa de `<Link>`). Swap en
   las 5 superficies list→detail (OrderCard, OrdersTable ×2, DeliveryCard, DeliveriesTable ×2, StoreCard).
   `view-transition-name: store-{slug}` agregado a StoreCard + StoreHero (cierra el gap de Stores). Reduced-motion
   = cross-fade ~150ms explícito en `globals.css §12` (no el corte a 0.01ms = none). Evento
   `POSTHOG_EVENTS.NAVIGATION.VIEW_TRANSITION_NAVIGATED` centralizado. `next.config.ts` **intacto** (Opción A no
   necesita `experimental.viewTransition`; el `<ViewTransition>` canary de React queda fuera del path). **Sin
   colisión de nombres:** las tablas (`hidden lg:block`) y las cards (`lg:hidden`) nunca coexisten renderizadas,
   y la VT API no captura elementos `display:none`.
3. **`Toast.tsx` transform-only + ventana undo.** Countdown `width 100%→0%` → `transform: scaleX(1→0)`
   origin-left vía clase `.toast-countdown` (keyframe migrado). `transition-all duration-300` →
   `transition-[transform,opacity]` + `--motion-base` + `--ease-emphasis`. Reduced-motion: barra oculta
   (`display:none`), el timer JS sigue. Ventanas centralizadas en el módulo del toast (`ToastContext.tsx`):
   `DEFAULT_DURATION_MS` (4s, no-undo), `NEUTRAL_UNDO_DURATION_MS` (5s, reversible ligera),
   `ENTITY_DELETE_UNDO_DURATION_MS` (8s, entidad entera). Default **variant-aware**: `neutral` → 5s (reconcilia el
   drift 4s vs 5s). `DeliveryDetailClient` migrado al constante compartido.
   > **8s — honestidad de scope:** hoy NINGÚN delete/cancel de entidad usa toast-undo; esas acciones usan
   > modal-confirm irreversible (patrón `optimistic-client-updates.mdc`). El 8s queda **exportado y documentado**
   > como la ventana canónica para cuando exista un undo de entidad. **No** se fabricó un flujo delete-con-undo
   > (sería un cambio de producto fuera del scope de motion).
4. **`OrderDetailHero` progress fill scaleX.** `width %` (por frame vía `useAnimatedNumber`) →
   `transform: scaleX()` origin-left. El fill **pierde su `rounded-full`** (el track con `overflow-hidden
rounded-full` redondea el borde izquierdo; el derecho queda recto) para evitar la distorsión de border-radius
   bajo escala que el ADR flaggea (§8.2). Gradiente visualmente equivalente. Reduced-motion ya cubierto por el
   hook (snap). Los mini-bars de las cards de lista usan `width` **estático** (no animado) → fuera de scope.
5. **Gaps reduced-motion explícitos.** `motion-reduce:transition-none` en Switch **track** (el thumb ya lo
   tenía), MascotBubble **hover**, StoreCard (+ tokenización de los `150ms` literales → `var(--motion-fast)`).
   Stepper **bullet** + conector con `[transition-duration:var(--motion-fast)]` explícito. MascotBubble **menú**
   gana entrada sutil (keyframe `mascot-menu-pop`, `--ease-out-expressive`, reduced → none).
6. **Voice Fase B (audit de copy).** Drift dialectal neutralizado en i18n `es` (5 strings, 2 archivos):
   "Dale otra vez" → "Vuelve a intentarlo" (`components.button.commonLabels.retry`); "Elegí una opción/fecha" →
   "Elige…"; "Completá el paso…" → "Completa…"; "Primero creá una tienda" → "Primero crea…". Paridad `en` ya
   correcta en las 5. Auditoría de matriz: **paridad estructural es↔en perfecta** (16/16 archivos, sets de claves
   idénticos), **cero emoji** (sin emoji mal puesto), sin corporativismo / `usted` en copy de app, sin
   exclamaciones en errores. `principles.md §7` **no** se reescribe (docs histórico S1; el drift ya está
   flaggeado en `voice-library.md §4.1`).

### Validación

`npm run test` 542 ✅ · `type-check` ✅ · `lint` 0 errores (31 warnings pre-existentes) ✅ · `validate-build` ✅ ·
e2e `deliveries` (lifecycle journey: crear-desde-pedido → marcar-llegada → re-derivación) + `store-listing`
(detalle) ✅. Preview: la app bootea y renderiza limpio (sign-in, consola sin errores; el swap a
`ViewTransitionLink` no rompe hidratación — confirmado además por los e2e que navegan esas páginas).
**Pendiente de Sergio** (modelo del subproyecto — el agente no lo ejecuta): review visual light/dark/mobile
**+ con `prefers-reduced-motion` activo en el SO** + **spot-check Safari** para las view transitions.

### Cross-cutting flaggeado

- **S12.1 — `tailwindcss-animate` ausente (pre-existente):** las utilities `animate-in` / `zoom-in-50` que usan
  `Checkbox` y `Radio` (`motion-safe:animate-in motion-safe:zoom-in-50`) son **inertes** — no hay paquete
  `tailwindcss-animate` / `tw-animate-css` instalado ni `@plugin` en `globals.css`, así que Tailwind v4 no genera
  esas clases y el zoom-in del check no anima hoy (degrada a aparición instantánea). Fuera del scope de S12
  (instalarlo sería dependencia nueva → decisión ADR 0010). Registrado en `_notes/cross-cutting-changes.md`. Por
  esto la entrada del menú del Mascot se hizo con keyframe hand-rolled (`mascot-menu-pop`), no con `animate-in`.

### Rollout

- La VT en producción arranca **flag-off** (`list-detail-view-transitions` en PostHog); se rampea desde el
  dashboard. En dev/preview está ON para revisión. Al habilitar: monitorear errores de navegación (Sentry) +
  evaluación del flag. Patrón nuevo reusable `ViewTransitionLink` documentado en PLAYBOOK §11.
