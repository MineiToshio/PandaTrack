---
title: Form
tier: 4
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0001 D12 (items.min(1), step navegable, autosave local "Guardado en este navegador, hace Ns")
  - ADR 0001 D2 (field-as-attribute para inputs pre-llenados)
  - ADR 0001 D3 (disabled sin opacity)
---

# Form

## Propósito

Wrapper de Tier 4 que orquesta el contrato completo de un formulario PandaTrack: validación post-blur (decálogo §3), submit con loading, server-error mapping a campos específicos, optimistic update en paralelo al Server Action (regla `optimistic-client-updates.mdc`) y autosave local opcional con copy "Guardado en este navegador, hace Ns" (ADR 0001 D12 OC4). Aparece en [`order-create.md`](../screens/order-create.md), [`delivery-create.md`](../screens/delivery-create.md) y [`settings.md`](../screens/settings.md). Provee `FormContext` que `<FieldGroup>`, `<FormFooter>`, `<Input>` y demás controles consumen vía hook `useFormContext<T>()`.

## API TypeScript

```ts
import type { ReactNode } from "react";
import type { ZodSchema } from "zod";

type FieldErrors<TValues> = Partial<Record<keyof TValues & string, string>>;

type SubmitSuccess<TResult> = {
  ok: true;
  data: TResult;
};

type SubmitFailure<TValues> = {
  ok: false;
  /** Errores mapeados a campos. Aparecen en `<FieldGroup>` / `<ErrorMessage>` del campo correspondiente. */
  fieldErrors?: FieldErrors<TValues>;
  /** Error a nivel de formulario. Se renderiza inline arriba del `<FormFooter>`. */
  formError?: string;
};

type SubmitResult<TValues, TResult> = SubmitSuccess<TResult> | SubmitFailure<TValues>;

type OptimisticContract<TValues> = {
  /** Aplicación local de la mutación, ejecutada en paralelo con el Server Action. */
  apply: (values: TValues) => void;
  /** Revert al snapshot previo si el server devuelve `ok: false`. */
  revert: () => void;
};

type AutosaveContract = {
  /** Clave de `localStorage`. Sugerido: `pandatrack.draft.<screen>.<entityId?>`. */
  storageKey: string;
  /** Throttle de escritura. Default `1500` (~`--motion-base * 5`). */
  throttleMs?: number;
  /** Activación. Default `true` cuando se pasa el contrato. */
  enabled?: boolean;
};

type FormProps<TValues, TResult> = {
  /** Validador Zod — corre full en submit; los `safeParse` por campo corren post-blur. */
  schema: ZodSchema<TValues>;
  /** Defaults iniciales. */
  defaultValues: Partial<TValues>;
  /**
   * Submit handler. Recibe los `values` ya validados por el schema.
   * Debe devolver `{ ok: true, data }` o `{ ok: false, fieldErrors?, formError? }`.
   * Nunca lanzar — los errores inesperados los captura el wrapper y emite `formError` fallback.
   */
  onSubmit: (values: TValues) => Promise<SubmitResult<TValues, TResult>>;
  /** Contrato optimistic (opcional). Si está, se ejecuta `apply` en paralelo al server y `revert` si falla. */
  optimistic?: OptimisticContract<TValues>;
  /** Contrato de autosave local (opcional). */
  autosave?: AutosaveContract;
  /** ID HTML del `<form>` (necesario para asociar el `<FormFooter>` con `form="<id>"`). */
  id: string;
  /** Nombre semántico del form para analítica/debug. */
  name: string;
  /** Children — incluye `<FieldGroup>`s y un `<FormFooter>` al final. */
  children: ReactNode;
  /** Callback opcional disparado tras submit `ok: true`. Útil para navegación. */
  onSuccess?: (result: TResult) => void;
};

type FormContextShape<TValues> = {
  values: Partial<TValues>;
  errors: FieldErrors<TValues>;
  touched: Set<keyof TValues & string>;
  isSubmitting: boolean;
  formError?: string;
  /** Timestamp del último autosave local. `undefined` si no hay autosave o aún no escribió. */
  lastSavedAt?: Date;
  setValue: <K extends keyof TValues & string>(field: K, value: TValues[K]) => void;
  setTouched: (field: keyof TValues & string) => void;
  setFieldError: (field: keyof TValues & string, message: string | undefined) => void;
  /** Solicita submit programático (equivalente a click en el primaryAction del FormFooter). */
  submit: () => void;
};

declare function useFormContext<TValues>(): FormContextShape<TValues>;
```

