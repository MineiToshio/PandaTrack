---
title: S3 draft — spacing + radius + breakpoints + z-index
status: draft gamma — para consolidación cross-área
---

> Notación: todos los tokens siguen la convención Tailwind v4 `@theme` (`--space-*`, `--radius-*`, `--breakpoint-*`). Los valores derivan del scale Atelier §4.6 más auxiliares Tailwind defaults conservados (marcados como tales). Magic numbers de layout se promueven a tokens semánticos para evitar literales sueltos en componentes.

---

## 1. Spacing scale (`--space-*`)

Base step Tailwind v4: `--spacing = 0.25rem` (4px). Las utilities `p-1`, `m-2`, `gap-3` derivan de ese step. La scale extendida nombrada se documenta para referencia explícita en componentes y docs de diseño.

| Token         | rem        | px  | Origen          | Uso típico                                                                                                       |
| ------------- | ---------- | --- | --------------- | ---------------------------------------------------------------------------------------------------------------- |
| `--space-0`   | `0`        | 0   | Atelier         | Reset; nunca para separar contenido legible.                                                                     |
| `--space-px`  | `1px`      | 1   | Tailwind base   | Bordes hairline, separadores 1px. Nunca como gap entre cards.                                                    |
| `--space-0_5` | `0.125rem` | 2   | Atelier         | Ajustes tipográficos finos (lift de chip, micro-padding de badge dot). Nunca como padding de card.               |
| `--space-1`   | `0.25rem`  | 4   | Atelier         | Gap entre icono e ícono en grupo de acciones, padding interno de chip pequeño.                                   |
| `--space-1_5` | `0.375rem` | 6   | Tailwind v4 def | **Auxiliar conservado**. Sólo cuando `--space-1` es muy chico y `--space-2` muy grande (rare).                   |
| `--space-2`   | `0.5rem`   | 8   | Atelier         | Padding vertical de chip/tag, gap entre label e input, padding interno de toast icon-text.                       |
| `--space-3`   | `0.75rem`  | 12  | Atelier         | Padding interno de input/button, gap entre fields en row, padding lateral de chip large.                         |
| `--space-4`   | `1rem`     | 16  | Atelier         | Padding base de card pequeña, gap vertical entre fields de un form, gap entre items de lista densa.              |
| `--space-5`   | `1.25rem`  | 20  | Tailwind v4 def | **Auxiliar conservado**. Padding interno de section card en mobile (decisión §2).                                |
| `--space-6`   | `1.5rem`   | 24  | Atelier         | Padding interno de section card desktop (mín). Gap entre section cards en column. Padding lateral de sheet body. |
| `--space-8`   | `2rem`     | 32  | Atelier         | Gap entre bloques de página, padding superior de section header con divider.                                     |
| `--space-10`  | `2.5rem`   | 40  | Tailwind v4 def | **Auxiliar conservado**. Altura de input/button medium estándar (40px control height).                           |
| `--space-12`  | `3rem`     | 48  | Atelier         | Gap entre secciones temáticas grandes. Altura de header desktop (48px).                                          |
| `--space-16`  | `4rem`     | 64  | Atelier         | Sidebar width collapsed (64px). Padding superior de hero/empty states.                                           |
| `--space-24`  | `6rem`     | 96  | Atelier         | Padding vertical de empty states full-page, gap entre regiones de landing.                                       |
| `--space-32`  | `8rem`     | 128 | Atelier         | Padding vertical de hero landing en desktop.                                                                     |
| `--space-48`  | `12rem`    | 192 | Atelier         | Reservado para landing splash y secciones marketing. Nunca dentro del admin app.                                 |

Decisión: el set Atelier explícito (`0`, `0.5`, `1`, `2`, `3`, `4`, `6`, `8`, `12`, `16`, `24`, `32`, `48`) es el preferido. Los auxiliares (`1_5`, `5`, `10`) se conservan porque ya forman parte del default Tailwind v4 y resuelven casos concretos (control heights, padding mobile de section card). Cualquier otro valor de spacing requiere justificación documental.

Decisiones de aplicación obligatorias:

- Section card padding desktop ≥ `--space-6` (24px). Si la card es densa con sub-cards, escalar a `--space-7` (1.75rem, fuera del scale base — usar `calc(var(--space-6) + var(--space-1))` o promover a token `--space-7` si reaparece).
- Section card padding mobile = `--space-5` (20px).
- Form field row gap = `--space-4` (16px).
- Form field column gap (label → input) = `--space-2` (8px).
- Section-to-section gap dentro de página = `--space-6` (24px) mobile / `--space-8` (32px) desktop.

---

