---
title: S13 — Pasada final de auditoría (Fase A hallazgos + Fase B remediación)
last_updated: 2026-06-16
status: CERRADA — Fase A (auditoría) + gate de Sergio + Fase B (remediación) aplicadas. Validación verde. Sin commitear (Sergio commitea).
owner: Sergio Minei
session: 13-final-audit
scope: barrido exhaustivo de todo el redesign implementado (S1–S12) + disposición de backlogs acumulados.
---

# S13 — Auditoría final del redesign

> **Naturaleza.** Pasada **READ-ONLY** sobre `redesign` con S1–S12 completos e implementados (Fase A), seguida
> de remediación acotada a lo aprobado en el gate (Fase B). Consolida consistencia visual + accesibilidad
> (WCAG 2.2 AA, light **y** dark) + higiene de código, y **dispone cada ítem** de los backlogs abiertos
> (pre-s12-audit F-03…F-12, s4-gaps G9/G10/G11/G13, cross-cuttings 🟡) como
> **🔧 fix · ⏸ diferir · 👍 aceptar-intencional · ✅ ya-resuelto · ⚖️ juicio-humano**.
> Las decisiones de criterio (Zilla, slot "Resumen", enforcement) las tomó Sergio en el gate — ver §13.

## 0. Método y cobertura

- **4 agentes Explore en paralelo** (read-only) + verificación de fuente dirigida + resolución de dudas en código:
  1. Higiene de tokens visuales (theme-blind, L074 oklch/oklab, CSS/keyframes muertos).
  2. Higiene de código (strings hardcodeados user-facing, paridad i18n es/en, dead code).
  3. Accesibilidad estática WCAG 2.2 AA (icon+label ADR 0006, labels de form, alt, reduced-motion, anuncios, foco).
  4. Componentes canónicos + vocabulario congelado §9.17 + wordmark de marca.
- **Resolución decisiva en fuente** de los "verificar-primero" F-11 (color de barra de pago) y F-12 (avatar settings vs sidebar), y de los choques entre agentes (LanguageToggle, StoreAvatar L074, mk-journey-tile).
- **Verificación de muerto:** los 5 keyframes `hero-*`/`banner-*` confirmados con 0 referencias en `src/`.
- **Cobertura:** app shell, los 4 módulos (stores/orders/deliveries/settings), estados transversales (S10),
  landing/auth/legal (S11), capa de motion+voz (S12), `globals.css`, i18n es/en (16 namespaces).

> **Nota de alcance visual.** El contraste runtime light/dark ya tiene cobertura fuerte: S3 auditó 188/188 pares AA,
> y la pasada visual pre-S12 barrió todas las superficies en light+dark/desktop+mobile sin regresiones de sistema.
> Desde entonces solo entró S12 (motion, doc-only en cierres). Esta Fase A se apoya en eso; el **re-pase visual
> light/dark/mobile es parte de la VALIDACIÓN de cierre (Fase B)**, no del gate.

## 1. Resumen ejecutivo

**Sistema sano.** Cero bloqueantes. Los componentes canónicos (Skeleton/EmptyState/SectionError/Modal/StatusChip/
DetailSidebar) están adoptados sin reinvenciones; ADR 0006 (icon+label) está **enforced por TypeScript**;
la paridad i18n es/en está **limpia** (16/16 namespaces); reduced-motion tiene cobertura global + por-superficie;
el vocabulario §9.17 es consistente en **8 de 9 slots**. Los hallazgos son menores: 1 instancia nueva de L074,
strings hardcodeados de baja prioridad, CSS muerto, y un puñado de decisiones de criterio.

