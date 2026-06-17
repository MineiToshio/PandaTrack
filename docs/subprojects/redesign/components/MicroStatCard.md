---
title: MicroStatCard
tier: 2
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0001 D8 (4 micro-stats — Este mes, Próximos 30 días, Atrasado condicional, Llega esta semana)
  - ADR 0005 (patrón canónico icon-tile + cifra neutra; accentToken discriminated union)
---

# MicroStatCard

## Propósito

KPI compacto del [`dashboard.md`](../screens/dashboard.md): cifra neutra + icon-tile circular soft-tint con glyph Lucide del color funcional dentro. Patrón canónico ADR 0005. Aparece en el bento del dashboard como 4 slots fijos (D8) y, ocasionalmente, en peek panels o resúmenes secundarios. La cifra es el dato; el tile cromático aporta el "vector emocional" del slot sin sacrificar AA.

## API TypeScript

```ts
import type { ReactNode } from "react";

type MicroStatAccentToken =
  | "--accent"
  | "--accent-warm"
  | "--warning"
  | "--success";

type MicroStatCardProps = {
  /** ADR 0005 — discriminated union restringida. El componente inyecta `--slot-accent` via inline style. */
  accentToken: MicroStatAccentToken;
  /** Nombre del ícono Lucide (e.g. "wallet", "calendar-clock"). El componente importa el ícono dinámicamente o el padre pasa el ReactNode. */
  glyph: string;
  /** Eyebrow uppercase mono (e.g. "PRÓXIMOS 30 DÍAS"). Voice glossary en español. */
  eyebrow: string;
  /** Cifra principal o ReactNode con composición (mantiene tabular nums). */
  value: string | ReactNode;
  /** Metadata secundaria opcional (e.g. "3 pre-órdenes"). */
  metadata?: string;
  /** Link opcional. Si presente, la card entera es navigable y aplica state-layer hover. */
  href?: string;
  /** Override del tamaño del icon-tile cuando el card vive en un slot densificado (peek panel). Default `auto`. */
  density?: "auto" | "compact";
};
```

## Variants / Sizes

| Variant (`density`) | Uso                                           | Tokens consumidos                                 |
| ------------------- | --------------------------------------------- | ------------------------------------------------- |
| `auto` (default)    | Bento del dashboard, slot principal           | Padding, icon-tile, cifra display per breakpoint  |
| `compact`           | Peek panel, sub-resúmenes                     | Padding `--space-4`, icon-tile 28×28, cifra `--text-title` |

Mapping canónico de los 4 slots del dashboard (ADR 0001 D8 + ADR 0005):

| Slot | accentToken      | Glyph Lucide sugerido          | Eyebrow ES               | Notas                                                                    |
| ---- | ---------------- | ------------------------------ | ------------------------ | ------------------------------------------------------------------------ |
| 1    | `--accent`       | `wallet` (o `trending-up`)     | "ESTE MES"               | Total pagado en el mes corriente — ancla emocional positiva.             |
| 2    | `--accent-warm`  | `calendar-clock` (o `hourglass`) | "PRÓXIMOS 30 DÍAS"       | Pagos programados en ventana 30d — ancla de planeación.                  |
| 3    | `--warning`      | `alert-triangle`               | "ATRASADO"               | **Condicional:** si count = 0 muta a "TIENDAS ACTIVAS" + `accentToken: --accent` neutralizado a `--text-muted` con glyph `store`. |
| 4    | `--success`      | `package-check` (o `truck`)    | "LLEGA ESTA SEMANA"      | Productos esperados en ventana 7d — ancla de anticipación.               |

(Slot 3 fallback "Tiendas activas" — el padre pasa `accentToken="--accent"` con glyph `store` y deja que el sub-tile tire del `--text-muted` para color del ícono. Ver edge case 3.)

## Estados visuales

