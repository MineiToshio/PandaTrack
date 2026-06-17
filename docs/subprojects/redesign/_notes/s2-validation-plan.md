---
title: S2 — Plan de validación (5 pruebas)
session: 02
last_updated: 2026-05-01
status: ready-for-human-execution
---

# S2 — Plan de las 5 validaciones requeridas antes de S3

Las cinco validaciones declaradas en [`direction-chosen.md`](../direction-chosen.md) cierran ~0.15 del 0.33 restante del score 4.67/5. Este plan documenta **qué se prueba, cómo se mide, qué pasa si falla y quién lo ejecuta**. Las pruebas las corre el humano (no el agente).

> **Resultados se registran en** `_notes/s2-validation-results.md` (no creado todavía — el humano lo crea al terminar). El agente no debe rellenar ese archivo con datos sintéticos.

---

## Validación 1 — Test de 5 segundos del hero del Dashboard

**Qué se prueba.** Si la primera impresión del Dashboard comunica el propósito de la app sin necesitar explicación. Es la prueba más barata para confirmar que Bento Atelier no se siente "una app de productividad genérica" sino "tracking de pagos/colección".

**Insumo.** Mock estático del **hero + próximo pago + 4 micro-stats** del Dashboard tomados del wireframe `screens/dashboard.md` §3 (desktop) y §2 (mobile). Para esta validación basta un mock visual de baja fidelidad (incluso ASCII renderizado a imagen) — lo importante es que se vean: el monto hero, el progress bar gradient indigo→coral, el avatar de tienda neutro, los chips de estado y la mascota idle bubble (si aplica al viewport mostrado).

**Quién lo ejecuta.** Humano (Sergio o quien delegue). Reclutar **8 collectors 18–25** (idealmente activos en TCG/manga/vinyl/figures), 4 mostrando el mock mobile, 4 el desktop.

**Cómo se mide.**
- Mostrar el mock 5 segundos exactos.
- Cerrar el mock.
- Pregunta abierta: _"¿Qué hace esta app?"_.
- Codificar la respuesta en una de tres categorías: (a) "tracking de pagos / colección / pre-órdenes / coleccionables", (b) "una app de finanzas / gastos / presupuesto", (c) "no sé / otra cosa".

**Criterio pass/fail.**
- ✅ **Pasa** si ≥6 de 8 (75%) caen en (a). El brief original pedía ≥70%; subimos el listón porque la muestra es chica.
- ⚠️ **Pasa con reserva** si 5 de 8 caen en (a). Anotar las palabras exactas y revisar el copy del eyebrow `dashboard.hero.eyebrow` ("TUS PRE-ÓRDENES").
- ❌ **Falla** si <5 de 8 caen en (a).

**Qué pasa si falla.**
- Revisar el eyebrow: ¿"TUS PRE-ÓRDENES" comunica algo a quien no conoce el producto? Probar variantes ("Tu colección en camino", "Lo que esperas", etc.).
- Revisar la jerarquía visual: si el monto hero domina demasiado, el usuario puede leer "app financiera". Reducir contraste del Display 56 vs el chrome categorical.
- Si <3 de 8 entienden, considerar añadir un sub-eyebrow temporal ("Tracker para coleccionables") sólo en onboarding.

---

## Validación 2 — Comparativa lado a lado con Linear

**Qué se prueba.** Si la diferenciación visual de Atelier vs Linear (la app más cercana en DNA) es perceptible para alguien no-diseñador. Esta es la prueba que justifica el riesgo de mantenernos en estética sereno-densa en lugar de saltar a algo más extremo.

