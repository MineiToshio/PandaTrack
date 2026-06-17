---
title: Módulo Landing + Onboarding (Auth + Legal) — S11
session: 11
phase: B implementada (código en src/ + validación verde + verificación visual vs demo)
status: implemented
last_updated: 2026-06-15
screens:
  - docs/redesign/screens/landing.md
  - docs/redesign/screens/auth.md
  - docs/redesign/screens/legal.md
frd_landing: docs/product/prd-00-pre-release-validation/frd-01-pre-release-landing/frd-01-pre-release-landing.md
frd_legal: docs/product/prd-00-pre-release-validation/frd-04-public-legal-transparency/frd-04-public-legal-transparency.md
frd_auth: docs/product/prd-01-collector-mvp/frd-01-account-access-and-recovery/frd-01-account-access-and-recovery.md
---

# Módulo Landing + Onboarding — S11

> **Sesión de módulo, superficies PÚBLICAS y ANÓNIMAS.** A diferencia de S6–S9
> (que viven dentro del shell `(app)`), S11 rediseña la landing, las páginas de
> auth y las páginas legales: superficies que el rediseño nunca tocó y que ya
> existían en código pre-rediseño. Paradigma de layout NUEVO (marketing
> full-bleed + auth cards + documento legal), **sin** app-shell.

## Resumen ejecutivo

S11 lleva las tres superficies públicas a Velvet en su **registro expresivo**
(mismos tokens/tipografía/status que el resto, usados en el extremo dramático del
sistema). La decisión de mayor impacto: la landing pasa de **waitlist** (pre-release,
FRD-01 PRD-00) a **go-live con sign-up** — el waitlist se reemplaza por completo y
los CTAs apuntan a `/sign-up`. "Onboarding" = pulir el flujo de auth existente
(no hay wizard first-run). Las legales (privacy/terms) entran como pase liviano.

## Decisiones de scope (Step 0, aprobadas por humano · 2026-06-14)

| #   | Decisión                      | Resolución                                                                                                           |
| --- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | Landing: ¿waitlist o sign-up? | **Go-live con sign-up.** Cambio de flujo aprobado explícitamente (ver `P-S11-01`).                                   |
| 2   | "Onboarding" = ¿qué?          | **Solo pulir auth** (sign-up → verify-email → entrada). Sin wizard first-run (excluido por FRD-07 L251 + wo-01 L60). |
| 3   | Legal (FRD-04)                | **Dentro de S11**, pase liviano (privacy + terms).                                                                   |
| 4   | Identidad visual              | **Velvet, registro expresivo.** Sin paleta/tipografía de marca aparte.                                               |
| —   | Waitlist                      | **Reemplazar del todo** — form + share fuera; Kit CRM / Google Sheets / referral retirados (dormidos).               |

## Pantallas del módulo

| Pantalla          | Spec                                | Anchors demo (desktop)                                                                                                                                       | Anchors demo (móvil)        |
| ----------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| Landing (go-live) | [landing.md](../screens/landing.md) | `#s11-landing`                                                                                                                                               | `#s11-landing-mobile`       |
| Auth              | [auth.md](../screens/auth.md)       | `#s11-sign-up` · `#s11-sign-in` · `#s11-sign-in-error` · `#s11-forgot-password` · `#s11-reset-password` · `#s11-verify-email` · `#s11-verify-email-required` | `#s11-sign-in-mobile`       |
| Legal             | [legal.md](../screens/legal.md)     | `#s11-legal-privacy` · `#s11-legal-terms`                                                                                                                    | `#s11-legal-privacy-mobile` |

## Funcionalidades preservadas (mapeadas a los FRD)

### Landing — FRD-01 PRD-00 (pre-release-landing)

| FR           | Comportamiento                                                         | Estado en S11                                                                             |
| ------------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| FR-01-01     | Secciones en orden narrativo estable                                   | **Preservado** (hero→userFit→features→banner→FAQ→footer). Se elimina la sección waitlist. |
| FR-01-02..07 | Form de waitlist (email req, name/comment opt, success/share, errores) | **Removido por go-live** (ver `P-S11-01`). El bloque de conversión pasa a CTAs sign-up.   |
| FR-01-08     | Copy localizada `es`/`en`                                              | **Preservado.** Copy nueva en `landing.json` (ES en A.3; EN en S12).                      |

