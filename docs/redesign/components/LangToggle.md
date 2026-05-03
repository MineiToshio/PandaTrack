---
title: LangToggle
tier: 3
status: spec — S5 (ready for implementation)
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0003 D4 (header con breadcrumbs + lang + theme)
---

# LangToggle

## Propósito

Control para alternar entre los locales soportados (`es` y `en`). Aparece en variant `compact` en el header del shell `(app)` (ADR 0003 D4, junto a [`Breadcrumbs`](./Breadcrumbs.md) y [`ThemeToggle`](./ThemeToggle.md)) y opcionalmente en variant `full` en [`screens/settings.md`](../screens/settings.md) → preferences. La persistencia se gobierna por path-based locale routing de next-intl: cambiar el idioma navega a `/{newLang}/...` con la misma path. No usa `localStorage` propio — el routing es la fuente de verdad.

## API TypeScript

```ts
type LangValue = "es" | "en";

type LangToggleProps = {
  /**
   * `compact` (default `compact`): pill 2 letras `ES`/`EN` con chevron-down 12px, o IconButton con globe.
   * `full`: card con label "Idioma" + Select o RadioGroup con dos opciones.
   */
  variant?: "compact" | "full";
  /** Locale activo. Obligatorio — viene del path por convención next-intl. */
  value: LangValue;
  /** Callback al elegir un nuevo locale. Debe disparar la navegación a `/{newLang}/...` (next-intl). */
  onValueChange: (lang: LangValue) => void;
};
```

Reglas TS:

- `value` y `onValueChange` son **obligatorios** porque el componente no infiere el locale por sí mismo (el locale lo provee next-intl vía `useLocale()` en el padre).
- TypeScript literal `"es" | "en"` rechaza cualquier locale fuera del set soportado por el sistema.

## Variants / Sizes

| Variant   | Uso                                                                                                                                                                                                                                                                  | Tokens consumidos                                                                                                                                                                                                                                        |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `compact` | Header del shell. Pill compacto con texto tabular "ES"/"EN" 2 letras + Lucide `chevron-down` 12px (default), **o** IconButton circular con Lucide `globe` (alternativa equivalente, decisión de S6 sobre cuál se aplica). Click abre `<DropdownMenu>` con dos items. | `--surface-elevated`, `--text-primary`, `--text-secondary`, `--border`, `--border-strong`, `--focus-ring`, `--state-hover-mix`, `--state-pressed-mix`, `--radius-pill`, `--font-mono` (texto tabular), `--text-mono`, `--motion-fast`, `--ease-emphasis` |
| `full`    | Settings → preferences (alternativa a `compact` en la misma pantalla, según el patrón de RadioGroup que adopte la sección). Label "Idioma" + Select o RadioGroup con dos opciones "Español" / "English".                                                             | `--surface`, `--text-primary`, `--text-secondary`, `--border-strong`, `--accent` (selected via color-mix), `--radius-md` (Select) o `--radius-lg` (RadioGroup card), `--space-2`, `--space-4`, `--text-body`, `--font-weight-medium-body`                |

## Estados visuales

### `compact` (header)

| Estado          | Receta CSS (light)                                                                                                                                                                                                                                                                                                                                                                                           | Receta CSS (dark) | Notas                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- | --------------------------------------------------------------------------- |
| `default`       | pill `min-height: 2.75rem` mobile / `2.5rem` desktop; `padding: 0 var(--space-3); background: transparent; color: var(--text-primary); border: 1px solid transparent; border-radius: var(--radius-pill); display: inline-flex; align-items: center; gap: var(--space-1_5);` texto tabular ES/EN en `--font-mono` `--text-mono` con `font-feature-settings: "tnum"` + chevron-down 12px en `--text-secondary` | mismo             | El gap entre texto y chevron usa `--space-1_5`. Tap target ≥44px en mobile. |
| `hover`         | overlay mix=6%                                                                                                                                                                                                                                                                                                                                                                                               | mix=8%            | Igual patrón que ThemeToggle compact.                                       |
| `pressed`       | overlay mix=12%                                                                                                                                                                                                                                                                                                                                                                                              | 14%               |                                                                             |
| `focus-visible` | `outline: 2px solid var(--focus-ring); outline-offset: 2px;`                                                                                                                                                                                                                                                                                                                                                 | mismo             |                                                                             |
| `open`          | `aria-expanded="true"`; chevron-down rota 180° vía `transform: rotate(180deg)` con `--motion-fast` `--ease-emphasis`                                                                                                                                                                                                                                                                                         | mismo             | Estado mientras el `<DropdownMenu>` está abierto.                           |
| `disabled`      | (no aplica — siempre disponible)                                                                                                                                                                                                                                                                                                                                                                             | mismo             |                                                                             |

