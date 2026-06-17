---
title: Card
tier: 2
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0001 D3 (disabled sin opacity — aplica a interactive disabled)
---

# Card

## Propósito

Primitiva más ligera que [`./SectionCard.md`](./SectionCard.md) — sin step indicator, sin estado gated, sin convención de wizard. Se usa para list rows del [`dashboard.md`](../screens/dashboard.md), peek panels desktop del [`order-detail.md`](../screens/order-detail.md), mini-cards del bento dashboard, popovers genéricos y composiciones donde un wrapper visual respirable es suficiente. Tres variants: `plain`, `elevated`, `outlined`.

## API TypeScript

```ts
import type { MouseEvent, ReactNode } from "react";

type CardVariant = "plain" | "elevated" | "outlined";
type CardPadding = "none" | "sm" | "md" | "lg";

type CardProps = {
  /** Variant visual. Default `plain`. */
  variant?: CardVariant;
  /** Padding interno. Default `md` = `--space-4`. */
  padding?: CardPadding;
  /** Si true (o si hay `href`/`onClick`), el card aplica state-layer hover + focus ring + cursor pointer. */
  interactive?: boolean;
  /** Link semántico — el card se renderiza como `<a>`. */
  href?: string;
  /** Click handler — el card se renderiza como `<button>` si no hay `href`. */
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  /** Etiqueta semántica raíz cuando NO es interactivo. Default `div`. */
  as?: "div" | "article" | "section" | "li";
  /** Identificador para ARIA. */
  id?: string;
  /** Aria-label cuando el card es interactivo y el contenido no provee label suficiente. */
  ariaLabel?: string;
  /** Hijos. */
  children: ReactNode;
};
```

## Variants / Sizes

| Variant     | Uso                                                            | Tokens consumidos                                    |
| ----------- | -------------------------------------------------------------- | ---------------------------------------------------- |
| `plain`     | List rows, dashboard mini-cards livianas                       | `--surface`, sin border, `--elevation-1`             |
| `elevated`  | Popovers, peek panels, drawers internos                        | `--surface-elevated`, sin border, `--elevation-2`    |
| `outlined`  | Cards listadas en grids donde la separación visual depende del border (sin shadow) | `--surface`, `1px solid var(--border)`, sin elevation |

| Padding     | Tamaño                                |
| ----------- | ------------------------------------- |
| `none`      | `0` — el padre controla padding       |
| `sm`        | `var(--space-3)`                      |
| `md` (def)  | `var(--space-4)`                      |
| `lg`        | `var(--space-6)`                      |

Radius siempre `--radius-lg`.

## Estados visuales

| Estado            | Receta CSS (light)                                                                                                                                                                                                                                                                                                                                       | Receta CSS (dark) | Notas                                                                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `plain default`   | `background: var(--surface); border-radius: var(--radius-lg); box-shadow: var(--elevation-1); padding: var(--space-4);`                                                                                                                                                                                                                                  | mismo (`--elevation-1` dark = inset highlight + border)  | Sin border. La elevación viene del shadow.                                                                                                              |
| `elevated default`| `background: var(--surface-elevated); border-radius: var(--radius-lg); box-shadow: var(--elevation-2);`                                                                                                                                                                                                                                                  | mismo (`--elevation-2` dark = inset highlight + border-strong) | Para popovers, peek panels.                                                                                                                            |
| `outlined default`| `background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);`                                                                                                                                                                                                                                                          | mismo             | Sin elevation.                                                                                                                                         |
| `hover` (interactive) | `background-color: color-mix(in oklch, var(--text-primary) var(--state-hover-mix), <surface>); cursor: pointer;`                                                                                                                                                                                                                                     | mismo             | `<surface>` = `--surface` (`plain`/`outlined`) o `--surface-elevated` (`elevated`).                                                                    |
| `pressed` (interactive) | `background-color: color-mix(in oklch, var(--text-primary) var(--state-pressed-mix), <surface>);`                                                                                                                                                                                                                                                | mismo             | Active / pressed.                                                                                                                                      |
| `focus` (interactive) | `outline: 2px solid var(--focus-ring); outline-offset: 2px;`                                                                                                                                                                                                                                                                                          | mismo             | Visible siempre en `:focus-visible`.                                                                                                                   |
| `disabled` (interactive) | `color: var(--text-muted); border-color: var(--border); pointer-events: none;` (sin opacity)                                                                                                                                                                                                                                                       | mismo             | ADR 0001 D3.                                                                                                                                            |