### Auth — FRD-01 PRD-01 (account-access-and-recovery, IMPLEMENTED)

| FR / AC             | Comportamiento                                               | Estado en S11                                                                 |
| ------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| AC-01-01            | Ruta privada anónima → redirige a sign-in                    | Preservado (sin cambio; solo visual).                                         |
| AC-01-02            | Autenticado en /sign-in o /sign-up → dashboard               | Preservado.                                                                   |
| AC-01-03 / BR-01-05 | Sin verificar a los 7 días → gate de verificación            | Preservado — pantalla `#s11-verify-email-required`.                           |
| AC-01-04 / BR-01-07 | Recuperación sin enumeración (respuesta neutral)             | Preservado — `#s11-forgot-password` muestra nota neutral.                     |
| AC-01-05 / BR-01-06 | Token de reset válido + nueva contraseña; token vence 60 min | Preservado — `#s11-reset-password`; copia de "vence en 60 minutos" en verify. |
| —                   | Google sign-in con account linking                           | Preservado — botón Google en sign-up/sign-in.                                 |

### Legal — FRD-04 PRD-00 (public-legal-transparency, IMPLEMENTED)

| FR       | Comportamiento                                                | Estado en S11                                                                         |
| -------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| FR-04-01 | Privacy localizada                                            | Preservado — rediseño visual (`#s11-legal-privacy`).                                  |
| FR-04-02 | Terms localizada                                              | Preservado — rediseño visual (`#s11-legal-terms`).                                    |
| FR-04-03 | Contenido estructurado desde locale (privacy.json/terms.json) | Preservado — el demo muestra muestra representativa; el contenido real sigue en i18n. |
| FR-04-05 | Ruta clara de vuelta al home localizado                       | Preservado — back-link arriba + abajo.                                                |

## Cambios visuales aplicados en Fase A (✅ aprobados visualmente por Sergio · 2026-06-15)

- Paradigma de layout nuevo: marketing full-bleed (`mk-*`), auth cards centradas
  (`auth-*`), documento legal (`legal-*`). Ninguno usa `.app-shell`.
- Registro expresivo de Velvet: hero gradient (`mk-grad-text` + glows radiales),
  heading display grande (clamp), `mk-eyebrow` chip mono, icon-tiles con accent
  tints, banner gradient card, ritmo generoso.
- Chrome público: `mk-header` (landing, completo) vs `mk-minibar` (auth + legal, slim).
- `§9.17` (chip-eyebrow + top-accent de detalle) **NO** se transfiere a flujos
  lineales de marketing/auth — el eyebrow chip de marketing es decorativo, no el
  patrón de diferenciación de cards de detalle.

### Iteración A.2 (feedback de Sergio · 2026-06-15)

- **H1 con framing de colección en el texto grande.** Sergio: el eyebrow chico no
  alcanza para una marca desconocida; el titular debe decir que es para
  coleccionables. H1 = **"Toda tu colección, _bajo control_"** ("colección" en grande,
  "bajo control" en gradiente). Se evaluaron 3 opciones (copy deck del copywriter,
  con investigación de buenas prácticas de hero); A elegida. Alternativa explícita
  del flujo: B "Organiza tu colección, de la compra a la entrega" — disponible si
  Sergio prefiere literalidad.
- **Hero visual — ventana-producto unificada (round 3, respaldado por deep-research).**
  Dos intentos descartados: (1) barra de flujo abstracta con bolita ("no comunica");
  (2) collage de cards sueltas (seguía confundiendo). Diseño final (deep-research
  wf_eee2eca5, 19 claims confirmados): **un objeto-héroe (el coleccionable) recorre el
  ciclo y converge en un panel**, en UNA ventana — ribbon "El viaje de tu coleccionable"
  (Tienda→Pedido→Pago→Entrega con el token viajando, una estación se ilumina a la vez) +
  panel "Tu colección" (stats + ítems). Movimiento direccional, una sola cosa moviéndose
  a la vez, ease-out, loop ambiental; respeta `prefers-reduced-motion`. Diferenciación:
  los competidores solo muestran screenshot estático. Detalle en `screens/landing.md §6`;
  research en `_notes/research/hero-visual-deep-research.md`.
