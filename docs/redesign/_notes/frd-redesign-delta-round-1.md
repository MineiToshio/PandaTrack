---
title: FRD ↔ Rediseño Delta Audit — Round 1
last_updated: 2026-05-19
scope: 6 FRDs (PRD-01 FRDs 01/02/03/04/05 + PRD-00 FRD-02)
out_of_scope: FRD-07 (S8 Fase B en curso — Round 2), FRD-08 (pending S9), PRD-00 FRD-01 (pending S11)
status: read-only audit — FRDs no actualizados
owner: Sergio Minei
---

# FRD ↔ Rediseño Delta Audit — Round 1

## Resumen ejecutivo

- **Total deltas detectados: 44**
- **Distribución por categoría:**
  - visual = 3
  - comportamiento = 9
  - funcional = 5
  - removido = 3
  - patrón nuevo = 18
  - métricas = 6
- **Distribución por FRD:**
  - FRD-03 Collector App Shell: 10 deltas (prioridad: **alta**)
  - FRD-05 Order Payment Shipment: 15 deltas (prioridad: **alta**)
  - FRD-04 Store Domain: 8 deltas (prioridad: **media/alta**)
  - FRD-02 PRD-01 Testing and Quality Baseline: 5 deltas (prioridad: **media**)
  - PRD-00 FRD-02 Growth and Observability: 4 deltas (prioridad: **media**)
  - FRD-01 Account Access and Recovery: 3 deltas (prioridad: **baja**)
- **Costo estimado total de reconciliación:** 4–6 conversaciones de ~1–1.5h cada una.

---

## Convenciones

- **visual**: el rediseño cambió la apariencia. El FRD no necesita actualización salvo nota cosmética opcional.
- **comportamiento**: el rediseño cambió la interacción (autosave, optimistic, gesto, UX). Requiere actualizar §Comportamiento del FR afectado.
- **funcional**: el rediseño cambió la regla de negocio o el flujo de usuario. Requiere reescritura del FR o agregar FRs nuevos.
- **removido**: el rediseño eliminó la funcionalidad. Marcar FR como deferred/removed en el FRD.
- **patrón nuevo**: el rediseño introdujo algo que el FRD no contemplaba. Decidir si va al FRD o queda solo en `docs/redesign/`.
- **métricas**: evento PostHog agregado/cambiado no reflejado en FRD de observabilidad.

---

## FRD-03 Collector App Shell

**Estado de partida:** `docs/product/prd-01-collector-mvp/frd-03-collector-app-shell/frd-03-collector-app-shell.md` · `last_updated: 2026-04-03` · `implementation_status: IMPLEMENTED`

### Deltas detectados

