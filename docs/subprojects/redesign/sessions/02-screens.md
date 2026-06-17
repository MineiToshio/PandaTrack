---
title: Sesión 02 — Wireframes de pantallas críticas
date: 2026-05-01
status: ✅ done + post-closure ADR
duration: dos corridas desatendidas (6 sub-agentes diseño + 5 sub-agentes research)
---

> **Adendum 2026-05-01 (post-cierre).** Tras una pasada de research con 5 sub-agentes en paralelo (apps revisadas: Linear, Stripe, Vercel, Notion, Shopify, Apple, GitHub, Cash App, YNAB, Pokémon Center, FedEx, Carbon, Polaris, Things 3, Gmail, Sonner), se cerraron las 19 decisiones pendientes en [`decisions/0001-s2-closure-decisions.md`](../decisions/0001-s2-closure-decisions.md). Los 4 gaps de `atelier-gaps.md` quedaron resueltos y los 41 supuestos de `assumptions-s2.md` se marcaron como **28 ✅ Confirmed / 8 ⚙️ Changed / 5 ⏳ Pending validation**. Cada wireframe afectado lleva un addendum al inicio que apunta al ADR. La Sesión 3 puede arrancar sin bloqueantes. Documentos de research: `_notes/research-status-colors.md`, `_notes/research-form-patterns.md`, `_notes/research-toasts-lifecycle.md`, `_notes/research-dashboard-lists.md`, `_notes/research-settings-avatar.md`.

# S02 — Wireframes lo-fi de las 6 pantallas críticas

## Qué corrió

1. **Paso 0:** lectura del subproyecto en orden (`README.md` → `direction-chosen.md` → `principles.md` → `directions.md` §4 Bento Atelier → `functional-inventory.md` → `sessions/01-research.md`).
2. **Fase 1 — diseño en paralelo:** se lanzaron **6 sub-agentes generales en un solo mensaje**, uno por pantalla crítica. Cada sub-agente recibió un brief auto-contenido con: dirección Atelier, decálogo, ítem de inventario funcional, estructura obligatoria de 10 secciones, reglas duras (mobile-first 360px, light/dark, voice glosario, no inventar tokens, no TODOs). Cada uno escribió directo a `docs/redesign/screens/<slug>.md` y devolvió un resumen ≤180 palabras.
3. **Fase 2 — pasada de consistencia cross-screen:** se verificó:
   - Convención `view-transition-name` (corregida a `order-{humanId}` en los 3 archivos que la mencionan).
   - Receta única de avatar tienda (logo o letra inicial sobre tinte indigo 14% + border 28%) — consistente.
   - Patrón section cards (`radius-xl`, padding 24/28 desktop / 20 mobile, eyebrow neutro mono `--text-muted`, sin tinte cromático) — consistente entre order-create / delivery-create / settings.
   - Mascota en posiciones canónicas únicamente (bubble idle ubicua, walking sólo `/dashboard` desktop, sleeping en empty hero, celebrating en achievement explícito) — consistente.
   - Voice glosario `principles.md §7` (`tú`, sin "usted", sin "por favor", sin meme storm) — cero anti-patrones detectados vía grep.
   - Eyebrow uppercase mono `--text-muted` con tracking +0.08em — consistente.
   - Categoría = ícono Lucide en `--accent-cool` teal — consistente; paleta categórica nunca invocada como decoración.
4. **Fase 3 — red team:** chequeos hostiles contra los 10 criterios del brief × 6 pantallas. Iteraciones aplicadas sobre `view-transition-name` y documentación de 4 huecos en `_notes/atelier-gaps.md`. Pasada cierra con objeciones vacías.
5. **Fase 4 — documentación de soporte:** se escribieron `_notes/s2-red-team.md`, `_notes/s2-validation-plan.md`, `_notes/assumptions-s2.md`. El archivo `_notes/atelier-gaps.md` lo creó el agente de delivery-create durante su corrida.
6. **Fase 5 — cierre:** este archivo + actualización del `README.md` (S2 marcada done, S3 next, mapa actualizado).

## Sub-agentes lanzados

Lanzados en paralelo en **un solo mensaje** (6 en total, todos `general-purpose`):

