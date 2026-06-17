---
title: S3 draft — typography tokens
status: draft beta — para consolidación cross-área
---

> Notación: convención Tailwind v4 `@theme`. Light y dark se calculan independientemente (regla "hermanos" del draft de color); la única diferencia entre modos en este bloque tipográfico es el peso ajustado en dark para Display y, cuando aplica, para Body. Cualquier tier no listado debe revalidarse antes de aprobar.

---

## 1. Stack final

Decisión cerrada: **Inter Variable + Inter Display + JetBrains Mono Variable**.

| Familia                 | Rol                                                                            | Por qué                                                                                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inter Variable          | Body, UI, formularios, controles, lista, tabla, todos los tiers ≤ Subtitle.    | Misma familia que el cut display → coherencia métrica perfecta entre title y body, sin saltos de eje x al transicionar entre tamaños. Soporte completo de `font-variant-numeric` y `feature-settings` (ss01, cv11, cv05).                             |
| Inter Display           | Display y Title (números héroe, headings ceremoniales, hero del dashboard).    | Cuts ópticos del mismo familiar Inter, diseñados específicamente para tamaños ≥24px (espacio interletra y curvas optimizadas). Mantener todo dentro de la familia Inter da coherencia mayor que mezclar Inter body + Geist display (familias ajenas). |
| JetBrains Mono Variable | Mono code, mono badges, IDs, eyebrows uppercase, tabular numerals secundarios. | Variable axis (peso 100→800), legibilidad superior a 11–13px que es donde mono vive en este sistema, ligadas controlables vía `calt`. Coexiste perceptualmente con Inter (ambos son humanist sans/mono modernos).                                     |

Alternativa **Geist Variable** descartada: introducir Geist como display rompería la coherencia métrica con Inter body (proporciones distintas en el eje x, ojal de la `a`, terminales de la `t`), generando un "salto" visible al pasar de un Subtitle Inter a un Display Geist en la misma card. Inter Display resuelve la misma necesidad sin cambiar de familia.

Carga: las tres se sirven como `next/font/google` (Inter, JetBrains_Mono) más Inter Display vía `next/font/local` con archivos variable WOFF2 desde `public/fonts/inter-display/`. `font-display: swap` y `preload` solo para Inter Variable y Inter Display Display-700 (los demás cuts son accesibles vía variable axis sin preload extra).

---

## 2. Tokens de familia (`--font-*`)

```css
@theme {
  --font-sans: "Inter Variable", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-display: "Inter Display", "Inter Variable", "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono Variable", "JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
}
```

Notas:

- `--font-sans` mapea a `font-sans` Tailwind (default).
- `--font-display` mapea a `font-display` Tailwind. Solo se usa con tiers `display`, `title` y excepcionalmente `subtitle` cuando el componente lo justifica (ver §3).
- `--font-mono` mapea a `font-mono` Tailwind y se usa en tiers `mono-lg`, `mono`, `eyebrow` y siempre que se rendericen IDs, hashes, códigos de tracking, badges status uppercase.

---

## 3. Escala (`--text-*`)

Cada tier produce tres sub-properties Tailwind v4: `--text-{name}` (size), `--text-{name}--line-height`, `--text-{name}--letter-spacing`. La columna "weight default" no es un sub-property `@theme` sino el valor que aplican las utilities semánticas (Heading, Body, etc.) y los componentes que consumen el tier.

