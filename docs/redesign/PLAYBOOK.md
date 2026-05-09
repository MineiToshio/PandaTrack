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

| Variant             | Cuándo                                                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `primary`           | CTA principal de una pantalla / sección. Una sola variant primary por viewport. Background `--accent`.                                                      |
| `secondary`         | CTA secundaria con peso visual. Background `--surface-elevated` + border-strong.                                                                            |
| `ghost`             | CTA tertiary, "Limpiar", "Atrás" en wizards, links como botón. **Tiene border visible** (`--border-strong`) — es el patrón Atelier, no la convención común. |
| `destructive`       | Acción destructiva irreversible (Eliminar, Cancelar pedido). Background `--destructive`.                                                                    |
| `destructive-ghost` | Acción destructiva sutil (Reportar, Eliminar de listado). Border destructive sin fill.                                                                      |
| `outline`           | **Legacy.** No usar para nuevo código — usar `secondary` o `ghost` según el caso.                                                                           |
| `link`              | **Legacy.** Para inline hyperlinks usar `<a>` directo con `text-accent underline-offset-4 hover:underline`.                                                 |

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

### Modal (`src/components/modules/Modal/Modal.tsx`) — CANÓNICO ÚNICO

**Regla absoluta:** hay UN solo componente modal en la app. **Prohibido** crear dialog/overlay con `<Portal>` + `<div>` ad-hoc. **Prohibido** copiar el patrón visual de modals viejos del demo HTML.

API obligatoria: `tone` (`default | destructive | warning | info`), `size` (`md | lg`), `primaryAction`, `secondaryAction`, opcional `tertiaryAction`, `icon` (Lucide en icon-circle tonal de 48px).

Reforzado por cursor rule `.cursor/rules/modal-canonical-pattern.mdc`. Detalle en `docs/redesign/components/Modal.md` y ADR 0008.

### Sheet (`src/components/modules/Sheet`)

Counterpart mobile del Modal. Mismo Semantic Depth language. Para bottom-sheets en mobile.

### FilterDrawer (`src/components/modules/FilterDrawer/FilterDrawer.tsx`)

Section types soportados: `pills | pills-search | icon-pills | autocomplete | tag-autocomplete | date-range | switches`.

- `tag-autocomplete` para listas largas tipo país (input + dropdown + tags inline + leading icon search + flag emoji).
- `pills` para listas cortas tipo presencia (chip-buttons con íconos).
- `switches` para toggles boolean simples.

**Comportamiento:** NO cierra on click outside. Solo X y Esc.

**Visual del header:** ícono Lucide en `--accent` (no `--accent-cool`). Border-radius 0 desktop / top corners mobile. Border `--border-strong` panel side / `--border` header+footer.

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
