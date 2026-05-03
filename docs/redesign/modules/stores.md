---
title: Módulo Stores — S6
session: 06
phase: A (aprobada) → B (pendiente)
status: handoff-ready
last_updated: 2026-05-03
screens:
  - docs/redesign/screens/store-list.md
  - docs/redesign/screens/store-detail.md
  - docs/redesign/screens/store-create.md
frd: docs/product/prd-01-collector-mvp/frd-04-store-domain/frd-04-store-domain.md
blueprint: docs/product/prd-01-collector-mvp/frd-04-store-domain/bp-01-store-public-trust-system/bp-01-store-public-trust-system.md
---

# Módulo Stores — S6

## Resumen ejecutivo

Este documento cubre la Fase A completa del módulo Stores (S6). El demo HTML fue aprobado visualmente en Fase A.2. Los screen specs en `docs/redesign/screens/store-*.md` describen el contrato funcional por pantalla. Este doc maestro define funcionalidades preservadas, cambios aplicados, propuestas funcionales pendientes de aprobación, componentes propios del módulo, y el Handoff a Fase B.

**Demo de referencia:** `docs/redesign/_notes/demo-screens.html` — anchors `#s6-stores-*`, `#s6-store-detail-*`, `#s6-store-create-*`.

---

## Pantallas del módulo

| Screen spec               | Anchors del demo                                                                                                                                                                               | Descripción               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `screens/store-list.md`   | `#s6-stores-list-loading`, `#s6-stores-list-default`, `#s6-stores-list-empty`, `#s6-stores-list-filters-open`                                                                                  | Lista pública de tiendas  |
| `screens/store-detail.md` | `#s6-store-detail-published-viewer`, `#s6-store-detail-other-user`, `#s6-store-detail-pending`, `#s6-store-detail-person`, `#s6-store-detail-report-modal`, `#s6-store-detail-reports-summary` | Detalle público de tienda |
| `screens/store-create.md` | `#s6-store-create-step-1-type` … `#s6-store-create-edit-mode` (12 anchors)                                                                                                                     | Wizard creación / edición |

---

## Funcionalidades preservadas (mapeadas al FRD)

Las siguientes funcionalidades del FRD-04 están representadas en el demo aprobado y deben implementarse en Fase B sin alteración funcional:

| FR / BR     | Descripción                                                                                                 | Pantalla(s)                                                         |
| ----------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| FR-04-01…05 | Modelo de datos: Store, tipo BUSINESS/PERSON, presencia, identity fields, metadata                          | Subyace a todas                                                     |
| FR-04-06…08 | Crear tienda autenticado; APPROVED para admins, PENDING para users normales                                 | `store-create` paso 5                                               |
| FR-04-09    | Validación contra catálogos de países y product types                                                       | `store-create` pasos 2, 3                                           |
| FR-04-10    | Detección de duplicados on blur + modal de confirmación on submit                                           | `store-create` paso 2, `#s6-store-create-duplicate-detected`        |
| FR-04-11…13 | Búsqueda por nombre, filtros product type / country / import country / presence / receivesOrders / hasStock | `store-list` toolbar + FilterDrawer                                 |
| FR-04-14…15 | OR intra-familia, AND inter-familia en filtros                                                              | `store-list` FilterDrawer                                           |
| FR-04-16    | Listing incluye PENDING + APPROVED (ambos PUBLIC)                                                           | `store-list`                                                        |
| FR-04-17    | Ruta canónica `/{locale}/stores/[slug]`                                                                     | `store-detail`                                                      |
| FR-04-18    | Disclaimer para tiendas PENDING                                                                             | `#s6-store-detail-pending`                                          |
| FR-01-19    | Warning inactividad                                                                                         | No en demo — Fase B agrega según spec                               |
| FR-01-20…23 | Business expone canales/direcciones; Person los omite                                                       | `#s6-store-detail-person`                                           |
| FR-04-33…34 | Flag `isPrivate` solo para PERSON, toggle en creación                                                       | `#s6-store-create-step-1-type`                                      |
| FR-01-24    | Reseñas: 1 por user por tienda, batch de 5 progresivo                                                       | `store-detail` sección Reseñas                                      |
| FR-01-25    | Campos de trust agregados persistidos (no recalculados)                                                     | Subyace al hero (rating)                                            |
| FR-01-26    | Nota privada con guardado de valor vacío para borrar                                                        | `store-detail` sidebar                                              |
| FR-01-27    | Report: 1 abierto por user/tienda; update al existente; nuevo tras resolución                               | `#s6-store-detail-report-modal`, `#s6-store-detail-reports-summary` |
| FR-01-28    | Solicitud de nuevo product type desde create y edit                                                         | `#s6-store-create-category-request`                                 |
| FR-01-29…30 | APPROVED → change request; PENDING → edición directa por creator/admins                                     | `#s6-store-create-edit-mode`                                        |
| FR-01-31    | Logo upload para BUSINESS                                                                                   | `#s6-store-create-logo-upload`, `#s6-store-create-step-2-logo-set`  |
| FR-01-32    | Layout detalle: columna principal, sales/shopping bajo el hero                                              | `store-detail` hero + chips presencia                               |
| BR-01-07    | Reviews sin order vinculado en MVP; disclosure progresivo 5+5                                               | `store-detail` sección Reseñas                                      |
| BR-01-08…09 | Duplicados solo bloquean en mismo país y sobre threshold                                                    | `store-create` detección                                            |
| BR-01-10    | Redirect a detail tras create exitoso                                                                       | Post-submit paso 5                                                  |
| BR-04-20    | Tiendas PENDING soportan mismas interacciones que APPROVED (solo cambia disclaimer + SEO)                   | `store-detail`                                                      |
| BR-04-21    | Tiendas privadas excluidas de listing público                                                               | `store-list` query                                                  |

