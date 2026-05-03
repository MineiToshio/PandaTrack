---
title: ADR 0008 — Modal Enhancement · Semantic Depth (M01)
date: 2026-05-03
status: accepted
session: M01-modal-enhancement (mini-sesión correctiva)
owner: Sergio Minei
updates: components/Modal.md
sources:
  - _notes/demo-screens.html (18 secciones M01 — versiones A, B, C × 6 casos de uso)
  - _notes/cross-cutting-changes.md (entrada M01)
---

# ADR 0008 — Modal Enhancement · Semantic Depth

## Contexto

Durante la exploración del módulo S6 (Tiendas), el componente `<Modal>` fue marcado como cross-cutting change M01 (Tipo 2 — cambio mayor de componente core). El diagnóstico: el modal se percibía como **plano y genérico** — un recuadro blanco con título, body y botones sin ninguna señal visual que comunicara tono, urgencia o identidad Atelier.

La spec original de `Modal.md` (S4) definía:

- Backdrop `--surface-overlay` sin blur
- `border-radius: var(--radius-xl)` (16px)
- Header plano: solo `<h2>` + `description` + close button
- Footer: `border-top: 1px solid var(--border)` pero con `background: var(--surface)` en lugar del fondo elevado
- Enter: `scale(0.96 → 1) + opacity`, easing `--ease-out-expressive`

El diseño no comunicaba semántica de acción (destructiva vs informativa vs form), y la entrada carecía de "peso" visual.

## Exploración

Se implementaron 3 versiones × 6 casos de uso reales en el demo HTML (`_notes/demo-screens.html`, secciones `m01-va-*`, `m01-vb-*`, `m01-vc-*`) y se evaluaron con el humano:

### Versión A — Editorial Quiet

Tipografía como única voz. Sin íconos en el header. Título 22px / 700. Padding 28px. El tono se comunica solo por el color del CTA. Referentes: Linear, Plain, Stripe.

### Versión B — Semantic Depth ✅ ELEGIDA

Ícono circular 48px (`border-radius: 24px`) con fondo tonal al 14% del color semántico. Header en fila flex: [icon-circle] + [título + subtítulo + close]. `border-top` divider sobre el footer. Referentes: Stripe Dashboard, Polaris, Carbon.

### Versión C — Atelier Hero

Hairline 2px de acento en el tope. Eyebrow monoespaciado 10px uppercase. Ícono centrado 40px con halo radial (`--m01c-tone`). Centrado horizontal completo. Referente: Apple HIG + firma PandaTrack.

## Decisión

**Versión B (Semantic Depth)** aprobada por el humano.

### Especificación aprobada

#### Overlay (backdrop + container unificados)

| Propiedad            | Valor                                                               |
| -------------------- | ------------------------------------------------------------------- |
| `position`           | `fixed`                                                             |
| `inset`              | `0`                                                                 |
| `z-index`            | `var(--z-modal)` (80) — ver nota z-index                            |
| `display`            | `flex; align-items: center; justify-content: center; padding: 16px` |
| `backdrop-filter`    | `blur(8px)` + `-webkit-backdrop-filter: blur(8px)`                  |
| `background` (light) | `oklch(12% 0.010 50 / 0.35)`                                        |
| `background` (dark)  | `oklch(4% 0.015 265 / 0.62)`                                        |

> **Nota z-index:** La nueva overlay unifica backdrop + card en un único elemento `position: fixed`. El valor de token sigue siendo `--z-modal: 80`. El toast (`--z-toast: 90`) sigue por encima — el stacking se preserva por DOM order cuando ambos coexisten.

#### Modal card

| Propiedad            | Valor                                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `max-width`          | `460px`                                                                                                                             |
| `width`              | `100%`                                                                                                                              |
| `background`         | `var(--surface-elevated)`                                                                                                           |
| `border`             | `1px solid var(--border-strong)`                                                                                                    |
| `border-radius`      | `20px` (`--radius-2xl`)                                                                                                             |
| `overflow`           | `hidden`                                                                                                                            |
| `box-shadow` (light) | `0 14px 28px oklch(20% 0.020 50 / 0.10), 0 2px 6px oklch(20% 0.020 50 / 0.06)`                                                      |
| `box-shadow` (dark)  | `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 1px var(--border-strong), 0 0 24px color-mix(in oklch, var(--accent) 5%, transparent)` |

#### Header

```
[icon-circle 48px] [gap 16px] [header-text flex-col]
                               ├─ [row: <h2 title>] [close button]
                               └─ [<p subtitle> — opcional]
padding: 24px 24px 0
```

#### Icon circle

| Clase / Tone       | Background                                                             | Color                |
| ------------------ | ---------------------------------------------------------------------- | -------------------- |
| `tone-default`     | `color-mix(in oklch, var(--accent) 14%, var(--surface-elevated))`      | `var(--accent)`      |
| `tone-destructive` | `color-mix(in oklch, var(--destructive) 14%, var(--surface-elevated))` | `var(--destructive)` |
| `tone-warning`     | `color-mix(in oklch, var(--warning) 14%, var(--surface-elevated))`     | `var(--warning)`     |
| `tone-info`        | `color-mix(in oklch, var(--info) 14%, var(--surface-elevated))`        | `var(--info)`        |

Dimensiones: `48px × 48px`, `border-radius: 24px`. Ícono interior: `20px`, `stroke-width: 1.75`.

#### Body

`padding: 16px 24px 4px; overflow-y: auto; flex: 1`

#### Footer

`padding: 12px 24px 20px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 8px`

