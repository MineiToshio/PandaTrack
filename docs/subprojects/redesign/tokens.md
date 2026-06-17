---
title: Sistema de tokens — Velvet (default) + 4 alternativas
last_updated: 2026-05-02
status: final S3
session: 03-tokens
owner: Sergio Minei
supersedes: directions.md §4 (paleta provisional, sin invalidar la estructura)
---

# Sistema de tokens — PandaTrack rediseño

> Este documento es el **contrato vinculante** del sistema de tokens dual-mode (light + dark) para el rediseño de PandaTrack. Reemplaza la paleta provisional de `directions.md` §4.4 (Atelier post-rev 3 con primario Indigo) y la sustituye por **Velvet** como paleta primaria, con 4 alternativas (Lilac, Plum, Lagoon, Forest) que comparten estructura semántica.
>
> **Ámbito:** este archivo define qué tokens existen, qué valores toman en cada modo, qué reglas de uso aplican. La traducción a CSS / Tailwind v4 `@theme` vive en [`tokens-css.md`](./tokens-css.md). El audit de contraste consolidado está en [`_notes/s3-contrast-audit.md`](./_notes/s3-contrast-audit.md). La pasada de red team en [`_notes/s3-red-team.md`](./_notes/s3-red-team.md).

## Reglas duras del sistema

1. **Light y dark son hermanos.** Cada token tiene valor light **y** dark calculados independientemente. No hay tokens "que se invierten" ni `filter: invert(1)`.
2. **WCAG 2.2 AA inviolable** en cada par foreground/background. Mínimos: body/labels/chips ≥4.5:1; UI components, focus, borders fuertes ≥3:1; texto sobre `--accent` ≥4.5:1.
3. **`--text-muted` cumple 4.5:1 incluso a 12-13px** (regla post-rev 2 de Atelier §4.4 promovida a invariante del sistema).
4. **Velvet es la paleta primaria** (ADR 0003 D1). Las otras 4 son alternativas conservadas para validación; el switch del sistema cambia valores, no nombres.
5. **Theme toggle: solo `light` y `dark`** (ADR 0003 D2, supersedea ADR 0001 D14).
6. **Status colors no cambian con la paleta** (`--success`, `--warning`, `--destructive`, `--info` y sus chip-text aliases son cross-paleta).
7. **Identificadores y tokens en inglés.** Documentación en español. Sin emojis salvo ✅ 🟡 ⏳.

---

## Paleta default: Velvet

Atelier nocturno: violeta profundo en light (lienzo plomo-violeta tipo papel de carta antiguo, **no blanco hospital**), azul-violeta nocturno en dark. Calidez "coleccionable / hobby" sin caer en infantil ni clínico.

## Paletas alternativas (mismos nombres semánticos, valores diferentes)

| Paleta     | Light                            | Dark                               | Carácter                                |
| ---------- | -------------------------------- | ---------------------------------- | --------------------------------------- |
| **Velvet** | plomo-violeta cálido h≈285       | azul-violeta nocturno h≈265        | premium "noche elegante" (default)      |
| Lilac      | crema-lila h≈320                 | azul-violeta profundo h≈280        | "diario alegre" sin perder elegancia    |
| Plum       | crema-magenta h≈340              | ciruela profunda h≈340             | "boutique editorial" con presencia      |
| Lagoon     | crema-turquesa h≈195             | turquesa profundo h≈200            | "calma analítica" tipo dashboard        |
| Forest     | crema-verde h≈100 (acento h≈145) | verde bosque h≈145 con texto h≈100 | "sustentable / herbario / coleccionado" |

---

## 1. Tokens core (color)

### 1.1 Lienzo y superficies

| Token                | Velvet light                 | Velvet dark                  | Uso siempre / sólo / nunca                                                                                                                                                                                                |
| -------------------- | ---------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--background`       | `oklch(93% 0.020 285)`       | `oklch(10% 0.028 265)`       | **Siempre:** lienzo raíz de la app. **Nunca** dentro de cards o sub-superficies.                                                                                                                                          |
| `--surface`          | `oklch(96.5% 0.014 285)`     | `oklch(13% 0.028 265)`       | **Siempre:** card por defecto, lista, panel principal de detalle. **Nunca** como acento.                                                                                                                                  |
| `--surface-elevated` | `oklch(95% 0.016 285)`       | `oklch(16% 0.030 265)`       | **Sólo** cuando hay jerarquía visual real con `--surface` (sub-card dentro de card, drawer/sheet body, popover, scroll spy header). En light es **ligeramente más oscuro** que `--surface` (paper-overlap), no más claro. |
| `--surface-overlay`  | `oklch(8% 0.020 285 / 0.55)` | `oklch(4% 0.020 265 / 0.65)` | **Sólo** scrim modal, sheet backdrop, command-palette overlay. **Nunca** como fondo de contenido.                                                                                                                         |

**Decisión cerrada:** `--surface-warm` queda **eliminado** del sistema (ver §11).

### 1.2 Bordes

| Token             | Velvet light           | Velvet dark                 | Uso siempre / sólo / nunca                                                                                                                |
| ----------------- | ---------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `--border`        | `oklch(85% 0.024 285)` | `rgba(200, 200, 255, 0.07)` | **Sólo** divider tenue, card outline decorativa, input idle. **Nunca** como única separación funcional entre dos zonas semánticas.        |
| `--border-strong` | `oklch(74% 0.030 285)` | `rgba(200, 200, 255, 0.14)` | **Sólo** input enfocado pre-ring, separador entre zonas semánticas, borde de avatar fallback, borde funcional ≥3:1. **Nunca** decoración. |

`--border` tiene contraste decorativo (~1.5–1.7:1); si se necesita separación funcional **siempre** escalar a `--border-strong`.

### 1.3 Texto

| Token              | Velvet light           | Velvet dark            | Uso siempre / sólo / nunca                                                                                                                                                                                                           |
| ------------------ | ---------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--text-primary`   | `oklch(22% 0.030 285)` | `oklch(96% 0.012 280)` | **Siempre:** body, headings, valores numéricos centrales del dashboard, label de input enfocado. **Nunca** metadatos secundarios.                                                                                                    |
| `--text-secondary` | `oklch(44% 0.024 285)` | `oklch(76% 0.020 280)` | **Sólo** subtítulos, labels de campo, descripciones cortas, breadcrumbs, **code mono identificador `PT-XXXXXX` y derivados** (ADR 0007 — robustez outdoor). **Sólo** cuando hay un `--text-primary` cercano que define jerarquía.    |
| `--text-muted`     | `oklch(46% 0.022 285)` | `oklch(64% 0.020 280)` | **Sólo** timestamps, eyebrows uppercase, helper text 11–13px. **Nunca** body principal, primer label visible de un campo, ni **code mono identificador `PT-XXXXXX`** (ese va en `--text-secondary` por robustez outdoor — ADR 0007). |
| `--text-on-accent` | `oklch(99% 0.005 285)` | `oklch(99% 0 0)`       | **Sólo** texto sobre `--accent` sólido (CTA primary, badge accent solid). **Nunca** sobre tinte/state-layer del accent.                                                                                                              |