---

## Cambios visuales aplicados en Fase A (aprobados)

Estos cambios respecto a la implementación actual están aprobados visualmente. Fase B los implementa sin necesidad de aprobación adicional:

1. **Vibe Atelier completa:** eyebrows mono uppercase, accent tints en avatares, icon-tiles en wizard, densidad media, chips tintados con border semitransparente.
2. **StoreCard rediseñada:** avatar 56px con tint accent (BUSINESS) o tint muted (PERSON) + icono tipo inline + fila "Importa de" en bloque (sin flex, wrapping natural) + fila stats con rating numérico bold.
3. **Hero del detalle en columna única:** hero con chips de presencia/stock/pre-órdenes bajo la descripción; sin rail de metadata competidor. Rating prominente en hero.
4. **Rating block en sección reseñas:** número grande (38px bold) + estrellas 20px + count, separado por border-bottom del form y la lista.
5. **WizardAccordion con labels 14px bold** en los headers de sección dentro de cada step.
6. **Paso 4 canales:** filas read-only bordeadas + panel "Agregar nuevo" separado con Select + Input + Button "Agregar".
7. **"Solicitar nueva categoría"** como chip dashed al final del grupo de categorías (no botón después de presencia).
8. **Modal de categoría sin contenedores de campo:** labels bold 13px `text-primary` directamente sobre inputs, sin cajas tintadas.
9. **Paso 2 con logo:** thumbnail 72px con inicial + nombre de archivo + acciones inline.
10. **Duplicados sin "Esta es mi tienda":** solo "Cancelar" y "Crear de todos modos".
11. **"Importa de" en cards:** bloque (no flex), línea-height 1.5, nombres completos de países.

---

## Propuestas de cambio funcional (requieren aprobación explícita antes de Fase B)

Estos ítems **no están en el FRD actual** o representan cambios de scope. Fase B NO los implementa hasta aprobación:

| ID      | Propuesta                                                                                                                                                | Origen           |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| P-S6-01 | Ordenar por en lista: "Mejor calificadas / Alfabético / Más recientes". El FRD no define ordenamiento — el demo lo muestra.                              | Demo A.1         |
| P-S6-02 | Distinción visual BUSINESS/PERSON en card de lista mediante icono de tipo inline. El FRD solo define comportamiento de payload, no presentación en card. | Demo A.1         |
| P-S6-03 | Toast post-submit de creación con copy "Tienda creada — pendiente de revisión". El FRD define redirect (BR-01-10) pero no Toast.                         | Demo paso 5      |
| P-S6-04 | Autosave en localStorage durante el wizard. El FRD no menciona persistencia temporal.                                                                    | Demo form-footer |

> **Decisión requerida:** confirmar P-S6-01 a P-S6-04 antes de arrancar Fase B. Si se aprueban, Fase B los implementa. Si se rechazan, se omiten del scope.

---

## Componentes propios del módulo

Estos componentes son específicos del módulo Stores y no están en el catálogo core `docs/redesign/components/`. Fase B los crea en `src/app/[locale]/(app)/stores/_components/`.

| Componente             | Descripción                                                                                                                | Pantallas que lo usan                                      |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `StoreCard`            | Card de la lista: avatar + nombre + tipo + meta + categorías + "Importa de" + stats                                        | `store-list`                                               |
| `StoreHero`            | Bloque de identidad del detalle: avatar 56px + nombre + meta + rating + descripción + chips de presencia/stock/pre-órdenes | `store-detail`                                             |
| `StoreSubcard`         | Acordeón colapsable de sección de detalle (`.subcard`): toggle con eyebrow + count + chevron, body colapsable              | `store-detail` (Categorías, Canales, Direcciones, Reseñas) |
| `ReviewRow`            | Fila de reseña individual: `Avatar` 32px + nombre reviewer + stars + timestamp + texto                                     | `store-detail` sección Reseñas                             |
| `WriteReviewForm`      | Formulario inline de reseña: stars interactivas + `Textarea` + CTA "Publicar"                                              | `store-detail` sección Reseñas (viewer autenticado)        |
| `DuplicateAlertInline` | Alerta on-blur bajo campo Nombre: eyebrow + candidatos con `StoreAvatar` 32px + links "Ver tienda"                         | `store-create` paso 2                                      |
| `ReportReasonPicker`   | Lista de razones de reporte: icono + label, una seleccionable a la vez                                                     | `#s6-store-detail-report-modal`                            |

