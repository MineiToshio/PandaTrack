---
title: Auth (sign-up · sign-in · recovery · verification)
session: 11
status: html-in-review
last_updated: 2026-06-14
demo_anchors:
  - "#s11-sign-up"
  - "#s11-sign-in"
  - "#s11-sign-in-error"
  - "#s11-forgot-password"
  - "#s11-reset-password"
  - "#s11-verify-email"
  - "#s11-verify-email-required"
  - "#s11-sign-in-mobile"
frd: docs/product/prd-01-collector-mvp/frd-01-account-access-and-recovery/frd-01-account-access-and-recovery.md
module: docs/redesign/modules/landing-onboarding.md
---

# Auth — sign-up · sign-in · recovery · verification

## 1. Propósito y contrato funcional

Rediseño visual del flujo de auth (FRD-01 PRD-01, IMPLEMENTED). "Onboarding" de S11
= este on-ramp (sign-up → verify-email → entrada). Cards centradas, sin app-shell.
Sin cambios de flujo: mismos FR/AC, sólo presentación. No hay wizard first-run.

## 2. Variantes y anchors del demo

| Pantalla                        | Anchor                       | Patrón                              |
| ------------------------------- | ---------------------------- | ----------------------------------- |
| Crear cuenta                    | `#s11-sign-up`               | form + Google + términos            |
| Iniciar sesión                  | `#s11-sign-in`               | form + Google + "¿la olvidaste?"    |
| Iniciar sesión · error          | `#s11-sign-in-error`         | banner form-error + inputs is-error |
| Olvidé contraseña               | `#s11-forgot-password`       | email + nota neutral (BR-01-07)     |
| Restablecer contraseña          | `#s11-reset-password`        | password + repetir (eye toggle)     |
| Verificar email · enviado       | `#s11-verify-email`          | status card accent + reenviar       |
| Verificar email · bloqueo día 7 | `#s11-verify-email-required` | status card warning (AC-01-03)      |
| Móvil (representativa)          | `#s11-sign-in-mobile`        | card en frame 390px                 |

## 3. Layout y estructura

- **Minibar** (`mk-minibar`) — logo home + ES/EN + theme.
- **`auth-wrap`** — centrado, `auth-glow` (halo accent superior).
- **`auth-card`** (`max-width 408px`) — head (h1 + sub) · [Google + divider] ·
  campos (`auth-field` + `auth-label` + `.input`) · [acciones] · `auth-foot`.
- Password: `auth-input-wrap` + `.input` + `auth-eye` (toggle visibilidad).
- Status (verify): `auth-status-icon` (accent / `tone-warning` / `tone-success`) +
  head + acción + `auth-note`.
- Errores: `auth-form-error` (banner) + `.input.is-error` + `auth-error` (inline).

## 4. Tokens relevantes

- `--surface` (card), `--surface-elevated` (inputs/Google), `--border-strong`.
- `--accent` (focus ring, links, primary, glow, status icon default).
- `--destructive` (errores: banner, borde is-error, texto inline).
- `--warning` (status icon del gate día 7), `--success` (status ok).

## 5. Estados visuales

- Default / focus (ring accent) / error (banner `auth-form-error` + inputs `is-error`) /
  submit en curso (botón disabled + spinner) / password visible-oculto.

## 6. Comportamiento e interacción

- **Validación:** post-blur + on-submit; el error se limpia al volver a interactuar.
  Foco inicial al primer campo; en submit con error, foco al primer campo inválido.
- **Password eye:** toggle `type` password↔text + swap de icono (`eye`/`eye-off`) +
  `aria-label` actualizado (demo OK; en Fase B lo provee `<PasswordInput>` core).
- **Google:** botón con estado de carga; redirect del flujo Better Auth existente.
- **Reenviar verificación:** con **cooldown** anti-spam + feedback (toast/línea).
- **Forgot-password:** **respuesta neutral siempre** (sin enumeración, `BR-01-07`).
- **Reset:** validar match de contraseñas; el token vence a los **60 min** (`BR-01-06`).
- **Gate día 7** (`AC-01-03`): `verify-email-required` bloquea hasta verificar.
- Flujo/AC **sin cambios** — S11 es solo presentación sobre el auth IMPLEMENTED.

## 7. i18n keys propuestas

Reusar/extender los namespaces de auth existentes (flujo IMPLEMENTED). Las cadenas ES
aprobadas (del demo) están listadas en el **Handoff del módulo**
([modules/landing-onboarding.md](../modules/landing-onboarding.md) §"Copy aprobada" → bloque Auth):
sign-up/sign-in heads, divider "o con tu email", "Continuar con Google", nota neutral de
forgot, "El enlace vence en 60 minutos", gate día 7, chip "Pre-reserva". EN en S12.

## 8. Accesibilidad acordada

- Labels asociados (`htmlFor`/`id`); inputs con `aria-invalid` + `aria-describedby` al error.
- Banners de error con `role="alert"`; status cards (verify) con heading h1.
- Foco gestionado (inicial + al primer error); password eye con `aria-label` dinámico.
- Contraste verificado light+dark; tap targets ≥44px; card centrada con `<main>` landmark.

## 9. Anti-patrones

- No introducir wizard first-run ni prefill de preferencias (FRD-07 L251, wo-01 L60).
- No hand-rollear inputs/botón: en Fase B reusar `<Input>`, `<PasswordInput>`, `<Button>`.
- El logo de Google es marca: colores fijos (exento de theming).
- No cambiar el flujo/AC: S11 es sólo visual sobre el auth IMPLEMENTED.

## 10. Notas para Fase B

Archivos React: `src/app/[locale]/(auth)/*` (sign-in, sign-up, forgot-password,
reset-password, verify-email[+required], `_components/AuthFormLayout`,
`AuthStatusCard`, `*Form`, `GoogleSignInButton`, `PasswordInput`). Sólo presentación.
Ver handoff en [modules/landing-onboarding.md](../modules/landing-onboarding.md).
