---
title: ADR 0001 — Decisiones de cierre de Sesión 2 (post-research)
date: 2026-05-01
status: accepted
session: 02-postresearch
sources: redesign subproject — S2 post-research notes (status colors, form patterns, toasts lifecycle, dashboard lists, settings/avatar) (historical)
---

# ADR 0001 — Decisiones de cierre de Sesión 2 (post-research)

## Contexto

Al cerrar Sesión 2 quedaron abiertos:

- 4 gaps de Atelier (gap analysis del subproyecto, histórico).
- 41 supuestos asumidos por el agente (registro de supuestos del subproyecto, histórico).
- Convención técnica `view-transition-name: order-{humanId}` pendiente de elevar a ADR.

Para no entrar a S3 (sistema de tokens) con decisiones débiles, se lanzaron **5 agentes de research en paralelo** que documentaron benchmarks de Linear, Stripe, Vercel, Notion, Shopify, Apple, GitHub, Cash App, YNAB, Pokémon Center, FedEx y otros, cuestionaron sus propias conclusiones contra Regla Cero + decálogo + dirección Atelier, y devolvieron recomendaciones con nivel de confianza explícito. Este ADR consolida y formaliza las decisiones tomadas.

Los 5 documentos de research del subproyecto son la **fuente fáctica** de cada decisión (histórico); este ADR es el **contrato vinculante** que las congela.

---

## Decisión 1 — Token nuevo `--info` para "pendiente sin urgencia"

**Origen:** atelier-gaps gap #1.

**Decisión.** Se introduce un cuarto color status `--info` (hue azul-cyan ~230) al sistema Atelier. Reemplaza el uso forzado de `--warning` para chips "Aún no llega".

**Spec del token.**

| Token          | Light                 | Dark                  | Uso                                          |
| -------------- | --------------------- | --------------------- | -------------------------------------------- |
| `--info`       | `oklch(62% 0.12 230)` | `oklch(76% 0.12 230)` | "Pendiente sin urgencia", informativo neutro |
| `--info / 14%` | color-mix bg          | color-mix bg          | background de chip status                    |
| `--info / 28%` | color-mix border      | color-mix border      | border del chip                              |

**Reglas de uso.**

- Sólo para "pendiente sin urgencia" en una superficie de status (chip, badge, dot).
- NO para CTAs, NO para focus ring, NO para íconos de categoría (esos siguen en `--accent-cool`).
- Texto adicional + ícono Lucide `clock` obligatorio (color-only no cumple a11y).

**Justificación.** Patrón dominante en Polaris (Shopify), Carbon (IBM), Linear backlog state, Stripe payment "processing", GitHub PR draft. Resuelve el conflicto semántico raíz — `--warning` queda exclusivo para "atrasado/vencido". Cuando lleguen los chips reales de "atrasado N días", serán inmediatamente distinguibles por hue (azul 230 vs ámbar 75).

**Confianza:** alto.

**Costo:** suma 1 token al sistema (light + dark + recetas color-mix).

**Rollback:** si en S3 las pruebas de a11y o las validaciones humanas muestran confusión con `--accent-cool` o `--success`, se ajusta el hue a azul más profundo (210) o se renombra `--pending`.

---

## Decisión 2 — Patrón canónico de input pre-llenado / read-only

**Origen:** atelier-gaps gap #2.

**Decisión.** El campo pre-llenado por contexto NO se renderiza como input editable bloqueado. Se renderiza como **field-as-attribute** dentro de la section card afectada:

- Wrapper: `surface-elevated`, `radius-lg`, padding 12-16px.
- Eyebrow superior: badge mono uppercase 11px en `--text-muted` con prefijo `↳ DESDE PT-XXXXXX` (referencia explícita al origen del prefill).
- Valor: avatar (si aplica) + nombre en `--text-primary` peso 500.
- Acción ghost a la derecha: `Cambiar` con ícono `pencil` que reemplaza el campo por un input editable normal y dispara confirm sheet si ya hay datos derivados (ej. productos seleccionados).

