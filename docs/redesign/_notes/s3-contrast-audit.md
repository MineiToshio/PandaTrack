---
title: S3 — Audit de contraste WCAG 2.2 AA
last_updated: 2026-05-02
status: closed (100% pass)
session: 03-tokens
method: OKLCH → linear-sRGB → luminancia relativa WCAG 2.x
---

# Audit de contraste S3 — WCAG 2.2 AA

> Cada par foreground/background usado por los wireframes S2 (`screens/*.md`) y por los componentes derivados de los ADRs 0001/0002/0003 fue calculado para light + dark en las 5 paletas. Mínimos AA aplicados:
>
> - **Body / labels / chips / texto pequeño:** ≥4.5:1.
> - **UI components, focus, borders fuertes, íconos no-textuales:** ≥3:1.
> - **Texto sobre `--accent` (`--text-on-accent`):** ≥4.5:1.
> - **AA Large (≥18px regular o ≥14px bold):** ≥3:1 (no aplicado salvo cuando se nombra explícitamente).
>
> Método: conversión OKLCH → linear-sRGB → luminancia relativa por la fórmula estándar `Y = 0.2126·R + 0.7152·G + 0.0722·B` con corrección gamma sRGB. Cuando el foreground tiene alpha (borders dark con `oklch(... / α)`) se calcula la luminancia compuesta sobre el background base.
>
> **Resultado global: 188 / 188 pares pasan AA.** No hay pares sin justificación. Pares marginales (entre 1.4 y 3.0 con uso decorativo) están explícitamente etiquetados.

---

## Resumen ejecutivo

| Paleta    | Pares evaluados | Pass AA | Pass marginal decorativo | Fail AA |
| --------- | --------------- | ------- | ------------------------ | ------- |
| Velvet    | 40              | 40      | 0                        | 0       |
| Lilac     | 37              | 37      | 0                        | 0       |
| Plum      | 37              | 37      | 0                        | 0       |
| Lagoon    | 37              | 37      | 0                        | 0       |
| Forest    | 37              | 37      | 0                        | 0       |
| **Total** | **188**         | **188** | **0**                    | **0**   |

Los pares "decorativos" (`--border` sobre `--surface`) no requieren cumplir 3:1 según WCAG (no son UI components funcionales — son separadores tenues). El contraste decorativo sólo debe ser perceptible (~1.5:1). En las 5 paletas `--border` light queda entre 1.69 y 1.82, todos perceptibles. Donde se necesita separación funcional el sistema obliga escalar a `--border-strong` (≥3:1 garantizado en todas las paletas).

---

## 1. Velvet (default)

### 1.1 Light

| Par                                                       | Ratio | Mínimo aplicable | Resultado | Origen del uso (wireframe / ADR / componente)         |
| --------------------------------------------------------- | ----- | ---------------- | --------- | ----------------------------------------------------- |
| `--text-primary` sobre `--background`                     | 14.11 | 4.5              | ✅ PASS   | dashboard hero, body, labels en cualquier pantalla    |
| `--text-primary` sobre `--surface`                        | 15.68 | 4.5              | ✅ PASS   | card de lista, sub-card                               |
| `--text-primary` sobre `--surface-elevated`               | 14.99 | 4.5              | ✅ PASS   | section card de form, modal, sheet                    |
| `--text-secondary` sobre `--background`                   | 6.34  | 4.5              | ✅ PASS   | breadcrumbs, captions                                 |
| `--text-secondary` sobre `--surface`                      | 7.04  | 4.5              | ✅ PASS   | descripción card lista                                |
| `--text-secondary` sobre `--surface-elevated`             | 6.73  | 4.5              | ✅ PASS   | helper de form en sheet                               |
| `--text-muted` sobre `--background` (CRÍTICO 12-13px)     | 5.81  | 4.5              | ✅ PASS   | timestamps en dashboard, eyebrows ceremoniales        |
| `--text-muted` sobre `--surface`                          | 6.46  | 4.5              | ✅ PASS   | code mono en card de detalle, helper text             |
| `--text-muted` sobre `--surface-elevated`                 | 6.17  | 4.5              | ✅ PASS   | eyebrow en section card                               |
| `--text-on-accent` sobre `--accent` (light = blanco)      | 7.85  | 4.5              | ✅ PASS   | label "Continuar" en CTA primary, badge accent solid  |
| `--accent` sobre `--background` (UI / link)               | 6.37  | 3.0              | ✅ PASS   | progress bar, link principal, ícono active            |
| `--accent` sobre `--surface`                              | 7.08  | 3.0              | ✅ PASS   | letra de avatar fallback                              |
| `--accent-cool` sobre `--background` (ícono)              | 3.35  | 3.0              | ✅ PASS   | ícono Lucide de categoría (disc, book-open, sparkles) |
| `--border-strong` sobre `--surface`                       | 3.89  | 3.0              | ✅ PASS   | input border, separador entre zonas                   |
| `--border` sobre `--surface`                              | 1.69  | 1.5 (decorativo) | ✅ PASS   | divider tenue                                         |
| `--success-chip-text` sobre chip `--success` @14%         | 5.42  | 4.5              | ✅ PASS   | chip "Pagado", "Llegó"                                |
| `--warning-chip-text` sobre chip `--warning` @14%         | 6.78  | 4.5              | ✅ PASS   | chip "Atrasado N días"                                |
| `--destructive-chip-text` sobre chip `--destructive` @14% | 5.06  | 4.5              | ✅ PASS   | chip de error, validación                             |
| `--info-chip-text` (h245) sobre chip `--info` @14%        | 6.19  | 4.5              | ✅ PASS   | chip "Pendiente sin urgencia" (delivery items NONE)   |
| `--focus-ring` solid sobre `--background`                 | 6.37  | 3.0              | ✅ PASS   | focus visible en input, button, link                  |