## 2. Layout magic numbers (sidebar, drawer, max-width)

Los anchos de layout no son spacing; son contratos del shell. Se promueven a tokens semánticos:

| Token                     | Valor       | px   | Uso                                                                                  |
| ------------------------- | ----------- | ---- | ------------------------------------------------------------------------------------ |
| `--sidebar-w-expanded`    | `15rem`     | 240  | Sidebar admin app expandido (push layout, no overlay en `≥ lg`).                     |
| `--sidebar-w-collapsed`   | `4rem`      | 64   | Sidebar collapsado (sólo iconos, tooltips on hover).                                 |
| `--header-h`              | `3.5rem`    | 56   | Header sticky admin app mobile.                                                      |
| `--header-h-desktop`      | `4rem`      | 64   | Header sticky admin app desktop.                                                     |
| `--drawer-w`              | `27.5rem`   | 440  | Filter drawer derecho desktop. En `< md` se transforma en bottom sheet.              |
| `--sheet-max-h`           | `92svh`     | —    | Bottom sheet mobile máx alto (deja espacio para handle y safe-area).                 |
| `--modal-max-w`           | `32rem`     | 512  | Modal centered default. Modales grandes pueden subir a `--modal-max-w-lg` = `48rem`. |
| `--modal-max-w-lg`        | `48rem`     | 768  | Modal centered grande (forms multi-step, picker complejo).                           |
| `--toast-max-w`           | `22rem`     | 352  | Ancho máximo de toast individual.                                                    |
| `--container-max-w`       | `80rem`     | 1280 | Ancho máximo de contenido en página admin (alineado con `--breakpoint-xl`).          |
| `--container-max-w-prose` | `42rem`     | 672  | Ancho máximo para prose/lectura (settings explainer, FAQ).                           |
| `--fab-size`              | `3.5rem`    | 56   | FAB diámetro mobile (acción primaria flotante).                                      |
| `--fab-offset`            | `--space-4` | 16   | Offset desde borde inferior/derecho de viewport para FAB.                            |

Reglas:

- Ningún componente puede declarar literal `240px`, `64px`, `440px`, etc. para layout. Siempre referenciar el token.
- En `< lg` la sidebar se renderiza como overlay (no push) y arranca cerrada por default.
- En `≥ lg` arranca expandida; el usuario puede colapsar.

---

## 3. Radius scale (`--radius-*`)

| Token           | Valor      | px  | Origen       |
| --------------- | ---------- | --- | ------------ |
| `--radius-xs`   | `0.25rem`  | 4   | Atelier xs   |
| `--radius-sm`   | `0.375rem` | 6   | Atelier sm   |
| `--radius-md`   | `0.5rem`   | 8   | Atelier md   |
| `--radius-lg`   | `0.75rem`  | 12  | Atelier lg   |
| `--radius-xl`   | `1rem`     | 16  | Atelier xl   |
| `--radius-2xl`  | `1.25rem`  | 20  | Atelier 2xl  |
| `--radius-pill` | `9999px`   | —   | Atelier pill |

Notas:

- `--radius-md` es el default para inputs y buttons (control height baseline).
- `--radius-pill` se aplica como `border-radius: 9999px` en chips, badges, icon buttons, FAB y avatar mobile. No se usa `--radius-full` para evitar colisión con la nomenclatura Tailwind por si el equipo prefiere alias futuro.
- Sheet mobile usa sólo top-radius: `border-radius: var(--radius-2xl) var(--radius-2xl) 0 0`.
- Filter drawer desktop usa sólo left-radius: `border-radius: var(--radius-xl) 0 0 var(--radius-xl)`.

---

## 4. Asignación radius por componente

| Componente                 | Token                   | Notas                                                     |
| -------------------------- | ----------------------- | --------------------------------------------------------- |
| input                      | `--radius-md`           | Default form control.                                     |
| button                     | `--radius-md`           | Primary, secondary, ghost.                                |
| icon button                | `--radius-pill`         | Hit area circular ≥ 40px.                                 |
| card de lista              | `--radius-lg`           | Lista de stores, orders, deliveries.                      |
| section card (form)        | `--radius-xl`           | Bloque de form agrupado por sección.                      |
| sub-card dentro de section | `--radius-lg`           | Una jerarquía menos que la section card que la contiene.  |
| sheet (mobile)             | `--radius-2xl` arriba   | Top-only, base plana contra viewport.                     |
| modal centered             | `--radius-xl`           | Misma curvatura que section card para coherencia.         |
| toast                      | `--radius-lg`           | Más suave que modal, más estructurado que pill.           |
| chip / badge               | `--radius-pill`         | Status, count, tag.                                       |
| avatar mobile              | `--radius-pill`         | Circular en mobile (StoreAvatar).                         |
| avatar desktop             | `--radius-lg`           | Squircle suave en desktop.                                |
| filter drawer (desktop)    | `--radius-xl` borde-izq | Sólo lado izquierdo, ancla al borde derecho del viewport. |
| popover / menu             | `--radius-lg`           | Dropdown, datepicker popover, menu contextual.            |
| tooltip                    | `--radius-sm`           | Compacto, no compite con popovers.                        |
| FAB                        | `--radius-pill`         | Circular siempre.                                         |
| command palette            | `--radius-xl`           | Coherente con modal centered (es overlay full-feature).   |
| skeleton placeholder       | hereda del componente   | Usa el mismo radius del bloque que reemplaza.             |

