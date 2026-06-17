---
title: IconButton
tier: 1
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0001 D6 (overflow `[···]` del header de detalle, destructivas irreversibles)
  - ADR 0001 D14 (theme dual — toggle sun/moon)
  - ADR 0003 D2 (theme toggle: solo light/dark, sin system)
  - ADR 0003 D8 (filtros — `sliders-horizontal`)
  - ADR 0006 (icon+label contract — `aria-label` obligatorio)
---

# IconButton

## Propósito

Variante de `<Button>` para acciones icon-only. Aparece en el header de [`order-detail.md`](../screens/order-detail.md) como overflow `[···]` (ADR 0001 D6 — destructivas irreversibles), en el shell global como theme toggle `sun`/`moon` (ADR 0001 D14 + ADR 0003 D2), language toggle `globe`, cierre de drawer/modal `x`, trigger de filtros `sliders-horizontal` (ADR 0003 D8), y como botón "Cambiar" en field-as-attribute (ADR 0001 D2 — `pencil`). Garantiza tap target ≥44×44 mobile aún cuando el visual sea 32×32.

## API TypeScript

```ts
import type { ReactNode, ButtonHTMLAttributes } from "react";

type IconButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "destructive-ghost";

type IconButtonSize = "sm" | "md" | "lg";

type IconButtonShape = "pill" | "square";

type IconButtonBaseProps = {
  /** Ícono Lucide (ReactNode SVG). Lleva `aria-hidden="true"` aplicado por el componente. */
  icon: ReactNode;
  /**
   * Etiqueta accesible OBLIGATORIA. Se aplica como `aria-label` al `<button>`.
   * TypeScript rechaza el componente si falta. Aplicar voice glossary §7 — corto, imperativo, en español.
   */
  label: string;
  /** Variante visual. Default `ghost`. */
  variant?: IconButtonVariant;
  /** Tamaño. Default `md`. */
  size?: IconButtonSize;
  /** Forma. Default `pill`. `square` para FAB cuadrado o overflow integrado al header. */
  shape?: IconButtonShape;
  /** Estado de carga. Reemplaza `icon` por spinner Lucide `loader-2`. */
  loading?: boolean;
  /** Si el botón es un toggle (theme/lang), pasar el estado actual para `aria-pressed`. */
  pressed?: boolean;
};

type IconButtonProps = IconButtonBaseProps &
  Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "children" | "aria-label"
  > & {
    /** Tipo nativo del `<button>`. Default `"button"`. */
    type?: "button" | "submit" | "reset";
  };
```

Reglas TS:

- `label` es **obligatorio** (no opcional, no fallback). El compilador rechaza `<IconButton icon={<X />} />` sin `label`. Esto formaliza el contrato icon+label de [ADR 0006](../decisions/0006-color-blindness-icon-label-contract.md): un ícono sin etiqueta accesible es siempre un fallo.
- `aria-label` no se acepta como prop directa — se computa siempre desde `label`. Esto previene divergencia visual/accesible.
- `pressed` activa `aria-pressed`. Cuando es `undefined`, el componente no rinde el atributo (botón no-toggle).

## Variants / Sizes

### Variants

Mismas variants visuales que `<Button>`, restringidas a las útiles para icon-only:

| Variant             | Uso                                                                                                                | Tokens consumidos                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `primary`           | FAB de "Crear" en mobile (cuando aplica), accent CTA icon-only en empty states puntuales.                          | bg `--accent`, color `--text-on-accent`, `--elevation-2`, `--focus-ring`                            |
| `secondary`         | Trigger de filtros `sliders-horizontal` en header, theme toggle cuando se quiere presencia mayor.                  | bg `--surface-elevated`, color `--text-primary`, border `--border-strong`                            |
| `ghost` (default)   | Overflow `[···]`, cierre de modal/drawer `x`, theme/lang toggles del header, pencil de field-as-attribute.         | bg `transparent`, color `--text-primary`                                                            |
| `destructive-ghost` | Trash inline (ej. eliminar item del wizard cuando es reversible vía undo). Las irreversibles van en menú overflow. | bg `transparent`, color `--destructive`                                                             |

