---
title: WizardStep
tier: 3
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0003 D5 (estructura del paso del wizard accordion)
  - ADR 0001 D12 OC3 (step navegable libre)
  - ADR 0001 D3 (no usar opacity en gating)
---

# WizardStep

## Propósito

Paso individual dentro de `<WizardAccordion>`. Renderiza eyebrow + title + summary cuando `done`, body cuando `active`, y un footer con `primaryAction` (Continuar) + `secondaryAction` (Atrás / Cancelar). Aplica a todos los steps de [`/orders/new`](../screens/order-create.md), [`/deliveries/new`](../screens/delivery-create.md) y `/stores/new`. Consume el contexto del orquestador para conocer su `state`.

## API TypeScript

```ts
type WizardStepAction = {
  /** Texto del botón. Voice glossary aplicado por el padre. */
  label: string;
  onClick: () => void;
  /** Indicador de pending mientras el padre confirma la acción (server roundtrip o validation async). */
  loading?: boolean;
  /** Bloquea click sin recurrir a `opacity: 0.5` (ADR 0001 D3). */
  disabled?: boolean;
};

type WizardStepProps = {
  /** Número del paso (1-indexed). Determina posición en el stepper y en el flujo. */
  n: number;
  /** Eyebrow uppercase mono. Patrón canónico: `"Paso {n} · {Categoría}"`. */
  eyebrow: string;
  /** Título de la pregunta o decisión del paso. Voz `tú`, voice glossary §7. */
  title: string;
  /** Summary mostrado cuando state === 'done'. Ej.: `"Akiba Records"`, `"3 productos"`, `"$ 43,00 USD"`. Si se omite, en done se muestra "Listo" en `--text-muted`. */
  summary?: string;
  /**
   * Override del state derivado por el orquestador. Solo para casos especiales (storybook, prefill manual).
   * Default: leído del `WizardAccordionContext`.
   */
  state?: "todo" | "active" | "done";
  /** Cuerpo del paso (inputs, comboboxes, etc.). */
  children: ReactNode;
  /**
   * CTA primario del footer del step. Marca el step como done y avanza al siguiente.
   * En el último step suele ser submit del form completo.
   */
  primaryAction?: WizardStepAction;
  /**
   * CTA secundario del footer del step. Tipicamente "Atrás" (n > 1) o "Cancelar" (n === 1).
   * Decisión del padre — el step no infiere.
   */
  secondaryAction?: WizardStepAction;
};
```

## Variants / Sizes

`<WizardStep>` no expone variants explícitas — su apariencia deriva del `state`. La densidad sigue las reglas de `<SectionCard>` / `<Card>` Tier 2.

| Variant (por `state`) | Uso                                                     | Tokens consumidos                                                           |
| --------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| `todo`                | Pasos futuros aún no abiertos.                          | `--surface`, `--border`, `--radius-xl`, padding `--space-5` mobile / `--space-6` desktop. |
| `active`              | Paso expandido — único visible a la vez.                | Mismas que `todo` + `--border-strong` outline + `--elevation-2`.            |
| `done`                | Pasos completados, summary inline visible.              | Mismas que `todo` + bolita `--success`.                                     |

## Estados visuales

