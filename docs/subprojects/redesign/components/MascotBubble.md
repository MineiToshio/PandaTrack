---
title: MascotBubble
tier: 3
status: REMOVED from app shell (2026-05-15) — file kept in src for potential future reuse, not mounted anywhere
last_updated: 2026-05-15
session: 04-components · removed in S5.3 cross-cutting
adrs:
  - ADR 0001 D17 (mascota toggle + menú contextual right-click / long-press)
  - ADR 0003 D2 (theme toggle solo light/dark — relevante para opción "Cambiar tema" del menú contextual)
---

> ⛔ **REMOVED from app shell on 2026-05-15** (cross-cutting entry **S5.3**). The component does not mount in `AppLayout` anymore. The file `src/components/modules/MascotBubble.tsx` still exists but is unused. Do NOT add it back to the shell without a fresh decision — Sergio explicitly removed it (visual noise, competed with sticky action bars + content focus). EmptyState `visual` slot can still use a small mascot illustration where relevant, but the floating bottom-right bubble is gone.

# MascotBubble

## Propósito

Sprite animado de la mascota (Felix, working name) en sus posiciones canónicas vinculantes definidas en [`directions.md` §4.10](../directions.md). Vive como bubble idle ubicua (esquina inferior derecha en todas las pantallas privadas), como walking strip exclusivo del [`dashboard.md`](../screens/dashboard.md) desktop, como decoración emocional de un `<EmptyState variant="general">` (sleeping en empty hero), y como halo del `<Toast variant="achievement">` cuando un evento explícito lo dispara (celebrating). Aparece sólo en estas posiciones — **NO** en formularios activos, validaciones, errores inline, ni delete/cancel confirms (`directions.md` §4.10 anti-patrones, [`principles.md` §6](../principles.md)). Soporta el toggle global "Mostrar la mascota" gobernado por [`settings.md`](../screens/settings.md) → preferences (ADR 0001 D17).

## API TypeScript

```ts
import type { ReactNode } from "react";

type MascotBubbleVariantIdle = {
  variant: "idle";
  /** Tamaño en px. 56 mobile-default, 80 opcional para desktop bubble grande. */
  size?: 56 | 80;
  /** `bubble` = fixed esquina inferior derecha; `inline` = el sprite se inserta donde el padre lo ubique (no auto-fixed). */
  position: "bubble" | "inline";
  /** Override del lighting setup. `auto` (default) sigue `:root[data-theme]`. */
  theme?: "auto" | "light" | "dark";
};

type MascotBubbleVariantSleeping = {
  variant: "sleeping";
  /** 56/80 para variantes compactas; 96 para empty state hero canónico. */
  size?: 56 | 80 | 96;
  /** Bandera obligatoria — sleeping sólo se renderiza embebido en `<EmptyState variant="general">`. */
  inEmptyState: true;
};

type MascotBubbleVariantCelebrating = {
  variant: "celebrating";
  size?: 56 | 80;
  /** Origen del achievement. Discrimina copy + halo. */
  trigger: "achievement" | "first-collection";
};

type MascotBubbleVariantWalking = {
  variant: "walking";
  /** Walking strip vinculado a una única ruta del shell (regla estricta `directions.md` §4.10). */
  route: "/dashboard";
};

/** Discriminated union sobre `variant` — tipos correctos por estado. */
type MascotBubbleProps = (
  | MascotBubbleVariantIdle
  | MascotBubbleVariantSleeping
  | MascotBubbleVariantCelebrating
  | MascotBubbleVariantWalking
) & {
  /**
   * Visibilidad gobernada por settings → preferences (ADR 0001 D17).
   * Cuando `false`, el componente no renderiza nada (ni sprite, ni bubble, ni walking).
   * Default `true`. Se sincroniza con `localStorage["pandatrack-mascot-visible"]`.
   */
  visible?: boolean;
  /**
   * Override del aria-label. Cuando se omite, el componente decide:
   * `idle` → `aria-hidden="true"` (decorativo puro);
   * `sleeping` → `components.mascotBubble.altSleeping`;
   * `celebrating` → `components.mascotBubble.altCelebrating`;
   * `walking` → `aria-hidden="true"`.
   */
  ariaLabel?: string;
  /** Fired cuando el usuario invoca el menú contextual (right-click desktop, long-press mobile). */
  onContextMenuOpen?: () => void;
};
```

