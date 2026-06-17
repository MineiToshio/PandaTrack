---
title: Research — Toasts con undo + lifecycle de acciones destructivas
session: 02-postresearch
last_updated: 2026-05-01
---

# Research — Toasts + lifecycle

Investigación para resolver gap #4 de Atelier (toast neutral con undo) y los supuestos OD4 / OD5 de `assumptions-s2.md` (ubicación de "Crear entrega" y de cancel/reactivate/delete en order-detail). Cada sección compara recetas reales del producto líder, propone una receta concreta para Bento Atelier, y se cuestiona a sí misma antes de cerrar.

---

## A. Toast con undo

### A.1. Hallazgos por app

| App                 | Posición                                               | Duración undo                                             | Ícono                                 | Countdown visual                                      | CTA "Undo"                          | Accesibilidad observable                                                                    |
| ------------------- | ------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------- |
| Linear              | Bottom-center                                          | ~5 s                                                      | Sin ícono leading; sólo copy + acción | No (fade out al cerrar)                               | Texto subrayado tipo link inline    | `aria-live=polite`; `Esc` dismiss; foco no robado                                           |
| Things 3 (iOS)      | Bottom-center, sobre tab bar                           | ~5 s                                                      | Sin ícono                             | Sutil progress hairline en algunas builds             | Botón ghost "Undo"                  | VoiceOver anuncia el toast; gesto de swipe lo descarta                                      |
| Gmail (web)         | Bottom-left                                            | ~5 s default (configurable 5/10/20/30)                    | Sin ícono                             | No                                                    | Link "Undo" + "View message" inline | `role=alert` + `aria-live=assertive`; `z` keyboard shortcut para undo                       |
| Notion              | Bottom-center                                          | Soft delete con trash semi-permanente; toast efímero ~3 s | Ícono `trash` discreto                | No                                                    | "Undo" link                         | `aria-live=polite`; trash separada accesible vía menú permite recuperación tardía           |
| Apple Notes (macOS) | Sin toast — `⌘Z` undo nativo + Recently Deleted folder | N/A                                                       | N/A                                   | N/A                                                   | N/A                                 | Confía en undo nativo del sistema                                                           |
| iOS swipe-to-delete | N/A — hay confirm contextual, no undo toast            | N/A                                                       | Botón rojo "Delete" inline            | N/A                                                   | N/A                                 | Confirmación destructiva inmediata; no se ofrece undo a nivel de OS                         |
| Sonner (lib base)   | Default bottom-right                                   | Default 4000 ms                                           | Opcional por tipo                     | No por default; hay variantes con progress bar custom | `action` prop renderiza botón       | `aria-live=polite` para info, `aria-live=assertive` para error; `dismissible: true` default |

### A.2. Patrón dominante

1. **Posición:** bottom-center mobile, bottom-right desktop. Linear/Things/Notion convergen en bottom-center; Sonner (la librería que probablemente usaremos) default es bottom-right en desktop. Ambas son aceptables — la regla real es **lejos del foco activo y nunca tapando el control que disparó la acción**.
2. **Duración:** **5 s es el consenso** (Linear, Things, Gmail default). Sonner default 4 s se siente apurado para un undo destructivo; Gmail permite hasta 30 s pero el default sigue siendo 5. Para PandaTrack: 5 s en mutations reversibles "ligeras" (mass-select, soft-delete pago); 8 s en delete de pedido entero (más datos en juego, más derecho a tiempo).
3. **Ícono:** **sin ícono leading** en el patrón mayoritario para neutralidad. Excepción: si el toast comunica éxito (`check`) o error (`alert-triangle`), entra ícono. El toast neutral con undo deja la copy como protagonista.
4. **Countdown visual:** **mayoría no lo muestra**. Las únicas que lo muestran (Sonner custom, algunas builds de Things) lo presentan como hairline progress bar 1–2 px en el borde inferior del toast, no como número visible. Recomendación: **opcional y sutil**, nunca número grande tipo "5… 4… 3…" (genera ansiedad y rompe el tono Atelier).
5. **CTA undo:** **ghost / link**, no primary. Una acción destructiva no debe pedir tap insistentemente — es opcional. Linear y Notion la presentan como link subrayado; Things como botón ghost. Atelier debería usar **botón ghost en `--accent` (indigo)** para diferenciarlo del cuerpo del toast.
6. **Convivencia con achievement toast:** el achievement toast de Atelier tiene mascota `celebrating` 64 px + `--ease-bounce` + halo coral. El undo toast es exactamente lo opuesto: surface neutra, sin mascota, easing emphasis (no bouncy). La diferencia visual es estructural, no decorativa.
7. **Stacking:** Sonner apila desde el más nuevo arriba (mobile) o abajo (desktop) y aplica scale-down a los anteriores. Si hay un achievement + un undo simultáneos, el undo gana prioridad de foco y el achievement queda detrás (porque la acción destructiva es tiempo-crítica).

