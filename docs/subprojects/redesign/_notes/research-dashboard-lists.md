---
title: Research — Dashboard KPIs + Orders list patterns
session: 02-postresearch
last_updated: 2026-05-01
---

# Research — Dashboard + Orders list

Investigación sobre patrones de KPIs en dashboards de tracking + decisiones de paginación, sort, swipe y densidad para la lista de pedidos. Las recomendaciones cuestionan la propuesta actual del wireframe S2.

---

## A. Dashboard — 4 micro-stats correctos

Recordatorio de la propuesta S2: `Pagado · Próximo · Vencidos · Llegando`. Cifra hero = total restante a pagar. El usuario abre el dashboard una vez al día (o más) y debe responder en <1s "qué pago, qué llega".

### Hallazgos por app

**BNPL (Klarna, Afterpay, Affirm).** Las apps de pago diferido jerarquizan así:

1. **Próximo pago** (monto + fecha) como dato más visible, casi siempre en card destacada arriba.
2. **Total pendiente** (sumatoria de todos los planes activos).
3. **Cuota actual / total cuotas** (progreso por plan, no agregado).
   No exponen "vencidos" como métrica hero — los pagos atrasados aparecen como **interrupción crítica** (banner rojo) sólo si hay alguno; cuando es cero no se muestra. Klarna añade "credit available" como cuarta métrica pero eso no aplica a PandaTrack.

**Tracking logístico personal (Parcel, Deliveries, AfterShip).** El hero suele ser un **count + estado**, no un monto:

1. **N paquetes en tránsito** con ETA del más próximo.
2. **N entregados recientemente**.
3. Filtro/segmentación por carrier o estado.
   La métrica monetaria no aparece porque no es el dominio.

**Coleccionables / wishlist (Discogs, GOAT, eBay watching).** Mezclan:

1. **Watchlist count** + cambios de precio recientes.
2. **Próximos drops / fechas esperadas** (cuando aplica pre-orden).
3. Total invertido suele estar en una pestaña de "stats" separada, no en el home.

**Finanzas con metas (YNAB, Goodbudget).** YNAB tiene un único número hero: **"Ready to Assign"** ("listo para asignar"). Es la métrica accionable más fuerte. Todo el resto es subordinado. Goodbudget muestra **balance restante por sobre** (envelope), también un solo número por contexto.

**Patrón común en apps premium tipo Linear/Notion/Stripe.** Cuando el dashboard tiene 4 métricas, son **homogéneas en formato** (todas counts o todas amounts) y **heterogéneas en función** (una de monto, una de tiempo, una de estado, una de actividad). Mezclar `$812 / $185 / $0 / 2` (3 amounts + 1 count) crea fricción cognitiva: el ojo no puede comparar las 4 sin recalibrar.

### Análisis de la propuesta actual (Pagado / Próximo / Vencidos / Llegando)

**Lo que funciona:**

- Cubre las 3 dimensiones del modelo mental del coleccionista: dinero gastado, dinero por gastar, paquetes en camino.
- Cada uno tiene un color de status funcional, lo que facilita memoria visual.

**Lo que no funciona:**

1. **Heterogeneidad de unidades.** Pagado/Próximo/Vencidos son `$`, Llegando es count. El cerebro no puede comparar. Confirma el anti-patrón observado en Linear/Stripe (que sólo agrupan counts juntos o amounts juntos).
2. **"Vencidos" en pre-orders es semánticamente raro.** Una pre-orden no "vence" como un BNPL: el pago no tiene un due date estricto impuesto por contrato — el due date es lo que el coleccionista se autoimpuso al crear el plan. Decir "vencidos" sugiere penalidad/multa que no existe. Más honesto: **"Atrasado respecto al plan"** o quitar la métrica del hero y mostrarla como banner sólo si hay >0 (igual que BNPL hace con sus overdue).
3. **"Pagado" en monto es métrica de vanidad.** Mostrar "$812 pagado" es mirar al pasado. El usuario abre el dashboard para decidir qué hacer ahora, no para celebrar lo que ya fue. YNAB lo entendió: nada en el hero es histórico.
4. **"Llegando" como count puede ser ambiguo.** ¿Cuenta entregas (paquetes físicos) o pedidos cuyo `expectedDeliveryFrom ≤ now+7d`? La definición debe ser explícita.
5. **Falta una métrica accionable temporal.** "Próximo pago" en el card grande ya cubre el "cuándo", pero los micro-stats no tienen dimensión de tiempo agregada (ej. "este mes", "próximos 7 días").