| Estado            | Receta CSS (light)                                                                                                                                                                                                                       | Receta CSS (dark) | Notas                                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `default`         | `background: var(--surface); border-radius: var(--radius-lg); box-shadow: var(--elevation-1); padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-2);`                                                       | mismo (`--elevation-1` dark = inset highlight + border) | Mobile padding `--space-5`, desktop `--space-6`.                                                                                |
| `hover` (con `href`) | `background-color: color-mix(in oklch, var(--text-primary) var(--state-hover-mix), var(--surface)); cursor: pointer;`                                                                                                                  | mismo             | Solo cuando `href` o `onClick` están presentes.                                                                                  |
| `focus` (con `href`) | `outline: 2px solid var(--focus-ring); outline-offset: 2px;`                                                                                                                                                                          | mismo             | Visible siempre en `:focus-visible`.                                                                                             |
| `pressed`         | `background-color: color-mix(in oklch, var(--text-primary) var(--state-pressed-mix), var(--surface));`                                                                                                                                  | mismo             | Solo interactivo.                                                                                                                |

Receta base CSS:

```css
.microstat-card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-1);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  text-decoration: none;
  color: inherit;
}

@media (min-width: 48rem) {
  .microstat-card {
    padding: var(--space-6);
  }
}

.microstat-card__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.microstat-card__icon-tile {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-pill);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in oklch, var(--slot-accent) 14%, var(--surface));
  border: 1px solid color-mix(in oklch, var(--slot-accent) 28%, var(--surface));
  color: var(--slot-accent);
  flex-shrink: 0;
}

@media (min-width: 48rem) {
  .microstat-card__icon-tile {
    width: 36px;
    height: 36px;
  }
}

.microstat-card__icon-tile > svg {
  width: 16px;
  height: 16px;
}

@media (min-width: 48rem) {
  .microstat-card__icon-tile > svg {
    width: 18px;
    height: 18px;
  }
}

.microstat-card__eyebrow {
  font-family: var(--font-mono);
  font-size: var(--text-eyebrow);
  line-height: var(--text-eyebrow--line-height);
  letter-spacing: var(--text-eyebrow--letter-spacing);
  font-weight: var(--font-weight-mono);
  text-transform: uppercase;
  color: var(--text-muted);
}

.microstat-card__value {
  font-family: var(--font-display);
  font-size: var(--text-display);
  line-height: var(--text-display--line-height);
  letter-spacing: var(--text-display--letter-spacing);
  font-weight: var(--font-weight-display);
  font-feature-settings: "ss01", "cv11", "tnum";
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}

.microstat-card__metadata {
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
  color: var(--text-secondary);
}

.microstat-card[href]:hover,
.microstat-card[role="link"]:hover {
  background-color: color-mix(in oklch, var(--text-primary) var(--state-hover-mix), var(--surface));
}

.microstat-card[href]:focus-visible,
.microstat-card[role="link"]:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
```

El componente setea inline `style={{ "--slot-accent": "var(--accent-warm)" }}` (o el token correspondiente) en el wrapper para inyectar la variable que las recetas del icon-tile referencian.

## Mobile vs desktop

- **Mobile (`< --breakpoint-md`):** padding `--space-5`. Icon-tile `32×32` con glyph `16×16`. Cifra `--text-display` con clamp activo.
- **Desktop (`≥ --breakpoint-md`):** padding `--space-6`. Icon-tile `36×36` con glyph `18×18`. Cifra `--text-display` resuelve a su tope superior del clamp.
- **Layout:** mobile preferir 2×2 grid en el bento; desktop 4 columnas en row. La elección la hace el shell del dashboard.
- **Density `compact`:** padding `--space-4`, icon-tile `28×28`, cifra `--text-title`. Para slots secundarios (peek panel).

## Accesibilidad

- Rol ARIA: `<a role="link">` cuando hay `href` (link semántico). Si solo hay `onClick`, `<button>` semántico. Si es decorativo, `<article aria-label="<eyebrow>: <value>">`.
- Atributos:
  - `aria-label` compuesto cuando es interactivo: "Este mes: $1.247.500. 3 pre-órdenes." — el SR lee la card como una unidad.
  - `aria-live="polite"` cuando la cifra cambia tras una mutación (anotar pago al 100% reduce el "Próximos 30 días" en tiempo real).
- Keyboard: Tab + Enter cuando es interactivo.
- Focus management: outline rodea la card completa.
- Screen reader: el ícono Lucide va con `aria-hidden="true"`; el SR lee eyebrow + value + metadata en orden.
- `prefers-reduced-motion`: la transición de hover state-layer reduce a opacity `--motion-fast`.
- Contraste: cifra `--text-primary` sobre `--surface` ≥13:1 (validado S3). Icon-tile bg + border + glyph cumplen 1.4.11 ≥3:1 non-text. Eyebrow `--text-muted` cumple ≥4.5:1 sobre `--surface`.

