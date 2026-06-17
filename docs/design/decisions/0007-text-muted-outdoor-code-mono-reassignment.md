---
title: ADR 0007 — Reasignación del code mono identificador a `--text-secondary` (robustez outdoor)
date: 2026-05-02
status: accepted
session: 03-tokens (research follow-up)
owner: Sergio Minei
refines: sistema de tokens del subproyecto §1.3, §10 (histórico)
sources: redesign subproject — S3 text-muted outdoor research note + S2 validation plan (Validation #4) (historical)
---

# ADR 0007 — Reasignación del code mono identificador a `--text-secondary`

## Contexto

`--text-muted` Velvet light está en `oklch(46% 0.022 285)` con ratio **5.81:1** sobre `--background` — pasa AA texto pequeño (4.5:1) holgado, pero apenas roza el umbral APCA recomendado para "body minimum" (Lc ≈75).

`--text-muted` se usa para timestamps, code mono, eyebrows uppercase y helper text — todos a 11–13px. **El caso outdoor-crítico** es el **code mono identificador `PT-XXXXXX`** del pedido: glyphs densos, función dependiente del reconocimiento exacto del string, y aparece en listas mobile que el usuario ve en la calle, transporte público, exteriores.

La Validation #4 del plan de validación del subproyecto (histórico) plantea probar lectura de `--text-muted` en mobile bajo sol. Quedó pendiente cuando S3 cerró tokens.

Agente D (research de text-muted outdoor del subproyecto, histórico) investigó:

- Strava, Komoot, AllTrails, Garmin Connect — apps outdoor-heavy usan ≥6.3:1 para metadata.
- Citymapper, Cash App, Venmo — apps mobile-general usan 4.9–5.5:1 (alineado con PandaTrack actual).
- APCA Lc ≥75 para body 13px; 5.81:1 ≈ Lc 65–70 (suficiente para "non-body content", borderline para body).
- Smartphones modernos en outdoor: 1000–2000 nits (iPhone 15 Pro Max 2000, Pixel 8 1400). El sun-glare reduce el contraste percibido ~15–20% vs lab.

Tres opciones evaluadas:

- (a) **Mantener muted como está.** PandaTrack no es outdoor-heavy; 5.81:1 supera WCAG AA holgado.
- (b) Bajar muted a L=42% → ratio ~7:1 → **invierte la jerarquía** con `--text-secondary` (L=44%): muted quedaría más oscuro que secondary. Bug estructural.
- (c) Bajar muted a L=38% → ratio ~9:1 → mismo problema de inversión, más severo.
- (d) Introducir `--text-muted-strong` token nuevo → suma un token sin uso claro fuera de "outdoor", deuda visual.

## Decisión

**Mantener `--text-muted` Velvet light en `oklch(46% 0.022 285)` (5.81:1).** No se modifica el valor del token.

**Pero reasignar el code mono identificador `PT-XXXXXX` (y derivados `delivery-{humanId}`, `store-{slug}` cuando se renderizan como código) de `--text-muted` a `--text-secondary`** (L=44% Velvet, ~6.32:1 sobre `--background`, equivalente APCA Lc ≈70+).

### Regla de uso refinada

| Caso de uso (mono / metadata)                                     | Token vinculante                |
| ----------------------------------------------------------------- | ------------------------------- |
| **Code mono identificador (PT-XXXXXX, hash, tracking)**           | **`--text-secondary`**          |
| Timestamps relativos ("hace 4s", "hace 2 días")                   | `--text-muted`                  |
| Eyebrows uppercase ("PRÓXIMOS 30 DÍAS", "TUS PRE-ÓRDENES")        | `--text-muted` (vía `.eyebrow`) |
| Helper text de form ("Cambios cada 30 días")                      | `--text-muted`                  |
| Footnote / leyenda                                                | `--text-muted`                  |
| Code mono inline dentro de body (ej. "el ID `xyz` corresponde a") | `--text-muted`                  |

**Diferenciador clave:** "code mono **identificador**" = strings densos cuya función depende del reconocimiento exacto carácter por carácter (lectura precisa, no escaneo), y que aparecen como información primaria de un row de lista.

## Justificación

1. **Razón estructural — preservar jerarquía.** `--text-muted` (L=46%) y `--text-secondary` (L=44%) son hermanas con apenas 2 puntos de diferencia. Bajar muted invierte la jerarquía visual y rompe la lectura "secondary > muted en peso visual".
2. **Atacar el caso crítico, no el token.** El problema outdoor no es `--text-muted` en general — es **el identificador denso** (5–7 caracteres alfanuméricos críticos). Mover ese caso específico al token de mayor contraste es proporcional al riesgo.
3. **PandaTrack no es outdoor-heavy.** El uso primario es indoor (escritorio, casa). Las sesiones outdoor son momentos liminales (transporte, fila). Calibrar TODO el sistema a estándares Strava (10:1) es sobre-ingeniería.
4. **No requiere tokens nuevos.** `--text-secondary` ya existe, ya pasa AA holgado, ya está cross-paleta. Cero deuda visual añadida.
5. **Compatible con Validation #4.** El test físico bajo sol valida ambos casos: timestamps en `--text-muted` (caso original) y code mono en `--text-secondary` (caso reasignado). Si timestamps en muted fallan en uso real, se reabre con datos.

## Costo

- **Trivial.** Cambio de regla de uso. El componente `<OrderRow>` (S4/S6) consume `var(--text-secondary)` para el span del code mono `PT-XXXXXX` en lugar de `var(--text-muted)`.
- Ningún cambio de tokens.

## Rollback

Si Validation #4 humana muestra que **incluso `--text-secondary` (6.32:1) falla outdoor para code mono**, escalar:

1. Promover a `--text-primary` (13:1) — pierde diferenciación visual con el nombre de la tienda en la misma row, pero gana robustez máxima.
2. Considerar `font-weight: 600` (semibold) en el code mono — incrementa contraste percibido sin tocar color.
3. Considerar tamaño +1 (de 13px a 15px / `text-mono` → `text-mono-lg`) — más glyph, más legible.

## Implicancias

1. el sistema de tokens §1.3 — actualizar regla de uso de `--text-muted` ("nunca code mono identificador") y `--text-secondary` ("también: code mono identificador `PT-XXXXXX` y derivados").
2. el sistema de tokens §10 — actualizar tabla de jerarquía con la regla refinada.
3. La Validation #4 del plan de validación del subproyecto (histórico) — refinada: setup split (versión actual `--text-muted` para timestamps vs versión propuesta `--text-secondary` para code mono) en mid-tier (Pixel 6a) + high-tier (iPhone 15 Pro). Detalle en el research de text-muted outdoor del subproyecto §9 (histórico).
4. S4 `<OrderRow>` y `<DeliveryRow>` consumen `var(--text-secondary)` para el span del code mono.
5. S4 `<StoreCard>` consume `var(--text-secondary)` para el slug si es identificador primario.

## Confianza

**Medio-alto.** La decisión es razonable y proporcional, pero la validación humana real con Pixel 6a + iPhone bajo sol cierra confianza alta. Si esa validación pasa, queda firme. Si falla, hay rollback claro.

## Próximos pasos

1. Aplicar a el sistema de tokens §1.3 + §10 (✅ aplicado en este mismo cierre).
2. Validation #4 humana refinada (paralelo a S4) — humano fuera del agente.
3. S4 implementa `<OrderRow>` con code mono en `--text-secondary` desde el día uno (no migración posterior).
