---
title: FAB
tier: 2
status: REMOVED from app shell (2026-05-15) — file kept in src for potential future reuse, not mounted anywhere
last_updated: 2026-05-15
session: 05-app-shell · removed in S5.3 cross-cutting
adrs:
  - ADR 0001 D6 (acciones destructivas en overflow — el FAB es solo para acción primaria)
---

> ⛔ **REMOVED from app shell on 2026-05-15** (cross-cutting entry **S5.3**). The component does not mount in `AppLayout` anymore. The file `src/components/core/FAB.tsx` still exists but is unused. Do NOT add it back to the shell without a fresh decision — Sergio explicitly removed it. If you need a primary mobile CTA, use a sticky bottom action bar inside the page (see `<WizardStep actionsLayout="sticky-on-mobile">`).

# FAB

## Propósito

Floating Action Button: botón circular fijo en la esquina inferior derecha de la pantalla en mobile. Dispara la **acción principal contextual** según la ruta activa. En desktop, el FAB no se renderiza — la acción principal está en el header de la lista o en un botón prominente en el contenido.

Acciones canónicas por ruta:

| Ruta                           | Acción FAB    | Ícono Lucide   | Label SR        |
| ------------------------------ | ------------- | -------------- | --------------- |
| `/dashboard`                   | Nuevo pedido  | `shopping-bag` | "Nuevo pedido"  |
| `/orders`                      | Nuevo pedido  | `shopping-bag` | "Nuevo pedido"  |
| `/orders/[id]`                 | Nueva entrega | `package`      | "Nueva entrega" |
| `/deliveries`                  | Nueva entrega | `package`      | "Nueva entrega" |
| `/stores`                      | Sumar tienda  | `store`        | "Sumar tienda"  |
| `/settings`                    | No FAB        | —              | —               |
| Fallback (cualquier otra ruta) | Nuevo pedido  | `shopping-bag` | "Nuevo pedido"  |

El FAB flota bottom-right con `position="fixed"` y es montado directamente desde el `AppShellLayout`.

## API TypeScript

```ts
import type { LucideIcon } from "lucide-react";

type FabAction = {
  /** Href de navegación destino. */
  href: string;
  /** Label sr-only obligatorio. */
  label: string;
  /** Ícono Lucide. */
  icon: LucideIcon;
};

type FABProps = {
  /** Acción a disparar. Si `null`, el FAB no renderiza. */
  action: FabAction | null;
  /** Posición de montaje. `fixed` = floating bottom-right. */
  position?: "fixed";
  /** Override del className. */
  className?: string;
};
```

Reglas TS:

- `action: null` es la forma correcta de "no mostrar FAB" (ej. `/settings`).
- El ícono es `LucideIcon` — no acepta SVG custom ni Simple Icons.
- `label` es obligatorio dentro de `FabAction` — TypeScript rechaza sin él.

## Variants / Sizes

Un solo variant visual. Tamaño fijo `--fab-size` = `3.5rem` (56px).

Receta visual:

```css
.fab {
  width: var(--fab-size); /* 3.5rem = 56px */
  height: var(--fab-size);
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: var(--text-on-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--elevation-2);
}
```

Ícono interno: 24×24px en `var(--text-on-accent)`.

## Estados visuales

| Estado        | Receta CSS (light)                                                                         | Receta CSS (dark)                  |
| ------------- | ------------------------------------------------------------------------------------------ | ---------------------------------- |
| idle          | `background: var(--accent); color: var(--text-on-accent); box-shadow: var(--elevation-2);` | mismo (valores dark de los tokens) |
| hover         | overlay `color-mix(in oklch, var(--text-on-accent) 8%, transparent)` via `::after`         | mix=10%                            |
| pressed       | overlay mix=16%                                                                            | 20%                                |
| focus-visible | `outline: 2px solid var(--focus-ring); outline-offset: 2px;`                               | mismo                              |
| loading       | ícono reemplazado por `loader-2` animado; `pointer-events: none`                           | mismo                              |

**Crítico:** `color: var(--text-on-accent)` — en dark, `--text-on-accent` es `oklch(15% 0.020 290)` (oscuro). No hardcodear `text-white`.

## Mobile vs desktop

| Aspecto           | Mobile (`< --breakpoint-md`)                                      | Desktop (`≥ --breakpoint-md`) |
| ----------------- | ----------------------------------------------------------------- | ----------------------------- |
| Visibilidad       | Visible (`position="fixed"`)                                      | **No renderizar** (null)      |
| Posición          | `bottom: var(--fab-offset); right: var(--fab-offset)` desde borde | N/A                           |
| Sin label visible | Solo ícono (tap target 56×56 ≥ 44px ✅)                           | N/A                           |

## Accesibilidad

