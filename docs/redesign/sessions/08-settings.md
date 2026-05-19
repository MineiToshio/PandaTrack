---
title: Sesión 08 — Módulo Settings (Fase A — demo + specs + color uplift)
date: 2026-05-18
status: ✅ done (A.1 + A.2 + uplift visual)
type: Módulo Fase A
---

## Qué corrió

S8 Fase A construyó el módulo lite **Settings**: 1 ruta (`/settings`) con 3 paneles (Perfil / Cuenta / Preferencias), 7 modales desktop, 7 sheets mobile y refactor del `#settings` original. El demo HTML, los specs maestros y el patrón visual cross-module **Chip Eyebrow + Top-Accent** quedaron cerrados en una sola sesión continua.

## Entregables

### Demo HTML — 17 anchors nuevos + #settings refactoreado

`docs/redesign/_notes/demo-screens.html`:

- **Desktop (3):** `#settings` (refactor), `#s8-settings-desktop-account`, `#s8-settings-desktop-preferences`.
- **Modales desktop (7):** `username`, `displayname`, `avatar`, `avatar-remove`, `email`, `password`, `currency`.
- **Mobile (7):** `profile-mobile`, `account-mobile`, `preferences-mobile`, `username-sheet-mobile`, `displayname-sheet-mobile`, `avatar-sheet-mobile`, `currency-sheet-mobile`.

Todos navegables vía dropdown `S8 · Ajustes` del demo navbar y vía hash directo.

### Specs

| Doc                                 | Estado          |
| ----------------------------------- | --------------- |
| `docs/redesign/screens/settings.md` | spec-complete   |
| `docs/redesign/modules/settings.md` | spec-complete   |
| `docs/redesign/PLAYBOOK.md §9.17`   | patrón canónico |

### Patrón visual nuevo (cross-module)

**Chip Eyebrow + Top-Accent border** — par visual coordinado por tono semántico:

- Eyebrow se renderiza como pill tintada (`color-mix` del token 9–14%) con ícono lucide leading.
- La card lleva `border-top: 2px solid color-mix(token 55%)` con el mismo token.
- Tonos: `accent` / `cool` / `warm` / `success` / `warning` / `destructive`.
- **Vocabulario cross-module congelado** — labels recurrentes (`Acciones`, `Tu nota privada`, `Reseñas`, `Productos`, `Historial`, `Pagos`, `Tu pedido · {curr}`, `Categorías`, `Canales de contacto`, `Direcciones`) tienen tono+ícono fijo en todo el redesign.

Implementación: clases CSS `s8-eyebrow-chip`, `s8-card-accent/cool/warm/success/warning/destructive` (extensión a state tonals: `success`, `warning`, `destructive` agregada en Fase B).

El patrón nació en Settings y se extendió a `order-detail` (×4 variantes) y `store-detail` (×3 variantes) en S8 Fase B uplift.

### Otros uplifts visuales S8

- **`s8-avatar-hero`** — avatar fallback de letra inicial con `linear-gradient(135deg, --accent → --accent-warm)` + glow shadow. Aplica en pane Perfil desktop, perfil mobile, sheet de avatar.
- **`s8-cooldown-chip`** — pill warning tint + ícono `clock-3` para FR-07-33 cooldown. Reemplaza texto muted plano en pane Perfil + modal + sheet.
- **`s8-modal-icon-gradient`** — radial gradient `color-mix` sobre todos los `m01b-icon-circle` de S8.

## Decisiones aprobadas

| Decisión                                               | Detalle                                                                                                   |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| ADR 0001 D15 vigente                                   | Tabs verticales 220px en desktop, override de BR-07-01 "sections not tabs"                                |
| Segmented control mobile                               | Patrón nuevo en S8: 3 botones sticky bajo topbar, oculto ≥ 1024px                                         |
| FR-07-32 two-path                                      | Modal/sheet currency: "Guardar y actualizar tipos de cambio" (primary) + "Guardar sin actualizar" (ghost) |
| FR-07-33 cooldown chip vivo                            | 7 días entre cambios; chip visible solo durante cooldown activo (ADR 0001 D18)                            |
| Card "Apariencia" → "Interfaz"                         | Rename + ícono `palette` → `monitor`. Scope ampliado a tema + idioma                                      |
| Densidad de listas → **deferred**                      | FR-07-31 removido del scope S8. Recuperar en S9+ si emerge necesidad                                      |
| Sesiones activas → **deferred**                        | FR-07-40 removido del pane Cuenta. Capability BetterAuth sigue activa pero sin UX dedicada                |
| Idioma promovido a control visible                     | FR-07-23 deja de ser preferencia silente; segmented Español / English en card Interfaz                    |
| Patrón Chip Eyebrow + Top-Accent canónico cross-module | PLAYBOOK §9.17                                                                                            |
| Avatar gradient `s8-avatar-hero`                       | Componente reutilizable s40 / s56 / s72                                                                   |

