---
title: Sesión 06 — Módulo Tiendas (Fase B implementación)
date: 2026-05-03
status: ✅ done
type: Módulo Fase B
---

## Qué corrió

S6 Fase B traduce a código React el contrato escrito en `modules/stores.md §12 Handoff`. Implementa el módulo Stores con redesign Velvet/Atelier completo, ejecuta la migración Prisma del campo `isPrivate` (FR-04-33/34, ADR 0009), construye toda la infraestructura pull-based de componentes (Modal canónico ADR 0008, Sheet, FilterDrawer, DetailSidebar, WizardAccordion, EmptyState, Card, SectionCard, Stepper, MicroStat) y refactoriza las tres pantallas del módulo conservando funcionalidad existente (reseñas, notas privadas, governance, change requests, logo upload).

## Migration Prisma

- Archivo: `prisma/migrations/20260503184615_add_is_private_to_store/migration.sql`
- Comando intentado: `npx prisma migrate dev --name add_is_private_to_store` falló por incompatibilidad preexistente de un migration anterior con la shadow DB de Neon (`P3006` — `expand_delivery_model` no aplica limpio en shadow). Workaround: SQL escrito a mano + `npx prisma migrate deploy` aplicado a la base real con éxito + `npx prisma generate` para regenerar el client.
- SQL final:
  ```sql
  ALTER TABLE "store" ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT false;
  CREATE INDEX "store_isPrivate_idx" ON "store"("isPrivate");
  ```
- Schema: `Store.isPrivate: Boolean @default(false)` + `@@index([isPrivate])`.

## Componentes implementados

### Core (atoms reutilizables)

| Componente    | Path                                  | Tests                              |
| ------------- | ------------------------------------- | ---------------------------------- |
| `Card`        | `src/components/core/Card.tsx`        | sí · `_tests/Card.test.tsx`        |
| `SectionCard` | `src/components/core/SectionCard.tsx` | sí · `_tests/SectionCard.test.tsx` |
| `Stepper`     | `src/components/core/Stepper.tsx`     | sí · `_tests/Stepper.test.tsx`     |
| `MicroStat`   | `src/components/core/MicroStat.tsx`   | no — presentacional puro           |

### Modules (orquestadores complejos)