Receta base CSS:

```css
.card {
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  text-decoration: none;
  color: inherit;
  display: block;
}

.card--padding-none { padding: 0; }
.card--padding-sm { padding: var(--space-3); }
.card--padding-md { padding: var(--space-4); }
.card--padding-lg { padding: var(--space-6); }

.card--plain {
  background: var(--surface);
  box-shadow: var(--elevation-1);
}

.card--elevated {
  background: var(--surface-elevated);
  box-shadow: var(--elevation-2);
}

.card--outlined {
  background: var(--surface);
  border: 1px solid var(--border);
}

.card--interactive {
  cursor: pointer;
  transition: background-color var(--motion-fast) var(--ease-emphasis);
}

.card--interactive:hover,
.card[href]:hover,
.card[role="button"]:hover {
  background-color: color-mix(in oklch, var(--text-primary) var(--state-hover-mix), var(--surface));
}

.card--elevated.card--interactive:hover {
  background-color: color-mix(in oklch, var(--text-primary) var(--state-hover-mix), var(--surface-elevated));
}

.card--interactive:active {
  background-color: color-mix(in oklch, var(--text-primary) var(--state-pressed-mix), var(--surface));
}

.card--interactive:focus-visible,
.card[href]:focus-visible,
.card[role="button"]:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.card--disabled {
  color: var(--text-muted);
  border-color: var(--border);
  pointer-events: none;
}
```

## Mobile vs desktop

- **Padding cross-viewport:** los 4 valores (`none/sm/md/lg`) se mantienen idénticos. Si el padre necesita densidad por viewport, decide en su CSS.
- **Tap target:** cuando `interactive`, `min-height: 44px` se garantiza solo si el contenido lo respeta. Para list rows densos, el padre asegura `padding-block` ≥`--space-3`.
- **Elevation dark:** la receta `--elevation-1` y `--elevation-2` son composiciones (border + inset highlight + glow) — no shadow real. Mantienen consistencia cross-viewport.

## Accesibilidad

- Rol ARIA:
  - `href` presente → `<a>` con role implícito link.
  - `onClick` presente sin `href` → `<button>` semántico (no `role="button"` en `<div>`).
  - Sin handlers → `<div>` / `<article>` / `<section>` / `<li>` según `as`.
- Atributos:
  - `aria-label={ariaLabel}` cuando es interactivo y el contenido no provee label claro.
  - `aria-disabled="true"` para variant disabled (no `disabled` HTML directo si es `<a>`).
- Keyboard: Tab + Enter / Space cuando es interactivo. El `<button>` y `<a>` lo proveen nativos.
- Focus management: outline rodea el card completo.
- Screen reader: lee el contenido en orden DOM. Para cards-link, anuncia "{contenido}, link".
- `prefers-reduced-motion`: la transición de hover state-layer reduce a opacity puro `--motion-fast`.

## Motion

- **Hover state-layer:** transición de bg en `--motion-fast` `--ease-emphasis`.
- **Pressed:** instant (sin transición — feedback inmediato).
- **Aparición:** sin animación por default. Si el card aparece en respuesta a una mutación, el padre coordina.
- Bajo `prefers-reduced-motion`: solo opacity, sin spring.

## Copy default + i18n

| Clave i18n sugerida              | Valor ES                       |
| -------------------------------- | ------------------------------ |
| `components.card.aria.linkSuffix` | "{label}, abrir"               |

(El componente normalmente no inyecta copy — los hijos lo proveen.)

EN se deja para S12.

## Edge cases

1. **`href` y `onClick` ambos presentes:** `href` gana — el card es `<a>` semántico. El `onClick` se delega al click event del link.
2. **`interactive: true` sin `href` ni `onClick`:** el card aplica visual state-layer pero no es focusable. Anti-patrón — definir handler.
3. **Variant `outlined` con state-layer hover:** el bg se mezcla sobre `--surface`; el border `--border` se mantiene visible. Validado.
4. **Variant `elevated` dentro de variant `elevated`:** soportado pero rompe la jerarquía visual. Padre debe optar por `plain` interno cuando ya está sobre `elevated`.
5. **Cards con muchas Cards anidadas:** límite recomendado 2 niveles de profundidad. Más allá rompe lectura.
6. **`children` ReactNode con un solo nodo de texto:** el card respira por padding. No fuerza estructura interna.
7. **`disabled` interactive con focus visible:** el outline NO se renderiza cuando `pointer-events: none`. Validar — el browser puede aún focusear con Tab si el elemento es `<a>`. Solución: agregar `tabIndex={-1}` cuando disabled.
8. **`as="li"` en lista de pedidos:** combinable con `interactive` + `href` — el `<li>` envuelve un `<a>`. Validar que la receta CSS aplica al `<li>` raíz.
9. **Modo dark glow card activa (peek panel):** se compone con `box-shadow: var(--elevation-2), 0 0 0 1px color-mix(--accent 6%, transparent)` solo si el padre lo activa via clase modificadora externa — no es default del Card.
10. **Card como contenedor de `<MicroStatCard>` u otro card:** anti-patrón. Las cards no anidan otras cards completas — solo contenido.

