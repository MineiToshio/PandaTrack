---
title: ADR 0008 — Modal Enhancement · Semantic Depth (M01) + Adaptive (S7-A.2)
date: 2026-05-03
last_extended: 2026-05-11
status: accepted
session: M01-modal-enhancement + S7-A.2-adaptive-modal
owner: Sergio Minei
updates: components/Modal.md, components/Sheet.md
sources:
  - _notes/demo-screens.html (18 secciones M01 — versiones A, B, C × 6 casos de uso)
  - _notes/demo-screens.html (S7 mobile sections — bottom sheets aplicados)
  - _notes/cross-cutting-changes.md (entrada M01)
---

# ADR 0008 — Modal Enhancement · Semantic Depth

## Contexto

Durante la exploración del módulo S6 (Tiendas), el componente `<Modal>` fue marcado como cross-cutting change M01 (Tipo 2 — cambio mayor de componente core). El diagnóstico: el modal se percibía como **plano y genérico** — un recuadro blanco con título, body y botones sin ninguna señal visual que comunicara tono, urgencia o identidad Atelier.

La spec original de `Modal.md` (S4) definía:

- Backdrop `--surface-overlay` sin blur
- `border-radius: var(--radius-xl)` (16px)
- Header plano: solo `<h2>` + `description` + close button
- Footer: `border-top: 1px solid var(--border)` pero con `background: var(--surface)` en lugar del fondo elevado
- Enter: `scale(0.96 → 1) + opacity`, easing `--ease-out-expressive`

El diseño no comunicaba semántica de acción (destructiva vs informativa vs form), y la entrada carecía de "peso" visual.

## Exploración

Se implementaron 3 versiones × 6 casos de uso reales en el demo HTML (`_notes/demo-screens.html`, secciones `m01-va-*`, `m01-vb-*`, `m01-vc-*`) y se evaluaron con el humano:

### Versión A — Editorial Quiet

Tipografía como única voz. Sin íconos en el header. Título 22px / 700. Padding 28px. El tono se comunica solo por el color del CTA. Referentes: Linear, Plain, Stripe.

### Versión B — Semantic Depth ✅ ELEGIDA

Ícono circular 48px (`border-radius: 24px`) con fondo tonal al 14% del color semántico. Header en fila flex: [icon-circle] + [título + subtítulo + close]. `border-top` divider sobre el footer. Referentes: Stripe Dashboard, Polaris, Carbon.

### Versión C — Atelier Hero

Hairline 2px de acento en el tope. Eyebrow monoespaciado 10px uppercase. Ícono centrado 40px con halo radial (`--m01c-tone`). Centrado horizontal completo. Referente: Apple HIG + firma PandaTrack.

## Decisión

**Versión B (Semantic Depth)** aprobada por el humano.

### Especificación aprobada

#### Overlay (backdrop + container unificados)

| Propiedad            | Valor                                                               |
| -------------------- | ------------------------------------------------------------------- |
| `position`           | `fixed`                                                             |
| `inset`              | `0`                                                                 |
| `z-index`            | `var(--z-modal)` (80) — ver nota z-index                            |
| `display`            | `flex; align-items: center; justify-content: center; padding: 16px` |
| `backdrop-filter`    | `blur(8px)` + `-webkit-backdrop-filter: blur(8px)`                  |
| `background` (light) | `oklch(12% 0.010 50 / 0.35)`                                        |
| `background` (dark)  | `oklch(4% 0.015 265 / 0.62)`                                        |

> **Nota z-index:** La nueva overlay unifica backdrop + card en un único elemento `position: fixed`. El valor de token sigue siendo `--z-modal: 80`. El toast (`--z-toast: 90`) sigue por encima — el stacking se preserva por DOM order cuando ambos coexisten.

#### Modal card

| Propiedad            | Valor                                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `max-width`          | `460px`                                                                                                                             |
| `width`              | `100%`                                                                                                                              |
| `background`         | `var(--surface-elevated)`                                                                                                           |
| `border`             | `1px solid var(--border-strong)`                                                                                                    |
| `border-radius`      | `20px` (`--radius-2xl`)                                                                                                             |
| `overflow`           | `hidden`                                                                                                                            |
| `box-shadow` (light) | `0 14px 28px oklch(20% 0.020 50 / 0.10), 0 2px 6px oklch(20% 0.020 50 / 0.06)`                                                      |
| `box-shadow` (dark)  | `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 1px var(--border-strong), 0 0 24px color-mix(in oklch, var(--accent) 5%, transparent)` |