| ID    | FR/BR afectado      | Cambio                                                                                                                                                                                                                                                                                                       | Categoría      | Origen                                         | Decisión rediseño                                                                                                                                                                   |
| ----- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D3-01 | FR-03-04 / BR-03-02 | Mobile navigation: FRD documenta "drawer pattern". Redesign eliminó MobileTabBar de 4 tabs que se había implementado en S5 y luego removida; burger drawer (AppNavDrawer) queda como única nav primaria mobile.                                                                                              | removido       | S5.2 (2026-05-11)                              | AppNavDrawer burger drawer es la única navegación primaria mobile. MobileTabBar.tsx eliminado del repo, token `--mobile-tab-bar-h` removido, i18n keys `mobileTabBar.*` eliminadas. |
| D3-02 | FR-03-06 / BR-03-03 | FAB (botón flotante de acción contextual) eliminado del app shell. FRD no lo mencionaba explícitamente, pero estaba implementado tras S5 (ícono paquetito por ruta).                                                                                                                                         | removido       | S5.3 (2026-05-15)                              | `FAB.tsx` y `fabAction.ts` existen en repo pero no son consumidos por AppLayout. Pueden reutilizarse o eliminarse en pasada futura.                                                 |
| D3-03 | FR-03-08 / BR-03-03 | MascotBubble (burbuja animada idle PandaTrac) eliminada del app shell. Competía con sticky action bars y no aportaba valor al flujo actual.                                                                                                                                                                  | removido       | S5.3 (2026-05-15)                              | `MascotBubble.tsx` existe en repo pero no consumido por AppLayout. Spec marcada como "REMOVED from app shell".                                                                      |
| D3-04 | FR-03-05 / BR-03-04 | Content header constraints: `ContentHeader.tsx` es **estático cross-route** — solo `[☰]` + breadcrumb + título en mobile. No admite back-arrow contextual, no admite `⋯` overflow en topbar, no admite avatar. El FR-03-05 dice "contextual chrome" pero la implementación actual establece un límite duro. | comportamiento | S7-A.6 (2026-05-12), ADR 0011                  | Contenido dinámico (acciones secundarias, back-link, CTAs) vive en `<main>`, no en el header shell.                                                                                 |
| D3-05 | FR-03-03 / FR-03-07 | Sidebar desktop: implementado con dos modos: **PUSH** (toggle manual, colapsa/expande el layout) + **FLOAT** (hover-expand sobre el contenido). El FRD dice "expanded and collapsed states" sin detallar PUSH vs overlay.                                                                                    | comportamiento | ADR 0003 D1, S5 (2026-05-02)                   | `--sidebar-current-w` CSS var desplaza el grid de contenido (PUSH). Hover-expand no desplaza (FLOAT).                                                                               |
| D3-06 | FR-03-06            | Color del sidebar: corregido de `bg-surface` a `bg-surface-elevated`.                                                                                                                                                                                                                                        | visual         | S5.1 (2026-05-05)                              | Alineación al demo HTML. Una línea en `Sidebar.tsx:85`.                                                                                                                             |
| D3-07 | (sin FR)            | **Patrón nuevo: Modal adaptive (M06).** `<Modal>` es ahora un smart wrapper que renderiza `ModalDialog` (desktop centered) o `ModalSheet` (mobile bottom sheet via Vaul) según viewport. Ningún FR del FRD-03 menciona este patrón.                                                                          | patrón nuevo   | M06 (2026-05-11), ADR 0008 Extensión, ADR 0010 | Aplica cross-app. `src/components/modules/Modal/`: `Modal.tsx` + `ModalDialog.tsx` + `ModalSheet.tsx` + `ModalContent.tsx`.                                                         |
| D3-08 | (sin FR)            | **Patrón nuevo: Single-primary sticky action bar (ADR 0011 + S7-A.7).** Bar sticky mobile con UN solo `.btn.primary` a la derecha + secundario `.btn.accent` a la izquierda. Ningún FR del FRD-03 menciona sticky bars ni jerarquía visual de botones.                                                       | patrón nuevo   | S7-A.7 (2026-05-12), ADR 0011 Ext.             | Cross-module (aplica a order-detail, store-detail, create/edit).                                                                                                                    |
| D3-09 | (sin FR)            | **Patrón nuevo: Chip Eyebrow + Top-Accent (M07).** `<Eyebrow variant="chip">` con tone + `<SectionCard topAccent>` coordinados. No mencionado en FRD-03.                                                                                                                                                     | patrón nuevo   | M07 (2026-05-19), PLAYBOOK §9.17               | Aplicado cross-app: orders, stores, settings, módulos de detail.                                                                                                                    |
| D3-10 | (sin FR)            | **Patrón nuevo: Topbar canónico mobile (S7-A.6).** `[☰]` + breadcrumb + título, propagado a todos los anchors mobile. Back-link vive en page content, no en el topbar.                                                                                                                                      | patrón nuevo   | S7-A.6 (2026-05-12), ADR 0011                  | Aplica a todas las pantallas del módulo.                                                                                                                                            |

### Patrones nuevos introducidos (no en FRD-03)

- Modal adaptive M06 (ADR 0008 Extensión + ADR 0010).
- MobilePicker (S7-A.9) — picker bottom-sheet para store, currency, date-range.
- AsideSummary reactivo en wizards de creación/edición.
- Chip Eyebrow + Top-Accent (M07, PLAYBOOK §9.17).
- Single-primary sticky action bar (ADR 0011 + S7-A.7, PLAYBOOK §9.16).
- Topbar canónico mobile sin back-arrow ni overflow (S7-A.6).
- AppLayout PUSH grid via `--sidebar-current-w` CSS var.
- `useIsMobile()` hook SSR-safe (≤767px breakpoint).

### Costo estimado de reconciliación FRD-03

- Secciones a actualizar: FR-03-04 (mobile nav), FR-03-05 (header constraints), FR-03-06 (account trigger + shell color), §Planned Alignment section completa.
- FRs a marcar como removidos/deferred: FAB, MascotBubble (agregar nota de remoción en §Current State).
- Patrones nuevos: decidir si van al FRD-03 o se documentan solo en `docs/redesign/`.
- Estimación: **medio** (~40 líneas a reescribir, ~3 FRs a actualizar, ~2 notas de remoción).
- Pre-requisitos: ninguno — contexto S5/S5.2/S5.3 cerrados y frescos.

