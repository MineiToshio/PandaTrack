---
title: AppShell
tier: 3
status: spec — S5 (ready for implementation)
last_updated: 2026-05-02
session: 05-app-shell
adrs:
  - ADR 0003 D3 (sidebar PUSH — manual toggle; hover-expand FLOAT overlay)
  - ADR 0003 D4 (header: breadcrumbs + lang + theme; sin avatar)
  - ADR 0001 D5 (view-transition-name: order-{humanId})
---

# AppShell

## Propósito

Orquestador del layout privado `(app)`. Combina todos los organismos del shell en una estructura coherente: `<VerifyEmailBanner>` (condicional) → `<Sidebar>` (fixed desktop) → `<Header>` (sticky) → `<main>` → `<MascotBubble>` (fixed global).

Define dos modos de expansión del sidebar:

- **PUSH (toggle manual)**: cuando el usuario expande/colapsa manualmente con el botón, el contenido principal se desplaza mediante `padding-left` animado.
- **FLOAT (hover-expand)**: cuando el sidebar está collapsed y el usuario hace hover, se expande como overlay flotante (`z-40`, sombra `--elevation-3`) sin desplazar el contenido.

El AppShell se divide en dos capas:

1. **`AppShellLayout` (Client Component)** — gestiona el estado del sidebar, emite los CSS vars, orquesta los 12 organismos.
2. **`src/app/[locale]/(app)/layout.tsx` (Server Component)** — fetches datos del usuario y del estado de verificación, pasa props al `AppShellLayout`.

## API TypeScript

```ts
type AppShellLayoutProps = {
  /** Locale activo. */
  locale: string;
  /** Pathname activo. Proviene del server layout. */
  pathname: string;
  /** Identidad del usuario autenticado. */
  currentUser: AppShellUserIdentity;
  /** Label de cierre de sesión (i18n del server). */
  signOutLabel: string;
  /** Href de tiendas con preference filters aplicados. */
  storesHref?: string;
  /** Mostrar el banner de verificación de email. */
  showVerifyBanner: boolean;
  /** Props del banner (todas las strings i18n pre-resueltas). */
  verifyBannerProps?: VerifyBannerPassedProps;
  /** Contenido de las páginas. */
  children: React.ReactNode;
};

type AppShellUserIdentity = {
  username: string;
  name: string | null;
  image: string | null;
};

type VerifyBannerPassedProps = {
  locale: string;
  returnTo: string;
  daysRemaining?: number;
  title: string;
  description: string;
  resendLabel: string;
  resendPendingLabel: string;
  resendSuccess: string;
  resendError: string;
};
```

## Estructura visual del shell

```
┌─ VerifyEmailBanner (top, full-width, height 3rem si activo) ───────────┐
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ SIDEBAR (fixed, left)        │ HEADER (sticky)                  │   │
│  │ 240px expanded / 64px colp.  │ breadcrumbs  [lang] [theme]      │   │
│  │─────────────────────────────│──────────────────────────────────│   │
│  │                              │ MAIN CONTENT                     │   │
│  │  logo                        │ <main id="main-content">         │   │
│  │  nav links                   │   {children}                     │   │
│  │                              │                                  │   │
│  │  user widget                 │                                  │   │
│  └──────────────────────────────┘──────────────────────────────────┘   │
│                                                                         │
│  [FAB fixed bottom-right — solo mobile]                                 │
│  [MascotBubble fixed bottom-right — todas las pantallas]                │
└─────────────────────────────────────────────────────────────────────────┘
```

## Mecanismo PUSH

El sidebar es `position: fixed`. El contenido (header + main) se mueve hacia la derecha mediante `padding-left` animado en el wrapper del contenido:

```css
.app-shell-content {
  padding-left: var(--sidebar-current-w);
  transition: padding-left var(--motion-base) var(--ease-out-expressive);
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}

@media (max-width: 63.99rem) {
  .app-shell-content {
    padding-left: 0; /* sin sidebar en mobile */
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-shell-content {
    transition: none;
  }
}
```

`--sidebar-current-w` es una CSS custom property inyectada inline por `AppShellLayout` según el estado del sidebar:

