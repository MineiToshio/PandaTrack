---
title: Principios UX/UI — Sesión 1
last_updated: 2026-04-30
status: final S1
---

# Decálogo UX/UI para PandaTrack

Principios accionables para una app de tracking de coleccionables dirigida a 18–25 años, con light y dark como ciudadanos de primera clase. Cada principio incluye **enunciado**, **por qué** (justificación), **cómo aplicarlo**, y **anti-patrón** que descarta.

Síntesis basada en: Nielsen Norman Group filtrado por Gen Z, _Refactoring UI_ (Wathan/Schoger), Material 3 Expressive, Apple HIG iOS 18+, shadcn/Radix, estudios de attention span y form completion en Gen Z, WCAG 2.2 AA.

---

## 1. Light y dark son productos hermanos, no un toggle

**Enunciado.** Cada token, superficie, sombra, gradiente, ilustración y motion se piensa en los dos modos en paralelo, no como inversión.

**Por qué.** Gen Z usa dark por default por hábito y por OLED, pero alterna a light en exteriores y al despertar. Una app que sólo se ve bien en dark se siente abandonada el resto del tiempo. Dark mode no es "light invertido": en dark, la elevación viene de la luz emitida (glow, rim light) y los borders de baja opacidad reemplazan a las sombras; en light, el papel respira y la tinta dibuja.

**Cómo aplicarlo.** Tokens semánticos OKLCH con valor light y valor dark. Borders en dark vía `rgba(255,255,255,0.06–0.10)`. Accent ~8–12% más L en dark. `#000` puro está prohibido como background dark — usar `oklch(13–15% …)`. Mascot e ilustraciones se renderizan con dos lighting setups (rim light obligatorio en dark). Charts y gradientes con paletas duales. Toggle de tema explícito (light/dark/system) con persistencia.

**Anti-patrón.** "Lo invertimos con `filter: invert(1)`". "El logo blanco en dark es el negro de light al revés". "Subimos opacidad al `rgba(0,0,0,0.6)` para que se vea en dark".

---

## 2. Una pantalla, una decisión

**Enunciado.** Cada superficie tiene una acción primaria clara. Si hay dos, una es secundaria visualmente. Si hay tres, sobra una.

**Por qué.** El attention span 18–25 en mobile es de pocos segundos antes del primer scroll. Los formularios largos (pre-orden, tienda) son la principal causa de abandono. Progressive disclosure y "one thing per screen" son la respuesta validada por Stripe Checkout, Things 3, Apple onboarding flows.

**Cómo aplicarlo.** Multi-step para forms con ≥6 campos. Resumen lateral persistente cuando el usuario quiere ver el contexto. Pills meta inline editables (Linear-style) en lugar de mostrar 12 inputs simultáneos. CTA primaria una sola por viewport mobile.

**Anti-patrón.** Modal con 14 campos visibles. Form de "Nueva tienda" como un solo scroll de 200vh. Dos botones del mismo peso visual compitiendo por la atención.

---

## 3. Validación que ayuda, no que regaña

**Enunciado.** La validación es informativa antes del envío, correctiva sólo después. El error nombra el problema, sugiere el arreglo y mantiene el contenido tipeado.

**Por qué.** La generación 18–25 castiga apps que tachan en rojo mientras escribes o que borran un campo entero por un typo. Stripe y Linear son los benchmarks: feedback verde tras blur cuando el dato es válido, rojo sólo cuando el usuario intentó enviar.

**Cómo aplicarlo.** Validación inline post-blur (no on-change). Server errors mapeados a campos específicos con copy declarativo en español ("La fecha de entrega no puede ser anterior a la de orden — ajusta la fecha o cambia el orden"). Optimistic UI con revert claro si el server rechaza, con toast de explicación. Conservar inputs tipeados ante error de server.

**Anti-patrón.** "Email inválido" en rojo mientras el usuario escribe `s` de su email. Limpiar el formulario completo tras error 500. Mensajes genéricos como "Algo salió mal".

---

## 4. Motion con propósito y vocabulario reducido

**Enunciado.** El motion confirma una acción, comunica una jerarquía o transporta un objeto. Tres easings, tres durations, una librería para springs. Punto.

**Por qué.** El motion sin propósito se siente lento, decorativo y caro de mantener. Linear, Raycast y Apple validan que sub-200ms se siente snappy y que springs físicos comunican peso. Material 3 Expressive separa _spatial_ (springs) de _effects_ (cubic-bezier).

**Cómo aplicarlo.** Vocabulario fijo:

- `--motion-fast: 150ms`, `--motion-base: 280ms`, `--motion-slow: 480ms`.
- `--ease-out-expressive` (linear() spring suave) para enters espaciales.
- `--ease-emphasis` (`cubic-bezier(0.2, 0, 0, 1)`) para opacity y color.
- `--ease-bounce` (linear() spring con bounce 0.2) para celebraciones.