---

## FRD-05 Order Payment Shipment

**Estado de partida:** `docs/product/prd-01-collector-mvp/frd-05-order-payment-shipment/frd-05-order-payment-shipment.md` · `last_updated: 2026-04-26` · `implementation_status: IN_PROGRESS`

### Deltas detectados

| ID    | FR/BR afectado | Cambio                                                                                                                                                                                                                                                                                                                                                     | Categoría      | Origen                                                    | Decisión rediseño                                                                                                                                   |
| ----- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| D5-01 | FR-05-28       | FRD: "sort by oldest order date first by default". Redesign: **sort por más recientes por defecto**. Motivo: los coleccionistas priorizan pedidos recientes; los más antiguos suelen estar cerrados.                                                                                                                                                       | funcional      | CB-01, `modules/orders.md §Cambios de comportamiento`     | Implementado. Sort default "Más recientes" en `order-list`.                                                                                         |
| D5-02 | FR-05-13       | FRD: modal discrepancia con **3 opciones** (mantener ingresado / usar calculado / volver). Redesign: **2 opciones** ("Volver y corregir" / "Guardar de todos modos"). Motivo: el total ingresado es siempre autoritativo — ofrecer reemplazarlo automáticamente crea confusión.                                                                            | funcional      | CB-02, `modules/orders.md §Cambios de comportamiento`     | Implementado. `#s7-order-create-discrepancy-modal`.                                                                                                 |
| D5-03 | FR-05-23       | FRD: "secondary affordance may be a split action: visible Edit + overflow trigger → View store / Cancel / Delete". Implementation notes del FRD también dicen "primary plus a single More menu". Redesign: **inline card "Acciones"** al pie del scroll con filas de acción (Editar, Cancelar, Eliminar rojo). Sin split button, sin overflow ⋯ en header. | funcional      | ADR 0011 (2026-05-12), S7-A.6                             | Implementado en desktop y mobile.                                                                                                                   |
| D5-04 | FR-05-21       | FRD: "inline-editable private note field that can be saved without entering full edit mode". Redesign: agrega **autosave on-blur con throttle 1.5s** + indicador "Guardada hace Ns". FRD no especifica el mecanismo de guardado.                                                                                                                           | comportamiento | ADR 0001 D7, `modules/orders.md §Cambios visuales D15`    | Implementado con debounce 800ms (nota: spec dice throttle 1.5s; confirmar valor real). No usa optimistic update (espera confirmación del servidor). |
| D5-05 | FR-05-17       | FRD: "add and delete multiple payment records over time". Redesign: "Anotar pago" se implementa como **inline expand dentro de la card Pagos** — no abre modal separado.                                                                                                                                                                                   | comportamiento | ADR 0001 D6, `modules/orders.md §Cambios visuales D14`    | Implementado.                                                                                                                                       |
| D5-06 | BR-05-10       | FRD: "payments may be deleted and the paid-versus-remaining summary must recalculate immediately after deletion". Redesign: agrega **toast neutral-undo 5s** con acción "Z" + **update optimista inmediato**. FRD no especifica el patrón UX de feedback.                                                                                                  | comportamiento | ADR 0001 D4                                               | Implementado.                                                                                                                                       |
| D5-07 | (sin FR)       | **Reactivar pedido sin modal de confirmación.** El rediseño implementa "Reactivar pedido" como disparo directo sin confirm dialog — es acción reversible. FRD BR-05-17 documenta que se puede reactivar, pero no especifica si requiere confirmación.                                                                                                      | comportamiento | ADR 0001 D8                                               | Implementado.                                                                                                                                       |
| D5-08 | (sin FR)       | **View-transition `order-{id}`.** `view-transition-name: order-{id}` en `order-row` (lista) y `detail-hero` (detalle). Usa el DB id, no el humanReadableId. No mencionado en FRD-05.                                                                                                                                                                       | patrón nuevo   | ADR 0001 D7                                               | Implementado.                                                                                                                                       |
| D5-09 | (sin FR)       | **Wizard de creación — 3 pasos** (Datos → Productos y costos → Confirmar). El FRD no especifica el número de pasos ni la estructura del wizard.                                                                                                                                                                                                            | patrón nuevo   | `modules/orders.md §Cambios visuales D20`                 | Implementado. Stepper con gating hacia adelante, libre hacia atrás.                                                                                 |
| D5-10 | (sin FR)       | **Edición all-open — L020.** Form de edición sin stepper; todas las secciones siempre expandidas. Tienda y Moneda locked con icono `lock`.                                                                                                                                                                                                                 | patrón nuevo   | ADR 0001 D9, L020                                         | Implementado.                                                                                                                                       |
| D5-11 | (sin FR)       | **Sidebar "Resumen" reactivo** en creación y edición. Se actualiza en tiempo real conforme el usuario completa campos.                                                                                                                                                                                                                                     | patrón nuevo   | `modules/orders.md §Cambios visuales D25`                 | Implementado. AsideSummary component.                                                                                                               |
| D5-12 | (sin FR)       | **Quick-picks en pay form: "Saldo pendiente ($X)" y "Mitad ($X/2)".** Chips sobre el input de monto. Prellena `remainingAmount` y `remainingAmount / 2`. Ambos chips en desktop y mobile (parity).                                                                                                                                                         | patrón nuevo   | S7-A.7 (2026-05-12), ADR 0011 Ext.                        | Aplicado en demo + spec. Implementado en Fase B.                                                                                                    |
| D5-13 | (sin FR)       | **Sticky action bar single-primary mobile** para order-detail. Layout por estado: active (`[Crear entrega .accent]` + `[Anotar pago .primary]`), overdue (`[Entrega .accent]` + `[Pagar saldo .primary]`), completed-unpaid (single `[Saldar .primary]`), cancelled (single `[Reactivar .primary]`).                                                       | patrón nuevo   | ADR 0011 + Ext. 2026-05-12, S7-A.7                        | Aplicado.                                                                                                                                           |
| D5-14 | (sin FR)       | **MobilePicker** para store/currency/date-range en mobile (bottom sheets). Typography + iconos canónicos (`accent-cool` idle, `accent` selected). 5 quick-range presets en DateRangePicker cross-viewport.                                                                                                                                                 | patrón nuevo   | S7-A.4 (2026-05-11), S7-A.9 (2026-05-12)                  | Aplicado en demo + specs.                                                                                                                           |
| D5-15 | FR-05-38       | FRD FR-05-38 menciona "bulk exchange-rate reconciliation grouped by currency pair". Redesign especifica el **componente `FxReconciliationModal`** masivo con full-screen sheet mobile. FRD no menciona el componente específico ni su layout.                                                                                                              | patrón nuevo   | P-S7-01, `modules/orders.md §Funcionalidades preservadas` | Implementado. `src/components/modules/FxReconciliationModal.tsx`.                                                                                   |
| D5-16 | (sin FR)       | **`pendingFxCount`** en `getOrdersList`. Contador de pedidos con exchange rate pendiente de actualizar. FRD menciona el filtro `Needs currency update` (FR-05-36) pero no el campo derivado específico.                                                                                                                                                    | patrón nuevo   | P-S7-03                                                   | Implementado.                                                                                                                                       |
| D5-17 | FR-05-16       | **Frankfurter API "Hoy"** — botón en el campo de tipo de cambio que llama a Frankfurter (sin API key, timeout 5s) para prefill del valor actual. FRD FR-05-16 solo dice "require one exchange-rate value"; no especifica el helper de autocompletado.                                                                                                      | patrón nuevo   | `modules/orders.md §Cambios visuales D24`                 | Implementado. Llamada desde cliente.                                                                                                                |

