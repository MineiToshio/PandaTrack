---
title: MonoCode
tier: 1
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0007 (code mono identificador en --text-secondary, no --text-muted)
  - ADR 0001 D5 (view-transition-name `order-{humanId}`, `delivery-{humanId}`, `store-{slug}`)
---

# MonoCode

## Propósito

Atom tipográfico que renderiza **identificadores en mono code** (`PT-002418`, `delivery-abc123`, `store-akiba-records`). Por default usa `--text-secondary` (ADR 0007 — robustez outdoor para strings densos cuya función depende del reconocimiento exacto carácter por carácter). Aparece en: header del detail de pedidos / entregas / tiendas, eyebrow `↳ DESDE PT-XXXXXX` (field-as-attribute), groups del paso 2 de [`delivery-create.md`](../screens/delivery-create.md) ("PT-002418 · 3 items"), command palette, view-transition naming convention (ADR 0001 D5). Soporta `tabular-nums`, `selectable: boolean`, y variant `inline` para uso dentro de body (donde queda en `--text-muted`).

## API TypeScript

```ts
type MonoCodeVariant = "identifier" | "inline";

type MonoCodeProps = {
  /** Contenido. String denso (ej. `PT-002418`). */
  children: ReactNode;
  /** Variant. Default `identifier` (`--text-secondary`). `inline` usa `--text-muted` (no es identificador primario). */
  variant?: MonoCodeVariant;
  /** Tamaño. Default `md` (`--text-mono` 13px). `lg` usa `--text-mono-lg` (15px) para detail headers. */
  size?: "sm" | "md" | "lg";
  /** Si el contenido se puede seleccionar/copiar. Default `true`. */
  selectable?: boolean;
  /** Etiqueta semántica HTML. Default `code`. Usar `span` cuando no es código (raro). */
  as?: "code" | "span";
};
```

## Variants / Sizes

| Variant      | Uso                                                                                                       | Tokens consumidos                                            |
| ------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `identifier` | Default — `PT-002418` en row de lista, header de detail, eyebrow attribute, group header, command palette | `--text-secondary` (ADR 0007), `--font-mono`, `--text-mono`  |
| `inline`     | Uso decorativo dentro de body (ej. "el ID `xyz` corresponde a…")                                          | `--text-muted`, `--font-mono`, `--text-mono`                 |

| Size  | Uso                                                                | Tokens consumidos                                           |
| ----- | ------------------------------------------------------------------ | ----------------------------------------------------------- |
| `sm`  | Inline en captions / chip                                          | `--text-eyebrow` (11px)                                     |
| `md`  | Default — listas, attributes, group headers                        | `--text-mono` (13px)                                        |
| `lg`  | Detail page headers ("Pedido `PT-002418`"), section card titles    | `--text-mono-lg` (15px)                                     |

## Estados visuales

| Estado          | Receta CSS (light)                                                                                                                                                                                                                                              | Receta CSS (dark) | Notas                                                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `identifier`    | `font-family: var(--font-mono); font-size: var(--text-mono); line-height: var(--text-mono--line-height); letter-spacing: var(--text-mono--letter-spacing); font-weight: var(--font-weight-mono); color: var(--text-secondary); font-variant-numeric: tabular-nums; font-feature-settings: "calt", "ss01", "tnum";` | mismo             | ADR 0007 — `--text-secondary` (no `--text-muted`).                                                                              |
| `inline`        | mismo + `color: var(--text-muted);`                                                                                                                                                                                                                              | mismo             | Caso decorativo, no identificador primario.                                                                                    |
| `selectable=false` | mismo + `user-select: none;`                                                                                                                                                                                                                                  | mismo             | Para casos donde el copy del ID no aporta valor (raro).                                                                        |

Receta base (CSS):

```css
.monocode {
  font-family: var(--font-mono);
  font-size: var(--text-mono);
  line-height: var(--text-mono--line-height);
  letter-spacing: var(--text-mono--letter-spacing);
  font-weight: var(--font-weight-mono);
  color: var(--text-secondary); /* ADR 0007 default */
  font-variant-numeric: tabular-nums;
  font-feature-settings: "calt", "ss01", "tnum";
}

.monocode--inline {
  color: var(--text-muted);
}

.monocode--sm {
  font-size: var(--text-eyebrow);
  line-height: var(--text-eyebrow--line-height);
}

.monocode--lg {
  font-size: var(--text-mono-lg);
  line-height: var(--text-mono-lg--line-height);
}

.monocode--non-selectable {
  user-select: none;
}
```

## Mobile vs desktop

- Mismo tamaño visual en ambos.
- Mobile outdoor: el variant `identifier` con `--text-secondary` (~6.32:1) es el caso outdoor-crítico — se mantiene legible bajo sol (ADR 0007).
- Desktop: el `tabular-nums` evita jitter al actualizar dinámicamente (ej. cuando el hu manId cambia tras crear).

## Accesibilidad

- Rol ARIA: native `<code>` (rol implícito `code`). Cuando `as="span"` no hay rol semántico.
- Atributos opcionales:
  - `aria-label` cuando el contenido tiene caracteres especiales (ej. `↳`) que el SR podría no leer correctamente.
- Keyboard: `selectable: true` (default) permite seleccionar con `Shift+Arrow` y copiar con `Cmd/Ctrl+C`.
- Screen reader: anuncia el contenido carácter por carácter cuando es un identificador denso (`PT-002418` se lee "P-T-guion-cero-cero-dos-cuatro-uno-ocho"). Acceptable para identifier strings — el usuario quiere la precisión.
- `prefers-reduced-motion`: no aplica (sin animación propia).

