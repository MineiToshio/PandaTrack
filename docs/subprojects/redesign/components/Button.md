---
title: Button
tier: 1
status: implementado
last_updated: 2026-05-03
session: 04-components
adrs:
  - ADR 0001 D4 (toast neutral-undo CTA ghost en `--accent` + atajo `Z`)
  - ADR 0001 D6 (lifecycle por reversibilidad — destructive ghost en sidebar, delete en overflow)
  - ADR 0001 D14 (theme dual — botones consumen `var(--text-on-accent)`, nunca `text-white`)
  - ADR 0006 (icon+label contract)
---

# Button

## Propósito

Atom de acción primaria del sistema. Compone CTA primarios, acciones secundarias, ghosts dentro de cards y sidebar, destructivos confirmables, y links que se ven como botón. Aparece en [`dashboard.md`](../screens/dashboard.md) ("Crear pedido", "Ver todos"), en [`order-detail.md`](../screens/order-detail.md) (cluster Acciones de sidebar — `Editar`, `Crear entrega`, `Cancelar pedido`, `Reactivar`, y `destructive-ghost` cuando aplica), en [`order-create.md`](../screens/order-create.md) (footer del wizard — "Continuar", "Atrás", "Guardar"), y en cualquier flow donde haya una decisión binaria (Confirmar / Cancelar).

## API TypeScript

```ts
import type { ReactNode, ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "destructive-ghost";

type ButtonSize = "sm" | "md" | "lg";

type ButtonCommonProps = {
  /** Etiqueta visible del botón. Aplicar voice glossary §7 — corto, imperativo, en español. */
  children: ReactNode;
  /** Variante semántica. Default `primary`. */
  variant?: ButtonVariant;
  /** Tamaño. Default `md`. */
  size?: ButtonSize;
  /** Ícono Lucide opcional a la izquierda del texto. */
  leadingIcon?: ReactNode;
  /** Ícono Lucide opcional a la derecha del texto (ej. `chevron-down` en menus, `arrow-right` en CTAs de flow). */
  trailingIcon?: ReactNode;
  /**
   * Atajo de teclado opcional. Renderiza un `<Kbd>` interno alineado a la derecha.
   * Sólo visible en `≥ --breakpoint-md` (oculto en mobile via CSS, no se desmonta).
   * Acepta una tecla simple (`"Z"`) o combinación (`["⌘", "Enter"]`).
   */
  kbd?: string | string[];
  /** Estado de carga. Reemplaza `leadingIcon` por spinner Lucide `loader-2` y mantiene texto + ancho originales. */
  loading?: boolean;
  /** Estado deshabilitado. Aplica tokens muted (sin opacity). */
  disabled?: boolean;
  /** Ocupa el ancho del contenedor padre. Default `false`. */
  fullWidth?: boolean;
};

type ButtonAsButton = ButtonCommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "disabled"> & {
    as?: "button";
    /** Tipo nativo del `<button>`. Default `"button"` (evita submit accidental). */
    type?: "button" | "submit" | "reset";
  };

type ButtonAsAnchor = ButtonCommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children"> & {
    as: "a";
    /** Destino del link. Obligatorio cuando `as="a"`. */
    href: string;
  };

/** Discriminated union sobre `as` — el consumidor obtiene tipos correctos según el elemento renderizado. */
type ButtonProps = ButtonAsButton | ButtonAsAnchor;
```

Reglas TS:

- `as` es discriminante. Cuando `as="a"`, `href` es obligatorio (TS rechaza si falta) y los handlers son los de `<a>`. Cuando `as` está ausente o vale `"button"`, los handlers son los de `<button>` y `type` está disponible.
- `disabled` no se propaga a `<a>`: cuando `as="a"` y `disabled` está, el componente renderiza un `<a aria-disabled="true">` sin `href` activo (`pointer-events: none`).

## Variants / Sizes

### Variants

