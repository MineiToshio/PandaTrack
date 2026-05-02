---
title: Avatar
tier: 2
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0001 D3 (disabled sin opacity)
---

# Avatar

## Propósito

Avatar genérico de **usuario** (no de tienda — esa primitiva vive en [`./StoreAvatar.md`](./StoreAvatar.md)). Render del avatar de la persona autenticada en el sidebar footer del shell admin (ADR 0003 D3), en account menus, en historial de actividad cuando se diseñe (S6+) y en cualquier UI que muestre identidad humana. Soporta imagen subida o iniciales fallback.

## API TypeScript

```ts
import type { ReactNode } from "react";

type AvatarSize = 24 | 32 | 40 | 56;
type AvatarStatus = "online" | "offline";

type AvatarProps = {
  /** Datos del usuario. `image` opcional; si no hay, se renderizan iniciales. */
  user: { name: string; image?: string };
  /** Sizes canónicos del sistema (alineados con StoreAvatar). */
  size: AvatarSize;
  /** Dot opcional de presencia. Reservado S6+ (no se usa en MVP). */
  status?: AvatarStatus;
  /** Aria-label override. Default = `user.name`. */
  ariaLabel?: string;
};
```

## Variants / Sizes

| Size | Uso típico                                            | Tokens consumidos                |
| ---- | ----------------------------------------------------- | -------------------------------- |
| 24   | Inline en activity feed denso, breadcrumbs con avatar | `--text-eyebrow` para iniciales  |
| 32   | Sidebar collapsed, dropdown items, list rows densas   | `--text-mono` para iniciales     |
| 40   | Sidebar expanded footer (ADR 0003 D3), account menu   | `--text-body` para iniciales     |
| 56   | Settings → Profile hero, achievement toast secundario | `--text-subtitle` para iniciales |

Radius **siempre `--radius-pill`** (a diferencia de `<StoreAvatar>` que cambia mobile/desktop). Razón: el avatar de usuario es identidad humana, el patrón cultural universal es circular.

## Estados visuales

| Estado             | Receta CSS (light)                                                                                                                                                                                                                                                                                | Receta CSS (dark)                       | Notas                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `with image`       | `background: transparent; background-image: url(<src>); background-size: cover; background-position: center; border-radius: var(--radius-pill); border: 1px solid var(--border);`                                                                                                                 | mismo                                   | `<img>` con `object-fit: cover` también es válido. Border `--border` evita que avatares con fondos blancos floten sin contorno sobre `--surface`. |
| `fallback initial` | `background: color-mix(in oklch, var(--text-primary) 14%, var(--surface-elevated)); color: var(--text-primary); font-family: var(--font-display); font-weight: var(--font-weight-semibold); border: 1px solid var(--border); display: inline-flex; align-items: center; justify-content: center;` | mismo                                   | Una sola letra (primera del nombre, mayúscula) — alineado con `<StoreAvatar>` D16.                                                                |
| `with status dot`  | `position: relative;` + dot 8×8 (`size 24/32`) o 10×10 (`size 40/56`) en bottom-right con `box-shadow: 0 0 0 2px var(--surface)`. `online` = `background: var(--success)`. `offline` = `background: var(--text-muted)`.                                                                           | mismo (status compartidos cross-paleta) | Reservado S6+. No usar en MVP.                                                                                                                    |
| `loading`          | Skeleton circular pulse: `background: color-mix(in oklch, var(--text-primary) 8%, var(--surface)); animation: pulse var(--motion-base) ease-in-out infinite alternate;`                                                                                                                           | mismo                                   | Cuando la imagen está cargando vía `next/image`.                                                                                                  |

## Mobile vs desktop

Sin diferencia visual entre breakpoints (a diferencia de `<StoreAvatar>` que cambia radius). Lo que cambia es el size que el componente padre invoca: sidebar mobile usa `size 32` cuando colapsado, `size 40` cuando expandido; sidebar desktop usa `size 40` siempre.

## Accesibilidad

- Wrapper como `<span>` o `<img>` según render.
- Cuando hay `image`: `<img alt={ariaLabel ?? user.name}>`. Nunca `alt=""` para avatar de usuario — el nombre tiene valor semántico.
- Cuando es fallback: `<span role="img" aria-label={ariaLabel ?? user.name}>` con la inicial visible.
- Status dot: `<span role="status" aria-label="En línea / Desconectado">` (i18n). En MVP no se usa.
- Focus: el avatar **no es focuseable por sí mismo**. Si vive dentro de un botón/link, el wrapper recibe el focus.