Reglas TS:

- `inEmptyState: true` es literal obligatorio en `sleeping` para impedir invocaciones sueltas — sleeping siempre vive dentro de `<EmptyState>`.
- `route: "/dashboard"` es literal en `walking` para que TypeScript rechace cualquier intento de invocar walking fuera del dashboard (regla estricta §4.10).
- `position` discrimina entre auto-fixed (`bubble`) y manual (`inline`). El consumer del achievement toast pasa `position: "inline"` para insertar el sprite dentro del Toast sin perder el lighting setup.

## Variants / Sizes

| Variant       | Uso                                                                                                                                                                        | Tokens consumidos                                                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `idle`        | Bubble ubicua esquina inferior derecha. Sprite sheet `idle` (4–6 frames, 2.4s loop).                                                                                       | bg `color-mix(--accent-cool 16%, --surface)`, `--border`, `--elevation-3`, `--radius-pill`, `--z-mascot`, `--space-4` (offset)                    |
| `sleeping`    | Empty state hero (sin pedidos todavía). Embebido en `<EmptyState variant="general">`. Sprite sheet `sleeping` (3 frames, 4s loop muy lento).                               | bg circular `color-mix(--accent-cool 24%, --surface)`, `--radius-pill`, sin elevation propia (la card padre la aporta)                            |
| `celebrating` | Halo dentro de `<Toast variant="achievement">` cuando un trigger explícito dispara (pago full, primera colección). Sprite sheet `celebrating` (6–8 frames, 1.0s one-shot). | halo `color-mix(--accent-warm 24%, transparent)` outer + glow `color-mix(--accent-warm 14%, transparent)`, `--ease-bounce`, `--motion-slow`       |
| `walking`     | Walking strip horizontal del dashboard desktop (≥ `--breakpoint-md` por shell pero la regla estricta de `directions.md` §4.10 lo bloquea en mobile incluso si se invoca).  | `--motion-slow * 4` (~1.9s) duración, easing lineal (movimiento uniforme), trayectoria fixed dentro del strip definido por el bento del dashboard |

### Sizes

| Size | Variants soportadas           | Uso                                                                                                                    |
| ---- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 56   | idle, sleeping, celebrating   | Default mobile y desktop compacto. Bubble idle estándar y celebrating embebido en toast.                               |
| 80   | idle, sleeping, celebrating   | Desktop opcional cuando el viewport lo permite. Walking sprite sheet rinde a 80×80 nominal aun cuando atraviesa strip. |
| 96   | sleeping (sólo en empty hero) | Empty hero canónico (`directions.md` §4.10 punto 4). Único caso 96px del sistema.                                      |

## Estados visuales

### `idle` (bubble)

| Estado          | Receta CSS (light)                                                                                                                                                                                                                                                                                  | Receta CSS (dark)                                                                                                                                                                                                                      | Notas                                                                                                            |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `default`       | `position: fixed; bottom: var(--space-4); right: var(--space-4); width: 56px; height: 56px; background: color-mix(in oklch, var(--accent-cool) 16%, var(--surface)); border: 1px solid var(--border); border-radius: var(--radius-pill); box-shadow: var(--elevation-3); z-index: var(--z-mascot);` | mismo contrato; `--elevation-3` en dark compone `inset highlight + ring + glow accent`. Halo extra `0 -1px 8px color-mix(in oklch, var(--accent-cool) 12%, transparent)` ya viene incluido por la receta canónica de elevation-3 dark. | El `bottom`/`right` se calcula con `env(safe-area-inset-*)` aditivo en mobile para no chocar con notch/home bar. |
| `hover`         | overlay `::after` con `background-color: color-mix(in oklch, var(--text-primary) var(--state-hover-mix), transparent)` (mix=6%)                                                                                                                                                                     | overlay con mix=8%                                                                                                                                                                                                                     | El `::after` respeta `border-radius: inherit` para no derramar fuera del pill.                                   |
| `pressed`       | overlay con `--state-pressed-mix` (12%)                                                                                                                                                                                                                                                             | overlay con `--state-pressed-mix` (14%)                                                                                                                                                                                                | `:active`. Usado cuando el usuario hace click/tap normal.                                                        |
| `focus-visible` | `outline: 2px solid var(--focus-ring); outline-offset: 2px;`                                                                                                                                                                                                                                        | mismo                                                                                                                                                                                                                                  | `:focus-visible` activado vía `tabindex="0"` (la bubble es focusable cuando `onContextMenuOpen` está provisto).  |
| `disabled`      | (no aplica — si `visible={false}` no se renderiza)                                                                                                                                                                                                                                                  | (idem)                                                                                                                                                                                                                                 | El componente no expone disabled visual; el toggle de Settings lo desmonta enteramente.                          |