| Variant             | Uso                                                                                                                        | Tokens consumidos                                                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `primary`           | CTA principal de la pantalla. **Una sola instancia visible por viewport** (decálogo §2 — una pantalla, una decisión).      | bg `--accent`, text `var(--text-on-accent)`, `--elevation-1`, `--radius-md`, `--font-weight-medium-body`, `--focus-ring`            |
| `secondary`         | Acción complementaria de jerarquía media (ej. "Cancelar" junto a "Confirmar", "Atrás" en wizard).                          | bg `--surface-elevated`, text `--text-primary`, border `1px solid var(--border-strong)`, `--radius-md`, `--font-weight-medium-body` |
| `ghost`             | Acción reversible dentro de sidebar/cluster, link que se ve como botón, items del cluster Acciones (ADR 0001 D6).          | bg `transparent`, text `--text-primary`, `--radius-md`, `--font-weight-medium-body`                                                 |
| `destructive`       | Confirmación final de operación irreversible (ej. modal "Eliminar pedido" → botón "Eliminar"). Nunca expuesta sin confirm. | bg `--destructive`, text `var(--text-on-accent)`, `--elevation-1`, `--radius-md`                                                    |
| `destructive-ghost` | Acción destructiva reversible dentro de sidebar (ej. "Cancelar pedido"). Las irreversibles van en overflow `[···]` (D6).   | bg `transparent`, text `--destructive`, `--radius-md`                                                                               |

Nota sobre `destructive`: el contraste de `var(--text-on-accent)` (oscuro en dark) sobre `--destructive` (light L=0.54 / dark L=0.70) cumple ≥4.5:1 cross-paleta (ver `_notes/s3-contrast-audit.md`). Se prefiere `--text-on-accent` antes que blanco hardcoded para mantener la regla cross-paleta.

### Sizes

| Size | Height (mobile / desktop)           | Padding-x        | Tipografía       | Gap interno        | Ícono leading/trailing | Uso                                                                 |
| ---- | ----------------------------------- | ---------------- | ---------------- | ------------------ | ---------------------- | ------------------------------------------------------------------- |
| `sm` | `2rem`                              | `var(--space-3)` | `--text-caption` | `var(--space-1_5)` | `1rem` (16)            | Toolbars densos, filtros, paginación, "Cargar más" en lista mobile. |
| `md` | `2.75rem` mobile / `2.5rem` desktop | `var(--space-4)` | `--text-body`    | `var(--space-2)`   | `1rem` (16)            | Default. CTA primarios, ghosts de sidebar, footer wizard.           |
| `lg` | `3rem`                              | `var(--space-5)` | `--text-body-lg` | `var(--space-2)`   | `1.125rem` (18)        | Hero del dashboard, CTA principal de empty state.                   |

Las heights se materializan via `min-height` (no `height` fijo) para que el padding no comprima el texto. Mobile bumpea `md` a `2.75rem` para garantizar tap target ≥44×44 (Comportamientos transversales §1 del shared brief).

## Estados visuales

Cada receta es un overlay sobre la base de la variant. El state layer es un pseudo-elemento `::after` que se enciende con `background-color` y deja el texto + íconos del botón intactos por encima.

### `primary`

| Estado          | Receta CSS (light)                                                                                                                                                               | Receta CSS (dark)                                                 | Notas                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `default`       | `background: var(--accent); color: var(--text-on-accent); box-shadow: var(--elevation-1);`                                                                                       | mismo (los valores de los tokens cambian via `:root[data-theme]`) | `--text-on-accent` en dark es **oscuro** (L=15%). Nunca usar `text-white`.                                |
| `hover`         | overlay `background-color: color-mix(in oklch, var(--text-primary) var(--state-hover-mix), transparent);` (mix=6%)                                                               | overlay con mix=8%                                                | Aplicado via `::after`. La transición usa `--motion-fast` `--ease-emphasis`.                              |
| `pressed`       | overlay con `--state-pressed-mix` (12%)                                                                                                                                          | overlay con `--state-pressed-mix` (14%)                           | `:active`. Reemplaza el overlay de hover.                                                                 |
| `focus-visible` | `outline: 2px solid var(--focus-ring); outline-offset: 2px;`                                                                                                                     | mismo                                                             | Sólo en `:focus-visible` (no en click puro). El outline-offset asegura que el ring no se trague el borde. |
| `disabled`      | `color: var(--text-muted); border: 1px solid var(--border); background: var(--surface-elevated); pointer-events: none; box-shadow: none;`                                        | mismo                                                             | **Sin opacity.** El primary disabled cae a la receta neutral. ADR 0001 D3.                                |
| `loading`       | leadingIcon → `<Loader2>` rotando; texto inalterado; `aria-busy="true"`; `pointer-events: none`; `min-width` se mantiene del estado anterior (`width: var(--btn-locked-width)`). | mismo                                                             | El ancho se preserva snapshot-eando antes de entrar a loading. Ver §Notas para S12.                       |