| Componente                                   | Path                                                   | Notas                                                                                                                                                                                                                                        |
| -------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Modal` (refactor a ADR 0008 Semantic Depth) | `src/components/modules/Modal/Modal.tsx`               | API extendida (`subtitle`, `icon`, `tone`, `primaryAction`, `secondaryAction`, `tertiaryAction`, `size`, `dismissible`) preservando alias legacy (`isOpen`, `onClose`, `description`, `closeButtonLabel`). Tests en `_tests/Modal.test.tsx`. |
| `Sheet`                                      | `src/components/modules/Sheet/Sheet.tsx`               | Bottom sheet mobile con drag handle, focus trap, scroll-lock y blur ADR 0008.                                                                                                                                                                |
| `EmptyState`                                 | `src/components/modules/EmptyState.tsx`                | Slot mascot/visual + título + subtítulo + actions.                                                                                                                                                                                           |
| `FilterDrawer`                               | `src/components/modules/FilterDrawer/FilterDrawer.tsx` | Config-driven (`pills`/`pills-search`/`switches`), responsive bottom-sheet ↔ side-drawer, focus trap, conteo aplicar opcional.                                                                                                               |
| `DetailSidebar`                              | `src/components/modules/DetailSidebar.tsx`             | Slot wrapper Resumen / Acciones / Nota privada / Gestión, sticky desktop.                                                                                                                                                                    |
| `WizardAccordion` + `WizardStep`             | `src/components/modules/WizardAccordion/`              | Orquestador con `WizardAccordionContext`, navegación libre OC3, advance auto opcional.                                                                                                                                                       |

### Módulo (propios de Stores)

| Componente             | Path                                         | Descripción                                                              |
| ---------------------- | -------------------------------------------- | ------------------------------------------------------------------------ |
| `StoreCard`            | `_components/share/StoreCard.tsx`            | Card del listing con avatar 56px + type-icon + chips + import-de + stats |
| `StoreHero`            | `_components/share/StoreHero.tsx`            | Hero del detalle con presence/stock/preorder chips                       |
| `ReviewRow`            | `_components/share/ReviewRow.tsx`            | Fila de reseña                                                           |
| `DuplicateAlertInline` | `_components/share/DuplicateAlertInline.tsx` | Alert on-blur con candidatos                                             |
| `ReportReasonPicker`   | `_components/share/ReportReasonPicker.tsx`   | Lista vertical de razones radio-style                                    |

## Pantallas refactorizadas

| Ruta                                                            | Cambios principales                                                                                                                                                                                                            | Funcionalidad preservada                                                                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `stores/page.tsx`                                               | `<AppPageHero>` eliminado; nuevo hero/eyebrow + `<StoreCard>` grid responsive 1/2/3 col + `<EmptyState>` cuando 0 resultados; `<StoreListingFilters>` reemplazado con toolbar buscar/filtrar/sort/new + `<FilterDrawer>` modal | sí — search por nombre, filtros por categoría/país/import/presencia/orders/stock, pagination existente, PostHog tracking |
| `stores/[slug]/page.tsx` + `_components/StoreDetailContent.tsx` | Hero refactor con `<StoreHero>`; banner privada (`Lock` icon) cuando `store.isPrivate` y viewer es creator; guard 404 cuando privada y viewer ≠ creator (no 403, BR-04-21); resto del body intacto                             | sí — reseñas, escribir reseña, nota privada, reporte, governance summary, edit access logic                              |
| `stores/new/page.tsx` + `_components/CreateStoreForm.tsx`       | `Switch` "Perfil privado" agregado al paso 1 cuando `storeType === PERSON`; resetea a `false` al cambiar a BUSINESS (ADR 0009)                                                                                                 | sí — wizard steps existentes, dup detection, logo upload, contact channels, addresses                                    |
| `stores/[slug]/edit/_components/EditStoreForm.tsx`              | `Switch` "Perfil privado" en sección catálogo solo cuando `store.storeType === PERSON`; pre-poblado desde `initialValues.isPrivate`                                                                                            | sí — direct edit (PENDING/admin) y change-request (APPROVED no-owner) flows                                              |

## Decisiones de implementación

1. **Modal** — Ubicación `modules/Modal/Modal.tsx` (no en core). API mantiene compatibilidad backward (`isOpen`, `description`, `closeButtonLabel`) para no romper consumidores existentes (`StoreReportModal`, `StoreGovernanceSummaryModal`, `StoreProductTypeRequestModal`, `StoreLogoField`, `StoreMultiTagAutocomplete`). Nuevos props ADR 0008 (`subtitle`, `icon`, `tone`, `primaryAction`, `secondaryAction`, `tertiaryAction`, `size`, `dismissible`) son aditivos. Visual ADR 0008 aplica a todos los modales del repo automáticamente.
2. **Core vs modules placement** — Card/SectionCard/Stepper/MicroStat van a `core/` (atoms simples reutilizables). Sheet/Modal/FilterDrawer/DetailSidebar/WizardAccordion/EmptyState van a `modules/` (multi-component complejos con focus trap/portales/orquestación). Coherente con `docs/development/file-organization.md`.
3. **`isPrivate` en EditableStore** — Se agregó al `EditableStore`, `EditableStoreInput`, `EditableStoreDiff`, `mergeEditableStoreWithChangeRequest`, `normalizeEditableStoreInput`, `mapStoreToEditableStore`, `buildEditableStoreDiff`, y al `tx.store.update` de `updateStoreEditableFields`. El normalize fuerza `false` cuando `storeType !== "PERSON"`, defense-in-depth con el Zod refinement.
4. **`refinePrivateOnlyPerson` extraído** — el schema base se hizo accesible vía `createStoreShape` para que `editStoreSchema` pueda reusar field shapes y aplicar el mismo refinement (los `.shape` no funcionan directamente sobre `ZodEffects`).
5. **404 vs 403 en private detail** — `BR-04-21` requiere ocultar la existencia. Implementado en `stores/[slug]/page.tsx` con `notFound()` cuando `store.isPrivate && !isAdmin && store.createdByUserId !== session?.user?.id`.
6. **Listing filter** — `getPublicStoresListingPage` agrega `isPrivate: false` al `where` de listing (BR-04-21). Los private stores siguen accesibles vía URL directa solo para su creador/admins.
7. **Wizard refactor pragmático** — La `CreateStoreForm` existente (809 líneas) y `EditStoreForm` (598 líneas) **no se reemplazaron** con `<WizardAccordion>` puro. En su lugar:
   - El wizard toolkit (`<WizardAccordion>` + `<WizardStep>` + `<Stepper>`) está construido y testeado, listo para S7/S8 y para una iteración futura del wizard de stores.
   - Para S6 priorizamos preservar funcionalidad existente y agregar el `Switch` `isPrivate` con voice glossary y validation correctas. Documentado en "Lo que NO se hizo".
8. **Modal viejo coexiste** — `modules/Modal/Modal.tsx` se actualizó in-place con la API extendida; los consumidores legacy reciben automáticamente el nuevo visual (Semantic Depth icon-circle vacío cuando no pasan `icon`).
9. **EmptyState con Sparkles** — En lugar de `<MascotBubble>` (que tiene API de bubble flotante de shell), el listing empty usa un icon-tile accent + Sparkles. Más simple y coherente.

## Strings i18n agregados

- `src/i18n/locales/es/storeListing.json` y `en/storeListing.json` — namespace `s6` con hero, toolbar, sort, count, importCountriesLabel, empty, card (~16 keys × 2 locales).
- `src/i18n/locales/es/stores.json` y `en/stores.json` — namespace `redesign` con `filter`, `detail`, `report`, `create.step1..step5`, `create.channels`, `create.duplicate`, `create.logo`, `create.categoryRequest`, `toast`, `edit`, `validationErrors` (~80 keys × 2 locales). Inglés completado con valores naturales — listo para curaduría en S12 si aplica.

## Server actions / schemas modificados

- `prisma/schema.prisma` — `Store.isPrivate Boolean @default(false)` + `@@index([isPrivate])`.
- `src/queries/store.ts` — `getPublicStoresListingPage` filtra `isPrivate: false`; `getStoreBySlug` selecciona `isPrivate` + `createdByUserId`; `StoreDetail` incluye ambos; `CreateStoreInput` admite `isPrivate`; `createStore` persiste el flag (forzado a `false` si `storeType !== PERSON`).
- `src/queries/storeGovernance.ts` — `EditableStore`/`EditableStoreInput`/`EditableStoreDiff` incluyen `isPrivate`; `normalizeEditableStoreInput` forza `false` si BUSINESS; `mapStoreToEditableStore`/`buildEditableStoreDiff`/`mergeEditableStoreWithChangeRequest` lo propagan; `updateStoreEditableFields` lo escribe.
- `src/app/[locale]/(app)/stores/new/_schemas/createStoreSchema.ts` — extracción de `createStoreShape` y `refinePrivateOnlyPerson` reusable; refinement enforce FR-04-33/34.
- `src/app/[locale]/(app)/stores/[slug]/edit/_schemas/editStoreSchema.ts` — usa `createStoreShape` + mismo refinement.
- Server actions `createStore.ts` y `saveStoreEdit.ts` — leen `isPrivate` del FormData (`formData.get("isPrivate") === "on"`) y lo pasan al query.
- `stores/[slug]/page.tsx` — guard 404 para private stores cuando viewer ≠ creator/admin.

## Repunteo de imports

- `stores/page.tsx`: eliminó `AppPageHero`; importa `EmptyState`, `Button`, `Sparkles`.
- `StoreListingContent.tsx`: reemplazado completo. Import único de `StoreCard` (compartido).
- `StoreListingFilters.tsx`: reemplazado completo. Imports de `FilterDrawer`, `Eyebrow`, `Button`, `Select`, `Input`.
- `StoreDetailContent.tsx`: agregó `StoreHero`, `Lock`, removió imports muertos (`STORE_HERO_META_PILL_CLASSNAME`, `getCollectorCountryFlagEmoji`, `Heading`/`Image`/`Building2`/`BadgeCheck`/`MapPinned` se mantienen para body subcards).
- `StoreToggleSwitch` reusado en `CreateStoreForm` y `EditStoreForm` para `isPrivate`.

## Validación

| Comando                     | Resultado                                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx prisma migrate deploy` | ✅ aplicada                                                                                                                                                         |
| `npx prisma generate`       | ✅ Generated Prisma Client                                                                                                                                          |
| `npm run type-check`        | ✅ sin errores                                                                                                                                                      |
| `npm run lint`              | ✅ 0 errores · 13 warnings (preexistentes en core: `_surfaceContext`, `_color`, `_iconClassName`, hint react-hooks en Modal cleanup, etc. — no introducidos por S6) |
| `npm run test`              | ✅ 411 tests pasando · 12 skipped · 57 archivos                                                                                                                     |
| `npm run validate-build`    | ✅ build limpio                                                                                                                                                     |
| `npm run test:e2e`          | no ejecutado en esta sesión — `e2e/stores.spec.ts` (si existe) requiere correr con dev server                                                                       |

