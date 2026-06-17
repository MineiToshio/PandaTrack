---
title: Research — paleta categórica para PandaTrack (validar ADR 0004)
status: investigación
date: 2026-05-02
owner: research sub-agent
scope: validar/refutar la decisión del ADR 0004 (eliminación de `--cat-figures/vinyl/manga/anime/cards/plush`).
---

# Contexto rápido

ADR 0004 elimina la paleta categórica reservada (6 hues OKLCH definida en Atelier §4.4) bajo el argumento de que (a) MVP no tiene charts, (b) la identidad de categoría ya vive en íconos Lucide sobre `--accent-cool`, (c) tokens sin uso son deuda. El reto: PandaTrack es app de coleccionistas (figures, vinyl, manga, anime, cards, plush) y la categoría es parte de la identidad. ¿Se está empobreciendo el producto al renunciar al color categórico, o es disciplina visual sana?

El dato clave del scope MVP es el filter drawer (ADR 0003 D8): `orders` filtra por "Categorías de producto" usando chips `pills`/`icon-pills`. Si el ADR 0004 confirma, esos chips no llevan color por categoría — sólo ícono Lucide + label, con el accent estándar para el estado seleccionado.

---

# 1. Apps de tracking de colecciones / hobby

## 1.1 Letterboxd (películas)

URL: `https://letterboxd.com` (revisado vía análisis externos: blakecrosley.com/guides/design/letterboxd, ixd.prattsi.org/2025/05/letterboxd-disassembled).

**Captura verbal:** Letterboxd usa **dos colores funcionales** y nada más:

- Verde = "yo" (visto, ratings, listas propias).
- Naranja = exclusividad de pago (Pro / Patron).

**Identidad por categoría/género:** **NO usa color para género.** El género se trata como metadata textual (tags). La identidad visual de una película la carga el **poster** (artwork del propio film), que es el "color" semántico real. Crítica recurrente en case studies: faltan pills/tags de género más visibles, pero **ninguna propuesta seria pide colorear géneros** — proponen mejor jerarquía tipográfica y filtros.

**Lectura para PandaTrack:** una app premium de hobby con identidad visual fuerte deliberadamente renuncia al color categórico. La identidad visual del ítem (cover/poster) lleva el peso. PandaTrack tiene cover de producto en `--surface`; la categoría queda en ícono.

## 1.2 Goodreads (libros)

**Captura verbal:** Goodreads usa hasta 17 colores en su UI (señalado como anti-pattern en múltiples redesign case studies). Los géneros aparecen como **chips/pills monocromáticos** (color marrón-beige del brand, sin variación por género). Los redesign exercises proponen reducir colores, no introducir paleta por género.

**Lectura para PandaTrack:** ejemplo negativo. Más colores ≠ mejor. Los chips de género funcionan en Goodreads sin color por categoría.

## 1.3 Discogs (vinyl/coleccionables musicales)

URL: `https://support.discogs.com/hc/en-us/articles/360005055213-Database-Guidelines-9-Genres-Styles`, `https://blog.discogs.com/en/genres-and-styles-on-discogs/`.

**Captura verbal:** Discogs maneja **15 géneros y 540 styles** (sub-géneros). En la UI, géneros y styles se muestran como **enlaces de texto azules** (link color), no como chips coloreados por género. La identidad visual del release viene del **artwork de la portada del disco**, no de un color del sistema.

**Lectura para PandaTrack:** la app de catalogación más profunda del mundo de vinyl no codifica color por género. Si Discogs (15 géneros, decisión arquitectural) no lo hace, asumir que coleccionistas "necesitan color por categoría" es bias.

## 1.4 AniList / MyAnimeList (anime/manga)

URL: `https://anilist.co/`, foros de personalización en `userstyles.org`.

**Captura verbal:** AniList tiene **un acento configurable por usuario** (default azul, con presets blue/purple/green/orange/red/pink/gray). El acento aplica al chrome global (header, links, progress bars). **No hay color por género.** Los géneros aparecen como tags textuales monocromáticos. La identidad de cada anime/manga la carga el cover artwork.

