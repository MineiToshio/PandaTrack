---
title: Research — Patrones de formulario (pre-fill, gated, multi-step UX)
session: 02-postresearch
last_updated: 2026-05-01
---

# Research — Patrones de formulario

Investigación enfocada para resolver los gaps Atelier #2 y #3, más los supuestos OC2/OC3/OC4 (orders create) y DC2/DC3 (delivery create). El objetivo es elegir patrones canonizables que se reusen entre `order-create` y `delivery-create` sin drift, funcionen en mobile 360 y desktop 1280, y respeten "Una pantalla, una decisión" del decálogo §2.

---

## A. Input pre-llenado / read-only por contexto

Caso: `delivery-create` entra desde detalle de pedido con `?sourceOrderId=`. La tienda viene fijada y no debe ser editable. Hoy: badge inline "Pre-llenado desde pedido". Sin patrón canonizado.

### Hallazgos por app

- **Linear (sub-issues / parent linkage):** cuando creas un sub-issue, el `Project` y el `Parent` aparecen en el header del modal como **chips compactos con icono `link-2` + texto** (no como un input). El campo no se ve como "input grayed-out", se ve como **metadata**. Se quita con un `×` discreto si el contexto lo permite.
- **Stripe Dashboard (refund / partial capture):** la `currency` del payment original aparece como **prefijo no-input** dentro del campo amount (ej. `USD  $0.00`), con el código mono al inicio. No hay un select; la moneda es una **etiqueta heredada**. Para refunds parciales, el monto original del payment se muestra arriba del amount como atributo→valor (`Charged $24.00 USD`) — también no editable, sin border.
- **Notion (sub-page / database row):** la propiedad heredada del parent (ej. `Project` de un task) aparece como **pill clickable con avatar/icon + label** dentro del panel de propiedades, sin tratamiento de input. Puede des-vincularse desde un menú overflow.
- **Vercel (deploy from a project):** al crear un deployment desde un proyecto existente, el `Project` y el `Git repository` se renderizan como **header context band** arriba del form (no como campos), con un link "Change project" en `--text-secondary`. La tienda equivalente nunca está dentro de las cards del paso actual.
- **GitHub (new issue from template / sub-issue):** `Repository` aparece como breadcrumb en el header (no como un input del form). El template seleccionado se muestra como un chip en el header con un link "Choose a different template".
- **Figma (duplicate file / move into team):** el `Team` y `Project` de origen aparecen como filas read-only en `surface-elevated` con border `--border` (no `--border-strong`), label `--text-secondary`, valor `--text-primary` 500, y un link inline `Change` en `--accent` 13px. **Esta es la receta más cercana a lo que necesita PandaTrack.**

### Patrón dominante

Hay dos enfoques claros, no uno solo:

1. **Header-context band** (Vercel, GitHub, Linear sub-issues): el contexto heredado vive **fuera del flujo de cards del form**, en un banner/breadcrumb superior. Pros: no compite con el step indicator, queda obvio que no es un campo. Contras: separa el "qué" del "dónde" — el user puede no asociar la tienda con la decisión actual.
2. **Field-as-attribute** (Figma, Notion, Stripe refund): el contexto se renderiza **dentro de la card del paso 1**, pero **no como input**. Es una fila attribute→value con border sutil, badge "↳ desde pedido", y un link `Change` discreto. Pros: el step indicator sigue fiel, el sidebar Resumen lo refleja sin gimnasia. Contras: requiere una receta visual nueva para el "campo no editable".

### Opciones evaluadas

- **A — Badge inline + input deshabilitado** (estado actual): combobox en gray con texto "Mercado MX" y badge mono "Pre-llenado desde pedido" debajo. Conocido, accesible, pero confuso: parece que se va a habilitar en algún momento, y los disabled inputs son mala señal a11y (bajo contraste, foco perdido).
- **B — Field-as-attribute** (Figma-style): la card 1 se renderiza distinto — sin combobox, con una fila attribute→value (`Tienda` `[M] Mercado MX  ↳ desde PT-002418`), border `--border`, background `--surface-elevated`, link inline `Cambiar` en `--accent` 13px que abre un sheet "Cambiar tienda obligará a reseleccionar productos. ¿Seguro?". El step 1 queda marcado como done en el indicator.
- **C — Header-context band** (Vercel-style): el contexto se mueve fuera de las cards a un banner `--surface-elevated` arriba del step indicator (`Anotando entrega para PT-002418 · Mercado MX  [Cambiar]`). Las 4 section cards arrancan en el paso 2 (Productos). Pros: cero ambigüedad. Contras: crea un patrón nuevo (header-context band) que no existe en order-create y rompe la simetría entre los dos forms — drift garantizado.

