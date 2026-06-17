---
title: S2 — Red team de wireframes lo-fi
session: 02
last_updated: 2026-05-01
status: closed (objeciones vacías)
---

# S2 — Red team de los 6 wireframes lo-fi

Pasada de revisión hostil sobre los 6 wireframes de pantallas críticas producidos en Sesión 2. Se aplica como revisor externo: sin compasión por el agente que escribió cada doc, midiendo contra Regla Cero, decálogo (`principles.md`), dirección elegida (`direction-chosen.md`) y la sección §4 de `directions.md`.

## Cómo se ejecutó

1. Se leyó cada `screens/*.md` post-síntesis cross-screen (post-fix de `view-transition-name`).
2. Se evaluó contra los 10 chequeos del brief.
3. Cualquier "no" disparó una iteración (edición directa o anotación en `atelier-gaps.md`).
4. La pasada cierra con la columna **Objeción** vacía o resuelta. No quedan TODOs.

## Tabla por pantalla

| Chequeo                                                                                                  | dashboard | orders-list | order-detail | order-create | delivery-create | settings  |
| -------------------------------------------------------------------------------------------------------- | --------- | ----------- | ------------ | ------------ | --------------- | --------- |
| 1. ¿Se siente Bento Atelier o se siente genérica?                                                        | ✅        | ✅          | ✅           | ✅           | ✅              | ✅        |
| 2. ¿La estructura difiere realmente del diseño actual o se parece?                                       | ✅        | ✅          | ✅           | ✅           | ✅              | ✅        |
| 3. ¿Los tokens invocados existen en `directions.md` §4.4?                                                | ✅        | ✅          | ✅           | ✅           | ⚠️ ver nota 1   | ✅        |
| 4. ¿Light y dark están ambos cubiertos?                                                                  | ✅        | ✅          | ✅           | ✅           | ✅              | ✅        |
| 5. ¿Mobile 360px es legible y operable con pulgar?                                                       | ✅        | ✅          | ✅           | ✅           | ✅              | ✅        |
| 6. ¿Voice consistente con glosario `principles.md` §7?                                                   | ✅        | ✅          | ✅           | ✅           | ✅              | ✅        |
| 7. ¿La mascota aparece según las reglas o se siente forzada?                                             | ✅        | ✅          | ✅           | ✅           | ✅              | ✅ (N/A)  |
| 8. ¿Estados completos (no faltan empty/loading/error/success/edit donde aplique)?                        | ✅        | ✅          | ✅           | ✅           | ✅              | ✅        |
| 9. ¿View transitions tienen sentido o son decorativas?                                                   | ✅        | ✅          | ✅           | ✅           | ✅              | ✅ (N/A)  |
| 10. ¿Hay TODOs o "por definir"? → no se permite cerrar con TODOs.                                        | ✅        | ✅          | ✅           | ✅           | ✅              | ✅        |

**Nota 1 — delivery-create §4 sobre `--warning`:** la pantalla usa `--warning` para chip "Aún no llega" (estado producto NONE). La tabla §4.4 reserva `--warning` a "atrasado N días / vencidos del dashboard". Se mantiene el uso porque (a) el agente registró el riesgo en `atelier-gaps.md` gap #1 con propuesta de resolución, (b) el alfa 14% sutil no llega a alarma, (c) la decisión final pasa a S3. No bloquea S2.

## Iteraciones aplicadas en esta pasada

| Iteración                                                                                          | Origen                                                                                 | Acción                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Convención `view-transition-name` divergente entre archivos                                        | order-detail usaba `order-X`; dashboard usaba `order-{id}`; orders-list `order-{humanId}` | Se unificó a `view-transition-name: order-{humanId}` en los tres archivos. Se reforzó en `order-detail.md §6` con la frase "Convención de nombre vinculante" para que la firma §4.8 no se rompa por drift de naming en la implementación S6+.                          |
| Riesgo de tono alarmante con `--warning` en chip "Aún no llega"                                    | delivery-create §4                                                                     | Se documentó en `atelier-gaps.md` gap #1; se mantiene el uso con alfa 14% pendiente de validación humana (Validation #4 del plan).                                                                                                                                     |
| Pattern de "input pre-llenado / read-only" no canonizado en Atelier                                | delivery-create §2 (combobox de tienda con `sourceOrderId`)                            | Documentado como `atelier-gaps.md` gap #2 con propuesta para §4.13.                                                                                                                                                                                                  |
| Section card en estado disabled/gated no canonizado                                                | delivery-create §5 cards 3 y 4 cuando `empty_no_eligible`                              | Documentado como `atelier-gaps.md` gap #3 con propuesta.                                                                                                                                                                                                              |
| Toast con undo (selección masiva) no canonizado                                                    | delivery-create §10                                                                    | Documentado como `atelier-gaps.md` gap #4 con propuesta.                                                                                                                                                                                                              |

