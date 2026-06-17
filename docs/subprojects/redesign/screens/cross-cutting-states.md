---
title: Estados transversales — empty / loading / error
session: 10-cross-cutting-states
status: Fase A — propuesta (gate visual pendiente)
last_updated: 2026-06-13
owner: Sergio Minei
adrs:
  - ADR 0013 — Cross-cutting state system (skeleton / empty / error)
demo_anchors:
  - "#s10-skeleton-anatomy"
  - "#s10-detail-loading"
  - "#s10-form-loading"
  - "#s10-empty-anatomy"
  - "#s10-route-error"
  - "#s10-section-error"
  - "#s10-not-found"
  - "#s10-offline"
---

# Estados transversales (empty / loading / error)

> **S10 no agrega pantallas de producto.** Unifica y eleva a sistema los estados que ya
> aparecen ad-hoc en todos los módulos (Tiendas S6, Órdenes S7, Entregas S9) y diseña por
> primera vez los estados de error con identidad de rediseño. El objetivo es que
> `empty` / `loading` / `error` sean consistentes y deriven de **primitivas canónicas**.

Tres familias, cada una derivada de una primitiva:

| Familia     | Primitiva                                           | Reemplaza / consolida                                                                 |
| ----------- | --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Loading** | `<Skeleton>` (átomo + composites)                   | `OrderListLoadingSkeleton`, `DeliveryListLoadingSkeleton`, `StoreListingGridSkeleton` |
| **Empty**   | `<EmptyState>` (tonos extendidos)                   | empties ad-hoc; sigue siendo la referencia única cross-módulo                         |
| **Error**   | `<EmptyState>` full-page + `<SectionError>` (nuevo) | `error.tsx`, `global-error.tsx`, 404 inexistente, error de sección inexistente        |

---

## 1. Auditoría de partida + decisiones de consolidación

### 1.1 Empty (canónico ya existe — consolidación menor)

`src/components/modules/EmptyState.tsx` es el canónico (S6). Tiene `appearance: plain | card`,
`iconTone: neutral | accent`, slots `visual` / `icon` / `title` / `subtitle` / `actions`.

