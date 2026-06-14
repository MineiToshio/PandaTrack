---
title: Catálogo de componentes core
last_updated: 2026-05-12
status: final S4
session: 04-components
owner: Sergio Minei
---

# Catálogo de componentes core — PandaTrack rediseño

> Este documento es el **mapa overview** de los 47 componentes specceados en Sesión 4. Para detalle de cada uno, ver el archivo correspondiente en [`./components/`](./components). Las plantillas obligatorias (API, estados, accesibilidad, motion, copy, edge cases, anti-patrones, ADRs aplicables) viven dentro de cada `<Name>.md`.
>
> **Estado del catálogo:** spec — no implementado. La aplicación al repo (`src/components/`) es trabajo de S12 — Handoff a implementación.
>
> **Reglas duras heredadas:** todos los componentes consumen tokens semánticos del sistema [`./tokens.md`](./tokens.md), respetan light + dark como hermanos, cumplen WCAG 2.2 AA, aplican voice glossary [`./principles.md`](./principles.md) §7, usan Lucide Icons únicamente para UI (Brand icons via Simple Icons no aplican en S4), y no introducen literales raw (hex, px, ms, sombras).

## Mapa por tier

### Tier 1 — Atoms (consumen solo tokens)

#### Form

- [`components/Input.md`](./components/Input.md) — text/number/email/password/search/tel/url. Sizes sm/md/lg. Validación post-blur.
- [`components/Textarea.md`](./components/Textarea.md) — autosize opcional, character counter. Usado por nota privada con autosave throttle 1.5s (orquestado por `<Form>`).
- [`components/Select.md`](./components/Select.md) — primitiva con popover, casos simples 1-15 options.
- [`components/Combobox.md`](./components/Combobox.md) — searchable, mode `single | multi` discriminated union, soporta avatar + nombre + meta (caso `<StoreSelect>`), inline action "Crear nueva tienda".
- [`components/DateInput.md`](./components/DateInput.md) — input + Popover calendar, locale-aware, formato display "DD MMM YYYY".
- [`components/DateRangeInput.md`](./components/DateRangeInput.md) — dos `<DateInput>` coordinados.
- [`components/Checkbox.md`](./components/Checkbox.md) — soporta `indeterminate` (caso select-all en delivery-create).
- [`components/Radio.md`](./components/Radio.md) — group navegable con flechas.
- [`components/Switch.md`](./components/Switch.md) — toggle con animación thumb.
- [`components/Label.md`](./components/Label.md) — primitiva form. Required (asterisco `--accent`) / optional ("(opcional)").
- [`components/HelperText.md`](./components/HelperText.md) — mensaje neutro debajo del control.
- [`components/ErrorMessage.md`](./components/ErrorMessage.md) — `role="alert"` + ícono `alert-circle` 14×14. Reemplaza Helper en error.
- [`components/Kbd.md`](./components/Kbd.md) — etiqueta de atajo.
- [`components/Eyebrow.md`](./components/Eyebrow.md) — uppercase mono `--text-muted` `--text-eyebrow`.
- [`components/MonoCode.md`](./components/MonoCode.md) — code mono identificador, default `--text-secondary` (ADR 0007).
- `StarRating` — 5 estrellas display, value 0-5 con redondeo a entero, `--accent-warm` filled / 14% mix `--text-primary` empty. Atomic (M04, sin spec individual).

#### Acción

- [`components/Button.md`](./components/Button.md) — variants `primary | secondary | ghost | destructive | destructive-ghost`, sizes sm/md/lg, loading con ancho preservado, `as: 'button' | 'a'` discriminated union. Auditoría legacy `text-white` flaggeada.
- [`components/IconButton.md`](./components/IconButton.md) — icon-only con `label` obligatorio (TypeScript rechaza sin él). `shape: 'pill' | 'square'`.
- [`components/FilterTriggerButton.md`](./components/FilterTriggerButton.md) — trigger canónico del `FilterDrawer` cross-app. Estado active (fondo tinted accent + badge count) cuando `appliedCount ≥ 1`. Variants `label` (toolbar) e `icon-only` (topbar mobile). Regla: count = chips visibles, búsqueda excluida. (M05)
- `Pill` — atomic toggle pill estilo `.filter-pill` del demo HTML. Idle/selected via prop `selected`. Caller controla semántica (role/aria-checked) via spread props. Consumido por FilterDrawer y futuros filtros cross-app (M04, sin spec individual).
- [`components/Skeleton.md`](./components/Skeleton.md) — átomo canónico de carga (ADR 0013). Variants `text | circle | rect | pill`, shimmer `.skeleton`, reduced-motion estático. Atom `aria-hidden`; el contenedor posee `aria-busy` + label.

### Tier 2 — Molecules (composición de atoms + tokens)