**Justificación.** Patrón Figma (component variants), Notion (database properties heredadas), Stripe Refund (currency heredada del Charge). El input bloqueado clásico falla porque parece "deshabilitado por error" — el field-as-attribute comunica "esto está en otra parte de tu modelo, no aquí".

**Confianza:** alto.

**Costo:** receta nueva en §4.13 + entrada en componente core S4 `<PrefilledField>`.

**Rollback:** si la prueba 5 (avatares) descubre que la composición avatar + badge mono es muy densa para mobile 360px, simplificar a sólo nombre + badge (sin avatar) en mobile.

---

## Decisión 3 — Section card en estado disabled / gated

**Origen:** atelier-gaps gap #3.

**Decisión.** La section card gated **no usa opacity reducida**. Mantiene eyebrow + title al 100% (intactos) y reemplaza su contenido con un sub-bloque guía:

- Ícono Lucide `lock` 24px en `--text-muted` (NO destructive — no es error, es secuencia).
- Copy guía en `--text-muted` Body 13px: ej. "Selecciona una tienda primero." (alineado al glosario de los principios de diseño del subproyecto §7, histórico).
- Padding generoso 32px vertical para que el bloque guía se sienta intencional, no roto.
- Border `--border` (no strong) para señalar "presente pero secundario".

**Justificación.** Stripe Checkout, Vercel deployments y Linear convergen en NO usar opacity para gating (rompe WCAG AA en texto pequeño). El patrón "card visible + contenido sustituido por guía" comunica el siguiente paso sin penalizar al usuario visualmente.

**Confianza:** alto.

**Costo:** receta nueva en §4.13 + entrada en componente core S4 `<SectionCard variant="gated">`.

**Rollback:** si en S6 un usuario reporta que el gating "no se siente bloqueado lo suficiente", agregar pointer-events: none al body de la card.

---

## Decisión 4 — Toast con undo (variant neutral-undo)

**Origen:** atelier-gaps gap #4.

**Decisión.** Atelier suma una variante explícita de toast `neutral-undo`, hermana del `achievement` ya documentado en §4.12.

**Spec.**

- Background: `--surface-elevated` + `--border-strong` 1px.
- Sin ícono decorativo, sin mascota.
- Copy en `--text-primary`, una línea.
- CTA derecha: ghost button "Deshacer" en `--accent` indigo + atajo de teclado `Z` (mostrado como kbd a la derecha en desktop).
- `aria-live="polite"` para anuncio screen reader.
- Posición: bottom-center mobile / bottom-right desktop.
- **Duración:** 5s para selección masiva, optimistic delete de pago, optimistic update simple. **8s para delete de pedido entero** (acción de mayor impacto).
- Hairline countdown opcional 1px en `--accent` 40% al pie del toast.
- Hover/focus pausa el countdown.

**Justificación.** Triangulado en Linear (5s default), Things 3 (5s), Gmail (5s), Notion (5s). Sonner ships con 4s default; subimos a 5s por accesibilidad (Gen Z + screen readers). Diferenciación visual clara contra el achievement (que sí lleva mascota celebrating + ease-bounce + halo coral).

**Confianza:** alto.

**Costo:** receta nueva en §4.12 + componente core S4 `<Toast variant="neutral-undo">`.

**Rollback:** si telemetría S6+ muestra que <5% de los usuarios usan el undo, evaluar si el toast genera ruido innecesario.

---

## Decisión 5 — Convención de view-transition `order-{humanId}` (vinculante)

**Origen:** cross-screen consistency S2.

**Decisión.** La convención de `view-transition-name` para la firma canónica list→detail descrita en las direcciones visuales del subproyecto §4.8 queda fijada como contrato vinculante:

```
view-transition-name: order-{humanId}
```

Aplica a:

