---
title: ThemeToggle
tier: 3
status: spec — S5 (ready for implementation)
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0001 D14 (theme dual — vive en header + en settings · supersedida en alcance por ADR 0003 D2)
  - ADR 0003 D2 (theme toggle solo light/dark — sin opción `system`)
  - ADR 0003 D4 (header con breadcrumbs + lang + theme)
---

# ThemeToggle

## Propósito

Control para alternar entre los modos `light` y `dark` del sistema. Aparece en dos sitios (ADR 0001 D14): variant `compact` en el header del shell `(app)` (junto a [`LangToggle`](./LangToggle.md) y [`Breadcrumbs`](./Breadcrumbs.md), ver [`screens/dashboard.md`](../screens/dashboard.md) y `screens/settings.md` referenciados por la addendum del shell), y variant `full` en [`screens/settings.md`](../screens/settings.md) → preferences. Persiste la elección manual del usuario en `localStorage["pandatrack-theme"]` y sincroniza en vivo todas las instancias montadas vía storage events (no requiere refetch). El sistema solo tiene `light` y `dark` — la opción `system` queda descartada por ADR 0003 D2.

## API TypeScript

```ts
type ThemeValue = "light" | "dark";

type ThemeToggleProps = {
  /**
   * `compact` (default `compact`): IconButton circular en el header — sólo ícono `sun`/`moon`.
   * `full`: card con label "Apariencia" + RadioGroup completo en settings → preferences.
   */
  variant?: "compact" | "full";
  /**
   * Valor controlado. Si se omite, el componente lee de `localStorage["pandatrack-theme"]` con fallback
   * a `prefers-color-scheme` para la primera carga.
   */
  value?: ThemeValue;
  /**
   * Callback al cambiar el tema. Si se omite, el componente escribe directamente en `localStorage`
   * y emite el `storage` event (modo no-controlado).
   */
  onValueChange?: (theme: ThemeValue) => void;
};
```

Reglas TS:

- **No existe `value: "system"`.** TypeScript rechaza cualquier intento de pasarlo (regla ADR 0003 D2).
- `value` y `onValueChange` son **opcionales** — el componente soporta modo controlado y no-controlado.
- El componente **siempre** sincroniza con `localStorage["pandatrack-theme"]` aun en modo controlado: el callback puede contener lógica adicional, pero el storage write es responsabilidad del componente para garantizar consistencia entre instancias.

## Variants / Sizes

| Variant   | Uso                                                                                                                                                                                                        | Tokens consumidos                                                                                                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `compact` | Header del shell `(app)` (ADR 0003 D4). IconButton circular 40×40 desktop / 44×44 mobile (tap target). Ícono `sun` (cuando el modo activo es `light`) o `moon` (cuando es `dark`). Click toggle inmediato. | `--surface-elevated`, `--text-primary`, `--border`, `--focus-ring`, `--state-hover-mix`, `--state-pressed-mix`, `--radius-pill`, `--motion-fast`, `--ease-emphasis`                      |
| `full`    | Settings → preferences. Label "Apariencia" + descripción + RadioGroup horizontal con dos `<Radio>` (Light / Dark), cada uno con preview pequeño + ícono Lucide.                                            | `--surface`, `--text-primary`, `--text-secondary`, `--text-muted`, `--border-strong`, `--accent` (estado seleccionado del Radio), `--radius-lg`, `--space-4`, `--space-6`, `--text-body` |

## Estados visuales

### `compact` (header)

