---
title: S11 — Landing + Onboarding (Auth + Legal)
session: 11
type: módulo (Tipo 3 — 2 conversaciones, Fase A iterativa + Handoff)
phase: A + B cerradas (2026-06-15) — módulo completo
owner: Sergio Minei
last_updated: 2026-06-15
---

# S11 — Landing + Onboarding · Fase A

> Sesión de módulo sobre las superficies **públicas y anónimas** que el rediseño
> nunca había tocado y que ya existían pre-rediseño: **landing**, **auth** y **legal**.
> Paradigma de layout nuevo (sin app-shell). Los agentes NO commitean — commitea Sergio.

## Step 0 — Menú de decisiones (gate de scope, aprobado por Sergio)

Antes de construir, se auditaron las 3 superficies contra sus FRDs y se trajo un menú
de decisiones. Resueltas:

1. **Landing: go-live con sign-up** (NO waitlist). Cambio de flujo aprobado → `P-S11-01`.
   El waitlist se reemplaza por completo (form + share fuera; Kit/Sheets/referral retirados).
2. **"Onboarding" = pulir el flujo de auth** (sign-up → verify-email → entrada). **Sin**
   wizard first-run (excluido por FRD-07 L251 + wo-01 L60).
3. **Legal (privacy/terms) dentro** de S11 (pase liviano).
4. **Identidad: Velvet, registro expresivo** (sin paleta/tipografía de marca aparte).

FRDs que gobiernan: PRD-00/FRD-01 (pre-release-landing, ACTIVE/IMPLEMENTED, waitlist) ·
PRD-00/FRD-04 (legal, IMPLEMENTED) · PRD-01/FRD-01 (account-access, IMPLEMENTED).

## Fase A.1 — Demo + specs bootstrap

- Demo extendido: `_notes/demo-screens.html`, dropdown **"S11 · Landing+Auth"**, 13
  pantallas `#s11-*` (landing + 6 auth + 2 legal + 3 móviles), light+dark, desktop+390px.
- Layout paradigm nuevo (sin `.app-shell`): marketing full-bleed (`mk-*`), auth cards
  centradas (`auth-*`), documento legal (`legal-*`). Chrome: `mk-header` (landing) /
  `mk-minibar` (auth+legal). Nav e índice del demo sincronizados.
- Specs bootstrappeados: `screens/landing.md`, `auth.md`, `legal.md` + doc maestro
  `modules/landing-onboarding.md`.
- Validado en preview (Velvet): consola limpia.

## Fase A.2 — Iteración visual (rondas con Sergio)

- **H1 con framing de colección** en el texto grande (la marca es desconocida): "Toda
  tu colección, **bajo control**".
- **Copy investigado** (subagente copywriter + buenas prácticas) y alineado al **glosario**:
  pedido / entrega / pre-reserva / pago / tienda (se corrigió "pre-orden/envíos" del A.1).
- **Banner full-width** (banda edge-to-edge).
- **User-fit cards**: más grandes + barra inferior del **color del ícono** a ancho completo en hover.
- **Legal con contenido real** verbatim (`privacy.json` 12 secciones / `terms.json` 9).
- **Hero — 3 iteraciones** hasta acertar:
  1. Barra de flujo abstracta con bolita → descartada ("no comunica").
  2. Collage de cards sueltas → descartada (seguía confundiendo).
  3. **Ventana-producto** (final, aprobada): ribbon "El viaje de tu coleccionable"
     (objeto-héroe que viaja Tienda→Pedido→Pago→Entrega, una estación se ilumina a la vez)
     - panel "Tu colección". Respaldado por **deep-research** (`_notes/research/hero-visual-deep-research.md`,
       107 agentes, 19 claims confirmados / 6 refutados: NN/g motion, Evil Martians, Collectr).
  - Ajustes finales: ventana sin rotación (recta), línea sincronizada con el token
    (llega al 100% en Entrega), ícono de coleccionable manga/figura (no CD), chip
    "Pre-reserva" (no "Seña").

## Fase A.3 — Cierre + Handoff