| Tier     | Token Tailwind  | Size                                          | Line-height       | Letter-spacing | Weight default (light / dark) | Familia          | Uso siempre / sólo / nunca                                                                                                                                                                                                          |
| -------- | --------------- | --------------------------------------------- | ----------------- | -------------- | ----------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Display  | `text-display`  | `clamp(2.5rem, 4vw + 1rem, 3.5rem)` (40→56px) | `4rem` (64px)     | `-0.03em`      | 700 / 670                     | `--font-display` | Hero numérico del dashboard, monto principal de "Próximo pago", display de bienvenida onboarding. Sólo una vez por viewport. Nunca dentro de cards densas, listas, formularios.                                                     |
| Title    | `text-title`    | `2rem` (32px)                                 | `2.5rem` (40px)   | `-0.02em`      | 600 / 580                     | `--font-display` | Títulos de página principal, headings de sección de detalle (`Pedido #123`, nombre de tienda en hero). Sólo cuando hay jerarquía con un Subtitle o Body-L cercano. Nunca como heading de card secundaria.                           |
| Subtitle | `text-subtitle` | `1.375rem` (22px)                             | `1.75rem` (28px)  | `-0.01em`      | 600 / 600                     | `--font-sans`    | Headings de card, headings de sub-sección dentro de detalle, modal title. Familia sans (no display) para mantener legibilidad en tamaño medio. Nunca para body.                                                                     |
| Body-L   | `text-body-lg`  | `1.0625rem` (17px)                            | `1.625rem` (26px) | `0`            | 400 / 400                     | `--font-sans`    | Subtítulo descriptivo del hero, body principal de empty state, intro de modal. Sólo cuando se requiere un body más respirado que el Body por defecto. Nunca como body de tabla ni de formulario.                                    |
| Body     | `text-body`     | `0.9375rem` (15px)                            | `1.375rem` (22px) | `0`            | 400 / 400 (medium 500 / 480)  | `--font-sans`    | Body por defecto del sistema: texto de card, párrafo de detalle, label de input no-focus, valor de input. Weight 500 (medium) cuando el componente requiere énfasis (label de input enfocado, valor numérico inline). Nunca >70 ch. |
| Caption  | `text-caption`  | `0.8125rem` (13px)                            | `1.125rem` (18px) | `+0.005em`     | 500 / 500                     | `--font-sans`    | Helper text de input, footnote de card, microcopy bajo CTA, leyenda de progress bar, fecha relativa. Nunca para body principal ni para el primer label visible de un campo.                                                         |
| Mono-L   | `text-mono-lg`  | `0.9375rem` (15px)                            | `1.375rem` (22px) | `0`            | 500 / 500                     | `--font-mono`    | Códigos visibles en cards de detalle (tracking number, ID de pedido en su propia fila), bloques de código en docs in-app. Sólo cuando el contenido es código real o ID. Nunca para texto narrativo "decorado en mono".              |
| Mono     | `text-mono`     | `0.8125rem` (13px)                            | `1.125rem` (18px) | `+0.02em`      | 500 / 500                     | `--font-mono`    | Mono inline dentro de body (e.g. ID corto en una row de lista), badge status mono, micro-stat label numérico tabular. Nunca uppercase (eso es eyebrow).                                                                             |
| Eyebrow  | `text-eyebrow`  | `0.6875rem` (11px)                            | `0.875rem` (14px) | `+0.08em`      | 500 / 500                     | `--font-mono`    | Eyebrow uppercase sobre headings ceremoniales ("TUS PRE-ÓRDENES", "PRÓXIMO PAGO"), label uppercase de strip de micro-stats, header de columna en tabla compacta. Sólo uppercase. Nunca como body ni como label de input.            |

Notas de cobertura:

- El clamp del Display cubre 40px (mobile ~360px) → 56px (desktop ≥1024px). El crossover entra a partir de ~640px de viewport.
- `body` y `mono-lg` comparten métricas de tamaño/altura para alinear verticalmente baselines cuando un mono inline aparece dentro de una línea de body.
- `caption` y `mono` también comparten 13/18 para que el helper text mono y el helper text sans rimen en la misma row de un formulario.
- `eyebrow` es token nuevo (no estaba explícito en Atelier §4.5 pero está implícito en "Eyebrow mono uppercase" usado por hero, micro-stats y card headers ceremoniales).

---

## 4. Pesos (tokens auxiliares)

Tailwind v4 no expone `font-weight` como `@theme` por default; los registramos como CSS vars en `:root` para uso semántico desde componentes y utilities.

```css
:root {
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-display: 700;
  --font-weight-mono: 500;
}
```

Aliases Tailwind opcionales (para escribir `font-display` como peso, no como familia, en componentes ad-hoc — desambiguar con la utility `font-weight-display` propuesta en §7):

| Alias                    | Valor |
| ------------------------ | ----- |
| `--font-weight-regular`  | 400   |
| `--font-weight-medium`   | 500   |
| `--font-weight-semibold` | 600   |
| `--font-weight-display`  | 700   |
| `--font-weight-mono`     | 500   |

