---
title: StatusChip
tier: 2
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0001 D1 (token --info)
  - ADR 0002 (mapeo enums → variant + Lucide + copy ES)
  - ADR 0006 (icon+label obligatorios para kind=info — discriminated union TS)
  - ADR 0007 (code mono identificador en --text-secondary, no aplica al chip pero coexiste)
---

# StatusChip

## Propósito

Pill compacto que comunica un estado del dominio o un derivado en una row. Aparece como chip principal en cada row de [`orders-list.md`](../screens/orders-list.md), en el header del [`order-detail.md`](../screens/order-detail.md), en cada item del paso 2 de [`delivery-create.md`](../screens/delivery-create.md), en el peek panel y activity feed del [`dashboard.md`](../screens/dashboard.md), y en filtros activos del filter drawer. Un chip = un estado; varios estados (principal + derivado) viven adyacentes, no fusionados.

## API TypeScript

```ts
import type { ReactNode } from "react";

type ChipVariant =
  | "success"
  | "warning"
  | "destructive"
  | "info"
  | "accent"
  | "neutral";

type ChipSize = "sm" | "md";

type StatusChipBase = {
  /** Default `md`. `sm` para chip-only en row densa. */
  size?: ChipSize;
  /** Anuncio screen reader cuando el chip tiene un cambio dinámico (atrasada N días, % pagado). */
  ariaLabel?: string;
};

type StatusChipProps =
  | (StatusChipBase & {
      kind: "orderStatus";
      value:
        | "OPEN"
        | "PARTIALLY_IN_TRANSIT"
        | "IN_TRANSIT"
        | "PARTIALLY_DELIVERED"
        | "COMPLETED"
        | "CANCELLED";
    })
  | (StatusChipBase & {
      kind: "deliveryStatus";
      value: "IN_TRANSIT" | "DELIVERED" | "CANCELLED";
      /** Cuando se renderiza un IN_TRANSIT con expectedArrivalTo < now, el padre pasa overdueDays. El chip muta a warning + copy "Atrasada N días". */
      overdueDays?: number;
    })
  | (StatusChipBase & {
      kind: "itemDeliveryState";
      value: "NONE" | "ARRIVED_AT_STORE" | "IN_TRANSIT" | "DELIVERED";
    })
  | (StatusChipBase & {
      kind: "derived";
      value: "paid" | "partial" | "unpaid" | "overdue";
      /** Para `overdue`. */
      days?: number;
      /** Para `partial`. Entero 0–100. */
      pct?: number;
    })
  | (StatusChipBase & {
      kind: "info";
      /** ADR 0006 — OBLIGATORIO. TS rechaza sin esta prop. */
      icon: ReactNode;
      /** ADR 0006 — OBLIGATORIO. */
      label: string;
    })
  | (StatusChipBase & {
      kind: "success" | "warning" | "destructive" | "accent" | "neutral";
      /** Opcional para variants ad-hoc (filtros activos, custom). */
      icon?: ReactNode;
      label: string;
    });
```

(Discriminated union estricta. Para `kind` enumerados (`orderStatus`/`deliveryStatus`/`itemDeliveryState`/`derived`), el componente provee mapping interno enum → variant + Lucide + copy ES default. Para `kind: "info"` icon+label son required (ADR 0006). Para `kind: "success"|"warning"|"destructive"|"accent"|"neutral"` el padre puede componer chips ad-hoc — útil para filtros activos del drawer y casos custom.)

## Mapping enum → variant + Lucide + copy ES (vinculante, ADR 0002)

### `kind: "orderStatus"`

| `value`                  | Variant            | Ícono Lucide   | Copy ES                  | Clave i18n                                  |
| ------------------------ | ------------------ | -------------- | ------------------------ | ------------------------------------------- |
| `OPEN`                   | `neutral`          | `clock`        | "Abierto"                | `components.statusChip.orderStatus.OPEN`    |
| `PARTIALLY_IN_TRANSIT`   | `info`             | `package`      | "Parcialmente en camino" | `components.statusChip.orderStatus.PARTIALLY_IN_TRANSIT` |
| `IN_TRANSIT`             | `info`             | `package`      | "En camino"              | `components.statusChip.orderStatus.IN_TRANSIT` |
| `PARTIALLY_DELIVERED`    | `success` (suave)  | `package-open` | "Llegó parcialmente"     | `components.statusChip.orderStatus.PARTIALLY_DELIVERED` |
| `COMPLETED`              | `success`          | `check-circle` | "Completo"               | `components.statusChip.orderStatus.COMPLETED` |
| `CANCELLED`              | `neutral`          | `ban`          | "Cancelado"              | `components.statusChip.orderStatus.CANCELLED` |

