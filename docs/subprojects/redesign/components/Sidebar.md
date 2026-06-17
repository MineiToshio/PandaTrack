---
title: Sidebar
tier: 3
status: spec — S5 (ready for implementation)
last_updated: 2026-05-02
session: 05-app-shell
adrs:
  - ADR 0003 D3 (sidebar: logo top / nav medio / user bottom; collapse + push; hover-expand FLOAT)
---

# Sidebar

## Propósito

Navegación principal del shell `(app)` en desktop (`≥ --breakpoint-lg`). Estructura vertical: **logo top → nav links medio → user widget bottom**. Colapsable entre 240px (expanded) y 64px (collapsed). Hover sobre el collapsed abre una expansión en modo **flotante** (float overlay): el sidebar se expande sobre el contenido sin desplazarlo. Solo el toggle manual (botón colapsar/expandir) crea un desplazamiento real del contenido (PUSH).

La persistencia del estado collapsed/expanded usa `localStorage["pandatrack-sidebar"]`. Default `"expanded"`.

En mobile (`< --breakpoint-lg`) el Sidebar no se monta — la navegación la provee el `<AppNavDrawer>` (drawer lateral abierto con el burger del topbar).

## API TypeScript

```ts
type SidebarProps = {
  /** Locale activo. Para generar hrefs de nav. */
  locale: string;
  /** Usuario autenticado. Para el user widget del footer. */
  currentUser: AppShellUserIdentity;
  /** Label de cierre de sesión. Viene de i18n del layout server. */
  signOutLabel: string;
  /** Estado expanded/collapsed actual. */
  expanded: boolean;
  /** Callback toggle. */
  onToggle: () => void;
  /** Href de tiendas con preference filters aplicados (puede tener query params). */
  storesHref?: string;
};

type AppShellUserIdentity = {
  username: string;
  name: string | null;
  image: string | null;
};
```

El estado `expanded` lo gestiona el `useSidebarState` hook (persistencia en `localStorage`).

## Variantes de estado del sidebar

El sidebar tiene 3 estados operativos:

| Estado           | Ancho                          | Descripción                                                                                          |
| ---------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `expanded`       | `--sidebar-w-expanded` (240px) | Logo + nombre, nav links con texto, user widget completo, botón "Colapsar".                          |
| `collapsed`      | `--sidebar-w-collapsed` (64px) | Solo íconos de nav + logo "P" + avatar del user. Hover → hover-expanded.                             |
| `hover-expanded` | `--sidebar-w-expanded` (240px) | Visible sobre collapsed al hacer hover. FLOAT — el sidebar flota sobre el contenido sin desplazarlo. |

## Layout del sidebar

```
┌──────────────────────┐  ← HEADER: Logo / "P"
├──────────────────────┤
│  LayoutDashboard "Hoy"│  ← NAV: 4 destinos primarios
│  ShoppingBag "Pedidos"│    (Hoy, Pedidos, Entregas, Tiendas)
│  Package "Entregas"   │
│  Store "Tiendas"      │
│  Settings "Ajustes"   │
├──────────────────────┤
│  [Avatar] Sergio M.   │  ← FOOTER: User widget
│  sergio@email.com     │    + chev-menu + botón colapsar
└──────────────────────┘
```

5 destinos de nav (los 4 primarios + Settings). Settings aparece en el nav del sidebar.

## Estados visuales

### Container del sidebar

```css
.sidebar {
  position: fixed;
  left: 0;
  top: var(--app-banner-offset, 0px);
  height: calc(100vh - var(--app-banner-offset, 0px));
  width: var(--sidebar-w-expanded); /* o --sidebar-w-collapsed */
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  z-index: var(--z-sidebar); /* 20 */
  transition: width var(--motion-base) var(--ease-out-expressive);
}
@media (prefers-reduced-motion: reduce) {
  .sidebar {
    transition: none;
  }
}
/* Solo visible en lg+ */
@media (max-width: 63.99rem) {
  .sidebar {
    display: none;
  }
}
```

### Header del sidebar (logo zone)

Altura igual al header horizontal (`--header-h-desktop` = 4rem) para alineación visual perfecta.

```css
.sidebar-logo-zone {
  height: var(--header-h-desktop);
  display: flex;
  align-items: center;
  padding: 0 var(--space-4);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
```

- **Expanded**: `<Logo>` con nombre completo "PandaTrack" + ícono a la izquierda.
- **Collapsed**: Solo `<Image src="/icon.svg" width={32} height={32}>` centrado.

### Nav link (idle)

```css
.nav-link {
  display: flex;
  align-items: center;
  height: 2.5rem; /* 40px — tap target desktop OK */
  padding: 0 var(--space-3);
  gap: var(--space-3);
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
  font-size: var(--text-body);
  font-weight: var(--font-weight-regular);
  text-decoration: none;
  transition:
    color var(--motion-fast) var(--ease-emphasis),
    background-color var(--motion-fast) var(--ease-emphasis);
}
```

### Nav link (active)

```css
.nav-link--active {
  background: color-mix(in oklch, var(--accent) 14%, var(--surface));
  color: var(--accent);
  font-weight: var(--font-weight-medium-body);
}
```