- [`components/StoreAvatar.md`](./components/StoreAvatar.md) — sizes 24/32/40/56, una sola letra (ADR 0001 D16). Logo cuadrado/rectangular/alpha con recetas distintas.
- [`components/StatusChip.md`](./components/StatusChip.md) — discriminated union `kind` con mapping enum→variant+Lucide+copy (ADR 0002). `kind="info"` requiere `icon` + `label` por TypeScript (ADR 0006).
- [`components/MicroStatCard.md`](./components/MicroStatCard.md) — patrón canónico icon-tile + cifra `--text-primary` (ADR 0005). Prop **obligatoria** `accentToken` discriminated union restringida a `--accent | --accent-warm | --warning | --success`.
- [`components/PrefilledField.md`](./components/PrefilledField.md) — field-as-attribute con eyebrow `↳ DESDE PT-XXXXXX` (ADR 0001 D2).
- [`components/SectionCard.md`](./components/SectionCard.md) — base wizard/form. Estados `default | active | gated`. Gated sin opacity (ADR 0001 D3).
- [`components/Card.md`](./components/Card.md) — primitiva ligera. Variants `plain | elevated | outlined`. Interactive con state-layer.
- [`components/EmptyState.md`](./components/EmptyState.md) — variants `general | filtered | error`. Mascota sleeping solo en variant general (decálogo §6).
- [`components/Avatar.md`](./components/Avatar.md) — usuario (no tienda). Sizes 24/32/40/56. Pill siempre.
- [`components/Tabs.md`](./components/Tabs.md) — orientación horizontal (mobile) o vertical (desktop settings — ADR 0001 D15).
- [`components/Stepper.md`](./components/Stepper.md) — bolitas numeradas. States `todo | active | done`. Refleja `<WizardAccordion>`.
- `AlertBanner` — tonal banner con tone `info | warning | destructive | success` + icon + title + body + action slot. Color-mix tinted bg/border 9%/22% transparent. Reemplaza alerts inline page-level (M04, sin spec individual).
- `CollapsibleSection` — card colapsable con eyebrow + count opcional + chevron toggle. Animation `grid-template-rows 1fr→0fr`. Heredera de `<StoreSubcard>` original (M04, sin spec individual).
- `ChannelRow` — icon-tile + label + value + trailing slot. Patrón `.channel-row` del demo. Border-bottom auto-collapse en first/last (M04, sin spec individual).
- `SummaryStatRow` — label muted + value bold tabular-nums. Dashed border-bottom entre rows. Para sidebars Resumen y mini-cards (M04, sin spec individual).
- [`components/SectionError.md`](./components/SectionError.md) — error de sección con retry (ADR 0013). Vocabulario §9.17 Chip-Eyebrow + Top-Accent, tone `destructive | warning`, retry default `router.refresh()`. No captura a Sentry.

### Tier 3 — Organisms (composición compleja)

#### Wizard + Filter + Detail

- [`components/WizardAccordion.md`](./components/WizardAccordion.md) — orquestador. Solo un paso expandido. Auto-scroll suave. (ADR 0003 D5 + ADR 0001 D12 OC3).
- [`components/WizardStep.md`](./components/WizardStep.md) — paso individual con eyebrow + title + summary + body + footer (primary/secondary actions).
- [`components/FilterDrawer.md`](./components/FilterDrawer.md) — bottom sheet mobile / drawer derecho 440px desktop. Config declarativa con `FilterSection` discriminated union (`pills | pills-search | icon-pills | date-range | switches`). Footer "Limpiar / Aplicar (N)".
- [`components/DetailSidebar.md`](./components/DetailSidebar.md) — slots fijos `Resumen | Acciones | NotaPrivada` (ADR 0003 D7). Mobile stackea debajo del cuerpo.

#### Surface primitives

- [`components/Toast.md`](./components/Toast.md) — variants `success | warning | error | info | achievement | neutral-undo`. Variant `neutral-undo` con CTA Deshacer + atajo `Z` + countdown 5s/8s (ADR 0001 D4).
- [`components/Sheet.md`](./components/Sheet.md) — bottom sheet mobile primitiva. Drag handle. `--sheet-max-h` (92svh).
- [`components/MobilePicker.md`](./components/MobilePicker.md) — versión mobile-only de `<Combobox>` searchable. Renderiza lista de opciones (con icono `--accent-cool` idle, `--accent` selected) dentro de un `<Sheet>`. Soporta `searchable`, `inlineAction` (ADR 0001 D12), `hint`. Tokens visuales canonizados S7-A.9. Caso canónico: pickers de Tienda/Moneda/Tipo de producto del wizard `order-create`.
- [`components/Modal.md`](./components/Modal.md) — center modal desktop, degrada a Sheet mobile. Caso modal de discrepancia 12.a (3 CTAs sin destructive).
- [`components/Drawer.md`](./components/Drawer.md) — primitiva panel lateral. Widths narrow/default/wide. Mobile fallback es responsabilidad del consumer.
- [`components/Popover.md`](./components/Popover.md) — base de DateInput, autocomplete results, Tooltip (composible).
- [`components/Tooltip.md`](./components/Tooltip.md) — etiqueta auxiliar. Inversión `--text-primary`/`--background`. Refuerza label, no lo reemplaza (ADR 0006).
- [`components/DropdownMenu.md`](./components/DropdownMenu.md) — primitiva genérica con `MenuItem` discriminated union (`item | separator | heading | submenu`).
- [`components/OverflowMenu.md`](./components/OverflowMenu.md) — variant especializada para overflow `[···]` del header de detalle (ADR 0001 D6). Trigger fijo IconButton `more-vertical` desktop / `more-horizontal` mobile.
- [`components/CommandPalette.md`](./components/CommandPalette.md) — `⌘K` aspiracional. Specced en S4, mounting opt-in S6+.