### A.3. Receta propuesta para Atelier

**Anatomía visual (canonizar en `directions.md` §4.8 motion + §4.13 form patterns):**

```
┌──────────────────────────────────────────────────┐
│  [3 productos seleccionados]      [↶ Deshacer]   │  44px height
└──────────────────────────────────────────────────┘
   surface-elevated · border 1px border-strong · radius-md
   shadow elevation-3 (light) / glow indigo 4% (dark)
   padding 12px 16px · gap 12px
   copy: text-primary 14px (caption-strong)
   CTA: ghost button 32px · text-accent indigo · hover bg accent/8
   countdown opcional: hairline 1px en borde inferior, accent indigo 40%, lerp 0→100% en 5s
```

- **Posición:** bottom-center mobile (24 px del bottom inset, encima de tab bar y FAB), bottom-right desktop (24 px del corner, fuera del sidebar 240 px). Mantener consistente con el achievement toast — la diferencia se nota por contenido, no por posición.
- **Duración:**
  - **5 s** — selección masiva accidental (delivery-create select-all ≥10 items), optimistic delete de pago.
  - **8 s** — optimistic delete/cancel de pedido entero (más datos, más reversible debe sentirse).
  - Si el usuario hace hover/focus dentro del toast, **pausar el timer** (Sonner soporta esto por default — lo dejamos activo).
- **Sin ícono leading.** Si el caso es soft-delete tras éxito server (no optimistic), permitir un `check` 16 px en `--success` opcional, pero por default cero ícono.
- **Countdown:** hairline 1 px en el borde inferior del toast, color `--accent / 40%`, `width: 100%` lerp a `0%` en la duración configurada. `prefers-reduced-motion: reduce` la elimina.
- **CTA "Deshacer":** botón ghost 32 px, text `--accent` (indigo), hover `--accent / 8%`, `:focus-visible` ring `--focus-ring`. **Activable con kbd `Z`** (estándar Gmail) cuando el toast está visible y no hay input con foco.
- **Accesibilidad:**
  - `role="status"` + `aria-live="polite"` para selección masiva / soft delete normal.
  - `aria-live="assertive"` reservado a errores con undo (revert tras fail).
  - El botón "Deshacer" debe ser focusable con `Tab` desde el documento, sin robar el foco actual.
  - Anuncio screen reader: "{n} productos seleccionados. Pulsa Z para deshacer."
- **Coexistencia:** stack vertical bottom-up con scale 0.96 en los anteriores (estándar Sonner). Achievement toast (mascota celebrating) y undo toast pueden coexistir; el undo toma prioridad de Z-index y de anuncio aria si entran simultáneos.
- **Diferenciación con achievement toast:**