- **User-fit cards.** Más grandes y con la **barra inferior del color del ícono** de
  cada card (`--tile`: accent / accent-warm / accent-cool), que crece a **ancho
  completo en hover** (antes: 3 barras naranjas fijas). Recupera el comportamiento que
  al dueño le gustaba de la landing original.
- **Banner full-width.** Pasó de card contenida a banda edge-to-edge con gradient
  (`mk-banner-section`) — decisión: más impactante ocupando todo el ancho.
- **Copy investigado + términos canónicos.** Todo el copy de la landing reescrito con
  investigación (copywriter) y voz §7. Alineado al **glosario**: pedido / entrega /
  pre-reserva / pago / tienda (NO "orden"/"pre-orden"/"envío" como función). "Envíos"
  solo para el concepto físico de envío partido. (El demo previo de A.1 usaba
  "pre-orden/envíos" — corregido.)
- **Legal con contenido real.** Las páginas privacy/terms ahora muestran el contenido
  **verbatim** de `privacy.json` (12 secciones) y `terms.json` (9), por pedido de
  Sergio (los textos se mantienen como en la app). Solo se rediseña la presentación.

## Cambios de comportamiento e interacción aplicados

| Comportamiento                 | Pantalla / componente   | Original (FRD/código)           | Nuevo (rediseño)                                                                | Razón                                               | Requiere ADR?                            |
| ------------------------------ | ----------------------- | ------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------- |
| Conversión de la landing       | Landing                 | Form de waitlist + estado share | CTAs → `/sign-up` (go-live); sin form                                           | Decisión de producto `P-S11-01` (aprobada)          | No (es supersede de FRD, ver alineación) |
| Hero visual                    | Landing hero            | Sin hero animado (pre-rediseño) | Ventana-producto: ribbon de ciclo de vida (objeto-héroe viajando) + panel       | Comunicar el producto de un vistazo (deep-research) | No                                       |
| Nav interna de la landing      | Landing header/footer   | Scroll a anclas                 | Scroll suave con offset de header (`data-s11-scroll` en demo)                   | UX moderna                                          | No                                       |
| Menú móvil                     | Landing móvil           | Burger menu                     | Burger → sheet lateral (backdrop, cierre por tap/Esc)                           | Patrón estándar móvil                               | No                                       |
| FAQ                            | Landing FAQ             | (según impl. actual)            | Acordeón expand/collapse, primer item abierto                                   | Escaneable                                          | No                                       |
| Password reveal                | Auth forms              | Input password plano            | Toggle de visibilidad (ojo) en campos de contraseña                             | Reduce errores de tipeo                             | No                                       |
| Validación de auth             | Auth forms              | (según impl. actual)            | Post-blur + on-submit; foco al primer error                                     | Validación que ayuda, no que regaña                 | No                                       |
| Reenvío de verificación        | verify-email[-required] | Botón reenviar                  | Reenviar con **cooldown** anti-spam + feedback                                  | Evitar flood; claridad                              | No                                       |
| Recuperación de contraseña     | forgot-password         | Respuesta neutral (BR-01-07)    | Se preserva la respuesta neutral (sin enumeración) + nota visible               | Seguridad (sin cambio de FR)                        | No                                       |
| Toggles theme/lang en públicas | header / minibar        | (en app shell)                  | Toggles propios de la superficie pública (theme funcional, lang visual en demo) | La landing/auth no usan el app shell                | No                                       |

## Propuestas de cambio funcional (requieren aprobación explícita antes de Fase B)

### `P-S11-01` — Go-live: waitlist → sign-up (APROBADA en Step 0)

- **Original (FRD-01 PRD-00):** landing en modo waitlist (captura de email,
  estado success/share, integraciones Kit + Google Sheets + referral).
- **Nuevo (aprobado):** landing como puerta del collector MVP. CTAs (hero, banner,
  header, burger) → `/sign-up`; header suma "Iniciar sesión" → `/sign-in`. Se
  elimina el bloque waitlist y el estado share; integraciones Kit/Sheets/referral
  retiradas (dormidas, no borradas del repo en A — la baja se decide en B).