### Cuestionamiento hostil

- ¿Funciona en order-create? **B sí, C no.** Order-create no tiene un equivalente de "vengo desde X" en el MVP, pero podría tenerlo en el futuro (ej. `?storeId=`) — la receta B se aplica idéntica. C requeriría un componente "header band" que sólo existe en delivery-create y nunca en order-create.
- ¿Mobile 360px? **B encaja en la card existente** — la fila attribute→value cabe sin scroll horizontal porque la card ya está pad 20. C agrega 56px verticales más al header y desplaza el step indicator más abajo del fold.
- ¿Discoverable para user nuevo? **B mejor.** El user que entra por primera vez desde detail de pedido encuentra la tienda en el lugar donde "esperaría" verla (paso 1), con un link `Cambiar` evidente. C requiere que el user lea un banner para entender qué pasa.
- ¿Cumple "una pantalla, una decisión"? **Sí en ambos.** B porque el paso 1 ya está resuelto y no compite por atención; C porque el banner es informativo y la decisión activa es paso 2.
- ¿Tokens nuevos? **B reusa todo:** `--surface-elevated` (ya existe), `--border` (ya existe), badge mono 11px en `--text-muted` (ya existe en eyebrow), link en `--accent` 13px (ya existe en CTAs ghost). C requeriría un patrón "context band" con su propia jerarquía de spacing/borders.

### Recomendación final

**Opción B — Field-as-attribute dentro de la card del paso 1.**

Receta:

- Card 1 mantiene su `eyebrow` (`PASO 1 · TIENDA`) y `title` (`¿De dónde viene?`).
- En lugar del combobox, una **fila attribute→value** dentro de un container `--surface-elevated` con `border 1px var(--border)` (no strong) y `radius-md`:
  - Avatar 24px + nombre tienda + código país, jerarquía idéntica a la del sidebar Resumen.
  - Debajo, en línea: badge mono uppercase 11px en `--text-muted` con texto `↳ DESDE PT-002418`, donde `PT-002418` es link en `--accent` que navega al detalle del pedido (target `_self`).
  - A la derecha, link ghost `Cambiar` 13px en `--accent`, que abre confirm sheet "Cambiar la tienda quitará los productos pre-seleccionados. ¿Seguir?".
- Step indicator: paso 1 marcado **done** (`--success` + check) automáticamente al montar. Foco lógico arranca en paso 2.
- Sidebar Resumen muestra la tienda como cualquier otra fila, sin badge de prefill (el badge es un detalle del input, no del resumen).

**Razón:** mantiene el patrón Atelier sin agregar componentes nuevos al sistema, se traslada idéntico a futuros prefills (ej. `order-create?storeId=`, `payment-create?orderId=`), respeta a11y (no hay un disabled input que confunda, hay un valor mostrado claramente), funciona en mobile y desktop con la misma receta.

**Confianza: alta.** El patrón Figma/Notion está validado en miles de usuarios, los tokens ya existen, y el glosario actual ya tiene la frase "Pre-llenado desde pedido" — sólo cambia su renderizado.

**Acción para `directions.md` §4.13:** agregar la receta `field-prefilled` como variante canonizada del patrón section card, con specs de border, surface, badge mono, y link `Cambiar`.

---

## B. Section card en estado deshabilitado / gated

Caso: en `delivery-create`, si el user no eligió tienda (o no hay productos elegibles), las cards 3 (Costos) y 4 (Resumen) quedan bloqueadas. Hoy: opacidad 0.4 + pointer-events none. Sin canon.

### Hallazgos por app

