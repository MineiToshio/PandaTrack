---
title: Bitácora de iteraciones — Sesión 1
last_updated: 2026-05-01
---

# Bitácora de iteraciones de Sesión 1

Registro cronológico de cómo evolucionaron las direcciones de S1 a partir del feedback humano. Las direcciones 1, 2 y 3 (Bento Editorial, Neon Drop Floor, Soft Garden) **no cambian**; sólo evoluciona la Dirección 4.

---

## Versión inicial (2026-04-30)

Cierre de S1 con **3 direcciones** completas: Bento Editorial, Neon Drop Floor, Soft Garden. Demos `demo.html` (dashboard) y `demo-form.html` (formulario "Nueva tienda") cubren las 3 con toggle Light/Dark.

---

## Revisión 1 — Dirección 4 inicial (2026-05-01)

**Feedback humano:** "Bento Editorial es mi favorito por bastante, pero hay cosas que me gustaría cambiar":

- Más color (no tan monocromo azul) — sin llegar a Neon ni a Garden.
- Reemplazar la itálica del display por otra opción.
- Sumar al formulario los **section cards** estilo Soft Garden (sin la metáfora jardín).
- Sumar el **step indicator con círculos numerados + labels**.
- Sumar las **big choice cards** para tipo de tienda (Negocio / Persona) estilo Soft Garden.
- Idea de un **asistente panda** flotante o lateral que dé tips contextuales.
- Mantener el sidebar con resumen + atajos.

**Solución entregada (rev 1):** Dirección 4 — Bento Atelier:

- Paleta: indigo + coral + teal (3 acentos coordinados) + paleta categórica de 6 tonos para chips/avatares.
- Tipografía: Inter Display 700 con tracking -0.03em (sin italic).
- Form: 5 section cards con eyebrow + title funcional + helper, step indicator con círculos numerados, big choice cards con icono y descripción, chips de categoría coloreados, sidebar con Resumen + Atajos + **card del asistente Pan**.
- Dashboard: hero con eyebrow dot color, Categorías mini-bento con dots cromáticos, lista con avatares de categoría coloreados, feed con íconos en color, **bubble flotante del asistente Pan** en bottom-right.
- Mascot: panda 2D estilo Linny/Bluesky en bubble flotante con auto-pop contextual.

Ver detalle del entregable rev 1 en [`directions.md`](../directions.md) §4 (versión actual ya es rev 2 — ver historial git para rev 1).

---

## Revisión 2 — Sobriedad y separación de FRD (2026-05-01)

**Feedback humano:**

1. "El asistente panda flotante me gusta, pero **eso no va con el diseño** — sino más algo para un FRD nuevo." → **sacar al asistente del sistema de diseño**.
2. "Tiene demasiados colores y puede distraer mucho. **Puede ser un poco más sobrio**?"
3. "Me gusta el color de la barra (progress) y de las **métricas principales**." → conservar.
4. "Los colores de los puntitos de las categorías y de los **avatars de las tiendas ya es mucho**." → quitar paleta categórica visible.
5. "Quizá el logo y si no hay logo puede ser el avatar de **un solo color**." → avatares neutros.
6. "Además en vez de imágenes deberíamos de usar **íconos**. Quizá de Lucide o alguna librería de íconos." → Lucide canon.

**Solución entregada (rev 2):** ajuste sobre la rev 1, sin abandonar el espíritu Bento Atelier:

### Cambios en el sistema (`directions.md` §4)