Reglas de aplicación:

- Body por default: 400. Pasar a 500 para énfasis inline (label de input focus, valor numérico clave dentro de un párrafo). Pasar a 600 sólo para Subtitle y para el row primario seleccionado en una lista densa.
- Display siempre 700 (light) / 670 (dark) — ver §6.
- Title siempre 600 (light) / 580 (dark) — ver §6.
- Mono siempre 500 — el regular 400 mono se ve "frágil" a 11–13px en pantallas estándar.
- Subtitle 600 en ambos modos (no requiere ajuste óptico porque el cut Inter sans a 22px no engrosa visualmente como Display).

---

## 5. `font-feature-settings` por tier

Reglas vinculantes — aplicadas vía clase utility o directamente en el token Tailwind.

| Tier          | `font-feature-settings`  | Justificación                                                                                                                                                                                                                        |
| ------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Display       | `"ss01", "cv11", "tnum"` | `ss01` activa alternates Inter Display más editoriales (1, J, l con terminales contundentes). `cv11` cambia el `1` por la versión sin serif horizontal — clave para hero numéricos. `tnum` porque casi todos los Display son cifras. |
| Title         | `"ss01", "cv11"`         | Mismo set para coherencia con Display. `tnum` solo si la instancia muestra cifras (aplicar via `.numeric` en lugar de bakear en el tier).                                                                                            |
| Subtitle      | (ninguno por default)    | Sin alternates — Subtitle ya está en Inter sans estándar.                                                                                                                                                                            |
| Body-L / Body | (ninguno por default)    | Body neutro, sin alternates. Activar `tnum` solo cuando renderiza cifras (vía `.numeric`).                                                                                                                                           |
| Caption       | (ninguno por default)    | Idem body.                                                                                                                                                                                                                           |
| Mono-L / Mono | `"calt", "ss01"`         | `calt` activa alternates contextuales de JetBrains Mono (separa `1` de `l`, `0` de `O`). `ss01` activa el set "more readable" recomendado por JetBrains.                                                                             |
| Eyebrow       | `"calt", "ss01"`         | Mismo que mono. Uppercase + tracking +0.08em es la diferencia visible.                                                                                                                                                               |

Cifras (transversal):

- **Toda cifra renderizada por el sistema usa `font-variant-numeric: tabular-nums` + `font-feature-settings: "tnum"`**, sin excepción. Esto incluye montos de pre-orden, IDs numéricos, fecha, hora, contadores, totales de tabla, micro-stats. Se expone como utility `.numeric` (ver §7) para evitar tener que recordar agregarlo en cada componente.

---

## 6. Comportamiento por modo

Hermanos light/dark — la única diferencia tipográfica entre modos vive aquí.

| Aspecto                             | Light                          | Dark                                   | Por qué                                                                                                                                                                                                                  |
| ----------------------------------- | ------------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Display weight                      | 700                            | 670                                    | Inter Display a 700 sobre fondo oscuro engruesa visualmente ~30 unidades de peso (efecto "óptico" documentado en variable fonts). Bajar a 670 mantiene la presencia editorial sin que el hero se vea "negrita ladrillo". |
| Title weight                        | 600                            | 580                                    | Mismo principio en menor magnitud. -20 alcanza para 32px.                                                                                                                                                                |
| Body weight (medium)                | 500                            | 480                                    | Solo aplica al modo medium del body (énfasis inline, label focus). El body regular 400 no se ajusta porque ya es delgado y bajarlo más empeoraría legibilidad.                                                           |
| Body color (no-token)               | `--text-primary` light (L=22%) | `--text-primary` dark (L=96%, NO 100%) | Definido en draft de color §3 — el body en dark vive a 96% L para reducir vibración óptica. Tipografía hereda este token; no necesita override propio.                                                                   |
| Italic                              | nunca                          | nunca                                  | Regla heredada de Atelier §4.5: sin itálicas en ningún tier. El énfasis viene de peso variable + tracking apretado.                                                                                                      |
| Subtitle / Caption / Mono / Eyebrow | sin cambio                     | sin cambio                             | Tamaños medios y pequeños no requieren ajuste óptico de peso. La diferencia perceptiva entre modos a estos tamaños es despreciable y un override innecesario aumentaría la complejidad del CSS.                          |

