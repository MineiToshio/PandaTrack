---
title: WizardAccordion
tier: 3
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0003 D5 (wizard accordion para forms ≥3 pasos)
  - ADR 0001 D12 OC3 (step navegable libre, autosave local)
  - ADR 0001 D13 (delivery prefill arranca paso 2)
---

# WizardAccordion

## Propósito

Orquestador del patrón wizard accordion para forms de creación con ≥3 pasos. Mantiene un solo `<WizardStep>` expandido a la vez, sincroniza el `<Stepper>` superior y maneja el flujo `Continuar` / `Atrás`. Aplica a [`/orders/new`](../screens/order-create.md) (5 pasos), [`/deliveries/new`](../screens/delivery-create.md) (4 pasos) y `/stores/new` (5 pasos). El orquestador no posee el estado del form ni el autosave — sólo el estado de "paso activo" y el cálculo derivado de `state` por step.

## API TypeScript

```ts
type WizardAccordionProps = {
  /** Paso 1-indexed que arranca expandido. Default `1`. Caso ADR 0001 D13: si entra con prefill, padre pasa `startStep={2}`. */
  startStep?: number;
  /** Notifica cambios de paso activo (1-indexed). Útil para analytics y para que el padre persista el step en URL/localStorage. */
  onStepChange?: (n: number) => void;
  /** Lista de `<WizardStep>` hijos. El orquestador inyecta `state` y `onActivate` por contexto. */
  children: ReactNode;
};

/** API expuesta por context para uso interno entre WizardAccordion y WizardStep. */
type WizardAccordionContext = {
  activeStep: number;
  doneSteps: ReadonlySet<number>;
  totalSteps: number;
  reducedMotion: boolean;
  activate: (n: number) => void;
  markDoneAndAdvance: (n: number) => void;
  goBack: (n: number) => void;
};
```

## Variants / Sizes

`<WizardAccordion>` no expone variants — su layout deriva del breakpoint y de los `<WizardStep>` hijos. La densidad y el padding viven en cada step.

| Variant            | Uso                                                                                                       | Tokens consumidos                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `default` (única)  | Wizard de creación con 3+ pasos (orders / deliveries / stores).                                           | `--space-4` gap mobile, `--space-6` gap desktop, `--container-max-w-prose` ancho lectura.  |

## Estados visuales

El propio orquestador no pinta chrome. Cada step deriva su `state` así:

| Estado del step | Cálculo                                                          | Receta CSS (light/dark)                                                                                   | Notas                                                                              |
| --------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `todo`          | `n > activeStep && !doneSteps.has(n)`                             | Card colapsada (`<Card variant="outlined">`): `background: var(--surface)`, `border: 1px solid var(--border)`, `border-radius: var(--radius-xl)`. | Bolita del stepper con `border: 1px solid var(--border-strong)` y nº en `--text-muted`. |
| `active`        | `n === activeStep`                                                | Card expandida (`<SectionCard state="active">`): `background: var(--surface)`, `border: 1px solid var(--border-strong)`, `box-shadow: var(--elevation-2)`. | Bolita en `--accent` rellena con nº en `--text-on-accent`; halo focus opcional `box-shadow: 0 0 0 4px color-mix(in oklch, var(--accent) 18%, transparent)`. |
| `done`          | `doneSteps.has(n) && n !== activeStep`                            | Card colapsada con summary inline. Misma receta que `todo` + summary visible.                             | Bolita en `--success` rellena con ícono Lucide `check` 14px en `--text-on-accent`. |

Stepper superior (`<Stepper>`) consume el mismo state — la bolita del paso `n` y el segmento conector hereda el color de la bolita.

## Mobile vs desktop

- **`< --breakpoint-md` (mobile):** stack vertical full-width. Gap entre cards = `--space-4`. El stepper superior se renderiza compacto (números + bolita + label corto debajo, scroll horizontal sólo si overflowea). Sin sidebar de resumen — vive en sheet inferior `info` (ver `screens/order-create.md` §2).
- **`≥ --breakpoint-md` (desktop):** la columna del wizard ocupa el subtree principal de la página (cols 1-8 del grid 12 col cuando hay sidebar de resumen, o `--container-max-w-prose` si no). Gap entre cards = `--space-6`. Stepper full-width arriba con líneas conectoras flex:1.

El cálculo de paso activo y el orquestador son idénticos en ambos breakpoints. El auto-scroll usa `scrollIntoView({ behavior: 'smooth', block: 'start' })` con offset compensando `--header-h` mobile / `--header-h-desktop`.

## Accesibilidad

- Rol ARIA: el contenedor del orquestador es `<ol role="list">` para la secuencia de pasos. Cada step expone su propio `role="region"` con `aria-labelledby` (ver `WizardStep.md`).
- El `<Stepper>` se renderiza como `<nav aria-label="{label de pasos}">` con `<ol>` y cada item linkeable a su step. La bolita activa lleva `aria-current="step"`.
- Atributos requeridos:
  - `aria-live="polite"` en el contenedor superior del stepper para anunciar el cambio de paso ("Paso 2 de 5: Productos").
  - `aria-disabled="false"` en bolitas; ningún paso está estrictamente bloqueado (ADR 0001 D12 OC3).