### Cambios de comportamiento documentados formalmente (CB)

| CB-ID | FR afectado | Comportamiento FRD           | Comportamiento redesign        | Razón                                              | Spec                   |
| ----- | ----------- | ---------------------------- | ------------------------------ | -------------------------------------------------- | ---------------------- |
| CB-01 | FR-05-28    | Sort oldest first            | Sort más recientes por defecto | Coleccionistas gestionan pedidos recientes primero | `order-list.md §6.2`   |
| CB-02 | FR-05-13    | Discrepancy modal 3 opciones | Discrepancy modal 2 opciones   | Total ingresado es autoritativo                    | `order-create.md §6.9` |

### Costo estimado de reconciliación FRD-05

- FRs a actualizar: FR-05-13, FR-05-21, FR-05-23, FR-05-28, FR-05-38.
- BRs a actualizar: BR-05-10 (agregar patrón undo toast), Implementation Notes (agregar wizard/edit layout).
- Secciones a reescribir: §Implementation Notes (añadir 5 patrones nuevos), §Confirmed (actualizar entry sobre More menu), §Functional Requirements (FR-05-28, FR-05-13, FR-05-23).
- Estimación: **grande** (~80 líneas, 5 FRs, 2 BRs, section de Implementation Notes).
- Pre-requisitos: ninguno — S7 cerrado, contexto fresco.