- `<a>` semántico si `action.href` es ruta interna (navegación), no `<button>`. El FAB navega, no ejecuta una acción in-place.
- `aria-label={action.label}` — el label es el único texto accesible del botón.
- Foco visible: `outline` sobre el radius-pill.
- No trampa de foco — el FAB es un link de navegación estándar.

## Motion

| Qué               | Token de duración                                    | Token de easing   | Notas                      |
| ----------------- | ---------------------------------------------------- | ----------------- | -------------------------- |
| State layer       | `--motion-fast`                                      | `--ease-emphasis` | Hover/pressed.             |
| loading spinner   | N/A (CSS animation del icon)                         | N/A               | loader-2 Lucide.           |
| Entrada al montar | Ninguna (FAB aparece con el shell, no anima entrada) | N/A               | Simplicidad > choreography |

## Copy default + i18n

| Clave i18n sugerida          | Valor ES        |
| ---------------------------- | --------------- |
| `components.fab.newOrder`    | "Nuevo pedido"  |
| `components.fab.newDelivery` | "Nueva entrega" |
| `components.fab.addStore`    | "Sumar tienda"  |

EN se completa en S12.

## Edge cases

1. **Ruta sin acción definida** (ej. `/orders/new`): pasar `action={null}`. El formulario de creación ya está en contexto.
2. **Ruta de detalle** (`/orders/[id]`): la acción principal contextual es "Nueva entrega para este pedido" — el `href` incluye el ID del pedido como query param o contexto.
3. **Sin tiendas** (gate "Necesitas una tienda primero"): el FAB navega a `/orders/new` de todas formas — el gate lo maneja el formulario, no el FAB.
4. **Loading durante navegación**: si la navegación tarda (ej. prefetch lento), el FAB no muestra loading. La navegación es estándar de Next.js.
5. **Scroll profundo**: el FAB queda visible aunque el usuario esté en el fondo de la lista. No compite con el `<Pagination variant="load-more">` — son zonas distintas.

## Anti-patrones

1. **FAB en desktop**: viola el patrón. Desktop usa botones en el header de la lista.
2. **Multiple FABs en la misma pantalla**: uno solo. Si hay múltiples acciones, usar el OverflowMenu o un Sheet.
3. **Label visible en mobile**: el FAB es icon-only en mobile. El label es sr-only.
4. **`background: var(--accent-warm)` o cualquier color que no sea `--accent`**: el FAB es la acción primaria de marca. Solo `--accent`.
5. **`color: white` hardcodeado**: usar `var(--text-on-accent)` que en dark es oscuro.
6. **`z-index` arbitrario**: usar `--z-fab` (38 — entre `--z-mascot` y `--z-popover`).

## Ejemplos de uso

```tsx
// En AppShellLayout, pasando la acción determinada por la ruta
const fabAction = getFabAction(pathname, locale);
<FAB action={fabAction} position="fixed" />;

// Helper puro para determinar la acción por ruta
function getFabAction(pathname: string, locale: string): FabAction | null {
  if (pathname.includes("/settings")) return null;
  if (pathname.includes("/orders/") && pathname.includes("/")) {
    return { href: `/${locale}/deliveries/new`, label: t("fab.newDelivery"), icon: Package };
  }
  if (pathname.includes("/deliveries")) {
    return { href: `/${locale}/deliveries/new`, label: t("fab.newDelivery"), icon: Package };
  }
  if (pathname.includes("/stores")) {
    return { href: `/${locale}/stores/new`, label: t("fab.addStore"), icon: Store };
  }
  return { href: `/${locale}/orders/new`, label: t("fab.newOrder"), icon: ShoppingBag };
}
```

## Tokens consumidos

- `--accent` (background)
- `--text-on-accent` (color del ícono — crítico: oscuro en dark)
- `--elevation-2` (box-shadow)
- `--radius-pill`
- `--fab-size` (3.5rem = 56px)
- `--fab-offset` (1rem = 16px)
- `--focus-ring`
- `--motion-fast`, `--ease-emphasis`
- `--state-hover-mix`, `--state-pressed-mix`

## ADRs aplicables

- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md): D6 (acciones destructivas en overflow `[···]` del header, no en el FAB — el FAB es solo para acción primaria de creación).

## Dependencias

- Lucide icons: `shopping-bag`, `package`, `store`, `loader-2`
- `ROUTES` de `src/lib/constants.ts` para los hrefs de las acciones

## Notas para S5 (implementación)

1. Implementar como `src/components/core/FAB.tsx` — es un atom de presentación con lógica minimal.
2. El helper `getFabAction` debe vivir en `src/app/[locale]/(app)/_utils/fabAction.ts` (lógica de shell, no del componente).
3. El `--z-fab` necesita ser agregado a `globals.css` en la escala de z-index. Propuesta: valor `38` (entre `--z-mascot: 35` y `--z-popover: 40`).
4. En S11 (motion), se puede agregar una animación de entrada suave al FAB. Por ahora sin animación de montaje.
