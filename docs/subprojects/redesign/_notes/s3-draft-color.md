---
title: S3 draft — color tokens (Velvet light + dark)
status: draft alpha — para consolidación cross-área
---

> Notación: todos los valores light y dark se calculan independientemente (regla "hermanos", no `filter: invert`). Los ajustes respecto al demo se justifican en §9. Status colors son compartidos entre paletas (cross-paleta).

---

## 1. Lienzo y superficies (Velvet)

| Token                | Light                        | Dark                         | Uso siempre / sólo / nunca                                                                                                                                                                        |
| -------------------- | ---------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--background`       | `oklch(93% 0.020 285)`       | `oklch(10% 0.028 265)`       | Lienzo raíz de la app. Nunca dentro de cards o sub-superficies.                                                                                                                                   |
| `--surface`          | `oklch(96.5% 0.014 285)`     | `oklch(13% 0.028 265)`       | Card por defecto, lista, panel principal de detalle. Siempre como contenedor; nunca como acento.                                                                                                  |
| `--surface-elevated` | `oklch(95% 0.016 285)`       | `oklch(16% 0.030 265)`       | Sub-card dentro de una card, drawer/sheet body, popover. Sólo cuando hay jerarquía visual real con `--surface`. En light es ligeramente más oscuro que `--surface` (paper-overlap), no más claro. |
| `--surface-overlay`  | `oklch(8% 0.020 285 / 0.55)` | `oklch(4% 0.020 265 / 0.65)` | Scrim modal, sheet backdrop, command-palette overlay. Sólo como capa por encima de la app; nunca como fondo de contenido.                                                                         |

Decisión: **`--surface-warm` se elimina** del sistema (ver §10).

---

## 2. Bordes

| Token             | Light                  | Dark                          | Uso siempre / sólo / nunca                                                                                                             |
| ----------------- | ---------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `--border`        | `oklch(80% 0.024 285)` | `oklch(96% 0.012 280 / 0.18)` | Bordes decorativos: card outline, divider tenue, input enfoque-off. Nunca como único separador funcional entre dos zonas semánticas.   |
| `--border-strong` | `oklch(58% 0.030 285)` | `oklch(96% 0.012 280 / 0.45)` | Borde de input enfocado pero pre-focus-ring, separador entre zonas semánticas, borde de avatar fallback. Sólo cuando se necesita ≥3:1. |

Notas:

- `--border-strong` dark se expresa como tinte del `--text-primary` con alfa 45% (en vez del demo `rgba(200,200,255,0.14)` que sólo lograba 1.28:1 sobre `--surface`). El uso del color del texto primario garantiza que mantenga relación cromática con la paleta y no introduzca un blanco-azul ajeno.
- `--border` (decorativo) no necesita pasar 3:1; basta delineación visible. Si una superficie sólo se distingue por `--border`, escalar a `--border-strong`.

---

## 3. Texto

| Token              | Light                  | Dark                   | Uso siempre / sólo / nunca                                                                                                          |
| ------------------ | ---------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `--text-primary`   | `oklch(22% 0.030 285)` | `oklch(96% 0.012 280)` | Headings, body principal, valores numéricos centrales del dashboard. Nunca para metadatos secundarios.                              |
| `--text-secondary` | `oklch(44% 0.024 285)` | `oklch(76% 0.020 280)` | Subtítulos, labels de campo, descripciones cortas, breadcrumbs. Sólo cuando hay un `--text-primary` cercano que defina jerarquía.   |
| `--text-muted`     | `oklch(46% 0.022 285)` | `oklch(64% 0.020 280)` | Timestamps, code mono, eyebrows uppercase, helper text. Nunca para body principal ni para el primer label visible de un campo.      |
| `--text-on-accent` | `oklch(99% 0.005 285)` | `oklch(15% 0.020 290)` | Texto sobre `--accent` (CTA primary, badge accent solid, focus-ring fill). Sólo sobre acento sólido; nunca sobre tinte/state-layer. |

Notas:

- `--text-muted` light **se oscureció de L=0.54 a L=0.46** (ver §9) para garantizar 4.5:1 a 12-13px sobre `--background` (5.81:1) y `--surface-elevated` (6.17:1).
- `--text-on-accent` dark **es oscuro** (no blanco): `--accent` dark (L=0.74) sólo da 2.55:1 contra blanco, fallando AA. Un texto profundo sobre el violeta claro logra 8.23:1.

---

## 4. Acentos

| Token           | Light                 | Dark                  | Uso siempre / sólo / nunca                                                                                                                                                 |
| --------------- | --------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--accent`      | `oklch(46% 0.20 290)` | `oklch(74% 0.19 290)` | Primary CTA, link principal, focus-ring base, progress bar, avatar fallback (tinte 14% bg / 28% border). Nunca para íconos de categoría ni para decoración no-interactiva. |
| `--accent-warm` | `oklch(64% 0.20 22)`  | `oklch(80% 0.15 25)`  | Métrica "Próximos 30 días" del dashboard (ADR 0001 D8), achievement halo decorativo, chip `accent` soft. **Nunca para CTAs** (no pasa 4.5:1 con texto blanco en light).    |
| `--accent-cool` | `oklch(58% 0.10 215)` | `oklch(74% 0.11 215)` | Íconos de categoría Lucide, info inline cuando ya coexiste con `--accent`. Nunca para CTAs, focus, ni status semántico.                                                    |