- **Eliminada §4.10 "Asistente Pan"**. Reescrita como "Identidad de marca y mascota panda": el panda existe sólo como glyph en logo, empty states, 404 y achievements. Cualquier asistente conversacional se trata en un FRD aparte.
- **Paleta categórica reservada (no expuesta).** Se conservan las 6 variables OKLCH definidas, pero documentadas como "uso reservado para charts/filtros activos con alfa muy bajo". **Prohibido** como dot, avatar o chip lleno.
- **Tres acentos siguen** (indigo + coral + teal) pero con uso **estrictamente funcional**: indigo = primary CTA / progress / focus / links principales, coral = métrica "próximo pago" / status warm / achievements, teal = info / links secundarios / tooltips.
- **Avatares de tienda neutros**: logo si existe; si no, círculo `surface-elevated` con `border-strong` 1px y la **inicial en `text-primary`**. Una sola receta, sin variantes cromáticas.
- **Lucide como set único de íconos**. Ban explícito a emojis decorativos en UI. Identidad categórica vive en el ícono (`disc`, `book-open`, `sparkles`, `gallery-thumbnails`, `package`, `shapes`), no en color.
- **Section cards sin tinte**: eliminada la card con `surface-warm` que añadía calidez. Todas usan `surface` plano.
- **Eyebrows neutros**: eliminados los dots de color cromático en eyebrows. Eyebrow = `text-muted` + label uppercase.
- **Anti-patrones actualizados** (§4.14): se prohíben emojis decorativos, dots de color en eyebrows, avatares con color categórico, y el asistente conversacional dentro del sistema de diseño.

### Cambios en `directions-comparison.md`

- Tabla puntuada actualizada para Dirección 4: total subió de 39 → 40 (más simplicidad, mejor escalabilidad sin perder identidad).
- Análisis por criterio reescrito para reflejar la versión sobria.
- Recomendación final actualizada con mezclas posibles (Atelier con 2 acentos en vez de 3, Atelier + achievement Neon).

### Cambios en `demo.html` (dashboard)

- **Eliminada la bubble flotante de Pan** + JS asociado.
- **Avatares neutros**: la M de "Mercado X" ahora es letra blanca en `surface-elevated` con border. Las P / B / R de pre-órdenes activas, igual.
- **Categorías mini-bento**: los 6 dots de color reemplazados por **íconos Lucide en cuadro `surface-elevated`** (figures = shapes, vinyl = disc, manga = book-open, anime = sparkles, cards = gallery-thumbnails, plush = package).
- **Pre-órdenes activas**: la categoría aparece como **icono Lucide inline en gris** dentro del código mono, no como avatar coloreado.
- **Feed de actividad**: emojis ($, ✓, +) reemplazados por **SVG Lucide reales** (`circle-dollar-sign`, `package-check`, `plus-circle`) con color funcional (warm, success, cool) en `border-color` además del stroke.
- **Eyebrows sin dots cromáticos**: todos los eyebrows ahora son `text-muted` plano.
- **Avatar próximo pago** sin halo coral.

### Cambios en `demo-form.html` (formulario)

- **Eliminada la card del asistente Pan** del sidebar. Sidebar = sólo Resumen + Atajos.
- **Big choice cards (Negocio / Persona)**: emojis 🏪/👤 reemplazados por **íconos Lucide** (`store` / `user`) en SVG inline.
- **Logo upload**: emoji 📷 reemplazado por **Lucide `camera`** en SVG.
- **Chips de categoría**: paleta cromática quitada. Cada chip ahora es **ícono Lucide + label**, estado normal = neutro, estado active = `--accent` (indigo). Sin colores categóricos.
- **Card de Identidad sin `surface-warm`**: el tinte cálido se quitó, todas las cards usan `surface` plano.
- **Eyebrows sin dot cromático**.
- **Selects de país sin emojis de bandera** (consistente con Lucide canon).
- **Helper warn de duplicados** ahora usa Lucide `triangle-alert` SVG en vez de ⚠.
- JS limpio: eliminado el handler del Pan card collapse.

---

## Estado al 2026-05-01

- 4 direcciones documentadas en `directions.md`.
- 4 direcciones renderizadas en ambos demos HTML.
- Dirección 4 — Bento Atelier es la apuesta principal en su versión sobria (rev 2).
- Decisión humana pendiente: escribir `direction-chosen.md` con la dirección elegida y cualquier ajuste residual antes de lanzar S2.