- Keyboard:
  - `Tab` navega lineal entre inputs activos del paso expandido y luego salta al footer del step (Continuar / Atrás).
  - `Tab` desde el footer del step va a la primera bolita del stepper si existe interactividad pendiente, o sale del wizard.
  - `Enter` sobre una card colapsada la abre.
  - `Space` sobre una bolita del stepper abre el paso correspondiente.
  - `Esc` no se captura por el wizard (puede ser usado por el padre para cancelar el form).
- Focus management:
  - Al activar un step, mover foco al primer control activo dentro del body (input, combobox, etc.). Si no hay control, foco al heading del step (`tabindex="-1"`).
  - Al colapsar un step, NO devolver foco — el siguiente paso ya tomó el foco.
- Screen reader: cuando el padre marca un step como done, anunciar via `aria-live` "Paso 1 marcado como completado. Paso 2 abierto."
- `prefers-reduced-motion`: `scrollIntoView({ behavior: 'auto' })`; expand/collapse sin transition de `max-height`, sólo cambio inmediato de `display`. La bolita transiciona color sin scale.

## Motion

- **Expand/collapse de la card:** `max-height: 0 → calc(content)` + `opacity: 0 → 1` con `--motion-base` `--ease-out-expressive`. La altura final usa `max-height: var(--wizard-step-max)` con `--wizard-step-max: 9999px` como upper bound (no animar en altura real porque rompe perf). Alternativa S12: `interpolate-size: allow-keywords` cuando esté disponible.
- **Bolita del stepper transiciona estado:** `background-color` + `border-color` + `color` con `--motion-fast` `--ease-emphasis`. El check Lucide aparece con `opacity: 0 → 1` y `transform: scale(0.85) → scale(1)` `--motion-fast` `--ease-out-expressive`.
- **Auto-scroll:** `scrollIntoView({ behavior: 'smooth', block: 'start' })` programáticamente al cambio de paso activo. En reduced-motion: `behavior: 'auto'`.
- **Sin spring overshoot ni bounce.** Reservados para celebraciones (`--ease-bounce`).

## Copy default + i18n

El orquestador no expone copy propio. Cada `<WizardStep>` aporta su `eyebrow` / `title` / acciones. La integración del autosave (ADR 0001 D12 OC4) usa toast neutral con copy gestionado por el padre:

| Clave i18n sugerida                          | Valor ES (voice glossary aplicado)                   |
| -------------------------------------------- | ---------------------------------------------------- |
| `components.wizardAccordion.stepper.aria`    | "Pasos del formulario"                               |
| `components.wizardAccordion.announce.active` | "Paso {n} de {total}: {title}"                       |
| `components.wizardAccordion.announce.done`   | "Paso {n} marcado como listo."                       |
| `components.wizardAccordion.autosave.saved`  | "Guardado en este navegador, hace {seconds}s"        |
| `components.wizardAccordion.autosave.saving` | "Guardando…"                                         |

EN se deja para S12.

## Edge cases

1. **Un solo step:** el orquestador degrada a render directo sin stepper ni transiciones. Un consumer con un solo paso debe usar `<SectionCard>` plano — el wizard sólo activa cuando `Children.count(children) >= 2`.
2. **`startStep` fuera de rango:** clamp a `[1, totalSteps]`. Si `startStep > totalSteps`, abre el último.
3. **Saltar a un paso futuro sin completar el actual (ADR 0001 D12 OC3):** permitido. El padre decide si mostrar errores de validación al intentar `Continuar` desde un paso incompleto. El wizard no bloquea navegación.
4. **`Atrás` en paso 1:** sin op (el `secondaryAction` del WizardStep paso 1 puede ser `Cancelar` en lugar de `Atrás` — decisión del padre).
5. **`Continuar` en último paso:** marca done y dispara `primaryAction.onClick` (típicamente submit del form). El orquestador no avanza más allá del último step.
6. **Click en bolita de paso futuro:** abre ese paso sin marcar los intermedios como done. Coherente con OC3.
7. **Click en bolita de paso done:** abre y mantiene el done state (no se "des-completa" por entrar a editar).
8. **Cambio dinámico de `children` (agregar/quitar steps):** soportado; `doneSteps` se preserva por nº de step. Si se elimina un step done, su entrada queda huérfana; el padre debe limpiar.
9. **Prefill ADR 0001 D13:** padre pasa `startStep={2}` y marca paso 1 done internamente vía API expuesta (ref imperativo `markDone(1)` en S12, o pre-poblar via prop `initialDoneSteps?: number[]` agregado en MVP — anotar en S12).
10. **Reduced-motion al activar paso:** sin animar el scroll; mantener todas las transitions a 150ms `--ease-emphasis`.
11. **Autosave (ADR 0001 D12 OC4):** orquestación NO vive en el wizard. El padre `<Form>` corre su throttle, y al confirmar render del toast neutral consume `components.wizardAccordion.autosave.saved`. El orquestador puede aceptar un slot opcional `footerSlot` para incrustar el indicador en el chrome compartido — anotar en S12.

