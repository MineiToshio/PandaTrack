---
title: DetailSidebar
tier: 3
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0003 D7 (sidebar derecha consistente en pantallas de detalle)
  - ADR 0001 D6 (lifecycle separado por reversibilidad)
  - ADR 0001 D4 (toast neutral-undo para autosave)
---

# DetailSidebar

## Propósito

Sidebar consistente para pantallas de detalle (`/orders/[id]`, `/stores/[slug]`, `/deliveries/[id]`). Tres slots fijos en orden inviolable: `Resumen` (datos clave del recurso) · `Acciones` (CTAs reversibles) · `NotaPrivada` (textarea privado del viewer). Mobile stackea debajo del cuerpo principal; desktop sticky en la columna derecha. Las acciones destructivas irreversibles (`Eliminar`) viven en el overflow `[···]` del header del recurso, NO acá (ADR 0001 D6).

## API TypeScript

```ts
type DetailSidebarProps = {
  /**
   * Slot 1: stats / datos clave del recurso (totales, % pagado, fechas, tienda).
   * El consumer compone con `<MicroStat>`, `<StoreAvatar>`, listas de meta, etc.
   */
  resumen: ReactNode;
  /**
   * Slot 2: CTAs sobre el recurso. Orden visual obligatorio:
   * 1. primary (ej. "Crear entrega")
   * 2. secondary reversibles ghost (ej. "Editar", "Cancelar pedido")
   * 3. destructive-ghost reversibles (ej. "Reportar tienda")
   *
   * Las irreversibles (`Eliminar`) NO van acá — overflow del header.
   */
  acciones: ReactNode;
  /**
   * Slot 3: textarea privado del viewer con autosave throttled.
   * El consumer maneja el `<Textarea>` y la lógica de save; el slot solo lo enmarca.
   */
  notaPrivada: ReactNode;
};
```

> **Nota S12.** El componente NO orquesta el contenido — recibe ReactNode por slot. La consistencia entre pantallas viene de patrones repetidos por el consumer + esta carcasa de tres `<Card variant="elevated">` / `<SectionCard>` con orden fijo.

## Variants / Sizes

| Variant         | Uso                                                                                | Tokens consumidos                                                                                              |
| --------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `default`       | Pantallas de detalle de recurso (orders, stores, deliveries).                      | `--surface-elevated`, `--radius-xl`, `--space-4`/`--space-6`, `--elevation-2`, `--header-h-desktop`, `--space-12`. |

No expone variants cromáticas — el contenedor es invisible (gap entre cards). Los slots usan `<Card variant="elevated">` o `<SectionCard>` Tier 2 con elevation `--elevation-2`.

## Estados visuales