---

## Handoff a Fase B

### Archivos a crear / modificar

**Rutas y páginas (App Router):**

```
src/app/[locale]/(app)/stores/
  page.tsx                          ← Ya existe, actualizar layout y componentes
  [slug]/
    page.tsx                        ← Ya existe, actualizar layout y componentes
    edit/
      page.tsx                      ← Ya existe, verificar branching PENDING vs APPROVED
  new/
    page.tsx                        ← Ya existe, reemplazar con wizard WizardAccordion
```

**Componentes del módulo (nuevos):**

```
src/app/[locale]/(app)/stores/_components/
  StoreCard.tsx
  StoreHero.tsx
  StoreSubcard.tsx
  ReviewRow.tsx
  WriteReviewForm.tsx
  DuplicateAlertInline.tsx
  ReportReasonPicker.tsx
```

**Componentes de listing existentes a actualizar:**

```
src/app/[locale]/(app)/stores/_components/
  StoreListingContent.tsx           ← Reemplazar cards con StoreCard
  StoreListingFilters.tsx           ← Usar FilterDrawer + Switch core
  StoreListingPagination.tsx        ← Usar Pagination core
```

**i18n:**

```
src/i18n/locales/es/stores.json     ← Agregar keys del módulo (ver §Copy aprobada)
src/i18n/locales/en/stores.json     ← Keys en inglés (completar en S12 si aplica)
```

### Componentes core a consumir

Ver §Inventario de componentes core consumidos por este módulo.

### Tokens a usar

| Elemento                 | Token                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| Avatar accent (BUSINESS) | `color-mix(in oklch, var(--accent) 18%, var(--surface-elevated))`                                |
| Avatar muted (PERSON)    | `color-mix(in oklch, var(--text-muted) 12%, var(--surface-elevated))`                            |
| Chip accent bg           | `color-mix(in oklch, var(--accent) 10%, transparent)`                                            |
| Chip accent border       | `color-mix(in oklch, var(--accent) 22%, transparent)`                                            |
| Chip info bg/border      | mismo patrón con `var(--info)`                                                                   |
| Chip success bg/border   | mismo patrón con `var(--success)`                                                                |
| Chip warning bg/border   | mismo patrón con `var(--warning)`                                                                |
| Step-num activo          | `background: var(--accent); color: #fff`                                                         |
| Step-num completado      | `background: color-mix(in oklch, var(--success) 15%, transparent); border-color: var(--success)` |
| Cat-chip dashed          | `border-style: dashed; color: var(--text-muted)`                                                 |
| Rating number            | `font-size: 38px; font-weight: 700; color: var(--text-primary)`                                  |
| Section label wizard     | `font-size: 14px; font-weight: 700`                                                              |
| Autosave checkmark       | `color: var(--success)`                                                                          |
| Review panel bg          | `color-mix(in oklch, var(--accent) 5%, transparent)`                                             |
| Review panel border      | `color-mix(in oklch, var(--accent) 15%, transparent)`                                            |

### Decisiones cerradas durante la iteración

| #   | Decisión                                                                                    | Justificación                                                                      |
| --- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| D1  | "Importa de" en cards usa bloque (no flex), texto fluye naturalmente                        | Flex sin wrap truncaba "Japón · Corea del Sur · Estados Unidos" en cards estrechas |
| D2  | Rating block prominente (38px) dentro de la sección Reseñas, no en el toggle header         | El toggle header con "92 · 4.7 ★" era redundante con el block visible al expandir  |
| D3  | Labels de sección en wizard a 14px bold (no `field-label` estándar)                         | Jerarquía visual mejorada dentro de los steps del WizardAccordion                  |
| D4  | Canales en paso 4: filas read-only + panel "Agregar nuevo" separado                         | Evita formulario mezclado con lista; más claro qué existe vs qué se agrega         |
| D5  | "Esta es mi tienda" eliminado del modal de duplicados                                       | Flujo confuso; el link "Ver tienda" sobre cada candidato cubre el caso de uso      |
| D6  | Modal "Solicitar nueva categoría" sin cajas tintadas por campo                              | Las cajas innecesarias pesaban visualmente sin añadir separación real              |
| D7  | "Solicitar nueva categoría" como chip dashed inline, no botón separado después de Presencia | Contextualmente cerca de las categorías; reduce scroll                             |