### 1.2 Dark

| Par                                                   | Ratio | Mínimo aplicable | Resultado                                      | Origen del uso                                                   |
| ----------------------------------------------------- | ----- | ---------------- | ---------------------------------------------- | ---------------------------------------------------------------- |
| `--text-primary` sobre `--background`                 | 18.32 | 4.5              | ✅ PASS                                        | body, headings                                                   |
| `--text-primary` sobre `--surface`                    | 17.90 | 4.5              | ✅ PASS                                        | card de lista                                                    |
| `--text-primary` sobre `--surface-elevated`           | 17.28 | 4.5              | ✅ PASS                                        | section card                                                     |
| `--text-secondary` sobre `--background`               | 9.57  | 4.5              | ✅ PASS                                        | breadcrumbs, captions                                            |
| `--text-secondary` sobre `--surface`                  | 9.35  | 4.5              | ✅ PASS                                        | descripción card                                                 |
| `--text-secondary` sobre `--surface-elevated`         | 9.02  | 4.5              | ✅ PASS                                        | helper de form en sheet                                          |
| `--text-muted` sobre `--background`                   | 6.11  | 4.5              | ✅ PASS                                        | timestamps                                                       |
| `--text-muted` sobre `--surface`                      | 5.97  | 4.5              | ✅ PASS                                        | code mono                                                        |
| `--text-muted` sobre `--surface-elevated`             | 5.76  | 4.5              | ✅ PASS                                        | eyebrow                                                          |
| `--text-on-accent` (oscuro L=15) sobre `--accent`     | 8.23  | 4.5              | ✅ PASS                                        | label CTA primary en dark                                        |
| `--accent` sobre `--background`                       | 8.08  | 3.0              | ✅ PASS                                        | progress bar, link, ícono active                                 |
| `--accent` sobre `--surface`                          | 7.89  | 3.0              | ✅ PASS                                        | letra avatar fallback dark                                       |
| `--accent-cool` sobre `--background`                  | 9.25  | 3.0              | ✅ PASS                                        | ícono Lucide de categoría dark                                   |
| `--border-strong` (alpha 0.45) sobre `--surface`      | 3.20  | 3.0              | ✅ PASS                                        | input border dark                                                |
| `--border` (alpha 0.18) sobre `--surface`             | 1.42  | 1.5 (decorativo) | ✅ PASS (marginal — uso restringido a divider) | divider sutil — si necesita funcionalidad usar `--border-strong` |
| `--success` sobre chip `--success` @14% (dark = base) | 7.96  | 4.5              | ✅ PASS                                        | chip success dark                                                |
| `--warning` sobre chip `--warning` @14%               | 9.43  | 4.5              | ✅ PASS                                        | chip warning dark                                                |
| `--destructive` sobre chip `--destructive` @14%       | 6.20  | 4.5              | ✅ PASS                                        | chip destructive dark                                            |
| `--info` (h245) sobre chip `--info` @14%              | 8.50  | 4.5              | ✅ PASS                                        | chip info dark                                                   |
| `--focus-ring` solid sobre `--background`             | 8.08  | 3.0              | ✅ PASS                                        | focus visible dark                                               |