### Nav link (hover)

```css
.nav-link:hover:not(.nav-link--active) {
  background: color-mix(in oklch, var(--text-primary) 6%, transparent);
  color: var(--text-primary);
}
```

### Nav link collapsed (solo ícono)

En estado collapsed: `gap: 0; padding: 0; justify-content: center; width: 100%; height: 2.5rem`. El texto del label se oculta (`overflow: hidden; width: 0`). Tooltip al hover con el label del destino.

### User widget (footer) — expanded

```
┌────────────────────────────┐
│ [Avatar 32px]  Sergio M.  ›│  ← avatar + nombre truncado + chevron-down (menú)
│                s@email.com │    email truncado, text-muted
├────────────────────────────┤
│ [PanelLeftClose] Colapsar  │  ← botón collapse
└────────────────────────────┘
```

User widget: `<ShellAccountMenu>` existente compone aquí. El chevron abre el dropdown de cuenta (sign out, settings, etc.).

### User widget (footer) — collapsed

Solo `<Avatar>` del usuario (32px) centrado + `<IconButton>` PanelLeftOpen (expand).

### Hover-expand (sobre collapsed)

Cuando el sidebar está collapsed y el usuario hace hover:

1. El sidebar anima su ancho a `--sidebar-w-expanded` como **overlay flotante** (`z-40`, `shadow-[var(--elevation-3)]`).
2. El contenido principal **no se mueve** — `--sidebar-current-w` permanece en `--sidebar-w-collapsed`.
3. El contenido expandido es idéntico al estado `expanded` normal.
4. Al quitar el hover (y sin focus dentro), vuelve a collapsed.

El estado `floatingOpen` es transient y no persiste en `localStorage`. Solo el toggle manual persiste y desplaza el contenido.

## Mobile vs desktop

| Aspecto         | Mobile (`< --breakpoint-lg`) | Desktop (`≥ --breakpoint-lg`)                                   |
| --------------- | ---------------------------- | --------------------------------------------------------------- |
| Visibilidad     | Oculto (`display: none`)     | Visible siempre                                                 |
| Estado inicial  | N/A                          | `localStorage["pandatrack-sidebar"]` o `"expanded"` por defecto |
| Hover-expand    | N/A                          | Disponible cuando collapsed                                     |
| Collapse toggle | N/A                          | Botón en el footer del sidebar                                  |

## Accesibilidad

- `<aside aria-label={t("accessibility.primarySidebar")}>` — landmark semántico.
- Nav: `<nav aria-label={t("accessibility.mainNavigation")}>` dentro del aside.
- Nav links: `<a aria-current={isActive ? "page" : undefined}>`.
- Collapsed → label sr-only en cada link (el texto visual está oculto, pero necesita ser leído por SR cuando el sidebar está collapsed).
- Hover-expand: cuando el sidebar se expande por hover, el foco ya está dentro (o no); no se roba foco automáticamente.
- Botón collapse: `aria-label={expanded ? t("sidebar.collapse") : t("sidebar.expand")}`.
- Cuando el sidebar colapsa con foco dentro: mover el foco al primer nav link del sidebar collapsed, o al main content. Evitar foco atrapado.
- `prefers-reduced-motion`: sin transición de ancho (cambio instantáneo).

## Motion

| Qué                   | Token de duración | Token de easing         | Notas                              |
| --------------------- | ----------------- | ----------------------- | ---------------------------------- |
| Ancho expand/collapse | `--motion-base`   | `--ease-out-expressive` | Transición del grid col del shell. |
| Hover-expand          | `--motion-base`   | `--ease-out-expressive` | Mismo timing que el toggle manual. |
| Nav link state layers | `--motion-fast`   | `--ease-emphasis`       | Hover/active colors.               |
| Ícono colapsar rotate | `--motion-fast`   | `--ease-emphasis`       | `PanelLeftClose ↔ PanelLeftOpen`.  |
| Reduce-motion         | Instantáneo (0ms) | N/A                     | Sin transición de ancho.           |

Note: ADR 0003 D3 especifica 220ms para el push; la recomendación de gaps S4 (G7) sugiere reusar `--motion-base` (280ms) por simplicidad. **Se adopta `--motion-base`** (280ms) — diferencia de 60ms imperceptible. Si en validación humana S5 el humano lo nota, crear `--motion-shell-push: 220ms`.

## Copy default + i18n

| Clave i18n                               | Valor ES                  |
| ---------------------------------------- | ------------------------- |
| `appLayout.sidebar.collapse`             | "Colapsar"                |
| `appLayout.sidebar.expand`               | "Expandir"                |
| `appLayout.nav.dashboard`                | "Hoy"                     |
| `appLayout.nav.purchases`                | "Pedidos"                 |
| `appLayout.nav.deliveries`               | "Entregas"                |
| `appLayout.nav.stores`                   | "Tiendas"                 |
| `appLayout.nav.settings`                 | "Ajustes"                 |
| `appLayout.accessibility.primarySidebar` | "Barra lateral principal" |
| `appLayout.accessibility.mainNavigation` | "Navegación principal"    |

