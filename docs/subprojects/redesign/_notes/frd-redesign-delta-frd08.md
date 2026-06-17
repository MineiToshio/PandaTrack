---
title: FRD ↔ Rediseño Delta Audit — FRD-08 Delivery Management
last_updated: 2026-06-12
scope: FRD-08 (PRD-01 Collector MVP) + BP-01 Delivery Management
trigger: cierre de S9 (Fase A demo/specs + Fase B implementación, 2026-06-12)
status: audit + FRD-08 sincronizado en el mismo cambio (ver §6)
owner: Sergio Minei
---

# FRD ↔ Rediseño Delta Audit — FRD-08

Complementa el [Round 1](./frd-redesign-delta-round-1.md), que dejó FRD-08 **out_of_scope ("pending S9")**. S9 cerró el 2026-06-12 (demo + specs aprobados + implementación en 3 partes commiteada: `6c854aa`, `91f0a73`, `0e04e86`, `35e6fe6`). Este doc audita el FRD-08 contra lo realmente shipeado.

## Resumen ejecutivo

- **Conclusión:** alineamiento alto. La implementación se construyó _desde_ el FRD-08, así que los 34 FR y 7 BR se cumplen sin reescrituras. Los deltas son pocos y de tipo "fact nuevo" o "patrón visual", no contradicciones.
- **Total deltas: 11** — datos = 2 · funcional = 2 · comportamiento = 1 · patrón nuevo = 4 · defecto conocido = 2.
- **Acción tomada:** FRD-08 sincronizado en este mismo cambio (status + Current State + 3 facts nuevos). El resto (patrones visuales) vive en `docs/redesign` y no necesita entrar al FRD.

## Convenciones

Mismas categorías que Round 1: **visual** (apariencia), **comportamiento** (interacción), **funcional** (regla de negocio/flujo), **datos** (modelo/schema), **patrón nuevo** (no contemplado), **defecto conocido** (bug shipeado a corregir).

## Deltas detectados

| ID    | FR/BR               | Cambio                                                                                                                                                                                                                                                                | Categoría        | Origen               | Resolución                                                                                                                                                                                |
| ----- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D8-01 | FR-08-22 / FR-08-31 | **Columna `receivedDate`** (nullable) agregada vía migración `20260612224123_add-delivery-received-date`. El FRD la exige implícitamente (mark-delivered captura received date; las cards DELIVERED la muestran) pero la fundación de datos WO-01 no la había creado. | datos            | S9 Fase B Parte 1    | ✅ migración aplicada (workaround Neon canónico). FRD-08 Current State actualizado.                                                                                                       |
| D8-02 | (sin FR)            | **Formato de ID legible `DLV-YYYYMMDD-NN`** para entregas. El FRD nunca especificó formato de ID de entrega (orders sí tenía FR para `ORD-…`). La implementación lo introdujo por paridad.                                                                            | datos            | S9 Fase B            | ✅ registrado en FRD-08 Current State como fact de implementación.                                                                                                                        |
| D8-03 | FR-08-24            | **La tienda es inmutable en modo edición** (S9-D4). El FRD habla de editar productos/costo/fechas (BR-08-04) pero no fija si la tienda puede cambiar. La implementación la bloquea: los productos dependen de la tienda; el escape es eliminar y recrear.             | funcional        | S9 Fase A (decisión) | ✅ agregado como nota a FR-08-24 / BR-08-04 en FRD-08.                                                                                                                                    |
| D8-04 | FR-08-25 / BR-08-07 | **Guard server-side de editabilidad**: edit solo permitido en `IN_TRANSIT` (DELIVERED/CANCELLED redirigen al detalle pidiendo reabrir). Consistente con BR-08-04 pero el FRD no lo explicitaba como guard de ruta.                                                    | funcional        | S9 Fase B Parte 3    | ✅ nota agregada a BR-08-04.                                                                                                                                                              |
| D8-05 | FR-08-23 / FR-08-27 | **Reabrir no abre modal de confirmación** (S9-D3): ejecuta directo con toast neutral-undo (tecla `Z`), por no ser destructiva. Marcar llegada / cancelar / eliminar sí confirman.                                                                                     | comportamiento   | S9 Fase A (decisión) | redesign-owned (ADR 0001 D4); no requiere cambio de FR. Documentado en `screens/delivery-detail.md`.                                                                                      |
| D8-06 | (sin FR)            | **Hero del detalle = ventana de llegada** (S9-D1), no un monto. DELIVERED/CANCELLED usan status uppercase.                                                                                                                                                            | patrón nuevo     | S9 Fase A            | redesign-owned. `screens/delivery-detail.md`.                                                                                                                                             |
| D8-07 | (sin FR)            | **Chip Eyebrow + Top-Accent (§9.17)** aplicado a detalle/cards de entregas.                                                                                                                                                                                           | patrón nuevo     | M07 / S9             | redesign-owned (PLAYBOOK §9.17).                                                                                                                                                          |
| D8-08 | FR-08-27            | **Sticky action bar single-primary + actions sheet** en mobile (ADR 0011). El FR pide "one primary, one secondary, destructive en More"; la implementación lo materializa con el patrón mobile canónico.                                                              | patrón nuevo     | S9 Fase B Parte 2    | redesign-owned (ADR 0011). Cumple el FR.                                                                                                                                                  |
| D8-09 | (sin FR)            | **Extensiones de componentes core**: `Toast` variante `neutral`+acción inline, `Modal` tone `success`, `CollapsibleSubcard`/`CodeCopyButton` promovidos.                                                                                                              | patrón nuevo     | S9 Fase B Parte 2    | redesign-owned. Registrado en lessons / session log.                                                                                                                                      |
| D8-10 | FR-08-28..33        | **Defecto S9.1**: el action row mobile de la lista desborda ~7px el viewport (390px). Heredado del patrón compartido con `/orders`.                                                                                                                                   | defecto conocido | S9 Fase B Parte 1    | 🟡 abierto en `cross-cutting-changes.md` S9.1. No viola un FR (la lista funciona) pero degrada el AC implícito de responsive.                                                             |
| D8-11 | FR-08-31            | **Defecto S9.2**: off-by-one de fechas — fechas de dominio guardadas a medianoche UTC se muestran un día antes en timezones negativos (`toLocaleDateString` sin `timeZone:"UTC"`). Sistémico orders+deliveries.                                                       | defecto conocido | S9 Fase B Parte 3    | 🟡 abierto en `cross-cutting-changes.md` S9.2. Afecta la veracidad de "shipping date" / "received date" mostrados (FR-08-31). **Recomendado priorizar** (toca datos visibles al usuario). |