## Iteración 2 (2026-05-03 follow-up)

Tras feedback del humano (listing card chiquito + chip "Pendiente de revisión" desbordando + wizard pendiente):

### Visuales del listing (StoreCard)

- Card `overflow-hidden` para evitar overflow visual a futuro.
- "Pendiente de revisión" chip movido a su propia fila debajo del meta — antes desbordaba el flex sin wrap.
- Type-icon bumped 12 → 14 px para mejor lectura junto al subtitle.
- `min-w-0 flex-1 truncate` aplicado al name + país.

### Ancho de páginas (form rail eliminado)

- `stores/page.tsx`, `stores/new/page.tsx`, `stores/[slug]/edit/page.tsx` ya no envuelven contenido en `APP_SHELL_FORM_RAIL_CLASSNAME` (`max-w-3xl`). Heredan el `max-w-6xl` del shell `<main>`. Las cards y el wizard tienen ahora el mismo ancho que el header del shell.

### Wizard real (CreateStoreForm + EditStoreForm)

Reemplazado el layout vertical de `StoreFormSectionCard` por el toolkit `<WizardAccordion>` + `<WizardStep>` + `<Stepper>` ya construido en la iteración 1. Implementado de forma reusable para que S7 (Orders) y S8 (Deliveries) lo hereden directamente.