- Cada row de `/orders` (lista) en su contenedor principal (avatar + código mono + chip status).
- El header del detalle `/orders/[id]` (avatar + código mono + chip status).
- Cualquier origen alternativo de morph al detalle (ej. row de pre-órdenes del Dashboard).

**Reglas vinculantes.**

1. El `humanId` se usa tal como llega del backend (ej. `PT-002418`), sin transformaciones.
2. Sólo la row clickeada / focused debe llevar el `view-transition-name` (delegación dinámica) para no inflar el snapshot del DOM.
3. La extensión a otros recursos (deliveries, stores) usa la misma convención: `delivery-{humanId}`, `store-{slug}`.

**Justificación.** Sin contrato vinculante, la firma §4.8 se rompe silenciosamente cuando un dev en S6 elige otro nombre. La convención es trivial pero crítica.

**Confianza:** alto.

**Costo:** sólo documentación.

**Rollback:** ninguno — es decisión arquitectónica.

---

## Decisión 6 — Lifecycle del pedido separado por reversibilidad

**Origen:** assumptions OD5 + research-toasts-lifecycle.

**Decisión.** Se cambia el supuesto OD5. Las acciones del pedido se separan por **reversibilidad**, no se agrupan en una sola sub-card "Acciones":

| Acción            | Reversibilidad           | Ubicación                                          | Confirm modal | Undo toast     |
| ----------------- | ------------------------ | -------------------------------------------------- | ------------- | -------------- |
| `Editar`          | Reversible               | Sidebar derecha desktop (link ghost)               | No            | No             |
| `Crear entrega`   | No destructiva           | Sidebar derecha desktop (CTA primary)              | No            | No             |
| `Cancelar pedido` | Reversible (reactivable) | Sidebar derecha desktop (ghost)                    | No            | 8s "Reactivar" |
| `Reactivar`       | Reversible               | Sidebar derecha desktop (ghost, sólo si cancelado) | No            | 5s "Volver"    |
| `Eliminar pedido` | **Destructiva**          | Menú overflow `[···]` en content header            | **Sí**        | 8s "Restaurar" |

**Mobile:** las reversibles forman un "cluster" de 4 botones ghost stack al pie del detalle; la destructiva (`Eliminar`) vive bajo el menú overflow del top-bar como en desktop.

**Justificación.** Linear (overflow + kbd para destructive), GitHub (close vs delete separados), Stripe (refund visible / delete charge oculto). Mezclar reversibles y destructivas en una sola sub-card "Acciones" aplana la jerarquía y aumenta el riesgo de delete accidental.

**Confianza:** alto.

**Costo:** medio — el wireframe de detalle de pedido del subproyecto debe re-organizarse (histórico).

**Rollback:** si en S6+ un usuario power solicita ver delete sin overflow, agregar atajo de teclado `⌘+⌫`.

---

## Decisión 7 — Crear entrega: doble entry-point (sidebar + footer de Items)

**Origen:** assumptions OD4 + research-toasts-lifecycle.

**Decisión.** Mantener el CTA primario "Crear entrega" en sidebar derecha (Acciones) **Y** agregar un link mono `↳ Crear entrega con estos productos` al footer de la sub-card Items cuando hay items elegibles. Sin FAB contextual (chocaría con el FAB global del shell).

**Justificación.** Patrón Shopify (fulfillment es flujo central, expuesto en múltiples puntos). Duplicación parcial deliberada — el sidebar gana descubribilidad; el link en Items gana contexto cuando el user está revisando productos.

**Confianza:** medio-alto.

**Costo:** bajo.

**Rollback:** si telemetría S6+ muestra que <10% usa el link de Items, eliminarlo.

---

## Decisión 8 — Dashboard: nuevo set de 4 micro-stats

**Origen:** assumptions D1 + research-dashboard-lists.

**Decisión.** Reemplazar el set actual `Pagado / Próximo / Vencidos / Llegando` por:

