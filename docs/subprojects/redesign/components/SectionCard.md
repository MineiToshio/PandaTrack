---
title: SectionCard
tier: 2
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0001 D3 (section card gated — sin opacity, sub-bloque guía con lock 24px)
  - ADR 0003 D5 (WizardAccordion — un paso expandido a la vez; SectionCard es la base estructural)
---

# SectionCard

## Propósito

Base estructural de cada paso del wizard accordion en formularios largos. Aparece en cada paso de [`order-create.md`](../screens/order-create.md) ("PASO 1 · TIENDA", "PASO 2 · FECHAS", etc.) y [`delivery-create.md`](../screens/delivery-create.md) ("DESDE", "QUÉ LLEGA", "CUÁNDO Y CUÁNTO"). Tres estados clave: `default` (paso visible no activo), `active` (paso expandido), `gated` (paso bloqueado por dependencia, contenido reemplazado por sub-bloque guía sin opacity — ADR 0001 D3).

## API TypeScript

```ts
import type { ReactNode } from "react";

type SectionCardState = "default" | "active" | "gated";

type SectionCardStep = {
  /** Número del paso (1-based). Mostrado en bolita del wizard. */
  n: number;
  /** Título visible del paso (e.g. "Tienda", "Fechas"). */
  title: string;
  /** Eyebrow uppercase mono (e.g. "PASO 1 · TIENDA"). Default compone "PASO {n} · {title.toUpperCase()}". */
  eyebrow?: string;
  /** Resumen mostrado cuando el paso está colapsado/done (e.g. "Akiba Records · Pokémon Center"). */
  summary?: string;
};

type SectionCardProps = {
  /** Estado del card. Default `default`. */
  state?: SectionCardState;
  /** Datos del paso para wizard. Si está presente, el card renderiza eyebrow + título; si no, los hijos lo proveen. */
  step?: SectionCardStep;
  /** Cuerpo del card. Solo visible cuando `state === "active"` o `state === "default"`. En `gated` se reemplaza por sub-bloque guía. */
  children: ReactNode;
  /** Copy del sub-bloque guía cuando `state === "gated"`. Default "Selecciona una tienda primero." */
  gatedHint?: string;
  /** Override del ícono lock cuando `state === "gated"`. Default Lucide `lock` 24. */
  gatedIcon?: ReactNode;
  /** Click handler para expandir el paso (wizard accordion). */
  onExpand?: () => void;
  /** Identificador único para `aria-labelledby` cuando se compone con stepper. */
  id?: string;
};
```

## Variants / Sizes

3 estados como variants:

| State     | Uso                                                                 | Tokens consumidos                                                  |
| --------- | ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `default` | Paso visible, no expandido (puede estar `done` con summary visible) | `--surface`, `--border`, `--elevation-2`                           |
| `active`  | Paso expandido — único editable a la vez en wizard accordion        | `--surface`, `--border-strong` light / `--accent` glow 6% dark     |
| `gated`   | Paso bloqueado por dependencia — sub-bloque guía con `lock` 24px    | `--surface`, `--border` (no strong), `--text-muted` para guía      |

## Estados visuales