### Edge cases acordados

- **Store PERSON privada:** el `Switch` "Perfil privado" solo aparece cuando tipo = PERSON. Si el user elige BUSINESS después de haber activado el switch, el switch se oculta y el valor se descarta sin error.
- **Detección de duplicados:** el alert inline aparece on-blur con ≥2 chars trimmed. Si el user borra el campo y lo deja vacío, el alert desaparece silenciosamente (sin error).
- **Duplicado cross-country:** si los candidatos son de otro país, el alert inline muestra los candidatos informativamente pero el submit no bloquea (BR-01-09).
- **Logo upload cancelado:** si el user abre el modal de recorte y lo cierra sin guardar, el campo logo vuelve al estado anterior (vacío o con logo previo).
- **Nota privada vacía:** guardar una nota vacía borra la nota existente (FR-01-26). No requiere confirmación.
- **Tienda PERSON en detalle:** los subcards "Canales de contacto" y "Direcciones" no se renderizan (no solo se vacían — la sección entera desaparece). El sidebar "Acciones" no incluye "Reportar" para la propia tienda personal.
- **Reseña del viewer:** siempre aparece primera en la lista aunque no sea la más reciente (FR-01-24).
- **Wizard autosave:** persiste en `localStorage` bajo clave `pt-store-draft`. Se limpia tras submit exitoso o al navegar fuera y confirmar descarte.

### Copy aprobada (keys i18n)

Keys en namespace `stores` (español). El inglés se completa en S12.

