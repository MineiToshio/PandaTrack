---
title: S4 — Brief compartido para sub-agentes de componentes core
status: brief operativo (no contrato)
session: 04-components
last_updated: 2026-05-02
---

# Brief compartido — Sesión 4

> Este archivo es un **resumen operativo** que cada sub-agente de S4 debe leer junto con `tokens.md` y `tokens-css.md` antes de escribir specs. No reemplaza esos documentos. Si hay contradicción, gana `tokens.md`.

## Reglas duras (no negociables)

1. **Un archivo por componente** en `docs/redesign/components/<Name>.md` siguiendo la **plantilla obligatoria** abajo. Nombre del archivo = PascalCase del componente (`Button.md`, `StoreAvatar.md`, `WizardAccordion.md`).
2. **Sin literales raw.** Cero hex (`#000`), cero px (`12px`), cero ms crudos (`280ms`), cero shadow literal, cero easing literal. Todo via tokens del sistema (`var(--*)` o referencia al token semántico).
3. **Light + dark hermanos.** Cada estado se piensa en los dos modos. Las recetas usan tokens semánticos — el switch ya está resuelto por `:root[data-theme]`.
4. **WCAG 2.2 AA** en cada estado (focus visible, contraste ≥4.5:1 texto / ≥3:1 UI grande, target táctil ≥44×44, keyboard completo).
5. **Identificadores y tokens en inglés** (props, variants, archivos, claves i18n). **Copy default en español** aplicando voice glossary §7 de `principles.md`.
6. **Voice glossary (§7 principles.md):** `tú` siempre (nunca `usted`); voz activa; cero "por favor", cero "le informamos", cero "disculpe las molestias", cero "sistema", cero "procesamiento"; cero meme storm ("bestie", "no cap", emoji loops); máximo 1 emoji puntual y solo en momentos celebratorios (✨ 🎉 🌱). Pares antes/después de referencia abajo.
7. **TypeScript discriminated unions** donde un ADR las exige. Props obligatorias se tipan como required (no opcionales).
8. **Lucide Icons** es el set único para íconos UI (`lucide-react`). Brand icons via Simple Icons (no aplica en S4).
9. **next-intl:** cada copy default lleva clave i18n sugerida `components.<name>.<slot>`. **No se escriben locales reales en S4** (eso es S12).
10. **Repository-relative paths** en links (`../tokens.md`, `../decisions/0006-color-blindness-icon-label-contract.md`). Nunca paths absolutos.
11. **Estado del archivo:** `status: spec — no implementado`, `last_updated: 2026-05-02`, `session: 04-components`.

## Plantilla obligatoria (copiar literal y rellenar)