#### Shell pieces

- [`components/MascotBubble.md`](./components/MascotBubble.md) — variants `idle | sleeping | celebrating | walking`. Posiciones canónicas vinculantes (`directions.md` §4.10). Toggle desde Preferences + menú contextual (ADR 0001 D17).
- [`components/ThemeToggle.md`](./components/ThemeToggle.md) — solo `light` / `dark` (ADR 0003 D2). Variants compact (header) / full (settings).
- [`components/LangToggle.md`](./components/LangToggle.md) — ES/EN. Path-based locale routing via next-intl.
- [`components/Breadcrumbs.md`](./components/Breadcrumbs.md) — content header de cada pantalla bajo `(app)` (ADR 0003 D4). Mobile collapse con ellipsis expandible.

### Tier 4 — Form orchestration

- [`components/Form.md`](./components/Form.md) — wrapper con Zod + validación post-blur + server-error mapping + optimistic UI (`optimistic-client-updates.mdc`) + autosave local "Guardado en este navegador, hace Ns" (ADR 0001 D12 OC4).
- [`components/FormFooter.md`](./components/FormFooter.md) — sticky bottom con primary + secondary + helperText (autosave timestamp).
- [`components/FieldGroup.md`](./components/FieldGroup.md) — agrupador label + control + helper/error con auto-wiring ARIA.

## Cobertura por wireframe S2

Cada componente invocado en `screens/*.md` debe existir en este catálogo o estar diferido explícitamente con sesión destino.

### `screens/dashboard.md`

| Componente invocado    | Status                                      |
| ---------------------- | ------------------------------------------- |
| StoreAvatar            | ✅ specced                                  |
| MicroStatCard (×4)     | ✅ specced (ADR 0005)                       |
| StatusChip             | ✅ specced                                  |
| Card                   | ✅ specced                                  |
| Button                 | ✅ specced                                  |
| IconButton             | ✅ specced                                  |
| MonoCode               | ✅ specced                                  |
| Eyebrow                | ✅ specced                                  |
| MascotBubble           | ✅ specced                                  |
| Breadcrumbs            | ✅ specced                                  |
| Tooltip                | ✅ specced                                  |
| ProgressBar (% pagado) | ⏳ diferido S5/S6 (ver `_notes/s4-gaps.md`) |
| FAB primario           | ⏳ diferido S5 (parte del shell)            |
| Tab bar inferior       | ⏳ diferido S5 (parte del shell)            |
| VerifyEmailBanner      | ⏳ diferido S5 (parte del shell)            |

### `screens/orders-list.md`

| Componente invocado            | Status                            |
| ------------------------------ | --------------------------------- |
| StoreAvatar                    | ✅ specced                        |
| StatusChip                     | ✅ specced                        |
| MonoCode                       | ✅ specced                        |
| Input (search)                 | ✅ specced                        |
| IconButton                     | ✅ specced                        |
| FilterDrawer                   | ✅ specced                        |
| Sheet (mobile filter sheet)    | ✅ specced                        |
| Button                         | ✅ specced                        |
| DropdownMenu (sort)            | ✅ specced                        |
| Combobox (filter tienda)       | ✅ specced                        |
| Checkbox (filter status multi) | ✅ specced                        |
| DateRangeInput                 | ✅ specced                        |
| Switch (peek panel toggle)     | ✅ specced                        |
| Eyebrow                        | ✅ specced                        |
| Card (peek panel)              | ✅ specced                        |
| Toast (post-swipe undo)        | ✅ specced                        |
| EmptyState                     | ✅ specced                        |
| Breadcrumbs                    | ✅ specced                        |
| ProgressBar (% pagado en row)  | ⏳ diferido S5/S6                 |
| Pagination numerada (desktop)  | ⏳ diferido S5                    |
| Swipe action background        | ⏳ diferido S6 (microinteracción) |