### Recomendación final

**Reemplazar las 4 micro-stats por las siguientes 4, todas amounts (homogéneas) y orientadas al futuro:**

| Posición | Métrica               | Definición                                                                                         | Color                 | Por qué                                                                                                                                                                                                                |
| -------- | --------------------- | -------------------------------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | **Este mes**          | Suma de pagos programados con `dueDate` dentro del mes calendario actual.                          | `--accent` indigo     | Horizonte temporal accionable; lo más cercano a "Ready to Assign" de YNAB. Responde "¿cuánto tengo que separar este mes?".                                                                                             |
| 2        | **Próximos 30 días**  | Suma rolling de los próximos 30 días desde hoy.                                                    | `--accent-warm` coral | Ventana planificadora útil para flujo de caja. Diferencia con (1): no se reinicia el día 1, es continuo.                                                                                                               |
| 3        | **Atrasado**          | Suma de pagos cuyo `dueDate` (del plan) ya pasó y siguen pendientes. **Sólo se renderiza si > 0**. | `--warning` ámbar     | Si es 0, ocupa el slot con métrica alternativa (ver fallback). Renombrado para evitar el peso semántico de "vencido".                                                                                                  |
| 4        | **Llega esta semana** | Count de entregas con `expectedDeliveryFrom ≤ now+7d`.                                             | `--success` verde     | Mantener como count tiene sentido aquí porque hablamos de paquetes físicos, no dinero. La heterogeneidad se vuelve aceptable cuando es 1 de 4 y está al final (cierra el bento con el dato emocional: "qué llega ya"). |

**Fallback cuando "Atrasado" = 0:** mostrar **"Tiendas activas"** (count de tiendas con ≥1 pre-orden activa) en `--accent-cool` teal. Métrica neutra, ayuda al usuario a recordar la diversidad de su colección. Mantiene los 4 slots ocupados sin gritar un cero falso.

**Cifra hero (sigue siendo el "$1.247,80 restante en 8 pre-órdenes activas"):** correcta, no tocar. Es el equivalente de "Ready to Assign" de YNAB para este dominio.

**Patrón visual:** 3 amounts + 1 count es aceptable porque el último slot es un cambio de contexto deliberado ("dinero → paquetes"), no una mezcla aleatoria.

### Cuestionamiento de la propia recomendación

- **¿Funciona con 3 pre-órdenes vs 80?** Sí. "Este mes" puede ser $0 con 3 pre-órdenes si todas tienen due dates futuros — en ese caso, el dashboard luce relajado, lo que es correcto. Con 80 pre-órdenes, el número crece y mantiene jerarquía. La métrica escala bien.
- **¿"Llega esta semana" es ruido si el usuario no tiene entregas inminentes?** Cuando es 0, mostrar "Sin llegadas próximas" en `--text-muted` mantiene el slot estable. No reemplazar el slot, sólo cambiar el copy.
- **Riesgo de "Atrasado" como slot condicional.** Cambiar dinámicamente el contenido de un slot puede confundir. Mitigación: el slot SIEMPRE existe; cuando atrasado=0, muta a "Tiendas activas" con un cross-fade lento (no aparece/desaparece).

### Confianza

**Media-alta (7/10).** Las heurísticas de YNAB y BNPL son sólidas, pero no testeé con usuarios reales del dominio. La decisión de "Atrasado" condicional debería validarse con prototipo testable en S3.