| Componente actual          | ¿Usa canónico?      | Decisión S10                                                                                                                                                                                                                                                                                       |
| -------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EmptyState` (modules)     | — (es el canónico)  | **Mantener.** Extender `iconTone` a `neutral \| accent \| warning \| destructive`; agregar `appearance="page"` (el `compact` planeado se descartó en Fase B — ver §3.2).                                                                                                                           |
| `OrderListEmptyState`      | ✅ `card`           | Mantener. `noOrders` (accent + `PackageOpen` + primary) / `noResults` (neutral + `SearchX` + ghost).                                                                                                                                                                                               |
| `DeliveryListEmptyState`   | ✅ `card`           | Mantener. `noDeliveries` (accent + `Truck`) / `noResults` (neutral + `SearchX`).                                                                                                                                                                                                                   |
| `DeliveryCreateEmptyState` | ✅ `card` + BackNav | Mantener. Empty de elegibilidad (FR-08-17).                                                                                                                                                                                                                                                        |
| `OrderCreateEmptyStores`   | ❌ **ad-hoc**       | **Consolidar → `EmptyState` `card`.** Hoy usa borde sólido + icon-well 48px cuadrado + tipografía 15/13. Es la **misma semántica** que `DeliveryCreateEmptyState` (gating: sin tiendas no se puede crear pedido). Envolver con `BackNavLink` + `h1` igual que aquél, tono `accent`, ícono `Store`. |
| `StoreEmptyStateBox`       | ❌ ad-hoc           | **Borrar (dead code).** En Fase B se confirmó que `StoreEmptyStateBox` no tiene consumidores en `src/`; se eliminó en vez de consolidar.                                                                                                                                                           |
| `StoreEmptyCatalogTag`     | ❌ ad-hoc           | **Legítimamente específico — mantener.** Es un _empty a nivel chip_ (pill dashed con `CircleMinus` para "campo de catálogo sin valores"), no una región. Documentar como excepción permitida.                                                                                                      |
| `AppComingSoonCard`        | ✅ (usa EmptyState) | Mantener (placeholder dashboard fuera de alcance S10).                                                                                                                                                                                                                                             |

### 1.2 Loading (SIN primitiva canónica — el gap más grande)

No existe `<Skeleton>`. Hay **tres recetas distintas** + animación inconsistente:

| Fuente                        | Receta del átomo                                               | Animación                                | a11y                          |
| ----------------------------- | -------------------------------------------------------------- | ---------------------------------------- | ----------------------------- |
| `OrderListLoadingSkeleton`    | `color-mix(in oklch, var(--text-primary) 10%, transparent)` r6 | `motion-safe:animate-pulse`              | ✅ `aria-busy` + `aria-live`  |
| `DeliveryListLoadingSkeleton` | idéntica a Orders                                              | `motion-safe:animate-pulse`              | ✅                            |
| `StoreListingGridSkeleton`    | `var(--border)` (otra tonalidad)                               | `animate-pulse` **sin `motion-safe`** ❌ | ✅ `aria-busy` + `aria-label` |
| demo `.skeleton` (S6)         | gradient `--border-strong`/`--border`                          | `shimmer 1.6s ease-in-out`               | cards `aria-hidden`           |
| demo `.s7-mob-skel` (S7)      | gradient `--text-primary` 6/12/6%                              | `s7-skel-shimmer 1.4s linear`            | `aria-busy` en contenedor     |

**Divergencias:** (a) dos rellenos distintos (`--text-primary` mix vs `--border`); (b) el demo usa **shimmer**, el React usa **pulse**; (c) `StoreListingGridSkeleton` no respeta `prefers-reduced-motion`; (d) **no existe skeleton de detalle ni de formulario** (`orders/[id]/loading.tsx` retorna `null`); (e) Stores carga con `<Suspense>` en `page.tsx` (no `loading.tsx`), Orders/Deliveries con `loading.tsx`.

**Decisión:** extraer `<Skeleton>` canónico (cierra gap **G8** de `s4-gaps.md`). Receta del átomo = clase CSS shipped **`.skeleton`** (el demo la prototipó como `.s10-skel`; promueve `.s7-mob-skel`, la mejor de las dos: mezcla neutra sobre `--text-primary`, funciona en cualquier superficie). Las recetas viejas (`.skeleton` S6, `.s7-mob-skel` S7, las dos del React) quedan **superseded**.

**Decisión de animación (GATE — ver §3.2): unificar en SHIMMER** (vibe del demo) en lugar de pulse. Es lo que el demo ya usa; el React migra de pulse → shimmer. Con `prefers-reduced-motion: reduce` → relleno estático sin animación.

### 1.3 Error (el gap de diseño más grande — nada rediseñado)

| Superficie                   | Estado actual                                                                                               | Decisión S10                                                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `(app)/error.tsx`            | Legacy: `SectionTitleWithAccent` + `Typography` + `Button`, card centrada. Sentry con tag `area:app_shell`. | **Rediseñar** a calidad rediseño (icon-well destructive, eyebrow mono, CTAs retry + ir-al-inicio).                       |
| `global-error.tsx`           | `NextError statusCode={0}` (página default de Next, sin diseño). Sentry bare.                               | **Rediseñar** a fallback minimal self-contained (sin providers ni i18n — estilos inline + tokens; copy bilingüe inline). |
| `not-found.tsx`              | **No existe** en ningún lado.                                                                               | **Crear** `(app)/not-found.tsx` (+ raíz si aplica) con identidad rediseño.                                               |
| Error de sección (con retry) | **No existe** ningún patrón.                                                                                | **Crear** `<SectionError>` reusable (patrón nuevo → ADR 0013).                                                           |
| Offline / sin conexión       | No existe.                                                                                                  | Variante `tone="warning"` de `<SectionError>` + estado full-page opcional.                                               |

**Sentry:** `error.tsx` ya captura con tag; `global-error` captura bare; muchos server actions capturan los suyos. El nuevo `<SectionError>` **no debe duplicar** la captura (ver §4.4).

---

## 2. Familia LOADING — `<Skeleton>`

### 2.1 Átomo `.skeleton`

Receta única (clase CSS shipped `.skeleton`; el demo la prototipó como `.s10-skel`):

```css
.skeleton {
  /* color-mix en custom properties, NO como color-stop del gradiente (L079):
     Lightning CSS / Tailwind v4 descarta la regla si el stop es `color-mix(…) <pos%>`. */
  --skeleton-base: color-mix(in oklab, var(--text-primary) 8%, transparent);
  --skeleton-highlight: color-mix(in oklab, var(--text-primary) 16%, transparent);
  background: linear-gradient(90deg, var(--skeleton-base), var(--skeleton-highlight), var(--skeleton-base));
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.4s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
    background: var(--skeleton-base);
  }
}
```

- **`color-mix` por custom property, no en el color-stop (L079):** Lightning CSS (Tailwind v4) descarta la regla si el `linear-gradient` tiene `color-mix(…) <posición%>` como stop. Se indirecciona por `var()`.
- **`in oklab`, no `in oklch` (L074):** sobre tokens neutros como `--text-primary`, oklch deriva el hue hacia rosa; oklab mantiene un gris limpio en todas las superficies.
- **Por qué `--text-primary` mix y no `--border`:** el mix neutro tiene contraste consistente sobre canvas (`--background`), `--surface` y `--surface-elevated`. `--border` se aplana en dark.
- **Reduce-motion:** relleno estático al 9% (punto medio del shimmer). Nunca animar bajo `prefers-reduced-motion`.

### 2.2 Composiciones canónicas

Demo anchor `#s10-skeleton-anatomy` muestra el átomo (4 formas) + las 4 composiciones. Las ad-hoc migran a éstas:

