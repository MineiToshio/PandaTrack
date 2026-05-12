---
title: PandaTrack Redesign — Playbook accionable
last_updated: 2026-05-05
status: vivo · cargar antes de cualquier implementación de UI
owner: Sergio Minei
---

# PandaTrack Redesign — Playbook accionable

> ⚠️ **Lectura obligatoria** antes de implementar / refactorear cualquier UI en `src/`. Reforzado por el cursor rule `.cursor/rules/design-system-playbook.mdc` con `alwaysApply: true`.

Este playbook destila aprendizajes operativos del subproyecto de rediseño. Cada regla acá apareció porque algo salió mal una vez (ver `_notes/lessons-learned.md` para origen). Si la regla ya está acá, **no la re-debates** — implementá según el playbook.

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

**Excepción full-screen sheet**: cuando contenido es muy largo (>4 secciones / scroll significativo) → full-screen sheet (ver `_notes/demo-screens.html` anchor `#s7-fx-reconciliation-mobile`).

API obligatoria de `<Modal>`: `tone` (`default | destructive | warning | info`), `size` (`md | lg`), `primaryAction`, `secondaryAction`, opcional `tertiaryAction`, `icon` (Lucide en icon-circle tonal de 48px). Para mobile: `ModalSheet` inyecta drag handle + sticky footer automáticamente.

ARIA: usar `role="alertdialog"` para destructivas (Eliminar, Cancelar pedido), `role="dialog"` para forms/pickers.

Reforzado por cursor rule `.cursor/rules/modal-canonical-pattern.mdc`. Detalle en `docs/redesign/components/Modal.md` y ADR 0008.

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

Section types soportados: `pills | pills-search | icon-pills | autocomplete | tag-autocomplete | date-range | switches`.

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

## 2. Tokens — convenciones cross-app

### Colores

- **Velvet** es la paleta única en `src/`. Las otras paletas (Lilac, Plum, Lagoon, Forest) viven solo en demo HTML para referencia futura.
- `--text-on-accent` light = blanco; dark = oscuro. Decisión S3-B para AA. Si te molesta visualmente, no cambies sin abrir un ADR.
- Status enums usan tokens semánticos: `--success`, `--warning`, `--destructive`, `--info`. Nunca hex literales.

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

Sidebar widths, header height, drawer widths, FAB size — todos como tokens (`--sidebar-w-expanded`, `--header-h`, `--drawer-w`, etc.). **Cero literales** `240px`, `64px`, `440px`.

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

`<Toast variant="neutral-undo">` con CTA "Deshacer" + atajo `Z`. Lifetime 5s default, 8s para delete entero. ADR 0001 D4.

### Section card disabled-gated

Card visible al 100% (eyebrow + title intactos), contenido reemplazado por icon `lock` + copy guía en `--text-muted`. **Sin opacity** (ADR 0001 D3).

### Field-as-attribute (campo prefilled por contexto)

Wrapper `surface-elevated` + badge mono `↳ DESDE PT-XXXXXX` + valor + link ghost "Cambiar". ADR 0001 D2.

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

Spec completo: `docs/redesign/components/FilterTriggerButton.md`. Demo visual: `#s7-orders-list-filters-open` (count=1) y `#s7-orders-list-empty-filtered` (count=3).

## 4. Anti-patterns explícitos (NO hacer)

- ❌ `<select>` HTML nativo. Usar `<Select>` o `<Combobox>`.
- ❌ Crear modal/dialog con Portal + div ad-hoc. Usar `<Modal>`.
- ❌ Copiar visual de modals viejos del demo HTML inline (`#s6-store-create-duplicate-detected`, etc. son flujos full-screen, no modals reales; `.report-modal*` ya está mapeado al canon).
- ❌ Hardcodear `text-white` en código. Usar `--text-on-accent` (resuelve light/dark automático).
- ❌ Hardcodear `border-radius: 8px` o cualquier literal de spacing/color/radius. Usar tokens.
- ❌ Borrar `<AppPageHero>` legacy de pantallas no rediseñadas. Solo eliminarlo en pantallas que se están rediseñando ahora (Stores ya lo eliminó; Orders/Deliveries lo van a eliminar cuando se rediseñen).
- ❌ Inventar `tone` o `variant` nuevos sin abrir ADR. Si necesitás algo que no existe, extender el componente in-place y documentar.
- ❌ Devolver "cierre" sin verificar el código modificado. Después de cada Edit, leer el archivo y pegar el snippet en el reporte.
- ❌ Mezclar visualmente paletas (Velvet en `src/` solamente; las alternativas viven solo en demo y docs).
- ❌ Usar `<select>` nativo aunque sea para 3 opciones — usar Select con buscador integrado.
- ❌ Cerrar drawer/modal al hacer click outside cuando ocupa una superficie grande (FilterDrawer no cierra outside). Solo X y Esc.
- ❌ Confundir `<FilterDrawer>` con `<Modal>` y usar uno donde corresponde el otro. Son patrones distintos con código independiente. Filtros de listado → `<FilterDrawer>` (side drawer desktop / bottom-sheet mobile, hand-rolled, sin Vaul). Decisiones discretas (confirm, alert, form corto) → `<Modal>` (centered desktop / bottom-sheet mobile via Vaul). El parecido visual del mobile bottom-sheet es coherencia del design system, no acoplamiento arquitectónico.
- ❌ `<input type="checkbox">` para opciones boolean en UI. **Por defecto usar `<Switch>`** (`src/components/core/Switch.tsx`). El Checkbox se reserva para: selección múltiple de ítems con estado indeterminate, aceptación de términos/condiciones, bulk-select en tablas. Si dudás, elegí toggle.