---

## B. Paginación mobile vs desktop

Propuesta S2: infinite scroll mobile + paginación clásica desktop con `pageSize 30`.

### Hallazgos

**Linear (referencia clave de Atelier).** No usa paginación clásica visible. Usa **virtualización completa con scroll continuo** (`@tanstack/virtual` o equivalente). El usuario percibe scroll infinito pero el DOM mantiene <100 nodos a la vez. No hay botón "siguiente página" porque no hay páginas: hay una lista única virtualizada.

**GitHub Issues / Stripe Dashboard / JIRA.** Paginación clásica con page size configurable (25/50/100). Stripe API default es 10 (no 30). El motivo es **previsibilidad y bookmark-ability**: el usuario power puede compartir `?page=3` y volver al mismo lugar.

**Apps mobile-first (Twitter, Instagram, Letterboxd).** Scroll infinito con sentinel. Aceptan el costo del "perdí mi scroll" porque el usuario no espera volver al mismo punto — el feed es efímero.

**Problema confirmado del scroll infinito en mobile + back button:** Múltiples fuentes (Artsy, NN/g, Metafizzy) reportan que el back button suele resetear scroll al top. La Scroll Restoration API y History API ayudan pero requieren trabajo explícito. Next.js App Router 15 lo maneja mejor que antes pero **no garantiza scroll restoration con scroll continuo virtualizado** — requiere library externa o implementación custom.

**Conflicto con view-transitions:** la view-transition canónica `order-{humanId}` morfa la row clickeada al header del detalle. Cuando el usuario regresa con back, espera ver la row en su posición original. Con paginación clásica, esto funciona naturalmente (la URL incluye `?page=N&filter=X` y el browser restaura). Con scroll infinito, el browser no sabe en qué row estaba — hay que persistir scroll position en sessionStorage **y** asegurar que las pages previas estén cargadas antes de que la view-transition reverse-anime. Es factible pero frágil.

**`pageSize 30` vs 50.** Para una vista densa de 36px row alto en desktop, 30 rows ocupan ~1080px (más viewport scroll interno). 50 rows ocupan ~1800px y exigen scroll interno significativo aun en monitores grandes. Stripe/GitHub default ronda 25-30. **30 está calibrado correctamente.**

### Recomendación

**Mantener decisión actual con un refinamiento:**

1. **Desktop: paginación clásica `pageSize 30`** (sin cambio). Razones:
   - Coexiste sin conflicto con view-transitions (URL es la fuente de verdad).
   - Bookmark-able / shareable.
   - Performance previsible (no se acumulan rows en memoria).
   - Usuarios power esperan este patrón en herramientas de trabajo.
2. **Mobile: cambiar a "load more" botón explícito en lugar de sentinel automático.** Razones:
   - El sentinel automático crea exactamente el problema de "perdí mi scroll" reportado.
   - "Load more" mantiene la URL paginada (`?page=2`) implícitamente, reusa la infraestructura de desktop.
   - El usuario controla cuándo cargar más — gana previsibilidad sin perder densidad.
   - Reduce data sobre conexiones móviles débiles.
   - Es el patrón usado por e-commerce y por GitHub mobile.
3. **Tercer camino para 500+ pedidos (futuro, no S2):** virtualización Linear-style con `@tanstack/virtual`. Requiere implementación custom de view-transition source delegation (sólo la row visible declara `view-transition-name`). Documentar como deuda técnica para S5+ cuando datos productivos justifiquen el esfuerzo.

### Cuestionamiento de la propia recomendación

