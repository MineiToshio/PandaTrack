---
title: Stepper
tier: 2
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0003 D5 (wizard accordion + step indicator refleja accordion)
  - ADR 0001 D3 (disabled sin opacity)
  - ADR 0001 D12 OC3 (steps navegables, no gating estricto)
---

# Stepper

## Propósito

Barra horizontal con bolitas numeradas que refleja el estado del [`./WizardAccordion.md`](./WizardAccordion.md). Aparece arriba del wizard (sticky bajo el header) en `/orders/new`, `/deliveries/new`, `/stores/new`. Muestra progreso visible + permite navegación libre entre pasos (ADR 0001 D12 OC3 — steps navegables, no gating estricto). Cada bolita comunica `todo` / `active` / `done` con tokens funcionales.

## API TypeScript

```ts
type StepState = "todo" | "active" | "done";

type StepperItem = {
  n: number; // número del paso (1-indexed)
  eyebrow?: string; // "PASO 1 · TIENDA" — opcional, mobile suele ocultar
  label: string; // "¿Dónde lo compraste?"
  state: StepState;
  summary?: string; // "Akiba Records" — visible cuando state==='done'
};

type StepperProps = {
  steps: StepperItem[];
  /** Click handler — habilitado por ADR 0001 D12 OC3 (navegación libre). */
  onStepClick?: (n: number) => void;
  /** Default `md`. */
  size?: "sm" | "md";
  /** Aria-label del wrapper nav. */
  ariaLabel?: string;
};
```

## Variants / Sizes

| Variant        | Uso                                                  | Tokens consumidos                                                           |
| -------------- | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| `md` (default) | Wizard accordion en `/orders/new`, `/deliveries/new` | bolita 32×32, gap `--space-3`, line `1px solid var(--border)` entre bolitas |
| `sm`           | Wizard compacto (no usado en MVP, reservado)         | bolita 24×24, gap `--space-2`                                               |

## Estados visuales (bolita)

| Estado                | Receta CSS (light + dark)                                                                                                                                                                                                                                                                                                                    | Notas                                                                                                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `todo`                | `width: 32px; height: 32px; border-radius: var(--radius-pill); background: var(--surface-elevated); border: 1px solid var(--border-strong); color: var(--text-muted); display: inline-flex; align-items: center; justify-content: center; font-family: var(--font-mono); font-size: var(--text-mono); font-weight: var(--font-weight-mono);` | Número visible. Border `--border-strong` ≥3:1 sobre fondo (UI components AA).                                                                                                             |
| `active`              | `background: var(--accent); border: 1px solid var(--accent); color: var(--text-on-accent);` + outer ring opcional `box-shadow: 0 0 0 4px color-mix(in oklch, var(--accent) 16%, transparent);`                                                                                                                                               | `--text-on-accent` es **oscuro en dark** — crítico, ver `tokens.md` §1.3.                                                                                                                 |
| `done`                | `background: var(--success); border: 1px solid var(--success); color: var(--text-on-accent);` + glyph Lucide `check` 16×16 reemplaza el número                                                                                                                                                                                               | Verificación de contraste de `--text-on-accent` sobre `--success`: cross-paleta debe pasar AA (validar en S12). Si falla cross-paleta, fallback a `color: var(--surface);` para el check. |
| `hover` (interactive) | Overlay state-layer 6%/8% sobre la bolita. Cursor pointer. No cambia colores base.                                                                                                                                                                                                                                                           | Solo cuando `onStepClick` está provisto.                                                                                                                                                  |
| `focus`               | `outline: 2px solid var(--focus-ring); outline-offset: 2px;` (visible en `:focus-visible`)                                                                                                                                                                                                                                                   | Bolita es `<button>` cuando hay `onStepClick`.                                                                                                                                            |
| `disabled`            | `color: var(--text-muted); border-color: var(--border); pointer-events: none;` (sin opacity)                                                                                                                                                                                                                                                 | ADR 0001 D3.                                                                                                                                                                              |