**Nota crítica.** `--text-on-accent` es **blanco puro en ambos modos** (revisado en S3-B.1 — alineado al demo HTML `.btn.primary { color: oklch(99% 0 0) }`). En dark queda 2.55:1 sobre `--accent` brillante (no pasa AA matemático contra el accent puro), pero la decisión humana priorizó la coincidencia visual con el demo y el patrón mental "botón = texto blanco". Cualquier `<Button>` y `<Badge variant="accent">` consume `var(--text-on-accent)`, nunca hardcodea `text-white`.

### 1.4 Acentos

| Token           | Velvet light          | Velvet dark           | Uso siempre / sólo / nunca                                                                                                                                                                                                                                                      |
| --------------- | --------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--accent`      | `oklch(46% 0.20 290)` | `oklch(74% 0.19 290)` | **Siempre:** primary CTA, link principal, focus-ring base, progress bar, avatar fallback (tinte 14% bg / 28% border). **Nunca** íconos de categoría ni decoración no-interactiva.                                                                                               |
| `--accent-warm` | `oklch(64% 0.20 22)`  | `oklch(80% 0.15 25)`  | **Sólo** decorativo: halo achievement, tinte de chip "accent soft", **icon-tile circular soft-tint con glyph Lucide warm dentro** del slot 2 del dashboard ("Próximos 30 días" — receta canónica en ADR 0005). **Nunca** texto sobre `--background` ni CTA ni cifra de métrica. |
| `--accent-cool` | `oklch(58% 0.10 215)` | `oklch(74% 0.11 215)` | **Sólo** color de íconos Lucide de categoría **siempre con label adyacente** (ADR 0006), e info inline cuando coexiste con `--accent` indigo. **Nunca** background, border, color de texto, CTA, focus, status semántico, ni icon-only sin label.                               |

**Cambios respecto a Atelier §4.4 original:**

- `--accent`: hue **290** (Velvet violeta profundo) en lugar de 268 (Indigo). ADR 0003 D1.
- `--accent-cool`: hue **215** (azul-gris suave) en lugar de 195 (teal franco). Documentado en §11.
- `--accent-warm`: nueva regla — **decorativo, no texto sobre background**. Resuelve el fallo cross-paleta de Lilac warm L=0.72 sobre lienzo claro (2.46:1). El slot 2 del dashboard (ADR 0001 D8) usa la cifra en `--text-primary` con un mini-decorador `--accent-warm`, no la cifra en color warm. Documentado en §10.

### 1.5 Status (compartidos cross-paleta)

| Token           | Light                 | Dark                  | Uso siempre / sólo / nunca                                                                                                                                                                                                         |
| --------------- | --------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--success`     | `oklch(58% 0.15 152)` | `oklch(74% 0.16 152)` | **Sólo** pago confirmado, entrega completa, achievement chip, toast success. **Nunca** decoración no-semántica.                                                                                                                    |
| `--warning`     | `oklch(70% 0.16 75)`  | `oklch(82% 0.15 75)`  | **Sólo** pago vencido / "atrasado N días" (ADR 0001 D1). **Nunca** "esperando algo" sin urgencia (eso es `--info`).                                                                                                                |
| `--destructive` | `oklch(54% 0.21 25)`  | `oklch(70% 0.18 25)`  | **Sólo** delete confirm, error feedback, toast destructive. **Nunca** decoración ni "atención sin riesgo".                                                                                                                         |
| `--info`        | `oklch(58% 0.14 245)` | `oklch(78% 0.13 245)` | **Sólo** status "pendiente sin urgencia" (chip **siempre con ícono `clock` + label de texto** — ADR 0006 contrato vinculante), inline notice neutra (ADR 0001 D1). **Nunca** CTAs, focus, íconos de categoría, ni chip color-only. |

**Cambio respecto al demo HTML.** `--info` se mueve de h230 → **h245** (azul más franco) para diferenciarse visualmente de `--accent-cool` (h215). En h230 daba ΔL=2 / Δh=15 contra accent-cool en dark — indistinguible lado a lado. Con h245 da Δh=30. **Importante (ADR 0006):** el research de daltonismo (Brettel/Viénot 1997) demuestra que h215 y h245 colapsan al mismo cuadrante de la _confusion plane_ en deuteranopia/protanopia — **mover los hues no resuelve el problema de raíz**. La mitigación correcta es el contrato "ícono + label obligatorio" formalizado en ADR 0006.

#### Recetas de chip (color-mix vinculantes)

```css
/* Chip background: tinte del status sobre el background actual */
background: color-mix(in oklch, var(--success) 14%, var(--background));

/* Chip border: tinte más intenso */
border: 1px solid color-mix(in oklch, var(--success) 28%, var(--background));

/* Chip text: usar variante chip-text en light; en dark usar el token base */
color: var(--success-chip-text);
```

#### Tokens de texto de chip (necesarios en light)

El color status base no pasa 4.5:1 sobre el chip @14% en light. Se introducen alias:

| Token                     | Light                 | Dark (= status base)  |
| ------------------------- | --------------------- | --------------------- |
| `--success-chip-text`     | `oklch(42% 0.13 152)` | `oklch(74% 0.16 152)` |
| `--warning-chip-text`     | `oklch(40% 0.10 75)`  | `oklch(82% 0.15 75)`  |
| `--destructive-chip-text` | `oklch(45% 0.20 25)`  | `oklch(70% 0.18 25)`  |
| `--info-chip-text`        | `oklch(40% 0.13 245)` | `oklch(78% 0.13 245)` |