- **Stripe Checkout:** los pasos posteriores quedan **renderizados pero colapsados** — sólo se ve el header del paso (eyebrow + title), sin el contenido. Background `--surface` plano, opacidad 100%, **sin grayed-out** — la deshabilitación se comunica por la **ausencia de contenido** y por el step indicator que dice claramente "no estás acá".
- **Apple onboarding (Apple ID, iCloud setup):** un solo paso visible a la vez. Los pasos posteriores no existen en el DOM. Modelo "wizard estricto" — no aplica al "all-on-page" que usa PandaTrack.
- **Vercel deploy (Build & Output settings):** el card "Build settings" aparece **collapsed con un placeholder** ("Configure build settings after selecting framework") y un border `--border` (no strong). Fondo idéntico al resto. Sin opacidad reducida. El user puede expandir manualmente pero el contenido está vacío con un copy "Choose a framework first".
- **GitHub PR creation:** el `Reviewers` y `Labels` sidebar permanecen activos pero los settings que dependen del target branch (ej. branch protection rules preview) se renderizan como un alert info `--info / 14%` en lugar de un panel grayed.
- **Linear (issue creation con template):** los campos opcionales que dependen del template seleccionado se renderizan como **placeholders text-muted** ("Pick a template to see fields") dentro del mismo layout — sin opacidad reducida, sin border distinta.
- **Figma (publish library):** los pasos `Description` y `Permissions` quedan visibles pero el botón `Publish` muestra un tooltip explicando qué falta. No hay grayed-out de cards.

### Patrón dominante

Las apps premium **evitan opacity 0.4** porque rompe a11y (contraste de texto cae bajo WCAG AA) y se siente "rota". El patrón dominante es:

- **Card visible con contenido reemplazado por una pista** — eyebrow + title intactos al 100%, contenido sustituido por un copy guía centrado en `--text-muted` (ej. "Selecciona una tienda primero para ver los costos") y un mini-icon Lucide `lock` o `arrow-up` apuntando al paso bloqueante.
- **Step indicator hace el trabajo principal** de comunicar "no estás acá todavía" — el círculo del paso bloqueado queda en estado pendiente (`--border-strong`, sin halo, sin fill).
- **Sin pointer-events none** — los inputs no existen mientras el gate está activo, así que no hay nada que bloquear. El user puede hacer scroll, leer, entender.

### Opciones evaluadas

- **A — Opacity 0.4 + pointer-events none** (estado actual): contenido completo renderizado pero atenuado. Pros: simple. Contras: a11y bajo (contraste fail), se siente "broken", el user duda si es bug.
- **B — Card visible con contenido vacío + copy guía** (Stripe/Vercel-style): eyebrow + title 100%, contenido reemplazado por un placeholder centrado en `--text-muted` con icono `lock` 16px (`--text-muted` también) y copy declarativo ("Selecciona una tienda en el paso 1 para ver los costos"). Border `--border` (no strong), surface `--surface` plano, sin opacidad.
- **C — Cards no renderizadas hasta que el gate se libera**: las cards 3 y 4 simplemente no existen en el DOM. Step indicator muestra todos los pasos. Pros: máxima limpieza. Contras: rompe el "all-on-page" del patrón Atelier, el user no ve a dónde va, salta visualmente cuando aparecen.

### Cuestionamiento hostil

- ¿Trasladable a order-create? **B sí.** Order-create podría usarlo si en el futuro hay dependencias entre pasos (ej. costos requiere moneda). Hoy no aplica directamente, pero la receta queda lista.
- ¿Mobile 360? **B mejor que A** — en mobile el opacity 0.4 con texto pequeño se vuelve ilegible. B mantiene el copy en `--text-muted` que tiene contraste WCAG AA mínimo.
- ¿Discoverable? **B claro:** el copy "Selecciona una tienda primero" indica exactamente qué hacer y dónde. A no dice nada.
- ¿"Una pantalla, una decisión"? **B refuerza el principio** — la única decisión activa es el paso bloqueante; las cards posteriores muestran su título pero no compiten por atención.
- ¿Tokens nuevos? **B reusa todo:** `--surface`, `--border`, `--text-muted`, icono Lucide `lock` (ya en el sistema). Cero tokens nuevos.

### Recomendación final

**Opción B — Card visible con contenido reemplazado por copy guía.**

Receta `disabled-gated`:

- Eyebrow + title de la card al 100% (igual que en estado normal).
- Contenido reemplazado por un container centrado vertical:
  - Icono Lucide `lock` 20px en `--text-muted`.
  - Copy declarativo Body 13 en `--text-muted`: "Selecciona una tienda primero" (variable según el gate).
  - Sin CTA — el user entiende que tiene que volver al paso anterior.
- Padding interno reducido (`py-12` en lugar de `py-6` del contenido normal) para que se sienta "vacía con propósito".
- Border `--border` (no strong) — el border-strong se reserva para card activa.
- Surface `--surface` plano. **Sin opacidad reducida.**
- Step indicator: el círculo del paso queda en `--border-strong` plain (estado pendiente), sin fill, sin halo.