## Variants / Sizes

`<Form>` no tiene variants visuales propias — es invisible (sólo orquestación). Su layout viene del padre (section card, modal, sheet). La única diferenciación de comportamiento es el set de contratos opcionales que recibe.

| Variant (composición de contratos)               | Uso                                                                                  | Tokens consumidos |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ | ----------------- |
| `bare`                                           | Form simple sin optimistic ni autosave (ej. login, password change).                 | —                 |
| `+ optimistic`                                   | Form que muta una lista que el usuario está viendo (ej. agregar nota privada).        | —                 |
| `+ autosave`                                     | Form de creación largo (`order-create`, `delivery-create`).                          | —                 |
| `+ optimistic + autosave`                        | Caso completo (creación con preview optimista en lista + draft local).                | —                 |

## Estados visuales

| Estado          | Receta CSS (light)                                                                                                                                                              | Receta CSS (dark) | Notas                                                                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `idle`          | `<form>` semántico sin estilos propios; los `<FieldGroup>` y `<FormFooter>` aportan layout.                                                                                      | mismo             | El `<form>` puede recibir `display: flex; flex-direction: column; gap: var(--space-4);` cuando el padre no provee layout.                                                                            |
| `submitting`    | El `<form>` agrega `aria-busy="true"`. El `primaryAction` del `<FormFooter>` muestra `loading: true`. Inputs no se deshabilitan (mantienen focus, permiten editar).              | mismo             | Decisión post-rev 3: bloquear inputs durante submit corta el flujo natural; sólo se bloquea si el padre lo decide explícitamente vía `disabled` por field.                                           |
| `formError`     | Inline alert sobre el `<FormFooter>`: `background: color-mix(in oklch, var(--destructive) 14%, var(--surface)); border: 1px solid color-mix(in oklch, var(--destructive) 28%, var(--surface)); color: var(--destructive-chip-text); border-radius: var(--radius-lg); padding: var(--space-3) var(--space-4); display: flex; align-items: flex-start; gap: var(--space-2);` | `color: var(--destructive);` mismo bg/border via color-mix sobre `--surface` dark. | Ícono Lucide `alert-triangle` 16×16 leading. `role="alert" aria-live="polite"`. Aparece con fade `--motion-fast` `--ease-emphasis`. Copy override por el server o fallback `components.form.serverErrorFallback`. |
| `restorePrompt` | `<Modal>` con 2 CTAs ("Sí, restaurar" / "Empezar de cero"). Detalle visual delegado a `<Modal>`.                                                                                  | mismo             | Aparece sólo al mount cuando hay draft válido en `localStorage[storageKey]`. Si schema rechaza el draft, se descarta silenciosamente (sin prompt).                                                  |

Receta del inline alert de `formError`:

```css
.form__form-error {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  margin-block-end: var(--space-3);
  background: color-mix(in oklch, var(--destructive) 14%, var(--surface));
  border: 1px solid color-mix(in oklch, var(--destructive) 28%, var(--surface));
  border-radius: var(--radius-lg);
  color: var(--destructive-chip-text);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}

:root[data-theme="dark"] .form__form-error {
  color: var(--destructive);
}

.form__form-error-icon {
  flex: 0 0 auto;
  width: 1rem;
  height: 1rem;
  margin-block-start: 0.125rem;
  color: currentColor;
}
```

## Mobile vs desktop

- Mobile (`< --breakpoint-md`): el `<form>` ocupa el ancho del contenedor (section card / sheet / modal). El inline alert de `formError` se renderiza por encima del `<FormFooter>` sticky bottom.
- Desktop (`≥ --breakpoint-md`): mismo layout. El `<FormFooter>` puede ser sticky bottom dentro de un panel scrollable o inline al pie del form (decisión del padre).
- El restore prompt usa `<Modal>` centered en desktop y bottom sheet en mobile (decisión del propio `<Modal>`).

## Accesibilidad

- Rol ARIA: native `<form>` con `aria-busy="true"` durante submit y `id` único. El `aria-labelledby` apunta al heading de la pantalla / modal cuando aplica.
- Atributos requeridos:
  - `<form id={id}>` para que `<FormFooter>` pueda usar `<button form={id} type="submit">`.
  - Inline alert de `formError`: `role="alert" aria-live="polite"`. Ícono `alert-triangle` con `aria-hidden="true"` (la información viaja en el texto).
  - El primer error tras submit recibe `focus()` automático (orquestado por el wrapper); los `<FieldGroup>` mapean errors a sus controles vía `aria-invalid` + `aria-describedby`.