`destructive` sólido NO se ofrece como variant de `<IconButton>`: una acción destructiva final siempre lleva texto en su confirm modal (`<Button variant="destructive">Eliminar</Button>`), nunca se confirma con un ícono solo.

### Sizes

| Size | Visual (cuadrado / pill) | Ícono Lucide | Tap target real           | Uso                                                                                                  |
| ---- | ------------------------ | ------------ | ------------------------- | ---------------------------------------------------------------------------------------------------- |
| `sm` | `2rem` (32×32)           | `1rem` (16)  | 44×44 mobile via padding   | Filas densas, toolbars, "limpiar campo" en input.                                                    |
| `md` | `2.5rem` (40×40)         | `1.125rem` (18) | 44×44 mobile via padding | Default. Header del shell (theme/lang), overflow `[···]`, filtros, cierre de drawer.                  |
| `lg` | `3rem` (48×48)           | `1.25rem` (20) | 48×48 nativo              | FAB, CTAs principales icon-only en empty/celebratory.                                                |

**Tap target extendido (mobile):** `sm` y `md` declaran un `padding` clickable adicional via pseudo-elemento `::before` con `inset: -6px` (sm) / `inset: -2px` (md), garantizando 44×44 sin afectar el layout visual. Comportamientos transversales §1.

### Shape

| Shape          | Radius           | Uso                                                                                                                                     |
| -------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `pill` (default) | `--radius-pill` | Default tokens.md §5 para icon button. Toggles, overflow, cierre, filtros.                                                              |
| `square`       | `--radius-md`   | FAB cuadrado, overflow integrado al header con esquinas afines a la card adyacente, casos donde el círculo rompe la geometría del bloque. |

## Estados visuales

Mismos estados que `<Button>`, con la única diferencia visual de que el state layer cubre toda la superficie circular/cuadrada y el ícono queda centrado.

| Estado          | Receta CSS (light)                                                                                                                     | Receta CSS (dark) | Notas                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------- |
| `default`       | Hereda de la variant elegida. Ej. `ghost`: `background: transparent; color: var(--text-primary); border-radius: var(--radius-pill);`   | mismo             | El ícono toma `currentColor`, por eso `color: var(--text-primary)` lo tiñe.                  |
| `hover`         | overlay `color-mix(in oklch, var(--text-primary) var(--state-hover-mix), transparent)` (mix=6%)                                        | mix=8%            | Sobre `destructive-ghost`: `color-mix(... --destructive ...)` igual que en `<Button>`.       |
| `pressed`       | overlay mix=12%                                                                                                                        | mix=14%           |                                                                                             |
| `focus-visible` | `outline: 2px solid var(--focus-ring); outline-offset: 2px;`                                                                            | mismo             | El offset 2px deja respirar el ring contra otros controles adyacentes en la toolbar.         |
| `disabled`      | `color: var(--text-muted); pointer-events: none;` (sin `opacity`)                                                                      | mismo             | El ícono se decolora vía `currentColor` al `--text-muted`. ADR 0001 D3.                      |
| `loading`       | ícono → spinner `loader-2`; `aria-busy="true"`; `pointer-events: none`; tamaño preservado                                              | mismo             | Mismo motion que `<Button>`.                                                                |
| `pressed=true`  | (toggle on) — se aplica `aria-pressed="true"`. Visual: igual que default + state-layer ligero (mix=6%) constante para señalizar estado. | mismo             | Útil en theme toggle (cuando dark está activo, el botón sun queda visualmente "activo").     |

### Receta base (CSS)