- **¿"Load more" es regresión vs scroll infinito moderno?** No. Es honesto sobre el costo de "ir más allá de la página actual" y resuelve el bug de scroll restoration sin código frágil. Ver MaterialUI, Shopify Storefront, Polaris.
- **¿Funciona con 500+ pedidos?** Apenas. Después de cargar 5+ pages el DOM se vuelve pesado. Por eso la virtualización es la salida de largo plazo. En MVP con 10–80 pedidos típicos, no es problema.
- **¿`pageSize 30` desktop pero 20 mobile podría ser mejor?** Posiblemente. Mobile tiene rows más altas (76px line-1+line-2) y 30 rows = ~2280px de scroll. 20 rows = ~1520px, más manejable. **Sub-recomendación: `pageSize 30 desktop / 20 mobile`** parametrizado.

### Confianza

**Alta (8/10).** El cambio de sentinel a load-more está bien fundamentado por documentación oficial sobre scroll restoration. La sub-recomendación de pageSize por viewport requiere validación con datos reales pero el riesgo es bajo.

---

## C. Sort default + filtros persistentes

Propuesta S2: sort default = "Más recientes" (`orderDate desc`). Filtros NO persisten cross-session.

### Hallazgos

**Linear.** Por defecto usa **"Focus" sort** en "My issues" — un sort compuesto que prioriza issues empezados, luego priority, luego due date. No es "más recientes". Cualquier vista permite **"Set default for everyone"** o personal default. Los filtros se persisten al guardar la vista como Custom View; si no se guarda, se pierden al cambiar de vista.

**GitHub Issues.** Default sort es `created desc` (más recientes). Filtros NO persisten cross-session por default — varios issues abiertos en la community pidiendo persistencia, GitHub no la implementa. Han añadido **Saved Filters** recientemente como feature opt-in para power users.

**JIRA / Stripe.** Saved searches / filters explícitos. Default sort = más recientes. Persistencia opt-in por nombre.

**Patrón emergente en herramientas modernas (Linear-style):**

- Sort y filtros persistidos en **URL** durante la sesión (shareable, deep-linkable).
- **NO persisten cross-session** por default.
- **Sí persisten** cuando el usuario explícitamente guarda como **vista** (Custom View / Saved Search).

Diferencia clave: **filtro en URL** ≠ **filtro default cross-session**. La URL es estado de la sesión actual; las vistas guardadas son configuración del usuario.

### Recomendación

**Mantener decisiones S2 con dos refinamientos:**

1. **Sort default = "Más recientes" (sin cambio).** Es el patrón canónico de GitHub/Stripe/JIRA y matchea expectativa del usuario. La alternativa "Próximos a llegar" es más accionable pero requiere data de delivery confiable que hoy no existe (las entregas son stubs hasta el FRD).
2. **Filtros persisten en URL durante sesión, NO cross-session (sin cambio).** Coincide con Linear/GitHub/Stripe.
3. **Refinamiento 1: sort y filter "anti-flicker" en navegación interna.** Cuando el usuario va de `/orders?status=active` al detalle y vuelve con back, los filtros DEBEN seguir aplicados (URL los preserva — verificar que no se reseteen accidentalmente al re-render).
4. **Refinamiento 2: reservar arquitectura para "vistas guardadas" en S4+.** No implementar en MVP, pero el modelo de URL-as-state debe permitir un futuro `savedViews: { name, urlState }[]` por usuario sin re-arquitectura. Documentar en `_notes/assumptions-s2.md` como dependencia futura (ya está parcialmente cubierto en OL2/OL3).

### Cuestionamiento de la propia recomendación

- **"Más recientes" revela los pedidos más relevantes?** No siempre. Un pedido pre-ordenado hace 6 meses con entrega esta semana es más relevante que uno creado ayer con entrega en 8 meses. **Pero** "Más recientes" es predecible y el usuario puede cambiarlo manualmente con el dropdown. Mejor previsibilidad que magia.
- **¿Filtros que NO persisten frustran a power users?** Sí, especialmente los que usan los mismos filtros cada día. Mitigación: las vistas guardadas son la respuesta, no persistir filtros transparentemente (eso confunde más que ayuda — el usuario no sabe por qué falta data).

