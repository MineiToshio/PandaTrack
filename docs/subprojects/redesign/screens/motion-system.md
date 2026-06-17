---
title: Sistema de movimiento — tokens, reglas, microinteracciones y view transitions
session: 12-motion-voice (Fase A)
status: Fase A — propuesta (gate humano pendiente)
last_updated: 2026-06-15
owner: Sergio Minei
adrs:
  - ADR 0014 — Motion system + View Transitions policy
related:
  - principles.md §4 (motion con propósito, vocabulario reducido)
  - _notes/s3-draft-elevation-motion.md (origen de los tokens de motion)
  - _notes/s12-motion-voice-research.md (insumo de research verificado)
  - ADR 0001 D4 (toast neutral-undo) · D5 (firma view-transition) · D7 (view-transition de orden)
  - .cursor/rules/optimistic-client-updates.mdc
demo_anchors: []
---

# Sistema de movimiento (S12)

> **S12 no agrega pantallas de producto.** Define a nivel **sistema** el lenguaje de
> movimiento que se aplica sobre todo lo ya construido (S1–S11). El movimiento confirma una
> acción, comunica jerarquía o transporta un objeto — nunca decora (lección Linear: _restraint_,
> motion = comprensión).

## Decisiones del gate — resueltas (2026-06-15)