```css
.icon-button {
  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-pill);
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  transition:
    background-color var(--motion-fast) var(--ease-emphasis),
    color var(--motion-fast) var(--ease-emphasis),
    border-color var(--motion-fast) var(--ease-emphasis),
    outline-color var(--motion-fast) var(--ease-emphasis);
}

.icon-button[data-shape="square"] {
  border-radius: var(--radius-md);
}

/* Tamaños */
.icon-button[data-size="sm"] { width: 2rem; height: 2rem; }
.icon-button[data-size="md"] { width: 2.5rem; height: 2.5rem; }
.icon-button[data-size="lg"] { width: 3rem; height: 3rem; }

/* Tap target extendido en mobile (sm/md) */
@media (max-width: 47.99rem) {
  .icon-button[data-size="sm"]::before,
  .icon-button[data-size="md"]::before {
    content: "";
    position: absolute;
    inset: -6px; /* sm */
    /* md: inset: -2px; — ajustado vía data-attr */
  }
  .icon-button[data-size="md"]::before {
    inset: -2px;
  }
}

/* State layer */
.icon-button::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-color: transparent;
  pointer-events: none;
  transition: background-color var(--motion-fast) var(--ease-emphasis);
}

.icon-button:hover::after {
  background-color: color-mix(in oklch, var(--text-primary) var(--state-hover-mix), transparent);
}

.icon-button:active::after {
  background-color: color-mix(in oklch, var(--text-primary) var(--state-pressed-mix), transparent);
}

.icon-button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.icon-button[aria-pressed="true"]::after {
  background-color: color-mix(in oklch, var(--text-primary) var(--state-hover-mix), transparent);
}

.icon-button[data-variant="destructive-ghost"] {
  color: var(--destructive);
}

.icon-button[data-variant="destructive-ghost"]:hover::after {
  background-color: color-mix(in oklch, var(--destructive) var(--state-hover-mix), transparent);
}

.icon-button[data-variant="destructive-ghost"]:active::after {
  background-color: color-mix(in oklch, var(--destructive) var(--state-pressed-mix), transparent);
}

.icon-button[data-variant="primary"] {
  background: var(--accent);
  color: var(--text-on-accent);
  box-shadow: var(--elevation-2);
}

.icon-button[data-variant="secondary"] {
  background: var(--surface-elevated);
  color: var(--text-primary);
  border-color: var(--border-strong);
}

.icon-button[data-disabled="true"] {
  color: var(--text-muted);
  pointer-events: none;
  background: transparent;
  border-color: transparent;
  box-shadow: none;
}

.icon-button[data-loading="true"] svg {
  animation: icon-button-spin var(--motion-base) linear infinite;
  animation-duration: calc(var(--motion-base) * 4);
}

@keyframes icon-button-spin {
  to { transform: rotate(360deg); }
}
```

## Mobile vs desktop

| Aspecto                          | `< --breakpoint-md` (mobile)                                                                                                                       | `≥ --breakpoint-md` (desktop)                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Tap target                       | Extendido a 44×44 vía `::before` con `inset` negativo (sm/md). El visual permanece a 32/40px.                                                       | Visual = clickable. Sin extensión adicional.                                                            |
| Overflow `[···]` del header (D6) | Ícono Lucide `more-horizontal` (orientación móvil; el menú abre desde abajo).                                                                      | Ícono Lucide `more-vertical` (orientación clásica desktop; el menú abre alineado al borde derecho).     |
| Theme toggle                     | Vive en sidebar mobile bajo el bubble panda (long-press) — ver ADR 0001 D14. Si en futuro va al header, queda con `size="md"` y `shape="pill"`.    | Vive en account menu / header. `size="md"`, `shape="pill"`, `aria-pressed` refleja el modo activo.     |
| Tooltip                          | No mostrar tooltip en mobile (no hay hover). Long-press puede activar action sheet con el `label` como título — comportamiento delegado al consumer. | Tooltip opcional con `label` aparece en hover/focus después de `--motion-base`. Componente futuro `<Tooltip>`. |

## Accesibilidad

- Rol ARIA: nativo `<button>`. Sin `role="button"` manual.
- `aria-label={label}` aplicado siempre (obligatorio por TS). Sin él, el botón es invisible para screen readers.
- `aria-pressed` aplicado solo cuando `pressed` está definido (toggles). `true` / `false` — nunca `mixed`.
- `aria-busy="true"` durante `loading`. El spinner `loader-2` lleva `aria-hidden="true"`.
- `aria-haspopup` / `aria-expanded` no son responsabilidad del componente — el consumer los aplica vía spread cuando el botón abre un menú/popover (overflow `[···]`, theme toggle con menú).
- Keyboard:
  - `Tab` / `Shift+Tab`: navegación.
  - `Enter` y `Space`: dispara `onClick`.
  - El handler de `Esc` para cerrar drawer/modal vive en el padre (drawer/modal), no en el botón.
