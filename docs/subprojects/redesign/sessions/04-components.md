---
title: Sesión 04 — Componentes core
date: 2026-05-02
status: ✅ done
duration: una corrida desatendida (7 sub-agentes paralelos + relleno manual del agente principal + consolidación + audit + red team + cierre)
---

# S04 — Componentes core (Tier 1 atoms / Tier 2 molecules / Tier 3 organisms / Tier 4 form orchestration)

## Qué corrió

1. **Paso 0 — Reconstrucción de contexto.** Lectura en orden de [`README.md`](../README.md), [`tokens.md`](../tokens.md), [`tokens-css.md`](../tokens-css.md), los 7 ADRs aceptados (`0001` a `0007`) en orden cronológico, [`principles.md`](../principles.md) (decálogo + voice glossary §7), los 6 wireframes [`screens/*.md`](../screens), [`functional-inventory.md`](../functional-inventory.md) §F + §C, y los rules duros del repo (`optimistic-client-updates.mdc`, `react-next-components.mdc`, `role-accessibility.mdc`, `icons.mdc`, `next-intl-translation-apis.mdc`). Cero contradicciones nuevas que requirieran `_notes/s4-conflicts.md`.

2. **Brief compartido.** Producido [`_notes/s4-shared-brief.md`](../_notes/s4-shared-brief.md) con plantilla obligatoria de 15 secciones, reglas duras, tokens, ADRs resumidos, voice glossary y comportamientos transversales — para que los sub-agentes trabajen autocontenidos.

3. **Fase 1 — Diseño base de componentes (paralelo).** Se lanzaron **7 sub-agentes `general-purpose`** divididos por tier-coherencia:
    - **α** Tier 1 atoms de form (15 componentes).
    - **β** Tier 1 atoms de acción (Button, IconButton).
    - **γ** Tier 2 molecules (10 componentes).
    - **δ** Tier 3 wizard + filter + detail (4 componentes).
    - **ε** Tier 3 surface primitives (9 componentes).
    - **ζ** Tier 3 shell pieces (4 componentes).
    - **η** Tier 4 form orchestration (3 componentes).

    Sub-agentes α, β, δ, η completaron exitosamente. Sub-agentes γ, ε, ζ saturaron rate limit cerca del fin → el agente principal completó manualmente los 9 archivos faltantes (Avatar, Tabs, Stepper, Tooltip, DropdownMenu, OverflowMenu, CommandPalette, Breadcrumbs) siguiendo la misma plantilla obligatoria.

4. **Fase 2 — Consolidación cross-componente.** Audit grep cruzado:
    - Voice glossary: cero violaciones genuinas (los 2 hits de "por favor" son anti-patrones documentados como tales).
    - Hex colors: cero hardcoded.
    - `text-white`: 7 menciones, todas como anti-patrones documentados (correcto).
    - Plantilla obligatoria: 47/47 componentes con las 15 secciones (1 typo en `Label.md` `Accesibiledad` → `Accesibilidad` corregido).
    - `prefers-reduced-motion`: declarado en 47/47.
    - Discriminated unions críticas (ADR 0005 `accentToken`, ADR 0006 `kind="info"` icon+label, ADR 0006 `IconButton.label`) implementadas como TS estricta.
    - Cero TODOs / FIXMEs reales (los hits son la palabra "TODOS" en español).

5. **Fase 3 — Catálogo + cross-references.** Producido [`components.md`](../components.md) con:
    - Mapa por tier (Tier 1: 17 atoms / Tier 2: 10 molecules / Tier 3: 17 organisms / Tier 4: 3 form orchestration).
    - Tabla de cobertura wireframe → componentes invocados (6/6 wireframes cubiertos).
    - Tabla ADR → componente que lo implementa (7/7 ADRs cubiertos).
    - Matriz tokens × componentes (todos los grupos del sistema con consumidores).
    - Tabla de componentes diferidos a otras sesiones con justificación.

6. **Fase 4 — Audit de cumplimiento.** Producido [`_notes/s4-compliance-audit.md`](../_notes/s4-compliance-audit.md) verificando: plantilla obligatoria, cobertura ADR, cobertura tokens, cobertura wireframes, compliance a11y, compliance voice, compliance tokens-only, discriminated unions críticas, naming. Resultado: **0 bloqueantes**, 12 notas menores documentadas.