| Estado            | Receta CSS (light)                                                                                                                                                                                                                  | Receta CSS (dark)                                                                                                                                                                                                                       | Notas                                                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Wrapper (mobile)  | `display: flex; flex-direction: column; gap: var(--space-4); margin-top: var(--space-6);`                                                                                                                                            | mismo                                                                                                                                                                                                                                   | Aparece después del cuerpo principal en el flujo del documento.                                                                              |
| Wrapper (desktop) | `position: sticky; top: calc(var(--header-h-desktop) + var(--space-4)); display: flex; flex-direction: column; gap: var(--space-6); width: var(--detail-sidebar-w);`                                                                  | mismo                                                                                                                                                                                                                                   | `--detail-sidebar-w` pendiente S5 — ver Notas S12. Default tentativo `21.25rem` (340px) ajustable via override.                              |
| Card de slot      | `background: var(--surface-elevated); border-radius: var(--radius-xl); border: 1px solid var(--border); padding: var(--space-5);` (mobile) / `padding: var(--space-6);` (desktop) — heredado de `<Card variant="elevated">`            | mismo + composición dark de `--elevation-2`                                                                                                                                                                                             | Cada slot envuelto independientemente.                                                                                                       |
| Header de slot    | Eyebrow uppercase mono `--text-muted` + título `--text-subtitle` `--text-primary` o eyebrow standalone (decisión consumer)                                                                                                            | mismo                                                                                                                                                                                                                                   | Patrón canónico: eyebrow + heading. NotaPrivada usa eyebrow especial "TU NOTA PRIVADA · solo tú la ves" en `--text-muted`.                  |
| Acción primary    | `<Button variant="primary">` Tier 2 — `background: var(--accent); color: var(--text-on-accent);` full-width dentro del slot                                                                                                          | mismo                                                                                                                                                                                                                                   | Solo una primary por slot Acciones.                                                                                                          |
| Acción ghost reversible | `<Button variant="ghost">` Tier 2 — `color: var(--text-secondary); background: transparent;` con hover state layer                                                                                                              | mismo                                                                                                                                                                                                                                   | Ej. "Editar", "Cancelar pedido", "Reactivar".                                                                                                |
| Acción destructive-ghost | `<Button variant="destructive-ghost">` Tier 2 — `color: var(--destructive); background: transparent;` con hover `color-mix(in oklch, var(--destructive) 10%, transparent)` bg                                                | mismo                                                                                                                                                                                                                                   | Reversibles destructivas (ej. "Reportar tienda"). Las irreversibles van al overflow del header.                                              |
| Nota privada idle | `<Textarea>` Tier 1 dentro de la card; height min 6 líneas; placeholder en `--text-muted`                                                                                                                                            | mismo                                                                                                                                                                                                                                   | Counter de chars opcional en footer del slot en `--text-muted`.                                                                              |
| Nota privada saving | Indicador de autosave inline en `--text-muted` con copy "Guardando…" o "Guardado, hace Ns" (autosave throttle 1.5s)                                                                                                                | mismo                                                                                                                                                                                                                                   | Sin animar el contador (tabular-nums).                                                                                                       |
| Disabled (state)  | `color: var(--text-muted); border-color: var(--border); pointer-events: none;` (sin `opacity`) — ADR 0001 D3                                                                                                                          | mismo                                                                                                                                                                                                                                   | Ej. acción "Reactivar" cuando `!canReactivate`.                                                                                              |

## Mobile vs desktop

- **`< --breakpoint-md`:** stackeado vertical después del cuerpo principal. Orden: cuerpo → Resumen → Acciones → NotaPrivada. Gap entre cards `--space-4`. Cada card ocupa full-width de la página dentro del padding lateral del shell.
- **`≥ --breakpoint-md`:** sticky a la derecha, `top: calc(var(--header-h-desktop) + var(--space-4))`. Width `--detail-sidebar-w` (pendiente S5; tentativo 340-380px). Gap entre cards `--space-6`. La columna derecha vive dentro del grid 12 col del shell (cols 9-12 cuando `≥ --breakpoint-lg`; cols 8-12 con grid simplificado entre `md` y `lg`).

El orden de slots es **idéntico en ambos breakpoints**. La nota privada SIEMPRE en sidebar (mobile y desktop), nunca como acordeón en el cuerpo (ADR 0003 D7 regla 2).

## Accesibilidad

- Rol ARIA: el wrapper es `<aside aria-label="Información del recurso">` semánticamente. En mobile es `<aside>` sticky-less; en desktop es `<aside>` sticky.
- Cada card de slot es `<section aria-labelledby="...">` con heading h2/h3 dentro (decisión del consumer; default sugerido `<h2>`).
- Atributos requeridos:
  - El `<aside>` del wrapper recibe `aria-label` localizado (`components.detailSidebar.aria.region`).
  - Los buttons del slot Acciones llevan `aria-disabled` cuando `disabled`, no se ocultan.
  - El textarea de NotaPrivada tiene `<Label>` asociado vía `htmlFor`. El indicador de autosave ("Guardado, hace Ns") va en un `<span aria-live="polite">` dentro del slot.