Cualquier animación nueva se compone con estos seis tokens; si necesitas otro, justifica por qué los existentes no sirven. View Transitions API para shared element list→detail. Scroll-driven CSS para colapso de header. `prefers-reduced-motion` reduce todo a fade 150ms.

**Anti-patrón.** Cada componente con su propio easing inventado. Animaciones decorativas en cada hover. Splash de 2 segundos al abrir la app. Motion que oculta lentitud de fetch.

---

## 5. Densidad informativa con respiración

**Enunciado.** Las listas son densas pero respirables: 36–40px en desktop, doble línea en mobile, swipe actions en lugar de filas saturadas.

**Por qué.** Un coleccionista con 80 pre-órdenes activas no quiere scrollear cards-pósters gigantes (Letterboxd-style only) ni filas enterprise saturadas (SAP-style). Linear y Height demostraron que la densidad alta + hover reveals es la zona dulce. Apple HIG con swipe-actions reduce taps en flujos frecuentes.

**Cómo aplicarlo.** Filas con info clave (tienda, código, total, estado, próximo pago) en una línea + meta secundaria en la segunda. Acciones secundarias aparecen en hover desktop / long-press mobile. Swipe izquierda = acción afirmativa frecuente (marcar pago), swipe derecha = acción contextual (ver tienda). Peek panel lateral en desktop para detalle sin perder filtros activos.

**Anti-patrón.** Cards de 280px de alto en una lista de 80 elementos. Botones "Editar / Ver / Eliminar" siempre visibles en cada fila.

---

## 6. Personalidad puntual, no sticker omnipresente

**Enunciado.** El panda mascot aparece en empty states, hitos y momentos ceremoniales. Fuera de eso, sólo deja huella en el grid (forma del pad, color de marca, una pieza decorativa).

**Por qué.** Linny (Linear) demostró que un mascot escaso es más memorable que un Duo omnipresente. Para 18–25 con coleccionables premium, sobrecargar de mascot infantiliza. POPMART y Cash App muestran que la celebración debe ser puntual y emotiva.

**Cómo aplicarlo.** Sistema con poses, expresiones y dos lighting setups (light/dark). Estados emocionales claros: durmiendo (sin compras), cargando paquete (entrega en camino), preocupado (pago vencido), orgulloso (colección crece). Empty states siempre con panda + copy declarativo. Achievement unlocks con celebración (confeti + haptic + sonido opcional). En el resto de pantallas, presencia tipográfica/cromática del brand sin la mascota visible.

**Anti-patrón.** Panda en cada esquina de cada pantalla. Panda celebrando cuando el usuario acaba de perder dinero por una entrega no llegada. Microcopy en primera persona del panda en cada toast.

---

## 7. Voice: informal, cómplice, breve, sin corporativismo (post rev 3)

**Enunciado.** Hablamos como un amigo que sabe del tema. Segunda persona `tú` siempre. Voz activa. Frases cortas. Cero corporativismo, cero meme storm. El error no culpa, propone.

**Por qué.** Cash App y Monzo validaron que Gen Z lee menos texto pero capta mejor el contexto cuando es coloquial. Linear validó que la copy declarativa de empty states aumenta el first-action-rate. Apple HIG advierte contra el "we apologize for the inconvenience". Y soreniverson/discord/bluesky muestran que el "bestie no cap fr fr 💀" envejece en 6 meses — la informalidad sostenible es la conversacional adulta, no el TikTok-talk.

**El sweet spot.** Está entre dos extremos prohibidos:

- ❌ **Linear-frío / corporativo:** _"Ha ocurrido un error en el procesamiento de su solicitud. Por favor, intente nuevamente más tarde."_
- ✅ **Atelier sweet spot:** _"Algo se rompió de este lado. Dale otra vez."_
- ❌ **Duolingo-cringe / TikTok-talk:** _"Ups bestie 💀 algo salió mal lol no cap fr"_

### Glosario de 15 pares — antes (frío) → después (Atelier)

Esta es la fuente de verdad cross-direction. Cualquier copy nuevo se compara contra estos pares para calibrar el tono.