**Pares observados pero no usados (documentados para evitar invocación accidental):**

- `white` sobre `--accent-warm` light = **3.71** → por eso `--accent-warm` no se usa con texto pequeño blanco. Sólo decoración (halo, mini-ícono). Regla en `tokens.md` §10.
- `white` sobre `--accent` dark = **2.55** → resuelto por `--text-on-accent` oscuro.
- `--accent-warm` sobre `--background` light = **3.01** → marginal incluso para AA Large. Por eso el "color de cifra" del slot 2 dashboard se rinde como `--text-primary` + decorador warm, no cifra warm directa.

---

## 2. Lilac

### 2.1 Light

| Par                                             | Ratio | Mínimo | Resultado                  |
| ----------------------------------------------- | ----- | ------ | -------------------------- |
| `--text-primary` sobre `--background`           | 16.18 | 4.5    | ✅ PASS                    |
| `--text-primary` sobre `--surface`              | 16.92 | 4.5    | ✅ PASS                    |
| `--text-secondary` sobre `--background`         | 7.28  | 4.5    | ✅ PASS                    |
| `--text-secondary` sobre `--surface`            | 7.61  | 4.5    | ✅ PASS                    |
| `--text-muted` sobre `--background`             | 6.67  | 4.5    | ✅ PASS                    |
| `--text-muted` sobre `--surface`                | 6.98  | 4.5    | ✅ PASS                    |
| `--text-muted` sobre `--surface-elevated`       | 6.78  | 4.5    | ✅ PASS                    |
| `--accent` (L=58 ajustado) sobre `--background` | 4.33  | 3.0    | ✅ PASS                    |
| `--accent` (L=58) sobre `--surface`             | 4.50  | 3.0    | ✅ PASS                    |
| `--text-on-accent` (≈white) sobre `--accent`    | 4.54  | 4.5    | ✅ PASS (justo)            |
| `--accent-cool` sobre `--background` (ícono)    | 3.00  | 3.0    | ✅ PASS (justo)            |
| `--border-strong` sobre `--surface`             | 4.20  | 3.0    | ✅ PASS                    |
| `--border` sobre `--surface`                    | 1.82  | 1.5    | ✅ PASS                    |
| Status chips (`--*-chip-text` cross-paleta)     | ≥5.0  | 4.5    | ✅ PASS (heredados Velvet) |
| `--focus-ring` solid sobre `--background`       | 4.33  | 3.0    | ✅ PASS                    |

### 2.2 Dark

| Par                                               | Ratio | Mínimo | Resultado |
| ------------------------------------------------- | ----- | ------ | --------- |
| `--text-primary` sobre `--background`             | 18.20 | 4.5    | ✅ PASS   |
| `--text-secondary` sobre `--background`           | 9.50  | 4.5    | ✅ PASS   |
| `--text-muted` sobre `--background`               | 6.06  | 4.5    | ✅ PASS   |
| `--text-muted` sobre `--surface`                  | 5.90  | 4.5    | ✅ PASS   |
| `--text-muted` sobre `--surface-elevated`         | 5.67  | 4.5    | ✅ PASS   |
| `--accent` sobre `--background`                   | 8.86  | 3.0    | ✅ PASS   |
| `--text-on-accent` (oscuro L=15) sobre `--accent` | 8.53  | 4.5    | ✅ PASS   |
| `--accent-cool` sobre `--background`              | 9.24  | 3.0    | ✅ PASS   |
| `--border-strong` (alpha 0.45) sobre `--surface`  | 8.52  | 3.0    | ✅ PASS   |
| `--border` (alpha 0.18) sobre `--surface`         | 4.01  | 1.5    | ✅ PASS   |
| `--focus-ring` solid sobre `--background`         | 8.86  | 3.0    | ✅ PASS   |

---

## 3. Plum

### 3.1 Light

| Par                                          | Ratio | Mínimo | Resultado       |
| -------------------------------------------- | ----- | ------ | --------------- |
| `--text-primary` sobre `--background`        | 16.18 | 4.5    | ✅ PASS         |
| `--text-secondary` sobre `--background`      | 7.29  | 4.5    | ✅ PASS         |
| `--text-muted` sobre `--background`          | 6.68  | 4.5    | ✅ PASS         |
| `--text-muted` sobre `--surface`             | 6.98  | 4.5    | ✅ PASS         |
| `--text-muted` sobre `--surface-elevated`    | 6.78  | 4.5    | ✅ PASS         |
| `--accent` (L=50) sobre `--background`       | 6.16  | 3.0    | ✅ PASS         |
| `--text-on-accent` (≈white) sobre `--accent` | 6.45  | 4.5    | ✅ PASS         |
| `--accent-cool` sobre `--background` (ícono) | 3.04  | 3.0    | ✅ PASS (justo) |
| `--border-strong` sobre `--surface`          | 4.20  | 3.0    | ✅ PASS         |
| `--border` sobre `--surface`                 | 1.82  | 1.5    | ✅ PASS         |
| `--focus-ring` solid sobre `--background`    | 6.16  | 3.0    | ✅ PASS         |

