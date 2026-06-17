---
title: FRD ↔ Rediseño Delta Audit — FRD-07 User Settings
last_updated: 2026-06-13
scope: FRD-07 (PRD-01 Collector MVP) + BP-01 User Settings, Identity and Preferences
trigger: cierre de S8 (Fase A demo/specs 2026-05-18 + Fase B implementación 2026-06-12)
status: audit + FRD-07 sincronizado en el mismo cambio (ver §6)
owner: Sergio Minei
---

# FRD ↔ Rediseño Delta Audit — FRD-07

Complementa el [Round 1](./frd-redesign-delta-round-1.md), que dejó FRD-07 **out_of_scope ("S8 Fase B en curso — Round 2")**. S8 cerró por completo el 2026-06-12 (Fase A demo 17 anchors + specs; Fase B módulo React/Next con `SettingsShell` + 3 panes + 7 modales adaptive + `ImageCropper` compartido, `e2e/settings.spec.ts` 3/3 ✅). Este doc audita el FRD-07 contra lo realmente shipeado y registra los cambios aplicados al FRD en el mismo paquete.

Contexto de origen: `docs/redesign/modules/settings.md` (propuestas P-S8-01..08 resueltas) + `sessions/08-settings.md`.

## Resumen ejecutivo

- **Conclusión:** alineamiento alto en el contrato funcional, pero con **una corrección de numeración importante** (ver §0). La implementación se construyó desde el FRD-07; las preferencias persistidas (FR-07-20..27, 34) se cumplen sin reescritura. Los deltas reales son pocos: refinamientos de comportamiento (two-path currency, cooldown vivo), controles de presentación nuevos en la pantalla (tema + idioma) que **no son preferencias persistidas**, y dos scope-outs.
- **Total deltas: 10** — funcional = 1 · comportamiento = 2 · patrón nuevo = 3 · scope-out = 2 · numeración = 1 · estado = 1.
- **Acción tomada:** FRD-07 sincronizado en este mismo cambio (`implementation_status` → `IMPLEMENTED`, `last_updated`, Current State real, notas a FR-07-32/33, Implementation Note de tema+idioma, 2 entradas en Out of Scope). El resto (patrones visuales §9.17, segmented control) vive en `docs/redesign` y no entra al FRD.
- **Decisión humana 2026-06-13:** densidad + sesiones activas → registradas en **Out of Scope** del FRD-07 (Q1); tema + idioma → **Implementation Note** sin FRs nuevos (Q2).

## Convenciones

Mismas categorías que Round 1 + FRD-08: **visual**, **comportamiento**, **funcional**, **datos**, **patrón nuevo**, **scope-out** (capability considerada y diferida), **defecto conocido**. Se añade **numeración** (desalineación de IDs entre docs) y **estado** (cambio de `implementation_status`).

## §0 — Corrección de numeración (meta-delta crítico) — D7-00

El doc del rediseño `modules/settings.md` (last_updated 2026-05-18) numeró los FRs del FRD-07 **de memoria / contra un draft**, y varios IDs **no coinciden** con el FRD-07 canónico (`frd-07-user-settings.md`, last_updated 2026-04-14, source of truth por AGENTS.md §2). Verificado contra el doc, `prisma/schema.prisma` y el código shipeado:

| `modules/settings.md` dice   | FRD-07 canónico real                                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| FR-07-20 = país              | **FR-07-20 = base currency** (país es FR-07-21)                                                          |
| FR-07-21 = currency          | **FR-07-21 = preferred country**                                                                         |
| FR-07-23 = idioma            | **FR-07-23 = copy de product types** ("What types of products do you collect?"). No existe FR de idioma. |
| FR-07-30 = tema              | **FR-07-30 = tres secciones Profile/Account/Preferences**                                                |
| FR-07-31 = densidad          | **FR-07-31 = notificación de seguridad por email** (FR real y shipeado)                                  |
| FR-07-40 = sesiones activas  | **No existe** — el FRD-07 termina en FR-07-34                                                            |
| FR-07-32 = currency two-path | ✅ coincide (confirmación de moneda + bulk update por par)                                               |
| FR-07-33 = username cooldown | ✅ coincide (rate-limit 7 días)                                                                          |

**Implicación:** la instrucción original "marcar FR-07-31/40 como deferred" se apoyaba en una premisa falsa — hacerlo literalmente **corrompería FR-07-31** (notificación de seguridad real) e **inventaría un FR-07-40 inexistente**. La sincronización del FRD se hizo mapeando **por semántica**, no por número. La numeración del rediseño se considera no confiable; la del FRD-07 canónico es la autoritativa. `modules/settings.md` además apunta a un path incorrecto en su frontmatter (`frd-07-user-account-settings/...`); el real es `frd-07-user-settings/`.

