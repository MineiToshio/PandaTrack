---
title: Store detail
session: 06
status: html-approved
last_updated: 2026-05-03
demo_anchors:
  - "#s6-store-detail-published-viewer"
  - "#s6-store-detail-other-user"
  - "#s6-store-detail-pending"
  - "#s6-store-detail-person"
  - "#s6-store-detail-report-modal"
  - "#s6-store-detail-reports-summary"
frd: docs/product/prd-01-collector-mvp/frd-04-store-domain/frd-04-store-domain.md
---

# Store detail

> **Fuente visual de verdad:** `docs/redesign/_notes/demo-screens.html`. Los seis anchors arriba son la referencia canónica. Este spec describe el contrato funcional + tokens + componentes consumidos.

## 1. Propósito y contrato funcional

Página pública de detalle de una tienda (`/[locale]/stores/[slug]`). Permite a cualquier visitante entender la identidad, presencia, categorías, canales de contacto y reputación de la tienda. Permite a usuarios autenticados escribir reseñas y guardar notas privadas. El owner ve métricas internas y acciones de gestión. El contexto del viewer determina qué secciones del sidebar se muestran.

Datos clave: `Store` completo (identidad, tipo, presencia, product types, import countries, contact channels, addresses, rating, reviews, moderation state, activity state). Para el viewer autenticado: sus pedidos asociados a esta tienda, su reseña, su nota privada, sus reportes y change requests abiertos.

## 2. Variantes y anchors del demo

| Anchor                              | Descripción                                     | Contexto del viewer          |
| ----------------------------------- | ----------------------------------------------- | ---------------------------- |
| `#s6-store-detail-published-viewer` | Tienda APPROVED, vista del owner                | Creator / owner de la tienda |
| `#s6-store-detail-other-user`       | Tienda APPROVED, viewer autenticado no-owner    | Cualquier user autenticado   |
| `#s6-store-detail-pending`          | Tienda PENDING con disclaimer                   | Creator / admins             |
| `#s6-store-detail-person`           | Tienda tipo PERSON (campos reducidos)           | Cualquier user autenticado   |
| `#s6-store-detail-report-modal`     | Modal "Reportar tienda" activo sobre el detalle | User autenticado             |
| `#s6-store-detail-reports-summary`  | Panel "Reportes y sugerencias" expandido        | Cualquier visitante          |

## 3. Layout y estructura

Vive dentro del `AppShell` ([spec](../components/AppShell.md)). Layout de dos columnas en desktop (main content + aside derecho); columna única en mobile.

**Topbar:** breadcrumb `← Tiendas` (ghost sm button) + nombre de la tienda en `h2`. Usa `Breadcrumbs` ([spec](../components/Breadcrumbs.md)) y `Header` ([spec](../components/Header.md)).

**Columna principal:** `StoreHero` (componente propio) + subcards colapsables apiladas verticalmente.

**Aside derecho (desktop):** `DetailSidebar` ([spec](../components/DetailSidebar.md)) con cards condicionales por rol. Sticky a `top: 80px`.

## 4. StoreHero

Componente propio del módulo (ver módulo stores.md §Componentes propios).

Estructura:

- Fila superior: `StoreAvatar` ([spec](../components/StoreAvatar.md)) 56px + bloque de identidad (nombre display, meta ciudad/país con icono `map-pin`) + bloque de rating (estrellas `stars` + "4.7 · 92 reseñas") justificado a la derecha.
- Descripción en `text-secondary` 14px, `line-height: 1.5`.
- Fila de chips de presencia + stock + pre-órdenes. Cada uno es un `StatusChip` ([spec](../components/StatusChip.md)) con tono semántico: `info` para presencia (física/online), `success` para "Tiene stock", `warning` para "Acepta pre-órdenes".

Para tienda PERSON: sin logo, sin address, sin contact channels en el payload público (FR-04-21). El hero muestra icono `user` en el avatar con tint muted y omite los chips de canales.

## 5. Subcards del detalle

Componente propio `StoreSubcard` (acordeón colapsable con `.subcard`, `.subcard-toggle`, `.subcard-body`). Consumen `Eyebrow` ([spec](../components/Eyebrow.md)) como header y `SectionCard` ([spec](../components/SectionCard.md)) como contenedor base.

**Categorías e importaciones:**

- Sección "Categorías": chips `chip accent` por cada product type asignado.
- Sección "Importa desde": chips `chip neutral` por cada import country (nombre completo, no código).

**Canales de contacto** (solo BUSINESS):

- Cada canal como `.channel-row`: icono del tipo (Lucide o Simple Icon) + label + value + acción (external-link o copy). `IconButton` ([spec](../components/IconButton.md)) para la acción.
- Header del subcard muestra count de canales en `text-muted` 12px.

**Direcciones** (solo BUSINESS):

- Cada dirección como `.channel-row` con icono `map-pin` + label + address + `IconButton` de mapa.

**Reseñas:**