7. **Fase 5 — Red team.** Producido [`_notes/s4-red-team.md`](../_notes/s4-red-team.md) con **18 objeciones hostiles** auto-generadas, todas evaluadas. Resultado: **0 bloqueantes pendientes**, 4 mayores resueltas con cambios al spec, 8 menores aceptadas con riesgo controlado, 6 informativas sin acción.

8. **Fase 6 — Cierre.** Este archivo + actualización de [`README.md`](../README.md) + [`_notes/s4-gaps.md`](../_notes/s4-gaps.md) (13 gaps registrados con sesión destino).

## Sub-agentes lanzados (tabla)

Lanzados en paralelo, mayoría en una sola tanda (β/γ/δ/ε/ζ/η simultáneos en background; α inicial en foreground):

| Bloque | Tier | Componentes | Resultado |
| ------ | ---- | ----------- | --------- |
| α | Tier 1 form (15) | Input, Textarea, Select, Combobox, DateInput, DateRangeInput, Checkbox, Radio, Switch, Label, HelperText, ErrorMessage, Kbd, Eyebrow, MonoCode | ✅ completado por sub-agente |
| β | Tier 1 acción (2) | Button, IconButton | ✅ completado por sub-agente |
| γ | Tier 2 molecules (10) | StoreAvatar, StatusChip, MicroStatCard, PrefilledField, SectionCard, Card, EmptyState, Avatar, Tabs, Stepper | 🟡 7/10 sub-agente; **3 completados por agente principal** (Avatar, Tabs, Stepper) tras rate limit |
| δ | Tier 3 wizard+filter+detail (4) | WizardAccordion, WizardStep, FilterDrawer, DetailSidebar | ✅ completado por sub-agente |
| ε | Tier 3 surface (9) | Toast, Sheet, Modal, Drawer, Popover, Tooltip, DropdownMenu, OverflowMenu, CommandPalette | 🟡 5/9 sub-agente; **4 completados por agente principal** (Tooltip, DropdownMenu, OverflowMenu, CommandPalette) tras rate limit |
| ζ | Tier 3 shell pieces (4) | MascotBubble, ThemeToggle, LangToggle, Breadcrumbs | 🟡 3/4 sub-agente; **1 completado por agente principal** (Breadcrumbs) tras rate limit |
| η | Tier 4 form orchestration (3) | Form, FormFooter, FieldGroup | ✅ completado por sub-agente |

**Total componentes specceados:** 47 (38 por sub-agentes + 9 por agente principal post rate limit).

## Hallazgos clave

1. **`text-white` Atelier legacy es deuda visible.** Cualquier botón/badge legacy de `src/components/` con `text-white` hardcoded romperá en dark con `--text-on-accent` oscuro (L=15%). Anotado para grep + migración masiva pre-S12. `<Button>` y `<IconButton>` lo flagean explícitamente.
2. **Discriminated unions cierran ADR 0006 en compile time.** `<StatusChip kind="info">` y `<IconButton label>` exigen icon+label vía TypeScript. Lint runtime rules de S12 cubren los casos JS plano / `as any`.
3. **`<MicroStatCard>` con `accentToken` discriminated union** materializa ADR 0005. Cualquier intento de pasar otro token rompe TS. La regla "cifra `--text-primary` + glyph en `accentToken` color sobre tile soft-tint" cierra el fail cross-paleta de Lilac warm 2.46:1.
4. **`<Toast variant="neutral-undo">`** con atajo `Z` resuelve elegantemente la colisión con undo nativo del browser: el listener checkea `document.activeElement` y NO intercepta cuando un input está focused. Atajo `Z` solo (sin modifier) es distinto de `Cmd+Z` nativo.
5. **`<WizardAccordion>` + `<Stepper>` comparten state vía context** (`WizardAccordionContext`). Una sola fuente de verdad para activo/done/todo. Click en bolita del stepper o en card colapsada del accordion → mismo handler.
6. **`<FilterDrawer>`** orquestador compone `<Sheet>` (mobile) y `<Drawer>` (desktop) según breakpoint. La primitiva `<Drawer>` NO degrada automáticamente a `<Sheet>` (a diferencia de `<Modal>`) — es decisión del consumer.
7. **`<DetailSidebar>` slots fijos vinculantes** (Resumen / Acciones / NotaPrivada). Las acciones destructivas reversibles van en slot Acciones como `destructive-ghost`; las irreversibles (Eliminar) van en `<OverflowMenu>` del header.
8. **`<MascotBubble>` posiciones canónicas vinculantes** (`directions.md` §4.10): bubble idle ubicua, walking strip solo `/dashboard` desktop, sleeping en empty hero, celebrating en achievement. NO en form active, NO en errores inline.
9. **Component-as-JSX vs Component-as-Composition.** `<DetailSidebar>` es slots-as-props (Resumen / Acciones / NotaPrivada como ReactNode props). `<WizardAccordion>` es children-based (`<WizardStep>` hijos). Pattern híbrido pero coherente — slots cuando los slots son rigid (3 cards fijas), children cuando el contenido varía (1-N steps).
10. **Sub-pixel borders aceptados.** `Checkbox` usa `1.5px` para presencia funcional ≥3:1. No tokenizable sin overkill — anotado como excepción documentada.