## Deltas detectados

| ID    | FR/BR canónico            | Cambio                                                                                                                                                                                                                                                                                                                      | Categoría      | Origen                | Resolución                                                                                                                                                                                                                                                  |
| ----- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D7-01 | (todo el FRD)             | **`implementation_status: IN_PROGRESS → IMPLEMENTED`.** S8 Fase B shipeó el vertical completo: `SettingsShell` + `SettingsNav` (tabs desktop + segmented mobile) + 3 panes + 7 modales adaptive + 11 server actions. WO-05 (preferencias) implementado.                                                                     | estado         | S8 Fase B             | ✅ status + last_updated actualizados. Current State reescrita.                                                                                                                                                                                             |
| D7-02 | FR-07-32 / AC-07-12       | **Two-path currency (P-S8-01).** El FRD ya describe "bulk update by currency pair / skip and reconcile manually later". La implementación lo materializa con footer de dos acciones: "Guardar y actualizar tipos de cambio" (Path A = bulk) vs "Guardar sin actualizar" (Path B = skip). Es refinamiento, no contradicción. | comportamiento | S8 Fase A/B           | ✅ nota agregada a FR-07-32 (server action `updateCurrency({ saveFxRates })`). Sin cambio de semántica.                                                                                                                                                     |
| D7-03 | FR-07-33 / FR-07-08       | **Cooldown de username vivo (P-S8 / FR-07-33).** El FRD fija el rate-limit de 7 días. La implementación lo comunica con `<CooldownChip>` vivo (chip warning con cuenta regresiva en días + fecha exacta) que **desaparece** al expirar (ADR 0001 D18) y deshabilita el submit mientras esté activo.                         | comportamiento | S8 Fase A/B           | redesign-owned (presentación). Nota agregada a FR-07-33 referenciando el patrón. Cumple el FR.                                                                                                                                                              |
| D7-04 | (sin FR — presentación)   | **Tema (light/dark) + idioma (es/en) surfaced en la card "Interfaz".** NO son preferencias persistidas: tema = `ThemeContext` (cliente, sin `system` por ADR 0003), idioma = cookie `NEXT_LOCALE` (`updateLanguageAction`, sin campo `preferredLanguageCode`). Espejados del header del app shell (FRD-03).                 | patrón nuevo   | S8 Fase A/B, ADR 0003 | ✅ **Implementation Note** agregada al FRD-07 (decisión Q2 2026-06-13). Sin FRs nuevos — se evita implicar persistencia inexistente. Cross-ref FRD-03.                                                                                                      |
| D7-05 | FR-07-31..40 (numeración) | **"Densidad de listas" diferida (P-S8-03).** Nunca fue FR canónico (FR-07-31 real = notificación de seguridad). Se registra como capability considerada y descartada.                                                                                                                                                       | scope-out      | S8 Fase A (decisión)  | ✅ agregada a **Out of Scope** del FRD-07 (decisión Q1 2026-06-13): "list-density preference (deferred)". No se toca ningún FR real.                                                                                                                        |
| D7-06 | (sin FR canónico)         | **"Sesiones activas visibles / Cerrar otras sesiones" diferida (P-S8-04).** Nunca fue FR canónico (no existe FR-07-40). La capability sigue en BetterAuth; sin UX dedicada en MVP.                                                                                                                                          | scope-out      | S8 Fase A (decisión)  | ✅ agregada a **Out of Scope** del FRD-07 (decisión Q1 2026-06-13): "active-session management UI (deferred)".                                                                                                                                              |
| D7-07 | FR-07-10 / Notes          | **`<ImageCropper>` extraído a `src/components/modules/` (P-S8-07).** El FRD pedía "reuse the store-logo crop-and-confirm pattern". La implementación promovió el cropper a componente compartido (avatar circular / logo rectangular). Cumple y mejora el FR.                                                               | patrón nuevo   | S8 Fase B             | redesign-owned. Nota en Implementation Notes del FRD (reuse → componente compartido). PLAYBOOK / lessons.                                                                                                                                                   |
| D7-08 | (sin FR)                  | **Patrón visual Chip Eyebrow + Top-Accent (§9.17).** Nacido en Settings, extendido a order-detail / store-detail. Tonos por card: Perfil=accent, Cuenta/Interfaz=cool, Coleccionista=warm.                                                                                                                                  | patrón nuevo   | S8 (origen), M07      | redesign-owned (PLAYBOOK §9.17). No entra al FRD.                                                                                                                                                                                                           |
| D7-09 | BR-07-01 / FR-07-30       | **Rename "Apariencia"→"Interfaz" + tabs verticales desktop / segmented mobile.** BR-07-01 decía "sections not tabs"; ADR 0001 D15 aprobó tabs verticales (220px) como override. El FRD mantiene "one page, tres secciones" (FR-07-30) — sigue siendo un solo route. El segmented control mobile es navegación intra-página. | funcional      | ADR 0001 D15, S8      | ⚠️ Conflicto visual con BR-07-01 (tabs vs sections). Per README §"rediseño vs FRD" punto 1 (visual/componente): rediseño gana, nota al FRD. Una sola ruta `/settings` se mantiene (no viola FR-07-30 ni el espíritu de BR-07-01). Nota agregada a BR-07-01. |
| D7-10 | FR-07-28 / WO-06          | **FR-07-28 (prefill de `/stores` con país + product types guardados) NO está shipeado.** El link de nav es estático `/${locale}/stores`; la página de stores lee filtros solo de la URL (`searchParams`), sin builder basado en preferencias ni redirect. WO-05 (persistencia de prefs) sí; WO-06 (consumidor) no.          | estado         | verificado 2026-06-13 | 🟡 **WO-06 permanece en Planned** en el FRD-07. No se marca como implementado (sin inventar scope). Candidato a sesión futura o a confirmar como diferido.                                                                                                  |

