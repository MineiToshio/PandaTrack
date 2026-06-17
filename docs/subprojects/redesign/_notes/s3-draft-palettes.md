---
title: S3 draft — paletas alternativas (Lilac, Plum, Lagoon, Forest)
status: draft epsilon — para consolidación cross-área
---

> Notación: las 4 paletas alternativas declaran **exactamente** los mismos tokens que Velvet (`s3-draft-color.md`). El switch del demo cambia valores, no nombres. Light y dark son hermanos calculados independientemente (no inversiones). Status colors (`--success`, `--warning`, `--destructive`, `--info`) y sus `--*-chip-text` **no cambian con la paleta** y se reutilizan tal cual desde Velvet §5.
>
> Contraste verificado por OKLCH → linear-sRGB → luminancia relativa WCAG 2.x. Pares AA mínimos: texto pequeño ≥4.5:1, UI / íconos / borde funcional ≥3:1.

---

## 1. Estructura común (todas las paletas declaran los mismos tokens)

Cada paleta `data-palette="X"` redefine los siguientes tokens en sus dos modos `light` y `dark`. Tokens **no listados aquí** se heredan del bloque global (status, focus-ring queda derivado del accent de la paleta, state-layer recipes son agnósticas). El nombre y rol de cada token es idéntico al fijado para Velvet en `s3-draft-color.md`:

- `--background`, `--surface`, `--surface-elevated`, `--surface-overlay`
- `--border`, `--border-strong`
- `--text-primary`, `--text-secondary`, `--text-muted`, `--text-on-accent`
- `--accent`, `--accent-warm`, `--accent-cool`
- `--focus-ring`

Los tokens **compartidos cross-paleta** (definidos una sola vez en el bloque base, no por paleta) son:

- Status: `--success`, `--warning`, `--destructive`, `--info`.
- Status chip text: `--success-chip-text`, `--warning-chip-text`, `--destructive-chip-text`, `--info-chip-text`.
- State-layer recipes (color-mix con `--text-primary` y `--accent` actual de la paleta).

Dos diferencias estructurales respecto al demo HTML:

1. El demo aplica `--border` / `--border-strong` / `--text-*` desde un bloque base h≈75 (cálido) que **no encaja** con el hue del lienzo de las paletas alternativas. Por eso esta normalización los **recalcula por paleta** usando el hue del background, manteniendo los L de Velvet (post rev 2 inviolable: `--text-muted` ≥4.5:1).
2. `--surface-overlay` no existe en el demo; se añade en cada paleta para scrim modal/sheet (regla heredada de Velvet §1).

---

## 2. Lilac

Identidad: lila-rosado frío sobre lienzo crema-violáceo. Acento principal violeta-magenta luminoso.

### 2.1 Light (borders + text recalculados a h=320)

```css
:root[data-palette="lilac"][data-theme="light"] {
  /* Lienzo y superficies */
  --background: oklch(97.5% 0.012 320);
  --surface: oklch(99% 0.008 320);
  --surface-elevated: oklch(98% 0.01 320);
  --surface-overlay: oklch(8% 0.02 320 / 0.55);

  /* Bordes (recalculados al hue del lienzo) */
  --border: oklch(80% 0.02 320);
  --border-strong: oklch(58% 0.026 320);

  /* Texto (recalculado al hue del lienzo) */
  --text-primary: oklch(22% 0.03 320);
  --text-secondary: oklch(44% 0.024 320);
  --text-muted: oklch(46% 0.022 320);
  --text-on-accent: oklch(99% 0.005 310);

  /* Acentos */
  --accent: oklch(58% 0.18 310); /* ajuste vs demo: L 60→58 */
  --accent-warm: oklch(72% 0.16 25);
  --accent-cool: oklch(64% 0.08 165);

  --focus-ring: oklch(58% 0.18 310 / 0.55);
}
```

### 2.2 Dark (preservar receta del demo h=290)