| Disposición propuesta       | #   | IDs                                                                              |
| --------------------------- | --- | -------------------------------------------------------------------------------- |
| ✅ Ya resuelto (verificado) | 7   | F-01, F-02, F-05, F-06, G11, S7-A.2, (parte de) S6.1–S6.3                        |
| 🔧 Fix ahora (bajo riesgo)  | 6   | N1(L074 StoreAvatar), F-07, N4(DateInput), N5(CSS muerto), F-08, N3(comentarios) |
| 👍 Aceptar-intencional      | 5   | F-09, F-10, F-11, F-12, G10                                                      |
| ⚖️ Juicio humano (gate)     | 3   | F-03 (wordmark), F-04 (slot "Resumen"), N2 (default "Filtrar")                   |
| ⏸ Diferir / doc-only S14    | 2   | G13 (border 1.5px), G9 (lint ADR 0006)                                           |

---

## 2. Backlog `pre-s12-consistency-audit` (F-01 … F-12)

| ID   | Qué                                                                       | Estado verificado en S13                                                                                                        | Disposición |
| ---- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| F-01 | L074 en `.mk-header/.mk-minibar/.mk-journey`                              | `oklch`→`oklab` aplicado pre-S12. Confirmado en `globals.css`.                                                                  | ✅ resuelto |
| F-02 | 7 mezclas neutras `oklch` + 3 componentes                                 | Aplicado pre-S12.                                                                                                               | ✅ resuelto |
| F-03 | Wordmark **Zilla Slab** (sidebar) vs **Inter + "P"** (público)            | **Real.** `Logo.tsx:10` usa `font-logo` (Zilla); `BrandMark.tsx` usa `.mk-brand` (Inter) + tile "P". Dos sistemas tipográficos. | ⚖️ **gate** |
| F-04 | Slot "Resumen" del aside sin identidad congelada                          | **Real.** Ver tabla §6. store="Tus pedidos aquí"/accent/Package · delivery="Resumen"/cool/ClipboardList · order=sin slot.       | ⚖️ **gate** |
| F-05 | 404 público off-brand                                                     | `[locale]/not-found.tsx` + catch-all aplicados pre-S12.                                                                         | ✅ resuelto |
| F-06 | Metadata EN hardcodeada + título duplicado                                | `absoluteTitle` + description localizada aplicados pre-S12.                                                                     | ✅ resuelto |
| F-07 | aria-labels hardcodeados mezclando idiomas                                | **Confirmado presente** (líneas exactas en §3.1). Incl. `WizardStep` con ES hardcodeado.                                        | 🔧 fix      |
| F-08 | Landing tooltips `TikTok`/`WhatsApp` + LanguageToggle fallback "Language" | **Confirmado.** `Footer.tsx:89,96` (`title=`) y `LanguageToggle.tsx:41` (`aria-label={ariaLabel ?? "Language"}`).               | 🔧 fix      |
| F-09 | OG/email/apple-icon hardcodean su propia paleta (hex)                     | **Intencional.** Hex es obligatorio (no admiten CSS vars). Valores cercanos a Velvet pero no derivados.                         | 👍 aceptar  |
| F-10 | `global-error.tsx` dark-only hardcodeado                                  | **Intencional/esperado** (ADR 0013: corre cuando el root layout/CSS-vars pueden no existir).                                    | 👍 aceptar  |
| F-11 | Color del fill de la barra de % de pago "varía"                           | **Intencional, regla coherente** (ver §5). No es bug.                                                                           | 👍 aceptar  |
| F-12 | Avatar Settings (gradiente) vs sidebar (foto)                             | **Intencional, two-source** (ver §5). Subtileza UX menor anotada.                                                               | 👍 aceptar  |

### Detalle F-03 (wordmark) — decisión de gate

- **App shell:** `src/components/core/Logo.tsx:10` → `<span className="font-logo …">PandaTrack</span>` → **Zilla Slab Highlight** (`--font-logo`, `src/lib/fonts.ts`).
- **Superficies públicas S11** (landing/auth/legal/footer): `BrandMark.tsx` → `.mk-brand` (sin font especial → **Inter** vía `--font-sans`) + `.mk-brand-mark` tile "P" con gradiente accent.
- **Defendible** como dos contextos (chrome interno vs marca pública), pero un sistema que se gradúa a `docs/design/` debería **decidir explícitamente**: (A) unificar a Inter + "P" (matar Zilla); (B) unificar a Zilla en ambos; (C) aceptar y documentar la divergencia como intencional. **Recomendación:** (A) o (C). Zilla es el único vestigio del lockup legacy; el "P" tile + Inter es lo nuevo y ya manda en las superficies de primera impresión.

