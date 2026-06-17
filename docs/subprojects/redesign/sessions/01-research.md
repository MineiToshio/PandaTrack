---
title: Sesión 01 — Research + Auditoría + 3 direcciones
date: 2026-04-30
status: ✅ done
duration: una corrida desatendida
---

# S01 — Research externo, auditoría funcional y 3 direcciones creativas

## Qué corrió

1. **Paso 0:** creación del folder `docs/redesign/` con estructura objetivo y `README.md` como índice/memoria del subproyecto.
2. **Fase 1:** investigación externa con 4 sub-agentes en paralelo cubriendo Dribbble/Behance/Awwwards, apps reales (Mobbin + capturas), design systems dual-mode (M3 Expressive, Apple HIG, shadcn/Radix, Tailwind v4) y tendencias 2025–2026 (bento, neo-brutalism, claymorphism, Y2K, expressive editorial, glass, mascotas, motion).
3. **Fase 3:** auditoría funcional del código actual con 4 sub-agentes Explore en paralelo cubriendo rutas públicas, rutas privadas, formularios + schemas + flujos multi-paso, y mecánica de tema/i18n/layouts/componentes core.
4. **Fase 2:** decálogo UX/UI sintetizado a partir del research y de la doctrina (NN/g filtrado por Gen Z, _Refactoring UI_, M3, HIG, WCAG 2.2 AA).
5. **Fase 4:** 3 direcciones creativas genuinamente divergentes con paleta dual-mode completa, type system, spacing/radius, elevation, motion, iconografía, mascot/ilustración, voice & tone, modo hero, sample del dashboard (desktop + mobile, microinteracciones, estados, light/dark), anti-patrones y riesgos.
6. **Pasada final red team:** auto-revisión hostil contra 5 criterios. Sin objeciones bloqueantes — los artefactos pasaron sin cambios.

## Sub-agentes lanzados

Lanzados en paralelo en un solo mensaje (8 en total):

| #   | Tipo            | Misión                                                                                                                                                  | Resultado                                                                                 |
| --- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| A   | general-purpose | Dribbble + Behance + Awwwards (12+ refs)                                                                                                                | 12 refs por categoría con URL/patrón/modo/aplicabilidad                                   |
| B   | general-purpose | 16 apps reales (Cash App, Linear, Arc, Things, Raycast, Duolingo, BeReal, Letterboxd, Strava, POPMART, StockX, GOAT, Notion, Revolut, Monzo, Robinhood) | 16 entradas con patrones nav/type/color/motion                                            |
| C   | general-purpose | Design systems dual-mode (M3 Expressive, Apple HIG, shadcn/Radix, Tailwind v4, producción)                                                              | 6 secciones + 2 paletas dual-mode + 5 recetas reusables                                   |
| D   | general-purpose | Tendencias 2025–2026 (bento, brutalism, clay, Y2K, editorial, glass, mascotas, motion 2026)                                                             | ~30 refs con aplicabilidad y dark-mode-specific                                           |
| E   | Explore         | Rutas públicas + landing + auth                                                                                                                         | mapa de rutas + tabla funcional + 3 notas transversales                                   |
| F   | Explore         | Rutas privadas/admin (dashboard, orders, deliveries, stores, settings)                                                                                  | mapa jerárquico + tablas por área + sub-flujos + permisos + server actions                |
| G   | Explore         | Formularios + schemas Zod + flujos multi-paso                                                                                                           | 10 secciones detalladas (auth, orders, deliveries, stores, settings) + diagramas de flujo |
| H   | Explore         | Theme toggle + i18n + layouts + componentes core/modules                                                                                                | 5 secciones + tablas de componentes + utilidades en `src/lib`                             |

Síntesis propia de los outputs. No se pegó output crudo en los artefactos finales.

## Hallazgos clave

1. **Dark mode nunca es negro puro** — Linear, Vercel, Notion, Stripe, Monzo, Material 3 Expressive lo confirman. Las 3 direcciones aplican `oklch(11–16%)` con tinte cromático sutil.
2. **Tailwind v4 + OKLCH + `color-mix()` + `@theme`** es el stack técnico ideal para implementar paletas dual-mode con state layers M3-style sin duplicar tokens.
3. **View Transitions API + scroll-driven CSS + Vaul-style sheets** son el motion stack 2026 sin libs JS pesadas. Las 3 direcciones lo aprovechan.
4. **Mascot omnipresente fatiga; mascot escaso encanta.** Linear (Linny) > Duolingo (Duo) para audiencia 18–25 con coleccionables premium. Las 3 direcciones modulan esto distinto: whisper / protagonista 3D / sistema caretaker+personajes.
5. **El contrato funcional incluye optimistic updates con revert (pagos, entregas), modal de discrepancia (orden), detección de duplicados (tienda) y rate limiting con cooldowns server.** Cualquier rediseño debe preservarlos.