### `screens/order-detail.md`

| Componente invocado           | Status            |
| ----------------------------- | ----------------- |
| StoreAvatar                   | ✅ specced        |
| StatusChip                    | ✅ specced        |
| MonoCode                      | ✅ specced        |
| Eyebrow                       | ✅ specced        |
| Button                        | ✅ specced        |
| IconButton                    | ✅ specced        |
| OverflowMenu                  | ✅ specced        |
| DetailSidebar                 | ✅ specced        |
| Textarea (nota privada)       | ✅ specced        |
| Card (sub-cards items, pagos) | ✅ specced        |
| SectionCard                   | ✅ specced        |
| Toast (undo)                  | ✅ specced        |
| Modal (delete confirm)        | ✅ specced        |
| Tabs (mobile sub-secciones)   | ✅ specced        |
| Breadcrumbs                   | ✅ specced        |
| ProgressBar (% pagado)        | ⏳ diferido S5/S6 |

### `screens/order-create.md`

| Componente invocado  | Status     |
| -------------------- | ---------- |
| WizardAccordion      | ✅ specced |
| WizardStep           | ✅ specced |
| Stepper              | ✅ specced |
| Form                 | ✅ specced |
| FormFooter           | ✅ specced |
| FieldGroup           | ✅ specced |
| Input                | ✅ specced |
| Combobox             | ✅ specced |
| DateInput            | ✅ specced |
| DateRangeInput       | ✅ specced |
| Button               | ✅ specced |
| IconButton           | ✅ specced |
| StoreAvatar          | ✅ specced |
| Modal (discrepancia) | ✅ specced |
| Sheet (mobile)       | ✅ specced |
| MobilePicker         | ✅ specced |
| Toast                | ✅ specced |
| ErrorMessage         | ✅ specced |
| HelperText           | ✅ specced |
| Label                | ✅ specced |
| Eyebrow              | ✅ specced |
| Card / SectionCard   | ✅ specced |
| Breadcrumbs          | ✅ specced |
| MonoCode             | ✅ specced |

### `screens/delivery-create.md`

| Componente invocado                            | Status                         |
| ---------------------------------------------- | ------------------------------ |
| WizardAccordion + Step                         | ✅ specced                     |
| Stepper                                        | ✅ specced                     |
| Form                                           | ✅ specced                     |
| Combobox                                       | ✅ specced                     |
| StoreAvatar                                    | ✅ specced                     |
| PrefilledField                                 | ✅ specced (ADR 0001 D2 + D13) |
| Checkbox                                       | ✅ specced                     |
| StatusChip                                     | ✅ specced                     |
| Sheet                                          | ✅ specced                     |
| IconButton                                     | ✅ specced                     |
| Button                                         | ✅ specced                     |
| Toast                                          | ✅ specced                     |
| ErrorMessage / HelperText / Label / FieldGroup | ✅ specced                     |
| Eyebrow                                        | ✅ specced                     |
| MonoCode                                       | ✅ specced                     |
| Card / SectionCard                             | ✅ specced                     |
| Breadcrumbs                                    | ✅ specced                     |

### `screens/settings.md`

| Componente invocado                     | Status                    |
| --------------------------------------- | ------------------------- |
| Tabs (vertical desktop)                 | ✅ specced (ADR 0001 D15) |
| Form                                    | ✅ specced                |
| FieldGroup                              | ✅ specced                |
| Input                                   | ✅ specced                |
| Switch                                  | ✅ specced                |
| Button                                  | ✅ specced                |
| ThemeToggle                             | ✅ specced                |
| LangToggle                              | ✅ specced                |
| Avatar (user)                           | ✅ specced                |
| StoreAvatar (mostrar tiendas asociadas) | ✅ specced                |
| Eyebrow                                 | ✅ specced                |
| HelperText                              | ✅ specced                |
| ErrorMessage                            | ✅ specced                |
| Card / SectionCard                      | ✅ specced                |
| Modal (confirm flows)                   | ✅ specced                |
| DropdownMenu (account menu)             | ✅ specced                |
| Breadcrumbs                             | ✅ specced                |
| StatusChip (cooldown username warning)  | ✅ specced                |

**Resumen cobertura wireframes:** 6/6 wireframes cubiertos. Cero componentes invocados sin spec. Componentes adicionales que aparecen en wireframes pero NO están specceados en S4 (ProgressBar, Pagination, FAB, Tab bar inferior, VerifyEmailBanner, swipe action background) están diferidos a sesiones específicas — ver [`./_notes/s4-gaps.md`](./_notes/s4-gaps.md).

## Cobertura por ADR

Cada ADR aceptado debe estar implementado por al menos un componente o diferido a otra sesión con justificación.

