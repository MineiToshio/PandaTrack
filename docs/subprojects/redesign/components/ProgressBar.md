---
title: ProgressBar
tier: 2
status: spec — S5 (ready for implementation)
last_updated: 2026-05-02
session: 05-app-shell
adrs:
  - ADR 0003 D3 (sidebar collapse/expand — usa ProgressBar internamente como indicador de progreso de wizard)
---

# ProgressBar

## Propósito

Barra de progreso lineal para indicar el estado de avance de un proceso cuantificable (porcentaje pagado de un pedido, progreso del hero del dashboard) o el estado de un proceso indeterminado (carga lenta). Atom de Tier 2 consumido por:

- `<WizardStep>` — progress visual del wizard accordion
- `screens/orders-list.md` — columna de porcentaje pagado en cada row
- `screens/order-detail.md` — barra de porcentaje pagado del pedido
- `screens/dashboard.md` — hero progress 62% gradient accent→accent-warm

No tiene interacción propia — es display-only.

## API TypeScript

```ts
type ProgressBarVariant = "accent" | "success" | "warm-gradient" | "destructive";
type ProgressBarSize = "sm" | "md";

type ProgressBarProps = {
  /** Porcentaje de progreso. Rango 0–100. Con `indeterminate`, se ignora. */
  value?: number;
  /** Cuando `true` el fill anima indefinidamente (proceso en curso sin porcentaje conocido). */
  indeterminate?: boolean;
  /** Paleta del fill. Default `accent`. */
  variant?: ProgressBarVariant;
  /** Altura del track. `sm` = 4px, `md` = 8px. Default `sm`. */
  size?: ProgressBarSize;
  /** Label accesible (sr-only si no se quiere visible). Requerido para ARIA. */
  label: string;
  /** Muestra el label visualmente arriba-izquierda del track. Default `false`. */
  showLabel?: boolean;
  /** Muestra el porcentaje numérico a la derecha del track. Default `false`. */
  showValue?: boolean;
  /** Override del className en el container. */
  className?: string;
};
```

Reglas TS:

- `value` y `indeterminate` son mutuamente excluyentes. Si ambos se pasan, `indeterminate` toma precedencia.
- `value` debe estar en 0–100. Values fuera de rango se clampean silenciosamente.
- `label` es obligatorio para ARIA. Puede ser sr-only cuando `showLabel={false}`.

## Variants / Sizes

| Variant         | Fill receta                                                                 | Uso                                                      |
| --------------- | --------------------------------------------------------------------------- | -------------------------------------------------------- |
| `accent`        | `background: var(--accent);`                                                | Default. % pagado de pedido, wizard step progress.       |
| `success`       | `background: var(--success);`                                               | Cuando value = 100 (completado). Toast achievement halo. |
| `warm-gradient` | `background: linear-gradient(to right, var(--accent), var(--accent-warm));` | Hero del dashboard (gradient editorial).                 |
| `destructive`   | `background: var(--destructive);`                                           | Indicador de error o límite excedido.                    |

| Size | Height token | px  |
| ---- | ------------ | --- |
| `sm` | `--space-1`  | 4   |
| `md` | `--space-2`  | 8   |

## Estados visuales

### Track (ambos modos)

```css
.progress-track {
  width: 100%;
  background: var(--surface-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  overflow: hidden;
  height: var(--size); /* 4px (sm) o 8px (md) */
}
```

### Fill determinado

```css
.progress-fill {
  height: 100%;
  border-radius: var(--radius-pill);
  transition: width var(--motion-base) var(--ease-out-expressive);
}
/* prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  .progress-fill {
    transition: none;
  }
}
```

### Fill indeterminado

```css
.progress-fill--indeterminate {
  width: 40%;
  animation: progress-slide var(--motion-slow) var(--ease-out-expressive) infinite;
}
@keyframes progress-slide {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(350%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .progress-fill--indeterminate {
    animation: none;
    width: 100%;
    opacity: 0.5;
  }
}
```

### Light vs dark

Track: light usa `--surface-elevated` ligeramente más oscuro que `--surface` (paper-overlap). Dark usa `--surface-elevated` con `--elevation-1`. Fill: los tokens semánticos `--accent`/`--success`/etc. tienen valor distinto por modo — se resuelven solos.

## Mobile vs desktop

| Aspecto   | Mobile            | Desktop                   |
| --------- | ----------------- | ------------------------- |
| Tamaño    | `sm` preferido    | `sm` o `md`               |
| showValue | `false` preferido | A criterio del consumidor |
| Label     | sr-only preferido | A criterio del consumidor |

Sin diferencias de comportamiento — solo de densidad visual.

## Accesibilidad

