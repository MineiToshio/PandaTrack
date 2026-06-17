---
title: ADR 0010 — UI Primitive Libraries Approval Policy
date: 2026-05-11
status: accepted
session: S7-A.2 — adaptive modal pattern decision
owner: Sergio Minei
trigger: S7-A.2 adaptive modal pattern requires drawer/sheet behavior in mobile
updates: la spec de Modal del subproyecto (histórico), PLAYBOOK.md, package.json
---

# ADR 0010 — UI Primitive Libraries Approval Policy

## Contexto

PandaTrack se construyó hasta hoy con **primitivas UI hand-rolled** (Modal, Sheet, FilterDrawer, Portal, Button, Input, etc.) sin depender de ninguna librería de design system o de UI primitives externa (Radix UI, Headless UI, Reach UI, Floating UI, etc.).

Esta política implícita —no documentada formalmente hasta ahora— se mantuvo durante S1-S7 Fase A y los rediseños M01-M05. El Modal canónico (`src/components/modules/Modal/Modal.tsx`, 383 líneas) implementa internamente focus trap, Portal, scroll lock, ARIA attributes, Esc handling y backdrop click — todo sin deps externas.

Durante S7-A.2 (rediseño mobile del módulo Orders, 2026-05-11) surgió la necesidad de implementar **bottom sheets para mobile** con comportamiento adaptive (centered dialog en desktop ≥768px, bottom sheet en mobile <768px, ADR 0008 Extensión). El bottom sheet con drag-to-dismiss + snap points + safe-area-inset-bottom + keyboard handling es **significativamente más complejo** de implementar hand-rolled que el Modal centrado:

- Touch gesture handling con velocity-based dismiss
- iOS Safari quirks (rubber-banding, scroll lock con virtual keyboard)
- Snap points y detents
- Focus trap con drag concurrente

La investigación externa (14 fuentes, ver ADR 0008 Extensión) identificó **Vaul** (Emil Kowalski, built on Radix Dialog) como el estándar de facto en React/Next.js 2024-2026. Su scope es estrictamente el drawer/sheet behavior — no es un design system completo.

## Tensión arquitectónica

Dos enfoques posibles:

### A. Hand-roll todo, sin libs

- **Pros**: coherente con el pattern actual; cero deps; control total; auditabilidad completa.
- **Cons (con desarrollo AI-driven)**: AI agents tienen mayor varianza de bugs en código custom complejo (gestures, iOS quirks); cada sesión futura paga el costo cognitivo de releer 200-400 líneas custom; tiempo de implementación ~3-5 días vs ~0.5 días con lib.

### B. Adoptar libs sin restricción

- **Pros**: velocidad de implementación; calidad de primitives battle-tested.
- **Cons**: slippery slope — agentes futuros pueden agregar dependencias sin auditoría; PandaTrack se transforma gradualmente en una "Radix/Headless app" sin decisión consciente; bundle crece sin control; vendor lock-in.

### C. Política explícita de libs aprobadas (este ADR)

- **Pros**: combina lo mejor de A y B. Hand-roll por default (pattern actual). Excepciones aprobadas explícitamente con ADR. Lista cerrada de libs aprobadas. Trazabilidad de cada decisión de agregar dep.
- **Cons**: requiere disciplina de cumplir el workflow; cada lib nueva = ADR.

## Decisión

**Adoptar Opción C — política formal de libs aprobadas.**

### Reglas

1. **Default: hand-rolled.** PandaTrack mantiene control sobre primitives core. Modal, Sheet, FilterDrawer, Portal, Button, Input, Select, Combobox, Chip, etc. — todos hand-rolled.

2. **Excepciones aprobadas** (lista cerrada, requiere ADR para agregar nuevas):
   - **`vaul`** — aprobado únicamente para implementar el bottom sheet behavior dentro del componente `<ModalSheet>` (variante mobile del Modal canónico). Razón: el drag-to-dismiss + snap points + safe-area + keyboard handling son significativamente complejos de hand-roll, y Vaul es scope narrow (un solo componente Drawer). Aprobado por ADR 0008 Extensión 2026-05-11.

3. **Banned hasta nueva decisión**:
   - `@radix-ui/*` como **dependencia top-level** en `package.json`. Vaul depende de `@radix-ui/react-dialog` y `@radix-ui/react-portal` transitivamente — esto es aceptable porque queda como implementation detail de Vaul; nuestro código nunca importa de `@radix-ui/*` directamente.
   - `@headlessui/react` — no aprobado.
   - `@floating-ui/react` — popovers/tooltips siguen siendo hand-rolled por ahora.
   - Cualquier "design system completo" (Mantine, Chakra UI, MUI, Ant Design, Polaris React, etc.) — no aprobado.
   - Cualquier "UI primitive library" no listada explícitamente arriba — requiere ADR previo.