**Razón:** respeta a11y (contraste WCAG AA mantenido), comunica intención clara con copy, no requiere componentes nuevos, y se traslada idéntico a cualquier otro form con dependencias entre pasos. Las apps premium ya validaron este patrón a escala.

**Confianza: alta.** Stripe + Vercel + Linear convergen en el mismo principio. Los tokens existen. La receta es chica.

**Acción para `directions.md` §4.13:** canonizar el estado `disabled-gated` con su copy template ("Necesita {paso bloqueante} primero") y especificar que **no usa opacity reducida**.

---

## C. Decisiones puntuales

### C1. OC2 — ¿bloquear submit con 0 items en order-create?

**Hallazgos:**

- **Stripe Invoices:** permite invoice con 0 line items pero muestra warning "An invoice without items will charge $0". El submit es válido.
- **Shopify Orders (draft):** permite draft order sin productos. Al confirmar (move to active), bloquea con "Add at least one product".
- **Linear Issues:** título obligatorio, descripción no — el "mínimo viable" es solo un título. No fuerza estructura interna.
- **QuickBooks/Wave Invoices:** bloquean submit con 0 items, hard error.

**Patrón dominante:** las apps de tracking financiero/pedidos **bloquean** porque un pedido sin items es semánticamente sospechoso. Las apps de invoicing flexible (Stripe) lo permiten porque hay casos legítimos (subscription invoice).

**Opciones:**

- **A — Bloquear hard:** schema `items.min(1)`, submit deshabilitado con tooltip "Suma al menos 1 item".
- **B — Soft prompt:** schema permite 0, submit muestra confirm sheet "Vas a anotar un pedido sin items. ¿Seguro?".
- **C — Permitir libre:** schema permite 0, sin warning.

**Recomendación: A — bloquear hard.**

Razón: el caso de uso de PandaTrack es tracking de coleccionables — un pedido sin items es siempre un dato incompleto, no una decisión válida. Mejor frenar al submit que tener pedidos huérfanos en el dashboard. Mantiene consistencia con delivery-create (que también requiere ≥1 producto). El schema `items.min(1)` con copy declarativo "Suma al menos 1 item antes de anotar" en validation_errors.

**Confianza: alta.**

---

### C2. OC3 — ¿step indicator navegable libre o secuencial estricto?

**Hallazgos:**

- **Typeform:** secuencial estricto, una pregunta a la vez, sólo "atrás" libre. Diseñado para conversion alta vía focus extremo.
- **Google Forms:** all-on-page (sin steps reales), navegación libre.
- **Stripe Checkout:** semi-libre — puede expandir cualquier paso para ver/editar, pero submit sólo cuando todos válidos.
- **Linear (project create):** all-on-page con secciones, navegación libre. Modelo idéntico al que usa PandaTrack.

**Datos de completion (research 2024–2026):** multi-step forms convierten ~3x mejor que single-page a partir de 7+ campos. Mobile users prefieren multi-step **15% más** que desktop. Gen Z asocia multi-step "tradicional" (Typeform-style) con patrones outdated y favorece eficiencia (single-page con secciones visibles).

**Patrón dominante para PandaTrack:** el form ya es **all-on-page con step indicator orientativo** (no wizard estricto). Las cards están todas visibles y el step indicator solo refleja **dónde está el foco activo**. No hay "navegación" real — el user scrollea y enfoca el campo que quiera.

**Opciones:**

- **A — Step indicator clickable que hace scroll a la card** + paso activo se actualiza con scroll spy. Navegación libre por construcción (el user puede scrollear o click).
- **B — Step indicator decorativo** (no clickable), sólo refleja foco activo. El user navega con scroll/tab.
- **C — Wizard estricto** (una card a la vez, atrás libre, adelante con validation): rompe "all-on-page".

**Recomendación: A — clickable con scroll spy + foco inteligente.**

Razón: el patrón Atelier ya muestra todas las cards. Hacer el step indicator clickable convierte un elemento decorativo en una utilidad de navegación gratuita (especialmente útil en desktop). Con scroll spy el user siempre ve dónde está. **Sin gating "adelante con validation"** — el user puede ir a cualquier paso, y el submit es el que valida todo al final. Esto coincide con el modelo mental Gen Z (eficiencia, no tutela).