## Decisiones tomadas

- **Modo hero declarado por dirección** (regla del brief): Dir 1 dark serio, Dir 2 dark eléctrico, Dir 3 light cálido. Justificación en cada sección 1.3/2.3/3.3.
- **Vocabulario fijo de motion: 3 durations + 3 easings.** Aplicado por igual a las 3 direcciones, sólo varía la calibración (tiempos y bounce).
- **OKLCH como espacio de color universal** para todas las paletas. Implementación vía `@theme` Tailwind v4 con `dark:` activado por clase `.dark` (no media query) para permitir override + persistencia.
- **Mascot panda con dos lighting setups** (light/dark distintos), no flat asset coloreado al vuelo. Las 3 direcciones lo respetan.
- **Borders en dark vía `rgba(luz, alpha)` no gris fijo.** Mejor integración visual sobre cualquier surface.

## Supuestos asumidos

Documentados en `_notes/assumptions.md`. Resumen:

1. Modo hero default = dark; light es ciudadano paralelo no inferior.
2. Mascot panda existe como sistema, cada dirección lo modula.
3. Mobile-first real; samples se piensan primero en 360px.
4. Auditoría no incluye lectura línea-a-línea exhaustiva; los huecos se resuelven pantalla por pantalla en S2.
5. URLs de research son referenciales — autores y patrones reales, slug exacto puede haber rotado; validar en moodboards de S2.
6. Las paletas verifican AA por construcción; pasada formal en S3.
7. Sólo locales `es` y `en` con paridad.
8. S1 no toca código de la app — sólo `.md` en `docs/redesign/`.

## Archivos producidos

- `docs/redesign/README.md` (índice/memoria del subproyecto)
- `docs/redesign/research.md` (38 referencias clasificadas por superficie)
- `docs/redesign/principles.md` (decálogo UX/UI accionable)
- `docs/redesign/functional-inventory.md` (contrato funcional inviolable)
- `docs/redesign/directions.md` (3 direcciones completas)
- `docs/redesign/directions-comparison.md` (tabla puntuada + recomendación)
- `docs/redesign/sessions/01-research.md` (este archivo)
- `docs/redesign/_notes/assumptions.md` (supuestos asumidos)
- `docs/redesign/_notes/red-team.md` (pasada de revisión hostil)

Carpetas creadas vacías para sesiones futuras: `screens/`, `decisions/`.

## Lo que NO se hizo (intencionalmente)

- No se modificó código de la app (CSS, componentes, configs).
- No se escribió `direction-chosen.md` — esa decisión es del humano.
- No se ejecutó `npm run test/type-check/lint/validate-build` — S1 no cambia código de la app.
- No se hizo commit ni PR.

## Qué necesita la Sesión 2 para arrancar

1. **Decisión humana en `docs/redesign/direction-chosen.md`:** elegir una de las 3 direcciones (o una mezcla justificada de ellas). Documento corto: nombre de la dirección, ajustes de paleta/type/motion si los hay, comentarios sobre el sample del dashboard.
2. **Lectura previa para S2:** `README.md` → `principles.md` → `functional-inventory.md` → `direction-chosen.md` → la sección de la dirección elegida en `directions.md`.
3. **Alcance sugerido para S2:** wireframes de baja fidelidad de las 6 pantallas críticas — Dashboard, Orders list, Order detail, Order create, Delivery create, Settings. Tablet y mobile. Validar que la dirección elegida tolera el contrato funcional sin quebrar.
4. **Validación opcional pre-S2:** abrir 4–6 referencias clave de `research.md` en navegador para confirmar que los patrones citados siguen vigentes y capturar moodboards.

## Métricas de la sesión

- 8 sub-agentes lanzados en paralelo, 1 mensaje, 0 esperas humanas intermedias.
- 9 artefactos `.md` producidos, ~3.500 líneas markdown.
- 3 direcciones × 14 secciones cada una = ~42 decisiones de diseño documentadas.
- 38 referencias externas curadas.
- 26 rutas + ~25 sub-flujos documentados en el contrato funcional.
- 10 principios accionables sintetizados.
- 0 objeciones bloqueantes en red team.