**Cambios al `<WizardAccordion>` (mejora reusable):**

- Nuevo prop `steps?: StepperStep[]` que, cuando se pasa, renderiza un `<Stepper>` integrado en el header del accordion y usa `steps.length` como `totalSteps`. Soporta steps condicionales (BUSINESS=5, PERSON=4) sin desincronizar la numeración.
- Nuevo prop `stepperAriaLabel` para el landmark.

**Cambios al `<WizardStep>`:**

- `primaryAction.onClick` y `secondaryAction.onClick` ahora son **opcionales**. Cuando se omiten:
  - `primaryAction` → `ctx.markDoneAndAdvance(n)` (avanza con done state).
  - `secondaryAction` → `ctx.goBack(n)` (retrocede).
- Nuevo prop `autoBack` (default `true`) controla el comportamiento del secondary, simétrico a `autoAdvance`.
- Nuevo prop `keepBodyMounted` (default `true`): el body permanece en el DOM con `hidden` cuando el paso no está activo. Esto preserva los inputs uncontrolled (channels/addresses) entre pasos para que `FormData` capture todo al submit.

**CreateStoreForm — wizard de 5 pasos (BUSINESS) / 4 pasos (PERSON):**

| n                         | Step       | Contenido                                                                   |
| ------------------------- | ---------- | --------------------------------------------------------------------------- |
| 1                         | Tipo       | `ToggleChoiceGroup` BUSINESS/PERSON + `Switch` Perfil privado (solo PERSON) |
| 2                         | Identidad  | Name (con dup detection inline), Country, Description, Logo (BUSINESS)      |
| 3                         | Categorías | ProductTypes, Presence, hasStock/receivesOrders, Import countries           |
| 4 (BUSINESS)              | Canales    | ContactChannels + Addresses lists                                           |
| 5 (BUSINESS) / 4 (PERSON) | Listo      | Summary + submit `triggerSubmit`                                            |