#### Header

```
[icon-circle 48px] [gap 16px] [header-text flex-col]
                               ├─ [row: <h2 title>] [close button]
                               └─ [<p subtitle> — opcional]
padding: 24px 24px 0
```

#### Icon circle

| Clase / Tone       | Background                                                             | Color                |
| ------------------ | ---------------------------------------------------------------------- | -------------------- |
| `tone-default`     | `color-mix(in oklch, var(--accent) 14%, var(--surface-elevated))`      | `var(--accent)`      |
| `tone-destructive` | `color-mix(in oklch, var(--destructive) 14%, var(--surface-elevated))` | `var(--destructive)` |
| `tone-warning`     | `color-mix(in oklch, var(--warning) 14%, var(--surface-elevated))`     | `var(--warning)`     |
| `tone-info`        | `color-mix(in oklch, var(--info) 14%, var(--surface-elevated))`        | `var(--info)`        |

Dimensiones: `48px × 48px`, `border-radius: 24px`. Ícono interior: `20px`, `stroke-width: 1.75`.

#### Body

`padding: 16px 24px 4px; overflow-y: auto; flex: 1`

#### Footer

`padding: 12px 24px 20px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 8px`

#### Animación de entrada

```css
@keyframes modal-spring {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
/* duración: 280ms — easing spring sintético */
animation: modal-spring 280ms linear(0, 0.5, 0.85, 0.97, 1) both;
```

Equivalente a `--ease-out-expressive` (spring) con `--motion-base` (280ms).

`@media (prefers-reduced-motion: reduce)`: solo opacity, sin scale.

## Justificación

1. **Señal semántica sin sobrecarga.** El icon-circle con fondo tonal al 14% transmite tono (rojo = destructivo, ámbar = warning) sin dominar la composición. La opacidad baja es suficiente para el usuario con visión de color; el ícono mismo actúa como señal orthogonal (ADR 0006 cumplido).
2. **Equilibrio entre B y C.** La Versión A era demasiado neutra (ambigüedad semántica). La Versión C era demasiado dominante para casos frecuentes (confirm, form, info). La Versión B tiene personalidad sin convertirse en el protagonista.
3. **Consistencia con referentes industriales.** Stripe Dashboard, Polaris y Carbon usan exactamente este patrón: icon circle tonal + título en línea + divider de footer. Es legible, familiar y directamente escalable.
4. **Backdrop blur Atelier.** `blur(8px)` con tint oklch calibrado es más sofisticado que `--surface-overlay` plano. Comunica profundidad (layered design) y refuerza la identidad Atelier sin romper a11y.
5. **Spring animation.** `linear(0, 0.5, 0.85, 0.97, 1)` produce una entrada que "aterriza" con convicción en lugar del scale mecánico anterior. Consistente con la personalidad 18–25 del sistema.

## Costo y riesgo

- **Bajo.** Cambio puramente visual — no afecta el contrato funcional del modal ni la API TypeScript de manera rompedora (solo se agregan props opcionales).
- `description` prop se renombra a `subtitle` semánticamente (posición: en el header, no en el body). La prop `description` queda como alias deprecado en S12.
- El backdrop unificado (backdrop + card en un div flex) simplifica la implementación vs el enfoque anterior de dos capas separadas.
- `border-radius: 20px` supera `--radius-xl` (16px) actual. Se asigna a `--radius-2xl` — confirmar valor en `tokens.md` antes de S12.

## Implicancias

1. `components/Modal.md` — actualizado en este cierre: API TypeScript, estados visuales, motion, tokens.
2. `_notes/cross-cutting-changes.md` — M01 marcado `✅ aplicado`.
3. `_notes/demo-screens.html` — 18 secciones M01 sirven como referencia visual vinculante. La implementación React en S12 debe replicar Version B.
4. `tokens.md` — confirmar `--radius-2xl: 20px` en S12 si no está definido.
5. ADR 0001 D4 (toast > modal z-index) sigue válido — `--z-toast: 90` > `--z-modal: 80`.