### `compact` IconButton alternativo (globe)

Si en S6 se decide que el header use IconButton con `globe`, la receta sigue exactamente el patrón de `<IconButton>` (sub-agente δ Tier 3) — circular 40×40 desktop / 44×44 mobile, ícono `globe` 18px en `--text-primary`, mismo state layer que ThemeToggle compact.

### Dropdown menu items (cuando `compact` abre)

| Estado        | Receta CSS (light)                                                                                                                                    | Receta CSS (dark) | Notas                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------- |
| item idle     | `padding: var(--space-2) var(--space-3); color: var(--text-primary); background: transparent;` texto del label "Español" / "English" en `--text-body` | mismo             | Cada item dentro del DropdownMenu (`--surface-elevated`, `--elevation-2`, `--radius-lg`). |
| item hover    | overlay mix=6%                                                                                                                                        | mix=8%            |                                                                                           |
| item active   | bg `color-mix(in oklch, var(--accent) 14%, var(--surface-elevated))`; check Lucide `check` 16px en `--accent` a la izquierda del label                | mismo             | El item del locale activo muestra el check; el otro queda sin marca.                      |
| focus-visible | `outline: 2px solid var(--focus-ring); outline-offset: -2px;` (offset negativo porque el outline va dentro del item para no derramar fuera del menu)  | mismo             |                                                                                           |

### `full` (settings)

| Estado         | Receta CSS (light)                                                                                                                                                                        | Receta CSS (dark) | Notas                                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------ |
| `default`      | label "Idioma" en `--text-primary` `--text-body` `--font-weight-medium-body`; debajo `<Select>` (preferido en mobile) o `<RadioGroup>` horizontal (preferido en desktop) con dos opciones | mismo             | El layout sigue el mismo patrón que ThemeToggle full para coherencia visual de la sección Preferences. |
| Select / Radio | hereda recetas de [`Select.md`](./Select.md) y [`Radio.md`](./Radio.md)                                                                                                                   | mismo             | Sin overrides propios — el componente solo cablea valores y handlers.                                  |

## Mobile vs desktop

| Aspecto        | `< --breakpoint-md` (mobile)                                                                                       | `≥ --breakpoint-md` (desktop)                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `compact` size | min-height 2.75rem (44px tap target inviolable)                                                                    | min-height 2.5rem (40px)                                                       |
| `compact` UX   | Click abre `<Sheet>` (bottom sheet) con dos opciones full-width — más cómodo en touch que un DropdownMenu pequeño. | Click abre `<DropdownMenu>` flotante alineado al toggle, con dos items.        |
| Tooltip        | No se muestra (sin hover).                                                                                         | Tooltip on hover/focus con copy `tooltip` ("Cambiar idioma").                  |
| `full` layout  | `<Select>` full-width preferido — RadioGroup también válido pero ocupa más espacio.                                | `<RadioGroup>` horizontal preferido (dos cards side-by-side, gap `--space-4`). |
| URL navigation | `router.push('/{newLang}/...same-path')` con scroll-restore disabled durante el cambio para evitar saltos.         | mismo                                                                          |

## Accesibilidad

- **Rol ARIA:**
  - `compact` (texto + chevron): `<button type="button" aria-haspopup="menu" aria-expanded={isOpen} aria-label="components.langToggle.tooltip">`. El texto "ES"/"EN" es visual; el `aria-label` lo complementa para SR.
  - `compact` IconButton (globe): `<button aria-haspopup="menu" aria-expanded={isOpen} aria-label="components.langToggle.tooltip">` — mismo patrón.
  - DropdownMenu: `<ul role="menu">` con `<li role="menuitemradio" aria-checked={isActive}>` por opción. El item activo tiene `aria-checked="true"`.
  - `full`: `<fieldset>` con `<legend>Idioma</legend>` + `<RadioGroup>` o `<Select aria-label="Idioma">`.
