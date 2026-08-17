---
title: PandaTrack — Playbook de implementación de UI
last_updated: 2026-06-16
status: vivo · cargar antes de cualquier implementación de UI
owner: Sergio Minei
---

# PandaTrack — Playbook de implementación de UI

> ⚠️ **Lectura obligatoria** antes de implementar / refactorear cualquier UI en `src/`. Reforzado por la regla `.agents/rules/design-system-playbook.mdc` con `alwaysApply: true`.

Este playbook es la capa **operativa** del sistema de diseño: el flujo obligatorio, los anti-patrones y el checklist de auto-auditoría para construir UI en este repo. El **spec** (tokens, foundations, patterns, motion, states, voice) vive en los demás documentos de `docs/design/` — este playbook **apunta** a ellos como autoridad y no los duplica. Cada regla acá apareció porque algo salió mal una vez. Si la regla ya está acá, **no la re-debates** — implementá según el playbook.

> La fuente de verdad permanente del sistema es `docs/design/` + el código en `src/`. Este sistema lo produjo un subproyecto de rediseño que se conserva solo como contexto histórico (no es fuente de reglas ni de specs a seguir).

## 1. Componentes core — cuándo usar qué

### Button (`src/components/core/Button/Button.tsx`)

Variants disponibles + cuándo usar:

| Variant             | Cuándo                                                                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `primary`           | CTA principal de una pantalla / sección. Una sola variant primary por viewport. Background `--accent`.                                                                                           |
| `tonal`             | CTA secundaria aditiva con energía de acento: "Añadir producto", "Usar este total", "Hoy" (FX fetch), "Anotar pago". Background `--accent` al 12% + texto `--accent`. Demo equiv: `.btn.accent`. |
| `secondary`         | CTA secundaria neutral con peso visual. Background `--surface-elevated` + border-strong. Para acciones que no deben competir con el color del acento.                                            |
| `ghost`             | CTA terciaria: "Limpiar", "Atrás" en wizards, links como botón. **Tiene border visible** (`--border-strong`) — es el patrón Atelier, no la convención común.                                     |
| `destructive`       | Acción destructiva irreversible (Eliminar, Cancelar pedido). Background `--destructive`.                                                                                                         |
| `destructive-ghost` | Acción destructiva sutil (Reportar, Eliminar de listado). Border destructive sin fill.                                                                                                           |
| `outline`           | **Legacy.** No usar para nuevo código — usar `secondary` o `ghost` según el caso.                                                                                                                |
| `link`              | **Legacy.** Para inline hyperlinks usar `<a>` directo con `text-accent underline-offset-4 hover:underline`.                                                                                      |

**Jerarquía de 3 niveles en formularios / wizards:** `primary` (CTA final) → `tonal` (acciones aditivas en-sección) → `ghost` (navegación atrás, limpiar). Anti-patrón frecuente: usar `ghost` para botones aditivos como "Añadir fila", "Calcular total" o "Cargar tipo de cambio" — esos deben ser `tonal` porque llevan energía de acento sin competir con el CTA primario.

**Terminología coloquial → técnica** (specs y conversación de diseño usan estos nombres coloquiales; el código usa los técnicos):

| Coloquial    | Variant técnica | Demo class     | Visual                                                                                                                                          |
| ------------ | --------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| "primario"   | `primary`       | `.btn.primary` | Relleno sólido `--accent`, texto blanco                                                                                                         |
| "secundario" | `tonal`         | `.btn.accent`  | Tinted `--accent` 10% + texto `--accent` + borde `--accent` 28%                                                                                 |
| "terciario"  | `ghost`         | `.btn.ghost`   | Fondo transparente + borde visible `--border-strong`. A pesar del nombre, **sí tiene borde** — es lo que otras design systems llaman "outline". |

**CTAs en banners de estado** (`role="status"`, por ejemplo FxBanner WO-07): usar `tonal`, nunca `primary`. El `primary` se reserva para el CTA de mayor jerarquía de la pantalla; dentro de un banner el `tonal` da énfasis suficiente sin crear dos CTAs primarios en el mismo viewport. Ejemplo canónico: el botón "Actualizar tipos de cambio" en el FxBanner.

Sizes: `sm | md | lg`. Default `md`. Tap target ≥44×44 mobile en `md` y `lg`.

Hover: lift `-translate-y-px` + `shadow-elevation-2`. Aplicado en `primary`, `secondary`, `ghost`, `outline`. Con `motion-reduce` fallback.

### Input (`src/components/core/Input.tsx`)

Tipos: `text | number | email | password | search | url | tel | date | time`.

Variants funcionales:

- **Standard input:** label + helper + error inline post-blur (no on-change).
- **Search variant:** consume `loading` prop → `<Loader2>` spinner reemplaza el trailing icon. Para search con submit visible, agregar botón submit interno con `<Search>` icon.

API: `leadingIcon`, `trailingIcon`, `prefix`, `suffix`, `loading`, `error` (boolean | string), `helperText`, `maxLength` (con counter automático).

### Select / Combobox (`src/components/core/Select.tsx`, `Combobox.tsx`)

**Regla cross-app:** todos los selects tienen buscador integrado por default. Nunca usar `<select>` HTML nativo en código nuevo.

- `Select` para listas cortas con buscador opt-in.
- `Combobox` para listas largas con buscador siempre visible + soporte de "Crear nuevo X" inline.
- `MultiTagAutocomplete` (`src/components/core/MultiTagAutocomplete.tsx`) para multi-select con tags inline (los tags se meten ADENTRO del input, no abajo). Tiene leading icon `<Search>`. Útil para país, categorías que quieren patrón "tag picker".

### Chip / StatusChip (`src/components/core/Chip.tsx`, `StatusChip.tsx`)

- `Chip` genérico con variants `success | warning | destructive | info | accent | neutral`. Soporta `icon` Lucide leading. Tamaño `sm | md`.
- `StatusChip` discriminated union por enum (OrderStatus, DeliveryStatus, etc.). **`kind: "info"` exige `icon` + `label`** por TypeScript (ADR 0006).
- Categorías de producto siempre con ícono Lucide en `--accent-cool` (teal). Mapping client-side en cada módulo (no DB).
- Status enum chips: respetar mapping del ADR 0002.

### Modal (`src/components/modules/Modal/Modal.tsx`) — CANÓNICO ÚNICO + ADAPTIVE

**Regla absoluta:** hay UN solo componente modal en la app. **Prohibido** crear dialog/overlay con `<Portal>` + `<div>` ad-hoc. **Prohibido** copiar el patrón visual de modals viejos del demo HTML.

**Adaptive Modal Pattern** (ADR 0008 Extensión 2026-05-11): el componente Modal se renderiza diferente según viewport:

- **Desktop ≥768px** → centered dialog con Semantic Depth (Version B de ADR 0008).
- **Mobile <768px** → **bottom sheet** con drag handle, sticky CTA footer, `safe-area-inset-bottom`, mismo Semantic Depth (icon-circle tonal heredado).

**Arquitectura interna (4 archivos en `src/components/modules/Modal/`):**