### `sleeping` (empty hero)

| Estado    | Receta CSS (light)                                                                                                                                                               | Receta CSS (dark)                                                                                                                    | Notas                                                                                                                                  |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `default` | `width: 96px; height: 96px;` sobre background circular `color-mix(in oklch, var(--accent-cool) 24%, var(--surface))` de `160px × 160px` con `border-radius: var(--radius-pill);` | mismo contrato; en dark el background circular ganaría 4–6% extra de luminosidad porque `--accent-cool` dark es L=0.74 vs 0.58 light | El sprite se centra ópticamente sobre el circle. El padre `<EmptyState>` ya provee la card con `--surface` y el `--space-24` vertical. |
| `hover`   | sin estado hover (decorativo, no interactivo)                                                                                                                                    | mismo                                                                                                                                |                                                                                                                                        |

### `celebrating` (halo achievement)

| Estado    | Receta CSS (light)                                                                                                                                                                       | Receta CSS (dark) | Notas                                                                                                                         |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `default` | sprite + halo composición ad-hoc: `box-shadow: 0 0 0 1px color-mix(in oklch, var(--accent-warm) 24%, transparent), 0 8px 32px color-mix(in oklch, var(--accent-warm) 14%, transparent);` | mismo             | Recipe coincide con halo achievement de `tokens.md §6` para que toast + mascota compartan firma visual.                       |
| `enter`   | scale 0.92 → 1.0, opacity 0 → 1, halo radius growing del 0% al 100%; duración `--motion-slow`, easing `--ease-bounce`                                                                    | mismo             | El sprite y el halo se animan juntos. ✨ emoji opcional aparece adyacente al sprite via `Toast` (no es parte del componente). |
| `reduced` | (`prefers-reduced-motion: reduce`) opacity 0 → 1 con `--motion-fast` `--ease-emphasis`; halo aparece estático, no expande                                                                | mismo             | El sprite no rota ni rebota — fade puro.                                                                                      |

### `walking` (strip horizontal)

| Estado    | Receta CSS (light)                                                                                                                                                                                                                                                | Receta CSS (dark) | Notas                                                                                                                                                       |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `idle`    | el strip está vacío; ningún sprite se renderiza                                                                                                                                                                                                                   | mismo             |                                                                                                                                                             |
| `walking` | sprite 56×56 con `position: absolute; top: 50%; transform: translateY(-50%) translateX(...)`; `transition: transform calc(var(--motion-slow) * 4) linear;` desde `right: 0` hasta `right: 100%` (animación CSS o JS coordinada por el shell — ver Notas para S12) | mismo             | Animación lineal porque la mascota camina a velocidad constante. `linear` es el único correcto para movimiento uniforme — easings curvos rompen la lectura. |
| `reduced` | desactivado completamente — el strip queda vacío                                                                                                                                                                                                                  | mismo             | `prefers-reduced-motion: reduce` desactiva walking sin excepción (regla `directions.md` §4.10).                                                             |

## Mobile vs desktop

| Aspecto                 | `< --breakpoint-md` (mobile)                                                                                                                                   | `≥ --breakpoint-md` (desktop)                                                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `idle` size             | 56 (default obligatorio)                                                                                                                                       | 56 (default) o 80 (opcional, decisión del shell)                                                                                                            |
| `walking`               | **Inviolable: NO se renderiza.** El componente con `variant: "walking"` queda como no-op en mobile aun si el shell lo monta.                                   | Activo solo en `/dashboard`. Walking strip horizontal de 80px de alto sobre el footer del bento; cooldown ≥8min entre paseos, trigger ≥30s sin interacción. |
| Context menu            | Long-press (≥500ms) sobre el sprite abre `<Sheet>` con las 3 opciones. El menú nativo de iOS/Android se previene con `touch-action: manipulation`.             | Right-click sobre el sprite abre `<DropdownMenu>` con las 3 opciones. El menú contextual nativo se previene con `event.preventDefault()`.                   |
| Offset bubble           | `bottom: calc(var(--space-4) + env(safe-area-inset-bottom)); right: calc(var(--space-4) + env(safe-area-inset-right));` para esquivar notch / home bar.        | `bottom: var(--space-4); right: var(--space-4);` — sin safe-area porque el desktop no tiene notch.                                                          |
| Z-stack                 | Por encima de header (`--z-header` 30) pero por debajo de modal/sheet/drawer (`--z-mascot` 35). En mobile el `<Sheet>` del context menu sube a `--z-sheet` 60. | Mismo `--z-mascot` 35.                                                                                                                                      |
| `sleeping` (empty hero) | size 96 default, padding superior `--space-24` del empty state.                                                                                                | size 96 default, padding superior `--space-24`. Sin cambios.                                                                                                |