- Focus management: `:focus-visible` con `--focus-ring` outline 2px + offset 2px. El offset es crítico cuando el botón está pegado a un borde (ej. cierre `x` del modal pegado al borde superior derecho).
- Screen reader:
  - Anuncia `label` siempre.
  - Para toggles, suma "presionado" / "no presionado" via `aria-pressed`.
  - Para overflow `[···]` que abre menú: el consumer pasa `aria-haspopup="menu"` + `aria-expanded={isOpen}`.
- `prefers-reduced-motion`: spinner deja de rotar; el SR lee "Cargando" via `aria-busy`. Hover/focus transitions caen a `--motion-fast` (ya son rápidas).
- Mínimo táctil: 44×44 garantizado vía padding clickable extendido en mobile (no recae en `min-width/min-height` que romperían el visual circular).

## Motion

| Qué se anima              | Token de duración                       | Token de easing          | Notas                                                                  |
| ------------------------- | --------------------------------------- | ------------------------ | ---------------------------------------------------------------------- |
| State layer (`::after`)   | `--motion-fast` (150ms)                 | `--ease-emphasis`        | `background-color` en hover/active/aria-pressed.                        |
| Focus ring                | `--motion-fast`                         | `--ease-emphasis`        | `outline-color`.                                                        |
| Color/border transitions  | `--motion-fast`                         | `--ease-emphasis`        | Ej. cuando el theme cambia, el ícono `sun`/`moon` se intercambia con cross-fade. |
| Spinner loading           | `calc(var(--motion-base) * 4)` (1120ms) | `linear` (rotación pura) | Mismo que `<Button>`.                                                  |
| Theme toggle swap         | `--motion-base` (280ms)                 | `--ease-emphasis`        | Cross-fade entre `sun` y `moon` (delegado al consumer/animación CSS).  |
| `prefers-reduced-motion`  | `--motion-fast`                         | `--ease-emphasis`        | Spinner se desactiva; theme swap = corte directo sin cross-fade.        |

## Copy default + i18n

| Clave i18n sugerida                       | Valor ES (voice glossary aplicado)        |
| ----------------------------------------- | ----------------------------------------- |
| `components.iconButton.close`             | "Cerrar"                                  |
| `components.iconButton.menu`              | "Más opciones"                            |
| `components.iconButton.themeLight`        | "Cambiar a modo claro"                    |
| `components.iconButton.themeDark`         | "Cambiar a modo oscuro"                   |
| `components.iconButton.langToggle`        | "Cambiar idioma"                          |
| `components.iconButton.filters`           | "Filtros"                                 |
| `components.iconButton.edit`              | "Cambiar"                                 |
| `components.iconButton.loading.label`     | "Cargando"                                |

EN se deja para S12. Cualquier `label` custom debe consumir `useTranslations()` — nunca hardcodear strings ES en TSX.

## Edge cases

1. **Toggle theme con `aria-pressed`**: el botón rinde el estado opuesto (ícono `moon` cuando el modo activo es light, anuncia "Cambiar a modo oscuro"). `aria-pressed` debe reflejar el modo **objetivo** del click, no el estado actual — convención inversa que el consumer maneja, o usar `aria-pressed={isDark}` con label "Modo oscuro" siempre. Decisión final S12.
2. **Lang toggle "ES"/"EN" tabular**: cuando el "ícono" es texto tabular ("ES"/"EN") en vez de un Lucide, pasarlo como `icon={<span className="lang-glyph">ES</span>}`. El componente lo trata igual; `label` sigue siendo obligatorio ("Cambiar idioma a inglés").
3. **Overflow `[···]` que abre menú**: el consumer aplica `aria-haspopup="menu"` y `aria-expanded={isOpen}` via spread. El componente no atrapa la lógica del menú (composición con `<DropdownMenu>` futuro).
4. **`label` largo**: no afecta visualmente (el `aria-label` no se renderiza). El SR lo lee íntegro. Los demás verán solo el ícono + tooltip si existe.
5. **`loading` en toggle**: durante `loading={true}`, `aria-pressed` se mantiene (el estado lógico no cambió). Visual: spinner reemplaza al ícono pero conserva el estado state-layer del toggle.
6. **`square` en FAB**: `shape="square"` + `size="lg"` + `variant="primary"` produce un FAB cuadrado con `--radius-md`. La sombra se mantiene en `--elevation-2`.
7. **Botón pegado al borde (cierre de modal `x`)**: el outline-offset 2px puede recortarse. Garantizar que el padre del modal tenga `overflow: visible` en la zona del botón o aceptar el clipping cosmético — el ring sigue visible >50% del perímetro.
8. **Múltiples icon buttons consecutivos en toolbar**: separar con `gap: var(--space-1)` mínimo para que los tap targets extendidos en mobile no se solapen perceptualmente. El consumer (toolbar) define el gap, no el botón.
9. **`disabled` con tooltip**: el tooltip debe seguir mostrándose en focus para explicar por qué está deshabilitado (a11y win). Implementación delegada al `<Tooltip>` futuro.
10. **`destructive-ghost` icon-only**: solo válido cuando la acción es **reversible vía undo** (toast neutral-undo, ADR 0001 D4). Las irreversibles requieren confirm modal y por tanto van con texto: usar `<Button variant="destructive-ghost">` con `leadingIcon`.