| Atributo  | Undo toast                        | Achievement toast                       |
| --------- | --------------------------------- | --------------------------------------- |
| Surface   | `--surface-elevated`              | `--surface-elevated` + halo coral 6%    |
| Border    | `--border-strong`                 | `--accent-warm / 24%`                   |
| Mascota   | **No**                            | `celebrating` 64 px sprite              |
| Easing    | `--ease-emphasis` (280 ms)        | `--ease-bounce` (entrada) + hold 800 ms |
| Acción    | Botón ghost "Deshacer"            | Sin acción (informativo)                |
| Duración  | 5 s o 8 s                         | 1.6 s (hold 800 ms + fade 280 ms × 2)   |
| aria-live | `polite` (o `assertive` en error) | `polite`                                |

### A.4. Cuestionamiento hostil

- **¿5 s alcanza para que un usuario ansioso lea y reaccione?** Para soft-deletes ligeras sí (el usuario ya esperaba el cambio). Para delete de pedido entero NO — por eso subimos a 8 s. La pausa-on-hover (Sonner default) actúa de red de seguridad para el lector lento.
- **¿El countdown hairline genera ansiedad?** Riesgo bajo si es 1 px, no animado con shake, y opcional. Si en S3 los testers reportan ansiedad, lo eliminamos; queda como opt-in via flag de `directions.md`.
- **¿Bottom-center mobile compite con la tab bar?** Sí — debe colocarse 24 px **por encima** del tab bar (no overlap), y el FAB elevado del shell debe quedar visible. Validar en S3 con shell real.
- **¿`Z` como atajo es discoverable?** No, pero es estándar Gmail/Linear y barato de descubrir. El toast también es tap-able con mouse/finger; el atajo es power-user.
- **¿Inconsistencia entre 5 s y 8 s?** No: 5 s es UI-mistake (selección), 8 s es destructive-mutation (delete pedido). La regla es _más datos en juego = más tiempo_, y queda documentada.
- **¿Qué pasa si el server confirma el delete antes de que el toast expire?** El toast sigue mostrando "Deshacer" hasta el timeout — pero "Deshacer" en ese caso ejecuta una **re-creación** (server action `restoreOrder` / `restorePayment`), no un cancel del request. Esto debe estar explícito en el contrato funcional de cada acción.

### A.5. Recomendación final + confianza

**Recomendación:** adoptar la receta propuesta (bottom-center mobile / bottom-right desktop, 5 s default y 8 s para delete pedido, ghost CTA "Deshacer" en `--accent`, sin ícono, hairline countdown opcional, `aria-live=polite` con `Z` shortcut). Canonizar en `directions.md` §4.12 como toast variant **"neutral-undo"**, hermana del existente **"achievement"**.

