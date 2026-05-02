---
title: Settings
session: 02
status: lo-fi-wireframe + post-closure updates
last_updated: 2026-05-01
post_closure_adr: ../decisions/0001-s2-closure-decisions.md
---

# Settings

> **Addendum post-S2 (2026-05-01)** — Decisiones aplicadas tras research, ver [`ADR 0001`](../decisions/0001-s2-closure-decisions.md):
>
> - Decisión 15: layout desktop confirmado **Opción A** — tabs verticales cols 1-3 + contenido cols 4-12. Default Profile activa.
> - Decisión 14: theme toggle en `preferences` con 3 opciones `light` / `dark` / `system`, default `system`. Misma fuente de verdad `localStorage["theme"]` que el shell.
> - Decisión 17: el toggle "Mostrar mascota" vive en `preferences` (current). **Bonus de descubribilidad:** right-click (desktop) / long-press (mobile) en la mascota misma abre menú contextual con: `Ocultar mascota` · `Cambiar tema` · `Configuración`.
> - Decisión 18: el chip warning con timer del cooldown de username aparece **sólo durante el período activo de cooldown** (post-cambio). Cuando termina, el chip desaparece y el input vuelve a estado normal editable. NO mostrar el chip permanentemente.
> - Decisión 19: el botón "Cerrar sesión en todos los dispositivos" se muestra siempre que la capability exista en el backend (BetterAuth la soporta), sin condicionar al número de sesiones activas.
> - Decisión 11: nuevo campo `preferences.preferredDensity` (S3+) refleja el toggle densa/cómoda de la lista de pedidos.
> - Decisión 16: spec final del componente `<StoreAvatar size={24|32|40|56} />` con UNA sola letra (monograma de marca) — aplica también al avatar del usuario (mismo componente reusado para tienda y para usuario).

## 1. Propósito y contrato funcional