| Estado del sidebar | `--sidebar-current-w`        | Nota                                               |
| ------------------ | ---------------------------- | -------------------------------------------------- |
| `expanded`         | `var(--sidebar-w-expanded)`  | PUSH — el contenido se desplaza                    |
| `collapsed`        | `var(--sidebar-w-collapsed)` | —                                                  |
| `hover-expanded`   | `var(--sidebar-w-collapsed)` | FLOAT — el sidebar flota, el contenido no se mueve |

El componente `AppShellLayout` la emite vía React `style` prop:

```tsx
<div
  className="app-shell-content"
  style={{
    "--sidebar-current-w": sidebarCurrentWidth,
  } as React.CSSProperties}
>
```

Donde `sidebarCurrentWidth` se deriva de:

```ts
// Solo el toggle manual (expanded) desplaza el contenido.
// El hover-expand (floatingOpen) flota sobre el contenido — no cambia este var.
const sidebarCurrentWidth = expanded ? "var(--sidebar-w-expanded)" : "var(--sidebar-w-collapsed)";
```

## Estados del AppShell

```
expanded ──(toggle)──→ collapsed
collapsed ──(toggle)──→ expanded
collapsed ──(hover in)──→ hover-expanded
hover-expanded ──(hover out)──→ collapsed
```

Los estados `expanded` y `collapsed` persisten en `localStorage["pandatrack-sidebar"]`. El estado `hover-expanded` es transient (solo mientras dure el hover).

## Skip link y ARIA landmarks

Antes del header, el AppShell renderiza un skip link visible al foco:

```tsx
<a href="#main-content" className="skip-link">
  {t("accessibility.skipToContent")}
</a>
```

```css
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: var(--accent);
  color: var(--text-on-accent);
  padding: var(--space-2) var(--space-4);
  z-index: 100;
  border-radius: 0 0 var(--radius-md) 0;
  transition: top var(--motion-fast) var(--ease-emphasis);
}
.skip-link:focus {
  top: 0;
}
```

Landmarks ARIA del shell:

| Elemento                   | Rol ARIA        | Label accesible                           |
| -------------------------- | --------------- | ----------------------------------------- |
| `<aside>` (Sidebar)        | `complementary` | `aria-label={t("sidebar.ariaLabel")}`     |
| `<nav>` dentro del Sidebar | `navigation`    | `aria-label={t("nav.ariaLabel")}`         |
| `<header>`                 | `banner`        | (landmark nativo)                         |
| `<nav>` (Breadcrumbs)      | `navigation`    | `aria-label={t("breadcrumbs.ariaLabel")}` |
| `<main id="main-content">` | `main`          | (landmark nativo)                         |

## CSS variables requeridas en globals.css

Las siguientes CSS vars son **nuevas** (aún no en globals.css) y deben agregarse en S5:

| Token     | Valor | Descripción                                    |
| --------- | ----- | ---------------------------------------------- |
| `--z-fab` | `38`  | Z-index del FAB (entre mascot=35 y popover=40) |

Las siguientes ya existen y se reutilizan:

| Token                   | Valor    |
| ----------------------- | -------- |
| `--sidebar-w-expanded`  | `15rem`  |
| `--sidebar-w-collapsed` | `4rem`   |
| `--header-h`            | `3.5rem` |
| `--header-h-desktop`    | `4rem`   |
| `--z-sidebar`           | `20`     |
| `--z-header`            | `30`     |
| `--z-mascot`            | `35`     |

## `--app-banner-offset`

Cuando el `<VerifyEmailBanner>` está activo, el layout inyecta `--app-banner-offset: 3rem` en el wrapper raíz. El sidebar (top: `var(--app-banner-offset)`) y el header (top: `var(--app-banner-offset)`) se desplazan hacia abajo automáticamente:

```tsx
<div
  style={{
    "--app-banner-offset": showVerifyBanner ? "3rem" : "0px",
  } as React.CSSProperties}
>
  {showVerifyBanner && <VerifyEmailBanner {...verifyBannerProps} />}
  <Sidebar top={showVerifyBanner ? "3rem" : "0px"} ... />
  <div className="app-shell-content">
    <Header ... />
    <main id="main-content">{children}</main>
  </div>
</div>
```