| Slot | Métrica                      | Color                 | Notas                                                                              |
| ---- | ---------------------------- | --------------------- | ---------------------------------------------------------------------------------- |
| 1    | **Este mes**                 | `--accent` indigo     | Total pagado en el mes corriente — ancla emocional positiva                        |
| 2    | **Próximos 30 días**         | `--accent-warm` coral | Suma de pagos programados o esperados en ventana 30d — ancla de planeación         |
| 3    | **Atrasado** _(condicional)_ | `--warning` ámbar     | Sólo aparece si > 0; cuando = 0 el slot muta a "Tiendas activas" en `--text-muted` |
| 4    | **Llega esta semana**        | `--success` verde     | Count de productos esperados en ventana 7d — ancla de anticipación                 |

**Justificación.** YNAB ("Ready to Assign" como única métrica accionable), Cash App (saldo + 1 acción), Robinhood (balance + variación + buying power) muestran que micro-stats deben ser **homogéneos en marco temporal**, no mezclar pasado y futuro. La métrica "Vencidos" implicaba penalidad contractual que no existe en pre-orders. La métrica condicional "Atrasado" es honesta — si no hay nada atrasado, el slot se reusa; no se muestra "0 vencidos" como ruido.

**Confianza:** medio-alto. Validación humana recomendada con la prueba 1 del plan (test de 5 segundos).

**Costo:** bajo (cambio de copy + lógica condicional).

**Rollback:** si la validación 1 falla, considerar volver a un set más cercano al actual ("Restante total / Próximo pago / Atrasado / Llega pronto") o hacer las métricas configurables por usuario.

---

## Decisión 9 — Orders list: paginación mobile = botón "Cargar más", desktop = clásica

**Origen:** assumptions OL4 + research-dashboard-lists.

**Decisión.**

- **Mobile:** botón explícito **"Cargar más"** al pie de la lista (no infinite scroll con sentinel). `pageSize 20`.
- **Desktop:** paginación clásica con paginador numerado. `pageSize 30`.

**Justificación.** El sentinel automático rompe scroll restoration al volver del detalle (incompatible con view-transitions canónica); además genera ansiedad infinita. El botón "Cargar más" preserva el control + soporta back/forward + es estándar GitHub Issues / Linear (mobile web). Desktop clásico = Stripe / Vercel / GitHub.

**Confianza:** alto.

**Costo:** bajo (cambio de patrón en mobile).

**Rollback:** si en S6+ los usuarios solicitan scroll continuo, evaluar virtualized scroll con scroll restoration explícita (más complejo pero compatible con VT).

---

## Decisión 10 — Orders list: swipe izquierda con `--accent` indigo

**Origen:** research-dashboard-lists §D.

**Decisión.** Cambiar el background del swipe izquierda ("Anotar pago") de `--success` verde a `--accent` indigo. El verde queda reservado para el toast de pago al 100% (achievement).

**Justificación.** Verde + izquierda en Things 3 = "completar definitivamente" → ambiguo aquí (anotar pago no completa el pedido). Indigo es el accent primario del sistema; mapea bien a "acción primaria del flujo".

**Confianza:** medio.

**Costo:** trivial.

**Rollback:** si la validación 5 (avatares) o pruebas con usuarios revelan que indigo se confunde con "abrir detalle", probar `--accent-warm` coral.

---

## Decisión 11 — Densidad de orders list reflejada en `preferences`

**Origen:** assumptions OL1 + research-dashboard-lists §E.

**Decisión.** El toggle de densidad (densa / cómoda) vive en `localStorage["orders.density"]` para acceso inmediato Y se refleja en `settings → preferences` cuando S3 actualice el schema con el campo `preferredDensity`. Default: `densa`.

**Justificación.** Mismo modelo dual que el theme toggle (Decisión 14): atajo en el lugar de uso + fuente de verdad persistente en preferences. Linear, Stripe, GitHub aplican el mismo modelo para "view options".