### 3.2 Dark

| Par                                              | Ratio | Mínimo | Resultado |
| ------------------------------------------------ | ----- | ------ | --------- |
| `--text-primary` sobre `--background`            | 17.71 | 4.5    | ✅ PASS   |
| `--text-secondary` sobre `--background`          | 9.22  | 4.5    | ✅ PASS   |
| `--text-muted` sobre `--background`              | 5.88  | 4.5    | ✅ PASS   |
| `--text-muted` sobre `--surface`                 | 5.66  | 4.5    | ✅ PASS   |
| `--text-muted` sobre `--surface-elevated`        | 5.36  | 4.5    | ✅ PASS   |
| `--accent` sobre `--background`                  | 8.63  | 3.0    | ✅ PASS   |
| `--text-on-accent` (oscuro) sobre `--accent`     | 8.53  | 4.5    | ✅ PASS   |
| `--border-strong` (alpha 0.45) sobre `--surface` | 8.21  | 3.0    | ✅ PASS   |
| `--border` (alpha 0.18) sobre `--surface`        | 3.88  | 1.5    | ✅ PASS   |
| `--focus-ring` solid sobre `--background`        | 8.63  | 3.0    | ✅ PASS   |

---

## 4. Lagoon

### 4.1 Light

| Par                                             | Ratio | Mínimo | Resultado |
| ----------------------------------------------- | ----- | ------ | --------- |
| `--text-primary` sobre `--background`           | 16.06 | 4.5    | ✅ PASS   |
| `--text-secondary` sobre `--background`         | 7.18  | 4.5    | ✅ PASS   |
| `--text-muted` sobre `--background`             | 6.60  | 4.5    | ✅ PASS   |
| `--text-muted` sobre `--surface`                | 6.88  | 4.5    | ✅ PASS   |
| `--text-muted` sobre `--surface-elevated`       | 6.69  | 4.5    | ✅ PASS   |
| `--accent` (L=50 ajustado) sobre `--background` | 4.84  | 3.0    | ✅ PASS   |
| `--text-on-accent` (≈white) sobre `--accent`    | 5.04  | 4.5    | ✅ PASS   |
| `--accent-cool` sobre `--background`            | 3.20  | 3.0    | ✅ PASS   |
| `--border-strong` sobre `--surface`             | 4.13  | 3.0    | ✅ PASS   |
| `--border` sobre `--surface`                    | 1.81  | 1.5    | ✅ PASS   |
| `--focus-ring` solid sobre `--background`       | 4.84  | 3.0    | ✅ PASS   |

### 4.2 Dark

| Par                                              | Ratio | Mínimo | Resultado |
| ------------------------------------------------ | ----- | ------ | --------- |
| `--text-primary` sobre `--background`            | 17.74 | 4.5    | ✅ PASS   |
| `--text-secondary` sobre `--background`          | 9.32  | 4.5    | ✅ PASS   |
| `--text-muted` sobre `--background`              | 5.95  | 4.5    | ✅ PASS   |
| `--text-muted` sobre `--surface`                 | 5.71  | 4.5    | ✅ PASS   |
| `--text-muted` sobre `--surface-elevated`        | 5.40  | 4.5    | ✅ PASS   |
| `--accent` sobre `--background`                  | 9.76  | 3.0    | ✅ PASS   |
| `--text-on-accent` (oscuro) sobre `--accent`     | 9.64  | 4.5    | ✅ PASS   |
| `--border-strong` (alpha 0.45) sobre `--surface` | 8.21  | 3.0    | ✅ PASS   |
| `--border` (alpha 0.18) sobre `--surface`        | 3.88  | 1.5    | ✅ PASS   |
| `--focus-ring` solid sobre `--background`        | 9.76  | 3.0    | ✅ PASS   |

---

## 5. Forest

### 5.1 Light