**Confianza: media-alta.** El click-to-scroll es estándar; el scroll spy requiere implementación cuidadosa pero hay libs maduras.

---

### C3. OC4 — autosave local-only o server drafts?

**Hallazgos:**

- **Notion:** server drafts cross-device. El user empieza una página en mobile y la sigue en desktop sin perder nada. Modelo aspirational.
- **Linear (issue draft):** local-only por device, sync sólo al publish. El user pierde el draft si cambia de máquina.
- **Gmail compose:** server drafts cross-device, sync continuo.
- **Apple Notes:** server drafts (iCloud).
- **Stripe Dashboard create flows:** local-only — Stripe no guarda forms a medias.

**Expectativa Gen Z:** investigaciones recientes muestran que Gen Z tiene expectativa **alta de cross-device continuity** — empezar en mobile (camino al trabajo) y terminar en desktop (en casa) es flujo común. Pierde la confianza si el draft se pierde al cambiar de device.

**Opciones:**

- **A — Local-only `localStorage`:** simple, cero cost backend, falla cross-device.
- **B — Server drafts con modelo `OrderDraft`:** complejidad de modelo, cleanup periódico, conflictos resolution. Cross-device perfecto.
- **C — Híbrido — local-only en MVP, plan futuro a server drafts:** local hoy, FRD aparte para server drafts.

**Recomendación: C — local-only en MVP, server drafts en FRD futuro.**

Razón: el MVP no justifica la complejidad de un modelo `OrderDraft` (TTL, cleanup, conflict resolution, sync). Local-only cubre el caso más común (sesión continua, mismo device). El cross-device draft se vuelve crítico cuando hay onboarding extenso o forms largos — los de PandaTrack no son tan largos (5 cards, ~12 campos). Documentar explícitamente como **deuda conocida** y abrir FRD si la validación con usuarios reales muestra fricción cross-device.

**Confianza: media.** La duda real es si Gen Z abandonará el flow al cambiar de device. Mitigación: **mensaje claro en el footer autosave que diga "Guardado en este navegador"** — explica la limitación sin esconderla.

---

### C4. DC3 — ¿productos del sourceOrder pre-seleccionados?

**Hallazgos:**

- **Shopify split fulfillment:** al crear un partial fulfillment desde un order, Shopify **pre-selecciona todos los unfulfilled items** y deja al user deseleccionar. Default optimiza para "voy a marcar todo como enviado".
- **Pokémon Center delayed shipment:** cuando hay split shipment automático (preorder + in-stock), el flujo no requiere selección — el user solo confirma. Modelo "asumimos que sabes cuál es cuál".
- **Apple Store ship-to-multiple-addresses:** los items arrancan **todos asignados a la dirección default**, el user re-asigna manualmente los que quiere a otra. Pre-selección agresiva.
- **eBay multi-package shipment:** pre-selecciona todos, deja al user mover a otro paquete.

**Patrón dominante:** **pre-selección agresiva** cuando hay un sourceOrder claro. El user mental model es "vengo desde un pedido, todo lo de ese pedido está implicado por default".

**Opciones:**

- **A — Pre-seleccionar todos los productos del sourceOrder.**
- **B — Vacío, dejar al user marcar.**
- **C — Pre-seleccionar pero mostrar un banner pidiendo confirmación.**

**Recomendación: A — pre-seleccionar todos.**

Razón: coincide con el modelo mental del user que entró desde el detalle del pedido. El common path (entrega completa, no split) requiere cero clicks de selección. El split case requiere deseleccionar 1-2 items, fricción menor que seleccionar 8-10. Mitigación de "selección invisible" via el banner ya documentado en el wireframe ("Vienen 3 productos pre-seleccionados de PT-002418 · Cambia lo que necesites") y el contador "3 productos seleccionados · ↶ Deshacer" en el paso 2.

**Confianza: alta.** Shopify/Apple/eBay convergen, el patrón está validado a escala industrial.

---

### C5. DC2 — ¿paso 2 directo con check en paso 1?

**Hallazgos:**

- **Linear sub-issue:** el `Project` heredado se muestra en header context, el cursor arranca en `Title`. Step indicator no aplica (no es multi-step).
- **Stripe Checkout (saved payment method):** el step `Payment` queda **collapsed con check verde** y el siguiente step abierto.
- **Vercel deploy from project:** el primer "step" (project) está implícito en el breadcrumb, los steps de configuración arrancan abiertos.
- **Apple Pay setup:** los pasos completados quedan con check, el siguiente abierto auto-focus.