- Gate visual de Sergio: **aprobado** ("me encanta cómo ha quedado").
- Specs completados (sin marcadores PENDING). Doc maestro con:
  **Cambios visuales** + **Cambios de comportamiento** (tabla) + **Componentes propios** +
  **Handoff a Fase B completo** (archivos `src/`, componentes core, tokens, copy aprobada
  ES, decisiones cerradas, comportamiento crítico, edge cases, anti-patrones, plan de baja
  del waitlist, alineación docs/product, preguntas abiertas, validación esperada).

## Propuestas funcionales

- `P-S11-01` — go-live waitlist→sign-up: **APROBADA**.
- `P-S11-02` — nudge no bloqueante post-login: anotada, **fuera de scope** S11.

## Alineación docs/product (anotada para Fase B — NO aplicada en A, regla §7.alpha)

- FRD-01 PRD-00 (pre-release-landing) → supersede / transición a PRD-01.
- FRD-04 legal + FRD-01 auth → alineación liviana (sin cambio de FR).
- Gap go-live: el dashboard destino sigue placeholder (fuera de scope S11).

## Artefactos producidos

- `_notes/demo-screens.html` (13 anchors `#s11-*`).
- `screens/landing.md` · `screens/auth.md` · `screens/legal.md`.
- `modules/landing-onboarding.md` (doc maestro + Handoff a Fase B).
- `_notes/research/hero-visual-deep-research.md` (reporte de investigación citado).

## Validación Fase A

Visual en preview de todas las pantallas nuevas (light+dark, desktop+390px) · nav e
índice del demo consistentes · cero errores de consola. Sin código React en Fase A.

## Fase B — Implementación (cerrada 2026-06-15)

Implementada en `src/` sobre `redesign`, partiendo del Handoff:

- **Landing go-live**: layout marketing full-bleed + hero ventana-producto animada (ribbon de ciclo de vida con objeto-héroe viajando + panel "Tu colección"), user-fit, features (6), banner full-width, FAQ accordion (primer item abierto), footer. CTAs → `/sign-up` · `/sign-in`. Chrome público compartido promovido a `[locale]/_components/public/` (BrandMark, PublicMinibar, theme/lang toggles).
- **Waitlist eliminado**: `Waitlist/*`, `submitWaitlist`, schema, integraciones Kit/Sheets/referral, env vars y eventos PostHog (reemplazados por el funnel de sign-up).
- **Auth**: restyle visual de las 6 pantallas (cards centradas + minibar + status cards), flujo/AC intactos; reset suma campo "repetir" con validación de match. Reusa `Button`/`Input`/`PasswordInput`.
- **Legal**: `LegalPageLayout` a documento standalone (back-link, eyebrow, TOC, secciones numeradas); contenido i18n verbatim.
- **i18n**: `landing.json` / `auth.json` / `common.json` en es + en.
- **Iteración con Sergio (post-implementación)**: "Iniciar sesión" → `secondary` en header y burger (peso visual equilibrado con el primary); footer "Producto" suma "Para quién".

CSS `mk-*` / `auth-*` / `legal-*` porteado a `globals.css` con tokens del repo. Solo Velvet, theme toggle activo, sin app-shell, sin libs UI nuevas (ADR 0010).

### Validación Fase B

`npm run test` (542) · `type-check` · `lint` (0 errores) · `validate-build` · `test:e2e` (landing + auth, 10) — todo verde. Verificación visual vs demo `#s11-*` en light/dark/desktop/390px: sin gaps. Cobertura del handoff ~100%.

### Alineación docs/product (flag §7.alpha aprobado por Sergio)

FRD-01 PRD-00 (pre-release-landing) marcado **SUPERSEDED** con nota de transición go-live; FRD-04 (legal) y FRD-01 PRD-01 (auth) con nota de implementación S11. README del rediseño + este doc actualizados.

### Pendientes señalados

- Sincronizar GitHub Project `4` / issues con los docs (fuera del alcance de esta herramienta).
- Gap go-live: el dashboard destino sigue placeholder (fuera de scope S11).

**S11 cerrada.** Próxima: S12.