| #   | Pantalla        | Slug                 | Líneas finales | Duración | Tokens | Resultado clave                                                                                                                                                    |
| --- | --------------- | -------------------- | -------------- | -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| α   | Dashboard       | `dashboard.md`       | 448            | 290s     | ~100k  | Bento mobile 3 folds + bento desktop 12-col + walking strip + empty hero con mascota sleeping. Sin gaps abiertos.                                                  |
| β   | Orders list     | `orders-list.md`     | 339            | 243s     | ~98k   | Densa 36px desktop, infinite scroll mobile vs paginación clásica desktop, filter rail sticky desktop / sheet bottom mobile, peek panel toggleable. Sin gaps.       |
| γ   | Order detail    | `order-detail.md`    | 270            | 180s     | ~94k   | Layout 2-col desktop con sidebar Resumen+Acciones+Nota; sub-cards Items + Pagos expandidos por default; hero target del view-transition canónica. Sin gaps.        |
| δ   | Order create    | `order-create.md`    | 329            | 198s     | ~97k   | 5 section cards (Tienda · Fechas · Items · Costos · Nota); modal de discrepancia 12.a; gate "sin tiendas" con mascota sleeping. Sin gaps.                          |
| ε   | Delivery create | `delivery-create.md` | 317            | 224s     | ~88k   | 4 section cards; prefill `sourceOrderId` con badge read-only; productos agrupados por orden con select-all; **abrió 4 gaps** en `atelier-gaps.md`.                 |
| ζ   | Settings        | `settings.md`        | 231            | 153s     | ~84k   | Desktop tabs verticales cols 1-3 + contenido cols 4-12; mobile 3 cards stackeadas con primera abierta; sin mascota (toggle "mostrar mascota" vive aquí). Sin gaps. |

Síntesis propia post-paralelo. No se pegó output crudo en los artefactos finales — el agente principal (yo) hizo la pasada de consistencia y red team antes de cerrar.

## Hallazgos clave

1. **El patrón Atelier (5 section cards + step indicator full-width + sidebar Resumen+Atajos + footer sticky) es transferible directo de "Nueva tienda" §4.13 a order-create y delivery-create**, sólo cambia la cantidad de cards (5 → 4) y el contenido. La firma se mantiene.
2. **La firma view-transition `order-{humanId}` es el cruce más frágil del rediseño** — los 3 archivos que la usan (orders-list, order-detail, dashboard) inicialmente declararon convenciones distintas (`order-X`, `order-{id}`, `order-{humanId}`). Sin ADR vinculante en S3, la firma se romperá silenciosamente en S6+. Recomendación elevada al red-team.
3. **La paleta categórica está bien reservada en los 6 wireframes** — ningún agente la invocó como decoración (avatares neutros, chips con ícono Lucide teal, status colors funcionales). Prueba de que la decisión post-rev 2 era correcta.
4. **`--warning` para "Aún no llega"** (delivery-create) es el primer caso donde la tabla §4.4 no cubre el matiz. Documentado como gap #1 — Validation #4 del plan resuelve.
5. **Mobile NO pasea, en serio nunca** — los 6 agentes respetaron la regla §4.10 sin necesidad de recordatorio adicional. Bubble idle sí en mobile, walking strip sólo en `/dashboard` desktop.
6. **`<StoreAvatar>` es la receta más replicada del subproyecto** — aparece en dashboard, orders-list, order-detail, order-create (combobox), delivery-create (combobox), settings (avatar usuario). Debe ser el primer componente core en S4.
7. **Voice glosario `principles.md §7` es trivial de cumplir cuando está bien especificado** — los 6 agentes generaron 30+ strings i18n sin anti-patrones detectables vía grep (`usted`, `por favor`, `bestie`, etc.).

## Decisiones tomadas

