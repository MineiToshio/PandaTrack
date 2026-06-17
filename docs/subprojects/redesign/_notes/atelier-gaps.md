---
title: Atelier — gaps detectados durante S2
last_updated: 2026-05-01
status: all-resolved
resolved_by: decisions/0001-s2-closure-decisions.md
---

# Atelier — gaps de tokens / patrones detectados durante S2

Este archivo registra huecos del sistema **Bento Atelier** (`directions.md` §4) que aparecieron al diseñar wireframes lo-fi de S2. Todos fueron **resueltos en `decisions/0001-s2-closure-decisions.md`** tras una pasada de research con 5 sub-agentes en paralelo (apps revisadas: Linear, Stripe, Notion, Vercel, Shopify, Apple, GitHub, Cash App, YNAB, Pokémon Center, FedEx, Carbon, Polaris).

Las recetas concretas viven en el ADR; este archivo se mantiene como bitácora del problema y enlace.

---

## Gaps cerrados

### ✅ 1. Color para "pendiente sin urgencia"

- **Detectado en:** `screens/delivery-create.md` §4 — chip "Aún no llega" para items en estado `NONE`.
- **Problema original:** la tabla §4.4 reservaba `--warning` para "pago vencido / atrasado N días". Usarlo para "todavía no llega" se sentía como falsa alarma.
- **Resolución:** introducir token nuevo **`--info`** (hue azul-cyan ~230) para status semántico "pendiente sin urgencia". Reservar `--warning` exclusivamente para atrasado/vencido.
- **Spec:** ver Decisión 1 en [`decisions/0001-s2-closure-decisions.md`](../decisions/0001-s2-closure-decisions.md).
- **Research fáctico:** [`research-status-colors.md`](./research-status-colors.md).

### ✅ 2. Patrón canónico de input pre-llenado / read-only por contexto

- **Detectado en:** `screens/delivery-create.md` §2 — combobox de tienda cuando viene `?sourceOrderId=`.
- **Problema original:** no había patrón sistémico para "campo fijado por contexto"; el input bloqueado clásico parece "deshabilitado por error".
- **Resolución:** **field-as-attribute** — wrapper `surface-elevated` + badge mono `↳ DESDE PT-XXXXXX` + valor + link ghost "Cambiar".
- **Spec:** ver Decisión 2 en el ADR.
- **Research fáctico:** [`research-form-patterns.md`](./research-form-patterns.md) §A.

### ✅ 3. Section card en estado disabled / gated

- **Detectado en:** `screens/delivery-create.md` §5 — cuando `empty_no_eligible`, las cards 3 y 4 quedan deshabilitadas.
- **Problema original:** §4.13 documentaba section cards normal y active, pero no disabled-gated. La práctica clásica con `opacity: 0.4` rompe WCAG AA.
- **Resolución:** card visible al 100% (eyebrow + title intactos) con contenido reemplazado por ícono `lock` + copy guía en `--text-muted` (ej. "Selecciona una tienda primero."). Sin opacity.
- **Spec:** ver Decisión 3 en el ADR.
- **Research fáctico:** [`research-form-patterns.md`](./research-form-patterns.md) §B.

### ✅ 4. Pattern de toast con undo

- **Detectado en:** `screens/delivery-create.md` §10 (selección masiva) + `screens/order-detail.md` §5 (optimistic delete de pago + delete de pedido).
- **Problema original:** Atelier sólo documentaba el toast achievement (con mascota + halo coral). Faltaba la variant "neutral-undo".
- **Resolución:** canonizar variant **`neutral-undo`** — `surface-elevated` + `border-strong`, sin ícono, ghost CTA "Deshacer" en `--accent` + atajo `Z`, 5s default / 8s para delete de pedido entero, hairline countdown opcional, pausa-on-hover.
- **Spec:** ver Decisión 4 en el ADR.
- **Research fáctico:** [`research-toasts-lifecycle.md`](./research-toasts-lifecycle.md) §A.

---

## Notas de proceso

- Los 4 gaps cerraron en una sola pasada post-S2 con 5 agentes de research lanzados en paralelo. Si en S3 emergen gaps nuevos al tokenizar, se vuelven a abrir aquí con el mismo formato.
- Convención: cuando un gap nuevo se detecta, anotar acá → research → ADR → cerrar referenciando el ADR.
- Mantener este archivo en repository-relative paths.