## 5. Workflow obligatorio antes de implementar UI

1. **Leer este playbook completo** (sí, todo).
2. **Leer el HTML demo** del componente/pantalla afectada en `docs/redesign/_notes/demo-screens.html`. Los anchors están agrupados en la nav lateral del demo por sesión (`#s6-`, `#s7-`, `#m01-`).
3. **Leer la spec del componente** en `docs/redesign/components/<Name>.md`.
4. **Leer ADRs aplicables** en `docs/redesign/decisions/`.
5. **Verificar tokens correctos** consultando `docs/redesign/tokens.md`.
6. Solo entonces implementar.

Si saltás cualquiera de estos pasos, vas a generar trabajo que después hay que rehacer. **Empíricamente verificado durante S6** (módulo Stores requirió 4-5 rounds de fixes por saltarse pasos).

## 6. Cómo verificar tu propio output (auto-audit antes de cerrar)

Antes de marcar una sesión como cerrada:

1. **TodoWrite** con cada item granular en `completed`.
2. **Verificación visual** vs HTML demo (anchor por anchor).
3. **Auditoría comparativa** contra handoff brief / specs (tabla con ✅/❌ por item).
4. **Validación**: `npm run type-check`, `lint`, `test`, `validate-build`.
5. **Snippet de cada cambio leído del archivo** en el reporte final, no descripciones genéricas.

Si algún paso queda con ❌, **NO cerrar** — seguir trabajando.

## 7. Cuando aparezca un cross-cutting durante una sesión

Si encontrás algo roto FUERA del scope (ej. otro componente core con tokens mal, otro patrón inconsistente):

1. **Flaggear al humano**, no fixear silencioso.
2. Anotarlo en `_notes/cross-cutting-changes.md` con tipo (1/2/3/4) según `methodology.md` §7.quater.
3. Continuar con el scope original.
4. El humano decide si se atiende inline o como mini-sesión separada (M0X / SN.X).

## 8. Qué actualizar al cierre de cada módulo

Cuando un módulo (S6 Stores, S7 Orders, etc.) cierra Fase B y queda aprobado:

1. Si surgió un patrón nuevo replicable cross-módulo → agregarlo a este playbook.
2. Si se aprendió algo del proceso → agregarlo a `_notes/lessons-learned.md`.
3. Si se cerró un cambio cross-cutting → marcar status ✅ en `_notes/cross-cutting-changes.md`.
4. Si una decisión de UI se tomó que vale para futuros módulos → ADR + actualizar este playbook.

Esto NO es opcional. Sin esto, los siguientes módulos repiten errores.

## 9. Reglas adicionales aprendidas en S6 (consolidación post-módulo)

Reglas accionables descubiertas implementando Stores. Aplican a todos los módulos siguientes. Para contexto histórico de cada una ver `_notes/lessons-learned.md` L013-L058.

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
- **Select vs SearchSelect: criterio de cantidad** (L022). <7 opciones fijas → `<Select>`. Lista larga o dinámica → `<SearchSelect>`. Multi-select con tags inline → `<MultiTagAutocomplete>`. NO agregar búsqueda "por consistencia" si la lista no la justifica.

### 9.2 Tokens y theming — refuerzos

- **Surface vs surface-elevated en dark mode** (L013). Δ luminosity entre `--background` y `--surface` es 3% (invisible). `--surface-elevated` da 6% (perceptible). Para cards sobre canvas en dark mode, default a `--surface-elevated`. Calcular Δ antes de elegir.
- **Card con Input/Textarea: backgrounds distintos** (L014). Convención del proyecto: input siempre `--surface-elevated`; card que lo contiene debe ser `--surface` (Card variant `outlined`, no `elevated`).