## Desviaciones demo → implementación (no son deltas de FRD)

Registradas en `sessions/08-settings.md`: autosave indicator de preferencias con tope de 60s, `SegmentedToggle` reutilizado para tema/idioma, 4 componentes legacy de settings eliminados, categorías favoritas traducidas vía `storeProductTypes`, password rules + strength meter inline (P-S8-08). Ninguna contradice el FRD. Theme con solo `light`/`dark` (sin `system`) por ADR 0003 — el demo S2/S8 mencionaba `system`, descartado.

## FR/BR sin delta (cumplidos tal cual)

FR-07-01..19 (shell identity, username/displayName/avatar, email/password flows) y FR-07-20..27, 34 (preferencias persistidas) se implementaron sin desviación funcional. BR-07-02..18 sin cambios. Verificación notable: **FR-07-32 ya contemplaba ambos caminos** de la moneda; el rediseño solo le dio forma de footer de dos botones.

## Open Questions del FRD — estado

Las 3 (librería de profanidad dedicada / visibilidad pública de usernames / gestión de proveedores post-MVP) siguen **abiertas y fuera de scope** — el rediseño no las tocó. Sin cambios.

## Recomendaciones de seguimiento

1. **FR-07-28 / WO-06 (store prefill desde preferencias)** — decidir si se implementa (consumidor de las prefs ya persistidas) o se difiere formalmente. Hoy queda en Planned.
2. **`modules/settings.md` numeración** — opcional: corregir los IDs de FR de ese doc del rediseño para que apunten a los canónicos, y arreglar el path del frontmatter (`frd-07-user-account-settings` → `frd-07-user-settings`). No bloquea; el FRD-07 ya quedó alineado.
3. FRD-07 ya sincronizado (§6); no queda deuda de alineación de producto para Settings salvo el punto 1.

## §6 — Cambios aplicados al FRD-07 en este mismo paquete

- `implementation_status: IN_PROGRESS → IMPLEMENTED`; `last_updated → 2026-06-13`.
- **Current State** reescrita: "Implemented" agrega el módulo S8 real (3 panes, 7 modales adaptive, `ImageCropper` compartido, 11 server actions, currency two-path, cooldown vivo, preferencias WO-05 persistidas). "Planned" reducida a **WO-06 (FR-07-28 store-entry defaults)**, único pendiente verificado.
- **FR-07-32**: nota de que el "explicit confirmation step / bulk update by pair" se materializa como footer two-path (`updateCurrency({ saveFxRates })`) (D7-02).
- **FR-07-33**: nota del `<CooldownChip>` vivo + submit deshabilitado durante el cooldown (D7-03).
- **BR-07-01**: nota del override ADR 0001 D15 (tabs verticales desktop / segmented mobile) manteniendo una sola ruta (D7-09).
- **Implementation Notes**: (a) la card "Interfaz" surfacea tema (light/dark, `ThemeContext`) + idioma (es/en, cookie `NEXT_LOCALE`) como controles de presentación espejados del app shell (FRD-03), **no** preferencias persistidas (D7-04); (b) el crop de avatar reusa `<ImageCropper>` compartido (D7-07).
- **Out of Scope**: + "list-density preference (deferred)" (D7-05) y "active-session management UI in settings (deferred)" (D7-06).
- Sin cambios de semántica de FRs/BRs existentes — solo facts de implementación, 2 aclaraciones y 2 scope-outs. Cero cambios de modelo de datos.
