---
title: Sesión 03 Fase B — Implementación de tokens en `src/`
date: 2026-05-02
status: ✅ done
type: B-only
---

## Qué corrió

**Paso 0 (lectura completa):** Se leyeron en orden `README.md`, `methodology.md`, `tokens.md`, `tokens-css.md`, `decisions/0003-demo-decisions.md`, `_notes/demo-screens.html` (estrategia del inline script), `src/app/globals.css` (keyframes a preservar, tokens legacy a aliasiar), `src/app/[locale]/layout.tsx` (punto de inyección del script), `src/lib/fonts.ts` (fuentes actuales), `src/contexts/ThemeContext.tsx` (lógica de tema existente), y `src/lib/constants.ts` (clave de almacenamiento). También se ejecutó grep para identificar qué clases Tailwind legacy usa la codebase existente (`text-text-title`, `text-text-muted`, `text-text-body`, `bg-muted`, `border-border`, etc.).

**Plan visible en chat** con las decisiones técnicas clave antes de implementar.

**Implementación en orden:**

1. `src/app/globals.css` — reescritura completa
2. `src/types/theme.ts` — tipos `Theme` y `Palette`
3. `src/lib/theme.ts` — utilidades `setTheme` / `setPalette` / `getTheme` / `getPalette`
4. `src/lib/fonts.ts` — carga de Inter Variable y JetBrains Mono vía `next/font/google`
5. `src/lib/constants.ts` — `THEME_STORAGE_KEY` → `"pandatrack-theme"` + nuevo `PALETTE_STORAGE_KEY`
6. `src/app/[locale]/layout.tsx` — inline script mejorado + variables de nuevas fuentes

**Validación al cierre:** los 4 comandos obligatorios pasaron (detalle abajo).

---

## Archivos modificados / creados

