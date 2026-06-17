---
title: S3 — Red team de cierre
last_updated: 2026-05-02
status: closed
session: 03-tokens
---

# Red team — Sistema de tokens S3

> Pasada hostil propia ejecutada por el agente principal después de consolidar `tokens.md`, `tokens-css.md` y `_notes/s3-contrast-audit.md`. Cada objeción tiene **descripción**, **severidad** (`bloqueante` / `mayor` / `menor`) y **resolución** (aplicada o decisión de no actuar con justificación).
>
> Cobertura mínima requerida en el brief: ≥10 objeciones. Aquí se listan **15**.

---

## 1. ¿Algún token tiene valor sólo en un modo?

**Severidad:** bloqueante si aplica.

**Verificación.** Crucé los tokens declarados en `tokens.md` §1 contra los bloques `:root[data-palette="X"][data-theme="light"|"dark"]` de `tokens-css.md` §3.1-3.6. Cada paleta declara los 14 tokens propios (`--background`, `--surface`, `--surface-elevated`, `--surface-overlay`, `--border`, `--border-strong`, `--text-primary`, `--text-secondary`, `--text-muted`, `--text-on-accent`, `--accent`, `--accent-warm`, `--accent-cool`, `--focus-ring`) en sus dos modos. Status colors (`--success/warning/destructive/info` + chip-text aliases) viven en `:root[data-theme="light"]` y `:root[data-theme="dark"]` (`tokens-css.md` §2.1-2.2), independientes de paleta. Elevation (`--elevation-1..4`) idem.

**Resolución.** Sin huérfanos. Pasa.

---

## 2. ¿Las 5 paletas mantienen estructura idéntica?

**Severidad:** bloqueante si no.

**Verificación.** Tabla cruzada (Velvet / Lilac / Plum / Lagoon / Forest):

- Cada paleta declara los **mismos 14 tokens propios** en light y dark.
- Status, chip-text, elevation, motion, spacing, radius, breakpoints, z-index son **agnósticos a paleta**.
- El switch de `data-palette` cambia exclusivamente valores cromáticos, **no añade ni quita tokens**.

**Resolución.** Estructura idéntica confirmada. Pasa.

---

## 3. ¿`--info` y `--accent-cool` son distinguibles?

**Severidad:** mayor (gap potencial: ambos son azulados).

**Análisis.** Demo original: `--info` h230, `--accent-cool` h215. Δh=15 con ΔL pequeño en dark — perceptualmente colapsan en escenarios cotidianos (chip de info en row + ícono Lucide de categoría en la misma row). En tokens S3 se mueve `--info` a **h245** (azul franco, casi indigo). Δh=30 contra `--accent-cool` (h215). Lados:

- Lectura de luminancia: `--info` light L=0.58, `--accent-cool` light L=0.58 → ΔL=0. Distinguibilidad sólo por hue.
- En deuteranopia / protanopia ambos colapsan a tonos grises diferenciables sólo por L. El sistema **debe** apoyarse en otra dimensión (ícono + label).

**Resolución.**

1. Cambio aplicado: `--info` movido a h245 (Δh=30 contra `--accent-cool`).
2. **Regla operativa nueva** documentada en `tokens.md` §1.5: el chip de info **siempre lleva ícono `clock` + label "Pendiente …"**, nunca color-only. El `--accent-cool` se usa **sólo para íconos de categoría** (no en chips), también con label si la categoría no está repetida en otra columna.
3. ~~Riesgo abierto en §12 de `tokens.md`: validación con simulador de daltonismo en S4 cierra.~~

**CERRADO post-research follow-up (2026-05-02 tarde).** Research agente B (`s3-research-colorblind-info.md`) demostró vía Brettel/Viénot/Mollon (1997) que **mover los hues no resuelve el problema** — h215 y h245 colapsan al mismo cuadrante de la _confusion plane_ en deutan/protan. Las opciones (b) mover `--info` a h255-260 o (c) mover a h195-205 fueron descartadas (h195 lo lleva a teal, h260+ pisa accent violeta h290). La solución correcta es ortogonal al color: **contrato vinculante "ícono + label"** formalizado en [ADR 0006](../decisions/0006-color-blindness-icon-label-contract.md) con enforcement TypeScript en `<StatusChip>` (S4) y lint rule `no-accent-cool-as-bg-border-text` (S12). Riesgo cerrado.