## Safe-area padding-bottom

En mobile, el contenido principal necesita `padding-bottom` para el safe area de iOS:

```tsx
<main
  id="main-content"
  className="lg:pb-0"
  style={{
    paddingBottom: "env(safe-area-inset-bottom, 0px)",
  }}
>
  {children}
</main>
```

En desktop (`lg+`) el padding se elimina con `lg:pb-0`.

## View-transition (ADR 0001 D5)

El AppShell no gestiona view-transitions directamente. Las transiciones de página las maneja Next.js App Router. Los elementos con `view-transition-name: order-{humanId}` se declaran en los componentes de las tarjetas/items — no en el shell.

El AppShell solo garantiza que el DOM container del shell no interfiera con las view-transitions (no `overflow: hidden` en el wrapper principal, no `will-change` genérico).

## Mobile vs desktop

| Aspecto                | Mobile (`< --breakpoint-lg`)               | Desktop (`≥ --breakpoint-lg`)              |
| ---------------------- | ------------------------------------------ | ------------------------------------------ |
| Sidebar                | No montado (`lg:hidden`)                   | Montado, expanded/collapsed/hover-expanded |
| Header                 | Visible, muestra burger button             | Visible, muestra breadcrumbs + lang/theme  |
| content `padding-left` | 0                                          | `var(--sidebar-current-w)` con transición  |
| FAB                    | Visible (fixed bottom-right)               | No renderizado                             |
| MascotBubble           | Visible (bubble, esquina inferior derecha) | Visible (bubble, esquina inferior derecha) |

## Accesibilidad

- Skip link antes del `<header>` — visible al foco teclado.
- Foco después de colapsar sidebar: si el foco estaba en un nav link del sidebar, moverlo al botón "Expandir" del sidebar collapsed.
- `prefers-reduced-motion`: sin transición de `padding-left` (cambio instantáneo).
- Drawer mobile (`<AppNavDrawer>`): cuando se abre, atrapa el foco adentro. Al cerrar, foco vuelve al burger button.

## Motion

| Qué                                | Token de duración | Token de easing         | Notas                                            |
| ---------------------------------- | ----------------- | ----------------------- | ------------------------------------------------ |
| `padding-left` PUSH (toggle)       | `--motion-base`   | `--ease-out-expressive` | Sincronizado con ancho del sidebar.              |
| Hover-expand (ancho sidebar float) | `--motion-base`   | `--ease-out-expressive` | Mismo timing de ancho; el contenido no se mueve. |
| Reduce-motion                      | Instantáneo (0ms) | N/A                     | Sin transición de layout.                        |

## Copy default + i18n

| Clave i18n                                     | Valor ES                  |
| ---------------------------------------------- | ------------------------- |
| `appLayout.accessibility.skipToContent`        | "Saltar al contenido"     |
| `appLayout.accessibility.primarySidebar`       | "Barra lateral principal" |
| `appLayout.accessibility.mainNavigation`       | "Navegación principal"    |
| `appLayout.accessibility.breadcrumbNavigation` | "Breadcrumbs"             |

## Edge cases

1. **Resize de ventana de desktop a mobile con sidebar expanded**: el sidebar se oculta (`max-lg:hidden`), `padding-left` cae a 0. El estado `expanded` en `localStorage` se preserva para cuando vuelva a desktop.
2. **Hover-expand durante resize a mobile**: el evento `hover-expanded` → collapsed debe dispararse cuando `window.innerWidth < breakpoint-lg`.
3. **`localStorage` no disponible**: `useSidebarState` cae a `expanded` como default sin error.
4. **VerifyEmailBanner activo + sidebar hover-expand + mascota**: los tres elementos conviven usando sus z-index declarados (`--z-sidebar: 20`, `--z-header: 30`, `--z-mascot: 35`).
5. **Next.js navigation entre rutas**: el AppShell se monta una vez y los children cambian. El sidebar no se re-monta entre rutas.
6. **Theme flash on first load**: el inline script en `src/app/[locale]/layout.tsx` (ya existente) aplica `data-theme` antes de la hidratación. El AppShell no necesita manejar esto.

