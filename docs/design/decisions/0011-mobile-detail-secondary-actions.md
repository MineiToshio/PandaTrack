---
title: ADR 0011 — Mobile detail-page secondary actions: inline card over bottom sheet
date: 2026-05-12
status: accepted
session: S7-A.6 — mobile topbar realignment + secondary actions pattern; extended 2026-05-12 in S7-A.7 (sticky bar single-primary + Pagos card state-aware default)
owner: Sergio Minei
trigger: S7-A.5 documented "Topbar mobile alignment a patrón implementación" as pending; user surfaced that the `⋯`/[Más] bottom sheet pattern for secondary actions on order detail is not intuitive and conflicts with the static `ContentHeader.tsx` shell
updates: redesign subproject — order list/detail/create/edit screen specs + cross-cutting register + demo (historical); design/interface-patterns.md
related: ADR 0003 D8 (FilterDrawer responsive), ADR 0008 (Modal canonical), ADR 0008 Extensión (adaptive modal pattern), ADR 0010 (UI primitive libraries policy)
---

# ADR 0011 — Mobile detail-page secondary actions: inline card over bottom sheet

## Contexto

`src/app/[locale]/(app)/_components/AppLayout/ContentHeader.tsx` (header mobile real implementado) es **estático cross-route**: contiene únicamente `[☰ hamburger]` + breadcrumb chain + título de página. No admite acciones contextuales per-page (no botones de "Editar", "⋯", "Volver", etc. en el chrome del header). Es una constraint dura del shell — no es negociable sin rediseñar `ContentHeader.tsx` y romper la coherencia cross-route.

Los demos mobile de S7 Fase A (S7-A.1 → S7-A.5) usaron un patrón divergente:

- Topbar mobile con `[← back-arrow]` + breadcrumb + `[⋯ overflow]` (o variante `[Más outline + label]` introducida en S7-A.5)
- Bottom sheet dedicado `#s7-order-detail-actions-mobile` con 4 acciones (Crear entrega, Editar, Cancelar, Eliminar) gatillado por el `⋯`/`[Más]` del sticky action bar inferior
- Sticky action bar mezclaba primary CTA + el trigger del overflow sheet

Esto genera dos problemas:

1. **Misalignment con la implementación shell.** El demo HTML promete un patrón que el `ContentHeader.tsx` real no puede entregar. Cuando se intente implementar Fase B Parte 1 de Orders, el agente encontrará que el back-arrow + ⋯ del demo no caben en el header y tendrá que improvisar.
2. **Acciones secundarias mal ubicadas.** El usuario reportó (2026-05-12) que el `⋯` icon-only "no es intuitivo" y que el patrón de bottom sheet activado por `⋯` rompe el flujo: hay que tap → sheet → leer 4 opciones → tap → cerrar. Para Editar (acción frecuente, no destructiva) eso es fricción innecesaria.

## Investigación externa

Agente research lanzado 2026-05-12, 25 fuentes consultadas. Hallazgos principales:

### Real apps (2024-2026)

- **Stripe Dashboard mobile**: secondary actions inline en cards de la página, no detrás de `⋯`.
- **Shopify Admin mobile**: "More actions" explícitamente labelled (no kebab) inline en el cuerpo del order detail.
- **Linear mobile**: edición inline directa sobre el contenido; destructiva ("Delete") en menú aparte (no en el detail principal).
- **GitHub Mobile**: action panel con filas labelled; "Danger Zone" solo en Settings repo (no en issues/PRs single-entity).
- **Apple Calendar (event detail)**: "Delete Event" como botón rojo full-width al **final del scroll**, dentro del mismo form, sin separación visual de Danger Zone.
- **Apple Wallet / Mercado Libre / Revolut**: mismo patrón — acciones secundarias como filas labelled en card al pie del detail, destructiva al final en rojo, sin Danger Zone separada para single-entity.

### Guidelines

