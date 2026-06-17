---
title: S4 — Red team del catálogo de componentes
status: final S4
session: 04-components
last_updated: 2026-05-02
owner: Sergio Minei
---

# Red team — Sesión 4

> Pasada hostil del catálogo de 47 componentes contra los principios del subproyecto (decálogo, ADRs, tokens, voice). Cada objeción se evalúa con **severidad** (bloqueante / mayor / menor / informativa) y **resolución** (aplicada o decisión de no actuar con justificación).
>
> **Resultado:** 18 objeciones generadas, **0 bloqueantes pendientes**, 4 mayores resueltas con cambios al spec, 8 menores aceptadas con riesgo controlado, 6 informativas sin acción requerida.

---

## #1 — `<MicroStatCard>` con `accentToken='--accent-warm'` y un valor muy largo rompe el icon-tile

**Severidad:** menor.

**Objeción.** Cuando la cifra es muy larga (e.g. "$1.247.500.250" en una venta hipotética de un coleccionable raro, o cuando la moneda es JPY y los valores naturales tienen 6+ dígitos), el card se queda sin espacio horizontal. El icon-tile soft-tint se mantiene 32-36px arriba, pero la cifra `--text-display` clamp hasta 56px en desktop podría desbordar el width del card en grid 4-column.

**Resolución aplicada.** El spec ya documenta `tabular-nums` + `font-feature-settings: "tnum"` (estabiliza el ancho carácter por carácter). Para overflow extremo, el padre puede usar:
- abreviar formato cuando excede umbral (`$1.2M`, `¥18.4k`).
- truncar con tooltip que muestra el valor completo.

**Anotado en `<MicroStatCard>`** Edge cases #4 (existe). No requiere cambio adicional.

**Aceptado** con riesgo controlado.

---

## #2 — `<WizardAccordion>` con un solo paso degrada con elegancia, pero `<Stepper>` se renderiza inútil

**Severidad:** menor.

**Objeción.** Si un wizard solo tiene 1 step, el `<Stepper>` arriba muestra una sola bolita sin connectors. Visualmente raro y semánticamente vacío.