| Estado          | Receta CSS (light)                                                                                                                                                                  | Receta CSS (dark) | Notas                                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------ |
| `default`       | `width: 2.75rem; height: 2.75rem; background: transparent; color: var(--text-primary); border: 1px solid transparent; border-radius: var(--radius-pill);`                           | mismo             | El icon-button no tiene background propio en idle — gana superficie sólo en hover.                           |
| `hover`         | overlay `background-color: color-mix(in oklch, var(--text-primary) var(--state-hover-mix), transparent);` (mix=6%)                                                                  | mix=8%            | Aplicado vía `::after` con `border-radius: inherit`.                                                         |
| `pressed`       | overlay con `--state-pressed-mix` (12%)                                                                                                                                             | 14%               | `:active`.                                                                                                   |
| `focus-visible` | `outline: 2px solid var(--focus-ring); outline-offset: 2px;`                                                                                                                        | mismo             | Sólo en `:focus-visible` (no en click puro).                                                                 |
| `pressed-state` | `aria-pressed="true"` cuando el modo activo es el contrario al "destino" del toggle. Visualmente igual que `default` — la diferencia la comunica el cambio de ícono `sun` ↔ `moon`. | mismo             | El estado lo lee el SR vía `aria-pressed`. Nunca usar background `--accent` (rompe la jerarquía del header). |
| `disabled`      | (no aplica — el toggle siempre está disponible)                                                                                                                                     | mismo             |                                                                                                              |

### `full` (settings)