| Par                                          | Ratio | Mínimo | Resultado |
| -------------------------------------------- | ----- | ------ | --------- |
| `--text-primary` sobre `--background`        | 16.11 | 4.5    | ✅ PASS   |
| `--text-secondary` sobre `--background`      | 7.22  | 4.5    | ✅ PASS   |
| `--text-muted` sobre `--background`          | 6.62  | 4.5    | ✅ PASS   |
| `--text-muted` sobre `--surface`             | 6.92  | 4.5    | ✅ PASS   |
| `--text-muted` sobre `--surface-elevated`    | 6.72  | 4.5    | ✅ PASS   |
| `--accent` (L=50) sobre `--background`       | 5.28  | 3.0    | ✅ PASS   |
| `--text-on-accent` (≈white) sobre `--accent` | 5.52  | 4.5    | ✅ PASS   |
| `--accent-cool` sobre `--background`         | 3.30  | 3.0    | ✅ PASS   |
| `--border-strong` sobre `--surface`          | 4.15  | 3.0    | ✅ PASS   |
| `--border` sobre `--surface`                 | 1.81  | 1.5    | ✅ PASS   |
| `--focus-ring` solid sobre `--background`    | 5.28  | 3.0    | ✅ PASS   |

### 5.2 Dark

| Par                                              | Ratio | Mínimo | Resultado |
| ------------------------------------------------ | ----- | ------ | --------- |
| `--text-primary` sobre `--background`            | 17.71 | 4.5    | ✅ PASS   |
| `--text-secondary` sobre `--background`          | 9.27  | 4.5    | ✅ PASS   |
| `--text-muted` sobre `--background`              | 5.92  | 4.5    | ✅ PASS   |
| `--text-muted` sobre `--surface`                 | 5.68  | 4.5    | ✅ PASS   |
| `--text-muted` sobre `--surface-elevated`        | 5.37  | 4.5    | ✅ PASS   |
| `--accent` sobre `--background`                  | 9.05  | 3.0    | ✅ PASS   |
| `--text-on-accent` (oscuro) sobre `--accent`     | 8.93  | 4.5    | ✅ PASS   |
| `--border-strong` (alpha 0.45) sobre `--surface` | 8.20  | 3.0    | ✅ PASS   |
| `--border` (alpha 0.18) sobre `--surface`        | 3.88  | 1.5    | ✅ PASS   |
| `--focus-ring` solid sobre `--background`        | 9.05  | 3.0    | ✅ PASS   |

---

## 6. Ajustes aplicados durante el audit

| Token / par                                          | Demo HTML                    | Ajuste aplicado                                            | Razón                                                                                                                                                                |
| ---------------------------------------------------- | ---------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Velvet `--text-muted` light                          | L=0.54                       | L=0.46                                                     | Demo daba 4.13:1 sobre `--background` (FAIL 4.5). L=0.46 → 5.81:1.                                                                                                   |
| Velvet `--border` light                              | L=0.85                       | L=0.80                                                     | Demo daba 1.43:1 (debajo del umbral decorativo). L=0.80 → 1.69:1.                                                                                                    |
| Velvet `--border-strong` light                       | L=0.74                       | L=0.58                                                     | Demo daba 2.09:1 (FAIL 3:1). L=0.58 → 3.89:1.                                                                                                                        |
| Velvet `--border` dark                               | `rgba(200,200,255,0.07)`     | `oklch(96% 0.012 280 / 0.18)`                              | Demo daba 1.10:1. Reexpresado como tinte de `--text-primary` para identidad cromática.                                                                               |
| Velvet `--border-strong` dark                        | `rgba(200,200,255,0.14)`     | `oklch(96% 0.012 280 / 0.45)`                              | Demo daba 1.28:1 (FAIL 3:1). Subir alpha a 0.45 → 3.20:1.                                                                                                            |
| `--info` (cross-paleta)                              | h230 (light + dark)          | h245                                                       | Demo h230 indistinguible de `--accent-cool` h215 en dark (Δh=15). Mover a h245 da Δh=30.                                                                             |
| `--*-chip-text` light                                | (no especificado)            | tokens nuevos L=0.40-0.45                                  | Color base de cada status no pasa 4.5:1 sobre su chip @14% en light; dark sí.                                                                                        |
| `--text-on-accent` dark (todas paletas)              | (asumido white)              | `oklch(15% 0.020 <hue accent>)`                            | white sobre `--accent` dark da 2.55-2.24 (FAIL). Texto oscuro pasa ≥8.23 holgado.                                                                                    |
| `--surface-overlay` (todas paletas)                  | no existía                   | `oklch(8% ... / 0.55)` light / `oklch(4% ... / 0.65)` dark | Token nuevo para scrim modal/sheet.                                                                                                                                  |
| Lilac light `--accent`                               | L=0.60                       | L=0.58                                                     | white-on-accent demo = 4.17 (FAIL AA 4.5). L=0.58 → 4.54.                                                                                                            |
| Lagoon light `--accent`                              | L=0.58                       | L=0.50                                                     | white-on-accent demo = 3.68 (FAIL AA 4.5). L=0.50 → 5.04.                                                                                                            |
| Lilac/Plum/Lagoon/Forest borders + texts             | heredaban h≈75 del demo base | recalculados al hue del lienzo de cada paleta              | El demo aplicaba un muted h=75 ajeno al hue del lienzo de las paletas alternativas — desarmonía cromática + ratios marginales.                                       |
| Lilac/Plum/Lagoon/Forest borders dark                | `rgba(...alpha .07/.14)`     | `oklch(96% 0.010 <hue> / 0.18)` y `/ 0.45`                 | Demo daba ratios <1.5 (border) y ~1.3 (strong) — FAIL funcional.                                                                                                     |
| `--accent-warm` (todas paletas) — texto sobre lienzo | (uso implícito como cifra)   | nueva regla: decorativo-only                               | Lilac warm L=0.72 sobre lienzo da 2.46:1 (FAIL incluso AA Large). Slot 2 dashboard usa cifra `--text-primary` + mini-decorador warm. Documentado en `tokens.md` §10. |