Estos alias también son cross-paleta.

### 1.6 Focus + state layers

| Token          | Velvet light                 | Velvet dark                  | Uso                                                                                 |
| -------------- | ---------------------------- | ---------------------------- | ----------------------------------------------------------------------------------- |
| `--focus-ring` | `oklch(46% 0.20 290 / 0.55)` | `oklch(74% 0.19 290 / 0.65)` | **Sólo** outline de cualquier `:focus-visible`. **Nunca** como fill ni en `:hover`. |

#### State layers (recetas color-mix vinculantes)

| Estado     | Light                                                                                                                         | Dark                                                        | Notas                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `hover`    | `color-mix(in oklch, var(--text-primary) 6%, transparent)`                                                                    | `color-mix(in oklch, var(--text-primary) 8%, transparent)`  | Aplicar como overlay (`background-color`) por encima de la superficie del control.          |
| `pressed`  | `color-mix(in oklch, var(--text-primary) 12%, transparent)`                                                                   | `color-mix(in oklch, var(--text-primary) 14%, transparent)` | Reemplaza la capa de hover durante el `:active`.                                            |
| `selected` | bg `color-mix(in oklch, var(--accent) 14%, var(--surface))` · border `color-mix(in oklch, var(--accent) 28%, var(--surface))` | mismo patrón con `--accent` y `--surface` dark              | Patrón de filter chip activo, sidebar item activo, opción seleccionada en lista.            |
| `disabled` | text → `var(--text-muted)`, border → `var(--border)`. **No usar `opacity`.**                                                  | mismo                                                       | ADR 0001 D3: nada de `opacity:.5` global. El bajo contraste se logra con tokens semánticos. |

---

## 2. Paleta categórica

**Decisión final S3:** **eliminada** del sistema de tokens. Ver [`decisions/0004-categorical-palette-removal.md`](./decisions/0004-categorical-palette-removal.md).

Justificación: el MVP no incluye charts ni vistas analíticas. Atelier §4.4 la dejaba "reservada" con 6 hues (`--cat-figures`, `--cat-vinyl`, `--cat-manga`, `--cat-anime`, `--cat-cards`, `--cat-plush`), pero ningún wireframe S2 la invoca como decoración (la identidad de categoría vive en **íconos Lucide** en `--accent-cool`). Mantener 6 tokens sin uso ni implementación es deuda visual y técnica. Cuando V2 introduzca charts, se diseñará un set dedicado `--chart-1..N` con paleta calibrada para data-viz (no necesariamente la misma).

Implicancia: cualquier referencia a `--cat-*` en docs históricos (`directions.md` §4.4 Tabla Reservada) queda como **referencia histórica** — no debe replicarse en código.

---

## 3. Typography

### 3.1 Stack

| Familia                 | Token            | Rol                                                                            |
| ----------------------- | ---------------- | ------------------------------------------------------------------------------ |
| Inter Variable          | `--font-sans`    | Body, UI, formularios, controles, lista, tabla, todos los tiers ≤ Subtitle.    |
| Inter Display           | `--font-display` | Display y Title (números héroe, headings ceremoniales, hero del dashboard).    |
| JetBrains Mono Variable | `--font-mono`    | Mono code, mono badges, IDs, eyebrows uppercase, tabular numerals secundarios. |

**Decisión:** Geist Variable descartado. Inter Display son cuts ópticos del mismo familiar Inter; mezclar Inter body + Geist display generaría salto métrico al transicionar entre tamaños.

Stacks declarados:

- `--font-sans`: `"Inter Variable", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif`
- `--font-display`: `"Inter Display", "Inter Variable", "Inter", system-ui, sans-serif`
- `--font-mono`: `"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace`

### 3.2 Escala

Cada tier produce 3 sub-properties Tailwind v4: `--text-{name}` (size), `--text-{name}--line-height`, `--text-{name}--letter-spacing`.

| Tier     | Token Tailwind  | Size                                | Line-height       | Letter-spacing | Weight default (light / dark) | Familia          | Uso                                                                                   |
| -------- | --------------- | ----------------------------------- | ----------------- | -------------- | ----------------------------- | ---------------- | ------------------------------------------------------------------------------------- |
| Display  | `text-display`  | `clamp(2.5rem, 4vw + 1rem, 3.5rem)` | `4rem` (64px)     | `-0.03em`      | 700 / 670                     | `--font-display` | Hero numérico del dashboard, monto principal de "Próximo pago".                       |
| Title    | `text-title`    | `2rem` (32px)                       | `2.5rem` (40px)   | `-0.02em`      | 600 / 580                     | `--font-display` | Títulos de página, headings de sección de detalle.                                    |
| Subtitle | `text-subtitle` | `1.375rem` (22px)                   | `1.75rem` (28px)  | `-0.01em`      | 600 / 600                     | `--font-sans`    | Headings de card, modal title, sub-sección.                                           |
| Body-L   | `text-body-lg`  | `1.0625rem` (17px)                  | `1.625rem` (26px) | `0`            | 400 / 400                     | `--font-sans`    | Subtítulo descriptivo del hero, body de empty state, intro de modal.                  |
| Body     | `text-body`     | `0.9375rem` (15px)                  | `1.375rem` (22px) | `0`            | 400 / 400 (medium 500 / 480)  | `--font-sans`    | Body por defecto: card, párrafo, label, valor.                                        |
| Caption  | `text-caption`  | `0.8125rem` (13px)                  | `1.125rem` (18px) | `+0.005em`     | 500 / 500                     | `--font-sans`    | Helper text, footnote, microcopy.                                                     |
| Mono-L   | `text-mono-lg`  | `0.9375rem` (15px)                  | `1.375rem` (22px) | `0`            | 500 / 500                     | `--font-mono`    | Códigos visibles en cards de detalle.                                                 |
| Mono     | `text-mono`     | `0.8125rem` (13px)                  | `1.125rem` (18px) | `+0.02em`      | 500 / 500                     | `--font-mono`    | Mono inline dentro de body, badge mono, micro-stat label tabular.                     |
| Eyebrow  | `text-eyebrow`  | `0.6875rem` (11px)                  | `0.875rem` (14px) | `+0.08em`      | 500 / 500                     | `--font-mono`    | Eyebrow uppercase ceremonial. Token nuevo (reemplaza `text-[11px] uppercase` ad-hoc). |