| ADR + decisión                                                     | Componente que lo implementa                                                                                                                                        | Status                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **ADR 0001** D2 (field-as-attribute)                               | `<PrefilledField>`                                                                                                                                                  | ✅                                                                         |
| **ADR 0001** D3 (gated sin opacity)                                | `<SectionCard>` (gated state) + todos los disabled handlers cross-componente (Button, IconButton, Tabs, Stepper, MenuItem, etc.)                                    | ✅                                                                         |
| **ADR 0001** D4 (toast neutral-undo 5s/8s + Z)                     | `<Toast variant="neutral-undo">`                                                                                                                                    | ✅                                                                         |
| **ADR 0001** D5 (vt-name `order-{humanId}`)                        | Convención del shell (S5) + `<MonoCode>` consume el contrato. La aplicación de `view-transition-name` la hace S5 al definir el list→detail.                         | 🟡 parcial — convención documentada, aplicación es S5                      |
| **ADR 0001** D6 (lifecycle por reversibilidad)                     | `<DetailSidebar>` (acciones reversibles slot) + `<OverflowMenu>` (irreversibles destructive)                                                                        | ✅                                                                         |
| **ADR 0001** D7 (Crear entrega doble entry-point)                  | El `<DetailSidebar>` aloja el CTA primary; el link "↳ Crear entrega con estos productos" del footer de Items lo cubrirá la pantalla de detalle al integrarse en S6. | 🟡 parcial — slot expuesto, el segundo entry-point es decisión de pantalla |
| **ADR 0001** D8 (4 micro-stats)                                    | `<MicroStatCard>` con `accentToken` discriminated union                                                                                                             | ✅                                                                         |
| **ADR 0001** D9 (paginación mobile "Cargar más" / desktop clásica) | Mobile: `<Button variant="ghost">` con onClick load-more (no componente nuevo). Desktop: pager numerado diferido a S5.                                              | 🟡 parcial — diferido S5                                                   |
| **ADR 0001** D10 (swipe izquierda con `--accent`)                  | Swipe gesture es microinteracción de pantalla, no componente. Diferido a S11 (motion).                                                                              | ⏳ diferido S11                                                            |
| **ADR 0001** D11 (densidad reflejada en preferences)               | Switch + persistencia es responsabilidad de `<Form>` settings + lib `localStorage`. Diferido S6 cuando se implemente settings.                                      | ⏳ diferido S6                                                             |
| **ADR 0001** D12 OC2 (items.min(1))                                | `<Form>` schema Zod                                                                                                                                                 | ✅                                                                         |
| **ADR 0001** D12 OC3 (step navegable)                              | `<WizardAccordion>` + `<Stepper>` (`onStepClick` libre)                                                                                                             | ✅                                                                         |
| **ADR 0001** D12 OC4 (autosave local)                              | `<Form>` `autosave` prop + copy "Guardado en este navegador, hace Ns"                                                                                               | ✅                                                                         |
| **ADR 0001** D13 (delivery prefill paso 2)                         | `<WizardAccordion startStep={2}>` + `<PrefilledField>`                                                                                                              | ✅                                                                         |
| **ADR 0001** D14 (theme dual)                                      | `<ThemeToggle>` (compact header + full settings) — supersedida a `light/dark` por ADR 0003 D2                                                                       | ✅                                                                         |
| **ADR 0001** D15 (settings tabs verticales)                        | `<Tabs orientation="vertical">`                                                                                                                                     | ✅                                                                         |
| **ADR 0001** D16 (StoreAvatar spec)                                | `<StoreAvatar>` sizes 24/32/40/56                                                                                                                                   | ✅                                                                         |
| **ADR 0001** D17 (mascota toggle + menú contextual)                | `<MascotBubble>` + `<DropdownMenu>` (en composición vía long-press / right-click handler)                                                                           | ✅                                                                         |
| **ADR 0001** D18 (cooldown username)                               | `<StatusChip kind="warning">` + `<HelperText>` en settings. UI específica diferida a S6.                                                                            | 🟡 parcial — chip + helper specced, integración S6                         |
| **ADR 0001** D19 (cerrar sesión todos)                             | `<Button variant="destructive-ghost">` en settings → Account. Implementación condicional capability diferida S6.                                                    | 🟡 parcial — primitiva specced                                             |
| **ADR 0002** (status chip mapping)                                 | `<StatusChip>` con discriminated union por `kind`                                                                                                                   | ✅                                                                         |
| **ADR 0003** D1 (Velvet)                                           | Token-only, sin componente — toda la S4 consume Velvet                                                                                                              | ✅                                                                         |
| **ADR 0003** D2 (theme solo light/dark)                            | `<ThemeToggle>`                                                                                                                                                     | ✅                                                                         |
| **ADR 0003** D3 (sidebar push)                                     | Sidebar shell — diferido S5                                                                                                                                         | ⏳ diferido S5                                                             |
| **ADR 0003** D4 (header con breadcrumbs + lang + theme)            | `<Breadcrumbs>` + `<LangToggle>` + `<ThemeToggle>` (composición la hace S5)                                                                                         | ✅                                                                         |
| **ADR 0003** D5 (WizardAccordion)                                  | `<WizardAccordion>` + `<WizardStep>` + `<Stepper>`                                                                                                                  | ✅                                                                         |
| **ADR 0003** D6 (nota privada NO es paso)                          | `<DetailSidebar>` aloja la nota; `<WizardAccordion>` no la incluye                                                                                                  | ✅                                                                         |
| **ADR 0003** D7 (DetailSidebar slots)                              | `<DetailSidebar>` slots Resumen/Acciones/NotaPrivada                                                                                                                | ✅                                                                         |
| **ADR 0003** D8 (FilterDrawer)                                     | `<FilterDrawer>` + `<Sheet>` mobile + `<Drawer>` desktop                                                                                                            | ✅                                                                         |
| **ADR 0004** (paleta categórica eliminada)                         | Aplicada cross-componente: identidad de categoría = ícono Lucide en `--accent-cool`. Cero `--cat-*` en specs.                                                       | ✅                                                                         |
| **ADR 0005** (MicroStatCard icon-tile)                             | `<MicroStatCard>` `accentToken` discriminated union                                                                                                                 | ✅                                                                         |
| **ADR 0006** (icon+label contract)                                 | `<StatusChip kind="info">` (TS rechaza sin icon+label) + `<IconButton>` (label obligatorio) + `<Tooltip>` (refuerzo) + `<MicroStatCard>` (glyph + eyebrow label)    | ✅                                                                         |
| **ADR 0007** (code mono en `--text-secondary`)                     | `<MonoCode>` default `--text-secondary`; consumido por `<Breadcrumbs>` y rows de pedido en S6                                                                       | ✅                                                                         |