Notas:

- `--accent` light: 6.37:1 sobre `--background`, 7.08:1 sobre `--surface` — pasa AA texto y AAA UI.
- `--accent-warm` light **no es seguro** para texto pequeño blanco: blanco-sobre-warm = 3.71:1. Por eso queda confinado a métrica grande (≥24px en dashboard, donde aplica AA Large 3:1) y a halos decorativos. El chip "accent soft" se construye con tinte 14% + texto en `--text-primary`, no con texto blanco.
- `--accent-cool` cumple 3.35:1 sobre background light y 9.25:1 sobre dark — apto como ícono no-textual.

---

## 5. Status (compartidos cross-paleta)

| Token           | Light                 | Dark                  | Uso siempre / sólo / nunca                                                                                                                  |
| --------------- | --------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `--success`     | `oklch(58% 0.15 152)` | `oklch(74% 0.16 152)` | Pago confirmado, entrega completa, achievement chip, toast success. Nunca como decoración no-semántica.                                     |
| `--warning`     | `oklch(70% 0.16 75)`  | `oklch(82% 0.15 75)`  | Pago vencido / "atrasado N días" exclusivamente (ADR 0001 D1). Nunca para "esperando algo" sin urgencia (eso es `--info`).                  |
| `--destructive` | `oklch(54% 0.21 25)`  | `oklch(70% 0.18 25)`  | Delete confirm, error feedback, toast destructive. Nunca como decoración ni para "atención sin riesgo de pérdida".                          |
| `--info`        | `oklch(58% 0.14 245)` | `oklch(78% 0.13 245)` | Status "pendiente sin urgencia" (chip + ícono `clock`), inline notice neutra. Nunca para CTAs, focus, ni íconos de categoría (ADR 0001 D1). |

**Cambio respecto al demo:** `--info` se movió de h230 → **h245** (azul más franco) para diferenciarlo visualmente de `--accent-cool` (h215). En dark, h230 daba ΔL=2 / Δh=15 contra accent_cool — indistinguible lado a lado. Con h245 da ΔL=4 / Δh=30. Ver §9 y §10.

### Recetas de chip (color-mix, vinculantes)

```css
/* Chip background: tinte del color status sobre el background actual */
background: color-mix(in oklch, var(--success) 14%, var(--background));

/* Chip border: tinte más intenso */
border: 1px solid color-mix(in oklch, var(--success) 28%, var(--background));

/* Chip text — light: usar variante oscurecida del status; dark: usar el token base */
color: var(--success-chip-text);
```