- **Keyboard:**
  - `compact`: Tab → foco; `Enter` o `Space` → abre el menú; flechas arriba/abajo navegan items dentro del menú; `Enter` selecciona y cierra; `Esc` cierra sin cambiar.
  - `full`: `<RadioGroup>` estándar (flechas para cambiar opción) o `<Select>` estándar (flechas + Enter).
- **Focus management:**
  - Al abrir el menú/sheet, el primer item recibe foco (o el item activo, dependiendo de la convención del DropdownMenu — recomendado: ítem activo).
  - Al cerrar, foco vuelve al toggle.
- **Screen reader:**
  - `aria-label="Cambiar idioma"` declara el propósito del control.
  - El `aria-expanded` comunica el estado abierto/cerrado.
  - Cada item del menú anuncia su locale ("Español" / "English") + el estado checked si aplica.
- **`prefers-reduced-motion: reduce`:**
  - El chevron rotation se reemplaza por cambio instantáneo (sin transition).
  - El DropdownMenu/Sheet abren con fade `--motion-fast` en lugar de slide.

## Motion

| Qué se anima                      | Token de duración | Token de easing         | Notas                                                                                   |
| --------------------------------- | ----------------- | ----------------------- | --------------------------------------------------------------------------------------- |
| State layer toggle                | `--motion-fast`   | `--ease-emphasis`       | Hover/active.                                                                           |
| Chevron rotation                  | `--motion-fast`   | `--ease-emphasis`       | 0° → 180° en open / 180° → 0° en close.                                                 |
| DropdownMenu enter/exit           | `--motion-base`   | `--ease-out-expressive` | Slide vertical 4px + fade. Desktop.                                                     |
| Sheet enter/exit                  | `--motion-base`   | `--ease-out-expressive` | Slide vertical desde abajo. Mobile.                                                     |
| Page transition al cambiar locale | `--motion-base`   | `--ease-out-expressive` | Coordinado por el router de next-intl + view-transitions globales si están habilitadas. |
| Focus ring                        | `--motion-fast`   | `--ease-emphasis`       |                                                                                         |

## Copy default + i18n

| Clave i18n sugerida               | Valor ES (voice glossary aplicado) |
| --------------------------------- | ---------------------------------- |
| `components.langToggle.label`     | "Idioma"                           |
| `components.langToggle.es`        | "Español"                          |
| `components.langToggle.en`        | "English"                          |
| `components.langToggle.tooltip`   | "Cambiar idioma"                   |
| `components.langToggle.menuLabel` | "Elegí tu idioma"                  |

EN se deja para S12. Notas: los nombres de los locales (`Español`, `English`) son auto-referenciales — cada uno se escribe en su idioma nativo. Esto es el estándar de toggles de idioma globales (Apple, Google, GitHub) y evita que un usuario que no entiende el locale activo se quede sin opciones legibles.

## Edge cases

1. **Cambio de locale durante una mutación pendiente**: la navegación a `/{newLang}/...` puede cancelar peticiones in-flight. Recomendación: deshabilitar el toggle visualmente durante mutaciones críticas (form submit). Decisión del consumer, no del componente.
2. **URL con query params o hash**: el cambio de locale debe preservar `?...` y `#...`. La navegación es `/{newLang}{pathname}{search}{hash}`, no solo `/{newLang}{pathname}`.
3. **Páginas que no existen en todos los locales**: si una ruta es exclusiva de `es` (ej. landing-only), navegar a `/en/...` puede 404. El consumer maneja el fallback (ej. redirect a homepage en el nuevo locale).
4. **Sin JS (SSR)**: el toggle se renderiza con el locale activo del path; el menú es inert hasta hidratar. Sin flash porque next-intl resuelve el locale server-side.
5. **Locale del browser ≠ locale activo**: el primer login el sistema sigue el `Accept-Language` header (next-intl lo maneja). Después del primer cambio manual, queda fijo en el path. Si el usuario cierra sesión y vuelve, se resuelve del path o del default `es`.
6. **Sync con menú contextual de mascota**: el menú contextual de [`MascotBubble`](./MascotBubble.md) NO incluye "Cambiar idioma" (solo "Cambiar tema") — la decisión queda exclusiva del LangToggle del header / Settings.
7. **Path con segmento `[locale]` mal configurado**: si next-intl no está configurado correctamente, el toggle navega a una ruta rota. Validar config en `src/i18n/routing.ts` y `src/proxy.ts`.
8. **Cambio de locale dispara reload del bundle**: next-intl carga messages dinámicamente; el cambio puede tardar unos ms si el chunk del nuevo locale no está cacheado. Mostrar feedback (loading state opcional en el toggle) si se detecta lag >300ms.
9. **`open` state se rompe si el padre desmonta el componente durante navegación**: usar `useLayoutEffect` para limpiar el state antes del unmount.
10. **A11y vs visual**: el texto "ES"/"EN" tabular es decorativo (decisión visual del header). El SR depende del `aria-label` para entender el propósito. Validar con axe-core.