Los keys existentes en el namespace `appLayout` se preservan. Agregar `accessibility.primarySidebar` que es nuevo.

## Edge cases

1. **`localStorage` no disponible** (modo incógnito estricto): caer a `"expanded"` como default. Sin error.
2. **Foco dentro del sidebar al colapsar**: si el usuario tiene foco en un nav link y clickea "Colapsar", el sidebar colapsa y el foco va al botón "Expandir" (que ahora es visible en el collapsed rail).
3. **Hover durante resize de ventana**: si la ventana se achica a `< --breakpoint-lg`, el sidebar se oculta. El estado `floatingOpen` se debe resetear.
4. **Sidebar expanded + window muy angosta** (1024-1100px): el contenido principal puede quedar muy angosto. Aceptable — el usuario puede colapsar el sidebar. No hay min-width del contenido principal garantizado en este rango.
5. **Navigation mientras hover-expanded**: si el usuario hace click en un nav link mientras está en hover-expand, la navegación ocurre y el hover-expand vuelve a collapsed normalmente.
6. **`--app-banner-offset`**: el sidebar debe considerar el banner al calcular su `top`. Ya manejado con `top: var(--app-banner-offset, 0px)`.

## Anti-patrones

1. **Float en el toggle manual**: el toggle colapsar/expandir siempre debe ser PUSH (desplaza el contenido). El float solo es correcto para el hover-expand transient.
2. **`opacity: 0` para el texto en collapsed**: en lugar de opacity, usar `width: 0; overflow: hidden` para ocultar el texto. La opacity rompe la regla universal (no opacity para disable).
3. **Avatar en el header del sidebar**: el avatar del usuario vive en el footer del sidebar. El header del sidebar es solo logo.
4. **Sidebar en mobile**: ocultar con `max-lg:hidden`, no renderizar condicionalmente.
5. **`position: sticky` en lugar de `position: fixed`**: el sidebar debe mantenerse fijo durante el scroll del contenido principal.
6. **`z-index: 9999`**: usar `var(--z-sidebar)` = 20.

## Ejemplos de uso

```tsx
// En AppShell (layout.tsx del (app))
const { expanded, toggle } = useSidebarState();

<Sidebar
  locale={locale}
  currentUser={currentUser}
  signOutLabel={signOutLabel}
  expanded={expanded}
  onToggle={toggle}
  storesHref={storesHref}
/>;
```

## Tokens consumidos

- `--surface` (background)
- `--border` (border-right + border-bottom logo zone)
- `--sidebar-w-expanded` (15rem = 240px)
- `--sidebar-w-collapsed` (4rem = 64px)
- `--header-h-desktop` (4rem — altura de la logo zone para alineación)
- `--accent` (nav active bg via color-mix 14% + color)
- `--text-primary`, `--text-secondary`, `--text-muted`
- `--font-weight-regular`, `--font-weight-medium-body`
- `--text-body`
- `--radius-lg` (nav links)
- `--space-3`, `--space-4` (padding/gap)
- `--z-sidebar` (20)
- `--motion-base`, `--ease-out-expressive` (ancho transition)
- `--motion-fast`, `--ease-emphasis` (state layers)
- `--state-hover-mix`
- `--breakpoint-lg`

## ADRs aplicables

- [ADR 0003 — Demo decisions](../decisions/0003-demo-decisions.md): D3 (sidebar: logo top + nav medio + user bottom; collapse 240px ↔ 64px; hover-expand PUSH; persistencia `localStorage["pandatrack-sidebar"]`).

## Dependencias

- `<Logo>` — expanded header
- `<Avatar>` — user widget collapsed
- `<ShellAccountMenu>` — user widget expanded (dropdown de cuenta)
- `<Tooltip>` — labels de nav links en collapsed
- Lucide icons: `layout-dashboard`, `shopping-bag`, `package`, `store`, `settings`, `panel-left-close`, `panel-left-open`
- `useSidebarState` hook — gestión del estado con localStorage
- `POSTHOG_EVENTS.APP_SHELL.SIDEBAR_TOGGLED` + `NAV_CLICKED`

## Notas para S5 (implementación)

1. Implementar como `src/components/modules/Sidebar/Sidebar.tsx`. El `<AppSidebar>` existente en `_components/AppLayout/AppSidebar.tsx` se reemplaza o se refactoriza para consumir los nuevos tokens Velvet.
2. `useSidebarState` hook: mover a `src/hooks/useSidebarState.ts` para compartir entre Sidebar y AppShell (que necesita conocer el ancho para calcular el margin-left del contenido).
3. La lógica de hover-expand existente (`floatingOpen` state en `AppSidebar.tsx`) es el patrón correcto — refinar para que sea PUSH real (grid column change) en lugar del overlay float actual.
4. Tests: collapse/expand state con mock de localStorage; hover-expand state; nav link active state por pathname.
5. PostHog: `SIDEBAR_TOGGLED` (state: expanded/collapsed) + `NAV_CLICKED` (destination, navigation_level, viewport: desktop).