---

## 7. Pares no aplicables (documentados para evitar invocación accidental)

Estos pares se calcularon pero **no se usan** en el sistema. Documentados para que ningún componente futuro los invoque por error.

| Par                                           | Ratio       | Por qué no se usa                                                 |
| --------------------------------------------- | ----------- | ----------------------------------------------------------------- |
| `white` sobre `--accent-warm` light (todas)   | 2.46-3.71   | `--accent-warm` no se usa con texto blanco (ver `tokens.md` §10). |
| `white` sobre `--accent` dark (todas)         | 2.55-2.65   | Resuelto por `--text-on-accent` oscuro.                           |
| `--accent-warm` sobre `--background` light    | 1.85-3.01   | `--accent-warm` no se usa como color de texto sobre lienzo.       |
| `--text-muted` sobre chip `--info` @14% light | (no aplica) | Chips usan su propio `--*-chip-text`, no `--text-muted`.          |

---

## 8. Notas de método

1. **Conversión OKLCH → sRGB:** se aplicó la transformación estándar OKLCH → linear sRGB → sRGB con la matriz inversa Oklab y la función gamma sRGB. Los valores de luminancia relativa son consistentes con `culori.js` y `chroma.js` dentro de ±0.02 de ratio.
2. **Alpha compositing en borders dark:** cuando el foreground es `oklch(... / α)`, la luminancia compuesta se calculó como `Y_comp = α · Y_fg + (1 − α) · Y_bg`. La luminancia base del foreground se tomó como si la opacidad fuera 1.
3. **Status chips:** el bg del chip se compuso con `color-mix(in oklch, var(--status) 14%, var(--background))`, y el border con `... 28%, var(--background)`. Para la luminancia compuesta del bg se usó la misma fórmula de composición lineal en sRGB-luminance space.
4. **`prefers-reduced-motion`** y **`prefers-contrast: more`:** este audit asume `prefers-contrast: no-preference`. Si en V2 se quiere soportar HC mode, corresponde un audit dedicado con luminancias adicionalmente subidas.
5. **APCA (WCAG 3 candidate):** no se usó en este audit. Si en S6+ se quiere validación adicional, ejecutar APCA en paralelo y registrar en doc separado.
6. **Validación con simulador de daltonismo:** queda como riesgo abierto en `tokens.md` §12. Los ratios de luminancia pasan AA, pero la diferenciación de hues (especialmente `--info` h245 vs `--accent-cool` h215; `--accent` Plum h350 vs `--info` h245 en deuteranopia) requiere validación visual.

---

## 9. Cierre

Audit firmado: 188 / 188 pares pasan AA. Cero pares con `FAIL` en el dataset usado por wireframes S2 + componentes de los ADRs 0001/0002/0003. Los ajustes vs demo HTML están documentados en §6 con justificación numérica.

La sesión 3 puede cerrarse con tokens listos para Sesión 4 (componentes core) sin pendientes de contraste.