## Accesibilidad

- **Rol ARIA:**
  - `idle`: `aria-hidden="true"` cuando no es focusable (decoración pura). Cuando expone `onContextMenuOpen`, sube a `<button aria-label="components.mascotBubble.contextMenu.open">` con `tabindex="0"`.
  - `sleeping`: `aria-label="components.mascotBubble.altSleeping"` (Felix dormido — sin pedidos todavía). Comunicación emocional intencional: el screen reader debe captar el contexto de "vacío".
  - `celebrating`: `aria-label="components.mascotBubble.altCelebrating"`. La live region la aporta el `<Toast variant="achievement">` padre (polite o assertive según trigger del Toast).
  - `walking`: `aria-hidden="true"`. La animación es decorativa pura y no comunica información funcional.
- **Keyboard:**
  - Tab → foco en la bubble (cuando es interactiva).
  - `Space` / `Enter` → abre el menú contextual (mismo handler que click).
  - `Shift+F10` → abre el menú contextual (estándar del sistema operativo para menús contextuales, no depende de mouse).
  - `Esc` dentro del menú contextual abierto → lo cierra y devuelve foco al sprite.
- **Focus management:**
  - Cuando el menú contextual abre (DropdownMenu desktop o Sheet mobile), el primer item recibe foco automáticamente.
  - Al cerrar, foco vuelve al sprite.
  - El menú implementa focus trap mientras está abierto (delegado a `<DropdownMenu>` / `<Sheet>`).
- **Screen reader:**
  - `idle` por default no anuncia (decorativo).
  - `sleeping` y `celebrating` anuncian el `aria-label` cuando entran al DOM.
  - Achievement assertive: el `<Toast>` padre dispara live region; la mascota es decoración del Toast.
- **`prefers-reduced-motion: reduce`:**
  - `idle` queda completamente estático (sin micro-bobbing).
  - `walking` desactivado completamente (el strip queda vacío).
  - `celebrating` cae a fade `--motion-fast` `--ease-emphasis` sin scale, sin halo expand, sin bounce.
  - `sleeping` queda estático.

## Motion

| Qué se anima             | Token de duración                                           | Token de easing   | Notas                                                                                                                                                                                                                      |
| ------------------------ | ----------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `idle` micro-bobbing     | `4s` (loop)                                                 | `--ease-emphasis` | `translate-y` ±1px continuo. `4s` no es un token (`--motion-*` cubre 150–480ms) — la duración del loop ambient se declara como literal de animación a través de variable local del componente. Documentado como excepción. |
| `sleeping` micro-bobbing | `4s` (loop)                                                 | `--ease-emphasis` | Mismo patrón que idle, ritmo lento intencional para comunicar "dormido".                                                                                                                                                   |
| `celebrating` enter      | `--motion-slow` (480ms)                                     | `--ease-bounce`   | Scale 0.92 → 1.0 + halo expand. One-shot, no loop.                                                                                                                                                                         |
| `celebrating` halo glow  | `--motion-slow`                                             | `--ease-bounce`   | Halo expande de 0% a 100% en sincronía con el scale.                                                                                                                                                                       |
| `walking` traversal      | `calc(var(--motion-slow) * 4)` (~1.92s)                     | `linear`          | Movimiento uniforme. Easing curvo está prohibido para movimiento físico constante.                                                                                                                                         |
| `walking` cooldown       | `~30s` mínimo idle del usuario, `~8min` mínimo entre paseos | (no aplica)       | Coordinación de timing del shell, no del componente. Documentado como compromiso del consumer.                                                                                                                             |
| `prefers-reduced-motion` | `--motion-fast` (150ms)                                     | `--ease-emphasis` | Aplicado a celebrating enter (fade puro). Idle, sleeping y walking quedan estáticos.                                                                                                                                       |