| Clave i18n                                          | Valor ES                                                                                                                                                       |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stores.list.hero.eyebrow`                          | `DIRECTORIO`                                                                                                                                                   |
| `stores.list.hero.title`                            | `Dónde comprar`                                                                                                                                                |
| `stores.list.hero.subtitle`                         | `Tiendas curadas por la comunidad. Filtra por país o categoría.`                                                                                               |
| `stores.list.toolbar.search_placeholder`            | `Buscar por nombre…`                                                                                                                                           |
| `stores.list.toolbar.filter`                        | `Filtrar`                                                                                                                                                      |
| `stores.list.toolbar.new`                           | `Nueva tienda`                                                                                                                                                 |
| `stores.list.toolbar.sort_label`                    | `Ordenar por`                                                                                                                                                  |
| `stores.list.sort.top_rated`                        | `Mejor calificadas`                                                                                                                                            |
| `stores.list.sort.alphabetical`                     | `Alfabético A–Z`                                                                                                                                               |
| `stores.list.sort.newest`                           | `Más recientes`                                                                                                                                                |
| `stores.list.count`                                 | `{count, plural, one {# tienda} other {# tiendas}}`                                                                                                            |
| `stores.list.import_countries_label`                | `Importa de ·`                                                                                                                                                 |
| `stores.list.no_import_countries`                   | `Sin países de importación declarados`                                                                                                                         |
| `stores.list.load_more`                             | `Cargar más`                                                                                                                                                   |
| `stores.list.empty.title`                           | `Sin resultados`                                                                                                                                               |
| `stores.list.empty.subtitle`                        | `Prueba con otros filtros o amplía la búsqueda.`                                                                                                               |
| `stores.list.empty.clear_filters`                   | `Limpiar filtros`                                                                                                                                              |
| `stores.filter.title`                               | `Filtrar tiendas`                                                                                                                                              |
| `stores.filter.categories`                          | `Categorías que vende`                                                                                                                                         |
| `stores.filter.presence`                            | `Presencia`                                                                                                                                                    |
| `stores.filter.country`                             | `País de la tienda`                                                                                                                                            |
| `stores.filter.import_country`                      | `Importa desde`                                                                                                                                                |
| `stores.filter.other`                               | `Otros`                                                                                                                                                        |
| `stores.filter.receives_orders`                     | `Recibe pre-órdenes`                                                                                                                                           |
| `stores.filter.has_stock`                           | `Tiene stock`                                                                                                                                                  |
| `stores.filter.ships_to`                            | `Envía a {country}`                                                                                                                                            |
| `stores.filter.clear`                               | `Limpiar`                                                                                                                                                      |
| `stores.filter.apply`                               | `Aplicar`                                                                                                                                                      |
| `stores.detail.back`                                | `Tiendas`                                                                                                                                                      |
| `stores.detail.reviews_title`                       | `Reseñas`                                                                                                                                                      |
| `stores.detail.categories_title`                    | `Categorías e importaciones`                                                                                                                                   |
| `stores.detail.channels_title`                      | `Canales de contacto`                                                                                                                                          |
| `stores.detail.addresses_title`                     | `Direcciones`                                                                                                                                                  |
| `stores.detail.reviews_all`                         | `Ver todas las {count} reseñas`                                                                                                                                |
| `stores.detail.write_review_placeholder`            | `¿Qué opinas de esta tienda?`                                                                                                                                  |
| `stores.detail.publish_review`                      | `Publicar reseña`                                                                                                                                              |
| `stores.detail.private_note_placeholder`            | `Apuntes sobre esta tienda.`                                                                                                                                   |
| `stores.detail.note_saved`                          | `Guardada hace {time}`                                                                                                                                         |
| `stores.detail.report_button`                       | `Reportar tienda`                                                                                                                                              |
| `stores.detail.pending_disclaimer`                  | `En revisión. Visible en la app; no indexable en buscadores.`                                                                                                  |
| `stores.detail.flagged_disclaimer`                  | `Tienda con reportes pendientes. Procede con precaución.`                                                                                                      |
| `stores.detail.presence.physical`                   | `Tienda física`                                                                                                                                                |
| `stores.detail.presence.online`                     | `Tienda online`                                                                                                                                                |
| `stores.detail.has_stock`                           | `Tiene stock`                                                                                                                                                  |
| `stores.detail.accepts_preorders`                   | `Acepta pre-órdenes`                                                                                                                                           |
| `stores.detail.imports_from`                        | `Importa desde`                                                                                                                                                |
| `stores.report.title`                               | `Reportar tienda`                                                                                                                                              |
| `stores.report.subtitle`                            | `¿Por qué quieres reportar {name}?`                                                                                                                            |
| `stores.report.reason.inaccurate`                   | `Info incorrecta`                                                                                                                                              |
| `stores.report.reason.scam`                         | `Posible estafa o fraude`                                                                                                                                      |
| `stores.report.reason.inappropriate`                | `Contenido inapropiado`                                                                                                                                        |
| `stores.report.reason.duplicate`                    | `Tienda duplicada`                                                                                                                                             |
| `stores.report.context_label`                       | `Contexto adicional`                                                                                                                                           |
| `stores.report.context_optional`                    | `(opcional)`                                                                                                                                                   |
| `stores.report.submit`                              | `Enviar reporte`                                                                                                                                               |
| `stores.report.cancel`                              | `Cancelar`                                                                                                                                                     |
| `stores.create.step1.eyebrow`                       | `PASO 1 · TIPO`                                                                                                                                                |
| `stores.create.step1.title`                         | `¿Qué tipo de tienda es?`                                                                                                                                      |
| `stores.create.step1.helper`                        | `Esto cambia los campos siguientes.`                                                                                                                           |
| `stores.create.step1.business_label`                | `Negocio`                                                                                                                                                      |
| `stores.create.step1.business_desc`                 | `Una tienda con marca, redes y direcciones.`                                                                                                                   |
| `stores.create.step1.person_label`                  | `Persona`                                                                                                                                                      |
| `stores.create.step1.person_desc`                   | `Alguien vendiendo — amigo, scout, vendedor.`                                                                                                                  |
| `stores.create.step1.private_label`                 | `Perfil privado`                                                                                                                                               |
| `stores.create.step1.private_badge`                 | `(solo para Persona)`                                                                                                                                          |
| `stores.create.step1.private_helper`                | `Solo tú puedes verlo. No aparece en el directorio público ni en búsquedas. Ideal para registrar coleccionistas o contactos privados sin visibilidad pública.` |
| `stores.create.step2.eyebrow`                       | `PASO 2 · IDENTIDAD`                                                                                                                                           |
| `stores.create.step2.title`                         | `Identidad`                                                                                                                                                    |
| `stores.create.step2.helper`                        | `Cómo se llama y dónde está.`                                                                                                                                  |
| `stores.create.step3.eyebrow`                       | `PASO 3 · CATEGORÍAS`                                                                                                                                          |
| `stores.create.step4.eyebrow`                       | `PASO 4 · CANALES`                                                                                                                                             |
| `stores.create.step5.eyebrow`                       | `PASO 5 · LISTO`                                                                                                                                               |
| `stores.create.step5.title`                         | `Revisa y confirma`                                                                                                                                            |
| `stores.create.continue`                            | `Continuar`                                                                                                                                                    |
| `stores.create.submit`                              | `Crear tienda`                                                                                                                                                 |
| `stores.create.autosave`                            | `Guardado en este navegador`                                                                                                                                   |
| `stores.create.summary_eyebrow`                     | `Resumen`                                                                                                                                                      |
| `stores.create.request_category`                    | `Solicitar nueva categoría`                                                                                                                                    |
| `stores.create.category_request.title`              | `Solicitar nueva categoría`                                                                                                                                    |
| `stores.create.category_request.helper`             | `¿No encuentras la categoría que buscas? Sugiere un nombre y explica por qué debería incluirse.`                                                               |
| `stores.create.category_request.name_label`         | `Nombre de la categoría`                                                                                                                                       |
| `stores.create.category_request.name_placeholder`   | `Ej: Nendoroids, Trading Cards, Gashapon…`                                                                                                                     |
| `stores.create.category_request.reason_label`       | `Motivo`                                                                                                                                                       |
| `stores.create.category_request.reason_placeholder` | `¿Por qué debería agregarse esta categoría? Describe qué tipo de productos cubre y por qué es distinta a las existentes.`                                      |
| `stores.create.category_request.submit`             | `Enviar solicitud`                                                                                                                                             |
| `stores.create.channels.add_button`                 | `Agregar`                                                                                                                                                      |
| `stores.create.channels.helper`                     | `Elige el tipo de canal y pega el valor.`                                                                                                                      |
| `stores.create.duplicate.eyebrow`                   | `Tiendas similares encontradas`                                                                                                                                |
| `stores.create.duplicate.title`                     | `¿Es alguna de estas?`                                                                                                                                         |
| `stores.create.duplicate.view_store`                | `Ver tienda`                                                                                                                                                   |
| `stores.create.duplicate.create_anyway`             | `Crear de todos modos`                                                                                                                                         |
| `stores.create.logo.reframe`                        | `Reencuadrar`                                                                                                                                                  |
| `stores.create.logo.remove`                         | `Quitar`                                                                                                                                                       |
| `stores.toast.created`                              | `Tienda creada — pendiente de revisión`                                                                                                                        |
| `stores.edit.title`                                 | `Editar tienda`                                                                                                                                                |

### Anti-patrones surgidos durante la iteración

- **No usar flex sin wrap en filas de texto de longitud variable.** El patrón `display:flex;gap:4px` trunca silenciosamente cuando el contenedor es estrecho. Usar bloque con `line-height` o flex con `flex-wrap:wrap`.
- **No añadir contenedores de campo innecesarios.** Cajas tintadas con borde alrededor de cada `<label>+<input>` añaden ruido visual sin separación semántica real. Los campos se separan con gap en el contenedor padre.
- **No replicar el rating en el toggle header cuando ya está prominente en el body.** Es redundante y crea jerarquía de información confusa.
- **No colocar CTAs de sub-flujo después de secciones no relacionadas.** "Solicitar nueva categoría" debe vivir junto a los chips de categorías, no al final del paso completo.
- **No mezclar filas existentes con el form de agregar en la misma superficie.** El paso de Canales separa físicamente la lista (read-only) del panel de alta (editable).

### Preguntas abiertas

1. **Propuestas P-S6-01 a P-S6-04** requieren decisión explícita antes de arrancar Fase B (ver §Propuestas de cambio funcional).
2. **Inactividad warning (FR-01-19):** el FRD lo define pero el demo no lo muestra. Fase B debe implementarlo siguiendo el patrón del disclaimer PENDING (mismo componente, tono `warning`). No bloquea arranque.
3. **`isPrivate` en schema:** FRD §Planned Enhancements confirma que requiere campo `isPrivate` boolean en `Store`. Fase B debe verificar si la migración ya existe o crearla.
4. **Moderación de logo:** FRD §Open Questions menciona que los logo replacements deben stagear fuera del key público hasta moderación. Fuera del scope de S6 pero a registrar para S-admin.

### Validación esperada al cierre de Fase B

```bash
npm run test          # unit + integration — incluye store queries
npm run type-check    # sin errores en nuevos componentes
npm run lint          # sin warnings en rutas y componentes nuevos
npm run validate-build
npm run test:e2e      # e2e/stores.spec.ts + e2e/store-listing.spec.ts (ya existen)
```

Criterio de aprobación cualitativa: alguien que vio el demo HTML y entra a la implementación debe sentir "esto es la versión completa de lo mismo" — vibe Atelier, densidad, eyebrows, accent tints, chips semánticos.

---

## Inventario de componentes core consumidos por este módulo

| Componente        | Spec                                                              | Anchors del demo donde aparece                                                                                                                                                                                                                      | Propósito en el módulo                                                                                                    |
| ----------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `AppShell`        | [components/AppShell.md](../components/AppShell.md)               | Todas las pantallas S6                                                                                                                                                                                                                              | Contenedor base con sidebar + content area                                                                                |
| `Sidebar`         | [components/Sidebar.md](../components/Sidebar.md)                 | Todas las pantallas S6                                                                                                                                                                                                                              | Navegación lateral izquierda                                                                                              |
| `MobileTabBar`    | [components/MobileTabBar.md](../components/MobileTabBar.md)       | Todas las pantallas S6                                                                                                                                                                                                                              | Navegación inferior en mobile                                                                                             |
| `Header`          | [components/Header.md](../components/Header.md)                   | Todas las pantallas S6                                                                                                                                                                                                                              | Topbar con título y acciones contextuales                                                                                 |
| `Breadcrumbs`     | [components/Breadcrumbs.md](../components/Breadcrumbs.md)         | `#s6-store-detail-*`, `#s6-store-create-*`                                                                                                                                                                                                          | Back link "← Tiendas" y title de página                                                                                   |
| `StoreAvatar`     | [components/StoreAvatar.md](../components/StoreAvatar.md)         | `#s6-stores-list-default`, `#s6-store-detail-*`, `#s6-store-create-duplicate-detected`, `#s6-store-create-step-5-preview`, review rows                                                                                                              | Avatar de tienda 56px (lista/hero), 32px (duplicados, reseñas)                                                            |
| `StatusChip`      | [components/StatusChip.md](../components/StatusChip.md)           | `#s6-store-detail-published-viewer`, `#s6-store-detail-other-user`, `#s6-store-detail-pending`, `#s6-store-create-step-1-type` (resumen)                                                                                                            | Presencia física/online (`info`), stock (`success`), pre-órdenes (`warning`), estado PENDING (`info`)                     |
| `FilterDrawer`    | [components/FilterDrawer.md](../components/FilterDrawer.md)       | `#s6-stores-list-filters-open`                                                                                                                                                                                                                      | Panel de filtros de la lista con secciones de categorías, presencia, país, importación y switches                         |
| `Sheet`           | [components/Sheet.md](../components/Sheet.md)                     | `#s6-stores-list-filters-open` (mobile)                                                                                                                                                                                                             | FilterDrawer como sheet desde el borde derecho en mobile                                                                  |
| `Pagination`      | [components/Pagination.md](../components/Pagination.md)           | `#s6-stores-list-default`                                                                                                                                                                                                                           | Paginación numérica desktop; "Cargar más" en mobile                                                                       |
| `EmptyState`      | [components/EmptyState.md](../components/EmptyState.md)           | `#s6-stores-list-empty`                                                                                                                                                                                                                             | Estado vacío cuando filtros no devuelven resultados                                                                       |
| `MascotBubble`    | [components/MascotBubble.md](../components/MascotBubble.md)       | `#s6-stores-list-empty`                                                                                                                                                                                                                             | Mascota sleeping con burbuja en estado vacío                                                                              |
| `DetailSidebar`   | [components/DetailSidebar.md](../components/DetailSidebar.md)     | `#s6-store-detail-published-viewer`, `#s6-store-detail-other-user`, `#s6-store-detail-pending`, `#s6-store-detail-person`, `#s6-store-detail-reports-summary`                                                                                       | Aside derecho sticky con cards condicionales por rol (Resumen, Acciones, Nota privada, Gestión)                           |
| `WizardAccordion` | [components/WizardAccordion.md](../components/WizardAccordion.md) | `#s6-store-create-step-1-type` … `#s6-store-create-edit-mode`                                                                                                                                                                                       | Contenedor acordeón del wizard de 5 pasos                                                                                 |
| `WizardStep`      | [components/WizardStep.md](../components/WizardStep.md)           | `#s6-store-create-step-1-type` … `#s6-store-create-step-5-review`                                                                                                                                                                                   | Cada paso individual del wizard (head colapsable + body)                                                                  |
| `Stepper`         | [components/Stepper.md](../components/Stepper.md)                 | Todos los `#s6-store-create-step-*`                                                                                                                                                                                                                 | Barra de progreso horizontal con 5 pasos numerados                                                                        |
| `Modal`           | [components/Modal.md](../components/Modal.md)                     | `#s6-store-detail-report-modal`, `#s6-store-create-duplicate-detected` (modal submit), `#s6-store-create-category-request`, `#s6-store-create-logo-upload`, `#s6-store-create-step-5-preview`                                                       | Reporte de tienda, confirmación de duplicado, solicitud de categoría, upload/recorte de logo, preview de tienda existente |
| `Input`           | [components/Input.md](../components/Input.md)                     | `#s6-stores-list-default` (search), `#s6-stores-list-filters-open` (búsqueda dentro del drawer), `#s6-store-create-step-2-identity`, `#s6-store-create-duplicate-detected`, `#s6-store-create-step-4-channels`, `#s6-store-create-category-request` | Campo búsqueda de lista, campos de nombre/canal/categoría en wizard                                                       |
| `Textarea`        | [components/Textarea.md](../components/Textarea.md)               | `#s6-store-detail-published-viewer` (nota + reseña), `#s6-store-detail-other-user` (idem), `#s6-store-detail-report-modal`, `#s6-store-create-step-2-identity` (descripción), `#s6-store-create-category-request` (motivo)                          | Nota privada, escribir reseña, descripción de tienda, motivo de categoría, contexto de reporte                            |
| `Select`          | [components/Select.md](../components/Select.md)                   | `#s6-stores-list-default` (ordenar por), `#s6-store-create-step-4-channels` (tipo de canal)                                                                                                                                                         | Selector de ordenamiento y tipo de canal de contacto                                                                      |
| `Switch`          | [components/Switch.md](../components/Switch.md)                   | `#s6-store-create-step-1-type` (perfil privado), `#s6-stores-list-filters-open` (pre-órdenes, stock, envía a)                                                                                                                                       | Toggle de perfil privado en creación; switches de filtro en el drawer                                                     |
| `Button`          | [components/Button.md](../components/Button.md)                   | Todas las pantallas                                                                                                                                                                                                                                 | CTAs primarios y secundarios en todo el módulo                                                                            |
| `IconButton`      | [components/IconButton.md](../components/IconButton.md)           | Cierre de modales, fila de canales (external-link, copy, delete), fila de canales en wizard                                                                                                                                                         | Acciones compactas sin etiqueta visible                                                                                   |
| `Eyebrow`         | [components/Eyebrow.md](../components/Eyebrow.md)                 | Todas las pantallas S6                                                                                                                                                                                                                              | Encabezados de sección mono uppercase (DIRECTORIO, PASO 1 · TIPO, CANALES DE CONTACTO, etc.)                              |
| `Card`            | [components/Card.md](../components/Card.md)                       | Sidebar del detalle, aside del wizard                                                                                                                                                                                                               | Cards de Resumen, Acciones, Nota privada; Resumen del wizard                                                              |
| `SectionCard`     | [components/SectionCard.md](../components/SectionCard.md)         | Pasos del wizard, subcards del detalle                                                                                                                                                                                                              | Contenedores con cabecera colapsable para grupos de contenido                                                             |
| `Toast`           | [components/Toast.md](../components/Toast.md)                     | Post-submit de creación, post-submit de solicitud de categoría, post-guardado de nota                                                                                                                                                               | Feedback de acciones completadas                                                                                          |
| `Combobox`        | [components/Combobox.md](../components/Combobox.md)               | `#s6-store-create-step-2-identity` (país, import countries), `#s6-stores-list-filters-open` (búsqueda de país en filtros)                                                                                                                           | Selector searchable de países en form y filtros                                                                           |
| `HelperText`      | [components/HelperText.md](../components/HelperText.md)           | `#s6-store-create-step-2-identity`, `#s6-store-create-step-2-error`                                                                                                                                                                                 | Texto helper bajo campos del wizard                                                                                       |
| `ErrorMessage`    | [components/ErrorMessage.md](../components/ErrorMessage.md)       | `#s6-store-create-step-2-error`                                                                                                                                                                                                                     | Error inline de validación en campos del wizard                                                                           |
| `Avatar`          | [components/Avatar.md](../components/Avatar.md)                   | Footer del sidebar (usuario), review rows                                                                                                                                                                                                           | Avatar del usuario autenticado; avatar de reviewers                                                                       |
| `ProgressBar`     | [components/ProgressBar.md](../components/ProgressBar.md)         | `#s6-store-create-logo-upload`                                                                                                                                                                                                                      | Progreso de upload de logo                                                                                                |
| `Form`            | [components/Form.md](../components/Form.md)                       | Wizard de creación/edición                                                                                                                                                                                                                          | Contenedor de form con Server Action                                                                                      |
| `FormFooter`      | [components/FormFooter.md](../components/FormFooter.md)           | `#s6-store-create-step-5-review`                                                                                                                                                                                                                    | Footer del wizard con autosave indicator                                                                                  |

---

## Cláusula de spec vigente (cross-cutting safety)

El agente de Fase B lee el spec vigente de cada componente core al momento de implementar, **no asume el spec de hoy**. Cualquier mini-sesión cross-cutting (M0X, SN.X) que actualice un componente listado en el inventario se aplica automáticamente.

### Mini-sesiones cross-cutting conocidas en curso al cierre de S6 Fase A

| ID  | Componente afectado | Descripción                                                                                                                               | Estado al cierre Fase A | Impacto en Fase B                                                                                                                                                                                                                                                                                          |
| --- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M01 | `Modal`             | Enhancement visual: íconos en color semántico, depth, motion, layered design. Ver `docs/redesign/_notes/cross-cutting-changes.md` ID M01. | 🟡 abierto              | Si M01 no ha cerrado cuando Fase B arranque, Fase B debe esperar M01 antes de implementar cualquier modal del inventario (`#s6-store-detail-report-modal`, `#s6-store-create-duplicate-detected`, `#s6-store-create-category-request`, `#s6-store-create-logo-upload`, `#s6-store-create-step-5-preview`). |

Si M01 cierra antes de que arranque Fase B, el agente de Fase B lee el spec actualizado de `Modal` y lo implementa directamente. No asume el spec anterior.

Si se registran nuevas mini-sesiones cross-cutting entre el cierre de esta Fase A y el arranque de Fase B, el coordinador las añade a esta tabla antes de entregar el prompt de Fase B.