## Decisiones tomadas

### Estructura del catálogo

- **47 componentes** organizados en 4 tiers (atoms 17 / molecules 10 / organisms 17 / form orchestration 3).
- **Plantilla obligatoria** de 15 secciones aplicada uniformemente a todos los archivos.
- **Frontmatter consistente:** `tier`, `status: spec — no implementado`, `last_updated: 2026-05-02`, `session: 04-components`, `adrs: [...]`.

### Reglas vinculantes a nivel sistema

- **Discriminated unions críticas:** `<StatusChip kind="info">` icon+label obligatorios (ADR 0006); `<MicroStatCard accentToken>` restringida a 4 valores literal (ADR 0005); `<IconButton label>` obligatorio (a11y + ADR 0006); `<Combobox mode>`, `<Button as>`, `<MascotBubble variant>`, `<Toast variant>`, `<FilterSection type>`, `<MenuItem type>`, `<Checkbox checked>` indeterminate.
- **Disabled sin opacity** cross-componente (ADR 0001 D3 generalizado a Button, IconButton, Tabs, Stepper, Inputs, Select, MenuItem, Card interactive, SectionCard).
- **`--text-on-accent` oscuro en dark** (no `text-white`) cross-componente.
- **Tap target ≥44×44 mobile** garantizado vía padding o pseudo-element en Button, IconButton, Tabs, Stepper, Checkbox, Radio, Switch, MenuItem.
- **Focus visible siempre** con `outline: 2px solid var(--focus-ring); outline-offset: 2px` en `:focus-visible`.
- **`prefers-reduced-motion` fallback** documentado en cada componente con motion (47/47).
- **Voice glossary aplicado en copy default** cross-componente. Sin "usted", "por favor", "le informamos", "bestie", "no cap". Máximo 1 emoji puntual celebratorio.
- **Identificadores en inglés / copy en español.** Claves i18n con namespace `components.<name>.<slot>`.

### Convenciones derivadas

- **`<MonoCode>` default `--text-secondary`** (ADR 0007). Variant `inline` baja a `--text-muted`.
- **Lucide Icons** referenciados por nombre canónico cross-componente.
- **`@floating-ui/react`** asumido como base de anchor + flip + collision para Popover, Combobox, DateInput, Tooltip, DropdownMenu (decisión definitiva en S12).
- **`@radix-ui` headless** considerado como alternativa para Modal, Sheet, Drawer, Tabs, DropdownMenu, Tooltip (decisión S12).
- **`cmdk`** considerado como base para CommandPalette (decisión S12).

## Supuestos asumidos