- **Apple HIG (Toolbars + Action sheets)**: navegación + acción más importante en nav bar; secundarias en bottom toolbar; destructiva como botón rojo full-width al pie del form.
- **Android Material 3 (2025)**: secondary actions inline en top bar o agrupadas con contenido relacionado en el cuerpo de la página; overflow menus solo para acciones "not promptly or frequently needed".
- **Material 3 Expressive (Google I/O 2025)**: **deprecó el speed-dial / FAB-stack** y movió hacia FAB Menu (panel labelled anclado, no kebab).
- **NN/g — Bottom sheets**: "aren't suited for displaying always-needed tools".
- **NN/g — Contextual menus**: "Don't use contextual menus to hide one or two items that could easily be accommodated within available space, as hiding actions behind a kebab or meatball icon saves no space, increases effort, and reduces discoverability."
- **NN/g — Thumb zone**: bottom third = easy zone (reservar para primary CTA); stretch zone para secundarias con menor frecuencia.
- **Smashing + UX Movement (destructive actions)**: confirm dialog + color rojo + posición al final del flujo. Danger Zone separada es patrón de SETTINGS desktop (GitHub, Vercel, AWS) cuando hay múltiples destructivas; **no aplica** a detail-screen single-entity con UNA destructiva.

## Tensión y opciones evaluadas

### A. Sticky expandable action bar (chevron que abre menú desde sticky)

- **Pros**: thumb-reachable. Mantiene primary CTA visible.
- **Cons**: cero precedente en apps reales a escala de detail screen; conflict-prone con primary CTA (mis-tap risk en `[Anotar pago]` vs chevron); requiere `aria-expanded`, focus trap, animación; sticky bar deja de ser single-purpose.
- **Veredicto**: rechazada.

### B. Inline card "Acciones" al pie del scroll + Danger Zone separada (con Eliminar)

- **Pros**: discoverable; labelled; sin conflicto con sticky CTA; alineada con guidelines.
- **Cons**: dos cards apiladas para 3 acciones es overkill en mobile; el patrón "Danger Zone" es de settings desktop, no de detail single-entity; visualmente le da a Eliminar más prominencia de la que necesita en una pantalla de pedido único.
- **Veredicto**: descartada tras feedback humano 2026-05-12.

### C. Inline card "Acciones" única, fila destructiva al final en rojo + divider sutil arriba

- **Pros**: matches Apple HIG iOS canon (Calendar event edit, Reminders edit, Contacts); minimal visual weight; Eliminar se comunica como "una opción más" sin alarmismo; confirm dialog con type-to-confirm "eliminar" sigue siendo la barrera real; menos código, menos CSS.
- **Cons**: usuario "veloz" podría tappear Eliminar por accidente — mitigado por el confirm dialog type-to-confirm que ya existe y por la posición al final (requiere intención).
- **Veredicto**: **adoptada.**

## Decisión

### Patrón canónico mobile para secondary actions en detail screens

Al pie del scroll del page content, antes de la sticky action bar inferior, una sola card `.s7-mob-actions-card` con eyebrow "Acciones" y lista de filas tap-able:

```text
┌─ ACCIONES ────────────────┐
│ ✏  Editar X            ›  │  ← acción frecuente, no destructiva
│ ⊘  Cancelar X          ›  │  ← acción reversible (mid-priority)
│ ──────── (divider sutil)   │
│ 🗑  Eliminar X          ›  │  ← destructiva irreversible, color rojo
└────────────────────────────┘
```

### Reglas

1. **Una sola card "Acciones"**. NO Danger Zone separada para single-entity detail.
2. **Fila destructiva siempre al final**, con color rojo (`var(--destructive)`), icono `trash-2`, y CSS divider sutil arriba via `::before` (solo si `:not(:first-child)`).
3. **Fila reversible (ej. Cancelar pedido) vive como neutra**, no como destructiva. Patrón Linear-style (Archive vs Delete).
4. **Sticky action bar inferior queda single-purpose**: solo CTAs primarios del estado. **Sin botón `[Más]` ni icono `⋯`**.
5. **Topbar mobile estricto**: `[☰ hamburger]` + breadcrumb chain + título. Sin acciones contextuales per-page.
6. **Back-link en page content**: justo debajo del topbar, da una salida thumb-reachable. El breadcrumb del header también funciona pero está en zona dura.
7. **Confirm dialog** sigue siendo obligatorio para destructivas irreversibles (type-to-confirm con palabra "eliminar"). El visual rojo + divider no reemplaza la confirmación — la complementa.
8. **State-aware visibility**:
   - Si una fila no aplica al estado actual del objeto (ej. "Editar" para un pedido cancelado, "Cancelar" para uno ya cancelado), **se oculta** (no se renderiza disabled).
   - Si después de filtrar solo queda la destructiva, la card sigue presente pero **sin divider arriba** (queda first-child).