---

## 4. ¿Tokens de Atelier §4 huérfanos sin uso ni decisión?

**Severidad:** mayor (deuda en sistema).

**Verificación.** Comparé el inventario de `directions.md` §4.4-4.8 contra `tokens.md`:

| Token Atelier original                  | Estado en S3                                                     |
| --------------------------------------- | ---------------------------------------------------------------- |
| `--background`                          | ✅ Mantenido, valor recalibrado a Velvet h285.                   |
| `--surface`                             | ✅ Mantenido, valor recalibrado.                                 |
| `--surface-elevated`                    | ✅ Mantenido.                                                    |
| `--surface-warm`                        | ✅ **Eliminado** (decisión §11.3 + ADR implícito Velvet).        |
| `--border`, `--border-strong`           | ✅ Mantenidos, valores ajustados por AA.                         |
| `--text-primary/secondary/muted`        | ✅ Mantenidos, muted ajustado por AA.                            |
| `--accent` (Indigo h268)                | ⚙️ **Reemplazado** por Velvet h290 (ADR 0003 D1).                |
| `--accent-warm` (coral h30)             | ✅ Mantenido h22-25, regla de uso reformulada (decorativo-only). |
| `--accent-cool` (teal h195)             | ⚙️ **Hue cambiado** a h215 (azul-gris suave). Documentado §11.2. |
| `--cat-figures/.../plush` (6)           | ✅ **Eliminados** (ADR 0004).                                    |
| `--success/warning/destructive`         | ✅ Mantenidos.                                                   |
| `--info`                                | ✅ Sumado por ADR 0001 D1, hue ajustado a h245.                  |
| `--focus-ring`                          | ✅ Mantenido, derivado del `--accent`.                           |
| `--motion-fast/base/slow`               | ✅ Mantenidos.                                                   |
| `--ease-emphasis/out-expressive/bounce` | ✅ Mantenidos.                                                   |
| `--elevation-1..4`                      | ✅ Mantenidos, recetas explícitas por modo.                      |
| Spacing scale                           | ✅ Mantenida + auxiliares Tailwind conservados explícitamente.   |
| Radius scale                            | ✅ Mantenida.                                                    |

Token nuevos en S3 que no estaban en Atelier explícitos:

- `--surface-overlay` (scrim modal/sheet).
- `--text-on-accent`.
- `--*-chip-text` (cross-paleta).
- `--ease-vt-signature` (firma view-transition aislada).
- `--text-eyebrow` (escala typography).
- Layout magic numbers (`--sidebar-w-*`, `--drawer-w`, `--header-h*`, `--modal-max-w*`, `--toast-max-w`, `--container-max-w*`, `--fab-*`).
- Z-index scale completa (`--z-*`).

**Resolución.** Cero huérfanos. Cada cambio documentado. Decisiones residuales (paleta categórica, accent-cool, surface-warm) cerradas en §11 + ADR 0004.

---

## 5. ¿Los wireframes S2 invocan algún token que no quedó tokenizado?

**Severidad:** bloqueante si aplica.

**Verificación.** Grep contra `screens/*.md` y `decisions/*.md`:

```bash
grep -h -oE -- '--[a-z-]+' docs/redesign/screens/*.md docs/redesign/decisions/*.md | sort -u
```

Tokens invocados por wireframes / ADRs:

```
--accent, --accent-cool, --accent-warm
--background, --border, --border-strong
--cat- (referencia histórica Atelier — ADR 0004 lo elimina)
--destructive, --ease-bounce, --ease-emphasis, --ease-out-expressive
--focus-ring, --info, --motion-base, --motion-fast
--pending (en una nota de rollback de ADR 0001 — alias de --info, no token real)
--success, --surface, --surface-elevated
--text-muted, --text-primary, --text-secondary
--warning
```

