---
title: Comparativa de las 4 direcciones — Sesión 1
last_updated: 2026-05-01
status: final S1 (revisión 2 con Dirección 4 sobria)
---

# Comparativa lado a lado

Tabla puntuada de las 4 direcciones contra 9 criterios. Escala **1–5** (1 muy bajo / 5 muy alto). Cada criterio incluye una nota corta sobre por qué cada dirección puntúa así.

> **Revisión 1 (2026-05-01):** se agregó la **Dirección 4 — Bento Atelier** como evolución de Bento Editorial tras feedback humano (más color coordinado, sin italic, formularios con cards de sección, asistente flotante panda, big choice cards).
>
> **Revisión 2 (2026-05-01):** se ajustó Dirección 4 con segundo feedback — se **retira el asistente conversacional del sistema de diseño** (queda como FRD aparte), se baja el ruido cromático (los 6 colores categóricos pasan a paleta reservada, no se usan como dots/avatares/chips), los avatares de tienda son **neutros** (logo o letra inicial sobre `surface-elevated`), y la identidad de categoría vive en **íconos Lucide** en vez de color. Sigue la sobriedad de Dir 1 con el mínimo de color funcional necesario. Ver [`directions.md`](./directions.md) §4.

---

## Tabla puntuada

| Criterio                                | 1. Bento Editorial                       | 2. Neon Drop Floor                            | 3. Soft Garden                                 | 4. Bento Atelier                             |
| --------------------------------------- | ---------------------------------------- | --------------------------------------------- | ---------------------------------------------- | -------------------------------------------- |
| **Energía visual**                      | 2 — calmado, denso                       | 5 — eléctrica, pulsante                       | 3 — cálido, juguetón                           | 3 — sereno con color puntual funcional       |
| **Densidad informativa**                | 5 — Linear-DNA                           | 4 — alta con celebración                      | 3 — generosa                                   | 5 — alta con respiración por sección         |
| **Formalidad / "seriedad"**             | 5 — premium tool                         | 2 — joven y pop                               | 3 — cálido pero serio                          | 5 — premium tool sobrio                      |
| **Riesgo de implementación**            | 3 — fonts pagas + view transitions       | 5 — 3D mascot, perf, paleta saturada          | 4 — pipeline 6 personajes 3D                   | 3 — coordinar 3 acentos + Lucide canon       |
| **Fit con target Gen Z (18–25)**        | 4 — segmento power user                  | 5 — segmento hype/drop                        | 4 — segmento caretaker/casual                  | 5 — power user + mainstream sin saturar      |
| **Fit con producto financiero/tracker** | 5 — formato canónico para data           | 3 — celebración choca con seriedad            | 4 — calidez funciona, data pierde peso         | 5 — data manda, color sólo donde hay función |
| **Escalabilidad del sistema**           | 5 — tokens claros, motion vocab reducido | 3 — gradients + 3D + glow agregan complejidad | 4 — personajes son escalables si se modulariza | 5 — 3 acentos funcionales + Lucide único     |
| **Reusabilidad cross-modo**             | 5 — light/dark hermanos limpios          | 3 — nativa dark, light reinterpretada         | 4 — light hero, dark requiere recalibración    | 5 — heredado de Dir 1, igual de limpio       |
| **Diferenciación vs apps existentes**   | 3 — riesgo de parecerse a Linear/Vercel  | 5 — diferenciación máxima                     | 4 — Copilot adjacente con worldbuilding        | 4 — Linear-DNA con identidad de marca propia |
| **Total (suma)**                        | **37**                                   | **35**                                        | **33**                                         | **40**                                       |

> El total es referencial. La decisión no se toma por suma sino por _fit estratégico_. Cada dirección apunta a un perfil distinto del target.

---

## Análisis por criterio

### Energía visual

- **Bento Editorial (2):** intencional. El producto se siente "tranquilo y poderoso". El brillo viene del display editorial italic y del motion sub-200ms, no del color.
- **Neon Drop Floor (5):** vibrante, gradientes Oklch, glow controlado, pulso del countdown, mascot chrome 3D. La app se siente _encendida_.
- **Soft Garden (3):** energía cálida, no eléctrica. Los personajes idle respiran, las cards tienen shadows blandas con color marca diluido. Es alegría serena, no euforia.
- **Bento Atelier (3):** la calma de Dir 1 con tres acentos funcionales (indigo + coral + teal) usados sólo donde tienen función — progress bar, status, info inline. Sin chips coloridos ni avatares cromáticos. Serena con color puntual, no decorativo.