- **Librería de form**: `react-hook-form` + Zod adapter como recomendación para `<Form>` (decisión final S12).
- **Librería de date picker**: `date-fns` + `Intl.DateTimeFormat`. No `Moment`, no `react-datepicker`. Implementación propia minimalista.
- **Librerías headless**: `@floating-ui/react` para anchor, `@radix-ui` para primitives complejas si simplifica.
- **Detección de plataforma** para `⌘` vs `Ctrl` en `<Kbd>` y `<CommandPalette>`: `navigator.platform.includes('Mac')` con fallback a `Ctrl`.
- **`view-transition-name` aplicación**: shell de S5/S6 lo aplica a list rows + detail header. `<MonoCode>` consume la convención del humanId pero no aplica el style.
- **Theme persistence**: `localStorage["pandatrack-theme"]` (clave producción), inline script en `<head>` antes de hydration para evitar flash (S12).
- **Sprite sheet de mascota**: placeholder en S4. Decisión final pixel art vs AI hi-res en S6.
- **Container queries**: si se necesitan para layouts adaptativos, decisión técnica en S12.

## Archivos producidos

### Plantillas y catálogo
- `docs/redesign/_notes/s4-shared-brief.md` — brief operativo S4 con plantilla obligatoria, reglas duras, tokens, ADRs resumidos, voice glossary.
- `docs/redesign/components.md` — catálogo overview por tier, cobertura wireframe, cobertura ADR, matriz tokens, componentes diferidos.

### Specs de componentes (47 archivos en `docs/redesign/components/`)

**Tier 1 atoms de form (15):**
- `Input.md`, `Textarea.md`, `Select.md`, `Combobox.md`, `DateInput.md`, `DateRangeInput.md`, `Checkbox.md`, `Radio.md`, `Switch.md`, `Label.md`, `HelperText.md`, `ErrorMessage.md`, `Kbd.md`, `Eyebrow.md`, `MonoCode.md`.

**Tier 1 atoms de acción (2):**
- `Button.md`, `IconButton.md`.

**Tier 2 molecules (10):**
- `StoreAvatar.md`, `StatusChip.md`, `MicroStatCard.md`, `PrefilledField.md`, `SectionCard.md`, `Card.md`, `EmptyState.md`, `Avatar.md`, `Tabs.md`, `Stepper.md`.

**Tier 3 organisms wizard + filter + detail (4):**
- `WizardAccordion.md`, `WizardStep.md`, `FilterDrawer.md`, `DetailSidebar.md`.

**Tier 3 organisms surface (9):**
- `Toast.md`, `Sheet.md`, `Modal.md`, `Drawer.md`, `Popover.md`, `Tooltip.md`, `DropdownMenu.md`, `OverflowMenu.md`, `CommandPalette.md`.

**Tier 3 organisms shell (4):**
- `MascotBubble.md`, `ThemeToggle.md`, `LangToggle.md`, `Breadcrumbs.md`.

**Tier 4 form orchestration (3):**
- `Form.md`, `FormFooter.md`, `FieldGroup.md`.

### Audits y red team
- `docs/redesign/_notes/s4-compliance-audit.md` — verificación 8 dimensiones, 0 bloqueantes, 12 notas menores.
- `docs/redesign/_notes/s4-red-team.md` — 18 objeciones evaluadas, 0 bloqueantes pendientes.
- `docs/redesign/_notes/s4-gaps.md` — 13 gaps abiertos para S5/S6/S9/S12.

### Cierre
- `docs/redesign/sessions/04-components.md` (este archivo).
- `docs/redesign/README.md` actualizado.

**Total nuevas líneas markdown agregadas en S4:** ~14.000+ líneas distribuidas en 51 archivos nuevos (47 specs + brief + catálogo + 3 audits + cierre).

## Lo que NO se hizo (intencionalmente)