## Audit AA — contraste

Verificación de pares foreground/background del modal Version B contra WCAG AA (4.5:1 texto normal, 3:1 texto grande/UI).

| Par                                                | Contexto                 | AA (light)                          | AA (dark) |
| -------------------------------------------------- | ------------------------ | ----------------------------------- | --------- |
| `--text-primary` sobre `--surface-elevated`        | Título, body text        | ✅ pasa                             | ✅ pasa   |
| `--text-secondary` sobre `--surface-elevated`      | Subtitle, descripción    | ✅ pasa                             | ✅ pasa   |
| `--destructive` sobre `color-mix(…14%…)`           | Ícono tono destructive   | ✅ pasa                             | ✅ pasa   |
| `--warning` sobre `color-mix(…14%…)`               | Ícono tono warning       | ✅ pasa                             | ✅ pasa   |
| `--info` sobre `color-mix(…14%…)`                  | Ícono tono info          | ✅ pasa                             | ✅ pasa   |
| `--accent` sobre `color-mix(…14%…)`                | Ícono tono default       | ✅ pasa                             | ✅ pasa   |
| CTA primary (`--text-on-accent` sobre `--accent`)  | Botón primario           | ✅ pasa                             | ✅ pasa   |
| CTA destructive (blanco sobre `--destructive`)     | Botón eliminar           | ✅ pasa                             | ✅ pasa   |
| `--text-primary` sobre backdrop `oklch(12%…/0.35)` | Texto detrás del overlay | N/A — texto del modal, no del fondo |           |
| Close button icon sobre `--surface-elevated`       | IconButton x en header   | ✅ pasa (usa `--text-secondary`)    |           |

Nota: el 14% de mezcla en los icon-circle backgrounds produce un tinte suave; el color del ícono mismo (`--destructive`, `--warning`, etc.) es el texto-grande semántico y cumple 3:1 contra el fondo tonal. Los tones siguen ADR 0006 (ícono + label — la semántica no descansa solo en el color).

> **Sheet mobile**: `<Sheet>` (contraparte mobile del modal) aplica el mismo `backdrop-filter: blur(8px)` con los oklch calibrados — decisión confirmada en cierre de M01. `--surface-overlay` eliminado también en Sheet. Ver `components/Sheet.md` (estado Backdrop).

## Confianza

**Alta.** Aprobado directamente por el humano tras ver las 3 versiones en el demo interactivo (light + dark + 5 paletas). Sin ambigüedad en la decisión.

## Próximos pasos

1. `components/Modal.md` actualizado ✅ (en este cierre).
2. En S12 (implementación): replicar Version B en React usando los tokens y recetas de este ADR.
3. Confirmar `--radius-2xl: 20px` en `tokens.md` al inicio de S12.

---

## Extensión 2026-05-11 — Adaptive Modal Pattern (mobile bottom sheet)

> Esta extensión NO modifica la decisión original. Formaliza la variante responsive: en mobile el mismo componente lógico se renderiza como **bottom sheet**, en desktop como **centered dialog**. Versión B (Semantic Depth) sigue vigente como contrato visual desktop.

### Contexto

Durante S7 Fase A.2 (rediseño mobile del módulo Orders, 2026-05-11), se aplicó intuitivamente el patrón **bottom sheet** en mobile para confirmaciones destructivas (eliminar/cancelar pedido), forms cortos (anotar pago, añadir producto), pickers (tipo de producto) y action menus (⋯ Más acciones). La pregunta humana fue: ¿es esto el patrón canónico mobile, y por lo tanto modificamos ADR 0008?

Investigación externa (agente con 14 fuentes citadas, 2026-05-11) concluyó:

- **Apple HIG (iOS 15+)** estandarizó `Sheet` como default para tareas scoped, con detents nativos. Action sheets son patrón distinto para listas de acciones.
- **Material Design 3** posiciona modal bottom sheet como alternativa canónica a inline menus y dialogs simples en mobile.
- **NN/g**: bottom sheets son menos intrusivos que dialogs centrados y aprovechan 3 de los 4 bordes del viewport.
- **Thumb zone reach (Hoober, Smashing)**: ~75% de interacciones son con el pulgar; bottom 25–40% del viewport es la "natural zone".
- **Fintech engagement data**: 25–30% más engagement con bottom sheets vs modales centrados (Doha Bank, Niyo).
- **Industry usage 2024–2026**: Stripe Checkout, Apple Pay, Apple Maps, Linear mobile, Notion mobile, banking apps modernas.
- **Stack web canónico**: Radix Dialog (base accesible) + Vaul / shadcn Drawer (mobile drawer con snap points) + adaptive wrapper estilo Credenza (`useIsMobile()` ≤768px → Drawer, else → Dialog).