### `kind: "deliveryStatus"`

| `value`      | `overdueDays?` | Variant   | Ícono           | Copy ES         | Clave i18n                                       |
| ------------ | -------------- | --------- | --------------- | --------------- | ------------------------------------------------ |
| `IN_TRANSIT` | `undefined`    | `info`    | `truck`         | "En camino"     | `components.statusChip.deliveryStatus.IN_TRANSIT` |
| `IN_TRANSIT` | `>= 1`         | `warning` | `alert-triangle`| "Atrasada {days} días" | `components.statusChip.deliveryStatus.overdue` |
| `DELIVERED`  | n/a            | `success` | `check-circle`  | "Llegó"         | `components.statusChip.deliveryStatus.DELIVERED` |
| `CANCELLED`  | n/a            | `neutral` | `ban`           | "Cancelada"     | `components.statusChip.deliveryStatus.CANCELLED` |

### `kind: "itemDeliveryState"`

| `value`            | Variant   | Ícono           | Copy ES               | Clave i18n                                              |
| ------------------ | --------- | --------------- | --------------------- | ------------------------------------------------------- |
| `NONE`             | `neutral` | `clock`         | "Pendiente en tienda" | `components.statusChip.itemDeliveryState.NONE`          |
| `ARRIVED_AT_STORE` | `success` | `check-circle`  | "Listo en tienda"     | `components.statusChip.itemDeliveryState.ARRIVED_AT_STORE` |
| `IN_TRANSIT`       | `info`    | `truck`         | "En camino"           | `components.statusChip.itemDeliveryState.IN_TRANSIT`    |
| `DELIVERED`        | `success` | `package-check` | "Entregado"           | `components.statusChip.itemDeliveryState.DELIVERED`     |

### `kind: "derived"`

| `value`   | Variant     | Ícono           | Copy ES             | Notas                                       |
| --------- | ----------- | --------------- | ------------------- | ------------------------------------------- |
| `paid`    | `success`   | `check-circle`  | "Pagado"            | `paidAmount === totalCost`                  |
| `partial` | `accent`    | `circle-dashed` | "{pct}% pagado"     | `0 < paidAmount < totalCost`. Soft accent.  |
| `unpaid`  | `neutral`   | `clock`         | "Sin pagar"         | `paidAmount === 0`                          |
| `overdue` | `warning`   | `alert-triangle`| "Atrasado {days} días" | `expectedDeliveryTo < now` & not COMPLETED/CANCELLED |

## Variants / Sizes

5 variants visuales (todas pasan AA por construcción):

| Variant       | Bg                                                            | Border                                                               | Text                       | Ícono color               |
| ------------- | ------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------- | ------------------------- |
| `success`     | `color-mix(in oklch, var(--success) 14%, var(--background))`  | `1px solid color-mix(in oklch, var(--success) 28%, var(--background))` | `var(--success-chip-text)` | `currentColor`            |
| `warning`     | `color-mix(in oklch, var(--warning) 14%, var(--background))`  | `1px solid color-mix(in oklch, var(--warning) 28%, var(--background))` | `var(--warning-chip-text)` | `currentColor`            |
| `destructive` | `color-mix(in oklch, var(--destructive) 14%, var(--background))` | `1px solid color-mix(in oklch, var(--destructive) 28%, var(--background))` | `var(--destructive-chip-text)` | `currentColor`            |
| `info`        | `color-mix(in oklch, var(--info) 14%, var(--background))`     | `1px solid color-mix(in oklch, var(--info) 28%, var(--background))`  | `var(--info-chip-text)`    | `currentColor`            |
| `accent`      | `color-mix(in oklch, var(--accent) 14%, var(--background))`   | `1px solid color-mix(in oklch, var(--accent) 28%, var(--background))` | `var(--text-primary)`      | `var(--accent)`           |
| `neutral`     | `var(--surface-elevated)`                                     | `1px solid var(--border-strong)`                                     | `var(--text-secondary)`    | `var(--text-muted)`       |