9. **Mismo patrón cross-viewport**: en desktop, esta card aparece en el right rail o al final de la sección de detail (no migrar a header buttons). Una única norma para mobile y desktop reduce divergencia y simplifica el componente.

### Aplicabilidad

Aplicable a cualquier detail screen de objeto único en PandaTrack:

- ✅ Order detail (S7) — primer caso, este ADR
- ⬜ Store detail (S6) — pendiente migrar en mini-sesión cuando se aborde
- ⬜ Delivery detail (S8) — usar este pattern desde día 1
- ⬜ Item detail si llega a existir como pantalla aparte

### Estado por estado en Order detail

| Estado del pedido | Filas de la card "Acciones"            |
| ----------------- | -------------------------------------- |
| Activo            | Editar · Cancelar · ─ · **Eliminar**   |
| Atrasado          | Editar · Cancelar · ─ · **Eliminar**   |
| Impago            | Editar · Cancelar · ─ · **Eliminar**   |
| Cancelado         | **Eliminar** (única fila, sin divider) |

> **Cancelado:** no se puede editar (el flujo es reactivar primero — primary CTA en sticky bar); no se puede cancelar (ya está cancelado). Solo queda Eliminar.

### Sticky bar single-purpose por estado

| Estado    | Sticky CTA(s)                                                         |
| --------- | --------------------------------------------------------------------- |
| Activo    | `[Anotar pago (primary flex:1)]` · `[Crear entrega (primary flex:1)]` |
| Atrasado  | `[Pagar saldo (primary flex:1)]` · `[Entrega (primary flex:1)]`       |
| Impago    | `[Saldar $X (primary flex:1)]`                                        |
| Cancelado | `[Reactivar pedido (primary flex:1)]`                                 |

## Implementación

### Demo HTML

- CSS: `.s7-mob-actions-card` + `.s7-mob-actions-card-title` + `.s7-mob-action-list` + `.s7-mob-action-row.is-destructive:not(:first-child)::before` (divider).
- CSS: `.s7-mob-back-link` (back-link en page content).
- Topbar canónico aplicado a los 21 anchors mobile que tienen `app-topbar` visible (4 detail + 3 modal overlays + 6 create + 1 edit + 4 list + 3 pickers; las fullsheets y el filter drawer no tienen app-topbar a migrar).
- Anchor eliminado: `#s7-order-detail-actions-mobile`. Referencias del demo-nav y del index limpiadas.
- `[Más]` removido de los 4 sticky action bars de detail mobile.

### Componentes futuros en `src/`

Cuando se implemente Fase B Parte 2 (detail) de Orders, crear:

- `<DetailActionCard>` (`src/components/modules/DetailActionCard/`) con props `actions: DetailAction[]`, cada acción `{ icon, label, href | onClick, variant: 'default' | 'destructive', disabled? }`.
- Componente reusable cross-module (Order, Store, Delivery).
- Reuse de `.s7-mob-action-row` / `.s7-mob-actions-card` styles existentes (promoverlos al design system si crecen).
- Migración optimista vía Server Action (`<form action={...}>` o `useTransition`) para Eliminar/Cancelar — ver `optimistic-client-updates.mdc`.

### Confirm dialogs

Sin cambios en este ADR. Los confirm dialogs ya existen como `<Modal>` adaptive (ADR 0008 Extensión 2026-05-11):

- `#s7-order-detail-delete-modal` / `#s7-order-detail-delete-mobile` — type-to-confirm "eliminar".
- `#s7-order-detail-cancel-modal` / `#s7-order-detail-cancel-mobile` — textarea opcional "motivo".

Las filas de la card "Acciones" abren estos modals; no se ejecuta nada destructivo directamente desde la card.

## Consecuencias

### Positivas

- **Discoverability máxima** para Editar (acción frecuente). Pasa de "tap ⋯ → leer 4 opciones → tap" a "scroll al final → tap".
- **Sticky bar single-purpose** elimina conflicto entre primary CTA y disclosure de secundarias.
- **Alineación con shell real**: el demo deja de prometer un header con acciones contextuales que `ContentHeader.tsx` no puede entregar.
- **Cross-viewport coherente**: mismo patrón mobile + desktop reduce mantenimiento.
- **Menos código y CSS**: eliminada section `#s7-order-detail-actions-mobile` + variantes de `[Más]` button + (en commit posterior) variant `.s7-mob-actions-card.is-danger` que se evaluó en draft.

