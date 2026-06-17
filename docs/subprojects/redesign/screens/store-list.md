---
title: Store list
session: 06
status: html-approved
last_updated: 2026-05-03
demo_anchors:
  - "#s6-stores-list-loading"
  - "#s6-stores-list-default"
  - "#s6-stores-list-empty"
  - "#s6-stores-list-filters-open"
frd: docs/product/prd-01-collector-mvp/frd-04-store-domain/frd-04-store-domain.md
---

# Store list

> **Fuente visual de verdad:** `docs/redesign/_notes/demo-screens.html`. Los cuatro anchors arriba son la referencia canónica. Este spec describe el contrato funcional + tokens + componentes consumidos. Cualquier implementación debe ser reconocible como descendiente del demo.

## 1. Propósito y contrato funcional

Directorio público de tiendas (`/[locale]/stores`). Permite a coleccionistas descubrir, buscar y filtrar tiendas por nombre, país, categorías, importaciones, presencia y flags de stock/pre-órdenes. Cualquier usuario autenticado puede iniciar la creación de una tienda nueva desde esta pantalla.

Datos clave: lista paginada de `Store` (nombre, slug, tipo BUSINESS/PERSON, país, presencia, product types, import countries, rating, review count, pedidos del viewer). Permisos: pública para cualquier visitante autenticado; la búsqueda por nombre y los filtros son URL-driven (estado en query params).

## 2. Variantes y anchors del demo

| Anchor                         | Descripción                             | Condición                      |
| ------------------------------ | --------------------------------------- | ------------------------------ |
| `#s6-stores-list-loading`      | Skeleton grid (6 cards pulsantes)       | SSR en curso / primer carga    |
| `#s6-stores-list-default`      | Lista poblada, sin filtros activos      | Estado normal                  |
| `#s6-stores-list-empty`        | Sin resultados con filtros activos      | `totalCount === 0` con filtros |
| `#s6-stores-list-filters-open` | FilterDrawer superpuesto (right drawer) | Usuario pulsó "Filtrar"        |

## 3. Layout y estructura

Vive dentro del `AppShell` ([spec](../components/AppShell.md)) con `Sidebar` izquierda ([spec](../components/Sidebar.md)). En mobile la navegación primaria está en el drawer del topbar (burger button).

**Topbar:** título "Tiendas" + contador de resultados (`47 tiendas`) justificado a la derecha. Usa `Header` ([spec](../components/Header.md)) como contenedor.

**Hero section:** eyebrow mono `DIRECTORIO` + display title `Dónde comprar` (28px, tabular Atelier) + subtítulo en `text-secondary`. El eyebrow usa la clase `.eyebrow` del sistema.

**Toolbar:** fila horizontal con buscador por nombre (icono search + `Input` deshabilitado en loading), botón `Filtrar` (ghost + icono `sliders-horizontal`), select `Ordenar por` (`Select` con opciones: Mejor calificadas / Alfabético A–Z / Más recientes), y CTA `Nueva tienda` (primary + icono `plus`). Usa `Button` ([spec](../components/Button.md)) e `Input` ([spec](../components/Input.md)).

**Grid de cards:** CSS grid responsivo. 1 columna en mobile (<640px) → 2 columnas (640px–1024px) → 3 columnas (>1024px). Cada cell es una `StoreCard` (componente propio del módulo — ver módulo stores.md §Componentes propios).

**Footer de paginación:** mobile usa botón "Cargar más" ghost; desktop usa `Pagination` ([spec](../components/Pagination.md)) numérica con flechas primera/anterior/siguiente/última.

## 4. Variante: loading (skeletons)

`aria-busy="true"` en el grid container. Seis `skeleton-card` con `aria-hidden="true"`. Cada skeleton replica la estructura de una StoreCard: sk-head (avatar + dos líneas), sk-chips (2 rows de chips), sk-stats. Toolbar con `Input` y botones deshabilitados para evitar interacción durante carga.