## Anti-patrones

1. **Permitir múltiples steps expandidos a la vez:** rompe el contrato ADR 0003 D5. Solo uno activo.
2. **Gating estricto (no permitir saltar a step futuro):** contradice OC3. El user puede revisar el formulario libremente.
3. **Animar `height: auto`:** causa jank. Usar `max-height` con un upper bound o `interpolate-size`.
4. **Devolver foco al body de la página al colapsar un step:** rompe el flujo. El nuevo step toma el foco.
5. **Reusar el wizard para forms con < 3 pasos:** usar `<SectionCard>` directos. El wizard agrega complejidad innecesaria.
6. **Renderizar el `<Stepper>` separado del orquestador:** debe estar gobernado por el mismo state. Si el padre quiere un stepper standalone, expone subcomponente `<WizardAccordion.Stepper />` que lee del context.
7. **Hardcodear `behavior: 'smooth'`:** debe condicionarse a `prefers-reduced-motion`.

## Ejemplos de uso

```tsx
// Order create — 5 pasos, arranca en paso 1
<WizardAccordion onStepChange={(n) => analytics.track("order.create.step", { n })}>
  <WizardStep n={1} eyebrow="Paso 1 · Tienda" title="¿Dónde lo compraste?"
    primaryAction={{ label: "Continuar", onClick: handleStoreContinue, disabled: !storeId }}>
    <StoreCombobox value={storeId} onChange={setStoreId} />
  </WizardStep>
  <WizardStep n={2} eyebrow="Paso 2 · Fechas" title="¿Cuándo y para cuándo?"
    primaryAction={{ label: "Continuar", onClick: handleDatesContinue }}
    secondaryAction={{ label: "Atrás", onClick: () => goBack(2) }}>
    {/* date inputs */}
  </WizardStep>
  {/* …pasos 3, 4, 5 */}
</WizardAccordion>

// Delivery create con prefill — arranca en paso 2 (ADR 0001 D13)
<WizardAccordion startStep={2} onStepChange={persistStep}>
  <WizardStep n={1} eyebrow="Paso 1 · Tienda" title="¿De qué tienda viene?"
    summary={prefilledStore.name}>
    <FieldAsAttribute fromHumanId={sourceOrderHumanId} value={prefilledStore} />
  </WizardStep>
  {/* …pasos 2, 3, 4 */}
</WizardAccordion>
```

## Tokens consumidos

- `--surface`, `--border`, `--border-strong`
- `--accent`, `--text-on-accent`, `--success`, `--text-muted`
- `--space-4`, `--space-6`
- `--radius-xl`
- `--elevation-2`
- `--motion-fast`, `--motion-base`
- `--ease-emphasis`, `--ease-out-expressive`
- `--container-max-w-prose`
- `--header-h`, `--header-h-desktop`
- `--breakpoint-md`

## ADRs aplicables

- [ADR 0003 — Decisiones consolidadas del demo visual](../decisions/0003-demo-decisions.md) (D5 wizard accordion)
- [ADR 0001 — Decisiones de cierre de Sesión 2](../decisions/0001-s2-closure-decisions.md) (D12 OC3 navegable, OC4 autosave local; D13 prefill paso 2)

## Dependencias

- [`./WizardStep.md`](./WizardStep.md) — children obligatorios.
- (Tier 2 pendiente) `<Stepper>` — indicador superior consumido vía context.
- (Tier 2 pendiente) `<SectionCard>` — variante `state="active"` para el step expandido.
- (Tier 2 pendiente) `<Card>` — variante `outlined` para steps colapsados.

## Notas para S12 (implementación)

1. **Estado del paso activo:** sugerencia `useState<number>(startStep)` + reducer si crece. Exponer `WizardAccordionContext` vía `createContext`.
2. **Marcar done sin avanzar:** definir si la API es `markDoneAndAdvance(n)` o dos métodos separados. MVP: combinado, suficiente para el flujo `Continuar`.
3. **Initial done steps (ADR 0001 D13):** evaluar agregar `initialDoneSteps?: number[]` o ref imperativa. Recomendación conservadora: prop declarativa (más fácil de testear).
4. **Auto-scroll offset:** depende del header sticky. S12 debe leer `--header-h` / `--header-h-desktop` runtime y sumar `--space-4` para respiración.
5. **Persistencia del paso activo:** opcional. Si el padre lo desea, persiste en `localStorage` o URL param vía `onStepChange`.
6. **Autosave throttle:** decisión del padre (típicamente `1500ms`). El wizard recibe el indicador como prop slot.
7. **`interpolate-size: allow-keywords`:** experimental al momento de escribir. Fallback `max-height` con upper bound es la receta MVP.
8. **Testing E2E:** Playwright debe verificar que tras `Continuar` el foco aterrice en el primer control del siguiente step y que `aria-current="step"` se mueva.
