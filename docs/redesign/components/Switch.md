---
title: Switch
tier: 1
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0001 D3 (disabled sin opacity)
  - ADR 0001 D14 (theme toggle persistente — usado por el switch del header/settings)
---

# Switch

## Propósito

Atom de formulario para preferencias on/off persistentes. Aparece en [`settings.md`](../screens/settings.md): toggle MFA, toggle "Mostrar mascota", toggle del theme `light`/`dark` (también desde header — ADR 0001 D14 con persistencia `localStorage["pandatrack-theme"]`), toggle de densidad, opt-ins de notificaciones futuros. Diferencia clave vs `<Checkbox>`: semántica de "ajuste activado/desactivado" con efecto inmediato (optimistic update), no parte de un envío de form.

## API TypeScript

```ts
type SwitchProps = {
  /** Identificador único para `<Label for>`. */
  id: string;
  /** Nombre del campo (cuando aplica). */
  name?: string;
  /** Estado actual. */
  checked: boolean;
  /** Cambio de estado. Usar para mutación optimista (snapshot → cambio local → server action → revert en fallo). */
  onChange: (checked: boolean) => void;
  /** Bloqueo lógico — sin opacity (ADR 0001 D3). */
  disabled?: boolean;
  /** Estado de carga (mutación pendiente). El switch queda visualmente en el nuevo estado pero con loader. */
  loading?: boolean;
  /** Etiqueta inline opcional. Click sobre label togglea. */
  label?: string;
  /** Helper neutro debajo. */
  helperText?: string;
  /** Mensaje de error mapeado por el `<Form>`. */
  error?: string;
  /** Tamaño. Default `md` (track 36×20). */
  size?: "sm" | "md";
};
```

## Variants / Sizes

| Variant (`size`) | Uso                                                      | Tokens consumidos                                                            |
| ---------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `sm`             | Toggles densos en filtros                                | track `1.75rem × 1rem`, thumb `0.75rem`, padding clickable 36×36             |
| `md` (default)   | Settings, header theme, preferencias                     | track `2.25rem × 1.25rem` (36×20), thumb `1rem` (16×16), padding clickable 44×44 |

## Estados visuales

| Estado     | Receta CSS (light)                                                                                                                                                                                                                                                                                                                                                                       | Receta CSS (dark) | Notas                                                                                                                                            |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `off`      | track `width: 2.25rem; height: 1.25rem; background: color-mix(in oklch, var(--text-primary) 16%, transparent); border-radius: var(--radius-pill);` + thumb `width: 1rem; height: 1rem; background: var(--surface); border-radius: var(--radius-pill); transform: translateX(0); box-shadow: var(--elevation-1);`                                                                       | mismo (track ajusta automáticamente al `--text-primary` de dark)             | Margen interno `0.125rem` para que el thumb no toque los bordes.                                                                                  |
| `on`       | track `background: var(--accent);` + thumb `transform: translateX(1rem)`                                                                                                                                                                                                                                                                                                                 | mismo             | El thumb se mantiene en `--surface` (para contraste vs `--accent`).                                                                              |
| `hover`    | overlay `background-color: color-mix(in oklch, var(--text-primary) var(--state-hover-mix), transparent);` aplicado al wrapper clickable                                                                                                                                                                                                                                                  | mismo             | —                                                                                                                                                |
| `focus`    | `outline: 2px solid var(--focus-ring); outline-offset: 2px;`                                                                                                                                                                                                                                                                                                                              | mismo             | El outline rodea el track completo.                                                                                                              |
| `disabled` | track `background: color-mix(in oklch, var(--text-muted) 16%, transparent);` + thumb `background: var(--surface);` + label `color: var(--text-muted); pointer-events: none;`                                                                                                                                                                                                              | mismo             | Sin `opacity` (ADR 0001 D3).                                                                                                                      |
| `loading`  | track mantiene el color del estado destino + thumb con `loader-2` Lucide 12×12 animado en lugar del thumb sólido                                                                                                                                                                                                                                                                          | mismo             | `aria-busy="true"`. Si el server falla, el padre revierte (`<Switch>` queda controlado por el padre — optimistic).                                |
| `error`    | el switch en sí no cambia visual (el error se muestra en `<ErrorMessage>` debajo)                                                                                                                                                                                                                                                                                                         | mismo             | Si el padre revierte tras error, el switch vuelve al estado previo y el `<ErrorMessage>` aparece.                                                  |