### Decisión

**Adoptar el patrón "adaptive modal"** como contrato canónico en `src/`:

- **Desktop (≥768px)**: el `<Modal>` mantiene la spec de Version B (centered, Semantic Depth, icon-circle tonal, etc.) tal cual está documentada arriba.
- **Mobile (<768px)**: el mismo componente lógico renderiza como **bottom sheet**, con la siguiente spec.

### Spec del bottom sheet (mobile)

| Propiedad         | Valor                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| `position`        | `fixed; bottom: 0; left: 0; right: 0; z-index: var(--z-modal)`                                      |
| `background`      | `var(--surface-elevated)`                                                                           |
| `border-top`      | `1px solid var(--border-strong)`                                                                    |
| `border-radius`   | `20px 20px 0 0` (`--radius-2xl` solo en top corners)                                                |
| `max-height`      | `78%` del viewport (o `90%` para detent `large`)                                                    |
| `box-shadow`      | `0 -8px 32px color-mix(in oklch, var(--text-primary) 22%, transparent)` (sombra hacia arriba)       |
| `padding-bottom`  | `calc(N + env(safe-area-inset-bottom))` — respeta home indicator de iOS                             |
| Backdrop          | mismo `backdrop-filter: blur(8px)` + tint oklch calibrado de la Version B                           |
| Drag handle       | 36×4 px, `border-radius: 999px`, `background: var(--border-strong)`, margin 8px auto 4px            |
| Animación entrada | `transform: translateY(100%) → 0` + opacity, duración 280ms, easing `linear(0, 0.5, 0.85, 0.97, 1)` |

### Header del bottom sheet

Mantiene el icon-circle tonal de Version B (48px, mismas reglas por tone) cuando el caso lo justifica (confirm destructive, alert). Para action menus y pickers, se usa header simplificado: solo título + close button (X) sin icon-circle.

### Footer del bottom sheet

Sticky `position: sticky; bottom: 0;` con `border-top: 1px solid var(--border)`, `background: var(--surface-elevated)`, padding-bottom respetando `env(safe-area-inset-bottom)`. Botones full-height `min-height: 44px` (HIG tap target).

### Mapping de casos del módulo Orders

| Caso                    | Mobile                            | Desktop            | ARIA role       | Icon-circle tone        |
| ----------------------- | --------------------------------- | ------------------ | --------------- | ----------------------- |
| Eliminar pedido         | Bottom sheet                      | Centered dialog    | `alertdialog`   | `destructive`           |
| Cancelar pedido         | Bottom sheet                      | Centered dialog    | `alertdialog`   | `warning`               |
| Discrepancia de total   | Bottom sheet                      | Centered dialog    | `alertdialog`   | `warning`               |
| Anotar pago             | Bottom sheet                      | Centered dialog    | `dialog`        | `default` o sin icon    |
| Añadir producto         | Bottom sheet                      | Centered dialog    | `dialog`        | sin icon                |
| ⋯ Más acciones          | Bottom sheet                      | Popover (no modal) | `dialog`/`menu` | sin icon (action sheet) |
| Picker tipo de producto | Bottom sheet                      | Popover/dropdown   | `dialog`        | sin icon (picker)       |
| FX Reconciliación       | **Full-screen sheet** (excepción) | Centered dialog L  | `dialog`        | sin icon                |

> **Excepción full-screen**: cuando el contenido es demasiado largo o complejo (>4 secciones / scroll significativo), el bottom sheet se reemplaza por full-screen sheet (cubre 100% del viewport del contenedor). Caso actual: FX Reconciliación.

### Stack técnico a implementar (Fase B)