---

## 5. Breakpoints (`--breakpoint-*`)

Base: Tailwind v4 defaults conservados, más un breakpoint extra abajo (`xs`) para mobile real chico.

| Token              | rem     | px   | Origen           | Uso                                                                                         |
| ------------------ | ------- | ---- | ---------------- | ------------------------------------------------------------------------------------------- |
| `--breakpoint-xs`  | `24rem` | 384  | PandaTrack extra | Detección de mobile real chico (referencia 360px). Ajustes de typografía/density.           |
| `--breakpoint-sm`  | `40rem` | 640  | Tailwind default | Mobile grande / phablet portrait.                                                           |
| `--breakpoint-md`  | `48rem` | 768  | Tailwind default | **Corte mobile/desktop del subproyecto.** Filter drawer pasa de bottom sheet a side drawer. |
| `--breakpoint-lg`  | `64rem` | 1024 | Tailwind default | Sidebar expandido por default. Bento grid 12 cols del dashboard activa.                     |
| `--breakpoint-xl`  | `80rem` | 1280 | Tailwind default | Container max-width admin app. Densidad máxima de columnas en lists.                        |
| `--breakpoint-2xl` | `96rem` | 1536 | Tailwind default | Wide desktop / pantallas externas. No se diseña activamente; sólo se permite scaling.       |

Reglas:

- Mobile real ≤ 767px (`< md`); desktop ≥ 768px (`≥ md`).
- Sidebar: collapsed por default en `< lg`; expanded por default en `≥ lg`.
- Filter drawer: bottom sheet en `< md`; drawer derecho 440px en `≥ md`.
- Bento grid 12 cols del dashboard: activa sólo en `≥ lg`. Entre `md` y `lg` se usa grid simplificado de 8 cols. `< md` colapsa a 4 cols stack.
- Cualquier breakpoint extra (ej. wide-3xl) requiere ADR.

---

## 6. Z-index y stacking contexts

Scale explícita. Ningún componente puede declarar `z-index: 999`, `z-index: 1`, etc. arbitrariamente: siempre se referencia uno de estos tokens.

| Capa               | Token                | Valor | Uso                                                                                             |
| ------------------ | -------------------- | ----- | ----------------------------------------------------------------------------------------------- |
| Base content       | `--z-base`           | `0`   | Contenido del documento. Default.                                                               |
| Sticky elements    | `--z-sticky`         | `10`  | Header sticky de tabla/list, columna sticky, footer sticky de form.                             |
| Sidebar            | `--z-sidebar`        | `20`  | Sidebar de la app shell (push y overlay).                                                       |
| Header             | `--z-header`         | `30`  | Topbar/header global de la app shell. Por encima del sidebar en mobile (hamburger).             |
| Mascot bubble      | `--z-mascot`         | `35`  | Mascota panda flotante. Entre header y popover, no compite con drawers ni modales.              |
| Dropdown / popover | `--z-popover`        | `40`  | Menus contextuales, datepicker popover, autocomplete, select menu.                              |
| Drawer             | `--z-drawer`         | `50`  | Filter drawer derecho desktop.                                                                  |
| Sheet (mobile)     | `--z-sheet`          | `60`  | Bottom sheet mobile (filter, picker, action sheet).                                             |
| Modal backdrop     | `--z-modal-backdrop` | `70`  | Scrim del modal centered y del command palette.                                                 |
| Modal              | `--z-modal`          | `80`  | Modal centered (form multi-step, confirmation).                                                 |
| Toast              | `--z-toast`          | `90`  | Toast neutral-undo, achievement. Por encima de modal porque puede confirmar acciones del modal. |
| Command palette    | `--z-command`        | `100` | ⌘K aspiracional. Overlay full-feature.                                                          |
| Tooltip            | `--z-tooltip`        | `110` | Siempre arriba de todo lo demás. No interactivo.                                                |