El demo ya define text + borders en h=290 (el sweet spot azul-violeta del lienzo dark Lilac). Se mantiene tal cual, sólo se normaliza el formato `rgba(...)` de borders a `oklch(...)` con alpha del `--text-primary` (consistencia con la decisión Velvet §2 de mantener identidad cromática).

```css
:root[data-palette="lilac"][data-theme="dark"] {
  --background: oklch(11% 0.024 280);
  --surface: oklch(14% 0.024 280);
  --surface-elevated: oklch(17% 0.026 280);
  --surface-overlay: oklch(4% 0.02 280 / 0.65);

  --border: oklch(96% 0.01 290 / 0.18); /* ajuste vs demo: rgba→oklch alpha textPrimary */
  --border-strong: oklch(96% 0.01 290 / 0.45); /* ajuste vs demo: rgba→oklch + alpha 0.14→0.45 */

  --text-primary: oklch(96% 0.01 290);
  --text-secondary: oklch(76% 0.018 290);
  --text-muted: oklch(64% 0.018 290);
  --text-on-accent: oklch(15% 0.02 290); /* ajuste vs demo: oscuro, no white */

  --accent: oklch(76% 0.17 305);
  --accent-warm: oklch(80% 0.14 25);
  --accent-cool: oklch(74% 0.1 200);

  --focus-ring: oklch(76% 0.17 305 / 0.65);
}
```

### 2.3 Verificación de contraste

#### Light

| Par                                          | Ratio | Mínimo | Resultado         |
| -------------------------------------------- | ----- | ------ | ----------------- |
| `--text-primary` sobre `--background`        | 16.18 | 4.5    | PASS              |
| `--text-primary` sobre `--surface`           | 16.92 | 4.5    | PASS              |
| `--text-secondary` sobre `--background`      | 7.28  | 4.5    | PASS              |
| `--text-secondary` sobre `--surface`         | 7.61  | 4.5    | PASS              |
| `--text-muted` sobre `--background`          | 6.67  | 4.5    | PASS              |
| `--text-muted` sobre `--surface`             | 6.98  | 4.5    | PASS              |
| `--text-muted` sobre `--surface-elevated`    | 6.78  | 4.5    | PASS              |
| `--accent` (L=58) sobre `--background`       | 4.33  | 3.0    | PASS              |
| `--accent` (L=58) sobre `--surface`          | 4.50  | 3.0    | PASS              |
| `--text-on-accent` (≈white) sobre `--accent` | 4.54  | 4.5    | PASS              |
| `--accent-cool` sobre `--background`         | 3.00  | 3.0    | PASS (justo)      |
| `--border-strong` sobre `--surface`          | 4.20  | 3.0    | PASS              |
| `--border` sobre `--surface`                 | 1.82  | 1.5    | PASS (decorativo) |

#### Dark

| Par                                               | Ratio | Mínimo | Resultado |
| ------------------------------------------------- | ----- | ------ | --------- |
| `--text-primary` sobre `--background`             | 18.20 | 4.5    | PASS      |
| `--text-primary` sobre `--surface`                | 17.72 | 4.5    | PASS      |
| `--text-secondary` sobre `--background`           | 9.50  | 4.5    | PASS      |
| `--text-secondary` sobre `--surface`              | 9.25  | 4.5    | PASS      |
| `--text-muted` sobre `--background`               | 6.06  | 4.5    | PASS      |
| `--text-muted` sobre `--surface`                  | 5.90  | 4.5    | PASS      |
| `--text-muted` sobre `--surface-elevated`         | 5.67  | 4.5    | PASS      |
| `--accent` sobre `--background`                   | 8.86  | 3.0    | PASS      |
| `--accent` sobre `--surface`                      | 8.62  | 3.0    | PASS      |
| `--text-on-accent` (oscuro L=15) sobre `--accent` | 8.53  | 4.5    | PASS      |
| `--accent-cool` sobre `--background`              | 9.24  | 3.0    | PASS      |
| `--border-strong` (alpha 0.45) sobre `--surface`  | 8.52  | 3.0    | PASS      |
| `--border` (alpha 0.18) sobre `--surface`         | 4.01  | 1.5    | PASS      |