**Decisión 2026-05-11**: NO usar Radix Dialog como dep top-level. El Modal canónico actual (`src/components/modules/Modal/Modal.tsx`, 383 líneas hand-rolled) ya implementa focus trap, Portal, ARIA, Esc, scroll lock — no necesita reemplazo. Solo se extiende con una variante mobile.

**Arquitectura de 3 componentes + 1 shared**:

```
src/components/modules/Modal/
├── Modal.tsx           ← Público. Smart wrapper. Usa useIsMobile, delega.
├── ModalDialog.tsx     ← Internal. Desktop centered (el actual Modal renombrado).
├── ModalSheet.tsx      ← Internal. Mobile bottom sheet (NEW, usa Vaul).
├── ModalContent.tsx    ← Internal. Header (icon-circle + title + close) + Footer (actions). Shared.
├── Modal.types.ts      ← Props compartidas entre Dialog y Sheet.
├── index.ts            ← Solo exporta <Modal>. ModalDialog/Sheet/Content NO se exportan.
└── _tests/
```

**Componentes**:

1. **`<Modal>`** (público, ~30 líneas): smart wrapper. Usa `useIsMobile()`. Si mobile → renderiza `<ModalSheet>`. Si desktop → renderiza `<ModalDialog>`. Es lo único que importan los 15 callsites del módulo Orders y los 7 de Settings/Stores. **El API público no cambia** — cero migración de callsites.

2. **`<ModalDialog>`** (internal, ~350 líneas): el código actual de Modal.tsx renombrado. Sin cambios funcionales. Sigue siendo hand-rolled (focus trap propio, Portal propio, ARIA, Esc, scroll lock). Sin deps externas.

