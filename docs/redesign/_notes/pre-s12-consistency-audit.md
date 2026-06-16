---
title: Auditoría de consistencia y regresión visual/UX — pre-S12
last_updated: 2026-06-15
status: hallazgos para decisión humana (NO se aplicó ningún fix)
owner: Sergio Minei
scope: smoke-check de seguridad antes de S12 (Motion). NO es la auditoría final S13.
---

# Auditoría pre-S12 — consistencia y regresión visual/UX

> **Naturaleza de este documento.** Pasada **READ-ONLY** sobre la branch `redesign` tras cerrar S1–S11.
> Es un **inventario de hallazgos**, no un changelog: **no se tocó código de producción ni FRDs**.
> Cubre lo que los tests automáticos (542 unit + type-check + lint 0 + e2e landing/auth, todos verdes) **no atrapan**:
> regresiones visuales, incoherencias cross-superficie y deriva de patrones tras el cambio acumulado.
> No es la auditoría exhaustiva S13 — es un smoke-check enfocado en lo que S12 va a tocar.

> **Cierre S13 (2026-06-16).** La auditoría final dispuso todos los hallazgos diferidos de este doc (detalle en [`s13-final-audit.md`](./s13-final-audit.md)):
>
> - **F-01, F-02, F-05, F-06** → ✅ ya arreglados pre-S12 (ver más abajo).
> - **F-03 (wordmark Zilla vs Inter)** → 👍 aceptar + documentar: Zilla ya está acotado al logo (`Logo`/favicon/OG), no leakea; el `BrandMark` público es el lockup S11 aprobado. Decisión de Sergio: "Zilla es solo para el logo".
> - **F-04 (slot "Resumen")** → 👍 aceptar + congelar regla: no es drift, son dos familias de slot (accent "tus cosas" vs cool "recap de datos"), cada una consistente.
> - **F-07 (aria-labels hardcodeados)** → 🔧 arreglado: DateInput/Toast/Sheet/WizardStep ruteados por i18n.
> - **F-08 (tooltips landing + LanguageToggle)** → 🔧 arreglado: `SimpleIconSvg` decorativo + fallback de LanguageToggle por i18n.
> - **F-09 (paleta de imágenes de marca), F-10 (global-error dark-only)** → 👍 aceptar-intencional (hex requerido para render de imágenes/email/fallback catastrófico).
> - **F-11 (color barra de pago)** → 👍 intencional: regla coherente success/warning/accent (verificada en fuente).
> - **F-12 (avatar settings vs sidebar)** → 👍 intencional: two-source (foto OAuth global vs avatar curado de la app). Sin cambio.

## 1. Resumen ejecutivo

**12 hallazgos** + varias observaciones de baja confianza. **Cero bloqueantes.** El sistema Velvet está
sano y cohesivo: las superficies públicas nuevas de S11 (landing/auth/legal) se sienten del **mismo sistema**
que la app (misma tipografía Inter, mismos tokens, mismo tono), el **vocabulario congelado §9.17 es correcto**
en order/store/delivery-detail y settings, los **componentes canónicos de S10** (`<Skeleton>`/`<EmptyState>`/`<SectionError>`)
están adoptados, la **paridad i18n es/en está limpia**, y la **consola está limpia en todas las rutas**.

El hallazgo dominante es una **única regresión visible**: el bug **L074 (tinte rosado/salmón por `color-mix in oklch`
sobre tokens neutros) fue re-introducido en la CSS pública nueva de S11** y es visible en light theme en las barras
superiores de landing/auth/legal y en la cinta del hero. El resto son incoherencias cross-superficie menores,
strings hardcodeados de baja prioridad y nits cosméticos.

| Severidad     | Cantidad | IDs                                |
| ------------- | -------- | ---------------------------------- |
| 🔴 Bloqueante | 0        | —                                  |
| 🟠 Mayor      | 1        | F-01                               |
| 🟡 Menor      | 6        | F-02, F-03, F-04, F-05, F-06, F-07 |
| ⚪ Cosmético  | 5        | F-08, F-09, F-10, F-11, F-12       |

Distribución por categoría: regresión visual ×1 (F-01) · anti-pattern código ×2 (F-02, parte de F-01) ·
incoherencia cross-superficie ×3 (F-03, F-04, F-11) · i18n ×3 (F-06, F-07, F-08) · a11y ×1 (F-07) ·
cosmético/verificar ×4 (F-09, F-10, F-12, + observaciones).