## Copy default + i18n

| Clave i18n sugerida                            | Valor ES (voice glossary aplicado) |
| ---------------------------------------------- | ---------------------------------- |
| `components.mascotBubble.contextMenu.hide`     | "Ocultar mascota"                  |
| `components.mascotBubble.contextMenu.theme`    | "Cambiar tema"                     |
| `components.mascotBubble.contextMenu.settings` | "Configuración"                    |
| `components.mascotBubble.contextMenu.open`     | "Abrir menú de mascota"            |
| `components.mascotBubble.altSleeping`          | "Felix dormido"                    |
| `components.mascotBubble.altCelebrating`       | "Felix festejando"                 |
| `components.mascotBubble.altIdle`              | "Felix"                            |

EN se deja para S12. "Felix" es working name placeholder — la decisión final del nombre se toma antes de S6 (`directions.md` §4.10). Si el nombre cambia, se renombra el copy en S12 antes del rollout. Nota: el set de copy se mantiene minimal (3 acciones de menú + 3 alts) — la mascota no habla en bubbles permanentes (regla `directions.md` §4.10 anti-patrones); el copy conversacional pertenece al FRD del asistente.

## Edge cases

1. **`visible={false}`**: el componente no renderiza nada — ni sprite, ni wrapper, ni listeners. Equivale a `return null`. El usuario que oculta la mascota desde Settings no debe ver "fantasmas" del sprite.
2. **Multi-tab walking cooldown**: si el usuario tiene varias pestañas abiertas en `/dashboard`, el cooldown (`localStorage["mascot:lastWalkAt"]`) es global. Solo una pestaña por vez puede animar la caminata; las demás respetan el timestamp y se quedan en idle.
3. **`prefers-reduced-motion` cambia mid-session**: si el usuario activa la preferencia mientras hay walking en curso, la animación se interrumpe en su frame actual y el sprite se desmonta del strip al completar el frame.
4. **Sprite sheet placeholder en S4**: la S4 trabaja con sprite sheet placeholder (forma neutral 56×56). La decisión final pixel art vs AI hi-res render queda diferida a S6 (`tokens.md §11.4`). El componente debe poder swappear el sprite asset sin cambios de API.
5. **Conflicto con menú contextual nativo del browser**: en desktop, `event.preventDefault()` en el `contextmenu` event bloquea el menú nativo. Si por alguna razón falla (extensiones, browsers no estándar), el rollback es eliminar el bonus de menú contextual y dejar solo Settings (ADR 0001 D17 rollback).
6. **Walking en navegador sin `requestIdleCallback`**: fallback a `setTimeout(detect, 1000)` polling — funcional pero menos eficiente. No bloquea el feature.
7. **`theme="auto"` (default)** vs override: el componente sigue `:root[data-theme]` por default. El override `theme="light" | "dark"` se reserva para mocks de diseño y previews — no usar en producción.
8. **`celebrating` sin `<Toast>` padre**: error de uso. El componente debería renderizar el sprite igual pero sin halo decoration coordinada — emit warning en dev mode.
9. **Walking con viewport horizontal muy chico (< 768px aun siendo desktop)**: la regla estricta es `≥ --breakpoint-md` Y `desktop`. El componente respeta el breakpoint via `matchMedia('(min-width: 48rem)')`; si el viewport es menor, no se renderiza.
10. **Long-press accidental scroll-mobile**: el listener de long-press cancela si detecta scroll antes del threshold (≥500ms). Evita activar el menú durante un scroll natural sobre el sprite.

## Anti-patrones