### Densidad informativa

- **Bento Editorial (5):** filas 36–40px, hover reveals, peek panel desktop, máxima info por pixel. Ideal para usuarios con 80+ pre-órdenes activas.
- **Neon Drop Floor (4):** densidad alta en listas pero el hero card y los countdowns ocupan espacio premium. Funciona bien para 30–50 pre-órdenes, no para 200.
- **Soft Garden (3):** spacing generoso, radius grandes, personajes-categoría como avatares. Funciona para 20–40 pre-órdenes; con más se siente largo.
- **Bento Atelier (5):** densidad de Dir 1 conservada en listas. En formularios la densidad baja a media, pero gana legibilidad por las section cards. Mejor balance que Dir 1 para forms largos.

### Formalidad / "seriedad"

- **Bento Editorial (5):** la dirección "premium tool" — referenciable a Linear/Plain. Inspira confianza para gestionar dinero serio.
- **Neon Drop Floor (2):** young + pop. Genial para entusiasmo, pero un coleccionista premium puede sentir que "no es serio para mi colección de $20k".
- **Soft Garden (3):** cálido sin ser informal. Letterboxd-vibe — confiable pero amistoso. Posición intermedia.
- **Bento Atelier (5):** mantiene la seriedad de Dir 1. El display sin italic + los avatares neutros + la categoría por ícono Lucide (no color) refuerzan el tono profesional. La mascota panda existe sólo en momentos de marca (empty/404/achievement), no como UI omnipresente.

### Riesgo de implementación

- **Bento Editorial (3):** fonts editoriales (Tiempos pago / Fraunces libre), View Transitions cross-document. Complejidad media.
- **Neon Drop Floor (5):** 3D mascot con dos lighting setups, Lottie pipelines, gradients + glow + grain (perf en mobile mid-tier), paleta saturada con AA estricto. Riesgo más alto.
- **Soft Garden (4):** 6 personajes-categoría + panda caretaker en clay 3D = ~12 entregables visuales, glass + Vaul sheets, dark "noche del jardín" requiere calibración fina.
- **Bento Atelier (3):** evita italic editorial (menos riesgo de fonts pagas). El reto es **coordinar 3 acentos con disciplina** + tener Lucide como set canónico (sin emojis decorativos). Componente `<StoreAvatar>` con fallback letra es producible. View Transitions igual que Dir 1. Sin pipeline de mascota 3D ni 6 personajes.

### Fit con target Gen Z (18–25)

- **Bento Editorial (4):** segmento de "power user collector" — el que tiene un Notion bien organizado, usa Linear en su trabajo, valora la claridad. Niche dentro del target.
- **Neon Drop Floor (5):** segmento "hype/drop hunter" — POPMART, StockX, sneakers, streetwear. Alineación máxima con la cultura de drops del target.
- **Soft Garden (4):** segmento "caretaker/lifestyle" — el que colecciona vinyls y manga sin pretensión, valora la calidez. Funciona para mucha gente del target pero sin "reclamarla" como las otras dos.
- **Bento Atelier (5):** **el sweet spot del mainstream Gen Z**: power user que también quiere identidad. Los 3 acentos funcionales + la mascota panda como brand (no UI) suman personalidad sin sacrificar seriedad. Captura más segmentos que Dir 1 sin saturarse.

### Fit con producto financiero/tracker

- **Bento Editorial (5):** dato manda, chrome respeta. Tipografía editorial dignifica los números. Ideal para tracking serio.
- **Neon Drop Floor (3):** la celebración constante puede chocar con el pago vencido y el dinero perdido. Riesgo de confeti cuando el usuario se siente mal.
- **Soft Garden (4):** la metáfora "jardín" funciona para coleccionar pero diluye el peso financiero. El mismo problema que Copilot Money tiene parcialmente.
- **Bento Atelier (5):** dato manda igual que Dir 1. El color sólo aparece donde tiene función (progress bar indigo→coral, métricas con su status, íconos de feed por tipo de evento). Avatares neutros y categorías por ícono dejan al número como héroe absoluto.

### Escalabilidad del sistema