| Estado   | Receta CSS (light)                                                                                                                                                                   | Receta CSS (dark)                                                                                                                                                       | Notas                                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `todo`   | `background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-5);` (mobile) / `padding: var(--space-6);` (desktop)               | mismo                                                                                                                                                                   | Header (eyebrow + title) en `--text-muted` + `--text-secondary`. Cursor `pointer` en toda la card; tap-target completo abre el step.            |
| `active` | mismo `todo` + `border-color: var(--border-strong); box-shadow: var(--elevation-2);` Body visible. Footer sticky inferior dentro de la card con `border-top: 1px solid var(--border);` | mismo + composición de `--elevation-2` dark (sin sombra real, ver `tokens.md` §6.2)                                                                                     | Title pasa a `--text-primary`. Halo accent opcional `box-shadow: 0 0 0 4px color-mix(in oklch, var(--accent) 18%, transparent)` cuando focus visible dentro. |
| `done`   | mismo `todo` + summary inline en `--text-primary` peso 500 al lado del title; bolita del stepper en `--success` con check Lucide                                                       | mismo                                                                                                                                                                   | Cursor `pointer`; click reabre el step (no des-completa).                                                                                       |
| `hover` (todo/done card) | `background-color: color-mix(in oklch, var(--text-primary) var(--state-hover-mix), var(--surface));`                                                                          | `background-color: color-mix(in oklch, var(--text-primary) var(--state-hover-mix), var(--surface));`                                                                    | State layer overlay, no cambia border.                                                                                                          |
| `focus-visible` | `outline: 2px solid var(--focus-ring); outline-offset: 2px; border-radius: var(--radius-xl);`                                                                                   | mismo                                                                                                                                                                   | Aplicado al wrapper `role="region"` o al heading clickable, según foco.                                                                          |
| `gated`  | (caso fuera de spec aquí) — si un step debe gating real, usa `<SectionCard variant="gated">` interno (ADR 0001 D3): no usar `opacity`.                                                 | mismo                                                                                                                                                                   | Ver `tokens-css.md` §7.                                                                                                                         |

### Bolita del stepper (token interno por step)

| state    | Receta                                                                                                                              |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `todo`   | `background: var(--surface); border: 1px solid var(--border-strong); color: var(--text-muted);` Glyph: número del step.            |
| `active` | `background: var(--accent); border: 1px solid var(--accent); color: var(--text-on-accent);` Glyph: número del step.                |
| `done`   | `background: var(--success); border: 1px solid var(--success); color: var(--text-on-accent);` Glyph: Lucide `check` 14px.          |

Tap target ≥ 44×44 mobile aunque el visual sea 28-32px (padding clickable extiende).

## Mobile vs desktop

- **`< --breakpoint-md`:** padding interno `--space-5`. Footer del step ocupa full-width con `Continuar` arriba y `Atrás` debajo (stack), o bien Atrás como ghost link a la izquierda + Continuar primary a la derecha si caben en una fila (target ≥48px).
- **`≥ --breakpoint-md`:** padding interno `--space-6`. Footer en una fila: Atrás ghost a la izquierda, Continuar primary a la derecha (alineación `justify-between`).
- En ambos breakpoints, la card colapsada (`todo` / `done`) tiene tap target en toda su superficie. Mobile: target completo; desktop: cursor `pointer` con state layer hover.

## Accesibilidad

- Rol ARIA: cada step renderiza un `<section role="region" aria-labelledby="wizard-step-{n}-title">`. El `id` del título es estable.
- Heading `<h2>` o `<h3>` (decisión del padre vía Tier 2 `<Heading>`); el wizard NO impone nivel — el contexto de la página lo decide. Default sugerido: `<h2>`.
- Atributos requeridos:
  - `aria-expanded={state === 'active'}` en la card colapsada cuando es clickable.
  - `aria-current="step"` cuando `state === 'active'`.
  - `aria-disabled` NO se usa — todos los steps son navegables (ADR 0001 D12 OC3).
- Keyboard:
  - `Enter` sobre la card colapsada → activa el step.
  - `Space` sobre la bolita del stepper → activa.
  - `Tab` recorre: card header (si interactiva) → primer control del body → … → `secondaryAction` → `primaryAction`.
  - `Enter` dentro de `primaryAction` o `secondaryAction` dispara su handler.
- Focus management: al activarse un step, el orquestador mueve foco al primer control activo del body. Si el body no tiene controles, el foco va al heading (`tabindex="-1"`).
- Screen reader: el cambio de `state` a `done` produce anuncio via `aria-live` desde el orquestador (ver `WizardAccordion.md`). El summary inline forma parte del nombre accesible: `aria-label="{title}, {summary}"` cuando `done`.
- `prefers-reduced-motion`: sin animar transiciones de altura ni scale; cambio inmediato de `state`. Bolita transiciona color con `--motion-fast` `--ease-emphasis`.

