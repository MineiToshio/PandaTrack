---
title: PandaTrack — Subproyectos
last_updated: 2026-06-17
owner: Sergio Minei
---

# Subproyectos de PandaTrack

Esta carpeta es el **historial de iniciativas internas** de PandaTrack: esfuerzos grandes y
acotados que corrimos como un mini-proyecto aparte (su propia investigación, iteración y gate
humano) en vez de trabajarlos sueltos sobre `main`. Cada uno vive en su subcarpeta con todo su
proceso preservado tal cual quedó al cerrarse.

**Qué NO es:** no es la fuente de verdad operativa. Cuando un subproyecto se implementa, su
resultado durable se gradúa a su hogar permanente (el sistema de diseño a `docs/design/`, el
diseño por feature a `docs/product/.../{fdd,prototype}`, el código a `src/`). Lo que queda acá
es el **registro histórico**: cómo se llegó ahí, qué se probó, qué se decidió y por qué.

## Estados

- **Implementado** — completado y graduado a sus hogares permanentes; vive en producción.
- **Descartado** — explorado y decidido no avanzar.
- **En investigación** — en exploración activa.
- **En pausa** — pausado, retomable.

## Índice

| Subproyecto                    | Periodo                    | Estado           | Resultado / hogar permanente                                                                                                                                                                                 |
| ------------------------------ | -------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [redesign](redesign/README.md) | S1–S17 · 2026-04 → 2026-06 | **Implementado** | Sistema Velvet → [`docs/design/`](../design/) + ADRs 0001–0014; diseño por FRD → `docs/product/.../{fdd-XX,prototype}`; implementación en `src/`. Historial completo preservado en [`redesign/`](redesign/). |

## Convención

- Mover una iniciativa aquí cuando se cierra (implementada o descartada), con un README propio que
  dé contexto y su estado en el frontmatter (`status:`).
- Las referencias desde docs permanentes hacia un subproyecto son **breadcrumbs históricos**, no
  dependencias: el proyecto principal debe poder reconstruirse sin leer esta carpeta.
- No re-apuntar al path viejo de un subproyecto movido. Para `redesign`, la guardia
  `src/test/redesign-archive-guard.test.ts` impide que el path antiguo del taller reaparezca.