### `secondary`

| Estado          | Receta CSS (light)                                                                                         | Receta CSS (dark) | Notas                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------- |
| `default`       | `background: var(--surface-elevated); color: var(--text-primary); border: 1px solid var(--border-strong);` | mismo             | Border `--border-strong` es funcional ≥3:1. |
| `hover`         | overlay mix=6%                                                                                             | overlay mix=8%    |                                             |
| `pressed`       | overlay mix=12%                                                                                            | overlay mix=14%   |                                             |
| `focus-visible` | `outline: 2px solid var(--focus-ring); outline-offset: 2px;`                                               | mismo             |                                             |
| `disabled`      | `color: var(--text-muted); border-color: var(--border); background: var(--surface);`                       | mismo             | Sin opacity. Border se relaja a `--border`. |
| `loading`       | igual que primary                                                                                          | igual             |                                             |

### `ghost`

| Estado          | Receta CSS (light)                                                                    | Receta CSS (dark) | Notas                                                                              |
| --------------- | ------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------- |
| `default`       | `background: transparent; color: var(--text-primary); border: 1px solid transparent;` | mismo             | Border transparente reservado para alinear height con `secondary` cuando conviven. |
| `hover`         | overlay mix=6%                                                                        | overlay mix=8%    |                                                                                    |
| `pressed`       | overlay mix=12%                                                                       | overlay mix=14%   |                                                                                    |
| `focus-visible` | `outline: 2px solid var(--focus-ring); outline-offset: 2px;`                          | mismo             |                                                                                    |
| `disabled`      | `color: var(--text-muted);`                                                           | mismo             | Sin opacity. La superficie sigue transparente — el muted comunica el bloqueo.      |
| `loading`       | igual que primary                                                                     | igual             |                                                                                    |

### `destructive`

| Estado          | Receta CSS (light)                                                                              | Receta CSS (dark) | Notas                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------- |
| `default`       | `background: var(--destructive); color: var(--text-on-accent); box-shadow: var(--elevation-1);` | mismo             | `--text-on-accent` cross-paleta. Nunca `text-white` aunque "se vea bien" en light.                  |
| `hover`         | overlay mix=6%                                                                                  | overlay mix=8%    |                                                                                                     |
| `pressed`       | overlay mix=12%                                                                                 | overlay mix=14%   |                                                                                                     |
| `focus-visible` | `outline: 2px solid var(--focus-ring); outline-offset: 2px;`                                    | mismo             | El ring usa el `--focus-ring` global (accent), no el destructive — es el mismo significante visual. |
| `disabled`      | igual que primary disabled                                                                      | mismo             | Sin opacity.                                                                                        |
| `loading`       | igual que primary                                                                               | igual             |                                                                                                     |

### `destructive-ghost`

| Estado          | Receta CSS (light)                                                                   | Receta CSS (dark)                        | Notas                                                                                          |
| --------------- | ------------------------------------------------------------------------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `default`       | `background: transparent; color: var(--destructive); border: 1px solid transparent;` | mismo (`--destructive` cambia via theme) | El texto destructive cumple ≥4.5:1 sobre `--surface` y `--surface-elevated` cross-paleta.      |
| `hover`         | `background-color: color-mix(in oklch, var(--destructive) 6%, transparent);`         | `color-mix(... 8%, transparent)`         | Hover usa el tinte del propio destructive (no el state layer neutro), refuerza la advertencia. |
| `pressed`       | `color-mix(in oklch, var(--destructive) 12%, transparent)`                           | `color-mix(... 14%, transparent)`        |                                                                                                |
| `focus-visible` | `outline: 2px solid var(--focus-ring); outline-offset: 2px;`                         | mismo                                    |                                                                                                |
| `disabled`      | `color: var(--text-muted);`                                                          | mismo                                    |                                                                                                |
| `loading`       | igual que primary                                                                    | igual                                    |                                                                                                |

### Receta base (CSS pseudo-elemento para state layers)