Implementación sugerida (override por modo, no token aparte):

```css
:root {
  /* Light defaults vienen de --font-weight-* */
}

:root[data-theme="dark"] {
  --font-weight-display: 670;
  --font-weight-title: 580;
  --font-weight-medium-body: 480;
}
```

Y los componentes/utilities consumen `var(--font-weight-display)` en vez de hardcodear `font-weight: 700`. Esto evita branching en cada componente.

---

## 7. Utilities reusables

Clases helper que viven en el layer base de Tailwind (definidas una vez, reutilizadas en componentes y JSX).

```css
@layer utilities {
  /* Cifras tabulares — obligatorio en cualquier render numérico */
  .numeric {
    font-variant-numeric: tabular-nums;
    font-feature-settings: "tnum";
  }

  /* Eyebrow mono uppercase — patrón hero, micro-stats, headers ceremoniales */
  .eyebrow {
    font-family: var(--font-mono);
    font-size: var(--text-eyebrow);
    line-height: var(--text-eyebrow--line-height);
    letter-spacing: var(--text-eyebrow--letter-spacing);
    font-weight: var(--font-weight-mono);
    text-transform: uppercase;
    color: var(--text-muted);
  }

  /* Display preset — combina familia, peso variable por modo y features */
  .display {
    font-family: var(--font-display);
    font-weight: var(--font-weight-display);
    letter-spacing: -0.03em;
    font-feature-settings: "ss01", "cv11", "tnum";
    font-variant-numeric: tabular-nums;
  }

  /* Title preset */
  .title {
    font-family: var(--font-display);
    font-weight: var(--font-weight-title, 600);
    letter-spacing: -0.02em;
    font-feature-settings: "ss01", "cv11";
  }
}
```

Notas:

- `.numeric` es el helper más usado del sistema. Cualquier componente que renderice una cifra debe componerlo (e.g. `<span className={cn("text-display", "numeric")}>...</span>`).
- `.eyebrow` consume `--text-muted` del bloque color. Si una superficie excepcional necesita eyebrow con otro color (e.g. eyebrow accent en achievement), se compone con `text-accent` Tailwind sobre la utility.
- `.display` y `.title` son atajos opcionales — se puede componer manualmente con `font-display`, `text-display`, `font-weight-display` y `tracking-...` Tailwind utilities, pero los presets garantizan que las features y el ajuste por modo se apliquen sin omisiones.

---

## 8. Mapping `@theme` propuesto

Bloque CSS dummy mostrando cómo se declararían los tokens en `src/app/globals.css` (o el archivo equivalente que consolide `tokens.md`):

```css
@import "tailwindcss";

@theme {
  /* Familias */
  --font-sans: "Inter Variable", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-display: "Inter Display", "Inter Variable", "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono Variable", "JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;

  /* Escala — Display */
  --text-display: clamp(2.5rem, 4vw + 1rem, 3.5rem);
  --text-display--line-height: 4rem;
  --text-display--letter-spacing: -0.03em;

  /* Escala — Title */
  --text-title: 2rem;
  --text-title--line-height: 2.5rem;
  --text-title--letter-spacing: -0.02em;

  /* Escala — Subtitle */
  --text-subtitle: 1.375rem;
  --text-subtitle--line-height: 1.75rem;
  --text-subtitle--letter-spacing: -0.01em;

  /* Escala — Body-L */
  --text-body-lg: 1.0625rem;
  --text-body-lg--line-height: 1.625rem;
  --text-body-lg--letter-spacing: 0;

  /* Escala — Body */
  --text-body: 0.9375rem;
  --text-body--line-height: 1.375rem;
  --text-body--letter-spacing: 0;

  /* Escala — Caption */
  --text-caption: 0.8125rem;
  --text-caption--line-height: 1.125rem;
  --text-caption--letter-spacing: 0.005em;

  /* Escala — Mono-L */
  --text-mono-lg: 0.9375rem;
  --text-mono-lg--line-height: 1.375rem;
  --text-mono-lg--letter-spacing: 0;

  /* Escala — Mono */
  --text-mono: 0.8125rem;
  --text-mono--line-height: 1.125rem;
  --text-mono--letter-spacing: 0.02em;

  /* Escala — Eyebrow */
  --text-eyebrow: 0.6875rem;
  --text-eyebrow--line-height: 0.875rem;
  --text-eyebrow--letter-spacing: 0.08em;
}

:root {
  /* Pesos auxiliares (light defaults) */
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-display: 700;
  --font-weight-title: 600;
  --font-weight-medium-body: 500;
  --font-weight-mono: 500;
}

:root[data-theme="dark"] {
  /* Ajuste óptico — única diferencia tipográfica por modo */
  --font-weight-display: 670;
  --font-weight-title: 580;
  --font-weight-medium-body: 480;
}
```