Pantalla utilitaria donde el usuario edita su identidad, credenciales y preferencias de coleccionista (ver fila #24 + sub-flujos 24.a Profile / 24.b Account / 24.c Preferences en `functional-inventory.md`). Datos clave por sección — **Profile**: `username` (unique, regex, blocked words, cooldown 30d), `displayName` (max 50), `avatar` (upload + crop). **Account**: `email + verified flag`, `password` (`canChange`/`canSet`), `mfa` toggle si hay capability. **Preferences**: `preferredCountryCode`, `baseCurrencyCode` (cambio dispara modal de confirmación), `preferredProductTypeKeys` (multi-select), `budgetAmount` (cents) y `budgetResetDayOfMonth` (1–31). Acciones: editar inline cada campo, validaciones específicas (debounced availability para username, password reglas inline, currency change con modal destructivo), un edit activo a la vez. Permisos: `verified` — gate de la app entera, no se duplica en esta pantalla.

## 2. Wireframe mobile (360px)

```
┌──────────────────────────────────────────┐
│ ← Atrás                          [···]   │   56px content header
├──────────────────────────────────────────┤
│                                          │
│  AJUSTES                                 │   eyebrow mono uppercase text-muted
│  Tu cuenta                               │   Display 32pt tracking -0.03em
│  Edita tu perfil, acceso y preferencias. │   Body-L text-secondary
│                                          │
│  ┌────────────────────────────────────┐  │   ← CARD 1 · Profile (EXPANDED)
│  │ PERFIL                          ▴  │  │   surface, radius-xl, padding 20px
│  │ Tu identidad                       │  │   Title 19pt
│  │ Cómo te ven en la app.             │  │   Body 13 text-secondary
│  │ ──────────────────────────────────  │  │
│  │ Usuario                            │  │   label text-secondary 13px
│  │ @sergio_m            ✎             │  │   value 15px / 500 + pencil
│  │ ──────────────────────────────────  │  │
│  │ Nombre visible                     │  │
│  │ Sergio Minei         ✎             │  │
│  │ ──────────────────────────────────  │  │
│  │ Avatar                             │  │
│  │ ╭──╮                               │  │   56px circular
│  │ │ S│   [ Cambiar avatar ]          │  │   ghost button + ícono camera
│  │ ╰──╯   [ Eliminar ]                │  │   destructive ghost (si existe)
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │   ← CARD 2 · Account (COLLAPSED)
│  │ CUENTA                          ▾  │  │   eyebrow mono
│  │ Email, contraseña y acceso         │  │   Body 13
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │   ← CARD 3 · Preferences (COLLAPSED)
│  │ PREFERENCIAS                    ▾  │  │
│  │ País, moneda, categorías, presupuesto │
│  └────────────────────────────────────┘  │
│                                          │
│  ─────────────────────────────────────   │
│  [ Cerrar sesión ]                       │   ghost destructive, full-width
│                                          │
└──────────────────────────────────────────┘

  Estado editing inline (Username):
  ┌────────────────────────────────────┐
  │ Usuario                            │
  │ ┌────────────────────────────────┐ │   input expandido
  │ │ @sergio_minei            ✓     │ │   check verde · available
  │ └────────────────────────────────┘ │
  │ Disponible.                        │   helper success
  │ [ Guardar ]   [ Cancelar ]         │   primary indigo + ghost
  └────────────────────────────────────┘
```

## 3. Wireframe desktop (≥1024px)

**Opción elegida: A — tabs verticales.** Justificación: el patrón de "settings con sidebar de secciones" (Vercel, Linear, Stripe Dashboard) se reconoce inmediatamente, mantiene una sola decisión activa por viewport (§2 principios), y deja respiración al detalle de la sección activa sin obligar al scroll que sí pediría la opción B. El shell `max-w-6xl` con grid 12 cols ya es la convención del resto de pantallas de S2.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Sidebar 240px │  Content (max-w-6xl, px-8 py-10)                            │
│   Dashboard   │                                                             │
│   Pedidos     │   AJUSTES                                                   │
│   Tiendas     │   Tu cuenta                                                 │
│   Entregas    │   Edita tu perfil, acceso y preferencias.                   │
│ ▸ Ajustes     │                                                             │
│   Salir       │   ┌─────────────────┬────────────────────────────────────┐  │
│               │   │ cols 1-3        │ cols 4-12                          │  │
│               │   │ TABS VERTICALES │ SECTION CARD ACTIVA                │  │
│               │   │                 │ surface, radius-xl, p-7            │  │
│               │   │ ▸ Perfil        │                                    │  │
│               │   │   Cuenta        │ PERFIL                             │  │
│               │   │   Preferencias  │ Tu identidad                       │  │
│               │   │                 │ Cómo te ven en la app.             │  │
│               │   │                 │ ──────────────────────────────────  │  │
│               │   │                 │ Usuario          @sergio_m      ✎ │  │
│               │   │                 │ cols 1-4         cols 5-10  11-12 │  │
│               │   │                 │ ──────────────────────────────────  │  │
│               │   │                 │ Nombre visible   Sergio Minei   ✎ │  │
│               │   │                 │ ──────────────────────────────────  │  │
│               │   │                 │ Avatar           ╭──╮              │  │
│               │   │                 │                  │ S│  [ Cambiar ] │  │
│               │   │                 │                  ╰──╯  [ Eliminar ]│  │
│               │   │                 │                                    │  │
│               │   └─────────────────┴────────────────────────────────────┘  │
│               │                                                             │
│               │   Estado editing inline (Usuario):                          │
│               │   ┌────────────────────────────────────────────────────┐    │
│               │   │ Usuario                                            │    │
│               │   │ cols 1-4                                           │    │
│               │   │ ┌──────────────────────────────────────────┐  ✓   │    │
│               │   │ │ @sergio_minei                            │      │    │   cols 5-12 input
│               │   │ └──────────────────────────────────────────┘      │    │
│               │   │ Disponible.                  helper text-success  │    │
│               │   │ [ Guardar ]   [ Cancelar ]   primary + ghost      │    │
│               │   └────────────────────────────────────────────────────┘    │
│               │                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

  Tabs verticales — receta:
    Estado normal:  text-secondary, padding y-2 x-3, sin border.
    Estado active:  background --accent / 10%, color --accent, border-l 2px --accent.
    Hover:          state layer text-primary / 6%.
    Foco teclado:   --focus-ring 2px outset.
```

## 4. Tokens invocados

- `--background`: lienzo de la pantalla settings.
- `--surface`: las 3 section cards (Profile · Account · Preferences) en su estado base.
- `--surface-elevated`: avatar preview circular detrás de la letra fallback, modal de currency change, sheet bottom de avatar upload + crop, sheet bottom de modals en mobile.
- `--border`: divisores entre filas dentro de cada card, separador entre el header de la pantalla y la primera card.
- `--border-strong`: borde de inputs, borde del avatar preview, borde de los `<kbd>` de atajos.
- `--text-primary`: valores activos de cada fila (`@sergio_m`, `Sergio Minei`, email, etc.), title de cada card.
- `--text-secondary`: labels de fila ("Usuario", "Email", "País"), helper Body 13 debajo del title, helpers neutros de validación.
- `--text-muted`: eyebrow mono "AJUSTES" y "PERFIL/CUENTA/PREFERENCIAS", counter `current/50` del displayName, timer de cooldown en helper, helper neutro `sameAsCurrent` ("Es el que ya tienes").
- `--accent` (indigo): CTA primario "Guardar", focus ring de inputs y CTAs, tab activa de la sidebar de tabs verticales (cols 1-3 desktop), check de availability_checking → available, chip activo de `productType` (border `--accent` + tinte 10%), letra fallback del avatar.
- `--accent-cool` (teal): íconos Lucide de los chips de `productType` en estado normal, ícono `shield` del row MFA, info inline del flujo de cambio de email ("Te enviamos un link…").
- `--accent-warm` (coral): badge contextual del email "Verificado" si decidimos calidez en confirmación (alternativo: `--success`); halo de mascota celebrating si en futuro se agrega achievement (fuera S2).
- `--success`: check inline post-save ("Guardado"), badge "Email verificado", helper success del username `available`.
- `--warning`: badge "Email no verificado", chip cooldown timer activo del username ("Podrás cambiarlo en {days} días").
- `--destructive`: botón "Eliminar avatar", botón "Cerrar sesión", helper de error del username `taken`, ícono `x-circle` del estado `taken`.
- `--focus-ring`: cualquier `:focus-visible` de tabs, inputs, CTAs, chips, toggles.

Si en producción se detecta que necesitamos un token específico para "row hover" o "section divider más sutil que `--border`" se anota en `docs/redesign/_notes/atelier-gaps.md` con el caso concreto. Para este lo-fi no se identificó hueco bloqueante.

## 5. Estados

- **Empty.** No aplica como estado de la pantalla — el usuario siempre tiene cuenta. **Avatar empty** sí: si no hay avatar subido, fallback a la letra inicial sobre tinte indigo 14% con border `--accent` 28% (receta única §4.4 — sin paleta categórica).
- **Loading.** El layout precarga la identidad del usuario desde el shell, así que el primer paint ya tiene los valores. Loading sólo aparece tras submit: la fila editada muestra spinner sutil dentro del input + CTA "Guardar" deshabilitado con label "Guardando…". Skeletons de fila (label + bar 60% width) sólo si el server tarda >300ms.
- **Error.** Inline alert dentro de la fila afectada: ícono `alert-circle` `--destructive` + copy del glosario "Algo se rompió de este lado. Dale otra vez." + botón ghost "Reintentar". El input mantiene el valor tipeado (§3 principios — conservar inputs).
- **Success post-edit.** Feedback inline verde en la misma fila: ícono `check` `--success` + copy "Guardado" + micro-pulso del border de la fila. Persiste 2s y hace fade out 150ms. Para cambios sensibles (cambio de email, cambio de password) además se dispara toast persistente Sonner-style con detalle accionable ("Te enviamos un link a tu nuevo email para confirmar.").
- **Edit detallado por campo:**
  - **Profile / username.** Input con debounced availability check (300ms tras última tecla). Sub-estados visuales: `availability_checking` (spinner suave dentro del input, helper neutro "Buscando…"), `available` (check `--success` + helper "Disponible."), `taken` (cross `--destructive` + helper "Ya está en uso. Prueba otro."), `sameAsCurrent` (helper `--text-muted` neutro "Es el que ya tienes."), `cooldown` (input deshabilitado + chip warning con timer "Podrás cambiarlo en {days} días."). CTA "Guardar" sólo habilitado en `available`.
  - **Profile / displayName.** Input simple max 50 chars con counter en `--text-muted` `current/50`, post-blur validation, sin debounce.
  - **Profile / avatar.** Zona clickeable + CTA "Cambiar avatar" abre **modal/sheet bottom** con uploader y cropper circular (drag para recortar). Si ya hay avatar, también botón "Eliminar" `--destructive` ghost. Preview circular dentro del modal con `--surface-elevated`.
  - **Account / email.** Form expandible con `newEmail` + `currentPassword`. Submit dispara verificación: helper info inline `--accent-cool` "Te enviamos un link de verificación a tu nuevo email." + toast persistente. Si el server responde con `cooldown` (`retryAfterIso`), helper warning con timer "Podrás cambiarlo en {time}.".
  - **Account / password.** Form expandible con `currentPassword` (si `canChange`) o sólo `newPassword` (si `canSet`) + `confirmation`. Reglas de password en helper inline `--text-muted` (longitud, mayúsculas, números). Validación post-blur por campo.
  - **Account / MFA.** Toggle simple. Al activar, abre flujo de enrolment como sheet/modal aparte (QR, código de verificación) — fuera del wireframe lo-fi de S2.
  - **Preferences / currency change.** Cambiar `baseCurrencyCode` dispara `currency_change_modal` (sheet bottom en mobile, modal centrado en desktop) con copy del glosario _"Cambiar moneda base no convierte tus datos viejos. ¿Seguir?"_ y CTAs "Confirmar cambio" `--accent` + "Volver" ghost.
  - **Preferences / productTypes.** Chips multi-select con receta §4.13 (ícono Lucide + label). Estado normal `border-strong` + ícono `--accent-cool`; estado active `--accent` border + tinte 10% + ícono e ícono `--accent`.
  - **Preferences / budget.** Input monetario con `font-variant-numeric: tabular-nums` + select de `budgetResetDayOfMonth` (1–31) inline a la derecha.

## 6. Motion y view transitions

- **Section card collapse/expand (mobile).** Altura animada con `--motion-base 280ms` y `--ease-emphasis`. Chevron rota 180° en `--motion-fast`. Stagger de 30ms entre filas internas al expandir.
- **Tab switch (desktop).** Cross-fade del contenido de la sección activa en `--motion-fast` (150ms) sin slide. La línea izquierda `--accent` de la tab activa se desliza con `--motion-fast` `--ease-emphasis`.
- **Inline edit toggle (viewing → editing).** El control crece/morfa en altura con `--motion-fast`; CTAs "Guardar" + "Cancelar" aparecen con stagger 30ms.
- **Username availability.** Spinner sutil dentro del input mientras chequea; transición a check (success) o cross (destructive) con fade 150ms `--ease-emphasis`. Sin layout shift.
- **Currency change modal.** Enter scale `0.96 → 1` + backdrop fade en `--motion-base`. Focus trap dentro del modal. Exit fade `--motion-fast`.
- **Avatar upload + crop sheet.** Enter con `--ease-out-expressive` desde abajo (sheet bottom). Preview circular se actualiza con cada drag del crop sin re-renders globales.
- **Save success inline.** Check `--success` aparece con `--motion-fast` y micro-pulso del border de la fila, persiste 2s, fade out 150ms.
- **Reduced motion.** `prefers-reduced-motion: reduce` → todo se reduce a fade 150ms, sin springs, sin stagger, sin scale.

## 7. Atajos de teclado (desktop) y gestos (mobile)

**Desktop**

- `Tab` navega lineal por las filas de la sección activa.
- `↑` / `↓` navegan entre tabs verticales cuando el foco está en la sidebar de tabs (cols 1-3).
- `Enter` activa edit en la fila enfocada.
- `⌘ + Enter` guarda la fila en edit.
- `Esc` cancela edit (con confirm si el campo está dirty).
- `⌘ + K` abre command palette (`/dashboard`-level shortcut, no exclusivo de settings).

**Mobile**

- Tap en cualquier parte de la fila viewing activa el edit.
- Sheets bottom para los modals de avatar upload + crop y de currency change.
- Pull-to-refresh recarga el snapshot del usuario (corrige drift si la sesión está vieja).
- Long-press en una fila viewing muestra acción "Copiar valor" (útil para username público).

## 8. Mascota

La mascota **NO aparece** en settings. Es una pantalla utilitaria, no celebratoria — si el usuario está acá está concentrado editando datos sensibles y la presencia de la mascota distraería. La bubble idle del shell sigue presente (regla universal del shell), con la ironía explícita de que el toggle `Mostrar mascota` vive en esta misma pantalla, dentro de Preferences. Un futuro achievement tipo "10 cambios sin errores" queda fuera de scope S2.

## 9. Voice samples

Strings reales en español alineados al glosario §7 de `principles.md`. Claves i18n en `src/i18n/locales/es/settings.json`.

- `settings.title` → "Tu cuenta"
- `settings.subtitle` → "Edita tu perfil, acceso y preferencias."
- `settings.profile.username.helper.available` → "Disponible."
- `settings.profile.username.helper.taken` → "Ya está en uso. Prueba otro."
- `settings.profile.username.helper.cooldown` → "Podrás cambiarlo en {days} días."
- `settings.profile.avatar.cta.change` → "Cambiar avatar"
- `settings.account.email.verified.badge` → "Verificado"
- `settings.account.email.afterChange.info` → "Te enviamos un link de verificación a tu nuevo email."
- `settings.preferences.currency.changeConfirm.title` → "Cambiar moneda base no convierte tus datos viejos. ¿Seguir?"
- `settings.preferences.currency.changeConfirm.cta` → "Confirmar cambio"
- `settings.cta.save` → "Guardar"
- `settings.cta.cancel` → "Cancelar"
- `settings.feedback.saved` → "Guardado"
- `settings.error.generic` → "Algo se rompió de este lado. Dale otra vez."

## 10. Riesgos y supuestos

**Supuestos**

- Layout desktop con tabs verticales (Opción A) por consistencia con apps tipo Vercel/Linear/Stripe Dashboard que ya forman el modelo mental del usuario 18–25 acostumbrado a SaaS premium.
- Cada fila se edita inline (no modal) salvo cambios sensibles que requieren modal por UX explícita: avatar upload requiere modal por el cropper, currency change requiere modal por el copy destructivo.
- Toggle "Mostrar mascota" vive en Preferences, no en una sección "Apariencia/Tema" separada — recomendación inicial.
- Theme toggle (light/dark/system) vive en ambos lugares: shell (acceso rápido en cualquier pantalla) y settings (fuente de verdad persistente). Recomendación inicial.

**Riesgos**

- **Cooldown 30d del username.** Si no se comunica claramente el usuario va a creer que el botón está roto. La pantalla muestra el contador en chip warning visible siempre — no se esconde detrás de un tooltip.
- **Currency change destructivo.** No convierte datos viejos. El modal de confirmación es la única protección — debe ser explícito en el copy y no permitir confirm accidental con Enter en focus equivocado.
- **MFA enrolment.** Es un flujo aparte (QR + código) que no entra en el lo-fi S2 — sólo se documenta el toggle de entrada. Diseñar el flujo completo en S3.
- **Avatar cropper.** Es la única superficie de settings con upload + manipulación de imagen — riesgo de complejidad si se intenta in-place; por eso vive en modal/sheet aparte.
- **Patrón de section cards** debe quedar consistente con `order-create` y otras pantallas de S2 que usen el mismo patrón colapsable — si una pantalla decide chevron a la izquierda y otra a la derecha, el sistema se rompe.

**Decisiones para input humano antes de S3**

- ¿El toggle "Mostrar mascota" vive en Preferences (recomendación) o en una sección "Apariencia" separada que también incluya el theme toggle?
- ¿El theme toggle (light/dark/system) vive sólo en settings, sólo en shell, o en ambos (recomendación)?
- ¿La fila "Cerrar sesión" vive como ghost destructive al pie de la pantalla (mockup actual) o se muda a la sidebar del shell para evitar contaminar la utilidad de settings con una acción de sesión?
- ¿Mostrar `--accent-warm` en el badge "Verificado" para sumar calidez, o quedarnos con `--success` por consistencia funcional? (recomendación: `--success` — el verificado es status confirmado, no celebración).