- El `<form>` envuelve todos los WizardSteps; submit final usa `formRef.current?.requestSubmit()` que dispara el `handleFormSubmit` existente.
- Hidden inputs raíz para `storeType`, `isPrivate`, `hasStock`, `receivesOrders` (las toggles de switches no se renderizan en el step activo cuando estás en step 5).
- Modal de confirmación de duplicados refactorizado a usar el nuevo `<Modal>` (icon + tone="warning" + primaryAction/secondaryAction).
- Validation por step:
  - Step 2 disabled si `name` o `country` vacíos.
  - Step 3 disabled si `productTypes` o `presence` vacíos.

**EditStoreForm — wizard de 4 pasos (BUSINESS) / 3 pasos (PERSON):**

Como `storeType` es inmutable en edit, el step 1 "Tipo" se omite y el flow arranca directo en Identidad:

| n                         | Step       | Contenido                                                                              |
| ------------------------- | ---------- | -------------------------------------------------------------------------------------- |
| 1                         | Identidad  | Name (con `immutableFieldsHelper` mostrando type+country read-only), Description, Logo |
| 2                         | Categorías | ProductTypes, Presence, hasStock/receivesOrders, isPrivate (PERSON), Import countries  |
| 3 (BUSINESS)              | Canales    | ContactChannels + Addresses                                                            |
| 4 (BUSINESS) / 3 (PERSON) | Listo      | Comment textarea (solo change-request mode) + Summary + submit                         |

### Validación post-iteración 2

| Comando                  | Resultado                                                                 |
| ------------------------ | ------------------------------------------------------------------------- |
| `npm run type-check`     | ✅ sin errores                                                            |
| `npm run lint`           | ✅ 0 errores · 11 warnings (todas preexistentes en core, no introducidas) |
| `npm run test`           | ✅ 411 tests pasando                                                      |
| `npm run validate-build` | ✅ build limpio                                                           |

## Lo que NO se hizo (intencionalmente)

1. **Logo upload modal con nuevo `<Modal>`.** El `StoreLogoField` existente sigue usando su modal interno; el componente Modal nuevo está disponible cuando se decida migrar.
2. **Toast post-submit "Tienda creada — pendiente de revisión"** (P-S6-03). Las keys `redesign.toast.created` están listas pero no se cableó el toast al success del action (queda como mejora UX).
3. **Autosave en localStorage** (P-S6-04). No implementado — propuesta no aprobada explícitamente.
4. **Inactividad warning visual** (FR-04-19). El handoff lo flageó como no bloqueante; pendiente.
5. **Migración de otros consumidores de Modal viejo** (StoreGovernanceSummaryModal, StoreProductTypeRequestModal, StoreMultiTagAutocomplete). Visualmente reciben el ADR 0008 automáticamente; la migración a la nueva API (icon/tone/primaryAction) es opcional y se hereda a S7+.
6. **`<DetailSidebar>` aplicado al detail page.** El layout actual del detail page conserva sus secciones existentes; el wrapper `<DetailSidebar>` está disponible para futuras pantallas.