## Motion

- **Update de cifra (mutación optimistic):** transición de opacity + y-transform `0 → -4px → 0` en `--motion-base` `--ease-emphasis`. Tabular nums evita jitter de carácter.
- **Hover state-layer (interactivo):** transición de bg en `--motion-fast` `--ease-emphasis`.
- **Aparición inicial:** sin animación (la card se renderiza con el resto del bento).
- Bajo `prefers-reduced-motion`: solo opacity, sin transform.

## Copy default + i18n

| Clave i18n sugerida                            | Valor ES                  |
| ---------------------------------------------- | ------------------------- |
| `components.microStatCard.dashboard.thisMonth.eyebrow` | "ESTE MES"          |
| `components.microStatCard.dashboard.next30.eyebrow`    | "PRÓXIMOS 30 DÍAS"  |
| `components.microStatCard.dashboard.late.eyebrow`      | "ATRASADO"          |
| `components.microStatCard.dashboard.thisWeek.eyebrow`  | "LLEGA ESTA SEMANA" |
| `components.microStatCard.dashboard.activeStores.eyebrow` | "TIENDAS ACTIVAS" |
| `components.microStatCard.metadata.preorders`  | "{count} pre-órdenes"     |
| `components.microStatCard.metadata.products`   | "{count} productos"       |
| `components.microStatCard.metadata.stores`     | "{count} tiendas"         |
| `components.microStatCard.aria.value`          | "{eyebrow}: {value}. {metadata}" |

EN se deja para S12.

## Edge cases

1. **Cifra muy grande (>10 dígitos, e.g. "$ 12.345.678.901"):** el `--text-display` con `clamp()` reduce. Si aún desborda, el padre debe abreviar con `1,23 M`.
2. **Cifra negativa (no aplica al dominio actual, pero defensivo):** renderizar tal cual con tabular nums. El signo se renderiza con el mismo color `--text-primary`.
3. **Slot 3 cuando count = 0 ("Atrasado" muta a "Tiendas activas"):** el padre cambia `accentToken` y `glyph` y `eyebrow`. El componente NO orquesta la mutación; solo refleja props. Para color "neutralizado" usar `accentToken="--accent"` con override del color del ícono — alternativa: extender la API con `tone: "muted"`. Decisión MVP: el padre pasa `accentToken="--accent"` y aplica clase modificadora `microstat-card--muted` que sobrescribe el ícono a `--text-muted` (definir en S12).
4. **Lilac warm tile bg vs `--surface`** marginal 2.x:1: la receta permite override del mix de 14% a 18-20% sin tocar el token. Implementación: prop opcional `tileMix?: 14 | 18 | 20` (default 14) que el componente lee. MVP: 14, override solo si validación cross-paleta lo pide.
5. **`metadata` ausente:** la card respira con solo eyebrow + value. No insertar placeholder.
6. **`value` como ReactNode con composición (e.g. cifra + delta sparkline):** soportado. La receta `.microstat-card__value` aplica al wrapper externo; los hijos heredan tipografía.
7. **`href` apunta a destino interno (Next.js Link):** el componente es agnóstico — el padre wrappea con `<Link>` o pasa `href` que el componente renderiza como `<a>`.
8. **`accentToken` inválido (e.g. `--info`):** TS error en compile-time.
9. **Modo dark glow accent en card hover:** la elevation dark ya sube a `--elevation-2` con glow `--accent` 6%; respetar esa receta vs reinventar.
10. **Cifra que muta de "$0" a un valor real (primer pago anotado):** transición simple opacity sin spring para no celebrar accidentalmente cifras chicas.

## Anti-patrones

1. **Cifra con color del `accentToken` (warm/warning):** rompe AA texto pequeño (ADR 0005 razón raíz). Cifra siempre en `--text-primary`.
2. **Icon-tile sin border (solo bg color-mix 14%):** rompe contraste 1.4.11 ≥3:1 cross-paleta. El border 28% es vinculante.
3. **Glyph en `--text-primary` (neutro):** pierde el "vector cromático" del slot. Glyph en `var(--slot-accent)`.
4. **Padding `--space-4` en mobile:** los KPIs deben respirar; mobile `--space-5` mínimo.
5. **Cifra sin tabular-nums:** jitter al actualizar optimistic.
6. **Animación bouncy en update:** la cifra es metadata, no celebración. Usar `--ease-emphasis`.
7. **Cifra en `--font-sans`:** la familia `--font-display` es parte de la identidad del dato (decálogo §9).
8. **Slot "Atrasado" siempre visible (incluso con count=0):** ADR 0001 D8 prohíbe — el slot muta condicionalmente.