### Detalle F-04 (slot "Resumen") — decisión de gate

"Resumen" **no está** en la tabla congelada §9.17 → es un label derivado. Opciones: **(A)** congelar el slot resumen del aside con label/tono/ícono únicos (p. ej. delivery → "Tu entrega · {moneda}"/accent/Package, espejando el hero "Tu pedido" de orders); **(B)** aceptar la divergencia como intencional por semántica de tonos (accent="tus cosas", cool="recap del sistema"). **Recomendación:** (A) acotada — alinear delivery al patrón "Tu {entidad}"/accent/Package para que el aside se lea como el mismo componente cross-módulo. El resto de §9.17 ya es consistente.

---

## 3. Higiene de código

### 3.1 Strings user-facing hardcodeados → 🔧 fix (todos confirmados presentes)

| Archivo:línea                                | Snippet                                | Nota                                                                                     |
| -------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------- |
| `core/DateInput.tsx:157`                     | `aria-label="Clear date"`              | **N4:** ya existe key `components.dateInput.clear` sin usar → wire-up.                   |
| `core/Toast/ToastContainer.tsx:18`           | `aria-label="Notifications"`           | i18n.                                                                                    |
| `modules/Sheet/Sheet.tsx:169`                | `aria-label="Close"`                   | i18n.                                                                                    |
| `modules/WizardAccordion/WizardStep.tsx:354` | `aria-label="Acciones del paso"`       | **ES hardcodeado** (viola english-code + i18n).                                          |
| `(landing)/_components/Footer.tsx:89,96`     | `title="TikTok"` / `title="WhatsApp"`  | F-08. tooltips no localizados.                                                           |
| `Menu/LanguageToggle.tsx:41`                 | `aria-label={ariaLabel ?? "Language"}` | F-08. fallback EN (la mayoría de callsites pasan `ariaLabel`, pero el default queda EN). |

> **N4 (DateInput) es gratis:** las keys `components.dateInput.clear` y `components.dateInput.placeholder` **ya existen en es+en** y están sin usar porque el componente hardcodea. Wire-up cierra F-07(DateInput) **y** las keys muertas a la vez.

### 3.2 Español en comentarios de código → 🔧 fix menor (english-code-only)

- `stores/_components/share/StoreCard.tsx:55` — comentario con `"+N más"`.
- `orders/_components/share/OrderAddProductSheet.tsx:89` — comentario citando `"Añadir"/"Guardar"/"Cancelar"`.

Ambos citan copy de UI dentro del comentario; trivial pasarlos a inglés (o referir las keys i18n).

### 3.3 Paridad i18n es/en → ✅ LIMPIA

16/16 namespaces balanceados, sin keys huérfanas, sin namespaces faltantes. 1 par vacío intencional conocido (`orders.detail.deleteModal.descriptionPayments`). Sin acción.

### 3.4 Dead code / dead CSS

- **N5 — 5 keyframes muertos en `globals.css`** (0 referencias en todo `src/`, confirmado): `banner-cta-subtle` (L449), `hero-fade-in-up` (L459), `hero-glow-pulse` (L470), `hero-float` (L482), `hero-cta-glow` (L492). Vestigios del hero animado previo a la "ventana-producto" `.mk-*` de S11. → **🔧 fix (remover).**
- Resto de keyframes: todos vivos (verificado). Sin dead code TS de alta confianza más allá de las keys `dateInput.*` (cubiertas por N4).

---

## 4. Accesibilidad WCAG 2.2 AA (light + dark) → ✅ AA-ready (estático)