1. **Mascota en formularios activos**: viola `directions.md` §4.10 ("nunca en form active"). Si el shell la mantiene visible durante un wizard, se rompe la concentración del usuario.
2. **Mascota en delete/cancel/error inline**: viola §4.10 ("nunca en payment processing, nunca en delete confirmation"). El humor descontextualizado es el peor antiértico.
3. **Walking en mobile**: rompe regla estricta §4.10 ("Mobile NO pasea — en serio nunca"). Aun cuando el dev quiera "probarlo" en mobile, el componente debe ser literalmente imposible de activar (TS literal `route: "/dashboard"` + check de breakpoint en runtime).
4. **`opacity` para "atenuar" la bubble**: prohibido (regla universal del sistema). Si es deseable atenuar, ajustar `color-mix` del background, no opacity.
5. **Sprite sheet >80KB**: viola budget de performance (`directions.md` §4.10). Si el assets supera el budget, simplificar walking a 4 frames antes de tocar idle/celebrating.
6. **Mascota con tooltip permanente en idle**: rompe el principio "personalidad puntual, no sticker omnipresente" (`principles.md` §6). El tooltip aparece sólo en hover/focus o dentro del menú contextual.
7. **Celebrating en pago parcial**: viola §4.10 ("no reacciona a cada acción del usuario — sólo a achievements explícitos"). Solo `pago full que cierra una pre-orden` o `primera colección` disparan celebrating.
8. **Mascota como CTA**: prohibido. La mascota nunca es la acción primaria; siempre es decoración/personalidad.
9. **Animar idle con `--ease-bounce`**: rompe el carácter calmo del idle. Bounce es exclusivo de celebrating.
10. **Mascota visible en settings**: rompe `screens/settings.md` §11 ("La mascota NO aparece en settings — es una pantalla utilitaria"). La bubble idle del shell se mantiene visible (regla universal), pero ninguna mascota adicional vive dentro de la pantalla.

## Ejemplos de uso

```tsx
// Bubble idle ubicua del shell — vive en el layout `(app)`
<MascotBubble
  variant="idle"
  size={56}
  position="bubble"
  visible={user.preferences.showMascot}
  onContextMenuOpen={handleOpenMascotMenu}
/>

// Walking strip exclusivo del dashboard desktop
<MascotBubble variant="walking" route="/dashboard" />

// Empty state de pre-órdenes vacías
<EmptyState variant="general">
  <MascotBubble variant="sleeping" size={96} inEmptyState />
  <Title>Sin pre-órdenes todavía. Suma una y empezamos.</Title>
  <Helper>Anota tu primer pedido y empezamos a ordenar tu colección.</Helper>
  <Button variant="primary" onClick={handleCreateOrder}>Crear pedido</Button>
</EmptyState>

// Achievement toast — pago full que cierra una pre-orden
<Toast variant="achievement" ariaLive="polite">
  <MascotBubble variant="celebrating" size={56} trigger="achievement" />
  <span>¡Cubierto! Una pre-orden menos. ✨</span>
</Toast>
```

## Tokens consumidos

- `--accent-cool` (color-mix 16% bubble, 24% empty hero, 12% glow dark)
- `--accent-warm` (halo achievement 24% ring + 14% glow)
- `--surface`
- `--border`
- `--text-primary` (overlay state layer del bubble)
- `--text-on-accent` (no aplica directamente; reservado por consistencia si futuras variants lo necesitan)
- `--focus-ring`
- `--state-hover-mix`, `--state-pressed-mix`
- `--radius-pill`
- `--elevation-3`
- `--space-4`
- `--space-24` (heredado del `<EmptyState>` padre)
- `--motion-fast`, `--motion-slow`
- `--ease-emphasis`, `--ease-bounce`
- `--z-mascot`
- `--breakpoint-md`

## ADRs aplicables

- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md): D17 (toggle "Mostrar mascota" en preferences + bonus menú contextual right-click / long-press).
- [ADR 0003 — Demo decisions](../decisions/0003-demo-decisions.md): D2 (theme toggle solo light/dark — relevante para la opción "Cambiar tema" del menú contextual).

## Dependencias

- [`Button.md`](./Button.md) — el item "Cambiar tema" del menú contextual delega a un control que respeta el contrato del Button (variant ghost dentro de DropdownMenu/Sheet).
- `<DropdownMenu>` (Tier 3, sub-agente δ) — desktop context menu.
- `<Sheet>` (Tier 3, sub-agente δ) — mobile context menu.
- `<EmptyState>` (Tier 3, sub-agente δ) — wrapper requerido por `sleeping`.
- `<Toast variant="achievement">` (Tier 3, sub-agente δ) — wrapper requerido por `celebrating`.
- Sprite assets — entregados como sprite sheet PNG @1x/@2x/@3x (formato decidido en S6, placeholder en S4).