---

## FRD-04 Store Domain

**Estado de partida:** `docs/product/prd-01-collector-mvp/frd-04-store-domain/frd-04-store-domain.md` · `last_updated: 2026-04-27` · `implementation_status: IMPLEMENTED`

### Deltas detectados

| ID    | FR/BR afectado                 | Cambio                                                                                                                                                                                                            | Categoría      | Origen                                 | Decisión rediseño                                                                                   |
| ----- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| D4-01 | FR-01-16 / BR-04-20            | FRD: implica chips de status visibles en toda vista. Redesign: **chip de status NO se muestra en el directorio público** (lista pública). Solo visible en página de detalle para el owner y directorio interno.   | funcional      | S6.1 (decisión humana 2026-05-03)      | `StoreCard` no renderiza status chips. Detalle sí muestra chips de status al owner/admin.           |
| D4-02 | FR-04-09 / FR-04-12            | Logo upload: FRD no especifica paso de crop. Redesign introduce un **paso intermedio de crop/ajuste en Modal** antes de confirmar el logo.                                                                        | comportamiento | M06 (2026-05-11), ADR 0008             | `AvatarField` integra Cropper en `<Modal size="lg" dismissible>`.                                   |
| D4-03 | FR-04-11 / FR-04-12 / FR-04-13 | FilterDrawer: FRD especifica los campos de filtro pero no el comportamiento del drawer. Redesign: drawer **no cierra al click fuera** (solo X y Esc). FRD no menciona esta restricción UX.                        | comportamiento | M03-fix (2026-05-04) — decisión humana | `FilterDrawer.tsx`: backdrop no cierra, solo X y Esc cierran.                                       |
| D4-04 | (sin FR)                       | **FilterTriggerButton con badge count y estado activo.** Cuando hay ≥1 filtro del drawer aplicado, el botón "Filtrar" cambia a fondo tintado + badge count. FRD no menciona este patrón.                          | patrón nuevo   | M05 (2026-05-09)                       | `src/components/core/FilterTriggerButton/`. Reglas: count = chips visibles; búsqueda no incrementa. |
| D4-05 | (sin FR)                       | **WizardAccordion con localStorage autosave entre pasos.** El wizard de creación de tienda persiste estado al browser storage. Solo el paso activo se expande; pasos completados colapsan con resumen en header.  | patrón nuevo   | S6 Fase B (2026-05-03)                 | WizardAccordion + WizardStep en `src/components/modules/`.                                          |
| D4-06 | (sin FR)                       | **Staged-add para canales y direcciones.** Los canales y direcciones usan estado "pendiente de confirmar" — el form abre, el usuario confirma, la entrada se agrega. Sin filas vacías insertadas automáticamente. | patrón nuevo   | M04 (2026-05-04), L05                  | Patrón staged-add en `CreateStoreForm`, `EditStoreForm`.                                            |
| D4-07 | (sin FR)                       | **Chip Eyebrow + Top-Accent en store-detail.** `<SectionCard topAccent>` con Eyebrow chip en `StoreDetailContent.tsx`.                                                                                            | patrón nuevo   | M07 (2026-05-19), PLAYBOOK §9.17       | Aplicado cross-module incluyendo stores.                                                            |
| D4-08 | (sin FR)                       | **Store-detail secondary action card (ADR 0011).** Acciones secundarias en store-detail mobile = inline card (no bottom sheet, no overflow ⋯ en topbar).                                                          | patrón nuevo   | ADR 0011 (2026-05-12)                  | Aplica a todo detail screen.                                                                        |

### Nota sobre FR-04-33 / FR-04-34 (isPrivate person stores)

Estos FRs **ya están en el FRD-04 como "Planned Enhancements"** y fueron implementados en S6. El FRD tiene la descripción funcional correcta. Lo que falta es actualizar el estado de `implementation_status` de "Planned" a "IMPLEMENTED" en esa sección.

