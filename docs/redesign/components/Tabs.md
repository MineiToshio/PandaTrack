---
title: Tabs
tier: 2
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0001 D15 (settings layout: tabs verticales)
---

# Tabs

## Propósito

Navegación tabular con dos orientaciones: horizontales (mobile, secondary navigation, sub-secciones cortas) y verticales (desktop settings — ADR 0001 D15: cols 1-3 tabs verticales / cols 4-12 contenido). Aparece en [`../screens/settings.md`](../screens/settings.md) y se reusará en cualquier vista futura con sub-vistas estables (≤6 items). Para listas largas o filtros multi-select usar [`./FilterDrawer.md`](./FilterDrawer.md), no Tabs.

## API TypeScript

```ts
import type { ReactNode } from "react";

type TabItem = {
  value: string;
  label: string;
  icon?: ReactNode; // Lucide icon (opcional)
  disabled?: boolean;
  badge?: string | number; // contador opcional ("3", "12")
};

type TabsProps = {
  /** Orientación. Mobile suele ser horizontal; desktop settings es vertical. */
  orientation: "horizontal" | "vertical";
  /** Valor activo controlado. */
  value: string;
  onValueChange: (value: string) => void;
  /** Tabs a renderizar. Máximo recomendado: 6. */
  items: TabItem[];
  /** Default `md`. */
  size?: "sm" | "md";
  /** Aria-label de la lista de tabs. */
  ariaLabel: string;
};
```

## Variants / Sizes

| Variant      | Uso                                                                | Tokens consumidos                                                     |
| ------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `horizontal` | Mobile sub-navegación, tabs de detalle (Items / Pagos / Historial) | underline indicator `--accent` 2px bottom; padding inline `--space-4` |
| `vertical`   | Desktop settings (Profile / Account / Preferences) — ADR 0001 D15  | left bar indicator `--accent` 3px; padding `--space-3 --space-4`      |

| Size       | Tokens                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------- |
| `sm`       | `--text-caption`, padding `--space-1_5 --space-3`, height ~32px                                |
| `md` (def) | `--text-body`, padding `--space-2 --space-4`, height ~40px desktop / ~44px mobile (tap target) |

## Estados visuales