> Nota: el alpha 0.45 del `--border-strong` dark da contraste alto en Lilac dark porque el L=11 del background es muy bajo. La intención semántica (borde funcional ≥3:1) se cumple holgada.

---

## 3. Plum

Identidad: ciruela profunda y madura. Acento más oscuro y saturado, registro elegante.

### 3.1 Light (h=340)

```css
:root[data-palette="plum"][data-theme="light"] {
  --background: oklch(97.5% 0.012 340);
  --surface: oklch(99% 0.008 340);
  --surface-elevated: oklch(98% 0.01 340);
  --surface-overlay: oklch(8% 0.02 340 / 0.55);

  --border: oklch(80% 0.02 340);
  --border-strong: oklch(58% 0.026 340);

  --text-primary: oklch(22% 0.03 340);
  --text-secondary: oklch(44% 0.024 340);
  --text-muted: oklch(46% 0.022 340);
  --text-on-accent: oklch(99% 0.005 350);

  --accent: oklch(50% 0.18 350);
  --accent-warm: oklch(70% 0.16 30);
  --accent-cool: oklch(64% 0.08 220);

  --focus-ring: oklch(50% 0.18 350 / 0.55);
}
```

### 3.2 Dark

```css
:root[data-palette="plum"][data-theme="dark"] {
  --background: oklch(14% 0.02 340);
  --surface: oklch(17% 0.02 340);
  --surface-elevated: oklch(20% 0.022 340);
  --surface-overlay: oklch(4% 0.018 340 / 0.65);

  --border: oklch(96% 0.01 340 / 0.18);
  --border-strong: oklch(96% 0.01 340 / 0.45);

  --text-primary: oklch(96% 0.01 340);
  --text-secondary: oklch(76% 0.018 340);
  --text-muted: oklch(64% 0.018 340);
  --text-on-accent: oklch(15% 0.02 340);

  --accent: oklch(76% 0.16 350);
  --accent-warm: oklch(80% 0.14 30);
  --accent-cool: oklch(76% 0.08 220);

  --focus-ring: oklch(76% 0.16 350 / 0.65);
}
```

### 3.3 Verificación

#### Light

| Par                                          | Ratio | Mínimo | Resultado         |
| -------------------------------------------- | ----- | ------ | ----------------- |
| `--text-primary` sobre `--background`        | 16.18 | 4.5    | PASS              |
| `--text-secondary` sobre `--background`      | 7.29  | 4.5    | PASS              |
| `--text-muted` sobre `--background`          | 6.68  | 4.5    | PASS              |
| `--text-muted` sobre `--surface`             | 6.98  | 4.5    | PASS              |
| `--text-muted` sobre `--surface-elevated`    | 6.78  | 4.5    | PASS              |
| `--accent` (L=50) sobre `--background`       | 6.16  | 3.0    | PASS              |
| `--text-on-accent` (≈white) sobre `--accent` | 6.45  | 4.5    | PASS              |
| `--accent-cool` sobre `--background`         | 3.04  | 3.0    | PASS (justo)      |
| `--border-strong` sobre `--surface`          | 4.20  | 3.0    | PASS              |
| `--border` sobre `--surface`                 | 1.82  | 1.5    | PASS (decorativo) |

#### Dark

| Par                                              | Ratio | Mínimo | Resultado |
| ------------------------------------------------ | ----- | ------ | --------- |
| `--text-primary` sobre `--background`            | 17.71 | 4.5    | PASS      |
| `--text-secondary` sobre `--background`          | 9.22  | 4.5    | PASS      |
| `--text-muted` sobre `--background`              | 5.88  | 4.5    | PASS      |
| `--text-muted` sobre `--surface`                 | 5.66  | 4.5    | PASS      |
| `--text-muted` sobre `--surface-elevated`        | 5.36  | 4.5    | PASS      |
| `--accent` sobre `--background`                  | 8.63  | 3.0    | PASS      |
| `--text-on-accent` (oscuro) sobre `--accent`     | 8.53  | 4.5    | PASS      |
| `--border-strong` (alpha 0.45) sobre `--surface` | 8.21  | 3.0    | PASS      |
| `--border` (alpha 0.18) sobre `--surface`        | 3.88  | 1.5    | PASS      |