| Composición   | Anatomía                                                                                  | Reemplaza                                          |
| ------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `list-row`    | circle 36 + 2 líneas (70%/50%) + pill estado                                              | filas de `OrderListLoadingSkeleton` etc.           |
| `card`        | header (circle 40 + 2 líneas) + pill + barra de progreso                                  | cards mobile de las listas, grid de Stores         |
| `detail-hero` | circle 52 + título 18 + subtítulo + chip estado + divisor + 3 stat-tiles                  | **NUEVO** — `orders/[id]/loading.tsx` (hoy `null`) |
| `form`        | label + input ×N + botón submit (alineado a la derecha); wizard agrega stepper de bolitas | **NUEVO** — loading de create/edit                 |

Demo anchors en contexto: `#s10-detail-loading` (detalle), `#s10-form-loading` (wizard), `#s10-detail-loading-mobile`.

### 2.3 Cuándo skeleton vs spinner vs nada (regla `react-next-components.mdc`)

- **Skeleton vía `loading.tsx` / `<Suspense>`** cuando Next resuelve trabajo **server** (DB/RSC lentos) de una pantalla cuyo layout es predecible (listas, detalle, form). La UI llega por SSR, no por chunk de cliente.
- **NO fake client fallback:** prohibido `dynamic(..., { loading })` para Client Components que igual se renderizan server-side (`ssr: true`). El skeleton casi nunca aparece y suma complejidad. (Regla `react-next-components.mdc` §"Loading UI".)
- **Spinner (`<Loader2>`):** solo para estados que el **usuario dispara** y son cortos/indeterminados — submit pendiente (botón `loading`), búsqueda en `<Input loading>`, autosave. Nunca como fallback de ruta.
- **Nada:** mutaciones optimistas (el cambio se aplica local de inmediato; no se muestra loading). Ver `optimistic-client-updates.mdc`.

---

## 3. Familia EMPTY — `<EmptyState>`

### 3.1 Anatomía única, dos clases (referencia: `#s10-empty-anatomy`)

Todos los empties de lista/flujo usan `<EmptyState appearance="card">`: card dashed sobre
`--surface-elevated`, radio `--radius-2xl`, círculo de 64px (`h-16 w-16`), título (`h2`/`h3`),
subtítulo `--text-secondary`, CTAs. Cambian solo **tono del ícono** + copy:

| Clase                         | `iconTone` | Ícono ejemplo | CTA                      | Voz (ux-copy.md)                            |
| ----------------------------- | ---------- | ------------- | ------------------------ | ------------------------------------------- |
| **Primera vez** (first-run)   | `accent`   | `PackageOpen` | primary (verbo + objeto) | Forward-looking, invita: "Anota tu primer…" |
| **Sin resultados** (filtrado) | `neutral`  | `SearchX`     | ghost "Limpiar filtros"  | Neutral, ofrece salida: "Prueba ajustando…" |

### 3.2 Cambios al componente (Fase B)

- **`iconTone` extendido:** `neutral | accent | warning | destructive`. `warning`/`destructive` se usan cuando `EmptyState` es la base de estados full-page de error/offline (§4).
- **`appearance="page"`:** estado centrado full-page (route error / 404 / offline) — icon-well 72px, eyebrow mono opcional, título h1, `min-height` de viewport. (El `compact` planeado se descartó: su único consumidor previsto, `StoreEmptyStateBox`, resultó dead code.)
- **Slot `visual` se preserva** para una futura mascota _sleeping_ (assets pendientes — ver §6). S10 **no** monta mascota.

