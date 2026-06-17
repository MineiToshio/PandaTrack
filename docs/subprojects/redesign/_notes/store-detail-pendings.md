---
title: Pendings — Detalle de tienda y pantallas derivadas
last_updated: 2026-05-02
status: backlog
owner: Sergio Minei
related:
  - ../decisions/0003-demo-decisions.md
  - ../_notes/demo-screens-readme.md
  - ../../product/ # cuando exista FRD de stores
---

# Pendings del Detalle de tienda y pantallas derivadas

> **Contexto.** El demo `_notes/demo-screens.html` cubre 10 pantallas. Las 6 originales del subproyecto S2 tienen wireframes lo-fi cerrados en `../screens/`. Las 4 derivadas (Lista de entregas, Lista de tiendas, **Detalle de tienda**, Sumar tienda) NO tienen wireframe formal — se construyeron en el demo a partir de [`../functional-inventory.md`](../functional-inventory.md) aplicando los componentes y tokens de las 6 que sí están cerradas. Su definición rica corresponde a S6+ (alta fidelidad) o al FRD de stores cuando exista.
>
> Este archivo registra qué falta visualmente en esas 4 pantallas para que cuando se trabajen formalmente no se pierda contexto.

---

## A. Detalle de tienda (`/[locale]/stores/[slug]`)

### A.1 Disclaimer de estado de la tienda

Hoy el demo muestra siempre `<span class="chip accent">Aprobada</span>` en el hero, sin variación. La tienda real puede estar en 4 estados (`StoreStatus` enum en `prisma/schema.prisma`):

| `StoreStatus` | Quién la ve                     | Qué disclaimer mostrar                                                                                  |
| ------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `APPROVED`    | Pública (cualquiera con la URL) | Sin disclaimer. Solo el chip "Aprobada" si decidimos mostrarlo.                                         |
| `PENDING`     | Solo el creador + admins        | Banner soft warning: "En revisión. Aparece pública cuando aprobemos."                                   |
| `REJECTED`    | Solo el creador + admins        | Banner destructive: "Rechazada. Razón: <texto>." + CTA "Editar y reenviar"                              |
| `FLAGGED`     | Pública pero con badge          | Banner warning: "Con reportes pendientes. Atención al confirmar pedidos." + link a "Ver detalles" admin |

**Decisión pendiente:** ¿el chip de estado va en el hero (al lado del rating) o como banner sticky en la parte superior? Mi recomendación: banner sticky para PENDING / REJECTED / FLAGGED (información crítica), chip "Aprobada" en hero opcional (no agrega valor para el viewer en estado normal).

**Componente core S4:** `<StoreStatusBanner status="..." reason="..." />`.

### A.2 Lista de países "envía a 12 países"

Hoy el demo muestra `<span class="chip info"><i data-lucide="send"></i> Envía a 12 países</span>` sin la lista. La lista real viene de `StoreImportCountry[]` (relación M:N con `Country`).

**Pendiente:**

- Click/hover en el chip "Envía a 12 países" debe revelar la lista (popover en desktop, sheet en mobile).
- Lista presentada como chips con bandera + código país (CO, MX, JP, US, etc.).
- Si el viewer está en un país NO incluido, mostrar advertencia "Esta tienda no envía a tu país" como sub-chip warning.
- Filtro automático en el listado público (`/stores`) si el user filtró por "Envía a CO".

**Esquema actual (`prisma/schema.prisma`):**

```prisma
model StoreImportCountry {
  storeId   String
  countryId String
  store     Store   @relation(...)
  country   Country @relation(...)
}
```

### A.3 Países de importación / origen

**Importante:** "Envía a" e "importa de" son distintos.

- **Envía a:** países a los que la tienda manda pedidos (relevante para el viewer).
- **Importa de:** países desde donde la tienda compra/distribuye (relevante para curaduría — "esta tienda trae cosas directamente de Japón").

Hoy el demo no diferencia. Cuando se diseñe el detalle real, debe mostrar ambos:

```
Envía a · CO · MX · CL · US · ... (12)
Importa de · JP · KR · CN
```

