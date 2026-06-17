---
title: Research — Status colors para "pendiente sin urgencia"
session: 02-postresearch
last_updated: 2026-05-01
---

# Research — Status colors para "pendiente sin urgencia"

Investigación sobre el gap #1 de Atelier (`atelier-gaps.md`): cómo representar el estado `NONE` ("aún no llega a la tienda") en la pantalla de crear entrega sin que el chip se sienta alarmante. El conflicto: `--warning` (amarillo) en Atelier está reservado para "atrasado / vencido", y un item que simplemente no ha salido todavía no es un atraso.

## Hallazgos por app

| App / sistema          | Estado equivalente                | Color usado                      | Texto                     | Ícono                    | Notas                                                                                                                                      |
| ---------------------- | --------------------------------- | -------------------------------- | ------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **GitHub** (PR)        | Draft                             | Gris neutro (#6e7781 / muted)    | "Draft"                   | Círculo hueco gris       | Ready=verde, Draft=gris, Merged=púrpura, Closed=rojo. Gris se reserva específicamente para "no listo todavía", no para "deshabilitado".    |
| **Linear** (Issue)     | Backlog · Todo                    | Gris claro (icon outline)        | "Backlog" / "Todo"        | Círculo punteado / vacío | In Progress usa amarillo/ámbar lleno parcial. Backlog y Todo nunca usan amarillo — el color amarillo aparece sólo cuando hay actividad.    |
| **Shopify Polaris**    | Pending (financial), Unfulfilled  | "Info" (azul) o "Attention"      | "Pending" / "Unfulfilled" | Sin ícono                | Polaris distingue `info` (azul, neutro informativo) de `attention` (amarillo, requiere atención) y `warning` (amarillo fuerte, problema).  |
| **Stripe Dashboard**   | Processing / Pending payment      | Azul claro (info)                | "Processing" / "Pending"  | Círculo / dot azul       | Reservan amarillo/naranja para `requires_action` y rojo para `failed`. Pending nunca es amarillo — es azul informativo.                    |
| **IBM Carbon**         | In progress · Draft · Not started | Azul (in-progress), gris (draft) | Status text               | Spinner / círculo hueco  | Patrón explícito: azul=actividad en curso, gris=no iniciado, amarillo=atención, rojo=crítico. Nunca usan amarillo para "pendiente normal". |
| **FedEx / UPS / USPS** | Label Created · In Transit        | Gris/azul (no urgente)           | "Label Created"           | Dot pequeño              | Amarillo/rojo se reservan para "Delivery Exception" o "Delayed". El estado normal de tránsito es siempre azul o neutro.                    |
| **Robinhood / Cash**   | Pending transaction               | Gris muted con texto secundario  | "Pending"                 | Reloj / clock            | Sin color de status — texto secundario + ícono de reloj. Sólo aparece amarillo/rojo cuando hay un real problema (declinada, expirada).     |
| **Pokémon Center**     | Order processing                  | Azul / gris neutro               | "Processing"              | —                        | Mismo patrón: pre-shipment es azul/neutro, no amarillo.                                                                                    |
| **POPMART app**        | Pre-orden esperando lanzamiento   | Gris/azul + countdown            | "Coming soon" + fecha     | Calendario               | El "tiempo natural" se comunica con fecha + neutralidad, no con color de alarma.                                                           |

## Patrón dominante

Las apps premium convergen claramente:

1. **"Pendiente sin urgencia" = azul (info) o gris neutro.** Nunca amarillo.
2. **Amarillo se reserva exclusivamente para "requiere atención del usuario"** — atrasado, expira pronto, falló parcial, requiere acción.
3. **Gris ≠ deshabilitado cuando va con texto + ícono explícitos**. GitHub Draft y Linear Backlog usan gris y nadie los percibe como "rotos" — porque tienen label clara y un ícono distintivo.
4. **La distinción "no urgente" vs "urgente" se logra por color, no por intensidad**. Ninguna app premium usa "amarillo claro" para no-urgente y "amarillo oscuro" para urgente — usan colores semánticamente distintos.
5. **En e-commerce/logística**, el flujo natural es: gris (creado) → azul (en tránsito) → verde (entregado), con amarillo/rojo apareciendo sólo en excepciones.

## Opciones evaluadas para Atelier

### Opción A: Mantener `--warning` con alfa bajo (status quo)

- **Pros:** No agrega tokens nuevos. Implementación cero.
- **Contras:** Choca con la jerarquía oficial §4.4 que reserva `--warning` para "atrasado". Crea ambigüedad: si en el futuro un producto está atrasado, ¿qué chip usamos? El alfa más alto del mismo color es una distinción frágil que nadie va a percibir.
- **Riesgo de confusión:** Alto. Cuando llegue el estado "atrasado N días" (que sí debe ser warning), no habrá forma visual de distinguirlo.
- **Costo:** Bajo (cero).
- **Veredicto:** Inviable a mediano plazo. Quema el token `--warning` para algo que no es warning.

### Opción B: Usar `--text-muted` plano sin chip (sólo texto)

- **Pros:** No agrega tokens. Sintoniza con Robinhood / Cash App. Calmado.
- **Contras:** Pierde el reconocimiento visual de chip. En una lista densa donde algunos items son "Listo en tienda" (chip verde), los items sin chip pueden leerse como "sin información" o "deshabilitados". Reduce paridad visual entre los dos estados.
- **Riesgo de confusión:** Medio. El usuario puede pensar "¿este item no carga su estado?" al ver texto plano junto a un chip verde lleno.
- **Costo:** Bajo (cero).
- **Veredicto:** Funciona si el estado `NONE` fuera el caso minoritario, pero en MVP es probable que sea el común path. Necesita simetría visual con `ARRIVED_AT_STORE`.

### Opción C: Introducir nuevo token `--info` (azul/teal sutil)

- **Pros:** Sigue el patrón premium dominante (Polaris info, Stripe processing, Carbon in-progress). Distingue inequívocamente "pendiente normal" de "atrasado". Da espacio futuro para otros usos legítimos de "info" (banners informativos, tooltips de status, mensajes de sistema sin urgencia).
- **Contras:** Suma 1 token al sistema (`--info` light + dark + alfa receta). Costo de mantenimiento bajo pero real. Hay que documentar en §4.4 cuándo usarlo y cuándo no, para que no se convierta en cajón de sastre.
- **Riesgo de confusión:** Bajo si se diferencia bien de `--accent` (indigo) y `--accent-cool` (teal). Recomendación: usar un teal/cyan más desaturado que `--accent-cool` para evitar pisar la familia coordinada.
- **Costo:** Medio. 1 token nuevo + 1 receta de chip + entrada en jerarquía §4.4.
- **Veredicto:** La opción más alineada con apps premium y la única que escala cuando aparezcan los estados "atrasado real" y otros mensajes informativos.

### Opción D: Usar `--accent-cool` (teal del sistema) directo

- **Pros:** No agrega tokens. El teal ya existe. Visualmente sintoniza con info-neutral de Stripe.
- **Contras:** `--accent-cool` está reservado en §4.4 para "íconos de categoría, info inline, tooltips, links secundarios". Usarlo como background de chip de status lo convierte en "color de status" — eso choca con su rol asignado y diluye la regla de "máx 3-4 cromáticos visibles". Además, en cards donde ya hay íconos de categoría en `--accent-cool`, el chip teal compite con los íconos.
- **Riesgo de confusión:** Medio-alto. El usuario empieza a ver teal en todos lados (íconos + chips + tooltips) y pierde la asociación "teal = info contextual".
- **Costo:** Bajo (cero) pero rompe contrato semántico.
- **Veredicto:** Tentadora pero ensucia el rol de `--accent-cool`. Si se elige, hay que actualizar §4.4 y aceptar que teal pasa de "extra puntual" a "status normal" — eso cambia el carácter del sistema.

## Cuestionamiento hostil aplicado a la Opción C (recomendada)

1. **¿Reduce o aumenta los tokens?** Aumenta en 1 (`--info` light/dark + receta de chip). Costo aceptable: el patrón es estándar en sistemas maduros (Polaris, Carbon, Material) y previene quemar `--warning`.
2. **¿Funciona en light Y dark?** Sí. Receta propuesta: `oklch(62% 0.12 230)` light, `oklch(76% 0.12 230)` dark. Hue 230 (azul-cyan) lo separa de `--accent` indigo (~268), `--accent-cool` teal (~195), y de `--focus-ring`. Verificar contraste en oklch viewer antes de canonizar.
3. **¿WCAG 2.2 AA en chip 11–13px?** Sí, si se usa la receta `bg --info / 14% + text --info` con verificación de contraste ≥4.5:1 sobre el fondo tintado en ambos modos (mismo patrón que `--success` y `--warning`). El borde sutil (`--info / 28%`) ayuda en color blindness.
4. **¿Distinguible para daltónicos?** Sí, porque el sistema obliga a chip = color + texto + ícono Lucide (`clock` para "Aún no llega", `check-circle` para "Listo en tienda"). Un protan/deutan vería los chips por forma de ícono y label, no por color.
5. **¿Se confunde con `--warning` real?** No, son hues distantes (azul 230 vs ámbar 75). De hecho, esa es la razón de existir: cuando aparezca el chip "atrasado N días" en `--warning`, será inmediatamente distinguible de "aún no llega" en `--info`.

La opción C pasa las 5 preguntas. La opción A falla la #5 (alfa no es distinción semántica). La opción B falla la accesibilidad/paridad visual. La opción D rompe el contrato de `--accent-cool`.

## Recomendación final

**Introducir `--info` como nuevo token status en Atelier** (hue azul-cyan ~230, receta `oklch(62% 0.12 230)` light / `oklch(76% 0.12 230)` dark), y usarlo en `delivery-create` para el chip "Aún no llega" del estado `NONE`. El chip mantiene la receta canónica de status (`bg --info / 14% + text --info` + borde `--info / 28%`) y se acompaña de ícono Lucide `clock` para refuerzo no cromático. Esta decisión alinea PandaTrack con el patrón dominante de apps premium (Polaris info, Stripe pending, Linear backlog, GitHub draft conceptualmente equivalentes), preserva `--warning` para su uso legítimo (atrasado/vencido), y abre espacio para futuros mensajes informativos sin tener que reabrir la jerarquía. El costo es sumar 1 token + 1 entrada en §4.4 — bajo comparado con el costo de seguir quemando `--warning` y luego no poder distinguir "aún no llega" de "atrasado 7 días".

**Nivel de confianza:** alto. El patrón es consistente entre 6+ sistemas premium y resuelve el conflicto semántico raíz, no el síntoma.

## Si me equivoco

Señales de rollback:

1. **Test de usabilidad con 5 coleccionistas 18–25**: si ≥2 usuarios describen el chip "Aún no llega" como "el item está mal" o "hay un problema", la información azul también está alarmando — entonces bajar la prominencia (alfa 8% bg, sin borde, sólo texto color).
2. **Conteo cromático en pantalla**: si en una vista típica de `delivery-create` con productos mixtos aparecen ≥5 cromáticos a la vez (indigo CTA + teal íconos + verde chips + azul chips + ámbar warning futuro), la regla de oro §4.4 está rota — entonces consolidar `--info` reemplazándolo por `--text-muted` + ícono `clock` (Opción B) y aceptar la asimetría de chips.
3. **Conflicto con futuros usos de azul**: si aparece un caso donde se necesita un azul informativo distinto (ej. tooltip de hint, banner de novedad), y `--info` ya está pegado a "pendiente sin urgencia" en la mente del usuario, entonces hay que renombrar a `--pending` y crear un `--info` separado. Mejor preverlo: nombrar el token desde el inicio como `--info` (genérico) y documentar en §4.4 que su primer uso canónico es "pendiente sin urgencia".
4. **Contraste real falla en dark mode**: si el chip a 11px no llega a 4.5:1 sobre `--surface` en dark, ajustar L del token o subir el alfa del bg al 18%.