### Negativas

- **Scroll requerido** para llegar a las acciones secundarias. Mitigado por: (1) el detail no es excesivamente largo en mobile (~3-4 subcards); (2) Editar es frecuente pero no urgente — el scroll es aceptable; (3) las acciones primarias (Anotar pago, Crear entrega, etc.) siguen sticky.
- **Breaking visual** con la versión del demo previa a S7-A.6 — cualquier captura/wireframe externo del módulo Orders mobile queda desactualizada.

### Migración

- ✅ Demo HTML: ejecutada en S7-A.6.
- ✅ Specs de los 4 order screens: actualizadas en S7-A.6.
- ⬜ Implementación en `src/`: pendiente de Fase B Parte 2. Sin breaking change en `src/` porque la pantalla no está implementada todavía.

## Extensión 2026-05-12 — Jerarquía single-primary en sticky bar + Pagos card state-aware

Post-implementación de S7-A.6 (2026-05-12 mismo día) el usuario surfaced dos refinements que afectan al patrón canónico de detail-screen mobile:

### 1. Anti-duplication: una sola entrada para "Anotar pago"

S7-A.6 dejó **dos entradas** para "Anotar pago" en el detalle mobile activo:

- Botón primary en la sticky bar (canónico de §5.8)
- Botón primary inline dentro de la subcard "Pagos" expandida

Esto es duplicación pura (misma acción, mismo target, sin diferenciación semántica). En contraste, "Crear entrega" tiene dos entradas legítimamente distintas:

- Botón en sticky bar → abre form vacío
- Ghost button "Crear entrega con estos productos" dentro de la subcard "Productos" → pre-selecciona los items pendientes (atajo contextual)

**Decisión adoptada (Option Z):** el sticky bar es la **single source of truth** para los CTAs primary del estado. Se eliminan las entradas duplicadas de la card "Pagos" interna. Los atajos contextuales (como "Crear entrega con estos productos") sobreviven solo cuando aportan semántica distinta del CTA del sticky bar.

### 2. Jerarquía single-primary en sticky bar con 2 botones

S7-A.6 implementó sticky bars con dos botones `.btn.primary` (purple bg + white text) compitiendo entre sí. Material 3 + UX Planet son explícitos: **"one high-emphasis button per context"**. Dos buttons primary degradan la jerarquía y obligan al usuario a decidir.

Research (2026-05-12, 10+ fuentes citadas):

- **Apple HIG (Toolbars)**: "Primary actions on the trailing edge" → primary a la derecha.
- **Material 3 (Dialogs)**: "Affirmative actions are placed on the right side."
- **Gutenberg reading-gravity**: el peso visual del flujo de lectura termina en la esquina inferior-derecha — primary derecha completa más rápido la tarea.
- **NN/g + Smashing thumb zone**: bottom-right es la "easy zone" para usuarios diestros (75% de la población).
- **SubUX / UX Planet**: button hierarchy = primary por frecuencia analítica + tonal/outline para alternos coexistentes.

**Decisión adoptada:**

