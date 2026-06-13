---
title: Sesión 09 — Módulo Entregas (Fase A demo + specs · Fase B implementación)
date: 2026-06-12
status: ✅ Fase A done (2 rounds + gap audit) · ✅ Fase B done (3 partes)
type: Módulo Fase A + Fase B
---

# Fase A — Entregas: demo HTML + specs (cierre 2026-06-12)

## Qué corrió

S9 Fase A construyó el módulo Entregas completo en el demo: lista, detalle (3 estados), crear (2 entry points), editar, 3 modales de lifecycle y 5 pantallas mobile. El contrato funcional se extrajo del FRD-08 (FR-08-01..34 + BR-08-01..07 + matriz de acciones por estado). Dos rounds de iteración con gate humano + auditoría de gaps contra el FRD.

## Entregables

### Demo HTML — 19 anchors (navbar `S9 · Entregas` + índice)

- **Desktop (11):** `#deliveries` (refactor), `#s9-deliveries-list-{empty,empty-filtered,loading}`, `#s9-delivery-detail{,-delivered,-cancelled}`, `#delivery-create` (refactor), `#s9-delivery-create-{standalone,empty}`, `#s9-delivery-edit`.
- **Modales (3):** `#s9-delivery-{mark-delivered,cancel,delete}-modal` (ADR 0008-B; tone success nuevo).
- **Mobile (5):** lista, detalle (sticky single-primary bar §9.16 + ADR 0011), crear paso 2, sheet marcar llegada, sheet más acciones.

### Specs

| Doc                          | Estado                                                     |
| ---------------------------- | ---------------------------------------------------------- |
| `screens/delivery-list.md`   | spec-complete (nuevo)                                      |
| `screens/delivery-detail.md` | spec-complete (nuevo)                                      |
| `screens/delivery-create.md` | spec-complete (rewrite del lo-fi S2; incluye modo edit §7) |
| `modules/deliveries.md`      | doc maestro + handoff Fase B (nuevo)                       |

### Cambios de infraestructura del demo

- `'deliveries'` y `'delivery-create'` removidas de `SCREEN_BREADCRUMBS` — `buildTopbar()` legacy les inyectaba un segundo topbar sobre el inline (patrón S7). Las pantallas refactorizadas usan topbar inline.
- CSS nuevo: `.m01b-icon-circle.tone-success` (siguiendo el patrón de tonos existente).
- `FILTER_CONFIGS.deliveries` enriquecido: presets de ETA (Vence hoy / 7d / 14d / Este mes) + búsqueda de producto + rangos de envío y llegada.
- Entry points de S7 order-detail cableados a `#delivery-create` ("Crear entrega" + "Crear entrega con estos productos").

## Iteración humana (round 2)

1. **Sumar ítems de otros pedidos** (from-order): grupo adicional expandido con elegibles desmarcados + helper explícito → S9-D6.
2. **Standalone**: combobox abierto mostrando solo tiendas con productos sin entregar + conteo (FR-08-17 visible).
3. **FX condicional**: helpers que explican que el tipo de cambio solo se pide cuando la moneda difiere de la base (FR-08-10); demoed en ambos sentidos (create JPY / edit USD).
4. **Sin kbd-chip en el CTA** de submit: atajo como texto plano "o presiona ⌘ Enter" → S9-D5 (candidato cross-app).

## Auditoría de gaps (round 2)

Cobertura FR por FR contra FRD-08 detectó 4 pantallas faltantes, agregadas: **editar entrega** (FR-08-24/BR-08-04 — WO-05 no tenía pantalla), **vacía filtrada**, **loading skeleton**, **sin productos elegibles** (copy literal del FRD). Verificado también lo que NO debe estar: sin card Historial en detalle (BR-08-05).

## Decisiones de diseño

S9-D1..D8 — ver tabla en `modules/deliveries.md §Decisiones`. Highlights: hero del detalle protagonizado por la ventana ETA (no un monto); reabrir sin modal (toast undo); tienda fija en edición; profundidad mobile acotada a 5 pantallas core.