| Dimensión                      | Resultado                                                                                                                                                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Icon-only sin nombre accesible | **Limpio.** `<IconButton>` exige `aria-label` por tipo; 30+ callsites revisados.                                                                                                                            |
| Form controls sin label        | **Limpio.** Input/Textarea/Select/Combobox/DateInput con label, `aria-label` o fieldset+legend.                                                                                                             |
| Imágenes sin alt               | **Limpio.** Decorativas con `alt=""`+`aria-hidden`; significativas con alt real.                                                                                                                            |
| ADR 0006 icon+label            | **Enforced por TS** (discriminated union de `StatusChip kind="info"`). `--accent-cool` solo como color de ícono con label.                                                                                  |
| Reduced-motion (≠ none)        | **Cobertura completa:** bloque global (`animation 0.01ms`, `transition 150ms`, `::view-transition-group`) + guards por-superficie (Switch/Stepper/Mascot/StoreCard/Toast/Skeleton/FilterDrawer/check-zoom). |
| Anuncios de estado             | **Limpio.** Toasts `role=status/alert`+`aria-live`; errores inline `role=alert`; autosave `role=alert`.                                                                                                     |
| Foco visible                   | **Limpio.** `outline:none` siempre acompañado de `focus-visible` ring (`--focus-ring`).                                                                                                                     |

**Contraste runtime:** cubierto por S3 (188/188 AA) + pasadas visuales previas; re-confirmar en el pase visual de cierre (Fase B). Sin hallazgos de a11y que muevan el gate.

---

## 5. "Verificar-primero" resueltos en fuente

### F-11 — color de la barra de % de pago → 👍 INTENCIONAL (no bug)

`OrderCard.tsx:49-55` y `OrdersTable.tsx:91-97` aplican la **misma** regla:

1. COMPLETED/CANCELLED → `--success`.
2. atrasado **o** (COMPLETED con saldo impago) → `--warning`.
3. `paymentPercentage >= 100` → `--success`.
4. parcial (`< 100`, sin atraso) → `--accent`.

Regla coherente (pagado/cerrado=verde · problema=ámbar · parcial=violeta). El "48%→¿verde?" del eyeball fue lectura errónea del snapshot.

### F-12 — avatar Settings vs sidebar → 👍 INTENCIONAL (two-source)

- **Sidebar** (`ShellAccountMenu.tsx:~60`): muestra `user.image` (foto OAuth de sesión) con fallback a iniciales.
- **Settings hero** (`UserAvatarHero.tsx` ← `SettingsProfilePane.tsx`): muestra **solo el avatar subido en la app** (`imageUrl`), con fallback a **inicial sobre gradiente**; **no** recibe `user.image`.

Diseño de dos fuentes (identidad OAuth global vs avatar curado de la app). **Subtileza UX menor (opcional):** un usuario con foto OAuth pero sin avatar subido ve foto en el sidebar y gradiente en Settings. Si se quiere coherencia, Settings podría caer a `user.image` antes del gradiente. **No bloqueante** — anotado por si Sergio quiere el fallback.

---

## 6. Vocabulario congelado §9.17 (tabla de verificación)

| Slot                                | order-detail   | store-detail                          | delivery-detail                  | Consistencia |
| ----------------------------------- | -------------- | ------------------------------------- | -------------------------------- | ------------ |
| Acciones (accent/Zap)               | ✓              | ✓                                     | ✓                                | ✅           |
| Tu nota privada (warm/PencilLine)   | ✓              | ✓                                     | ✓                                | ✅           |
| Productos (cool/Boxes)              | ✓              | (N/A)                                 | ✓                                | ✅           |
| Historial (cool/Clock3)             | ✓              | (N/A)                                 | (N/A)                            | ✅           |
| Pagos (state-aware/Wallet)          | ✓              | (N/A)                                 | (N/A)                            | ✅           |
| Tu pedido · {curr} (accent/Package) | ✓              | (N/A)                                 | (N/A)                            | ✅           |
| Categorías (cool/Tags)              | (N/A)          | ✓                                     | (N/A)                            | ✅           |
| Canales de contacto (cool/AtSign)   | (N/A)          | ✓                                     | (N/A)                            | ✅           |
| Direcciones (cool/MapPin)           | (N/A)          | ✓                                     | (N/A)                            | ✅           |
| **Resumen (aside)**                 | **(sin slot)** | **"Tus pedidos aquí" accent/Package** | **"Resumen" cool/ClipboardList** | ⚖️ **F-04**  |

