---
title: Sesión 04 Fase B — Implementación de atoms (primer batch)
date: 2026-05-02
status: ✅ done
type: B-only
---

## Qué corrió

**Lectura inicial:** `docs/redesign/README.md`, `methodology.md`, `sessions/03B-tokens-impl.md`, specs de los 5 componentes (`components/Button.md`, `Input.md`, `StatusChip.md`, `StoreAvatar.md`, `MonoCode.md`), `src/app/globals.css` (tokens disponibles), `src/components/core/Button/Button.tsx` (legacy), `src/components/core/Input.tsx` (legacy). Luego lectura retroactiva del workflow de cursor rules (`docs/tooling/cursor/rules.md` + reglas aplicables).

**Plan visible en chat** con decisiones técnicas clave antes de implementar.

**Implementación en orden:**

1. `src/components/core/MonoCode.tsx` — nuevo atom
2. `src/components/core/StoreAvatar.tsx` — nuevo atom
3. `src/components/core/StatusChip.tsx` — nuevo atom + i18n
4. `src/components/core/Input.tsx` — reemplazo del legacy
5. `src/components/core/Button/buttonVariants.ts` — actualización CVA
6. `src/components/core/Button/Button.tsx` — reemplazo del legacy
7. `src/i18n/locales/es/components.json` — nuevo namespace
8. `src/i18n/locales/en/components.json` — nuevo namespace (EN)
9. `src/i18n/request.ts` — registro del namespace `components`
10. `src/components/core/_tests/StatusChip.test.tsx` — 28 tests
11. `src/components/core/Button/_tests/Button.test.tsx` — 13 tests

**Cursor rules audit (retroactivo):** Leídas todas las reglas baseline + scope (theme-light-dark, tailwind-semantic-html, typescript-practices, role-accessibility, coding-standards, testing-strategy, icons, next-intl-translation-apis, react-next-components, project-structure, posthog-events, quality-docs-cleanup, ui-visual-consistency, role-frontend-development, validation-checklist). Gaps encontrados y corregidos durante la sesión (ver sección Decisiones).

**Validación al cierre:** los 4 comandos obligatorios pasaron (detalle abajo).

---

## Archivos modificados / creados

| Path                                                | Operación          | Descripción                                                                                          |
| --------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------- |
| `src/components/core/MonoCode.tsx`                  | Creado             | Atom de identificadores mono. Variantes identifier/inline, tamaños sm/md/lg, ADR 0007                |
| `src/components/core/StoreAvatar.tsx`               | Creado             | Avatar de tienda. Sizes 24/32/40/56, logo con aspect, letter fallback, placeholder Store icon        |
| `src/components/core/StatusChip.tsx`                | Creado             | Status pill con discriminated union en `kind`. 6 variantes, useTranslations wired, ADR 0002/0006     |
| `src/components/core/Input.tsx`                     | Reemplazo completo | Single-line input con slots leading/trailing, prefix/suffix, error string, counter, loading spinner  |
| `src/components/core/Button/buttonVariants.ts`      | Actualizado        | CVA con state layers `::after`, nuevas variantes destructive/destructive-ghost, ADR 0001 D3/D14      |
| `src/components/core/Button/Button.tsx`             | Reemplazo completo | Discriminated union en `as` (button/a), leadingIcon, trailingIcon, kbd slot, loading, PostHog compat |
| `src/i18n/locales/es/components.json`               | Creado             | Namespace `components` — button, input, statusChip con plurales ICU                                  |
| `src/i18n/locales/en/components.json`               | Creado             | Namespace `components` EN (EN values para S12)                                                       |
| `src/i18n/request.ts`                               | Modificado         | Registro del namespace `components` en el config de next-intl                                        |
| `src/components/core/_tests/StatusChip.test.tsx`    | Creado             | 28 tests: todos los kind/value, edge cases derived (pct=0/100), ariaLabel                            |
| `src/components/core/Button/_tests/Button.test.tsx` | Creado             | 13 tests: element rendering, disabled, loading, PostHog attrs, leading/trailing icons                |

---

## Decisiones de implementación

### 1. StatusChip — hardcoded strings → useTranslations

La versión inicial del componente tenía las etiquetas en español hardcodeadas (violación de `english-code-only.mdc` + AGENTS.md). La auditoría de cursor rules detectó el gap. Se creó el namespace `components` en i18n con ICU message format para plurales (`{days, plural, one {# día} other {# días}}`). `useTranslations` funciona en Server Components con next-intl v3; no se requirió añadir `"use client"`.

