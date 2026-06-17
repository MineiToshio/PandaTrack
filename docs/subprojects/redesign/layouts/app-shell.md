---
title: App Shell Layout
session: 05-app-shell
last_updated: 2026-05-02
status: spec — S5 (ready for implementation)
---

# App Shell Layout

Documento de referencia maestro para el layout del shell privado `(app)`. Define la estructura de grid, los breakpoints, la escala de z-index, el mecanismo PUSH del sidebar, los landmarks ARIA, y el inventario de todos los tokens de layout del shell.

Los organismos individuales tienen su propia spec en `docs/redesign/components/`. Este documento es la fuente de verdad para las **relaciones estructurales** entre ellos.

## 1. Diagrama de áreas del shell

```
╔══════════════════════════════════════════════════════════════════════╗
║  VerifyEmailBanner  (full-width, height --verify-banner-h = 3rem)   ║
║  Visible solo cuando state="grace". Empuja todo hacia abajo.        ║
╠═══════════════════════╦══════════════════════════════════════════════╣
║                       ║  HEADER  (sticky, height --header-h-desktop)║
║  SIDEBAR              ║  breadcrumbs [flex:1] │ [lang] [theme]      ║
║  (fixed, lg+)         ╠══════════════════════════════════════════════╣
║                       ║                                              ║
║  ┌─────────────────┐  ║  MAIN CONTENT                                ║
║  │ logo zone       │  ║  <main id="main-content">                    ║
║  │─────────────────│  ║    {children / page content}                 ║
║  │ nav links       │  ║                                              ║
║  │─────────────────│  ║                                              ║
║  │ user widget     │  ║                                              ║
║  └─────────────────┘  ║                                              ║
╚══════════════════════════════════════════════════════════════════════╝
   [FAB]           fixed bottom-right  (solo mobile < lg)
   [MascotBubble]  fixed bottom-right  (todas las pantallas)
```

## 2. Comportamiento por breakpoint

| Breakpoint           | Sidebar | Header                         | FAB             | MascotBubble |
| -------------------- | ------- | ------------------------------ | --------------- | ------------ |
| `< --breakpoint-md`  | Oculto  | Burger + breadcrumbs truncados | Fixed btm-right | Bubble fixed |
| `--breakpoint-md–lg` | Oculto  | Burger + breadcrumbs           | Fixed btm-right | Bubble fixed |
| `≥ --breakpoint-lg`  | Visible | Breadcrumbs + lang + theme     | No render       | Bubble fixed |

El sidebar solo aparece en `≥ --breakpoint-lg`. Los tokens de breakpoint:

| Token              | Valor   |
| ------------------ | ------- |
| `--breakpoint-sm`  | `36rem` |
| `--breakpoint-md`  | `48rem` |
| `--breakpoint-lg`  | `64rem` |
| `--breakpoint-xl`  | `80rem` |
| `--breakpoint-2xl` | `96rem` |

## 3. Dimensiones del shell

| Token                   | Valor    | Uso                                                  |
| ----------------------- | -------- | ---------------------------------------------------- |
| `--sidebar-w-expanded`  | `15rem`  | Sidebar expanded (240px)                             |
| `--sidebar-w-collapsed` | `4rem`   | Sidebar collapsed (64px)                             |
| `--header-h`            | `3.5rem` | Altura del header mobile (56px)                      |
| `--header-h-desktop`    | `4rem`   | Altura del header desktop (64px) + logo zone sidebar |
| `--verify-banner-h`     | `3rem`   | Altura del VerifyEmailBanner (48px)                  |
| `--fab-size`            | `3.5rem` | Diámetro del FAB (56px)                              |

## 4. Mecanismo PUSH del sidebar

El sidebar es `position: fixed`. El contenido principal (header + main) se desplaza mediante `padding-left` animado en el contenedor de contenido. Esto garantiza que el sidebar **nunca cubra el contenido** (ADR 0003 D3 — prohibición explícita de overlay float).

### CSS variable `--sidebar-current-w`

`AppShellLayout` inyecta esta variable inline según el estado del sidebar:

```
expanded       → var(--sidebar-w-expanded)   = 15rem
collapsed      → var(--sidebar-w-collapsed)  = 4rem
hover-expanded → var(--sidebar-w-expanded)   = 15rem
```

### CSS del contenedor de contenido

```css
.app-shell-content {
  padding-left: var(--sidebar-current-w);
  transition: padding-left var(--motion-base) var(--ease-out-expressive);
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}

@media (max-width: 63.99rem) {
  /* < --breakpoint-lg */
  .app-shell-content {
    padding-left: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-shell-content {
    transition: none;
  }
}
```

### Timing del PUSH

| Token                   | Valor                             | Fuente                                                                                               |
| ----------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `--motion-base`         | 280ms                             | Token adoptado para el push (ADR 0003 D3 = 220ms, gap G7 resuelto: diferencia de 60ms imperceptible) |
| `--ease-out-expressive` | `cubic-bezier(0.05, 0.7, 0.1, 1)` | Deceleration natural                                                                                 |