### Costo estimado de reconciliación FRD-04

- Secciones a actualizar: §Current State (agregar implementaciones S6), §FR-04-33/FR-04-34 Planned → Implemented, §Current Implementation Notes (agregar comportamientos nuevos de FilterDrawer, staged-add, wizard autosave).
- FR a actualizar: agregar nota de comportamiento en FR-04-09 (status chip visibility), FR-04-12 (crop step), FR-04-11/12/13 (FilterDrawer UX).
- Estimación: **medio** (~40 líneas, 3 FRs con notas, sección Planned Enhancements).
- Pre-requisitos: ninguno — S6/M03/M04/M05 cerrados.

---

## FRD-01 Account Access and Recovery

**Estado de partida:** `docs/product/prd-01-collector-mvp/frd-01-account-access-and-recovery/frd-01-account-access-and-recovery.md` · `last_updated: 2026-03-21` · `implementation_status: IMPLEMENTED`

### Deltas detectados

| ID    | FR/BR afectado                       | Cambio                                                                                                                                                                                                                     | Categoría    | Origen                          | Decisión rediseño                                                 |
| ----- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------- | ----------------------------------------------------------------- |
| D1-01 | FR-03-06 (sign-out es cross-concern) | **Sign-out destructive styling.** `ShellAccountMenu.tsx` renderiza sign-out con color rojo sin borde (destructive pattern). FRD-01 no menciona el estilo del botón de sign-out. No hay ADR documentado para esta decisión. | visual       | S5 Fase B (sin ADR documentado) | Patrón visual en `ShellAccountMenu.tsx`. Falta ADR formal.        |
| D1-02 | (sin FR)                             | **Avatar cropper via Modal adaptive (M06).** `AvatarField` integra el cropper de imagen en `<Modal size="lg" dismissible>` con `ModalDialog` desktop y `ModalSheet` mobile. FRD-01 no menciona avatar upload ni crop.      | patrón nuevo | M06 (2026-05-11), ADR 0008 Ext. | Cross-concern entre FRD-01 (identidad) y FRD-07 (settings).       |
| D1-03 | (sin FR)                             | **Visual redesign de sign-in/sign-up** (Velvet tokens, componentes rediseñados — `<Input>`, `<Button>`, `<Label>`, etc.). FRD-01 no menciona especificaciones visuales de las páginas de auth.                             | visual       | S3B, S4B (2026-05-02)           | Cambio visual puro — no requiere actualización funcional del FRD. |

### Costo estimado de reconciliación FRD-01

- Secciones a actualizar: §Implementation Notes (mencionar ShellAccountMenu + AvatarField modal pattern).
- Estimación: **chico** (~5 líneas).
- Pre-requisitos: decidir si D1-01 (sign-out rojo) merece ADR formal o se documenta como nota en FRD-03.

---

## FRD-02 Testing and Quality Baseline (PRD-01)

**Estado de partida:** `docs/product/prd-01-collector-mvp/frd-02-testing-and-quality-baseline/frd-02-testing-and-quality-baseline.md` · `last_updated: 2026-03-21` · `implementation_status: IMPLEMENTED`

### Deltas detectados

| ID    | FR/BR afectado              | Cambio                                                                                                                                                                                                                                     | Categoría    | Origen                                                    | Decisión rediseño                                                          |
| ----- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ | --------------------------------------------------------- | -------------------------------------------------------------------------- |
| D2-01 | FR-02-03 (RTL)              | **Portal queries con `screen.*`** (no `container.*`). Para componentes que renderizan en Portal, `screen.getByRole()` es el patrón canónico, no `container.querySelector()`. FRD-02 menciona RTL pero no este matiz específico.            | patrón nuevo | `.cursor/rules/browser-testing-patterns.mdc` L11–36, L058 | Documentado en cursor rule.                                                |
| D2-02 | FR-02-03 (RTL)              | **`dispatchEvent` con React-aware setter pattern.** Para inputs controlados de React, usar `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(...)` antes del `dispatchEvent`. FRD-02 no menciona este patrón. | patrón nuevo | `browser-testing-patterns.mdc` L38–68, lessons L056       | Documentado en cursor rule + lessons.                                      |
| D2-03 | FR-02-04 (Playwright)       | **`preview_eval` split-call navigation.** Nunca encadenar `await page.evaluate(...)` en la misma llamada que `window.location.href` — destruye el contexto Chrome DevTools. Patrón específico al tooling del subproyecto.                  | patrón nuevo | `browser-testing-patterns.mdc` L75–98, lessons L054       | Documentado en cursor rule.                                                |
| D2-04 | FR-02-04 (Playwright / E2E) | **Dev credentials login workflow** para rutas `(app)/*`. Sign-in en `[locale]/sign-in` con creds de desarrollo, esperar redirect, antes de ejercer rutas protegidas. FRD-02 no define un workflow de auth para E2E.                        | patrón nuevo | `browser-testing-patterns.mdc` L100–120, lessons L053     | Documentado en cursor rule.                                                |
| D2-05 | (sin FR)                    | **Mobile viewport simulation strategy** para tests (CSS media query override, sufijo `-mobile` en anchors). FRD-02 no cubre estrategia de testing en viewports mobile.                                                                     | patrón nuevo | Lessons L066–L070                                         | En lessons. No formalizado en FRD ni en cursor rule como sección dedicada. |