### Confianza

**Alta (8/10).** Patrones bien establecidos. La única zona gris es si validar "Próximos a llegar" como default cuando exista data productiva.

---

## D. Swipe actions direction

Propuesta S2: swipe izquierda = "Anotar pago" (`--success`), swipe derecha = "Ver tienda" (`--accent-cool`).

### Hallazgos

**Apple Mail (default iOS).** Swipe **izquierda** = More / Flag / Archive (acciones múltiples, destructivas o de organización). Swipe **derecha** = Mark as Read (acción de inbox-zero, no destructiva). **Direction convention:** izquierda = acciones de "remover/procesar fuera del inbox", derecha = "estado de lectura/atención". Customizable.

**Things 3.** Swipe **izquierda** = mark complete (acción terminal). Swipe **derecha** = schedule / add date (acción planificadora). **Convention:** izquierda = cerrar/completar, derecha = posponer/decidir más tarde.

**Gmail.** Configurable. Default izquierda = archive (terminal), derecha = configurable.

**Patrón cross-app dominante en iOS:**

- **Swipe izquierda** = acción **principal/destructiva/terminal**. Es donde está el pulgar derecho del 80% de usuarios diestros, gesto natural.
- **Swipe derecha** = acción **secundaria/postergar/navegar**.

### Análisis de la propuesta actual

**Swipe izquierda = "Anotar pago"** es **acción principal accionable**. ✓ Coincide con convención iOS (Things 3 mark complete, Mail archive). La acción transforma el estado del pedido.

**Swipe derecha = "Ver tienda"** es **acción de navegación lateral** (no transforma el pedido, salta a otra entidad). ✓ Coincide con la convención de "secundaria/diferir" en sentido amplio. El usuario no espera consecuencia destructiva.

**El color verde para "anotar pago"** es ambiguo: en Things 3 verde + izquierda = complete (terminal). El usuario podría asumir que swipe izquierda "completa" la pre-orden, no que sólo anota un pago parcial. **Riesgo de copy:** la etiqueta "Anotar pago" debe ser inequívoca, no "Pagar" ni "Completar".

### Recomendación

**Mantener decisión actual con dos refinamientos:**

1. **Swipe izquierda = "Anotar pago" (sin cambio en dirección).** Coincide con convención iOS dominante.
2. **Swipe derecha = "Ver tienda" (sin cambio en dirección).** Acción no destructiva, navegacional.
3. **Refinamiento 1: ajustar copy del label de swipe.** Verificar que la etiqueta visible al hacer swipe izquierda sea exactamente `"Anotar pago"` (no "Pagar"). Reduce ambigüedad.
4. **Refinamiento 2: revisar el color del swipe-action izquierda.** `--success` verde en Things 3 = terminal. Para evitar la falsa promesa "esto cierra la pre-orden", considerar usar **`--accent` indigo** (color de CTA primario "Anotar pago" en el resto de la app — coherencia cross-screen). El verde se reserva para cuando el pago efectivamente cubra el 100% (toast post-acción).
5. **Refinamiento 3: haptic feedback diferenciado.** Light impact al cruzar el threshold de swipe izquierda (acción accionable), selection feedback en swipe derecha (navegación). Refuerza el modelo mental "izquierda transforma, derecha navega".

### Cuestionamiento de la propia recomendación

- **¿Usuario zurdo se confunde?** Posiblemente. Mitigación: no hay configuración custom en MVP, aceptamos el sesgo diestro estándar de iOS/Android. Si surge feedback, considerar setting opt-in.
- **¿La convención "izquierda = terminal" rompe si "Anotar pago" no completa la pre-orden?** Es por eso que el color y copy importan. Indigo + "Anotar pago" señalan acción modificadora pero no terminal. Verde + "Pagado" sería terminal y entrarían en colisión.

### Confianza

**Media (6/10).** La dirección está bien, pero el color verde + acción no-terminal es un riesgo real. Validar en S3 con prototipo táctil (la convención teórica no garantiza la lectura emocional).