## Notas para S5 (implementación)

1. Implementar como `src/components/modules/MascotBubble/MascotBubble.tsx` — **solo `variant="idle"`** en S5. Los variants `walking`, `celebrating`, y `sleeping` se difieren a S12.
2. Usar sprite placeholder (PNG neutro 56×56 @1x, @2x, @3x) hasta que el asset final llegue en S6. El import del sprite debe ser indirecto (`spriteSet` prop o import condicional) para que el swap en S6 no requiera cambios de API.
3. `position="bubble"`: `position: fixed; bottom: var(--space-6); right: var(--space-6);` en mobile y desktop. `z-index: var(--z-mascot)` = 35.
4. Menú contextual básico (right-click desktop / long-press mobile): implementar en S5 con las dos opciones mínimas: "Ocultar mascota" (escribe `localStorage["pandatrack-mascot-visible"]` = `"hidden"`) y "Cambiar tema" (llama a `setTheme()` de `src/lib/theme.ts`). Usar `<DropdownMenu>` existente.
5. El `AppShell` lee `localStorage["pandatrack-mascot-visible"]` en mount y no renderiza `<MascotBubble>` si está `"hidden"`. El setting toggle en preferences restaura la visibilidad.
6. PostHog: `POSTHOG_EVENTS.APP_SHELL.MASCOT_HIDDEN` / `MASCOT_SHOWN` cuando el usuario oculta/muestra desde el menú contextual.

## Notas para S12 (implementación)

1. **Sprite sheet placeholder vs final**: S4 trabaja con sprite sheet placeholder (forma neutral 56×56 con animación frame-by-frame). La decisión pixel art vs AI hi-res se toma en S6 (`tokens.md §11.4`). El componente debe abstraer el asset detrás de una prop `spriteSet` o de un import dinámico para que el swap sea sin cambios de API.
2. **Walking coordination**: la coordinación entre cooldown (`localStorage["mascot:lastWalkAt"]`), detector de idle (`requestIdleCallback` + listeners de mouse/keyboard/scroll), y route check (`/dashboard` only) vive en un hook custom `useMascotWalking()` declarado en S12. El componente se mantiene "tonto" — recibe `shouldWalk: boolean` del hook y anima si es `true`.
3. **Sync `localStorage` con menú contextual**: la opción "Ocultar mascota" del menú escribe en `localStorage["pandatrack-mascot-visible"]` y emite un `storage` event. El layout `(app)` escucha el event y desmonta la mascota en todas las pestañas abiertas.
4. **Long-press detection**: usar `pointerdown` + `setTimeout(500)` con cancel en `pointermove` (threshold 8px) y `pointerup`. Implementación cross-browser estándar; verificar comportamiento en iOS Safari (puede requerir `touch-action: manipulation`).
5. **`prefers-reduced-motion` listener**: usar `matchMedia('(prefers-reduced-motion: reduce)')` con `addEventListener('change', ...)` para reaccionar mid-session.
6. **Z-stack debugging**: validar que `--z-mascot` 35 no choque con sticky elements internos del bento (que viven en `--z-sticky` 10) ni con popovers (`--z-popover` 40). En el caso del menú contextual, usar el z-index del componente padre (`<DropdownMenu>` `--z-popover` 40 > `--z-mascot` 35 ✓).
7. **PostHog event**: instrumentar `mascot_context_menu_opened` con prop `source: "right-click" | "long-press"` para medir descubribilidad real del bonus de ADR 0001 D17. Centralizar nombre en `POSTHOG_EVENTS` (regla repo).
8. **A11y verification**: los SR (NVDA, VoiceOver) anuncian correctamente el `aria-label` cuando el sprite entra al DOM. Validar en S12 con setup automatizado (axe-core en CI) + un smoke manual.
9. **Walking strip layout**: el strip horizontal de 80px de alto requiere coordinación con el dashboard layout. El componente expone una prop opcional `stripBounds: { top: number; left: number; width: number }` para que el dashboard pase los límites; sin ella, el componente asume que su parent tiene `position: relative` y usa toda la fila.
10. **Halo achievement ad-hoc**: la receta del halo coincide con `tokens.md §6` (no es un token semántico nuevo). Si en S12 se decide promoverlo a token (`--halo-achievement`), actualizar este componente y `<Toast variant="achievement">` en sincronía.
