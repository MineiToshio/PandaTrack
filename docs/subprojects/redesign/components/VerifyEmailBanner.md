---
title: VerifyEmailBanner
tier: 3
status: spec — S5 (ready for implementation)
last_updated: 2026-05-02
session: 05-app-shell
adrs: []
gaps:
  - s4-gaps G3
---

# VerifyEmailBanner

## Propósito

Banner de advertencia sticky visible cuando el usuario está en estado `grace` (email sin verificar, pero dentro del período de gracia de 6 días). Se monta en el shell `<AppShell>` sobre el header — el banner empuja el contenido hacia abajo (no flota encima). Incluye copy de urgencia leve, CTA de reenvío, y botón de cierre con persistencia de sesión (no permanente).

Ya existe una implementación legacy en `src/components/modules/auth/VerifyEmailBanner.tsx` que debe migrarse a Velvet tokens en S5.

## API TypeScript

```ts
type VerifyEmailBannerProps = {
  /** Locale activo para routing del CTA "Verificar ahora". */
  locale: string;
  /** URL de retorno después de la verificación. */
  returnTo: string;
  /** Días restantes del período de gracia. 0 = "hoy es el último día". */
  daysRemaining?: number;
  /** Copy del título. Viene de i18n del layout server. */
  title: string;
  /** Copy de la descripción. Viene de i18n del layout server. */
  description: string;
  /** Label del CTA principal. */
  resendLabel: string;
  /** Label del CTA durante el resend pending. */
  resendPendingLabel: string;
  /** Mensaje de éxito tras reenvío. */
  resendSuccess: string;
  /** Mensaje de error tras reenvío. */
  resendError: string;
};
```

Reglas TS:

- Todos los strings de copy son props obligatorios — el componente no hace i18n propio (el layout server se los pasa).
- El dismiss es estado interno (no prop) — se gestiona con `localStorage["pandatrack-verify-banner-dismissed"]` (por sesión via `sessionStorage`, no `localStorage`).

## Variants / Sizes

Sin variants. Una sola presentación: banner full-width sticky top-of-app (por encima del header).

Altura fija: `3rem` (48px) — token `--verify-banner-h` a definir en globals. Actualmente `VERIFICATION_BANNER_HEIGHT_PX` = constante en `src/lib/constants.ts`.

## Estados visuales

### Banner (light)

```css
.verify-banner {
  width: 100%;
  height: 3rem;
  background: color-mix(in oklch, var(--warning) 14%, var(--surface));
  border-bottom: 1px solid color-mix(in oklch, var(--warning) 28%, var(--surface));
  color: var(--warning-chip-text);
  display: flex;
  align-items: center;
  padding: 0 var(--space-4);
  gap: var(--space-3);
}
```

### Banner (dark)

Misma receta — `--warning` dark es `oklch(82% 0.15 75)`, `--warning-chip-text` dark idem base. El color-mix produce un tinte amber sobre el surface dark azul-violeta — contraste AA verificado.

### Ícono

Lucide `mail` 16×16 en `--warning-chip-text`. `aria-hidden="true"`.

### CTA "Enviar de nuevo"

`<Button variant="ghost" size="sm">` con color `--warning-chip-text`. Hover: state layer sobre el banner background.

### Botón close

`<IconButton Icon={X} aria-label={t("dismiss")} size="sm">`. Color `--warning-chip-text`. Posicionado al extremo derecho.

### Estado loading del resend

El CTA "Enviar de nuevo" muestra Lucide `loader-2` animado y `pointer-events: none` durante la petición.

### Estado success/error

`<ErrorMessage>` o mensaje inline bajo el banner o como toast (decisión del consumer). El banner no cambia su layout para el feedback — usa el sistema de Toast existente.

## Mobile vs desktop

| Aspecto | Mobile                                   | Desktop                        |
| ------- | ---------------------------------------- | ------------------------------ |
| Layout  | Ícono oculto si no cabe + texto truncado | Ícono visible + texto completo |
| Copy    | Versión abreviada (sin `description`)    | Completo                       |
| CTA     | Solo "Reenviar" (sin texto largo)        | "Enviar de nuevo"              |
| Dismiss | Visible siempre (X en extremo derecho)   | Visible siempre                |

## Accesibilidad

- `role="status" aria-live="polite"` en el container — anuncia cambios de estado (resend success/error) sin interrumpir.
- `aria-label` en el banner completo: no necesario (el contenido de texto es suficientemente descriptivo).
- Dismiss: `<button aria-label="Cerrar aviso de verificación">`.
- El CTA reenvío: `aria-busy={isLoading}` cuando cargando.
- Color del texto `--warning-chip-text` sobre `color-mix(--warning 14%, --surface)` cumple WCAG AA (≥4.5:1 verificado en audit S3).
- Keyboard: Tab → CTA reenvío → dismiss. No trampa de foco.

## Motion

- El banner no anima entrada/salida — aparece/desaparece con la condición del server (no hay toggle visual).
- Dismiss: el componente se unmonta del árbol cuando el usuario lo cierra. Sin transición de salida (la posición sticky del header cambia inmediatamente).
- CTA loading: loader-2 Lucide anima. Reduce-motion: sin animación, solo estado disabled visual.