- **Convención de view-transition `order-{humanId}`** unificada en los 3 archivos que la usan; reforzada en `order-detail.md §6` con la frase "Convención de nombre vinculante".
- **`<StoreAvatar>` componente** elevado a prioridad alta en S4 con sizes 24/32/40/56 documentado en `assumptions-s2.md` T2.
- **Paleta categórica permanece reservada** sin invocaciones como decoración en S2.
- **Mascota fuera del flujo de form active** y de delete/cancel/error inline — sólo en empty hero, achievement explícito y error 500.
- **Modal de discrepancia 12.a** = bottom sheet mobile / center modal desktop con 3 CTAs nombradas explícitamente ("Usar ingresado" / "Usar calculado" / "Volver"), sin tono destructive.
- **Layout settings desktop = Opción A** (tabs verticales cols 1-3 + contenido cols 4-12).
- **Patrón "input pre-llenado / read-only"** identificado como gap del sistema (gap #2 atelier-gaps).

## Supuestos asumidos

Documentados en detalle en `_notes/assumptions-s2.md`. Resumen:

- **5 transversales:** convención view-transition, `<StoreAvatar>`, shell con sidebar+tabbar+bubble, locale default `es`, theme toggle dual (shell + settings).
- **5 dashboard:** FRD futuro de KPIs, walking cooldown localStorage, toggle mascota como campo de preferences, `⌘K` aspiracional, stub deliveries puede caer al error individual.
- **6 orders-list:** densa default, sort default "Más recientes", filtros no persisten cross-session, infinite scroll mobile vs paginación desktop, avatar fallback con 1 letra, gate "sin tiendas" como variante del empty.
- **6 order-detail:** pagos no paginan, historial lazy on expand, layout 2-col desktop, "Crear entrega" en sidebar Acciones, lifecycle en sub-card Acciones colapsada, autosave nota throttle 1.5s.
- **6 order-create:** 5 cards específicas, items mínimo recomendado 1, step indicator navegable libre hacia atrás, autosave local-only, modal discrepancia con tres CTAs sin destructive, atajo "Crear nueva tienda" inline en combobox.
- **6 delivery-create:** 4 cards específicas, prefill desde sourceOrderId arranca en paso 2, productos pre-seleccionados, chips warning/success por estado, toast con undo tras select-all ≥10, split shipment se infiere.
- **7 settings:** Opción A desktop, edit inline salvo casos sensibles, toggle mascota en Preferences, theme toggle dual, cooldown username visible, MFA fuera de scope S2, "cerrar sesión en todos los dispositivos" como ghost destructive si capability existe.

## Archivos producidos

- `docs/redesign/screens/dashboard.md` (448 líneas)
- `docs/redesign/screens/orders-list.md` (339 líneas)
- `docs/redesign/screens/order-detail.md` (270 líneas)
- `docs/redesign/screens/order-create.md` (329 líneas)
- `docs/redesign/screens/delivery-create.md` (317 líneas)
- `docs/redesign/screens/settings.md` (231 líneas)
- `docs/redesign/_notes/atelier-gaps.md` (4 gaps abiertos)
- `docs/redesign/_notes/s2-red-team.md` (objeciones vacías)
- `docs/redesign/_notes/s2-validation-plan.md` (5 validaciones documentadas)
- `docs/redesign/_notes/assumptions-s2.md` (5 transversales + 36 por pantalla)
- `docs/redesign/sessions/02-screens.md` (este archivo)

Total ~2.700 líneas markdown agregadas en S2.

Actualizado en este cierre:

- `docs/redesign/README.md` — S2 marcada ✅ done, S3 marcada 🟡 next; mapa de archivos actualizado con `screens/`, `_notes/atelier-gaps.md`, `_notes/s2-*.md`; sección "Cómo leer este folder" extendida con orden post-S2.

## Lo que NO se hizo (intencionalmente)

- **No se ejecutaron las 5 validaciones con usuarios reales** — eso es trabajo humano fuera del agente, documentado en `_notes/s2-validation-plan.md` para que el humano lo corra.
- **No se rediseñaron pantallas no críticas** (auth, onboarding, landing, OG, settings avanzados) — viven en S10+.
- **No se hicieron mocks hi-fi ni tokens nuevos** — eso es S3 (tokens) y S6+ (hi-fi).
- **No se construyeron componentes** — eso es S4.
- **No se modificó código de la app** — S2 sólo `.md` en `docs/redesign/`.
- **No se ignoró `docs/design/` actual conscientemente** — Regla Cero respetada.
- **No se hizo commit ni PR** — fuera del alcance del agente.

## Métricas de la sesión

- **6 sub-agentes** lanzados en paralelo en 1 solo mensaje, sin esperas humanas intermedias.
- **11 archivos** `.md` producidos (6 wireframes + 4 notas + 1 session log).
- **~2.700 líneas** markdown agregadas.
- **4 gaps de Atelier** abiertos en `atelier-gaps.md` para resolución en S3.
- **5 validaciones** documentadas con criterio pass/fail explícito.
- **41 supuestos** registrados (5 transversales + 36 por pantalla).
- **0 objeciones bloqueantes** en red team final.
- **0 TODOs** en los wireframes finales.
- **30+ strings i18n** propuestas con clave sugerida.

## Qué necesita la Sesión 3 para arrancar

1. **El humano revisa los 6 wireframes** y registra correcciones puntuales en cada `screens/*.md` o anota desacuerdos en `assumptions-s2.md`.
2. **Ejecutar las 5 validaciones** del plan en `_notes/s2-validation-plan.md` (orden recomendado: 4 → 1 → 5 → 2 → 3). Resultados se registran en `_notes/s2-validation-results.md` (a crear).
3. **Resolver los 4 gaps** abiertos en `_notes/atelier-gaps.md`:
   - Tono de `--warning` para "Aún no llega" (atado a Validation #4).
   - Patrón canónico de input pre-llenado / read-only.
   - Estado `disabled-gated` para section cards.
   - Toast neutral con undo.
4. **Elevar a ADR la convención `view-transition-name: order-{humanId}`** en `decisions/` antes de empezar S3.
5. **Si las validaciones pasan,** lanzar Sesión 3 — Sistema de tokens dual-mode con OKLCH + `@theme` Tailwind v4 + state layers M3 (los 4 gaps + las recetas confirmadas en S2).
6. **Si ≥3 validaciones fallan,** reabrir la pregunta "¿Atelier sigue siendo la dirección?" en una sub-sesión humana antes de S3.