### 2. Input — `className` en wrapper vs `<input>` nativo

El nuevo Input usa un wrapper `<div>` para los slots visuales. `className` se aplica al wrapper; `inputClassName` al `<input>` nativo. Consumidores existentes no pasaban `className` directamente, por lo que el cambio es backward compatible. `forwardRef` se mantuvo.

### 3. Input — `onChange` signature

El spec de S4 proponía `(value: string) => void` para el onChange. Se mantuvo la signature nativa `(e: React.ChangeEvent<HTMLInputElement>) => void` (vía `InputHTMLAttributes`) porque ~10 consumidores existentes dependen de ella. Este delta vs spec se documenta como deuda S12.

### 4. Button — eliminación del ripple effect

El legacy `<Button>` tenía un ripple visual animado para la variante primary. El nuevo sistema usa state layers `::after` en `buttonVariants.ts` (hover 6% + pressed 12% via `color-mix()`). El ripple se eliminó porque es duplicado visual y no estaba en el spec S4. No impacta a consumidores (ninguno depende del comportamiento interno del ripple).

### 5. Button — `as="a"` disabled handling

`<a>` no tiene `disabled` nativo. Cuando `as="a"` y `disabled={true}`: se aplica `aria-disabled="true"`, se elimina `href`, y se setea `tabIndex={-1}`. Los consumidores existentes no usan `as="a"` aún (no había consumo de este prop antes de esta sesión), por lo que es capacidad nueva.

### 6. Button — `outline` y `link` variants conservados

El spec S4 no incluye `outline` ni `link` como variants canónicas. Se conservaron en `buttonVariants.ts` con `// Kept for backward compatibility` porque consumen ~3 archivos existentes. `outline` se actualiza visualmente a secondary-with-accent-border; `link` usa `--accent` con underline hover.

### 7. buttonVariants — `focus-visible:outline` class

En Tailwind v4, la clase utilitaria `focus-visible:outline` (sin valor) no genera CSS por sí sola. Se mantiene junto a `focus-visible:outline-2` y `focus-visible:outline-offset-2` que sí generan el ring correcto. Comportamiento verificado con validate-build.

### 8. Tests — `<a>` sin href pierde role "link"

ARIA spec: un `<a>` sin `href` no tiene rol `link`. La aserción inicial del test usaba `getByRole("link")` que fallaba. Se reemplazó por `container.querySelector("a")` para verificar `aria-disabled` y `tabIndex`. El comportamiento es correcto; solo el selector de test era incorrecto.

---

## Audit de cursor rules — hallazgos y acciones

| Regla                        | Hallazgo                                                   | Acción tomada                                            |
| ---------------------------- | ---------------------------------------------------------- | -------------------------------------------------------- |
| `coding-standards.mdc`       | StatusChip tenía strings ES hardcodeadas                   | Wired `useTranslations`, creados components.json         |
| `testing-strategy.mdc`       | StatusChip (mappers) y Button sin tests                    | Creados 28 + 13 tests                                    |
| `next-intl-translation-apis` | `components` namespace no existía ni estaba registrado     | Creado y registrado en request.ts                        |
| `theme-light-dark.mdc`       | Sin `text-white` ni colores hardcodeados — ✅ sin gaps     | —                                                        |
| `role-accessibility.mdc`     | `aria-label` en StoreAvatar ✅, `aria-hidden` en íconos ✅ | —                                                        |
| `typescript-practices.mdc`   | Ref cast en Button.tsx necesitaba ajuste                   | Corregido a `as unknown as React.Ref<HTMLAnchorElement>` |
| `posthog-events.mdc`         | `posthogEvent`/`posthogProps` en Button preservados        | ✅ backward compat mantenida                             |

---

## Validación

| Comando                  | Resultado | Notas                                                     |
| ------------------------ | --------- | --------------------------------------------------------- |
| `npm run type-check`     | ✅ pass   | 0 errores tras corrección ref cast y `disabled` en anchor |
| `npm run lint`           | ✅ pass   | 3 warnings (vars `_as`, `_surfaceContext` intencionales)  |
| `npm run test`           | ✅ pass   | 328 tests pasan, 12 skipped (integration sin DB)          |
| `npm run validate-build` | ✅ pass   | Build compilado limpio, 45 páginas generadas              |