**Confianza:** alto.

**Costo:** bajo en S2 (solo `localStorage`); medio en S3 (campo en `preferences` schema).

**Rollback:** si <5% de usuarios cambian la densidad, eliminar el campo de preferences y dejar sólo localStorage.

---

## Decisión 12 — Order create: items.min(1), step navegable, autosave local

**Origen:** assumptions OC2/OC3/OC4 + research-form-patterns §C.

**Decisiones puntuales.**

- **OC2 — Bloquear submit con 0 items:** sí. UI agrega `items.min(1)` aunque el schema lo permita opcional. Pedidos sin items son datos incompletos en el dominio coleccionables.
- **OC3 — Step indicator navegable libre con scroll spy:** sí. Los pasos son clickables hacia adelante y atrás; el scroll spy resalta el paso del viewport. Sin gating estricto. Coincide con modelo mental Gen Z (Typeform-like libertad, no Wizard).
- **OC4 — Autosave local-only en MVP:** sí, con copy explícito **"Guardado en este navegador, hace Ns"** (no sólo "Guardado, hace Ns") para que el usuario sepa que el draft no es cross-device. Server drafts pasan a FRD futuro.

**Justificación.** Stripe invoices y Shopify orders requieren al menos un line item por contrato semántico. Typeform vs Stripe Checkout: Gen Z prefiere visibilidad de progreso + libertad de navegación, no Wizard estricto. Notion / Apple Notes ya entrenaron al user a "drafts cross-device" — pero implementarlo en MVP requiere modelo nuevo; copy explícito mitiga la sorpresa.

**Confianza:** alto en OC2 y OC3; medio en OC4 (requiere validación humana).

**Costo:** bajo en S2; OC4 puede crecer si server drafts se necesitan en S5+.

**Rollback:** OC4 — si la prueba 3 (form completion) muestra que el user pierde drafts cross-device frecuentemente, escalar a server drafts antes de S6.

---

## Decisión 13 — Delivery create: prefill arranca en paso 2, productos pre-seleccionados

**Origen:** assumptions DC2/DC3 + research-form-patterns §C.

**Decisiones.**

- **DC2:** si entra con `?sourceOrderId=`, el step indicator arranca en **paso 2** (Productos) con paso 1 (Tienda) marcado **done con check `--success`**. La tienda aparece como **field-as-attribute** (Decisión 2) en el header del paso 2, no como sección separada.
- **DC3:** los productos elegibles del `sourceOrder` vienen **pre-seleccionados todos**. El usuario puede deseleccionar uno a uno o por grupo. Toast neutral-undo (Decisión 4) aparece tras selección/deselección masiva.

**Justificación.** Shopify split fulfillment, Apple ship-to-multiple (cuando entras con un sourceOrder, el sistema asume "quieres entregar todo a menos que digas otra cosa"). eBay y Pokémon Center confirman el patrón.

**Confianza:** alto.

**Costo:** bajo.

**Rollback:** si la pre-selección genera errores frecuentes (entregas con productos que el user no quería), cambiar a "vacío y selecciono lo que voy a entregar" como default.

---

## Decisión 14 — Theme toggle dual (shell + settings)

**Origen:** assumptions T5 + research-settings-avatar §C.

**Decisión.** El theme toggle vive en **dos lugares**, ambos leyendo/escribiendo la misma fuente de verdad `localStorage["theme"]`:

- **Shell:** atajo rápido en sidebar mobile (long-press en bubble panda → menú contextual con opciones theme) o en account menu desktop (click en avatar usuario top-right). 3 opciones: `light` / `dark` / `system`. Default: `system`.
- **Settings → Preferences:** sección "Apariencia" con el mismo toggle como fuente de verdad persistente y descubrible.

**Justificación.** Vercel y Stripe convergen — duplicación deliberada porque el theme es la setting más usada y debe estar a un click. La consistencia entre los dos lugares se garantiza con la misma fuente de verdad.