- Keyboard:
  - `Tab` recorre Resumen (si tiene controles) → Acciones (botones en orden) → NotaPrivada (textarea).
  - `Esc` no captura — propaga al consumer (puede usarlo para cerrar overflow del header).
- Focus management:
  - Sin focus trap (no es modal).
  - El sticky desktop NO desplaza foco; mantiene su posición vertical.
- Screen reader:
  - El eyebrow "TU NOTA PRIVADA · solo tú la ves" debe leerse antes del textarea.
  - Cuando autosave commitea, el `aria-live="polite"` anuncia "Guardado, hace 0s" (rate-limit interno — el consumer puede silenciar consecutivos).
- `prefers-reduced-motion`: sin transiciones de scroll. Sticky se aplica inmediato (default browser).

## Motion

- **Wrapper en sí:** sin animar entrada — aparece con la página (sin stagger).
- **Cards de slot:** opcional fade-in sutil al primer mount con `--motion-fast` `--ease-emphasis`. MVP: sin animación.
- **Hover de botones del slot Acciones:** state layer `--motion-fast` `--ease-emphasis` (heredado del `<Button>` Tier 2).
- **Nota privada save indicator:** sin animar el contador. Cambio instantáneo entre "Guardando…" y "Guardado, hace Ns".
- **Reduced-motion:** sin animar nada.

## Copy default + i18n

| Clave i18n sugerida                                  | Valor ES (voice glossary aplicado)                              |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| `components.detailSidebar.resumen.title`             | "Resumen"                                                       |
| `components.detailSidebar.acciones.title`            | "Acciones"                                                      |
| `components.detailSidebar.notaPrivada.title`         | "Tu nota privada"                                               |
| `components.detailSidebar.notaPrivada.eyebrow`       | "TU NOTA PRIVADA · solo tú la ves"                              |
| `components.detailSidebar.notaPrivada.placeholder`   | "Anota lo que necesites recordar de este pedido…"               |
| `components.detailSidebar.notaPrivada.savedAt`       | "Guardado, hace {seconds}s"                                     |
| `components.detailSidebar.notaPrivada.savingNow`     | "Guardando…"                                                    |
| `components.detailSidebar.aria.region`               | "Información del recurso"                                       |

EN se deja para S12.

> **Tip de copy:** `notaPrivada.placeholder` se ajusta por contexto (`pedido` / `tienda` / `entrega`). El consumer pasa el placeholder concreto vía el `<Textarea>` que monta dentro del slot.

## Edge cases

1. **Slot vacío:** si `resumen` o `acciones` son `null` / `undefined`, NO renderizar la card vacía. El slot se omite del DOM. La nota privada SIEMPRE se renderiza (es decisión del consumer si la deshabilita cuando readonly).
2. **Acción en estado loading:** el botón mantiene su ancho original con spinner Lucide `loader-2` rotando + label opcional ("Cancelando…"). El resto del slot sigue interactivo.
3. **Acción no aplicable (ej. "Reactivar" cuando `!cancelled`):** ocultar el botón completamente (no mostrar disabled). La presencia del botón implica capability disponible.
4. **Nota privada con autosave fallido:** mostrar inline error en `--destructive` debajo del textarea con copy del consumer. Conservar el contenido tipeado.
5. **Sticky desktop más alto que viewport:** el sidebar overflow vertical NO scrollea independientemente — mantiene `position: sticky` y se trunca si el viewport es muy chico (caso raro). Alternativa S12: `max-height: calc(100vh - var(--header-h-desktop) - var(--space-8))` con `overflow-y: auto`.
6. **Reordenar slots:** prohibido (ADR 0003 D7 regla 1). El orden Resumen → Acciones → NotaPrivada es inviolable.
7. **Mover NotaPrivada al cuerpo principal:** prohibido (regla 2). Si una pantalla no tiene nota privada, el slot se omite (caso 1).
8. **Acción `Eliminar` en el slot Acciones:** PROHIBIDO. Va al overflow `[···]` del header del recurso (ADR 0001 D6).
9. **Pantallas con sidebar derecho ya existente (legacy):** la migración debe consolidar todo el contenido en estos 3 slots o moverlo al cuerpo. No coexisten dos sidebars.
10. **Mobile: orden distinto al desktop:** prohibido (regla 5 ADR 0003 D7). El stack respeta el orden idéntico.
11. **Acciones con > 6 botones:** desbordamiento — el consumer debe priorizar y mover los menos usados al overflow `[···]` del header.

