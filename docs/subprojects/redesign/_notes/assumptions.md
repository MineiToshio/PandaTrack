---
title: Supuestos asumidos en Sesión 1
last_updated: 2026-04-30
---

# Supuestos durante S1

Decisiones tomadas sin esperar confirmación humana, según la regla de "documenta y sigue":

1. **Modo hero del producto = dark.** La audiencia 18–25 nativos digitales y la categoría (coleccionables nocturnos, drops, tracking emocional de paquetes) tira a dark. Light se diseña como hermano paralelo, no como "default desactivado". Cada dirección declara su modo hero explícitamente y lo justifica.
2. **Mascota panda existe como sistema, no como sticker.** El nombre del producto manda. Cada dirección define cómo encarna o reinterpreta al panda — desde "el panda no aparece, sólo su huella en el grid" hasta "el panda es el narrador del producto".
3. **Mobile-first real.** Los samples del dashboard se piensan primero en 360px y luego se expanden a desktop, no al revés.
4. **Auditoría del código no incluye lectura exhaustiva línea a línea de toda la app.** Los sub-agentes Explore extrajeron lo necesario para el contrato funcional. Cualquier hueco se resolverá en S2 cuando se aborden pantallas específicas.
5. **No tocamos código.** Cualquier referencia a `data-theme="light/dark"` actual o a tokens existentes es para indicar qué se reescribirá en S3 (sistema de tokens dual-mode), no para preservar la implementación.
6. **Las URLs de research son referenciales.** Algunas pueden haber rotado de slug; los autores y patrones referenciados son reales. Cuando S2 pida moodboards visuales se validan en navegador.
7. **Las paletas propuestas en cada dirección verifican AA por construcción.** En S3 se hará una pasada formal con contrast checker; los ratios indicados son derivaciones directas de OKLCH con rangos de luminosidad seguros.
8. **El "delivery" en el modelo de datos puede tener split shipments parciales** — se interpretó del nombre histórico de la entidad y de las migraciones recientes que removieron carrier/tracking; se preserva el flujo "una orden → 1..N entregas, cada entrega contiene N items elegibles".
9. **Sólo dos locales: es (default) y en.** Cualquier sample de copy se entrega en ambos cuando es relevante.
10. **No se programaron unit tests, type-check, lint ni Playwright** porque S1 no toca código de la app — únicamente crea archivos `.md` en `docs/redesign/`.