**Confianza:** alto.

**Costo:** bajo.

---

## Decisión 15 — Settings: layout desktop tabs verticales (Opción A confirmada)

**Origen:** assumptions S1 + research-settings-avatar §A.

**Decisión.** Confirmar Opción A: tabs verticales cols 1-3 + contenido cols 4-12. Default: Profile activa.

**Justificación.** Patrón dominante en SaaS premium (Vercel, Linear, Stripe, GitHub, Notion). Escala bien cuando lleguen Notifications, Billing, Integrations en sesiones futuras. Mejor mobile→desktop scaling que cards stackeadas.

**Confianza:** alto.

---

## Decisión 16 — `<StoreAvatar>` componente: spec final

**Origen:** assumptions T2 + research-settings-avatar §B.

**Decisión.**

```ts
<StoreAvatar store={store} size={24 | 32 | 40 | 56} />
```

**Spec.**

- **Sizes:** `24, 32, 40, 56`. Descartados 16 (ilegible para letra) y 48 (no añade nada vs 40/56).
- **Letra:** UNA sola — primera letra del nombre en mayúsculas (monograma de marca). No iniciales dobles.
- **Logo cuadrado:** render circular (mobile) / `radius-lg` (desktop) sin tinte de fondo.
- **Logo rectangular:** `object-fit: contain` + padding interno 12.5% del size sobre `--surface-elevated`. Centrado.
- **Logo con transparencia / alpha:** SIEMPRE sobre `--surface-elevated`, NUNCA sobre el tinte indigo (interferencia cromática).
- **Sin status indicator** en S2 (descartar dot "tienda activa/problemas" hasta que haya use case real).

**Justificación.** GitHub (1 letra), Notion (1), Slack default (1) — el monograma de 1 letra se ve "diseñado". Las iniciales 2-letra de Apple Mail se ven más "fallback de contacto". `object-fit: contain` con padding 12.5% es la receta que Stripe y Notion usan para logos de empresa.

**Confianza:** alto-medio (validación humana con la prueba 5 cierra confianza alta).

**Costo:** bajo (componente core S4).

**Rollback:** si la prueba 5 falla, alternativa documentada en el plan de validación del subproyecto, Validation 5 (histórico).

---

## Decisión 17 — Toggle "Mostrar mascota": Preferences + menú contextual bonus

**Origen:** assumptions S3 + research-settings-avatar §D.

**Decisión.** El toggle vive en **`settings → preferences`** como fuente de verdad. Bonus de descubribilidad: **right-click (desktop) / long-press (mobile) en la mascota misma** abre menú contextual con opciones: `Ocultar mascota` · `Cambiar tema` · `Configuración`.

**Justificación.** GitHub Octocat y Discord Wumpus no son toggleables (problema). Atelier diferencia: mascota toggleable (anti-fatiga) + menú contextual sobre el sprite (descubribilidad sin investigar settings).

**Confianza:** medio-alto.

**Costo:** medio (hay que implementar contextmenu en el sprite).

**Rollback:** si el menú contextual choca con el comportamiento default del browser, eliminar el bonus y dejar sólo Preferences.

---

## Decisión 18 — Cooldown de username: chip warning solo durante el período activo

**Origen:** assumptions S5 + research-settings-avatar §E.

**Decisión.** El chip warning con timer "{days} días" aparece **sólo durante el período activo de cooldown** (post-cambio del username). Cuando el cooldown termina, el chip desaparece y el input de username vuelve a estado normal editable. NO mostrar el chip permanentemente como recordatorio de la regla.

**Justificación.** Discord, GitHub y X aplican el cooldown silenciosamente — sólo lo comunican cuando el usuario intenta cambiar dentro del período. Mostrar el chip permanente genera ruido visual sin valor para el 95% de los usuarios que cambian su username una vez.

**Confianza:** medio-alto.

**Costo:** bajo.