---

## 4. Lagoon

Identidad: turquesa-aqua sereno. Lectura "fresco / acuático" sin perder contraste.

### 4.1 Light (h=195)

```css
:root[data-palette="lagoon"][data-theme="light"] {
  --background: oklch(97.5% 0.012 195);
  --surface: oklch(99% 0.008 195);
  --surface-elevated: oklch(98% 0.01 195);
  --surface-overlay: oklch(8% 0.02 195 / 0.55);

  --border: oklch(80% 0.018 195);
  --border-strong: oklch(58% 0.024 195);

  --text-primary: oklch(22% 0.024 195);
  --text-secondary: oklch(44% 0.02 195);
  --text-muted: oklch(46% 0.018 195);
  --text-on-accent: oklch(99% 0.005 195);

  --accent: oklch(50% 0.14 195); /* ajuste vs demo: L 58→50 */
  --accent-warm: oklch(70% 0.16 28);
  --accent-cool: oklch(64% 0.1 250);

  --focus-ring: oklch(50% 0.14 195 / 0.55);
}
```

### 4.2 Dark

```css
:root[data-palette="lagoon"][data-theme="dark"] {
  --background: oklch(14% 0.018 200);
  --surface: oklch(17% 0.018 200);
  --surface-elevated: oklch(20% 0.02 200);
  --surface-overlay: oklch(4% 0.016 200 / 0.65);

  --border: oklch(96% 0.01 200 / 0.18);
  --border-strong: oklch(96% 0.01 200 / 0.45);

  --text-primary: oklch(96% 0.01 200);
  --text-secondary: oklch(76% 0.018 200);
  --text-muted: oklch(64% 0.018 200);
  --text-on-accent: oklch(15% 0.02 200);

  --accent: oklch(76% 0.13 195);
  --accent-warm: oklch(80% 0.14 28);
  --accent-cool: oklch(76% 0.1 250);

  --focus-ring: oklch(76% 0.13 195 / 0.65);
}
```

### 4.3 Verificación

#### Light

| Par                                             | Ratio | Mínimo | Resultado         |
| ----------------------------------------------- | ----- | ------ | ----------------- |
| `--text-primary` sobre `--background`           | 16.06 | 4.5    | PASS              |
| `--text-secondary` sobre `--background`         | 7.18  | 4.5    | PASS              |
| `--text-muted` sobre `--background`             | 6.60  | 4.5    | PASS              |
| `--text-muted` sobre `--surface`                | 6.88  | 4.5    | PASS              |
| `--text-muted` sobre `--surface-elevated`       | 6.69  | 4.5    | PASS              |
| `--accent` (L=50 ajustado) sobre `--background` | 4.84  | 3.0    | PASS              |
| `--text-on-accent` (≈white) sobre `--accent`    | 5.04  | 4.5    | PASS              |
| `--border-strong` sobre `--surface`             | 4.13  | 3.0    | PASS              |
| `--border` sobre `--surface`                    | 1.81  | 1.5    | PASS (decorativo) |

#### Dark

| Par                                              | Ratio | Mínimo | Resultado |
| ------------------------------------------------ | ----- | ------ | --------- |
| `--text-primary` sobre `--background`            | 17.74 | 4.5    | PASS      |
| `--text-secondary` sobre `--background`          | 9.32  | 4.5    | PASS      |
| `--text-muted` sobre `--background`              | 5.95  | 4.5    | PASS      |
| `--text-muted` sobre `--surface`                 | 5.71  | 4.5    | PASS      |
| `--text-muted` sobre `--surface-elevated`        | 5.40  | 4.5    | PASS      |
| `--accent` sobre `--background`                  | 9.76  | 3.0    | PASS      |
| `--text-on-accent` (oscuro) sobre `--accent`     | 9.64  | 4.5    | PASS      |
| `--border-strong` (alpha 0.45) sobre `--surface` | 8.21  | 3.0    | PASS      |
| `--border` (alpha 0.18) sobre `--surface`        | 3.88  | 1.5    | PASS      |