### 3.3 Empties que NO se tocan

- `StoreEmptyCatalogTag` — empty a nivel chip (excepción documentada).
- Empties dentro de modales/sheets — el icon-circle del Modal ya cumple la función.

---

## 4. Familia ERROR

### 4.1 Error de RUTA full-page (`error.tsx`) — `#s10-route-error`

Construido sobre el bloque centrado (sibling de `.s7-empty`, clase demo `.s10-state`):

- Icon-well 72px circular, **tono `destructive`** (`color-mix(--destructive 12%)` + ícono `--destructive`).
- Ícono `TriangleAlert`. Eyebrow mono "Algo falló". Título 20px. Subtítulo ≤440px.
- Acciones: primary "Reintentar" (`RotateCw`, llama `reset()`) + ghost "Ir al inicio".
- `role="alert"`. Mantiene el shell (sidebar + topbar) porque el error es del segmento, no del layout.
- Sentry: conserva el `captureException` con `tags.area` + `extra.digest` (ya presente).

### 4.2 `global-error.tsx` (fallback catastrófico del root layout)

- No tiene acceso a providers ni `next-intl` (reemplaza el root layout). Estilos **inline + tokens** o un CSS mínimo; copy **bilingüe inline** (no i18n).
- Mantiene la vibe (icon-well destructive + retry) pero self-contained. `<html data-scroll-behavior="smooth">` (L048).
- Sentry: `captureException(error)` (ya presente).

### 4.3 Error de SECCIÓN con retry (`<SectionError>` — NUEVO) — `#s10-section-error`

Una región (card/lista) falló mientras el resto de la página vive. Patrón nuevo → **ADR 0013**.

- Visual = vocabulario **§9.17 Chip-Eyebrow + Top-Accent**, tono `destructive`: card `--surface-elevated`
  con `border-top: 2px` destructive + chip eyebrow mono "No se pudo cargar" (`TriangleAlert`) + mensaje
  `--text-secondary` + botón ghost "Reintentar" (`RotateCw`).
- **Mecánica (App Router):** `<SectionError>` es un Client Component chico con un botón de retry. El retry
  llama un `onRetry` (default `router.refresh()` para re-correr los Server Components). La carga sigue
  siendo SSR (no fake client fallback). Para capturar el fallo de una subárea sin tumbar la ruta, el
  consumidor envuelve el fetch fallible en `try/catch` (Server Component) y renderiza `<SectionError>` en
  el `catch`, o usa un error boundary de cliente acotado a esa subárea.
- `role="alert"` + `aria-live="polite"`.
- **Variante `tone="warning"` = offline** (`WifiOff`, "Sin conexión").

### 4.4 404 not-found (`not-found.tsx` — NUEVO) — `#s10-not-found`

- Mismo bloque `.s10-state`, **tono `neutral`** (un 404 no es un error: el contenido no existe / se movió).
- Ícono `Compass`. Eyebrow mono "Error 404". Título "Esta página no existe". CTAs: primary "Volver al inicio" (`Home`) + ghost "Ver mis pedidos".
- Mantiene el shell. **NO** captura en Sentry (404 es esperado, no excepción).

### 4.5 Offline / sin conexión — `#s10-offline`

- Full-page: bloque `.s10-state` **tono `warning`** (`WifiOff`), "Parece que estás sin conexión".
- Section-level: `<SectionError tone="warning">`.
- Es transitorio → warning, no destructive. **NO** Sentry.

### 4.6 Ownership de Sentry (sin ruido duplicado)

| Quién captura         | Qué                                       | Tag/contexto                                                       |
| --------------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| `error.tsx`           | error de render del segmento `(app)`      | `tags.area` + `extra.digest`                                       |
| `global-error.tsx`    | error del root layout                     | bare `captureException`                                            |
| Server actions        | sus propios errores esperados/inesperados | ya implementado (no tocar)                                         |
| `<SectionError>`      | **no captura** por sí mismo               | el fetch fallible que lo origina captura una vez en su `try/catch` |
| `not-found` / offline | **no captura** (esperado / transitorio)   | —                                                                  |

Regla: cada error se reporta **una sola vez**. El `<SectionError>` es presentación; la captura vive en la capa de datos que falló. (Ver `sentry-error-handling.mdc`.)