### Costo estimado de reconciliación FRD-02 PRD-01

- Secciones a actualizar: §Implementation Notes (agregar referencia a `browser-testing-patterns.mdc`), agregar FR opcional "FR-02-07: Browser testing patterns".
- Estimación: **chico** (~10 líneas, 1 FR nuevo opcional).
- Pre-requisitos: ninguno.

---

## PRD-00 FRD-02 Growth and Observability Foundation

**Estado de partida:** `docs/product/prd-00-pre-release-validation/frd-02-growth-and-observability-foundation/frd-02-growth-and-observability-foundation.md` · `last_updated: 2026-03-21` · `implementation_status: IMPLEMENTED`

### Deltas detectados

| ID    | FR/BR afectado | Cambio                                                                                                                                                                                                                                                                                                      | Categoría    | Origen                                                | Decisión rediseño                          |
| ----- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------- | ------------------------------------------ |
| D0-01 | FR-02-01       | FRD: "PostHog event names centralizados". Implementación actual: **73 eventos en 7 categorías** (LANDING × 13, AUTH × 20, APP_SHELL × 9, SETTINGS × 9, ORDER × 24, DELIVERY × 2, STORE × 22). El FRD no tiene lista canónica por módulo.                                                                    | métricas     | S5, S6, S7, S8 (múltiples sesiones)                   | `src/lib/constants.ts` POSTHOG_EVENTS.     |
| D0-02 | FR-02-01       | **Categorías de eventos nuevas post-diseño.** Las categorías APP_SHELL, ORDER, STORE, SETTINGS fueron agregadas durante S5–S8. El FRD solo menciona waitlist y auth events como ejemplos de implementación.                                                                                                 | métricas     | S5 (APP_SHELL), S6 (STORE), S7 (ORDER), S8 (SETTINGS) | `src/lib/constants.ts`.                    |
| D0-03 | (sin FR)       | **`posthog-events.mdc` cursor rule** establece mecanismos de enforcement que el FRD no menciona: (a) `data-ph-event` / `data-ph-props` declarativos para clicks simples, (b) jerarquía de 2 niveles en naming (módulo → acción), (c) convenciones de properties (snake_case, non-PII, campos contextuales). | patrón nuevo | `.cursor/rules/posthog-events.mdc`                    | Documentado en cursor rule pero no en FRD. |
| D0-04 | (sin FR)       | **Eventos del redesign sin doc en FRD**: `sidebar_toggled`, `nav_clicked`, `drawer_opened`, `theme_changed`, `locale_changed` (APP_SHELL); todos los ORDER events; todos los STORE events post-S6. PLAYBOOK no hace referencia explícita a qué eventos deben dispararse por patrón UX.                      | métricas     | S5–S8                                                 | En `src/lib/constants.ts`.                 |

### Costo estimado de reconciliación PRD-00 FRD-02

- Decisión humana requerida: ¿el FRD de observabilidad debe enumerar todos los eventos por módulo, o solo los principios de centralización?
- Si se enumera: agregar tabla con las 73 entradas agrupadas por categoría (~60 líneas).
- Si solo principios: agregar referencia a `posthog-events.mdc` (~5 líneas).
- Estimación: **chico a medio** según decisión.
- Pre-requisitos: decisión de Sergio sobre el nivel de detalle en el FRD.

---

## Próximos pasos recomendados (opciones para Sergio)

### Opción 1 — Reconciliación FRD-by-FRD en sesiones dedicadas