> Nota: el demo definía `--accent` light en `oklch(58% 0.14 195)`, pero white-on-accent daba 3.68 (FAIL AA texto). Bajar L a 0.50 mantiene la sensación turquesa y eleva el ratio a 5.04.

---

## 5. Forest

Identidad: verde bosque equilibrado, lienzo cálido apenas amarillento. Acento orgánico.

### 5.1 Light (h=100 para lienzo / h=145 para acento)

```css
:root[data-palette="forest"][data-theme="light"] {
  --background: oklch(97.5% 0.014 100);
  --surface: oklch(99% 0.01 100);
  --surface-elevated: oklch(98% 0.012 100);
  --surface-overlay: oklch(8% 0.018 100 / 0.55);

  --border: oklch(80% 0.018 100);
  --border-strong: oklch(58% 0.024 100);

  --text-primary: oklch(22% 0.024 100);
  --text-secondary: oklch(44% 0.02 100);
  --text-muted: oklch(46% 0.018 100);
  --text-on-accent: oklch(99% 0.005 145);

  --accent: oklch(50% 0.13 145);
  --accent-warm: oklch(66% 0.18 35);
  --accent-cool: oklch(60% 0.06 250);

  --focus-ring: oklch(50% 0.13 145 / 0.55);
}
```

### 5.2 Dark

```css
:root[data-palette="forest"][data-theme="dark"] {
  --background: oklch(14% 0.014 145);
  --surface: oklch(17% 0.014 145);
  --surface-elevated: oklch(20% 0.016 145);
  --surface-overlay: oklch(4% 0.014 145 / 0.65);

  --border: oklch(96% 0.01 100 / 0.18);
  --border-strong: oklch(96% 0.01 100 / 0.45);

  --text-primary: oklch(96% 0.01 100);
  --text-secondary: oklch(76% 0.018 100);
  --text-muted: oklch(64% 0.018 100);
  --text-on-accent: oklch(15% 0.02 145);

  --accent: oklch(74% 0.13 145);
  --accent-warm: oklch(80% 0.16 35);
  --accent-cool: oklch(76% 0.06 250);

  --focus-ring: oklch(74% 0.13 145 / 0.65);
}
```

### 5.3 Verificación

#### Light

| Par                                          | Ratio | Mínimo | Resultado         |
| -------------------------------------------- | ----- | ------ | ----------------- |
| `--text-primary` sobre `--background`        | 16.11 | 4.5    | PASS              |
| `--text-secondary` sobre `--background`      | 7.22  | 4.5    | PASS              |
| `--text-muted` sobre `--background`          | 6.62  | 4.5    | PASS              |
| `--text-muted` sobre `--surface`             | 6.92  | 4.5    | PASS              |
| `--text-muted` sobre `--surface-elevated`    | 6.72  | 4.5    | PASS              |
| `--accent` (L=50) sobre `--background`       | 5.28  | 3.0    | PASS              |
| `--text-on-accent` (≈white) sobre `--accent` | 5.52  | 4.5    | PASS              |
| `--border-strong` sobre `--surface`          | 4.15  | 3.0    | PASS              |
| `--border` sobre `--surface`                 | 1.81  | 1.5    | PASS (decorativo) |

#### Dark

| Par                                              | Ratio | Mínimo | Resultado |
| ------------------------------------------------ | ----- | ------ | --------- |
| `--text-primary` sobre `--background`            | 17.71 | 4.5    | PASS      |
| `--text-secondary` sobre `--background`          | 9.27  | 4.5    | PASS      |
| `--text-muted` sobre `--background`              | 5.92  | 4.5    | PASS      |
| `--text-muted` sobre `--surface`                 | 5.68  | 4.5    | PASS      |
| `--text-muted` sobre `--surface-elevated`        | 5.37  | 4.5    | PASS      |
| `--accent` sobre `--background`                  | 9.05  | 3.0    | PASS      |
| `--text-on-accent` (oscuro) sobre `--accent`     | 8.93  | 4.5    | PASS      |
| `--border-strong` (alpha 0.45) sobre `--surface` | 8.20  | 3.0    | PASS      |
| `--border` (alpha 0.18) sobre `--surface`        | 3.88  | 1.5    | PASS      |