## Motion

- **Expand body (todo/done → active):** `max-height: 0 → var(--wizard-step-max)` + `opacity: 0 → 1` con `--motion-base` `--ease-out-expressive`. Padding del body crece de 0 a `--space-5` (mobile) / `--space-6` (desktop) en la misma curva.
- **Collapse body (active → done):** mismo curve invertido. El summary inline aparece con fade `--motion-fast` `--ease-emphasis`.
- **Bolita del stepper transición de estado:** `background-color`, `border-color`, `color` con `--motion-fast` `--ease-emphasis`. El check Lucide aparece con `transform: scale(0.85) → 1` + `opacity: 0 → 1` `--motion-fast` `--ease-out-expressive`.
- **Hover overlay:** `--motion-fast` `--ease-emphasis`.
- **Reduced-motion:** sin animar altura, scale ni overshoot. Sólo opacity con `--motion-fast` `--ease-emphasis`.

## Copy default + i18n

| Clave i18n sugerida                          | Valor ES (voice glossary aplicado)                |
| -------------------------------------------- | ------------------------------------------------- |
| `components.wizardStep.eyebrow.template`     | "Paso {n} · {category}"                           |
| `components.wizardStep.actions.continue`     | "Continuar"                                       |
| `components.wizardStep.actions.back`         | "Atrás"                                           |
| `components.wizardStep.actions.cancel`       | "Cancelar"                                        |
| `components.wizardStep.actions.submit`       | "Listo"                                           |
| `components.wizardStep.summary.donePending`  | "Listo"                                           |
| `components.wizardStep.aria.openStep`        | "Abrir paso {n}"                                  |
| `components.wizardStep.aria.activeStep`      | "Paso {n} de {total}: {title}"                    |

EN se deja para S12.

## Edge cases

1. **Paso sin `primaryAction`:** acepta render — útil para steps puramente informativos. La navegación se hace clickeando otra bolita.
2. **`primaryAction.disabled === true` y user intenta `Enter`:** sin op (acción ignorada). El padre comunica el motivo via `<HelperText>` o `<ErrorMessage>` dentro del body.
3. **`primaryAction.loading === true`:** el botón mantiene su ancho (no shrink), label se reemplaza por spinner Lucide `loader-2` con `--motion-base` linear infinito + texto opcional "Anotando…" en `--text-muted`. La card no acepta colapsar mientras loading.
4. **Step con summary muy largo:** truncar a 1 línea con `text-overflow: ellipsis`. Tooltip al hover desktop con texto completo. Mobile: ocupa la línea inferior si excede.
5. **`state` override manual en testing/storybook:** respetado; el orquestador no fuerza recálculo si el step tiene `state` prop explícita.
6. **Reabrir un step done desde la bolita:** mantiene `done` hasta que el usuario hace cambios. Si el padre detecta diff vs último valor confirmado, debe limpiar el `done` flag explícitamente.
7. **Step con error dentro del body:** la card mantiene `state === 'active'` pero el wrapper recibe `border-left: 2px solid var(--destructive)` (heredado de `<SectionCard>`). El padre dispara scroll a primer error post-submit.
8. **Auto-focus al activar step:** si `primaryAction.loading`, no robar foco — esperar a que termine.
9. **Card colapsada clickeable mientras teclas modifier están presionadas (Cmd+click):** sin op especial; navega como click normal.

## Anti-patrones

1. **Usar `opacity: 0.5` para steps `todo`:** prohibido (ADR 0001 D3 + tokens.md §1.6 disabled). Diferenciación cromática viene de border y bolita, no de opacity.
2. **Renderizar dos `<WizardStep>` con el mismo `n`:** el orquestador asume `n` único.
3. **Ocultar el step (display: none) cuando `todo`:** rompe el patrón. Las cards colapsadas son visibles, sólo el body está oculto.
4. **Forzar `aria-disabled` en pasos no completos:** contradice OC3.
5. **Tap target < 44×44 mobile en la bolita:** padding clickable debe extender.
6. **Hardcodear el nivel de heading dentro del componente:** decisión del padre.
7. **Renderizar el footer del step fuera de la card:** rompe la asociación visual; debe vivir dentro del wrapper con border-top divider.