| Estado    | Receta CSS (light)                                                                                                                                                                                                                                                                                                                                                            | Receta CSS (dark)                                                                                                                                                                                                                       | Notas                                                                                                                                                                                                                  |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default` | `background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-5); box-shadow: var(--elevation-2);`                                                                                                                                                                                                                       | `--elevation-2` dark = `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 1px var(--border-strong)` (sin shadow real).                                                                                                                          | Mobile padding `--space-5`, desktop `--space-6`.                                                                                                                                                                       |
| `active`  | `border: 1px solid var(--border-strong);`                                                                                                                                                                                                                                                                                                                                     | `border: 1px solid var(--border-strong);` + glow accent: `box-shadow: var(--elevation-2), 0 0 0 1px color-mix(in oklch, var(--accent) 16%, transparent);`                                                                                | El glow dark refuerza la presencia del paso activo sin sombra real.                                                                                                                                                    |
| `gated`   | `border: 1px solid var(--border);` (no strong — "presente pero secundario") + body reemplazado por sub-bloque guía: `display: flex; flex-direction: column; align-items: center; gap: var(--space-3); padding: var(--space-8) var(--space-4); color: var(--text-muted);` con ícono Lucide `lock` 24px en `--text-muted` (no destructive) y copy en Body 13px (`--text-caption`). | mismo                                                                                                                                                                                                                                   | **NO opacity.** Eyebrow + title intactos al 100%. El sub-bloque guía respira con padding `--space-8` vertical para sentirse intencional.                                                                                |
| `done`    | (sub-estado de `default`) — eyebrow + title visibles, body reemplazado por `summary` con bolita check `--success`. Visualmente igual a `default` pero con `summary` en `--text-secondary` y bolita verde con check.                                                                                                                                                            | mismo                                                                                                                                                                                                                                   | El componente NO orquesta el indicador de done — el padre pasa `step` con summary y el shell del wizard renderiza la bolita en el `<Stepper>`.                                                                          |
| `hover`   | (solo cuando es interactivo via `onExpand` y `state !== "active"`) `background: color-mix(in oklch, var(--text-primary) var(--state-hover-mix), var(--surface));`                                                                                                                                                                                                              | mismo                                                                                                                                                                                                                                   | El paso colapsado clickable revela hover state-layer.                                                                                                                                                                  |
| `focus`   | (interactivo) `outline: 2px solid var(--focus-ring); outline-offset: 2px;`                                                                                                                                                                                                                                                                                                    | mismo                                                                                                                                                                                                                                   | Focus visible en card colapsada clickable.                                                                                                                                                                              |

Receta base CSS (corresponde a `tokens-css.md` §7):

```css
.section-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: var(--space-5);
  box-shadow: var(--elevation-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

@media (min-width: 48rem) {
  .section-card {
    padding: var(--space-6);
  }
}

.section-card--active {
  border-color: var(--border-strong);
}

:root[data-theme="dark"] .section-card--active {
  box-shadow: var(--elevation-2), 0 0 0 1px color-mix(in oklch, var(--accent) 16%, transparent);
}

.section-card--gated {
  border-color: var(--border); /* no strong — "presente pero secundario" */
}

.section-card--gated .section-card__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-8) var(--space-4);
  color: var(--text-muted);
  text-align: center;
}

.section-card__lock-icon {
  width: 24px;
  height: 24px;
  color: var(--text-muted);
}

.section-card__hint {
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
  color: var(--text-muted);
}

.section-card__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.section-card__title {
  font-family: var(--font-display);
  font-weight: var(--font-weight-title);
  font-size: var(--text-subtitle);
  line-height: var(--text-subtitle--line-height);
  letter-spacing: var(--text-subtitle--letter-spacing);
  color: var(--text-primary);
}

.section-card__summary {
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
  color: var(--text-secondary);
}

.section-card[role="button"]:hover {
  background: color-mix(in oklch, var(--text-primary) var(--state-hover-mix), var(--surface));
}