Cada uno está cubierto en `tokens.md`. `--cat-*` queda como referencia histórica eliminada (ADR 0004). `--pending` no es token; es alias mencionado en una nota de rollback hipotético — `--info` es el token real.

**Resolución.** Cobertura completa. Pasa.

---

## 6. ¿La paleta categórica está realmente eliminada o quedó como decoración disfrazada?

**Severidad:** mayor (regla cero).

**Verificación.**

- `tokens.md` §2 documenta la eliminación.
- `tokens.md` §10 marca **Eliminada** en jerarquía de uso.
- `tokens-css.md` no declara ningún `--cat-*` en `@theme` ni en bloques de paleta.
- ADR 0004 formaliza la decisión.
- Wireframes S2 nunca usaron `--cat-*` como decoración (sólo aparecen en una nota histórica de Atelier §4.4).

**Resolución.** Eliminada limpiamente. Pasa.

---

## 7. ¿`--text-muted` cumple AA inviolable post-rev 2 (≥4.5:1 incluso a 12-13px) en Velvet light?

**Severidad:** bloqueante.

**Verificación.** Audit §1.1: `--text-muted` light sobre `--background` = **5.81:1**, sobre `--surface` = **6.46:1**, sobre `--surface-elevated` = **6.17:1**. Todos ≥4.5.

L del token bajado de demo 0.54 → **0.46** específicamente para cumplir esta regla. Verificado en las 4 paletas alternativas también: ratios entre 5.36 y 6.98.

**Resolución.** Cumple en todas las paletas y modos. Pasa. Validation #4 humana puede ejecutarse con confianza.

---

## 8. `--accent-warm` Lilac light = 2.46:1 sobre lienzo — ¿cómo se resuelve sin romper la simetría cross-paleta?

**Severidad:** mayor.

**Análisis.** Demo Lilac warm L=0.72 sobre background L=0.975 → 2.46:1 (FAIL incluso AA Large 3:1). Si bajamos warm a L=0.55, rompemos simetría con Plum/Lagoon/Forest/Velvet warm L=0.64-0.72.

**Resolución aplicada** (documentada en `tokens.md` §10 + §1.4):

- `--accent-warm` se redefine como **decorativo-only**: halo achievement, tinte de chip "accent soft" (con texto en `--text-primary`, no warm), mini-decorador (ícono / ring / glyph) del slot 2 del dashboard.
- La métrica "Próximos 30 días" del dashboard (ADR 0001 D8) **interpreta** "color `--accent-warm` coral" como color del **decorador** (ícono, ring), **no** color de la cifra. La cifra se rinde en `--text-primary`.
- Esto resuelve cross-paleta sin necesidad de oscurecer warm en Lilac específicamente.

Si a futuro algún componente requiere warm como color de texto sobre background light, abrir ADR específico evaluando alternativas (oscurecer warm cross-paleta, introducir `--accent-warm-strong` solo light, etc.).

---

## 9. ¿`--text-on-accent` dark oscuro sobrevive un refactor distraído de buttons?

**Severidad:** mayor (regresión silenciosa).

**Análisis.** El patrón mental "botón dark = texto blanco" es fuerte. Si un dev en S4 escribe `<Button class="bg-accent text-white">` directamente con utilities Tailwind hardcoded, romperá AA en dark sin ninguna alarma.

**Resolución.**

1. `tokens.md` §1.3 documenta prominentemente: "**`--text-on-accent` en dark es oscuro, no blanco**".
2. `tokens-css.md` §9 nota de implementación #8: "Auditar `text-white` hardcoded en buttons / badges legacy".
3. **S4 debe entregar** el componente `<Button>` consumiendo `color: var(--text-on-accent)` (no Tailwind utility `text-white`). Este red team registra el riesgo; la mitigación cae en S4.
4. Considerar lint rule en S12 que prohíba `text-white` cuando coexiste con `bg-accent` o equivalentes.

---