```css
.button {
  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border-radius: var(--radius-md);
  font-family: var(--font-sans);
  font-weight: var(--font-weight-medium-body);
  cursor: pointer;
  transition:
    background-color var(--motion-fast) var(--ease-emphasis),
    color var(--motion-fast) var(--ease-emphasis),
    border-color var(--motion-fast) var(--ease-emphasis),
    outline-color var(--motion-fast) var(--ease-emphasis),
    box-shadow var(--motion-fast) var(--ease-emphasis),
    transform var(--motion-fast) var(--ease-emphasis);
}

/* Hover lift — primary, secondary, destructive, outline variants */
.button:hover {
  transform: translateY(-1px);
  box-shadow: var(--elevation-2);
}

/* Ghost / destructive-ghost: lift without shadow (transparent background) */
.button[data-variant="ghost"]:hover,
.button[data-variant="destructive-ghost"]:hover {
  transform: translateY(-1px);
  box-shadow: none;
}

/* Reset on :active so the button "sinks" back on press */
.button:active {
  transform: translateY(0);
  box-shadow: var(--elevation-1); /* solid variants; ghost: none */
}

@media (prefers-reduced-motion: reduce) {
  .button:hover,
  .button:active {
    transform: none;
  }
}

.button::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-color: transparent;
  pointer-events: none;
  transition: background-color var(--motion-fast) var(--ease-emphasis);
}

.button:hover::after {
  background-color: color-mix(in oklch, var(--text-primary) var(--state-hover-mix), transparent);
}

.button:active::after {
  background-color: color-mix(in oklch, var(--text-primary) var(--state-pressed-mix), transparent);
}

.button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.button[data-variant="destructive-ghost"]:hover::after {
  background-color: color-mix(in oklch, var(--destructive) var(--state-hover-mix), transparent);
}

.button[data-variant="destructive-ghost"]:active::after {
  background-color: color-mix(in oklch, var(--destructive) var(--state-pressed-mix), transparent);
}

.button[data-loading="true"] .button__leading-icon {
  animation: button-spin var(--motion-base) linear infinite;
  /* Duración aproximada 1120ms = --motion-base * 4 — ver Motion */
  animation-duration: calc(var(--motion-base) * 4);
}

@keyframes button-spin {
  to {
    transform: rotate(360deg);
  }
}
```

`isolation: isolate` evita que el `::after` se filtre fuera del botón cuando vive dentro de un padre con `mix-blend-mode`.

## Mobile vs desktop

| Aspecto                   | `< --breakpoint-md` (mobile)                                                                                                                                                  | `≥ --breakpoint-md` (desktop)                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Altura `md`               | `2.75rem` (44px) — tap target inviolable                                                                                                                                      | `2.5rem` (40px) — densidad mayor                                                                                  |
| `kbd` slot                | Oculto via `display: none` en `< --breakpoint-md`. El nodo se mantiene en el DOM por SR, marcado `aria-hidden="true"` en mobile.                                              | Visible alineado a la derecha del texto, con `margin-inline-start: auto` cuando comparte fila con texto + íconos. |
| Cluster del sidebar (D6)  | Stack vertical (mobile colapsa el sidebar al pie del detalle) — botones `fullWidth`.                                                                                          | Botones de ancho natural alineados verticalmente dentro del sidebar.                                              |
| `fullWidth`               | Recomendado en footer de wizard, modal confirm.                                                                                                                               | Opcional; default natural.                                                                                        |
| Cluster primary+secondary | Stack vertical, primary arriba (orden visual prioritario). En modal de confirm destructivo, "Cancelar" puede quedar arriba para reducir riesgo de touch accidental en bordes. | Side-by-side con primary a la derecha en modal/dialog, "Cancelar" a la izquierda (Linear/GitHub convergente).     |

## Accesibilidad

- Rol ARIA: nativo `<button>` cuando `as="button"` (default); nativo `<a>` cuando `as="a"`. Sin `role="button"` manual.
- `aria-busy="true"` cuando `loading={true}`. Spinner Lucide `loader-2` lleva `aria-hidden="true"`; el texto del botón sigue siendo el accessible name. Sumar texto sr-only `components.button.loading.label` ("Cargando") como complemento via `aria-label` o `aria-describedby` para SR que no anuncian `aria-busy`.
- `aria-disabled="true"` cuando `disabled={true}` y `as="a"` (los `<a>` no aceptan `disabled` nativo). Para `<button>`, `disabled` nativo es suficiente.
- Cuando el botón es icon+label (`leadingIcon` + `children`), el ícono lleva `aria-hidden="true"` (el `children` ya es el accessible name).
- Cuando el botón rinde solo ícono, **usar `<IconButton>`** (componente separado), no `<Button>` con `children` vacío.
- Keyboard:
  - `Tab` / `Shift+Tab`: navegación.
  - `Enter` y `Space`: dispara `onClick` (nativo `<button>`); `Enter` solo en `<a>`.
  - El atajo declarado en `kbd` lo escucha el padre (form, page, modal) — el componente no atrapa eventos. Visualmente solo etiqueta.
