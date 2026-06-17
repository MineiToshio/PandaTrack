---
title: Legal (privacy · terms)
session: 11
status: html-in-review
last_updated: 2026-06-14
demo_anchors:
  - "#s11-legal-privacy"
  - "#s11-legal-terms"
  - "#s11-legal-privacy-mobile"
frd: docs/product/prd-00-pre-release-validation/frd-04-public-legal-transparency/frd-04-public-legal-transparency.md
module: docs/redesign/modules/landing-onboarding.md
---

# Legal — privacy · terms

## 1. Propósito y contrato funcional

Rediseño visual de las páginas legales públicas (FRD-04 PRD-00, IMPLEMENTED):
política de privacidad y términos. Documento standalone (sin app-shell), columna
de lectura angosta. Linkeadas desde el footer de la landing y desde el
`ShellAccountMenu` del app — rediseñar una vez sirve a ambas. Pase liviano: sólo
presentación; el contenido real sigue viniendo de i18n (privacy.json/terms.json).

## 2. Variantes y anchors del demo

| Pantalla             | Anchor                      |
| -------------------- | --------------------------- |
| Privacidad (desktop) | `#s11-legal-privacy`        |
| Términos (desktop)   | `#s11-legal-terms`          |
| Privacidad (móvil)   | `#s11-legal-privacy-mobile` |

> **Decisión A.2 (dueño):** los textos legales se mantienen como están hoy en la app.
> El demo ahora usa el **contenido real verbatim** desde `privacy.json` (12 secciones)
> y `terms.json` (9 secciones), incluida la fecha real ("Última actualización: febrero
> de 2026"). El rediseño es **solo presentación**; el contenido sigue viniendo de i18n
> (FR-04-03) y NO se reescribe.

## 3. Layout y estructura

- **Minibar** (`mk-minibar`) — logo home + ES/EN + theme.
- **`legal-doc`** (`max-width 760px`):
  - `legal-back` (arriba) — back-link al home (FR-04-05).
  - `legal-head` — eyebrow chip "LEGAL" · h1 · `legal-updated` (fecha + icono).
  - `legal-intro` — párrafo de apertura.
  - `legal-toc` — índice en 2 columnas con anchors internos (`scroll-margin-top`).
  - `legal-section` × N — h2 numerado + párrafos.
  - `legal-back` (abajo).

## 4. Tokens relevantes

- `--surface` (TOC card), `--border` (divisores), `--text-secondary` (cuerpo),
  `--accent` (eyebrow, hover de links del TOC).

## 5. Estados visuales

- Default (documento). Hover en links del TOC / back-link.
- Sin loading/empty/error propios (estático SSR desde i18n).

## 6. Comportamiento e interacción

- Anchors del TOC → scroll suave a cada sección, con `scroll-margin-top` para no quedar
  bajo el header.
- Back-link (arriba y abajo) → home **preservando el locale** (es/en).
- Solo presentación: el contenido y `buildPageMetadata` no cambian.

## 7. i18n keys propuestas

**No se crean keys de contenido:** privacy/terms vienen verbatim de `privacy.json` /
`terms.json` existentes (`FR-04-03`) y **no se reescriben**. Solo posibles keys de chrome
(eyebrow "Legal", "Volver al inicio", "En esta página") en `common`. EN ya existe en
los locales; no requiere trabajo nuevo de copy.

## 8. Accesibilidad acordada

- `<main>` landmark; jerarquía correcta h1 (título) → h2 (secciones).
- TOC como `<nav aria-label>`; foco visible en los anchors internos.
- Contraste del cuerpo verificado light+dark; ancho de lectura ≤ ~70ch.

## 9. Anti-patrones

- No duplicar el contenido legal en el componente: viene de i18n (FR-04-03).
- No usar app-shell: es documento standalone.
- Mantener consistencia con el patrón existente `LegalPageLayout` (reusar en Fase B).

## 10. Notas para Fase B

Archivos React: `src/app/[locale]/_components/LegalPageLayout.tsx`,
`src/app/[locale]/privacy/page.tsx`, `src/app/[locale]/terms/page.tsx` (+ OG images).
Sólo presentación; preservar `buildPageMetadata` y la fuente i18n.
Ver handoff en [modules/landing-onboarding.md](../modules/landing-onboarding.md).
