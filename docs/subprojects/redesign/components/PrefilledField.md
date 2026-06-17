---
title: PrefilledField
tier: 2
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0001 D2 (field-as-attribute — wrapper surface-elevated, eyebrow ↳ DESDE, ghost change con pencil)
---

# PrefilledField

## Propósito

Render canónico de un campo pre-llenado por contexto (sin input editable bloqueado). Aparece como bloque `surface-elevated` con eyebrow `↳ DESDE PT-XXXXXX`, valor (avatar + nombre), y acción ghost "Cambiar" con ícono `pencil`. Caso canónico: header del paso 2 de [`delivery-create.md`](../screens/delivery-create.md) cuando el flujo arranca con `?sourceOrderId=` (ADR 0001 D13). Comunica "esto está en otra parte de tu modelo, no aquí" — distinto de un input deshabilitado (ADR 0001 D2).

## API TypeScript

```ts
import type { ReactNode } from "react";

type PrefilledFieldProps = {
  /** Eyebrow del bloque, e.g. "↳ DESDE PT-002418". El consumidor compone el prefijo + identificador. */
  eyebrow: string;
  /** Valor visible: avatar + nombre, o solo nombre, u otro contenido. */
  value: ReactNode;
  /** Handler de cambio. Si está presente, se renderiza el botón "Cambiar". */
  onChange?: () => void;
  /** Copy del CTA. Default "Cambiar". */
  changeLabel?: string;
  /** Si true, el handler dispara confirm sheet antes de habilitar el cambio (cuando hay datos derivados). */
  confirmOnChange?: boolean;
  /** Override del ícono de change. Default Lucide `pencil` 16. */
  changeIcon?: ReactNode;
  /** Identificador estable para `aria-describedby` cuando el padre quiere asociar helper text. */
  id?: string;
};
```

## Variants / Sizes

Sin variants. La densidad y tipografía son fijas (un solo tamaño visual canónico). Mobile vs desktop solo afecta padding.

| Slot interno     | Tokens consumidos                                                       |
| ---------------- | ----------------------------------------------------------------------- |
| Wrapper          | `--surface-elevated`, `--radius-lg`, `--space-3`, `--space-4`           |
| Eyebrow          | `--font-mono`, `--text-eyebrow`, `--text-muted`                         |
| Valor            | `--text-primary`, `--font-weight-medium-body`, `--font-sans`            |
| Botón Change     | `--text-secondary` → `--text-primary` en hover, ícono `pencil` 16       |

## Estados visuales

| Estado            | Receta CSS (light)                                                                                                                                                                                       | Receta CSS (dark) | Notas                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------- |
| `default`         | `background: var(--surface-elevated); border-radius: var(--radius-lg); padding: var(--space-3) var(--space-4); display: flex; align-items: center; gap: var(--space-3);`                                | mismo             | Sin border decorativo; el `--surface-elevated` ya señaliza "atributo".      |
| `hover` (en Change) | El botón cambia de `color: var(--text-secondary)` a `color: var(--text-primary)`. Sin bg fill — es ghost.                                                                                              | mismo             | El bloque entero NO es interactivo; solo el botón Change.                   |
| `focus` (en Change) | `outline: 2px solid var(--focus-ring); outline-offset: 2px;` en el botón.                                                                                                                              | mismo             | Visible siempre.                                                             |
| `editing`         | El componente reemplaza `value` por un input editable (responsabilidad del padre — ver "Notas para S12"). El wrapper conserva `--surface-elevated` para coherencia visual mientras el input está activo. | mismo             | Estado transitorio. La transición opacity-only `--motion-fast` `--ease-emphasis`. |

Receta base CSS (corresponde a `tokens-css.md` §8):

```css
.prefilled-field {
  background: var(--surface-elevated);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.prefilled-field__eyebrow {
  font-family: var(--font-mono);
  font-size: var(--text-eyebrow);
  line-height: var(--text-eyebrow--line-height);
  letter-spacing: var(--text-eyebrow--letter-spacing);
  text-transform: uppercase;
  color: var(--text-muted);
}

.prefilled-field__value {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-weight: var(--font-weight-medium-body);
  font-size: var(--text-body);
  flex: 1 1 auto;
  min-width: 0;
}

.prefilled-field__change {
  margin-left: auto;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  min-height: 2.75rem; /* tap target */
  min-width: 2.75rem;
}

.prefilled-field__change:hover {
  color: var(--text-primary);
}

.prefilled-field__change:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.prefilled-field__change > svg {
  width: 16px;
  height: 16px;
  color: currentColor;
}
```