- Keyboard:
  - `Tab` / `Shift+Tab` navegan inputs en orden visual (sin saltos por `tabIndex` arbitrario).
  - `Enter` dentro de un `<Input>` simple dispara submit del form padre.
  - `Esc` no se intercepta — lo maneja el `<Modal>`/`<Sheet>` contenedor.
- Focus management: tras submit fallido, el wrapper hace `focus()` al primer control con `error` (orden DOM). Tras submit exitoso con `onSuccess`, el padre decide la navegación.
- Screen reader:
  - El inline alert de `formError` se anuncia vía `aria-live="polite"` cuando aparece.
  - El `lastSavedAt` se anuncia sólo cuando el usuario foca el `helperText` del `<FormFooter>` (no se anuncia cada throttle para no spam).
  - El restore prompt se anuncia como diálogo modal (responsabilidad del `<Modal>`).
- `prefers-reduced-motion`: el fade del inline alert se reduce a corte directo. El `<FormFooter>` no anima.

## Motion

- Inline alert de `formError`: `opacity: 0 → 1` con `--motion-fast` `--ease-emphasis`. Sin transform.
- Aparición/desaparición de `helperText` del autosave en el `<FormFooter>`: fade `--motion-fast` `--ease-emphasis`.
- Submit loading: el spinner del primaryAction usa `--motion-base` infinito linear (delegado a `<Button loading>`).
- Bajo `prefers-reduced-motion`: corte directo en cada caso.

## Copy default + i18n

| Clave i18n sugerida                            | Valor ES                                                              |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| `components.form.autosave.localPrefix`         | "Guardado en este navegador,"                                         |
| `components.form.autosave.relativeTime`        | "hace {seconds}s"                                                     |
| `components.form.autosave.justNow`             | "recién"                                                              |
| `components.form.serverErrorFallback`          | "Algo se rompió de este lado. Dale otra vez."                         |
| `components.form.restoreDraftPrompt`           | "Tenés un draft guardado. ¿Lo restauramos?"                           |
| `components.form.restoreDraftDescription`      | "Lo dejamos hace {seconds}s en este navegador."                       |
| `components.form.restoreDraftYes`              | "Sí, restaurar"                                                       |
| `components.form.restoreDraftNo`               | "Empezar de cero"                                                     |
| `components.form.submitting.aria`              | "Guardando…"                                                          |

> Nota voice glossary: `lastSavedAt` se renderiza concatenando `localPrefix` + ` ` + `relativeTime` interpolando los segundos. Para `<5s` se usa `justNow` ("recién"). Distinto a `"Guardado, hace Ns"` (sin "en este navegador"): la diferencia explicita que el draft NO es cross-device (ADR 0001 D12 OC4).

## Edge cases

1. **Schema rechaza `defaultValues` parciales al mount**: el wrapper no valida en mount (validación post-blur). Sólo corre full validation en submit.
2. **Server devuelve `fieldErrors` con keys que no están en el schema**: el wrapper los registra como `formError` con copy fallback, evitando errores huérfanos invisibles.
3. **Server devuelve `ok: false` sin `fieldErrors` ni `formError`**: el wrapper usa `components.form.serverErrorFallback` ("Algo se rompió de este lado. Dale otra vez.").
4. **`onSubmit` lanza una excepción**: el wrapper la captura, hace `revert()` si hay `optimistic`, expone `formError` fallback y reporta a Sentry. Inputs conservan los valores tipeados (principle §3).
5. **Optimistic + server falla con `formError` (no fieldErrors)**: `revert()` se ejecuta antes de mostrar el alert; el toast de error es responsabilidad del padre vía `<Toast variant="destructive">` (no se duplica con el alert inline; usar uno u otro según el contexto).
6. **Autosave con valores que el schema no acepta** (parciales válidos pero schema estricto): se persisten igual; al mount, el wrapper intenta `schema.safeParse(stored)` y, si falla, descarta el draft silenciosamente (ADR 0001 D12 OC4).
7. **Múltiples tabs editando el mismo `storageKey`**: el wrapper escucha `storage` event y muestra el restore prompt si la última escritura no es la propia. MVP: política "última escritura gana", documentar en S12.
8. **`storageKey` no disponible** (modo incógnito Safari, cuota llena): autosave queda inactivo silenciosamente; `lastSavedAt` queda `undefined`. El form sigue funcionando.
9. **Submit con `optimistic` y navegación inmediata vía `onSuccess`**: el `apply` ya pintó la lista destino; el `onSuccess` solo navega. Sin refetch.
10. **Submit success limpia el draft**: tras `ok: true` el wrapper hace `localStorage.removeItem(storageKey)`.
11. **Tab navigation lineal**: sin `tabIndex` arbitrario. Los `<FieldGroup>` aparecen en orden DOM = orden visual.
12. **Server retorna `data: TResult` con shape diferente al esperado**: el wrapper no lo valida (responsabilidad del Server Action contractual). El `onSuccess` lo recibe tal cual.