Tokens de texto de chip (necesarios en light porque el color base no pasa 4.5:1 sobre el bg @14%):

| Token                     | Light                 | Dark (= status base)  |
| ------------------------- | --------------------- | --------------------- |
| `--success-chip-text`     | `oklch(42% 0.13 152)` | `oklch(74% 0.16 152)` |
| `--warning-chip-text`     | `oklch(40% 0.10 75)`  | `oklch(82% 0.15 75)`  |
| `--destructive-chip-text` | `oklch(45% 0.20 25)`  | `oklch(70% 0.18 25)`  |
| `--info-chip-text`        | `oklch(40% 0.13 245)` | `oklch(78% 0.13 245)` |

Verificado: cada `*-chip-text` light pasa ≥5.0:1 sobre el chip @14% del mismo status. En dark el color base ya pasa ≥6.0:1.

---

## 6. Focus

| Token          | Light                        | Dark                         | Uso siempre / sólo / nunca                                                                                 |
| -------------- | ---------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `--focus-ring` | `oklch(46% 0.20 290 / 0.55)` | `oklch(74% 0.19 290 / 0.65)` | Outline de cualquier elemento `:focus-visible`. Sólo como ring (no como fill); nunca dispara con `:hover`. |

Visibilidad: el color sólido subyacente da 6.37:1 (light) y 8.08:1 (dark) sobre `--background`. La alfa baja levemente la luminancia efectiva pero el contraste contra el background queda muy por encima del mínimo de 3:1 para indicador no-textual.

---

## 7. State layers (recetas color-mix)

Reglas vinculantes — sin sobrescribir colores base, sólo capa por encima:

| Estado     | Light                                                                                                                         | Dark                                                                    | Notas                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `hover`    | `color-mix(in oklch, var(--text-primary) 6%, transparent)`                                                                    | `color-mix(in oklch, var(--text-primary) 8%, transparent)`              | Aplicar como overlay (`background-color`) por encima de la superficie del control.          |
| `pressed`  | `color-mix(in oklch, var(--text-primary) 12%, transparent)`                                                                   | `color-mix(in oklch, var(--text-primary) 14%, transparent)`             | Reemplaza la capa de hover durante el `:active`.                                            |
| `selected` | bg `color-mix(in oklch, var(--accent) 14%, var(--surface))` + border `color-mix(in oklch, var(--accent) 28%, var(--surface))` | mismo patrón con `--accent` y `--surface` dark                          | Patrón usado por filter chip activo, sidebar item activo, opción seleccionada en lista.     |
| `disabled` | text → `var(--text-muted)`, border → `var(--border)`, no usar `opacity`                                                       | text → `var(--text-muted)`, border → `var(--border)`, no usar `opacity` | ADR 0001 D3: nada de `opacity:.5` global. El bajo contraste se logra con tokens semánticos. |

---

## 8. Verificación de contraste

Calculado por conversión OKLCH → linear-sRGB → sRGB y luminancia relativa WCAG 2.x. Pares listados son los críticos del sistema; cualquier composición no listada debe revalidarse antes de aprobar.

### Light