> Sergio delegó las decisiones técnicas de motion/voice ("yo de estas cosas no entiendo; decide lo más
> adecuado para nuestro caso"). Estas resoluciones son **finales** y **reemplazan** cualquier marca
> "PROPUESTO / Decisión de Sergio / ¿gate?" del resto del documento. Criterio: _restraint_ Linear
> (motion = comprensión), audiencia 18–25 mobile-first, REGLA CERO (aditivo, no reset).

| #   | Decisión                                  | Resolución                                                                                                                                                                                | Razón                                                                                                                                                                                 |
| --- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | `--motion-instant: 100ms` (§1.1)          | **SÍ — se agrega** (aditivo)                                                                                                                                                              | Cierra el tramo de feedback discreto del research; flips de toggle/checkmark/count más snappy en mobile; cero riesgo                                                                  |
| D2  | `--ease-accelerate` para exits (§1.2)     | **NO — se difiere**                                                                                                                                                                       | Restraint + vocabulario reducido (`principles.md` §4); los exits con `--ease-emphasis` funcionan; fácil de sumar después                                                              |
| D3  | View Transitions list→detail (§5)         | **Opción A** — CSS names + wrapper `startViewTransition`, **feature-flag gateado** + fallback gracioso + `store-{slug}` + reduced-motion cross-fade + spot-check Safari. **NO** el canary | Reusa la infra stageada, evita la dependencia canary, menor riesgo, honra REGLA CERO                                                                                                  |
| D4  | Stagger de entrada de lista (§6.6)        | **NO — listas instantáneo**; se **elimina** el keyframe muerto `order-item-animate`                                                                                                       | Coherente con la tesis de restraint del sistema; un stagger en cada navegación a una lista de 80 ítems estorba (Linear/Things); la personalidad vive en mascota/brand, no en staggers |
| D5  | Showcases de motion en el demo HTML (§8)  | **NO — se entrega el motion real en Fase B** (review con `npm run dev`)                                                                                                                   | El owner evalúa mejor el movimiento en la app real que en un demo HTML; el showcase sería redundante                                                                                  |
| —   | `button-ripple` keyframe muerto (§0.3)    | **Eliminar**                                                                                                                                                                              | Sin consumidor; el ripple no es parte del lenguaje Atelier (Button usa lift + state-layer)                                                                                            |
| —   | Toast: ventana undo + `width`→`scaleX`    | **Aplicar todo** (§6.2, §2.1)                                                                                                                                                             | 5 s reversible / 8 s delete (default neutral a 5000); transform-only; `transition-[transform,opacity]` + tokens                                                                       |
| —   | Cobertura `motion-reduce` faltante (§3.3) | **Completar** (Switch track, Mascot, StoreCard, Stepper)                                                                                                                                  | reduced ≠ none como contrato                                                                                                                                                          |

## REGLA CERO — respetar, no resetear

Las primitivas de motion **ya existen y se conservan**. Esta spec construye la capa **expresiva**
encima, no reemplaza la base. Lo que se respeta verbatim:

- Los **tokens de duración** (`--motion-fast/base/slow`) y **easing** (`--ease-emphasis`,
  `--ease-out-expressive`, `--ease-bounce`, `--ease-vt-signature`) de `globals.css` §1.
- El **easing signature** `--ease-vt-signature` — exclusivo de view-transitions, auditable, **no se duplica**.
- Los **state-layer mixes** (`--state-hover-mix`, `--state-pressed-mix`, …).
- El **bloque canónico de view-transition** (`::view-transition-group(*)`, `globals.css` §8).
- Los **fallbacks `prefers-reduced-motion`** ya presentes en componentes + el **bloque global** (§12).
- El **shimmer del skeleton** (S10 / ADR 0013), el **spring del modal**, los **toasts neutral-undo + optimistic** (S7/S9).

---

## 0. Punto de partida — qué ya vive en `src/`

Inventario real (`globals.css` + componentes), base de la REGLA CERO.

### 0.1 Tokens implementados (`globals.css` §1)

```css
/* Duraciones */
--motion-fast: 150ms; /* hover, focus ring, tooltip, control state */
--motion-base: 280ms; /* sheet, modal, drawer, page/step, view-transition */
--motion-slow: 480ms; /* feedback expresivo, celebraciones, indeterminate */

/* Easings */
--ease-emphasis: cubic-bezier(0.2, 0, 0, 1); /* opacity / color / UI chica */
--ease-out-expressive: linear(0, 0.5, 0.85, 0.97, 1); /* enters de superficie */
--ease-bounce: linear(0, 0.32, 0.68, 0.92, 1.08, 1.04, 1); /* celebraciones (overshoot) */
--ease-vt-signature: linear(0, 0.18, 0.5, 0.78, 0.95, 1.02, 1); /* SOLO view-transitions */
```

> Coinciden 1:1 con `principles.md` §4 y con `_notes/s3-draft-elevation-motion.md`. No hay drift entre
> lo planeado y lo implementado. Esta spec **opera** esos tokens, no los rehace.

### 0.2 Mecanismos vivos

| Mecanismo                                    | Dónde                                                                            | Estado                                                      |
| -------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------- | ----------------------------------------------------------- |
| View-transition CSS (`view-transition-name`) | OrderCard/Table, DeliveryCard/Table, los Hero de detalle, `order-create-confirm` | **Nombres asignados, pero INERTES** (ver §5)                |
| `useAnimatedNumber` (count-roll)             | `src/hooks/useAnimatedNumber.ts` → OrderDetailHero (monto + %)                   | Vivo, 600 ms cubic-out, honra reduced-motion                |
| Toast enter/exit + countdown                 | `Toast.tsx`                                                                      | Vivo (translateX+opacity 300 ms; countdown `width 100%→0%`) |
| Toast neutral-undo                           | `DeliveryDetailClient` (reopen)                                                  | Vivo, `UNDO_TOAST_DURATION_MS = 5000`                       |
| Toggle micro (Switch/Checkbox/Radio)         | `core/Switch                                                                     | Checkbox                                                    | Radio.tsx` | Vivo, `--motion-fast` + `--ease-emphasis`, zoom-in en check |
| Modal/Sheet spring                           | `Modal/ModalDialog.tsx` (`modal-spring` 280 ms) + `ModalSheet.tsx` (Vaul)        | Vivo, con fallback `motion-reduce`                          |
| FilterDrawer rise/slide                      | `FilterDrawer.tsx` (`drawer-rise` / `drawer-slide-right` 280 ms)                 | Vivo, `motion-safe:`                                        |
| Wizard pulse hint                            | `WizardStep.tsx` + `.animate-wizard-pulse`                                       | Vivo, one-shot, `motion-reduce → none`                      |
| Skeleton shimmer                             | `.skeleton` (`globals.css`)                                                      | Vivo (ADR 0013), reduced → relleno estático                 |
| Card/row hover                               | OrderCard/Table, DeliveryCard, StoreCard                                         | Vivo, border/shadow/lift `--motion-fast`                    |
| Bloque reduced-motion global                 | `globals.css` §12                                                                | Vivo (corta todo a 0.01 ms; VT a 0.01 ms)                   |

### 0.3 Keyframes "stageados" sin consumidor (deuda detectada)

| Keyframe                                | Consumidor            | Decisión propuesta                                            |
| --------------------------------------- | --------------------- | ------------------------------------------------------------- |
| `order-item-in` / `.order-item-animate` | **ninguno**           | Cablear como _stagger_ acotado de lista (§6.6) **o** eliminar |
| `button-ripple`                         | **ninguno**           | Eliminar (dead code) — la jerarquía Atelier no usa ripple     |
| `animate-progress-indeterminate`        | (route/async loading) | Conservar; documentar su uso (§6.3)                           |
| `banner-cta-subtle`                     | `FxBanner.tsx`        | Conservar (pulse del CTA "Actualizar tipos de cambio")        |

---

## 1. Taxonomía de tokens (duraciones + easings con nombre)

### 1.1 Duraciones — escala por complejidad y distancia recorrida

El insumo de research (A1) define cuatro tramos (≈100 / 200–300 / ≈400 / hasta 500 ms). Se **mapean
sobre los tokens existentes**; donde hay un hueco real (el tramo ≈100 ms de feedback discreto) se
**propone** un token aditivo para el gate.

| Tramo research  | Uso                                                               | Token                                       | Valor   |
| --------------- | ----------------------------------------------------------------- | ------------------------------------------- | ------- |
| **≈100 ms**     | Feedback discreto: flip de toggle, checkmark "pagado", count tick | **`--motion-instant` (PROPUESTO, aditivo)** | `100ms` |
| **150 ms**      | Hover, focus ring, tooltip, transición de estado de control       | `--motion-fast`                             | `150ms` |
| **200–300 ms**  | Modal, sheet, drawer, page/step, view-transition                  | `--motion-base`                             | `280ms` |
| **≈400–500 ms** | Feedback expresivo, indeterminate, count-roll                     | `--motion-slow`                             | `480ms` |
| **600 ms**      | Count-roll de cifras (settling)                                   | (hook `useAnimatedNumber`, no token CSS)    | `600ms` |

**Propuesta para el gate — `--motion-instant: 100ms`:** el research separa el feedback discreto
(toggle, checkmark, tick) del feedback de estado de control (hover/focus, 150 ms). Hoy todo lo
"rápido" usa `--motion-fast` (150 ms). Agregar `--motion-instant` cierra el tramo ≈100 ms del insumo
sin tocar nada existente (aditivo). **Alternativa conservadora:** no agregar token y seguir usando
`--motion-fast` para todo lo rápido (150 ms ya se siente snappy). Decisión de Sergio.

> Regla dura (`principles.md` §4): cualquier animación nueva se compone con estos tokens. Si necesitás
> otro valor, justificá por qué los existentes no sirven.

### 1.2 Easings — crosswalk Material 3 / Apple HIG (cierre del gap #1 del research)

El research tenía las duraciones y la regla transform/opacity, pero **no** las curvas con nombre para
poner junto al `--ease-vt-signature`. Esto las captura. **No son tokens nuevos** — son la
documentación con nombre de las curvas que **ya existen**, para auditar uso y elegir bien.

| Token (existente)       | Curva                                        | ≈ Material 3                                      | ≈ Apple HIG (spring)     | Cuándo                                                           |
| ----------------------- | -------------------------------------------- | ------------------------------------------------- | ------------------------ | ---------------------------------------------------------------- |
| `--ease-emphasis`       | `cubic-bezier(0.2, 0, 0, 1)`                 | **Standard** (`emphasized-decelerate` aproximada) | `ease-in-out` perceptual | `opacity`, `color`, focus ring, UI chica, transiciones de estado |
| `--ease-out-expressive` | `linear(0, 0.5, 0.85, 0.97, 1)`              | **Emphasized decelerate** (spring aprox.)         | SwiftUI `.smooth`        | Enters de superficie: sheet, modal, drawer, page/step            |
| `--ease-bounce`         | `linear(0, 0.32, 0.68, 0.92, 1.08, 1.04, 1)` | **Emphasized** con overshoot                      | SwiftUI `.bouncy`        | **Solo** celebraciones / éxito (low-frequency)                   |
| `--ease-vt-signature`   | `linear(0, 0.18, 0.5, 0.78, 0.95, 1.02, 1)`  | (firma propia, overshoot 0.05)                    | spring custom            | **Solo** view-transitions (auditable, nunca reusar)              |

**Propuesta opcional para el gate — `--ease-accelerate` (M3 Emphasized accelerate):** hoy las
**salidas** (cerrar modal, dismiss de sheet, leave de toast) reusan `--ease-emphasis` (una curva
decelerate). M3 usa `emphasized-accelerate` `cubic-bezier(0.3, 0, 0.8, 0.15)` para lo que **se va** de
pantalla (arranca lento, acelera al salir). Agregarlo afinaría los exits. Prioridad baja — los exits
actuales funcionan. Decisión de Sergio.

> **Material 3** publica dos sets: _Standard_ (transiciones utilitarias) y _Emphasized_ (las "hero",
> con más carácter). Nuestro `--ease-emphasis` = la Standard; `--ease-out-expressive`/`--ease-bounce` =
> la familia Emphasized. **Apple HIG** no publica béziers con nombre: trabaja con springs físicos
> (damping/response); el análogo perceptual son nuestras curvas `linear()` multistop.

---

## 2. Reglas duras (performance + a11y)

1. **Animar SOLO `transform` y `opacity`.** Se quedan en el compositor. **Nunca** `width`, `height`,
   `top`, `left`, `margin`, `padding` (disparan layout). Dato del research (A2): la misma animación
   dropea ~50 % de frames con `top/left` vs ~1 % con `transform`.
2. **INP ≤ 200 ms en p75** (Core Web Vital), nunca > 500 ms. Handlers de interacción con trabajo corto
   en el main thread; el trabajo visual va por transform/opacity/scale.
3. **Vocabulario reducido.** Componé desde los tokens de §1. Easing nuevo = justificación escrita.
4. **`will-change` con moderación** — solo en el elemento que se anima y solo durante la animación; no
   dejarlo permanente (consume memoria de compositor).
5. **Stagger acotado.** Si una lista entra escalonada, capear el stagger (§6.6); nunca animar 50+ filas.

### 2.1 Desviaciones detectadas (reconciliar en Fase B)

| Superficie                             | Desviación                                               | Acción                                                                   |
| -------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------ |
| Toast countdown (`Toast.tsx`)          | anima `width: 100% → 0%` (layout)                        | Migrar a `transform: scaleX(1 → 0)` + `transform-origin: left`           |
| Toast enter/exit (`Toast.tsx`)         | `transition-all` (anima todo) + `duration-300` hardcoded | `transition-[transform,opacity]` + `--motion-base` (280 ms)              |
| Progress fill (`OrderDetailHero.tsx`)  | anima `width %` por frame (JS)                           | Migrar a `transform: scaleX()` origin-left (costo bajo hoy: barra única) |
| FAQ accordion (landing, `globals.css`) | `transition: max-height`                                 | Aceptable (reveal de contenido, low-risk); documentado, no bloqueante    |

---

## 3. Cobertura `prefers-reduced-motion` (obligatoria — reduced ≠ none)

El browser **no auto-honra** reduced-motion para view-transitions ni para casi nada: hay que escribirlo.
La regla (Chrome/W3C, confirmada en el research A4): **"reduced ≠ none"** — mantener una animación más
**sutil** que exprese la relación (cross-fade), no matar todo el feedback.

### 3.1 El piso global ya existe — se extiende, no se reinventa

`globals.css` §12 es el **piso**: corta `animation-duration` a `0.01 ms`, `transition-duration` a
`150 ms`, y las view-transitions a `0.01 ms`. Es correcto como red de seguridad, pero es un **martillo**:
para la VT list→detail un corte a `0.01 ms` = **none** (sin morph, sin fade). La capa expresiva nueva
debe **extender** esa cobertura con tratamientos por superficie, no inventar otro bloque.

### 3.2 Tratamiento por superficie bajo reduced-motion

| Superficie                       | Full motion                              | Reduced-motion                                                                                          |
| -------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| View-transition list→detail      | Morph shared-element (280 ms, signature) | **Cross-fade opacity ~150 ms** (posición instantánea, sin morph) — **explícito**, no el corte a 0.01 ms |
| Count-roll (`useAnimatedNumber`) | Interpola 600 ms                         | **Snap** al valor final (ya implementado)                                                               |
| Toggle (switch/checkbox/radio)   | translate/zoom 150 ms                    | Sin transición (instant)                                                                                |
| Toast enter/exit + countdown     | translateX+opacity; barra                | Aparece/desaparece sin slide; **barra oculta**, timer sigue                                             |
| Modal/Sheet                      | spring 280 ms                            | Cross-fade 200 ms (ya en `ModalDialog`); Vaul honra el sistema                                          |
| FilterDrawer                     | rise/slide 280 ms                        | `motion-safe:` ya lo desactiva → aparición directa                                                      |
| Skeleton                         | shimmer                                  | Relleno estático (ya implementado)                                                                      |
| Wizard pulse                     | ring+lift 700 ms                         | `none` (ya implementado)                                                                                |
| Stagger de lista (si se adopta)  | escalonado                               | Todo en el mismo frame                                                                                  |

**Regla vinculante:** toda superficie de la capa expresiva nueva ships con su `motion-safe:`/`motion-reduce:`
explícito (o un `@media (prefers-reduced-motion: reduce)` dedicado). El piso global queda como respaldo,
no como única cobertura.

### 3.3 Gaps de cobertura detectados (Fase B)

- **Switch track** (`Switch.tsx`): el thumb tiene `motion-reduce:transition-none`, el track **no** → agregar.
- **MascotBubble**: `hover:scale-105` sin `motion-reduce`, y el menú aparece sin transición → agregar
  `motion-reduce` al hover + entrada sutil al menú.
- **StoreCard**: hover con `transform: translateY(-2px)` inline sin `motion-reduce` explícito (lo cubre el
  piso global; conviene explícito).

---

## 4. Mapa por superficie — el catálogo (animar vs quedarse quieto)

Resultado del barrido de la app (3 agentes de exploración). Marca **KEEP** (ya está bien), **FIX**
(existe pero hay deuda), **ADD** (falta motion que aporta comprensión), **QUIET** (debe quedarse quieto
— restraint). El criterio único: _motion = comprensión, no decoración_.

### 4.1 Navegación y listas

| Superficie                              | Hoy                                                     | Token                       | Veredicto                                                         |
| --------------------------------------- | ------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------- |
| Card/row → detalle (Orders, Deliveries) | `view-transition-name` asignado pero **sin trigger**    | `--motion-base` + signature | **FIX** — cablear el trigger (§5)                                 |
| Card → detalle (Stores)                 | **sin `view-transition-name`**                          | —                           | **ADD** — `store-{slug}` (§5)                                     |
| Hover de card/row                       | border/shadow (`--motion-fast`); StoreCard también lift | `--motion-fast`             | KEEP (StoreCard: explicitar `motion-reduce`)                      |
| Chevron expand/collapse                 | `transition-transform` 200 ms                           | —                           | KEEP                                                              |
| Entrada de lista (first paint)          | **STATIC** (`order-item-animate` sin cablear)           | —                           | **ADD opcional** — stagger acotado, o eliminar el keyframe (§6.6) |
| Append de paginación / "Cargar más"     | STATIC                                                  | —                           | **QUIET** — no animar appends (honestidad > decoración)           |
| Filter chips aplicados (mount/unmount)  | STATIC                                                  | —                           | QUIET (opcional fade 150 ms; bajo valor)                          |

### 4.2 Formularios y controles

| Superficie                       | Hoy                                        | Token                      | Veredicto                                                     |
| -------------------------------- | ------------------------------------------ | -------------------------- | ------------------------------------------------------------- |
| Switch thumb/track               | translate + color                          | `--motion-fast` + emphasis | KEEP (track: agregar `motion-reduce`)                         |
| Checkbox/Radio check             | `motion-safe:zoom-in-50`                   | `--motion-fast`            | KEEP (best-in-class)                                          |
| Input border de error            | **instant** (sin transición)               | —                          | **QUIET** (intencional — M04: el error no se demora)          |
| Combobox/Select chevron + border | `transition-transform` / `-[border-color]` | `--motion-fast`            | KEEP                                                          |
| Combobox/Select popover open     | STATIC                                     | —                          | **ADD opcional** — fade/scale 150 ms origin-trigger           |
| Wizard step expand/collapse      | **STATIC** (toggle `hidden`)               | —                          | **ADD opcional** — fade del body activo (no `height`); ver §6 |
| Stepper bullet activo            | `transition-colors` (duración implícita)   | —                          | FIX — explicitar `[transition-duration:var(--motion-fast)]`   |
| Wizard pulse hint (mobile)       | `animate-wizard-pulse`                     | 700 ms custom              | KEEP                                                          |
| FilterDrawer open/close          | `drawer-rise` / `drawer-slide-right`       | `--motion-base`            | KEEP                                                          |
| FilterDrawer section reveals     | STATIC                                     | —                          | QUIET                                                         |

### 4.3 Feedback y overlays

| Superficie                    | Hoy                                       | Token                | Veredicto                                                                   |
| ----------------------------- | ----------------------------------------- | -------------------- | --------------------------------------------------------------------------- |
| Toast enter/exit              | translateX+opacity 300 ms                 | (hardcoded)          | FIX — `transition-[transform,opacity]` + `--motion-base`                    |
| Toast countdown (hairline)    | `width 100%→0%`                           | `duration` del toast | FIX — `scaleX` origin-left; **5 s / 8 s** (§6.2)                            |
| Progress de pago (fill)       | `width %` por frame (`useAnimatedNumber`) | 600 ms               | FIX — `scaleX` origin-left (§6.3)                                           |
| Morph "$0 → Pago completado"  | gated en count llegando a 0               | 600 ms               | KEEP (micro-momento de éxito, §6.4)                                         |
| StatusChip cambio de estado   | **instant swap**                          | —                    | **QUIET** (cross-fade opcional 150 ms solo si el chip es el único feedback) |
| Optimistic update (pago)      | count-roll                                | 600 ms               | KEEP                                                                        |
| Optimistic update (settings)  | spinner `isPending`                       | —                    | KEEP (sin "success pulse"; opcional, bajo valor)                            |
| Skeleton                      | shimmer                                   | 1.4 s                | KEEP                                                                        |
| Empty / Error / 404 / offline | **STATIC**                                | —                    | **QUIET** (son destinos, no transiciones; opcional fade 150–200 ms)         |
| Modal/Sheet                   | spring 280 ms + backdrop fade 200 ms      | `--motion-base`      | KEEP                                                                        |
| MascotBubble                  | hover scale; menú instant                 | implícita            | FIX — `motion-reduce` + entrada sutil del menú                              |

### 4.4 Afordancias globales

| Superficie         | Hoy                                                                 | Token                      | Veredicto                              |
| ------------------ | ------------------------------------------------------------------- | -------------------------- | -------------------------------------- |
| Button hover       | lift `-translate-y-px` + elevation; `motion-reduce` quita transform | `--motion-fast` + emphasis | KEEP                                   |
| Button ripple      | `@keyframes button-ripple` **sin consumidor**                       | —                          | **QUIET/CLEAN** — eliminar (dead code) |
| FAB hover          | `transition-colors`                                                 | implícita                  | KEEP                                   |
| FxBanner CTA pulse | `banner-cta-subtle`                                                 | infinito sutil             | KEEP                                   |

### 4.5 Principio "animar vs quedarse quieto"

- **Animá** cuando el movimiento **explica**: de dónde vino algo (morph list→detail), que un número
  cambió (count-roll), que un estado se confirmó (toggle, fully-paid morph), que una superficie entró
  (modal/sheet/drawer).
- **Quedate quieto** cuando el movimiento **estorba o miente**: errores de validación (instant — el
  error no se demora), swaps de status que ya vienen acompañados de otro feedback, appends de
  paginación, reveals de secciones de filtro, hovers en superficies no interactivas.
- **Nunca** animes para tapar latencia de fetch, ni pongas hover-motion decorativo en todo, ni
  celebraciones (`--ease-bounce`) fuera de momentos genuinamente celebratorios y de bajo riesgo.

---

## 5. View Transitions list→detail (con el CAVEAT canary)

### 5.1 Estado real hoy — la infraestructura está stageada pero INERTE

- Las cards/heroes de Orders y Deliveries tienen `view-transition-name` asignado (`order-{id}`,
  `dlv-{id}`), más `order-create-confirm`. **Stores no tiene nombre.**
- `globals.css` §8 estiliza `::view-transition-group(*)` con `--motion-base` + `--ease-vt-signature`.
- **PERO:** `next.config.ts` `experimental` tiene **solo** `serverActions` (no `viewTransition`). **No
  hay** `startViewTransition`, ni el componente React `<ViewTransition>`, ni `onNavigate`, ni librería
  (`next-view-transitions`) en `src/`. **Nada dispara `document.startViewTransition()` en la navegación**
  → el morph **no ocurre hoy**. Los nombres + el bloque global son infraestructura esperando el trigger.

> Esto es exactamente lo "greenfield" de S12: el **contrato de nombres + la firma de easing se
> conservan** (REGLA CERO); lo que falta cablear es el **disparador**, detrás de flags y con fallback.

### 5.2 Decisión — cablear el trigger, gateado y con degradación graciosa

Dos caminos. Se recomienda el **A** (menor riesgo, reusa lo stageado, mantiene el componente React
canary fuera del path); el **B** queda documentado como alternativa bendecida por el research.

**Opción A (RECOMENDADA) — CSS names + wrapper `startViewTransition`.**

- Conservar los `view-transition-name` CSS existentes + la firma `--ease-vt-signature`.
- Agregar un wrapper fino de navegación que envuelva `router.push` en `document.startViewTransition()`
  (vía `<Link onNavigate>` en Next 15+, o un hook `useViewTransitionRouter`).
- **No** requiere el componente React canary. Mínima superficie nueva.

**Opción B (research A3) — `experimental.viewTransition` + React `<unstable_ViewTransition name>`.**

- `experimental: { viewTransition: true }` en `next.config.ts` (App Router ya trae React canary).
- Envolver thumbnail (lista) y hero (detalle) en `<ViewTransition name="…">` con el mismo `name`.
- ⚠️ **CAVEAT (verificado, jun 2026):** `<ViewTransition>` de React es **experimental/canary**, no
  estable. La API puede cambiar. **No** convertirlo en dependencia dura.

### 5.3 Reglas vinculantes (ambas opciones)

1. **Gate doble:** detrás del flag de Next (experimental) **y** de un feature flag de runtime (PostHog),
   para poder apagarlo sin redeploy.
2. **Degradación graciosa:** sin soporte de browser o con el flag off → navegación normal, **la app
   funciona igual**, solo no anima. **No es dependencia dura.**
3. **Contrato de nombres (ADR 0001 D5 — CONSERVADO):** `order-{id}`, `dlv-{id}`; **ADD** `store-{slug}`
   para cerrar el gap de Stores. Nombres únicos por entidad (sin colisión en listas). Solo el par
   navegado morfea.
4. **Firma:** duración `--motion-base` (280 ms) + `--ease-vt-signature`. No customizar por pantalla.
5. **Reduced-motion explícito:** cross-fade opacity ~150 ms (posición instantánea), **no** el corte a
   0.01 ms del piso global (ver §3.2).
6. **Safari spot-check** obligatorio antes de habilitar (el research marcó este browser como el de mayor
   riesgo de la API).

### 5.4 Soporte de browser (verificado)

Chrome/Edge **111+**, Safari **18.0+**, Firefox **144+** → ~88.6 % global. Degrada gracioso fuera de ese
rango. **Refutado** (no usar): los cutoffs "Safari 18.2 / Edge 125".

---

## 6. Patrones de microinteracción canónicos

Recetas accionables. Cierran el gap #4 del research (timings de tracking: ventana de undo, lifecycle de
la barra de progreso, animación de count change).