4. **Workflow para agregar nueva lib aprobada**:
   - Abrir ADR con: contexto, alternativas evaluadas (incluir DIY), bundle impact, mantenibilidad, aprobación humana explícita.
   - Si la decisión es aprobar, actualizar este ADR (sección "Excepciones aprobadas") con la nueva entrada.
   - Justificación obligatoria: por qué hand-roll no es viable (ej. complejidad técnica, tiempo de desarrollo desproporcionado, riesgo de bugs sutiles).

5. **Auditoría continua**:
   - `package.json` no debe contener entradas que no aparezcan en la lista de excepciones aprobadas.
   - `grep "@radix-ui" package.json` debe retornar empty.
   - Cualquier agente que detecte una violación debe abrir issue/flag inmediato.

## Justificación

1. **Coherencia con el pattern del proyecto**: PandaTrack se construyó hand-rolled desde S1. Romper este pattern sin governance explícita es riesgoso.

2. **Realidad del desarrollo AI-driven**: con agentes AI escribiendo el código, las libs conocidas tienen ventaja sobre código custom complejo (los modelos están entrenados en patrones famosos, menos bugs en integraciones de libs estándar que en gestures/touch event handling custom). Sin embargo, esa ventaja solo aplica a casos donde la complejidad lo justifica.

3. **Bundle accountability**: cada lib es un costo permanente de bundle. Tener una política explícita evita crecimiento por inercia.

4. **Slippery slope prevention**: sin governance, un agente puede agregar `@radix-ui/react-dropdown-menu` en una sesión de S8 sin que nadie note. En 6 meses, PandaTrack se vuelve una Radix app. Este ADR previene eso requiriendo ADR explícito para cada nueva lib.

5. **Vaul como excepción justificada**: el drag-to-dismiss + iOS quirks + scroll lock + safe-area en bottom sheets son complejos de implementar correctamente. Vaul es estado del arte (Emil Kowalski / Vercel) y scope estrictamente narrow (un solo componente Drawer). El costo (~15KB transitive incluyendo Radix Dialog hidden) es bajo comparado con el costo de implementar el comportamiento equivalente custom con calidad similar.

## Implicancias

1. **`package.json`** debe agregar únicamente `vaul` como dep nueva. No agregar `@radix-ui/*` directamente — viene como transitive de Vaul.

2. **`PLAYBOOK.md` §1** debe referenciar este ADR en la sección Modal/Sheet.

3. **Cualquier agente futuro** que considere agregar una lib UI debe:
   - Leer este ADR primero.
   - Verificar si la lib está en la lista aprobada.
   - Si NO está, abrir nuevo ADR con justificación. NO instalar la lib hasta aprobación humana explícita.

4. **`.cursor/rules/` deberían reflejar esta política**: agregar regla nueva `ui-libs-policy.mdc` que referencie este ADR. Cualquier `npm install <ui-lib>` requiere auditoría contra este ADR.

5. **`docs/tooling/cursor/rules.md`** debe incluir la nueva rule en su índice.

## Costo y riesgo

- **Costo de adoptar**: ~30 minutos para crear este ADR + actualizar refs + agregar cursor rule. Negligible.
- **Riesgo de NO adoptar**: alto. Sin governance, el proyecto puede acumular 5-10 deps UI en 6 meses sin decisión consciente. Refactoring para revertir es costoso.

## Confianza

**Alta.** Decisión humana explícita 2026-05-11 tras análisis de trade-offs con agente AI considering AI-driven development implications. La lista aprobada es minimal (solo Vaul) y la política es revisitable con ADRs futuros.

## Próximos pasos

1. Agregar cursor rule `ui-libs-policy.mdc` en `.cursor/rules/` (requiere flag §7.alpha — fuera del subproyecto de rediseño).
2. Actualizar `docs/tooling/cursor/rules.md` con la nueva rule.
3. En Fase B Parte 0 (Modal adaptive): instalar `vaul` y verificar que `@radix-ui/*` queda como transitive only.
4. Auditar `package.json` después de cada `npm install` en sesiones futuras.

## Referencias externas

- [Vaul — Drawer for React (Emil Kowalski)](https://vaul.emilkowal.ski/)
- [Vaul GitHub repository](https://github.com/emilkowalski/vaul)
- ADR 0008 — Modal Enhancement + Adaptive (decisión que disparó este ADR)
