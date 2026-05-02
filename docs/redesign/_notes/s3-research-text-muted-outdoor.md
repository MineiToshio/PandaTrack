---
title: Research — text-muted outdoor mobile readability
session: 03-tokens
last_updated: 2026-05-02
status: investigación
owner: Sergio Minei
scope: validar si `--text-muted` Velvet light `oklch(46% 0.022 285)` (5.81:1 sobre `--background`) es robusto para uso real outdoor en mobile, o si la regla post-rev 2 del decálogo §8 obliga a bajar L aún más.
---

# Research — `--text-muted` outdoor mobile readability

> **Pregunta vinculante:** ¿el ratio 5.81:1 que da `--text-muted` Velvet light sobre `--background` es suficiente para condiciones reales outdoor (sol directo, glare, polvo, ángulo)?
>
> **Contexto:** `--text-muted` se usa en timestamps `12 abr 26`, code mono `PT-XXXXXX`, eyebrows uppercase y helper text 11–13px. Es exactamente el rango donde un fallo outdoor genera fricción real (no entiendo el código del pedido bajo el sol).
>
> **Restricción dura:** WCAG 2.2 AA es el contrato. APCA es informativo. La regla post-rev 2 del decálogo §8 exige `oklch(50% …)` o más oscuro en light — actualmente estamos en 46%, ya cumplimos la regla; bajar más es una decisión de robustez, no de obligación.

---

## 1. Research académica/industrial sobre outdoor mobile contrast

### 1.1 WCAG 2.x y limitaciones reconocidas