**Confianza:** **alta** (8/10). El patrón está triangulado en Linear, Things, Gmail y Notion con muy poca variación. La incertidumbre real es el countdown hairline (gap #4 lo deja opcional) y la duración 8 s para delete-pedido (no triangulada — es decisión de diseño basada en peso de la acción).

---

## B. Ubicación de Cancel / Reactivate / Delete en order-detail

### B.1. Hallazgos por app

| App               | Dónde viven las acciones destructivas/lifecycle                                                                                | Confirm modal                                                           | Notas                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Linear            | Menú overflow `[···]` en header del issue + atajos kbd (`C` cancel, `Ctrl+D` duplicate, `Backspace` delete)                    | Sólo para delete (irreversible); cancel = status change sin modal       | Lifecycle reversible (cancel/reopen) tratado como cambio de status, no acción destructiva. Delete sí confirma. |
| GitHub (Issue/PR) | Botones inline al pie del issue: "Close" prominente; "Delete" escondido en Settings del repo (no del issue)                    | Close NO confirma; reopen NO confirma; delete sí (separado en settings) | Separación deliberada: close/reopen son flujo normal; delete es admin-only y separado físicamente.             |
| Stripe Dashboard  | Botones diferenciados en panel lateral: "Refund" primario (reversible-ish), "Cancel" secundario, opciones avanzadas en `[···]` | Refund pide modal con monto; cancel pide confirm modal corto            | Stripe trata "Refund" y "Cancel" como acciones de primer nivel visibles, no escondidas.                        |
| Notion            | Page → menú `[···]` en header con "Move to trash"; trash página separada permite restore por 30 días                           | "Move to trash" sin confirm — confía en la trash de 30 días             | Sin modal, sin undo toast — confía en una papelera persistente. Funcional pero requiere infra de trash real.   |
| Apple Reminders   | Swipe row para complete/delete; long-press abre menú contextual con "Delete"                                                   | Delete sin confirm — `⌘Z` undo nativo                                   | iOS confía en undo del sistema. No portable a web.                                                             |

### B.2. Patrón dominante

- **Acciones reversibles (cancel / reactivate)** se exponen como **status changes inline o en panel visible**, no escondidas. Linear, GitHub y Stripe coinciden: estas no son destructivas, son cambios de estado.
- **Acciones irreversibles (delete)** se esconden tras un menú overflow `[···]` o un panel separado, y siempre piden **confirm modal** (excepto Notion que tiene trash real).
- **Discoverability vs error-prevention** se balancea ubicando reversible en posición primaria visible y destructive en posición secundaria escondida.

### B.3. Opciones evaluadas

**B1. Menú overflow `[···]` en header del detalle.**

- Pro: estándar Linear/Notion. Limpio. Acciones destructivas escondidas reduce errores.
- Contra: cancel/reactivate quedan también escondidas, mala discoverability para acciones reversibles legítimas. Usuarios 18–25 no necesariamente exploran `[···]`.

**B2. Sub-card "Acciones" colapsada por default (current).**

- Pro: discoverable (aparece en el flujo de la página). Permite agrupar múltiples acciones con copy explicativa.
- Contra: gasta vertical real estate. Al estar colapsada, el delete sigue oculto hasta tap (similar a B1, sin la convención `[···]`).

**B3. Botones inline en sidebar derecha siempre visibles.**

- Pro: máxima discoverability. Acciones siempre a un click. Patrón Stripe.
- Contra: el delete destructivo siempre visible aumenta riesgo de mis-click. En mobile la sidebar no existe — habría que reubicar todo abajo del scroll.

**B4. Página separada `/orders/[id]/manage`.**

- Pro: GitHub-style, separa admin de uso normal.
- Contra: overkill para un tracker personal. Añade nav extra. No vale la complejidad.

### B.4. Recomendación + confianza

**Recomendación: híbrido B1 + B3 (split por reversibilidad), evolución del current B2.**

- **Sidebar derecha desktop / sub-card mobile:** acciones reversibles visibles como CTAs ghost en `--accent`:
  - `+ Crear entrega` (primario suave)
  - `✎ Editar pedido` (ghost)
  - `⊘ Cancelar pedido` (ghost, con `--text-secondary`; no destructive — es reversible)
  - `↻ Reactivar` (ghost, sólo si `canReactivate=true`)
- **Menú overflow `[···]` en content header:** acciones destructivas:
  - `⌫ Eliminar pedido` (destructive, con `--destructive` color, item del menú)
  - Posible duplicate/export futuro vive aquí también.
- **Confirm modal:** sólo para `Eliminar` (irreversible — los pagos se van con el pedido). `Cancelar` y `Reactivar` ejecutan optimistic con undo toast 8 s. **Esto resuelve OD5 con más matiz que el supuesto original.**
- **Separación visual:**
  - Reversibles → ghost neutrales, agrupadas por proximidad espacial.
  - Destructiva → escondida tras `[···]` con item destacado en `--destructive`.
- **Mobile:** content header lleva `[···]` igual que desktop. La sub-card "Acciones" desaparece — se reubican las reversibles como un cluster de botones ghost en su propia sub-card colapsable que default-expanded en mobile (porque ahí no hay sidebar) y solo contiene reversibles.
- **Atajos kbd desktop:** `C` cancel, `R` reactivate, `⌫` delete (con confirm modal). Refuerza Linear-style power flow sin sacrificar discoverability mouse.

**Cuestionamiento hostil:**

- _¿`[···]` es discoverable?_ Sí entre 18–25 — viven en Notion, Linear, Discord. No es un patrón senior-only.
- _¿La separación reversible/destructive aumenta la cognitive load?_ No — reduce errores y refleja la intención del usuario. Cancelar y eliminar **son cosas distintas** y deben sentirse distintas.
- _¿Optimistic cancel sin confirm es seguro?_ Sí: el toast de undo 8 s cubre el error. Cancel no destruye datos — sólo cambia status. Si el undo expira y el usuario quiere reactivar, está a un click en la misma sidebar.
- _¿Y si el sidebar `[···]` y el header `[···]` confunden?_ Sólo hay UN `[···]` (en content header). El sidebar tiene CTAs explícitos con texto. No hay duplicación.

**Confianza:** **alta** (8/10). Triangulado con Linear (overflow + atajos), GitHub (separación close/delete), Stripe (panel visible para acciones primarias). Riesgo residual: en mobile sin sidebar, la posición exacta de las CTAs reversibles requiere prototipo en S3.

---

## C. Ubicación de "Crear entrega desde pedido"

### C.1. Hallazgos por app

| App     | Cómo expone "create related X desde Y"                                                                               | Notas                                                                                        |
| ------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Shopify | Botón "Create shipment" / "Fulfill items" prominente en el header del Order detail; preselección de items pendientes | Acción primaria — Shopify trata fulfillment como flujo central. Header no overflow.          |
| Stripe  | "Refund" como botón secundario inline en panel derecho del charge detail; no escondido en `[···]`                    | Stripe no esconde acciones de primer nivel reversibles; las hace visibles pero no primarias. |
| Linear  | "Create related issue" vive en menú `[···]` (acción menor), o como atajo `Cmd+Shift+N` desde el issue actual         | Linear lo trata como acción secundaria — no es flujo principal del issue.                    |

### C.2. Opciones

- **C1.** CTA en sidebar Acciones (current OD4).
- **C2.** CTA inline en sub-card Items con preselección.
- **C3.** FAB flotante contextual.
- **C4.** Ambos (Items + sidebar).

### C.3. Recomendación + confianza

**Recomendación: C1 reforzado con un trigger contextual ligero en Items (no full C4).**

- **CTA primario "Crear entrega" en sidebar Acciones desktop / cluster reversibles mobile** (mantiene OD4). Es la acción más esperada después de marcar pagos, y para PandaTrack (a diferencia de Linear) **sí es flujo central**. Más Shopify que Linear.
- **En sub-card Items:** un link mono pequeño "↳ Crear entrega con estos productos" en el footer de la sub-card cuando hay items elegibles (estado `NONE` o `ARRIVED_AT_STORE`). Es una abreviación, no un CTA primary — visualmente jerárquicamente menor que la sidebar. Pre-llena `?sourceOrderId=` igual que el primario. Si no hay items elegibles, no aparece (resuelve sin ruido el `empty_no_eligible`).
- **No FAB:** el shell ya tiene FAB global "+ nuevo" (T3); duplicar un FAB contextual choca con esa convención.

**Cuestionamiento hostil:**

- _¿No es duplicación inútil tener el link en Items y el CTA en sidebar?_ No — son contextos distintos. El usuario que vino a revisar items piensa "ya están listos los del pedido" y dispara desde ahí; el usuario que vino a ver el resumen del pedido encuentra la acción donde ve todas las acciones. Patrón Shopify lo confirma.
- _¿En mobile satura?_ El link de Items ocupa una línea — no satura. La sidebar mobile ya no existe; las acciones reversibles cluster en una sub-card propia, donde "Crear entrega" sigue siendo CTA primario.
- _¿El link "↳ Crear entrega…" pelea con el principio de UI sobria de Atelier?_ No si es ghost, mono pequeño, y aparece sólo cuando hay items elegibles. Encaja con la receta de "input fijado" / link micro de §4.13.

**Confianza:** **media-alta** (7/10). Shopify confirma el patrón pero la duplicación parcial Items+sidebar es decisión local. Validar en S3 con prototipo si los usuarios efectivamente usan ambos puntos de entrada o uno cae en desuso (en cuyo caso eliminar el link de Items).

---

## Resumen ejecutivo

| Decisión                                  | Recomendación                                                                                                                                                                                                                                                                                                     | Confianza         | Razón                                                                                                                                                |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Toast undo (gap #4)**                | Variant **"neutral-undo"** en §4.12: surface-elevated + border-strong, sin ícono, sin mascota, ghost CTA "Deshacer" en `--accent`, kbd `Z`, `aria-live=polite`. Posición bottom-center mobile / bottom-right desktop. **5 s** default; **8 s** delete pedido entero. Hairline countdown 1 px opcional.            | Alta (8/10)       | Triangulado en Linear, Things 3, Gmail, Notion y Sonner defaults. Diferenciación clara vs achievement toast.                                         |
| **B. Lifecycle cancel/reactivate/delete** | **Híbrido:** reversibles (`cancel`, `reactivate`, `crear entrega`, `editar`) visibles como CTAs ghost en sidebar desktop / cluster reversibles mobile. Destructive (`delete`) escondida en menú overflow `[···]` del content header con confirm modal obligatorio. Cancel/reactivate son optimistic con undo 8 s. | Alta (8/10)       | Linear (overflow + kbd) + GitHub (close/delete separados) + Stripe (acciones reversibles visibles) coinciden en este split.                          |
| **C. "Crear entrega" desde pedido**       | **C1 + trigger ligero:** CTA primario en sidebar Acciones (desktop) / cluster reversibles (mobile). Adicional: link mono `↳ Crear entrega con estos productos` en footer de sub-card Items cuando hay items elegibles. Sin FAB contextual (chocaría con FAB global del shell).                                    | Media-alta (7/10) | Shopify trata el fulfillment como flujo central, lo que mapea a PandaTrack. La duplicación parcial es deliberada y revertible si en S3 no se valida. |

**Acciones de cierre para los wireframes afectados:**

1. Actualizar `screens/order-detail.md` §2/§3 mover `Eliminar pedido` desde la sub-card Acciones al overflow `[···]` del header. Reorganizar la sidebar para reflejar reversibles únicamente.
2. Actualizar `screens/order-detail.md` §5 `Cancelando / Eliminando / Reactivando` para indicar: cancel/reactivate optimistic con undo 8 s (sin modal); delete con confirm modal obligatorio + undo 8 s post-confirm.
3. Actualizar `screens/order-detail.md` §6 motion para canonizar el toast neutral-undo (5 s / 8 s, easing emphasis, sin mascota).
4. Actualizar `screens/delivery-create.md` §10 para alinear toast undo a 5 s (selección masiva ≥10 items) con la receta canónica.
5. Mover gap #4 de `_notes/atelier-gaps.md` a `decisions/` con ADR breve referenciando este documento.
6. Resolver supuestos OD4 (parcialmente confirmado — añadir link en Items) y OD5 (parcialmente rechazado — el split reversible/destructive cambia el supuesto original).

---

## Notas de proceso

- Todas las cifras de duración (4/5/8 s) son las observadas en la documentación pública y en las apps en uso a 2026-04, no derivadas de research interno con usuarios. La validación con usuarios reales debe ocurrir en S3.
- La accesibilidad (aria-live, kbd `Z`, focus no robado, pausa-on-hover) es no negociable — Atelier hereda la baseline de Sonner pero canonizamos los detalles arriba para evitar drift.
- Mascota: confirmado que **nunca aparece en undo toast**, ni en confirm de cancel/delete/reactivate. Sigue regla §4.10.