## 2. Método y cobertura

**A) Barrido de código** (grep dirigido + 3 agentes Explore en paralelo):
theme-blind/hardcoded colors, bug L074 (`color-mix in oklch` sobre tokens neutros), strings user-facing
hardcodeados en TSX, paridad i18n es/en, vocabulario §9.17 cross-superficie, adopción de componentes S10.

**B) Pasada visual** (MCP Claude_Preview, dev server :7100, login dev) en **light + dark, desktop 1280 + mobile 390**:

- **Públicas (anónimas):** landing `/`, sign-in, privacy (legal). Auth/legal comparten chrome → cubiertas por clase.
- **App (autenticado):** dashboard (placeholder — esperado), stores (lista + detalle), orders (lista + detalle + mobile),
  deliveries (lista + detalle), settings (pane Perfil). Estados: 404 no-emparejado (default Next) vs `notFound()` in-segment (canónico).
- **Verificaciones puntuales:** colores `oklch` vs `oklab` resueltos en runtime (prueba decisiva de L074), tonos de los
  chips eyebrow §9.17 por color computado, fuente del logo, fondo del header app (oklab) vs público (oklch), consola por ruta.

## 3. Tabla de hallazgos

| ID   | Superficie / archivo                                                                                                         | Descripción                                                                                                                                                                                                                                                                                                                      | Categoría                                | Severidad    | Evidencia                                     |
| ---- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------ | --------------------------------------------- |
| F-01 | `globals.css:686` `.mk-header`, `:828` `.mk-minibar`, `:1033` `.mk-journey`                                                  | Tinte **rosado/salmón** en light theme: `color-mix(in oklch, …)` sobre tokens neutros de chroma bajo colapsa el hue a `none`. **L074 re-introducido en S11.**                                                                                                                                                                    | Regresión visual / anti-pattern          | 🟠 Mayor     | Computado `oklch(… none …)` + screenshots     |
| F-02 | `globals.css:366,370,745,936,1059,1398,1597` + `OrderDetailHero:227` `DeliveryDetailHero:202` `CancellationReasonCallout:29` | `color-mix(in oklch, var(--text-primary) N%, transparent)` — desvía de la regla L074 (debería ser `oklab`) pero **NO drifta** (chroma 0.03 retiene hue).                                                                                                                                                                         | Anti-pattern código (sin impacto visual) | 🟡 Menor     | Computado: oklch y oklab dan hue 285          |
| F-03 | App sidebar logo vs header público                                                                                           | Wordmark de marca en **dos fuentes distintas según superficie**: app shell usa **Zilla Slab** (legacy `--font-logo`), S11 público usa **Inter** + marca "P".                                                                                                                                                                     | Incoherencia cross-superficie            | 🟡 Menor     | `fontFamily: "zilla"` en sidebar              |
| F-04 | `StoreDetailContent.tsx:355` vs `DeliverySummaryCard.tsx:114`                                                                | El slot "Resumen" del aside **no tiene identidad congelada**: store = "Tus pedidos aquí" `accent`+`Package`; delivery = "Resumen" `cool`+`ClipboardList`; order = no tiene.                                                                                                                                                      | Incoherencia cross-superficie            | 🟡 Menor     | Color computado de chips + screenshots        |
| F-05 | `src/app/[locale]/(app)/not-found.tsx` (único)                                                                               | El not-found canónico está **scopeado a `(app)`**. URLs no-emparejadas fuera del grupo (incl. **todo bad URL público/anónimo**) caen al **404 default de Next** (inglés, sin estilo, sin shell). `notFound()` in-segment sí funciona.                                                                                            | Incoherencia cross-superficie            | 🟡 Menor     | Screenshots: `/es/typo` vs `/es/stores/<bad>` |
| F-06 | `src/app/[locale]/layout.tsx:27` + `<title>` de landing                                                                      | Metadata `description: "Track your collection efficiently"` **hardcodeada en inglés** (producto es-default). `document.title` = **"PandaTrack \| PandaTrack"** (template + título duplican marca).                                                                                                                               | i18n / SEO                               | 🟡 Menor     | Agent i18n + `document.title` en runtime      |
| F-07 | `DateInput.tsx:157` `ToastContainer.tsx:18` `Sheet.tsx:169` `WizardStep.tsx:354`                                             | `aria-label` **hardcodeados y mezclando idiomas**: "Clear date" / "Notifications" / "Close" (EN) + "Acciones del paso" (ES). Deberían ir por next-intl. (Componentes pre-S11.)                                                                                                                                                   | a11y / i18n                              | 🟡 Menor     | Agent strings                                 |
| F-08 | `(landing)/_components/Footer.tsx:89,96` `Menu/LanguageToggle.tsx:41`                                                        | Landing: `title="TikTok"`/`"WhatsApp"` (tooltips no localizados) y `aria-label={ariaLabel ?? "Language"}` (fallback EN).                                                                                                                                                                                                         | i18n                                     | ⚪ Cosmético | Agent strings                                 |
| F-09 | `OgImageTemplate.tsx` (OG landing/terms/privacy) · `resend.ts` · `apple-icon.tsx`                                            | Superficies de imagen de marca **hardcodean su propia paleta** (`#0b0f14` navy, `#8b5cf6`, `#38bdf8`). El hex es **obligatorio** (no admiten CSS vars); valores **cercanos** a Velvet pero **no derivados de los tokens** → derivan si Velvet se re-tunea; el fondo navy + info sky difieren del lavanda/azul-apagado de Velvet. | Cosmético / verificar                    | ⚪ Cosmético | Hex en src + tokens Velvet                    |
| F-10 | `src/app/global-error.tsx`                                                                                                   | Fallback catastrófico **dark-only hardcodeado en hex** (`#0c0b12`…). Defendible (corre cuando el root layout/CSS-vars pueden no estar), pero un usuario en light ve una página oscura, y §10.4 dice "inline + tokens" mientras el código usa hex.                                                                                | Cosmético / esperado                     | ⚪ Cosmético | Hex en `global-error.tsx`                     |
| F-11 | Orders list — barra de % Pago                                                                                                | El **color del fill de la barra de % de pago varía** entre filas (100%→verde, 89%→violeta, 48%→¿verde?, atrasado→ámbar) sin regla obvia. Probablemente intencional (atrasado=ámbar, pagado=verde) pero verde-vs-violeta en parciales requiere confirmación.                                                                      | Incoherencia (baja confianza)            | ⚪ Cosmético | Screenshots (no se pudo confirmar por DOM)    |
| F-12 | Settings (Perfil) vs sidebar — avatar                                                                                        | El avatar de Settings muestra un **gradiente** mientras el sidebar muestra la **foto** del mismo usuario. Posible inconsistencia de fuente de avatar (o intencional: app-avatar editable vs foto OAuth). Verificar.                                                                                                              | Cosmético / verificar                    | ⚪ Cosmético | Screenshots (mismo usuario, 2 avatares)       |