| Estado         | Receta CSS (light + dark)                                                                                                                                                                                                                                                                                                                                                                                                                                         | Notas                                                                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tab idle`     | `background: transparent; color: var(--text-secondary); font-weight: var(--font-weight-medium-body); padding: var(--space-2) var(--space-4); border-radius: 0; cursor: pointer;`                                                                                                                                                                                                                                                                                  | Sin border. Sin background.                                                                                                                           |
| `tab hover`    | `background-color: color-mix(in oklch, var(--text-primary) var(--state-hover-mix), transparent); color: var(--text-primary);`                                                                                                                                                                                                                                                                                                                                     | State layer overlay. No subraya hasta active.                                                                                                         |
| `tab active`   | Horizontal: `color: var(--text-primary); font-weight: var(--font-weight-semibold); position: relative;` + pseudo `::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: var(--accent); }`. Vertical: pseudo `::before { content: ""; position: absolute; top: var(--space-1); bottom: var(--space-1); left: 0; width: 3px; background: var(--accent); border-radius: 0 var(--radius-pill) var(--radius-pill) 0; }` | Indicador es pseudo-elemento — anima `transform: translate` o `width` con `--motion-fast` `--ease-emphasis` cuando cambia tab activa.                 |
| `tab focus`    | `outline: 2px solid var(--focus-ring); outline-offset: -2px;` (offset negativo para que el ring no salga del container)                                                                                                                                                                                                                                                                                                                                           | `:focus-visible` solamente.                                                                                                                           |
| `tab disabled` | `color: var(--text-muted); pointer-events: none;` (sin opacity)                                                                                                                                                                                                                                                                                                                                                                                                   | ADR 0001 D3.                                                                                                                                          |
| `tab badge`    | `display: inline-flex; align-items: center; gap: var(--space-1_5);` con `<span class="tab-badge">` 18×18 `--radius-pill` `background: color-mix(in oklch, var(--text-primary) 12%, transparent); color: var(--text-secondary); font-size: var(--text-eyebrow); font-family: var(--font-mono); padding: 0 var(--space-1_5);`                                                                                                                                       | Cuando `badge` está presente. Si tab activa, badge cambia a `background: color-mix(in oklch, var(--accent) 14%, transparent); color: var(--accent);`. |

Container (tablist):

- Horizontal: `display: flex; gap: 0; border-bottom: 1px solid var(--border); overflow-x: auto;` (scroll horizontal cuando exceden viewport mobile).
- Vertical: `display: flex; flex-direction: column; gap: var(--space-1); border-right: 1px solid var(--border); padding-right: 0;`.

## Mobile vs desktop

- **Mobile** (`< --breakpoint-md`): `orientation` siempre horizontal en uso real. Si el padre intenta vertical en mobile, el componente lo respeta pero advierte en console.warn. Tabs scroll-x con scroll-snap a inicio de cada tab. Tap target ≥44×44 garantizado vía padding.
- **Desktop** (`≥ --breakpoint-md`): horizontal o vertical según contexto. Settings ADR 0001 D15 = vertical (cols 1-3) + content (cols 4-12).

## Accesibilidad

- Container: `role="tablist"` + `aria-label={ariaLabel}` + `aria-orientation={orientation}`.
- Cada tab: `<button role="tab" aria-selected={value === item.value} aria-controls={`panel-${item.value}`} tabIndex={value === item.value ? 0 : -1}>`. Solo el tab activo es focuseable; el resto se navega con flechas.
- Panel asociado: `<div role="tabpanel" id={`panel-${value}`} aria-labelledby={`tab-${value}`} tabIndex={0}>`.
- Keyboard: `ArrowLeft`/`ArrowRight` (horizontal), `ArrowUp`/`ArrowDown` (vertical), `Home` (primer tab), `End` (último), `Tab` salta al panel.
- Focus visible siempre.
- `prefers-reduced-motion`: indicador no anima (cambia instantáneo).

## Motion

- Indicador active: transition `transform` y/o `width` con `--motion-fast` `--ease-emphasis`. El indicador es un pseudo-elemento posicionado absolutamente sobre el tab activo — al cambiar tab activa, anima entre posiciones.
- Badge: sin animación entrada/salida (cambio instantáneo cuando contador actualiza).
- `prefers-reduced-motion`: indicador cambia instantáneo (sin transition).

## Copy default + i18n

| Clave i18n sugerida                | Valor ES (voice glossary aplicado)                    |
| ---------------------------------- | ----------------------------------------------------- |
| `components.tabs.scrollHint.left`  | "Más a la izquierda"                                  |
| `components.tabs.scrollHint.right` | "Más a la derecha"                                    |
| `components.tabs.disabled.suffix`  | "(no disponible)" — sufijo sr-only para tabs disabled |

(Las labels mismas vienen del consumidor — el componente no provee copy de items.)

## Edge cases

1. **Más de 6 tabs:** el componente sigue funcionando pero advierte console.warn ("Más de 6 tabs sugiere reconsiderar la navegación"). Mobile horizontal: scroll-x con shadows laterales que indican overflow.
2. **Tab disabled activo:** si `value` apunta a un item con `disabled: true`, el componente advierte y no aplica indicator (el padre debe corregir el `value`).
3. **Cambio de orientation runtime:** el componente respeta el cambio sin re-mount; `aria-orientation` se actualiza, indicator re-calcula posición.
4. **Tab con label muy largo:** mobile scroll-x lo permite. Desktop vertical: `text-overflow: ellipsis` + tooltip con label completo en hover.
5. **Sin items:** componente no renderiza nada (return null), no hay placeholder.

## Anti-patrones

1. **Nunca usar Tabs como filtros multi-select** — eso es [`./FilterDrawer.md`](./FilterDrawer.md). Tabs es navegación entre vistas mutuamente excluyentes.
2. **Nunca >6 items** — si necesitás más, reconsiderá la navegación (sub-niveles, search, sidebar).
3. **Nunca `--accent-cool`** como indicator — solo `--accent` (ADR 0006: `--accent-cool` no es color de UI funcional).
4. **Nunca opacity** en disabled (ADR 0001 D3).
5. **Nunca dos pseudo-indicadores simultáneos** (uno por orientation) — el wrapper controla cuál renderiza.

## Ejemplos de uso

```tsx
// Settings desktop — vertical (ADR 0001 D15)
<Tabs
  orientation="vertical"
  value={tab}
  onValueChange={setTab}
  ariaLabel="Secciones de ajustes"
  items={[
    { value: "profile", label: "Perfil", icon: <User /> },
    { value: "account", label: "Cuenta", icon: <Key /> },
    { value: "preferences", label: "Preferencias", icon: <Settings /> },
  ]}
/>

// Order detail mobile — horizontal con badge
<Tabs
  orientation="horizontal"
  value={section}
  onValueChange={setSection}
  ariaLabel="Secciones del pedido"
  items={[
    { value: "items", label: "Productos", badge: 3 },
    { value: "payments", label: "Pagos" },
    { value: "history", label: "Historial" },
  ]}
/>
```

## Tokens consumidos

`--surface`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent`, `--border`, `--focus-ring`, `--font-weight-medium-body`, `--font-weight-semibold`, `--text-body`, `--text-caption`, `--text-eyebrow`, `--font-mono`, `--space-1`, `--space-1_5`, `--space-2`, `--space-3`, `--space-4`, `--radius-pill`, `--motion-fast`, `--ease-emphasis`, `--state-hover-mix`.

## ADRs aplicables

- [`../decisions/0001-s2-closure-decisions.md`](../decisions/0001-s2-closure-decisions.md) D15 (settings desktop tabs verticales).
- [`../decisions/0001-s2-closure-decisions.md`](../decisions/0001-s2-closure-decisions.md) D3 (disabled sin opacity).
- [`../decisions/0006-color-blindness-icon-label-contract.md`](../decisions/0006-color-blindness-icon-label-contract.md) (no usar `--accent-cool` como indicator).

## Dependencias

Compone íconos Lucide (responsabilidad del consumidor). Composible dentro de cualquier shell de pantalla.

## Notas para S12 (implementación)

- Considerar usar `@radix-ui/react-tabs` como base headless (provee keyboard + aria correcto out-of-the-box). Los estilos se aplican via tokens.
- Indicator posicionado absolutamente sobre el tab activo: medir con `useLayoutEffect` el bounding rect y aplicar `transform`. Alternativa: CSS `:has(:checked)` selector si todos los browsers target lo soportan.
- Scroll-x mobile: scroll snap + IntersectionObserver para shadows laterales.
- Persistencia del tab activo: el padre decide (querystring para shareable, localStorage para preferencia, ninguna para estado efímero).