- `role="progressbar"` en el container visual.
- `aria-valuenow={value}` cuando no es indeterminado.
- `aria-valuemin={0}` + `aria-valuemax={100}` siempre.
- `aria-label={label}` siempre (el label accesible es obligatorio).
- Cuando `indeterminate={true}`: omitir `aria-valuenow` (ARIA prohibe `aria-valuenow` en progressbar indeterminado).
- Si `showLabel={true}` el label visual se asocia vía `aria-labelledby` para evitar doble lectura en SR.
- Focus: no es focuseable (display-only).

## Motion

| Qué                | Token de duración    | Token de easing         | Notas                                                                         |
| ------------------ | -------------------- | ----------------------- | ----------------------------------------------------------------------------- |
| Fill width change  | `--motion-base`      | `--ease-out-expressive` | Actualización de porcentaje (optimistic post-pago).                           |
| Indeterminate loop | `--motion-slow`      | `--ease-out-expressive` | Animación de carga continua.                                                  |
| Reduce-motion      | N/A (sin transición) | N/A                     | Cambio instantáneo (determinado); estático 100% opacidad 0.5 (indeterminado). |

## Copy default + i18n

| Clave i18n sugerida              | Valor ES   |
| -------------------------------- | ---------- |
| `components.progressBar.label`   | "Progreso" |
| `components.progressBar.percent` | "{value}%" |

EN se completa en S12.

## Edge cases

1. **value=0**: fill width 0%, ARIA aria-valuenow=0. Track visible con border. Sin fill visible.
2. **value=100**: fill completo. Recomendación: cambiar variant a `success` para el estado "100% pagado".
3. **value > 100 o < 0**: clampear a rango 0–100. Sin error visible.
4. **Container muy angosto** (< 4rem): el fill sigue siendo visible. No colapsar.
5. **showValue + indeterminate**: ocultar el número (no tiene valor). Mostrar "—" si el consumidor lo requiere.
6. **Cambio de value durante mount**: la transición CSS se aplica solo a cambios post-mount. El valor inicial se renderiza sin transición.

## Anti-patrones

1. **`fill: var(--accent-warm)` como fill principal**: `--accent-warm` es decorativo, nunca texto ni fill funcional. Solo en `warm-gradient` como parte del gradiente.
2. **opacity para el track**: no usar `opacity` para el track deshabilitado. Usar `--surface-elevated` que ya tiene menor contraste.
3. **Omitir `label`**: viola ARIA. Aunque sea sr-only, es obligatorio.
4. **Usar ProgressBar como spinner**: para loading circular usar `Lucide loader-2` en el Button/IconButton. ProgressBar es siempre horizontal.
5. **Hardcodear `4px` o `8px`**: usar `--space-1` y `--space-2`.

## Ejemplos de uso

```tsx
// % pagado de un pedido en row de lista
<ProgressBar
  value={60}
  variant="accent"
  size="sm"
  label="60% pagado"
  showValue
/>

// Hero dashboard
<ProgressBar
  value={62}
  variant="warm-gradient"
  size="md"
  label="62% del total pagado"
  showLabel
  showValue
/>

// Pedido completamente pagado
<ProgressBar
  value={100}
  variant="success"
  size="sm"
  label="100% pagado"
/>

// Carga en curso (indeterminado)
<ProgressBar
  indeterminate
  variant="accent"
  size="sm"
  label="Cargando..."
/>
```

## Tokens consumidos

- `--surface-elevated` (track background)
- `--border` (track border)
- `--accent` (fill accent)
- `--success` (fill success)
- `--accent-warm` (fill warm-gradient endpoint)
- `--destructive` (fill destructive)
- `--radius-pill` (track + fill border-radius)
- `--space-1` (sm height), `--space-2` (md height)
- `--text-secondary` (valor numérico)
- `--text-muted` (label visible)
- `--text-caption`, `--text-body` (tipografía label/value)
- `--motion-base`, `--motion-slow`
- `--ease-out-expressive`

## ADRs aplicables

- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md): D8 (micro-stats dashboard usan ProgressBar variant warm-gradient).
- [ADR 0003 — Demo decisions](../decisions/0003-demo-decisions.md): D1 (Velvet — los tokens de color del fill son Velvet).

## Dependencias

Ninguna (atom puro de tokens). No compone otros componentes.

## Notas para S5 (implementación)

1. Implementar como `src/components/core/ProgressBar.tsx` — atom simple, no necesita carpeta.
2. La transición `width` en el fill es clave para el feedback optimístico post-pago (S7 Módulo Órdenes).
3. `indeterminate` se usa en S9 para skeleton/loading states dentro del shell.
4. Test units: states (determinado 0/50/100), indeterminado, edge cases value overflow, ARIA attributes.