**Rollback:** si reportes muestran que usuarios intentan cambiar el username y se sorprenden con la regla, agregar helper text neutro permanente: "Cambios cada 30 días."

---

## Decisión 19 — "Cerrar sesión en todos los dispositivos": condicional a capability

**Origen:** assumptions S7 + research-settings-avatar §F.

**Decisión.** El botón ghost destructive "Cerrar sesión en todos los dispositivos" aparece al pie de la sección **Account** sólo si la capability existe en el backend (BetterAuth la soporta). NO se condiciona al número de sesiones activas — siempre visible si la capability está, aunque el usuario tenga sólo 1 sesión.

**Justificación.** GitHub, Vercel, Stripe muestran la opción siempre (cuando existe) — es comportamiento esperado de "cuenta segura". Condicionarla a "≥2 sesiones" requiere consultar al server por sessions activas, lo cual añade complejidad sin valor.

**Confianza:** alto.

**Costo:** bajo.

---

## Resumen ejecutivo

| #   | Decisión                                                       | Confianza  | Cierra       |
| --- | -------------------------------------------------------------- | ---------- | ------------ |
| 1   | Token nuevo `--info` para "pendiente sin urgencia"             | Alto       | gap #1       |
| 2   | Patrón input pre-llenado (field-as-attribute)                  | Alto       | gap #2       |
| 3   | Section card gated (sin opacity)                               | Alto       | gap #3       |
| 4   | Toast neutral-undo                                             | Alto       | gap #4       |
| 5   | Convención `view-transition-name: order-{humanId}`             | Alto       | cross-screen |
| 6   | Lifecycle separado por reversibilidad                          | Alto       | OD5          |
| 7   | Crear entrega doble entry-point                                | Medio-alto | OD4          |
| 8   | 4 micro-stats nuevos (Este mes / 30d / Atrasado / Esta semana) | Medio-alto | D1           |
| 9   | Paginación: mobile "Cargar más" / desktop clásica              | Alto       | OL4          |
| 10  | Swipe izquierda con `--accent` indigo                          | Medio      | swipe color  |
| 11  | Densidad reflejada en preferences                              | Alto       | OL1          |
| 12  | OC2 items.min(1) · OC3 navegable · OC4 local-only              | Alto/Medio | OC2/OC3/OC4  |
| 13  | Prefill arranca en paso 2 + pre-seleccionados                  | Alto       | DC2/DC3      |
| 14  | Theme toggle dual                                              | Alto       | T5           |
| 15  | Settings layout: tabs verticales (Opción A)                    | Alto       | S1           |
| 16  | StoreAvatar spec (sizes 24/32/40/56, 1 letra)                  | Alto-medio | T2           |
| 17  | Mostrar mascota: Preferences + menú contextual                 | Medio-alto | S3           |
| 18  | Cooldown username: chip sólo durante activo                    | Medio-alto | S5           |
| 19  | "Cerrar sesión en todos": condicional capability               | Alto       | S7           |

**Total decisiones:** 19. **Bloqueantes para S3:** 0 (todas con suficiente claridad). **Que requieren validación humana antes de S6:** 4 (decisiones 8, 12-OC4, 16, 17).

---

## Próximos pasos

1. **Wireframes** afectados se actualizan en este mismo cierre (delivery-create, order-detail, order-create, dashboard, orders-list, settings).
2. **el gap analysis del subproyecto** marca los 4 gaps como ✅ resolved con referencia a este ADR.
3. **los supuestos de S2 del subproyecto** marca cada supuesto como ✅ confirmed / ⚙️ changed / ⏳ pending validation.
4. **las direcciones visuales del subproyecto** se actualizará en S3 con los nuevos tokens y recetas (sólo el ADR; el doc base se mantiene como referencia histórica de S1).
5. **Las 5 validaciones** del plan se ejecutan en paralelo a S3 — no son bloqueantes para arrancar tokens.