---

## 6. Vibe / carácter de cada paleta

| Paleta | Carácter (1 línea)                                                                                       |
| ------ | -------------------------------------------------------------------------------------------------------- |
| Velvet | Atelier nocturno: violeta profundo, calidez de cuero, registro premium "noche elegante".                 |
| Lilac  | Lavanda matinal: lila luminoso y rosado, registro "diario alegre" sin perder elegancia.                  |
| Plum   | Ciruela madura: magenta profundo y saturado, registro "boutique editorial" con presencia.                |
| Lagoon | Aqua sereno: turquesa fresco, registro "calma analítica" tipo dashboard de operaciones.                  |
| Forest | Verde bosque: orgánico equilibrado sobre crema-cálido, registro "sustentable / herbario / coleccionado". |

---

## 7. Tabla cruzada — light (los 5 tokens más representativos)

| Token             | Velvet                   | Lilac                    | Plum                     | Lagoon                   | Forest                   |
| ----------------- | ------------------------ | ------------------------ | ------------------------ | ------------------------ | ------------------------ |
| `--background`    | `oklch(93% 0.020 285)`   | `oklch(97.5% 0.012 320)` | `oklch(97.5% 0.012 340)` | `oklch(97.5% 0.012 195)` | `oklch(97.5% 0.014 100)` |
| `--surface`       | `oklch(96.5% 0.014 285)` | `oklch(99% 0.008 320)`   | `oklch(99% 0.008 340)`   | `oklch(99% 0.008 195)`   | `oklch(99% 0.010 100)`   |
| `--text-primary`  | `oklch(22% 0.030 285)`   | `oklch(22% 0.030 320)`   | `oklch(22% 0.030 340)`   | `oklch(22% 0.024 195)`   | `oklch(22% 0.024 100)`   |
| `--text-muted`    | `oklch(46% 0.022 285)`   | `oklch(46% 0.022 320)`   | `oklch(46% 0.022 340)`   | `oklch(46% 0.018 195)`   | `oklch(46% 0.018 100)`   |
| `--accent`        | `oklch(46% 0.20 290)`    | `oklch(58% 0.18 310)`    | `oklch(50% 0.18 350)`    | `oklch(50% 0.14 195)`    | `oklch(50% 0.13 145)`    |
| `--border-strong` | `oklch(58% 0.030 285)`   | `oklch(58% 0.026 320)`   | `oklch(58% 0.026 340)`   | `oklch(58% 0.024 195)`   | `oklch(58% 0.024 100)`   |

> Lectura: las 5 paletas comparten el "esqueleto L" (text-primary L≈22, text-muted L≈46, border-strong L≈58, accents en rango L 46-58); sólo varían hue y croma. Esa consistencia hace que el switch del data-attribute mantenga jerarquía visual sin re-aprender el lenguaje.

---

## 8. Ajustes vs demo HTML (cada cambio justificado por AA o por consistencia estructural)