**Decisión pendiente:** ¿"Importa de" se muestra siempre o solo si la tienda lo declara? Mi recomendación: solo si declara, como info enriquecida bajo el subtítulo de identidad.

**Esquema:** no parece existir `StoreOriginCountry` o similar en el schema actual. Si se decide implementar, requiere:

1. Nuevo modelo `StoreOriginCountry` (paralelo a `StoreImportCountry`).
2. Campo en `/stores/new` y `/stores/[slug]/edit`.
3. FRD de stores que defina la diferencia conceptual.

**Esto es Decisión categoría E (modelo de datos) — escalar antes de implementar.**

### A.4 Reportes públicos vs admin

Hoy el demo solo tiene un botón "Reportar tienda" en el sidebar. La estructura completa según `prisma/schema.prisma`:

- `StoreReport` — reportes individuales del user.
- `StoreReportReason` — enum: `INACCURATE_INFO`, `SCAM`, `INAPPROPRIATE`, etc.
- `StoreReportStatus` — enum: `PENDING`, `RESOLVED`, `DISMISSED`.

**Pendiente:**

- **Viewer normal:** botón "Reportar" + flow modal de reporte (ya en sidebar Acciones).
- **Admin:** sub-card adicional "Gestión" con count de reportes pendientes + link a queue de moderación. Solo visible si el viewer es admin.
- **Owner de la tienda:** ¿puede ver count de reportes contra su propia tienda? Decisión de producto.

### A.5 Sub-card de productos / catálogo

Hoy el demo muestra "Categorías" como chips simples. Si la tienda mantiene catálogo (tabla `Product` o similar — no parece existir aún), debería haber una sub-card adicional "Productos disponibles" con grid o lista compacta.

**Decisión categoría E** — depende de si decidimos modelar catálogo. Hoy el dominio es "el coleccionista anota qué pidió a la tienda", no "la tienda lista qué tiene". Probablemente sin catálogo formal en MVP.

### A.6 Diferencias UI: "tu tienda" (owner) vs "tienda pública" (viewer)

El detalle de tienda se renderiza con 3 contextos posibles:

- **Viewer no autenticado:** ve identidad pública + reseñas. NO ve "Tus pedidos aquí" ni "Tu nota privada" ni "Acciones" salvo "Iniciar sesión para anotar pedido".
- **Viewer autenticado (no owner):** ve todo lo del demo actual.
- **Owner de la tienda:** ve `Editar tienda` en Acciones (CTA primary), ve count de reportes pendientes, ve métricas internas (cuántos pedidos se han anotado a esta tienda, etc.).
- **Admin:** ve botones de gestión (aprobar / rechazar / flag) + queue de reportes.

**Pendiente:** decidir cómo se muestra la diferencia. Mi recomendación: usar el sidebar con cards condicionales por rol.

```
Sidebar viewer no autenticado:
  - Resumen (público)
  - Acciones [Iniciar sesión]

Sidebar viewer autenticado:
  - Resumen (tus pedidos)
  - Acciones [Anotar pedido aquí, Guardar, Reportar]
  - Tu nota privada

Sidebar owner:
  - Resumen (métricas internas)
  - Acciones [Editar tienda, Ver reportes]
  - Gestión (count reportes pendientes)

Sidebar admin:
  - Resumen (público)
  - Gestión (aprobar / rechazar / flag / ver reportes)
  - Acciones [Anotar pedido aquí (si quiere), Guardar]
```

---

## B. Lista de tiendas (`/[locale]/stores`)

### B.1 Filtros faltantes

Hoy el filter drawer de Tiendas tiene: Categorías, Presencia, País, Switches (Recibe pre-órdenes / Tiene stock / Envía a CO).

**Pendiente:**

- Filtro "Importa de" (cuando se modele).
- Filtro "Estado" para admin (PENDING / APPROVED / REJECTED / FLAGGED).
- Ordenamiento (Más recientes / Mejor calificadas / Más pedidos / Cercanas a tu país).

### B.2 Card de tienda — info que falta

Hoy las cards muestran: avatar, nombre, país, presencia, 2 categorías, rating, reseñas, tus pedidos.

**Pendiente:**