### 3.3 Pesos (tokens auxiliares)

```
--font-weight-regular: 400
--font-weight-medium: 500
--font-weight-semibold: 600
--font-weight-display: 700  (dark: 670)
--font-weight-title: 600    (dark: 580)
--font-weight-medium-body: 500  (dark: 480)
--font-weight-mono: 500
```

Componentes y utilities consumen `var(--font-weight-display)` etc., **nunca** literal `font-weight: 700`. Esto evita branching por modo.

### 3.4 `font-feature-settings` por tier

| Tier          | features                 | Justificación                                                                                                               |
| ------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Display       | `"ss01", "cv11", "tnum"` | Alternates editoriales del Inter Display + `1` sin serif horizontal (clave para hero numéricos) + tabular nums obligatorio. |
| Title         | `"ss01", "cv11"`         | Mismo set para coherencia.                                                                                                  |
| Subtitle      | (ninguno por default)    | Inter sans estándar.                                                                                                        |
| Body-L / Body | (ninguno por default)    | Body neutro. Activar `tnum` solo cuando renderiza cifras (vía utility `.numeric`).                                          |
| Caption       | (ninguno por default)    | Idem body.                                                                                                                  |
| Mono-L / Mono | `"calt", "ss01"`         | Alternates contextuales JetBrains Mono (separa `1` de `l`, `0` de `O`).                                                     |
| Eyebrow       | `"calt", "ss01"`         | Mismo que mono.                                                                                                             |

**Regla transversal:** toda cifra renderizada por el sistema usa `font-variant-numeric: tabular-nums` + `font-feature-settings: "tnum"`. Expuesto como utility `.numeric`.

### 3.5 Comportamiento por modo

Única diferencia tipográfica entre modos:

- **Display weight:** light 700 → dark 670 (compensa engrosamiento óptico).
- **Title weight:** light 600 → dark 580.
- **Body medium weight:** light 500 → dark 480.
- **Body color:** dark a 96% L (no 100%) — heredado de `--text-primary`.
- **Italic prohibido** en cualquier tier (regla heredada).

---

## 4. Spacing

Base step Tailwind v4: `--spacing = 0.25rem` (4px). Scale extendida nombrada:

| Token         | rem        | px  | Uso típico                                                     |
| ------------- | ---------- | --- | -------------------------------------------------------------- |
| `--space-0`   | `0`        | 0   | Reset; nunca para separar contenido legible.                   |
| `--space-px`  | `1px`      | 1   | Bordes hairline.                                               |
| `--space-0_5` | `0.125rem` | 2   | Ajustes tipográficos finos, micro-padding de badge dot.        |
| `--space-1`   | `0.25rem`  | 4   | Gap icono–icono en grupo.                                      |
| `--space-1_5` | `0.375rem` | 6   | Auxiliar conservado.                                           |
| `--space-2`   | `0.5rem`   | 8   | Padding vertical chip, gap label–input.                        |
| `--space-3`   | `0.75rem`  | 12  | Padding interno input/button, gap entre fields en row.         |
| `--space-4`   | `1rem`     | 16  | Padding base de card pequeña, gap vertical entre fields.       |
| `--space-5`   | `1.25rem`  | 20  | Padding interno section card en mobile.                        |
| `--space-6`   | `1.5rem`   | 24  | Padding interno section card desktop. Gap entre section cards. |
| `--space-8`   | `2rem`     | 32  | Gap entre bloques de página.                                   |
| `--space-10`  | `2.5rem`   | 40  | Auxiliar; control height baseline.                             |
| `--space-12`  | `3rem`     | 48  | Gap entre secciones temáticas, header desktop height.          |
| `--space-16`  | `4rem`     | 64  | Sidebar collapsed width, padding superior empty states.        |
| `--space-24`  | `6rem`     | 96  | Padding vertical empty states full-page.                       |
| `--space-32`  | `8rem`     | 128 | Padding vertical hero landing desktop.                         |
| `--space-48`  | `12rem`    | 192 | Reservado landing splash. Nunca dentro del admin app.          |

Decisiones de aplicación (vinculantes):

- Section card padding desktop = `--space-6` (24px); mobile = `--space-5` (20px).
- Form field row gap = `--space-4`; column gap (label → input) = `--space-2`.
- Section-to-section gap = `--space-6` mobile / `--space-8` desktop.

### Layout magic numbers (no son spacing — son contratos del shell)

| Token                     | Valor     | px   | Uso                                                                     |
| ------------------------- | --------- | ---- | ----------------------------------------------------------------------- |
| `--sidebar-w-expanded`    | `15rem`   | 240  | Sidebar admin expandido (push, no overlay en `≥ lg`).                   |
| `--sidebar-w-collapsed`   | `4rem`    | 64   | Sidebar collapsed (sólo iconos).                                        |
| `--header-h`              | `3.5rem`  | 56   | Header sticky mobile.                                                   |
| `--header-h-desktop`      | `4rem`    | 64   | Header sticky desktop.                                                  |
| `--drawer-w`              | `27.5rem` | 440  | Filter drawer derecho desktop. En `< md` se transforma en bottom sheet. |
| `--sheet-max-h`           | `92svh`   | —    | Bottom sheet mobile máx alto.                                           |
| `--modal-max-w`           | `32rem`   | 512  | Modal centered default.                                                 |
| `--modal-max-w-lg`        | `48rem`   | 768  | Modal centered grande (forms multi-step).                               |
| `--toast-max-w`           | `22rem`   | 352  | Ancho máximo toast individual.                                          |
| `--container-max-w`       | `80rem`   | 1280 | Ancho máximo de página admin.                                           |
| `--container-max-w-prose` | `42rem`   | 672  | Ancho máximo prose/lectura.                                             |
| `--fab-size`              | `3.5rem`  | 56   | FAB diámetro mobile.                                                    |
| `--fab-offset`            | `1rem`    | 16   | Offset desde borde de viewport.                                         |

Regla: **ningún componente declara literal** `240px`, `64px`, `440px` para layout. Siempre referencia el token.

---

## 5. Radius