## Anti-patrones

1. **Renderizar nota privada como acordeón en el cuerpo principal:** rompe consistencia ADR 0003 D7.
2. **Reordenar slots por pantalla:** rompe consistencia.
3. **Mezclar acciones destructivas irreversibles dentro del slot Acciones:** ADR 0001 D6 las saca al overflow del header.
4. **`opacity: 0.5` para acción disabled:** ADR 0001 D3.
5. **Sticky con offset incorrecto (no compensar `--header-h-desktop`):** se solapa con el header del shell.
6. **Hardcodear width en px:** usar `--detail-sidebar-w` (token semántico — ver Notas S12).
7. **Render del wrapper sin `<aside>`:** rompe semántica.
8. **Sin `aria-live` en el indicador de autosave:** el usuario screen reader no se entera de que se guardó.
9. **Toast variant `neutral-undo` para confirmar autosave de la nota:** el toast neutral-undo es para acciones revocables (delete, cancel). El autosave de la nota usa indicador inline en `--text-muted`, no toast.

## Ejemplos de uso

```tsx
// Order detail
<DetailSidebar
  resumen={
    <>
      <MicroStat label="Total" value="$ 120,00" mono />
      <MicroStat label="Pagado" value="$ 71,50" mono />
      <MicroStat label="Restante" value="$ 48,50" mono accent="--accent" />
      <ProgressBar value={60} max={100} label="60% pagado" />
      <MetaList
        items={[
          { label: "Tienda", value: <StoreAvatarRow store={store} /> },
          { label: "Día del pedido", value: "5 may 2026" },
          { label: "Llegada", value: "10–20 jun 2026" },
        ]}
      />
    </>
  }
  acciones={
    <>
      <Button variant="primary" onClick={handleCreateDelivery}>
        Crear entrega
      </Button>
      <Button variant="ghost" onClick={handleEdit}>
        Editar
      </Button>
      {canCancel && (
        <Button variant="ghost" onClick={handleCancel}>
          Cancelar pedido
        </Button>
      )}
      {canReactivate && (
        <Button variant="ghost" onClick={handleReactivate}>
          Reactivar
        </Button>
      )}
    </>
  }
  notaPrivada={
    <PrivateNoteField
      value={note}
      onChange={setNote}
      placeholder="Anota lo que necesites recordar de este pedido…"
      autosaveThrottleMs={1500}
    />
  }
/>;

// Store detail
<DetailSidebar
  resumen={
    <>
      <MicroStat label="Tus pedidos" value="12" />
      <MicroStat label="Total gastado" value="$ 1.247,50" mono />
      <MicroStat label="Última visita" value="hace 3 días" />
    </>
  }
  acciones={
    <>
      <Button variant="primary" onClick={handleNewOrder}>
        Anotar pedido aquí
      </Button>
      <Button variant="ghost" onClick={handleSave}>
        Guardar tienda
      </Button>
      <Button variant="destructive-ghost" onClick={handleReport}>
        Reportar tienda
      </Button>
    </>
  }
  notaPrivada={
    <PrivateNoteField
      value={note}
      onChange={setNote}
      placeholder="Anota lo que necesites recordar de esta tienda…"
    />
  }
/>;
```