Layout:

- Eyebrow stackeado **arriba** del valor en mobile (column).
- En desktop, el componente sigue siendo column (eyebrow encima del valor) con el botón Change a la derecha en flex row del wrapper.
- Estructura HTML: `<div class="prefilled-field"><div class="prefilled-field__main"><eyebrow/><value/></div><button class="prefilled-field__change">…</button></div>` para mantener Change a la derecha en flex.

## Mobile vs desktop

- **Mobile (`< --breakpoint-md`):** padding `var(--space-3) var(--space-4)`. El botón Change conserva `min-height: 44px`.
- **Desktop (`≥ --breakpoint-md`):** mismo padding. El componente respira en grid 12-col con su contenedor padre.
- **Wrap en mobile angosto (360px):** si el valor + avatar + Change desbordan, el botón Change baja a una línea propia debajo del valor (responsive flex-wrap). Padre puede forzar `flex-direction: column` con clase modificadora.
- **Tap target:** botón Change cumple ≥44×44 con padding clickable (`var(--space-2)` + `min-height/min-width: 2.75rem`).

## Accesibilidad

- Rol ARIA: el wrapper es un `<div>` semántico (no un input — no hay edición sin click en Change). El eyebrow es decorativo (`<span>` o `<p>`), opcionalmente `<dt>` si se compone como `<dl>` semántico.
- Atributos:
  - `aria-describedby={id}` en el botón Change apuntando al wrapper si el padre quiere relación explícita.
  - Botón Change: `aria-label="{changeLabel} {valueText}"` (e.g. "Cambiar Akiba Records") cuando el `value` es un ReactNode complejo.
- Keyboard: Tab navega al botón Change. Enter / Space lo activa.
- Focus management: outline solo en el botón Change. El wrapper no es focusable.
- Screen reader:
  - Lee eyebrow → valor → botón Change en orden.
  - El ícono pencil va con `aria-hidden="true"`; el SR lee solo el `changeLabel`.
- `prefers-reduced-motion`: la transición editing reduce a opacity puro.

## Motion

- **Hover Change:** transición de color `--motion-fast` `--ease-emphasis`.
- **Editing (transición a input):** crossfade del slot `value` ↔ input en `--motion-fast` `--ease-emphasis` con opacity. Sin slide.
- Bajo `prefers-reduced-motion`: solo opacity, sin transition de color (instant).

## Copy default + i18n

| Clave i18n sugerida                          | Valor ES                                |
| -------------------------------------------- | --------------------------------------- |
| `components.prefilledField.eyebrow.fromOrder` | "↳ DESDE {humanId}"                    |
| `components.prefilledField.eyebrow.fromStore` | "↳ DESDE {storeName}"                  |
| `components.prefilledField.change.default`   | "Cambiar"                               |
| `components.prefilledField.change.aria`      | "Cambiar {valueLabel}"                  |
| `components.prefilledField.confirm.title`    | "¿Cambiar y revisar productos?"         |
| `components.prefilledField.confirm.body`     | "Si cambias la tienda los productos elegibles cambian. Va a quedar pendiente revisar." |
| `components.prefilledField.confirm.cta`      | "Sí, cambiar"                           |
| `components.prefilledField.confirm.cancel`   | "No, dejarlo así"                       |

EN se deja para S12.

## Edge cases