## Motion

- View-transition (ADR 0001 D5): cuando un row de lista pasa a su detail page, el `<MonoCode>` con `view-transition-name: order-{humanId}` (delegación dinámica) se anima creciendo `font-size: 11px → 13px` sin re-render. Duración fija `--motion-base` (280ms), easing `--ease-vt-signature`.
- Copy success (selectable + click-to-copy futuro): scale `1 → 1.02 → 1` con `--motion-fast` `--ease-out-expressive` + toast neutral.
- Bajo `prefers-reduced-motion`: view-transition desactivada (corte directo).

## Copy default + i18n

| Clave i18n sugerida                          | Valor ES                                  |
| -------------------------------------------- | ----------------------------------------- |
| `components.monoCode.copyAria`               | "Copiar identificador"                    |
| `components.monoCode.copySuccess`            | "Copiado al portapapeles"                 |

(El componente NO tiene copy propio; solo renderiza el contenido recibido.)

## Edge cases

1. **Identificador con prefijo `↳ DESDE`**: el `↳` puede vivir fuera del `<MonoCode>` o adentro como `<span aria-hidden="true">↳ </span>` para que el SR no lo lea como "flecha".
2. **Identificador muy largo** (slug de tienda con 30+ chars): permite wrap o agrega `text-overflow: ellipsis` cuando vive en row (decisión del padre, no del atom).
3. **View-transition en lista virtualizada**: la delegación dinámica setea el `view-transition-name` solo en el row clickeado/focused. El `<MonoCode>` recibe `style={{ viewTransitionName: 'order-PT-002418' }}` cuando aplica.
4. **Identificador con caracteres no ASCII** (futuro): JetBrains Mono soporta Latin Extended; debería renderizar correctamente.
5. **`selectable=false` con click-to-copy**: contradicción — si quieres copiar, debe ser seleccionable. El `selectable: false` se reserva para casos donde el ID es decorativo.
6. **Identificador en estado `loading`** (placeholder skeleton): NO usar `<MonoCode>` con `--text-muted` para skeleton; usar `<Skeleton>` (Tier 2).
7. **Identifier sobre `--surface-elevated` (ej. en field-as-attribute)**: contraste de `--text-secondary` se mantiene ≥4.5:1 (validado en S3 contrast audit).

## Anti-patrones

1. **Usar `--text-muted` para identificador** (ADR 0007 prohíbe — usar `--text-secondary`).
2. **Hardcodear `font-family: 'JetBrains Mono'`**: usar `--font-mono` (token).
3. **Sin `tabular-nums`**: produce jitter al actualizar. Siempre activado.
4. **`text-transform: uppercase`**: los identificadores son case-sensitive (`PT-002418` distinto de `pt-002418`). Nunca aplicar.
5. **Animar `font-size` en view-transition con `--ease-out-expressive`**: usar `--ease-vt-signature` (ADR 0001 D5).
6. **`view-transition-name` global en TODA lista**: la delegación dinámica solo lo aplica al row activo (evita colisiones).
7. **`<MonoCode>` con icono leading sin label adyacente**: el identificador YA es label; los íconos suman, no reemplazan.

## Ejemplos de uso

```tsx
// Order detail · header con humanId (size lg)
<header>
  <h1>Pedido</h1>
  <MonoCode size="lg">PT-002418</MonoCode>
</header>

// Field-as-attribute · prefix eyebrow + identifier
<div className="field-as-attribute">
  <span className="eyebrow">↳ DESDE</span> <MonoCode size="sm">PT-002418</MonoCode>
  ...
</div>

// Delivery create · paso 2 · group header
<header>
  <MonoCode>PT-002418</MonoCode> · 3 items
</header>

// View-transition shared element del list → detail
<MonoCode style={{ viewTransitionName: `order-${humanId}` }}>{humanId}</MonoCode>
```

## Tokens consumidos

- `--font-mono`
- `--font-weight-mono`
- `--text-mono`, `--text-mono-lg`, `--text-eyebrow`
- `--text-secondary`, `--text-muted`
- `--motion-base`
- `--ease-vt-signature`

## ADRs aplicables

- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md) (D5 view-transition-name convention)
- [ADR 0007 — Text muted outdoor code mono reassignment](../decisions/0007-text-muted-outdoor-code-mono-reassignment.md)

## Dependencias

Ninguna. Es atom tipográfico puro.

## Notas para S12 (implementación)

1. El `view-transition-name` se aplica con `style={{ viewTransitionName: ... }}` en la instancia del row activo (delegación dinámica). El componente NO orquesta — solo lo recibe.
2. Click-to-copy es feature opcional (futuro). MVP: el atom es solo render. La copia la implementa un wrapper (Tier 2) `<CopyableMonoCode>` con tooltip.
3. La detección de outdoor para legibilidad NO es responsabilidad del componente; los tokens `--text-secondary` lo cubren.
4. Validar en S6 con mocks reales que el `--text-secondary` `tabular-nums` se ve bien sobre `--surface` y `--surface-elevated` (ambos backgrounds donde aparece).
5. La utility `.numeric` (ya tokenizada) puede componerse externamente si el padre quiere reforzar `tabular-nums` — el atom ya lo activa por default.