## 10. Borders dark "marginal" (Velvet `--border` 1.42:1) — ¿es realmente decorativo o funcional?

**Severidad:** menor.

**Análisis.** En Velvet dark, `--border` con alpha 0.18 da 1.42:1 sobre `--surface` — apenas debajo del umbral informal de 1.5 que se usa para "decorativo perceptible". Las 4 paletas alternativas dan ≥3.88:1 (sus borders dark son más contrastantes por la combinación de hue + L del lienzo). Velvet es el caso más débil.

**Resolución.**

1. **Acción aplicada:** `tokens.md` §1.2 documenta explícitamente: "`--border` tiene contraste decorativo (~1.5–1.7:1); si se necesita separación funcional **siempre** escalar a `--border-strong`".
2. Se acepta como riesgo controlado. Si validación humana en S6 reporta que `--border` en Velvet dark se ve invisible, subir alpha a 0.22 (1.59:1) sin afectar otras paletas (`--border` dark se redeclara por paleta — el incremento solo aplica a Velvet).
3. Documentado en S5/S6 retroactivo.

---

## 11. ¿La firma view-transition `--ease-vt-signature` queda atrapada en su propio token y nadie la usa fuera por error?

**Severidad:** menor (riesgo de abuso, no de regresión).

**Análisis.** El nombre `--ease-vt-signature` es deliberadamente descriptivo. Token aparte (no inline en `::view-transition-group`) para que cualquier uso fuera sea **detectable por grep**.

**Resolución.**

1. `tokens.md` §7.2 documenta: "**Sólo** view-transitions. Nunca fuera."
2. `tokens-css.md` §1 declara el token con comentario explícito.
3. Auditable por grep: `grep -r "ease-vt-signature" src/` debería sólo aparecer en CSS `::view-transition-group`. Si aparece en componentes JS/TSX, es bug.

Riesgo aceptado.

---

## 12. ¿Conflictos con `directions.md` §4.4 que un agente futuro pueda confundir?

**Severidad:** mayor.

**Análisis.** `directions.md` §4 es referencia histórica de S1 (Bento Atelier post rev 3). Tras S3 hay tres divergencias:

- Primario Indigo (h268) → Velvet (h290). ADR 0003 D1.
- `--accent-cool` teal (h195) → azul-gris (h215). `tokens.md` §11.2.
- Paleta categórica reservada → eliminada. ADR 0004.

Si un agente futuro lee `directions.md` §4.4 sin leer los ADRs ni `tokens.md`, podría reintroducir Indigo o `--cat-*`.

**Resolución.**

1. `tokens.md` frontmatter declara `supersedes: directions.md §4`.
2. README.md (a actualizar) incluye nota explícita en la sección de mapa de archivos: `directions.md` §4 = referencia histórica; tokens vivos en `tokens.md`.
3. Cualquier sesión futura (S4+) lee primero `README.md` → `decisions/000X.md` → `tokens.md`, en ese orden, según las "lecturas mínimas" del README.

Cubierto. Si aún así un agente confunde, la verificación de `tokens.md` durante implementación detecta la divergencia.

---

## 13. Status chip-text en light: ¿son demasiados tokens para algo que podría resolverse con `color-mix` inline?

**Severidad:** menor (decisión de inventario).

**Análisis.** Se introdujeron 4 tokens nuevos: `--success-chip-text`, `--warning-chip-text`, `--destructive-chip-text`, `--info-chip-text`. Alternativa: definir un mixin / receta que cada componente compone inline.

**Resolución.** Tokens nombrados ganan porque:

1. Son referenciados por el componente `<StatusChip>` como una variable única (no `color-mix(in oklch, var(--success) ?%, …)` que requiere afinar el % por status).
2. El L apropiado para cada chip-text varía por hue (verde 152 necesita más oscuro que info 245). No hay un % uniforme que sirva para los 4.
3. En dark son aliases del status base — el costo es trivial.

Decisión: mantener los 4 tokens. Riesgo aceptado de "4 tokens más en el inventario" por claridad y mantenibilidad.

---