## Motion

- Skeleton loading: pulse `--motion-base` infinite alternate. `prefers-reduced-motion`: pulse desactivada → skeleton estático.
- Status dot: sin animación (estado puntual, no anuncia transición).

## Copy default + i18n

| Clave i18n sugerida                | Valor ES (voice glossary aplicado) |
| ---------------------------------- | ---------------------------------- |
| `components.avatar.fallbackAlt`    | "Avatar de {name}"                 |
| `components.avatar.status.online`  | "En línea"                         |
| `components.avatar.status.offline` | "Desconectado"                     |
| `components.avatar.imageLoadError` | "No pudimos cargar el avatar"      |

## Edge cases

1. **Nombre con emoji o caracteres no-letra al inicio:** se usa la primera letra alfabética. Si no hay ninguna, se usa el primer carácter Unicode tal cual (ej. nombre "🐼 Sergio" → "S").
2. **Imagen rota (404 o load error):** fallback automático a iniciales (no romper el render).
3. **Nombre vacío:** render con ícono Lucide `user` 16/20/24/32 según size en `--text-muted` sobre `--surface-elevated`.
4. **Imagen con transparencia (PNG alpha):** sin tinte de fondo (a diferencia de StoreAvatar que sí tinta), porque la silueta humana es identificable. Border `--border` mantiene contorno visible.
5. **Avatar dentro de stack de avatares (S6+):** el componente acepta clase modificadora `avatar--stacked` que aplica `box-shadow: 0 0 0 2px var(--surface)` y `margin-left: -var(--space-2)` para overlap controlado.

## Anti-patrones

1. **Nunca dos iniciales** — se usa siempre una (alineado con `<StoreAvatar>` D16). Dos iniciales se sienten "fallback de contacto" tipo Apple Mail; una sola inicial se siente "diseñada".
2. **Nunca opacity** para "avatar de usuario inactivo / suspendido" — usar `--text-muted` para iniciales + border `--border` (no strong).
3. **Nunca colorear iniciales con `--accent`** — eso lo hace `<StoreAvatar>` para representar la marca de la tienda. El avatar de usuario es neutro: usa `--text-primary` sobre tinte muted.
4. **Nunca tinte de marca por user-id** — sin "el avatar de Sergio es violeta y el de María es coral". El sistema no asigna colores por persona.

## Ejemplos de uso

```tsx
// Sidebar footer del shell admin (ADR 0003 D3)
<Avatar user={{ name: "Sergio Minei", image: session.user.image }} size={40} />

// Inline en activity feed denso
<Avatar user={{ name: actor.name }} size={24} />
```

## Tokens consumidos

`--surface`, `--surface-elevated`, `--text-primary`, `--text-muted`, `--border`, `--success`, `--font-display`, `--font-weight-semibold`, `--text-eyebrow`, `--text-mono`, `--text-body`, `--text-subtitle`, `--radius-pill`, `--motion-base`.

## ADRs aplicables

- [`../decisions/0001-s2-closure-decisions.md`](../decisions/0001-s2-closure-decisions.md) D3 (disabled sin opacity), D16 (sizes 24/32/40/56 alineados con StoreAvatar).
- [`../decisions/0003-demo-decisions.md`](../decisions/0003-demo-decisions.md) D3 (avatar usuario vive en sidebar footer, no en header).

## Dependencias

Ninguna (primitiva atómica). Composible dentro de [`./Button.md`](./Button.md), [`./DropdownMenu.md`](./DropdownMenu.md), [`./Tabs.md`](./Tabs.md) cuando aplique.

## Notas para S12 (implementación)

- Decidir entre `next/image` (con loader + blur placeholder) vs `<img>` directo con `loading="lazy"`. Para avatares 24-56px probablemente `<img>` simple sea suficiente; `next/image` para size 56+ del settings.
- Status dot reservado S6+ — no implementar en MVP (no hay use case validado).
- Fallback de imagen rota: implementar con `onError` handler que setea `src=undefined` y dispara render fallback.
- Stack overlap (avatar list S6+): clase utility o componente envoltorio decide en S6 cuando se diseñe el activity feed con varios actores.