| Size            | Padding                                  | Tipografía                                            | Uso                                            |
| --------------- | ---------------------------------------- | ----------------------------------------------------- | ---------------------------------------------- |
| `sm`            | `var(--space-0_5) var(--space-2)`        | `--text-mono` o `--text-eyebrow` + uppercase opcional | Chip-only en row densa, filtros activos compactos |
| `md` (default)  | `var(--space-1) var(--space-3)`          | `--text-caption`                                      | Chip estándar en list rows, detail headers     |

Radius siempre `--radius-pill`.

## Estados visuales

| Estado     | Receta CSS (light)                                                                                                                                                                                           | Receta CSS (dark) | Notas                                                                                                                                                                                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default`  | bg + border + text por variant (ver tabla anterior). `display: inline-flex; align-items: center; gap: var(--space-1_5); border-radius: var(--radius-pill); padding: var(--space-1) var(--space-3); font-size: var(--text-caption); font-weight: var(--font-weight-medium);` | mismo (chip-text aliases ya cambian via `--<status>-chip-text` que en dark son alias del status base — receta única) | El `gap` deja respirar el ícono respecto al label.                                                                                                                                                                                                                                                  |
| `hover`    | (solo cuando el chip es interactivo — filtro activo) `background: color-mix(in oklch, var(--<variant>) 18%, var(--background));`                                                                              | mismo             | Por default el chip NO es interactivo. La hover state vive solo en chips de filtro activo (composición tier 3).                                                                                                                                                                                       |
| `focus`    | (solo interactivo) `outline: 2px solid var(--focus-ring); outline-offset: 2px;`                                                                                                                              | mismo             | Idem.                                                                                                                                                                                                                                                                                                |
| `disabled` | no aplica — el chip no se deshabilita (refleja un estado del dominio, no un control).                                                                                                                         | n/a               | Si el padre necesita "chip leído pero no actuable", usar variant `neutral`.                                                                                                                                                                                                                          |

Receta base CSS:

```css
.status-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1_5);
  border-radius: var(--radius-pill);
  padding: var(--space-1) var(--space-3);
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
}

.status-chip--sm {
  padding: var(--space-0_5) var(--space-2);
  font-size: var(--text-mono);
  letter-spacing: var(--text-mono--letter-spacing);
}

.status-chip > svg {
  width: 14px;
  height: 14px;
  color: currentColor;
  flex-shrink: 0;
}

.status-chip--success {
  background: color-mix(in oklch, var(--success) 14%, var(--background));
  border: 1px solid color-mix(in oklch, var(--success) 28%, var(--background));
  color: var(--success-chip-text);
}

.status-chip--warning {
  background: color-mix(in oklch, var(--warning) 14%, var(--background));
  border: 1px solid color-mix(in oklch, var(--warning) 28%, var(--background));
  color: var(--warning-chip-text);
}

.status-chip--destructive {
  background: color-mix(in oklch, var(--destructive) 14%, var(--background));
  border: 1px solid color-mix(in oklch, var(--destructive) 28%, var(--background));
  color: var(--destructive-chip-text);
}

.status-chip--info {
  background: color-mix(in oklch, var(--info) 14%, var(--background));
  border: 1px solid color-mix(in oklch, var(--info) 28%, var(--background));
  color: var(--info-chip-text);
}

.status-chip--accent {
  background: color-mix(in oklch, var(--accent) 14%, var(--background));
  border: 1px solid color-mix(in oklch, var(--accent) 28%, var(--background));
  color: var(--text-primary);
}

.status-chip--accent > svg {
  color: var(--accent);
}

.status-chip--neutral {
  background: var(--surface-elevated);
  border: 1px solid var(--border-strong);
  color: var(--text-secondary);
}

