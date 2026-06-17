---
title: Eyebrow
tier: 1
status: implementado · chip variant agregado S8 Fase B
last_updated: 2026-05-18
session: 04-components · ampliado en S8
adrs:
  - ADR 0001 D2 (eyebrow ↳ DESDE PT-XXXXXX en field-as-attribute)
  - ADR 0005 (microstat eyebrow uppercase mono)
---

# Eyebrow

## Propósito

Atom de tipografía: render uppercase mono identificando una sección, slot, o categoría. Aparece en cada section card de [`order-create.md`](../screens/order-create.md) ("PASO 1 · TIENDA", "PASO 2 · FECHAS", etc.), en cada section card de [`delivery-create.md`](../screens/delivery-create.md) ("DESDE", "QUÉ LLEGA", "CUÁNDO Y CUÁNTO"), en eyebrows de microstats del dashboard ("PRÓXIMOS 30 DÍAS", "TUS PRE-ÓRDENES" — ADR 0005), y en el patrón field-as-attribute (ADR 0001 D2 — `↳ DESDE PT-002418`). Tokenizado como `--text-eyebrow`.

Desde S8 admite dos variantes: `text` (la original, default) y `chip` (pill tintada con ícono leading, parte del patrón S8 cross-módulo descrito en `PLAYBOOK §9.17`).

## API TypeScript

```ts
type EyebrowVariant = "text" | "chip";
type EyebrowTone = "muted" | "accent" | "cool" | "warm" | "success" | "warning" | "destructive";

type EyebrowProps = {
  /** Contenido. Se renderiza tal cual; el componente aplica `text-transform: uppercase` por CSS. */
  children: ReactNode;
  /** Variante visual. `text` = inline mono uppercase (default). `chip` = pill tintada con ícono leading (S8). */
  variant?: EyebrowVariant;
  /** Tamaño. Default `md`. */
  size?: "sm" | "md";
  /**
   * Tono. Default `muted`.
   * - `text` variant: `muted` (default) o `accent` (celebratorio).
   * - `chip` variant: cualquiera del set semántico cross-módulo. Ver PLAYBOOK §9.17.
   */
  tone?: EyebrowTone;
  /** Ícono lucide leading. SOLO se renderiza en `variant="chip"`. */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  /** Etiqueta semántica. Default `span`. Usar `h2`/`h3` cuando el eyebrow es heading semántico de la sección. */
  as?: "span" | "p" | "h2" | "h3" | "h4" | "legend";
  /** `id` estable — usado como target de `aria-labelledby` desde la `<section>` padre. */
  id?: string;
  className?: string;
};
```

## Variants / Sizes

| Variant (`variant`) | Uso                                                                                                          | Tokens consumidos                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `text` (default)    | Section cards de wizards, microstats, attribute prefix, headings de paneles                                  | `--text-eyebrow`, color por tono                 |
| `chip` (S8)         | Cards de detalle (`order-detail`, `store-detail`, settings panes) — comunicar naturaleza semántica con tinte | `--text-eyebrow` + `color-mix` sobre token tonal |

| Variant (`size`) | Uso                                           | Tokens consumidos                       |
| ---------------- | --------------------------------------------- | --------------------------------------- |
| `sm`             | Inline en cuerpo, captions densos             | `--text-eyebrow` (11px), `--text-muted` |
| `md` (default)   | Section cards, microstats, field-as-attribute | `--text-eyebrow` (11px), `--text-muted` |

(El size del Eyebrow es estable por convención S3 — no escala. Las dos variantes existen para herencia consistente con otros atoms.)

### Tones disponibles

| Tone          | Aplicable en   | Uso                                                                               | Token           |
| ------------- | -------------- | --------------------------------------------------------------------------------- | --------------- |
| `muted`       | `text`, `chip` | Default — section cards de wizards, microstat eyebrows, attribute prefix          | `--text-muted`  |
| `accent`      | `text`, `chip` | Identidad, contenido principal, acciones; achievement celebrations (variant text) | `--accent`      |
| `cool`        | `chip`         | Sistema, datos, historial, info técnica (Productos, Historial, Categorías…)       | `--accent-cool` |
| `warm`        | `chip`         | Personal, hobby, social, notas privadas, reseñas                                  | `--accent-warm` |
| `success`     | `chip`         | Estado terminal positivo (Pagos · 100% pagado)                                    | `--success`     |
| `warning`     | `chip`         | Estado de atención (Pagos · completed + saldo pendiente)                          | `--warning`     |
| `destructive` | `chip`         | Estado de error / urgencia (Pagos · overdue)                                      | `--destructive` |