| #   | Superficie              | ❌ Antes (frío / corporativo)                                                                 | ✅ Después (Atelier informal)                             |
| --- | ----------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1   | Empty pre-órdenes       | _"No se encontraron pre-órdenes registradas en el sistema."_                                  | _"Sin pre-órdenes todavía. Suma una y empezamos."_        |
| 2   | Pago registrado         | _"El pago ha sido procesado exitosamente. Saldo restante: $48,50 USD."_                       | _"Listo. Te quedan $48,50."_                              |
| 3   | Error 500               | _"Ha ocurrido un error en el servidor. Por favor, contacte al administrador."_                | _"Algo se rompió de este lado. Dale otra vez."_           |
| 4   | Confirm delete          | _"¿Está seguro que desea eliminar este pedido? Esta acción es irreversible."_                 | _"¿Borrar este pedido? Sus pagos también se van."_        |
| 5   | Loading                 | _"Cargando datos, por favor espere…"_                                                         | (skeleton sin texto) — o si necesita texto: _"Buscando…"_ |
| 6   | Validation duplicado    | _"Se han detectado posibles coincidencias en la base de datos: Mercado MX, Mercado XX."_      | _"Hey, hay 2 tiendas parecidas. ¿Es alguna?"_             |
| 7   | Achievement entrega     | _"Su pedido ha sido marcado como entregado. Su colección ha sido actualizada."_               | _"Llegó. Pieza nueva en tu colección. 🎉"_                |
| 8   | CTA primario            | _"Registrar pago en el sistema"_                                                              | _"Anotar pago"_                                           |
| 9   | Date picker placeholder | _"Seleccione una fecha del calendario"_                                                       | _"¿Para cuándo?"_                                         |
| 10  | Save autoguardado       | _"Sus cambios han sido guardados automáticamente hace 4 segundos."_                           | _"Guardado, hace 4s"_                                     |
| 11  | Discrepancia modal      | _"La sumatoria de los items no coincide con el monto total ingresado. ¿Cómo desea proceder?"_ | _"Tu suma no cuadra con el total. ¿Cuál dejamos?"_        |
| 12  | Empty filter            | _"No se encontraron resultados que coincidan con los filtros aplicados."_                     | _"Nada con esos filtros. ¿Quitamos alguno?"_              |
| 13  | Email confirmado        | _"Su correo electrónico ha sido verificado satisfactoriamente."_                              | _"Email confirmado. Ya estás dentro."_                    |
| 14  | Onboarding step         | _"Para comenzar, deberá crear su primera tienda."_                                            | _"Vamos por tu primera tienda."_                          |
| 15  | Sin tiendas (gate)      | _"No es posible crear una orden sin tener al menos una tienda registrada previamente."_       | _"Necesitas una tienda primero. Te ayudamos."_            |

### Reglas operativas

1. **`tú` siempre, nunca `usted`.** Sin excepciones (los textos legales en `terms.md` y `privacy.md` viven con su tono propio formal y no son alcance de esta regla).
2. **Voz activa.** "Cancela este pedido", no "Este pedido será cancelado". "Borra el archivo", no "El archivo es eliminado".
3. **Una idea por línea.** Si la frase pasa de 12 palabras, se parte. Si una pantalla pide más de 30 palabras de copy, está mal pensada.
4. **Honesto en errores.** "Algo se rompió de este lado" en lugar de "Lo sentimos por las molestias". Asume la culpa cuando es nuestra; no le pidas perdón al usuario por lo que no hizo.
5. **Cero corporativismo.** Banear: _"Le informamos"_, _"Ha ocurrido"_, _"Tenga en cuenta"_, _"Por favor"_ (en CTAs y validaciones; ok en cortesías reales), _"Disculpe las molestias"_, _"Sistema"_, _"Procesamiento"_, _"Operación exitosa"_.
6. **Cero meme storm.** Banear: _"bestie"_, _"no cap"_, _"literally me"_, _"slay"_, emoji loops. Un emoji puntual y funcional sí (✨ achievement, 🎉 colección completa, 🌱 primer pedido). Máximo 1 emoji por mensaje, y sólo en momentos celebratorios — no en errores, no en CTAs normales.
7. **Brevedad sobre ingenio.** Si no se te ocurre algo natural en 5 segundos, escribe lo más corto y útil. _"Listo"_ es mejor que un chiste forzado.
8. **Locale `es` + `en` con paridad.** El copywriter no traduce, reinterpreta. _"Te quedan $48,50"_ en `es` no es _"$48,50 left to you"_ en `en` — es _"$48,50 to go"_. Glosario en `docs/product/glossary.md`.

**Anti-patrón.** "Le informamos que su transacción ha sido procesada exitosamente". "Lo sentimos por las molestias ocasionadas". "Click here to continue". Y al otro extremo: "ay bestie 💀 algo se rompió no cap fr fr". Cualquiera de los dos polos saca al usuario del producto.

---

## 8. Accesibilidad WCAG 2.2 AA en ambos modos, sin ceremonias

**Enunciado.** Cada superficie cumple AA en light y dark. Focus visible siempre. Touch target 44×44 mínimo. Soporte completo de teclado y screen reader.