1. **`value` como ReactNode con `<StoreAvatar>` + nombre:** el componente NO orquesta el avatar; el padre lo provee. Asegurar que el `<StoreAvatar>` pase `aria-hidden="true"` cuando el nombre adyacente ya da el label.
2. **`onChange` ausente:** no se renderiza el botón Change. El bloque queda solo informativo (e.g. cuando el contexto NO permite cambiar — fuera del MVP de delivery-create pero defensivo).
3. **`confirmOnChange: true`:** el handler intercepta el click y dispara confirm sheet (componente externo). El componente NO contiene el sheet; solo dispara `onChange` después de la confirmación del padre.
4. **`changeIcon` custom (e.g. `arrow-right-left`):** soportado. Default `pencil` 16.
5. **`eyebrow` sin prefijo `↳ DESDE`:** soportado pero anti-patrón (rompe convención ADR 0001 D2). Validar en S12 con linter o code review.
6. **`value` muy largo (e.g. nombre de tienda 60 chars):** el flex `min-width: 0` permite truncar con `text-overflow: ellipsis` si el padre lo envuelve en un `<span class="truncate">`.
7. **Modo editing mientras el padre aún no recibió `confirmOnChange` answer:** el componente debe mantener el render del valor original hasta que el padre confirme.
8. **Avatar dentro del `value` con `size: 24`:** soportado, padre decide. El componente no fuerza tamaño.
9. **`id` colisiona con otro elemento del DOM:** padre responsable de unicidad.
10. **Doble click en Change:** tratar como un solo evento via debounce simple (responsabilidad del padre o handler).

## Anti-patrones

1. **Renderizar como `<input disabled>`:** ADR 0001 D2 prohíbe — comunica "deshabilitado por error", no "atributo heredado".
2. **`opacity: 0.5` para señalar "pre-llenado":** rompe AA y D2.
3. **Eyebrow sin prefijo `↳ DESDE`:** pierde legibilidad del origen del prefill.
4. **Botón Change sin ícono pencil:** rompe convención visual cross-pantalla.
5. **Botón Change con bg fill (no ghost):** compite con CTA primary del form (rompe §2 decálogo).
6. **`confirmOnChange: false` cuando hay datos derivados:** el padre debe activar la confirm sheet — `false` solo cuando es seguro cambiar sin reseteo.
7. **Animación spring al entrar en editing:** rompe densidad informativa. Crossfade simple.
8. **Tap target del botón Change <44×44:** rompe decálogo §8.

## Ejemplos de uso

```tsx
// Delivery create · paso 2 con prefill desde sourceOrder
<PrefilledField
  eyebrow="↳ DESDE PT-002418"
  value={
    <>
      <StoreAvatar size={32} store={{ name: "Akiba Records" }} />
      <span>Akiba Records</span>
    </>
  }
  onChange={() => openStoreCombobox()}
  confirmOnChange
  changeLabel="Cambiar"
/>

// Sin acción de cambio (informativo)
<PrefilledField
  eyebrow="↳ DESDE PT-002418"
  value="Akiba Records"
/>
```

## Tokens consumidos

- `--surface-elevated`
- `--text-primary`, `--text-secondary`, `--text-muted`
- `--font-mono`, `--font-sans`
- `--text-eyebrow`, `--text-body`, `--text-caption`
- `--font-weight-medium-body`, `--font-weight-medium`
- `--radius-lg`, `--radius-sm`
- `--space-1`, `--space-2`, `--space-3`, `--space-4`
- `--motion-fast`, `--ease-emphasis`
- `--focus-ring`

## ADRs aplicables

- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md) D2 (field-as-attribute), D13 (delivery-create paso 2 con prefill).

## Dependencias

- [`./StoreAvatar.md`](./StoreAvatar.md) (avatar inline en `value` cuando aplica).
- [`./Eyebrow.md`](./Eyebrow.md) (atom interno para el eyebrow del bloque).
- Iconos `lucide-react` (`pencil`).
- Para `confirmOnChange`, integración con `<ConfirmSheet>` (tier 3, fuera de este spec).

## Notas para S12 (implementación)

1. El estado "editing" (transición a input editable) NO vive en el componente — el padre cambia el render entre `<PrefilledField>` y `<Combobox>`/`<Input>`. El componente solo dispara `onChange`.
2. Decidir en S12 si el componente expone `forwardRef` para que el padre pueda enfocar el input editable apenas se monte.
3. Para confirm sheet, integrar con el componente `<ConfirmSheet>` que se especificará en tier 3 de S4 o en S5. MVP: el padre maneja la modal manualmente.
4. Validar que el `aria-label` del botón Change con valores complejos (avatar + nombre) se compone correctamente — helper `getValueText(value: ReactNode): string`.
5. La transición editing puede beneficiarse de `view-transition-name` para morph del valor al input. MVP: simple opacity.
6. El padre debe limpiar el `confirmOnChange` flag tras confirmar para evitar dobles diálogos.
7. Considerar exponer evento `onChangeStart` antes del `onChange` para tracking analytics (PostHog).