La comunidad genera CSS custom para personalizar; ninguno de los temas populares introduce color-por-género.

**Lectura para PandaTrack:** AniList confirma el patrón Letterboxd/Discogs. Acento único, identidad por artwork, género en texto.

## 1.5 Untappd (cervezas)

URL: `https://untappd.com`, blog `lounge.untappd.com`.

**Captura verbal:** Untappd tiene **253 estilos de cerveza**. En la UI, los estilos aparecen como **enlaces textuales** y como **filtros de búsqueda**, sin color por estilo. El color funcional es el rating (sistema de estrellas amarillas). La paleta de marca es amber/marrón con acento amarillo. Los digital boards B2B (Untappd for Business) permiten temas custom (Snacktime, Pizza Box, Vineyard, etc.) pero esos son temas de la marca cervecera, no codificación por estilo de cerveza.

**Lectura para PandaTrack:** otra app de hobby con muchas categorías (253!) que opta por estilo textual + brand color, no paleta por categoría.

## 1.6 Vivino (vinos)

URL: `https://www.vivino.com/`, case study en `https://norikogondo.com/vivino/`.

**Captura verbal:** Vivino es la **excepción interesante**. La filtran por type usando **swatches que reflejan el color literal del vino** (red/white/rosé/sparkling/orange/dessert/fortified). El color no es decorativo arbitrario — **es información literal sobre el contenido del producto**. El "color del wine of the day" cambia el background.

**Lectura para PandaTrack:** Vivino usa color porque **el color del wine ES información intrínseca del producto** (red wine es literalmente rojo). En PandaTrack, ¿es vinyl literalmente violeta? ¿Manga literalmente durazno? **No.** Los hues de Atelier §4.4 son arbitrarios (rosa para figures, violeta para vinyl, etc.). El precedente Vivino sólo aplica si el color tiene anclaje semántico literal. PandaTrack no lo tiene.

## 1.7 Backloggd / HowLongToBeat (videojuegos)

**Captura verbal:** Backloggd tiene mejor UI (consenso en ResetEra). Usa cover art como identidad por juego, géneros en texto (tags), sin color por género. HowLongToBeat es funcional pero feo y tampoco usa color por género — usa color para tipo de tiempo (Main Story / Main+Extras / Completionist) que es lo más cercano a una "paleta categórica funcional", pero son ejes ortogonales (no géneros).

**Lectura para PandaTrack:** mismo patrón. Color por género = no.

## 1.8 Pop Mart / Funko (figures/blind boxes)

URL: `https://www.popmart.com/us/`, apps Funko official, PopGrinder, iCollect Everything.

**Captura verbal:** POPMART website usa **fotografía de producto en cards limpias sobre fondo blanco**. La línea de coleccionable (Skullpanda, Molly, Dimoo, etc.) se identifica por **el artwork del personaje**, no por color de UI. Los apps de tracking (PopGrinder, iCollect, Funko official) son **catálogos visuales**: grids de fotos de producto. El color del UI es neutro; la identidad la lleva el item.

**Lectura para PandaTrack:** confirma el patrón. En collectibles, la imagen del producto es el "color". El chrome se queda fuera del camino.

---

# 2. Apps de inventory / e-commerce

## 2.1 Shopify Polaris admin

URL: `https://polaris-react.shopify.com/design/colors`.

**Captura verbal:** Polaris adopta **paleta monocromática negro/blanco con un solo accent (verde Shopify)** intencionalmente, "para que los elementos con color ganen impacto y prominencia". Roles funcionales: brand, warning, critical, success, info — exactamente la lógica Atelier. **No hay color por categoría de producto.** Las categorías de producto aparecen como **tags de texto** (Polaris Tag component). El merchant puede agregar tags custom y todos se renderizan con el mismo background neutro.

**Lectura para PandaTrack:** Polaris es prueba directa. La plataforma de e-commerce más usada del mundo, que maneja millones de catálogos de producto con categorías diversas, no codifica color por categoría. **El argumento de "los coleccionistas necesitan color" no se sostiene contra este precedente.**