**Resumen cobertura ADR:** 7/7 ADRs cubiertos por al menos un componente. Decisiones puntuales diferidas (D5 vt-name application, D7 second entry-point, D9 pager, D10 swipe, D11 density, D18/D19 capabilities) están explicitadas con sesión destino. Cero ADRs sin cobertura.

## Matriz tokens × componentes (grupos)

> Marca cada celda como ✅ cuando el componente consume al menos un token del grupo. La matriz completa (token-by-token) vive dentro de la sección "Tokens consumidos" de cada `<Name>.md`.

| Componente      | Surface | Texto | Acentos | Status | Border | Focus | State layers | Typography | Spacing | Layout | Radius | Elevation | Motion | Z-index |
| --------------- | :-----: | :---: | :-----: | :----: | :----: | :---: | :----------: | :--------: | :-----: | :----: | :----: | :-------: | :----: | :-----: |
| **Tier 1**      |         |       |         |        |        |       |              |            |         |        |        |           |        |         |
| Input           |   ✅    |  ✅   |   ✅    |   ✅   |   ✅   |  ✅   |      ✅      |     ✅     |   ✅    |        |   ✅   |           |   ✅   |         |
| Textarea        |   ✅    |  ✅   |   ✅    |   ✅   |   ✅   |  ✅   |      ✅      |     ✅     |   ✅    |        |   ✅   |           |   ✅   |         |
| Select          |   ✅    |  ✅   |   ✅    |        |   ✅   |  ✅   |      ✅      |     ✅     |   ✅    |        |   ✅   |    ✅     |   ✅   |   ✅    |
| Combobox        |   ✅    |  ✅   |   ✅    |        |   ✅   |  ✅   |      ✅      |     ✅     |   ✅    |        |   ✅   |    ✅     |   ✅   |   ✅    |
| DateInput       |   ✅    |  ✅   |   ✅    |        |   ✅   |  ✅   |      ✅      |     ✅     |   ✅    |        |   ✅   |    ✅     |   ✅   |   ✅    |
| DateRangeInput  |   ✅    |  ✅   |   ✅    |        |   ✅   |  ✅   |      ✅      |     ✅     |   ✅    |        |   ✅   |           |   ✅   |         |
| Checkbox        |   ✅    |  ✅   |   ✅    |   ✅   |   ✅   |  ✅   |              |     ✅     |   ✅    |        |   ✅   |           |   ✅   |         |
| Radio           |   ✅    |  ✅   |   ✅    |        |   ✅   |  ✅   |              |     ✅     |   ✅    |        |   ✅   |           |   ✅   |         |
| Switch          |         |  ✅   |   ✅    |        |        |  ✅   |              |            |   ✅    |        |   ✅   |           |   ✅   |         |
| Label           |         |  ✅   |   ✅    |        |        |       |              |     ✅     |   ✅    |        |        |           |        |         |
| HelperText      |         |  ✅   |         |        |        |       |              |     ✅     |   ✅    |        |        |           |        |         |
| ErrorMessage    |         |  ✅   |         |   ✅   |        |       |              |     ✅     |   ✅    |        |        |           |        |         |
| Kbd             |         |  ✅   |         |        |   ✅   |       |              |     ✅     |   ✅    |        |   ✅   |           |        |         |
| Eyebrow         |         |  ✅   |         |        |        |       |              |     ✅     |         |        |        |           |        |         |
| MonoCode        |         |  ✅   |         |        |        |       |              |     ✅     |         |        |        |           |        |         |
| Button          |         |  ✅   |   ✅    |   ✅   |   ✅   |  ✅   |      ✅      |     ✅     |   ✅    |        |   ✅   |    ✅     |   ✅   |         |
| IconButton      |         |  ✅   |   ✅    |   ✅   |   ✅   |  ✅   |      ✅      |            |   ✅    |        |   ✅   |           |   ✅   |         |
| **Tier 2**      |         |       |         |        |        |       |              |            |         |        |        |           |        |         |
| StoreAvatar     |   ✅    |  ✅   |   ✅    |        |   ✅   |       |              |     ✅     |   ✅    |        |   ✅   |           |        |         |
| StatusChip      |   ✅    |  ✅   |   ✅    |   ✅   |   ✅   |       |              |     ✅     |   ✅    |        |   ✅   |           |        |         |
| MicroStatCard   |   ✅    |  ✅   |   ✅    |   ✅   |   ✅   |       |              |     ✅     |   ✅    |        |   ✅   |    ✅     |        |         |
| PrefilledField  |   ✅    |  ✅   |         |        |   ✅   |  ✅   |      ✅      |     ✅     |   ✅    |        |   ✅   |           |   ✅   |         |
| SectionCard     |   ✅    |  ✅   |   ✅    |        |   ✅   |       |              |     ✅     |   ✅    |        |   ✅   |    ✅     |        |         |
| Card            |   ✅    |  ✅   |         |        |   ✅   |  ✅   |      ✅      |            |   ✅    |        |   ✅   |    ✅     |   ✅   |         |
| EmptyState      |   ✅    |  ✅   |   ✅    |   ✅   |   ✅   |       |              |     ✅     |   ✅    |        |   ✅   |           |        |         |
| Avatar          |   ✅    |  ✅   |         |   ✅   |   ✅   |       |              |     ✅     |   ✅    |        |   ✅   |           |   ✅   |         |
| Tabs            |         |  ✅   |   ✅    |        |   ✅   |  ✅   |      ✅      |     ✅     |   ✅    |        |   ✅   |           |   ✅   |         |
| Stepper         |   ✅    |  ✅   |   ✅    |   ✅   |   ✅   |  ✅   |      ✅      |     ✅     |   ✅    |        |   ✅   |           |   ✅   |         |
| **Tier 3**      |         |       |         |        |        |       |              |            |         |        |        |           |        |         |
| WizardAccordion |   ✅    |  ✅   |   ✅    |   ✅   |   ✅   |       |      ✅      |     ✅     |   ✅    |        |   ✅   |    ✅     |   ✅   |         |
| WizardStep      |   ✅    |  ✅   |   ✅    |   ✅   |   ✅   |       |              |     ✅     |   ✅    |        |   ✅   |    ✅     |   ✅   |         |
| FilterDrawer    |   ✅    |  ✅   |   ✅    |        |   ✅   |       |      ✅      |     ✅     |   ✅    |   ✅   |   ✅   |    ✅     |   ✅   |   ✅    |
| DetailSidebar   |   ✅    |  ✅   |   ✅    |   ✅   |   ✅   |       |      ✅      |     ✅     |   ✅    |   ✅   |   ✅   |    ✅     |        |         |
| Toast           |   ✅    |  ✅   |   ✅    |   ✅   |   ✅   |  ✅   |              |     ✅     |   ✅    |   ✅   |   ✅   |    ✅     |   ✅   |   ✅    |
| Sheet           |   ✅    |  ✅   |         |        |   ✅   |       |              |            |   ✅    |   ✅   |   ✅   |    ✅     |   ✅   |   ✅    |
| Modal           |   ✅    |  ✅   |         |        |   ✅   |       |              |     ✅     |   ✅    |   ✅   |   ✅   |    ✅     |   ✅   |   ✅    |
| Drawer          |   ✅    |  ✅   |         |        |   ✅   |       |              |            |   ✅    |   ✅   |   ✅   |    ✅     |   ✅   |   ✅    |
| Popover         |   ✅    |  ✅   |         |        |   ✅   |       |              |            |   ✅    |        |   ✅   |    ✅     |   ✅   |   ✅    |
| Tooltip         |   ✅    |  ✅   |         |        |        |       |              |     ✅     |   ✅    |        |   ✅   |    ✅     |   ✅   |   ✅    |
| DropdownMenu    |   ✅    |  ✅   |         |   ✅   |   ✅   |       |      ✅      |     ✅     |   ✅    |        |   ✅   |    ✅     |   ✅   |   ✅    |
| OverflowMenu    |   ✅    |  ✅   |         |   ✅   |   ✅   |       |      ✅      |     ✅     |   ✅    |        |   ✅   |    ✅     |   ✅   |   ✅    |
| CommandPalette  |   ✅    |  ✅   |   ✅    |        |   ✅   |       |      ✅      |     ✅     |   ✅    |   ✅   |   ✅   |    ✅     |   ✅   |   ✅    |
| MascotBubble    |   ✅    |  ✅   |   ✅    |        |   ✅   |       |              |            |   ✅    |        |   ✅   |    ✅     |   ✅   |   ✅    |
| ThemeToggle     |         |  ✅   |         |        |        |  ✅   |      ✅      |            |   ✅    |        |   ✅   |           |   ✅   |         |
| LangToggle      |         |  ✅   |         |        |   ✅   |  ✅   |      ✅      |     ✅     |   ✅    |        |   ✅   |           |   ✅   |         |
| Breadcrumbs     |         |  ✅   |         |        |        |  ✅   |      ✅      |     ✅     |   ✅    |        |   ✅   |           |   ✅   |         |
| **Tier 4**      |         |       |         |        |        |       |              |            |         |        |        |           |        |         |
| Form            |   ✅    |  ✅   |   ✅    |   ✅   |   ✅   |       |              |     ✅     |   ✅    |        |   ✅   |           |        |         |
| FormFooter      |   ✅    |  ✅   |         |        |   ✅   |       |              |     ✅     |   ✅    |        |        |           |        |   ✅    |
| FieldGroup      |         |  ✅   |         |   ✅   |        |       |              |     ✅     |   ✅    |        |        |           |        |         |