- Focus management: `:focus-visible` con `--focus-ring` outline 2px + offset 2px. Nunca `outline: none` sin reemplazo.
- Screen reader: el accessible name viene de `children`. Si el botón tiene `trailingIcon` decorativo (ej. `chevron-down`), el ícono lleva `aria-hidden="true"`.
- `prefers-reduced-motion`:
  - Spinner `loader-2` deja de rotar — se reemplaza por el texto sr-only "Cargando" pronunciado por SR (live region implícito en el botón con `aria-busy`).
  - Hover/focus transitions caen a `--motion-fast` con `--ease-emphasis` (ya son rápidas, casi imperceptible).

## Motion

| Qué se anima             | Token de duración                       | Token de easing          | Notas                                                                                               |
| ------------------------ | --------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------- |
| State layer (`::after`)  | `--motion-fast` (150ms)                 | `--ease-emphasis`        | `background-color`. Se enciende en hover/active.                                                    |
| Hover lift (`transform`) | `--motion-fast`                         | `--ease-emphasis`        | `translateY(-1px)` en hover. Reset a `0` en `:active`. Desactivado bajo `prefers-reduced-motion`.   |
| Hover shadow             | `--motion-fast`                         | `--ease-emphasis`        | `--elevation-1` → `--elevation-2` en hover para variantes sólidas. Ghost: sin shadow scale.         |
| Focus ring               | `--motion-fast`                         | `--ease-emphasis`        | `outline-color`. Aparición instantánea en `:focus-visible`.                                         |
| Color/border transitions | `--motion-fast`                         | `--ease-emphasis`        | `color`, `border-color`, `background-color` cuando cambian de variant programáticamente.            |
| Spinner loading          | `calc(var(--motion-base) * 4)` (1120ms) | `linear` (rotación pura) | Rotación `360deg` infinita. Linear es lo correcto para spinners — los easing curvos generan jitter. |
| `prefers-reduced-motion` | n/a                                     | n/a                      | Lift + spinner desactivados. Color transitions siguen via `--motion-fast`.                          |

## Copy default + i18n

| Clave i18n sugerida                      | Valor ES (voice glossary aplicado) |
| ---------------------------------------- | ---------------------------------- |
| `components.button.loading.label`        | "Cargando"                         |
| `components.button.commonLabels.confirm` | "Confirmar"                        |
| `components.button.commonLabels.cancel`  | "Cancelar"                         |
| `components.button.commonLabels.save`    | "Guardar"                          |
| `components.button.commonLabels.delete`  | "Eliminar"                         |
| `components.button.commonLabels.retry`   | "Dale otra vez"                    |

EN se deja para S12. Las claves `commonLabels.*` son utilities que el sistema puede consumir cuando un consumer no provee `children` explícito (ej. confirm modal genérico). Cualquier copy custom siempre debe pasar por `useTranslations()` — nunca hardcodear strings ES en TSX (regla de `english-code-only.mdc` + `next-intl-translation-apis.mdc`).

## Edge cases

1. **Loading con texto largo**: el ancho se snapshot-ea al entrar a `loading={true}` (`width = el.offsetWidth`) y se mantiene como `min-width` hasta salir. Evita el "salto" cuando el spinner reemplaza el `leadingIcon` y este ocupa menos.
2. **Loading sin `leadingIcon` previo**: el spinner se inserta de todos modos en la posición leading; el texto se desplaza un `gap` a la derecha. Para evitar el shift, el padre puede pasar un placeholder invisible vía `leadingIcon={<span aria-hidden style={{ width: 16 }} />}` cuando sabe que va a entrar a loading.
3. **`as="a"` con `target="_blank"`**: el consumer agrega `rel="noopener noreferrer"` (no es responsabilidad del componente — es decisión del flow). Considerar `trailingIcon={<ExternalLink />}` en links externos.
4. **`disabled` + `as="a"`**: renderiza `<a aria-disabled="true">` sin `href` activo (`pointer-events: none; tabindex={-1}`). El navegador no navega.
5. **Botón dentro de `<form>` con `type` no especificado**: TS default `type="button"` evita submit accidental. Cuando se quiere submit, pasar `type="submit"` explícitamente.
6. **`fullWidth` + `kbd`**: el `<Kbd>` queda alineado a la derecha del flex; el texto + íconos quedan agrupados a la izquierda (`justify-content: space-between`).
7. **Doble click rápido en `loading={true}`**: `pointer-events: none` lo bloquea visualmente. Backend optimistic-update mitigation queda en el hook del consumer.
8. **Botón en modal sobre `--surface-overlay`**: las recetas usan `var(--surface-elevated)` directamente — al estar dentro de un modal, ese token ya resuelve a la superficie correcta sin override.
9. **`ghost` adyacente a otro `ghost`**: ambos comparten state layer pero no se "tocan" porque cada uno aísla su `::after` con `isolation: isolate`.
10. **`primary` cerca de `destructive`**: válido (ej. modal confirm "Eliminar / Cancelar"). En este caso `destructive` ocupa el slot primario semántico y el otro botón degrada a `secondary` — nunca dos saturados a la vez.