Connector lines entre bolitas: `1px solid var(--border)` (`todo`→`todo`, `active`→`todo`) o `var(--success)` cuando ambos extremos son `done` (línea de progreso completada). Animación de "fill" al avanzar: `--motion-base` `--ease-out-expressive`.

Wrapper container:

```css
.stepper {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) 0;
}

.stepper__step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}

.stepper__connector {
  flex: 1;
  height: 1px;
  background: var(--border);
  min-width: var(--space-4);
}

.stepper__connector--done {
  background: var(--success);
}
```

Eyebrow + summary debajo de la bolita en `--text-eyebrow` `--text-muted` (eyebrow uppercase mono) y `--text-caption` `--text-secondary` (summary).

## Mobile vs desktop

- **Mobile** (`< --breakpoint-md`): scroll horizontal con sticky shadow lateral. Eyebrow opcional oculto (`hidden md:block`); solo número + summary corto. Tap target ≥44×44 mediante padding. Sticky justo bajo el `--header-h` mobile (56px).
- **Desktop** (`≥ --breakpoint-md`): bolitas + eyebrow + summary visibles, distribuidas con gap uniforme. Sticky bajo `--header-h-desktop` (64px).

## Accesibilidad

- Wrapper: `<nav aria-label="Progreso del formulario" role="navigation">` o `<ol aria-label="...">` con steps como `<li>`.
- Cada step: si `onStepClick` provisto, `<button type="button" aria-current={state === 'active' ? 'step' : undefined} aria-label="Paso {n}: {label}. Estado: completado/activo/pendiente">`.
- Si `onStepClick` ausente: `<span role="img" aria-label="...">` (no focuseable).
- Keyboard: si interactive, `Tab` navega entre bolitas, `Enter`/`Space` activa onClick. `ArrowRight`/`ArrowLeft` opcional para saltar entre bolitas (parity con Tabs).
- Screen reader anuncio del cambio de paso: el `<WizardAccordion>` controla el live-region; el Stepper solo publica estado via `aria-current`.
- `prefers-reduced-motion`: connector fill anima instantáneo; no animación entrada de bolita active.

## Motion

- Cambio de bolita `todo → active`: `--motion-fast` `--ease-emphasis` para color/border. Outer ring (16%) entra con `--motion-fast`.
- Cambio de bolita `active → done`: el background transiciona de `--accent` a `--success` con `--motion-fast`; el glyph `check` entra con scale 0.6→1 + opacity 0→1 con `--motion-base` `--ease-bounce` (suave celebración pequeña).
- Connector fill: scaleX 0→1 desde la bolita izquierda con `--motion-base` `--ease-out-expressive`.
- `prefers-reduced-motion`: todas las transitions reducen a `--motion-fast` opacity-only.

## Copy default + i18n

| Clave i18n sugerida                        | Valor ES (voice glossary aplicado) |
| ------------------------------------------ | ---------------------------------- |
| `components.stepper.stateAriaLabel.todo`   | "Pendiente"                        |
| `components.stepper.stateAriaLabel.active` | "En curso"                         |
| `components.stepper.stateAriaLabel.done`   | "Completado"                       |
| `components.stepper.stepAriaLabel`         | "Paso {n}: {label}. {state}"       |
| `components.stepper.scrollHint`            | "Deslizá para ver más pasos"       |

## Edge cases

1. **Un solo step:** componente degrada a una sola bolita visible sin connector. El wizard accordion también degrada (sin step indicator) — coordinar con `<WizardAccordion>`.
2. **Más de 7 steps:** mobile hace scroll-x; desktop también hace scroll-x si no entra. No truncar (cada step debe ser visible y clickable). Si el formulario tiene >7 steps, reconsiderar la división (probablemente debería ser flujo separado).
3. **Step `done` clickado para volver atrás:** el componente solo emite `onStepClick(n)` — el `<WizardAccordion>` decide si re-abrir el step, mantiene el `done` state hasta que el user vuelva a "Continuar".
4. **Step `todo` clickado adelantado:** ADR 0001 D12 OC3 permite navegación libre. El componente emite `onStepClick(n)`; el wizard decide si abrir directo o validar pasos previos.
5. **Wizard con autosave:** el Stepper no tiene relación con autosave. El `<Form>` orquesta autosave; el Stepper solo refleja state.
6. **Step disabled (gating estricto):** si un step debe quedar inaccesible (ej. step 4 requiere step 3 completado), el padre setea `state: "todo"` y NO provee `onStepClick` para ese step específico, o usa una variante interna `disabled` (no en API pública MVP).