## Bugs encontrados durante la sesión (todos resueltos)

1. **IDs mobile con `-mobile-` en el medio** — selector CSS `section[id$="-mobile"]` no matcheaba. Renombré los 7 anchors a `s8-settings-{tab}-mobile`. Cubre L070.
2. **`showScreen` con NodeList stale** — `screens` capturado en script-time no incluía las secciones S8 (parseadas después del `<script>`). Fix: query dentro de `showScreen`. → Nueva lección **L073**.
3. **Secciones S8 fuera de `<main>`** — pegadas al final del body después de filter-drawer, panda-bubble y script. Renderizaban al final del documento con espacio en blanco arriba; íconos lucide saltaban después del paint inicial. Fix: mover bloque dentro de `<main>` con script Python. → Nueva lección **L072**.
4. **`@media (min-width: 768px)` desktop grid leaking en phone frame** — `settings-row` aplicaba grid `180px 1fr auto` dentro del frame de 390px. Fix: override `section[id$="-mobile"].is-active .settings-row { grid-template-columns: 1fr !important }`. Cubre L066.
5. **Currency icon-circle dim en algunos modales** — los `<i data-lucide>` se reemplazan por `<svg>` después del paint, causando flicker. Mitigado al mover S8 dentro de `<main>` (lucide procesa antes del primer paint visible).
6. **"Figures" en lugar de "Figuras"** — copy fix en 2 spots de S8.

## Lessons learned agregadas

- **L072** — Secciones `.screen` fuera de `<main>` se renderizan al final del documento.
- **L073** — `querySelectorAll` capturado en script-time pierde elementos del DOM posteriores al script.

## Iteraciones humano-AI relevantes

- **Densidad y Sesiones activas removidas** — pedido humano post-A.2 review. Razonamiento: ambas son features sin uso validado; el coleccionista MVP no las pide explícitamente y las pantallas se sienten más limpias sin ellas. Documentado como "deferred" en `modules/settings.md §Fuera de scope`.
- **Estandarización del top-border cross-card** — pedido humano: "por que solo las secciones del tab de preferencias tiene un border top de colores? Hay que estandarizar todo." Resolución: aplicar el patrón a Perfil (`accent`) y Cuenta (`cool`) también. Esto cristalizó el patrón como cross-module y motivó §9.17 del PLAYBOOK.
- **Idioma agregado al card Interfaz** — humano pidió promover el toggle a control visible (FR-07-23 dejó de ser silente).
- **Color uplift segunda pasada** — humano notó pantallas "muy planas". Investigación de tokens disponibles (`--accent`, `--accent-warm`, `--accent-cool`) llevó a crear `s8-avatar-hero` (gradient), `s8-cooldown-chip`, `s8-modal-icon-gradient`. Sin inventar colores nuevos.
- **Extensión cross-module aprobada** — humano pidió evaluar si el patrón S8 aplicaba en `order-detail`/`store-detail`. Auditoría manual identificó 7 pantallas ganadoras (4 order-detail variants + 3 store-detail variants), 5 zonas anti-pattern (lists, wizard step cards, modales, filter drawer interno, sidebar sticky de wizards). El otro agente ejecutó la extensión en Fase B uplift.

## Mini-sesiones / cross-cutting abiertas

Ninguna bloqueante. Propuestas para FRD-07 alignment (P-S8-01 a P-S8-08) listadas en `modules/settings.md §Propuestas pendientes`. Se procesan en sesión dedicada de actualización de docs/product.

## Prerequisitos cerrados / pendientes para Fase B

- ✅ Demo aprobado visualmente por humano.
- ✅ Specs `screens/settings.md` y `modules/settings.md` con scope final.
- ✅ Patrón Chip Eyebrow + Top-Accent en PLAYBOOK §9.17.
- ⏳ FRD-07 alignment (propuestas P-S8-01 a P-S8-08 abiertas para sesión próxima).
- ⏳ Avatar cropper UX detallado (P-S8-07).
- ⏳ Mascot toggle ubicación final (P-S8-05).

## Validación

Todos los HTMLs verificados visualmente en preview server (Claude Preview MCP, port 5500) — light y dark theme, viewports desktop (1440px) y phone frame simulado (390px).

Sin código React tocado en esta sesión. Fase B implementación de Settings + uplift cross-module quedó para sesión separada.