## Anti-patrones

1. **`aria-label` ausente o vacío** (`label=""`): rompe el contrato icon+label de [ADR 0006](../decisions/0006-color-blindness-icon-label-contract.md). TS lo previene; en runtime no debería ocurrir.
2. **Tap target visible-only sin padding extendido en mobile**: viola comportamientos transversales §1. Inviolable.
3. **`text-white` o color hardcoded sobre `--accent` (variant `primary`)**: rompe en dark donde `--text-on-accent` es oscuro. Usar `var(--text-on-accent)` siempre.
4. **`opacity: 0.5` para disabled**: prohibido. Usar `--text-muted`.
5. **`destructive` sólido como variant de IconButton**: no existe por construcción. Las acciones destructivas finales tienen texto en su confirm.
6. **Confiar solo en el ícono para indicar estado** (sin `aria-pressed` para toggles): inaccesible. ADR 0006 + WCAG 1.1.1.
7. **Cierre de modal sin `aria-label="Cerrar"`** (o equivalente): SR escucha "botón" sin contexto. Inaceptable.
8. **`size="sm"` para overflow `[···]` que abre menú**: target visual 32px sin extender = riesgo de mishit en mobile. Usar `size="md"` mínimo, o asegurar el padding extendido a 44×44.
9. **Tooltip que repite literal el `label`**: redundante visualmente pero útil para users que no entienden el ícono. Aceptable en mobile via long-press; en desktop, considerar acortar el tooltip o agregar contexto adicional.
10. **`shape="square"` para overflow `[···]` aislado**: rompe la convención visual de "icon button = pill". Solo usar `square` cuando el botón se integra a un grupo cuadrado (ej. card header con esquinas duras).

## Ejemplos de uso

```tsx
// Header del shell — theme toggle (ADR 0001 D14 + ADR 0003 D2)
<IconButton
  icon={isDark ? <Sun /> : <Moon />}
  label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
  pressed={isDark}
  variant="ghost"
  size="md"
  onClick={handleToggleTheme}
/>

// Header de detalle de pedido — overflow [···] (ADR 0001 D6)
<IconButton
  icon={<MoreVertical />}
  label="Más opciones"
  variant="ghost"
  size="md"
  aria-haspopup="menu"
  aria-expanded={isMenuOpen}
  onClick={handleOpenOverflow}
/>

// Lista de pedidos — trigger de filtros (ADR 0003 D8)
<IconButton
  icon={<SlidersHorizontal />}
  label="Filtros"
  variant="secondary"
  size="md"
  onClick={handleOpenFilters}
/>

// Modal — botón cerrar pegado al borde superior derecho
<IconButton
  icon={<X />}
  label="Cerrar"
  variant="ghost"
  size="md"
  onClick={handleClose}
/>

// Field-as-attribute — pencil "Cambiar" (ADR 0001 D2 — alternativa icon-only)
<IconButton
  icon={<Pencil />}
  label="Cambiar"
  variant="ghost"
  size="sm"
  onClick={handleEdit}
/>
```

## Tokens consumidos