Esto da utilities Tailwind automáticas: `font-sans`, `font-display`, `font-mono`, `text-display`, `text-title`, `text-subtitle`, `text-body-lg`, `text-body`, `text-caption`, `text-mono-lg`, `text-mono`, `text-eyebrow`. Cada `text-*` aplica size + line-height + letter-spacing en una sola clase.

---

## 9. Riesgos / dudas para el agente principal

1. **Inter Display licencia y alojamiento.** Inter Display se publica como cuts del proyecto Inter pero su distribución oficial depende de la versión del repo de Rasmus Andersson. Confirmar antes de cerrar `tokens.md`: ¿está disponible en Google Fonts como `Inter` con axis `opsz` (que activa los cuts Display automáticamente a tamaños grandes), o requiere descargar archivos variable y servirlos vía `next/font/local`? Si Google Fonts ya expone `opsz`, el stack se simplifica a una sola declaración de `Inter` con axis `opsz` activado.

2. **Compatibilidad de `clamp()` en `--text-*` Tailwind v4.** El sub-property `--text-display` con valor `clamp(...)` debe verificarse en la versión de Tailwind v4 instalada (algunas versiones tempranas no aceptaban `clamp` directamente en `@theme` y exigían pasar a una CSS var intermedia). Si falla, mover el clamp a `:root { --text-display: clamp(...); }` y referenciarlo desde `@theme { --text-display: var(--text-display); }`.

3. **Override de peso por modo via CSS var.** El patrón propuesto (consumir `var(--font-weight-display)` desde componentes) requiere que ningún componente hardcodee `font-weight: 700`. Riesgo de regresión silenciosa si cuando se migren los componentes existentes alguno queda con `font-bold` Tailwind literal en un Display — quedaría siempre 700 también en dark. **Pendiente confirmar en S3-component:** auditar usos de `font-bold` y `font-semibold` en componentes que renderizan Display/Title.

4. **`cv11` (alternate del `1` sin serif)** es una feature avanzada de Inter Display; si la versión de Inter Variable instalada no la soporta (versiones <4.0), `font-feature-settings: "cv11"` se ignora silenciosamente y los `1` mantienen serif horizontal. Verificar versión Inter en `package.json` o en los archivos local.

5. **`text-eyebrow` token nuevo.** No estaba en el inventario explícito de Atelier §4.5. El agente que arme `tokens.md` debe agregarlo a la sección "escala" y marcar que reemplaza el patrón ad-hoc `text-[11px] uppercase tracking-[0.08em]` que aparece en wireframes S2. Sin token, cada componente podría inventar su propio eyebrow.

6. **Tracking `+0.005em` en Caption** es un valor poco común y borderline imperceptible; se incluye porque a 13px sin tracking el body se siente apenas "comprimido" comparado con el body 15px (que tiene `0`). Si en S3 component la diferencia visual es nula, simplificar a `0` para reducir variantes.

7. **Familia `--font-display` con fallback a `Inter Variable`** asume que si Inter Display falla en cargar, Inter Variable absorbe el render sin layout shift catastrófico. Verificar con simulación de `font-display: swap` que la métrica de Inter Display y Inter Variable coincidan lo suficiente (mismo proyecto, debería) para no provocar CLS al swap.

8. **Italic prohibido — riesgo de regresión.** El sistema no expone tokens italic ni utility `.italic`. Si algún componente legacy en `src/components/` usa `italic` Tailwind (e.g. en un blockquote, en un placeholder), el token system no lo bloquea automáticamente. **Pendiente:** considerar lint rule o convención en `docs/design/visual-foundations.md` que prohíba `italic` en código nuevo.