## Anti-patrones

1. **`text-white` o `color: white` hardcoded sobre `--accent` / `--destructive`**: rompe en dark donde `--text-on-accent` es oscuro (L=15%). Tokens `tokens.md §1.3` lo prohíbe explícitamente. Cualquier botón Atelier legacy con `text-white` debe migrar a `var(--text-on-accent)` antes de tocar S12.
2. **`opacity: 0.5` para disabled**: prohibido (ADR 0001 D3 + comportamientos transversales §3). Usar `--text-muted` + `--border` + `pointer-events: none`.
3. **Dos `primary` visibles en el mismo viewport**: rompe decálogo §2 (una pantalla, una decisión). Si hay duda, degradar el secundario a `secondary` o `ghost`.
4. **`destructive` sin confirm modal previo**: la variant `destructive` es para el botón final del confirm. Acciones destructivas iniciales en sidebar van como `destructive-ghost` (ADR 0001 D6). Las irreversibles (Eliminar) van en overflow `[···]` del header.
5. **Quitar el focus ring** (`outline: none` sin reemplazo): viola WCAG 2.4.7 + 2.4.13. Inviolable.
6. **Tap target < 44×44 en mobile**: `size="sm"` en mobile sin extender el tap clickable. Si se necesita visual chico mobile, usar `<IconButton size="sm">` que extiende padding clickable a 44×44.
7. **Atajo `kbd` sin handler en el padre**: el `<Kbd>` decora pero no captura. Si el handler no existe, el atajo es mentira visual.
8. **Spinner con easing curvo** (`--ease-emphasis`, `--ease-bounce`): genera jitter perceptual. Linear es el único correcto para rotación.
9. **`children` vacío con `leadingIcon` solo**: si el botón no tiene texto, debe ser `<IconButton>` con `label` obligatorio. `<Button>` sin `children` es un bug de a11y.
10. **`size="sm"` para CTA principal**: rompe la jerarquía. CTA principal = `md` mobile (`2.75rem` = 44px) o `lg` cuando es hero.

## Ejemplos de uso

```tsx
// Dashboard hero — CTA principal (lg + leading + atajo desktop)
<Button
  variant="primary"
  size="lg"
  leadingIcon={<Plus aria-hidden="true" />}
  kbd={["⌘", "N"]}
  onClick={handleCreateOrder}
>
  Crear pedido
</Button>

// Modal confirm "Eliminar pedido" — destructive + cancelar secondary
<dialog>
  <p>¿Borrar este pedido? No se puede deshacer.</p>
  <footer>
    <Button variant="secondary" onClick={handleCancel}>Cancelar</Button>
    <Button
      variant="destructive"
      loading={isDeleting}
      onClick={handleDelete}
    >
      Eliminar
    </Button>
  </footer>
</dialog>

// Sidebar de detalle de pedido — cluster reversibles (ADR 0001 D6)
<aside>
  <Button variant="ghost" leadingIcon={<Pencil aria-hidden="true" />} as="a" href={`/orders/${id}/edit`}>
    Editar
  </Button>
  <Button variant="primary" leadingIcon={<Truck aria-hidden="true" />} onClick={handleCreateDelivery}>
    Crear entrega
  </Button>
  <Button variant="destructive-ghost" leadingIcon={<Ban aria-hidden="true" />} onClick={handleCancelOrder}>
    Cancelar pedido
  </Button>
</aside>

// Toast neutral-undo — ghost link-as-button con kbd Z
<Toast>
  Borraste el pedido.
  <Button variant="ghost" size="sm" kbd="Z" onClick={handleUndo}>
    Deshacer
  </Button>
</Toast>
```