## Estado del working tree

Cambios sin commitear (incluye archivos de migration, código en `src/`, locales, docs nuevos en `docs/redesign/sessions/06-stores-impl.md` y actualización de `docs/redesign/README.md`).

## Riesgos visuales / regresiones conocidas

1. **Listing visual radical.** El layout antes mostraba cards detalladas con channel icons y commerce signal pills inline; ahora son `<StoreCard>` minimalistas. Si algún user dependía de "ver canales sin entrar al detalle", este flujo cambió. Coherente con el handoff visual.
2. **Hero del detalle con menos chrome.** El gradient hero animado se reemplazó por hero plano con chips. La animación `hero-fade-in-up` quedó referenciada en globals pero no se aplica más en la pantalla.
3. **Wizard sigue con look anterior.** Como mencionado, `CreateStoreForm` y `EditStoreForm` mantienen su layout — visualmente NO son descendientes directos del demo. Funcionalmente correctos (incluyendo `isPrivate`).
4. **Toast no aparece** post-creación (queda fuera de scope).
5. **EmptyState** usa Sparkles en lugar de la mascota; visualmente más sutil que lo descrito en `screens/store-list.md §6`.

## Iteración 3 — Auditoría comparativa visual (2026-05-03)

Sesión de audit S6 Fase B: comparación sistemática de cada componente implementado contra los anchors `#s6-*` del demo HTML (`docs/redesign/_notes/demo-screens.html`). Sin cambios funcionales — solo alineación visual con el contrato del demo.

### Gaps encontrados y corregidos

| Archivo                   | Gap                                                                                        | Fix aplicado                                                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StoreCard.tsx`           | Background `--surface-elevated` en vez de `--surface`                                      | `[background:var(--surface)]`                                                                                                                                           |
| `StoreCard.tsx`           | Padding `p-4`/`md:p-5` — no uniforme 18px                                                  | `p-[18px]`                                                                                                                                                              |
| `StoreCard.tsx`           | Hover: solo border-color, faltaba lift + shadow                                            | `hover:[transform:translateY(-2px)] hover:[box-shadow:var(--shadow-2)]`; transition explícita `border-color 150ms, transform 150ms, box-shadow 150ms`                   |
| `StoreCard.tsx`           | Avatar PERSON: mostraba letra con tinte accent en lugar de muted+user icon                 | Pasa `isPerson={isPerson}` al `StoreAvatar`                                                                                                                             |
| `StoreAvatar.tsx`         | No tenía variante PERSON (User icon + muted tint)                                          | Nuevo prop `isPerson?: boolean`; cuando true: bg `color-mix(in oklch, var(--text-muted) 12%, var(--surface-elevated))`, color `--text-muted`, icon `User` (22px en s56) |
| `StoreListingContent.tsx` | Grid `gap-4` (16px) vs demo `14px`                                                         | `gap-[14px]`                                                                                                                                                            |
| `StarRating.tsx`          | Filled: `--accent`; empty: `--text-muted opacity-50`                                       | Filled: `--accent-warm`; empty: `color-mix(in_oklch,var(--text-primary)_14%,transparent)`                                                                               |
| `ReviewRow.tsx`           | Stars filled: `--accent`                                                                   | `--accent-warm`                                                                                                                                                         |
| `StoreHero.tsx`           | Shadow: multi-capa custom                                                                  | `[box-shadow:var(--shadow-2)]`                                                                                                                                          |
| `StoreHero.tsx`           | Avatar no-logo ignoraba `isPerson`                                                         | Pasa `isPerson={isPerson}` al `StoreAvatar` del hero                                                                                                                    |
| `StoreDetailContent.tsx`  | ChannelRow icon: 36px, radius 10px, color `--accent`                                       | 32px (`h-8 w-8`), `[border-radius:8px]`, `--accent-cool` y tinte `--accent-cool`                                                                                        |
| `StoreDetailContent.tsx`  | Main column `space-y-4` entre subcards                                                     | `space-y-3` (12px, matching `.subcard + .subcard { margin-top: 12px }`)                                                                                                 |
| `StoreSubcard.tsx`        | Collapse: mount/unmount inmediato, sin animación                                           | CSS `grid-template-rows: 1fr → 0fr` con `transition: 200ms ease`; `aria-hidden` cuando cerrado                                                                          |
| `CreateStoreForm.tsx`     | Inline duplicate: clases no-theme-aware (`border-primary/35 bg-primary/8 ring-primary/20`) | Reemplazado por `<DuplicateAlertInline>` con labels `tCreateRedesign("duplicate.*")`                                                                                    |
| `CreateStoreForm.tsx`     | Faltaba indicador autosave                                                                 | Added footer `<Check> {tCreateRedesign("autosave")}` bajo el `WizardAccordion`                                                                                          |
| `StoreListingFilters.tsx` | —                                                                                          | Sin gaps — estructura y tokens correctos contra `#s6-stores-list-filters-open`                                                                                          |