## Tokens consumidos

- `--surface-elevated`
- `--border`, `--border-strong`
- `--text-primary`, `--text-secondary`, `--text-muted`, `--text-on-accent`
- `--accent`, `--success`, `--destructive`
- `--focus-ring`
- `--space-4`, `--space-5`, `--space-6`, `--space-8`, `--space-12`
- `--radius-xl`
- `--elevation-2`
- `--motion-fast`
- `--ease-emphasis`
- `--header-h-desktop`
- `--text-eyebrow`, `--text-subtitle`, `--text-body`, `--text-caption`
- `--breakpoint-md`, `--breakpoint-lg`
- (Pendiente S5) `--detail-sidebar-w`

## ADRs aplicables

- [ADR 0003 — Decisiones consolidadas del demo visual](../decisions/0003-demo-decisions.md) (D7 sidebar derecha consistente)
- [ADR 0001 — Decisiones de cierre de Sesión 2](../decisions/0001-s2-closure-decisions.md) (D6 lifecycle por reversibilidad, D4 toast neutral-undo, D3 disabled sin opacity)

## Dependencias

- (Tier 2 pendiente) `<Card variant="elevated">` o `<SectionCard>` — wrapper de cada slot.
- (Tier 2 pendiente) `<Button>` `variant="primary"` / `variant="ghost"` / `variant="destructive-ghost"` — acciones.
- (Tier 1) [`./Textarea.md`](./Textarea.md) — base del slot NotaPrivada (envuelto por `<PrivateNoteField>` Tier 2 con autosave).
- (Tier 1) [`./Eyebrow.md`](./Eyebrow.md) — header de slots.
- (Tier 1) [`./Label.md`](./Label.md) — asociación con textarea.
- (Tier 2 pendiente) `<MicroStat>` mini — items del slot Resumen.
- (Tier 2 pendiente) `<StoreAvatar>` — meta del slot Resumen en orders/deliveries.

## Notas para S12 (implementación)

1. **`--detail-sidebar-w` token:** Pendiente decisión S5 (Navegación y layouts). Tentativo: `21.25rem` (340px) o `23.75rem` (380px). El componente debe consumir el token semántico, NO hardcodear. Default fallback en MVP `width: clamp(20rem, 28vw, 24rem)` si el token aún no existe.
2. **Sticky offset compensación:** `top: calc(var(--header-h-desktop) + var(--space-4))`. Si el header ocupa más en algún caso (breadcrumbs altos), el consumer puede pasar override.
3. **Autosave de nota privada:** Tier 2 `<PrivateNoteField>` orquesta throttle (1.5s default) + indicador inline. NO usa toast neutral-undo (ese se reserva para deletes — ADR 0001 D4).
4. **Slot Resumen estructura libre:** el componente NO impone una grid interna. El consumer compone con primitivas (`<MicroStat>`, `<MetaList>`, `<StoreAvatar>`).
5. **Slot Acciones spacing:** gap entre botones `--space-2` (mobile) / `--space-3` (desktop). Decisión hereda del `<Card>` interno; si el consumer monta una lista flat de buttons, el componente puede aplicar `display: flex; flex-direction: column; gap: var(--space-2);` automáticamente — anotar como decisión MVP.
6. **Test E2E:** Playwright cubre (a) orden de slots idéntico mobile/desktop, (b) sticky desktop al scrollear, (c) acción `Eliminar` AUSENTE del sidebar (regression test contra ADR 0001 D6), (d) autosave de nota muestra indicador.
7. **Cuando se diseñe `/deliveries/[id]`:** validar que el slot Resumen acomoda los datos de entrega (productos, costo envío, ETA) sin romper el patrón. Anotar gap si surge.
8. **Optimistic update de nota privada:** el `<PrivateNoteField>` debe seguir el contrato `optimistic-client-updates.mdc` — snapshot, cambio local, server action, revert en fallo.