.section-card:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
```

## Mobile vs desktop

- **Mobile (`< --breakpoint-md`):** padding `--space-5`. La card stackea con `gap: --space-4` entre cards (el padre lo gestiona).
- **Desktop (`≥ --breakpoint-md`):** padding `--space-6`. Las cards stackean en grid 12-col con su contenedor padre.
- **`gated`:** sub-bloque guía centrado en ambos viewports. El padding `--space-8` vertical es el mismo cross-viewport.
- **Click area en card colapsada:** mobile la card entera es clickable (tap target generoso); desktop también.

## Accesibilidad

- Rol ARIA:
  - Cuando es interactiva (collapsed clickable para expandir): `<section role="button" aria-expanded={false}>` o, mejor, `<section>` con un `<button>` interno que abarca el header (semántica más limpia).
  - `state === "active"`: `<section aria-expanded="true">`.
  - `state === "gated"`: `<section aria-disabled="true">` + el botón header (si aplica) `aria-disabled="true"`.
- Atributos:
  - `aria-labelledby={headingId}` apuntando al `<h3 class="section-card__title">`.
  - `aria-describedby={hintId}` cuando `gated` apunta al hint para SR.
  - `aria-controls={bodyId}` en el botón de expansión apuntando al wrapper del body.
- Keyboard:
  - Tab navega al header del card colapsada.
  - Enter / Space expande (dispara `onExpand`).
  - Cuando `active`, Tab continúa hacia los inputs del body.
- Focus management:
  - Al expandir, mover foco al primer input del body (`useEffect` post-mount). Patrón estándar wizard.
  - Al colapsar (otro paso se expande), el foco salta al header de ese nuevo paso.
- Screen reader:
  - Anuncia "Sección {n}, {title}, {state}".
  - `gated` anuncia "Bloqueado, {gatedHint}".
- `prefers-reduced-motion`: la transición de expansión reduce a opacity puro `--motion-fast` `--ease-emphasis` (sin slide).

## Motion

- **Expansión / colapso:** `max-height` + opacity en `--motion-base` `--ease-out-expressive`. El body hace slide-down + fade-in.
- **Cambio de border `default` → `active`:** transición `--motion-fast` `--ease-emphasis`.
- **Glow dark del `active`:** transición de `box-shadow` en `--motion-base` `--ease-emphasis`.
- **`gated` → `default` (cuando se desbloquea):** crossfade del sub-bloque guía al body real en `--motion-base` `--ease-emphasis`.
- Bajo `prefers-reduced-motion`: solo opacity, sin transform / max-height. Slide reemplazado por instant show/hide tras opacity.

## Copy default + i18n

| Clave i18n sugerida                              | Valor ES                              |
| ------------------------------------------------ | ------------------------------------- |
| `components.sectionCard.eyebrow.template`        | "PASO {n} · {title}"                  |
| `components.sectionCard.gated.default`           | "Selecciona una tienda primero."      |
| `components.sectionCard.gated.delivery.products` | "Elegí una tienda y arrancamos."      |
| `components.sectionCard.gated.delivery.dates`    | "Marcá los productos que viajan primero." |
| `components.sectionCard.aria.expand`             | "Abrir sección {title}"               |
| `components.sectionCard.aria.collapse`           | "Cerrar sección {title}"              |
| `components.sectionCard.aria.gated`              | "Bloqueado: {hint}"                   |

EN se deja para S12.

## Edge cases

1. **`state === "gated"` con `step.eyebrow` largo:** el eyebrow respeta wrapping; no truncar. La regla "eyebrow + title intactos al 100%" (ADR 0001 D3) implica preservar lectura.
2. **`state === "active"` mientras otro card expandido:** el padre coordina (wizard accordion: solo uno activo). El componente NO orquesta — refleja props.
3. **`state === "gated"` con `gatedHint` vacío:** caer al copy default "Selecciona una tienda primero."
4. **`step` ausente:** el card NO renderiza eyebrow + title automáticos. El padre los compone como hijos. Útil para uso fuera de wizard accordion (e.g. settings cards).
5. **`onExpand` ausente y `state === "default"`:** card visible no clickeable (modo "info card"). El padre puede preferir `state === "active"` siempre.
6. **`done` indicator (bolita check):** vive en el `<Stepper>` adyacente, no en el card. El card solo refleja `summary` cuando aplica.
7. **`state === "gated"` con ícono custom (e.g. `key`):** soportado via `gatedIcon` prop. Default `lock`.
8. **Body vacío en `state === "active"`:** el wrapper conserva su altura mínima por padding. Padre debe garantizar que `children` no sea null en active.
9. **Mobile angosto (320px):** padding `--space-5` debe permitir respirar inputs. El componente no fuerza min-width — el padre decide.
10. **Modo dark glow accent persistente:** la transición a `--accent` 16% en box-shadow puede acumular GPU work; usar `transform: translateZ(0)` solo si S12 detecta jank.

## Anti-patrones

1. **`opacity: 0.5` en `gated`:** ADR 0001 D3 prohíbe. Eyebrow + title al 100%, body reemplazado.
2. **`pointer-events: none` global en `gated`:** las acciones del header (e.g. "Volver al paso 1") siguen accesibles.
3. **Ícono lock en `--destructive`:** ADR 0001 D3 — gated NO es error, es secuencia. `--text-muted` siempre.
4. **Border `--border-strong` en `gated`:** señaliza presencia funcional cuando debería ser secundario.
5. **Skip de la transición de expansión (instant):** rompe la sensación del wizard accordion. Usar `--motion-base`.
6. **Glow accent en light mode:** la receta es exclusiva de dark (light usa shadow real `--elevation-2`).
7. **Card sin radius-xl:** rompe convención visual cross-pantalla del form.

## Ejemplos de uso

```tsx
// Order create paso 1 — activo
<SectionCard
  state="active"
  step={{ n: 1, title: "Tienda", eyebrow: "PASO 1 · TIENDA" }}