Orden sugerido (mayor deuda primero):

1. **FRD-03** (app shell) — bloquea comprensión de patrones shell para sesiones futuras. S5/S5.2/S5.3 cerrados y frescos.
2. **FRD-05** (orders) — recién cerrado en S7, contexto más fresco disponible. 15 deltas, el FRD más desactualizado en términos funcionales.
3. **FRD-04** (stores) — 8 deltas, mayormente patrones nuevos. S6 cerrado.
4. **FRD-02 PRD-01** (testing baseline) — agregar referencia a `browser-testing-patterns.mdc`. Muy chico.
5. **FRD-01** (account) — 3 deltas, chico. Puede combinarse con FRD-03 en la misma sesión.
6. **PRD-00 FRD-02** (observability) — necesita decisión humana sobre nivel de detalle.

Cada sesión: 1 conversación, scope acotado a 1 FRD, output FRD actualizado + ADR retroactivo si aplica.

### Opción 2 — Reconciliación inline con sesiones de cierre de módulo

Cada vez que cierre una nueva sesión (S8 Fase B, S9), abrir mini-sesión "FRD-XX sync" al cierre. Riesgo: FRD-03 y FRD-05 acumulan más deuda si se esperan sesiones futuras.

### Opción 3 — Concentrar en S13 (audit final pre-release)

Postergar toda la reconciliación a la sesión de audit final S13. Riesgo: contexto perdido para FRD-05 (S7 cerrado hace semanas en ese punto); sesiones intermedias S8/S9 continuarán divergiendo del FRD.

---

## Pendientes para Round 2

- **FRD-07** (user settings) — esperar cierre de S8 Fase B. Propuestas P-S8-01 a P-S8-08 no reconciliadas.
- **FRD-08** (delivery management) — pending S9 implementar.
- **PRD-00 FRD-01** (pre-release landing) — pending S11.
- **PRD-00 FRD-03** (public web platform) — sin impacto del rediseño según scope.
- **PRD-00 FRD-04** (public legal transparency) — impacto trivial según scope.

---

## Cosas flaggeadas durante el audit

Las siguientes son observaciones detectadas fuera del scope del delta. **No se aplicaron cambios.** Se listan para que Sergio decida si merecen follow-up.

1. **FRD-04 §Functional Requirements tiene FRs mal numerados.** Después de `FR-04-17`, el documento usa `FR-01-19`, `FR-01-20`, `FR-01-21`, etc. (prefijo `01` en lugar de `04`). Esto es un error tipográfico en el FRD existente que debería corregirse en la sesión de reconciliación.

2. **FRD-05 Implementation Notes menciona "More menu"** en la sección §Confirmed, pero el rediseño eliminó ese patrón por la inline card (ADR 0011). Esta inconsistencia interna ya existe en el FRD antes de la reconciliación.

3. **ADR faltante para sign-out destructive styling** (`ShellAccountMenu.tsx` sign-out rojo sin borde). Esta decisión de diseño no tiene ADR ni referencia en ningún doc. Candidato para ADR 0012 si se quiere documentar la regla "acciones destructivas de cuenta = variant destructive sin borde" como estándar cross-app.

4. **Subagente 3 (FRD-05) produjo respuesta vacía.** Los deltas de FRD-05 en este documento fueron construidos desde lectura directa de `modules/orders.md` + `cross-cutting-changes.md` por el agente coordinador. La cobertura es completa con los documentos disponibles, pero una segunda pasada con lectura de `screens/order-detail.md` §6 completo podría revelar deltas adicionales en el área de payment y history interactions.

5. **S6.1, S6.2, S6.3 siguen marcados como `🟡 abierto`** en `cross-cutting-changes.md`. Estas son correctivas de audit del módulo Stores que nunca se cerraron formalmente. Su estado debería verificarse antes de la reconciliación de FRD-04 para saber qué cambios adicionales aplicaron.

6. **PLAYBOOK §9.xx enumera patrones que no tienen referencia en ningún FRD.** Los patrones §9.12 (FilterDrawer tag-autocomplete), §9.13 (FX banner color), §9.15 (Modal adaptive spec), §9.16 (sticky single-primary), §9.17 (Chip Eyebrow + Top-Accent) son canónicos para implementación pero viven solo en docs del rediseño. Si se reconcilian en los FRDs, hay que decidir el nivel de detalle UX que pertenece al FRD vs al PLAYBOOK.