---

## E. Densidad toggle (densa default + cómoda opt-in en localStorage)

### Hallazgos

**Material React Table, Mantine, Cloudscape, Vuetify, MUI X.** Todos tratan la densidad como **preferencia de usuario persistida** (no preferencia de pantalla). Cloudscape Design System lo dice explícitamente: "store the user's preference across all pages within your service". Patrón dominante = persistir cross-session, NO sólo en una pantalla.

**Linear / Notion / Stripe.** Densidad fija con tendencia a "compacto". No exponen toggle al usuario. Filosofía: nosotros decidimos qué es óptimo, y es denso. El usuario no debe preocuparse.

**Discourse, Salesforce.** Toggle expuesto, persistido en perfil de usuario (no localStorage anónimo).

**Decisión de "dónde vive el toggle":**

- **Opción A: en la página** (header de orders-list, junto al sort). Discoverability alta, scope claro.
- **Opción B: en settings → preferences**. Discoverability baja, pero alineado con que sea preferencia del usuario y no por-pantalla.
- **Opción C: ambos** (toggle en página + reflejado en settings como source of truth). Patrón Linear-like del theme toggle (también está en shell + settings).

**`localStorage["orders.density"]` vs preferencias del schema:**

- `localStorage` = local del browser/device. Si el usuario cambia de dispositivo, pierde la preferencia. Aceptable para MVP.
- Schema `preferences` = sincronizado cross-device. Mejor experiencia pero requiere migration.

### Recomendación

**Cambiar a Opción C con `localStorage` por ahora, con plan de migración:**

1. **Densa default = mantener (sin cambio).** Apropiado para coleccionista con 10–80 pedidos.
2. **Toggle en página:** en header del listado (donde está hoy en el wireframe). Discoverability alta.
3. **Toggle reflejado en `/settings → preferences`:** "Vista densa" como switch separado, fuente de verdad consultable. Cross-screen visible + alineado con cómo el theme toggle ya vive en ambos lados.
4. **Persistencia: `localStorage["orders.density"]` en MVP** (sin cambio). Documentar como deuda técnica para mover a `preferences` schema en S3+ junto con `showMascot`.
5. **Tap target en mobile densa:** el wireframe S2 documenta que la row densa = 76px efectivo (línea 1 + línea 2 + padding 14×2). Cumple §8 a11y (≥44px holgado). **Verificar visualmente en mock real** que los chips de status dentro de la row no caen bajo 44px individualmente (el chip es interactivo si filtra al tap).

### Cuestionamiento de la propia recomendación

- **¿Default densa rompe a usuarios con 3 pre-órdenes?** No. 3 rows × 76px = 228px, queda mucho whitespace pero no se siente apretado. Si quisiéramos optimizar para casos vacíos, mejor un empty state grande, no cambiar la densidad.
- **¿`localStorage` por device crea inconsistencia molesta cross-device?** Sí, pero es problema "nice-to-have" para post-MVP. La migración a `preferences` schema es tarea bien delimitada.

### Confianza

**Alta (8/10).** Patrón Cloudscape/MUI bien validado. La Opción C (página + settings) tiene precedente claro con el theme toggle.

---

## Resumen ejecutivo

