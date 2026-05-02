---
title: Order detail
session: 02
status: lo-fi-wireframe + post-closure updates
last_updated: 2026-05-01
post_closure_adr: ../decisions/0001-s2-closure-decisions.md
---

# Order detail

> **Addendum post-S2 (2026-05-01)** — Decisiones aplicadas tras research, ver [`ADR 0001`](../decisions/0001-s2-closure-decisions.md):
>
> - Decisión 5: `view-transition-name: order-{humanId}` queda como contrato vinculante (ya reforzado en §6).
> - Decisión 6: lifecycle separado por reversibilidad. Acciones reversibles (`Editar`, `Crear entrega`, `Cancelar`, `Reactivar`) viven en sidebar derecha desktop / cluster ghost al pie en mobile, **siempre visibles**, con undo toast (5-8s). La acción destructiva `Eliminar pedido` vive en menú overflow `[···]` del content header con confirm modal obligatorio + undo 8s post-confirm. Se reemplaza la sub-card "Acciones" colapsada del wireframe original.
> - Decisión 7: "Crear entrega" tiene **doble entry-point** — CTA primario en sidebar Acciones + link mono `↳ Crear entrega con estos productos` en footer de la sub-card Items cuando hay items elegibles.
> - Decisión 4: optimistic deletes de pago y de pedido usan toast variant **`neutral-undo`** (5s para pago, 8s para pedido completo). Atajo `Z` deshace.

## 1. Propósito y contrato funcional