| Token           | Valor      | px  |
| --------------- | ---------- | --- |
| `--radius-xs`   | `0.25rem`  | 4   |
| `--radius-sm`   | `0.375rem` | 6   |
| `--radius-md`   | `0.5rem`   | 8   |
| `--radius-lg`   | `0.75rem`  | 12  |
| `--radius-xl`   | `1rem`     | 16  |
| `--radius-2xl`  | `1.25rem`  | 20  |
| `--radius-pill` | `9999px`   | —   |

Asignación por componente:

| Componente                 | Token                   |
| -------------------------- | ----------------------- |
| input                      | `--radius-md`           |
| button                     | `--radius-md`           |
| icon button                | `--radius-pill`         |
| card de lista              | `--radius-lg`           |
| section card (form)        | `--radius-xl`           |
| sub-card dentro de section | `--radius-lg`           |
| sheet (mobile)             | `--radius-2xl` arriba   |
| modal centered             | `--radius-xl`           |
| toast                      | `--radius-lg`           |
| chip / badge               | `--radius-pill`         |
| avatar mobile              | `--radius-pill`         |
| avatar desktop             | `--radius-lg`           |
| filter drawer (desktop)    | `--radius-xl` borde-izq |
| popover / menu             | `--radius-lg`           |
| tooltip                    | `--radius-sm`           |
| FAB                        | `--radius-pill`         |
| command palette            | `--radius-xl`           |
| skeleton placeholder       | hereda del componente   |

Notas:

- Sheet mobile usa sólo top-radius: `border-radius: var(--radius-2xl) var(--radius-2xl) 0 0`.
- Filter drawer desktop usa sólo left-radius: `border-radius: var(--radius-xl) 0 0 var(--radius-xl)`.

---

## 6. Elevation

Mismos identificadores en ambos modos (`--elevation-1` … `--elevation-4`); valor distinto por modo. Light usa sombras reales con alfa bajo (slate frío `rgba(20, 22, 30, ...)`); dark **no usa sombra real** — composición de tono + borde + highlight inset + glow accent puntual.

### 6.1 Light (sombras reales suaves)

| Token           | Valor                                                                  | Uso                                               |
| --------------- | ---------------------------------------------------------------------- | ------------------------------------------------- |
| `--elevation-1` | `0 1px 2px rgba(20, 22, 30, 0.04)`                                     | Cards de lista.                                   |
| `--elevation-2` | `0 4px 12px rgba(20, 22, 30, 0.06), 0 1px 2px rgba(20, 22, 30, 0.04)`  | Section cards, popover, dropdown, drawer derecho. |
| `--elevation-3` | `0 12px 24px rgba(20, 22, 30, 0.08), 0 2px 6px rgba(20, 22, 30, 0.06)` | Modal, sheet, mascot bubble.                      |
| `--elevation-4` | `0 24px 48px rgba(20, 22, 30, 0.12)`                                   | Command palette, assistant expandida.             |

### 6.2 Dark (composiciones sin sombra real)

| Token           | Valor                                                                                                                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--elevation-1` | `inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 0 0 1px var(--border)`                                                                                                                                                   |
| `--elevation-2` | `inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 0 0 1px var(--border-strong)`                                                                                                                                            |
| `--elevation-3` | `inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 0 0 1px var(--border-strong), 0 -1px 8px color-mix(in oklch, var(--accent) 6%, transparent)`                                                                             |
| `--elevation-4` | `inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 0 0 1px var(--border-strong), 0 -1px 8px color-mix(in oklch, var(--accent) 6%, transparent), 0 16px 64px -16px color-mix(in oklch, var(--accent-cool) 12%, transparent)` |

Asignación por componente:

| Componente                            | Elevation                            |
| ------------------------------------- | ------------------------------------ |
| Card de lista                         | `1`                                  |
| Row hover (no eleva, usa state layer) | `0`                                  |
| Section card de formulario            | `2`                                  |
| Popover / dropdown                    | `2`                                  |
| Sheet (mobile)                        | `3`                                  |
| Modal centered                        | `3`                                  |
| Drawer derecho                        | `2`                                  |
| Toast neutral-undo (ADR 0001 D4)      | `2`                                  |
| Toast achievement                     | `3` + halo achievement (composición) |
| Command palette                       | `4`                                  |
| Mascot bubble flotante                | `3`                                  |
| FAB                                   | `2`                                  |

Halo achievement (composición ad-hoc, **no token**):

```css
box-shadow:
  var(--elevation-3),
  0 0 0 1px color-mix(in oklch, var(--accent-warm) 24%, transparent),
  0 8px 32px color-mix(in oklch, var(--accent-warm) 14%, transparent);
```

---

## 7. Motion

### 7.1 Duraciones

| Token           | Valor   | Uso                                                                      |
| --------------- | ------- | ------------------------------------------------------------------------ |
| `--motion-fast` | `150ms` | hover, focus, toggle, ripple state layer, tooltip in/out.                |
| `--motion-base` | `280ms` | sheet, modal, drawer, page transition, step transition, view-transition. |
| `--motion-slow` | `480ms` | celebraciones, achievements, mascot peeking. **No** navegación.          |

### 7.2 Easings

| Token                   | Valor                                        | Uso                                                            |
| ----------------------- | -------------------------------------------- | -------------------------------------------------------------- |
| `--ease-emphasis`       | `cubic-bezier(0.2, 0, 0, 1)`                 | opacity, color, focus ring, background-color.                  |
| `--ease-out-expressive` | `linear(0, 0.5, 0.85, 0.97, 1)`              | sheets, modals, page transitions, step transitions, transform. |
| `--ease-bounce`         | `linear(0, 0.32, 0.68, 0.92, 1.08, 1.04, 1)` | celebraciones, mascot peek/celebrate.                          |
| `--ease-vt-signature`   | `linear(0, 0.18, 0.5, 0.78, 0.95, 1.02, 1)`  | **Sólo** view-transitions. Nunca fuera.                        |

### 7.3 Firma view-transition canónica

```css
::view-transition-group(*) {
  animation-duration: var(--motion-base); /* 280ms fijos */
  animation-timing-function: var(--ease-vt-signature);
}
```

Reglas vinculantes (ADR 0001 D5):

- Convención de nombre: `view-transition-name: order-{humanId}` (ej. `order-PT-002418`). Extensiones: `delivery-{humanId}`, `store-{slug}`.
- **Duración fija 280ms.** No customizar.
- **Easing único `--ease-vt-signature`** (spring overshoot 0.05). No usar `--ease-out-expressive` ni `--ease-bounce`.
- Sólo la row clickeada/focused recibe el `view-transition-name` (delegación dinámica).
- Avatar tienda mantiene tinte indigo continuo durante el morph.
- Código mono crece 11→13px sin re-render (animar `font-size` en mismo nodo).
- Chip status hace micro-pausa de 40ms entre 120ms y 160ms.
- Body de la card: fade simple, sin `view-transition-name` compartido.

### 7.4 `prefers-reduced-motion`

Receta vinculante:

- Toda transición se reduce a `opacity` + `transform: none` con `--motion-fast` (150ms).
- Spring easings (`--ease-bounce`, `--ease-vt-signature`) se reemplazan por `--ease-emphasis`.
- View transitions: la firma se desactiva — corte directo (`animation-duration: 0.01ms`).
- Mascota panda queda en `idle` siempre (no walking, no peeking, no celebrating animado).
- Stagger animations: desactivadas (todo aparece simultáneo).

Bloque CSS canónico (incluir una sola vez):

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 150ms !important;
    scroll-behavior: auto !important;
  }
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation-duration: 0.01ms !important;
  }
}
```