## Anti-patrones

1. **Validar on-change**: rompe principle §3. Validación corre solo post-blur o en submit.
2. **Limpiar inputs tras error 500**: rompe principle §3 server-error mapping. Conservar valores tipeados.
3. **`router.refresh()` después de `ok: true` para ver el cambio**: rompe `optimistic-client-updates.mdc`. El Server Action devuelve `data` canónica para reconciliar.
4. **Saltarse `revert()` en fallo optimistic**: silent failure → erosión de confianza. Siempre revert + alert.
5. **Mostrar `formError` Y toast a la vez por el mismo error**: doble notificación; usar uno (alert inline si el error es contextual al form, toast si el form ya cerró).
6. **Copy genérico "Algo salió mal"**: voice glossary — usar fallback "Algo se rompió de este lado. Dale otra vez."
7. **Autosave sin "en este navegador"**: rompe ADR 0001 D12 OC4. El usuario debe saber que el draft no viaja entre dispositivos.
8. **Throttle de autosave on-keystroke** (cada 50ms): default `1500ms`. Debounce no — throttle (escritura periódica mientras hay cambios pendientes).
9. **Bloquear inputs durante submit con `disabled`**: rompe ADR 0001 D3 (sin opacity) y corta el flujo natural. Solo el CTA muestra `loading`.
10. **Persistir secrets en `localStorage`**: schemas que incluyen `password`, `creditCard`, `apiToken` deben omitirse del autosave. El wrapper NO inspecciona — responsabilidad del padre vía `autosave: undefined` para esos forms.

## Ejemplos de uso

```tsx
// Order create — full contract: schema + optimistic preview en orders list + autosave local
<Form
  id="order-create-form"
  name="order-create"
  schema={orderCreateSchema}
  defaultValues={{ items: [], totalCost: undefined, currency: "ARS" }}
  optimistic={{
    apply: (values) => insertDraftOrder(values, ordersList),
    revert: () => restoreOrdersList(),
  }}
  autosave={{ storageKey: "pandatrack.draft.order-create", throttleMs: 1500 }}
  onSubmit={async (values) => createOrderAction(values)}
  onSuccess={(order) => router.push(`/orders/${order.humanId}`)}
>
  <FieldGroup name="storeId" label="Tienda" required>
    <Combobox id="storeId" name="storeId" options={stores} />
  </FieldGroup>
  <FieldGroup name="items" label="Productos" required helperText="Al menos 1.">
    <ItemListEditor id="items" name="items" />
  </FieldGroup>
  <FieldGroup name="totalCost" label="Total" required>
    <Input id="totalCost" name="totalCost" type="number" prefix="$" suffix="USD" />
  </FieldGroup>

  <FormFooter
    primaryAction={{ label: "Crear pedido", type: "submit" }}
    secondaryAction={{ label: "Cancelar", onClick: () => router.back() }}
  />
</Form>

// Settings · profile — bare (sin optimistic ni autosave)
<Form
  id="settings-profile-form"
  name="settings-profile"
  schema={profileSchema}
  defaultValues={profile}
  onSubmit={async (values) => updateProfileAction(values)}
>
  <FieldGroup name="username" label="Usuario" required>
    <Input id="username" name="username" prefix="@" />
  </FieldGroup>
  <FieldGroup name="displayName" label="Nombre" optional>
    <Input id="displayName" name="displayName" />
  </FieldGroup>

  <FormFooter primaryAction={{ label: "Guardar", type: "submit" }} />
</Form>
```