## Anti-patrones

1. **Float overlay en el toggle manual**: el toggle manual (colapsar/expandir) siempre debe ser PUSH — el contenido se desplaza. El float solo es correcto para el hover-expand transient.
2. **`position: absolute` en lugar de `fixed` para el sidebar**: el sidebar debe ser `fixed` para mantenerse fijo durante scroll del contenido.
3. **Inyectar el `--app-banner-offset` en `:root` vía JS global**: inyectarlo como `style` prop en el wrapper del AppShell para evitar side effects globales.
4. **Renderizar Sidebar en mobile**: ocultar con `max-lg:hidden`, no con renderizado condicional por JS (evita parpadeo).
5. **Gestionar el estado de rutas activas en el AppShell**: el estado de nav link activo lo gestiona cada `<NavLink>` internamente con `usePathname()`.

## Ejemplos de uso

```tsx
// src/app/[locale]/(app)/layout.tsx (Server Component)
export default async function AppLayout({ children, params }) {
  const { locale } = await params;
  const session = await getSession();
  const verification = await getVerificationState(session.user.id);
  const t = await getTranslations({ locale, namespace: "appLayout" });

  return (
    <AppShellLayout
      locale={locale}
      pathname={/* from headers */}
      currentUser={session.user}
      signOutLabel={t("signOut")}
      showVerifyBanner={verification.state === "grace"}
      verifyBannerProps={
        verification.state === "grace"
          ? {
              locale,
              returnTo: "...",
              daysRemaining: verification.daysRemaining,
              title: t("verificationBanner.title"),
              // ...
            }
          : undefined
      }
    >
      {children}
    </AppShellLayout>
  );
}
```

## Tokens consumidos

- `--sidebar-w-expanded` (15rem), `--sidebar-w-collapsed` (4rem)
- `--header-h` (3.5rem), `--header-h-desktop` (4rem)
- `--z-sidebar` (20), `--z-header` (30), `--z-mascot` (35), `--z-fab` (38)
- `--motion-base`, `--ease-out-expressive` (PUSH transition)
- `--motion-fast`, `--ease-emphasis` (skip link)
- `--accent`, `--text-on-accent` (skip link)
- `--breakpoint-lg`

## ADRs aplicables

- [ADR 0003 — Demo decisions](../decisions/0003-demo-decisions.md): D3 (sidebar PUSH; hover-expand PUSH; no float). D4 (header breadcrumbs+lang+theme).
- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md): D5 (view-transition-name en tarjetas — el AppShell no interfiere).

## Dependencias

- `<VerifyEmailBanner>` — condicional sobre children
- `<Sidebar>` — desktop nav
- `<Header>` — sticky header
- `<AppNavDrawer>` — mobile nav (burger drawer)
- `<FAB>` — acción principal mobile (fixed bottom-right)
- `<MascotBubble variant="idle">` — bubble global
- `useSidebarState` hook (`src/hooks/useSidebarState.ts`)
- `POSTHOG_EVENTS.APP_SHELL` — eventos del shell

## Notas para S5 (implementación)

1. Implementar como `src/components/modules/AppShell/AppShellLayout.tsx` — Client Component (`"use client"`).
2. El `src/app/[locale]/(app)/layout.tsx` existente se refactoriza para pasar props al nuevo `AppShellLayout`. La lógica de fetch de sesión y verificación permanece en el Server Component.
3. `useSidebarState` hook: mover a `src/hooks/useSidebarState.ts`. Debe exponer `{ expanded, toggle, floatingOpen, setFloatingOpen }`.
4. La lógica de hover-expand actual en `AppSidebar.tsx` (`floatingOpen` state) se preserva y refina: el `floatingOpen` debe disparar el cambio de `--sidebar-current-w` a `expanded`, creando el PUSH real en lugar del overlay flotante actual.
5. `ShellIdentityContext` y `ToastProvider` existentes se preservan y se componen dentro de `AppShellLayout`.
6. Agregar `--z-fab: 38` a `src/app/globals.css`.
7. Tests: PUSH transition cuando sidebar colapsa/expande; `--app-banner-offset` correcto cuando banner activo/inactivo; skip link visible al foco.
