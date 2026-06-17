---
title: Header
tier: 3
status: spec — S5 (ready for implementation)
last_updated: 2026-05-02
session: 05-app-shell
adrs:
  - ADR 0003 D4 (header: breadcrumbs izq + lang + theme der, sin avatar)
---

# Header

## Propósito

Barra de navegación superior sticky del shell `(app)`. Estructura: **breadcrumbs (izquierda) + spacer + LangToggle + ThemeToggle (derecha)**. Sin avatar (el avatar vive en el footer del sidebar — ADR 0003 D4).

En mobile muestra un burger button a la izquierda que abre el `<AppNavDrawer>` (cajón de navegación lateral). Los toggles de lang/theme se muestran en desktop; en mobile solo se muestra el burger.

El header es sticky: queda fijo en la parte superior del área de contenido (a la derecha del sidebar en desktop) durante el scroll.

Altura: `--header-h` mobile (3.5rem = 56px), `--header-h-desktop` desktop (4rem = 64px).

## API TypeScript

```ts
type HeaderProps = {
  /** Locale activo. Para LangToggle. */
  locale: string;
  /** Pathname activo. Para Breadcrumbs. */
  pathname: string;
  /** Si el drawer móvil está abierto (para aria-expanded). */
  drawerOpen: boolean;
  /** Callback para abrir el drawer móvil. */
  onOpenDrawer: () => void;
  /** Ref del burger button para restaurar foco al cerrar el drawer. */
  burgerButtonRef: React.RefObject<HTMLButtonElement | null>;
};
```

El Header es Client Component (`"use client"`) porque necesita `useTranslations`, `usePathname` y los toggles de tema/lang que son interactivos.

## Variants / Sizes

Sin variants de presentación. Un solo layout responsivo.

## Estados visuales

### Container del header

```css
.header {
  position: sticky;
  top: var(--app-banner-offset, 0px); /* debajo del VerifyEmailBanner si activo */
  height: var(--header-h); /* 3.5rem mobile */
  z-index: var(--z-header); /* 30 */
  background: color-mix(in oklch, var(--background) 95%, transparent);
  /* backdrop-blur si el browser lo soporta: */
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 var(--space-4);
  gap: var(--space-3);
}
@media (min-width: 64rem) {
  /* lg = --breakpoint-lg */
  .header {
    height: var(--header-h-desktop); /* 4rem */
    padding: 0 var(--space-8);
  }
}
```

### Background backdrop

Light: `oklch(93% 0.020 285 / 0.95)` — translúcido sobre el lienzo plomo-violeta.
Dark: `oklch(10% 0.028 265 / 0.92)` — translúcido sobre azul-violeta nocturno.

El backdrop-blur crea el efecto frosted glass sin perder legibilidad.

### Burger button (solo mobile)

`<IconButton Icon={Menu} variant="ghost" size="sm" aria-label={t("drawer.openMenu")} aria-expanded={drawerOpen}>`. Se oculta en `lg:hidden`.

### Zona de breadcrumbs (izquierda)

Ocupa `flex: 1 1 0`. Contiene `<Breadcrumbs>`.

### Zona de controles (derecha)

Flex row con `gap: --space-2`. Contiene `<LangToggle variant="compact">` + `<ThemeToggle variant="compact">`. Visible solo en `lg:flex`, oculto en `hidden`.

## Mobile vs desktop

| Aspecto        | Mobile (`< --breakpoint-lg`)                        | Desktop (`≥ --breakpoint-lg`)      |
| -------------- | --------------------------------------------------- | ---------------------------------- |
| Altura         | `3.5rem` (`--header-h`)                             | `4rem` (`--header-h-desktop`)      |
| Contenido izq. | Burger button + breadcrumbs truncados               | Breadcrumbs completos (sin burger) |
| Contenido der. | Oculto (lang/theme se acceden desde drawer)         | LangToggle + ThemeToggle visibles  |
| Top sticky     | `var(--app-banner-offset, 0px)` (debajo del banner) | mismo                              |

## Accesibilidad

- `<header>` landmark semántico.
- Breadcrumbs: `<nav aria-label="Breadcrumbs">` internal.
- Burger: `aria-expanded={drawerOpen}` + `aria-controls="app-nav-drawer"` (id del drawer).
- Focus management: cuando el drawer se cierra, foco vuelve al burger button (via `burgerButtonRef`).
- Skip link: el shell debe renderizar `<a href="#main-content" className="skip-link">Saltar al contenido</a>` antes del header. No es responsabilidad del Header sino del AppShell.
- LangToggle + ThemeToggle: cada uno tiene `aria-label` per su spec.
- En mobile, los controles de tema/lang no están en el header pero sí en el drawer — el usuario puede acceder a ellos por keyboard a través del drawer.

## Motion