**Resumen cobertura tokens:** todos los grupos del sistema [`./tokens.md`](./tokens.md) tienen al menos un consumidor en S4. Surface (47), Texto (47), Spacing (47), Radius (43), Acentos (32), Status (20), Focus ring (19), State layers (18), Motion (32), Border (40), Elevation (24), Z-index (16), Layout magic numbers (8), Typography (40).

## Componentes diferidos a otras sesiones

| Componente / patrón                                | Sesión destino | Justificación                                                                                     |
| -------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------- |
| **Sidebar** (logo / nav / user)                    | S5             | App shell; ADR 0003 D3 con collapse + push.                                                       |
| **Header** (sticky con breadcrumbs)                | S5             | Composición de `<Breadcrumbs>` + `<LangToggle>` + `<ThemeToggle>` (componentes ya specceados).    |
| **FAB primario**                                   | S5             | Parte del shell; es Button variant `primary` con tamaño `--fab-size` (token ya existe).           |
| **VerifyEmailBanner**                              | S5             | Sticky banner del shell para email no verificado.                                                 |
| **ProgressBar (% pagado)**                         | S5             | Aparece en dashboard hero, orders rows, order detail. Componente independiente — anotado en gaps. |
| **Pagination numerada (desktop)**                  | S5             | ADR 0001 D9. Componente independiente.                                                            |
| **Skeleton**                                       | S9             | Loading states de pantallas. Patrón emergente en specs (Avatar, Breadcrumbs).                     |
| **Spinner**                                        | S5/S6          | Implícito en `<Button loading>` via Lucide `loader-2`. No requiere archivo propio MVP.            |
| **Inline alert (form-level error)**                | S6/S7          | Cubierto en composición por `<Form>` (formError) y SectionCard. No requiere primitiva nueva.      |
| **Toggle de densidad densa/cómoda** (ADR 0001 D11) | S6             | Es un Switch o segmented control en settings → Preferences. Diferido a settings hi-fi.            |
| **Swipe action background** (orders list)          | S11            | Microinteracción de pantalla, no primitiva.                                                       |
| **CommandPalette mounting**                        | S6+            | Specced en S4, mount real opt-in S6+ (ver `<CommandPalette>` notas S12).                          |

## Cómo leer este catálogo

1. Para un cambio que afecta un componente concreto → abrí `components/<Name>.md`.
2. Para entender qué decisiones del producto generaron el catálogo → ADRs en `decisions/000[1-7]-...`.
3. Para auditar cumplimiento (a11y, voice, tokens-only, ADR coverage) → [`./_notes/s4-compliance-audit.md`](./_notes/s4-compliance-audit.md).
4. Para ver objeciones hostiles que se evaluaron en S4 → [`./_notes/s4-red-team.md`](./_notes/s4-red-team.md).
5. Para ver gaps abiertos a otras sesiones → [`./_notes/s4-gaps.md`](./_notes/s4-gaps.md).