El vocabulario de tonos cross-módulo está congelado en `PLAYBOOK §9.17` — labels como `Acciones`, `Tu nota privada`, `Reseñas`, `Productos`, `Historial` SIEMPRE usan el mismo par tono+ícono entre pantallas.

## Estados visuales

| Estado   | Receta CSS (light)                                                                                                                                                                                                                                                                                     | Receta CSS (dark) | Notas                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- | --------------------------------- |
| `muted`  | `font-family: var(--font-mono); font-size: var(--text-eyebrow); line-height: var(--text-eyebrow--line-height); letter-spacing: var(--text-eyebrow--letter-spacing); font-weight: var(--font-weight-mono); text-transform: uppercase; color: var(--text-muted); font-feature-settings: "calt", "ss01";` | mismo             | `letter-spacing: 0.08em` (token). |
| `accent` | mismo + `color: var(--accent)`                                                                                                                                                                                                                                                                         | mismo             | Solo en momentos celebratorios.   |

Receta base (CSS):

```css
.eyebrow {
  font-family: var(--font-mono);
  font-size: var(--text-eyebrow);
  line-height: var(--text-eyebrow--line-height);
  letter-spacing: var(--text-eyebrow--letter-spacing);
  font-weight: var(--font-weight-mono);
  text-transform: uppercase;
  color: var(--text-muted);
  font-feature-settings: "calt", "ss01";
}

.eyebrow--accent {
  color: var(--accent);
}
```

(Tailwind utility correspondiente: `.eyebrow` ya tokenizada en `tokens.md` §3.1.)

## Mobile vs desktop

- Mismo tamaño visual en ambos. El tamaño `--text-eyebrow` (11px) se mantiene fijo.
- Cuando el eyebrow lleva un caracter especial (ej. `↳`), respetar la dirección de lectura izquierda → derecha.

## Accesibilidad

- Rol ARIA: depende de `as`. Default `span` — sin rol semántico (es decoración tipográfica). Cuando `as="h2"`/`h3`/`h4`, el eyebrow es heading de la sección y screen reader lo navega.
- Atributos opcionales: el `text-transform: uppercase` se aplica por CSS (los SR leen el contenido en case original), por lo que no requiere `aria-label` para evitar deletreo.
- Keyboard: no interactivo.
- Screen reader: el contenido se anuncia tal cual; el `text-transform: uppercase` no afecta la lectura (es styling).
- `prefers-reduced-motion`: no aplica (sin animación propia).

## Motion

Ninguno. El eyebrow no se anima.

Bajo `prefers-reduced-motion`: sin cambios.

## Copy default + i18n

| Clave i18n sugerida                      | Valor ES            |
| ---------------------------------------- | ------------------- |
| `components.eyebrow.section.step1`       | "PASO 1 · TIENDA"   |
| `components.eyebrow.section.step2`       | "PASO 2 · FECHAS"   |
| `components.eyebrow.section.step3`       | "PASO 3 · ITEMS"    |
| `components.eyebrow.section.step4`       | "PASO 4 · COSTOS"   |
| `components.eyebrow.section.step5`       | "PASO 5 · NOTA"     |
| `components.eyebrow.section.from`        | "DESDE"             |
| `components.eyebrow.section.what`        | "QUÉ LLEGA"         |
| `components.eyebrow.section.when`        | "CUÁNDO Y CUÁNTO"   |
| `components.eyebrow.section.summary`     | "RESUMEN"           |
| `components.eyebrow.dashboard.next30`    | "PRÓXIMOS 30 DÍAS"  |
| `components.eyebrow.dashboard.thisMonth` | "ESTE MES"          |
| `components.eyebrow.dashboard.late`      | "ATRASADO"          |
| `components.eyebrow.dashboard.thisWeek`  | "LLEGA ESTA SEMANA" |
| `components.eyebrow.attribute.fromOrder` | "↳ DESDE {humanId}" |