## 2.2 Etsy seller dashboard / Square / Stripe

(Búsqueda no específica, observación de mercado): mismo patrón. Categorías como tags textuales monocromáticos. Filtros como chips con un solo "selected accent" en el color de la marca.

---

# 3. Design systems / research externo

## 3.1 Material Design 3

URL: `https://m3.material.io/styles/color/overview`, `https://m3.material.io/styles/color/roles`.

**Captura verbal:** M3 distingue **tres tipos de paleta**:

- Roles funcionales (primary, secondary, tertiary, error, etc.).
- Tertiary se sugiere para "tags, charts, avatars, decorative highlights, **content categories**".
- Para data viz, paletas categóricas separadas, ≤10 colores, hue-first.

M3 explícitamente recomienda **NO usar la paleta de roles para categorización**: para categorías UI, puede usarse `tertiary` como un único acento, o introducir una paleta de chart aparte si hay data viz.

**Lectura para PandaTrack:** M3 valida el approach del ADR 0004 (paleta categórica = paleta de chart, separada del sistema). Y confirma que para "tags/categories" en UI, **un solo accent (`tertiary` en M3, equivalente a `--accent-cool` en Atelier) basta**.

## 3.2 IBM Carbon

URL: `https://carbondesignsystem.com/data-visualization/color-palettes/`.

**Captura verbal:** Carbon mantiene su paleta categórica **exclusivamente dentro de data viz**, no como tokens UI generales. La paleta tiene reglas estrictas: secuencia fija (no random), 2–14 categorías max, contraste 3:1 entre adyacentes, balance warm/cool para evitar falsas asociaciones. Carbon explícitamente menciona que **al ser una paleta cool-skewed (brand IBM blue), tuvieron que introducir warm colors deliberadamente para data viz**.

**Lectura para PandaTrack:** valida el ADR 0004 punto 4: "una paleta categórica para charts es un set dedicado, no la misma paleta UI". También anticipa: si en V2 PandaTrack introduce charts, no debe reusar `--cat-*` de Atelier §4.4 (no fueron diseñados con esas reglas).

## 3.3 Cloudscape (AWS)

URL: `https://cloudscape.design/foundation/visual-foundation/data-vis-colors/`.

**Captura verbal:** misma postura que Carbon. Paleta categórica vive en data viz, no en UI tokens. Categorías UI se identifican por label + ícono, color reservado para estado o data.

## 3.4 WCAG 1.4.1 — Use of Color

URL: `https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html`.

**Captura verbal:** "Color is not used as the only visual means of conveying information". Si PandaTrack codifica categorías SÓLO por color, falla WCAG. Si codifica por **ícono + label**, pasa WCAG sin necesidad de color. Agregar color por categoría ENCIMA del ícono+label es redundancia accesible (no daña), pero **no es necesaria**. Daltonismo afectaría sólo al subset de la población que necesita el color, y aún así el ícono resolvería.

**Lectura para PandaTrack:** la accesibilidad está garantizada por ícono+label. Color sería plus visual, no requerimiento.

## 3.5 ColorBrewer / Cynthia Brewer (qualitative palettes)

**Captura verbal:** ColorBrewer recomienda **máximo 8 categorías** en paletas qualitative para mantener distinguibilidad. PandaTrack tiene 6 — entra en rango. Pero ColorBrewer está diseñado para **mapas/charts**, donde el color ES el dato. En UI generalista, mismo principio M3/Carbon: si no hay anclaje semántico, color por categoría introduce ruido sin ganancia.

---

# 4. ¿Coleccionistas asocian categoría con color?

**Hipótesis del prompt original:** "vinyl negro/dorado, manga blanco/negro, figures multicolor, anime multicolor, cards multicolor, plush pastel".

**Test de la hipótesis con la evidencia:**