### 6.1 Toggle (Switch / Checkbox / Radio)

- **Track/circle:** `transition-[background-color,border-color]`, `--motion-fast` (150 ms),
  `--ease-emphasis`.
- **Thumb:** `transition-transform`, mismo timing; del off al on.
- **Check/dot:** `motion-safe:zoom-in-50`, `--motion-fast`.
- **Reduced:** sin transición (instant). Hoy ok salvo el **track del Switch** (falta `motion-reduce`).
- Si se adopta `--motion-instant` (§1.1), el flip discreto puede bajar a 100 ms.

### 6.2 Optimistic + undo (toast neutral-undo) — ventana de undo

Patrón canónico de mutación reversible (ADR 0001 D4 + `optimistic-client-updates.mdc`).

- **Ventana:** **5 s** para reversibles ligeras (reabrir, soft-delete de pago, selección masiva);
  **8 s** para delete/cancel de entidad entera (más datos en juego). Hoy `UNDO_TOAST_DURATION_MS = 5000`
  (reopen de entrega); falta cablear el **8 s** en deletes.
  > **Drift a reconciliar:** `Toast.tsx` tiene `DEFAULT_DURATION_MS = 4000` (default de info/success/error).
  > Un toast neutral-undo que olvide pasar `duration` cae a 4 s, no 5 s. Fase B: o se sube el default a
  > 5000 para neutral, o se garantiza que todo callsite undo pase `duration` explícito.