.status-chip--neutral > svg {
  color: var(--text-muted);
}
```

## Mobile vs desktop

- **Tamaño:** mobile preferir `sm` en row densa; desktop preferir `md`. La elección la hace el padre.
- **`white-space: nowrap`:** garantiza que el chip no rompa en dos líneas. Si el copy es muy largo en mobile (ej. "Parcialmente en camino"), el padre puede ocultar el ícono y usar `sm`, o truncar.
- **Ícono:** 14×14 cross-viewport. No escala.
- **Filtros activos del drawer:** `<StatusChip variant="accent" size="sm">` con la `x` de remoción a la derecha (composición tier 3).

## Accesibilidad

- Rol ARIA: `<span role="status">` para chips dinámicos (overdue days que cambian, % pagado). Para chips estáticos, sin rol.
- Atributos:
  - `aria-label` cuando el chip combina ícono + texto que pueda ser ambiguo en SR (ej. "Atrasada 3 días" puede leerse como dos elementos — `aria-label="Entrega atrasada 3 días"` aclara).
  - `aria-live="polite"` cuando el chip cambia de variant en respuesta a una mutación (paid → partial → paid).
- Keyboard: no interactivo por default. Cuando es interactivo (filtro activo con remoción), el wrapper es un `<button>` con `aria-label="Quitar filtro {label}"`.
- Focus: solo en variant interactiva (filtro activo). Outline rodea el chip completo.
- Screen reader: el ícono Lucide va con `aria-hidden="true"`; el SR lee solo el label.
- `prefers-reduced-motion`: la transición de variant (paid → partial) reduce a fade `--motion-fast` `--ease-emphasis` puro.
- Contraste: cada variant cumple AA por construcción del color-mix; el `--<status>-chip-text` light está pre-validado en S3 (`oklch(40-45% …)` sobre tinte 14%).

## Motion

- **Cambio de variant:** transición de bg + border + color en `--motion-base` `--ease-emphasis`. Aplica cuando el chip cambia por mutación (ej. `partial` → `paid` tras anotar pago al 100%).
- **Aparición:** sin animación por default. Si aparece como respuesta a una mutación, el padre coordina el fade (`--motion-fast` `--ease-emphasis`).
- Bajo `prefers-reduced-motion`: solo opacity, sin spring.

## Copy default + i18n

(Mapping completo arriba en "Mapping enum → variant + Lucide + copy ES".)

Claves transversales:

| Clave i18n sugerida                          | Valor ES                                  |
| -------------------------------------------- | ----------------------------------------- |
| `components.statusChip.aria.statusOf`        | "Estado: {label}"                         |
| `components.statusChip.aria.removeFilter`    | "Quitar filtro {label}"                   |

EN se deja para S12.

## Edge cases

1. **`kind: "deliveryStatus"` con `value: "IN_TRANSIT"` + `overdueDays >= 1`**: el chip muta automáticamente a variant `warning` + Lucide `alert-triangle` + copy "Atrasada N días". El consumidor pasa los datos crudos; el componente decide.
2. **`kind: "derived"` `value: "partial"` con `pct: 0` o `pct: 100`**: caer al estado correspondiente (`unpaid` para 0, `paid` para 100). Definir guard interno.
3. **`kind: "info"` sin `icon` o sin `label`**: TS error en compile-time (ADR 0006). Runtime fallback no necesario porque TS lo bloquea.
4. **Chip en variant `neutral` cuando el ícono Lucide es `clock`** y el `--text-muted` light está cerca de WCAG limit: la combinación pasa AA holgado (validado en S3); si futuras paletas bajan el contraste, escalar a `--text-secondary` para íconos.
5. **`overdueDays` muy alto (>365)**: el copy "Atrasada 412 días" funciona pero indica posible bug del dominio. El componente lo renderiza tal cual; el padre decide si suprime.
6. **Múltiples chips adyacentes (principal + derivado):** el padre los compone con `gap: var(--space-2)`. El componente NO orquesta múltiples chips en un solo render.
7. **`PARTIALLY_DELIVERED` variant `success` (suave)**: implementación = mismo `success` con icon `package-open` (no `check-circle`). El "suave" ya está en el `color-mix 14%`.
8. **`kind: "info"` con label muy largo (>30 chars)**: el chip hace `nowrap` y desborda. Padre debe truncar o usar variant inferior. El componente no truncia.
9. **i18n con plurales en `Atrasada {days} días`**: en `es-AR` "1 día" / "2 días" — manejar via `next-intl` `Plural` en S12.
10. **Variant `accent` con `--accent` Velvet en dark (L=0.74):** el ícono `--accent` sobre `color-mix(--accent 14%, --background)` cumple AA por construcción (validado).

## Anti-patrones

1. **Color como único portador (sin ícono):** ADR 0006 prohíbe info color-only; convención de equipo extiende esto a todos los `kind` enumerados.
2. **Chip con dos labels concatenados ("En camino · Atrasada"):** romper en dos chips adyacentes (principal + derivado).
3. **Variant inventada (`primary`, `urgent`, `pending`):** las 5 variants visuales son cerradas. Si falta una, abrir ADR.
4. **Background sólido (no `color-mix 14%`):** rompe la jerarquía visual (chip vs CTA primary).
5. **Texto en `--text-muted` para variants soft:** cada variant tiene su `*-chip-text` ya pre-validado AA.
6. **Animación bouncy al aparecer:** rompe densidad informativa. El chip es metadata, no celebración.
7. **`<StatusChip kind="info" />` sin icon ni label:** ADR 0006 — TS bloquea.
8. **Renderizar `--accent-cool` como bg de chip:** ADR 0006 prohíbe.

## Ejemplos de uso

```tsx
// Orders list · row con chip principal
<StatusChip kind="orderStatus" value="IN_TRANSIT" />