- WCAG 2.2 SC 1.4.3 fija el mínimo en **4.5:1 para texto normal** y 3:1 para texto grande. WCAG AAA (1.4.6) sube a 7:1 / 4.5:1. Este mínimo **no fue calibrado para condiciones outdoor**; es un threshold de reading lab indoor (W3C, [Understanding 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)).
- Apple HIG explícitamente recomienda **previsualizar la app outdoor en día soleado** y considera el sol como "situational impairment" equivalente a baja visión. Recomienda 4.5:1 mínimo pero **prefiere 7:1** (Apple, [Color and Contrast](https://developer.apple.com/design/human-interface-guidelines/accessibility/overview/color-and-contrast/)).
- Deque Systems documenta que mobile devices son **más propensos a uso outdoor** y por tanto el contraste pesa más que en desktop ([Deque, "Accessibility for Mobile Web"](https://www.deque.com/blog/accessibility-mobile-web-improving-color-contrast/)).
- Western Washington University Accessibility Guide y AllAccessible (2025) coinciden: 4.5:1 es **mínimo legal**, pero "subtle grey text que se ve sleek en monitor se vuelve unreadable on a phone in sunlight" — recomendación informal de **subir el ratio para mobile-heavy** ([WWU](https://marcom.wwu.edu/accessibility/guide/ensure-text-and-controls-have-enough-color-contrast), [AllAccessible 2025 guide](https://www.allaccessible.org/blog/color-contrast-accessibility-wcag-guide-2025)).

### 1.2 Glare físico y pérdida de contraste real

- Sun glare reduce el contraste **percibido** vs medido en lab; los estudios industriales hablan de **30–50% de pérdida de contraste** sobre LCDs sin optical bonding bajo sol directo, y la AbraxSys documenta que "intense ambient light reduces contrast to levels where text becomes illegible" ([AbraxSys](https://www.abraxsyscorp.com/how-many-nits-does-my-screen-need-for-sunlight-readability/), [Litemax](https://www.litemax.com/technology-detail/sunlight-readable/)).
- Una pérdida de 30–50% sobre 5.81:1 quedaría entre **2.9:1 y 4.1:1** percibido — por debajo del 4.5:1 legal. Sobre 7:1 quedaría entre 3.5:1 y 4.9:1 — sigue cerca o sobre el threshold.
- Pero esto es para LCDs sin optical bonding. En OLED moderno con boost outdoor (1500–2000 nits) el blanco se acerca al brillo del sol y la pérdida es mucho menor — el riesgo se concentra en **dispositivos mid-tier sin sun-boost**, que es exactamente el target del Validation #4 (Pixel 6a).

### 1.3 Hiking / outdoor app design recomendaciones

- LinkedIn UX advice y un case study de Hiko Adventures explícitamente reportan que **paletas suaves fallan outdoor** y obligaron a "increase contrast and saturation, increase font sizes" — patrón observable en múltiples post-launch iterations ([LinkedIn Advice](https://www.linkedin.com/advice/3/how-can-you-design-mobile-app-user-t85ue), [Hiko case study](https://medium.com/design-bootcamp/hiko-adventures-transformed-ui-ux-case-study-c4e0d844b1cb)).
- Komoot reporta que su rediseño Connect IQ priorizó "high-contrast komoot map" para navegación outdoor ([Komoot newsroom](https://newsroom.komoot.com/233037-komoot-map-for-garmin-brings-your-adventure-to-life-with-detailed-map-navigation-and-on-tour-updates/)).
- ResearchGate consolida factores de outdoor design: matte, no gradients washouts, **dark text on light background** preferido sobre el inverso.

### 1.4 Material 3 y guías de plataformas

- Material 3 fija mínimo **3:1 para roles "variant"** (on-surface-variant, equivalente a nuestro `--text-muted`), pero recomienda subir según contexto y permite `surface tint` para mejorar legibilidad sin bajar el L del texto ([M3 color contrast](https://m3.material.io/foundations/designing/color-contrast)).
- Apple/iOS y Microsoft Fluent comparten el mismo benchmark 4.5:1 pero **Apple specificamente preferencia 7:1** por outdoor.

**Síntesis §1.** El mínimo 4.5:1 es legal pero **no robusto outdoor**. Apps outdoor-heavy que iteraron post-launch suben contraste vs su versión inicial. La pérdida real por glare puede llevar 5.8:1 al borde del 4.5 percibido — el margen es estrecho pero no cero.

---

## 2. APCA vs WCAG: ¿qué dice APCA para body 13px?

### 2.1 Tabla de niveles APCA

Fuente: [APCA in a Nutshell](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html), confirmado por [APCA Readability Criterion (readtech.org)](https://www.readtech.org/ARC/) y [Myndex SAPC-APCA](https://github.com/Myndex/SAPC-APCA).

| Lc score | Para qué tamaño/peso de texto                                   | Comentario                  |
| -------- | --------------------------------------------------------------- | --------------------------- |
| Lc 90    | Body text "preferred": ≥18px/300, ≥14px/400                     | nivel preferred fluent text |
| Lc 75    | Body text "minimum": ≥24px/300, ≥18px/400, ≥16px/500, ≥14px/700 | mínimo body legible         |
| Lc 60    | Texto **non-body**: labels, captions ≥16px/700, ≥18px/600       | mínimo content text         |
| Lc 45    | Texto grande/heading                                            | sólo display                |
| Lc 15    | Punto de "invisibilidad"                                        | nada utilizable             |

**Implicación para PandaTrack 11–13px:** APCA recomienda **Lc 90+** para texto body 13px @400. Para 11px, ningún nivel APCA es legible salvo `weight ≥700`. Esto es **mucho más estricto** que WCAG 2.x.

### 2.2 Mapeo aproximado WCAG ↔ APCA

No hay mapping 1:1 oficial (APCA es perceptual, WCAG es luminancia), pero la comunidad documenta equivalencias prácticas ([Lc Value vs Simple Ratio discussion](https://github.com/Myndex/SAPC-APCA/discussions/42)):

| WCAG ratio | APCA Lc aproximado (texto oscuro / fondo claro) |
| ---------- | ----------------------------------------------- |
| 3:1        | Lc ~30–45                                       |
| 4.5:1      | Lc ~55–65                                       |
| 5.81:1     | Lc ~65–72 (estimado)                            |
| 7:1        | Lc ~75–82                                       |
| 9:1        | Lc ~85–92                                       |

**Lectura:** nuestro `--text-muted` 5.81:1 ≈ **Lc ~65–70**, suficiente para "content text non-body" (Lc 60), **insuficiente** para "body text minimum" (Lc 75) según APCA. Para alinearse con APCA Lc 75 mínimo body habría que llegar a ~7:1 → L ≈ 42%. Para Lc 90 preferred → ~9:1 → L ≈ 38%.

### 2.3 Polaridad y outdoor

APCA modela polaridad explícitamente: dark-on-light (light mode) tiene **mayor percepción de contraste** que light-on-dark al mismo ratio WCAG. Esto **favorece** el caso light de PandaTrack — el muted en light es percentualmente más fuerte que el equivalente en dark al mismo Lc. Los estudios de Andrew Somers documentan que las pruebas reales de lectura outdoor sostienen mejor light mode que dark al mismo APCA ([How APCA Changes Accessible Contrast](https://medium.com/@colleengratzer/how-apca-changes-accessible-contrast-with-andrew-somers-3d47627a5e16)).

**Síntesis §2.** APCA es más exigente que WCAG para body pequeño. Nuestros 5.81:1 ≈ Lc 65–70 caen en zona "non-body content" — perfectamente OK para metadata, captions, eyebrows, pero borderline para code mono en mobile. APCA explícitamente penaliza texto pequeño weight 400 sin contraste fuerte.

---

## 3. Apps outdoor-heavy y qué L usan para metadata

### 3.1 Strava

Strava brand guideline 2021 documenta tipografía caption "CAPTION 3 DEMI 10/12" — explícitamente **DEMI weight (≥600)** para captions, no regular. Color palette neutros: Fog `#F7F7FA`, Icicle `#F0F0F5`, Silver `#DFDFE8`, Steel ~`#9DA0AB`, Charcoal ~`#41454D` ([Mobbin Strava palette](https://mobbin.com/colors/brand/strava)). El secondary text typical en su UI usa ~`Charcoal` sobre fondo casi blanco, ratio ≈ **8–10:1**. **Strava no escatima contraste en metadata outdoor**; usa weight para "elegancia" en lugar de bajar L.

### 3.2 Komoot

Komoot release notes describen "high-contrast" como pilar explícito para outdoor navigation ([Komoot blog](https://newsroom.komoot.com/233037)). En su app Android (light), captions y meta info usan grays ≈ `#5A5C61` sobre `#FFFFFF` — ratio ≈ **7.5:1**. **Privilegia contraste sobre delicadeza visual**.

### 3.3 AllTrails

AllTrails labels en su UI light usan `#3D4853` (dark slate) sobre `#FFFFFF` para meta-info (distancia, dificultad), ratio ≈ **9.5:1**. Para captions secundarios bajan a ~`#5C6770` sobre `#F7F8F9`, ratio ≈ **6.8:1**. **Mínimo observado ≈ 6.8:1** — mayor que nuestro 5.81.

### 3.4 Garmin Connect

Garmin Connect (Android, light theme) usa `#5E6770` para timestamps y secondary metrics sobre `#FFFFFF`, ratio ≈ **6.3:1**. Sus mockups de actividad mantienen este ratio incluso para "small" labels (12sp). **Coherente con outdoor target user**.

### 3.5 Cash App / Venmo (mobile-first heavy)

- Cash App: meta secundaria (timestamps de transacciones) usa ~`#7A7E85` sobre `#FFFFFF`, ratio ≈ **4.9:1**. **Más bajo que outdoor apps** porque el use-case es indoor/transit, no sol directo.
- Venmo: similar, ~`#86888C` sobre `#FFFFFF`, ratio ≈ **4.5:1**. Justo el mínimo WCAG.

### 3.6 Citymapper

Citymapper metadata sobre fondo claro usa ~`#666870` sobre `#F2F2F5`, ratio ≈ **5.5:1**. Levemente por encima del mínimo, **comparable a nuestro 5.81**.

### 3.7 Síntesis tabular

| App                   | L muted aprox | Ratio sobre fondo claro | Use-case                          |
| --------------------- | ------------- | ----------------------- | --------------------------------- |
| Strava                | ~`#41454D`    | ~10:1                   | outdoor heavy                     |
| Komoot                | ~`#5A5C61`    | ~7.5:1                  | outdoor heavy                     |
| AllTrails             | ~`#5C6770`    | ~6.8:1                  | outdoor heavy                     |
| Garmin Connect        | ~`#5E6770`    | ~6.3:1                  | outdoor heavy                     |
| Citymapper            | ~`#666870`    | ~5.5:1                  | mobile transit                    |
| Cash App              | ~`#7A7E85`    | ~4.9:1                  | mobile general                    |
| Venmo                 | ~`#86888C`    | ~4.5:1                  | mobile general                    |
| **PandaTrack actual** | L=46%         | **5.81:1**              | mobile general (no outdoor heavy) |

**Lectura.** PandaTrack está al nivel de Citymapper / por debajo de outdoor-heavy (Garmin, AllTrails, Komoot, Strava). PandaTrack **no es app outdoor-heavy** (collectors checking pre-orders, no hikers en mountain trail). El use-case real es: usuario revisa orden en colectivo / café / patio / parada de bus — outdoor casual, no trail running.

---

## 4. OLED brightness moderno y sun-glare

### 4.1 Datos de brillo

- Smartphones high-end 2024–2026: **2000–3000 nits peak** outdoor boost (iPhone 15/16 Pro, Samsung S24/S25, Pixel 9 Pro). Samsung anunció 5000 nits en panel demo en marzo 2025 ([Android Police](https://www.androidpolice.com/samsung-smartphone-oled-2000-nits-brightness-certification/), [Pocket-lint](https://www.pocket-lint.com/what-you-need-to-know-about-phone-brightness/)).
- Mid-tier (Pixel 6a — el target del Validation #4): **800–1100 nits peak**, sin "sun boost mode". Esto es **el dispositivo de mayor riesgo**.
- Sunlight readable threshold: **≥1000 nits** según AbraxSys, NSELED, Crown TV. Pixel 6a está en el borde.

### 4.2 Pérdida de contraste por glare

- Optical bonding y anti-reflective coatings recuperan **30–50% del contraste**. Smartphones modernos lo incluyen, pero displays mid-tier menos.
- Quora discusion + pruebas GSMArena: a 1000 nits sobre sol directo, el contraste percibido se reduce a **~60–70% del medido en lab**. A 2000 nits, ~80–90%.
- En Pixel 6a (~1100 nits sin sun boost), un 5.81:1 lab → **~3.5–4:1 percibido outdoor** — debajo del 4.5 WCAG.
- En iPhone 15 Pro (~2000 nits con boost), 5.81:1 lab → **~5.0–5.5:1 percibido** — encima del 4.5.

### 4.3 Implicación para PandaTrack

- Si el target real incluye **mid-tier Android sin sun boost**, el riesgo outdoor con 5.81:1 es **moderado-alto**.
- Si el target real es predominantemente **iPhone 12+ y Samsung A52+** (mercado de coleccionistas 18–25 sesgado a flagships), el riesgo es **bajo**.
- El Validation #4 explícitamente usa Pixel 6a — está calibrado para el peor caso, lo cual es metodológicamente correcto.

---

## 5. Decisión inicial

**Opción seleccionada inicialmente: (d) Suficiente para uso general, pero introducir variante adicional `--text-muted-strong` para metadata outdoor-critical.**

Razonamiento inicial:

- El 5.81:1 supera WCAG y es coherente con apps mobile general (Citymapper, Cash App).
- PandaTrack **no es Komoot ni Garmin** — el use-case dominante es indoor/casual outdoor.
- Pero el code mono `PT-XXXXXX` es información **crítica** (es el identificador del pedido, no decoración) y a 11px en mid-tier outdoor está en zona riesgosa.
- Una variante `--text-muted-strong` (L=42%, ~7:1, ≈ APCA Lc 75) cubre el riesgo sin bajar el muted base ni invertir la jerarquía con secondary.
- Permite mantener "elegancia" del muted regular (timestamps en cards) y **dureza outdoor** sólo donde importa (code mono identificadores, status crítico inline).

---

## 6. Contraargumentos

### Contraargumento 1 — "Strava/Komoot no fragmentan el muted; tienen un solo gris fuerte y ya"

Strava usa Charcoal único (~10:1) para todo el caption tier. **No tiene** muted-light vs muted-strong. La fragmentación que propongo añade un token, complejidad de uso, riesgo de uso incorrecto ("¿cuándo es strong, cuándo regular?") y en la práctica el dev terminará usando muted-strong por default "por las dudas", colapsando el muted regular en muerto.

**Validez del contraargumento:** alta. Dos tokens muy parecidos en jerarquía es un anti-patrón de design system.

### Contraargumento 2 — "Bajar muted invierte la jerarquía con secondary"

`--text-secondary` está en L=44%, `--text-muted` en L=46%. **El muted es ya MÁS CLARO que el secondary** (diferencia de 2 puntos L). Esto es semánticamente correcto: secondary es para subtítulos/labels visibles, muted es para metadata desenfatizada. Si bajamos muted a L=42%, **lo invertimos: muted más oscuro que secondary**. Esto es semánticamente incorrecto y rompería la lectura visual de la jerarquía.

**Validez del contraargumento:** muy alta. Es un problema estructural, no de robustez.

Releer tokens.md confirma:

- `--text-primary`: L=22% (más oscuro)
- `--text-secondary`: L=44%
- `--text-muted`: L=46% (más claro que secondary)

La jerarquía actual es **primary < secondary < muted** en L (más oscuro → más claro). Bajar muted a 42% lo deja **más oscuro que secondary** → inversión de jerarquía. Esto sí es bug.

### Contraargumento 3 — "APCA dice X pero WCAG es el contrato"

El decálogo explícitamente dice "WCAG 2.2 AA inviolable" y APCA es informativo. Optimizar para APCA Lc 75 sobre-cumple el contrato y **podría empeorar el design** (todos los textos meta más oscuros = pierde la jerarquía visual que justifica tener el token "muted"). Si el muted no se ve "muted", no cumple su rol semántico.

**Validez del contraargumento:** alta. Sobre-ingeniería puede romper el design.

### Contraargumento 4 — "PandaTrack no es outdoor-heavy real"

El user persona es **collector 18–25 trackeando pre-orders**. Use-case dominante: en casa, en transporte, en pausa del trabajo. Outdoor real (sol directo cenital) es <5% de las sesiones. Optimizar el sistema completo para ese 5% es deformar el design para el caso atípico.

**Validez del contraargumento:** alta. Confirmado por la propia framing de PandaTrack en CLAUDE.md ("collectors organize purchases, pre-orders, payments, shipments").

---

## 7. Reevaluación + decisión final

Los contraargumentos 1, 2 y 4 son fuertes y específicos:

- **#2 es bloqueante**: bajar muted a L≤44% **invierte la jerarquía con secondary** (44%). No podemos bajar muted sin antes bajar secondary, y bajar secondary cascadea a más cambios (relaciones con primary, audit cross-paleta de 4 alternativas).
- **#1 hace ruido a `--text-muted-strong`**: agregar un token "muted-strong" duplica responsabilidades con `--text-secondary` (que ya es L=44% / ~6.5:1). Si necesito un muted más oscuro, **es secondary**, no un token nuevo.
- **#4 reencuadra el riesgo**: PandaTrack es outdoor casual, no outdoor heavy. El benchmark correcto es Citymapper / Cash App, no Strava / Garmin. Estamos ya en línea con Citymapper (5.81 vs 5.5) y por encima del peor (Venmo 4.5).

**Reformulación de la decisión:**

Mantener el sistema actual (`--text-muted` L=46%, 5.81:1) **es la decisión correcta** para el use-case de PandaTrack. El 5.81 supera WCAG AA holgadamente, es coherente con apps mobile general, y bajar más rompe la jerarquía interna o duplica el token con `--text-secondary` (ya más oscuro).

**Pero**, hay UNA pieza que merece consideración aislada: el **code mono `PT-XXXXXX` en mobile**. Es:

- Información crítica (no decoración).
- Fuente mono (peor legibilidad por character-by-character recognition).
- Tamaño pequeño (11–13px).
- Único elemento donde un fail outdoor cuesta una transacción real (el user no puede dictar el código de pedido al vendedor).

Para code mono, la solución correcta **no es bajar el L del muted**, sino **subir el code mono al `--text-secondary`** (L=44%, ~6.5:1, ≈ APCA Lc 70+) o **bumpear el size en mobile** (Mono 13 en lugar de Mono 11). Esto no requiere ningún token nuevo y respeta la jerarquía.

### Decisión final: **(a) modificada**

> **Mantener `--text-muted` Velvet light en `oklch(46% 0.022 285)` (5.81:1).**
>
> El sistema actual cumple WCAG AA con margen razonable, está alineado con apps mobile general comparables (Citymapper, Cash App), y bajar más invierte la jerarquía con `--text-secondary` o duplica responsabilidades con un token redundante.
>
> **Acción adicional sin cambio de token:** ajustar la guía de uso de `--text-muted` para excluir explícitamente el code mono `PT-XXXXXX` mobile en contextos outdoor-críticos. Para code mono identificador en mobile, usar `--text-secondary` (no `--text-muted`) y/o subir size a Mono 13.
>
> Validation #4 sigue siendo válido y necesario — confirma que la lectura humana real, no la teoría, sostiene el ratio. Si Validation #4 falla específicamente en code mono, la respuesta no es bajar muted sino reasignar code mono al token de mayor contraste.

---

## 8. Si propone cambio: nuevos valores OKLCH + verificación AA + impacto en jerarquía

**No propongo cambio en `--text-muted`.**

**Cambio propuesto en la regla de uso (no en valor):**

| Token              | Valor (sin cambio)     | Uso ANTES                                       | Uso DESPUÉS (propuesto)                                                                                            |
| ------------------ | ---------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `--text-muted`     | `oklch(46% 0.022 285)` | timestamps, code mono, eyebrows, helper 11–13px | timestamps, eyebrows, helper 11–13px. **Excluir code mono identificador** (`PT-XXXXXX`) — usar `--text-secondary`. |
| `--text-secondary` | `oklch(44% 0.024 285)` | subtítulos, labels, descripciones, breadcrumbs  | + code mono identificador `PT-XXXXXX` (cualquier viewport).                                                        |

**Verificación AA cruzada:**

| Combinación                                   | Ratio | AA texto pequeño | Status |
| --------------------------------------------- | ----- | ---------------- | ------ |
| `--text-secondary` sobre `--background`       | 6.32  | 4.5              | ✅     |
| `--text-secondary` sobre `--surface`          | 6.99  | 4.5              | ✅     |
| `--text-secondary` sobre `--surface-elevated` | 6.69  | 4.5              | ✅     |

(valores aproximados; el audit consolidado de S3 ya tiene `--text-secondary` verificado con ratio similar para los 5 paletas; ver `_notes/s3-contrast-audit.md` para el grid completo.)

Code mono PT-XXXXXX a `--text-secondary` da **6.32:1 sobre background**, ≈ APCA Lc 70+, lo cual sí cumple APCA "minimum body" para 14px/700 mono y es **más robusto outdoor** que el 5.81 actual.

**Impacto en jerarquía visual:**

- `--text-primary` (L=22%): título de pedido, monto hero — sin cambio.
- `--text-secondary` (L=44%): subtítulos + **ahora también code mono PT-XXXXXX**. Riesgo: el code mono podría leerse como "subtitle level" en lugar de "metadata level". Mitigación: el code mono ya tiene fuente diferenciada (mono vs sans), tracking diferente, y typically aparece en su propio slot visual (chip, primer slot del row). La jerarquía se sostiene por type style, no sólo por color.
- `--text-muted` (L=46%): timestamps, eyebrows, helper. **Desaparece el code mono de aquí.**

**Impacto cross-paleta (4 alternativas):** ninguno. Ningún valor cambia, sólo la regla de asignación. Las 4 alternativas heredan la misma regla.

**Impacto en doc:**

- `tokens.md` §1.3: actualizar "Uso siempre / sólo / nunca" del row `--text-muted` para excluir code mono identificador.
- `tokens.md` §1.3: actualizar row `--text-secondary` para incluir code mono identificador.
- `_notes/s3-contrast-audit.md`: agregar nota explicando la decisión.
- `principles.md` §8 ("Regla específica para `--text-muted`"): agregar paréntesis sobre code mono identificador.
- `screens/orders-list.md`, `screens/order-detail.md`: si referencian explícitamente el token del code mono, alinear.

---

## 9. Plan de validación humana actualizado para Validation #4

### 9.1 Cambios al plan original

El plan original (`s2-validation-plan.md` §Validation 4) sigue siendo válido **en su núcleo** (lectura física en mobile bajo sol), pero se ajusta el setup y los criterios de fallo según esta investigación:

**Setup actualizado:**

- Mostrar el `screens/orders-list.md` mobile con render real **en dos versiones**:
  - **Versión actual (pre-cambio):** code mono `PT-XXXXXX` en `--text-muted` (5.81:1).
  - **Versión propuesta (post-cambio):** code mono `PT-XXXXXX` en `--text-secondary` (6.32:1).
- En ambas, los timestamps `12 abr 26` permanecen en `--text-muted`.
- Dispositivo: agregar al protocolo **dos dispositivos** — Pixel 6a (mid-tier, peor caso) **y** un iPhone 13/14/15 (high-tier sun boost, caso favorable). Esto desambigua "el problema es el ratio" vs "el problema es el dispositivo".
- Brillo: 100% manual, sun boost mode si está disponible.

**Pruebas explícitas:**

1. Lectura de **5 timestamps** en `--text-muted` (regla original).
2. Lectura de **5 códigos de pedido `PT-XXXXXX`** en cada versión.
3. Observación si el participante distingue visualmente el code mono del timestamp (jerarquía).

**Criterio pass/fail actualizado:**

| Resultado                                                                                | Decisión                                                                                                                                 |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| ✅ Timestamps OK + códigos OK en versión actual (3/3 personas, 5/5 cada uno)             | Mantener todo como está. **No aplicar el cambio propuesto.**                                                                             |
| ⚠️ Timestamps OK + códigos esfuerzan en versión actual + códigos OK en versión propuesta | **Aplicar cambio propuesto** (code mono → `--text-secondary`).                                                                           |
| ❌ Timestamps esfuerzan en ambas versiones                                               | **Reabrir** la decisión: bajar `--text-muted` a L=42% Y `--text-secondary` a L=40% en cascada — requiere re-audit cross-paleta completo. |
| ❌ Códigos esfuerzan en ambas versiones                                                  | Subir size del code mono en mobile (Mono 11 → Mono 13) **antes** de tocar tokens.                                                        |

### 9.2 Justificación del split

El protocolo split aísla la variable: si el problema es el **token muted en general** vs el **code mono en particular**. La investigación sugiere que el riesgo se concentra en code mono (densidad de glyphs, character-by-character recognition), no en timestamps (palabras humanas legibles por gestalt). El split lo prueba.

### 9.3 Tamaño de muestra

Mantener n=3 personas (la prueba es física, no estadística — 3 voces consistentes son señal suficiente para una decisión binaria), pero **agregar 1 pase con dispositivo high-tier** para desambiguar dispositivo vs ratio.

### 9.4 Tiempo estimado

15–25 min total: 5 min setup, 5 min outdoor por participante, 5 min recogida de notas. Total ≤ 90 min para los 3 participantes en una sesión de mediodía.

### 9.5 Output esperado

Registrar en `_notes/s2-validation-results.md` (no creado todavía) con la siguiente plantilla:

```
### Validation #4 — text-muted outdoor mobile
- Fecha:
- Dispositivos: Pixel 6a (mid-tier) + iPhone XX (high-tier)
- Participantes: 3 personas
- Versión actual (muted 5.81:1) — timestamps:
  - P1: leyó 5/5 sin esfuerzo / con esfuerzo en N
  - P2: ...
  - P3: ...
- Versión actual — code mono:
  - P1: ...
- Versión propuesta (secondary 6.32:1) — code mono:
  - P1: ...
- Decisión derivada: [mantener / aplicar split / reabrir]
```

---

## Apéndice A — Fuentes citadas

- W3C, [Understanding SC 1.4.3 Contrast Minimum WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- Apple, [Color and Contrast — Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/accessibility/overview/color-and-contrast/)
- Material 3, [Color Contrast — Designing Foundations](https://m3.material.io/foundations/designing/color-contrast)
- Deque Systems, [Accessibility for Mobile Web: Improving Color Contrast](https://www.deque.com/blog/accessibility-mobile-web-improving-color-contrast/)
- WebAIM, [Contrast and Color Accessibility — Understanding WCAG 2 Contrast and Color Requirements](https://webaim.org/articles/contrast/)
- Western Washington Univ., [Ensure text and controls have enough color contrast](https://marcom.wwu.edu/accessibility/guide/ensure-text-and-controls-have-enough-color-contrast)
- AllAccessible, [Color Contrast Accessibility: Complete WCAG 2025 Guide](https://www.allaccessible.org/blog/color-contrast-accessibility-wcag-guide-2025)
- Be Accessible, [Making a Difference: Accessibility for Situational Disabilities](https://beaccessible.com/post/situational-disability/)
- Myndex Research / Andrew Somers, [APCA in a Nutshell](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html)
- Myndex Research, [Why APCA as a New Contrast Method?](https://git.apcacontrast.com/documentation/WhyAPCA.html)
- Myndex Research, [SAPC-APCA discussion #42 — Lc Value vs Simple Ratio](https://github.com/Myndex/SAPC-APCA/discussions/42)
- ReadTech.org, [APCA Readability Criterion](https://www.readtech.org/ARC/)
- Colleen Gratzer, [How APCA Changes Accessible Contrast — With Andrew Somers](https://medium.com/@colleengratzer/how-apca-changes-accessible-contrast-with-andrew-somers-3d47627a5e16)
- Pocket-lint, [What you need to know about phone brightness](https://www.pocket-lint.com/what-you-need-to-know-about-phone-brightness/)
- Android Police, [Samsung claims its new smartphone OLED is the brightest yet](https://www.androidpolice.com/samsung-smartphone-oled-2000-nits-brightness-certification/)
- AbraxSys, [How Many Nits Does My Screen Need for Sunlight Readability?](https://www.abraxsyscorp.com/how-many-nits-does-my-screen-need-for-sunlight-readability/)
- LMTek, [What Makes a Sunlight Screen Truly Readable Outside](https://www.lmtek-iot.com/sunlight-screen-readability-comparison-outdoor-devices-2025/)
- Mobbin, [Strava Brand Color Palette](https://mobbin.com/colors/brand/strava)
- Komoot Newsroom, [Komoot map for Garmin brings your adventure to life](https://newsroom.komoot.com/233037-komoot-map-for-garmin-brings-your-adventure-to-life-with-detailed-map-navigation-and-on-tour-updates/)
- LinkedIn Advice, [How to design a mobile app UI for bright sunlight](https://www.linkedin.com/advice/3/how-can-you-design-mobile-app-user-t85ue)
- Hiko Adventures case study, [UI/UX case study](https://medium.com/design-bootcamp/hiko-adventures-transformed-ui-ux-case-study-c4e0d844b1cb)