- Indicador visual si la tienda envía a tu país (ej. icono globe verde si sí, gris si no).
- Indicador "Recibe pre-órdenes" como pequeño badge en la card (no solo en filtro).
- Si admin: badge de estado (PENDING / FLAGGED) visible en la card de la lista.

---

## C. Sumar tienda (`/[locale]/stores/new`)

### C.1 Detección de duplicados

Según `functional-inventory.md` fila #22: "detectar duplicados (onBlur de name) y modal de confirmación al submit".

**Pendiente:**

- Implementar el patrón en el demo: al blur del campo "Nombre" en paso 2, búsqueda fuzzy contra tiendas existentes; si match >70%, mostrar inline helper "Hey, hay X tiendas parecidas. ¿Es alguna?" con preview.
- Modal de confirmación al submit si el match persiste.

### C.2 Estado inicial post-submit

El demo muestra "Estado: Pendiente" en el sidebar Resumen. Después del submit real:

- Para users normales: tienda queda en `PENDING`, redirect a `/stores/[slug]?status=pending` con disclaimer "Tu tienda está en revisión".
- Para admin: tienda queda en `APPROVED` directo, redirect normal.
- Si returnTo es `order-create`, redirect a `/orders/new?store=<slug>` (deep link).

**Pendiente en demo:** flujo post-submit no está representado. Solo el form de creación.

---

## D. Lista de entregas (`/[locale]/deliveries`)

### D.1 Detalle de entrega faltante

Click en row de entrega NO navega a ningún detalle (no existe). Cuando se diseñe `/[locale]/deliveries/[id]` debe seguir las decisiones del ADR 0003:

- Sidebar derecha consistente: Resumen / Acciones / Tu nota privada.
- Header con breadcrumbs Inicio › Entregas › PT-DEL-XXXX.
- Cuerpo principal: hero (avatar tienda + código mono + chip status) + sub-cards (Productos por pedido origen, Costo + envío, Historial, Nota? — NO, va al sidebar).

### D.2 Filtros faltantes

El demo tiene: Estado, Solo atrasadas, Tienda, Rango fechas (entrega + ETA). Pendiente:

- Filtro por categoría de productos contenidos (relevante: "solo entregas que tienen vinyl").
- Ordenamiento (Más recientes / Llegada más cercana / Más atrasadas).

---

## E. Cuando se trabaje cada pantalla — checklist

Antes de promover cualquiera de estas 4 pantallas a wireframe oficial o implementación real:

1. ✅ Confirmar que existe FRD relevante en `docs/product/` o decidir abrir uno.
2. ✅ Cruzar este doc contra ese FRD — qué cubre, qué falta.
3. ✅ Resolver cualquier ambigüedad de modelo de datos (Decisión categoría E) con el equipo.
4. ✅ Aplicar las **8 decisiones del ADR 0003** (Velvet, sidebar shell, header con breadcrumbs, sidebar derecha consistente Resumen/Acciones/Nota, etc.).
5. ✅ Aplicar el **mapeo de chips del ADR 0002** para cualquier estado renderizado.
6. ✅ Verificar consistencia visual con las pantallas de detalle ya cerradas (Detalle de pedido como referencia).
7. ✅ Pasar por red team (estilo `_notes/s2-red-team.md`) antes de cerrar.

---

## F. Notas sueltas que aparecieron en feedback humano

- "Detalle de pedido y detalle de tienda no deben parecer aplicaciones diferentes." → Aplicado vía Decisión 7 ADR 0003.
- "El que más me gusta es Velvet." → Aplicado vía Decisión 1 ADR 0003.
- "No me gusta el modo sistema en el theme toggle." → Aplicado vía Decisión 2 ADR 0003.
- "El botón de colapsar al lado del breadcrumb sobra." → Aplicado: solo vive en sidebar footer.
- "El hover-expand del sidebar se ve horrible cuando flota." → Aplicado: cambiado a modo PUSH.
- "La nota no debe ser paso del wizard, va al detalle." → Aplicado vía Decisión 6 ADR 0003.
- "El producto en la columna de pedidos no agrega valor, mejor cantidad." → Aplicado.
- "Estados como 'Activo' o 'Aún no llega' no tienen sentido." → Aplicado vía ADR 0002.