## Ejemplos de uso

```tsx
// Paso 1 de Order create
<WizardStep
  n={1}
  eyebrow="Paso 1 · Tienda"
  title="¿Dónde lo compraste?"
  summary={selectedStore?.name}
  primaryAction={{
    label: "Continuar",
    onClick: handleContinue,
    disabled: !selectedStore,
  }}
>
  <Combobox
    id="order-store"
    name="storeId"
    mode="single"
    value={storeId}
    onChange={setStoreId}
    options={storeOptions}
    placeholder="Buscar tienda…"
    inlineAction={{ label: "Crear nueva tienda", onClick: openStoreSheet }}
  />
</WizardStep>

// Último paso (Listo) — submit del form completo
<WizardStep
  n={5}
  eyebrow="Paso 5 · Listo"
  title="Repasá y anotá."
  primaryAction={{
    label: "Anotar pedido",
    onClick: handleSubmit,
    loading: isSubmitting,
  }}
  secondaryAction={{ label: "Atrás", onClick: () => goBack(5) }}
>
  <OrderReviewSummary values={formValues} />
</WizardStep>
```

## Tokens consumidos

- `--surface`, `--border`, `--border-strong`
- `--text-primary`, `--text-secondary`, `--text-muted`, `--text-on-accent`
- `--accent`, `--success`, `--destructive`
- `--focus-ring`
- `--space-1`, `--space-2`, `--space-3`, `--space-4`, `--space-5`, `--space-6`
- `--radius-xl`
- `--elevation-2`
- `--motion-fast`, `--motion-base`
- `--ease-emphasis`, `--ease-out-expressive`
- `--state-hover-mix`
- `--text-eyebrow`, `--text-subtitle`, `--text-body`
- `--breakpoint-md`

## ADRs aplicables

- [ADR 0003 — Decisiones consolidadas del demo visual](../decisions/0003-demo-decisions.md) (D5 wizard step)
- [ADR 0001 — Decisiones de cierre de Sesión 2](../decisions/0001-s2-closure-decisions.md) (D3 disabled sin opacity, D12 OC3 navegable libre)

## Dependencias

- [`./WizardAccordion.md`](./WizardAccordion.md) — orquestador padre obligatorio.
- (Tier 2 pendiente) `<SectionCard>` — wrapper visual cuando `state === 'active'`.
- (Tier 2 pendiente) `<Card>` — wrapper cuando `todo` / `done`.
- (Tier 2 pendiente) `<Button>` — primaryAction (`variant="primary"`) y secondaryAction (`variant="ghost"`).
- (Tier 2 pendiente) `<Eyebrow>` — header del step.

## Notas para S12 (implementación)

1. **Lectura del context:** si el componente se usa fuera de `<WizardAccordion>`, debe lanzar warning explicit y degradar a `state="active"` siempre.
2. **`max-height` upper bound:** definir `--wizard-step-max: 9999px` o usar `interpolate-size: allow-keywords` cuando el target soporte (Chrome 129+, Safari 18+). Fallback `max-height: 9999px` es aceptable.
3. **Foco al activarse:** S12 implementa via `useEffect` que dispara `requestAnimationFrame` sobre el primer focusable del body.
4. **Heading level:** exponer prop opcional `headingLevel?: 'h2' | 'h3'` con default `h2`.
5. **Loading state del primaryAction:** spinner Lucide `loader-2` reusa el patrón de `<Button>` Tier 2 — no duplicar.
6. **Test E2E:** Playwright debe verificar (a) `Continuar` marca done + avanza, (b) click en bolita futura abre sin marcar intermedios, (c) `Atrás` no des-completa pasos posteriores.
