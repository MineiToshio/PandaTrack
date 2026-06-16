---
title: S13 — Pasada final de auditoría (Fase A + Fase B)
session: 13
type: foundational A+B (audit, sin demo visual — methodology §6 "Cuándo NO aplica")
status: ✅ done
last_updated: 2026-06-16
owner: Sergio Minei
branch: redesign
---

# S13 — Pasada final de auditoría

Penúltima sesión del subproyecto (antes de S14, la graduación a `docs/design/`). **No agrega features.** Barre
toda la app —ya con S1–S12 implementados— para verificar consistencia + accesibilidad + higiene, y **disponer**
cada ítem de los backlogs acumulados. Hallazgos + disposición completa en
[`_notes/s13-final-audit.md`](../_notes/s13-final-audit.md).

## Fase A — auditoría (read-only)

- **4 agentes Explore en paralelo** + verificación de fuente dirigida + resolución decisiva en código de los
  "verificar-primero" (F-11, F-12) y de los choques entre agentes (LanguageToggle, StoreAvatar, mk-journey-tile).
- **Resultado: sistema sano, cero bloqueantes.** Componentes canónicos adoptados sin reinvenciones; ADR 0006
  (icon+label) **enforced por TS**; paridad i18n es/en **limpia** (16/16); reduced-motion con cobertura global +
  por-superficie; vocabulario §9.17 consistente en 8/9 slots.
- **Disposición de backlogs:** pre-s12-audit (F-01…F-12), s4-gaps (G9/G10/G11/G13) y cross-cuttings 🟡
  (S6.1/S6.2/S6.3, S7-A.2) — cada uno marcado ✅ resuelto / 🔧 fix / 👍 aceptar / ⏸ diferir / ⚖️ juicio.

## Gate (Sergio, 2026-06-16)

- **F-03 Zilla:** "solo para el logo" → aceptar + documentar (ya acotado a `Logo`/favicon/OG, no leakea).
- **F-04 slot "Resumen":** investigar → **no es drift**, son dos familias de slot (accent "tus cosas" vs cool
  "recap de datos"), cada una consistente → aceptar + congelar la regla en §9.17.
- **Enforcement:** guardia grep cero-dep (aprobado).
- **N2 / F-12:** delegados → N2 removido el default ES; F-12 sin cambio (two-source intencional).

## Fase B — remediación (solo lo aprobado)

- **N1** `StoreAvatar` `oklch`→`oklab` (convención L074; verificado color-idéntico en light, **no era salmón**).
- **N5** removidos 5 keyframes muertos de `globals.css` (`banner-cta-subtle`, `hero-*`).
- **F-07 + N4** aria-labels por i18n (DateInput reusa `components.dateInput.clear`; nuevas keys
  `components.toast.regionLabel`, `components.wizard.stepActions`, `common.close`, `common.languageToggle.regionLabel`).
- **F-08** `SimpleIconSvg` decorativo (link ya localizado) + fallback de LanguageToggle por i18n.
- **N3** 2 comentarios a inglés. **N2** default ES removido.
- **Guardia** `src/test/design-token-guard.test.ts` (theme-blind + L074, cero-dep). Mocks de `next-intl` en los 2
  tests afectados (DateInput, MobilePicker).

### Hallazgo de método (registrado en lessons)

N1 mostró que **no toda mezcla `color-mix(in oklch)` sobre tokens neutros drifta**: cuando ambos endpoints
comparten el hue Velvet (285), oklch preserva el hue (idéntico a oklab). El drift L074 real requiere mezclar
contra `transparent` o tokens de hue ambiguo/chroma ~0. La convención sigue siendo **blanket** (neutrales en
oklab) porque no es evidente en tiempo de autoría cuál instancia va a derivar — y la guardia la enforce blanket.

## Validación de cierre (verde)

`type-check` ✅ · `lint` ✅ (0 errores) · `test` ✅ **544** (incl. guardia) · `validate-build` ✅ ·
e2e ✅ **15/15** (landing · auth · store-listing · deliveries) · preview: consola limpia, N1 color-idéntico en light.

## Pendiente para S14

- G13 (`1.5px` Checkbox → nota en `tokens.md`).
- Reflejar en el sistema final: Zilla = solo logo; §9.17 dos familias de slot resumen.
- Reemplazo de `docs/design/` con el sistema Velvet extraído de `docs/redesign/`.

**Agentes no commitean.** Sergio revisa y commitea.