Receta base (CSS):

```css
.switch {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  min-height: 2.75rem;
  padding-block: var(--space-2);
}

.switch__track {
  width: 2.25rem;
  height: 1.25rem;
  background: color-mix(in oklch, var(--text-primary) 16%, transparent);
  border-radius: var(--radius-pill);
  position: relative;
  transition: background var(--motion-fast) var(--ease-emphasis);
  flex: 0 0 auto;
}

.switch--on .switch__track {
  background: var(--accent);
}

.switch__thumb {
  position: absolute;
  top: 0.125rem;
  left: 0.125rem;
  width: 1rem;
  height: 1rem;
  background: var(--surface);
  border-radius: var(--radius-pill);
  box-shadow: var(--elevation-1);
  transition: transform var(--motion-fast) var(--ease-emphasis);
}

.switch--on .switch__thumb {
  transform: translateX(1rem);
}

.switch:focus-visible .switch__track {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.switch--disabled {
  pointer-events: none;
}

.switch--disabled .switch__track {
  background: color-mix(in oklch, var(--text-muted) 16%, transparent);
}

.switch__label {
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}

.switch--disabled .switch__label {
  color: var(--text-muted);
}
```

## Mobile vs desktop

- Mobile: padding clickable 44×44 efectivo aunque el track sea 36×20.
- Desktop: tap area mantiene ≥36×36; el track puede mantenerse al mismo tamaño.
- Label inline: tipografía `--text-body` mobile/desktop.

## Accesibilidad

- Rol ARIA: `role="switch"` con `aria-checked="true" | "false"`.
- Atributos requeridos:
  - `id` enlazado con `<Label for>` o el componente expone su propio `label`.
  - `aria-busy="true"` cuando `loading`.
  - `aria-invalid="true"` cuando `error`.
  - `aria-describedby` apuntando a `<HelperText>`/`<ErrorMessage>`.
- Keyboard: `Space` o `Enter` togglean. Foco visible siempre.
- Focus management: el outline rodea el track + label cuando hay label inline.
- Screen reader: anuncia "Conmutador, activado" / "Conmutador, desactivado".
- `prefers-reduced-motion`: la transición del thumb se mantiene a `--motion-fast` (es pequeña, no es desorientadora). Alternativamente, reducir a opacity-only con corte directo si la auditoría lo pide.

## Motion

- Toggle: thumb `translateX(0) ↔ translateX(1rem)` con `--motion-fast` `--ease-emphasis`. Track background `--motion-fast` `--ease-emphasis`.
- Loading: spinner `loader-2` reemplaza el thumb sólido con rotación `--motion-base` infinito linear.
- Bajo `prefers-reduced-motion`: corte directo del thumb sin transición; track cambia opacity-only.

## Copy default + i18n

| Clave i18n sugerida                          | Valor ES                                  |
| -------------------------------------------- | ----------------------------------------- |
| `components.switch.aria.on`                  | "Activado"                                |
| `components.switch.aria.off`                 | "Desactivado"                             |
| `components.switch.aria.loading`             | "Cambiando…"                              |
| `components.switch.theme.label`              | "Modo oscuro"                             |
| `components.switch.mascot.label`             | "Mostrar mascota"                         |
| `components.switch.mfa.label`                | "Doble factor"                            |

## Edge cases