- **Bento Editorial (5):** vocabulario cerrado de 6 motion tokens, 1 accent, paleta semántica simple. Cualquier feature nueva encuentra su lugar.
- **Neon Drop Floor (3):** gradients custom + paleta tricromo + glow + 3D = más decisiones por superficie. Mantenible si hay un design ops fuerte.
- **Soft Garden (4):** personajes-categoría como sistema de naming/poses se escala bien si se documenta. Glass + sheets + Vaul son patrones cerrados.
- **Bento Atelier (5):** 3 acentos funcionales claramente nombrados (`accent`/`accent-warm`/`accent-cool`) + paleta categórica reservada para charts (no expuesta) + Lucide como set único de íconos. Sistema más simple y disciplinado que en revisión 1. Lint rules en S3 evitan uso accidental.

### Reusabilidad cross-modo (light/dark)

- **Bento Editorial (5):** estructura idéntica, distinto setup de color/elevación. Light = sombras reales, dark = elevación por tono. Conversión limpia.
- **Neon Drop Floor (3):** la dirección nace en dark. Light requiere reinterpretación con paleta desaturada y brutalism stroke negro tinta. Dos productos hermanos, pero el hermano dark es claramente más feliz.
- **Soft Garden (4):** light es hero pero dark "noche del jardín" tiene su propia coherencia conceptual. Riesgo si se hace dark como light invertido.
- **Bento Atelier (5):** heredado de Dir 1. Los 3 acentos están definidos con valores light y dark. La estructura es idéntica entre modos. La paleta categórica reservada también está en ambos modos por si se necesita en charts.

### Diferenciación vs apps existentes

- **Bento Editorial (3):** referenciable a Linear, Vercel, Things. Riesgo de "ya lo vi en otro lado". Diferenciación viene del editorial italic + mascot whisper, no del shell.
- **Neon Drop Floor (5):** ninguna app de tracking de coleccionables se ve así hoy. Categoría desocupada. El brand reclama territorio.
- **Soft Garden (4):** Copilot Money es la referencia obvia, pero los personajes-categoría con worldbuilding propio (Lila/Virgilio/etc.) y la paleta jardín diferencian. POPMART está cerca pero más comercial.
- **Bento Atelier (4):** Linear-DNA estructural, pero la combinación **3 acentos coordinados con función + Lucide canon + identidad de marca panda + step circles + big choice cards** no es un combo común en apps de tracking. Diferencia más que Dir 1 sin sacrificar seriedad ni saturar el sistema.

---

## Recomendación de la sesión (revisión 2 — 2026-05-01)

> **No se elige una dirección en S1.** El humano lo hace en `direction-chosen.md` con cualquier ajuste o mezcla.

Ranking actualizado tras revisión 2:

1. **Bento Atelier** como primera apuesta — la evolución más completa **y sobria**: conserva la calma + densidad + seriedad de Dir 1, suma 3 acentos funcionales (no decorativos), formularios con jerarquía visual y step circles, big choice cards, Lucide como set único, avatares neutros, mascota panda sólo en momentos de marca. El asistente conversacional queda fuera del sistema de diseño y se trata como FRD aparte.
2. **Bento Editorial** como base alternativa — si después de probar Atelier en S2 el equipo siente que los 3 acentos son demasiado, siempre se puede volver a la base monocroma de Dir 1.
3. **Soft Garden** como tercera — encarna la metáfora "coleccionar = cuidar" mejor que ninguna pero pierde peso financiero. Si la calidez es un must-have, esta es la opción.
4. **Neon Drop Floor** como cuarta — la más diferenciadora pero la más arriesgada en performance, polarización y celebración cuando el usuario se siente mal.

**Mezclas posibles si el humano quiere ajustar Bento Atelier:**

- _Atelier sólo con dos acentos_: dejar `--accent` (indigo) + `--accent-warm` (coral) y prescindir de `--accent-cool` (teal) si en pruebas se siente que tres son uno de más.
- _Atelier con achievement Neon_: tomar de Dir 2 el confeti tricromo efímero sólo para el momento ceremonial post-pago completo o post-entrega completa. Suma energía puntual sin contaminar el resto.
- _Atelier + asistente como FRD futuro_: el sistema de diseño de S1 no incluye asistente conversacional. Si en el futuro un FRD lo agrega, el sistema ya tiene el glyph reusable de la mascota y la paleta `--accent-cool` para tooltips/info.

Cualquier mezcla se decide en `direction-chosen.md` antes de la S2.