- **Pausa on-hover/focus** (red de seguridad para el lector lento).
- **Countdown hairline** atado a `duration` — migrar de `width 100%→0%` a `transform: scaleX(1→0)`
  origin-left. Reduced-motion: barra oculta, timer sigue.
- **Atajo `Z`** mientras el toast está visible y no hay input enfocado (el consumidor es dueño del
  listener con latest-ref). `aria-live="polite"`.
- **Enter/exit:** translateX+opacity, `--motion-base` + `--ease-emphasis`. Sin mascota (la mascota
  nunca aparece en undo/confirm — `principles.md` §6).
- **Optimistic Confirmation** (modal/sheet): cierran sincrónicamente al submit; el coordinador padre es
  dueño del rollback + toast si el server falla.

### 6.3 Progress (lifecycle de la barra de pago)

Lifecycle: _idle → cambia el monto pagado → la barra y la cifra se asientan juntas_.

- **Fill:** hoy `width: ${animatedPct}%` actualizado por frame vía `useAnimatedNumber` (600 ms cubic-out,
  reduced → snap). Migrar a `transform: scaleX(pct)` + `transform-origin: left` (transform-only). El
  contenedor mantiene su ancho; el fill escala.
- **Color swap** (warning ↔ accent según `completedUnpaid || isOverdue`): instant es honesto (coincide
  con un cambio de estado real). Cross-fade 150 ms opcional, bajo valor.