## Edge cases

1. **Eyebrow con caracteres acentuados** (ej. "PRÓXIMOS"): el `text-transform: uppercase` en `es-AR` mantiene los acentos (e.g. "Á"). JetBrains Mono renderiza `Á` correctamente.
2. **Eyebrow con `·` separator** (ej. "PASO 1 · TIENDA"): el `·` está en JetBrains Mono; rendering correcto sin escapes.
3. **Eyebrow muy largo**: hace wrap natural; el line-height de `--text-eyebrow` mantiene la lectura.
4. **Eyebrow con icono leading**: NO soportado por este atom. Componer manualmente: `<div className="flex items-center gap-1"><Icon /> <Eyebrow>...</Eyebrow></div>`.
5. **Eyebrow como heading semántico**: pasar `as="h2"` / `h3` cuando aplica. El styling visual no cambia.
6. **Eyebrow con tone `accent` en dark**: el `--accent` dark (L=0.74) sobre `--surface` cumple AA.
7. **Eyebrow con números**: el `font-feature-settings: "calt", "ss01"` activa alternates contextuales de JetBrains Mono (separa `1` de `l`, `0` de `O`).

## Anti-patrones

1. **`text-transform: uppercase` aplicado al contenido fuente** (escribir "PASO 1" en mayúsculas): el contenido se escribe en case original ("Paso 1") y el CSS lo eleva. Evita problemas de SR/i18n.
2. **`font-family: var(--font-sans)`**: usar `--font-mono` (la familia es parte de la identidad del eyebrow).
3. **Color `--text-secondary` o `--text-primary`**: usar `--text-muted` para mantener jerarquía decorativa.
4. **Tamaño mayor que `--text-eyebrow` (11px)**: rompe la jerarquía visual y deja de ser eyebrow.
5. **Letter-spacing diferente de `0.08em`**: el token define la métrica.
6. **Animación de aparición** (fade in slow): rompe lectura.
7. **Eyebrow celebratorio en cada section card**: el tone `accent` se reserva para achievements.

## Ejemplos de uso

```tsx
// Order create · paso 1
<Eyebrow as="h2">PASO 1 · TIENDA</Eyebrow>
<h3>¿Dónde lo compraste?</h3>

// Microstat · próximos 30 días (ADR 0005)
<MicroStatCard>
  <Eyebrow>PRÓXIMOS 30 DÍAS</Eyebrow>
  <span className="microstat__value">$ 1.247.500</span>
  <span className="microstat__metadata">3 pre-órdenes</span>
</MicroStatCard>

// Field-as-attribute (ADR 0001 D2)
<div className="field-as-attribute">
  <Eyebrow size="sm">↳ DESDE PT-002418</Eyebrow>
  <span className="field-as-attribute__value">
    <StoreAvatar size={32} store={store} /> Akiba Records
  </span>
  <button>Cambiar</button>
</div>
```

## Tokens consumidos

- `--font-mono`
- `--text-eyebrow`
- `--font-weight-mono`
- `--text-muted`, `--accent`

## ADRs aplicables

- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md) (D2 field-as-attribute eyebrow prefix)
- [ADR 0005 — Dashboard microstat icon-tile](../decisions/0005-dashboard-microstat-icon-tile.md) (eyebrow uppercase mono en cada microstat)

## Dependencias

Ninguna. Es atom tipográfico puro.

## Notas para S12 (implementación)

1. El componente puede ser un `className` reutilizable (`.eyebrow`) o un componente React. Recomendado React para el control de `as`.
2. La utility `.eyebrow` ya está tokenizada en `tokens.md` §3.1 — el componente la consume.
3. Decidir si el contenido "↳ DESDE PT-002418" se compone con dos eyebrows (uno para "↳ DESDE", otro para `<MonoCode>`) o como un solo bloque. MVP: un solo eyebrow simple (string).
4. Validar en S6 con mocks reales si la `letter-spacing: 0.08em` queda demasiado abierta para mobile (puede ajustarse a 0.06em si rompe lectura).