## Cross-screen consistency check (segunda pasada manual)

| Chequeo cruzado                                                                                                                            | Resultado                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Receta de avatar tienda** (logo o letra inicial sobre tinte indigo 14% + border 28%) replicada igual en dashboard, orders-list, order-detail, order-create (combobox), delivery-create (combobox) | ✅ Consistente. Recomendación elevada al §10 de dashboard: definir `<StoreAvatar>` reusable en S3 con sizes 24/32/40/56.                                                                                                                                            |
| **Patrón section cards** (`radius-xl`, padding 24/28 desktop / 20 mobile, eyebrow mono `--text-muted` neutro, title 19pt, helper Body 13, sin tinte cromático) | ✅ Consistente entre order-create (5 cards), delivery-create (4 cards) y settings (3 cards colapsables). La diferencia en cantidad de cards está justificada por contenido distinto.                                                                                  |
| **Sidebar derecha (Resumen + Atajos)** con receta de filas attribute → value §4.13 (label `--text-secondary` 13px / valor `--text-primary` 13px peso 500) | ✅ Consistente en order-create y delivery-create. Order-detail tiene sidebar con receta similar pero con cards distintas (Resumen, Acciones, Nota) — alineadas al patrón.                                                                                            |
| **Step indicator full-width** (5 círculos en order-create, 4 en delivery-create) con `flex: 1` sin `max-width` rígido                     | ✅ Consistente con §4.13 post-rev 2 (no tope `60px`).                                                                                                                                                                                                                |
| **Footer sticky con autosave + CTAs** (primary indigo + ghost cancel)                                                                      | ✅ Consistente en order-create y delivery-create.                                                                                                                                                                                                                    |
| **View Transition canónica list→detail** declarada en orders-list, order-detail y dashboard (origen alternativo)                          | ✅ Consistente tras la unificación de nombre `order-{humanId}`. Reglas inviolables (280ms, easing spring overshoot 0.05, avatar continuo, código mono crece 11→13px, chip status micro-pausa 40ms) repetidas en los tres docs sin drift.                              |
| **Mascota en posiciones canónicas únicamente** (bubble idle ubicua + walking solo en /dashboard desktop + sleeping en empty hero + celebrating en achievement explícito + idle en error 500) | ✅ Consistente. Settings declara "mascota ausente" como decisión, con bubble idle aún presente del shell. Order-create explicita "no celebrating al success" porque es task completion, no achievement.                                                                |
| **Voice glosario `principles.md` §7** (`tú` siempre, sin `usted`, sin "por favor", sin "le informamos", sin meme storm)                  | ✅ Cero ocurrencias de anti-patrones detectadas vía grep.                                                                                                                                                                                                            |
| **Eyebrow mono uppercase con `--text-muted` y tracking +0.08em** sin dot cromático                                                        | ✅ Consistente en las 6.                                                                                                                                                                                                                                            |
| **Categoría = ícono Lucide en `--accent-cool` (teal)**, sin color de fondo categórico ni dots                                              | ✅ Consistente. Paleta categórica reservada nunca se invoca como decoración.                                                                                                                                                                                         |
| **Regla de oro 3-4 colores visibles máximo por pantalla** (§4.4)                                                                           | ✅ Verificado: dashboard usa indigo + coral + warning + success (4, justificado por micro-stats); el resto se mantiene en 3.                                                                                                                                          |
| **Gate "necesitas tienda primero"** consistente en order-create (mascota sleeping + CTA → `/stores/new?returnTo=order-create`)            | ✅ Documentado consistentemente.                                                                                                                                                                                                                                    |

## Objeciones residuales

**Vacías.** Cualquier punto pendiente está documentado en `atelier-gaps.md` (resolución S3) o en §10 de cada wireframe (input humano antes de S3). Nada bloqueante para abrir Sesión 3.

## Recomendaciones para S3

1. **Resolver los 4 gaps de `atelier-gaps.md`** antes de tokenizar el sistema final, en especial:
   - Patrón canónico de "input pre-llenado / read-only" (gap #2).
   - Estado `disabled-gated` para section cards (gap #3).
   - Toast neutral con undo (gap #4).
   - Validar el tono de `--warning` en chip "Aún no llega" con prueba humana (Validation #4).
2. **Convención `view-transition-name: order-{humanId}` debe quedar registrada en `principles.md §4` o como ADR** en `decisions/` antes de S6 — sin ese contrato, la firma §4.8 se rompe en silencio en la implementación.
3. **Componente `<StoreAvatar>`** con sizes 24/32/40/56 debe entrar en el inventario de componentes core S4. Es la receta más replicada de S2.
4. **Catálogo i18n** de las claves propuestas en §9 de cada wireframe (≈40 strings) debe consolidarse en una hoja S2.5 antes de pasar a hi-fi S6+.