## Desviaciones demo → implementación (no son deltas de FRD)

Registradas en `sessions/09-deliveries.md §Desviaciones`: hero CANCELLED sin "cancelada el {fecha}" (no existe columna `cancelledAt`; el FRD no la exige), contador central del sticky wizard mobile movido al footer (limitación del `<WizardStep>` canónico), atajo `Esc` no cableado. Ninguna contradice el FRD.

## FR/BR sin delta (cumplidos tal cual)

FR-08-01..21, 26, 32, 34 y BR-08-01..03, 05, 06 se implementaron sin desviación. Verificación notable: **BR-08-05 respetada** — el detalle NO tiene timeline de historial (diferencia deliberada con order-detail).

## Open Questions del FRD — estado

Las 3 (costo de envío como serie de dashboard / carrier+tracking post-MVP / attachments post-MVP) siguen **abiertas y fuera de scope** — el rediseño no las tocó. Sin cambios.

## Recomendaciones de seguimiento

1. **S9.2 (fechas UTC)** — priorizar: afecta datos visibles en ambos módulos. Sesión dedicada (helper de formato `timeZone:"UTC"` para fechas de dominio vs normalización de persistencia).
2. **S9.1 (overflow mobile)** — fix visual en el patrón compartido de action row (orders + deliveries).
3. FRD-08 ya sincronizado (§6); no queda deuda de alineación de producto para este módulo.

## §6 — Cambios aplicados al FRD-08 en este mismo paquete

- `implementation_status: PLANNED → IMPLEMENTED`; `last_updated → 2026-06-12`.
- **Current State** reescrita: "Implemented" lista el vertical real (lista/detalle/crear/editar + lifecycle + nota), la migración `receivedDate`, el formato `DLV-YYYYMMDD-NN`, y las rutas. "Planned" vaciada (todo shipeado).
- **FR-08-24** + **BR-08-04**: nota de que la tienda es inmutable en edición (D8-03) y de que el guard de edición exige `IN_TRANSIT` (D8-04).
- Sin cambios a la semántica de ningún FR/BR existente — solo facts de implementación y 2 aclaraciones.