- **Indeterminate** (route/async load): `animate-progress-indeterminate` (`translateX(-100% → 400%)`,
  `--motion-slow` + `--ease-emphasis`, loop). Reduced → estático al 50 %. Ya correcto.

### 6.4 Success micro-moment (bajo, restringido)

- **Money/tracking:** el éxito se siente por **asentamiento**, no por confeti. El morph
  "$0 → Pago completado" (gated en el count llegando a 0) es el patrón canónico: la cifra cuenta hasta 0
  y **recién ahí** se reemplaza por el bloque de estado. Replicable en "Marcar como llegada".
- **Celebración genuina** (pedido completo, pre-orden 100 % pagada, primera pieza): único lugar para
  `--ease-bounce` + (futuro) mascota `celebrating` + 1 emoji puntual. **Nunca** sobre superficies de
  confianza ni de error.

### 6.5 Count / number change

- **`useAnimatedNumber`** (600 ms cubic-out, first-mount sin animar, reduced → snap) para **cualquier
  cifra tabular que cambie por update optimista**: saldo, %, totales y (futuro) micro-stats del
  dashboard.
- **`tabular-nums`** obligatorio en cifras que actualizan (evita jitter — `principles.md` §9).
- Hoy solo en OrderDetailHero. **Extender** a DeliveryDetailHero y al dashboard cuando exista.