## Anti-patrones

1. **`localStorage` propio para locale**: rompe la convención de next-intl. El locale es path-based; cualquier sync extra es deuda. (Excepción: si el equipo decide en S12 mirror en `localStorage["pandatrack-lang"]` para optimizar primera carga, documentar como ADR.)
2. **Banderas país (🇪🇸 🇬🇧)**: prohibido. Las banderas representan países, no idiomas — un usuario hispanohablante en EEUU no se siente representado por 🇪🇸. Convención del sector: solo texto auto-referencial ("Español", "English").
3. **Cambio de locale con full page reload**: rompe la fluidez. Usar el router de next-intl (`router.push` cliente).
4. **Locale picker con >2 opciones en MVP**: out of scope. La API TS literal `"es" | "en"` lo bloquea.
5. **Tooltip que dice "ES" / "EN" estático**: redundante con el texto visible. El tooltip declara la acción, no el estado.
6. **Persistir locale en cookie sin migrar a path**: rompe path-based locale routing. Cookie como mirror está OK (next-intl lo soporta), pero la fuente de verdad es el path.
7. **Auto-detectar locale en cada navegación**: rompe la elección manual del usuario. Solo se detecta una vez (primera carga).
8. **`compact` en settings + `full` en header**: invertir las variants rompe la convención. `compact` en el header es densidad alta; `full` en settings es densidad baja con preview.
9. **Bloquear focus al cerrar el menú**: el focus debe volver al toggle. Anti-patrón clásico de DropdownMenu mal implementado.
10. **Lista de items en orden alfabético "EN" antes de "ES"**: en una app `es`-default, el primer item del menú es siempre el locale activo (o el default `es`). Convención de UX para reducir el target del más probable primer click.

## Ejemplos de uso

```tsx
// Header del shell — variant compact
<header>
  <Breadcrumbs items={breadcrumbItems} />
  <div className={headerActions}>
    <LangToggle
      variant="compact"
      value={locale}
      onValueChange={(newLang) => {
        const newPath = pathname.replace(/^\/(es|en)/, `/${newLang}`);
        router.push(`${newPath}${searchParams.toString() ? `?${searchParams}` : ""}`);
      }}
    />
    <ThemeToggle variant="compact" />
  </div>
</header>

// Settings → preferences — variant full
<section aria-labelledby="language-label">
  <LangToggle
    variant="full"
    value={user.preferences.lang}
    onValueChange={handleLangChange}
  />
</section>
```

## Tokens consumidos

- `--surface`, `--surface-elevated`
- `--text-primary`, `--text-secondary`
- `--border`, `--border-strong`
- `--accent` (selected state via color-mix 14%)
- `--focus-ring`
- `--state-hover-mix`, `--state-pressed-mix`
- `--radius-pill` (compact), `--radius-md` (Select), `--radius-lg` (RadioGroup card / Menu)
- `--font-mono`, `--font-sans`
- `--text-mono`, `--text-body`
- `--font-weight-medium-body`
- `--space-1_5`, `--space-2`, `--space-3`, `--space-4`
- `--motion-fast`, `--motion-base`
- `--ease-emphasis`, `--ease-out-expressive`
- `--breakpoint-md`
- `--elevation-2` (DropdownMenu)
- `--z-popover` (DropdownMenu), `--z-sheet` (Sheet mobile)

