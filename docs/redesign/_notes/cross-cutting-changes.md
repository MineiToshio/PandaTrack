---
title: Cambios cross-cutting del subproyecto de rediseño
last_updated: 2026-05-02
owner: Sergio Minei
status: vigente
---

# Cambios cross-cutting del subproyecto de rediseño

Registro de cambios que afectan componentes core, shell, tokens o convenciones del subproyecto detectados durante sesiones de módulo o foundational. Cada cambio se clasifica según `methodology.md` §7.quater (4 tipos) y se ejecuta con el procedimiento correspondiente.

## Convenciones

- **Tipo 1:** trivial / cosmético → inline en sesión actual, sin entrada acá.
- **Tipo 2:** cambio mayor de componente core → ADR + mini-sesión correctiva separada. Numerar **M0X** (M01, M02, ...) si es del catálogo de componentes.
- **Tipo 3:** shell / layout → ADR + mini-sesión "S5.1, S5.2, ..." dedicada.
- **Tipo 4:** token / sistema visual base → ADR + mini-sesión "S3-B.1, S3-B.2, ..." dedicada.

## Backlog y aplicados

| ID  | Fecha      | Cambio                                                                                                                                                                                                                                                                                                                      | Tipo | ADR                                                | Status      |
| --- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------- | ----------- |
| M01 | 2026-05-02 | `<Modal>` enhancement: el componente se siente plano/aburrido. Investigar patrones modernos (Linear, Vercel, Stripe, Apple HIG, Material 3, Polaris, Carbon, Cash App, Notion, Things) y aplicar mejoras visuales (íconos en color semántico, depth, motion, layered design, etc.) sin romper a11y ni la dirección Atelier. | 2    | [ADR 0008](../decisions/0008-modal-enhancement.md) | ✅ aplicado |

## Cómo registrar uno nuevo

Cuando una sesión detecta un cambio cross-cutting:

1. Pausar la sesión actual.
2. Clasificar el tipo (1/2/3/4).
3. Decidir urgencia (bloquea sesión actual sí/no).
4. Si tipo 2/3/4 → registrar acá con ID nuevo + ADR placeholder + status `🟡 abierto`.
5. Ejecutar la mini-sesión correctiva.
6. Cuando cierre, actualizar status a `✅ aplicado` + completar referencia a ADR final.