### 6.6 State flip / chip + entrada de lista

- **StatusChip:** swap instant por default (restraint). Cross-fade 150 ms (opacity) **solo** cuando el
  chip es el único feedback del cambio (no cuando ya hay toast/layout acompañando).
- **Stagger de lista:** `order-item-in` / `.order-item-animate` existe pero no se cablea. **Propuesta:**
  cablearlo **acotado** — opacity + `translateY(8px)`, 300 ms, delay ~40–50 ms/item, **cap en los
  primeros ~6–8 items**; nunca en appends de paginación ni en listas largas. Reduced → todo en el mismo
  frame. **Alternativa:** dejar las listas estáticas (restraint Linear) y **eliminar** el keyframe muerto.
  Decisión de Sergio en el gate.

---

## 7. Higiene / deuda detectada (cleanup para Fase B)

| Ítem                                                             | Acción                                                                            |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `button-ripple` keyframe sin consumidor                          | Eliminar (dead code)                                                              |
| `order-item-animate` keyframe sin consumidor                     | Cablear como stagger (§6.6) **o** eliminar                                        |
| Toast `transition-all`                                           | → `transition-[transform,opacity]`                                                |
| Toast `duration-300` hardcoded                                   | → `--motion-base` (280 ms)                                                        |
| Toast countdown `width`                                          | → `transform: scaleX` origin-left                                                 |
| Progress fill `width`                                            | → `transform: scaleX` origin-left                                                 |
| `DEFAULT_DURATION_MS = 4000` vs undo 5 s                         | Reconciliar (subir default neutral a 5000, o exigir `duration` explícito en undo) |
| Switch track sin `motion-reduce`                                 | Agregar                                                                           |
| MascotBubble hover sin `motion-reduce` + menú instant            | Agregar                                                                           |
| StoreCard sin `view-transition-name` + hover sin `motion-reduce` | Agregar `store-{slug}` + explicitar reduce                                        |
| Stepper bullet sin duración explícita                            | `[transition-duration:var(--motion-fast)]`                                        |