## ADRs aplicables

- [ADR 0003 — Demo decisions](../decisions/0003-demo-decisions.md): D4 (header con breadcrumbs + lang + theme — el LangToggle compact vive en el cluster derecho del header).

## Dependencias

- IconButton (sub-agente δ Tier 3) — base alternativa del `compact` cuando se elige el ícono `globe`.
- `<DropdownMenu>` (sub-agente δ Tier 3) — desktop menu.
- `<Sheet>` (sub-agente δ Tier 3) — mobile menu.
- [`Select.md`](./Select.md) — base del `full` mobile.
- [`Radio.md`](./Radio.md) — base del `full` desktop.
- Tooltip (sub-agente δ Tier 3) — `compact` desktop.
- Lucide icons: `chevron-down`, `globe`, `check`.
- next-intl router (`useRouter`, `usePathname`, `useLocale`).

## Notas para S5 (implementación)

1. Crear `src/components/core/LangToggle.tsx` — `variant="compact"` únicamente. `variant="full"` se difiere a la sesión de Settings.
2. Integrar next-intl: `useLocale()` para el locale activo, `useRouter()` + `usePathname()` para navegación. El `onValueChange` construye el nuevo path con `pathname.replace(/^\/(es|en)/, \`/\${newLang}\`)` preservando query params y hash.
3. Extraer la lógica de path replacement a `src/hooks/useLangNavigation.ts` para reusar desde Header y eventualmente desde Settings.
4. En el nuevo `Header.tsx`, importar desde `src/components/core/LangToggle`. Misma corrección de project-structure que `ThemeToggle`.
5. PostHog: `POSTHOG_EVENTS.APP_SHELL.LOCALE_CHANGED` con `{ from, to }`. Centralizar nombre en `src/lib/constants.ts`.
6. Tests: cambio de locale navega al path correcto, query params se preservan, locale activo muestra el estado correcto en el toggle.

## Notas para S12 (implementación)

1. **next-intl integration**: el componente no maneja la navegación directamente — el padre construye el `onValueChange` con la lógica de `router.push(/${newLang}${pathname})`. Documentar el patrón en un hook `useLangNavigation()` para evitar duplicación.
2. **Path preservation**: el patrón de replace `/^\/(es|en)/` debe cubrir edge cases (path raíz `/`, paths con query/hash, paths con segmentos dinámicos `[id]`). Implementar como helper en `src/lib/i18n.ts`.
3. **PostHog event**: `lang_changed` con prop `from`, `to`, `path`. Centralizar nombre.
4. **Decisión `compact` texto vs IconButton**: la spec deja ambas alternativas válidas. Decisión final en S6 con mocks reales del header. MVP: empezar con texto tabular (más explícito para nuevos usuarios) y migrar a IconButton si en validación humana se confirma claridad equivalente.
5. **Server-side locale detection**: la primera carga depende de `Accept-Language` header gestionado por next-intl middleware (`src/proxy.ts`). Validar que el middleware redirige correctamente cuando el path no incluye locale.
6. **A11y testing**: validar `aria-haspopup`, `aria-expanded`, `aria-label`, y el `aria-checked` del item activo del menú con axe-core + smoke manual NVDA/VoiceOver.
7. **Loading state**: si la carga del chunk del nuevo locale tarda >300ms, mostrar un spinner discreto en el toggle (Lucide `loader-2` reemplazando el chevron). Implementación via `router.events` o nuevo hook según versión de Next.js / next-intl.
8. **Test e2e**: cubrir cambio desde header + persistencia tras reload (path debe mantener nuevo locale) + cambio desde settings sincronizado.
9. **Locale del browser en primera carga**: validar comportamiento cuando el browser declara `Accept-Language: en-US,en;q=0.9,es;q=0.8` — el sistema debe servir `en` por preferencia. next-intl ya lo maneja; solo confirmar con setup del proyecto.
10. **Out of scope**: locales adicionales (pt, fr, de, ja, etc.), RTL languages (ar, he), formato de número/fecha por locale más allá de lo que `Intl.NumberFormat`/`Intl.DateTimeFormat` resuelven. La API TS deja la puerta cerrada para que un cambio futuro requiera revisión deliberada.
