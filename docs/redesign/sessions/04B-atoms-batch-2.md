---
title: Sesión 04 Fase B — Implementación de atoms (segundo batch)
date: 2026-05-02
status: ✅ done
type: B-only
---

## Qué corrió

**Lectura inicial:** `docs/redesign/README.md`, `methodology.md`, `sessions/04B-atoms-batch-1.md`, specs de los 15 componentes (ver lista abajo), `src/app/globals.css` (tokens disponibles), legacy files para análisis de backward-compat (`IconButton.tsx`, `Label.tsx`, `Textarea.tsx`, `Select.tsx`, `DatePickerInput.tsx`), batch-1 components para replicar patrones (`Button.tsx`, `Input.tsx`, `MonoCode.tsx`, `StatusChip.tsx`), cursor rules baseline.

**Plan documentado** con análisis de conflicts antes de implementar (ver `_notes/s4b-batch-2-conflicts.md`).

**Implementación en orden:**

1. `src/components/core/Eyebrow.tsx` — nuevo atom
2. `src/components/core/Kbd.tsx` — nuevo atom
3. `src/components/core/HelperText.tsx` — nuevo atom
4. `src/components/core/ErrorMessage.tsx` — nuevo atom
5. `src/components/core/Avatar.tsx` — nuevo atom, "use client" para onError
6. `src/components/core/Label.tsx` — reemplazo del legacy
7. `src/components/core/Textarea.tsx` — reemplazo del legacy
8. `src/components/core/Select.tsx` — reemplazo del legacy (dual-mode: controlled + native)
9. `src/components/core/IconButton.tsx` — reemplazo del legacy
10. `src/components/core/Checkbox.tsx` — nuevo atom
11. `src/components/core/Switch.tsx` — nuevo atom
12. `src/components/core/Radio.tsx` — nuevo atom
13. `src/components/core/Combobox.tsx` — nuevo atom
14. `src/components/core/DateInput.tsx` — nuevo atom (ISO string API, coexiste con DatePickerInput)
15. `src/components/core/DateRangeInput.tsx` — nuevo atom (compone DateInput)
16. `src/i18n/locales/es/components.json` — añadidos: label, avatar, select, combobox, dateInput, dateRangeInput
17. `src/i18n/locales/en/components.json` — añadidos: mismos namespaces EN
18. `src/components/core/_tests/Checkbox.test.tsx` — 16 tests
19. `src/components/core/_tests/Switch.test.tsx` — 15 tests
20. `src/components/core/_tests/Combobox.test.tsx` — 19 tests
21. `src/components/core/_tests/DateInput.test.tsx` — 13 tests
22. `src/components/core/_tests/DateRangeInput.test.tsx` — 7 tests
23. `docs/redesign/_notes/s4b-batch-2-conflicts.md` — 5 decisiones de compatibilidad

**Iteraciones de corrección tras type-check:**

- IconButton: agregados variantes "outline" | "standard" + `iconClassName` para backward compat con 8 consumers
- Label: expandido `LabelSize` con "xs" | "2xs" | "lg" y agregado `color?`/`spacing?` silenciosos (legacy CVA props)
- Select: `SelectNativeProps` usa `Omit<SelectHTMLAttributes, "size">` para evitar colisión con el atributo HTML nativo `size: number`
- DateRangeInput: eliminada `toRef` sin uso (warning lint)
- Tests: ajustado `getByRole("button")` en DateInput para ser específico con `aria-haspopup='dialog'`

**Validación al cierre:** los 4 comandos obligatorios pasaron (detalle abajo).

---

## Archivos modificados / creados

| Path                                                 | Operación  | Descripción                                                                                   |
| ---------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------- |
| `src/components/core/Eyebrow.tsx`                    | Creado     | Uppercase mono label, size sm/md, tone muted/accent, polymorphic tag                          |
| `src/components/core/Kbd.tsx`                        | Creado     | Keyboard shortcut, keys[] con "+" separator, size sm/md, aria-label                           |
| `src/components/core/HelperText.tsx`                 | Creado     | Helper neutro con id para aria-describedby, tone neutral/success, align                       |
| `src/components/core/ErrorMessage.tsx`               | Creado     | role=alert + AlertCircle icon, --destructive-chip-text, aria-live=polite                      |
| `src/components/core/Avatar.tsx`                     | Creado     | user.image/fallback inicial/User icon, sizes 24/32/40/56, onError handler                     |
| `src/components/core/Label.tsx`                      | Reemplazo  | required asterisk, optional text i18n, disabled token color, legacy size/color/spacing compat |
| `src/components/core/Textarea.tsx`                   | Reemplazo  | autosize useLayoutEffect, minRows/maxRows, counter, error string, loading spinner             |
| `src/components/core/Select.tsx`                     | Reemplazo  | Dual-mode: controlled (custom popover) + native (legacy compat); Velvet tokens                |
| `src/components/core/IconButton.tsx`                 | Reemplazo  | icon ReactNode + Icon LucideIcon compat, variantes S4 + outline/standard legacy               |
| `src/components/core/Checkbox.tsx`                   | Creado     | checked/indeterminate/disabled, Check/Minus icons, loading spinner, forwardRef                |
| `src/components/core/Switch.tsx`                     | Creado     | track+thumb animated, role=switch, loading spinner, error/helperText                          |
| `src/components/core/Radio.tsx`                      | Creado     | RadioGroup con roving tabindex, keyboard arrows, vertical/horizontal orientation              |
| `src/components/core/Combobox.tsx`                   | Creado     | Discriminated union mode=single/multi, search, chips, inlineAction, position absolute         |
| `src/components/core/DateInput.tsx`                  | Creado     | ISO string API, DayPicker v9, clear button, min/max, Velvet classNames                        |
| `src/components/core/DateRangeInput.tsx`             | Creado     | Compone dos DateInput, validación to≥from+1, useTranslations error                            |
| `src/i18n/locales/es/components.json`                | Modificado | Añadidos: label, avatar, select, combobox, dateInput, dateRangeInput                          |
| `src/i18n/locales/en/components.json`                | Modificado | Añadidos: mismos namespaces EN                                                                |
| `src/components/core/_tests/Checkbox.test.tsx`       | Creado     | 16 tests: estados, onChange, disabled, loading, aria                                          |
| `src/components/core/_tests/Switch.test.tsx`         | Creado     | 15 tests: rendering, checked, onChange, loading                                               |
| `src/components/core/_tests/Combobox.test.tsx`       | Creado     | 19 tests: trigger, popover, search, single/multi, inlineAction, disabled, error               |
| `src/components/core/_tests/DateInput.test.tsx`      | Creado     | 13 tests: trigger, popover, clear, error, disabled                                            |
| `src/components/core/_tests/DateRangeInput.test.tsx` | Creado     | 7 tests: rendering, validation, error, helperText                                             |
| `docs/redesign/_notes/s4b-batch-2-conflicts.md`      | Creado     | 5 decisiones de backward-compat documentadas                                                  |