**Por qué.** No es opcional, es no-negociable. WCAG 2.2 añade criterios 2.4.11 (Focus Not Obscured) y 2.4.13 (Focus Appearance). El target 18–25 incluye personas con condiciones de accesibilidad temporales y permanentes que abandonan apps que no las consideran.

**Cómo aplicarlo.** Focus ring `outline: 2px solid var(--focus-ring); outline-offset: 2px;` en `:focus-visible`. Contraste verificado AA en cada token (≥4.5:1 texto, ≥3:1 UI grande/borders). Labels en cada control, `aria-live` en status feedback, gestos siempre con alternativa via teclado/click. Reduce motion respetado. Charts con descripciones textuales y patterns como fallback de color.

**Regla específica para `--text-muted`.** El token de texto más bajo de la jerarquía (timestamps, code, eyebrows, captions, helpers) **debe cumplir 4.5:1 sobre `--background` Y sobre `--surface`**, no sólo "se ve bien". Tendencia natural del diseñador es bajarlo a `oklch(60% …)` en light buscando "elegancia"; eso da ~3.5:1 y rompe AA en texto pequeño 11–13px que es justo donde se usa este token. Regla: en light usar `oklch(50% …)` o más oscuro; en dark `oklch(64% …)` o más claro. Verificar con contrast checker, no por ojo.

**Anti-patrón.** "Lo arreglamos en QA antes del launch". Focus ring del navegador suprimido. Tap targets de 32px. Color como único portador de información. Texto muted "elegante" pero ilegible en mobile bajo sol.

---

## 9. Dato como héroe, chrome al servicio del dato

**Enunciado.** Los números (total, restante, días al destino, pagos hechos) son el contenido principal. La UI los presenta con peso tipográfico claro, tabular nums, y narrativa que los explica.

**Por qué.** Cash App, Robinhood y Revolut demostraron que el balance grande emocional importa más que el chrome. Para coleccionables, "qué falta pagar y para cuándo llega" es la pregunta central — la UI debe responderla en menos de un segundo.

**Cómo aplicarlo.** Display tipográfico 48–72px para totales hero. Tabular numbers (`font-variant-numeric: tabular-nums`) en TODA cifra que pueda actualizar (evita jitter). Jerarquía clara: total → restante → próximo pago → fecha esperada. Símbolo de moneda y locale formatting respetando preferencias del usuario. Cifras siempre con contexto (no `$48.50` solo, sino `$48.50 restantes de $120`).

**Anti-patrón.** Total de la orden en `text-base` perdido entre meta. Usar `font-variant-numeric: proportional-nums` en cifras que actualizan optimistic. Mostrar montos sin moneda implícita ni contextualización.

---

## 10. Mobile-first real, desktop como espacio extra

**Enunciado.** Cada pantalla se diseña primero en 360px con gestos nativos. Desktop se gana espacio para peek panels y atajos de teclado, no para "ver todo a la vez".

**Por qué.** Gen Z gestiona pre-órdenes desde el celular en momentos liminales (transporte, fila, antes de dormir). Si la app sólo brilla en desktop, pierde 70% de las sesiones reales. Mobbin captura cómo Cash App, Monzo, Letterboxd diseñan en mobile y _escalan_, no al revés.

**Cómo aplicarlo.** Bottom sheet con stops Vaul-style para acción rápida. Tab bar inferior con 4 destinos máximo + FAB elevado para creación. Pull-to-refresh real (no decorativo). Swipe actions en cada lista. En tablet/desktop: sidebar primaria, peek panel lateral en detalle, atajos de teclado (`⌘K` aspiracional, navegación J/K, `N` para nuevo). View Transitions habilitan shared element en ambos formatos.

**Anti-patrón.** Diseñar el dashboard en 1440px y luego "ver cómo entra" en mobile. Hover-only interactions sin equivalente táctil. Tablas con scroll horizontal forzado en mobile. Modal full-screen en desktop cuando un peek panel basta.

---

## Cierre — la prueba de los 10

Antes de aprobar cualquier pantalla del rediseño, validamos:

1. ¿Funciona igual de bien en light y dark, con tokens propios cada uno?
2. ¿Hay una decisión clara por viewport?
3. ¿La validación ayuda o regaña?
4. ¿Las animaciones usan el vocabulario de 6 tokens?
5. ¿Las listas son densas pero respirables?
6. ¿La personalidad aparece sólo donde aporta?
7. ¿La copy es directa, cálida, no condescendiente?
8. ¿Cumple AA con focus visible y target ≥44px?
9. ¿El dato manda y el chrome respeta?
10. ¿Funciona desde 360px y se gana espacio hacia desktop?

Si la respuesta a alguna es "no", la pantalla aún no está lista.