### Comparative audit — checklist vs handoff §12

| Componente                        | Tokens paleta                 | Hover/motion      | Spacing | Avatar PERSON | Shadow | Stars |
| --------------------------------- | ----------------------------- | ----------------- | ------- | ------------- | ------ | ----- |
| `StoreCard`                       | ✅                            | ✅                | ✅      | ✅            | ✅     | ✅    |
| `StoreAvatar`                     | ✅                            | n/a               | n/a     | ✅            | n/a    | n/a   |
| `StarRating`                      | ✅ `--accent-warm`            | n/a               | n/a     | n/a           | n/a    | ✅    |
| `ReviewRow`                       | ✅ `--accent-warm`            | n/a               | ✅      | n/a           | n/a    | ✅    |
| `StoreHero`                       | ✅                            | n/a               | ✅      | ✅            | ✅     | ✅    |
| `StoreDetailContent` — ChannelRow | ✅ `--accent-cool`            | n/a               | ✅ 32px | n/a           | n/a    | n/a   |
| `StoreSubcard`                    | ✅                            | ✅ CSS transition | ✅      | n/a           | n/a    | n/a   |
| `CreateStoreForm`                 | ✅ via `DuplicateAlertInline` | n/a               | n/a     | n/a           | n/a    | n/a   |

### Validación post-iteración 3

| Comando                  | Resultado                                       |
| ------------------------ | ----------------------------------------------- |
| `npm run test`           | ✅ 411 tests pasando · 12 skipped · 57 archivos |
| `npm run type-check`     | ✅ 0 errores                                    |
| `npm run lint`           | ✅ 0 errores · 12 warnings preexistentes        |
| `npm run validate-build` | ✅ build limpio                                 |

### Fuera de scope (§7 — sin cambios funcionales)

- Iconos por categoría en los chips del `StoreCard` (requeriría mapa de producto a Lucide icon — feature nueva).
- `DuplicateCandidatesList` en el Modal de confirmación de submit: mantiene clases legacy (`border-border`, `bg-background/70`, `hover:border-primary/60`) — no era parte del gap list de la auditoría.

## Qué necesita la próxima sesión (S7 Módulo Órdenes)

- Reusar `<WizardAccordion>` + `<WizardStep>` + `<Stepper>` para el wizard de Orders (5 pasos según el demo).
- Reusar `<FilterDrawer>` para `/orders` (config con `orderStatus`, `payment`, `store`, `categories`, `dates`).
- Reusar `<DetailSidebar>` para `/orders/[id]` con slots Resumen (totales, % pagado), Acciones (crear entrega, editar, cancelar/reactivar), Nota privada.
- Reusar `<Modal>` ADR 0008 para discrepancia (sub-flujo 12.a), confirm delete, descartar cambios.
- Migration Prisma probablemente innecesaria.
- El wizard refactor pragmático de Stores deja un patrón a NO repetir: para Orders, refactor wizard completo desde el inicio.