| Qué                                    | Token de duración  | Token de easing   | Notas                                                                                     |
| -------------------------------------- | ------------------ | ----------------- | ----------------------------------------------------------------------------------------- |
| Estado hover de controles              | `--motion-fast`    | `--ease-emphasis` | State layers de los buttons.                                                              |
| `top` cuando banner aparece/desaparece | N/A                | N/A               | El `--app-banner-offset` CSS var se actualiza por JS — sin transición (cambio de layout). |
| backdrop-blur                          | N/A (CSS property) | N/A               | Siempre activo.                                                                           |
| `prefers-reduced-motion`               | Sin cambios        | N/A               | No hay animaciones propias.                                                               |

## Copy default + i18n

Los strings del header vienen de `appLayout` (namespace ya existente). Claves usadas:

| Clave i18n                                     | Valor ES         |
| ---------------------------------------------- | ---------------- |
| `appLayout.drawer.openMenu`                    | "Abrir menú"     |
| `appLayout.accessibility.breadcrumbNavigation` | "Breadcrumbs"    |
| `appLayout.accessibility.languageNavigation`   | "Cambiar idioma" |

## Edge cases

1. **`--app-banner-offset` activo**: el header queda exactamente debajo del VerifyEmailBanner. El CSS var lo gestiona sin lógica extra.
2. **Scroll rápido hacia abajo**: el header queda fijo. No hay hide-on-scroll (el sidebar requiere que el header siempre sea visible para orientación).
3. **Breadcrumb con label dinámico** (nombre de tienda/pedido): el `<Breadcrumbs>` maneja el loading skeleton internamente.
4. **Drawer open en desktop** (resize de ventana): si el usuario abre el drawer en mobile y agranda la ventana a desktop, el drawer se debe cerrar (lógica del padre).
5. **Focus en burger cuando drawer está abierto**: el burger tiene `aria-expanded="true"`. Al cerrar el drawer, el foco vuelve al burger.

## Anti-patrones

1. **Avatar del usuario en el header**: prohibido por ADR 0003 D4. El avatar vive solo en el sidebar footer.
2. **Título de página en el header** (sin breadcrumbs): el patrón actual tiene `pageTitle` solo. El nuevo patrón es breadcrumbs jerárquicos. El título de la página (h1) vive en el contenido principal, no en el header.
3. **`position: fixed` en lugar de `sticky`**: con sticky, el header se mantiene dentro del flujo del layout y no necesita offset del sidebar.
4. **Hardcodear `56px` o `64px`**: usar `--header-h` y `--header-h-desktop`.
5. **LangToggle en mobile dentro del header**: provoca overflow en pantallas pequeñas. El patrón es moverlos al drawer.
6. **`z-index: 9999`**: usar `var(--z-header)` = 30.

## Ejemplos de uso

```tsx
// Dentro del AppShell (layout del (app))
<HeaderTitleProvider>
  <Header
    locale={locale}
    pathname={pathname}
    drawerOpen={drawerOpen}
    onOpenDrawer={() => setDrawerOpen(true)}
    burgerButtonRef={burgerButtonRef}
  />
  <main id="main-content">{children}</main>
</HeaderTitleProvider>
```

## Tokens consumidos

- `--background` (backdrop base)
- `--border` (border-bottom)
- `--z-header` (30)
- `--header-h` (3.5rem)
- `--header-h-desktop` (4rem)
- `--space-3`, `--space-4`, `--space-8` (gaps y paddings)
- `--breakpoint-lg` (media query)
- `--motion-fast`, `--ease-emphasis` (state layers de controles)

## ADRs aplicables

- [ADR 0003 — Demo decisions](../decisions/0003-demo-decisions.md): D4 (header: breadcrumbs izq + lang + theme der; sin avatar).

## Dependencias

- `<Breadcrumbs>` ([`Breadcrumbs.md`](./Breadcrumbs.md))
- `<LangToggle variant="compact">` ([`LangToggle.md`](./LangToggle.md))
- `<ThemeToggle variant="compact">` ([`ThemeToggle.md`](./ThemeToggle.md))
- `<IconButton>` — burger button
- `<AppNavDrawer>` — drawer móvil (componente del shell, no en catálogo S4)
- Lucide icons: `menu`
- `HeaderTitleProvider` / `useHeaderTitle` — context para overrides de breadcrumbs por página

## Notas para S5 (implementación)

1. Implementar como `src/components/modules/Header/Header.tsx`. Es Client Component (`"use client"`) por los toggles interactivos.
2. El `<ContentHeader>` existente en `src/app/[locale]/(app)/_components/AppLayout/ContentHeader.tsx` se reemplaza con este. Migrar o eliminar el legacy después de repuntear consumidores.
3. El `HeaderTitleContext` existente en `HeaderTitleContext.tsx` se puede reusar — expone un override para el breadcrumb dinámico por página.
4. Los LangToggle y ThemeToggle actuales importan desde `src/app/[locale]/(landing)/` — esto es un violation de project-structure. En S5 se crean en `src/components/core/` y se consume desde ahí.
5. El `<AppNavDrawer>` (drawer mobile) puede mantenerse como está o migrarse — su scope está dentro del shell pero no es uno de los 12 organismos especificados en S5.