---

## 5. Contratos de componente (Fase B)

### 5.1 `<Skeleton>` (nuevo — `src/components/core/Skeleton.tsx`)

```ts
type SkeletonProps = {
  /** Forma. `text` líneas, `circle` avatar, `rect` bloque, `pill` chip. Default `rect`. */
  variant?: "text" | "circle" | "rect" | "pill";
  width?: string | number;
  height?: string | number;
  /** Para `text`: número de líneas (la última al 60-80%). */
  lines?: number;
  className?: string;
};
```

- Render: `<span>` con la clase del átomo `.skeleton` (Tailwind v4: `motion-safe:` shimmer + reduced-motion estático).
- **Atributos a11y los pone el contenedor, no el átomo.** El átomo es `aria-hidden`. El wrapper de la composición lleva `aria-busy="true"` (+ `aria-live="polite"` o `aria-label="Cargando…"`).
- Composiciones (`ListRowSkeleton`, `CardSkeleton`, `DetailHeroSkeleton`, `FormSkeleton`) viven cerca del átomo o como helpers de módulo según reuso. Migrar `OrderListLoadingSkeleton` / `DeliveryListLoadingSkeleton` / `StoreListingGridSkeleton` a consumir el átomo (misma receta, shimmer).

### 5.2 `<EmptyState>` (extender — `src/components/modules/EmptyState.tsx`)

- `iconTone: "neutral" | "accent" | "warning" | "destructive"` (agregar warning/destructive al record de clases).
- `appearance: "plain" | "card" | "page"` (agregar `page`; el `compact` planeado se descartó).
- Sin breaking change: defaults actuales se preservan (L016 — API aditiva).

### 5.3 `<SectionError>` (nuevo — `src/components/modules/SectionError.tsx`)

```ts
type SectionErrorProps = {
  /** Eyebrow del chip. Default i18n `components.sectionError.title`. */
  title?: string;
  /** Mensaje. Context-specific lo pasa el consumidor. */
  message: string;
  /** Tono. `destructive` error, `warning` offline/transitorio. Default `destructive`. */
  tone?: "destructive" | "warning";
  /** Handler de reintento. Default `router.refresh()`. */
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
};
```

- Client Component (`"use client"` por el botón de retry).
- `role="alert"` + `aria-live="polite"`.

### 5.4 Boundaries

- `error.tsx`: Client Component, full-page `.s10-state` destructive, `reset()` en el primary.
- `global-error.tsx`: Client Component self-contained (sin i18n), bilingüe inline.
- `not-found.tsx`: Server Component, full-page `.s10-state` neutral.

---

## 6. Mascota — decisión (no bloquea S10)

`MascotBubble` está **desmontado del shell** (cross-cutting S5.3, 2026-05-15) y los sprites siguen
diferidos (delta D3-03, assets pendientes). Anti-patrón vinculante (`MascotBubble.md` §Anti-patrones,
`directions.md` §4.10): **la mascota NUNCA aparece en errores ni confirmaciones**.

**Decisión S10:**

- **Errores (route / section / 404 / offline): mascota prohibida.** Anti-patrón duro.
- **Empties: S10 NO monta mascota.** El icon-well canónico es suficiente y es lo que toda la app usa hoy.
  El slot `visual` del `<EmptyState>` queda reservado para una futura mascota _sleeping_ en empty-hero
  cuando los assets existan — **no se implementa acá**, no se bloquea S10 en sprites.

---

## 7. i18n (es + en)

Copy en **español neutro** (PLAYBOOK §5.2). EN se completa en el mismo cambio (L036).