---

## 8. Z-index y stacking contexts

Scale explícita. Ningún componente declara `z-index` arbitrario; siempre referencia uno de estos tokens.

| Capa               | Token                | Valor | Uso                                                                                   |
| ------------------ | -------------------- | ----- | ------------------------------------------------------------------------------------- |
| Base content       | `--z-base`           | `0`   | Default.                                                                              |
| Sticky elements    | `--z-sticky`         | `10`  | Header sticky de tabla, columna sticky, footer sticky de form.                        |
| Sidebar            | `--z-sidebar`        | `20`  | Sidebar de la app shell (push y overlay).                                             |
| Header             | `--z-header`         | `30`  | Topbar global. Por encima del sidebar en mobile (hamburger).                          |
| Mascot bubble      | `--z-mascot`         | `35`  | Mascota panda flotante. Entre header y popover; no compite con drawers ni modales.    |
| Dropdown / popover | `--z-popover`        | `40`  | Menus contextuales, datepicker popover, autocomplete, select menu.                    |
| Drawer             | `--z-drawer`         | `50`  | Filter drawer derecho desktop.                                                        |
| Sheet (mobile)     | `--z-sheet`          | `60`  | Bottom sheet mobile.                                                                  |
| Modal backdrop     | `--z-modal-backdrop` | `70`  | Scrim del modal centered y del command palette.                                       |
| Modal              | `--z-modal`          | `80`  | Modal centered (form multi-step, confirmation).                                       |
| Toast              | `--z-toast`          | `90`  | Toast neutral-undo, achievement. Por encima de modal para confirmar acciones modales. |
| Command palette    | `--z-command`        | `100` | ⌘K aspiracional.                                                                      |
| Tooltip            | `--z-tooltip`        | `110` | Siempre arriba.                                                                       |

---

## 9. Breakpoints

Tailwind v4 defaults conservados + un breakpoint extra `xs` para mobile real chico (referencia 360px).

| Token              | rem     | px   | Origen           | Uso                                                                                         |
| ------------------ | ------- | ---- | ---------------- | ------------------------------------------------------------------------------------------- |
| `--breakpoint-xs`  | `24rem` | 384  | PandaTrack extra | Detección de mobile real chico. Ajustes de typografía/density.                              |
| `--breakpoint-sm`  | `40rem` | 640  | Tailwind default | Mobile grande / phablet.                                                                    |
| `--breakpoint-md`  | `48rem` | 768  | Tailwind default | **Corte mobile/desktop del subproyecto.** Filter drawer pasa de bottom sheet a side drawer. |
| `--breakpoint-lg`  | `64rem` | 1024 | Tailwind default | Sidebar expandido por default. Bento grid 12 cols del dashboard activa.                     |
| `--breakpoint-xl`  | `80rem` | 1280 | Tailwind default | Container max-width admin. Densidad máxima de columnas en lists.                            |
| `--breakpoint-2xl` | `96rem` | 1536 | Tailwind default | Wide desktop. No se diseña activamente; sólo scaling.                                       |

Reglas:

- Mobile real ≤ 767px (`< md`); desktop ≥ 768px (`≥ md`).
- Sidebar collapsed por default en `< lg`; expanded por default en `≥ lg`.
- Filter drawer: bottom sheet en `< md`; drawer derecho 440px en `≥ md`.
- Bento grid 12 cols del dashboard: activa sólo en `≥ lg`. Entre `md` y `lg` se usa grid simplificado de 8 cols. `< md` colapsa a 4 cols stack.

---

## 10. Reglas de uso (jerarquía Primary / Extra / Reservada)

Versión actualizada de la tabla de Atelier §4.4 con Velvet aplicado y las decisiones de los ADRs 0001/0002/0003/0004/0005/0006/0007.