### 9.3 CSS layout — patrones nuevos

- **Separadores entre filas: `border-top + first-of-type:border-top:0`** (L025). NO `border-bottom + last-child` porque se rompe en cuanto hay un elemento posterior heterogéneo (ej. CTA al final).
- **Alturas iguales entre controles: `min-h + items-center + line-height`** (L026). NUNCA `py` vertical. Si un control mide más que sus pares con mismo `size`, sospechar `py` redundante. Aplica a toolbars con Button + Select + Input mixtos.
- **Input + botón inline en fila: `align-items: stretch`** (L067). Cuando un `<input>` y un `<button>` conviven en la misma fila flex (ej. campo FX + botón "Hoy"), usar `align-items: stretch` en el contenedor y NO dar `sm` al botón si el input no es `sm`. Con `stretch` el botón adopta exactamente la altura del input sin necesidad de hardcodear alturas.
- **Grid con columna condicional + extremo derecho: usar `flex justify-between`** (L027). CSS Grid no "reserva" slots para hijos condicionales. Patrón seguro: flex con dos grupos hijos (izquierda + `shrink-0` derecha) con `justify-between`.
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

- **Antes de crear componente UI, `ls src/components/core/` y `modules/`** (L038). En este repo conviven varios componentes con propósitos similares (Select, SearchSelect, Combobox; Modal, Sheet, Drawer). Verificar inventario antes de crear.
- **N inconsistencias visuales: leer demo + mapear elementos ANTES de tocar** (L039). Cuando humano lista N gaps, primer paso NO es fixar la primera. Es leer todos los anchors relevantes del demo + listar en chat el mapping `elemento del demo → componente del repo + delta`. Recién después editar.
- **Refactors visuales de pantalla: wholesale del shell, NO parcial** (L040). Reescribir el shell visual completo usando los componentes nuevos del demo. Reusar building-blocks de lógica (forms, modals, queries) pero el chrome SE REESCRIBE. Nunca dejar `SectionSurfaceCard` legacy + componentes nuevos en la misma pantalla.
- **Demo HTML con mutation JS post-render: leer también los scripts** (L041). El demo aplica `buildTopbar()` y otros transformadores en `<script>` final (~línea 8824). Si los breadcrumbs vienen del shell, no duplicar back link en body de página.
- **Componentes core de S4/S5 que aparecen en demo: audit visual cada Fase B** (L042). Specs solo detallaban API, no visual final. Re-auditar cada componente core consumido contra el demo en cada Fase B donde aparece.
- **Inventario de componentes consumidos: describir USO del módulo, no replicar spec** (L043). Plantilla mental: `[ComponentName] ([spec link]) [tono/variante/tamaño] para [propósito específico del módulo]`. La estructura interna del componente NO aparece — eso vive en su spec.
- **Cierre de Fase A: recorrer FRD por features visibles en demo sin cobertura** (L044). Listar como `P-SX-NN` (Propuesta-SesiónX-NN) para decisión humana antes de Fase B. NO asumir que "está en el demo" = aprobación de implementación.
- **Cláusula spec vigente: enumerar mini-sesiones cross-cutting abiertas** (L045). Al escribir handoff, consultar `cross-cutting-changes.md` y listar componentes del inventario con mini-sesiones 🟡 + política (esperar cierre vs implementar y revisar después).
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
| Más recientes | `createdAt DESC`                            | ✓           |
| Más antiguas  | `createdAt ASC`                             |             |
| Tienda A–Z    | `store.name ASC`                            |             |
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

### 9.16 Mobile viewport simulation en demo HTML (S7-A.2)

Reglas para agregar nuevas pantallas mobile al demo HTML (`_notes/demo-screens.html`). Aplica solo al demo — Fase B implementa con responsive real (no simulation).

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

## Referencias

- `docs/redesign/methodology.md` — metodología completa del subproyecto.
- `docs/redesign/_notes/cross-cutting-changes.md` — backlog M01-M03, S5.1, S6.1-S6.3.
- `docs/redesign/_notes/lessons-learned.md` — diario de aprendizajes con origen y contexto.
- `docs/redesign/components/` — specs por componente.
- `docs/redesign/decisions/` — ADRs aceptados.
- `docs/redesign/tokens.md` — sistema de tokens vivo.
- `docs/redesign/_notes/demo-screens.html` — fuente de verdad visual.
- `.cursor/rules/modal-canonical-pattern.mdc` — refuerzo canónico del Modal.
- `.cursor/rules/design-system-playbook.mdc` — refuerzo de este playbook.