- Rating block prominente: número grande (38px, `font-weight:700`) + `stars` 20px + count en `text-muted`. Separado del resto por `border-bottom`.
- Formulario de reseña propia: panel con `background: color-mix(in oklch, var(--accent) 5%, transparent)` + stars interactivas + `Textarea` ([spec](../components/Textarea.md)) + `Button` primary sm "Publicar reseña".
- Lista de `ReviewRow` (componente propio): `StoreAvatar` 32px + nombre + `stars` + timestamp + texto.
- CTA ghost "Ver todas las N reseñas" al final del batch inicial (5 por defecto, +5 por acción).

## 6. Disclaimer de estado (PENDING / FLAGGED)

Banner sticky visible antes del hero cuando la tienda no está APPROVED:

- `PENDING`: tono `info`/`warning` suave — "En revisión. Visible en la app; no indexable en buscadores."
- `FLAGGED`: tono `warning` — "Tienda con reportes pendientes. Procede con precaución."

Visible solo para el creator/admins en caso PENDING. Visible para cualquier visitante en caso FLAGGED. Usa `VerifyEmailBanner` ([spec](../components/VerifyEmailBanner.md)) como patrón de referencia, adaptado al tono.

## 7. DetailSidebar por rol

Usa `DetailSidebar` ([spec](../components/DetailSidebar.md)) como contenedor. Las cards internas cambian según el contexto:

**Owner:**

- Card "Tu tienda · Resumen": pedidos anotados, pedidos activos, total facturado, calificación media, guardada por N personas. Link "Ver pedidos vinculados".
- Card "Acciones": `Button` primary "Editar tienda" + `Button` ghost "Ver reportes pendientes" con `StatusChip` warning con count.
- Card "Tu nota privada": `Textarea` autosave + timestamp del último guardado.

**Viewer autenticado (no owner):**

- Card "Resumen": pedidos del viewer en esta tienda (count, último pedido).
- Card "Acciones": "Anotar pedido aquí" (primary), "Guardar tienda" (ghost), "Reportar" (ghost, abre modal).
- Card "Tu nota privada": idéntica a owner.

**Admin:**

- Card "Gestión": count de reportes pendientes + change requests + CTAs de aprobar/rechazar/flaggear.
- Card "Acciones" (si quiere usar la tienda personalmente).

**No autenticado:**

- Card "Resumen" (datos públicos solamente).
- Card "Acciones": un solo CTA "Inicia sesión para anotar pedidos".

## 8. Variante: tienda PERSON

`#s6-store-detail-person` (Collectibles CO). Hero sin presencia física, sin canales de contacto, sin dirección. Avatar con icono `user`. El subcard "Canales de contacto" y "Direcciones" no aparecen. FRD FR-04-21 / FR-04-23.

## 9. Variante: modal de reporte

`#s6-store-detail-report-modal`: el contenido del detalle se desenfoca (opacity 0.35, `pointer-events:none`). `Modal` ([spec](../components/Modal.md)) superpuesto con `role="dialog"`.

Contenido del modal: título + subtítulo + `ReportReasonPicker` (componente propio — lista de razones con icono Lucide + label, una seleccionable a la vez) + campo "Contexto adicional" opcional (`Textarea`) + footer con "Cancelar" (ghost) y "Enviar reporte" (primary + icono send).

Razones disponibles: Info incorrecta, Posible estafa o fraude, Contenido inapropiado, Tienda duplicada.

## 10. Variante: panel reportes y sugerencias

`#s6-store-detail-reports-summary`: sección expandida dentro del flujo del detalle. Dos bloques:

1. **Reportes de la comunidad**: counts agrupados por razón. Identidades y free-text de otros users ocultos (BR-04-13). El viewer ve su propio reporte si tiene uno abierto (con CTA "Editar reporte").
2. **Solicitudes de cambio**: resumen de change requests pendientes. El viewer ve su propio change request si tiene uno abierto (con CTA "Continuar edición").

## 11. Tokens relevantes

| Elemento                | Token                                                            |
| ----------------------- | ---------------------------------------------------------------- |
| Hero surface            | `--surface-elevated`                                             |
| Hero padding            | `--space-20`                                                     |
| Subcard toggle bg       | `--surface`                                                      |
| Channel-row gap         | `--space-12`                                                     |
| Channel icon size       | 14px                                                             |
| Rating number           | `font-size:38px`, `font-weight:700`, `color:var(--text-primary)` |
| Stars accent            | `var(--accent)`                                                  |
| Stars empty             | `var(--text-muted)`                                              |
| Presence chip info      | `color-mix(in oklch, var(--info) 10%, transparent)`              |
| Stock chip success      | `color-mix(in oklch, var(--success) 12%, transparent)`           |
| Pre-orders chip warning | `color-mix(in oklch, var(--warning) 10%, transparent)`           |
| Review panel bg         | `color-mix(in oklch, var(--accent) 5%, transparent)`             |

## 12. Accesibilidad acordada

- Modal con `role="dialog"`, `aria-modal="true"`, `aria-labelledby`.
- Stars interactivas con `aria-label="Calificación"`.
- Subcards con toggle `<button>` (keyboard navigable).
- `DetailSidebar` como `<aside>` con label descriptivo.
- Disclaimer banner anunciable via `role="alert"` o `aria-live` cuando cambia.
- IconButtons de canal con `aria-label` descriptivo (p.ej. "Visitar sitio web", "Copiar email").