| Categoría | ¿Tiene color cultural intrínseco?             | Hue de Atelier §4.4 | ¿Coincide?   |
| --------- | --------------------------------------------- | ------------------- | ------------ |
| Figures   | No (variado por línea/personaje)              | rosa                | No           |
| Vinyl     | Sí — negro (vinilo físico) o dorado (limited) | violeta             | No           |
| Manga     | Sí — blanco/negro (B&W print)                 | durazno             | No           |
| Anime     | No (variado por serie)                        | cyan                | No           |
| Cards     | No (variado por set TCG)                      | lima                | No           |
| Plush     | Débil — pastel asociado a plush kawaii        | durazno cálido      | Parcialmente |

**Conclusión:** la hipótesis falla. Los hues de Atelier §4.4 **no reflejan asociaciones culturales reales** de cada categoría — son una paleta arbitraria distribuida en el círculo cromático para asegurar distinguibilidad visual. Si exponemos `--cat-vinyl: violeta`, contradecimos la asociación coleccionista (vinyl es negro). El "argumento de identidad cultural" queda invalidado.

Discogs (la app definitiva del vinyl coleccionista) no usa color por género — porque la identidad de cada release la lleva el artwork del disco, no un hue arbitrario.

---

# 5. Decisión inicial

**Decisión inicial: (a) Confirmar ADR 0004.**

Justificación:

1. 6/6 apps de hobby relevantes (Letterboxd, Goodreads, Discogs, AniList, Untappd, Backloggd) NO usan color por categoría/género. La única excepción (Vivino) tiene anclaje semántico literal (color del vino) que PandaTrack no replica.
2. Apps de e-commerce/inventory genéricas (Shopify, Etsy) tampoco. Polaris explicita la postura.
3. Design systems serios (M3, Carbon, Cloudscape) **separan estrictamente paleta categórica UI de paleta data-viz**. Y Carbon advierte que paletas data-viz tienen reglas (secuencia, contraste 3:1 entre adyacentes, warm/cool balance) que la paleta de Atelier §4.4 no cumple.
4. WCAG 1.4.1 está cubierto por ícono + label; color sería redundancia, no requerimiento.
5. Los hues arbitrarios de Atelier §4.4 no coinciden con asociaciones culturales reales de cada categoría coleccionista. Exponerlos es desinformación visual.
6. Regla de oro Atelier "máx 3-4 tokens cromáticos por pantalla" se respeta mejor sin paleta categórica disponible.

---

# 6. Contraargumentos (≥3)

## C1. "Vivino + POPMART demuestran que coleccionistas SÍ asocian color con categoría"

**Contra-respuesta:** Vivino usa color porque red wine ES rojo (anclaje físico literal). POPMART NO usa color por línea — usa el artwork del personaje. La hipótesis se cae al examinarla. Ni un solo competidor directo de PandaTrack codifica por color — y POPMART es el referente más cercano por "blind box collectible toy".

## C2. "El filter drawer (ADR 0003 D8) tiene 'Categorías de producto (multi-select chips)' — los chips merecen color para distinguirse a un golpe de vista"

**Contra-respuesta:** Material Chips guidelines + Carbon Filtering pattern + Polaris Tags coinciden: chips de filtro multi-select se distinguen por **el toggle on/off (selected vs unselected)**, no por color por categoría. Selected usa el accent del sistema (en PandaTrack, `--accent-cool`), unselected usa neutral. Adicionar color por categoría rompería la regla de oro y crearía un patrón inconsistente con el resto de chips de la app (los chips de "Estado del pedido" del mismo drawer NO tendrían color por estado — sólo selected/unselected). Se perdería sistematización a cambio de cero ganancia funcional.

## C3. "Mantener tokens reservados sin uso no cuesta nada — eliminar es overshoot"

**Contra-respuesta:** Sí cuesta. Un token disponible es una invitación a usarlo: el primer dev/diseñador que ve `--cat-vinyl` definido lo va a aplicar como decoración (avatar, dot, badge), rompiendo la jerarquía Primary/Extra/Reservada. Atelier §4.4 ya tuvo que escribir explícitamente "**no expuesta como decoración**" como guardrail — eso es señal de que el token genera tentación. Eliminar es removed-by-default; el costo de no tenerlo es cero porque ningún componente del MVP lo usa. Hygiene >> opcionalidad teórica.