| Estado            | Receta CSS (light)                                                                                                                                                                                                        | Receta CSS (dark) | Notas                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default`         | label "Apariencia" en `--text-primary` con `--text-body` `--font-weight-medium-body`; descripción opcional en `--text-secondary` `--text-caption`; RadioGroup horizontal con `gap: var(--space-4)` entre las dos opciones | mismo             | Cada `<Radio>` envuelto en card 144×96px con preview swatch (mini-bento de 6 sub-rectángulos en colores del modo) + ícono `sun`/`moon` + label texto. |
| `option idle`     | card `background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);`                                                                                                                      | mismo             | Hover overlay 6% / 8% (light/dark) sobre el card.                                                                                                     |
| `option selected` | bg `color-mix(in oklch, var(--accent) 14%, var(--surface)); border: 1px solid color-mix(in oklch, var(--accent) 28%, var(--surface));`                                                                                    | mismo patrón      | Patrón canónico de selected (`tokens.md §1.6`).                                                                                                       |
| `focus-visible`   | `outline: 2px solid var(--focus-ring); outline-offset: 2px;` aplicado al card focused (no al input radio interno; el card es el control).                                                                                 | mismo             |                                                                                                                                                       |
| `disabled`        | `color: var(--text-muted); border-color: var(--border); background: var(--surface);` + `pointer-events: none`                                                                                                             | mismo             | Sin opacity. (Se reserva para casos futuros de "tema forzado por preferencia parental" — no aplica MVP).                                              |

## Mobile vs desktop

| Aspecto             | `< --breakpoint-md` (mobile)                                                                                        | `≥ --breakpoint-md` (desktop)                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `compact` size      | 44×44 (tap target inviolable)                                                                                       | 40×40 (densidad mayor)                                                                                |
| `compact` ubicación | Header sticky mobile (junto a `<LangToggle>`, derecha del breadcrumb truncado).                                     | Header sticky desktop (mismo cluster derecho del header).                                             |
| `compact` tooltip   | No se muestra en mobile (sin hover) — se confía en el ícono y el `aria-pressed`.                                    | Tooltip on hover/focus con copy `tooltip.light` o `tooltip.dark` según próximo destino.               |
| `full` layout       | Card stack vertical: cada Radio ocupa full-width con label horizontal (preview a la izquierda, label a la derecha). | Card grid horizontal: dos Radio side-by-side, gap `--space-4`. Preview centrado arriba, label debajo. |

## Accesibilidad

- **Rol ARIA:**
  - `compact`: `<button type="button" aria-pressed={value === "dark"} aria-label={...}>`. La etiqueta accesible viene del copy `tooltip.light` o `tooltip.dark` (depende del próximo destino — nunca del estado actual).
  - `full`: `<fieldset>` con `<legend>Apariencia</legend>` + `<RadioGroup>` con dos `<Radio>` semánticos. Cada Radio: `<input type="radio" name="theme" value="light|dark">` envuelto en `<label>`.
- **Keyboard:**
  - `compact`: Tab → foco; `Enter` o `Space` → toggle.
  - `full`: Tab → entra al RadioGroup; flechas izq/der/arriba/abajo → cambian opción seleccionada (estándar del role radiogroup).
- **Focus management:**
  - Focus ring visible siempre en `:focus-visible`.
  - El cambio de tema es instantáneo y no roba foco.
- **Screen reader:**
  - `compact`: el `aria-pressed` cambia de `false` (cuando modo light activo, ícono sun, "Cambiar a modo oscuro") a `true` (modo dark activo, ícono moon, "Cambiar a modo claro"). El SR anuncia el toggle correctamente.
  - `full`: el RadioGroup anuncia "Apariencia, grupo de radio, 2 opciones" + cada opción con su label.
- **`prefers-reduced-motion: reduce`:**
  - La transición de tema (cambio de tokens vía `:root[data-theme]`) usa `--motion-fast` `--ease-emphasis`. Reduce-motion la mantiene a `--motion-fast` (ya es 150ms).
  - Sin animaciones de scale o rotation del ícono.

## Motion

| Qué se anima                     | Token de duración | Token de easing   | Notas                                                                                                               |
| -------------------------------- | ----------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| State layer del IconButton       | `--motion-fast`   | `--ease-emphasis` | Hover/active fade.                                                                                                  |
| Cambio de ícono `sun` ↔ `moon`   | `--motion-fast`   | `--ease-emphasis` | Cross-fade (no rotation, no scale). El swap visual es instantáneo de leer.                                          |
| Cambio de tema global            | `--motion-fast`   | `--ease-emphasis` | Las propiedades `background-color` y `color` interpolan vía CSS transitions globales declaradas en `tokens-css.md`. |
| Focus ring                       | `--motion-fast`   | `--ease-emphasis` | Aparición instantánea en `:focus-visible`.                                                                          |
| `full` Radio selected transition | `--motion-fast`   | `--ease-emphasis` | bg + border interpolan suave.                                                                                       |

## Copy default + i18n

| Clave i18n sugerida                    | Valor ES (voice glossary aplicado) |
| -------------------------------------- | ---------------------------------- |
| `components.themeToggle.label`         | "Apariencia"                       |
| `components.themeToggle.description`   | "Elegí el tema para tu sesión."    |
| `components.themeToggle.light`         | "Claro"                            |
| `components.themeToggle.dark`          | "Oscuro"                           |
| `components.themeToggle.tooltip.light` | "Cambiar a modo claro"             |
| `components.themeToggle.tooltip.dark`  | "Cambiar a modo oscuro"            |

EN se deja para S12. Notas: "Apariencia" es el label canónico (alineado con Vercel, Linear, Stripe Dashboard); evita "Tema" porque colisiona con tema visual del sistema vs themes de "skin" en otras apps. La descripción en `--text-secondary` aparece sólo en `variant="full"`.

## Edge cases

1. **Primera carga sin `localStorage`**: el componente lee `prefers-color-scheme` una vez y aplica el modo correspondiente. Inmediatamente escribe ese valor en `localStorage["pandatrack-theme"]` para fijar la elección a partir de ese momento (después de la primera carga, el sistema NO sigue cambios del SO — ADR 0003 D2).
2. **Sync entre instancias (header + settings)**: ambos consumen el mismo `localStorage["pandatrack-theme"]` y escuchan `window.addEventListener("storage", ...)`. Cuando una instancia cambia el valor, las otras lo reflejan sin reload. Importante: el `storage` event no se dispara en la pestaña que originó el cambio — usar un custom event interno (`window.dispatchEvent(new CustomEvent("pandatrack:theme-change"))`) además del storage write.
3. **Múltiples pestañas abiertas**: el cambio en una pestaña se propaga a todas las demás vía `storage` event. Sin race conditions — `localStorage` es atómico para writes simples.
4. **Sin JS (SSR)**: el componente requiere JS para funcionar (es client-side). En SSR/SSG, el botón se renderiza con el modo correspondiente al `data-theme` del `<html>` (server-side), pero el toggle es inert hasta hidratar. Si se necesita evitar flash, ver Notas para S12.
5. **`localStorage` deshabilitado (modo incognito estricto)**: el componente cae a in-memory state — el cambio funciona dentro de la sesión pero no persiste. Sin error visible al usuario.
6. **Migración desde `localStorage["theme"]` legacy**: si existe la clave vieja con valor `system`, se migra a `light` o `dark` según `prefers-color-scheme` y se elimina la clave vieja.
7. **`value` controlado pero sin `onValueChange`**: el componente lo trata como modo "display only" (no responde a clicks). Emite warning en dev mode.
8. **Cambio de tema mid-animación de view-transition**: el view-transition se completa con el modo viejo y luego el nuevo modo aplica. No hay interrupción.
9. **Theme dual sync con context menu de mascota**: la opción "Cambiar tema" del menú contextual de [`MascotBubble`](./MascotBubble.md) invoca el mismo handler que el ThemeToggle. Validar que la sync funcione cuando el cambio viene de ese tercer punto.
10. **Tooltip en `compact` mobile**: en touch sin hover, el tooltip nunca se dispara — se confía en el `aria-label` para SR y en la asociación visual sun/moon ↔ tema.

## Anti-patrones

1. **Variant `system`**: prohibido por ADR 0003 D2. TS literal `"light" | "dark"` rechaza cualquier intento.
2. **Persistir en cookie en lugar de `localStorage`**: rompe ADR 0001 D14 + ADR 0003 D2 (clave declarada `localStorage["pandatrack-theme"]`). Si se necesita SSR-aware theming, usar inline script en `<head>` antes de hydration (ver Notas para S12).
3. **`opacity: 0.5` para disabled**: prohibido (regla universal — `tokens.md §1.6` y `principles.md`).
4. **Cambiar de tema con animación scale/rotate del ícono**: rompe la sobriedad del header. Cross-fade simple es la firma correcta.
5. **Ícono diferente a `sun`/`moon`**: prohibido. Lucide canónicos del set obligatorio.
6. **Background `--accent` en `compact` selected**: rompe la jerarquía del header (el header no debe tener acentos saturados; el accent vive en el contenido). El estado se comunica por `aria-pressed` + ícono.
7. **Tooltip que dice "Modo claro" / "Modo oscuro" estático (estado actual)**: confuso. El tooltip declara el destino del toggle, no el estado actual.
8. **Saltar `prefers-color-scheme` en primera carga**: rompe ADR 0003 D2 ("Inferencia `prefers-color-scheme` solo primera carga"). Si el usuario nunca eligió manualmente, debemos respetar su preferencia del SO la primera vez.
9. **Persistir el cambio en server (DB)**: fuera de scope MVP. La preferencia es client-side; si en el futuro se quiere sync cross-device, agregar mirror en `user.preferences.theme`.
10. **Bloquear el toggle durante navegación**: prohibido. El cambio de tema debe ser inmediato, ningún spinner.

## Ejemplos de uso

```tsx
// Header del shell — variant compact, modo no-controlado
<header>
  <Breadcrumbs items={breadcrumbItems} />
  <div className={headerActions}>
    <LangToggle variant="compact" value={lang} onValueChange={handleLangChange} />
    <ThemeToggle variant="compact" />
  </div>