#### Animación de entrada

```css
@keyframes modal-spring {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
/* duración: 280ms — easing spring sintético */
animation: modal-spring 280ms linear(0, 0.5, 0.85, 0.97, 1) both;
```

Equivalente a `--ease-out-expressive` (spring) con `--motion-base` (280ms).

`@media (prefers-reduced-motion: reduce)`: solo opacity, sin scale.

## Justificación

1. **Señal semántica sin sobrecarga.** El icon-circle con fondo tonal al 14% transmite tono (rojo = destructivo, ámbar = warning) sin dominar la composición. La opacidad baja es suficiente para el usuario con visión de color; el ícono mismo actúa como señal orthogonal (ADR 0006 cumplido).
2. **Equilibrio entre B y C.** La Versión A era demasiado neutra (ambigüedad semántica). La Versión C era demasiado dominante para casos frecuentes (confirm, form, info). La Versión B tiene personalidad sin convertirse en el protagonista.
3. **Consistencia con referentes industriales.** Stripe Dashboard, Polaris y Carbon usan exactamente este patrón: icon circle tonal + título en línea + divider de footer. Es legible, familiar y directamente escalable.
4. **Backdrop blur Atelier.** `blur(8px)` con tint oklch calibrado es más sofisticado que `--surface-overlay` plano. Comunica profundidad (layered design) y refuerza la identidad Atelier sin romper a11y.
5. **Spring animation.** `linear(0, 0.5, 0.85, 0.97, 1)` produce una entrada que "aterriza" con convicción en lugar del scale mecánico anterior. Consistente con la personalidad 18–25 del sistema.

## Costo y riesgo

- **Bajo.** Cambio puramente visual — no afecta el contrato funcional del modal ni la API TypeScript de manera rompedora (solo se agregan props opcionales).
- `description` prop se renombra a `subtitle` semánticamente (posición: en el header, no en el body). La prop `description` queda como alias deprecado en S12.
- El backdrop unificado (backdrop + card en un div flex) simplifica la implementación vs el enfoque anterior de dos capas separadas.
- `border-radius: 20px` supera `--radius-xl` (16px) actual. Se asigna a `--radius-2xl` — confirmar valor en `tokens.md` antes de S12.

## Implicancias

1. `components/Modal.md` — actualizado en este cierre: API TypeScript, estados visuales, motion, tokens.
2. `_notes/cross-cutting-changes.md` — M01 marcado `✅ aplicado`.
3. `_notes/demo-screens.html` — 18 secciones M01 sirven como referencia visual vinculante. La implementación React en S12 debe replicar Version B.
4. `tokens.md` — confirmar `--radius-2xl: 20px` en S12 si no está definido.
5. ADR 0001 D4 (toast > modal z-index) sigue válido — `--z-toast: 90` > `--z-modal: 80`.

## Audit AA — contraste

Verificación de pares foreground/background del modal Version B contra WCAG AA (4.5:1 texto normal, 3:1 texto grande/UI).

| Par                                                | Contexto                 | AA (light)                          | AA (dark) |
| -------------------------------------------------- | ------------------------ | ----------------------------------- | --------- |
| `--text-primary` sobre `--surface-elevated`        | Título, body text        | ✅ pasa                             | ✅ pasa   |
| `--text-secondary` sobre `--surface-elevated`      | Subtitle, descripción    | ✅ pasa                             | ✅ pasa   |
| `--destructive` sobre `color-mix(…14%…)`           | Ícono tono destructive   | ✅ pasa                             | ✅ pasa   |
| `--warning` sobre `color-mix(…14%…)`               | Ícono tono warning       | ✅ pasa                             | ✅ pasa   |
| `--info` sobre `color-mix(…14%…)`                  | Ícono tono info          | ✅ pasa                             | ✅ pasa   |
| `--accent` sobre `color-mix(…14%…)`                | Ícono tono default       | ✅ pasa                             | ✅ pasa   |
| CTA primary (`--text-on-accent` sobre `--accent`)  | Botón primario           | ✅ pasa                             | ✅ pasa   |
| CTA destructive (blanco sobre `--destructive`)     | Botón eliminar           | ✅ pasa                             | ✅ pasa   |
| `--text-primary` sobre backdrop `oklch(12%…/0.35)` | Texto detrás del overlay | N/A — texto del modal, no del fondo |           |
| Close button icon sobre `--surface-elevated`       | IconButton x en header   | ✅ pasa (usa `--text-secondary`)    |           |

Nota: el 14% de mezcla en los icon-circle backgrounds produce un tinte suave; el color del ícono mismo (`--destructive`, `--warning`, etc.) es el texto-grande semántico y cumple 3:1 contra el fondo tonal. Los tones siguen ADR 0006 (ícono + label — la semántica no descansa solo en el color).

> **Sheet mobile**: `<Sheet>` (contraparte mobile del modal) aplica el mismo `backdrop-filter: blur(8px)` con los oklch calibrados — decisión confirmada en cierre de M01. `--surface-overlay` eliminado también en Sheet. Ver `components/Sheet.md` (estado Backdrop).

## Confianza

**Alta.** Aprobado directamente por el humano tras ver las 3 versiones en el demo interactivo (light + dark + 5 paletas). Sin ambigüedad en la decisión.

## Próximos pasos

1. `components/Modal.md` actualizado ✅ (en este cierre).
2. En S12 (implementación): replicar Version B en React usando los tokens y recetas de este ADR.
3. Confirmar `--radius-2xl: 20px` en `tokens.md` al inicio de S12.
