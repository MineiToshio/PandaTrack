---
title: Tooltip
tier: 3
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0006 (icon+label contract — Tooltip provee label adyacente cuando se usa para clarificar íconos en `--accent-cool`)
---

# Tooltip

## Propósito

Etiqueta auxiliar que aparece al hover/focus sobre un control. Aparece en headers compactos del shell (icon-only buttons como theme/lang toggle), en bolitas del [`./Stepper.md`](./Stepper.md) cuando el label se trunca en mobile, en chips de status cuando el copy completo no entra. **No reemplaza un label** — es información secundaria. El consumer debe asegurar que el contenido funcional tenga su propio nombre accesible vía `aria-label` antes de añadir Tooltip.

## API TypeScript

```ts
import type { ReactNode, RefObject } from "react";

type TooltipSide = "top" | "right" | "bottom" | "left";

type TooltipProps = {
  /** Texto del tooltip — obligatorio, no decorativo. Mantener corto (máx ~50 chars). */
  content: string;
  /** Trigger — cualquier focusable (Button, IconButton, link, control con focus). */
  children: ReactNode;
  /** Lado preferido. Default `top`. Si no entra, `@floating-ui` flippea automáticamente. */
  side?: TooltipSide;
  /** Delay antes de mostrar (hover/focus). Default 600. */
  delayMs?: number;
  /** Forzar render (debug / portal stories). Default `undefined` = controlado por hover/focus. */
  open?: boolean;
};
```

## Variants / Sizes

Tooltip tiene un solo render visual. Lo que varía es la `side` (placement). No hay `sm`/`md`/`lg`: el size se ajusta al contenido (`max-width: calc(var(--container-max-w-prose) / 4)` ~= 168px para mantener línea legible — wrapping vertical permitido).

## Estados visuales

| Estado     | Receta CSS (light + dark)                                                                                                                                                                                                                                                                                                                                       | Notas                                                                                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `closed`   | No render (no hay nada en DOM hasta que abre).                                                                                                                                                                                                                                                                                                                  | Para evitar bloat en listas largas.                                                                                                                           |
| `open`     | `background: var(--text-primary); color: var(--background); border-radius: var(--radius-sm); padding: var(--space-1) var(--space-2); font-size: var(--text-caption); line-height: var(--text-caption--line-height); font-weight: var(--font-weight-medium); box-shadow: var(--elevation-2); max-width: 16rem; pointer-events: none; z-index: var(--z-tooltip);` | Inversión deliberada de tokens texto/superficie — alto contraste universal. `pointer-events: none` para que el tooltip no se interponga al click del trigger. |
| `entering` | `opacity: 0 → 1; transform: scale(0.96) → scale(1);` con `--motion-fast` `--ease-emphasis`.                                                                                                                                                                                                                                                                     | Anchor flip vía `@floating-ui` cuando no entra en `side` preferida.                                                                                           |
| `exiting`  | `opacity: 1 → 0;` con `--motion-fast` `--ease-emphasis`.                                                                                                                                                                                                                                                                                                        | Sin transform en exit.                                                                                                                                        |

Arrow opcional: pequeño triángulo 6×6 del mismo color del background, posicionado por `@floating-ui` middleware. En MVP, el arrow se omite por simplicidad — si en S6 se solicita, agregar como prop `showArrow?: boolean`.

## Mobile vs desktop

- **Desktop**: hover sobre trigger → delay 600ms → abre. Esc o blur cierra. Mouse sale del trigger O del tooltip → cierra inmediato.
- **Mobile** (`< --breakpoint-md`): el hover no existe. La estrategia es **doble**: (a) el `aria-label` del trigger ya provee información para SR/touch, (b) si el padre quiere reforzar visualmente, usar press-and-hold (long-press) para abrir el tooltip — pero **el componente NO implementa long-press en MVP** (complejidad sin valor obvio cuando el aria-label ya cubre). Documentar para S6+ si se necesita.

Recomendación: en mobile, en vez de Tooltip considerar inline label visible (HelperText) o foldable.

## Accesibilidad

- Tooltip wrapper: `role="tooltip"` + `id={id}`.
- Trigger: `aria-describedby={id}` cuando el tooltip está abierto. **Nunca** `aria-labelledby` (eso reemplazaría el label, y el tooltip es secundario, no nombre).
- Tooltip **no es focuseable** (no entra en tab order). Tab pasa de largo.
- Esc cierra cuando el trigger tiene focus.
- Screen reader: el contenido del tooltip se anuncia automáticamente cuando el trigger recibe focus (vía `aria-describedby`).
- `prefers-reduced-motion`: enter/exit sin transform — solo opacity con `--motion-fast`.
- **Importante (ADR 0006)**: Tooltip NO sustituye un label. Si un IconButton usa `--accent-cool` ícono y solo provee Tooltip, la regla del ADR 0006 sigue requiriendo label adyacente — el Tooltip es **adicional**, no reemplazo.