| Aspecto                      | Regla                                                                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Cantidad de primary          | **Un solo `.btn.primary`** por sticky bar                                                                                         |
| Variant del secundario       | **`.btn.accent`** (tonal — purple light bg + purple text + purple border 28%). Misma familia de color que el primary; no compite  |
| Posición del primary         | **Derecha** (Apple HIG + M3 + Gutenberg + thumb zone)                                                                             |
| Criterio para elegir primary | **Frecuencia de uso esperada + FRD priority.** En PandaTrack: pago > entrega (FRD #3 vs #4; 2–3 pagos vs 1–2 entregas por pedido) |

Aplicabilidad cross-module:

- Order detail (S7) — aplicado: pago = primary, entrega = secundario.
- Store detail (S6) — pendiente migrar: si llega a tener 2 acciones en sticky bar, evaluar primary por FRD priority + frecuencia.
- Delivery detail (S8) — usar el pattern desde día 1: si hay 2 acciones, primary = la más frecuente; secundario = `.btn.accent` izquierda.
- Item detail si aparece — mismo pattern.

### 3. Defaults state-aware de subcards (Pagos)

S7-A.6 mantuvo Pagos collapsed por default. Re-evaluación con research (NN/g sobre acordeones, real apps como Mercado Libre / Shopify / Stripe / banking apps):

- Acordeones esconden discoverability — usarlos solo para contenido "sometimes relevant"
- Pagos es **siempre relevante** cuando hay saldo pendiente (es la acción esperada)
- Pagos es **histórico** cuando saldo = 0 (puede ir collapsed)

**Decisión adoptada:**

- Productos: **always open**.
- **Pagos: open cuando `saldo > 0` (activo/atrasado/impago); collapsed cuando `saldo = 0`** (cancelado, pagado completo).
- Nota privada: **always collapsed** (textarea voluminosa, baja frecuencia; el header con "✓ Guardada" cubre el caso informativo).
- Historial (cuando aplica): collapsed.

### Implicaciones de implementación

- `<DetailActionCard>` (futuro componente `src/components/modules/DetailActionCard/`) **no cambia** — sigue el patrón de la sección "Implementación" arriba.
- Nuevo componente potencial `<DetailStickyActionBar>` (`src/components/modules/DetailStickyActionBar/`) que acepta `primaryAction` + `secondaryAction?` con validación: máximo 1 primary, secundario forzado a `.btn.accent` con posición izquierda, primary forzado a posición derecha. Implementar cuando se aborde Fase B Parte 2.
- Subcards con estado inicial: si el componente `<Subcard>` ya existe en `src/`, agregar prop `initiallyOpen?: boolean` para permitir defaults state-aware desde el componente padre. Si no existe, implementarlo en Fase B Parte 2.

## Notas

- ADR 0011 NO modifica ADR 0008 (Modal canonical) ni ADR 0008 Extensión (Modal adaptive). Los confirm dialogs siguen usando `<Modal>` adaptive sin cambios.
- ADR 0011 NO modifica ADR 0010 (UI libraries policy). No se agregan deps.
- Si en el futuro un detail screen requiere **múltiples** acciones destructivas (ej. Transfer ownership + Delete + Archive en Store settings), evaluar si entonces sí amerita Danger Zone separada — abrir un nuevo ADR de extensión, no modificar éste.

## Referencias

- Apple HIG — Toolbars: <https://developer.apple.com/design/human-interface-guidelines/toolbars>
- Apple HIG — Action sheets: <https://developer.apple.com/design/human-interface-guidelines/action-sheets>
- Material 3 — FAB Menu (replaces speed dial): <https://github.com/material-components/material-components-android/blob/master/docs/components/FloatingActionButtonMenu.md>
- NN/g — Bottom sheets: <https://www.nngroup.com/articles/bottom-sheet/>
- NN/g — Designing Effective Contextual Menus: <https://www.nngroup.com/articles/contextual-menus-guidelines/>
- NN/g — Thumb Zone: <https://www.smashingmagazine.com/2016/09/the-thumb-zone-designing-for-mobile-users/>
- Smashing — Manage Dangerous Actions: <https://www.smashingmagazine.com/2024/09/how-manage-dangerous-actions-user-interfaces/>
- Stripe Dashboard mobile: <https://docs.stripe.com/dashboard/mobile>
- Linear — Delete and archive issues: <https://linear.app/docs/delete-archive-issues>
- Material 3 — Dialogs Guidelines (affirmative right rule): <https://m3.material.io/components/dialogs/guidelines>
- Material 3 — Bottom App Bar Guidelines: <https://m3.material.io/components/bottom-app-bar/guidelines>
- UX Movement — Optimal Placement for Mobile CTAs: <https://uxmovement.com/mobile/optimal-placement-for-mobile-call-to-action-buttons/>
- UX Planet — Primary & Secondary Action Buttons (Nick Babich): <https://uxplanet.org/primary-secondary-action-buttons-c16df9b36150>
- SubUX — Button hierarchy (primary, secondary, tertiary): <https://subux.pro/guides/article/button-hierarchy-primary-secondary-tertiary>
- Brainstorm Ergonomics — Dialog Button Order: <https://www.brainstormergonomics.com/blog/dialog-button-order-design/>
- ADR 0008 — Modal enhancement (canonical pattern): `../decisions/0008-modal-enhancement.md`
- ADR 0010 — UI primitive libraries policy: `../decisions/0010-ui-primitive-libraries-policy.md`
- `ContentHeader.tsx` (shell real): `src/app/[locale]/(app)/_components/AppLayout/ContentHeader.tsx`