Reglas:

- Un nuevo elemento overlay debe mapear a una de estas capas. Si no encaja, el agente abre discusión antes de inventar un nivel intermedio.
- Stacking contexts locales (transform, filter, opacity < 1) pueden romper la jerarquía global; en esos casos se documenta y se usa portal a `body` para overlays.
- Mascot vive entre header (30) y popover (40) intencionalmente: debe verse sobre la app pero nunca obstaculizar inputs activos ni overlays modales.

---

## 7. Mapping `@theme` propuesto (bloque CSS dummy)

```css
@theme {
  /* Spacing base step (Tailwind v4 deriva utilities desde acá) */
  --spacing: 0.25rem;

  /* Spacing scale nombrada */
  --space-0: 0;
  --space-px: 1px;
  --space-0_5: 0.125rem;
  --space-1: 0.25rem;
  --space-1_5: 0.375rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.25rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-10: 2.5rem;
  --space-12: 3rem;
  --space-16: 4rem;
  --space-24: 6rem;
  --space-32: 8rem;
  --space-48: 12rem;

  /* Layout magic numbers semánticos */
  --sidebar-w-expanded: 15rem;
  --sidebar-w-collapsed: 4rem;
  --header-h: 3.5rem;
  --header-h-desktop: 4rem;
  --drawer-w: 27.5rem;
  --sheet-max-h: 92svh;
  --modal-max-w: 32rem;
  --modal-max-w-lg: 48rem;
  --toast-max-w: 22rem;
  --container-max-w: 80rem;
  --container-max-w-prose: 42rem;
  --fab-size: 3.5rem;
  --fab-offset: 1rem;

  /* Radius scale */
  --radius-xs: 0.25rem;
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-2xl: 1.25rem;
  --radius-pill: 9999px;

  /* Breakpoints */
  --breakpoint-xs: 24rem;
  --breakpoint-sm: 40rem;
  --breakpoint-md: 48rem;
  --breakpoint-lg: 64rem;
  --breakpoint-xl: 80rem;
  --breakpoint-2xl: 96rem;

  /* Z-index */
  --z-base: 0;
  --z-sticky: 10;
  --z-sidebar: 20;
  --z-header: 30;
  --z-mascot: 35;
  --z-popover: 40;
  --z-drawer: 50;
  --z-sheet: 60;
  --z-modal-backdrop: 70;
  --z-modal: 80;
  --z-toast: 90;
  --z-command: 100;
  --z-tooltip: 110;
}
```

---

## 8. Riesgos / dudas para el agente principal

1. **Section card padding 28px desktop** — la spec menciona 24/28; 28px no está en el scale base. Propuesta: usar `--space-6` (24) como default y permitir `--space-7` (1.75rem) sólo si reaparece en ≥3 lugares. Confirmar si se promueve a token.
2. **Mascot z-index (35)** — colocado entre header (30) y popover (40). Si la mascota debe poder superponerse a popovers (ej. tutorial guiado), subir a `45` o introducir `--z-mascot-priority`. Dejar pendiente hasta definir comportamiento de onboarding.
3. **`--radius-pill` vs `--radius-full`** — Tailwind v4 default usa `--radius-full = 9999px`. Renombramos a `pill` para alinear con Atelier §4.6, pero rompe el alias automático de Tailwind. Confirmar si conviene mantener ambos (`--radius-full = var(--radius-pill)`) para compatibilidad con utilities `rounded-full`.
4. **Auxiliares Tailwind (`1_5`, `5`, `10`)** — los conservamos por pragmatismo (control heights, padding mobile). Si se quiere purismo Atelier, eliminar y forzar uso del subset estricto. Riesgo: refactor de cada lugar que use `p-5` o `h-10`.
5. **`--breakpoint-xs (384px)`** — no es Tailwind default. Genera utilities `xs:*` nuevas. Confirmar si el equipo quiere ese verbose extra o si basta con media queries puntuales sin token.
6. **Drawer 440px (`27.5rem`)** — no es valor del scale Atelier ni Tailwind. Promovido a `--drawer-w` semántico para evitar literal. Si producto pide drawer más angosto en futuras vistas, este token centraliza el cambio.
7. **Toast por encima de modal (90 > 80)** — decisión deliberada para que confirmaciones de acción modal sean visibles. Si un toast no debiera tapar el modal (ej. error in-modal), se renderiza inline en el modal, no como toast global. Confirmar regla.
8. **Container max-width admin (`--container-max-w = 80rem`)** — alineado con `--breakpoint-xl`. La spec no lo definió explícitamente; lo derivamos para evitar que el bento grid se estire infinitamente en monitores wide.