---

## 8. Handoff a Fase B

### 8.1 Archivos a tocar (orden sugerido)

1. **`globals.css`** — (a) si se aprueba, agregar `--motion-instant: 100ms` (+ opcional `--ease-accelerate`);
   (b) limpiar `button-ripple`; (c) decidir destino de `order-item-animate`; (d) tratamiento
   reduced-motion explícito para VT (cross-fade) cuando se cablee §5.
2. **View Transitions (§5)** — `next.config.ts` (flag, si Opción B) + wrapper de navegación (Opción A) +
   feature flag PostHog + `store-{slug}` en StoreCard + hero de Store. **Detrás de flag, con fallback.**
3. **`Toast.tsx`** — `transition-[transform,opacity]`, token de duración, countdown `scaleX`,
   reconciliar default vs ventana de undo, cablear 8 s en deletes.
4. **`OrderDetailHero.tsx`** — progress fill a `scaleX`.
5. **Toggles / controls** — `motion-reduce` en Switch track, Stepper bullet explícito, MascotBubble.
6. **(Opcional)** stagger de lista acotado; popover fade de Combobox/Select.
7. **(Opcional)** showcases de motion en `_notes/demo-screens.html` (sección S12) — solo si Sergio lo pide.

### 8.2 Riesgos

- **⚠️ `<ViewTransition>` de React es canary** (Opción B). Mitigación: preferir Opción A (CSS names +
  wrapper), gate doble, fallback gracioso, spot-check Safari. **No** hacerlo dependencia dura.
- **Migrar `width` → `scaleX`** en countdown/progress puede cambiar sutilmente el render (border-radius
  del fill, sub-pixel). Verificar visual light/dark + reduced-motion.
- **Stagger de lista:** riesgo de sentirse lento si no se capea. Adoptar acotado o no adoptar.
- **`prefers-reduced-motion`:** el piso global enmascara faltantes de cobertura per-componente.
  Verificar cada superficie nueva con el flag del SO activo.

### 8.3 Validación esperada (Fase B)

`npm run test` · `npm run type-check` · `npm run lint` · `npm run validate-build`. Si se cablea VT o se
tocan flujos con e2e (orders/deliveries/landing/auth), correr la spec correspondiente. Verificación
visual light/dark/mobile + **con `prefers-reduced-motion` activo** + spot-check Safari para VT.