>
  <Combobox label="¿Dónde lo compraste?" placeholder="Buscá una tienda" />
</SectionCard>

// Paso 2 — gated (paso 1 sin completar)
<SectionCard
  state="gated"
  step={{ n: 2, title: "Fechas", eyebrow: "PASO 2 · FECHAS" }}
  gatedHint="Selecciona una tienda primero."
/>

// Paso 1 done con summary
<SectionCard
  state="default"
  step={{ n: 1, title: "Tienda", summary: "Akiba Records" }}
  onExpand={() => goToStep(1)}
/>
```

## Tokens consumidos

- `--surface`, `--surface-elevated`
- `--border`, `--border-strong`
- `--text-primary`, `--text-secondary`, `--text-muted`
- `--accent` (glow dark active)
- `--font-display`, `--font-weight-title`
- `--text-subtitle`, `--text-caption`, `--text-eyebrow`
- `--radius-xl`
- `--space-1`, `--space-3`, `--space-4`, `--space-5`, `--space-6`, `--space-8`
- `--elevation-2`
- `--motion-base`, `--motion-fast`, `--ease-out-expressive`, `--ease-emphasis`
- `--state-hover-mix`
- `--focus-ring`
- `--breakpoint-md`

## ADRs aplicables

- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md) D3 (gated sin opacity), D7 (delivery doble entry-point — sectioncard de sidebar también).
- [ADR 0003 — S2 post-research decisions](./../decisions) D5 (WizardAccordion expandido + done semantics).

## Dependencias

- [`./Eyebrow.md`](./Eyebrow.md) (eyebrow del header, wraps `step.eyebrow`).
- Iconos `lucide-react` (`lock`, opcional `key`).
- [`./Stepper.md`](./Stepper.md) — sibling, no dependencia directa. El stepper refleja el state de cada card.

## Notas para S12 (implementación)

1. La transición de `max-height` requiere conocer la altura final del body; usar `grid-template-rows: 0fr` ↔ `1fr` para animar height sin medir. Validar soporte browser target.
2. El componente puede recibir un `ref` callback para que el wizard externo enfoque el primer input al expandir.
3. Decidir si el card en `default` con `onExpand` se renderiza como `<button>` (semántica) o como `<section>` con un `<button>` overlay (visual). Recomendado: `<section>` + `<header role="button" tabIndex={0}>` con keyboard handlers.
4. La recipe de glow dark `box-shadow: var(--elevation-2), 0 0 0 1px color-mix(...)` se compone via stacking — validar que ambos shadows se respetan sin conflicto.
5. El `gatedHint` puede aceptar ReactNode (no solo string) para casos con link inline ("Selecciona una tienda primero o [crea una](/stores/new)."). MVP: solo string.
6. Para wizard accordion estricto (un solo activo), el padre orquesta. El componente no impone restricciones — un padre podría tener múltiples `state="active"` simultáneos para casos especiales.
7. La transición `gated → default` cuando se cumple la dependencia debe tener trigger explícito (cambio de prop) — no animar si el cambio es instantáneo en el modelo del padre.