- **Impacto:** transición PRD-00 → PRD-01. FRD-01 PRD-00 queda **superseded**.
- **Requiere alineación de docs/product** (ver sección siguiente). **No se aplica
  a `docs/product/` en Fase A** (regla §7.alpha); se ejecuta como parte de Fase B
  con flag previo.

### `P-S11-02` — Nudge no bloqueante post-login (NO aprobada — anotada)

- Idea descartada en Step 0 para S11: welcome/empty-state opcional post-login que
  apunte a Settings (moneda base), sin bloquear ni prefill. Queda anotada por si
  Sergio la quiere como iteración futura. **Fuera de scope S11.**

## Alineación docs/product pendiente (anotada para Fase B — NO tocar en Fase A)

> Regla §7.alpha: modificar `docs/product/**` requiere flag + aprobación humana.
> Estas son las acciones a ejecutar en Fase B (con flag), no ahora.

1. **FRD-01 PRD-00 (pre-release-landing):** marcar como `superseded` / transición.
   La landing go-live pertenece al collector MVP (el propio FRD lo anticipa:
   _"later auth-first CTA behavior belongs to the collector MVP rather than this FRD"_).
   Decisión abierta: ¿FRD nuevo "collector-MVP landing" en PRD-01, o nota de
   transición en FRD-01? → resolver con Sergio en Fase B.
2. **FRD-04 PRD-00 (legal):** alineación liviana — sólo refresh de implementation
   notes/refs visuales. Sin cambio de FR.
3. **FRD-01 PRD-01 (auth):** sin cambio de FR (sólo visual). Posible refresh de notas.
4. **Gap de go-live (fuera de scope S11):** sign-up exitoso aterriza en el dashboard
   placeholder ("Coming Soon", fuera del rediseño — methodology §10). Go-live real
   necesita dashboard usable. Señalado, no resuelto por S11.

## Componentes propios del módulo

| Componente (rol)                               | Dónde        | Notas                                                                                                                                                                                   |
| ---------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marketing header + burger sheet                | landing      | Logo + nav (scroll interno) + theme/lang + CTAs sign-in/sign-up; sheet lateral en móvil.                                                                                                |
| Minibar pública                                | auth + legal | Logo (→ home) + theme/lang. Versión slim del header.                                                                                                                                    |
| Hero — ventana-producto animada                | landing      | Ribbon de ciclo de vida (objeto-héroe viajando + estaciones que se iluminan) + panel "Tu colección". Demo classes `mk-journey-*`, `mk-window`. **Comportamiento crítico, ver Handoff.** |
| Hero scaffolding                               | landing      | `mk-grad-text` (H1 highlight), glows radiales, trust line.                                                                                                                              |
| Problem cards (user-fit)                       | landing      | Index + icon-tile + **bottom bar del color del ícono** (`--tile`) → ancho completo en hover.                                                                                            |
| Feature cards                                  | landing      | Icon-tile con accent tint por card.                                                                                                                                                     |
| FAQ accordion                                  | landing      | Acordeón; evaluar reusar el patrón existente en Fase B.                                                                                                                                 |
| Banner full-width                              | landing      | Banda edge-to-edge con gradient (`mk-banner-section`).                                                                                                                                  |
| Auth card + field + password eye + status card | auth         | Reusan `Input` / `PasswordInput` / `Button` core en Fase B.                                                                                                                             |
| Legal doc layout + TOC + back-link             | legal        | Reusa/ajusta `LegalPageLayout` existente.                                                                                                                                               |

## Handoff a Fase B

> **Cómo usar este handoff.** Un agente fresco de Fase B debería poder implementar el
> módulo leyendo este doc + `screens/landing.md|auth.md|legal.md` + el HTML aprobado en
> `_notes/demo-screens.html` (anchors `#s11-*`) + las reglas de `docs/tooling/cursor/rules.md`.
> El HTML es la verdad visual; este doc es la verdad funcional/comportamental. **Paso 0
> obligatorio de Fase B:** abrir el demo en los anchors `#s11-*` y leer el workflow de
> cursor rules (methodology §6.ter). Los agentes NO commitean (commitea Sergio).