## Anti-patrones

1. **`opacity: 0.5` para disabled:** ADR 0001 D3.
2. **Card con border AND elevation simultáneo:** elige uno. `outlined` no tiene shadow; `plain`/`elevated` no tienen border.
3. **Radius distinto de `--radius-lg`:** las cards con radius diferente (xl) se llaman `<SectionCard>`. Mantener el contrato.
4. **`role="button"` en `<div>` interactivo:** usar `<button>` semántico nativo.
5. **Animación bouncy en hover:** rompe densidad informativa.
6. **Card sin padding cuando contiene texto:** texto pegado al border. Usar `padding="md"` mínimo.
7. **Card como wrapper de un solo botón:** anti-patrón — el botón ya tiene su propio styling.
8. **Click handler sin keyboard support:** si `onClick` está, el `<button>` lo da; si se ignora la convención (`<div onClick>`), rompe a11y.

## Ejemplos de uso

```tsx
// Dashboard mini-card plain
<Card variant="plain" padding="md">
  <Eyebrow>TUS PRE-ÓRDENES</Eyebrow>
  <p className="text-body">12 activas</p>
</Card>

// Peek panel elevated
<Card variant="elevated" padding="lg" as="aside">
  <h3 className="title">PT-002418 · Akiba Records</h3>
  <StatusChip kind="orderStatus" value="IN_TRANSIT" />
</Card>

// Outlined list row interactive (link)
<Card
  variant="outlined"
  padding="sm"
  href="/orders/PT-002418"
  ariaLabel="Pedido PT-002418, Akiba Records, en camino"
  as="li"
>
  <StoreAvatar size={32} store={{ name: "Akiba Records" }} />
  <MonoCode>PT-002418</MonoCode>
  <span>Akiba Records</span>
  <StatusChip kind="orderStatus" value="IN_TRANSIT" />
</Card>
```

## Tokens consumidos

- `--surface`, `--surface-elevated`
- `--border`
- `--text-primary`, `--text-muted`
- `--radius-lg`
- `--space-3`, `--space-4`, `--space-6`
- `--elevation-1`, `--elevation-2`
- `--motion-fast`, `--ease-emphasis`
- `--state-hover-mix`, `--state-pressed-mix`
- `--focus-ring`

## ADRs aplicables

- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md) D3 (disabled sin opacity, aplica al estado interactive disabled).

## Dependencias

Ninguna primitiva. Es base estructural; otros componentes la consumen.

## Notas para S12 (implementación)

1. Decidir si el componente expone `forwardRef` para integración con frameworks que necesiten ref (e.g. animaciones, intersection observer). Recomendado: sí, para `<a>` y `<button>` ambos.
2. La detección de variant según `as` puede ser explícita (prop) o implícita (Tag de raíz). MVP: explícita via `as`.
3. Para ZStack o composiciones especiales (peek panel con drag handle), el padre extiende `<Card>` con clases adicionales — el componente no provee variants para casos uno-off.
4. Validar contraste de variant `outlined` cross-paleta — el border `--border` sobre `--surface` cumple AA (decorativo, ratio ~1.5:1, válido para non-text).
5. Si `interactive` cambia entre renders (e.g. card carga datos y luego se hace clickable), validar que el state-layer no flickee — usar transición consistente.
6. Decidir si exponer slots (`<Card.Header>`, `<Card.Body>`, `<Card.Footer>`) en S12 para casos de listas con header/footer fijos. MVP: sin slots — el padre compone.
7. Para variant `outlined` interactive, el border puede transitar a `--border-strong` en hover — opcional, validar visual antes de adoptar.