8/9 congelados y consistentes. El único divergente es el slot "Resumen" (F-04, decisión de gate §2).

---

## 7. Backlog `s4-gaps` (residuales)

| Gap | Qué                                     | Disposición S13                                                                                                                               |
| --- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| G9  | Lint rules para enforcement de ADR 0006 | ⏸/👍 **No vale lint rule:** ya está **enforced por TS** (discriminated union). Una regla ESLint sería redundante. Ver §8.                     |
| G10 | Audit cross-paleta glyph/status         | 👍 **Moot por alcance:** solo **Velvet** vive en `src/`; las 4 paletas alternativas son demo-only. No hay cross-paleta que auditar en la app. |
| G11 | Migración legacy `text-white` masiva    | ✅ **Cerrado:** 0 violaciones theme-blind en `src/` (todo lo que queda son excepciones legítimas OG/email/apple-icon/global-error).           |
| G13 | Sub-token border `1.5px` (Checkbox)     | ⏸ **doc-only S14:** aceptar `1.5px` como CSS legítimo (opción a recomendada en S4); anotar en `tokens.md` al graduar.                         |

(G1–G8, G10(parte), G12 ya se resolvieron en S5/S6/S9. Solo quedaban estos 4.)

---

## 8. Enforcement (gap S4 / G9) — evaluación

**Setup actual:** `eslint.config.mjs` = `eslint-config-next` (core-web-vitals + typescript) puro. **Sin plugin custom, sin stylelint.**

| Regla candidata                                        | Veredicto                                     | Razón                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **theme-blind** (`text-white`/`#hex`/`bg-{color}-{n}`) | 🟡 **opcional, tamaño chico**                 | 0 violaciones hoy + disciplina clara. Un plugin ESLint custom para escanear `className` strings es costoso y obliga a allowlist (OG/email/global-error). **Mejor: un test de guardia (grep) en la suite**, no un plugin.                                                                    |
| **ADR 0006 icon+label**                                | ❌ **over-engineering**                       | Ya **enforced por TS**. La regla ESLint sería redundante; el lado CSS (`var(--accent-cool)` como bg/border) es bajo riesgo y mejor cubierto por PLAYBOOK + review.                                                                                                                          |
| **oklab sobre neutros (L074)**                         | 🟡 **vale, pero como grep no como stylelint** | Tiene historial de regresión (S11 + N1 StoreAvatar). Pero es CSS + inline styles; ESLint no ve `globals.css` y stylelint = dependencia nueva (ADR 0010 favorece hand-roll/cero-deps). **Mejor: guardia grep** `color-mix(in oklch, var(--(surface\|text-\|border\|background))` en un test. |

**Recomendación neta (aprobada en el gate):** **una sola guardia barata** — un test que grep-ea `src/` por (a) clases theme-blind en `.tsx` y (b) `color-mix(in oklch, …)` sobre tokens neutros. **Cero dependencias nuevas, cero plugin.** Respeta ADR 0010. ✅ **Implementada** en `src/test/design-token-guard.test.ts` (Fase B, §13). **No** se hizo plugin ESLint custom ni stylelint (over-engineering para el volumen actual).

---

## 9. Hallazgos nuevos de S13 (no estaban en ningún backlog)