1. **Optimistic update + server fallo**: el padre revierte `checked`; el `<Switch>` muestra el estado revertido. `<ErrorMessage>` aparece debajo o un `<Toast>` se dispara. El `<Switch>` NO orquesta el revert.
2. **Toggle muy rápido (doble click)**: el padre debe debounce / throttle si necesita evitar requests duplicados. El componente emite todos los cambios.
3. **`disabled` y `checked` simultáneos**: visualmente queda en estado `on` con track `--text-muted` 16% transparente.
4. **`loading` cuando ya está en el estado destino**: el spinner aparece en el thumb del lado activo; el padre decide cuándo limpiar `loading`.
5. **Theme toggle sin `prefers-color-scheme` consultado primero**: ADR 0003 D2 — el switch lee `localStorage["pandatrack-theme"]` y solo cae a `prefers-color-scheme` en primera carga sin valor guardado.
6. **Label muy largo**: `flex-wrap: wrap` en mobile con `gap: var(--space-2)`; el track queda alineado al baseline del primer renglón del label.
7. **Form nativo HTML5**: si `name` está, opcionalmente renderizar `<input type="checkbox" hidden>` sincronizado.

## Anti-patrones

1. **Usar `<Switch>` para selección dentro de un form que requiere submit explícito**: usar `<Checkbox>`.
2. **Animar con `--motion-base`** (280ms): un toggle on/off debe ser snappy. Usar `--motion-fast`.
3. **`opacity: 0.5` para disabled**: tokens semánticos (ADR 0001 D3).
4. **`text-white` hardcoded en thumb**: usar `--surface` (el thumb es del color del lienzo elevado, no del texto).
5. **Confirmar cada toggle con modal**: rompe la fricción esperada de un switch. Usar undo toast (ADR 0001 D4) si el efecto es destructivo.
6. **Toggle sin label adyacente o sin `<Label>`**: rompe affordance y accesibilidad.
7. **Animar el track entrando con scale/translate**: el motion del switch es interno (thumb), no externo.

## Ejemplos de uso

```tsx
// Settings · preferencias · theme toggle
<Switch
  id="theme-toggle"
  name="theme"
  checked={theme === "dark"}
  onChange={(checked) => {
    const next = checked ? "dark" : "light";
    setTheme(next); // optimistic
    persistTheme(next).catch(() => setTheme(theme)); // revert on fail
  }}
  label="Modo oscuro"
  helperText="Se aplica al instante."
/>

// Settings · MFA toggle con loading
<Switch
  id="mfa-toggle"
  checked={mfaEnabled}
  onChange={toggleMfa}
  loading={mutating}
  label="Doble factor"
  error={mfaError}
/>
```

## Tokens consumidos

- `--surface`
- `--text-primary`, `--text-muted`
- `--accent`, `--focus-ring`
- `--destructive`
- `--font-sans`
- `--text-body`, `--text-caption`
- `--space-2`
- `--radius-pill`
- `--elevation-1`
- `--motion-fast`, `--motion-base`
- `--ease-emphasis`
- `--state-hover-mix`

## ADRs aplicables

- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md) (D3 disabled sin opacity, D14 theme toggle dual)
- [ADR 0003 — Theme toggle solo light/dark](../decisions/0003-tokens-design-direction.md) (supersedes ADR 0001 D14: no `system` mode)

## Dependencias

- [`./Label.md`](./Label.md)
- [`./HelperText.md`](./HelperText.md)
- [`./ErrorMessage.md`](./ErrorMessage.md)

## Notas para S12 (implementación)

1. Implementar como `<button role="switch">`. Sincronizar `<input type="checkbox" hidden>` solo si el form requiere submit nativo.
2. El theme toggle del header se implementa con este `<Switch>` o con un `<IconButton>` (sun/moon) — decidir en S6. Ambos consumen el mismo store.
3. El optimistic update + revert es responsabilidad del padre (`useOptimistic` o reducer). El componente solo dispara `onChange`.
4. Validar en S12 que el thumb no se sale del track con tamaños no-default vía CSS calc (`thumb-translate = track-width - thumb-width - 2×offset`).
5. Decidir si el spinner del estado `loading` reemplaza al thumb (UI más limpia) o aparece junto al label (más explícito). MVP: reemplaza al thumb.
