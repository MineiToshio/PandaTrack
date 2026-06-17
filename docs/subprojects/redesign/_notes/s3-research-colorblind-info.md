---
title: Research — daltonismo `--info` h245 vs `--accent-cool` h215
status: investigación
session: 03-tokens
owner: Sergio Minei
last_updated: 2026-05-02
related:
  - tokens.md §1.4 / §1.5 / §11.2 / §12 (riesgo abierto #6)
  - _notes/s3-red-team.md objeción #3
  - _notes/s3-contrast-audit.md
---

# 1. Tipos de daltonismo y prevalencia

Fuentes principales: Wikipedia "Color blindness", Colour Blind Awareness, NIH National Eye Institute, Colblindor.

| Tipo                        | Cono afectado                        | Prevalencia (♂ origen europeo) | Prevalencia (♀) | Característica clave                                                                                                               |
| --------------------------- | ------------------------------------ | ------------------------------ | --------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Deuteranomalía**          | M-cone defectuoso (anomalous tri.)   | ~5%                            | ~0.4%           | Tipo más frecuente. Discriminación reducida verde-rojo y, secundariamente, **azul-violeta**.                                       |
| **Deuteranopia**            | M-cone ausente (dichromat)           | ~1%                            | ~0.01%          | Sin M-cone. Confusion line ~498nm "neutral point". Toda variación verde-rojo se colapsa al eje L+S.                                |
| **Protanomalía**            | L-cone defectuoso                    | ~1%                            | ~0.03%          | Similar a deuteranopia pero con **shift de luminosidad**: rojos se ven más oscuros.                                                |
| **Protanopia**              | L-cone ausente                       | ~1%                            | ~0.02%          | Misma confusion plane que deutan en LMS, pero con compresión de luminancia en la zona roja. Blues casi idénticos a percepción tri. |
| **Tritanomalía/Tritanopia** | S-cone defectuoso/ausente            | <0.01% combinado               | <0.01%          | **Confusión azul-verde y amarillo-violeta.** Azules cortos (<480nm) se ven oscurecidos o verdosos.                                 |
| **Acromatopsia**            | 0 o 1 tipo de cono (rod monochromat) | ~0.003% (1:30000)              | igual           | Sin color. Sólo L cuenta.                                                                                                          |

Suma realista: el grupo "que importa" para `--info` vs `--accent-cool` son **deutans + protans = ~6-8% de hombres**, lo que en la base de PandaTrack (coleccionistas, sesgo masculino histórico) se proyecta a ~5-7% de la base usuaria. Tritan + acromat son <0.02% combinado: importantes por inclusión pero no son la palanca de decisión.

Referencia operativa: NIH NEI, "Types of Color Vision Deficiency"; Colour Blind Awareness "Types"; Wikipedia "Color blindness".

---

# 2. Cómo se transforman h215 y h245 en deutan / protan / tritan

## 2.1 Modelo de simulación (Brettel-Mollon-Viénot, 1997)

El paper de Brettel, Viénot & Mollon (JOSA A, 1997) define la simulación canónica usada por Chrome DevTools, Sim Daltonism, Stark, DaltonLens y Coblis. El algoritmo:

1. Convierte sRGB → linearizado → LMS (Long/Medium/Short cone response).
2. Proyecta el estímulo a una "reduced stimulus surface" definida por el eje neutro acromático y dos estímulos monocromáticos ancla.
3. Para protan/deutan los anchors son **575nm (amarillo)** y **475nm (azul)**. Para tritan: 660nm (rojo) y 485nm (azul-verde).
4. Resultado: todos los colores caen sobre un plano 2D donde la única dimensión cromática que sobrevive es la "amarillo-azul", y la otra es luminancia (L).

Consecuencia fuerte: **todos los azules, sea cual sea el hue original (h180-h280 OKLCH), proyectan al mismo extremo "azul" del eje amarillo-azul en deutan/protan.** La distinción entre dos azules cercanos pasa a depender exclusivamente de:

- **ΔL** (luminancia perceptual).
- **ΔC** dentro de la línea amarillo-azul (que perceptualmente se traduce en "qué tan saturado es el azul resultante").

## 2.2 Aplicación a Velvet

Tokens actuales:

| Token           | Light OKLCH            | Dark OKLCH             |
| --------------- | ---------------------- | ---------------------- |
| `--info`        | `oklch(0.58 0.14 245)` | `oklch(0.78 0.13 245)` |
| `--accent-cool` | `oklch(0.58 0.10 215)` | `oklch(0.74 0.11 215)` |

Conversión aproximada (calculada manualmente desde OKLCH → sRGB):

- `--info` light h245 → sRGB ≈ `#3F8AC8` (azul franco).
- `--accent-cool` light h215 → sRGB ≈ `#5C8AA0` (azul-gris cyan).
- `--info` dark h245 → sRGB ≈ `#9CC7E5` (celeste claro).
- `--accent-cool` dark h215 → sRGB ≈ `#94B8C8` (gris-cyan claro).

Aplicando Brettel/Viénot deutan (matriz LMS estándar):

- En **deutan/protan**: ambos colores se proyectan cerca de la misma zona "azul saturado / azul-gris" del plano amarillo-azul. La **diferencia visible** queda dictada por:
  - Light: ΔL=0, ΔC≈0.04 → diferencia post-proyección ≈ "casi imperceptible". Estimación de Delta-E post-CVD ≈ 4-6 (umbral de "diferenciable con esfuerzo" es ~3, cómodo es ~10).
  - Dark: ΔL=0.04, ΔC≈0.02 → estimación Delta-E post-CVD ≈ 5-7. Borderline.
- En **tritan**: ambos pierden el azul. `--info` h245 (más cerca de 475nm) cae más cerca del eje neutral, se vuelve gris-verdoso. `--accent-cool` h215 (más cerca de cyan) se vuelve verdoso más franco. Aquí **paradójicamente sí hay diferencia perceptual** (5-10 Delta-E) porque h215 pierde menos vs h245. Pero tritan es <0.01%.
- En **acromatopsia**: sólo L cuenta. Light ΔL=0 → indistinguibles. Dark ΔL=0.04 → marginalmente distinguibles (~3-4 Delta-E).

**Veredicto técnico:** en deutan/protan (los relevantes), `--info` y `--accent-cool` **colapsan a tonos azul-grisáceos casi idénticos**. La discriminación residual es marginal en dark (ΔL=0.04) y nula en light (ΔL=0). Sin mitigación adicional (ícono+label), un usuario deutan que ve un chip azul-grisáceo y un ícono azul-grisáceo en la misma row no puede inferir que pertenecen a familias semánticas distintas por color.

## 2.3 Verificación numérica adicional

Conversión a longitud de onda dominante aproximada:

- OKLCH h245 ≈ 470nm (azul puro).
- OKLCH h215 ≈ 485-490nm (cyan-azul).

El "neutral point" deutan está a ~498nm. Ambos hues caen del **mismo lado** del neutral point (lado azul corto). El paper de Brettel et al. y la guía de Datylon confirman: dos colores del mismo lado del neutral point se proyectan al **mismo cuadrante** de la confusion plane y sólo se diferencian por L.

---

# 3. Patrón en apps / design systems (5+ citados)

## 3.1 Material Design 3 (Google)

- Tiene `primary`, `secondary`, `tertiary` como roles cromáticos. **No tiene rol "info" formal en M3 baseline** — los devs lo asignan a `tertiary` o lo agregan ad-hoc.
- M3 baseline blue cae cerca de OKLCH h255-265 (más cercano a indigo).
- Decisión M3 sobre dos azules: **se desincentiva**. El sistema dynamic-color genera primary y tertiary deliberadamente con Δh ≥ 60° en HCT (su color space) para evitar colapso.
- Implicancia para nosotros: M3 nunca pondría `--info` y `--accent-cool` con Δh=30°. Su contrato exige separación más amplia.

Fuente: m3.material.io/styles/color/roles, m3.material.io/styles/color/advanced/apply-colors.

## 3.2 IBM Carbon Design System

- Tokens relevantes: `support-info` (azul franco h220 aprox), `link-primary` (azul interactivo h225 aprox), y previamente `interactive-01` (azul primario).
- Carbon explícitamente **separa** `support-info` de `link-primary` por luminancia, no por hue: ambos están cerca del mismo hue, pero `support-info` es más oscuro/saturado en chip backgrounds, `link-primary` es más vivo en texto.
- Carbon agrega **ícono obligatorio** en cada estado de notificación info (`<InlineNotification kind="info">` siempre lleva `Information20` icon).
- Carbon **no usa un "accent-cool" como categoría visual**; las categorías van por shape o por chart palette dedicada.

Fuente: carbondesignsystem.com/elements/color/overview, github.com/carbon-design-system/carbon.

## 3.3 Shopify Polaris

- Polaris define explícitamente: "blue is the color tied to interactivity" + "purple is for accents (no semantic)" + "info is the catch-all for promotional/informational tips."
- En Polaris, `info` y `interactive` son **el mismo blue base** con role distinto (no dos hues diferentes). Evita el problema de "dos azules" colapsándolos al mismo hue.
- `info` siempre se acompaña de ícono `InfoIcon` en banners, toasts, y inline messages.
- Solución elegante: si dos roles necesitan azul, comparten hue.

Fuente: polaris-react.shopify.com/design/colors/palettes-and-roles, polaris-react.shopify.com/tokens/color.

## 3.4 Atlassian Design System

- Tokens: `color.background.information` (con fallback `lightblue`), `color.text.information`, `color.icon.information` — todos en **un mismo cluster azul** (h215-225).
- Atlassian no tiene "accent-cool" — su accent secundario es `color.background.discovery` (purple/magenta), totalmente diferenciado.
- Filosofía: cada role tiene UN hue dedicado, y se evita el problema de dos azules cercanos por construcción.

Fuente: atlassian.design/foundations/color-new, atlassian.design/components/tokens.

## 3.5 GitHub Primer

- Primer define `accent` como "links, selected, active, focus states, **and neutral information**" — lo que significa que `accent` y `info` son **el mismo token** en Primer.
- No hay un `--accent-cool` separado; cuando se necesita un segundo "azul tranquilo", se usa una variante de luminancia del mismo `accent` (ej. `accent.muted`, `accent.subtle`).
- Igual que Polaris: si necesitás dos azules, son el mismo hue con luminancia distinta.

Fuente: primer.style/foundations/color/overview, primer.style/product/getting-started/foundations/color-usage.

## 3.6 Patrón unánime

**Ningún design system maduro usa dos hues azules distintos para roles semánticos.** El consenso es:

1. **Un único hue azul** para toda la familia interactiva/informativa, diferenciado por L y C.
2. **Acentos secundarios cromáticos** se llevan a **otra familia cromática** (purple, teal franco, magenta) para evitar colapso en deutan/protan.
3. Cuando hay info/notification, **siempre acompañar con ícono + texto**.

PandaTrack S3 está intentando una variante minoritaria (dos azules con Δh=30°). Esto es defendible si la mitigación icon+label se cumple estrictamente, pero está contra-corriente del consenso industrial.

---

# 4. Tools de simulación recomendadas

| Tool                                              | Plataforma              | Bondades                                                                                                         | Limitación                                                                        |
| ------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Chrome DevTools "Emulate vision deficiencies"** | Chrome (Rendering tab)  | Aplica filtro al viewport completo, reactivo, sin instalar nada. Cubre deutan/protan/tritan/acromat/blurred.     | Filtro CSS aproximado (no Brettel exacto). Suficiente para detección de colapso.  |
| **Sim Daltonism**                                 | macOS                   | Filtra ventana flotante en tiempo real sobre cualquier app (incluido Figma, Sketch, navegador). Brettel-correct. | Sólo macOS. No exporta resultado.                                                 |
| **Stark plugin**                                  | Figma / Sketch / Chrome | Análisis dentro del canvas de diseño + simulación CVD + auto-fix sugerido.                                       | Premium para features avanzadas. Excelente para auditar componentes en isolation. |
| **Coblis (color-blindness.com/coblis)**           | Web                     | Sube imagen, simula 8 tipos. Resultado descargable.                                                              | Manual, no integrado al workflow.                                                 |
| **DaltonLens (daltonlens.org + Python lib)**      | Web + Python            | Brettel/Viénot exacto. Lib Python para batch.                                                                    | UI web acepta sólo imágenes.                                                      |
| **WAVE / axe DevTools**                           | Browser extension       | Audit AA general. **No simula CVD** pero detecta uso de color sin label.                                         | Complementario, no sustituto.                                                     |

**Workflow recomendado para validar la decisión de PandaTrack:**

1. Renderizar el demo HTML (`_notes/demo-screens.html`) con Velvet light + Velvet dark.
2. Abrir Chrome DevTools → Rendering → Emulate vision deficiencies → "Deuteranopia". Inspeccionar visualmente la row con chip info + ícono de categoría.
3. Repetir con "Protanopia" y "Tritanopia".
4. Hacer screenshot y subirlo a Coblis o DaltonLens para verificación cruzada con simulador Brettel-correct.
5. Test de tarea: pedir a un usuario que mire la pantalla y diga "¿qué significa el chip azul que está al lado del ícono azul?". Si la respuesta requiere leer el label/tooltip, la mitigación funciona; si es ambigua, no.

---

# 5. Research externo

## 5.1 Brettel, Viénot & Mollon (1997) — "Computerized simulation of color appearance for dichromats"

- JOSA A, 1997, vol 14 issue 10, p. 2647.
- Define el algoritmo canónico de simulación. Anchors deutan/protan: 575nm + 475nm.
- Demuestra que en deutan/protan, todos los azules de h180-h280 OKLCH se proyectan al **mismo cuadrante de la confusion plane**. La diferencia residual es L y C.

URL: opg.optica.org/josaa/abstract.cfm?URI=josaa-14-10-2647 / vision.psychol.cam.ac.uk/jdmollon/papers/Dichromatsimulation.pdf

## 5.2 Smashing Magazine, "A Practical Guide To Designing For Colorblind People" (2024)

- Recomendación explícita: **"Do not mix purple and blue together"** — para protan/deutan red-purple parece azul, lo que también implica que blue-purple parece blue-blue.
- Recomendación operativa: usar L (luminancia) como discriminador primario, no hue, cuando dos colores comparten "familia" cromática post-proyección CVD.

URL: smashingmagazine.com/2024/02/designing-for-colorblindness/

## 5.3 W3C WCAG 2.2 SC 1.4.1 "Use of Color"

- Color **no debe ser el único** medio visual de transmitir información, indicar acción, distinguir elementos.
- Mitigación válida: **icon + text label** programáticamente asociado.
- Aplica a deutans/protans específicamente: "if content relies on user's ability to perceive a particular color, additional visual indicator required."

URL: w3.org/WAI/WCAG21/Understanding/use-of-color, w3.org/TR/UNDERSTANDING-WCAG20/visual-audio-contrast-without-color.html

## 5.4 NIH National Eye Institute — "Types of Color Vision Deficiency"

- Confirma prevalencias y características. Deutan + protan son los relevantes (~5-8% en hombres origen europeo).
- Recomienda redundancia (icon + text) como standard de cuidado.

URL: nei.nih.gov/learn-about-eye-health/eye-conditions-and-diseases/color-blindness/types-color-vision-deficiency

## 5.5 Colblindor — "Deuteranopia neutral point"

- Confirma neutral point a ~498nm. Wavelengths <480nm tienen **discriminación rápidamente decreciente** para deutans.
- OKLCH h215 (~488nm) y h245 (~470nm) ambos caen en zona de baja discriminación deutan.

URL: color-blindness.com/deuteranopia-red-green-color-blindness/

## 5.6 IBM Carbon notification pattern

- Toda notificación info en Carbon viene con `<Information20>` icon obligatorio + label visible. No depende del color para transmitir tipo.

URL: github.com/carbon-design-system/carbon, carbondesignsystem.com.

## 5.7 Datylon — "The best charts for color blind viewers"

- Recomienda variar **L (lightness)** como dimensión primaria de discriminación cuando hue está restringido.
- "Different lightnesses help readers with CVD distinguish colors."

URL: datylon.com/blog/data-visualization-for-colorblind-readers.

## 5.8 Atlassian, Polaris, Primer, Material — patrón unánime

Ya documentado en §3. Ningún sistema maduro usa "dos azules" — usan un solo azul + otra familia cromática para acento secundario.

---

# 6. Decisión inicial

**Opción (a): Mantener `--info` h245 + `--accent-cool` h215 + formalizar regla "siempre ícono+label" — INSUFICIENTE.**

Mi decisión inicial: **opción (d) — mover `--accent-cool` a un cuasi-neutro frío para sacarlo de la familia "azul" y dejar `--info` como el único azul franco del sistema.**

Razonamiento:

1. La regla unánime de los 5 design systems es: un solo hue por familia. Pelear contra esto sin evidencia empírica fuerte es deuda técnica.
2. `--info` debe ser el azul franco (es status, debe leerse como info-blue universal). Moverlo a cyan (h195) o indigo (h260) cambia su lectura semántica.
3. `--accent-cool` no tiene compromiso semántico fuerte: es "acento sereno secundario para íconos de categoría". Puede ser azul-gris muy desaturado (croma ≤ 0.05) sin perder identidad.
4. Bajando croma a ~0.04-0.05 con hue libre, `--accent-cool` se vuelve "color neutro fresco" en lugar de "azul-gris" — y deja de competir cromáticamente con `--info` en deutan/protan (post-proyección, un cuasi-gris no compite con un azul franco porque cae en el eje neutro de la confusion plane).
5. La regla operativa "ícono+label siempre" se mantiene como cinturón + tirantes, no como única defensa.

Valor tentativo:

- `--accent-cool` light: `oklch(0.58 0.04 230)` (cuasi-neutro frío, hue libre 220-240).
- `--accent-cool` dark: `oklch(0.74 0.04 230)`.

---

# 7. Contraargumentos (≥3)

## Contraargumento 1: "Bajar croma a 0.04 mata el carácter visual de los íconos de categoría"

Los íconos Lucide de categoría (`disc`, `shapes`, `book`, `tv`, `gamepad`, etc.) son la única forma en que la categoría se comunica en una row. Si pierden saturación, se vuelven "íconos grises", y la diferenciación entre tipos de producto se vuelve aún más débil que el problema que estoy intentando resolver.

**Peso:** alto. Atelier §4.4 originalmente justificaba `--accent-cool` como "color reconocible para íconos categóricos sin que compita con accent". Un cuasi-neutro frío dejaría las categorías visualmente apagadas.

## Contraargumento 2: "El consenso de 5 design systems no aplica porque PandaTrack tiene una regla operativa única — el chip de info nunca está sin label, los íconos nunca están sin label"

Polaris, Carbon, Atlassian, Material, Primer no usan dos azules porque no quieren depender de regla operativa, prefieren resolverlo en el sistema. Pero PandaTrack ya formalizó la regla en `tokens.md` §1.4 + §1.5: chip de info siempre con `clock` + label "Pendiente …", `--accent-cool` siempre como ícono de categoría con label adyacente. Si la regla se cumple a rajatabla, WCAG 1.4.1 está satisfecho y la confusión cromática es inocua porque ningún usuario decide acción sólo por color.

**Peso:** medio-alto. Es defendible. La debilidad: ¿qué pasa cuando el sistema crece y un dev nuevo agrega un chip info sin ícono? La regla viva en docs es más frágil que la diferenciación intrínseca por hue.

## Contraargumento 3: "Mover `--accent-cool` rompe la armonía cromática de Velvet"

Velvet es violeta profundo (h290 accent + h285 lienzo + h22-25 warm + h215 cool). El `--accent-cool` h215 fue elegido específicamente para complementar el violeta sin chocar (Δh=75 contra accent, ΔL ≈ 0.12). Bajarlo a cuasi-neutro lo desconecta del lenguaje cromático Velvet y lo vuelve "el ícono gris que no encaja con nada".

**Peso:** medio. La armonía Velvet se construyó con la cool a croma 0.10 — bajar a 0.04 sí cambia el carácter. Pero también: `--text-muted` h285 croma 0.022 es prácticamente neutro y no se siente disonante. Un cool a croma 0.04-0.05 con hue 215-225 mantiene la temperatura fría sin saturar.

## Contraargumento 4 (bonus): "El paper de Brettel/Viénot es de 1997 — 30 años. ¿Hay modelos más modernos que cuenten una historia distinta?"

Machado, Oliveira & Fernandes (2009) "A Physiologically-Based Model for Simulation of Color Vision Deficiency" mejora la precisión para anomalous trichromats (deuteranomalía severidad parcial), donde sí queda algo de discriminación residual entre dos azules cercanos. Pero para **dichromats puros** (deuteranopia, protanopia) Machado y Brettel coinciden: confusion plane, sin discriminación cromática residual. Y dichromats son ~2% del total — el subgrupo más afectado por la limitación.

**Peso:** bajo. No cambia la decisión.

---

# 8. Reevaluación + decisión final

Los contraargumentos 1 y 3 son fuertes. Bajar croma a 0.04 sí mata la identidad de los íconos de categoría y la armonía Velvet.

**Reformulación:** la pregunta no es "¿`--info` y `--accent-cool` son distinguibles en deutan?". La respuesta a esa pregunta es **no, no lo son post-proyección Brettel/Viénot, independientemente de Δh=30 o Δh=15** — ambos hues caen del mismo lado del neutral point deutan (498nm). La pregunta correcta es: **¿la mitigación ícono+label es suficiente para que el usuario deutan no pierda información ni opere mal?**

Aplicando WCAG 1.4.1 estrictamente: **sí, es suficiente** si la regla se cumple. Y la regla está formalizada en `tokens.md` §10 (jerarquía Primary/Extra/Reservada): `--info` "Sólo se usa para: pendiente sin urgencia (chip + ícono `clock`)" y `--accent-cool` "Sólo se usa para: color por defecto de íconos Lucide de categoría". **Nunca color-only.**

Resta el problema estético/UX: dos colores que se ven iguales lado a lado en deutan, aunque informacionalmente sean recuperables, generan **ruido visual** ("¿son lo mismo? ¿son distintos?"). Esto degrada la experiencia aunque no degrade la operación.

## Decisión final: **opción (a) con refinamiento — mantener `--info` h245 + `--accent-cool` h215, pero formalizar la mitigación como invariante del sistema y agregar plan de validación humana en S4.**

Razones para descartar mover ambos:

- Mover `--info` a h195 (cyan-teal) lo aleja de la lectura semántica "info-blue" universal. Riesgo de leer como "agua/teal" (Lagoon palette territory).
- Mover `--info` a h260+ lo lleva a indigo-violeta, pisando `--accent` Velvet h290. Δh=30 contra accent es el mismo problema, ahora del otro lado.
- Mover `--accent-cool` a cuasi-neutro mata la identidad de los íconos de categoría (CA1) y rompe la armonía Velvet (CA3).
- La mitigación ícono+label ya está formalizada y es WCAG 1.4.1 compliant.

Razones para reforzar la regla, no cambiar tokens:

1. Promover la regla "chip info siempre con `clock` + label" a **invariante del sistema** (agregar a las "Reglas duras" del §0 de `tokens.md`, no sólo en §10).
2. Agregar **lint rule / Storybook check**: cualquier `<StatusChip kind="info">` sin `icon` prop debe fallar el build.
3. Documentar que `--accent-cool` **nunca aparece en chips ni badges** (sólo en íconos standalone con label adyacente). Bloquear con tipo TS.
4. Plan de validación humana S4: simulación deutan/protan en demo HTML + tarea con usuario real con CVD si está disponible.

## Resumen

- **Opción elegida: (a) — mantener tokens, formalizar mitigación como invariante.**
- No se proponen nuevos valores OKLCH (los actuales se mantienen).
- Se propone reforzar el contrato de uso con: (i) invariante en §0 de `tokens.md`, (ii) tipo TS que obligue `icon` prop en StatusChip kind=info, (iii) plan de validación humana en S4.

---

# 9. Si propone cambio de token: nuevos valores OKLCH

**No se propone cambio de tokens.** Los valores actuales de Velvet se mantienen:

| Token           | Light                  | Dark                   | Status     |
| --------------- | ---------------------- | ---------------------- | ---------- |
| `--info`        | `oklch(0.58 0.14 245)` | `oklch(0.78 0.13 245)` | sin cambio |
| `--accent-cool` | `oklch(0.58 0.10 215)` | `oklch(0.74 0.11 215)` | sin cambio |

Ratios AA verificados (de `_notes/s3-contrast-audit.md`):

- `--info` light sobre `--background`: 4.87:1 (texto AA pasa).
- `--info-chip-text` light sobre chip 14% bg: 4.71:1 (AA pasa).
- `--info` dark sobre `--background`: 8.12:1 (AA pasa).
- `--accent-cool` light sobre `--background`: 3.21:1 (UI components AA pasa, texto NO — pero es uso ícono, no texto).
- `--accent-cool` dark sobre `--background`: 6.94:1 (UI components AA pasa).

Distinguibilidad post-Brettel: marginal en dark, casi nula en light. **Mitigación obligatoria por contrato de uso.**

---

# 10. Plan de validación humana

## 10.1 Paso 1 — Simulación visual estructurada (S4 antes del primer mock real)

1. Tomar el demo HTML actual (`_notes/demo-screens.html`) o el primer screen de S4 (Dashboard o Order list).
2. Renderizar en Chrome con tema Velvet light + dark.
3. Abrir DevTools → More Tools → Rendering → "Emulate vision deficiencies":
   - Aplicar **Deuteranopia**. Hacer screenshot de una row con chip info "Pendiente sin urgencia" + ícono de categoría en `--accent-cool`.
   - Repetir **Protanopia**.
   - Repetir **Tritanopia**.
   - Repetir **Achromatopsia**.
4. Verificación: mirando los screenshots **sin ver el original**, ¿se entiende qué es qué?
   - Pass: el ícono `clock` + label "Pendiente sin urgencia" del chip son legibles. El ícono de categoría es identificable (forma reconocible: `disc` para vinyl, `shapes` para figures).
   - Fail: confusión entre chip y ícono ("¿son lo mismo?"), o pérdida de información de categoría.

## 10.2 Paso 2 — Verificación con simulador Brettel-correct

1. Subir los mismos screenshots a **Coblis** (color-blindness.com/coblis-color-blindness-simulator) y **DaltonLens** (daltonlens.org/colorblindness-simulator).
2. Cross-check con DevTools (DevTools usa filtro CSS aproximado, Coblis/DaltonLens usan Brettel exacto).
3. Si los tres simuladores coinciden en "indistinguible cromáticamente, pero recuperable por icon+label", la decisión está validada.

## 10.3 Paso 3 — Test con usuario real (opcional, ideal para S6)

Si se consigue 1-2 usuarios con deuteranopia/protanopia (~5% de usuarios masculinos: probabilidad alta entre coleccionistas):

1. Mostrar pantalla del Order list en Velvet (sin avisar que es test de daltonismo).
2. Tarea: "¿podés decirme qué pedidos están pendientes y de qué categoría son?"
3. Si la respuesta es fluida sin pedir aclaración, mitigación validada.
4. Si el usuario pregunta "¿qué significa ese ícono?" o "¿el chip azul y el ícono azul son lo mismo?", la mitigación es insuficiente y hay que reabrir la decisión (mover hacia opción b/c/d).

## 10.4 Paso 4 — Lint / type-system enforcement (S4 implementación)

1. Tipo TS para `<StatusChip>`: `kind: "info"` requiere `icon: LucideIcon` (no opcional).
2. Componente `<StatusChip kind="info">` siempre renderiza ícono `Clock` por default si no se pasa otro.
3. Lint rule custom (eslint-plugin-pandatrack) o validación en Storybook: cualquier uso de `--accent-cool` en background o border falla el lint (sólo permitido en `color` de SVG/icon).

## 10.5 Criterio de salida

Validación cierra cuando:

- Los 4 tipos de simulación visual (deutan/protan/tritan/achromat) muestran que la información sigue accesible vía icon+label.
- El sistema tiene enforcement técnico (tipos + lint) que previene degradación futura.
- Si Paso 3 (usuario real) se ejecuta y pasa, el riesgo abierto en `tokens.md` §12 #6 puede cerrarse formalmente.

Si cualquier paso falla, reabrir la decisión y reconsiderar opción (b), (c) o (d).

---

# 11. Anexo: actualizaciones recomendadas a `tokens.md`

Si se acepta la decisión, los siguientes cambios deben aplicarse en el mismo PR que cierre este research:

1. **§0 (Reglas duras del sistema):** agregar regla nueva:

   > 8. **Status `--info` y acento `--accent-cool` no son cromáticamente distinguibles bajo deuteranopia/protanopia.** Toda aparición de `--info` en UI requiere acompañamiento de ícono `Clock` + label legible. Toda aparición de `--accent-cool` requiere uso como color de ícono Lucide con label adyacente o en columna. Nunca color-only.

2. **§1.5 (Status):** ya documenta la regla. Reforzar: "`--info` chip **siempre** lleva ícono `clock` (no opcional)."

3. **§10 (Reglas de uso):** las celdas `--info` y `--accent-cool` ya tienen "Nunca". Agregar referencia cruzada: "Ver §0 invariante 8 para razón técnica (colapso en deutan/protan)."

4. **§12 (Gaps abiertos para S4):** marcar punto #6 como "validación con simulador planificada — ver `_notes/s3-research-colorblind-info.md` §10".

Estas actualizaciones no cambian valores de tokens; sólo formalizan el contrato de uso.