## 4. Detalle de los hallazgos clave

### F-01 — L074 re-introducido en superficies públicas S11 (🟠 Mayor) — el hallazgo dominante

**Qué se ve.** En **light theme**, las barras superiores translúcidas de **todas** las superficies públicas nuevas
(landing, sign-in/auth, legal) y la **cinta del ciclo de vida del hero** se tiñen de **rosado/salmón/durazno** sobre el
canvas lavanda. No existe en dark (correcto) ni en la app autenticada (correcto).

**Mecanismo (confirmado numéricamente en runtime).** Es exactamente L074. Al hacer `color-mix(in oklch, …, transparent)`
—o incluso al mezclar dos tokens neutros entre sí— con tokens de **chroma muy bajo** (`--surface` light = `oklch(96.5% 0.014 285)`,
`--surface-elevated` = `oklch(95% 0.016 285)`), el hue del resultado **colapsa a `none`**, que el navegador compone hacia
hue 0 (rojo) → tinte salmón. Verificado:

```
.mk-header background (light)  →  oklch(0.964998 0.0139748 none / 0.8)   ← hue "none" = drift
mismo mix en oklab            →  oklab(0.964998 0.0036 -0.0135 / 0.8)    ← preserva lavanda, sin drift
.mk-journey background (light)→  oklch(0.955998 0.015175 none)           ← hue "none" (¡sin transparent!)
```

**Callsites (3 visibles):**

- `src/app/globals.css:686` — `.mk-header` (header de marketing/landing) — `color-mix(in oklch, var(--surface) 80%, transparent)`.
- `src/app/globals.css:828` — `.mk-minibar` (barra superior de auth + legal) — mismo patrón.
- `src/app/globals.css:1033` — `.mk-journey` (cinta del hero "ventana-producto") — `color-mix(in oklch, var(--surface-elevated) 60%, var(--surface))` (**sin `transparent`**: confirma que el bug no es solo "+transparent", sino mezclar **cualquier** token neutro de chroma bajo en oklch).