Si en validación humana la diferencia de 60ms resulta perceptible, crear `--motion-shell-push: 220ms` y reemplazar `--motion-base` en este componente.

## 5. Mecanismo `--app-banner-offset`

El `<VerifyEmailBanner>` ocupa espacio **sobre** el header y el sidebar. Cuando está activo, el layout inyecta `--app-banner-offset: 3rem` en el wrapper raíz del AppShell.

Los elementos fijos del shell lo consumen:

| Elemento | CSS                                                     |
| -------- | ------------------------------------------------------- |
| Sidebar  | `top: var(--app-banner-offset, 0px);`                   |
|          | `height: calc(100dvh - var(--app-banner-offset, 0px));` |
| Header   | `top: var(--app-banner-offset, 0px);`                   |

El `AppShellLayout` emite este var como `style` prop en el wrapper raíz, no como variable global en `:root`:

```tsx
<div
  style={{
    "--app-banner-offset": showVerifyBanner ? "var(--verify-banner-h)" : "0px",
  } as React.CSSProperties}
>
```

Cuando el usuario cierra el banner (`sessionStorage` dismiss), el componente se desmonta y `--app-banner-offset` vuelve a `0px` inmediatamente (sin transición — cambio de layout).

## 6. Escala de z-index del shell

Todos los valores en `globals.css` bajo la sección `/* z-index scale */`:

| Token         | Valor | Elemento                                   |
| ------------- | ----- | ------------------------------------------ |
| `--z-sticky`  | 10    | Encabezados sticky de tablas/listas        |
| `--z-sidebar` | 20    | `<Sidebar>` (fixed desktop)                |
| `--z-header`  | 30    | `<Header>` sticky                          |
| `--z-mascot`  | 35    | `<MascotBubble>` bubble fixed              |
| `--z-fab`     | 38    | `<FAB>` (entre mascot y popover)           |
| `--z-popover` | 40    | `<DropdownMenu>`, `<Tooltip>`, `<Popover>` |
| `--z-sheet`   | 50    | `<Sheet>` (bottom sheet)                   |
| `--z-drawer`  | 50    | `<AppNavDrawer>` (mobile drawer)           |
| `--z-modal`   | 60    | `<Modal>` (dialog)                         |
| `--z-toast`   | 70    | `<Toast>` (notifications)                  |

Notas:

- `--z-fab` = 38 garantiza que el FAB quede encima del MascotBubble pero debajo de cualquier popover.
- Los overlays del sidebar hover-expand usan `--z-sidebar` (20) — nunca superan el header.

## 7. ARIA landmarks del shell

El AppShell produce la siguiente estructura de landmarks. Las páginas de contenido añaden sus propios landmarks (`<section>`, `<article>`, etc.) dentro del `<main>`.

```
<body>
  <a href="#main-content" class="skip-link">   ← skip link (a11y)

  [VerifyEmailBanner]                          ← role="status" aria-live="polite"

  <aside aria-label="Barra lateral principal"> ← complementary landmark (desktop)
    <nav aria-label="Navegación principal">    ← navigation landmark
  </aside>

  <header>                                     ← banner landmark
    <nav aria-label="Breadcrumbs">             ← navigation landmark (breadcrumbs)
  </header>

  <main id="main-content">                     ← main landmark
    {children}
  </main>

  <nav role="tablist" aria-label="...">        ← navigation landmark (mobile tab bar)

  [MascotBubble]                               ← aria-label en el sprite
</body>
```

### Skip link

```tsx
<a href="#main-content" className="skip-link">
  {t("accessibility.skipToContent")}
</a>
```

Visible solo al foco teclado. Se posiciona absolutamente fuera de la pantalla hasta `:focus`.

## 8. Mobile padding-bottom

En mobile, el contenido principal tiene `padding-bottom` para el safe area de iOS:

```
padding-bottom = env(safe-area-inset-bottom, 0px)
```

En desktop (`≥ lg`) este padding es 0.

## 9. Resumen de componentes por slot

| Slot del shell          | Componente          | Archivo destino                                        |
| ----------------------- | ------------------- | ------------------------------------------------------ |
| Orquestador             | `AppShellLayout`    | `src/components/modules/AppShell/AppShellLayout.tsx`   |
| Banner condicional      | `VerifyEmailBanner` | `src/components/modules/auth/VerifyEmailBanner.tsx`    |
| Navegación desktop      | `Sidebar`           | `src/components/modules/Sidebar/Sidebar.tsx`           |
| Header sticky           | `Header`            | `src/components/modules/Header/Header.tsx`             |
| Breadcrumbs             | `Breadcrumbs`       | `src/components/core/Breadcrumbs.tsx`                  |
| Lang toggle             | `LangToggle`        | `src/components/core/LangToggle.tsx`                   |
| Theme toggle            | `ThemeToggle`       | `src/components/core/ThemeToggle.tsx`                  |
| Navegación mobile       | `AppNavDrawer`      | `src/components/modules/AppNavDrawer/AppNavDrawer.tsx` |
| Acción principal mobile | `FAB`               | `src/components/core/FAB.tsx`                          |
| Mascota idle            | `MascotBubble`      | `src/components/modules/MascotBubble/MascotBubble.tsx` |
| Progress indicador      | `ProgressBar`       | `src/components/core/ProgressBar.tsx`                  |
| Paginación              | `Pagination`        | `src/components/core/Pagination.tsx`                   |