Tokens: `--border-radius-card`, `--border`, gradiente pulsante sobre `--surface-elevated`.

## 5. Variante: lista poblada

Seis stores dummy en el demo con datos realistas: Akiba Records (JP, Vinyl + Anime), Mandarake (JP, Manga + Figures), Pop Mart Bogotá (CO, Figures + Plush), Kokoro Shop (ES, Manga + Anime), Collectibles CO (CO, Figures + Cards, tipo PERSON), HMV Japan (JP, Vinyl + Anime, PENDING sin importaciones declaradas).

La `StoreCard` muestra:

- `StoreAvatar` ([spec](../components/StoreAvatar.md)) 56px: inicial del nombre con tint accent (BUSINESS) o icono user con tint muted (PERSON).
- Nombre con icono tipo inline (store 12px para BUSINESS, user 12px para PERSON en `text-muted`).
- Meta: icono map-pin + ciudad + código país.
- Chips de categorías en `chip accent` + chips "+N más" en `chip neutral`.
- Fila "Importa de" en `text-muted` 12px: label bold 11px + países en texto natural que envuelve si es necesario.
- Fila stats: rating numérico (bold) + count reseñas / pedidos del viewer / estrellas (`stars` class).

## 6. Variante: vacío con filtros activos

Usa `EmptyState` ([spec](../components/EmptyState.md)) con `MascotBubble` ([spec](../components/MascotBubble.md)) en variante `sleeping`. Copy: "Sin resultados" + subtítulo sugeriendo aflojar filtros + CTA ghost "Limpiar filtros". La toolbar permanece activa para que el usuario pueda ajustar.

## 7. Variante: FilterDrawer abierto

`FilterDrawer` ([spec](../components/FilterDrawer.md)) superpuesto sobre el contenido (que se desenfoca a 35% opacity, `pointer-events:none`). El drawer aparece como panel derecho en desktop y como `Sheet` ([spec](../components/Sheet.md)) desde el borde derecho en mobile.

Secciones del drawer (en orden):

1. **Categorías que vende** — pills multi-select (Figures, Vinyl, Manga, Anime, Cards, Plush). OR dentro de la familia.
2. **Presencia** — pills: Tienda física / Tienda online.
3. **País de la tienda** — searchbox inline + pills de país.
4. **Importa desde** — searchbox inline + pills de país de importación.
5. **Otros** — tres `Switch` ([spec](../components/Switch.md)): Recibe pre-órdenes / Tiene stock / Envía a [país del viewer].

Footer del drawer: botón ghost "Limpiar" + botón primary "Aplicar" (flex: 1). Usa `Button` ([spec](../components/Button.md)).

Lógica: OR dentro de familia, AND entre familias (FR-04-14, FR-04-15).

## 8. Tokens relevantes

| Elemento       | Token                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------- |
| Grid gap       | `--space-16`                                                                                 |
| Card surface   | `--surface-elevated`                                                                         |
| Card radius    | `--radius-xl` (12px)                                                                         |
| Chip accent    | `color-mix(in oklch, var(--accent) 10%, transparent)` + border `22%`                         |
| Stars color    | `var(--accent)`                                                                              |
| Eyebrow        | `var(--text-muted)`, `font-size:11px`, `letter-spacing:0.06em`, `font-weight:600`, uppercase |
| Skeleton pulse | `var(--border)` → `var(--surface-elevated)`                                                  |
| Text muted     | `var(--text-muted)`                                                                          |

## 9. Accesibilidad acordada

- Grid con `aria-busy` + `aria-label` durante loading.
- Skeleton cards con `aria-hidden="true"`.
- FilterDrawer con `role="dialog"`, `aria-modal="true"`, `aria-label="Filtrar tiendas"`.
- Switch buttons con `aria-pressed` + `aria-label` descriptivo.
- Store cards como `<a>` (elementos ancla) con href al detalle.
- Contador de resultados en topbar para lectores de pantalla.