| Path                          | Operación            | Descripción                                                                                                                                            |
| ----------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app/globals.css`         | Reescritura completa | Sistema de tokens nuevo: `@theme`, `@theme inline`, 5 paletas × 2 modos, state layers, aliases legacy, keyframes preservados, `prefers-reduced-motion` |
| `src/types/theme.ts`          | Creado               | Tipos `Theme = "light" \| "dark"` y `Palette = "velvet" \| "lilac" \| "plum" \| "lagoon" \| "forest"`                                                  |
| `src/lib/theme.ts`            | Creado               | Funciones `setTheme`, `setPalette`, `getTheme`, `getPalette` con guards de SSR y localStorage seguro                                                   |
| `src/lib/fonts.ts`            | Modificado           | Agregados `interFont` (`--font-inter`, opsz activado) y `monoFont` (`--font-jetbrains-mono`); fuentes legacy preservadas con exports renombrados       |
| `src/lib/constants.ts`        | Modificado           | `THEME_STORAGE_KEY` → `"pandatrack-theme"`; agregado `PALETTE_STORAGE_KEY = "pandatrack-palette"`                                                      |
| `src/app/[locale]/layout.tsx` | Modificado           | Inline script mejorado (palette + theme antes de hydration); `interFont.variable` y `monoFont.variable` en body className                              |

---

## Decisiones de implementación

### 1. Carga de fuentes

**Inter Variable vía `next/font/google`** con `axes: ['opsz']`. El axis óptico `opsz` activa el cut Display de Inter automáticamente a tamaños grandes (≥24px) sin necesitar una fuente separada. No se descargaron WOFF2 locales. `--font-inter` queda disponible en toda la app vía CSS variable.

**Decisión tomada:** `--font-sans` y `--font-display` apuntan ambos a `var(--font-inter)`. Los componentes que usen `--font-display` + font-size grande + `font-optical-sizing: auto` obtendrán el cut Display automáticamente.

**JetBrains Mono vía `next/font/google`** — variable `--font-jetbrains-mono`. Reemplaza el stack `ui-monospace, SFMono-Regular, ...` del sistema anterior.

### 2. Estrategia del inline script

El script se inyecta en `<head>` vía `dangerouslySetInnerHTML` antes de hydration (sincrono). Lee `pandatrack-palette` (default: `velvet`) y `pandatrack-theme` (inferred de `prefers-color-scheme` si no hay valor guardado). Setea `document.documentElement.dataset.palette` y `document.documentElement.dataset.theme`. En caso de error de localStorage (private mode, etc.), aplica `velvet` + `light` como fallback seguro.

### 3. Manejo del conflicto `--text-title` / `--text-body`

`@theme { --text-title: 2rem; --text-body: 0.9375rem; }` crea estas como propiedades de font-size. El código legacy usa las clases Tailwind `text-text-title`, `text-text-body`, `text-text-muted` (que en el sistema old se generaban como `--color-text-title: var(--text-title)` donde `--text-title` era un color). Para evitar el conflicto, en `@theme inline` se mapean directamente a los tokens nuevos **sin pasar por el nombre conflictivo**:

```
--color-text-title: var(--text-primary)   /* no via var(--text-title) */
--color-text-body:  var(--text-primary)   /* no via var(--text-body)  */
--color-text-muted: var(--text-muted)
```

### 4. Clave de localStorage

`THEME_STORAGE_KEY` se cambió de `"theme"` a `"pandatrack-theme"` en `constants.ts`. El `ThemeContext.tsx` existente ya importa esta constante, por lo que queda alineado automáticamente. El inline script también usa la nueva clave. Los usuarios que tenían `"theme"` guardado perderán su preferencia (aceptable — rama de rediseño, no producción).

### 5. Body font-family

`body { font-family: var(--font-sans); }` → Inter Variable. El `var(--font-regular)` de Open Sans sigue disponible como CSS variable (cargada por `next/font` en body className) para código que la referencia directamente.

### 6. Keyframes con color hardcodeado

Los keyframes de `banner-cta-subtle` y `hero-cta-glow` originalmente usaban `rgb(139 92 246 / 0.15)` (violet hardcoded). Se migraron a `color-mix(in oklch, var(--accent) 15%, transparent)` para que sigan al color del tema activo. Los demás keyframes eran opacity/transform puros — sin cambio.

---

## Aliases de retrocompatibilidad mantenidos

| Token legacy               | → Token nuevo                        | Razón                                   |
| -------------------------- | ------------------------------------ | --------------------------------------- |
| `--foreground`             | `var(--text-primary)`                | color principal de texto                |
| `--surface-2`              | `var(--surface-elevated)`            | segunda superficie = superficie elevada |
| `--card`                   | `var(--surface)`                     | cards usan la superficie base           |
| `--popover`                | `var(--surface-elevated)`            | popovers flotan sobre la superficie     |
| `--input`                  | `var(--border)`                      | borde de input = token de borde         |
| `--ring`                   | `var(--focus-ring)`                  | ring = indicador de foco                |
| `--primary`                | `var(--accent)`                      | CTA primario = accent del sistema       |
| `--primary-foreground`     | `var(--text-on-accent)`              | texto sobre botones primarios           |
| `--secondary`              | `var(--accent)`                      | secundario también es accent            |
| `--secondary-foreground`   | `var(--text-on-accent)`              | texto sobre botones secundarios         |
| `--accent-foreground`      | `var(--text-on-accent)`              | texto sobre elementos accent            |
| `--muted`                  | `var(--surface-elevated)`            | bg atenuado = superficie elevada        |
| `--muted-foreground`       | `var(--text-muted)`                  | texto atenuado = text-muted             |
| `--destructive-foreground` | `var(--text-on-accent)`              | texto sobre destructivo                 |
| `--highlight`              | `var(--accent)`                      | highlight era violet = mismo accent     |
| `--highlight-foreground`   | `var(--text-on-accent)`              | texto sobre highlight                   |
| `--link`                   | `var(--accent)`                      | links usan accent                       |
| `--link-hover`             | `var(--accent)`                      | hover de link también accent            |
| `--logo`                   | `var(--accent)`                      | color del logo = accent de marca        |
| `--eyebrow-bg`             | `color-mix(accent 35%, transparent)` | tinte del accent para bg eyebrow        |
| `--eyebrow-fg`             | `var(--text-on-accent)`              | texto sobre eyebrow background          |
| `--eyebrow-ring`           | `color-mix(accent 40%, transparent)` | ring del componente eyebrow             |

**Clases Tailwind legacy preservadas via `@theme inline`:**
`text-text-title`, `text-text-body`, `text-text-muted`, `bg-primary`, `text-primary`, `bg-muted`, `bg-card`, `bg-background`, `border-border`, `bg-surface`, `text-foreground`, `bg-accent`, `text-accent`, `bg-destructive`, `text-destructive`, `bg-success`, `text-warning`, y todas las demás del sistema viejo.

---

## Validación

| Comando                  | Resultado                                             |
| ------------------------ | ----------------------------------------------------- |
| `npm run type-check`     | ✅ 0 errores                                          |
| `npm run lint`           | ✅ 0 warnings                                         |
| `npm run test`           | ✅ 287 passed / 12 skipped (integrations sin DB)      |
| `npm run validate-build` | ✅ "Compiled successfully in 53s", 45 rutas generadas |

---

## Lo que NO se hizo (intencionalmente)

- **Componentes nuevos del catálogo S4** (Button, Input, StatusChip, StoreAvatar, etc.) → S4B
- **Refactor de componentes legacy** en `src/components/` → S4B / S5
- **App shell nuevo** (sidebar collapsable push, header con breadcrumbs) → S5
- **UI de `<ThemeToggle>` y `<PaletteSwitcher>`** → S5 (header) / S4B (atom)
- **Pantallas alta fidelidad** → S6+
- **Audit cross-paleta de componentes legacy** → S4B (cuando se reemplacen)
- **Migración de clases legacy en `src/components/`** → sin `text-white` hardcodeado (0 ocurrencias encontradas)
- **Eliminación de fuentes legacy** (Open Sans, Roboto Condensed, Zilla Slab) → se preservan como `--font-regular`, `--font-secondary`, `--font-logo` para código que las referencia directamente
- **Commits / PRs** → humano

---

## Estado del working tree

~6 archivos modificados/creados. El humano puede correr `npm run dev` para ver la app con el nuevo sistema de tokens y `git diff` para revisar los cambios antes de commitear.

---

## Riesgos visuales conocidos

1. **`--accent` cambió semánticamente.** El viejo `--accent` era ámbar (`#f59e0b`). El nuevo `--accent` es el violeta Velvet (`oklch(46% 0.2 290)` light). Todo componente legacy que usaba `bg-accent`, `text-accent`, `border-accent` ahora renderizará violeta en lugar de ámbar. Este cambio es **intencional** — el acento amber era del sistema viejo, el violeta es la paleta Velvet nueva.