Hooks del shell:

| Hook                | Archivo destino                           |
| ------------------- | ----------------------------------------- |
| `useSidebarState`   | `src/hooks/useSidebarState.ts`            |
| `useLangNavigation` | `src/hooks/useLangNavigation.ts`          |
| `useTheme`          | (existente, verificar `src/lib/theme.ts`) |

Utils del shell:

| Helper               | Archivo destino                                    |
| -------------------- | -------------------------------------------------- |
| `getBreadcrumbItems` | `src/app/[locale]/(app)/_utils/breadcrumbItems.ts` |
| `getFabAction`       | `src/app/[locale]/(app)/_utils/fabAction.ts`       |

## 10. Tokens nuevos a agregar en globals.css (S5)

Los siguientes tokens **no existen aún** y deben agregarse en la sesión S5:

```css
/* Z-index scale (agregar entre --z-mascot y --z-popover) */
--z-fab: 38; /* FAB — entre mascot (35) y popover (40) */
```

## 11. Dependencias entre specs

```
AppShell
├── VerifyEmailBanner     (migración de tokens, legacy existe)
├── Sidebar
│   ├── Logo
│   ├── Avatar
│   ├── ShellAccountMenu  (ya existe, reusar)
│   ├── Tooltip           (ya existe)
│   └── useSidebarState   (nuevo hook)
├── Header
│   ├── Breadcrumbs       (nuevo)
│   ├── LangToggle        (nuevo — extraído de landing)
│   ├── ThemeToggle       (nuevo — extraído de landing)
│   └── IconButton        (ya existe)
├── AppNavDrawer          (mobile nav — burger drawer)
├── FAB                   (nuevo — fixed bottom-right mobile)
└── MascotBubble          (nuevo — idle variant solo S5)
```

Componentes **no** parte del shell pero usados en el contenido de página:

- `ProgressBar` — indicador de progreso en stepper, upload, etc.
- `Pagination` — al fondo de listas paginadas.

## 12. PostHog events del shell

Todos los eventos de shell van bajo `POSTHOG_EVENTS.APP_SHELL` en `src/lib/constants.ts`:

| Evento            | Cuándo                                       | Props                                         |
| ----------------- | -------------------------------------------- | --------------------------------------------- | -------------- |
| `SIDEBAR_TOGGLED` | Usuario clickea colapsar/expandir            | `{ state: "expanded"                          | "collapsed" }` |
| `NAV_CLICKED`     | Click en nav link del sidebar o AppNavDrawer | `{ destination, navigation_level, viewport }` |
| `THEME_CHANGED`   | Usuario cambia tema                          | `{ from, to, source }`                        |
| `LOCALE_CHANGED`  | Usuario cambia idioma                        | `{ from, to }`                                |
| `MASCOT_HIDDEN`   | Usuario oculta mascota desde menú contextual | (sin props extra)                             |
| `MASCOT_SHOWN`    | Usuario muestra mascota desde Settings       | (sin props extra)                             |

## ADRs que gobiernan este layout

- [ADR 0003 — Demo decisions](../decisions/0003-demo-decisions.md): D3 (sidebar PUSH), D4 (header breadcrumbs+lang+theme).
- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md): D5 (view-transition-name), D9 (pagination desktop classic / mobile load-more).
- [ADR 0006 — Color blindness icon-label contract](../decisions/0006-color-blindness-icon-label-contract.md): los nav links del sidebar y el AppNavDrawer siempre muestran ícono + label visible.

## Specs de componentes del shell

| Componente        | Spec                                                                       |
| ----------------- | -------------------------------------------------------------------------- |
| AppShell          | [`../components/AppShell.md`](../components/AppShell.md)                   |
| Sidebar           | [`../components/Sidebar.md`](../components/Sidebar.md)                     |
| Header            | [`../components/Header.md`](../components/Header.md)                       |
| Breadcrumbs       | [`../components/Breadcrumbs.md`](../components/Breadcrumbs.md)             |
| ThemeToggle       | [`../components/ThemeToggle.md`](../components/ThemeToggle.md)             |
| LangToggle        | [`../components/LangToggle.md`](../components/LangToggle.md)               |
| AppNavDrawer      | [`../components/AppNavDrawer.md`](../components/AppNavDrawer.md)           |
| FAB               | [`../components/FAB.md`](../components/FAB.md)                             |
| VerifyEmailBanner | [`../components/VerifyEmailBanner.md`](../components/VerifyEmailBanner.md) |
| MascotBubble      | [`../components/MascotBubble.md`](../components/MascotBubble.md)           |
| ProgressBar       | [`../components/ProgressBar.md`](../components/ProgressBar.md)             |
| Pagination        | [`../components/Pagination.md`](../components/Pagination.md)               |