## Ejemplos de uso

```tsx
// Slot 1 — Este mes
<MicroStatCard
  accentToken="--accent"
  glyph="wallet"
  eyebrow="ESTE MES"
  value="$ 1.247.500"
  metadata="12 pagos anotados"
  href="/payments?range=thisMonth"
/>

// Slot 2 — Próximos 30 días
<MicroStatCard
  accentToken="--accent-warm"
  glyph="calendar-clock"
  eyebrow="PRÓXIMOS 30 DÍAS"
  value="$ 480.000"
  metadata="3 pre-órdenes"
/>

// Slot 3 — Atrasado (count > 0)
<MicroStatCard
  accentToken="--warning"
  glyph="alert-triangle"
  eyebrow="ATRASADO"
  value="2"
  metadata="Akiba · Pokémon Center"
  href="/orders?filter=overdue"
/>

// Slot 3 fallback — Tiendas activas (count = 0 atrasadas)
<MicroStatCard
  accentToken="--accent"
  glyph="store"
  eyebrow="TIENDAS ACTIVAS"
  value="7"
/>

// Slot 4 — Llega esta semana
<MicroStatCard
  accentToken="--success"
  glyph="package-check"
  eyebrow="LLEGA ESTA SEMANA"
  value="4"
  metadata="2 entregas en camino"
/>
```

## Tokens consumidos

- `--accent`, `--accent-warm`, `--warning`, `--success`
- `--surface`, `--surface-elevated`
- `--text-primary`, `--text-secondary`, `--text-muted`
- `--font-display`, `--font-mono`
- `--text-display`, `--text-eyebrow`, `--text-caption`, `--text-title`
- `--font-weight-display`, `--font-weight-mono`
- `--radius-lg`, `--radius-pill`
- `--space-2`, `--space-3`, `--space-4`, `--space-5`, `--space-6`
- `--elevation-1`
- `--motion-fast`, `--motion-base`, `--ease-emphasis`
- `--state-hover-mix`, `--state-pressed-mix`
- `--focus-ring`
- `--breakpoint-md`

## ADRs aplicables

- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md) D8 (4 micro-stats: este mes / 30d / atrasado condicional / esta semana).
- [ADR 0005 — Dashboard microstat icon-tile](../decisions/0005-dashboard-microstat-icon-tile.md) (patrón canónico icon-tile + cifra neutra; accentToken discriminated union).

## Dependencias

- [`./Eyebrow.md`](./Eyebrow.md) — atom interno para el eyebrow uppercase mono.
- Iconos `lucide-react` (`wallet`, `trending-up`, `calendar-clock`, `hourglass`, `alert-triangle`, `package-check`, `truck`, `store`).

## Notas para S12 (implementación)

1. La inyección del `--slot-accent` via `style` inline es lo más portable. Alternativa más estricta: usar variantes CSS por `data-accent-token="..."`. Decidir en S12 según linter / framework.
2. El `glyph` como string requiere mapear al ícono Lucide. Recomendación: el componente importa los íconos vía `dynamic` o el padre pasa `<Icon>` ReactNode para evitar bundle bloat. MVP: dictionary `{ wallet: WalletIcon, … }` interno.
3. La mutación condicional del slot 3 (Atrasado ↔ Tiendas activas) vive en el shell del dashboard, no en el componente. El componente solo refleja props.
4. Para "tone muted" del slot 3 fallback, decidir si extender la API con `tone: "muted"` o si el padre wrappea con clase modificadora. MVP: clase modificadora externa.
5. La cifra como ReactNode permite composiciones como sparkline + número. Validar en S6 que el tipograma se mantiene heredado correctamente.
6. Cross-paleta: si Lilac warm tile bg da < 3:1, sumar override `tileMix` en S12 sin tocar el token base.
7. Definir si la card es prefetch (`<Link prefetch>`) cuando hay `href` — MVP `prefetch={false}` para evitar over-fetching del dashboard.