## Copy default + i18n

| Clave i18n sugerida                     | Valor ES                                                |
| --------------------------------------- | ------------------------------------------------------- |
| `auth.verificationBanner.title`         | "Confirmá tu email para mantener tu cuenta segura."     |
| `auth.verificationBanner.description`   | "Te quedan {days, plural, one {# día} other {# días}}." |
| `auth.verificationBanner.resend`        | "Enviar de nuevo"                                       |
| `auth.verificationBanner.resendPending` | "Enviando..."                                           |
| `auth.verificationBanner.resendSuccess` | "¡Listo! Revisá tu bandeja de entrada."                 |
| `auth.verificationBanner.resendError`   | "No se pudo enviar. Intentá de nuevo."                  |
| `auth.verificationBanner.dismiss`       | "Cerrar aviso de verificación"                          |

Namespace: `auth` (ya existe). Los keys de `verificationBanner` ya existen en el layout — confirmar que coinciden al implementar.

## Edge cases

1. **Usuario cierra el banner y recarga**: el dismiss usa `sessionStorage` — el banner vuelve a aparecer en una nueva sesión de browser. Esto es intencional (no es permanente).
2. **Resend exitoso**: mostrar Toast `success` + el banner sigue visible (el email sigue sin verificar hasta que el usuario clickee el link).
3. **Resend error**: mostrar Toast `error`. El banner sigue visible, CTA vuelve a estado idle.
4. **daysRemaining=0**: copy urgente: "Hoy es el último día." Cambiar color del texto a `--destructive-chip-text` para reforzar urgencia.
5. **Múltiples recargas**: la lógica `maybeSendDaySixVerificationReminder` en el layout ya throttlea el reenvío automático — el banner no interfiere.
6. **Layout sin banner** (estado no-grace): el shell NO monta el componente. El CSS variable `--app-banner-offset` queda en 0px.

## Anti-patrones

1. **Banner permanente via `localStorage`**: el dismiss debe ser por sesión (`sessionStorage`), no permanente. Si fuera permanente, el usuario podría ignorarlo indefinidamente.
2. **Toast en lugar de banner**: el banner es prominente por diseño. Un toast sería fácilmente ignorable. El patrón sticky top es intencional.
3. **Overlay / float**: el banner empuja el contenido, no lo cubre.
4. **`background: var(--warning)` puro**: el background es el tinte `color-mix(--warning 14%, --surface)`, no el warning saturado. El saturado fallaría contraste.
5. **Múltiples banners**: solo puede existir uno. No hay variante de "info banner" ni "error banner" en el shell. Otros mensajes de shell van al Toast.

## Ejemplos de uso

```tsx
// En src/app/[locale]/(app)/layout.tsx (server component)
{
  snapshot?.state === "grace" && (
    <VerifyEmailBanner
      locale={locale}
      returnTo={returnTo}
      daysRemaining={snapshot.daysRemaining}
      title={t("verificationBanner.title")}
      description={t("verificationBanner.description")}
      resendLabel={t("verificationBanner.resend")}
      resendPendingLabel={t("verificationBanner.resendPending")}
      resendSuccess={t("verificationBanner.resendSuccess")}
      resendError={t("verificationBanner.resendError")}
    />
  );
}
```

## Tokens consumidos

- `--warning` (background tinte via color-mix 14%)
- `--warning-chip-text` (texto + ícono + CTA)
- `--surface` (base del color-mix)
- `--destructive-chip-text` (cuando daysRemaining=0)
- `--space-3`, `--space-4` (padding)
- `--text-caption` (tipografía del copy corto)
- `--motion-fast` (state layers del CTA)

## ADRs aplicables

Ninguno directamente. El patrón `state=grace` está definido en la lógica de auth existente (`src/lib/auth/authVerification.ts`).

## Dependencias

- `<Button variant="ghost" size="sm">` — CTA reenvío
- `<IconButton>` — dismiss
- Lucide icons: `mail`, `x`, `loader-2`
- Server action de reenvío (ya existe en `src/actions/auth/`)
- `sessionStorage` para dismiss persistence

## Notas para S5 (implementación)

1. La implementación legacy `src/components/modules/auth/VerifyEmailBanner.tsx` existe y funciona. La tarea S5 es migrar sus tokens a Velvet (reemplazar `bg-warning/15`, `text-warning`, etc. por `var(--warning-chip-text)`, `color-mix(--warning 14%, --surface)`).
2. Verificar que `VERIFICATION_BANNER_HEIGHT_PX` en `src/lib/constants.ts` (actualmente 48px) coincide con `3rem`. Si el shell nuevo cambia la altura, actualizar la constante.
3. El CSS variable `--app-banner-offset` que el layout inyecta en el wrapper es el mecanismo que permite al sidebar y al header posicionarse correctamente debajo del banner. Mantener este patrón.
4. No requiere tests nuevos si la lógica de dismiss es mínima. Si se agrega lógica de sessionStorage, test unit para persist/restore.
