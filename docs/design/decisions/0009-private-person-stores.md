---
title: ADR 0009 — Flag de visibilidad privada para Person stores
date: 2026-05-02
status: accepted
session: 06-stores-phase-a
supersedes: none
related: FR-04-33, FR-04-34, BR-04-20, BR-04-21
---

# ADR 0009 — Flag de visibilidad privada para Person stores

## Contexto

Durante la iteración visual de S6 Fase A.2 (HTML del wizard de "Sumar tienda"), surgió la necesidad de soportar tiendas tipo **PERSON** que no se publiquen en el directorio público. Casos de uso:

- Coleccionista registra a otro coleccionista con el que intercambia ocasionalmente, pero no quiere exponer ese contacto a la comunidad.
- Usuario registra una persona vendedora informal (Instagram seller, contacto WhatsApp) para llevar tracking propio sin promoverla públicamente.
- Cualquier escenario donde el viewer quiere usar la infraestructura de Stores (tracking de pedidos, pagos, entregas, notas, reseñas privadas) sin contribuir al directorio público.

El humano aprobó la propuesta visual durante la iteración. Tras detección post-cierre, se formaliza acá.

## Decisión

Se introducen **2 nuevos requirements funcionales** y **2 reglas de negocio** al FRD `frd-04-store-domain.md`:

### Requirements funcionales

- **`FR-04-33`** — Person stores soportan un flag `private` (`isPrivate: boolean`) al momento de creación. Cuando está activo, la tienda es visible solo para su creador; no aparece en listings públicos, búsquedas, ni en vistas de otros usuarios. Mantiene toda la funcionalidad de collector (orders, deliveries, reviews, notes) para su creador.
- **`FR-04-34`** — El flag de visibilidad privada **solo aplica a stores tipo `PERSON`**. Business stores siempre son públicas (no se ofrece toggle).

### Reglas de negocio

- **`BR-04-20`** — Pending stores soportan las mismas interacciones del usuario que approved stores (reseñas, anotación de pedidos/entregas, notas privadas, reportes, change requests). La única diferencia es el banner de moderación visible en la página de detalle y la ausencia de SEO indexing.
- **`BR-04-21`** — Private person stores se excluyen de TODAS las superficies públicas (listing, search, recomendaciones). Solo accesibles vía URL directa por su creador.

## Justificación

1. **Encaja con el modelo mental.** Las person stores ya son una categoría aparte (no son negocios formales). Que algunas sean privadas es una extensión natural — no todos los contactos individuales merecen visibilidad pública.
2. **Reduce fricción de creación.** Sin la opción privada, el usuario que solo quiere tracking personal evitaría crear la store o crearía una "fake business" para no exponer contactos. La flag elimina ese workaround.
3. **No afecta business stores.** Las tiendas formales siempre son públicas (BR-04-21 lo asegura), preservando el valor del directorio comunitario.
4. **Implementable sin cambios mayores al modelo.** Solo requiere un campo booleano + filtro en queries de listing/search.

## Impacto técnico

### Cambio de schema Prisma

```prisma
model Store {
  // ... campos existentes
  isPrivate Boolean @default(false)
  // ...
}
```

Migration name sugerido: `add_isPrivate_to_store`.

**Constraint de modelo:** la lógica de aplicación debe garantizar que `isPrivate = true` solo es válido cuando `type = PERSON`. Validación a nivel:

- Zod schema de creación / edición.
- Server action de creación / edición.
- (Opcional) Constraint check a nivel DB para defense-in-depth.

### Cambio de queries

- `getPublicStoresListingPage` y cualquier query similar deben agregar `where: { OR: [{ isPrivate: false }, { isPrivate: null }] }` al filtro base. Si el viewer es el owner, las private stores propias sí aparecen en sus listings personales (futuro — no MVP).
- Search público debe excluir private stores.

### Enmienda 2026-08-05: el scope de viewer deja de ser futuro, y "cualquier query similar" resultó ser mucho más que el listing

Lo que se implementó en su momento fue el filtro del listing y el 404 del detalle. El resto de superficies que devuelven tiendas nunca aplicó la regla, así que una private store quedaba **oculta para su dueño y visible para todos los demás**, que es exactamente lo contrario de lo que este ADR decidió. En concreto: `getOrderableStores` (el selector de tienda de todo el flujo de pedidos), las dos queries de match de intake, las dos de candidatos duplicados (que además devuelven `slug`, o sea la dirección de la página), y la ruta de edición, que no tenía ninguna comprobación de dueño y entregaba los canales de contacto completos a cualquier sesión.