## Anti-patrones

1. **Nunca opacity** en bolitas — `todo` ya es visualmente más débil por tokens (border + text muted).
2. **Nunca íconos diferentes en bolitas done** — siempre `check`. Variar genera ruido visual.
3. **Nunca colorear bolitas con `--accent-cool` o `--accent-warm`** — solo `--accent` (active), `--success` (done), `--surface-elevated` + `--border-strong` (todo). El stepper no es decorativo.
4. **Nunca animaciones >`--motion-base`** — el stepper es estructural, no celebratorio. La micro-celebración del `done` (bounce del check) es la única excepción.
5. **Nunca renderizar text-only sin bolita** — la bolita es el ancla visual y el target táctil.

## Ejemplos de uso

```tsx
// Order create wizard (5 pasos, paso 3 activo)
<Stepper
  ariaLabel="Progreso del nuevo pedido"
  onStepClick={(n) => wizard.activate(n)}
  steps={[
    { n: 1, eyebrow: "PASO 1 · TIENDA", label: "¿Dónde lo compraste?", state: "done", summary: "Akiba Records" },
    { n: 2, eyebrow: "PASO 2 · FECHAS", label: "¿Cuándo?", state: "done", summary: "12 abr → 22 may" },
    { n: 3, eyebrow: "PASO 3 · ITEMS", label: "Qué pediste", state: "active" },
    { n: 4, eyebrow: "PASO 4 · COSTOS", label: "Total y moneda", state: "todo" },
    { n: 5, eyebrow: "PASO 5 · LISTO", label: "Revisa y guarda", state: "todo" },
  ]}
/>
```

## Tokens consumidos

`--surface-elevated`, `--accent`, `--success`, `--border`, `--border-strong`, `--text-muted`, `--text-secondary`, `--text-on-accent`, `--focus-ring`, `--font-mono`, `--font-weight-mono`, `--text-mono`, `--text-eyebrow`, `--text-caption`, `--space-1`, `--space-2`, `--space-3`, `--space-4`, `--radius-pill`, `--motion-fast`, `--motion-base`, `--ease-emphasis`, `--ease-out-expressive`, `--ease-bounce`, `--state-hover-mix`.

## ADRs aplicables

- [`../decisions/0003-demo-decisions.md`](../decisions/0003-demo-decisions.md) D5 (Stepper refleja accordion).
- [`../decisions/0001-s2-closure-decisions.md`](../decisions/0001-s2-closure-decisions.md) D3 (sin opacity), D12 OC3 (steps navegables).

## Dependencias

Composible dentro de [`./WizardAccordion.md`](./WizardAccordion.md) (relación uno-a-uno). Reusa el state shared de `WizardAccordionContext`.

## Notas para S12 (implementación)

- Verificar `--text-on-accent` sobre `--success` cross-paleta. Si Lilac/Forest fallan AA para el check 16px (texto pequeño bold), considerar `color: var(--surface);` específicamente para el check del Stepper o subir size del check a 18px (UI grande 3:1 holgado).
- Bolita render como `<button>` solo cuando `onStepClick` está provisto. Si no, render como `<span>` no-focuseable.
- Connector progress fill: implementar con `transform: scaleX` + `transform-origin: left` para evitar layout shift.
- Mobile sticky bajo header: usar `position: sticky; top: var(--header-h);` con `z-index: var(--z-sticky)`.