1. `Modal.tsx` — **público, smart wrapper** (~30 líneas). Usa `useIsMobile()` y delega. Es lo único que importan los callsites.
2. `ModalDialog.tsx` — **internal, desktop centered** (~350 líneas). El Modal hand-rolled actual renombrado, sin cambios funcionales. Sin deps externas.
3. `ModalSheet.tsx` — **internal, mobile bottom sheet** (~150 líneas). Usa [Vaul](https://vaul.emilkowal.ski/) para drag-to-dismiss + snap points + safe-area.
4. `ModalContent.tsx` — **internal shared** (~150 líneas). Header (icon-circle + title + close) + Footer (actions). Reusado por Dialog y Sheet — DRY garantizado.

**Dependencias** (ver ADR 0010 — UI Primitive Libraries Approval Policy):

- **`vaul`** única lib UI top-level aprobada. Radix Dialog viene como **transitive** dentro de Vaul — NO se importa directamente.
- **NO** `@radix-ui/*` como dep directa en `package.json`.
- `lucide-react` (ya existente).

**Excepción full-screen sheet**: cuando contenido es muy largo (>4 secciones / scroll significativo) → full-screen sheet (ver el prototipo de FRD-05, pantalla de reconciliación FX en mobile).

API obligatoria de `<Modal>`: `tone` (`default | destructive | warning | info | success` — `success` agregado en S9 Fase B para "Marcar como llegada", M06), `size` (`md | lg`), `primaryAction` (`variant: primary | destructive | success | warning` — success/warning pintan el CTA con el token semántico), `secondaryAction`, opcional `tertiaryAction`, `icon` (Lucide en icon-circle tonal de 48px). Para mobile: `ModalSheet` inyecta drag handle + sticky footer automáticamente.

ARIA: usar `role="alertdialog"` para destructivas (Eliminar, Cancelar pedido), `role="dialog"` para forms/pickers.

Reforzado por la regla `.agents/rules/modal-canonical-pattern.mdc`. Detalle en `docs/design/components.md` y ADR 0008.

### Sheet / Drawer (`src/components/modules/Sheet`) — variante mobile del Modal

Counterpart mobile del Modal — implementado como `ModalSheet.tsx` interno (NO se exporta). Mismo Semantic Depth language heredado de ModalContent. Es **invocado automáticamente** por `<Modal>` cuando `useIsMobile()` retorna true — **nunca se usa directamente** en callsites.

Spec visual del bottom sheet (resumen):

- `position: fixed; bottom: 0;` con `border-radius: 20px 20px 0 0` (solo top corners).
- Drag handle 36×4 px en `--border-strong`, margin `8px auto 4px`.
- Header igual al Modal (icon-circle tonal 48px cuando aplica) o simplificado para action menus/pickers.
- Body `padding: 16px 18px 10px; overflow-y: auto`.
- Sticky footer con `safe-area-inset-bottom`, `border-top: 1px solid var(--border)`, `min-height: 44px` por botón (HIG tap target).
- Animación entrada: `transform: translateY(100% → 0) + opacity`, 280ms, easing spring.

**Action sheet variant** (mobile-only para "⋯ Más acciones"): header con título corto + close X, body con lista `.s7-mob-action-list` de filas (icon + label), filas destructivas en `--destructive`. Ver demo anchor `#s7-order-detail-actions-mobile`.

**Picker variant** (Tipo de producto, Tienda, Moneda): header con título + search input opcional, body con lista `.s7-mob-picker-list` (icon + label + check selectivo). Ver demo anchor `#s7-product-type-picker-mobile`.

### FilterDrawer (`src/components/modules/FilterDrawer/FilterDrawer.tsx`)

Section types soportados: `pills | pills-search | icon-pills | autocomplete | tag-autocomplete | date-range | switches | text` (`text` agregado en S9 para el filtro libre "Producto"; value shape `string`).

- `tag-autocomplete` para listas largas tipo país (input + dropdown + tags inline + leading icon search + flag emoji).
- `pills` para listas cortas tipo presencia (chip-buttons con íconos).
- `switches` para toggles boolean simples.

**Responsive canónico (ADR 0003 D8):**

- **Desktop (≥768px)**: side drawer derecho 440px, anclado al borde derecho, `border-left: 1px solid var(--border-strong)`, top-corners rectos, animación `drawer-slide-right` 280ms (`translateX(100%) → 0`).
- **Mobile (<768px)**: bottom-sheet, anclado al borde inferior, `border-top: 1px solid var(--border-strong)`, top-corners `--radius-2xl` (20px), drag handle 4×36px en `var(--border-strong)`, `max-height: 92svh`, `box-shadow` hacia arriba `0 -8px 32px ...`, `padding-bottom: env(safe-area-inset-bottom)`, animación `drawer-rise` 280ms (`translateY(100%) → 0`).

Mismo backdrop blur 8px + tint oklch en ambos breakpoints (heredado del lenguaje Semantic Depth de ADR 0008, pero hand-rolled independiente, sin Vaul y sin compartir código con `<Modal>`).

**NO es un `<Modal>`.** Aunque visualmente comparte algunos elementos con el `<Modal>` canónico (backdrop blur, top-corners en mobile, drag handle en mobile), **arquitectónicamente son patrones distintos**: el `<Modal>` canónico es para decisiones discretas (confirm, alert, form corto, decision overlay) y usa Vaul en mobile; el `<FilterDrawer>` es para refinement de lista y es hand-rolled responsive. Coherencia visual viene del design system, no del componente. No mezclar el código de un patrón con el otro y no usar `<Modal>` como contenedor de filtros.

**Comportamiento:** NO cierra on click outside. Solo X y Esc.

**Visual del header:** ícono Lucide en `--accent` (no `--accent-cool`). Border-radius 0 desktop / top corners mobile. Border `--border-strong` panel side / `--border` header+footer.

**Demo anchors de referencia:**

- Desktop: `#s6-stores-list-filters-open`, `#s7-orders-list-filters-open`.
- Mobile: `#s7-orders-list-filters-mobile` (Stores mobile reusa el mismo componente — la apariencia mobile no tiene un anchor dedicado en stores).

### BackNavLink (`src/components/core/BackNavLink.tsx`)

Componente canónico cross-app para navegación "Volver" / "Atrás". Vive típicamente arriba del `page-heading` del contenido principal, antes del título de la pantalla.

**Tres `appearance` con uso explícito (un solo callsite, un solo patrón):**

| Appearance | Cuándo usar                                                                                                                                                                           | Visual                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `text`     | **Default canónico.** Back-link sobre el page-heading en pantallas de detalle, edit, create de un módulo.                                                                             | Text link sutil: `--text-muted`, font-size 13px, `arrow-left` 12px, sin background/border/shadow, hover → `--foreground`. |
| `pill`     | **Sin consumidores.** La variante existe en `BackNavLink` pero `appearance="pill"` no se usa en ningún sitio de `src/`. Estaba reservada para un back-link flotando sobre contenido denso (hero, hero image, sticky header con overlay); el `OrderSummaryHeader.tsx` que la justificaba nunca se construyó. | Pill flotante `rounded-full` con `bg-background/70 backdrop-blur-sm shadow-sm`. NO usar para back-link estándar.          |
| `button`   | Footer de wizard junto al submit primario, cuando la geometría debe igualar al CTA hermano (`Button outline md`). Hoy `DeliveryCreateForm` footer.                                    | Outline button md, mismas geometría/tokens que `<Button variant="outline" size="md">`.                                    |

**Receta del default `text` (canónica — copia del demo Orders `.back-link`):**

```tsx
<BackNavLink href={backHref}>{backLabel}</BackNavLink>
// renderiza:
// className="text-text-muted hover:text-foreground inline-flex items-center
//            gap-1.5 px-0 py-0.5 text-[13px] no-underline transition-colors"
// + <ArrowLeft className="size-3 shrink-0" />
```

**Reglas vinculantes:**

- **El default es `text`.** No pasar `appearance="pill"` por costumbre — pasarlo solo cuando el back-link tiene que flotar sobre un hero o contenido denso.
- **Prohibido** envolver el componente con `Button`, `IconButton`, o crear back-links ad-hoc con `<a>` + clases. Usar `<BackNavLink>`.
- **Icono fijo:** `ArrowLeft` de Lucide, tamaño 12px (`size-3`) en variant `text`. Variant `pill`/`button` usan 16px (`size-4`) por geometría del botón.
- **Copy:** label corto que indica el destino, no la acción. ✅ "Pedidos", "Volver a Solaris Books", "Tiendas". ❌ "Volver atrás", "Cancelar".
- **A11y:** `<Link>` semántico de Next; sin `aria-label` extra (el texto del label es el accessible name).
- **Posición canónica:** primer elemento dentro de `<main>`, antes del `page-heading`. `margin-bottom: 8px` (`mb-2` aproximado) implícito por el spacing del page-heading. No anidar dentro de `app-topbar` (eso es scope del breadcrumb del shell, no del back-link).

**Anti-patrones:**

- ❌ `<BackNavLink appearance="pill">` cuando no hay hero/overlay — usar `text`.
- ❌ Back-link como botón con `<Button>` o `<IconButton>` — usar `<BackNavLink>`.
- ❌ Duplicar el breadcrumb del shell con un back-link redundante (los dos siempre existen — el breadcrumb es navegación, el back-link es atajo a la pantalla padre).
- ❌ Variants nuevas del componente sin abrir mini-sesión / ADR. Si necesitás un patrón nuevo, extendé en lugar de forkear.

**Referencia visual:** el patrón `back-link` (detalle/crear/editar de pedido) vive en el prototipo de FRD-05 y en `docs/design/interface-patterns.md`.

## 2. Tokens — convenciones cross-app

### Colores

- **Velvet** es la paleta única en `src/`. Las otras paletas (Lilac, Plum, Lagoon, Forest) viven solo en demo HTML para referencia futura.
- `--text-on-accent` light = blanco; dark = oscuro. Decisión S3-B para AA. Si te molesta visualmente, no cambies sin abrir un ADR.
- Status enums usan tokens semánticos: `--success`, `--warning`, `--destructive`, `--info`. Nunca hex literales.
- **Alpha sobre tokens neutros (`--background`, `--surface*`, `--border`, `--text-*`): usar `color-mix(in oklab, …, transparent)`, NO `in oklch`** — en oklch el hue deriva hacia rojo al mezclar con `transparent` y los tokens de chroma bajo se ven rosados (L074). `in oklch` queda reservado para tintar tokens de acento de chroma alto (chips, top-accents).
  - **Convención blanket, enforced por guardia (S13).** No _toda_ mezcla neutra en oklch drifta: si ambos endpoints comparten el hue Velvet (285) el hue se preserva (idéntico a oklab). Pero la regla es **blanket** — no es evidente en tiempo de autoría cuál instancia va a derivar — y la guardia `src/test/design-token-guard.test.ts` falla la suite ante cualquier `color-mix(in oklch, var(--<neutral>))`. La misma guardia bloquea clases Tailwind theme-blind (`text-white`/`bg-{color}-{n}`/etc.) en `.tsx`. Cero-dep (sin ESLint plugin ni stylelint), por ADR 0010.

### Borders

- `--border` — divisores internos (header bottom, footer top de paneles, separadores sutiles).
- `--border-strong` — borders perimetrales de superficies destacadas (panel del FilterDrawer side, ghost button, chip normal, input border focused).

**Confusión común:** estos dos se intercambian fácil. Mirar el demo HTML antes de decidir cuál.

### Spacing

`--space-1` a `--space-12` en escala consistente. **Cero literales hardcoded** (`16px`, `1rem`). Usar tokens.

### Radius

`--radius-md` (8px) — inputs, buttons, chips chicos.
`--radius-lg` (12px) — cards medianas.
`--radius-xl` (16px) — section cards grandes.
`--radius-2xl` (20px) — Modal, FilterDrawer mobile top corners.
`--radius-pill` (999px) — pills, status chips.

### Layout magic numbers

Sidebar widths, header height, drawer widths — todos como tokens (`--sidebar-w-expanded`, `--header-h`, `--drawer-w`, etc.). **Cero literales** `240px`, `64px`, `440px`.

### Fechas de dominio (display UTC) — L076

Las fechas de dominio (calendar-day: `orderDate`, `deliveryDate`, `expectedArrival*`/`expectedDelivery*`, `receivedDate`, `paymentDate`) se persisten a **medianoche UTC**. Reglas:

- **Display:** SIEMPRE con `src/lib/domainDate.ts` (`formatDomainDate`/`formatDomainShortDate`, que fuerzan `timeZone:"UTC"`). Nunca `toLocaleDateString`/getters locales directos sobre una fecha de dominio — en TZ negativas (América) muestran el día anterior.
- **Ventanas de rango:** comparar meses/días con getters `getUTC*`, no locales.
- **Edit forms (prefill al date picker):** convertir el `Date` de servidor con `utcDomainDateToLocal` (UTC-midnight → local-midnight, mismo día) porque `react-day-picker` trabaja en local; re-serializar con getters locales (`toIsoDate`), nunca `toISOString` sobre una fecha local (corrompe en TZ positiva).
- **NO aplicar UTC a:** timestamps reales (`createdAt`/`updatedAt` → hora local), summaries de create-form (picker-origin local, ya correctas), boundaries de query server-side (UTC intencional), `src/lib/localDate.ts` (filtros/forms en hora local).

### Fechas de dominio (write) — L077

La otra mitad de L076, y la que se rompió tres veces: **un `Date` que cruza el boundary de una Server Action llega como el instante exacto que lleva**. El valor del picker es medianoche LOCAL, así que enviarlo tal cual guarda el día del coleccionista a las `05:00Z` desde Lima, fuera de la medianoche UTC en la que se apoya todo lo demás. No lo detecta ningún tipo: `Date` a `Date` compila.

- **Cliente, obligatorio:** convertir con `toDomainDate(...)` (o mandar el texto `yyyy-mm-dd` de `toLocalIsoDateString`) ANTES de llamar a la Server Action. La normalización va en el cliente porque solo él sabe qué día civil eligió el usuario; desde el instante solo, el servidor no puede reconstruirlo.
- **Servidor, obligatorio:** declarar el campo con `domainDateSchema` (`src/lib/domainDateSchema.ts`), nunca con un `z.coerce.date()` pelado. Coacciona el texto de los `FormData` igual que antes y **rechaza** un `Date` que no venga en medianoche UTC, en vez de persistir el desfase en silencio. Lo vigila `src/test/domain-date-guard.test.ts`.
- **Por qué las rutas de formulario nunca fallaron:** mandan `yyyy-mm-dd` por `FormData`, y la coacción lee una fecha sin hora como medianoche UTC. Solo las rutas que pasan un `Date` (payment sheet, inline payment, quick arrival, mark-delivered) están expuestas.
- **Tests:** un `new Date()` no es una fecha de dominio. Usar `src/test/domainDateFixtures.ts` (`utcMidnightToday`, `addUtcDays`).

## 3. Patrones canónicos por escenario

### Confirm modal destructive (Eliminar X)

```tsx
<Modal
  isOpen={isOpen}
  onClose={handleClose}
  title="Eliminar tienda"
  subtitle="Esta acción no se puede deshacer."
  icon={<Trash2 />}
  tone="destructive"
  primaryAction={{ label: "Eliminar tienda", onClick: handleDelete, variant: "destructive" }}
  secondaryAction={{ label: "Cancelar", onClick: handleClose }}
>
  Akiba Records y toda su información serán eliminados permanentemente.
</Modal>
```

### Confirm modal sensible (Reportar X, Marcar como Y)

`tone: "warning"` + icon Lucide acorde + primary `variant: "primary"` (no destructive).

### Decisión con 3 CTAs sin destructive

`tone: "info"` + 3 actions (`primaryAction`, `secondaryAction`, `tertiaryAction`).

### Form embebido en modal

`tone: "default"` + `size: "lg"` + form con validación post-blur en el body.

### Toast con undo (operación reversible)

Implementado en S9 Fase B vía `useToast()`: `addToast(msg, { variant: "neutral", duration: 5000, action: { label, onClick } })`. El consumidor es dueño del atajo `Z` (listener global con latest-ref mientras la ventana de undo está abierta) y de la mutación inversa que restaura el estado previo. Lifetime 5s default, 8s para delete entero. ADR 0001 D4. Referencia: `DeliveryDetailClient.handleReopen` / `handleUndoReopen`.

### Section card disabled-gated

Card visible al 100% (eyebrow + title intactos), contenido reemplazado por icon `lock` + copy guía en `--text-muted`. **Sin opacity** (ADR 0001 D3).

### Field-as-attribute (campo prefilled por contexto)

Wrapper `surface-elevated` + badge mono `↳ DESDE PT-XXXXXX` + valor + link ghost "Cambiar". ADR 0001 D2.

### Wizard step CTA — "Continuar" SIEMPRE habilitado + validación inline al click

> **Regla vinculante cross-app.** En todo wizard de creación (`WizardAccordion mode="wizard"`), el botón "Continuar" / "Crear" de cada paso **nunca se renderiza `disabled`**. Está siempre clickeable.

**Por qué:** un botón deshabilitado deja al usuario sin feedback — "¿por qué no puedo continuar? ¿qué me falta?". Un botón habilitado + validación inline al click le dice exactamente qué corregir.

**Mecánica (ya soportada por `<WizardStep>`):**

1. `primaryAction={{ label }}` — **sin `disabled`**. (`disabled` se reserva solo para el estado `loading` del submit final del último paso.)
2. `validate={validateStepN}` — el validador corre en el click del primary. Debe:
   - **Setear estado de error a nivel campo** (un `useState` por campo: `storeError`, `currencyError`, etc.).
   - **Retornar el booleano** de validez.
3. `<WizardStep>` llama `ctx.reportValidation(n, isValid)`: si `false`, el paso pasa a estado `errored` → bullet del numeral se tiñe `--destructive`, borde de la card `--destructive`, el `<Stepper>` superior marca ese paso en rojo.
4. Cada campo recibe `error={Boolean(fieldError)}` (se pinta rojo) y renderiza debajo un mensaje inline: `<p class="flex items-center gap-1.5 text-[12px] [color:var(--destructive)]"><AlertCircle size={13}/> {fieldError}</p>`.
5. Los errores se **limpian on-change** de su campo (`onChange` → `setFieldError(null)`).

**Patrón de error idéntico al de `StoreForm`** (módulo Stores S6): mismo `<AlertCircle size={13}>` + texto 12px `--destructive`, mismo viraje de bullet/card/stepper. No inventar un patrón de error nuevo por módulo — copiar este.

Referencia de implementación: `OrderCreateForm.tsx` (`validateStep1` setea `storeError`/`currencyError`/`orderDateError`), `WizardStep.tsx` (`handlePrimary` → `reportValidation`).

### Wizard mobile — checklist canónico cross-app

> **Regla vinculante.** Cualquier wizard de creación (`<WizardAccordion mode="wizard">`) en mobile (`<md`) DEBE seguir este checklist completo. No aplica a `mode="all-open"` (edición) que mantiene el layout desktop.

Referencias de implementación: `OrderCreateForm.tsx` (S7-B Parte 2) y `StoreForm.tsx` (S6 + alineación 2026-05-16). Si vas a crear un wizard nuevo, copialos exacto.

1. **`useIsMobile()`** al root del componente para bifurcar los renders mobile vs desktop. SSR-safe (inicia false, hidrata post-mount).
2. **Stepper compact en mobile**: `<Stepper variant={isMobile ? "compact" : "default"} compactEyebrow={t("stepperCompactEyebrow", { current, total })} />`. La key i18n debe existir en el namespace del módulo (ej. `orders.create.stepperCompactEyebrow`, `stores.redesign.create.stepperCompactEyebrow`).
3. **`actionsLayout="sticky-on-mobile"` en cada `<WizardStep>`**. Render condicional: si tu wizard tiene un branch `edit` con `mode="all-open"`, pasale `actionsLayout="inline"` en ese branch (el sticky bar no aplica al all-open layout). Patrón:
   ```tsx
   actionsLayout={isEditMode ? "inline" : "sticky-on-mobile"}
   ```
4. **Continuar SIEMPRE habilitado** (ver §3 "Wizard step CTA"). NO usar `disabled={N > maxAllowedStep}` ni similares en los `primaryAction` — eso bloquea el `WizardContext.canActivate(n)` que dispara el pulse hint cuando el usuario tapea un paso futuro. El `<WizardStep>` ya maneja: si el header del paso N es clickado y `!ctx.canActivate(n)`, llama `ctx.pulseStickyHint()` automáticamente.
5. **AsideSummary oculto en mobile**: `<AsideSummary className="hidden lg:block">` o conditional `!isMobile && <AsideSummary>`. El resumen vive solo en desktop; en mobile el sticky bar + summary del paso 3 cumplen la misma función.
6. **Bottom padding para evitar overlap con el sticky bar**: el contenedor raíz del wizard debe reservar espacio en mobile:
   ```tsx
   className = "pb-[calc(76px+env(safe-area-inset-bottom))] md:pb-0";
   ```
   `76px` ≈ altura del sticky bar (`py-3` + Button `md` height) + safe-area inset.
7. **h1 oculto en mobile** (opcional pero recomendado): el topbar canónico ya muestra el título de la pantalla. Usar `<h1 className="hidden md:block ...">` para evitar duplicación visual cross-viewport.
8. **Ancho asimétrico de los CTAs del sticky bar** (heredado automáticamente del `<WizardStep>`): `Atrás` tiene `flex: 0 0 96px` (chico, ancho fijo), `Continuar` tiene `flex: 1` (crece). Match del demo S7-A.6. NO sobreescribir.

**Cómo verificar** (preview tools):

- Cargar la URL del wizard en mobile (375×812).
- Confirmar: stepper compact arriba (PASO X DE N + barra), wizard cards sin indent izquierdo, sticky bar abajo con `Atrás 96px / Continuar flex-1`, NO AsideSummary visible, h1 desktop oculto.
- Tap en un paso futuro colapsado (locked) → el Continuar abajo debe hacer pulse.
- Tap en cualquier input/fila dentro del step body → mismo pulse (UX hint para descubrir el sticky bar).

**Anti-patrones**:

- ❌ Pasar `actionsLayout="sticky-on-mobile"` al wizard de **edit** (`mode="all-open"`). El all-open no renderiza CTAs per-step — el sticky bar no tiene de dónde tomar handlers.
- ❌ Mantener `disabled={N > maxAllowedStep}` en `primaryAction` "para que el botón se vea desactivado en pasos locked". Eso NO es lo que el usuario ve: el botón del header del paso locked no es el primaryAction del propio step, es el header click; bloquear `primaryAction.disabled` solo desactiva el botón visible del paso ACTIVO (no del locked) y rompe el patrón canónico de "Continuar siempre habilitado".
- ❌ Renderizar `<AsideSummary>` en mobile sin `hidden lg:block`. Genera scroll vertical extra sin valor.
- ❌ Olvidar el `pb-[calc(76px+...)]` del container → el sticky bar tapa el último input del último paso.

### Atajo de submit — CTA limpio + hint de texto (cross-app)

> **Regla vinculante.** El CTA primario de submit de cualquier form (create/edit) se mantiene **limpio** (label + ícono `Check`, sin chip). El atajo de teclado se comunica como **texto plano** junto al CTA, nunca como kbd-chip embebido dentro del botón.

- **Hint:** `<p>`/`<span>` con `text-[12px] [color:var(--text-muted)]` y copy `"o presiona ⌘ Enter"` (key i18n reutilizada por create y edit; es + en en el mismo cambio). En create-wizard vive al pie del body del paso final; en edit vive en el footer junto al CTA. Desktop-only cuando el footer es `hidden md:flex` (el atajo es de teclado).
- **Cableado:** handler `onKeyDown` en el `<form>`:
  ```tsx
  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "Enter") {
      if (isPending /* + guardas del botón */) return;
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };
  ```
- **Guardas obligatorias:** (1) **excluir `shiftKey`** para no colisionar con atajos de grid tipo `Ctrl+Shift+Enter` (insertar fila); (2) **espejar el `disabled` del botón** (ej. edit: `!isDirty || totalBelowPaid || isPending`) para que el atajo no envíe un form sin cambios o inválido; (3) en create-wizard dispara el submit final desde cualquier paso (la validación de pasos lo gatea).
- **El chip kbd embebido** (`Button` prop `kbd`) **se reserva** para atajos de acción contextual de un grid/lista (ej. `ShortcutHint` del item grid de Orders: `Ctrl⇧↵` insertar fila), NO para el submit principal.
- **Referencia:** `DeliveryCreateWizard`/`DeliveryEditForm` (S9-D5) y `OrderCreateForm`/`OrderEditForm` (P-S9-02). Origen: L075. **Testing:** `⌘Enter` no se verifica con `KeyboardEvent` sintético (no dispara el delegado de React) — usar tecla real.

### Filter chips display (después de aplicar filtros)

Row de chips con `<X>` para remover individual. Visible arriba del listado. Patrón cross-módulo.

### Filter trigger button con applied count (M05)

Usar `<FilterTriggerButton>` (`src/components/core/FilterTriggerButton/FilterTriggerButton.tsx`) en cualquier listado con `FilterDrawer`. Reglas vinculantes:

1. **count = chips visibles** arriba del listado (1 chip = 1 unidad, no granular).
2. **Solo filtros del drawer cuentan.** La búsqueda (search input) no incrementa el badge ni activa el estado pintado.
3. **Mobile icon-only:** usar `variant="icon-only"` con `aria-label` cuando el botón vive en el topbar del shell.

```tsx
// Label variant (toolbar desktop + mobile in-toolbar)
<FilterTriggerButton
  appliedCount={drawerAppliedCount}  // excludes search query
  onClick={() => setDrawerOpen(true)}
  label={t("toolbar.filter")}
/>

// Icon-only variant (topbar mobile)
<FilterTriggerButton
  variant="icon-only"
  appliedCount={drawerAppliedCount}
  onClick={() => setDrawerOpen(true)}
  aria-label={t("toolbar.filterIconLabel")}
/>
```

El `drawerAppliedCount` se deriva sumando las longitudes de los arrays de filtros del drawer (product types, countries, presence, flags, etc.) — nunca incluir el query string.

Spec completo: `docs/design/components.md`. Demo visual: `#s7-orders-list-filters-open` (count=1) y `#s7-orders-list-empty-filtered` (count=3).

## 4. Anti-patterns explícitos (NO hacer)

- ❌ `<select>` HTML nativo. Usar `<Select>` o `<Combobox>`.
- ❌ Crear modal/dialog con Portal + div ad-hoc. Usar `<Modal>`.
- ❌ Copiar visual de modals viejos del demo HTML inline (`#s6-store-create-duplicate-detected`, etc. son flujos full-screen, no modals reales; `.report-modal*` ya está mapeado al canon).
- ❌ Hardcodear `text-white` en código. Usar `--text-on-accent` (resuelve light/dark automático).
- ❌ Hardcodear `border-radius: 8px` o cualquier literal de spacing/color/radius. Usar tokens.
- ❌ Inventar `tone` o `variant` nuevos sin abrir ADR. Si necesitás algo que no existe, extender el componente in-place y documentar.
- ❌ Devolver "cierre" sin verificar el código modificado. Después de cada Edit, leer el archivo y pegar el snippet en el reporte.
- ❌ Mezclar visualmente paletas (Velvet en `src/` solamente; las alternativas viven solo en demo y docs).
- ❌ Usar `<select>` nativo aunque sea para 3 opciones — usar Select con buscador integrado.
- ❌ Cerrar drawer/modal al hacer click outside cuando ocupa una superficie grande (FilterDrawer no cierra outside). Solo X y Esc.
- ❌ Confundir `<FilterDrawer>` con `<Modal>` y usar uno donde corresponde el otro. Son patrones distintos con código independiente. Filtros de listado → `<FilterDrawer>` (side drawer desktop / bottom-sheet mobile, hand-rolled, sin Vaul). Decisiones discretas (confirm, alert, form corto) → `<Modal>` (centered desktop / bottom-sheet mobile via Vaul). El parecido visual del mobile bottom-sheet es coherencia del design system, no acoplamiento arquitectónico.
- ❌ Alcanzar los 44×44 con un `::before` cuando el vecino más cercano es **otro control** (un chevron a 4px, un chip de la fila de arriba, el mismo botón una fila más abajo). Dos expansiones más juntas que `2N` se solapan y la posterior en el DOM se queda con toda la banda, sin que nada se vea en pantalla. Ahí se **redimensiona la caja** (`size-11` de base, caja compacta detrás de la variante `md:`/`lg:`), porque dos cajas en flujo normal no pueden solaparse. Ver `docs/design/interface-patterns.md` §12; el guard es `src/test/tap-target-guard.test.ts`.
- ❌ Comprimir de vuelta el grupo final de un campo (clear + chevron) "porque ocupa mucho en táctil". Debajo de `md` muestra **un** control: el clear si hay valor, el icono de estado si no. El chevron es decoración; el cuerpo del campo ya abre la lista.
- ❌ `<input type="checkbox">` para opciones boolean en UI. **Por defecto usar `<Switch>`** (`src/components/core/Switch.tsx`). El Checkbox se reserva para: selección múltiple de ítems con estado indeterminate, aceptación de términos/condiciones, bulk-select en tablas. Si dudás, elegí toggle.

## 5. Workflow obligatorio antes de implementar UI

1. **Leer este playbook completo** (sí, todo).
2. **Consultar el inventario de componentes en `docs/design/components.md` (y `ls src/components/core/` + `src/components/modules/`)** — **inventario obligatorio antes de crear nada**. `components.md` es el catálogo autoritativo: qué existe, cuándo usar cada uno y su ruta canónica. Cualquier patrón visual replicado en el módulo nuevo casi seguro existe ya en el módulo cerrado anterior (Stores → Orders → Deliveries). El catálogo se mantiene sincronizado con el árbol real por la guardia `src/test/component-inventory-guard.test.ts` (falla la suite si un componente de `core/`/`modules/` no está catalogado, o si el catálogo referencia uno inexistente) — por eso crear un componente obliga a pasar por el inventario. **Ver §5.1 — Regla de reuse obligatorio.**
3. **Leer el prototipo del FRD afectado** en `docs/product/<prd>/<frd>/prototype/<slug>.html` (la verdad visual permanente de cada pantalla).
4. **Leer la spec del componente** en `docs/design/components.md<Name>.md`.
5. **Leer ADRs aplicables** en `docs/design/decisions/`.
6. **Verificar tokens correctos** consultando `docs/design/visual-foundations.md`.
7. Solo entonces implementar.

Si saltás cualquiera de estos pasos, vas a generar trabajo que después hay que rehacer. **Empíricamente verificado durante S6** (módulo Stores requirió 4-5 rounds de fixes por saltarse pasos) y **S7-B Parte 2** (panel Resumen, CTAs Continuar/Atrás, contenedores collapsibles de wizard se recrearon desde cero teniendo el patrón canónico ya implementado en `StoreForm` — Sergio rebote ~6 fixes en 2 turnos por esa omisión).

### 5.1 Regla de reuse obligatorio (cross-module)

> **Antes de crear cualquier componente o pattern para un módulo nuevo, asumí que ya existe en el módulo anterior y buscalo.** Si replicaste algo en lugar de reusar y se ve "casi igual pero no": estás generando deuda. Movelo a un componente compartido.

**Lista vinculante de patrones cross-module reutilizables** (origen: Stores S6, consumidores: Orders S7, Deliveries S8…):

| Patrón                               | Componente canónico                                                                             | Ubicación                                                                                                                                               |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aside Resumen del form-grid          | `<AsideSummary>` + `<AsideSummaryRow>`                                                          | `src/components/modules/AsideSummary/`                                                                                                                  |
| Wizard con stepper + cards           | `<WizardAccordion>` + `<WizardStep>` + `<Stepper>`                                              | `src/components/modules/WizardAccordion/`, `core/Stepper.tsx`                                                                                           |
| Stepper full-width arriba del grid   | `<Stepper>` montado fuera de `<WizardAccordion showStepper={false}>`                            | `core/Stepper.tsx` — patrón documentado en S7-B Parte 2                                                                                                 |
| CTAs Continuar / Atrás de wizard     | `primaryAction={{ label }}` + `secondaryAction={{ label }}` (sin icons manual)                  | `<WizardStep>` API — los iconos default (ArrowRight) los agrega                                                                                         |
| Back-link sobre page-heading         | `<BackNavLink>`                                                                                 | `core/BackNavLink.tsx`                                                                                                                                  |
| Modal adaptive (centered + sheet)    | `<Modal>`                                                                                       | `modules/Modal/`                                                                                                                                        |
| Filter drawer (lista módulo)         | `<FilterDrawer>`                                                                                | `modules/FilterDrawer/`                                                                                                                                 |
| Picker mobile (lista + search)       | `<MobilePicker>`                                                                                | `modules/MobilePicker/`                                                                                                                                 |
| Input + helper text + error inline   | `<Input>` con `error` + `helperText` props                                                      | `core/Input.tsx`                                                                                                                                        |
| Eyebrow mono uppercase               | `<Eyebrow>`                                                                                     | `core/Eyebrow.tsx`                                                                                                                                      |
| StoreAvatar inicial + bg             | `<StoreAvatar>`                                                                                 | `core/StoreAvatar.tsx`                                                                                                                                  |
| Chip de estado por enum              | `<StatusChip>` (discriminated union)                                                            | `core/StatusChip.tsx`                                                                                                                                   |
| Combobox desktop con search          | `<Combobox>` / `<SearchableSelect>`                                                             | `core/`                                                                                                                                                 |
| Toast neutral con undo               | `useToast().addToast(msg, { variant: "neutral", action })`                                      | `core/Toast` + `contexts/ToastContext`                                                                                                                  |
| Switch / Checkbox / Radio            | `<Switch>` / `<Checkbox>` / `<Radio>`                                                           | `core/`                                                                                                                                                 |
| Sidebar de detalle sticky            | `<DetailSidebar>` (cuando aplique)                                                              | `modules/DetailSidebar/`                                                                                                                                |
| Paginación de lista (L062)           | `<ListPagination>` (labels traducidos por el consumidor) + `<PerPageSelect>` (per-page control) | `modules/ListPagination.tsx`, `modules/PerPageSelect.tsx` — promovido en S9 Parte 1, extendido con page-size + resumen desktop en ADR 0018 (2026-07-23) |
| Subcard colapsable de detalle        | `<CollapsibleSubcard>` (eyebrow chip + topAccent)                                               | `modules/CollapsibleSubcard.tsx` — promovido en S9 Parte 2                                                                                              |
| Código mono con click-to-copy        | `<CodeCopyButton>` (labels por props)                                                           | `core/CodeCopyButton.tsx` — promovido en S9 Parte 2                                                                                                     |
| Skeleton de carga (átomo)            | `<Skeleton>` (variant text/circle/rect/pill) + composites                                       | `core/Skeleton.tsx` — S10 (átomo `.skeleton`, shimmer)                                                                                                  |
| Empty state (centrado)               | `<EmptyState>` (appearance card/plain/page · iconTone neutral/accent/warning/destructive)       | `modules/EmptyState.tsx` — extendido en S10                                                                                                             |
| Error de sección con retry           | `<SectionError>` (tone destructive/warning · onRetry default `router.refresh()`)                | `modules/SectionError.tsx` — S10                                                                                                                        |
| Link list→detail con view-transition | `<ViewTransitionLink>` (drop-in de `<Link>`, triple-gate + fallback gracioso)                   | `core/ViewTransitionLink.tsx` — S12                                                                                                                     |

**Decisión:**

1. Antes de escribir cualquier `<div className="rounded-... bg-...">` que se parezca a algo del módulo anterior, **buscar en la tabla de arriba**. Si está, **reusalo**.
2. Si encontrás un patrón nuevo replicado en 2+ lugares (typically Stores + Orders) y no está en `core/` o `modules/`: **promovelo a un módulo compartido en la misma sesión que lo detectás**. No esperés a "después". Movelo, migrá los consumidores, mantené la tabla de arriba actualizada.
3. Si tu PR introduce un componente cuyo nombre se parece a uno existente (`OrderCreateSummarySidebar` vs `AsideSummary`): **fail review**. Renombrá tu wrapper o eliminalo y consumí el shared directo.
4. **Heights, tokens, paddings**: respetar exactamente los del componente canónico. No tunear (`h-10` vs `h-[2.875rem]`). Si necesitás un tamaño nuevo, abrí una variant en el componente canónico, no inventes uno paralelo.
5. **Naming**: cuando promovés un patrón, nombre genérico que funcione para N módulos (`AsideSummary` ✓, `OrderCreateSummarySidebar` ✗).

**Lessons-learned related**: L038 (audit antes de crear), L042 (componentes core S4/S5 audit visual cada Fase B), L043 (inventario = USO del módulo, no replicar spec).

### 5.2 Copy / i18n — español neutro obligatorio

Todo el copy en español **usa español neutro internacional**. Sin modismos regionales:

- ❌ Argentinismos: "dejás", "podés", "anotá", "tenés", "querés", "necesitás", "armá"
- ❌ Mexicanismos: "platícame", "ahorita", "padre" (en sentido "cool")
- ❌ Voseo en imperativos: "agregá", "elegí", "guardá"
- ✅ Forma neutra: "deja", "puedes", "registra", "tienes", "quieres", "necesitas", "arma"
- ✅ Imperativos tuteo: "agrega", "elige", "guarda"
- ✅ Aceptable: "Tú" o tercera persona impersonal según el caso. Mantener consistencia dentro del namespace.

Se aplica a TODO `src/i18n/locales/es/*.json` y todo lo que escriba un agente para usuarios hispanohablantes. Cualquier PR que introduzca voseo/modismos será rebotado.

**Si encontrás argentinismos heredados** en docs o en código durante una sesión, **flageá pero no fixees silenciosamente** — dejalo señalado para un pase dedicado de copy. Lo que sí podés y debés hacer: en el copy nuevo que vas a escribir en tu sesión, usar siempre neutro desde el primer minuto.

## 6. Cómo verificar tu propio output (auto-audit antes de cerrar)

Antes de marcar una sesión como cerrada:

1. **TodoWrite** con cada item granular en `completed`.
2. **Verificación visual** vs el prototipo del FRD (pantalla por pantalla).
3. **Auditoría comparativa** contra handoff brief / specs (tabla con ✅/❌ por item).
4. **Validación**: `npm run type-check`, `lint`, `test`, `validate-build`.
5. **Snippet de cada cambio leído del archivo** en el reporte final, no descripciones genéricas.

Si algún paso queda con ❌, **NO cerrar** — seguir trabajando.

## 7. Cuando aparezca un cross-cutting durante una sesión

Si encontrás algo roto FUERA del scope (ej. otro componente core con tokens mal, otro patrón inconsistente):

1. **Flaggear al humano**, no fixear silencioso.
2. Dejarlo registrado (tarea / issue) para atención dedicada.
3. Continuar con el scope original.
4. El humano decide si se atiende inline o como trabajo separado.

## 8. Qué actualizar al cierre de cada módulo

Cuando un módulo (S6 Stores, S7 Orders, etc.) cierra Fase B y queda aprobado:

1. Si surgió un patrón nuevo replicable cross-módulo → agregarlo a este playbook.
2. Si se aprendió algo durable del proceso → documentarlo en el doc de `docs/design/` correspondiente.
3. Si una decisión de UI se tomó que vale para futuros módulos → ADR + actualizar este playbook.

Esto NO es opcional. Sin esto, los siguientes módulos repiten errores.

## 9. Reglas adicionales aprendidas en S6 (consolidación post-módulo)

Reglas accionables descubiertas implementando Stores. Aplican a todos los módulos siguientes.

### 9.1 Componentes core — patrones nuevos

- **Wizard step cards: background siempre `--surface-elevated`** (L066). `WizardStep` usa `[background:var(--surface-elevated)]` porque la card se sienta directamente sobre el canvas (`--background`). Anti-patrón: usar `--surface` en wizard steps — resulta en cards visualmente planas que no se diferencian del canvas en dark mode. Esto NO contradice L014 (que aplica a cards de contenido que contienen inputs y cuyo contenedor es `--surface`); son jerarquías distintas.
- **Wizard layouts: `mode: "wizard" | "all-open"`** (L020). Crear usa progressive disclosure; editar usa all-open (todos los paneles visibles, header estático sin chevron, sin botones step-level, stepper top oculto). Exponer la prop desde el inicio del WizardAccordion.
- **Wizard orchestrator acepta lista explícita de steps** (L017). Nunca asumir `totalSteps = Children.count`. Pasar `steps?: StepperStep[]` permite conditional rendering (ej. BUSINESS=5 vs PERSON=4 steps) sin desincronizar.
- **Wizard con form único: `keepBodyMounted=true`** (L018). Default true. Si los steps tienen inputs uncontrolled, deben quedar en el DOM (con `hidden` + `aria-hidden`) para que `new FormData(form)` capture sus valores en el submit.
- **Crear/Editar misma UI = un componente con `mode` discriminated union** (L021). Cuando dos rutas comparten 80%+ de UI y solo difieren en (a) submit action y (b) reglas de bloqueo de campos, NO crear archivos separados. Ver `StoreForm.tsx` como referencia (CreateStoreForm + EditStoreForm como wrappers de ~20 LOC).
- **Modal sin footer: `bodyClassName="pb-6"`** (L019). El default `pb-1` asume que footer aporta los 20px restantes. Si no hay actions, sobreescribir.
- **Backward compat al rediseñar core con consumidores** (L016). Primer commit es API-aditivo (alias legacy + nuevos props). Migración de consumidores sesión por sesión. Nunca breaking change de API en la misma PR que cambia el visual. Ver `Modal.tsx` como referencia.
- **`ChannelRow` con `valueLines?: string[]`** (L023) para campos multi-línea (direcciones). URLs/emails siguen con `truncate`; campos cuyo valor pierde sentido si se trunca usan multi-line wrap.
- **`<StarRating value={number|null} size>` compartido** (L024). Cualquier display de rating numérico se acompaña SIEMPRE de las 5 estrellas visuales. No construir ad-hoc. Cuando aparezca el segundo consumidor cross-módulo, promover a `core/`.
- **Border consistency entre variants** (L015). Si una variant tiene `border: 1px solid`, todas las que conviven con ella deben tener border (transparente cuando no se ve) para igualar el border-box accounting. Aplica a Button, Chip, IconButton, Badge.
- **Select vs SearchableSelect: criterio de cantidad** (L022). <7 opciones fijas → `<Select>`. Lista larga o dinámica → `<SearchableSelect>`. Multi-select con tags inline → `<MultiTagAutocomplete>`. NO agregar búsqueda "por consistencia" si la lista no la justifica.

### 9.2 Tokens y theming — refuerzos

- **Surface vs surface-elevated en dark mode** (L013). Δ luminosity entre `--background` y `--surface` es 3% (invisible). `--surface-elevated` da 6% (perceptible). Para cards sobre canvas en dark mode, default a `--surface-elevated`. Calcular Δ antes de elegir. La regla normativa completa (los cinco casos, con la tabla de Δ) vive en [visual-foundations.md → Choosing between `--surface` and `--surface-elevated`](visual-foundations.md).
- **Card con Input/Textarea: backgrounds distintos** (L014). Convención del proyecto: input siempre `--surface-elevated`; card que lo contiene debe ser `--surface` (Card variant `outlined`, no `elevated`).

### 9.3 CSS layout — patrones nuevos

- **Separadores entre filas: `border-top + first-of-type:border-top:0`** (L025). NO `border-bottom + last-child` porque se rompe en cuanto hay un elemento posterior heterogéneo (ej. CTA al final).
- **Campos de formulario miden 46px, los botones 44/40** (L077). `<Input>` y el trigger de `<StoreCombobox>` siempre midieron `h-[2.875rem]`; `<Select size="md">` seguía la escala de `<Button>` (`h-11 md:h-10`) y quedaba 6px más bajo que el input de al lado en toda fila de dos columnas. `Select` md ahora mide 46px. Regla: un control que es **campo** iguala a `<Input>`; un control que es **botón** mantiene su propia escala.
- **Alturas iguales entre controles: `min-h + items-center + line-height`** (L026). NUNCA `py` vertical. Si un control mide más que sus pares con mismo `size`, sospechar `py` redundante. Aplica a toolbars con Button + Select + Input mixtos.
- **Input + botón inline en fila: `align-items: stretch`** (L067). Cuando un `<input>` y un `<button>` conviven en la misma fila flex (ej. campo FX + botón "Hoy"), usar `align-items: stretch` en el contenedor y NO dar `sm` al botón si el input no es `sm`. Con `stretch` el botón adopta exactamente la altura del input sin necesidad de hardcodear alturas.
- **Grid con columna condicional + extremo derecho: usar `flex justify-between`** (L027). CSS Grid no "reserva" slots para hijos condicionales. Patrón seguro: flex con dos grupos hijos (izquierda + `shrink-0` derecha) con `justify-between`.
- **`min-h` + `flex-wrap` en un hijo flex: falta `shrink-0`** (L082). Un `min-h-[N]` explícito sustituye al `min-height: auto` que pararía al ítem en su propio contenido, así que el ítem se queda clavado en N en cuanto ENVUELVE: la segunda línea se pinta FUERA de la caja y tapa al hermano siguiente. Solo se ve donde envuelve (móvil), y no avisa: no hay overflow visible ni scrollbar. Medido en Chromium a 375px en `StorePaymentAllocationPanel`: la tira de recapitulación daba `offsetHeight` 36 con `scrollHeight` 55, y el botón "Editar monto o fecha" tapaba 7px del hint de abajo; la barra de totales, 28 contra 70. Cura: `shrink-0` en todo hijo de la columna que no sea el scroller (`min-h` es suelo de reposo, nunca altura). Verificar de paso que el `min-h` no sea MENOR que el control más alto que lleva dentro (28px con un `Button size="sm"` de 32px dentro = el botón cuelga 2px por cada extremo).
- **Flex con label + text node + ancho limitado: usar bloque** (L030). `flex;gap:N` con `<span>` + text node bajo ancho insuficiente comprime y desaparece texto sin overflow visible. Usar bloque o `flex-wrap:wrap` con `min-width:0`.
- **Cards en listing grid: SIEMPRE `flex-wrap` para meta inline** (L028). Chips que pueden crecer overflowean cards estrechas. Wrappear en fila propia o usar `flex-wrap`.
- **No duplicar wrapper de width** (L029). `max-w-6xl` ya viene del shell `<main>`. `APP_SHELL_FORM_RAIL_CLASSNAME = "max-w-3xl"` solo cuando NO hay aside (settings simples, auth flows). Para create/edit con aside Resumen: `<form>` con `grid lg:grid-cols-[1fr_18rem]` dentro del max-w-6xl.

### 9.4 Modals UX — patrones nuevos

- **Secciones simétricas en modals con "personal" + "comunidad"** (L031). Si reportes están en dos `SectionGroup` hermanos, change-requests también deben estar así. NO mezclar "dos secciones hermanas" con "una sección con dos paneles internos".
- **Modal con form: NO envolver cada label+input en caja decorativa** (L032). El gap del flex column ya separa los campos. Cajas con border y tint solo para bloques semánticamente diferenciados (preview de entidad), no campos individuales.
- **Subcard toggle no duplica info ya prominente en body** (L033). Header de toggle muestra count/resumen solo cuando su ausencia justifica mirar el header. Si el body ya tiene la info, eliminar del header.

### 9.5 Forms / inputs — patrones

- **Campos sin botón save visible en demo = autosave por default** (L034). Demo HTML estático no muestra autosave obvio — solo el indicador final "Guardado hace Xm". UX default: nota privada → autosave; comentario en review → manual submit. Receta: textarea controlled + `useTransition` + debounce 800ms en change + persist on blur + indicador 3-state (saving/saved/error).
- **Metadata (lastUpdated) va al footer del campo, no al header del form** (L035). Header del form es para titular/describir. Metadata corresponde al footer del campo principal.

### 9.6 i18n

- **Keys i18n: SIEMPRE en `es` + `en` en el mismo cambio + validar JSON** (L036). Si aparece `MISSING_MESSAGE` en `es`, revisar también `en` — casi siempre falta también. Validar con `node -e "JSON.parse(require('fs').readFileSync('...'))"` antes de cerrar.
- **`t(...)` con claves dinámicas: cast `as never` documentado inline** (L037). Aceptable cuando: (a) el dynamic key es union finito conocido, (b) fallback no silencioso, (c) todas las keys presentes en archivos i18n. Comentario inline obligatorio.

### 9.7 Workflow — refuerzos críticos

- **Antes de crear componente UI, `ls src/components/core/` y `modules/`** (L038). En este repo conviven varios componentes con propósitos similares (Select, SearchableSelect, Combobox; Modal, Sheet, Drawer). Verificar inventario antes de crear.
- **N inconsistencias visuales: leer demo + mapear elementos ANTES de tocar** (L039). Cuando humano lista N gaps, primer paso NO es fixar la primera. Es leer todos los anchors relevantes del demo + listar en chat el mapping `elemento del demo → componente del repo + delta`. Recién después editar.
- **Refactors visuales de pantalla: wholesale del shell, NO parcial** (L040). Reescribir el shell visual completo usando los componentes nuevos del demo. Reusar building-blocks de lógica (forms, modals, queries) pero el chrome SE REESCRIBE. Nunca dejar un contenedor legacy + componentes nuevos en la misma pantalla. (El caso que originó la lección fue `SectionSurfaceCard`; ese componente ya no existe en el repo, la regla sí.)
- **Demo HTML con mutation JS post-render: leer también los scripts** (L041). El demo aplica `buildTopbar()` y otros transformadores en `<script>` final (~línea 8824). Si los breadcrumbs vienen del shell, no duplicar back link en body de página.
- **Componentes core de S4/S5 que aparecen en demo: audit visual cada Fase B** (L042). Specs solo detallaban API, no visual final. Re-auditar cada componente core consumido contra el demo en cada Fase B donde aparece.
- **Inventario de componentes consumidos: describir USO del módulo, no replicar spec** (L043). Plantilla mental: `[ComponentName] ([spec link]) [tono/variante/tamaño] para [propósito específico del módulo]`. La estructura interna del componente NO aparece — eso vive en su spec.
- **Cierre de Fase A: recorrer FRD por features visibles en demo sin cobertura** (L044). Listar como `P-SX-NN` (Propuesta-SesiónX-NN) para decisión humana antes de Fase B. NO asumir que "está en el demo" = aprobación de implementación.
- **Cláusula spec vigente: enumerar mini-sesiones cross-cutting abiertas** (L045). Al escribir handoff, listar componentes del inventario con mini-sesiones abiertas + política (esperar cierre vs implementar y revisar después).
- **Roadmap de sesiones es plan, no trigger automático** (L049). Un módulo no está "listo para avanzar" hasta que humano confirma visualmente contra demo. Al generar handoff, preguntar al humano qué hace en la próxima conversación, no inferirlo del plan.
- **README "sesión vigente" describe estado real** (L050). Solo trabajo que ya ocurrió o compromisos confirmados. Para "lo que sigue": `próxima: X (requisitos previos: Y)`. Antes de editar el campo, verificar contra `git log`.
- **Session doc: lista archivos desde `git status`, NO memoria** (L051). `git status` y `git log --oneline -10` antes de listar archivos modificados. Separar "modificados en esta sesión" vs "tocados en sesiones previas".
- **Patrón comunicación humano "prefiero X, acepto Y si difícil"** (L055). Implementar X si es trivial, sin pedir confirmación adicional. Confirmación ya implícita.

### 9.8 Migrations Prisma

- **Migration done = SQL escrito + `migrate deploy` aplicado + `prisma generate` + type-check pasa** (L046). Una migration NO está done hasta que los 4 pasos están confirmados. Documentar output exacto de cada paso en el session log.
- **`migrate dev` falla en shadow DB → SQL manual + `migrate deploy`** (L047). El path canónico cuando una migration vieja del repo tiene cast inválido: escribir `prisma/migrations/<ts>_<name>/migration.sql` a mano con timestamp posterior + `npx prisma migrate deploy` (NO usa shadow DB). Después `prisma generate`.

### 9.9 Testing browser-based

- **Tests con Portal: `screen.*` queries, NO `container.querySelector`** (L058). Modal, Sheet, FilterDrawer, DetailSidebar floating, Toast renderean vía Portal a `document.body`. `container.querySelector` falla.
- **`preview_eval` con `window.location.href`: NO encadenar `await`** (L054). Cuando la página navega, el contexto de evaluación se destruye. Separar en dos `preview_eval` calls: una para navegar, otra para verificar.
- **`dispatchEvent` + React inputs controlados: setter nativo + Event con bubbles** (L056). React no escucha `Event` nativo en inputs controlados; necesita `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new Event('input', {bubbles:true}))`. Para blur: `dispatchEvent(new FocusEvent('focusout', {bubbles:true}))`.
- **Rutas `(app)/*` requieren auth en preview** (L053). Antes de verificar visualmente cualquier ruta protegida, usar credentials dev (memoria `reference_dev_credentials.md`). Workflow: navegar a `/sign-in` → `preview_fill` email + password → buscar `<button type="submit">` con texto "Iniciar sesión" → click → esperar 2-2.5s.

### 9.10 Otros

- **`data-scroll-behavior="smooth"` en `<html>` para Next.js** (L048). Si `globals.css` tiene `scroll-behavior: smooth`, agregar el attribute a TODOS los `<html>` (root layout + global-error). Sin esto, Next emite warnings en cada navegación.
- **`replace_all` sobre style strings compartidos: extender `old_string`** (L057). Antes de `replace_all:true` sobre un style en HTML, escanear todas las instancias para verificar estructura interna idéntica. Si difiere, extender `old_string` con contenido adyacente único.
- **PostToolUse formatter: re-Read si zona estructural** (L052). Tras aviso "PostToolUse hook modified … after your edit (likely a formatter)", si el siguiente Edit apunta a zona estructural (imports, types, prettier-sensitive), hacer Read previo.

### 9.11 Patrones de lista tabular (S7 — módulo Pedidos)

Descubiertos en S7-A.2. Aplican a cualquier módulo con lista tabular expandible.

- **Expand chevron: anclado al top; en desktop es columna de grid** (L059). En mobile (`position: absolute`): `top: <padding-top>px; transform: none` — NUNCA `top: 50%; transform: translateY(-50%)`. Al expandir, `top: 50%` se desplaza al centro de la altura total, sacando el chevron de su línea de referencia. En desktop (`≥ 1024px`): el chevron es un hijo normal del grid (7ª columna ~28px), `position: static; align-self: start; justify-self: center`. Esto lo alinea bajo su header correspondiente y elimina el `padding-right` reservado para el overlay absoluto.

- **Orden y alineación de columnas en tabla de pedidos** (L060). Canónico cross-app para cualquier lista tabular:
  - **Orden de columnas:** Avatar → Nombre/Entidad → Conteo → **Estado** → **Total** → % Pago → Chevron. El Total va inmediatamente antes de % Pago para que las dos columnas de "dinero" queden juntas. Estado va antes de Total porque el chip contextualiza el monto.
  - Avatar / imagen: columna fija (~36px), sin header text.
  - Nombre / entidad principal: `text-align: left`.
  - Conteo (Productos): `text-align: left` con `color: var(--text-secondary)`.
  - Estado (chip): `text-align: left` (viene ANTES del Total).
  - Monto total: `text-align: right` + clase `num` (tabular-nums). Columna contigua a % Pago.
  - Barra de progreso + %: `justify-content: flex-start` (NO `flex-end`). La **barra** define la arista izquierda fija; el número va después con `min-width: 3.2ch; text-align: right; display: inline-block` para tener ancho fijo independiente de los dígitos. Sin esto, distintos porcentajes (0%, 33%, 100%) producen barras con X de inicio variable.

- **Headers de tabla: todos centrados excepto la columna de texto principal** (L063). En cualquier cabecera de lista tabular, usar `text-align: center` en todos los `> *`, luego sobrescribir con `text-align: left` solo la columna de entidad principal (Pedido/Tienda, Nombre, etc.). La columna de avatar/icono y la del chevron no llevan texto. Esto da simetría visual a las columnas numéricas y de estado sin confundir la jerarquía.

- **Íconos de tipo de producto en items expandidos** (L061). La columna `.item-icon` de cada ítem en la vista expandida muestra el ícono del **tipo de producto**, no un ícono genérico. Mapping canónico en `src/lib/catalog/storeProductTypeIcons.ts` (`getStoreProductTypeIcon`): vinilo → `Disc3`, figura → `Shapes`, manga → `BookOpen`, anime goods → `Sparkles`, cards → `GalleryThumbnails`, plush → `Package`. Si el tipo es desconocido: `Tag` como fallback. El subtipo del ítem también puede mostrarse como `<small>` bajo el nombre para reforzar el tipo.

- **Paginación de lista: canónico = Stores list** (L062). Referencia: `s6-stores-list-default` demo anchor. Estructura:
  - Mobile: único botón "Cargar más" centrado (`load-more-wrap`).
  - Desktop (`≥ 1024px`): botones individuales `«`, `‹`, números de página, `›`, `»` + `<span>` de conteo con `margin-left: 8px` ("X pedidos · Y por página"). Los `<span>` tipo texto sin botón están prohibidos para los controles de nav.
  - Página activa: `background: color-mix(in oklch, var(--accent) 12%, transparent); border-color: var(--accent); color: var(--accent); font-weight: 600; aria-current="page"`.
  - Encima de la paginación: `<div>` con conteo legible "Mostrando A–B de N pedidos" a `font-size: 12px; color: var(--text-muted); text-align: center`.
  - `gap: 4px` entre botones (NO `gap: 12px`).
  - **Actualizado (2026-07-23, ADR 0018):** el bloque de arriba describe el layout original de S6. El patrón vigente unifica orders/deliveries/**stores** (antes stores mostraba páginas numeradas en mobile y sin línea de resumen — ya no): desktop es **una sola fila** con el resumen a la izquierda y, a la derecha, el `<PerPageSelect>` (10/25/50/100, default 25) seguido del nav numerado; mobile es resumen + "Cargar más" en las tres listas. Ver [interface-patterns.md → List pagination](interface-patterns.md#list-pagination-adr-0018) y [ADR 0018](decisions/0018-list-pagination-page-size-and-desktop-summary.md).

### 9.12 Patrones de FilterDrawer — booleans y autocomplete de entidades (S7)

Descubiertos en S7-A.2. Aplican a cualquier FilterDrawer del módulo Pedidos y a futuros módulos.

- **Toggle (Switch) siempre por defecto; Checkbox como excepción justificada** (L064). Para cualquier opción boolean en FilterDrawer, forms y settings: usar `filter-switch-row` + `button.switch` en demo HTML, y `<Switch>` de `src/components/core/Switch.tsx` en implementación. Checkbox (`<Checkbox>`) solo para: (a) selección múltiple de ítems con estado indeterminate, (b) aceptación de T&C / confirmación de acuerdo, (c) bulk-select en tablas. Si dudás, elegí toggle.

- **Filtro de entidad (tienda, usuario, etc.) = `MultiTagAutocomplete`, no pills preset** (S7-A.2). El filtro por tienda en el drawer de pedidos usa `src/components/core/MultiTagAutocomplete.tsx`. Los chips de ítems seleccionados aparecen **dentro** del contenedor bordeado junto al input — no debajo de él. El `FilterDrawer` ya soporta `type: "tag-autocomplete"` en sus secciones; Fase B solo pasa la config con la lista de tiendas del usuario como `options`. Anti-patrón: NO renderizar el chip en un `<div>` separado debajo del `<input>` — eso contradice el componente canónico y confunde la implementación.

### 9.13 Mapping canónico de íconos de estado y pago — módulo Orders (S7)

Descubierto en S7-A.2 (L065). El ícono de estado es **siempre el mismo** en cualquier superficie: filter pill, chip de fila, chip de detalle, mobile card. El ícono en filter pills **siempre tiene color**: `var(--accent-cool)` en idle, `var(--accent)` cuando activo. CSS del demo: `.filter-pill svg { color: var(--accent-cool) }`.

**Estado del pedido:**

| Estado                 | Ícono Lucide     | `StatusChip` / chip color |
| ---------------------- | ---------------- | ------------------------- |
| Activas (filtro grupo) | `activity`       | — (solo en filter pill)   |
| Abierto                | `clock`          | neutral                   |
| En camino              | `truck`          | info                      |
| Parcialmente en camino | `truck`          | info                      |
| Completo               | `package-check`  | success                   |
| Cancelado              | `ban`            | neutral                   |
| Atrasado (N días)      | `alert-triangle` | warning                   |

**Estado de pago:**

| Estado de pago  | Ícono Lucide     | `StatusChip` / chip color |
| --------------- | ---------------- | ------------------------- |
| Pagado          | `check-circle`   | success                   |
| Pago parcial    | `circle-dot`     | warning / neutral         |
| Impago          | `x-circle`       | warning                   |
| Atrasado (pago) | `alert-triangle` | warning                   |
| Saldo pendiente | `alert-triangle` | warning                   |

Anti-patrón: ❌ no usar `package` para "En camino" ni `check-circle` para "Completo" — confunden la semántica de "paquete físico" con "estado de orden", y "pagado" con "entregado".

**Criterio de búsqueda en toolbar de lista:** campo de texto busca por `código de pedido` (PT-XXXXXX, match exacto o prefijo) **OR** `nombre de producto` (substring sobre `OrderItem.name`). **"Tienda" no va en el buscador** — vive exclusivamente en el FilterDrawer como `tag-autocomplete`. Tener tienda en ambos lugares crea estado conflictivo y duplica el filtrado. Placeholder: `"Código o producto (ORD-20260428-01, Evangelion OST…)"`.

**Opciones de ordenamiento de lista (módulo Orders):**

| Opción        | Descripción                                 | Por defecto |
| ------------- | ------------------------------------------- | ----------- |
| Más recientes | `orderDate DESC`                            | ✓           |
| Más antiguas  | `orderDate ASC`                             |             |
| Tienda A–Z    | `store.name ASC`                            |             |
| Tienda Z–A    | `store.name DESC`                           |             |
| % Pago: menor | `paymentPercent ASC` (deudas primero)       |             |
| Total: mayor  | `totalAmount DESC` (monto más alto primero) |             |

### 9.14 Patrones de pantallas de detalle y formularios de edición (S7 — módulo Órdenes)

Descubiertos en S7-A.3. Aplican a cualquier módulo con pantalla de detalle de entidad o formulario de edición.

- **Layout de detalle de entidad: `detail-grid` (main + aside compacto)** (L068). Pantallas de detalle de una entidad (pedido, tienda, entrega) usan un layout de 2 columnas en desktop: `main` (ancho, hero card + subcards de contenido principal) y `aside` sticky (columna derecha estrecha, ~18–20rem). La columna `aside` es para **información compacta y secundaria** — elementos cuyo contenido no justifica ocupar el ancho total del main porque generaría demasiado espacio vacío. Siempre van en el aside: botones de acción (Acciones card) y nota privada (Note card). También van en el aside: resúmenes financieros compactos (pagos: solo monto pagado + restante + barra — contenido pequeño), estadísticas secundarias de la entidad (cuántos pedidos tiene una tienda), y cualquier metadata que no sea el cuerpo principal de la entidad. En mobile: columna única, aside colapsa debajo del contenido principal. El heading de la pantalla lo proporciona la `detail-hero` card (primera card del main column) — NO se usa `page-heading` en pantallas de detalle. Anti-patrón: ❌ no meter en el aside contenido de edición interactiva compleja (formularios largos) ni listas expandibles largas — eso pertenece al main column.

- **Campo inmutable post-creación: "locked-field" en formularios de edición** (L069). Cuando un campo no puede modificarse una vez creada la entidad (ej. Tienda y Moneda en edición de pedido), renderizarlo como `<div>` read-only — NO como `<input disabled>`. Estructura: contenedor con `opacity: 0.7`, fondo semitransparente (`color-mix(--text-primary 4%, transparent)`), borde `--border`, border-radius igual al de los inputs; dentro: icono de entidad (avatar, código) + texto del valor + icono `lock` 13px (`color: var(--text-muted)`) alineado a la derecha. Debajo del contenedor: helper text en `card-helper` explicando por qué está bloqueado ("La tienda no se puede cambiar una vez creado el pedido."). El `<div>` lleva `aria-disabled="true"`. El valor se incluye en el FormData como campo oculto para que el action lo reciba, pero el backend no lo modifica. Anti-patrón: ❌ no usar `<input disabled>` — crea un campo de formulario con valor mutable potencial y semántica incorrecta para datos que nunca deben enviarse como editable.

- **Autosave on-blur para campos de texto libre: throttle 1.5s, no optimista** (L070). Refina y supersede la receta de L034 para campos de nota/texto libre. Implementación canónica: textarea controlled + guardar **solo on blur** con throttle de 1.5s (no debounce on change — evita POSTs con cada keystroke). El save **no es optimista**: el indicador solo cambia a "Guardada hace Ns" cuando el servidor confirma. Guardar un valor vacío equivale a `saveAction(null)` — limpia el campo en DB (no guarda string vacío). Indicador de estado: 3 estados — `idle` (sin cambios), `saving` (spinner pequeño o texto "Guardando..."), `saved` ("Guardada hace Ns" con timestamp relativo). El timestamp se actualiza cada 30s en idle para que el "hace Ns" sea siempre preciso. Anti-patrón: ❌ no aplicar optimismo aquí — el riesgo de mostrar contenido incorrecto si el servidor falla supera el beneficio de feedback inmediato en campos de texto largo.

- **Formulario inline expand dentro de card (vs modal)** (L071). Para acciones de "anotar X" o "añadir Y" que son contextuales y no requieren información de otra pantalla, expandir el formulario **inline dentro de la card** en lugar de abrir un modal. Patrón: un botón CTA en el footer/header de la card ("+ Registrar pago") que al hacer click expande un formulario dentro de la misma card con transición de altura suave (`max-height` + `overflow: hidden`). El resto de la pantalla permanece visible y funcional. Usar modal (ADR 0008 B) solo cuando: (a) la acción es destructiva o irreversible, (b) requiere contexto de otra pantalla o paso adicional, (c) la cantidad de campos supera lo que cabe cómodamente en el aside. Ejemplo canónico: "Anotar pago" en la card de Pagos de order-detail — solo 2 campos (monto + fecha), inline es suficiente.

- **Form wizard con sidebar Resumen reactivo** (L072). Formularios de creación/edición multi-sección usan el patrón `form-grid`: columna main con `section-cards` (pasos wizard o secciones all-open) + columna `form-sidebar` con una card "Resumen" sticky que muestra los valores actuales del formulario. El Resumen se actualiza reactivamente conforme el usuario completa campos (estado de React derivado del form state — no requiere server roundtrip). En modo create: los valores del Resumen empiezan en "—" y se rellenan paso a paso. En modo edit: los valores reflejan el estado actual del form con alguna indicación visual de "en edición" (ej. color `--warning`). El Resumen es informativo, no una validación — no bloquea ni guía el flujo. En mobile: el sidebar colapsa debajo de las section-cards (no hay toggle de accordion). Anti-patrón: ❌ no duplicar el Resumen como un accordion colapsable en mobile; mostrar siempre debajo del contenido.

- **Undo-toast 5s para deletes optimistas reversibles** (L073). Para operaciones de eliminación que no tienen consecuencias permanentes inmediatas (ej. eliminar un pago de un pedido), usar el patrón undo-toast: (1) aplicar el delete optimistamente en UI de inmediato (el ítem desaparece), (2) mostrar un toast neutro con cuenta regresiva ("Pago eliminado — Deshacer Z · 5s"), (3) si el usuario activa "Deshacer" (clic o tecla `Z`), restaurar el ítem en UI y cancelar el server action, (4) si el toast expira sin acción, ejecutar el server action. Diferencia con el patrón standard de `optimistic-client-updates.mdc`: en ese patrón el server action se dispara inmediatamente junto con el update; en undo-toast el server action se **difiere** hasta que el toast expira. Usar undo-toast cuando el costo del error es bajo (el usuario puede reconstruir el registro) y el valor del "deshacer" es alto (operaciones frecuentes o accidentales). NO usar para deletes destructivos permanentes (pedido, entrega, tienda) — esos requieren modal de confirmación ADR 0008 B.

- **Convención de view-transition names en navegación list → detail** (L074). Al animar la transición entre una fila de lista y la pantalla de detalle con la View Transitions API, la convención de naming es `view-transition-name: {entity}-{dbId}` usando el **DB id** de la entidad (no el humanReadableId ni el slug). El elemento origen (fila en la lista, ej. `order-row`) y el elemento destino (hero card en el detalle, ej. `detail-hero`) deben declarar el mismo `view-transition-name` para activar la animación de elemento compartido. Usar el DB id (no humanReadableId como `ORD-20260428-01`) porque: (a) el DB id nunca tiene caracteres especiales que conflictúen con CSS, (b) es único garantizado, (c) está disponible en ambas superficies sin lógica adicional. En producción, fallos de la View Transitions API (navegadores sin soporte, contextos de `prefers-reduced-motion`) deben ser silenciosos — nunca bloquear la navegación ni mostrar error. Anti-patrón: ❌ no usar el humanReadableId como view-transition-name — los guiones en `ORD-20260428-01` son válidos en CSS pero la longitud variable puede causar bugs sutiles de matching.

### 9.15 Adaptive Modal Pattern: bottom sheet en mobile + centered dialog en desktop (S7-A.2)

Descubierto en S7-A.2 (rediseño mobile de Orders). Aplica a TODOS los modales/sheets del rediseño desde ahora.

- **Adaptive Modal canónico** (L071, ADR 0008 Extensión 2026-05-11). El componente `<Modal>` se renderiza diferente según viewport: en desktop ≥768px = centered dialog Semantic Depth (ADR 0008 Version B); en mobile <768px = bottom sheet con drag handle 36×4px en top corners (`--radius-2xl`), sticky CTA footer con `safe-area-inset-bottom`, animación `translateY(100% → 0)` 280ms. **Arquitectura**: `Modal.tsx` (smart wrapper público) + `ModalDialog.tsx` (desktop hand-rolled) + `ModalSheet.tsx` (mobile, usa [Vaul](https://vaul.emilkowal.ski/)) + `ModalContent.tsx` (shared subcomponents). Callsites importan SOLO `<Modal>` — los demás son internos al folder. **Deps** (ver ADR 0010): `vaul` única lib UI top-level aprobada; Radix Dialog viene transitivo dentro de Vaul (NO se importa directo). ARIA: `role="alertdialog"` para destructivas (Eliminar, Cancelar), `role="dialog"` para forms/pickers. **Prohibido implementar modales centrados en mobile.** Excepción full-screen sheet cuando contenido excede ~4 secciones (caso FX Reconciliación). Demos visuales: anchors `*-mobile` del demo HTML (`s7-order-detail-delete-mobile`, `s7-order-detail-pay-mobile`, `s7-order-detail-actions-mobile`, etc.).

- **Bottom sheet variants** (L071). Tres patrones distintos según contenido:
  - **Dialog/alertdialog sheet** (confirm, alert, form corto): icon-circle tonal heredado de Semantic Depth, header con título + close, body con descripción/form, sticky footer con 2 botones (Cancelar + Acción).
  - **Action sheet** (mobile-only para "⋯ Más acciones"): sin icon-circle, lista `.s7-mob-action-list` de filas con icono + label, filas destructivas en `--destructive`. No tiene footer — cada fila ES la acción.
  - **Picker sheet** (selector de opciones tipo "tipo de producto"): search input opcional arriba + lista `.s7-mob-picker-list` (icon + label + check selectivo). Tap en opción = seleccionar y cerrar (no footer).

### 9.16 Mobile viewport simulation (histórico — demo del subproyecto)

Nota histórica: reglas que se usaron para simular viewports mobile en el demo del subproyecto de rediseño (la implementación real en `src/` usa responsive real, no simulation). Se conservan como contexto.

- **Naming convention: anchors mobile deben terminar en `-mobile`** (L070). El selector canónico de mobile viewport simulation es `section[id$="-mobile"]`. IDs como `s7-X-mobile-Y` NO matchean. Convención: `s7-<screen-name>-<variant>-mobile`.

- **Override de selectores con media queries desktop** (L066). Las media queries (`@media (min-width: 768px)`, `>=1024px`) evalúan el viewport del browser, no el ancho del contenedor simulado. Dentro del phone container de 390px, TODOS los selectores responsive desktop aplican erróneamente. Hay que overridearlos uno por uno:
  - `.app-shell` (grid desktop) → `display: flex; flex-direction: column; grid-template-columns: none !important`
  - `.form-grid` (1fr 320px) → `1fr !important`
  - `.form-sidebar` (sticky desktop) → `position: static !important`
  - `.mobile-tabbar` (`display: none` en ≥1024px) → `display: flex !important`
  - `.detail-grid` similar

- **Cascada `min-width: 0`** (L067). Si un descendiente tiene `min-width` explícito (tabla con scroll horizontal, código preformateado, imagen sin `max-width`), todos los flex/grid ancestors heredan ese mínimo y desbordan el padre. Agregar `min-width: 0` a `.section-cards`, `.section-card`, `.section-card-body`, `.section-card-inner`, `.field` (o equivalentes) dentro del mobile container.

- **Action bar dentro del phone container: NO usar `position: fixed`** (L069). En contenedores constreñidos, `position: fixed` se escapa al viewport. Preferir flex column layout: action bar como hermano de `app-content` dentro de `app-shell` con `flex-direction: column`; `app-content` con `flex: 1; overflow-y: auto`; action bar con `position: static` o `position: sticky; bottom: 0`. Si `position: fixed` es absolutamente necesario, agregar `transform: translateZ(0)` al ancestor (`app-shell`) para crear containing block.

- **Lucide selectores duales `> i, > svg`** (L068). El runtime `lucide.createIcons()` reemplaza `<i data-lucide="X">` con `<svg>`. Los selectores CSS `> i` dejan de matchear post-runtime. Usar selectores duales: `.alert > i, .alert > svg { color: ...; }`. En Fase B (React/Next con `lucide-react`) NO es problema — renderiza `<svg>` directamente.

### 9.17 Patrón S8 — Chip Eyebrow + Top-Accent (S8, módulo Ajustes + uplift de detalles)

Descubierto en S8 (Fase A demo) y trasladado a código en S8 Fase B uplift de `order-detail` y `store-detail`. Aplica a cualquier página de detalle con cards heterogéneas que coexisten en un mismo viewport.

**Qué es.** Un par visual coordinado:

- **Chip Eyebrow** — el eyebrow tradicional (mono uppercase) se renderiza como pill tintada con borde + fondo `color-mix(in oklch, var(--token) 9–14%, transparent)` + ícono lucide leading.
- **Top-accent border** — la card lleva `border-top: 2px solid color-mix(in oklch, var(--token) 55%, transparent)` con el mismo token semántico que el chip.

Los dos elementos siempre se aplican juntos. Un chip sin top-border, o un top-border sin chip, rompe el patrón y se lee como ruido.

**Tonos disponibles** (vocabulario semántico cross-módulo — NO inventar tonos por módulo):

| Tono          | Token           | Comunica                                 | Ejemplos canónicos                             |
| ------------- | --------------- | ---------------------------------------- | ---------------------------------------------- |
| `accent`      | `--accent`      | Identidad, contenido principal, acciones | Hero del pedido, Acciones, Tu tienda · Resumen |
| `cool`        | `--accent-cool` | Sistema, datos, historial, info técnica  | Productos, Historial, Pagos (activo)           |
| `warm`        | `--accent-warm` | Personal, hobby, social, notas, reseñas  | Tu nota privada, Reseñas                       |
| `success`     | `--success`     | Estado terminal positivo                 | Pagos cuando 100% pagado                       |
| `warning`     | `--warning`     | Estado de atención (no error)            | Pagos cuando pedido completo + saldo           |
| `destructive` | `--destructive` | Estado de error / urgencia               | Pagos cuando pedido overdue                    |

**Vocabulario cross-módulo congelado** — estos labels NO varían su tono+ícono entre pantallas:

| Eyebrow                                      | Tono                      | Ícono lucide    |
| -------------------------------------------- | ------------------------- | --------------- |
| `Acciones`                                   | `accent`                  | `Zap`           |
| `Tu nota privada`                            | `warm`                    | `PencilLine`    |
| `Reseñas`                                    | `warm`                    | `Star`          |
| `Productos`                                  | `cool`                    | `Boxes`         |
| `Historial`                                  | `cool`                    | `Clock3`        |
| `Pagos`                                      | (state-aware — ver abajo) | `Wallet`        |
| `Tu pedido · {curr}` / `Tu entrega · {curr}` | `accent`                  | `Package`       |
| `Tus pedidos aquí` (recap "tus cosas")       | `accent`                  | `Package`       |
| `Resumen` (recap de datos del sistema)       | `cool`                    | `ClipboardList` |
| `Categorías` / `Categorías e importaciones`  | `cool`                    | `Tags`          |
| `Canales de contacto`                        | `cool`                    | `AtSign`        |
| `Direcciones`                                | `cool`                    | `MapPin`        |

**Slot resumen del aside — dos familias (congelado en S13, F-04).** El primer card del aside de detalle puede ser uno de dos slots semánticamente distintos; NO se unifican porque comunican cosas distintas:

- **Recap "tus cosas"** (la actividad/identidad del viewer): `accent` + `Package`. Espeja el hero `Tu pedido`/`Tu entrega`. Ejemplo: store-detail "Tus pedidos aquí" (pedidos del viewer en esa tienda).
- **Recap de datos del sistema** (atributos factuales de la entidad): `cool` + `ClipboardList`. Misma familia que `Productos`/`Historial`/`Categorías`. Ejemplo: delivery-detail "Resumen" (tienda, fechas, pedidos origen).

Elegí la familia por lo que el card comunica, no por su posición. Order-detail no tiene slot resumen propio (lo cubre el hero + la card `Pagos`).

**Pagos — tono derivado del estado del pedido** (`derivePaymentsTone` en `OrderPaymentsAsideCard.tsx`):

```
isFullyPaid     → success
isOverdue       → destructive
isCompleted && hasUnpaidBalance → warning
otherwise (activo, cancelado) → cool
```

#### Cuándo usar

✅ Páginas de detalle (`order-detail`, `store-detail`, `delivery-detail` futuro) — cards de tipos **distintos** coexistiendo en el viewport. El usuario necesita escanear y encontrar "dónde está la card de Pagos / Acciones / Nota". Los tonos crean un lenguaje visual reconocible.

✅ Pantalla de Ajustes (S8) — paneles Perfil / Cuenta / Preferencias y sus sub-cards (Apariencia cool, Coleccionista warm).

✅ Cards que comparten viewport y representan **naturalezas semánticas distintas**.

#### Cuándo NO usar

❌ **Wizard step cards** (`section-card-wizard` con `step-num`, en `order-create` / `store-create`). Las cards son homogéneas (cada una es "un paso") y ya tienen el `step-num` como diferenciador primario. Además los estados `is-active` (`--border-strong` + sombra) e `is-done` (success verde) ya usan color tonal en un eje de progresión — un top-border de color pelearía con eso. Razonamiento completo: en wizards el flujo es lineal (no se escanea), las cards contienen inputs (cromo de color se lee como alerta), y dos sistemas tonales superpuestos se anulan.

❌ **List items repetidos** (`order-list`, `store-list`, filas de cualquier listado). Cards homogéneas en serie — agregar top-border de color en cada fila licúa la señal hasta convertirse en decoración.

❌ **Eyebrows dentro de modales o sheets**. Los modales (`m01b` / ADR 0008 Semantic Depth) ya usan `m01b-icon-circle` tonal como diferenciador. Apilar un chip eyebrow encima duplica la señal.

❌ **Filter drawer interno** (`#s6-stores-list-filters-open`, `#s7-orders-list-filters-open`). El drawer mismo es el contexto; secciones internas no necesitan diferenciación tonal.

❌ **Sidebar sticky cards de wizards** (`Resumen` aside, `Atajos`). Son auxiliares secundarios — no merecen jerarquía visual de "tipo principal".

❌ **Eyebrow `Tu pedido · {moneda}` cuando vive dentro del `m01b-header` de un modal** — el modal ya tiene su propio icon-circle.

Regla general: el patrón es un **diferenciador**, y los diferenciadores solo funcionan mientras son escasos. Si lo aplicás en todas las cards de la app, el ojo deja de registrarlo como significativo.

#### Cómo implementar en código (Fase B)

**1. Componentes core** (ya extendidos en S8 Fase B):

- `<Eyebrow variant="chip" tone="..." icon={LucideIcon}>` — renderiza el pill. Tones: `muted | accent | cool | warm | success | warning | destructive`. Acepta `id` para `aria-labelledby`.
- `<SectionCard topAccent="...">` — top-border 2px independiente del prop `tone` (que sigue siendo borde-izquierdo para warning/destructive states).
- Wrappers con styling propio (`CollapsibleSection`, `CollapsibleSubcard`, `DetailSidebar`, `PrivateNoteCard`, `OrderPaymentsAsideCard`) reciben prop `topAccent` y aplican el border-top via inline style con `color-mix` sobre el token correspondiente. Patrón:

  ```ts
  const TOP_ACCENT_VAR: Record<EyebrowTone, string> = {
    accent: "var(--accent)",
    cool: "var(--accent-cool)",
    warm: "var(--accent-warm)",
    success: "var(--success)",
    warning: "var(--warning)",
    destructive: "var(--destructive)",
    muted: "var(--text-muted)",
  };
  style={{ borderTop: `2px solid color-mix(in oklch, ${TOP_ACCENT_VAR[topAccent]} 55%, transparent)` }}
  ```

**2. El gotcha RSC — íconos cruzando server→client** (descubierto durante S8 Fase B):

Si el card-wrapper es un Client Component (`"use client"` porque tiene `useState` para colapsar/toggle) y el padre es Server Component, **NO se puede pasar el componente del ícono lucide como prop directo** — React intenta serializarlo y crashea con:

> Only plain objects can be passed to Client Components from Server Components. Classes or other objects with methods are not supported.

**Patrón correcto:** la wrapper Client Component recibe el eyebrow ya armado como `ReactNode`, y el padre Server Component arma el JSX (que React server-renderiza antes de cruzar el boundary):

```tsx
// ❌ MAL — crash en RSC boundary
<CollapsibleSection
  eyebrow={tStores("redesign.detail.categoriesTitle")}
  eyebrowTone="cool"
  eyebrowIcon={Tags}        // function ref no se serializa
  topAccent="cool"
/>

// ✅ BIEN — el Eyebrow se renderiza server-side, el SVG ya plano cruza el boundary
<CollapsibleSection
  eyebrow={
    <Eyebrow variant="chip" tone="cool" icon={Tags}>
      {tStores("redesign.detail.categoriesTitle")}
    </Eyebrow>
  }
  topAccent="cool"
/>
```

Esto funciona porque `Eyebrow` no tiene `"use client"` — es Server Component. React lo renderiza server-side, el ícono se invoca server-side y resulta en SVG markup plano que sí cruza la frontera serializado.

`topAccent` (string enum) se pasa como prop directo sin problema — el problema es exclusivo de function refs (componentes).

**3. Cuándo el componente consumidor es Client** (el card-wrapper completo, no solo el eyebrow):

Si todo el árbol consumidor es client (ej. `OrderDetailHero`, `OrderPaymentsAsideCard`, `OrderActionsCard`, `PrivateNoteCard`), importá los íconos directamente desde `lucide-react` dentro del Client Component y pasalos a `<Eyebrow icon={...}>` sin restricción — todo se ejecuta del lado cliente, no hay boundary que cruzar.

#### Tokens consumidos por el patrón

- Color: `--accent`, `--accent-cool`, `--accent-warm`, `--success`, `--warning`, `--destructive`, `--text-muted`.
- Chip background: `color-mix(in oklch, var(--token) 9–14%, transparent)`.
- Chip border: `color-mix(in oklch, var(--token) 18–28%, transparent)`.
- Card top-border: `2px solid color-mix(in oklch, var(--token) 55%, transparent)`.

Los porcentajes vienen del demo HTML y están calibrados para AA en light/dark. NO ajustar sin actualizar el demo + este playbook.

#### Verificación post-implementación

Para cada card afectada por el patrón:

1. Top border 2px en el color correcto (no 1px ni 3px).
2. Eyebrow chip con ícono visible y color coordinado con el border (NO un tono que no exista en la tabla cross-módulo).
3. Sin regresión de layout — la card no crece > 2px en altura.
4. Light y dark — los `color-mix` con tokens semánticos se adaptan solos. Probar ambos themes.
5. Labels recurrentes (`Acciones`, `Tu nota privada`, etc.) usan el mismo tono+ícono que en el resto de la app (vocabulario congelado).

### 9.18 Wordmark / logo — Zilla solo para el logo (congelado en S13, F-03)

La fuente **Zilla Slab Highlight** (`--font-logo` / clase `font-logo`) está **acotada exclusivamente al logo de marca**: el wordmark del app shell (`Logo.tsx`), el favicon (`icon.svg`) y el logo de las imágenes OG. **No se usa en body, headings ni ningún otro texto.** No expandir su uso.

Las superficies públicas (landing/auth/legal) usan un **lockup distinto y deliberado** (S11): `BrandMark` con Inter + un tile "P" con gradiente accent. Esto es intencional — chrome interno (Zilla) vs marca pública compacta (Inter + "P") son dos contextos. No unificar sin decisión explícita.

## 10. Estados transversales — empty / loading / error (S10)

Reglas del sistema de estados. Spec completo: `docs/design/states.md`. Decisión: ADR 0013. Demo: anchors `#s10-*`.

### 10.1 Loading — skeleton vs spinner vs nada

- **Skeleton** (vía `loading.tsx` / `<Suspense>`) cuando Next resuelve trabajo **server** de una pantalla con layout predecible (listas, detalle, form). Llega por SSR.
- **Spinner** (`<Loader2>`) solo para acciones **cortas que el usuario dispara**: submit pendiente (`<Button loading>`), `<Input loading>` de búsqueda, autosave. **Nunca** como fallback de ruta.
- **Nada** en mutaciones optimistas — el cambio se aplica local de inmediato (`optimistic-client-updates.mdc`).
- **Prohibido fake client fallback** (`dynamic(..., { loading })`) para Client Components que igual se renderizan server-side (`ssr: true`). El skeleton no aparece y suma complejidad (`react-next-components.mdc`).
- **Arquitectura de loading de listas (L080):** el `<Suspense>` envuelve **solo la región de datos** (tabla/cards + paginación). El **chrome** (título + toolbar de filtros/búsqueda/sort/nuevo + chips) renderiza a nivel de página y es **instantáneo** (alimentado por queries livianas: store options). El **contador** del heading es una unidad suspendida aparte (`<Suspense>` sin key, counts globales → skeleton solo en carga inicial). El **skeleton de datos coincide con el layout real**: tabla-desktop/cards-mobile, o **card-grid donde son cards (NUNCA tabla para grids)**. Referencia: `orders/page.tsx`, `deliveries/page.tsx`, `stores/page.tsx`. **Tiendas** usa `useTransition` (toolbar persiste en transiciones) + `<Suspense>` para el skeleton inicial, con **card-grid skeleton (nunca tabla)**; su contador se desacopló del query pesado con `countPublicStores(db, filters)` (reusa el where-builder) y se suspende aparte. Técnica reusable cuando el contador sale del query pesado (L080).
- **Título/breadcrumb del shell en rutas de detalle con `loading.tsx` (L081):** si una ruta de detalle conserva un `loading.tsx` (Suspense a nivel de ruta), el setter del título del shell (`SetHeaderTitle` / `*SegmentContentHeader`) DEBE montarse desde el `layout.tsx` del segmento (ARRIBA del boundary), nunca desde el contenido del `page` (abajo del boundary): en hard load el shell hidrata con el fallback antes de que resuelva el contenido streameado y el set queda atrapado → el topbar muestra "Detalle" en vez del código. Patrón canónico: `stores/[slug]/layout.tsx` + `StoreSegmentContentHeader`; replicado en `orders/[id]/layout.tsx`. Sin `loading.tsx` (p. ej. deliveries) el setter en el contenido del `page` sirve. Verificable por DOM en hard load: `header p.truncate` = código/nombre, no el fallback.

### 10.2 Skeleton canónico — `<Skeleton>` (átomo `.skeleton`)

- **Una sola receta:** `linear-gradient` shimmer con mezcla neutra sobre `--text-primary` (6→12→6 %), `1.4s linear infinite`. **Shimmer, no pulse.** Clase CSS shipped `.skeleton` (keyframe `skeleton-shimmer`); el demo la prototipó como `.s10-skel`. Supersede `.skeleton` (S6), `.s7-mob-skel` (S7) y las recetas pulse del React.
- **Relleno con `--text-primary` mix, NO `--border`** (mantiene contraste en canvas/surface/elevated; `--border` se aplana en dark).
- **`prefers-reduced-motion: reduce` → estático** (mix 9 %, sin animación). **Obligatorio** — usar `motion-safe:` en Tailwind (corrige el bug de `StoreListingGridSkeleton`).
- **a11y:** el átomo es `aria-hidden`; el **contenedor** lleva `aria-busy="true"` + `aria-label`/`aria-live`.
- Composiciones canónicas: `list-row`, `card`, `detail-hero`, `form`. Reflejan el layout real que reemplazan (el shimmer no debe "saltar" cuando llega el contenido).

### 10.3 Empty — `<EmptyState>` (anatomía única, dos clases)

- Card dashed sobre `--surface-elevated`, círculo 64 px, título + subtítulo + CTAs. Cambia solo **tono del ícono** + copy:
  - **Primera vez:** `iconTone="accent"`, CTA primary (verbo+objeto). Voz forward-looking ("Anota tu primer…").
  - **Sin resultados:** `iconTone="neutral"`, CTA ghost "Limpiar filtros". Voz que ofrece salida.
- `appearance="page"` para estados centrados full-page (route error / 404 / offline). El `compact` planeado se descartó y `StoreEmptyStateBox` se eliminó como dead code. `appearance="plain"` legacy.
- **Excepción:** `StoreEmptyCatalogTag` es empty a nivel chip, no región — no se consolida.
- El slot `visual` queda reservado para una futura mascota _sleeping_; **S10 no monta mascota**.

### 10.4 Error — route vs section vs 404 vs offline

- **Error de RUTA (full-page, `error.tsx`):** bloque centrado, icon-well **`destructive`** (`TriangleAlert`), eyebrow mono, retry (`reset()`) + ghost "Ir al inicio". Mantiene el shell. `role="alert"`. Sentry con `tags.area`.
- **`global-error.tsx`:** fallback catastrófico del root layout. Self-contained, **sin i18n** (copy bilingüe inline), estilos inline + tokens. Sentry bare.
- **Error de SECCIÓN (`<SectionError>`):** una región falló y el resto vive. Vocabulario §9.17 (Chip-Eyebrow + Top-Accent) tono **`destructive`** + retry ghost. Retry default = `router.refresh()`. `role="alert"` + `aria-live="polite"`. Variante `tone="warning"` = offline.
- **404 (`not-found.tsx`):** mismo bloque, tono **`neutral`** (`Compass`). Un 404 **no es un error** → nunca `destructive`. Sin Sentry.
- **Offline:** tono **`warning`** (`WifiOff`, transitorio). Sin Sentry.

### 10.5 Tonos de estado (vocabulario congelado)

| Estado                 | Tono          | Ícono Lucide    |
| ---------------------- | ------------- | --------------- |
| Empty · primera vez    | `accent`      | contextual      |
| Empty · sin resultados | `neutral`     | `SearchX`       |
| Error de ruta          | `destructive` | `TriangleAlert` |
| Error de sección       | `destructive` | `TriangleAlert` |
| 404                    | `neutral`     | `Compass`       |
| Offline                | `warning`     | `WifiOff`       |

### 10.6 Sentry — una sola captura por error

`error.tsx` / `global-error.tsx` capturan el render; los server actions capturan los suyos. **`<SectionError>` NO captura** (es presentación; la captura vive en el fetch fallible que lo origina). `not-found` y offline no capturan. Nunca duplicar (`sentry-error-handling.mdc`).

### 10.7 Anti-patrones (S10)

- ❌ Receta de skeleton ad-hoc por módulo · ❌ `animate-pulse` sin `motion-safe:` · ❌ fake client fallback para UI SSR · ❌ mascota en errores/confirmaciones · ❌ `destructive` para un 404 · ❌ doble captura en Sentry · ❌ cerrar el shell en `error.tsx`/`not-found.tsx` · ❌ spinner como fallback de ruta.

## 11. Motion — sistema de movimiento (S12)

> Detalle completo en `docs/design/motion.md` + ADR 0014. Acá la versión accionable.
> **REGLA CERO:** las primitivas de motion ya existen (`globals.css` §1) — se construye encima, no se resetean.

### 11.1 Tokens (no inventar otros)

- **Duraciones:** `--motion-fast` 150ms (hover/focus/control) · `--motion-base` 280ms (modal/sheet/drawer/page/VT) · `--motion-slow` 480ms (expresivo/indeterminate). Count-roll = 600ms (hook). **`--motion-instant` 100ms** (flips discretos — toggle/checkmark/count tick).
- **Easings:** `--ease-emphasis` (= M3 Standard; opacity/color/UI chica) · `--ease-out-expressive` (= M3 Emphasized decelerate; enters de superficie) · `--ease-bounce` (celebraciones, solo low-frequency) · `--ease-vt-signature` (**solo** view-transitions, nunca reusar).
- **Regla dura:** animar **solo `transform`/`opacity`**. Nunca `width`/`height`/`top`/`left`/`margin`. INP ≤ 200ms p75.
- **`prefers-reduced-motion`:** el bloque global (`globals.css` §12) es el **piso**; cada superficie nueva ships su `motion-safe:`/`motion-reduce:` explícito. **reduced ≠ none** (cross-fade sutil, no matar el feedback).

### 11.2 Patrones canónicos

- **Toggle** (Switch/Checkbox/Radio): translate/zoom `--motion-fast` + `--ease-emphasis`; reduced → instant.
- **Optimistic + undo** (toast neutral-undo): ventana **5s** reversible / **8s** delete entero, pausa on-hover, countdown hairline (`scaleX`, no `width`), atajo `Z`, `aria-live=polite`. Modal/sheet cierran sincrónico (Optimistic Confirmation), el padre es dueño del rollback+toast.
- **Progress de pago:** fill por `transform: scaleX()` origin-left (no `width`); cifra con `useAnimatedNumber` (600ms cubic-out, reduced → snap).
- **Count change:** `useAnimatedNumber` + `tabular-nums` en toda cifra que actualiza por update optimista.
- **Success micro-moment:** asentamiento, no confeti (morph "$0 → Pago completado" gated en el count a 0). `--ease-bounce` + emoji + (futuro) mascota **solo** en celebración genuina de bajo riesgo.
- **List→detail VT** (`src/components/core/ViewTransitionLink.tsx`): drop-in de `<Link>` que envuelve `router.push` en `document.startViewTransition`. Contrato de nombres `order-{id}`/`dlv-{id}`/`store-{slug}` (en el wrapper de card/row/hero, NO en el link) + firma `--ease-vt-signature`. **Triple gate:** nunca bajo automatización (`navigator.webdriver` → e2e determinista) · ON en dev/preview (revisable) · flag PostHog `FEATURE_FLAGS.LIST_DETAIL_VIEW_TRANSITIONS` en prod (kill sin redeploy). **Fallback gracioso** (modificadores / middle-click / sin soporte de browser / flag-off → navegación nativa de `<Link>`); reduced-motion → cross-fade ~150ms explícito (`globals.css §12`). **Opción A:** el `<ViewTransition>` canary de React queda fuera del path (`next.config.ts` sin `experimental.viewTransition`). No hacerlo dependencia dura.

### 11.3 Anti-patrones (motion)

- ❌ Animar props de layout (`width`/`height`/`top`/`left`) · ❌ `transition-all` (scopear a `[transform,opacity]`) · ❌ easing inventado por componente · ❌ hover-motion decorativo en superficies no interactivas · ❌ `--ease-bounce`/emoji fuera de momentos celebratorios · ❌ animar para tapar latencia de fetch · ❌ hacer el `<ViewTransition>` de React (canary) dependencia dura · ❌ confiar **solo** en el piso global de reduced-motion · ❌ duraciones hardcoded (`duration-300`) en vez de tokens.

## 12. Voice — voz constante, tono por contexto (S12)

> Detalle completo en `docs/design/ux-copy.md`. Términos canónicos: `docs/product/glossary.md`.

### 12.1 Voz constante (4 pilares)

Clara y directa (una idea por línea, voz activa, brevedad > ingenio) · Cómplice no corporativa (`tú` siempre, cero "Le informamos"/"Sistema"/"Disculpe las molestias") · Traductora del dominio (glosario + el **dato es el héroe**) · Humor seco y puntual (solo si sale natural; "si dudás, cara seria"; máx **1 emoji**, solo en celebración).

### 12.2 Tono por contexto (la matriz)

- **Polo neutro/claro** (Linear): plata/pagos/totales, tracking de entrega, **destructivas**, **errores**, confirmaciones, atraso/vencido. Serio, task-first, sin emoji, el dato manda.
- **Polo juguetón** (Arc/Duolingo): empty states, onboarding, **éxito/achievement**. Cálido, exclamación OK, personalidad de coleccionista, 1 emoji puntual.
- **Regla de oro:** ante la duda, **bajá al polo neutro**. Claridad **siempre** > entretenimiento. El delight mal puesto (sobre plata/error/entrega fallida) saca al usuario del producto.

### 12.3 Anti-patrones (voice)

- ❌ Delight/emoji/exclamación sobre plata, errores o acciones destructivas · ❌ Voseo / argentinismos ("dale", "podés", "agregá" — usar neutro, PLAYBOOK §5.2) · ❌ > 1 emoji o emoji fuera de celebración · ❌ Corporativismo ("Operación exitosa", "Ha ocurrido") · ❌ Cringe/TikTok-talk ("bestie", "no cap") · ❌ Traducir es↔en literal (se **reinterpreta**; el `en` gana calidez por contracciones) · ❌ Cifra sin contexto ("$48,50" suelto, no "$48,50 de $120").

## Referencias

Fuente de verdad permanente (`docs/design/`):

- `docs/design/README.md` — índice del sistema + guía de selección de archivo.
- `docs/design/visual-foundations.md` — color, tipografía, spacing, radius, superficies, gradients.
- `docs/design/tokens-css.md` — contrato literal de variables CSS (espejo de `globals.css`).
- `docs/design/interface-patterns.md` — layout, shell, modales, formularios, chips, responsive, a11y.
- `docs/design/motion.md` — sistema de motion (tokens, reglas, microinteracciones, view transitions).
- `docs/design/states.md` — estados transversales empty/loading/error.
- `docs/design/ux-copy.md` — voice library (voz constante + matriz de tono).
- `docs/design/components.md` — mapa de componentes (qué existe, cuándo usar, ruta canónica en `src/`).
- `docs/design/decisions/` — ADRs aceptados (0001–0014).

Refuerzo (reglas):

- `.agents/rules/modal-canonical-pattern.mdc` — refuerzo canónico del Modal.
- `.agents/rules/design-system-playbook.mdc` — refuerzo de este playbook.

Este sistema lo produjo un subproyecto de rediseño, conservado solo como contexto histórico (no es fuente de reglas ni de specs a seguir). La autoridad permanente es `docs/design/` + el código en `src/`.