## Tokens consumidos

- `--accent`, `--destructive`
- `--text-primary`, `--text-muted`, `--text-on-accent`
- `--surface`, `--surface-elevated`
- `--border`, `--border-strong`
- `--focus-ring`
- `--state-hover-mix`, `--state-pressed-mix`
- `--radius-md`
- `--font-sans`, `--font-weight-medium-body`
- `--text-caption`, `--text-body`, `--text-body-lg`
- `--space-1_5`, `--space-2`, `--space-3`, `--space-4`, `--space-5`
- `--motion-fast`, `--motion-base`
- `--ease-emphasis`
- `--elevation-1`
- `--breakpoint-md`

## ADRs aplicables

- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md): D3 (disabled sin opacity), D4 (toast neutral-undo CTA ghost en `--accent` + atajo `Z`), D6 (lifecycle por reversibilidad — `destructive-ghost` para reversible cancel, irreversibles en overflow), D14 (theme dual — `var(--text-on-accent)` cross-paleta).
- [ADR 0006 — Color blindness icon-label contract](../decisions/0006-color-blindness-icon-label-contract.md): cuando el botón porta significado vía color (ej. `destructive`), el `children` (label de texto) ya satisface el contrato. Botones color-only están prohibidos por construcción (no existe variant sin label).

## Dependencias

- [`Kbd.md`](./Kbd.md) — el slot `kbd` renderiza un `<Kbd>` interno cuando se provee.
- Lucide icons (`loader-2`, `chevron-down`, `arrow-right`, `pencil`, `plus`, `truck`, `ban`, `external-link`) consumidos como `leadingIcon` / `trailingIcon`. Tamaños 16/16/18 (sm/md/lg).

## Notas para S12 (implementación)

1. **Ancho preservado en `loading`**. Implementar via ref + `useLayoutEffect`: snapshot `el.offsetWidth` al entrar a `loading={true}`, set `el.style.minWidth = ${width}px` durante el estado, limpiar al salir. Alternativa: medir el ancho del label estable y aplicarlo siempre como `min-width` calculado en mount (más estable, evita races con resize).
2. **Discriminated union `as`**. Evaluar usar el patrón de Radix / shadcn (componente `<Slot>`) si el equipo prefiere `asChild` en lugar de `as`. Ambos satisfacen la regla; el brief especifica `as` por simplicidad de tipos.
3. **`kbd` oculto en mobile vs desmontado**. Recomendado mantener en DOM con `display: none` + `aria-hidden="true"` para no perder reactividad si el viewport cambia (rotación tablet). Validar con e2e que SR no lo lee dos veces.
4. **Detección de plataforma para `kbd`**. El atajo `["⌘", "Enter"]` se reescribe a `Ctrl + Enter` en non-Mac via helper `getModifierKey()` (mismo de `<Kbd>`). MVP: el consumer pasa los símbolos correctos.
5. **Auditoría heredada `text-white`**. Antes de aplicar este componente al repo (S12), grepar `text-white` y `color: white` en `src/components/**` y migrar a `var(--text-on-accent)`. Es deuda S0 de Atelier legacy — `tokens.md §1.3` y ADR 0001 D14 lo flaggean explícito. Suma: revisar también `text-white/90`, `bg-white/...` con texto encima, y clases Tailwind hardcoded en CTAs legacy.
6. **Loading + form submit**. Cuando `type="submit"` y `loading={true}`, asegurarse de que el form no se vuelve a enviar si el usuario presiona Enter. El consumer maneja el lock real; el botón solo señaliza visualmente.
7. **Reduced motion**. Implementar via `@media (prefers-reduced-motion: reduce)` global (ya provisto por `tokens-css.md §7.4`) — no requiere lógica JS adicional. El spinner cae a "opacity 1, no rotation" + el SR lee "Cargando" via `aria-busy` y el texto sr-only.
8. **Variant cambio en runtime**. Si un consumer cambia `variant` programáticamente (ej. de `primary` a `loading`-ish), los tokens transicionan vía CSS — no requiere remount.
9. **Tooltip opcional**. Si en S12 se decide que algunos botones llevan tooltip (ej. con info adicional cuando `disabled`), agregar prop `tooltip?: string` y dependencia con futuro `<Tooltip>`. Fuera de scope MVP.