---

## Decisiones de implementación

### 1. Select — dual-mode (controlled + native)

La nueva API S4 requiere `options[]` con `onChange(value: string)`. Los consumers existentes usan `children` + `onChange: ChangeEvent`. Se implementó dual-mode: cuando `options` prop está presente → custom popover; cuando hay `children` → native `<select>`. `SelectNativeProps` omite el atributo HTML nativo `size: number` para evitar colisión con el design-system `size: "sm" | "md" | "lg"`. El sheet bottom mobile (> 6 opciones) se deja como S12.

### 2. IconButton — backward compat bridge

La spec requiere `icon: ReactNode` + `aria-label` mandatory. Los consumers legacy usan `Icon: LucideIcon`, `iconClassName`, `variant="outline"|"standard"`. Solución: ambos props coexisten (`icon` tiene precedencia), `iconClassName` aceptado y silenciado, `"outline"` mapea a "secondary", `"standard"` mapea a "ghost". `aria-label` es required en TypeScript vía `"aria-label": string` en el tipo (no `aria-label?: string`).

### 3. Textarea — onChange signature nativa (deuda S12)

Al igual que en Input (batch 1), se mantuvo `ChangeEvent<HTMLTextAreaElement>` en lugar de `(value: string) => void`. Se normaliza `\r\n → \n` antes de propagar el evento. Delta vs spec documentado como deuda S12.

### 4. Combobox — position absolute sin Floating UI

`@floating-ui/react` no está instalado. Se implementó posicionamiento con `position: absolute top-full` + backdrop overlay `fixed inset-0`. El flip automático (cuando el popover desborda el viewport) es S12 con Floating UI.

### 5. DateInput — coexistencia con DatePickerInput

`DatePickerInput.tsx` (legacy) usa `Date | null`. `DateInput.tsx` (S4) usa `"YYYY-MM-DD" | null`. Los dos archivos coexisten; la migración de consumers es S12 per-page refactor.

### 6. Radio — roving tabindex

El grupo `radiogroup` implementa roving tabindex: el item seleccionado (o el primero si value=null) tiene `tabIndex=0`; los demás `-1`. Las flechas ↑↓ y ←→ navegan y seleccionan simultáneamente (patrón ARIA radiogroup).

---

## Audit de cursor rules — hallazgos

| Regla                            | Hallazgo                                                 | Acción                      |
| -------------------------------- | -------------------------------------------------------- | --------------------------- |
| `coding-standards.mdc`           | No hardcoded strings de usuario                          | ✅ todo en i18n o inglés    |
| `theme-light-dark.mdc`           | Tokens semánticos en todos los componentes               | ✅ sin colores hardcodeados |
| `role-accessibility.mdc`         | role=switch/checkbox/radiogroup, aria-checked, aria-busy | ✅                          |
| `testing-strategy.mdc`           | 5 test files para componentes con lógica de branches     | ✅                          |
| `typescript-practices.mdc`       | Discriminated union en Combobox mode, Select props       | ✅                          |
| `next-intl-translation-apis.mdc` | Label, DateRangeInput usan useTranslations               | ✅ namespace registrado     |

---

## Validación

| Comando                  | Resultado | Notas                                                                                                |
| ------------------------ | --------- | ---------------------------------------------------------------------------------------------------- |
| `npm run type-check`     | ✅ pass   | 0 errores tras correcciones de backward compat                                                       |
| `npm run lint`           | ✅ pass   | 0 errores, 8 warnings intencionales (vars `_color`, `_spacing`, `_iconClassName`, `_surfaceContext`) |
| `npm run test`           | ✅ pass   | 388 tests pasan, 12 skipped (integration sin DB)                                                     |
| `npm run validate-build` | ✅ pass   | Build compilado limpio, 45 páginas generadas                                                         |