| Clave                                     | ES                                                                                                         | EN                                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `appLayout.error.eyebrow`                 | Algo falló                                                                                                 | Something went wrong                                                               |
| `appLayout.error.title`                   | Algo se rompió de nuestro lado                                                                             | Something broke on our end                                                         |
| `appLayout.error.description`             | No pudimos cargar esta página. Vuelve a intentarlo; si sigue sin funcionar, prueba de nuevo en un momento. | We couldn't load this page. Try again; if it keeps failing, try again in a moment. |
| `appLayout.error.retry`                   | Reintentar                                                                                                 | Try again                                                                          |
| `appLayout.error.goHome`                  | Ir al inicio                                                                                               | Go home                                                                            |
| `appLayout.notFound.eyebrow`              | Error 404                                                                                                  | Error 404                                                                          |
| `appLayout.notFound.title`                | Esta página no existe                                                                                      | This page doesn't exist                                                            |
| `appLayout.notFound.description`          | Puede que el enlace esté roto o que el contenido se haya movido. Volvamos a un lugar conocido.             | The link may be broken or the content may have moved. Let's get you back on track. |
| `appLayout.notFound.homeCta`              | Volver al inicio                                                                                           | Back to home                                                                       |
| `appLayout.notFound.ordersCta`            | Ver mis pedidos                                                                                            | View my orders                                                                     |
| `components.sectionError.title`           | No se pudo cargar                                                                                          | Couldn't load                                                                      |
| `components.sectionError.retry`           | Reintentar                                                                                                 | Try again                                                                          |
| `components.sectionError.offline.title`   | Sin conexión                                                                                               | No connection                                                                      |
| `components.sectionError.offline.message` | Parece que perdiste la conexión. Revisa tu red y vuelve a intentarlo.                                      | Looks like you lost connection. Check your network and try again.                  |
| `components.skeleton.loading`             | Cargando…                                                                                                  | Loading…                                                                           |
| `offline.title` (full-page)               | Parece que estás sin conexión                                                                              | You appear to be offline                                                           |
| `offline.description`                     | Revisa tu red y vuelve a intentarlo. Tus cambios guardados están a salvo.                                  | Check your network and try again. Your saved changes are safe.                     |

> `global-error.tsx` no usa i18n (reemplaza el root layout): copy **inline bilingüe** dentro del componente.

Skeleton `aria-label` por contexto reusa las keys de módulo existentes (`orderListing`, `deliveries`, `stores`) y agrega `components.skeleton.loading` como fallback genérico.

---

## 8. Accesibilidad

- **Loading:** `aria-busy="true"` en el contenedor del skeleton; átomos `aria-hidden`. `aria-label` o `aria-live="polite"` describiendo qué carga ("Cargando pedidos"). Shimmer respeta `prefers-reduced-motion` (estático).
- **Empty:** título como heading del outline (list pages: `h2` bajo el `h1`); icon-well decorativo `aria-hidden`.
- **Error de ruta / 404:** `role="alert"` (route error) en el bloque; foco al heading o al botón primario al montar el boundary (focus management). Botones con label verbo+objeto.
- **Section error:** `role="alert"` + `aria-live="polite"` para anunciar el fallo de la región sin robar foco.
- **Offline:** `role="status"` + `aria-live="polite"` (transitorio, no urgente).

---

## 9. Edge cases acordados

1. **`orders/[id]/loading.tsx`** hoy retorna `null` (placeholder S7). S10 lo reemplaza por `DetailHeroSkeleton`.
2. **Stores carga con `<Suspense>`** en `page.tsx`, no `loading.tsx`. Mantener el mecanismo; solo cambia el átomo del skeleton.
3. **Retry de section-error sin handler:** default `router.refresh()`. Si el consumidor pasa `onRetry`, se usa ese.
4. **`global-error` sin i18n/providers:** copy inline bilingüe; nunca importar `useTranslations`.
5. **404 vs error:** `not-found()` de Next dispara `not-found.tsx` (neutral, sin Sentry); un throw dispara `error.tsx` (destructive, con Sentry).
6. **Reduced-motion mid-session:** el shimmer es CSS puro con `@media (prefers-reduced-motion)`, reacciona solo.
7. **Skeleton sobre distintas superficies:** `--text-primary` mix mantiene contraste sobre canvas/surface/elevated (por eso no `--border`).

---

## 10. Anti-patrones

- ❌ Receta de skeleton ad-hoc por módulo. Usar el átomo `.skeleton` / `<Skeleton>`.
- ❌ `animate-pulse` sin `motion-safe:` (bug actual de `StoreListingGridSkeleton`).
- ❌ Fake client fallback (`dynamic loading`) para UI que llega por SSR.
- ❌ Mascota en cualquier estado de error o confirmación (anti-patrón duro).
- ❌ Tono `destructive` para un 404 (no es un error; usar `neutral`).
- ❌ Doble captura en Sentry: `<SectionError>` no captura; la capa de datos sí.
- ❌ Cerrar/colapsar el shell en `error.tsx` o `not-found.tsx` (el error es del segmento, no del layout).
- ❌ Spinner como fallback de ruta. Spinner solo para acciones cortas que el usuario dispara.
- ❌ Empty sin CTA accionable cuando hay una acción obvia (first-run siempre ofrece "Anotar…").