| Par                                                       | Ratio | Mínimo | Resultado         |
| --------------------------------------------------------- | ----- | ------ | ----------------- |
| `--text-primary` sobre `--background`                     | 14.11 | 4.5    | PASS              |
| `--text-primary` sobre `--surface`                        | 15.68 | 4.5    | PASS              |
| `--text-primary` sobre `--surface-elevated`               | 14.99 | 4.5    | PASS              |
| `--text-secondary` sobre `--background`                   | 6.34  | 4.5    | PASS              |
| `--text-secondary` sobre `--surface`                      | 7.04  | 4.5    | PASS              |
| `--text-secondary` sobre `--surface-elevated`             | 6.73  | 4.5    | PASS              |
| `--text-muted` sobre `--background` (L=0.46 ajustado)     | 5.81  | 4.5    | PASS              |
| `--text-muted` sobre `--surface`                          | 6.46  | 4.5    | PASS              |
| `--text-muted` sobre `--surface-elevated`                 | 6.17  | 4.5    | PASS              |
| `--text-on-accent` (≈white) sobre `--accent`              | 7.85  | 4.5    | PASS              |
| `--accent` sobre `--background` (UI / link)               | 6.37  | 3.0    | PASS              |
| `--accent` sobre `--surface`                              | 7.08  | 3.0    | PASS              |
| `--accent-cool` sobre `--background` (ícono)              | 3.35  | 3.0    | PASS              |
| `--border-strong` (L=0.58 ajustado) sobre `--surface`     | 3.89  | 3.0    | PASS              |
| `--border` (L=0.80 ajustado) sobre `--surface`            | 1.69  | 1.5    | PASS (decorativo) |
| `--success-chip-text` sobre chip `--success` @14%         | 5.42  | 4.5    | PASS              |
| `--warning-chip-text` sobre chip `--warning` @14%         | 6.78  | 4.5    | PASS              |
| `--destructive-chip-text` sobre chip `--destructive` @14% | 5.06  | 4.5    | PASS              |
| `--info-chip-text` sobre chip `--info` @14%               | 6.19  | 4.5    | PASS              |
| `--focus-ring` solid sobre `--background`                 | 6.37  | 3.0    | PASS              |

### Dark

| Par                                                       | Ratio | Mínimo | Resultado                                                                             |
| --------------------------------------------------------- | ----- | ------ | ------------------------------------------------------------------------------------- |
| `--text-primary` sobre `--background`                     | 18.32 | 4.5    | PASS                                                                                  |
| `--text-primary` sobre `--surface`                        | 17.90 | 4.5    | PASS                                                                                  |
| `--text-primary` sobre `--surface-elevated`               | 17.28 | 4.5    | PASS                                                                                  |
| `--text-secondary` sobre `--background`                   | 9.57  | 4.5    | PASS                                                                                  |
| `--text-secondary` sobre `--surface`                      | 9.35  | 4.5    | PASS                                                                                  |
| `--text-secondary` sobre `--surface-elevated`             | 9.02  | 4.5    | PASS                                                                                  |
| `--text-muted` sobre `--background`                       | 6.11  | 4.5    | PASS                                                                                  |
| `--text-muted` sobre `--surface`                          | 5.97  | 4.5    | PASS                                                                                  |
| `--text-muted` sobre `--surface-elevated`                 | 5.76  | 4.5    | PASS                                                                                  |
| `--text-on-accent` (oscuro) sobre `--accent`              | 8.23  | 4.5    | PASS                                                                                  |
| `--accent` sobre `--background`                           | 8.08  | 3.0    | PASS                                                                                  |
| `--accent` sobre `--surface`                              | 7.89  | 3.0    | PASS                                                                                  |
| `--accent-cool` sobre `--background`                      | 9.25  | 3.0    | PASS                                                                                  |
| `--border-strong` (alpha 0.45 ajustado) sobre `--surface` | 3.20  | 3.0    | PASS                                                                                  |
| `--border` (alpha 0.18 ajustado) sobre `--surface`        | 1.42  | 1.5    | NEAR (decorativo, aceptable; si necesita separación funcional usar `--border-strong`) |
| `--success` chip text sobre chip `--success` @14%         | 7.96  | 4.5    | PASS                                                                                  |
| `--warning` chip text sobre chip `--warning` @14%         | 9.43  | 4.5    | PASS                                                                                  |
| `--destructive` chip text sobre chip `--destructive` @14% | 6.20  | 4.5    | PASS                                                                                  |
| `--info` (h245) chip text sobre chip `--info` @14%        | 8.50  | 4.5    | PASS                                                                                  |
| `--focus-ring` solid sobre `--background`                 | 8.08  | 3.0    | PASS                                                                                  |

Pares observados pero **no aplicables** como par de texto:

- `white` sobre `--accent-warm` light = 3.71 → por eso `--accent-warm` no se usa con texto pequeño blanco; sólo métrica grande (AA Large 3:1) y decoración.
- `white` sobre `--accent` dark = 2.55 → resuelto con `--text-on-accent` oscuro.
- `--accent-warm` sobre `--background` light = 3.01 → ok justo para ícono o texto Large; el uso definido (métrica `text-3xl`+) lo cubre.

---

## 9. Cambios respecto al demo

| Token                   | Demo                                          | Ajuste                                                                 | Por qué                                                                                                               |
| ----------------------- | --------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `--text-muted` light    | `oklch(54% 0.022 285)`                        | `oklch(46% 0.022 285)`                                                 | Demo daba 4.13:1 sobre `--background` y 4.38 sobre `--surface-elevated`, fallando AA a 12-13px. L=0.46 → 5.81 / 6.17. |
| `--border` light        | `oklch(85% 0.024 285)`                        | `oklch(80% 0.024 285)`                                                 | Demo daba 1.43:1 sobre surface, debajo del umbral mínimo decorativo. L=0.80 → 1.69:1.                                 |
| `--border-strong` light | `oklch(74% 0.030 285)`                        | `oklch(58% 0.030 285)`                                                 | Demo daba 2.09:1 — falla 3:1 para borde funcional. L=0.58 → 3.89:1.                                                   |
| `--border` dark         | `rgba(200,200,255,0.07)`                      | `oklch(96% 0.012 280 / 0.18)`                                          | Tinte demasiado tenue (1.10:1). Reexpresado como alfa del `--text-primary` para mantener identidad cromática.         |
| `--border-strong` dark  | `rgba(200,200,255,0.14)`                      | `oklch(96% 0.012 280 / 0.45)`                                          | Demo daba 1.28:1 — muy lejos de 3:1. Subir alfa a 0.45 → 3.20:1.                                                      |
| `--info` (light + dark) | `oklch(62% 0.12 230)` / `oklch(76% 0.12 230)` | `oklch(58% 0.14 245)` / `oklch(78% 0.13 245)`                          | h230 era casi indistinguible de `--accent-cool` h215 (ΔL=2 en dark). Mover a h245 da Δh=30 y rescata diferenciación.  |
| Chip text en light      | (no especificado)                             | Tokens `--*-chip-text` con L=0.40-0.45                                 | El color base de cada status no pasa 4.5:1 sobre su propio chip @14% en light; dark sí.                               |
| `--text-on-accent` dark | (no especificado, asumido white)              | `oklch(15% 0.020 290)`                                                 | White sobre `--accent` dark = 2.55 (FAIL). Texto oscuro = 8.23.                                                       |
| `--surface-overlay`     | (no existía)                                  | `oklch(8% 0.020 285 / 0.55)` light / `oklch(4% 0.020 265 / 0.65)` dark | Token nuevo necesario para scrim modal/sheet sin acoplar a un valor literal en cada componente.                       |

---

## 10. Decisiones residuales cerradas

### `--surface-warm` → eliminado

Atelier §4 lo definía como una superficie con tinte cálido extra para dar "calidez puntual" dentro de cards. En Velvet:

1. El propio `--surface` ya es plomo-violeta cálido (h285, L=0.965 light): el contraste con un "warm extra" sería casi imperceptible y rompería la jerarquía limpia background → surface → surface-elevated.
2. Los wireframes S2 nunca lo invocan — todo el calor visual viene de `--accent-warm` aplicado a métrica/halo, no a un fondo.
3. Cuando una sub-card requiera diferenciación cálida (ej. card de logro / achievement bloque), se resuelve con `state-layer` `accent` soft: `color-mix(in oklch, var(--accent-warm) 14%, var(--surface))`. No se necesita un token dedicado.

Conservar `--surface-warm` añadiría un cuarto nivel de superficie sin uso real y duplicaría la responsabilidad de `--accent-warm` soft. **Eliminado del sistema.**