### Archivos a crear / modificar (`src/`)

**Landing — `src/app/[locale]/(landing)/`** (rediseño visual + go-live):

- `page.tsx`, `layout.tsx` — recomponer a layout marketing full-bleed; quitar el chrome viejo.
- `_components/Menu/Header.tsx`, `HeaderNav.tsx`, `BurgerMenu.tsx`, `ThemeToggle.tsx`, `LanguageToggle.tsx` — header marketing nuevo (logo + nav scroll + theme/lang + CTAs `Iniciar sesión`/`Crear cuenta`); burger → sheet lateral.
- `_components/Hero.tsx` — **reescritura mayor**: H1 + subtítulo + CTAs + la **ventana-producto animada** (ribbon de ciclo de vida + panel "Tu colección"). Ver "Comportamiento crítico".
- `_components/UserFit/UserFit.tsx`, `ProblemCard.tsx` — cards más grandes; bottom bar del color del ícono (`--tile`) a ancho completo en hover.
- `_components/Features/Features.tsx`, `FeaturesGrid.tsx`, `FeatureCard.tsx` — 6 cards, icon-tile con accent por card.
- `_components/Banner.tsx` — banda full-width con gradient → `/sign-up`.
- `_components/Faqs.tsx` — acordeón (primer item abierto).
- `_components/Footer.tsx` — brand + tagline + columnas (Producto/Cuenta/Legal) + social + copyright.
- `_components/Section.tsx` — ritmo/contenedor marketing.
- `_components/LandingJsonLd.tsx` — revisar JSON-LD (cambia de waitlist a producto).
- **Baja del waitlist:** `_components/Waitlist/{Waitlist,WaitlistForm,WaitlistShare,submitWaitlist,waitlistSchema}.tsx|ts` → retirar del render de la landing. Ver "Plan de baja del waitlist".

**Auth — `src/app/[locale]/(auth)/`** (solo presentación; flujo intacto):

- `_components/AuthFormLayout.tsx` — card centrada (`auth-card`) + minibar pública + glow.
- `_components/AuthStatusCard.tsx` — status card (icon tile tone accent/warning/success) para verify-email[-required].
- `_components/{SignInForm,SignUpForm,EmailPasswordForm,ForgotPasswordForm,ResetPasswordForm}.tsx` — restyle (auth-field, labels, errores, password eye).
- `_components/GoogleSignInButton.tsx` — botón Google (logo multicolor, exento de theming).
- `forgot-password|reset-password|sign-in|sign-up|verify-email[/confirm]|verify-email-required/page.tsx` — wrappers.
- Tests existentes en `_components/_tests/` deben seguir pasando.

**Legal — `src/app/[locale]/`** (solo presentación; contenido i18n verbatim):

- `_components/LegalPageLayout.tsx` — restyle a `legal-doc` (back-link, head con eyebrow + fecha, TOC, secciones). Linkeado desde el footer de la landing **y** desde `ShellAccountMenu` del app.
- `privacy/page.tsx`, `terms/page.tsx` — sin tocar contenido (viene de i18n).

**i18n — `src/i18n/locales/{es,en}/`**:

- `landing.json` — reescribir a go-live (ver "Copy aprobada"); **eliminar `waitlist`**; mantener `hero/userFit/features/banner/faqs/footer/header/meta/og*`.
- `privacy.json` / `terms.json` — **sin cambios** (legal verbatim).
- Auth: reusar/extender los namespaces auth existentes; las cadenas ES del demo son las aprobadas.
- EN se completa en S12 (esta sesión deja ES).

### Componentes core a consumir (de `src/components/`)

- `Button` (CTAs, submits) — variantes primary/ghost.
- `Input` + `PasswordInput` (auth; el eye toggle ya existe en `PasswordInput`).
- Iconos vía la convención de `icons.mdc` (lucide). Iconos usados: `sparkles, store, package, wallet, truck, book-open, bell, badge-check, layout-dashboard, shopping-bag, badge-dollar-sign, line-chart, layers, target, layout-grid, help-circle, shield, scroll-text, calendar, mail, mail-check, shield-alert, arrow-left, arrow-right, eye, eye-off, alert-circle, info, menu, x, sun, moon, chevron-down, message-circle, send, check`.
- `StatusChip`/`.chip` para los chips del hero/estado.
- Toggles theme: reusar el mecanismo `data-theme` / `setTheme` existente (ADR 0003 D2; solo light/dark, sin `system`).

