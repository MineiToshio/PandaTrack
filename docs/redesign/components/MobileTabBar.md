---
title: MobileTabBar
tier: 3
status: spec — S5 (ready for implementation)
last_updated: 2026-05-02
session: 05-app-shell
adrs:
  - ADR 0003 D3 (sidebar estructura logo/nav/user — el TabBar es su equivalente mobile)
---

# MobileTabBar

## Propósito

Barra de navegación inferior para mobile (`< --breakpoint-md`). Reemplaza el sidebar en viewports pequeños. Muestra 4 destinos primarios de navegación más un `<FAB>` elevado en el centro. En desktop esta componente no se monta.

4 destinos primarios del tab bar:

| Posición | Destino   | Ícono Lucide       | Label              |
| -------- | --------- | ------------------ | ------------------ |
| 1 (izq)  | Dashboard | `layout-dashboard` | "Hoy"              |
| 2        | Pedidos   | `shopping-bag`     | "Pedidos"          |
| 3 (FAB)  | (acción)  | contextual         | aria-label del FAB |
| 4        | Tiendas   | `store`            | "Tiendas"          |
| 5 (der)  | Ajustes   | `settings`         | "Ajustes"          |

La posición 3 (centro) está reservada para el `<FAB>` elevado — no es un tab, es la acción principal flotante.

## API TypeScript

```ts
type MobileTabBarProps = {
  /** Locale activo para generar hrefs. */
  locale: string;
  /** Pathname activo (de usePathname). Para resaltar el tab activo. */
  pathname: string;
  /** Acción del FAB central. null = no muestra FAB (pero el espacio se reserva igualmente). */
  fabAction: import("./FAB").FabAction | null;
  /** Href de tiendas (puede tener preference filters). */
  storesHref?: string;
};
```

## Variants / Sizes

Sin variants. Una sola presentación. Altura fija `--mobile-tab-bar-h` (token a definir = `4rem` = 64px).

El FAB sobresale 28px sobre el borde superior del tab bar.

## Estados visuales

### Tab bar container

```css
.mobile-tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: var(--mobile-tab-bar-h); /* 4rem = 64px */
  background: var(--surface);
  border-top: 1px solid var(--border);
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr 1fr; /* 5 slots: tab tab FAB-slot tab tab */
  align-items: center;
  z-index: var(--z-header); /* mismo nivel que header */
  padding-bottom: env(safe-area-inset-bottom, 0px); /* iOS safe area */
}
```

### Tab item idle (sin active)

```css
.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-0_5);
  padding: var(--space-2) var(--space-1);
  color: var(--text-muted);
  min-height: 44px;
  min-width: 44px;
}
.tab-item__icon {
  width: 1.25rem;
  height: 1.25rem;
}
.tab-item__label {
  font-size: var(--text-caption);
  font-weight: var(--font-weight-regular);
}
```

### Tab item active

```css
.tab-item--active {
  color: var(--accent);
}
.tab-item--active .tab-item__icon {
  color: var(--accent);
}
.tab-item--active .tab-item__label {
  font-weight: var(--font-weight-medium-body);
}
```

El indicador activo es solo el cambio de color (no dot, no underline, no background). Patrón Material 3 / iOS tab bar — limpio y sin fricciones visuales.

### Tab item hover/pressed (touch)

No hay hover en mobile. En pressed: overlay `color-mix(in oklch, var(--text-primary) 8%, transparent)` via `::after` durante el tap (`:active`).

### Slot del FAB (posición 3)

```css
.tab-fab-slot {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 0; /* el FAB sale del tab bar hacia arriba */
}
/* El FAB se posiciona con transform: translateY(-28px) para elevarse */
```

### Light vs dark

- Light: `--surface` es `oklch(96.5% 0.014 285)` — blanco crema violeta.
- Dark: `--surface` es `oklch(13% 0.028 265)` — azul-violeta profundo.
- Tab active: `--accent` cambia con el modo (violeta light / violeta vibrante dark).

## Mobile vs desktop

El componente **solo se renderiza en mobile** (`< --breakpoint-md`). El layout padre lo monta condicionalmente o lo oculta con `lg:hidden`.

En desktop, el `<Sidebar>` reemplaza la navegación.

## Accesibilidad

- `<nav role="tablist" aria-label={t("accessibility.mainNavigation")}>` wrapping.
- Cada tab: `<a role="tab" aria-selected={isActive} aria-label={label}>`. Usar `<a>` semántico (navegación), no `<button>`.
- El slot del FAB no tiene `role="tab"` — es distinto (acción, no navegación).
- `aria-current="page"` en el tab activo.
- Focus visible en cada tab.
- Safe-area-inset-bottom para iOS notch/home indicator.
- Los labels de texto son visibles (no solo ícono) — cumplen ADR 0006 (ícono siempre con label).

## Motion