### `--accent-cool` → mantenido con nueva semántica (cambio explícito)

| Aspecto       | Atelier §4 original                   | Velvet (esta versión)                                                |
| ------------- | ------------------------------------- | -------------------------------------------------------------------- |
| Hue           | h195 (teal franco)                    | **h215 (azul-gris suave)**                                           |
| Carácter      | Acento secundario "fresco / acuático" | Acento secundario "sereno / informativo no urgente"                  |
| Uso permitido | Íconos decorativos opcionales         | Íconos de categoría Lucide e info inline coexistiendo con `--accent` |
| Uso prohibido | (no formalizado)                      | CTAs, focus, status semántico                                        |

Justificación: el teal h195 introducía una tercera familia cromática que competía con `--accent` violeta y dispersaba la identidad. h215 lo mantiene en la misma "vecindad" perceptual que `--info` (h245) pero con menor croma y L distinta, funcionando como acento neutro sin generar bandera de status. **Confirmado activo en Velvet.**

### `--info` vs `--accent-cool` distinguibilidad

Demo ponía `--info` en h230 (azul) y `--accent-cool` en h215 (azul-gris). En dark daban ΔL=2 / Δh=15 — un usuario con visión tricromática estándar los percibiría como variantes del mismo color, lo que rompe la regla "info es status, accent-cool no". Mover `--info` a **h245** (azul más franco, ya casi indigo) restaura Δh=30 y mantiene `--info` claramente como status sin acercarlo a `--accent` violeta (h290).

---

## 11. Riesgos detectados / dudas para el agente principal

1. **Texto sobre `--accent-warm` light (3.71:1).** Resuelto por convención de uso (sólo métrica grande + halo decorativo). Si en el futuro algún componente necesita texto pequeño blanco sobre warm en light, habría que oscurecer warm a L≈0.55 — pero eso lo desplaza visualmente del rol "fondo cálido coral" a "rojizo". **Pendiente confirmar en S3-component:** ningún componente futuro pondrá texto fino sobre fondo `--accent-warm` sólido en light.

2. **`--text-on-accent` dark = oscuro (no white) cambia el patrón mental.** Buttons de paletas dark suelen asumirse con texto blanco. Habrá que documentarlo prominente en `tokens.md` y prever revisar todas las recetas de Button dark en componentes para no usar `text-white` literal. **Riesgo de regresión silenciosa** si algún Tailwind class hardcodeado sobrevive.

3. **Border dark "decorativo" da 1.42:1**, levemente bajo del umbral informal de 1.5. En la práctica los wireframes S2 no usan `--border` como única separación funcional (siempre hay diferencia de surface o un `--border-strong` próximo). Si esto cambia, subir alfa a 0.22 (1.59:1).

4. **`--surface-overlay` valores** son una propuesta inicial; pueden requerir tuning una vez veamos el sheet de modales reales con sus blur backdrops. La regla "no romper jerarquía" sí es vinculante.

5. **Otras paletas (Lilac, Forest, Atelier, etc.) deberán recalcular sus `text_muted`, `border`, `border_strong` independientemente.** Los ajustes hechos a Velvet son específicos de h285/h265 — no se pueden copiar L=0.46 / L=0.58 / L=0.80 a otras paletas sin re-verificar contraste.

6. **`--success-chip-text` y `--warning-chip-text` son tokens nuevos** que no estaban en el inventario original. Asegurar que el agente que arme `tokens.md` los incluya en la sección "status compartidos" y que el inventario de componentes (chips, badges) los referencie en lugar de hacer color-mix inline para el texto.

7. **Validación pendiente con simulador de daltonismo:** los ratios numéricos pasan AA, pero la diferenciación `--info` (h245) vs `--accent-cool` (h215) en deuteranopia/protanopia podría colapsar (ambos azules). Recomendado test visual antes de cerrar §10 definitivamente; si colapsa, mover `--info` aún más hacia h255-260.