### Tokens a usar

- Superficie/texto/borde: `--surface`, `--surface-elevated`, `--background`, `--border`, `--border-strong`, `--text-primary/secondary/muted`.
- Acento expresivo: `--accent`, `--accent-warm`, `--accent-cool` (H1 gradient, glows, icon-tiles, banner, journey, barras user-fit).
- Status: `--success`, `--warning`, `--info`, `--destructive` (chips, estados de error de auth).
- Motion: reusar los tokens/convenciones de `globals.css` (`--motion-base`, `--ease-out-expressive`, etc.) y el bloque global `@media (prefers-reduced-motion: reduce)`. **No** hardcodear duraciones/colores.
- **Solo Velvet** (methodology §6.bis.2). Sin `data-palette`.

### Copy aprobada (i18n · ES; EN en S12)

> Estructura sobre el namespace `landing` existente. Glosario: **pedido / entrega / pre-reserva / pago / tienda** (NO orden/pre-orden/envío como función).

| Clave (landing.\*)          | ES                                                                                                                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hero.eyebrow`              | Para coleccionistas                                                                                                                                                                          |
| `hero.title` (+ highlight)  | Toda tu colección, **bajo control** (resaltar "bajo control")                                                                                                                                |
| `hero.subtitle`             | Reúne tus pedidos de cualquier tienda, controla pre-reservas, pagos y entregas, y recibe un aviso antes de cada fecha clave.                                                                 |
| `hero.ctaPrimary`           | Crear cuenta gratis                                                                                                                                                                          |
| `hero.ctaSecondary`         | Ver cómo funciona                                                                                                                                                                            |
| `hero.trust`                | Gratis para empezar · Sin tarjeta                                                                                                                                                            |
| `hero.demo.caption`         | El viaje de tu coleccionable                                                                                                                                                                 |
| `hero.demo.steps`           | Tienda · Pedido · Pago · Entrega                                                                                                                                                             |
| `hero.demo.panelTitle`      | Tu colección                                                                                                                                                                                 |
| `hero.demo.stats`           | Gastado · Pendiente · En camino                                                                                                                                                              |
| `header.nav`                | Para quién · Funciones · Preguntas                                                                                                                                                           |
| `header.signIn` / `signUp`  | Iniciar sesión / Crear cuenta                                                                                                                                                                |
| `userFit.eyebrow`           | El día a día de coleccionar                                                                                                                                                                  |
| `userFit.title`             | Tu colección crece. El desorden, también.                                                                                                                                                    |
| `userFit.subtitle`          | Cuando compras en varias tiendas, es fácil perder el hilo de qué pagaste, qué falta y qué está por llegar.                                                                                   |
| `userFit.cards[0]`          | **Pedidos por todas partes** — Confirmaciones en el correo, capturas en el teléfono, mensajes en chats. Tu colección vive en diez lugares distintos.                                         |
| `userFit.cards[1]`          | **«¿Esto ya lo pagué?»** — Entre señas, saldos y pre-reservas, recordar cuánto debes y a quién se vuelve un dolor de cabeza.                                                                 |
| `userFit.cards[2]`          | **Entregas que no sabes dónde están** — Pedidos que llegan por partes y fechas que se te pasan. Te enteras tarde, o nunca.                                                                   |
| `features.eyebrow`          | Todo en un solo lugar                                                                                                                                                                        |
| `features.title`            | Lo que necesitas para llevar tu colección al día                                                                                                                                             |
| `features.subtitle`         | Desde la compra hasta que llega a tus manos, PandaTrack te acompaña en cada paso.                                                                                                            |
| `features.cards.stores`     | **Tiendas de confianza** — Guarda las tiendas donde compras y reconoce de un vistazo a las que ya conoces.                                                                                   |
| `features.cards.orders`     | **Tus pedidos, ordenados** — Registra cada pedido de cualquier tienda, con sus productos y su costo, en una sola lista clara.                                                                |
| `features.cards.preorders`  | **Pre-reservas sin sorpresas** — Lleva la cuenta de lo que ya señaste y lo que aún falta pagar, pedido por pedido.                                                                           |
| `features.cards.deliveries` | **Entregas, incluso divididas** — Sigue cada entrega y maneja sin problema los pedidos que llegan en varios envíos.                                                                          |
| `features.cards.reminders`  | **Avisos a tiempo** — Te recordamos un pago o una fecha clave antes de que se te pase, por ti.                                                                                               |
| `features.cards.dashboard`  | **Todo de un vistazo** — Ve el estado de tus pedidos, los próximos pagos y cuánto llevas gastado, todo en una pantalla.                                                                      |
| `banner.eyebrow`            | Empieza hoy                                                                                                                                                                                  |
| `banner.title`              | Tu colección merece estar en orden                                                                                                                                                           |
| `banner.subtitle`           | Crea tu cuenta gratis y reúne tus pedidos, pagos y entregas en un solo lugar. Toma menos de un minuto.                                                                                       |
| `banner.cta`                | Crear cuenta gratis                                                                                                                                                                          |
| `faqs.items` (5)            | ¿PandaTrack es gratis? · ¿Funciona con cualquier tienda? · ¿Tengo que cargar todo a mano? · ¿Mis datos están seguros? · ¿En qué idiomas está? (respuestas en `screens/landing.md §7` / demo) |
| `footer.tagline`            | Toda tu colección en un solo lugar: pedidos, pre-reservas y entregas.                                                                                                                        |
| `footer.cols`               | Producto (Funciones, Preguntas) · Cuenta (Crear cuenta, Iniciar sesión) · Legal (Privacidad, Términos)                                                                                       |
| `footer.copyright`          | © 2026 PandaTrack · Hecho para coleccionistas                                                                                                                                                |

Auth (reusar/extender namespaces auth; ES aprobado en el demo): sign-up "Crea tu cuenta / Empieza a organizar tu colección. Es gratis." · sign-in "Bienvenido de nuevo / Inicia sesión para seguir con tu colección." · divider "o con tu email" · Google "Continuar con Google" · forgot "¿Olvidaste tu contraseña? …" + nota neutral · reset "Crea una nueva contraseña" · verify "Revisa tu correo …" + "El enlace vence en 60 minutos" · verify-required "Verifica tu email para continuar / Pasaron los 7 días…". Chip de pre-reserva en el hero: **"Pre-reserva"** (no "Seña").

### Decisiones cerradas durante la iteración

- Landing = **go-live con sign-up**; waitlist **eliminado** (`P-S11-01`).
- "Onboarding" = pulir auth; **sin wizard first-run** (FRD-07 L251, wo-01 L60).
- Identidad = **Velvet, registro expresivo** (sin paleta de marca aparte).
- H1 = "Toda tu colección, **bajo control**" (opción A; B disponible si Sergio cambia de idea).
- Hero = **ventana-producto** (ribbon de viaje + panel), NO collage ni bolita abstracta (ambos descartados por confusos). Respaldado por deep-research.
- User-fit bar = color del ícono, a ancho completo en hover. Banner = full-width.
- Legal = contenido **verbatim** de i18n (no reescribir).
- Chip "Seña" → "Pre-reserva".
- Window del hero **sin rotación** (recta + float vertical sutil).

### Comportamiento crítico para Fase B

- **Hero animado (ver `screens/landing.md §6`):** un objeto-héroe (coleccionable) viaja Tienda→Pedido→Pago→Entrega; cada estación se ilumina al pasar el token (**una a la vez**, escalonada); la línea de progreso se rellena **sincronizada con el token** (en la última estación el fill llega al 100% = posición del token — bug corregido en A.2). Entrada una sola vez + loop ambiental. **Solo `transform`/`opacity`**, **respeta `prefers-reduced-motion`** (loops a 1 iteración, estado estático legible). Ventana **recta** (sin rotate). Implementar con CSS `@keyframes` (o scroll-driven como enhancement opcional, no Baseline).
- **Nav de la landing:** scroll suave con offset del header sticky; sticky `top-0` en producción.
- **Burger (móvil):** sheet lateral con backdrop, focus trap, cierre por tap-fuera / Esc / link, retorno de foco.
- **FAQ:** acordeón accesible (`aria-expanded`, teclado), primer item abierto.
- **Auth:** password eye toggle (type + icono + aria-label); validación post-blur + on-submit con foco al primer error; `forgot-password` mantiene **respuesta neutral** (sin enumeración, BR-01-07); reenvío de verificación con **cooldown**; token de reset vence 60 min (BR-01-06); gate de verificación a los 7 días (AC-01-03).
- **Optimistic/mutaciones:** aplicar `optimistic-client-updates.mdc` donde haya mutación visible (waitlist ya no aplica; sign-up/sign-in siguen su patrón actual).

### Edge cases acordados

- Hero en `prefers-reduced-motion`: sin loops, estado final legible (no en blanco).
- Móvil (390px): el hero colapsa al mismo diseño (las 4 estaciones entran); el burger sheet no debe desbordar el frame.
- Auth con error: banner `auth-form-error` + inputs `is-error` + `aria-invalid`.
- Landing sin JS (SSR): la ventana del hero debe verse correcta estática (la animación es progressive enhancement).
- Legal: el back-link preserva el locale (es/en).

### Anti-patrones

- No reintroducir el waitlist ni el estado share.
- No volver a la bolita abstracta ni al collage de cards sueltas en el hero.
- No usar `disc-3`/CD como ícono de coleccionable (usar manga/figura).
- No hardcodear colores/duraciones; no `text-white`/`#fff`; theme-aware siempre.
- No app-shell en landing/auth/legal.
- No aplicar §9.17 (chip-eyebrow + top-accent de detalle) a estos flujos lineales.
- No reescribir el contenido legal (viene de i18n).
- No introducir libs de UI nuevas (ADR 0010; `ui-libs-policy.mdc`).