</header>

// Settings → preferences — variant full, modo controlado
<section aria-labelledby="appearance-label">
  <ThemeToggle
    variant="full"
    value={user.preferences.theme}
    onValueChange={handleThemeChange}
  />
</section>
```

## Tokens consumidos

- `--surface`, `--surface-elevated`
- `--text-primary`, `--text-secondary`, `--text-muted`
- `--border`, `--border-strong`
- `--accent` (sólo en `full` para selected state via color-mix 14%/28%)
- `--focus-ring`
- `--state-hover-mix`, `--state-pressed-mix`
- `--radius-pill` (compact)
- `--radius-lg` (full Radio cards)
- `--space-2`, `--space-4`, `--space-6`
- `--text-body`, `--text-caption`
- `--font-weight-medium-body`
- `--motion-fast`
- `--ease-emphasis`
- `--breakpoint-md`

## ADRs aplicables

- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md): D14 (theme dual — vive en header + en settings, persistencia `localStorage["pandatrack-theme"]`). Alcance reducido por ADR 0003 D2.
- [ADR 0003 — Demo decisions](../decisions/0003-demo-decisions.md): D2 (theme toggle solo light/dark, sin opción `system`; inferencia `prefers-color-scheme` solo en la primera carga). D4 (header con breadcrumbs + lang + theme).

## Dependencias

- IconButton (sub-agente δ Tier 3) — base del `compact`.
- `<RadioGroup>` y `<Radio>` ([`Radio.md`](./Radio.md)) — base del `full`.
- Tooltip (sub-agente δ Tier 3) — `compact` desktop hover/focus.
- Lucide icons: `sun`, `moon`.

## Notas para S5 (implementación)

1. Crear `src/components/core/ThemeToggle.tsx` extrayendo la lógica del componente existente en `src/app/[locale]/(landing)/_components/Menu/ThemeToggle.tsx`. Implementar `variant="compact"` únicamente — `variant="full"` (pantalla Settings) se difiere a la sesión de Settings.
2. El componente debe importar `setTheme()` / `getTheme()` desde `src/lib/theme.ts` (ya existe). Verificar que no haya acoplamiento al route group `(landing)`.
3. En el nuevo `Header.tsx` (`src/components/modules/Header/Header.tsx`), importar desde `src/components/core/ThemeToggle` — nunca desde `(landing)`. Esta corrección elimina la violación de project-structure detectada en `ContentHeader.tsx`.
4. PostHog: instrumentar con `POSTHOG_EVENTS.APP_SHELL.THEME_CHANGED` (`{ from, to, source: "header" }`). Centralizar el nombre del evento en `src/lib/constants.ts` si no existe.
5. Tests: toggle cambia `aria-pressed`, escribe `localStorage["pandatrack-theme"]`, ícono alterna `sun` ↔ `moon`.

## Notas para S12 (implementación)

1. **Inline script anti-flash**: para evitar el flash de tema incorrecto en la primera carga (FOUC), incluir un inline `<script>` en el `<head>` del `RootLayout` que lee `localStorage["pandatrack-theme"]` (con fallback a `prefers-color-scheme`) y aplica `<html data-theme="light|dark">` antes de que el bundle JS hidrate. El script vive en `src/app/layout.tsx` y es síncrono y minimalista (≤30 LOC).
2. **Sync custom event**: además del `storage` event nativo (que no dispara en la pestaña origen), emitir `window.dispatchEvent(new CustomEvent("pandatrack:theme-change", { detail: { theme } }))` para coordinar el header y el settings dentro de la misma pestaña.
3. **`useTheme()` hook**: extraer la lógica de read/write/listen a un hook compartido que ambas variantes consumen. Hook expone `{ theme, setTheme }` y maneja el listener `storage` + custom event.
4. **PostHog event**: instrumentar `theme_changed` con prop `from`, `to`, `source: "header" | "settings" | "mascot-context-menu"`. Centralizar el nombre en `POSTHOG_EVENTS`.
5. **Migración desde `localStorage["theme"]` legacy**: en mount, si existe la clave vieja con valor `system`, escribir `pandatrack-theme` con `light` o `dark` según `prefers-color-scheme` y eliminar la clave vieja. Telemetry: contar cuántos usuarios tenían `system` para confirmar que ADR 0003 D2 fue la decisión correcta.
6. **CSS transition global**: declarar `transition: background-color var(--motion-fast) var(--ease-emphasis), color var(--motion-fast) var(--ease-emphasis), border-color var(--motion-fast) var(--ease-emphasis);` en `:root` para que el cambio de tema sea suave en todas las superficies (no solo en el toggle).
7. **Validar `prefers-color-scheme` en inline script**: el script de pre-hydration debe usar `window.matchMedia('(prefers-color-scheme: dark)').matches` con fallback explícito a `light` si no se detecta.
8. **Test e2e**: cubrir cambio de tema desde header + persistencia tras reload + sync entre tabs (`storage` event simulado en Playwright).
9. **A11y testing**: validar que SR (NVDA, VoiceOver) anuncian correctamente `aria-pressed` y el cambio de label en `compact`. Validar el RadioGroup en `full` con axe-core.
10. **Server mirror (futuro)**: si en V2 se decide guardar el tema en `user.preferences.theme`, el componente lo respeta como source of truth y `localStorage` actúa como cache local. Out of scope MVP.