## Validación

19/19 anchors verificados en preview (Claude Preview MCP, puerto 5500): light + dark, Velvet (+ Lilac persistida), desktop + 390px, todas las secciones dentro de `<main>` (L072), nav + índice sincronizados, cero errores de consola.

Sin código React tocado. Fase B (implementación en 3 partes) queda para conversación nueva con handoff en `modules/deliveries.md`.

---

# Fase B — Entregas: implementación React/Next (cierre 2026-06-12)

Implementación en 3 partes secuenciales sobre el handoff de `modules/deliveries.md`, con commit y revisión humana entre partes. Branch `redesign`.

## Parte 1 — Lista (`6c854aa`)

- `/deliveries` reemplaza el placeholder: filtros URL + chips removibles, default canónico `?status=IN_TRANSIT` (URL sin key `status` redirige; `status=` vacío explícito = todas — el chip removido no reaparece), sort default "Más antiguas" (FR-08-30), estados loading/empty/empty-filtered, filas expandibles planas (FR-08-32), cards mobile, paginación de 30.
- Data layer: `getDeliveriesList` + `getDeliveryStoreOptions` en `deliveryQueries.ts`; `deliveryListSort.ts` nuevo en `src/lib/deliveries/`.
- **Migración `20260612224123_add-delivery-received-date`**: el blueprint WO-04 exigía una columna nullable `receivedDate` que WO-01 no creó (FR-08-22/31). Aprobada por humano; aplicada con el workaround canónico (`migrate dev` exigía reset por drift → SQL manual + `migrate deploy` + `generate` + type-check). Zod `deliveryMarkDeliveredSchema` extendido con `receivedDate ≤ hoy`.
- **P-S9-03 resuelto**: paginación promovida a `modules/ListPagination` (orders ahora la consume); `localDate` promovido a `src/lib/localDate.ts` (segundo consumidor). Tabla/cards quedan route-local: las columnas (Costo, Llegada est.) divergen de orders (Total, % Pago) y un genérico quedaría lleno de condicionales.
- Fixes colaterales: namespace i18n roto de `StatusChip` (`statusChip` → `components.statusChip`, nunca tuvo consumidor real); icono overdue del chip de entrega a `alert-circle` + copy compacto "Atrasada {N}d" (ADR 0002); `FilterDrawer` gana sección `type: "text"` (filtro Producto).

## Parte 2 — Detalle + lifecycle (`91f0a73`)

- `/deliveries/[id]` completo: hero 3 variantes (ventana ETA + progress temporal S9-D1 / ENTREGA RECIBIDA / ENTREGA CANCELADA), productos agrupados por pedido origen con chips por ítem (FR-08-18), aside Resumen → Acciones → Nota (autosave `PrivateNoteCard`), **sin card Historial** (BR-08-05).
- Mutations: `markDeliveryDelivered` / `reopenDelivery` (guard FR-08-21 contra productos en otra entrega viva) / `cancelDelivery` / `deleteDelivery` (BR-08-07) / `updateDeliveryNote` — todas re-derivan `OrderStatus` en la misma transacción.
- Optimistic UI (`DeliveryDetailClient` coordina `status + receivedDate`): marcar llegada y cancelar con Optimistic Confirmation (modal cierra sincrónico); **reabrir sin modal** con toast neutral-undo + tecla `Z` (S9-D3, mutación inversa restaura el estado previo); eliminar awaited con type-to-confirm (excepción permitida).
- Mobile: sticky bar single-primary por estado + sheet "Más acciones" gateado (ADR 0011); fondo `oklab` (L074).
- Extensiones canónicas: `Toast` variante `neutral` + acción inline (ADR 0001 D4 — no existía en código); `Modal` tone `success` + CTAs primarios `success`/`warning` (M06). Promociones: `CollapsibleSubcard` → `modules/`; botón copiar código → `core/CodeCopyButton`.

## Parte 3 — Crear + editar