### Plan de baja del waitlist

- Quitar `Waitlist/*` del render de `(landing)/page.tsx`.
- Decidir con Sergio si se **borra** el código del waitlist + integraciones (Kit CRM, Google Sheets append, referral share) o se deja dormido. Revisar env vars asociadas (`env-example.mdc`) y `submitWaitlist.ts`.
- Eventos PostHog de waitlist → reemplazar por funnel de sign-up (`posthog-events.mdc`, `POSTHOG_EVENTS`).
- Tests de waitlist (`_components/Waitlist/_tests/*`, `e2e/landing.spec.ts`) → actualizar/retirar.

### Alineación docs/product (flag previo, regla §7.alpha)

- FRD-01 PRD-00 (pre-release-landing) → marcar superseded / transición a PRD-01 (¿FRD nuevo o nota? resolver con Sergio).
- FRD-04 legal + FRD-01 auth → alineación liviana (refresh de notas, sin cambio de FR).
- Gap go-live: dashboard placeholder (fuera de scope S11).

### Preguntas abiertas

- ¿H1 final A o B? (default: A, ya aprobada).
- ¿Chip del hero "Pre-reserva" o variante "Pago parcial"/"Saldo pendiente"? (default: "Pre-reserva").
- ¿Borrar o dormir el código del waitlist + integraciones?
- ¿Transición FRD-01 PRD-00 como FRD nuevo o nota?
- (Research) ¿layout centrado vs side-by-side? ¿scroll-driven? — no necesarios; mejoras opcionales.

### Validación esperada al cierre de Fase B

- `npm run test` · `npm run type-check` · `npm run lint` · `npm run validate-build` — todos ✅.
- `npm run test:e2e` con `e2e/landing.spec.ts` y `e2e/auth.spec.ts` (actualizados al nuevo flujo go-live).
- Verificación visual contra el demo (`#s11-*`) en light+dark+desktop+390px: 0 gaps significativos.
- Cobertura del handoff expresada en % (objetivo 100%).

## Cláusula de spec vigente (cross-cutting safety)

Si entre el cierre de Fase A y la ejecución de Fase B se abren mini-sesiones
correctivas que toquen componentes core consumidos por estas superficies
(`Button`, `Input`, `PasswordInput`, `LegalPageLayout`), esta spec se subordina a
esos ADRs. Verificar `_notes/cross-cutting-changes.md` antes de implementar.
