---
title: Dirección elegida — Bento Atelier
date: 2026-05-01
decided_by: Sergio Minei
score: 4.67/5 (techo realista para propuesta paper en S1)
---

# Dirección elegida: Bento Atelier

> _Curated Workshop con calidez y mascota panda con personalidad real._

Tras 2 revisiones + análisis crítico contra principios y research, **Bento Atelier es la dirección visual que llevamos a S2 y siguientes**. Es la evolución sobria de Bento Editorial (la favorita base) con identidad propia gracias a la mascota, voz informal Gen Z, y 3 acentos coordinados con función explícita.

## Por qué esta dirección

- Conserva la **calma + densidad + seriedad** de Linear/Plain (Dir 1) — el mejor formato para datos financieros.
- Suma **calidez puntual con función**: 3 acentos coordinados (indigo + coral + teal) usados sólo donde tienen función, no como decoración.
- Resuelve la **diferenciación visual** vs Linear/Vercel con mascota panda (AI/pixel art) que se pasea por la pantalla y voice informal Gen Z.
- **Light y dark son hermanos limpios** — heredado de Dir 1.
- **Form mejorado** con 5 section cards + step indicator full-width + big choice cards + sidebar consistente.
- **Lucide como set único de íconos**, avatares neutros con tinte indigo, paleta categórica reservada para charts (no decoración).

## Score por criterio (paper-only S1, post recomendaciones aplicadas)

| Criterio                 | Score              | Notas                                                                    |
| ------------------------ | ------------------ | ------------------------------------------------------------------------ |
| Energía visual           | 4/5                | Sereno con calidez puntual; mascota suma energía sin saturar             |
| Densidad informativa     | 5/5                | Listas densas + section cards respiran                                   |
| Formalidad / seriedad    | 5/5                | Premium tool con voz informal pero no infantil                           |
| Riesgo de implementación | 3/5                | Mascota pixel art + 3 acentos requieren disciplina                       |
| Fit Gen Z (18–25)        | 5/5                | Sweet spot mainstream sin saturar                                        |
| Fit producto financiero  | 5/5                | Dato manda, color sólo donde hay función                                 |
| Escalabilidad sistema    | 5/5                | 3 acentos funcionales + Lucide canon + tokens claros                     |
| Reusabilidad cross-modo  | 5/5                | Light/dark con misma estructura                                          |
| Diferenciación vs apps   | 5/5                | Mascota con nombre + voice + view-transitions signature                  |
| **Total**                | **42/45 = 4.67/5** | El 0.33 restante se gana con S2-S6 (validación + producción + iteración) |

## Recomendaciones aplicadas (rev 3)

Las 5 recomendaciones del análisis del 2026-05-01 quedan documentadas en el sistema:

1. **Paleta con jerarquía explícita** (`directions.md` §4.4): tabla "siempre / para X / nunca" para cada token.
2. **View Transitions signature** (`directions.md` §4.8): receta concreta para list→detail (avatar continuo, mono crece sin re-render, micro-pausa de status, easing spring overshoot 0.05).
3. **Mascota panda con nombre, AI/pixel art, que se pasea** (`directions.md` §4.10): pixel art recomendado, 5 estados base (idle/walking/peeking/celebrating/sleeping), reglas estrictas de aparición.
4. **Voice informal Gen Z con glosario** (`principles.md` §7 + `directions.md` §4.11): 15 pares antes/después, sweet spot entre Linear-frío y Duolingo-cringe.
5. **Asistente conversacional sólo en lo visual** (FRD aparte): el sistema documenta presencia de la mascota; comportamiento conversacional sale del scope de S1.

## Decisiones residuales pendientes (no bloquean S2)

| Decisión                                                 | Cuándo                                                                                 |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Nombre de la mascota                                     | S6 (cuando se diseñe el render real). Candidatos: Bento, Ito, Boro, Mochi, Tomo, Kuma. |
| Pixel art vs AI hi-res render                            | S2/S3 con explorations reales. Recomendación inicial: pixel art.                       |
| Eliminar paleta categórica reservada o mantenerla        | S3 cuando se decida si el MVP tiene charts. Si no → eliminar.                          |
| Activar `--accent-cool` (teal) o quedarnos con 2 acentos | S2 con tests reales. Default: 3 acentos.                                               |

## Validaciones requeridas en S2 antes de invertir en S3+

Estas pruebas cierran ~0.15 del 0.33 restante:

1. **Test de 5 segundos** del hero del dashboard con 8 collectors 18–25. Pregunta: "¿Qué hace esta app?". Pasa si ≥70% dice "tracking de pagos/colección".
2. **Comparativa lado a lado con Linear** — abrir `linear.app` y nuestro mock juntos. Pasa si la respuesta dominante NO es "se parecen mucho".
3. **Form completion rate** del nuevo "Nueva tienda" multi-step vs single-page actual. Pasa si mejora.
4. **Lectura de `--text-muted` en mobile bajo sol** físicamente. Pasa si los timestamps se leen sin esfuerzo.
5. **Inicial vs logo en avatar**: preguntar si la inicial tinted indigo se siente "diseñada" o "fallback feo".

## Lo que NO es Atelier (para evitar drift)

- **No es Linear con coral** — la mascota y la voz informal son lo que separa.
- **No es Soft Garden con menos color** — categorías por ícono Lucide (no personajes con nombre).
- **No es Neon Drop Floor** — sin gradientes saturados, sin chrome type, sin brutalism.
- **No tiene asistente conversacional** dentro del sistema — eso es FRD aparte.
- **No tiene 6 colores categóricos visibles** — la paleta categórica está reservada para charts.

## Cómo arrancar S2

1. Leer `direction-chosen.md` (este archivo).
2. Leer `directions.md` §4 completo (la dirección elegida).
3. Leer `principles.md` (especialmente §7 voice glossary y §8 a11y).
4. Leer `functional-inventory.md` para conocer las 6 pantallas críticas a wireframear.
5. Diseñar wireframes de baja fidelidad de las 6 pantallas críticas (Dashboard, Orders list, Order detail, Order create, Delivery create, Settings) primero en 360px.
6. Lanzar las 5 validaciones con usuarios reales en paralelo a los wireframes.