| Paleta / token                                    | Demo                                              | Ajuste                                                        | Por qué                                                                                                                                                                                                     |
| ------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lilac light `--accent`                            | `oklch(60% 0.18 310)`                             | `oklch(58% 0.18 310)`                                         | white-on-accent en demo = 4.17 (FAIL AA 4.5). L=0.58 → 4.54 con white-on-accent y 4.33 sobre `--background`.                                                                                                |
| Lagoon light `--accent`                           | `oklch(58% 0.14 195)`                             | `oklch(50% 0.14 195)`                                         | white-on-accent en demo = 3.68 (FAIL AA 4.5). L=0.50 → 5.04 con white-on-accent.                                                                                                                            |
| Lilac light `--text-muted`                        | (heredado h=75 del demo: L=52)                    | `oklch(46% 0.022 320)`                                        | El demo aplicaba un muted h=75 que es ajeno al lienzo h=320 y daba un gris tirando a verde-amarillento sobre fondo lila.                                                                                    |
| Lilac light `--text-primary` / `--text-secondary` | (heredado h=75 / L=20 / L=44)                     | `oklch(22% 0.030 320)` / `oklch(44% 0.024 320)`               | Recalculados a h=320 para armonizar con el lienzo lila. L mantenidos según receta Velvet.                                                                                                                   |
| Lilac light `--border` / `--border-strong`        | (heredado h=75 / L=90 / L=80)                     | `oklch(80% 0.020 320)` / `oklch(58% 0.026 320)`               | Demo daba 1.43:1 (border-strong L=80) — falla 3:1 funcional. Bajar a L=58 → 4.20:1. Hue alineado al lienzo.                                                                                                 |
| Plum light texto + bordes                         | (heredados h=75)                                  | recalc h=340                                                  | Mismo razonamiento: el lienzo plum es magenta cálido, no neutro-amarillo. El text-muted L=46/h=340 da 6.68 sobre background.                                                                                |
| Lagoon light texto + bordes                       | (heredados h=75)                                  | recalc h=195                                                  | El lienzo es turquesa-frío. Hue h=75 introducía un sesgo cálido conflictivo. Recalc h=195 mantiene neutralidad cromática.                                                                                   |
| Forest light texto + bordes                       | (heredados h=75)                                  | recalc h=100                                                  | El lienzo es verde-cálido (h=100). El demo h=75 estaba cerca pero no idéntico; alinear a h=100 elimina micro-shift de hue.                                                                                  |
| Lilac dark `--border` / `--border-strong`         | `rgba(220,215,255,.07)` / `rgba(220,215,255,.14)` | `oklch(96% 0.010 290 / 0.18)` / `oklch(96% 0.010 290 / 0.45)` | Demo daba ratios <1.5 (border) y ~1.3 (strong) — falla funcional. Subir alpha a 0.18 / 0.45 lleva a 4.0 / 8.5. Reexpresado como tinte del text-primary para mantener identidad cromática (regla Velvet §2). |
| Plum dark `--border` / `--border-strong`          | (heredados rgba alpha .07/.14)                    | `oklch(96% 0.010 340 / 0.18)` / `oklch(96% 0.010 340 / 0.45)` | Mismo razonamiento. Hue del lienzo plum (340) en lugar del cálido h=75 del demo.                                                                                                                            |
| Lagoon dark `--border` / `--border-strong`        | (heredados rgba alpha .07/.14)                    | `oklch(96% 0.010 200 / 0.18)` / `oklch(96% 0.010 200 / 0.45)` | Mismo razonamiento. Hue 200 (lienzo lagoon dark).                                                                                                                                                           |
| Forest dark `--border` / `--border-strong`        | (heredados rgba alpha .07/.14)                    | `oklch(96% 0.010 100 / 0.18)` / `oklch(96% 0.010 100 / 0.45)` | Hue 100 (matching del text-primary forest dark, no del background h=145; el text es el que tiñe el alpha y debe ser consistente con los textos visibles).                                                   |
| Todas dark `--text-on-accent`                     | (no especificado, asumido white)                  | `oklch(15% 0.020 <hue accent>)`                               | white-on-accent dark da 1.98 (Lagoon) – 2.24 (Lilac/Plum) – 2.14 (Forest), todos FAIL. Texto oscuro pasa ≥8.5 holgado.                                                                                      |
| Todas `--surface-overlay`                         | (no existía en el demo)                           | `oklch(8% ... / 0.55)` light / `oklch(4% ... / 0.65)` dark    | Token nuevo para scrim modal/sheet, regla heredada de Velvet §1. Hue tomado del lienzo de la paleta.                                                                                                        |

---

## 9. Riesgos / dudas para el agente principal