| Token                                                                  | Tier          | Siempre se usa para                                                                             | Sólo se usa para                                                                                                                                              | Nunca se usa para                                                                   |
| ---------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `--background`, `--surface`, `--surface-elevated`, `--surface-overlay` | **Primary**   | Lienzo + cards + overlays                                                                       | —                                                                                                                                                             | Acentos, decoración cromática                                                       |
| `--text-primary`                                                       | **Primary**   | Body, headings, valores en cifras, labels activos                                               | —                                                                                                                                                             | Decoración, fondos                                                                  |
| `--text-secondary`                                                     | **Primary**   | Meta, captions, labels de form, helpers, **code mono identificador `PT-XXXXXX`** (ADR 0007)     | —                                                                                                                                                             | Body principal (usar `--text-primary`)                                              |
| `--text-muted`                                                         | **Primary**   | Timestamps, eyebrows uppercase, helper 11–13px, code mono inline no-identificador               | —                                                                                                                                                             | Body principal, CTA labels, **code mono identificador `PT-XXXXXX`** (ADR 0007)      |
| `--text-on-accent`                                                     | **Primary**   | Texto sobre `--accent` sólido                                                                   | —                                                                                                                                                             | Sobre tinte/state-layer del accent                                                  |
| `--border`, `--border-strong`                                          | **Primary**   | Dividers, input borders, card outlines                                                          | —                                                                                                                                                             | Como única separación funcional sin escalar a `--border-strong`                     |
| `--accent` (Velvet violeta h290)                                       | **Primary**   | Primary CTA, focus ring, links principales, progress bar, avatar fallback tinte 14% / borde 28% | Estado active de big choice cards y chips                                                                                                                     | Decoración pura, dots de eyebrow, íconos de categoría (esos van en `--accent-cool`) |
| `--accent-warm` (coral)                                                | **Extra**     | —                                                                                               | Halo achievement, tinte chip "accent soft", **icon-tile circular soft-tint con glyph Lucide warm dentro** del slot 2 del dashboard (receta canónica ADR 0005) | Texto sobre `--background`, CTAs, fondos completos, avatares, cifra de métrica      |
| `--accent-cool` (azul-gris suave h215)                                 | **Extra**     | —                                                                                               | Color de íconos Lucide de categoría **siempre con label adyacente** (contrato ADR 0006), info inline cuando coexiste con `--accent`                           | CTAs, focus, texto, status semántico, **background, border, icon-only sin label**   |
| `--success`                                                            | **Extra**     | —                                                                                               | Pago confirmado, entrega completa, status chip "100% pagado", achievement                                                                                     | Decoración, fondos extensos                                                         |
| `--warning`                                                            | **Extra**     | —                                                                                               | Pago vencido, status chip "atrasado N días", métrica "atrasado" del dashboard                                                                                 | "Pendiente sin urgencia" (eso es `--info`), CTAs, body                              |
| `--destructive`                                                        | **Extra**     | —                                                                                               | Botones de delete, error feedback, métricas con valor negativo                                                                                                | Decoración, status normal                                                           |
| `--info`                                                               | **Extra**     | —                                                                                               | "Pendiente sin urgencia" — chip **siempre con ícono `clock` + label de texto** (contrato vinculante ADR 0006), inline notice neutra                           | CTAs, focus, íconos de categoría (esos van en `--accent-cool`), **chip color-only** |
| `--focus-ring`                                                         | **Primary**   | Cualquier `:focus-visible`                                                                      | —                                                                                                                                                             | Hover state, decoración                                                             |
| Paleta categórica                                                      | **Eliminada** | (no aplica — ver §2 + ADR 0004)                                                                 | —                                                                                                                                                             | (cualquier referencia es deuda histórica)                                           |

**Regla de oro.** Una pantalla típica usa **3–4 tokens cromáticos visibles máximo** (`--accent` Velvet + 1 status + opcionalmente `--accent-warm` o `--accent-cool` para 1 elemento puntual). Si una pantalla tiene 6+ colores visibles a la vez, está rota.

---

## 11. Decisiones residuales cerradas

### 11.1 Paleta categórica → eliminada

Atelier §4.4 la dejaba "reservada" con 6 hues. Decisión S3: **eliminar del sistema** vía [ADR 0004](./decisions/0004-categorical-palette-removal.md). Justificación: MVP sin charts; cero invocaciones en wireframes S2; identidad de categoría vive en íconos Lucide en `--accent-cool`. Cuando V2 introduzca data-viz, se diseñará `--chart-1..N` con paleta dedicada.

**Confirmado por research follow-up** (`_notes/s3-research-categorical-palette.md`): 6/6 apps de hobby (Letterboxd, Goodreads, Discogs, AniList, Untappd, Backloggd) NO usan color por categoría a pesar de manejar cientos de géneros. POPMART/Vivino son excepciones por razones específicas (artwork-heavy / objeto físico literalmente coloreado). Material 3 + Carbon + Cloudscape reservan paleta categórica estrictamente para data viz.

### 11.2 `--accent-cool` → mantenido con nueva semántica

| Aspecto       | Atelier §4 original                   | Velvet (esta versión)                                                |
| ------------- | ------------------------------------- | -------------------------------------------------------------------- |
| Hue           | h195 (teal franco)                    | **h215 (azul-gris suave)**                                           |
| Carácter      | Acento secundario "fresco / acuático" | Acento secundario "sereno / informativo no urgente"                  |
| Uso permitido | Íconos decorativos opcionales         | Íconos de categoría Lucide e info inline coexistiendo con `--accent` |
| Uso prohibido | (no formalizado)                      | CTAs, focus, status semántico, texto                                 |

Justificación: el teal h195 introducía una tercera familia cromática que competía con `--accent` violeta. h215 lo mantiene en la misma "vecindad" perceptual que `--info` (h245) pero con menor croma y L distinta, funcionando como acento neutro sin generar bandera de status.

**Confirmado por research follow-up** (`_notes/s3-research-colorblind-info.md`): Brettel/Viénot/Mollon (1997) demuestra que en deutan/protan, h215 y h245 colapsan al mismo cuadrante de la _confusion plane_ — mover los hues no resuelve nada estructuralmente. La mitigación correcta es ortogonal al color: el contrato vinculante "ícono + label" ([ADR 0006](./decisions/0006-color-blindness-icon-label-contract.md)) garantiza distinguibilidad para usuarios dichromat sin tocar tokens.

### 11.3 `--surface-warm` → eliminado

Atelier §4 lo definía como superficie con tinte cálido extra. En Velvet:

1. El propio `--surface` ya es plomo-violeta cálido (h285, L=0.965 light): un "warm extra" sería casi imperceptible y rompería la jerarquía background → surface → surface-elevated.
2. Wireframes S2 nunca lo invocan — todo el calor visual viene de `--accent-warm` aplicado a métrica/halo, no a un fondo.
3. Cuando una sub-card requiera diferenciación cálida, se resuelve con `state-layer` accent soft: `color-mix(in oklch, var(--accent-warm) 14%, var(--surface))`.

**Eliminado del sistema.**

### 11.4 Pixel art vs AI hi-res render → diferido a S6

No bloquea tokens. La decisión final del render de la mascota (pixel art recomendado por Atelier §4.10) se toma en S6 con mocks reales. Los tokens de elevation, motion y color soportan ambos caminos sin cambios.

### 11.5 `--accent-warm` reformulado como decorativo + receta canónica del slot 2 dashboard