## Motion

- Enter: opacity 0→1 + scale 0.96→1 con `--motion-fast` `--ease-emphasis`. Delay 600ms antes de mostrar.
- Exit: opacity 1→0 con `--motion-fast`. Sin scale en exit.
- `prefers-reduced-motion`: enter es opacity-only (sin scale), exit igual.

## Copy default + i18n

El componente **no provee copy por default** — el `content` viene del consumidor. Sí documenta convenciones:

| Caso                               | Convención de copy (voice glossary)                               |
| ---------------------------------- | ----------------------------------------------------------------- |
| Tooltip en IconButton de toggle    | "Cambiar a modo claro/oscuro" (verbo en infinitivo, voz activa)   |
| Tooltip en chip truncado           | El texto completo del chip                                        |
| Tooltip en bolita stepper (mobile) | "Paso N: {label}"                                                 |
| Tooltip de "más info" (signo `?`)  | Una sola frase corta — si necesitás más, usá HelperText o Popover |

## Edge cases

1. **Trigger sin focus capability** (ej. `<div>` sin `tabIndex`): el componente advierte console.warn y NO se abre con focus, solo con hover desktop. El consumidor debe envolver en un focusable.
2. **Multiple triggers cerca**: el delay 600ms evita "flicker" cuando el cursor pasa de un trigger a otro. Cada tooltip cierra al perder hover/focus.
3. **Trigger se desmonta abierto**: cleanup automático del tooltip (no portal huérfano).
4. **Contenido muy largo**: el `max-width` impide overflow horizontal. Si supera 3 líneas, reconsiderar usar `<Popover>` con contenido estructurado.
5. **HTML en `content`**: el componente acepta solo `string`. Si necesitás HTML/JSX, usá `<Popover>`. Tooltip simple = texto plano.
6. **Touch device sin hover**: como se documenta en mobile, no se abre por hover. La accesibilidad la cubre `aria-describedby` + el `aria-label` propio del trigger.

## Anti-patrones

1. **Nunca tooltip como único nombre accesible** — el trigger debe tener su propio `aria-label` o texto visible. Tooltip es información secundaria.
2. **Nunca tooltip en hover-only** sin equivalente focus — rompe keyboard accessibility.
3. **Nunca tooltip con `--accent-cool` background** — ADR 0006 prohíbe. El bg es siempre `--text-primary` (inversión).
4. **Nunca delays <300ms** — un tooltip que aparece inmediato es ruidoso.
5. **Nunca multi-paragrafo** — eso es Popover.
6. **Nunca interactive content** (links, buttons) dentro del Tooltip — eso es Popover.

## Ejemplos de uso

```tsx
// IconButton toggle theme
<Tooltip content="Cambiar a modo oscuro">
  <IconButton icon={<Sun />} label="Cambiar tema" onClick={toggleTheme} />
</Tooltip>

// Chip truncado en mobile orders list
<Tooltip content="Parcialmente en camino">
  <StatusChip kind="orderStatus" value="PARTIALLY_IN_TRANSIT" />
</Tooltip>
```

## Tokens consumidos

`--text-primary`, `--background`, `--font-weight-medium`, `--text-caption`, `--radius-sm`, `--space-1`, `--space-2`, `--elevation-2`, `--z-tooltip`, `--motion-fast`, `--ease-emphasis`.

## ADRs aplicables

- [`../decisions/0006-color-blindness-icon-label-contract.md`](../decisions/0006-color-blindness-icon-label-contract.md) (Tooltip refuerza label, no lo reemplaza).

## Dependencias

Compone con cualquier focusable trigger: [`./Button.md`](./Button.md), [`./IconButton.md`](./IconButton.md), bolita de [`./Stepper.md`](./Stepper.md), chip de [`./StatusChip.md`](./StatusChip.md). Composible dentro de [`./Popover.md`](./Popover.md) trigger (rara, pero válida).

## Notas para S12 (implementación)

- Usar `@floating-ui/react` para anchor + flip + collision detection. Provee también `useHover` + `useFocus` + `useDismiss` + `useRole` hooks.
- Portal a `<body>` o a un `<div id="tooltip-root">` para evitar `overflow: hidden` clipping.
- Considerar `@radix-ui/react-tooltip` como alternativa headless ya con keyboard + ARIA correctos.
- Long-press mobile (S6+): si se decide implementar, usar 500ms + `pointerdown`/`pointerup` listeners. No interferir con scroll.
- Si en future feature el tooltip necesita HTML rich content, escalar el spec a una variant `Popover` (no agregar HTML al Tooltip).