1. **Lilac light `--accent` ajustado de L=60 a L=58.** El demo se vería casi idéntico al ojo, pero el agente que arme el storybook visual debería confirmar que la sensación "lila luminoso" sigue presente. Si el equipo prefiere mantener el demo tal cual, la salida obligada es **abandonar `--text-on-accent` blanco en Lilac light** y pasar a `oklch(15% 0.020 320)` (texto oscuro), lo que cambia el patrón mental "CTA primario tiene texto blanco en light".

2. **Lagoon light `--accent` bajado de L=58 a L=50.** El cambio es más perceptible (turquesa más oscuro y profundo). Alternativa simétrica: mantener L=58 demo y usar texto oscuro como `--text-on-accent` light — pero eso rompe la convención cross-paleta de "CTA primario light = botón sólido + texto blanco". Recomendado mantener el ajuste a L=50 y validar visualmente en la pantalla "dashboard" del demo.

3. **`--accent-cool` Lilac light = 3.00:1 sobre background.** Justo en el umbral (h=165 verde-aguamarina suave). Es seguro como ícono no-textual pero **no apto para texto**. Documentarlo en `tokens.md` como "ícono de categoría únicamente, no texto inline". Si el componente de íconos crece a usos textuales, bajar L a 0.60 (eleva a 3.6).

4. **`--accent-cool` Plum light = 3.04:1.** Mismo caso: justo. Confirmar uso restringido a íconos.

5. **`--accent-warm` Lilac light** (`oklch(72% 0.16 25)`) sobre background da **2.46:1**. Falla incluso para ícono (3:1). El uso "métrica grande" de Velvet (≥24px, AA Large 3:1) **no se cumple aquí**. Decisión pendiente: bajar el L del `--accent-warm` Lilac a 0.66 (≈3.1:1) o aceptar que en Lilac la métrica `--accent-warm` se rinda con halo + texto en `--text-primary` (no con color saturado sobre background). Recomendado oscurecer warm a `oklch(66% 0.18 25)` para Lilac light específicamente — pero eso rompe la simetría con las otras paletas. **Riesgo abierto.**

6. **Hue de borders dark.** Para Velvet, Lilac, Plum y Lagoon el hue del border alpha es el **mismo del lienzo** del modo dark. Para Forest dark, mantuve el hue del **`--text-primary`** (h=100, cálido), no del background (h=145, verde franco), porque los borders se construyen como alpha del text-primary y deben mantener identidad cromática con el texto, no con el lienzo. Esto es consistente con la decisión Velvet §2 ("tinte del text-primary"). Si el agente principal prefiere el hue del background, cambiar a `h=145` en Forest dark — pero recomiendo no hacerlo (ver §2 Velvet).

7. **Status colors no se redefinen.** Si en el futuro alguien quiere matizar `--success` para que armonice con Forest (verde sobre lienzo verde puede leerse débil), la decisión correcta es definir un **`--success-on-forest` chip variant**, no romper la regla "status es cross-paleta". Proteger esa invariante en `tokens.md` para evitar regresiones.

8. **Validación cross-paleta con simulador de daltonismo pendiente.** Cada paleta pasa AA en luminancia, pero la diferenciación entre `--accent` y `--info` (h245 cross-paleta) puede colapsar especialmente en Plum (acento h=350 magenta vs info azul) en deuteranopia → ambos pueden lucir como variantes de gris-violeta. Recomendado test visual antes de cerrar selección de paleta default. Idéntico riesgo Lagoon (acento turquesa h=195 vs info h=245) en protanopia.

9. **`--surface-elevated` invariante "más oscuro que `--surface` en light".** En Velvet light, `--surface-elevated` (L=0.95) es ligeramente más oscuro que `--surface` (L=0.965) para simular paper-overlap. En las 4 paletas alternativas el demo invierte la regla: `--surface-elevated` (L=0.98) es **más oscuro** que `--surface` (L=0.99). Mantengo el demo tal cual porque preserva la intención de jerarquía (la diferencia es 1 unidad L, perceptible pero sutil). Confirmar con el agente principal que esta convención (L_elevated < L_surface en light) es la correcta del sistema y no un error a reescribir.