[ADR 0005](./decisions/0005-dashboard-microstat-icon-tile.md) materializa la decisión D8 de ADR 0001 ("color del slot 2 = `--accent-warm`") como **patrón canónico icon-tile**: cifra en `--text-primary`, label eyebrow en `--text-muted`, y un **icon-tile circular soft-tint** (32-36px) con `bg = color-mix(--accent-warm 14%, --surface)` + `border = color-mix(--accent-warm 28%, --surface)` + glyph Lucide en `--accent-warm` adentro. El patrón se generaliza a los 4 slots del dashboard (cada uno con su token funcional).

Resuelve el fallo cross-paleta (Lilac warm 2.46:1 sobre lienzo claro) sin oscurecer warm cross-paleta. **Confirmado por research follow-up** (`_notes/s3-research-accent-warm-metric.md`): convergencia de 11+ apps (Shopify Polaris, IBM Carbon, Material 3, Tailwind UI, Plausible, Apple Health Rings, YNAB, Cash App, Dell, Power BI canónico) en el patrón "cifra neutra + decorador asociado".

### 11.6 Code mono identificador en `--text-secondary` (no `--text-muted`)

[ADR 0007](./decisions/0007-text-muted-outdoor-code-mono-reassignment.md) reasigna el code mono identificador (`PT-XXXXXX`, `delivery-{humanId}`, `store-{slug}` cuando se renderiza como código) de `--text-muted` (5.81:1) a `--text-secondary` (6.32:1) por robustez outdoor.

Razón: el code mono identificador es **el caso outdoor-crítico** del sistema — string denso, función dependiente del reconocimiento exacto carácter por carácter, aparece en listas mobile que el usuario consulta en exteriores. **Confirmado por research follow-up** (`_notes/s3-research-text-muted-outdoor.md`): apps outdoor-heavy (Strava 10:1, Komoot 7.5:1, AllTrails 6.8:1) usan ratios mayores; PandaTrack no es outdoor-heavy pero sí tiene un caso crítico. La solución no toca tokens — sólo reasigna el caso al token de mayor contraste que ya existe, preservando la jerarquía visual `--text-muted` (L=46%) > `--text-secondary` (L=44%).

---

## 12. Gaps abiertos para S4

1. **`<StoreAvatar>` componente** (ADR 0001 D16): primera prioridad de S4. Receta `--accent` 14% bg / 28% border / letra en `--accent` con `font-display 600`. Sizes 24/32/40/56.
2. **`<StatusChip>` componente** (ADR 0002): discriminated union `kind = orderStatus | deliveryStatus | itemDeliveryState | derived`. Variants `success | warning | destructive | info | accent | neutral`. Consume `--*-chip-text` light / `--*` base dark.
3. **`<WizardAccordion>`** (ADR 0003 D5): consume `--motion-base`, `--ease-out-expressive`, `--space-6/--space-5` para padding, `--radius-xl` para card.
4. **`<FilterDrawer>`** (ADR 0003 D8): consume `--drawer-w` desktop / `--sheet-max-h` mobile, `--z-drawer/--z-sheet`, `--radius-xl` izq / `--radius-2xl` arriba.
5. **`<DetailSidebar>`** (ADR 0003 D7): slots Resumen / Acciones / NotaPrivada. Consume `--surface-elevated` en cada card, `--space-6` gap.
6. ~~**Validación con simulador de daltonismo** del par `--info` (h245) vs `--accent-cool` (h215)~~ — **CERRADO por research follow-up + ADR 0006.** Brettel/Viénot (1997) demuestra que mover los hues no resuelve el problema (ambos colapsan al mismo cuadrante en deutan/protan). Mitigación correcta = contrato vinculante "ícono + label" formalizado en [ADR 0006](./decisions/0006-color-blindness-icon-label-contract.md). Validación humana con usuario dichromat real queda para S6+ alta fidelidad como confirmación final.
7. **Validation #4 refinada (lectura outdoor mobile):** plan original era leer `--text-muted` bajo sol. Refinado por [ADR 0007](./decisions/0007-text-muted-outdoor-code-mono-reassignment.md) y `_notes/s3-research-text-muted-outdoor.md` §9: setup split — comparar versión actual (timestamp + code mono ambos en `--text-muted`) vs versión propuesta (timestamp en `--text-muted`, code mono en `--text-secondary`) en mid-tier (Pixel 6a) + high-tier (iPhone 15 Pro) bajo sol directo. Pasa si code mono se lee sin esfuerzo en ambos dispositivos; falla si requiere acercar ojos o dispositivo a sombra.
8. **`<MicroStatCard>` core** (ADR 0005): patrón icon-tile circular soft-tint con prop obligatoria `accentToken: '--accent' | '--accent-warm' | '--warning' | '--success'`. Rechaza accent diferente a esos 4 vía TypeScript discriminated union.
9. **Lint rules en S12** (ADR 0006): `no-accent-cool-as-bg-border-text`, y prop obligatoria `icon` + `label` en `<StatusChip kind="info">` vía TypeScript.

## 13. Validaciones humanas (paralelas a S3)

Las 5 validaciones de [`_notes/s2-validation-plan.md`](./_notes/s2-validation-plan.md) se ejecutan fuera de este documento. Tokens fueron diseñados para no contradecir sus criterios pass/fail.

**Validation #4 refinada por ADR 0007.** El plan original era "leer `--text-muted` en mobile bajo sol". Tras research follow-up (`_notes/s3-research-text-muted-outdoor.md`), el plan se refina:

- `--text-muted` light pasa 5.81:1 sobre `--background` y 6.46:1 sobre `--surface` — diseñado para ser legible en condiciones adversas para timestamps, eyebrows, helper text.
- **Pero el code mono identificador (`PT-XXXXXX`) se reasigna a `--text-secondary`** (6.32:1, ~APCA Lc 70+) por ser el caso outdoor-crítico (string denso, función dependiente del reconocimiento exacto).
- Setup de validación split: mid-tier (Pixel 6a) + high-tier (iPhone 15 Pro) bajo sol directo, comparando versión actual (todo en muted) vs propuesta (code mono en secondary). Pasa si code mono se lee sin esfuerzo en ambos dispositivos.

Validación de daltonismo del par `--info` h245 vs `--accent-cool` h215 quedó cerrada por ADR 0006 (research follow-up): la mitigación correcta es ortogonal al color (contrato ícono + label), no mover los hues. Validación humana con usuario dichromat real queda para S6+ como confirmación final, no como bloqueo de S3/S4.