```markdown
---
title: <ComponentName>
tier: 1 | 2 | 3 | 4
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - <ADR-id> <decisión> (si aplica)
---

# <ComponentName>

## Propósito

1–2 líneas. Qué resuelve, en qué pantallas aparece (referenciar `screens/*.md`).

## API TypeScript

\`\`\`ts
type <Name>Props = {
  // ...
}
\`\`\`

(Discriminated union si aplica. Props requeridas marcadas explícitamente.)

## Variants / Sizes

Tabla con columnas: `variant | uso | tokens consumidos`.

## Estados visuales

Tabla con columnas: `estado | receta CSS (light) | receta CSS (dark) | notas`.

Cada receta referencia tokens. Cero literales raw.

## Mobile vs desktop

Qué cambia entre `< --breakpoint-md` (768px) y `≥ --breakpoint-md`.

## Accesibilidad

- Rol ARIA
- Atributos `aria-*` requeridos
- Keyboard (Tab, Enter, Esc, flechas, atajos)
- Focus management / focus trap si aplica
- Screen reader (anuncios, live regions)
- `prefers-reduced-motion` fallback

## Motion

Qué se anima · token de duración · token de easing. Si no se anima, escribir "ninguno".

## Copy default + i18n

Tabla con columnas: `clave i18n sugerida | valor ES (voice glossary aplicado)`.

EN se deja para S12.

## Edge cases

Lista enumerada con comportamiento esperado.

## Anti-patrones

Lista enumerada con justificación.

## Ejemplos de uso

TSX simulado breve. Máximo 2 ejemplos representativos. **No aplicado al repo.**

## Tokens consumidos

Lista plana de los `--*` que toca este componente.

## ADRs aplicables

Lista con link relativo (`../decisions/0001-...`).

## Dependencias

Otros componentes que compone (link relativo a `./<Other>.md`).

## Notas para S12 (implementación)

Qué decisiones técnicas quedan abiertas (event handlers concretos, librerías, etc.).
```

## Tokens del sistema (referencia rápida — full en `tokens.md`)

### Color (light + dark via `:root[data-theme]`)

- **Lienzo:** `--background`, `--surface`, `--surface-elevated`, `--surface-overlay`.
- **Bordes:** `--border` (decorativo ~1.5:1), `--border-strong` (funcional ≥3:1).
- **Texto:** `--text-primary`, `--text-secondary`, `--text-muted`, `--text-on-accent` (¡oscuro en dark, no blanco!).
- **Acentos:** `--accent`, `--accent-warm` (decorativo-only), `--accent-cool` (solo íconos categoría con label adyacente — ADR 0006).
- **Status:** `--success`, `--warning`, `--destructive`, `--info` + aliases `--*-chip-text`.
- **Focus:** `--focus-ring` (con alpha).
- **State layers:** `color-mix(in oklch, var(--text-primary) <mix>, transparent)` con `--state-hover-mix`, `--state-pressed-mix`, `--state-selected-bg-mix`, `--state-selected-border-mix`.

### Typography

`--font-sans`, `--font-display`, `--font-mono`. Tiers: `--text-display`, `--text-title`, `--text-subtitle`, `--text-body-lg`, `--text-body`, `--text-caption`, `--text-mono-lg`, `--text-mono`, `--text-eyebrow`. Pesos: `--font-weight-regular`, `--font-weight-medium`, `--font-weight-semibold`, `--font-weight-display`, `--font-weight-title`, `--font-weight-medium-body`, `--font-weight-mono`. Utilities: `.numeric` (tabular nums + tnum), `.eyebrow` (uppercase mono).

### Spacing

`--space-0 / -px / -0_5 / -1 / -1_5 / -2 / -3 / -4 / -5 / -6 / -8 / -10 / -12 / -16 / -24 / -32 / -48`.

### Layout magic numbers (semánticos)

`--sidebar-w-expanded` (240), `--sidebar-w-collapsed` (64), `--header-h` (56 mobile), `--header-h-desktop` (64), `--drawer-w` (440), `--sheet-max-h` (92svh), `--modal-max-w` (512), `--modal-max-w-lg` (768), `--toast-max-w` (352), `--container-max-w` (1280), `--container-max-w-prose` (672), `--fab-size` (56), `--fab-offset` (16).

### Radius

`--radius-xs / -sm / -md / -lg / -xl / -2xl / -pill`. Asignaciones canónicas en `tokens.md` §5.

### Breakpoints

`--breakpoint-xs` (384), `--breakpoint-sm` (640), `--breakpoint-md` (768) **= corte mobile/desktop**, `--breakpoint-lg` (1024), `--breakpoint-xl` (1280), `--breakpoint-2xl` (1536).

### Z-index

`--z-base 0`, `--z-sticky 10`, `--z-sidebar 20`, `--z-header 30`, `--z-mascot 35`, `--z-popover 40`, `--z-drawer 50`, `--z-sheet 60`, `--z-modal-backdrop 70`, `--z-modal 80`, `--z-toast 90`, `--z-command 100`, `--z-tooltip 110`.

### Motion

`--motion-fast 150ms`, `--motion-base 280ms`, `--motion-slow 480ms`. Easings: `--ease-emphasis` (opacity/color), `--ease-out-expressive` (sheets/modals/transforms), `--ease-bounce` (celebraciones), `--ease-vt-signature` (solo `::view-transition-*`).

### Elevation

`--elevation-1 / -2 / -3 / -4` (light: sombra real soft slate frío; dark: composición tono + borde + highlight inset + glow accent).

## Reglas críticas que vienen de ADRs (resumen vinculante)

### ADR 0001

- **D2** field-as-attribute: input pre-llenado se renderiza como bloque `surface-elevated radius-lg` con eyebrow `↳ DESDE PT-XXXXXX` + valor + botón ghost "Cambiar" con ícono `pencil`. Nunca como input bloqueado con `disabled`.
- **D3** section card gated: NO usar opacity. Mantener eyebrow + title al 100%. Body reemplazado por sub-bloque guía con ícono Lucide `lock` 24px en `--text-muted` (no destructive) + copy en `--text-muted` Body 13px + padding generoso.
- **D4** toast neutral-undo: 5s default / **8s para delete de pedido entero**. CTA ghost "Deshacer" en `--accent` + atajo `Z` (kbd visible desktop). Hairline countdown 1px en `--accent` 40%. Hover/focus pausa countdown. `aria-live="polite"`. Posición bottom-center mobile / bottom-right desktop.
- **D5** view-transition-name: convención `order-{humanId}` (`PT-002418`). Extensiones `delivery-{humanId}`, `store-{slug}`. Solo la row clickeada/focused recibe el nombre (delegación dinámica).
- **D6** lifecycle por reversibilidad: reversibles van en sidebar/cluster; destructivas irreversibles (`Eliminar`) van en overflow `[···]` del header.
- **D8** 4 micro-stats: `Este mes` (`--accent`), `Próximos 30 días` (`--accent-warm`), `Atrasado` condicional (`--warning`), `Llega esta semana` (`--success`). Cuando `Atrasado = 0` slot muta a "Tiendas activas" en `--text-muted`.
- **D14** theme dual: vive en header + en settings. Persistencia `localStorage["pandatrack-theme"]`. **ADR 0003 D2 supersede:** solo `light`/`dark` (sin `system`).
- **D16** StoreAvatar: sizes `24 | 32 | 40 | 56` (no 16 ni 48). 1 letra (no 2). Logo cuadrado → circular mobile / `radius-lg` desktop sin tinte. Logo rectangular → `object-fit: contain` + padding 12.5% sobre `--surface-elevated`. Logo con alpha → siempre sobre `--surface-elevated`.

### ADR 0002 — StatusChip mapping (ver `decisions/0002-status-chip-mapping.md`)

Discriminated union `kind`:

- `orderStatus`: `OPEN→Abierto/neutral/clock`, `PARTIALLY_IN_TRANSIT→Parcialmente en camino/info/package`, `IN_TRANSIT→En camino/info/package`, `PARTIALLY_DELIVERED→Llegó parcialmente/success/package-open`, `COMPLETED→Completo/success/check-circle`, `CANCELLED→Cancelado/neutral/ban`.
- `deliveryStatus`: `IN_TRANSIT→En camino/info/truck`, `DELIVERED→Llegó/success/check-circle`, `CANCELLED→Cancelada/neutral/ban`. Derivado: `Atrasada N días/warning` reemplaza `En camino` cuando `expectedArrivalTo < now`.
- `itemDeliveryState`: `NONE→Pendiente en tienda/neutral/clock`, `ARRIVED_AT_STORE→Listo en tienda/success/check-circle`, `IN_TRANSIT→En camino/info/truck`, `DELIVERED→Entregado/success/package-check`.
- `derived`: `Pagado/success`, `N% pagado/accent soft`, `Sin pagar/neutral`, `Atrasado N días/warning`.

5 variants: `success | warning | destructive | info | accent | neutral`. Variant `neutral`: bg `--surface-elevated`, border `--border-strong`, text `--text-secondary`, ícono `--text-muted`.

### ADR 0003

- **D2** theme toggle: solo `light`/`dark`, sin `system`. Inferencia `prefers-color-scheme` solo primera carga.
- **D5** `<WizardAccordion>` + `<WizardStep>`: solo un paso expandido a la vez. Click en card colapsada o en bolita la abre y cierra las demás. "Continuar" marca done y abre el siguiente. "Atrás" vuelve. Step indicator refleja accordion. Auto-scroll suave. Pasos done muestran summary + bolita en `--success` con check.
- **D7** `<DetailSidebar>` slots fijos: `Resumen` / `Acciones` / `NotaPrivada`. Mobile: stackea debajo del cuerpo. Acciones destructivas como `destructive-ghost` dentro de Acciones; las irreversibles en overflow `[···]` del header.
- **D8** `<FilterDrawer>` mobile bottom sheet (drag handle, slide vertical 320ms = `--motion-base`+, max-height 88vh = `--sheet-max-h`); desktop drawer derecho `--drawer-w` (440px), slide horizontal. Header con `sliders-horizontal` + título contextual. Tipos: `pills | pills-search | icon-pills | date-range | switches`. Footer sticky con "Limpiar" + "Aplicar (N resultados)".

### ADR 0004 — paleta categórica eliminada

Identidad de categoría = ícono Lucide en `--accent-cool`. **Nunca color**. Lucides canónicos: `figures→shapes`, `vinyl→disc`, `manga→book-open`, `anime→sparkles`, `cards→gallery-thumbnails`, `plush→package`.

### ADR 0005 — `<MicroStatCard>`

Prop **obligatoria** `accentToken: '--accent' | '--accent-warm' | '--warning' | '--success'` vía discriminated union. Patrón canónico: cifra en `--text-primary` + icon-tile circular soft-tint (32-36px) con glyph Lucide del `accentToken` adentro. Bg del tile = `color-mix(in oklch, var(<accentToken>) 14%, var(--surface))`. Border = `color-mix(... 28%, --surface)`. Eyebrow uppercase mono en `--text-muted`. Cifra display + `tabular-nums`.

### ADR 0006 — contrato icon+label (vinculante TypeScript)

- `<StatusChip kind="info">` **requiere props `icon` (ReactNode) + `label` (string)**. TypeScript debe rechazar el componente sin esas props vía discriminated union.
- Cualquier ícono en `--accent-cool` requiere label adyacente.
- `--accent-cool` prohibido como `background`, `border-color`, `color` de texto, `fill` de no-ícono. Solo color de ícono o tinte ≤14%.

### ADR 0007 — code mono identificador

`PT-XXXXXX`, `delivery-{humanId}`, `store-{slug}` cuando se renderizan como código → **`--text-secondary`** (no `--text-muted`). El componente `<MonoCode>` debe consumir `--text-secondary` por default cuando representa un identificador. Caps/timestamps relativos siguen en `--text-muted`.

## Voice glossary — pares antes/después (referencia para copy default)

| Caso                  | ❌ Antes (frío / corporativo)                     | ✅ Después (Atelier informal)              |
| --------------------- | ------------------------------------------------- | ------------------------------------------ |
| Empty                 | "No se encontraron resultados"                    | "Sin resultados todavía. Suma uno y arrancamos." |
| Confirm delete        | "¿Está seguro que desea eliminar?"                | "¿Borrar esto? No se puede deshacer."      |
| CTA primario          | "Confirmar acción"                                | "Confirmar" / "Listo" / "Anotar" / "Guardar" |
| Validation duplicado  | "Se han detectado coincidencias"                  | "Hey, hay 2 parecidas. ¿Es alguna?"        |
| Error 500             | "Ha ocurrido un error en el servidor"             | "Algo se rompió de este lado. Dale otra vez." |
| Loading               | "Cargando datos, por favor espere…"               | "Buscando…" o skeleton sin texto           |
| Helper                | "Por favor ingrese un valor válido"               | "Pongan un número, e.g. 123,45"            |
| Date placeholder      | "Seleccione una fecha"                            | "¿Para cuándo?"                            |
| Save autosave         | "Sus cambios han sido guardados"                  | "Guardado, hace 4s"                        |
| Cancel                | "Cancelar operación"                              | "Cancelar"                                 |
| Search empty          | "No hay coincidencias"                            | "Nada con eso. Probá otro término."        |

## Lucide icons referenciados en wireframes (lista parcial)

`shopping-bag`, `clock`, `package`, `package-open`, `package-check`, `truck`, `check-circle`, `ban`, `lock`, `pencil`, `info`, `circle-dashed`, `hourglass`, `wallet`, `trending-up`, `calendar-clock`, `alert-triangle`, `alert-circle`, `shapes`, `disc`, `book-open`, `sparkles`, `gallery-thumbnails`, `chevron-down`, `chevron-up`, `chevron-right`, `chevron-left`, `x`, `plus`, `minus`, `search`, `sliders-horizontal`, `more-horizontal` (overflow `[···]`), `more-vertical`, `sun`, `moon`, `globe`, `bell`, `eye`, `eye-off`, `loader-2` (spinner), `arrow-right`, `arrow-left`, `arrow-up`, `arrow-down`, `command`, `corner-down-left` (Enter), `grip-vertical` (drag), `home`, `settings`, `user`, `log-out`, `mail`, `key`, `trash-2`, `copy`, `external-link`.

## Comportamientos transversales que aplican a varios componentes

1. **Tap target ≥ 44×44 mobile.** Aunque el visual sea más chico (ej. icon-button 32px), padding clickable extiende a 44×44.
2. **Focus visible siempre.** `outline: 2px solid var(--focus-ring); outline-offset: 2px;` en `:focus-visible`.
3. **Disabled sin opacity.** Estado disabled usa `color: var(--text-muted)` + `border-color: var(--border)` + `pointer-events: none`. Nunca `opacity: 0.5`.
4. **Loading state.** Spinner `loader-2` (Lucide) animado con `--motion-base` infinito linear. Botones loading mantienen ancho original (no shrink).
5. **Optimistic updates.** Componentes que emiten mutaciones (Toast undo, Form submit, Switch toggle) deben soportar el contrato de `optimistic-client-updates.mdc`: snapshot → cambio local → server action → reconcile/revert + toast error en fallo.
6. **Validación post-blur.** Inputs no validan mientras escribís. Solo después de `blur` o `submit`.
7. **Server-error mapping.** Forms mapean errores del servidor a campos específicos con copy declarativo en español. Conservan inputs tipeados.
8. **`prefers-reduced-motion`.** Cualquier transition se reduce a opacity + `transform: none` con `--motion-fast`. Spring easings se reemplazan por `--ease-emphasis`. View transitions se desactivan.
9. **Tabular nums.** Toda cifra renderizada usa `font-variant-numeric: tabular-nums` + `font-feature-settings: "tnum"`. Utility `.numeric`.
10. **No `text-white` hardcoded.** Sobre `--accent` sólido siempre `var(--text-on-accent)` (oscuro en dark).

## Referencia visual del demo

`_notes/demo-screens.html` muestra cómo lucen muchos de estos componentes ya bocetados. Es **referencia visual, no contrato de API**. Si la API que diseñes contradice cómo se usa visualmente en el demo, **gana el demo** salvo que tengas razón explícita (entonces anotala en `_notes/s4-conflicts.md`).

## Entregables del sub-agente

1. **Un archivo por componente** en `docs/redesign/components/<Name>.md` con la plantilla obligatoria completa (sin TODOs).
2. **Resumen final ≤200 palabras** con: lista de archivos creados, decisiones clave tomadas, supuestos asumidos, riesgos abiertos para fase 2 (consolidación).

Cualquier ambigüedad: tomar la decisión más conservadora y documentarla en "Notas para S12 (implementación)" del componente afectado.