**Insumo.** Mock del **dashboard de Atelier** (mismo del Validation 1) abierto al lado de [`linear.app`](https://linear.app) en su dashboard inicial (My Issues / Active). Resolución desktop ≥1280px. Tema dark en ambos (Linear default).

**Quién lo ejecuta.** Humano. Reclutar 6 personas (mezcla de collectors y no-collectors, edad 22–32 — un rango más amplio para detectar reacción genérica).

**Cómo se mide.**
- Mostrar las dos pantallas lado a lado durante 15 segundos.
- Pregunta abierta: _"¿Qué notas de estas dos apps? ¿Se parecen, son distintas, en qué?"_.
- Codificar la respuesta dominante en: (a) "se parecen mucho / casi idénticas", (b) "son del mismo estilo pero distintas (DNA común)", (c) "son muy distintas".

**Criterio pass/fail.**
- ✅ **Pasa** si la respuesta dominante NO es (a). Si (b) o (c) son la mayoría, se considera diferenciación suficiente — el DNA Linear está en el ADN del rediseño por decisión consciente.
- ⚠️ **Pasa con reserva** si la respuesta dominante es (a) pero los participantes nombran **al menos un elemento diferenciador concreto** sin pedírselo (mascota, gradient indigo→coral, eyebrow editorial, etc.).
- ❌ **Falla** si la respuesta dominante es (a) y nadie nombra elemento diferenciador.

**Qué pasa si falla.**
- Subir la presencia de la mascota (mover bubble idle a posición más visible, agregar walking strip preview).
- Aumentar la calidez del hero: subir saturación del coral del gradient, agregar el `--surface-warm` sutil en una sub-card.
- Considerar mover el eyebrow display de mono a Inter Display heavy con tracking apretado para diferenciarlo del label uppercase clásico de Linear.

---

## Validación 3 — Form completion rate del nuevo "Nueva tienda" multi-step vs single-page actual

**Qué se prueba.** Si el patrón de **5 section cards + step indicator + sidebar consistente** mejora la tasa de completion vs el form actual de `/stores/new` (single-page largo). Es la validación más cara (requiere implementación de prototipo) pero la más importante para confirmar el patrón Atelier multi-step.

**Insumo.**
- **Versión A (control):** form actual `/stores/new` en la implementación actual del repo (sin redesign).
- **Versión B (variante):** prototipo navegable (Figma/Framer/HTML estático) del form Atelier basado en `directions.md` §4.13 — el wireframe `screens/order-create.md` reusa el mismo patrón y sirve como referencia visual cercana, pero la prueba se ejecuta sobre el form de Tienda.

**Quién lo ejecuta.** Humano. Reclutar 12 personas (6 control, 6 variante), perfil collector 18–25 con cuenta nueva (no usuarios actuales — hay que evitar memoria del form viejo).

**Cómo se mide.**
- Tarea: _"Crea una tienda llamada 'Akiba Records', es una persona, vende vinilos, opera online en Colombia"_ (mismo brief para ambas versiones).
- Métricas:
  - **Completion rate** (terminó la tarea sin abandonar) — primaria.
  - **Tiempo a completion** (desde que abre el form hasta submit exitoso) — secundaria.
  - **Errores de validación encontrados** — secundaria.
  - **Pregunta cualitativa post-tarea:** _"¿Qué te frustró? ¿Qué te ayudó?"_.

**Criterio pass/fail.**
- ✅ **Pasa** si Variante B tiene **≥+15% completion rate** vs Control A (con n=6 cada uno, esto significa al menos 1 más completa). Tiempo similar o menor también es señal positiva.
- ⚠️ **Pasa con reserva** si completion rate es **igual o levemente mejor** pero la pregunta cualitativa muestra mejor sentimiento subjetivo en B.
- ❌ **Falla** si Variante B tiene completion rate **menor** que Control A.

**Qué pasa si falla.**
- Revisar si el step indicator confunde (¿el usuario espera ver "5 pasos arriba" como expectativa, vs el patrón de section cards stackeadas que no tienen "Siguiente" hasta el último?).
- Considerar volver a single-page con respiración entre secciones (sin step indicator) — alternativa propuesta en `principles.md §2`.
- Si el problema es la sidebar Resumen + Atajos en mobile (sheet bottom), revisar si el sheet es discoverable o si se necesita un hint persistente.
- Si el problema es validación inline post-blur (el user no sabe qué falta), agregar resumen de campos pendientes en el footer sticky.

---

## Validación 4 — Lectura de `--text-muted` en mobile bajo sol

**Qué se prueba.** Si el ajuste de `--text-muted` post-rev 2 (subido de `oklch(60%/56%)` a `oklch(50%/64%)` para cumplir AA en texto pequeño) realmente se lee sin esfuerzo en condiciones reales de uso — la validación es **física**, no por contrast checker.

**Insumo.** Render real (no mock estático) del `screens/orders-list.md` mobile y del `screens/order-detail.md` mobile en un dispositivo Android mid-tier (Pixel 6a o equivalente) con brillo al 100%. La pantalla muestra rows densas con código mono `PT-XXXXXX` y timestamps "12 abr 26" en `--text-muted`.

**Quién lo ejecuta.** Humano. **3 personas distintas** salen físicamente al sol (mediodía, día despejado) e intentan leer 5 timestamps específicos sin esforzar la vista.

**Cómo se mide.**
- Pregunta directa por cada timestamp: _"¿Qué dice acá?"_ y _"¿Tuviste que esforzarte?"_.
- Si el participante se inclina, achina los ojos o tapa la luz con la mano → considerar "esforzar".

**Criterio pass/fail.**
- ✅ **Pasa** si las 3 personas leen los 5 timestamps sin esforzar.
- ⚠️ **Pasa con reserva** si 1 persona se esfuerza en 1 timestamp (caso aislado).
- ❌ **Falla** si ≥2 personas se esfuerzan en ≥2 timestamps.

**Qué pasa si falla.**
- Subir aún más el `--text-muted` light a `oklch(45% 0.018 260)` (más oscuro) — re-verificar AA en el nuevo valor.
- Considerar subir el size de los timestamps de Mono 11 a Mono 13 en mobile (sólo mobile).
- Validar también el chip "Aún no llega" con `--warning / 14%` (gap #1 de `atelier-gaps.md`) en la misma sesión — dos pájaros de un tiro.

---

## Validación 5 — Inicial vs logo en avatar de tienda

**Qué se prueba.** Si la receta de **avatar fallback con letra inicial sobre tinte indigo 14% + border 28%** (única receta sin paleta categórica, post-rev 2) se siente "diseñada" o "fallback feo / placeholder". Esta validación protege la decisión de no usar paleta categórica como diferenciador visual.

**Insumo.** Mostrar el `screens/orders-list.md` mobile con una mezcla de rows: 50% con logo real de tienda, 50% con inicial. La inicial debe usar la receta `color-mix(in oklch, var(--accent) 14%, var(--surface-elevated))` background + `var(--accent)` letra + `color-mix(in oklch, var(--accent) 28%, var(--border))` border.

**Quién lo ejecuta.** Humano. 6 collectors 18–25.

**Cómo se mide.**
- Mostrar el listado durante 10 segundos sin instrucciones específicas.
- Pregunta abierta: _"¿Qué notas de estos avatares?"_.
- Codificar respuesta en: (a) "se ven bien / consistentes / forman parte del estilo", (b) "los que tienen logo se ven mejor que los que tienen letra", (c) "los de letra se ven feos / parecen placeholder / parecen un error".

**Criterio pass/fail.**
- ✅ **Pasa** si ≥5 de 6 caen en (a). El indigo tinted feels intentional.
- ⚠️ **Pasa con reserva** si caen 4 de 6 en (a) y 2 en (b) — los de logo ganan pero los de letra no se sienten error.
- ❌ **Falla** si ≥2 caen en (c).

**Qué pasa si falla.**
- Subir el tinte de fondo del 14% al 18% para que se sienta más "diseñado".
- Cambiar la letra inicial a Inter Display 700 con tracking apretado en lugar de Inter body 600 — más "tipo display, menos placeholder".
- Como último recurso: introducir 2 variantes de tinte (warm + cool) que se asignan determinísticamente por hash del nombre — aún sin paleta categórica de 6 colores, pero con más vida.

---

## Resumen ejecutivo

| #   | Qué                                       | n   | Cuándo                          | Costo | Bloqueante para S3 |
| --- | ----------------------------------------- | --- | ------------------------------- | ----- | ------------------ |
| 1   | Test 5s hero dashboard                    | 8   | Antes de tokenizar S3           | Bajo  | Sí                 |
| 2   | Comparativa lado-a-lado con Linear        | 6   | Antes de tokenizar S3           | Bajo  | Sí                 |
| 3   | Form completion multi-step vs single      | 12  | Antes de cerrar S3 (forma final del patrón) | Alto | Sí                 |
| 4   | `--text-muted` mobile bajo sol            | 3   | Antes de tokenizar S3           | Muy bajo | Sí              |
| 5   | Inicial vs logo en avatar                 | 6   | Antes de tokenizar S3           | Bajo  | Sí                 |

**Orden recomendado de ejecución:** 4 → 1 → 5 → 2 → 3. La 4 es la más barata y desbloquea decisión sobre token; la 1 y la 5 confirman que la dirección visual transmite producto + identidad; la 2 valida diferenciación; la 3 es la más cara pero valida el patrón crítico de forms.

**Si alguna falla:** se re-itera la dirección antes de cerrar S2. Si fallan 3 o más, se reabre la pregunta "¿Atelier sigue siendo la dirección?" en una sub-sesión humana.

**Si todas pasan:** se sube el score de Atelier a ~4.82/5 y se cierra S2 con luz verde para S3 (sistema de tokens).