3. **`<ModalSheet>`** (internal, ~150 líneas, NEW): mobile bottom sheet. Usa [Vaul](https://vaul.emilkowal.ski/) para drag-to-dismiss + snap points + safe-area. Renderiza `<ModalContent>` adentro del Drawer.Content.

4. **`<ModalContent>`** (internal shared, ~150 líneas): subcomponentes compartidos. Header (icon-circle tonal + title + description + close), Body, Footer (primary/secondary/tertiary actions). Reusado por Dialog y Sheet — DRY garantizado.

5. **`useIsMobile()`** hook (~15 líneas, NEW): `window.matchMedia('(max-width: 767px)')` con listener + SSR-safe initial state.

**Dependencias**:

- **NUEVA**: `vaul` (única dep nueva). Radix Dialog viene como **transitive** dentro de Vaul — NO se importa directamente, NO aparece en `package.json` top-level. Bundle: ~15KB gzipped.
- **NO se agrega**: `@radix-ui/*` (banned como top-level dep per ADR 0010 — UI Primitive Libraries Approval Policy).
- **Existing**: `lucide-react` (ya en el proyecto).

**Estilos**: Tailwind v4 + tokens semánticos del rediseño. Cero estilos hardcoded.

**Governance**: ver ADR 0010 — `vaul` es la única lib UI aprobada como dep top-level. Cualquier futura adición requiere ADR explícito.

### Costo estimado (actualizado 2026-05-11)

Con la arquitectura final (Modal smart wrapper + ModalDialog + ModalSheet + ModalContent shared + Vaul):

| Tarea                                                                                                     | Tiempo      |
| --------------------------------------------------------------------------------------------------------- | ----------- |
| `useIsMobile()` hook                                                                                      | 15 min      |
| Renombrar Modal.tsx → ModalDialog.tsx + cleanup imports                                                   | 30 min      |
| Extraer ModalContent.tsx con Header/Body/Footer compartidos                                               | 2-3 horas   |
| Instalar Vaul + crear ModalSheet.tsx usando Drawer + ModalContent                                         | 3-4 horas   |
| Crear Modal.tsx wrapper (smart, ~30 líneas)                                                               | 30 min      |
| Migrar 7 ad-hoc dialogs identificados en audit (AvatarField, Settings, Stores, etc.) → `<Modal>` canónico | 1-1.5 días  |
| E2E + visual regression en mobile + desktop (matching ADR 0008 Version B + bottom sheet spec)             | 0.5 día     |
| Audit `package.json`: confirmar `vaul` presente, `@radix-ui/*` ausente como top-level                     | 5 min       |
| **Total**                                                                                                 | **~3 días** |

**Cero migración de los 15 callsites canónicos** del Modal actual — siguen importando `<Modal>` que ahora es smart-adaptive. Solo cambian los 7 ad-hoc que se migran al canónico.

**Hacerlo ANTES de Fase B de Orders Parte 1 (listado).** Si se difiere, los modales nuevos de Orders se implementan con patrón obsoleto y hay reescritura posterior.

### Cuándo el centered modal SIGUE siendo correcto en mobile (excepciones)

- Photo viewers / media lightbox → full-screen, no sheet.
- Wizards multistep muy largos → full-screen page (no sheet con scroll infinito).
- Alertas no-destructivas muy cortas tipo "Sesión expirada" → centered pequeño.

**Ninguno de los modales actuales de Orders cae en estos casos.**

### Justificación de la extensión

1. **Industry standard 2024–2026** consolidado: Apple HIG + Material 3 + NN/g + adopción universal (Stripe, Linear, Notion, banking).
2. **Thumb zone reach** con datos duros (Hoober): mejora medible 25–30% engagement.
3. **Compatible con ADR 0008 original**: el bottom sheet hereda Semantic Depth (mismo icon-circle, mismos tones, mismo backdrop blur). Solo cambia el posicionamiento del contenedor.
4. **Stack canónico React/Next.js**: Radix + Vaul es el estándar 2026 con accessibility resuelta. Cero deuda técnica.
5. **Costo bajo, riesgo bajo**: 2.5–4 días totales, único upfront cost antes de Fase B.

### Implicancias adicionales (de esta extensión)

1. `components/Modal.md` debe agregarse una sección "Variante responsive (mobile bottom sheet)" referenciando esta extensión.
2. `components/Sheet.md` debe absorber esta spec como su contrato visual canónico (ya estaba alineado parcialmente per nota en Version B).
3. `PLAYBOOK.md` §1 (Modal) + §3 (patrones canónicos) deben referenciar la arquitectura: callsites usan `<Modal>` (smart wrapper); ModalDialog/ModalSheet son internos.
4. En Fase B de cualquier módulo: usar `<Modal>` desde día 1 — automáticamente es adaptive (renderiza ModalDialog en desktop, ModalSheet en mobile). Prohibido implementar modales centrados manualmente en mobile.
5. **Governance de libs UI**: ver ADR 0010 — `vaul` es la única lib UI aprobada como dep top-level. Radix Dialog NO se importa directamente (queda transitivo dentro de Vaul).
5. Mantener cursor rule `modal-canonical-pattern.mdc` vigente. Extender para mencionar que bottom sheet mobile NO es excepción al canónico — es el mismo componente en variante responsive.

### Fuentes externas (citadas en investigación)

- [NN/g — Bottom Sheets: Definition and UX Guidelines](https://www.nngroup.com/articles/bottom-sheet/)
- [Material Design 3 — Bottom sheets guidelines](https://m3.material.io/components/bottom-sheets/guidelines)
- [Apple HIG — Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets)
- [Apple HIG — Modality](https://developer.apple.com/design/human-interface-guidelines/modality)
- [Apple HIG — Action sheets](https://developer.apple.com/design/human-interface-guidelines/action-sheets)
- [Smashing — The Thumb Zone](https://www.smashingmagazine.com/2016/09/the-thumb-zone-designing-for-mobile-users/)
- [Radix UI — Dialog primitive](https://www.radix-ui.com/primitives/docs/components/dialog)
- [shadcn/ui — Drawer (Vaul)](https://ui.shadcn.com/docs/components/radix/drawer)
- [Credenza — Auto-Adaptive Dialog + Drawer](https://github.com/redpangilinan/credenza)
- [MDN — ARIA dialog role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/dialog_role)
- [MDN — ARIA alertdialog role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/alertdialog_role)
- [W3C APG — Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [LogRocket — Sheets vs dialogs vs snackbars](https://blog.logrocket.com/ux-design/sheets-dialogs-snackbars/)
- [Mobbin — Bottom Sheet UI Design glossary](https://mobbin.com/glossary/bottom-sheet)

### Confianza

**Alta.** Validación cruzada con guidelines oficiales (Apple HIG, Material 3, NN/g, W3C APG) + adopción industrial unánime + datos cuantitativos de engagement. Decisión humana explícita 2026-05-11 tras revisar el informe del agente.