Pantalla read-only del pedido del usuario, foco en estado de pagos y acciones de lifecycle (ver fila #14 + sub-flujos 14.a pagos / 14.b notas / 14.c historial / 14.d lifecycle de `functional-inventory.md`). Datos clave: `humanId` (PT-XXXXXX), tienda (avatar + nombre), `orderDate`, `expectedDeliveryFrom/To`, `currencyCode + exchangeRate`, `totalCost` en cents, items (`name`, `quantity`, `unitPrice`, `productTypeKey`), pagos (`amount`, `paymentDate`, summary `paid/remaining/percentage`), historial de cambios, nota privada (max 2000 chars), eligibility flags (`canCancel`, `canDelete`, `canReactivate`). Acciones: ver items, agregar/eliminar pago (optimistic), guardar nota (autosave on blur), cancelar/reactivar/eliminar pedido (con confirm), crear entrega desde items elegibles (`/deliveries/new?sourceOrderId=`), link a `/orders/[id]/edit`. Permisos: `verified + owner` — la página devuelve 404 a no-owners.

## 2. Wireframe mobile (360px)

```
┌──────────────────────────────────────────┐
│ ← Pedidos          [···]                 │  56px content header (back button)
├──────────────────────────────────────────┤
│                                          │
│  ┌────────────────────────────────────┐  │  ← HERO (view-transition target)
│  │  ╭──╮                              │  │     surface-elevated, radius-xl
│  │  │ M│  Mercado XX                  │  │     padding 20px
│  │  ╰──╯  PT-002418  • [Activo]       │  │     [view-transition-name: order-{humanId}]
│  │  40px  mono 13px   chip success    │  │
│  │                                    │  │
│  │  TUS PRE-ÓRDENES · CO ↔ USD         │  │  eyebrow mono uppercase, text-muted
│  │                                    │  │
│  │  Restante                          │  │  caption text-secondary
│  │  $48,50                            │  │  Display 32pt tabular-nums
│  │  de $120,00 USD                    │  │  Body text-secondary
│  │                                    │  │
│  │  ▰▰▰▰▰▰▱▱▱▱▱▱  60% pagado         │  │  progress 4px gradient indigo→coral
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │  ← SECTION: Items (collapsed default)
│  │ ITEMS                       3   ▾  │  │  eyebrow mono · count · chevron
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │  ← SECTION: Pagos (expanded default)
│  │ PAGOS              2 · $71,50  ▴   │  │
│  ├────────────────────────────────────┤  │
│  │ ◉ $50,00     12 abr    [×]         │  │  row: amount · fecha · delete
│  │ ◉ $21,50     20 abr    [×]         │  │
│  │ ───────────────────────────────    │  │
│  │ Te quedan $48,50                   │  │  helper text-secondary
│  │ ┌──────────────────────────────┐   │  │
│  │ │ + Anotar pago                │   │  │  CTA primary indigo, full width
│  │ └──────────────────────────────┘   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │  ← SECTION: Entregas
│  │ ENTREGAS                    0  ▾   │  │  count
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │  ← SECTION: Nota privada
│  │ NOTA PRIVADA                   ▾   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │  ← SECTION: Historial (collapsed)
│  │ HISTORIAL                   8  ▾   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │  ← SECTION: Acciones (collapsed)
│  │ ACCIONES                       ▾   │  │  cancel/reactivate/delete viven aquí
│  └────────────────────────────────────┘  │
│                                          │
│  [Editar pedido]  ghost button           │  link al /edit, secondary
│                                          │
└──────────────────────────────────────────┘
   ↑ pull-to-refresh recarga el detalle
```

Bottom sheets Vaul-style aparecen para confirm cancel/delete/reactivate. Tap en código mono del hero copia humanId con feedback haptic + toast "Código copiado".

## 3. Wireframe desktop (≥1024px)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Sidebar 240px │  ContentHeader: ← Pedidos          ⌘K  ⏐ avatar                          │
│               ├──────────────────────────────────────────────────────────────────────────┤
│               │                                                                          │
│               │  max-w-6xl · gap-6 · 12-col grid                                         │
│               │                                                                          │
│               │  ┌─── cols 1-8 (main column) ──────────┐ ┌─ cols 9-12 (sidebar) ────┐  │
│               │  │                                     │ │                          │  │
│               │  │  ╭──╮                               │ │  RESUMEN                 │  │
│               │  │  │ M│  Mercado XX                   │ │  ┌────────────────────┐  │  │
│               │  │  ╰──╯  PT-002418  • [Activo]        │ │  │ Total      $120,00 │  │  │
│               │  │  40px  mono 13px   chip success     │ │  │ Pagado      $71,50 │  │  │
│               │  │  [view-transition-name: order-{humanId}] │ │ Restante  $48,50 │  │  │
│               │  │                                     │ │  │ ───────────────── │  │  │
│               │  │  TUS PRE-ÓRDENES · CO ↔ USD          │ │  │ % pagado      60% │  │  │
│               │  │                                     │ │  │ ▰▰▰▰▰▰▱▱▱▱       │  │  │
│               │  │  Restante                           │ │  │                    │  │  │
│               │  │  $48,50  de $120,00 USD              │ │  │ Próximo pago        │  │  │
│               │  │  Display 40pt tabular-nums          │ │  │ — sin programar    │  │  │
│               │  │                                     │ │  └────────────────────┘  │  │
│               │  │  ▰▰▰▰▰▰▱▱▱▱▱▱  4px gradient        │ │                          │  │
│               │  │                                     │ │  ACCIONES                │  │
│               │  │                                     │ │  ┌────────────────────┐  │  │
│               │  │  ┌─── Items (expanded) ─────────┐   │ │  │ + Crear entrega    │  │  │
│               │  │  │ ITEMS                  3 ▴   │   │ │  │ ✎ Editar pedido    │  │  │
│               │  │  ├──────────────────────────────┤   │ │  │ ⊘ Cancelar pedido  │  │  │
│               │  │  │ ◐ Naruto vol. 12     ×1  $25 │   │ │  │ ↻ Reactivar        │  │  │
│               │  │  │   book-open · manga          │   │ │  │ ⌫ Eliminar pedido  │  │  │
│               │  │  │ ◐ Vinilo OST          ×1  $40│   │ │  └────────────────────┘  │  │
│               │  │  │   disc · vinyl               │   │ │  (overflow per-eligibility)│  │
│               │  │  │ ◐ Figura SD limited  ×1  $55 │   │ │                          │  │
│               │  │  │   shapes · figures           │   │ │  NOTA PRIVADA            │  │
│               │  │  └──────────────────────────────┘   │ │  ┌────────────────────┐  │  │
│               │  │                                     │ │  │ Llega con la       │  │  │
│               │  │  ┌─── Pagos (expanded) ─────────┐   │ │  │ entrega de mayo.   │  │  │
│               │  │  │ PAGOS         2 · $71,50  ▴  │   │ │  │                    │  │  │
│               │  │  ├──────────────────────────────┤   │ │  │ 28/2000   ✓ 4s     │  │  │
│               │  │  │ ◉ $50,00   12 abr 26    [×]  │   │ │  └────────────────────┘  │  │
│               │  │  │ ◉ $21,50   20 abr 26    [×]  │   │ │                          │  │
│               │  │  │ Te quedan $48,50             │   │ │  (sticky · top-24)       │  │
│               │  │  │ [+ Anotar pago] primary      │   │ │  surface-elevated        │  │
│               │  │  └──────────────────────────────┘   │ │  elevation-2             │  │
│               │  │                                     │ │                          │  │
│               │  │  ┌─── Historial (collapsed) ────┐   │ │                          │  │
│               │  │  │ HISTORIAL              8 ▾   │   │ └──────────────────────────┘  │
│               │  │  └──────────────────────────────┘   │                                │
│               │  └─────────────────────────────────────┘                                │
│               │                                                                          │
└───────────────┴──────────────────────────────────────────────────────────────────────────┘
   atajos: E editar · P enfoca pago · N nota · J/K navega · ⌘K palette · Esc cierra modals
```

Hero del detalle (avatar + código + chip) es el target del view-transition desde la row de la lista. El cuerpo del detalle hace fade simple desde abajo.

## 4. Tokens invocados

| Token                   | Uso en order-detail                                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `--background`          | Lienzo de la pantalla                                                                                                               |
| `--surface`             | Cards de sección (Items, Pagos, Entregas, Historial, Acciones, Nota mobile)                                                         |
| `--surface-elevated`    | Hero card del pedido + sidebar derecha desktop + bottom sheet de confirm modals                                                     |
| `--border`              | Dividers entre rows de pagos/items                                                                                                  |
| `--border-strong`       | Outline del hero card, outline del textarea de nota, divider de "Te quedan"                                                         |
| `--text-primary`        | Cifra hero "$48,50", nombre tienda, nombres de item, amounts de pagos                                                               |
| `--text-secondary`      | Meta inline ("de $120,00 USD"), labels Items/Pagos count, helpers de formularios, "Te quedan"                                       |
| `--text-muted`          | Código mono `PT-002418`, eyebrows uppercase, timestamps de pagos ("12 abr 26"), counter "28/2000", "✓ 4s"                           |
| `--accent` (indigo)     | CTA primario "Anotar pago", inicio del gradient progress bar, focus ring, avatar fallback letra (tinte 14% + letra indigo)          |
| `--accent-warm` (coral) | Fin del gradient progress bar, métrica "Próximo pago" en sidebar cuando aplica, halo achievement post pago full                     |
| `--accent-cool` (teal)  | Íconos Lucide de categoría inline en items (`book-open`, `disc`, `shapes`), íconos info inline en helpers                           |
| `--success`             | Status chip "100% pagado" (border + text + bg 14%), check verde de "Pago anotado" inline feedback, ícono check de pagos confirmados |
| `--warning`             | Status chip "atrasado N días" si `expectedDeliveryTo < now` y no entregado, métrica advertencia                                     |
| `--destructive`         | Botón "Eliminar pedido" en sub-card Acciones, copy de confirm modal de delete, tinte de revert en optimistic fail                   |
| `--focus-ring`          | Outline `:focus-visible` 2px en todos los controles                                                                                 |
| `elevation-2`           | Sidebar derecha desktop (light: shadow real; dark: surface-elevated + glow indigo 6%)                                               |
| `elevation-3`           | Confirm modals + bottom sheets de cancel/delete/reactivate                                                                          |

Si aparece un caso fuera de esta tabla, anotar en `../_notes/atelier-gaps.md` antes de inventar token.

## 5. Estados

- **Empty parcial — Sin pagos:** sub-card pagos colapsable expandida muestra ícono Lucide `circle-dollar-sign` 32px en `--text-secondary` centrado, copy `orders.detail.payment.empty` ("Sin pagos anotados. Anota el primero."), botón ghost "Anotar pago" 44px. Sin mascota — es empty puntual de sub-card, no empty hero.
- **Empty NO aplica al pedido en sí:** todo pedido tiene ≥1 item por contrato del schema (`items.min(1)`).
- **Loading:** skeleton del hero (avatar circle 40px + 2 líneas de meta + bloque grande para cifra hero placeholder en `--text-primary / 8%`) + skeletons de secciones colapsadas a la altura del header con chevron (no animadas hasta confirmar geometría). Sin shimmer agresivo — sólo `--text-primary / 4%` overlay sutil.
- **Error fetch:** full-page con ícono Lucide `alert-circle` 48px en `--destructive`, copy "Algo se rompió de este lado. Dale otra vez.", botón primary "Reintentar", link ghost "Volver al listado".
- **Success post-acción (pago partial / nota saved):** inline feedback dentro de la sub-card afectada, 2s, check verde + texto "Listo. Te quedan $48,50." (pago) o "Guardado, hace 0s" (nota). Toast Sonner sólo si pago full o cambio cross-card.
- **Edit inline (nota privada):** textarea expandible 3-line min, 8-line max, counter `{n}/2000` en `--text-muted`, autosave on blur con throttle 1.5s, indicador "Guardado, hace 4s" en `--text-muted` debajo. Validar post-blur (no on-change). Vacío + blur borra la nota.
- **Edit inline (pago add):** form expandible bajo el header de la sub-card con 2 inputs en columna (mobile) o fila (desktop): `amount` (number, locale-aware, currency simbol prefijo) + `paymentDate` (date picker, default hoy, max hoy). Validación post-blur: amount > 0 entero (cents); paymentDate ≤ hoy. CTA primario "Anotar pago" + ghost "Cancelar". Optimistic add: row aparece con motion expressive; si server falla, slide-out con tinte `--destructive 14%` + toast revert.
- **Edit inline error de discrepancia:** si `amount` excedería `remainingAmount`, inline error rojo bajo el input: "No puede ser mayor a $48,50 restantes." (`orders.detail.payment.error.exceedsRemaining`). El submit queda bloqueado.
- **Cancelando / Eliminando / Reactivando:** confirm modal (desktop) o bottom sheet Vaul-style (mobile) con copy del glosario, CTA destructivo + ghost "Cancelar". Mientras submitting: botón muestra spinner inline + label cambia a "Borrando…"; modal queda interactivamente bloqueado.
- **Optimistic delete pago:** row se desliza con fade fuera, toast con undo 5s. Si server confirma fail, row reaparece con tinte destructive 14%.

## 6. Motion y view transitions

- **Entrada al detalle (firma canónica §4.8):** el header (avatar + código mono + chip status) es el target del morph desde la card-row de la lista. **Convención de nombre vinculante: `view-transition-name: order-{humanId}`** — la lista (`/orders`) y el detalle (`/orders/[id]`) DEBEN declarar el nombre exacto en este formato; cualquier otra convención rompe la firma sin error visible. Reglas inviolables: duración fija 280ms, easing `linear() spring overshoot 0.05`, avatar continuo (no re-paint del tinte indigo), código mono crece de 11px a 13px en el mismo nodo (animación `font-size`, no fade-cross), chip status hace micro-pausa 40ms entre ms 120-160 del path. El cuerpo del detalle (sub-cards + sidebar) hace fade-in simple con `translate-y 8px → 0` en `--motion-base` con `--ease-emphasis`.
- **Sub-card collapse/expand:** altura animada con `--motion-base` (280ms) y `--ease-emphasis`. Chevron rota 180° en `--motion-fast` (150ms).
- **Pago agregado optimistic:** row aparece con `--ease-out-expressive` (slide desde top + fade) en 200ms, summary actualiza tabular-nums sin jitter. Si server rechaza: row hace slide-out con tinte `--destructive 14%` en 200ms + toast revert.
- **Pago full (achievement):** toast Sonner-style en bottom-right (desktop) / top (mobile) con mascota `celebrating` 64px sprite + copy "¡Cubierto! Una pre-orden menos. ✨", easing `--ease-bounce`, hold 800ms, fade-out 280ms.
- **Confirm modal cancel/delete/reactivate:** scale 0.96 → 1 + fade en `--motion-base`, focus trap activo, `Esc` cierra.
- **Bottom sheet mobile:** translate-y entrada 280ms con `--ease-out-expressive`, drag-to-dismiss con stops 50%/100%.
- **Note autosave indicator:** "Guardado, hace 4s" fade en/out 150ms con `--ease-emphasis` cuando aparece tras blur exitoso.
- **`prefers-reduced-motion: reduce`:** todo se reduce a fade 150ms; sin springs, sin morph, sin walking de mascota. View-transition fallback a navegación normal sin shared-element.

## 7. Atajos de teclado (desktop) y gestos (mobile)

**Desktop:**

- `E` — abre `/orders/[id]/edit`.
- `P` — expande sub-card Pagos y enfoca el input `amount` del form de "Anotar pago".
- `N` — expande sub-card Nota y enfoca el textarea.
- `J` / `K` — navega entre sub-cards expandidas (foco en el header de cada una).
- `⌘+Enter` — envía el form de pago si está abierto y válido.
- `Esc` — cierra modals abiertos, cierra forms inline (con confirm si hay datos sucios).
- `⌘K` — abre command palette global.
- `⌫` con foco en row de pago + confirm modal — elimina el pago seleccionado.

**Mobile:**

- Tap en código mono `PT-002418` del hero — copia humanId con haptic + toast "Código copiado".
- Swipe izquierda en row de pago — elimina con undo toast 5s.
- Pull-to-refresh — recarga el detalle.
- Bottom sheet con stops 50%/100% para confirm modals (cancel/delete/reactivate) y para form de "Anotar pago" si se prefiere full-screen.
- Long-press en row de pago — alternativa a swipe para revelar acción delete.

## 8. Mascota

- **Aparece sólo en achievement** post-pago full o post-entrega completa creada desde este pedido: `celebrating` sprite 64px en toast Sonner-style. Reglas estrictas §4.10: nunca aparece durante delete/cancel/reactivate (no celebra pérdidas), nunca durante form active (no distrae mientras el usuario tipea pago).
- **Bubble idle del shell sigue presente** en esquina inferior derecha (desktop y mobile) salvo opt-out en settings.
- **Empty state de pagos NO usa mascota:** es empty puntual de sub-card, no empty hero — se usa ícono Lucide `circle-dollar-sign` neutro en `--text-secondary`.
- **No camina aquí:** el "paseo" es exclusivo de `/dashboard` (§4.10). Order detail es vista densa con form active potencial — la mascota nunca pasea por encima.
- **No peek desde card en este detalle:** si el achievement triggerea, va a toast con `celebrating`, no peek desde el hero.

## 9. Voice samples

Strings reales en español alineados al glosario `principles.md` §7. Claves i18n en `src/i18n/locales/es/orders.json` namespace `orders.detail.*`.

| Clave i18n                                     | Valor `es`                                                                   |
| ---------------------------------------------- | ---------------------------------------------------------------------------- |
| `orders.detail.payment.empty`                  | "Sin pagos anotados. Anota el primero."                                      |
| `orders.detail.payment.cta.add`                | "Anotar pago"                                                                |
| `orders.detail.payment.success.partial`        | "Listo. Te quedan {remaining}."                                              |
| `orders.detail.payment.success.full`           | "¡Cubierto! Una pre-orden menos. ✨"                                         |
| `orders.detail.payment.error.exceedsRemaining` | "No puede ser mayor a {remaining} restantes."                                |
| `orders.detail.payment.error.dateInFuture`     | "La fecha no puede ser futura."                                              |
| `orders.detail.payment.field.amount.label`     | "Monto"                                                                      |
| `orders.detail.payment.field.date.label`       | "¿Cuándo lo pagaste?"                                                        |
| `orders.detail.note.placeholder`               | "Lo que quieras recordar de este pedido."                                    |
| `orders.detail.note.savedAt`                   | "Guardado, hace {seconds}s"                                                  |
| `orders.detail.note.counter`                   | "{count}/2000"                                                               |
| `orders.detail.summary.remainingLabel`         | "Restante"                                                                   |
| `orders.detail.summary.paidLabel`              | "Pagado"                                                                     |
| `orders.detail.summary.percentPaid`            | "{percent}% pagado"                                                          |
| `orders.detail.summary.nextPayment.none`       | "— sin programar"                                                            |
| `orders.detail.actions.createDelivery`         | "Crear entrega"                                                              |
| `orders.detail.actions.edit`                   | "Editar pedido"                                                              |
| `orders.detail.actions.cancel`                 | "Cancelar pedido"                                                            |
| `orders.detail.actions.reactivate`             | "Reactivar"                                                                  |
| `orders.detail.actions.delete`                 | "Eliminar pedido"                                                            |
| `orders.detail.delete.confirm.title`           | "¿Borrar este pedido? Sus pagos también se van."                             |
| `orders.detail.delete.confirm.cta`             | "Sí, borrar"                                                                 |
| `orders.detail.delete.confirm.cancel`          | "Mejor no"                                                                   |
| `orders.detail.cancel.confirm.title`           | "¿Cancelar este pedido?"                                                     |
| `orders.detail.cancel.confirm.helper`          | "Lo guardamos pero deja de contar como activo. Lo puedes reactivar después." |
| `orders.detail.reactivate.confirm.title`       | "¿Reactivar el pedido?"                                                      |
| `orders.detail.toast.codeCopied`               | "Código copiado"                                                             |
| `orders.detail.error.fetch`                    | "Algo se rompió de este lado. Dale otra vez."                                |
| `orders.detail.error.fetch.cta.retry`          | "Reintentar"                                                                 |
| `orders.detail.error.fetch.cta.back`           | "Volver al listado"                                                          |

## 10. Riesgos y supuestos

**Supuestos:**

- El detalle muestra todos los pagos sin paginar — pedidos típicos tienen <20 pagos (validar con datos reales en S3).
- El historial es colapsable y NO se carga por default (lazy fetch al expandir) para reducir payload inicial.
- El `Resumen` lateral en desktop usa los mismos datos del summary que viene en el server payload — no requiere refetch.
- El "Próximo pago" en sidebar es opcional: aparece sólo si en el futuro existe el concepto de payment-schedule; mientras tanto muestra "— sin programar" en `--text-muted`.
- Los items son read-only en la vista de detalle — la edición vive en `/orders/[id]/edit` (link ghost en sidebar y mobile).

**Riesgos:**

- Optimistic update con revert requiere disciplina de test: agregar PostHog event `orders.detail.payment.optimisticRevert` para detectar bugs de reconciliación cliente↔servidor en producción.
- Textarea de nota con autosave on blur puede generar muchas requests si el user hace blur frecuente — mitigar con throttle 1.5s + debounce client-side.
- View-transition target debe matchar EXACTO con el source en `orders-list` (avatar 40px + código mono 11→13px + chip status en mismo orden) — cualquier divergencia rompe el morph y se vuelve fade plain. Test cross-screen obligatorio en S3.
- Cancel/Reactivate/Delete dentro de sub-card "Acciones" colapsada por default: hay riesgo de baja discoverability — mitigar con counter de eligibility en el header de la sub-card ("3 acciones disponibles").
- Mobile sin sidebar: el resumen monetario debe quedar embedido en el hero — riesgo de saturar la cifra hero. Decisión: el resumen ya está visible como cifra hero + progress + percent label; los totales detallados (pagado/total) viven inline en el hero subtitle.

**Decisiones para input humano antes de S3:**

- ¿"Crear entrega" vive como CTA en la sub-card de Items (con preselección de productos elegibles) o sólo en sidebar/Acciones? Hipótesis: en sidebar para no saturar Items, pero validar con usuarios reales.
- ¿Lifecycle (cancel/reactivate/delete) vive en sub-card "Acciones" colapsada o en menú overflow `[···]` del content header? Hipótesis: sub-card mejora discoverability vs overflow oculto, pero gasta espacio.
- ¿El historial muestra eventos de payment add/delete o sólo lifecycle changes? Hipótesis: ambos, pero limitar a 50 eventos visibles con "Ver más".
- ¿Confirm cancel mantiene los pagos o los borra? Por contrato actual cancel sólo cambia estado a `CANCELLED` sin tocar pagos — confirmar copy refleja eso.
