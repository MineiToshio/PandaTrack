---
title: ADR 0012 — Account destructive-action styling (sign-out, avatar removal, account exits)
date: 2026-06-13
status: accepted
session: Round 1 / FRD-07 alignment closure (2026-06-13) — formalizes a pattern shipped in S5 (ShellAccountMenu) and S8 (Settings) without a prior ADR
owner: Sergio Minei
trigger: FRD ↔ rediseño delta audit flagged that the destructive (red) styling of sign-out in `ShellAccountMenu.tsx` had no ADR and no FRD reference (Round 1 flagged item #3 / delta D1-01)
updates: docs/product/prd-01-collector-mvp/frd-01-account-access-and-recovery/frd-01-account-access-and-recovery.md (plus the redesign subproject's Round-1 delta audit, historical)
related: ADR 0001 D3 (disabled sin opacity), ADR 0011 (mobile detail secondary actions — destructive row at end, red), ADR 0008 (Modal canonical — confirm dialogs)
---

# ADR 0012 — Account destructive-action styling

## Contexto

Durante S5 (app shell) y S8 (Settings) se introdujo un tratamiento visual rojo para las acciones de cuenta que sacan al usuario de un estado o eliminan identidad — principalmente **cerrar sesión** y **eliminar foto de perfil**. El tratamiento se implementó de forma consistente pero **nunca se documentó como decisión**: el delta audit (D1-01) lo marcó como "patrón visual sin ADR ni referencia en ningún FRD". Este ADR cierra ese hueco formalizando el contrato, sin cambiar la implementación vigente.

Estado implementado al momento de escribir este ADR:

- `src/app/[locale]/(app)/_components/AppLayout/ShellAccountMenu.tsx` — el ítem "Cerrar sesión" del menú de cuenta usa `text-destructive hover:bg-destructive/10 hover:text-destructive`: **texto + icono rojos, sin borde, hover con tinte rojo 10%**. Es una fila de menú (`menuitem`), no un botón sólido.
- `src/app/[locale]/(app)/settings/_components/SettingsPrefsPane.tsx` — el botón "Cerrar sesión" mobile (fuera del menú) usa `--destructive` para texto/icono + `border 1px` rojo 28% + hover bg rojo 8%. Es un botón standalone, no una fila de menú.
- Settings · "Eliminar foto" (`AvatarRemoveModal`) usa el tono destructivo del Modal (icon-circle rojo) + confirmación explícita.
- Cambio de email (`EmailModal`) usa tono **warning** (ámbar), no destructive — es sensible pero no destructivo.

## Decisión

Las acciones de cuenta percibidas por el usuario como **salir de un estado o eliminar identidad** se comunican con el token semántico `--destructive`, con la forma que dicte el contenedor. El contrato es de **estilo**, separado del de **confirmación**.

### Reglas

1. **Token único:** texto e icono usan `--destructive` (vía `text-destructive` / `[color:var(--destructive)]`). Nunca `text-red-*` ni hex hardcodeado. Theme-aware en light y dark (el token ya pasa AA en ambos).
2. **Forma según contenedor:**
   - **En un menú** (account menu, listas de acciones): fila **sin borde**, texto/icono rojos, hover con tinte `--destructive`/10%. No botón sólido.
   - **Como botón standalone** (ej. sign-out mobile en Settings): texto/icono rojos + **borde sutil** `--destructive` ~28% + hover bg `--destructive` ~8%. Outline, no relleno.
   - **Como fila al pie de una card de acciones** (detail screens): se rige por ADR 0011 (fila destructiva al final, rojo, divider sutil arriba).
3. **Nunca botón rojo sólido (filled)** para sign-out: cerrar sesión es reversible (se vuelve a entrar); un filled rojo lo dramatiza de más. El relleno rojo se reserva, si acaso, para confirmaciones irreversibles dentro de un Modal.
4. **Estilo ≠ confirmación.** El rojo señala consecuencia, no la previene. Las acciones **irreversibles** (eliminar foto, eliminar cuenta a futuro) exigen además confirmación en `<Modal>` (ADR 0008). Sign-out, al ser reversible, **no** requiere modal de confirmación.
5. **Sensible-pero-no-destructivo = warning, no destructive.** Cambiar email o moneda base usan tono `warning` (ámbar), reservando el rojo para salidas/eliminaciones.
6. **Sin opacity para disabled** (hereda ADR 0001 D3): un control destructivo deshabilitado no se atenúa con opacity; usa los estados de color del sistema.

### Aplicabilidad

- ✅ Sign-out en `ShellAccountMenu` (desktop sidebar + mobile drawer) — caso origen.
- ✅ Sign-out standalone (Settings mobile).
- ✅ Eliminar foto de perfil (`AvatarRemoveModal`) — rojo + confirmación.
- ⬜ Eliminar cuenta (si llega a existir post-MVP) — rojo + confirmación type-to-confirm.
- Acciones destructivas **de objeto de dominio** (eliminar pedido / entrega / tienda) siguen ADR 0011 (card de acciones), no este ADR; ambos comparten el token `--destructive` pero difieren en forma/posición.

## Consecuencias

### Positivas

- El patrón rojo de cuenta deja de ser folklore de implementación: queda con regla escrita, token único y theme-aware verificado.
- Distinción clara destructive (rojo, salir/eliminar) vs warning (ámbar, sensible) evita el "todo es rojo".
- Separar estilo de confirmación evita modales innecesarios para acciones reversibles (sign-out).

### Negativas / límites

- No se introduce una "Danger Zone" agrupada para cuenta: con una sola acción destructiva por superficie no se justifica (mismo criterio que ADR 0011 para single-entity). Si post-MVP aparecen múltiples destructivas de cuenta (eliminar cuenta + revocar sesiones + desvincular proveedor), evaluar Danger Zone en un ADR de extensión.

## Referencias

- `src/app/[locale]/(app)/_components/AppLayout/ShellAccountMenu.tsx` (sign-out menuitem)
- `src/app/[locale]/(app)/settings/_components/SettingsPrefsPane.tsx` (sign-out standalone mobile)
- ADR 0001 — D3 disabled sin opacity: `./0001-s2-closure-decisions.md`
- ADR 0008 — Modal canonical (confirm dialogs): `./0008-modal-enhancement.md`
- ADR 0011 — Mobile detail secondary actions (destructive row): `./0011-mobile-detail-secondary-actions.md`