## 14. ¿La paleta Lilac light `--accent-cool` (h165 verde-aguamarina suave) viola la nueva semántica "azul-gris suave"?

**Severidad:** menor (consistencia conceptual).

**Análisis.** Velvet `--accent-cool` h215 (azul-gris). Plum h220, Lagoon h250, Forest h250 — todos en rango azul. **Lilac h165** está en verde-aguamarina, fuera del cluster. El demo lo definió así para complementar el lila (h310) — un complemento más cálido (verde) en lugar de azul.

**Resolución.** Mantener Lilac en h165 — es deliberado por marca (la paleta tiene su carácter y el accent-cool es libre dentro de la regla "no chocar con accent ni con info"). En h165 está suficientemente lejos de `--info` h245 (Δh=80) — no hay riesgo de colapso. Documento la divergencia como **decisión de marca**, no como bug.

Justificación añadida implícitamente: cada paleta puede elegir el hue de `--accent-cool` que mejor complemente su `--accent`, siempre que: (a) no colapse con `--info`, (b) cumpla AA mínimo 3:1 sobre `--background` para íconos.

Validación: Lilac `--accent-cool` h165 sobre `--background` light = 3.00:1 (justo). Pasa. Documentado.

---

## 15. ¿La regla "ningún componente declara `z-index` arbitrario" es realista en producción?

**Severidad:** menor.

**Análisis.** La regla es ambiciosa pero no imposible. Patterns conocidos que rompen: stacking context locales (transform, filter, opacity < 1), portals que crean nuevos contextos, libraries de terceros con z-index hardcoded.

**Resolución.**

1. La regla queda en `tokens.md` §8 como contrato del sistema. Cualquier tercero que necesite `z-index` propio se documenta como excepción.
2. Cualquier nuevo overlay debe mapear a una de las 13 capas existentes (`--z-base` a `--z-tooltip`). Si no encaja, abrir ADR antes de inventar nivel intermedio.
3. Para libraries (datepicker, command-K, drag handles), el componente wrapper de PandaTrack inyecta `z-index: var(--z-popover)` etc. via CSS-in-JS o portal.

Aceptado como regla con asterisco.

---

## Cierre

15 objeciones evaluadas, 0 bloqueantes pendientes, 0 mayores sin resolución, 5 menores aceptados con riesgo controlado. El sistema de tokens S3 cierra firmado.

**Actualización post-research follow-up (2026-05-02 tarde):** se cerraron 4 temas pendientes con 4 sub-agentes de research independientes (apps reales + research académica + design systems). Resultados consolidados:

- **Objeción #3 (daltonismo):** cerrada por ADR 0006. Mover hues no resuelve; mitigación correcta = contrato vinculante "ícono + label".
- **Objeción #4 (paleta categórica):** confirmada — ADR 0004 sobrevive (6/6 apps de hobby no usan color por categoría).
- **Objeción #8 (`--accent-warm` Lilac fail):** cerrada por ADR 0005 (icon-tile circular soft-tint con cifra neutra; 11+ apps convergen).
- **Validation #4 (text-muted outdoor):** refinada por ADR 0007 (code mono `PT-XXXXXX` reasignado a `--text-secondary` 6.32:1, sin tocar tokens).

Riesgos abiertos remanentes (no bloquean S4):

1. ~~Validación con simulador de daltonismo de `--info` vs `--accent-cool` (objeción #3)~~ — **CERRADO por ADR 0006** (mitigación contrato ícono+label).
2. Auditar `text-white` hardcoded en componentes legacy (objeción #9) — pendiente para S12.
3. Velvet `--border` dark marginal (objeción #10) — monitoreo en S6.
4. Adopción de regla z-index sin excepciones en libraries de tercero (objeción #15) — manejo caso por caso.
5. Validation #4 humana refinada (Pixel 6a + iPhone 15 Pro bajo sol, setup split) — ejecuta humano paralelo a S4.
6. Validación con usuario dichromat real del contrato ADR 0006 — programada para S6+ alta fidelidad como confirmación final.