- **No se diseñaron layouts** (sidebar collapsable + push, header sticky, app shell, Tab bar inferior mobile, FAB elevado, VerifyEmailBanner) — eso es **S5**. Los componentes que componen el shell (Breadcrumbs, ThemeToggle, LangToggle) sí están specceados.
- **No se diseñaron pantallas alta fidelidad** — eso es **S6+**.
- **No se diseñaron flujos completos** (creación pedido / pago / entrega) — eso es **S7-S8**.
- **No se especificaron empty / loading / error states de pantallas concretas** — eso es **S9** (S4 specceó el primitive `<EmptyState>` pero no las composiciones por pantalla).
- **No se diseñó onboarding ni landing** — **S10**.
- **No se diseñaron coreografías de motion** (walking strip de mascota, microinteracciones de pantalla, swipe action backgrounds) — **S11**.
- **No se cerró voice library completa** (S4 aplicó voice glossary §7 a copy default; la voice library completa para toda la app es **S11**).
- **No se aplicó nada al código real** (`src/components/`, `src/app/`, `src/i18n/locales/`) — eso es **S12**.
- **No se decidió pixel art vs AI hi-res mascota** — **S6**.
- **No se ejecutaron las 5 validaciones humanas del `_notes/s2-validation-plan.md`** — humano fuera del agente.
- **No se montó `<CommandPalette>`** (specced pero opt-in real es S6+).
- **No se creó ADR nuevo en S4.** Las decisiones que se tomaron están dentro del scope de los ADRs 0001-0007 ya aceptados (interpretación + materialización en componentes, no decisiones nuevas que requieran ADR formal).

## Métricas de la sesión

- **47 componentes specceados** en plantilla obligatoria de 15 secciones.
- **7 ADRs (0001-0007) cubiertos** por al menos un componente. Decisiones específicas con cobertura parcial (D5, D7, D9, D18, D19) explicitadas con sesión destino.
- **6/6 wireframes** con cobertura full de componentes invocados. Componentes adicionales del shell diferidos a S5.
- **0 bloqueantes pendientes** para S5.
- **18 objeciones de red team** evaluadas, todas resueltas o aceptadas con riesgo controlado.
- **12 notas menores** registradas en compliance audit.
- **13 gaps abiertos** para S5 (4) / S6 (3) / S9 (1) / S12 (5).
- **0 violaciones de voice glossary**.
- **0 hex / px / ms literales raw genuinos** (los hits son anti-patrones documentados o sub-pixel borders aceptados).
- **10 discriminated unions críticas** implementadas (ADR 0005 + 0006 enforce TS).

## Qué necesita la Sesión 5 para arrancar

S5 es **Navegación y layouts** — diseña el app shell que aloja los componentes de S4.

Para arrancar, S5 necesita:

1. **Decisión sobre los 7 gaps de tokens / shell tokens:**
    - G3 `<VerifyEmailBanner>` — composición simple usando `<StatusChip variant="warning">` o componente nuevo Tier 2.
    - G4 `<TabBar>` mobile — componente shell con 4 destinos + FAB elevado.
    - G5 token `--detail-sidebar-w` — proponer 21.25rem (340px) y validar.
    - G6 tokens `--drawer-w-narrow` (320) / `--drawer-w-wide` (560).
    - G7 `--motion-shell-push` o reuso de `--motion-base` (decisión humana D3 dice 220ms; recomendado reuso de `--motion-base` 280ms para simplificar).
    - G1 `<ProgressBar>` Tier 2 — primitive independiente que aparece en dashboard hero, orders rows, order detail.
    - G2 `<Pagination>` numerada desktop (ADR 0001 D9).

2. **Decisión de aplicación de la firma view-transition** (`view-transition-name: order-{humanId}`): el shell setea el style en list rows + detail header (delegación dinámica para no inflar DOM).

3. **Diseño de la app shell:**
    - Sidebar 240px / 64px collapsable con push (ADR 0003 D3) — logo top / nav medio / user bottom.
    - Content header con `<Breadcrumbs>` + `<LangToggle>` + `<ThemeToggle>` (ADR 0003 D4).
    - `<MobileTabBar>` con 4 destinos + FAB elevado (mobile).
    - Sticky `<VerifyEmailBanner>` cuando aplica.
    - Layout grid principal con `--container-max-w` 1280px.

4. **Composición de pantallas a alto nivel** (sin alta fidelidad — eso es S6) usando los componentes ya specceados.

5. **Validación humana paralela**: las 5 validaciones del [`_notes/s2-validation-plan.md`](../_notes/s2-validation-plan.md) (especialmente Validation #4 refinada por ADR 0007 sobre code mono outdoor) siguen siendo trabajo del humano fuera del agente.

S5 no es bloqueada por ningún tema pendiente de S4. Los 12 notas menores y 13 gaps están todos registrados con sesión destino y propuesta de resolución.