## C4. "Letterboxd no usa color por género porque tiene poster grandes; PandaTrack también — entonces ¿por qué ni siquiera reservar?"

**Contra-respuesta:** justamente. Si Letterboxd, con la misma estructura visual (cover-driven grid), no necesita color categórico, PandaTrack tampoco. La conclusión refuerza el ADR 0004, no lo debilita.

## C5. "POPMART y Funko son visualmente saturados — coleccionistas esperan eso"

**Contra-respuesta:** POPMART tiene **producto visualmente saturado** (figura kawaii multicolor) sobre **chrome neutro** (sitio en blanco/gris). El producto explota; el sistema se queda fuera del camino. Esa es exactamente la postura Atelier: chrome calmo + identidad por artwork del item + acento funcional escaso. ADR 0004 alinea con ese patrón.

---

# 7. Reevaluación + decisión final

Los cinco contraargumentos no sobreviven al cross-check con evidencia externa. La hipótesis "coleccionista necesita color por categoría" no tiene soporte empírico en ninguno de los seis competidores de hobby ni en los design systems de referencia. La hipótesis "color en chips del filter drawer mejora reconocimiento" se rompe contra la regla de oro Atelier y el patrón estandarizado de chips Material/Carbon/Polaris.

**Decisión final: (a) Confirmar ADR 0004.**

Sin enmienda. La paleta categórica `--cat-*` se elimina del sistema. Identidad de categoría = ícono Lucide canónico + label, en `--accent-cool` cuando aplica (filtro seleccionado, badge, breadcrumb), en `--text-primary` cuando es metadata neutra. V2 introducirá `--chart-N` con paleta calibrada cuando aparezcan analytics — y esa paleta se diseñará según reglas data-viz reales (Carbon-style), no reciclando los hues arbitrarios de Atelier §4.4.

---

# 8. Notas adicionales para reforzar la decisión

Recomendaciones operativas para que la decisión se sostenga:

1. **`tokens.md` §10 (jerarquía):** dejar fila "Paleta categórica" marcada **Eliminada** (no "Reservada"). Agregar nota: "Si V2 requiere data viz, abrir ADR `0006-chart-palette-design.md` con paleta calibrada bajo reglas Carbon-style (secuencia fija, contraste 3:1 entre adyacentes, balance warm/cool, ≤10 categorías)."
2. **`directions.md` §4.4:** queda como registro histórico; **no editar** (principio de no reescribir docs cerrados de S1). El ADR 0004 prevalece como contrato vinculante posterior.
3. **Filter drawer chips (ADR 0003 D8):**
   - Chip unselected: `--surface-2` background + `--text-primary` label + ícono Lucide en `--text-secondary`.
   - Chip selected: `color-mix(--accent-cool 14%, --surface-2)` background + `--accent-cool` label + ícono Lucide en `--accent-cool`.
   - Mismo patrón aplica a chips de estado del pedido, pago derivado, tienda, presencia, país. Cero excepción categoría-específica.
4. **Lucide canónicos por categoría (ya en ADR 0004 punto 2 — re-confirmar en `tokens.md` §10 o `directions.md` §4.9):**
   - figures → `shapes`
   - vinyl → `disc`
   - manga → `book-open`
   - anime → `sparkles`
   - cards → `gallery-thumbnails`
   - plush → `package`
5. **Avatar de tienda y cualquier visual de "categoría como decoración":** sigue receta única `--accent-cool` 14% tint + 28% border. **Nunca** `--cat-*` aunque alguien sienta tentación.
6. **Test de regression visual al final de S6:** scan de tokens en CSS final — `--cat-*` debe tener 0 referencias. Sentinela en CI opcional (lint contra `--cat-`).

---

# 9. Spec del nuevo uso si modifica/rechaza

(No aplica — decisión final es **confirmar ADR 0004**, sin modificación.)

---

# 10. Verificación contra regla de oro "máx 3-4 tokens cromáticos por pantalla"

Tokens cromáticos visibles en una pantalla típica de Pedidos (lista) bajo ADR 0004:

1. `--accent-cool` (CTA primaria "Nuevo pedido", filtro seleccionado, link activo).
2. `--accent-warm` (chip de estado "atrasado" / pago pendiente — un solo eje).
3. `--info` o `--success` (badge de pago completado).
4. `--text-primary` / `--text-secondary` (no cromático, neutral).

Total cromático: **3 tokens** visibles. Pasa la regla de oro con margen.

Si hubiéramos mantenido `--cat-*` en chips de filtro de "Categorías de producto", la misma pantalla con el drawer abierto tendría:

1. `--accent-cool` (selected state).
2. `--accent-warm` (chip "atrasado").
3. `--info` (badge pago).
4. `--cat-figures` rosa.
5. `--cat-vinyl` violeta.
6. `--cat-manga` durazno.
7. `--cat-anime` cyan.
8. `--cat-cards` lima.
9. `--cat-plush` durazno cálido.

= **9 tokens cromáticos visibles**. Violación severa de la regla de oro. ADR 0004 protege la regla.

---

# Sources

- [Letterboxd: Cinema as Social Object — Blake Crosley](https://blakecrosley.com/guides/design/letterboxd)
- [Letterboxd Disassembled — IXD@Pratt](https://ixd.prattsi.org/2025/05/letterboxd-disassembled-creating-a-design-system-for-movie-review-site-letterboxd/)
- [Goodreads UI/UX Case Study — Sanjivani Kene, Medium](https://medium.com/@SanjivaniKene/navigating-the-goodreads-labyrinth-a-newbies-ui-ux-case-study-296f0936ebd4)
- [Discogs Database Guidelines: Genres / Styles](https://support.discogs.com/hc/en-us/articles/360005055213-Database-Guidelines-9-Genres-Styles)
- [Discogs blog — Genres and Styles](https://blog.discogs.com/en/genres-and-styles-on-discogs/)
- [Understanding the Anilist App in Anime Culture](https://manganoa.com/articles/understanding-anilist-app-anime-culture/)
- [AniList themes & skins — Userstyles.org](https://userstyles.org/styles/browse/anilist)
- [Untappd for Business — Designing Your Digital Board](https://help.untappd.com/hc/en-us/articles/19574848959636-Designing-Your-Digital-Board)
- [Beer Match — Untappd visualization study](http://beer.tany.kim/)
- [Vivino UI/UX Case Study — Noriko Gondo](https://norikogondo.com/vivino/)
- [Vivino — Wine colors explained](https://www.vivino.com/en/wine-news/your-guide-to-wine-color)
- [Backloggd Roadmap](https://backloggd.com/roadmap/)
- [Funko official app — App Store](https://apps.apple.com/us/app/funko/id1286964746)
- [POP MART Official US](https://www.popmart.com/us)
- [Material Design 3 — Color overview](https://m3.material.io/styles/color/overview)
- [Material Design 3 — Color roles](https://m3.material.io/styles/color/roles)
- [Material Design 3 — Chips guidelines](https://m3.material.io/components/chips/guidelines)
- [IBM Carbon — Data viz color palettes](https://carbondesignsystem.com/data-visualization/color-palettes/)
- [Carbon — Filtering pattern](https://carbondesignsystem.com/patterns/filtering/)
- [Cloudscape — Data visualization colors](https://cloudscape.design/foundation/visual-foundation/data-vis-colors/)
- [Shopify Polaris — Color](https://polaris-react.shopify.com/design/colors)
- [Shopify Polaris — Palettes and roles](https://polaris-react.shopify.com/design/colors/palettes-and-roles)
- [WCAG 2.1 Understanding 1.4.1 Use of Color](https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html)
- [WCAG 2.1 Understanding 1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html)
- [WebAIM — Contrast and Color Accessibility](https://webaim.org/articles/contrast/)
- [The A11Y Collective — Improving Icon Usability and Accessibility](https://www.a11y-collective.com/blog/icon-usability-and-accessibility/)
- [PatternFly — Filters design guidelines](https://www.patternfly.org/patterns/filters/design-guidelines/)