**Por qué importa / por qué es regresión.** L074 ya está documentado en el PLAYBOOK §2 y `lessons-learned.md` (2026-06-12).
El fix original fue **estrecho** (solo `OrderListFilters.tsx` + `OrderListLoadingSkeleton.tsx`). **S11 (2026-06-15) introdujo
CSS pública nueva que volvió a caer en el anti-pattern** — y en las superficies de **primera impresión** del go-live.
**Corroboración:** el header del app-shell (código más viejo) usa `oklab` y **no** drifta (`oklab(0.93 0.005 -0.019 / 0.85)`),
mientras las clases `.mk-*` nuevas usan `oklch` y sí. El sistema ya sabe hacerlo bien; S11 no lo siguió.

**Fix (trivial, idéntico al de L074):** cambiar `in oklch` → `in oklab` en esas 3 reglas (y, de paso, en F-02).

### F-04 — El slot "Resumen" del aside no tiene identidad cross-superficie

La pregunta guía ("¿'Resumen' tiene el mismo tono+ícono en order/store/delivery-detail?") tiene respuesta **no**:

| Superficie      | Label del slot                                  | Tono     | Ícono           | Archivo                       |
| --------------- | ----------------------------------------------- | -------- | --------------- | ----------------------------- |
| Store detail    | "Tus pedidos aquí"                              | `accent` | `Package`       | `StoreDetailContent.tsx:355`  |
| Delivery detail | "Resumen"                                       | `cool`   | `ClipboardList` | `DeliverySummaryCard.tsx:114` |
| Order detail    | (no hay slot Resumen; lo cubre la card "Pagos") | —        | —               | —                             |