// Order detail · header con chip principal + derivado
<header className="order-detail__header">
  <StatusChip kind="orderStatus" value="PARTIALLY_DELIVERED" />
  <StatusChip kind="derived" value="partial" pct={67} />
</header>

// Delivery list · entrega atrasada (chip muta a warning)
<StatusChip kind="deliveryStatus" value="IN_TRANSIT" overdueDays={3} />

// Delivery create paso 2 · item elegible
<StatusChip kind="itemDeliveryState" value="ARRIVED_AT_STORE" size="sm" />

// Custom info chip (ADR 0006 — icon+label OBLIGATORIOS)
<StatusChip kind="info" icon={<HourglassIcon />} label="En revisión" />

// Filtro activo del drawer (variant ad-hoc)
<StatusChip kind="accent" icon={<XIcon />} label="Akiba Records" />
```

## Tokens consumidos

- `--success`, `--warning`, `--destructive`, `--info`, `--accent`
- `--success-chip-text`, `--warning-chip-text`, `--destructive-chip-text`, `--info-chip-text`
- `--surface-elevated`, `--background`
- `--border-strong`
- `--text-primary`, `--text-secondary`, `--text-muted`
- `--font-sans`, `--text-caption`, `--text-mono`, `--text-eyebrow`
- `--font-weight-medium`
- `--radius-pill`
- `--space-0_5`, `--space-1`, `--space-1_5`, `--space-2`, `--space-3`
- `--motion-base`, `--motion-fast`, `--ease-emphasis`
- `--focus-ring`

## ADRs aplicables

- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md) D1 (token `--info`).
- [ADR 0002 — Status chip mapping](../decisions/0002-status-chip-mapping.md) (mapping completo enum → variant + Lucide + copy).
- [ADR 0006 — Color blindness icon+label contract](../decisions/0006-color-blindness-icon-label-contract.md) (kind=info icon+label obligatorios).

## Dependencias

- Iconos `lucide-react`: `clock`, `package`, `package-open`, `package-check`, `truck`, `check-circle`, `ban`, `alert-triangle`, `circle-dashed`, `hourglass`, `info`.

## Notas para S12 (implementación)

1. El mapping `enum → { variant, icon, copy }` vive en un módulo helper `lib/status-chip/mapping.ts` (no inline en el componente). Cada `kind` exporta una función `resolve<Kind>(value, extras?)`.
2. La derivación de overdue para deliveryStatus ocurre en el componente (no en el padre): el padre pasa `overdueDays`, el componente decide variant + copy. Decidir si exponer también helper compartido para que badges en otros contextos usen la misma lógica.
3. Para el caso `derived: "partial"` con `pct`, el copy "{pct}% pagado" debe redondear (no decimales) y validar 0 < pct < 100 con guard.
4. El `aria-live` para chips dinámicos puede vivir en el padre (peek panel, list row) en lugar del chip mismo, para evitar anuncios inesperados al renderizar listas grandes.
5. Validar contraste de variant `accent` con paletas Lilac y Plum donde `--text-primary` sobre `color-mix(--accent 14%, --background)` puede tener menos cabecera de margen. S12 ejecuta cross-paleta audit.
6. Definir si la variant `success` para `PARTIALLY_DELIVERED` requiere un sub-token `--success-soft-chip-text` o si el `--success-chip-text` actual ya cubre el caso (cabecera AA holgada).
7. Para el ícono Lucide `circle-dashed` (variant `accent`/`partial`), validar tamaño visual 14×14 — si el dashed se ve muy ligero, escalar peso o cambiar a `clock`.