---

## 11. Handoff a Fase B

### Archivos a crear / modificar

| Path                                                                            | Acción                                                               |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `src/components/core/Skeleton.tsx`                                              | **Crear** átomo + composites (`ListRow/Card/DetailHero/Form`).       |
| `src/components/modules/EmptyState.tsx`                                         | Extender `iconTone` (+warning/destructive) y `appearance` (+`page`). |
| `src/components/modules/SectionError.tsx`                                       | **Crear** componente de error de sección con retry.                  |
| `src/app/[locale]/(app)/error.tsx`                                              | Rediseñar a `.s10-state` destructive (mantener Sentry).              |
| `src/app/global-error.tsx`                                                      | Rediseñar self-contained bilingüe (mantener Sentry).                 |
| `src/app/[locale]/(app)/not-found.tsx`                                          | **Crear** 404 neutral.                                               |
| `src/app/[locale]/(app)/orders/[id]/loading.tsx`                                | Reemplazar `null` por `DetailHeroSkeleton`.                          |
| `src/app/[locale]/(app)/orders/_components/OrderListLoadingSkeleton.tsx`        | Migrar al átomo (shimmer).                                           |
| `src/app/[locale]/(app)/deliveries/_components/DeliveryListLoadingSkeleton.tsx` | Migrar al átomo (shimmer).                                           |
| `src/app/[locale]/(app)/stores/_components/StoreListingGridSkeleton.tsx`        | Migrar al átomo (+ fix `motion-safe`).                               |
| `src/app/[locale]/(app)/orders/_components/share/OrderCreateEmptyStores.tsx`    | Consolidar sobre `EmptyState` `card`.                                |
| `src/app/[locale]/(app)/stores/_components/share/StoreEmptyStateBox.tsx`        | Borrar (dead code — sin consumidores en `src/`).                     |
| `src/i18n/locales/{es,en}/*.json`                                               | Keys de §7.                                                          |
| `docs/redesign/components/Skeleton.md`, `SectionError.md`, `EmptyState.md`      | Specs de componente (crear/actualizar).                              |

### Componentes a consumir

`<Skeleton>` (nuevo), `<EmptyState>` (extendido), `<SectionError>` (nuevo), `<Button>` (variants primary/ghost), `<Eyebrow variant="chip" tone="destructive">` (para SectionError, §9.17), íconos Lucide `TriangleAlert` / `RotateCw` / `Compass` / `Home` / `WifiOff` / `PackageOpen` / `SearchX` / `Store`.

### Tokens a usar

`--text-primary` (skeleton mix), `--destructive` / `--warning` / `--accent` (icon-wells + top-accents), `--surface-elevated`, `--border`, `--radius-2xl` / `--radius-xl` / `--radius-lg`, `--font-mono` (eyebrows). Alpha sobre neutros con `color-mix(in oklab, …)` (L074); sobre acentos/status con `color-mix(in oklch, …)`.

### Decisiones cerradas

1. Skeleton canónico = **shimmer** (no pulse), clase `.skeleton` (`--text-primary` mix). Reduced-motion → estático.
2. `EmptyState` es la primitiva compartida del bloque centrado: empty (neutral/accent) + base de error full-page (destructive/warning) + 404 (neutral).
3. `SectionError` es patrón nuevo (ADR 0013), §9.17 destructive, retry = `router.refresh()` por default.
4. Tonos: empty-firstrun `accent`, empty-noresults `neutral`, route-error `destructive`, 404 `neutral`, offline `warning`, section-error `destructive`.
5. Mascota: prohibida en errores; no se monta en empties (slot `visual` reservado para el futuro).
6. Sentry: una sola captura por error; `SectionError` no captura.

### Validación esperada

`npm run test` + `npm run type-check` + `npm run lint` + `npm run validate-build`. Verificación visual en preview (light + dark + 390px) forzando un error de sección y uno de ruta (throw temporal / mock) para ver las boundaries reales; skeletons en navegación lenta; empties en cada lista. Correr e2e afectado si se toca un flujo con cobertura Playwright.

### Cláusula de spec vigente

No hay mini-sesiones cross-cutting abiertas (`cross-cutting-changes.md`) que afecten estos componentes. `EmptyState` se extiende de forma aditiva (sin romper consumidores S6/S7/S9).