- `DeliveryCreateForm` legacy eliminado; reemplazado por `share/DeliveryForm` (mode dispatcher) → `DeliveryCreateWizard` (4 pasos: Tienda · Productos · Datos · Confirmar) + `DeliveryEditForm` (all-open). Compartidos: `DeliveryProductsPicker` (grupos por pedido + select-all + búsqueda con fold + chips de estado por ítem), `DeliveryDataFields` (FX condicional FR-08-10), `DeliveryStoreCombobox` (solo tiendas elegibles + conteo, FR-08-17).
- From-order: arranca en paso 2 con paso 1 done como field-as-attribute (ADR 0001 D2) + botón Cambiar; otros pedidos elegibles expandidos y desmarcados (S9-D6). Standalone: combobox con conteos. Empty de elegibilidad con copy FRD + CTAs (`#s9-delivery-create-empty`).
- Paso 4: review real (M04) + CTA limpio con atajo como texto "o presiona ⌘ Enter" (S9-D5). Atajos: ⌘↵ enviar · Space toggle (nativo) · A select-all · / buscar (card Atajos en el aside). Aside Resumen reactivo con `AsideSummary` + conversión "En tu base".
- Edit (`/deliveries/[id]/edit`): tienda fija como locked-field (S9-D4 / L069), guard server-side `IN_TRANSIT` (BR-08-04, redirect al detalle), quitar producto tinta la fila `--warning` + aviso "Al guardar vuelve a Listo en tienda" (FR-08-24), aside "Resumen de cambios" con dirty-flags (`6 → 5`) + nota de productos liberados, discard-guard (modal warning + beforeunload).
- Data layer: `editDelivery` (membership add/remove con revalidación atómica de elegibilidad WO-05 + re-derivación de orders) + `editDeliveryAction`. `EligibleProduct` gana `deliveryState` (chips del picker).
- Mobile wizard checklist §3 completo: stepper compact eyebrow, sticky bar Atrás/Continuar, aside oculto, padding inferior.

## Validación Fase B

- `npm run test` 529 ✅ (20 tests nuevos: params/fechas de lista, 5 lifecycle mutations, 6 de `editDelivery`) · `type-check` ✅ · `lint` 0 errores · `validate-build` ✅.
- `e2e/deliveries.spec.ts` extendido: journey completo crear-pedido → crear-entrega-desde-pedido (preselección) → marcar llegada (modal) → verificación de re-derivación a COMPLETED del pedido origen → cleanup (reabrir + eliminar entrega y pedido).
- Verificación visual en preview (light + dark + 390px) con login dev: lista (canonicalización, drawer, empty filtrado), detalle (3 estados vía mutaciones reales + undo de reabrir + sheet de acciones), wizard completo (combobox, grupos, ⌘ Enter submit real), edit (lock de tienda, fila warning, resumen de cambios, save + delete).

## Desviaciones documentadas

- **"cancelada el {fecha}"** del hero CANCELLED (demo) omitida: no existe columna `cancelledAt` y el spec funcional no la exige. Si se quiere, es otra migración aditiva.
- **Contador del sticky mobile del wizard** ("3 seleccionados" entre Atrás y Continuar en el demo): el `<WizardStep>` canónico no soporta slot central; el contador vive en el footer del paso 2. No se forkeó el componente canónico.
- **Resumen de cambios**: `AsideSummaryRow changed` pinta `--warning` para todo delta (el demo usaba `--accent` para fechas); se respetó la variante del componente canónico.
- **Atajo Esc** del card Atajos del demo: no cableado (cancelar sin discard-guard en create pierde datos); el card lista solo los 4 atajos implementados.

## Cross-cutting flaggeados (no fixeados — §7 PLAYBOOK)

- **S9.1**: action row mobile de listas desborda ~7px el viewport (también en `/orders`; heredado del patrón compartido).
- **S9.2**: off-by-one de fechas en display — fechas guardadas como medianoche UTC se muestran un día antes en timezones negativos (`toLocaleDateString` local). Sistémico en orders + deliveries.