| ID  | Archivo:línea                                         | Qué                                                                                                                                                                                                                                                                                                                                                           | Disposición                                                                                                    |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| N1  | `core/StoreAvatar.tsx:118`                            | `color-mix(in oklch, var(--text-muted) 12%, var(--surface-elevated))` sobre dos tokens neutros. **Verificado en preview (light): NO drifta** — ambos tokens caen en el hue lavanda 285, el mix da `oklch(0.891 0.0167 285)` = idéntico al oklab. **No es salmón visible.** Pero viola la convención L074 ("neutrales en oklab") y el guard nuevo lo marcaría. | 🔧 **fix de convención** (`oklch`→`oklab`, color idéntico; igual que se trataron las mezclas neutras de F-02). |
| N2  | `core/FilterTriggerButton/FilterTriggerButton.tsx:34` | Default prop `label = "Filtrar"` hardcodeado (ES). Los callsites suelen pasar `label`, pero el default queda en ES.                                                                                                                                                                                                                                           | ⚖️ gate (menor): rutear por i18n **o** hacer `label` requerido.                                                |
| N3  | (ver §3.2)                                            | Español en 2 comentarios de código.                                                                                                                                                                                                                                                                                                                           | 🔧 fix menor                                                                                                   |
| N4  | (ver §3.1)                                            | DateInput hardcodea + 2 keys i18n muertas ya existentes.                                                                                                                                                                                                                                                                                                      | 🔧 fix (wire-up)                                                                                               |
| N5  | `globals.css` L449/459/470/482/492                    | 5 keyframes muertos.                                                                                                                                                                                                                                                                                                                                          | 🔧 fix (remover)                                                                                               |

> **No-hallazgo (aclaración):** `globals.css:1190` `.mk-journey-tile` usa `color-mix(in oklch, currentColor 12%, var(--surface))` — `currentColor` ahí es `--tile`, un color de ciclo-de-vida de **chroma alto**, así que `oklch` es **correcto** (preserva el hue del acento). No es L074.

---

## 10. Cross-cuttings 🟡 abiertos (bookkeeping)

| ID             | Estado real S13                                                                                                                                                                                        | Disposición                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| S6.1/S6.2/S6.3 | Placeholders "audit correctivo de listado/wizard/detalle de tiendas" abiertos el 2026-05-03. El módulo Stores se completó (S6+M04+M07) y **pasó el audit canónico de S13 sin reinvenciones ni drift**. | ✅ **cerrar como superseded** por S6+M04+M07. |
| S7-A.2         | "🟡 docs aplicado · src pendiente" — pero **M06 (✅) implementó** la arquitectura Modal adaptive en `src/`. El status quedó stale.                                                                     | ✅ **cerrar** (superseded por M06).           |

---

## 12. Decisiones del gate (Sergio, 2026-06-16)

| Ítem              | Decisión de Sergio                     | Resolución aplicada                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F-03 Zilla**    | "Zilla es solo para el logo."          | 👍 **Aceptar + documentar.** Verificado: Zilla (`font-logo`) ya está acotado a `Logo.tsx` + `icon.svg` (favicon) + OG; **no leakea**. El `BrandMark` público (Inter + "P") es el lockup S11 aprobado. Sin cambio de código; regla anotada en PLAYBOOK §12.alpha.                                                                                                                                                                            |
| **F-04 Resumen**  | "Investiga y saca lo que corresponda." | 👍 **Aceptar + congelar la regla.** Investigado: NO es un drift — son **dos familias de slot** distintas. Store "Tus pedidos aquí" (accent/Package) = _tus cosas_ (espeja el hero "Tu pedido"/"Tu entrega"); Delivery "Resumen" (cool/ClipboardList) = _recap de datos del sistema_ (misma familia cool que Productos/Historial/Categorías). Cada una es internamente consistente. Sin cambio de código; regla congelada en PLAYBOOK §9.17. |
| **Enforcement**   | "Guardia grep (cero-dep)."             | 🔧 **Aplicado.** `src/test/design-token-guard.test.ts` (vitest, sin deps): (a) cero clases Tailwind theme-blind en `.tsx`; (b) cero `color-mix(in oklch, var(--<neutral>))`. Ambos verdes hoy.                                                                                                                                                                                                                                              |
| **N2 "Filtrar"**  | "Te lo dejo a ti."                     | 🔧 **Aplicado.** Removido el default `label = "Filtrar"` (los 3 callsites label-variant ya pasan label traducido; los icon-only pasan `aria-label`). Sin string ES hardcodeado.                                                                                                                                                                                                                                                             |
| **F-12 fallback** | "Te lo dejo a ti."                     | 👍 **Sin cambio (conservador).** El two-source es intencional y la hero de Settings es donde se **edita** el avatar de la app — mostrar ahí la foto OAuth sugeriría que esa foto ES el avatar de la app. Se deja como está.                                                                                                                                                                                                                 |