## Tokens consumidos

- `--surface`, `--background`
- `--destructive`, `--destructive-chip-text`
- `--text-primary`, `--text-secondary`, `--text-muted`
- `--accent` (caret de inputs hijos)
- `--focus-ring`
- `--font-sans`
- `--text-body`, `--text-caption`
- `--space-2`, `--space-3`, `--space-4`
- `--radius-lg`
- `--motion-fast`, `--motion-base`
- `--ease-emphasis`
- `--breakpoint-md`

## ADRs aplicables

- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md) (D2 field-as-attribute, D3 disabled sin opacity, D12 items.min(1) + step navegable + autosave local)

## Dependencias

- [`./FormFooter.md`](./FormFooter.md) — sticky bottom con CTAs y `helperText` para `lastSavedAt`.
- [`./FieldGroup.md`](./FieldGroup.md) — agrupador label + control + helper/error que consume `useFormContext()`.
- [`./Input.md`](./Input.md), [`./Textarea.md`](./Textarea.md), [`./Select.md`](./Select.md), [`./Combobox.md`](./Combobox.md), [`./DateInput.md`](./DateInput.md), [`./DateRangeInput.md`](./DateRangeInput.md), [`./Checkbox.md`](./Checkbox.md), [`./Radio.md`](./Radio.md), [`./Switch.md`](./Switch.md) — controles que viven dentro de un `<FieldGroup>`.
- [`./ErrorMessage.md`](./ErrorMessage.md) — render del error por campo (orquestado por `<FieldGroup>`).
- [`./HelperText.md`](./HelperText.md) — render del helper por campo.
- (Tier 3) `<Modal>` — usado para el restore prompt.
- (Tier 3) `<Toast>` — surface paralelo opcional para revert errors (sólo cuando el form ya cerró).

## Notas para S12 (implementación)

1. **Librería de form esperada**: el spec asume hook `useFormContext<T>()` con shape `FormContextShape<T>`. La implementación concreta queda abierta:
   - Opción A: librería interna PandaTrack sobre `useState` + `useReducer` (control total, sin dependencia).
   - Opción B: `react-hook-form` + adapter que cumple la interfaz (más maduro, integra Zod via `@hookform/resolvers/zod`).
   - Recomendación: arrancar con `react-hook-form` por velocidad; encapsular detrás del hook `useFormContext` para poder reemplazar sin tocar consumidores.
2. **Server Action contract**: cada Server Action debe devolver `{ ok: true, data } | { ok: false, fieldErrors?, formError? }`. Documentar como tipo compartido en `src/types/forms.ts`. El wrapper NO mapea status HTTP — confía en el contrato.
3. **Autosave throttle**: usar `throttle` (no debounce) para garantizar escritura periódica mientras el usuario tipea continuo. Default `1500ms` (~`--motion-base * 5`). Implementar con `setTimeout` simple — `lodash.throttle` está sobredimensionado.
4. **`lastSavedAt` rendering**: el `<FormFooter>` recibe `lastSavedAt` vía `useFormContext()`. Calcula segundos relativos con un timer interno cada `1s`. Bajo `<5s` muestra "recién"; sino "{N}s".
5. **Restore prompt UX**: el modal muestra el timestamp relativo del draft ("Lo dejamos hace 12m") usando un util compartido `formatRelativeShort(date)` en `src/lib/format`. Si el draft tiene >7d, descartar silenciosamente (heurística para evitar restaurar contextos obsoletos).
6. **Sentry**: capturar excepciones lanzadas dentro de `onSubmit` con tag `form_name: <name>` y context con `field_count` (sin payload — datos del usuario fuera de logs).
7. **Analytics**: el wrapper emite eventos `POSTHOG_EVENTS.form.submit_attempt`, `form.submit_success`, `form.submit_failure` con prop `formName`. Centralizar nombres en `src/lib/constants.ts`.
8. **Multi-tab `storage` event**: la decisión sobre conflicto cross-tab se difiere a S12; MVP "última escritura gana" + log en consola dev.
9. **Modo incógnito Safari**: el wrapper hace `try/catch` alrededor de `localStorage.setItem` y deja el autosave inactivo si falla. No notifica al usuario.
10. **`onSubmit` con valores transformados**: la transformación (ej. coma → punto en montos) la hacen los controles individuales antes de emitir `onChange`. `onSubmit` recibe los valores ya canonizados.