| Tema                         | Decisión actual S2                                                          | Recomendación                                                                                                                                                                    | Cambio                                                  | Confianza         |
| ---------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------- |
| **A. Micro-stats dashboard** | Pagado / Próximo / Vencidos / Llegando (3 amount + 1 count, mira al pasado) | **Este mes / Próximos 30 días / Atrasado (condicional → Tiendas activas si =0) / Llega esta semana**. 3 amounts + 1 count, todo accionable y futuro.                             | **Cambio fuerte.** Reemplazar 3 de 4 slots y renombrar. | Media-alta (7/10) |
| **B. Paginación**            | Sentinel infinito mobile + paginación clásica desktop, `pageSize 30`        | Cambiar mobile a **"Load more" explícito**. Mantener desktop clásico `pageSize 30`. Sub-recomendación: `pageSize 20 mobile`. Reservar virtualización para 500+ pedidos en S5+.   | **Cambio medio** en mobile (sentinel → botón).          | Alta (8/10)       |
| **C. Sort + filtros**        | Sort default "Más recientes"; filtros NO persisten cross-session, sí en URL | Mantener. Reservar arquitectura para "vistas guardadas" en S4+. Verificar anti-flicker de filtros al volver con back.                                                            | **Sin cambio mayor.**                                   | Alta (8/10)       |
| **D. Swipe actions**         | Izquierda = Anotar pago (verde) / Derecha = Ver tienda (teal)               | Mantener direcciones. **Cambiar color de swipe izquierda a `--accent` indigo** (no verde — verde implica terminal). Confirmar copy "Anotar pago" exacto. Haptic diferenciado.    | **Cambio menor** (color del swipe izquierda).           | Media (6/10)      |
| **E. Densidad toggle**       | Densa default + cómoda opt-in en `localStorage`                             | Mantener default y `localStorage`. **Añadir toggle reflejado en `/settings → preferences`** (Opción C, igual que theme toggle). Plan de migración a `preferences` schema en S3+. | **Cambio menor** (añadir reflejo en settings).          | Alta (8/10)       |

### Decisiones que requieren input humano antes de S3

1. **Confirmar las 4 micro-stats** — la propuesta cambia 3 de 4 slots. Validar con producto si "Este mes / 30 días / Atrasado / Llega esta semana" matchea modelo mental del coleccionista 18–25.
2. **Confirmar cambio mobile a "Load more" botón** — implica refactor del componente de lista pero resuelve scroll restoration cleanly.
3. **Confirmar color swipe izquierda indigo vs verde** — riesgo de ambigüedad terminal/no-terminal real, vale prototipo.
4. **Confirmar añadir toggle de densidad en settings** — afecta scope de S5 (settings).

### Sources

- [Pagination vs. infinite scroll: Making the right decision for UX — LogRocket](https://blog.logrocket.com/ux-design/pagination-vs-infinite-scroll-ux/)
- [Infinite Scrolling: When to Use It — NN/g](https://www.nngroup.com/articles/infinite-scrolling-tips/)
- [Retain scroll position in infinite scroll — Artsy Engineering](https://artsy.github.io/blog/2014/07/09/retain-scroll-position-in-infinite-scroll/)
- [Infinite Scroll v3 un-breaks the back button — Metafizzy blog](https://metafizzy.co/blog/infinite-scroll-unbreaks-back-button/)
- [Linear Filters docs](https://linear.app/docs/filters)
- [Linear Custom Views docs](https://linear.app/docs/custom-views)
- [Linear Display Options docs](https://linear.app/docs/display-options)
- [Stripe API Pagination](https://docs.stripe.com/api/pagination)
- [GitHub community — Saved Filters discussion](https://github.com/orgs/community/discussions/47220)
- [Apple Mail swipe options — iPhoneLife](https://www.iphonelife.com/blog/5/tip-day-change-mail-swipe-options-settings)
- [Things 3 Gestures — Cultured Code support](https://culturedcode.com/things/support/articles/2803582/)
- [Cloudscape Design System — Density settings](https://cloudscape.design/patterns/general/density-settings/)
- [Material React Table — Density Toggle Guide](https://www.material-react-table.com/docs/guides/density-toggle)
- [Day One with YNAB — Ready to Assign](https://www.ynab.com/blog/day-one-with-ynab-how-to-set-up-your-budget)
- [Next.js View Transitions docs](https://nextjs.org/docs/app/guides/view-transitions)
- [Next.js Linking and Navigating (scroll behavior)](https://nextjs.org/docs/app/getting-started/linking-and-navigating)