Se corrige aplicando un único predicado compartido, `storeVisibleToViewerFilter(viewerId)`, en todas ellas, y el 404 del detalle también en `/stores/[slug]/edit`. Con eso:

- El filtro plano `isPrivate: false` pasa a ser `OR: [{ isPrivate: false }, { createdByUserId: viewerId }]`, de modo que **el dueño sí ve sus private stores en su listing**. Esto adelanta el punto que este ADR había dejado como futuro, no por ambición sino porque sin él la copy del propio producto ("Solo tú puedes verlo") es falsa en las dos direcciones.
- Un match de intake no puede resolver hacia la private store de otro usuario. El catálogo compartido sigue siéndolo; una person store privada nunca formó parte de él.

Nota deliberada sobre canales de contacto: un canal `isPublic: false` es una pista de matching que la app infirió (un teléfono leído de una captura), no un dato que la tienda publicó. No se muestra en el formulario de edición, no se reescribe al guardar y no aparece en la cola de moderación, porque la decisión de aprobar o rechazar es sobre la tienda, no sobre un número sacado de una conversación privada.

### Cambio de UI

- Wizard "Sumar tienda" paso 1 (Tipo) muestra un `<Switch>` "Perfil privado" cuando se selecciona PERSON. Helper text: "Solo tú puedes verlo. No aparece en el directorio público ni en búsquedas."
- Si el user cambia a BUSINESS después de activar el switch, el switch se oculta y el valor se descarta sin error.
- Página de detalle de una private store muestra un banner sutil "Tienda privada — solo tú la ves" cuando el viewer es el owner. Si un usuario no-owner intenta acceder vía URL directa, retorna 404 (no 403, para no exponer la existencia).

## Alternativas consideradas

### A — No agregar flag, dejar que cualquier person store sea pública

**Descartada.** Genera fricción + lleva a workarounds (fake business stores, info inventada).

### B — Soportar flag en business stores también

**Descartada.** Anula el valor del directorio comunitario para business. Si una business no quiere ser pública, no debería existir en PandaTrack.

### C — Diferir a post-MVP

Considerada pero descartada porque la mecánica es trivial (un boolean + filtro) y el costo de re-trabajo de UI futuro sería mayor que implementarlo ahora.

## Consecuencias

### Positivas

- Reduce fricción para tracking personal de contactos individuales.
- Diferencia clara person/business stores (público vs opcional-privado).
- Mantiene integridad del directorio comunitario.

### Negativas

- Suma un campo al schema → migration requerida en S6 Fase B.
- Suma complejidad de query (filtro por visibilidad).
- Edge cases de estado: cambiar BUSINESS → PERSON con isPrivate guardado, cambiar PERSON private → public, etc.

### Cobertura de edge cases en S6 Fase A

Ya están documentados en el módulo de tiendas del subproyecto (histórico):

- Switch oculto si tipo cambia a BUSINESS (valor descartado).
- Edición posterior puede cambiar visibility (con confirm si la tienda tiene reseñas públicas).
- 404 (no 403) para no-owner accediendo a private store.

## Trazabilidad

- **Origen:** S6 Fase A.2 (iteración visual del wizard).
- **Aprobación humana:** durante iteración + ratificación post-detección 2026-05-02.
- **Modificación al FRD:** `frd-04-store-domain.md` agregó FR-04-33, FR-04-34, BR-04-20, BR-04-21 + sección "Planned Enhancements".
- **Implementación:** S6 Fase B (migration + query updates + UI toggle).

## Nota meta sobre proceso

El agente de S6 Fase A modificó el FRD `frd-04-store-domain.md` directamente sin flag explícito al humano (violación leve de la regla "subproyecto no toca el modelo de datos sin escalar"). En este caso el humano ratificó la decisión post-facto, pero la regla operativa correcta es:

> **Cualquier agente del subproyecto que necesite modificar archivos fuera del subproyecto de rediseño (reglas, FRDs, blueprints, work orders, code en `src/` durante Fase A) debe flaggear el cambio en chat ANTES de aplicarlo, y esperar aprobación humana.**

Esa regla queda formalizada en la metodología del subproyecto §7.bis.bis (sub-cláusula nueva) (histórico).