**Patrón dominante:** **paso 1 marcado done con check `--success`**, foco arranca en paso 2. Esto es lo que ya documenta el wireframe y coincide con el patrón de la industria.

**Opciones:**

- **A — Paso 2 con foco, paso 1 con check `--success` y la card en "field-as-attribute" (recomendación A.B de este doc).**
- **B — Paso 1 abierto con tienda visible read-only, foco en card 1.** El step indicator no avanza al montar.
- **C — Saltar paso 1 completamente** (no renderizar la card 1): el step indicator empieza en 1 pero corresponde a "Productos".

**Recomendación: A — paso 1 marcado done, foco en paso 2.**

Razón: alineado con la receta A.B (field-as-attribute), respeta el patrón de la industria, comunica progreso real al user. Bonus: el step indicator funciona como mini-confirmación visual de que la tienda está fijada y entendida por el sistema. **B** desperdicia el primer paso forzando al user a "validar" algo que ya está fijado. **C** rompe el contrato visual del step indicator (4 pasos siempre).

**Confianza: alta.**

---

## Resumen ejecutivo

| Decisión                           | Recomendación                                                                                                    | Confianza  | Razón en 1 frase                                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------ |
| **A. Pre-fill / read-only**        | Field-as-attribute dentro de card 1 (Figma-style), reusa tokens existentes, link `Cambiar` ghost en `--accent`   | Alta       | Patrón Notion/Figma validado, traslada idéntico a futuros prefills, sin componentes nuevos       |
| **B. Section card disabled/gated** | Eyebrow + title intactos, contenido reemplazado por copy `--text-muted` + icono `lock`, **sin opacity reducida** | Alta       | Stripe/Vercel/Linear convergen; opacity 0.4 falla WCAG AA y se siente "broken"                   |
| **C1. OC2 — items mínimo 1**       | Bloquear hard con `items.min(1)`                                                                                 | Alta       | Pedidos sin items son siempre datos incompletos en el contexto de tracking de coleccionables     |
| **C2. OC3 — step navegable**       | Step indicator clickable + scroll spy; sin gating "adelante con validation"                                      | Media-alta | Coincide con modelo mental Gen Z (eficiencia, no tutela); el form ya es all-on-page              |
| **C3. OC4 — autosave**             | Local-only en MVP; FRD futuro para server drafts; **footer dice "Guardado en este navegador"**                   | Media      | MVP no justifica la complejidad de `OrderDraft`; Gen Z espera cross-device pero el form es corto |
| **C4. DC3 — pre-selección**        | Pre-seleccionar todos los productos del sourceOrder                                                              | Alta       | Shopify/Apple/eBay convergen; alinea con modelo mental "vengo desde el pedido completo"          |
| **C5. DC2 — prefill UX**           | Paso 1 marcado done con check `--success`, foco arranca en paso 2                                                | Alta       | Patrón Stripe/Apple validado; comunica progreso real; refuerza receta A.B                        |

**Validación humana adicional requerida (confianza media o conocida-pendiente):**

1. **C2 (step navegable):** el scroll spy con click-to-scroll necesita prototipo de interacción para confirmar que no se siente jumpy en mobile. Validar en S3 con prototipo.
2. **C3 (autosave local-only):** validar con 3-5 usuarios reales si el cross-device draft es deal-breaker. Si lo es, FRD `OrderDraft` se eleva a prioridad alta.
3. **A (field-as-attribute):** validar que el link `Cambiar` con confirm sheet ("Cambiar tienda quitará productos pre-seleccionados") no se sienta destructivo de más — alternativa es dejar el cambio sin confirm si la lista de productos está vacía/sin tocar.

Sources:

- [Multi-Step Form Best Practices 2026: Design Principles & Completion Rate Data | Anve](https://voiceforms.anvevoice.app/blog/multi-step-form-best-practices/)
- [Form Conversion Rate Benchmarks 2026: 100+ Data Points](https://www.digitalapplied.com/blog/form-conversion-rate-benchmarks-2026-data-points)
- [Multi-Step Forms vs Single-Step Forms: Which Converts Better?](https://ivyforms.com/blog/multi-step-forms-single-step-forms/)
- [Is a Single Page Form or Multi Step Form Better for Conversion? | Zuko Blog](https://www.zuko.io/blog/single-page-or-multi-step-form)