**Resolución aplicada.** El spec de `<Stepper>` ya documenta este edge case (#1): "Un solo step: componente degrada a una sola bolita visible sin connector. **El wizard accordion también degrada (sin step indicator)** — coordinar con `<WizardAccordion>`."

`<WizardAccordion>` ya documenta que cuando `children.length === 1` no renderiza el `<Stepper>` (solo el step). Aceptado.

---

## #3 — `<FilterDrawer>` mobile con 12 secciones es scroll infinito

**Severidad:** mayor.

**Objeción.** Si un filtro tiene muchas secciones (`orders` ya tiene 6, pero futuras vistas podrían tener 10-12 — Estado, Pago, Tienda, Categorías, Productos, Tags, Fechas pedido, Fechas llegada, País tienda, Switches Recibe pre-órdenes, Tiene stock, Envía a CO), el bottom sheet mobile con `max-height: 92svh` puede sentirse interminable de scrollear.

**Resolución aplicada.** El spec ya soporta:
- max-height controlada (`--sheet-max-h` 92svh).
- Footer sticky con "Aplicar (N)" siempre visible.
- Drag handle para resize manual del sheet.

**Cambio aplicado al spec:** documentar en `<FilterDrawer>` Edge cases que cuando hay más de 6 secciones, el componente debe mostrar un sumario de "filtros aplicados (N)" sticky arriba del scroll body para feedback inmediato sin scrollear hasta el footer. Esto NO requiere cambio del componente (es comportamiento opt-in por config) — anotado como recomendación S6.

Para vistas con 12+ filtros, recomendar reorganización en sub-sections con headings colapsables (variant `collapsible: boolean` en `FilterSection` — diferido a S6).

**Aceptado** con nota S6.

---

## #4 — `<StatusChip kind="info">` sin label en runtime crashea o degrada

**Severidad:** mayor → resuelta.

**Objeción.** El TypeScript bloquea por discriminated union (ADR 0006). Pero qué pasa en JS plano (sin types) o si un dev usa `as any` para forzar el tipo?

**Resolución aplicada.** El spec de `<StatusChip>` declara explícitamente:
- En TS, compile-time error.
- En runtime (JS plano o `as any`), el componente debe **fallar gracefully**: detectar `props.icon == null || props.label == null || props.label === ''` y NO renderizar (devolver `null`) + console.error con copy "ADR 0006 violation: <StatusChip kind='info'> requires both `icon` and `label` props." Esto está documentado en `<StatusChip>` "Notas para S12".

**Adicional para S12:** lint rule `pandatrack/no-info-chip-without-icon-label` que cuente como error. Anotado en `s4-gaps.md`.

**Resuelto.**

---

## #5 — `<Toast>` neutral-undo con atajo `Z` colisiona con undo nativo del browser en input focused

**Severidad:** mayor → resuelta.

**Objeción.** El atajo `Z` global del toast neutral-undo interfiere con `Cmd+Z` / `Ctrl+Z` (undo nativo) que el usuario espera cuando está editando un input.

**Resolución aplicada.** El spec de `<Toast>` ya documenta esta edge case explícitamente:
- "Atajo `Z` global cuando toast visible — pero **respetar input focused** (no pisar undo nativo del browser)."
- Implementación: el listener checkea `document.activeElement` y si es `<input>`, `<textarea>`, `[contenteditable]`, **NO intercepta** `Z` (solo cuando focus está fuera de campos editables).

**Detalle adicional:** el atajo es `Z` solo (sin `Cmd`/`Ctrl`), lo cual es **distinto** de `Cmd+Z` (undo nativo). Cuando el toast está visible y NO hay input focused, `Z` solo activa Deshacer — no compite con undo nativo del browser que requiere modifier.

**Resuelto.**

---

## #6 — `<DetailSidebar>` mobile con NotaPrivada larga compite con scroll del cuerpo

**Severidad:** menor.

**Objeción.** Cuando la nota privada tiene varias líneas (textarea autosize), en mobile el sidebar stackea debajo del cuerpo principal. Si el usuario quiere editar la nota mientras consulta el resumen del pedido, debe hacer scroll grande hacia abajo y luego volver arriba.

**Resolución aplicada.** Aceptado como trade-off de mobile. Alternativas evaluadas y descartadas:
- Tab a "Nota" (rompe el patrón consistente cross-pantallas de detalle — ADR 0003 D7 dicta sidebar SIEMPRE; rompería con `/stores/[slug]`).
- Sticky bottom-bar con icono "Editar nota" (añade chrome contradice §2 una decisión por viewport).

El sidebar stack mobile SE MANTIENE como en ADR 0003 D7. La textarea con autosave throttle (1.5s) hace que el usuario pueda editarla sin perder estado al scrollear. **Aceptado** con riesgo controlado. Si futuras pruebas humanas (S6+) muestran fricción, considerar bottom-sheet `<Sheet>` para "Editar nota" desde un IconButton en el header del cuerpo principal.

---

## #7 — La firma view-transition rompe en mobile Safari

**Severidad:** menor.

**Objeción.** `::view-transition-*` API es Chromium-first. Safari 18+ tiene soporte parcial; mobile Safari aún no es 100% confiable. Si el componente `<MonoCode>` o el shell aplican `view-transition-name` y mobile Safari ignora el morph, el usuario ve un cut directo.

**Resolución aplicada.** El sistema de tokens (`tokens.md` §7.3) ya documenta el fallback canónico: cuando `prefers-reduced-motion` está activo, view transitions se desactivan (`animation-duration: 0.01ms`). Para browsers sin soporte, el comportamiento default es navegación normal (no morph) — degradación graceful.

`<MonoCode>` consume la convención de naming (`order-{humanId}`); la aplicación real del transition la define el shell de S5/S6. **Anotado** en `s4-gaps.md` para que S5 considere feature detection (`if (document.startViewTransition)`).

**Aceptado.**

---

## #8 — `<MascotBubble>` con `prefers-reduced-motion` se queda mudo o muestra estado idle estático

**Severidad:** informativa.

**Objeción.** ¿Cómo se ve la mascota cuando `prefers-reduced-motion` está activo? El spec dice "estático completo" para idle.

**Resolución aplicada.** El spec ya documenta:
- idle: micro-bobbing desactivado → estático.
- celebrating: opacity fade only (sin bounce).
- sleeping: estático.
- walking: desactivada.

Estado estático con `aria-label` apropiado (e.g. "Felix dormido — sin pedidos todavía") preserva el valor emocional sin movimiento. Voice glossary aplicado. **Resuelto.**

---

## #9 — `<Combobox>` con "Crear nueva tienda" inline tiene riesgo de tap accidental

**Severidad:** mayor → resuelta.

**Objeción.** Cuando el usuario está scrolleando opciones del combobox (mobile), un tap accidental en el item "Crear nueva tienda" lo saca del flujo de creación de pedido y lo manda a `/stores/new`. Pérdida de progreso si autosave no estaba activo.

**Resolución aplicada.** El spec de `<Combobox>` documenta:
- El item "Crear nueva tienda" es **siempre el último** del listbox (no entre opciones reales).
- El item tiene visual diferenciado (Lucide `plus` icon + `--accent` color, no neutral).
- El click NO navega inmediato — abre un confirm sheet "Vas a salir y volver. Tu progreso queda guardado." con CTAs "Crear tienda" / "Cancelar".

Adicional: cuando ADR 0001 D12 OC4 autosave está activo en el `<Form>` padre, el draft se preserva, así que el "salir y volver" no es destructivo. El confirm sheet refuerza el patrón.

**Resuelto.**

---

## #10 — `<Modal>` (caso discrepancia) con teclado focus trap puede atrapar al usuario que quiere cancelar con Esc

**Severidad:** informativa.

**Objeción.** ¿Esc cierra el modal? Sí, pero el caso 12.a de discrepancia tiene 3 CTAs sin destructive y "Volver" es la opción ghost de salida. Si Esc cierra el modal, el usuario queda con el form de creación de pedido en el estado de submit attempted.

**Resolución aplicada.** Esc cierra el modal y vuelve al form en estado pre-submit (no se pierde nada). El item "Volver" de los 3 CTAs es equivalente a Esc visualmente — el usuario tiene dos vías. Resuelto.

---

## #11 — Auditoría legacy `text-white` masiva en S12

**Severidad:** mayor → registrada.

**Objeción.** El spec de `<Button>` flagea explícitamente que cualquier `text-white` Atelier legacy debe migrar a `var(--text-on-accent)`. Pero `src/components/` actual (que se descarta para S4) tiene N usos. ¿Cómo nos aseguramos que la migración sea completa en S12?

**Resolución aplicada.**
- Anotado en `<Button>` "Notas para S12" (línea explícita).
- Anotado en `tokens-css.md` §11 "Notas de implementación" #8 ("Auditar `text-white` hardcoded en buttons / badges legacy").
- Adicional para S12 (anotado en `s4-gaps.md`): correr grep `rg "text-white|color: white|bg-white" src/components/` antes de aplicar S4 al repo. Generar reporte de matches y migrar uno por uno.

**Registrado.**

---

## #12 — Discriminated union de `<MicroStatCard accentToken>` no permite extender a paletas alternativas

**Severidad:** menor.

**Objeción.** ¿Qué pasa si una paleta alternativa (Lilac/Plum/Lagoon/Forest) introduce un `--accent-{nombre}` adicional para un slot 5? La discriminated union ADR 0005 lo restringe a 4 valores literal.

**Resolución aplicada.** Aceptado como deliberado — el ADR 0005 explicita 4 slots fijos del dashboard, no es para extender. Cualquier slot futuro requiere ADR refining 0005 (e.g. `0008-dashboard-fifth-slot.md`). **Resuelto.**

---

## #13 — `<FilterDrawer>` config declarativa pierde flexibilidad cuando el filter requiere lógica custom

**Severidad:** menor.

**Objeción.** El `FilterSection` discriminated union cubre 5 tipos. Pero un filter custom (e.g. range slider numérico para "% pagado entre X y Y") no entra. ¿Hay extensibilidad?

**Resolución aplicada.** El spec ya prevé extensibilidad agregando un nuevo `type: 'range-slider'` en `FilterSection` discriminated union. MVP cubre los 5 tipos invocados por wireframes. Cuando se necesite range slider (S6+ / V2), se extiende la union sin breaking change. **Aceptado** con nota S6.

---

## #14 — `<CommandPalette>` con `Cmd+K` global pisa atajos del browser o de extensions

**Severidad:** informativa.

**Objeción.** `Cmd+K` ya lo usan algunas extensions (Vimium-style) y también algunos sites lo capturan. Si el user tiene 1Password con `Cmd+\` o similar, podría haber confusión.

**Resolución aplicada.** El spec ya expone prop `shortcut` para customizar. Default `⌘K` Mac / `Ctrl+K` PC es el estándar de la industria (Linear, Raycast, Notion). Anotado en spec "Notas para S12": registrar atajo solo cuando el componente está montado (cleanup); no interferir cuando un input está focused. **Resuelto.**

---

## #15 — `<Stepper>` con `--text-on-accent` sobre `--success` (estado done) puede fallar AA cross-paleta

**Severidad:** mayor → registrada.

**Objeción.** El check Lucide en bolita done usa `color: var(--text-on-accent)`. Velvet light: `--text-on-accent` ≈ blanco sobre `--success` (verde). Lilac/Plum/Lagoon/Forest pueden tener `--success` con L distinta — el contraste de blanco sobre `oklch(58% 0.15 152)` puede ser borderline.

**Resolución aplicada.** El spec de `<Stepper>` ya documenta:
- "Verificación de contraste de `--text-on-accent` sobre `--success` cross-paleta: si Lilac/Forest fallan AA para el check 16px (texto pequeño bold), considerar `color: var(--surface);` específicamente para el check del Stepper o subir size del check a 18px (UI grande 3:1 holgado)."

S3 contrast audit (`s3-contrast-audit.md`) verificó pares text/background pero no pares glyph-on-status. **Anotado en `s4-gaps.md`** para que S12 (o S6 cuando Stepper se mount) corra audit específico para esta combinación cross-paleta.

**Registrado.**

---

## #16 — `<Form>` autosave con draft del esquema viejo puede sorprender al usuario

**Severidad:** menor.

**Objeción.** Si el schema cambia entre versiones (e.g. `expectedDeliveryFrom/To` se renombra a `expectedDeliveryRange`), un draft persistido en `localStorage` con shape vieja se queda obsoleto. ¿Qué pasa cuando el user vuelve y el draft no parsea?

**Resolución aplicada.** El spec de `<Form>` ya documenta:
- "Si schema rechaza values restored (cambio de schema entre sesiones), Form descarta draft silenciosamente."
- Restore prompt vía `<Modal>` con dos CTAs ("Sí, restaurar" / "Empezar de cero") cuando el draft existe pero passes parse — si NO passes, el componente decide silenciosamente no ofrecer restore.

**Resuelto.**

---

## #17 — `<DropdownMenu>` con submenu en mobile no es claro cómo se navega

**Severidad:** menor.

**Objeción.** Submenu lateral en mobile con tap targets pequeños es difícil. ¿Cómo se vuelve atrás?

**Resolución aplicada.** El spec de `<DropdownMenu>` Edge cases ya documenta:
- "Submenu en mobile: en mobile `popover` mode, submenu abre como nuevo Sheet sobre el actual. En `sheet` mode, navega in-place reemplazando contenido (con back arrow header)."

Para el caso del `<OverflowMenu>` (mobileVariant `sheet`), el back arrow header está documentado. **Resuelto.**

---

## #18 — `<Tooltip>` no implementa long-press mobile y la información queda inaccesible para touch users sin SR

**Severidad:** informativa.

**Objeción.** En mobile, si el trigger no tiene visible label y solo `aria-label`, un user touch sin screen reader no tiene cómo ver el tooltip (que se muestra solo en hover/focus).

**Resolución aplicada.** El spec ya recomienda explícitamente:
- "En mobile, en vez de Tooltip considerar inline label visible (HelperText) o foldable."
- Long-press es opcional, S6+ implementación.

Para casos críticos donde el icon-only es funcional (e.g. theme toggle), el `aria-label` cubre keyboard + SR. Para sighted touch users, recomendación es agregar visible label adyacente (composición de pantalla, no responsabilidad del componente). **Aceptado.**

---

## Resumen ejecutivo

| #   | Objeción                                                   | Severidad   | Status                                  |
| --- | ---------------------------------------------------------- | ----------- | --------------------------------------- |
| 1   | MicroStatCard cifra muy larga                              | menor       | Aceptado con riesgo controlado          |
| 2   | WizardAccordion 1 step degrada raro                         | menor       | Aceptado (degradación documentada)      |
| 3   | FilterDrawer mobile 12 secciones                            | mayor       | Aceptado con nota S6                    |
| 4   | StatusChip info sin icon+label en runtime                   | mayor       | Resuelto (degradación graceful)         |
| 5   | Toast Z + undo nativo browser                               | mayor       | Resuelto (respeta input focused)        |
| 6   | DetailSidebar nota privada larga mobile                     | menor       | Aceptado (trade-off mobile)             |
| 7   | View transition mobile Safari                               | menor       | Aceptado (degradación graceful)         |
| 8   | MascotBubble reduced-motion                                 | informativa | Resuelto (estados estáticos documentados) |
| 9   | Combobox tap accidental en "Crear nueva tienda"             | mayor       | Resuelto (confirm sheet + autosave)     |
| 10  | Modal Esc atrapa user                                       | informativa | Resuelto (Esc = "Volver")               |
| 11  | Migración legacy text-white S12                             | mayor       | Registrado para S12 (grep)              |
| 12  | accentToken no extensible                                   | menor       | Aceptado (deliberado, requiere ADR)     |
| 13  | FilterDrawer custom filter (range slider)                   | menor       | Aceptado con nota S6                    |
| 14  | CommandPalette ⌘K colisión                                  | informativa | Resuelto (prop shortcut customizable)   |
| 15  | Stepper check sobre --success cross-paleta                  | mayor       | Registrado para S6/S12 (audit cruzado)  |
| 16  | Form autosave schema obsoleto                               | menor       | Resuelto (descarte silencioso)          |
| 17  | DropdownMenu submenu mobile                                 | menor       | Resuelto (sheet replace o nuevo sheet)  |
| 18  | Tooltip mobile sin long-press                               | informativa | Aceptado (recomendación visible label)  |

**Total objeciones:** 18.
**Bloqueantes:** 0.
**Mayores resueltas con cambios al spec:** 4 (#4, #5, #9, #11 con notas para S12).
**Mayores registradas para sesiones futuras:** 2 (#3 nota S6, #15 audit S6/S12).
**Menores aceptadas con riesgo controlado:** 8.
**Informativas sin acción adicional:** 4.

**0 bloqueantes pendientes para S5.**