- Cambio de tab activo: inmediato (sin transición del color — cambio de ruta via Next.js router).
- Pressed overlay: `--motion-fast` `--ease-emphasis`.
- Entrada del tab bar al montar: sin animación (aparece con el shell).
- `prefers-reduced-motion`: no hay animaciones en el tab bar base.

## Copy default + i18n

| Clave i18n sugerida                      | Valor ES               |
| ---------------------------------------- | ---------------------- |
| `appLayout.mobileTabBar.today`           | "Hoy"                  |
| `appLayout.mobileTabBar.orders`          | "Pedidos"              |
| `appLayout.mobileTabBar.stores`          | "Tiendas"              |
| `appLayout.mobileTabBar.settings`        | "Ajustes"              |
| `appLayout.accessibility.mainNavigation` | "Navegación principal" |

Los labels del tab bar usan el namespace `appLayout` (ya existe).

## Edge cases

1. **Safe area iOS**: el `padding-bottom: env(safe-area-inset-bottom)` es crítico para iPhones con home indicator.
2. **Pantalla muy estrecha** (320px): los 4 tabs + slot FAB siguen en la misma fila. Cada tab tiene `min-width: 44px`; en 320px total / 5 slots = 64px por slot — suficiente.
3. **Label largo** (ej. "Entregas" si se agregara): truncar con `overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 3.5rem`.
4. **FAB action = null**: el slot central queda vacío pero el grid mantiene su posición. Los otros 4 tabs se reparten el espacio normalmente (grid no colapsa).
5. **Navegación a ruta sin tab correspondiente** (ej. `/orders/new`): ningún tab queda activo. Normal.
6. **Cambio de locale**: los hrefs se regeneran con el nuevo locale. El componente recibe `locale` como prop.

## Anti-patrones

1. **TabBar en desktop**: solo mobile. Ocultar con `lg:hidden` o no montar en desktop.
2. **5 tabs sin FAB slot**: el patrón tiene 4 tabs + 1 slot FAB. No expandir a 5 tabs reales.
3. **Tab de "Ajustes" como FAB**: Ajustes no es la acción principal del usuario. El FAB es para crear/agregar.
4. **Label solo ícono sin texto**: los tabs tienen ícono + label. ADR 0006 aplica — siempre ícono con label visible.
5. **`position: sticky`**: debe ser `fixed` para que quede al fondo al hacer scroll.
6. **Z-index arbitrario**: usar `--z-header` (el tab bar tiene la misma importancia que el header — ambos son nav primaria).

## Ejemplos de uso

```tsx
// En AppShell (solo mobile)
<div className="lg:hidden">
  <MobileTabBar
    locale={locale}
    pathname={pathname}
    fabAction={getFabAction(pathname, locale)}
    storesHref={storesHref}
  />
</div>;
{
  /* Padding bottom para que el contenido no quede tapado */
}
<div style={{ paddingBottom: "calc(var(--mobile-tab-bar-h) + env(safe-area-inset-bottom, 0px))" }}>{children}</div>;
```

## Tokens consumidos

- `--surface` (background)
- `--border` (border-top)
- `--text-muted` (tab idle)
- `--accent` (tab active)
- `--font-weight-regular` (tab idle label)
- `--font-weight-medium-body` (tab active label)
- `--text-caption` (tamaño del label)
- `--space-0_5`, `--space-1`, `--space-2` (gaps y paddings)
- `--mobile-tab-bar-h` (altura — token a definir: `4rem`)
- `--z-header` (stacking)
- `--motion-fast`, `--ease-emphasis` (pressed state)
- `--state-pressed-mix`

## ADRs aplicables

- [ADR 0003 — Demo decisions](../decisions/0003-demo-decisions.md): D3 (sidebar estructura logo/nav/user — el MobileTabBar es el equivalente mobile de la navegación principal).

## Dependencias

- `<FAB>` ([`FAB.md`](./FAB.md)) — slot central elevado.
- Lucide icons: `layout-dashboard`, `shopping-bag`, `store`, `settings`.
- `getFabAction` helper (util del shell).
- `POSTHOG_EVENTS.APP_SHELL.NAV_CLICKED` para tracking de tabs.

## Notas para S5 (implementación)

1. Implementar como `src/components/modules/MobileTabBar/MobileTabBar.tsx`.
2. Token `--mobile-tab-bar-h` debe agregarse a `globals.css` (valor: `4rem`).
3. El contenido del main area necesita `padding-bottom` para que el último elemento no quede detrás del tab bar — esto lo gestiona el `<AppShell>` en mobile.
4. PostHog: instrumentar cada tab click con `POSTHOG_EVENTS.APP_SHELL.NAV_CLICKED` + `{ destination, navigation_level: "primary", viewport: "mobile" }`.
5. Tests: verificar que el tab activo se resalta correctamente por pathname; verificar que el FAB slot reserva espacio aunque `fabAction=null`.