## 13. Fase B — remediación aplicada (2026-06-16)

Solo lo aprobado en el gate. Cambios mínimos, theme-aware, i18n es/en, sin refactors no pedidos. **Agentes no commitean.**

| Fix     | Archivo(s)                                                                                                                    | Qué                                                                                                                                                                                       |
| ------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1      | `core/StoreAvatar.tsx`                                                                                                        | `oklch`→`oklab` (convención L074; color idéntico, verificado en preview).                                                                                                                 |
| N5      | `app/globals.css`                                                                                                             | Removidos 5 keyframes muertos (`banner-cta-subtle`, `hero-fade-in-up`, `hero-glow-pulse`, `hero-float`, `hero-cta-glow`).                                                                 |
| F-07+N4 | `core/DateInput.tsx` · `core/Toast/ToastContainer.tsx` · `modules/Sheet/Sheet.tsx` · `modules/WizardAccordion/WizardStep.tsx` | aria-labels por i18n. DateInput reusa `components.dateInput.clear`; nuevas keys `components.toast.regionLabel`, `components.wizard.stepActions`, `common.close` (es+en).                  |
| F-08    | `(landing)/Footer.tsx` · `(landing)/Menu/LanguageToggle.tsx`                                                                  | `SimpleIconSvg` decorativo (el link ya tiene `aria-label` localizado → se quitó el `<title>` redundante de marca). LanguageToggle fallback → `common.languageToggle.regionLabel` (es+en). |
| N3      | `stores/.../StoreCard.tsx` · `orders/.../OrderAddProductSheet.tsx`                                                            | 2 comentarios pasados a inglés.                                                                                                                                                           |
| N2      | `core/FilterTriggerButton/FilterTriggerButton.tsx`                                                                            | Removido el default ES.                                                                                                                                                                   |
| Guard   | `src/test/design-token-guard.test.ts` (nuevo)                                                                                 | Guardia de regresión cero-dep (theme-blind + L074).                                                                                                                                       |
| Tests   | `_tests/DateInput.test.tsx` · `MobilePicker/_tests/MobilePicker.test.tsx`                                                     | Mock `next-intl` (patrón del repo) por los componentes que ahora usan `useTranslations`.                                                                                                  |

**Validación de cierre (verde):** `type-check` ✅ · `lint` ✅ (0 errores, 31 warnings preexistentes) · `test` ✅ **544** (incl. guardia nueva) · `validate-build` ✅ · e2e ✅ **15/15** (landing · auth · store-listing · deliveries) · verificación de preview: consola limpia + N1 confirmado color-idéntico en light. Cambios no-visuales (i18n/aria/dead-code/convención), por eso no hay screenshots de diff.

## 14. Qué queda para S14 (graduación a `docs/design/`)

- G13 — anotar `1.5px` (Checkbox) como CSS legítimo en `tokens.md`.
- G9 — sin lint rule custom (queda en TS para ADR 0006 + la guardia grep para theme/L074).
- Reflejar en el sistema final las reglas congeladas en el gate: Zilla = solo logo (§12.alpha); §9.17 dos familias de slot resumen (accent "tus cosas" vs cool "recap de datos").
- Reemplazo de `docs/design/` con el sistema Velvet extraído de `docs/redesign/` (objeto central de S14).

---

_Fase A + gate + Fase B cerradas el 2026-06-16. Sin commitear — Sergio revisa y commitea._