Cada elección es **defendible** por la semántica de tonos §9.17 (accent = "tus cosas/identidad", cool = "datos/recap del
sistema"), pero el slot estructural "resumen del aside" **no se lee como el mismo componente** entre módulos. "Resumen"
**no está** en la tabla congelada §9.17 → es un label que derivó. **Decisión para Sergio:** congelarlo (un label/tono/ícono
único) o aceptar la divergencia como intencional. Resto del vocabulario §9.17 (Acciones, Tu nota privada, Productos,
Historial, Pagos state-aware, Categorías, Canales de contacto, Direcciones, "Tu pedido/entrega") **es correcto y consistente**
en todas las superficies verificadas.

### F-05 — El 404 canónico solo cubre el grupo `(app)`

`src/app/[locale]/(app)/not-found.tsx` es el único not-found; **no hay** `[locale]/not-found.tsx` ni `app/not-found.tsx` raíz.

- ✅ `notFound()` dentro de rutas `(app)` (ej. `/es/stores/<slug-inexistente>`) → **404 canónico Velvet** (shell + Compass neutral + "Esta página no existe" + "Volver al inicio"/"Ver mis pedidos"). Verificado.
- ❌ URL no-emparejada fuera de `(app)` — incluido **cualquier bad URL público/anónimo** (ej. `/es/loquesea`) → **404 default de Next** ("404 | This page could not be found", inglés, sin estilo, sin shell). Verificado.

Tras el go-live de superficies públicas, un usuario anónimo que tipea mal una URL ve una página off-brand en inglés.
**Fix:** agregar un `[locale]/not-found.tsx` (o raíz) usando `<EmptyState appearance="page">` (mismo patrón que el de `(app)`).

## 5. Falsos positivos / esperado (NO re-flaggear)

- **Dashboard placeholder** ("Tu panel está en construcción") — esperado; dashboard fuera de scope del rediseño.
- **Paridad i18n es/en** — **verificada limpia**: 16 namespaces, todos balanceados (incl. S11: `auth`/`landing`/`privacy`/`terms`), sin errores de parseo. 1 par vacío intencional (`orders.detail.deleteModal.descriptionPayments`).
- **Vocabulario §9.17** en order/store/delivery-detail + settings — **verificado correcto** (tonos+íconos calzan la tabla congelada; "Pagos" es state-aware → success cuando 100% pagado; delivery-detail **sí** adoptó el patrón, no quedó "future").
- **Componentes canónicos S10** (`<Skeleton>`/`<EmptyState>`/`<SectionError>`) — adoptados; el `notFound()` canónico funciona dentro de `(app)`.
- **Header del app-shell** — **no** tiene tinte rosado (usa `oklab`). El drift L074 es exclusivo de las clases `.mk-*` públicas nuevas.
- **Clases Tailwind theme-blind** (`text-white`/`bg-black`/`*-{color}-{n}`) — **limpio** en `src/` (0 violaciones; solo un comentario doc en `buttonVariants.ts` que **documenta** la regla).
- **`geist-latin.woff2`** en la red — es la fuente del **overlay de devtools de Next**, no la fuente de la app (la app usa Inter + JetBrains Mono).
- **StarRating coral / reseñas en warm** — intencional (§9.17 "Reseñas → warm").
- **Badge "N" abajo-derecha** — indicador de dev de Next, no es UI.
- **Hex crudo en `resend.ts`/OG/`apple-icon.tsx`** — **requerido** para render de imágenes/emails (no admiten CSS vars). El matiz de paleta está en F-09, no es un theme-blind a corregir con tokens.
- **Flash breve "Detalle" en breadcrumb de store-detail en hard-load** — resuelve correctamente al nombre ("Sergio"); L081 funciona. No es hallazgo firme.

**Observaciones de muy baja confianza (no contadas como hallazgos):** sort default deliveries "Más antiguas" vs orders
"Más recientes" (probablemente intencional); truncación del subtítulo de fecha en la lista de deliveries ("enviada 1 may 2…").

## 6. Recomendación: ¿antes de S12 o esperar a S13?

**S12 = Motion + microinteracciones.** Va a tocar transiciones/feedback sobre **estas mismas superficies** (header público,
cinta del hero, state-layers hover/press). Eso cambia la prioridad de algunos hallazgos.

### ✅ Arreglado ANTES de S12 (aplicado 2026-06-15)

> Pasada de fixes pre-S12 sobre el bucket prioritario. `oklch`→`oklab` no se hizo en bloque:
> solo se flipearon las mezclas sobre tokens **neutros**; las de acento/status (chroma alto) se
> dejaron en `oklch` a propósito (L074). Validado: type-check ✅, lint 0 ✅, 542 tests ✅, build ✅,
> y verificación visual en preview (header/cinta sin tinte salmón, 404 público on-brand, `document.title` = "PandaTrack").

- **F-01 ✅** — `oklch`→`oklab` en `.mk-header`, `.mk-minibar`, `.mk-journey` (`globals.css`). Computado confirmado
  `oklab(… -0.0135)` (lavanda) en vez de `oklch(… none)` (salmón).
- **F-02 ✅** — `oklch`→`oklab` en las 7 mezclas neutras de `globals.css` (state-hover/pressed + otras `--text-primary`)
  - 3 componentes (`OrderDetailHero`, `DeliveryDetailHero`, `CancellationReasonCallout`).
- **F-05 ✅** — `[locale]/not-found.tsx` nuevo (`<EmptyState appearance="page">`, namespace `common.notFound` es/en)
  **+ catch-all `[locale]/[...rest]/page.tsx`** que llama `notFound()`. El `not-found.tsx` solo no bastaba: en Next 16
  un segmento dinámico no captura URLs sueltas sin `notFound()` explícito → el catch-all las convierte. Verificado: `/es/<bad>`
  ahora muestra el 404 Velvet localizado dentro del locale layout.
- **F-06 ✅** — opción `absoluteTitle` en `buildPageMetadata` (mata el "PandaTrack | PandaTrack" del homepage) +
  description default del layout localizada vía `getTranslations("common")` (key `common.meta.description` es/en).

### Puede esperar a S13 (auditoría final) — decisiones de criterio / bajo riesgo

- **F-03 (fuente del logo Zilla vs Inter).** Decisión de lockup de marca — encaja en una unificación deliberada de S13/S14.
- **F-04 ("Resumen" sin identidad congelada).** Decisión de vocabulario — encaja en el pase de vocabulario de S13.
- **F-07 / F-08 (aria-labels y tooltips hardcodeados).** Pase de limpieza i18n/a11y.
- **F-09 / F-10 (paleta de imágenes de marca; global-error dark-only).** Verificar intención; cosmético.
- **F-11 / F-12 (color de barra de pago; avatar settings vs sidebar).** **Verificar primero** que sean intencionales antes de
  decidir si son hallazgos reales.

---

_Generado por una pasada read-only el 2026-06-15. No se modificó código de producción ni FRDs. Las decisiones de qué
corregir y cuándo quedan para Sergio._