2. **`--text-on-accent` en dark es oscuro, no blanco.** Botones legacy con texto hardcodeado `text-white` seguirán blancos (0 ocurrencias encontradas), pero cualquiera que usara `var(--primary-foreground)` o `var(--text-on-accent)` mostrará texto oscuro en modo dark. Esto es correcto según ADR 0001 D3 y `tokens.md §1.3`.

3. **Open Sans reemplazado por Inter en `body`.** La familia tipográfica del cuerpo de la app cambia de Open Sans a Inter Variable. Los componentes legacy que usaban `font-sans` Tailwind class (Open Sans) ahora renderizan Inter. Esto es el cambio de stack tipográfico esperado de S3B.

4. **Paleta predeterminada es Velvet**, no el sistema azul-fintech anterior. La app entera se verá violeta-gris en la primera carga. Componentes legacy que consumían los viejos tokens de color ahora verán los valores Velvet (lienzo plomo-violeta en light, azul-violeta nocturno en dark).

5. **`--muted` en light cambia.** El viejo `--muted: #f1f5f9` (gris azulado claro) ahora mapea a `var(--surface-elevated)` = `oklch(95% 0.016 285)` (ligeramente violeta). Diferencia sutil pero visible en componentes como badges y chips que usan `bg-muted`.

---

## Qué necesita la próxima sesión (S4B atoms primer batch)

Componentes legacy a reemplazar primero (mayor impacto visual):

- `src/components/core/Button.tsx` (si existe) — consume `--primary`, `--primary-foreground`, necesita `--text-on-accent` correcto
- `src/components/core/StatusChip.tsx` (si existe) — consume status tokens, necesita discriminated union (ADR 0006)
- `src/components/core/Input.tsx` — consume `--input`, `--ring`, `--border`
- Cualquier badge/chip que use `--accent` como ámbar decorativo

Componentes nuevos del catálogo S4 a implementar:

- `<Button>` con variants primary / secondary / ghost / destructive
- `<StatusChip>` con discriminated union `kind` (ADR 0006)
- `<StoreAvatar>` sizes 24/32/40/56 (ADR 0001 D16)
- `<Badge>` con variant accent / neutral

---

## Addendum 2026-05-02 — Correctivo: solo Velvet en la app

Tras el cierre original de S3-B, decisión humana: las 4 paletas alternativas (Lilac, Plum, Lagoon, Forest) viven solo en el demo HTML (`docs/redesign/_notes/demo-screens.html`) y en docs (`docs/redesign/tokens.md`, `docs/redesign/tokens-css.md`) como referencia futura, no en la app.

### Cambios aplicados

| Archivo                       | Qué se removió                                                                                                                                                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/globals.css`         | Section 5 completa (10 bloques: Velvet + 4 alternativas × 2 modos). Los valores Velvet se fusionaron en los bloques `[data-theme="light"]` y `[data-theme="dark"]` existentes (section 4). Comentario de alias section actualizado: "data-palette / data-theme" → "data-theme". |
| `src/types/theme.ts`          | `type Palette = "velvet" \| "lilac" \| "plum" \| "lagoon" \| "forest"`                                                                                                                                                                                                          |
| `src/lib/theme.ts`            | Import de `Palette`, constante `PALETTE_KEY`, constante `VALID_PALETTES`, funciones `setPalette` y `getPalette`.                                                                                                                                                                |
| `src/lib/constants.ts`        | `PALETTE_STORAGE_KEY = "pandatrack-palette"`                                                                                                                                                                                                                                    |
| `src/app/[locale]/layout.tsx` | Rama de palette del inline script (`PALETTE_KEY`, `PALETTES`, `localStorage.getItem(PALETTE_KEY)`, `el.dataset.palette`). JSDoc actualizado para reflejar solo theme.                                                                                                           |

### Mecanismo conservado

- `data-theme` en `<html>` como atributo de control de tema.
- `setTheme` / `getTheme` en `src/lib/theme.ts`.
- `THEME_STORAGE_KEY = "pandatrack-theme"` en `src/lib/constants.ts`.
- Inferencia inicial de `prefers-color-scheme` en el inline script del layout.
- Fallback `data-theme='light'` en el catch del inline script.

### Validación post-correctivo

| Comando                  | Resultado                         |
| ------------------------ | --------------------------------- |
| `npm run type-check`     | ✅ 0 errores                      |
| `npm run lint`           | ✅ 0 warnings                     |
| `npm run test`           | ✅ 287 passed / 12 skipped        |
| `npm run validate-build` | ✅ Compiled successfully in 31.9s |