- `--accent`, `--destructive`
- `--text-primary`, `--text-muted`, `--text-on-accent`
- `--surface-elevated`
- `--border-strong`
- `--focus-ring`
- `--state-hover-mix`, `--state-pressed-mix`
- `--radius-pill`, `--radius-md`
- `--motion-fast`, `--motion-base`
- `--ease-emphasis`
- `--elevation-2`
- `--breakpoint-md`

## ADRs aplicables

- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md): D2 (`pencil` de field-as-attribute), D3 (disabled sin opacity), D6 (overflow `[···]` con `more-horizontal` mobile / `more-vertical` desktop), D14 (theme toggle dual con `sun`/`moon`).
- [ADR 0003 — Demo decisions](../decisions/0003-demo-decisions.md): D2 (theme toggle solo light/dark, sin system), D8 (filtros con `sliders-horizontal`).
- [ADR 0006 — Color blindness icon-label contract](../decisions/0006-color-blindness-icon-label-contract.md): `label` (aria) obligatorio por TS — el contrato icon+label se cumple por construcción.

## Dependencias

- `<Button>` — comparte recetas, tokens, motion. Si en S12 se decide refactorizar como wrapper de `<Button>` con `iconOnly` mode, mantener la API pública del IconButton intacta para no romper consumers.
- Lucide icons (`more-horizontal`, `more-vertical`, `sun`, `moon`, `globe`, `x`, `sliders-horizontal`, `pencil`, `loader-2`, `plus`).
- (Futuro) `<Tooltip>` — slot opcional cuando el botón está en desktop y el ícono no es auto-evidente.
- (Futuro) `<DropdownMenu>` — para el caso overflow `[···]`.

## Notas para S12 (implementación)

1. **Tap target extendido vía `::before`**. El padding clickable se logra con un pseudo-elemento absoluto `inset: -6px` (sm) / `inset: -2px` (md). No interfiere con sibling layout porque `position: absolute`. Validar con e2e que no se solapa con icon buttons adyacentes en toolbars; si se solapa, usar `gap: var(--space-1)` mínimo entre ellos en el contenedor.
2. **`label` requerido por TS**. Implementar como prop required en la firma — TS lo rechaza en compile time. Sumar lint rule `no-iconbutton-without-label` opcional para CI doble-cheque.
3. **`aria-pressed` semántica**. Decidir convención S12: `pressed = (estado actual)` o `pressed = (estado objetivo del click)`. Recomendado el primero (refleja estado actual del UI) — más intuitivo para SR. Documentar en el componente real.
4. **Theme toggle con cross-fade entre `sun` y `moon`**. Implementación CSS: dos íconos absolutos en el mismo wrapper, opacity transitions. Bajo `prefers-reduced-motion`: corte directo sin fade.
5. **Auditoría heredada `text-white`**. Mismo punto que en `<Button>`: antes de aplicar al repo, grepar y migrar legacy CTAs que usen `text-white` sobre `--accent`.
6. **Tooltip integration**. Cuando se sume `<Tooltip>` (sesión futura), exponer `tooltip?: string` opcional que default-ea a `label` cuando se omite. La duración de delay en hover usa `--motion-base`.
7. **Overflow menu integration**. El componente no provee `<DropdownMenu>`. El consumer compone:
   ```tsx
   <DropdownMenu trigger={<IconButton icon={<MoreVertical />} label="Más opciones" />}>
     <DropdownMenuItem destructive>Eliminar</DropdownMenuItem>
   </DropdownMenu>
   ```
8. **`aria-haspopup` / `aria-expanded`**. Aceptados via spread (no enumerados en la API explícita). El consumer los aplica cuando el botón gobierna un popover. Validar en S12 que TS no los pierde por el `Omit` de la firma.
9. **Reduced motion**. Spinner se desactiva globalmente vía `@media (prefers-reduced-motion)` en `tokens-css.md §7.4`. Theme swap cross-fade se implementa con la misma media query: `@media (prefers-reduced-motion: reduce) { .icon-button .icon-cross-fade { transition: none; } }`.
10. **Forma `square` para FAB**. Si el FAB lleva texto opcional (ej. "Crear" + ícono `+` en empty state desktop), usar `<Button>` con `leadingIcon`, no `<IconButton shape="square">`. La separación es intencional: `<IconButton>` es siempre icon-only.
