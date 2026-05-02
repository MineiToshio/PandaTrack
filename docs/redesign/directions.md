---
title: 3 direcciones creativas — Sesión 1
last_updated: 2026-04-30
status: final S1
---

# 3 direcciones creativas para PandaTrack

Tres polos genuinamente distintos, no variantes. Cada uno responde a una hipótesis sobre **qué siente el coleccionista 18–25** cuando abre PandaTrack:

- **Dirección 1 — Bento Editorial** ("Calm Collector"): el coleccionista quiere una herramienta seria pero hermosa, casi un Linear para su colección. Densidad alta, type protagonista, dark hero serio.
- **Dirección 2 — Neon Drop Floor** ("Drop Hunter"): el coleccionista vive de los drops, los countdowns, la dopamina del "JUST DROPPED". Y2K + neo-brutalism, eléctrica, dark hero pulsante, mascot panda 3D chrome.
- **Dirección 3 — Soft Garden** ("Caretaker"): el coleccionista cuida su colección como un jardín. Categorías como personajes, claymorphism, bottom-sheet con física, light hero cálido, dark hero como "noche del jardín".

Cada dirección preserva el contrato funcional íntegro de [`functional-inventory.md`](./functional-inventory.md) y respeta los 10 principios de [`principles.md`](./principles.md).

---

# Dirección 1 — Bento Editorial

> _"Calm Collector"_: la herramienta seria que merece ser un placer abrir.

## 1.1 Concepto narrativo

PandaTrack como Linear/Plain del coleccionista: densidad alta, motion sub-200ms, tipografía que hace el trabajo pesado, dark hero oscuro pero no negro. La marca panda es huella tipográfica y un glyph reservado, no mascota celebrante. La dopamina viene de la **claridad** y la **velocidad**, no del confeti.

## 1.2 Mood board verbal

- **Linear** (1.1, 9.6 del research): sidebar primary nav, Cmd+K, dark `#08090A`, transitions 80–150ms.
- **Plain** (4.4): detail-as-timeline, eventos como entradas verticales narrativas.
- **Stripe Press / Brian Lovin / mds.is** (8.2): editorial expresivo, type-as-art en superficies ceremoniales.
- **Vercel home / Linear method** (2.4): bento "serio 2025" con motion sutil y data viz embebida.
- **Height** (4.1): peek panel lateral en desktop, listas 36–40px respirables.
- **Vaul + Sonner** (3.5, 3.6): bottom sheets físicos y toasts con motion correcto.

## 1.3 Modo hero

**Dark.** Justificación: el coleccionista 18–25 que prioriza herramienta seria usa la app de noche, en transporte, antes de dormir. Dark es donde esta dirección respira mejor. Light es ciudadano de primera clase como "modo de día / ducha del cerebro" pero no es la postal que el producto saca primero.

## 1.4 Paleta semántica

Espacio: **OKLCH** vía Tailwind v4 `@theme`. Implementación con `color-mix()` para state layers.

| Token                 | Light                                | Dark                                 | Contraste sobre bg        | Uso                        |
| --------------------- | ------------------------------------ | ------------------------------------ | ------------------------- | -------------------------- |
| `--background`        | `oklch(98.5% 0.005 250)` ≈ `#F8F9FB` | `oklch(13.5% 0.012 260)` ≈ `#0C0D11` | —                         | lienzo                     |
| `--surface`           | `oklch(100% 0 0)` ≈ `#FFFFFF`        | `oklch(17% 0.014 260)` ≈ `#13141A`   | —                         | card base                  |
| `--surface-elevated`  | `oklch(99% 0.004 250)` con shadow    | `oklch(20.5% 0.016 260)` ≈ `#181A22` | —                         | popover, modal, elevated   |
| `--surface-overlay`   | rgba(255,255,255,0.72) + blur        | rgba(24,26,34,0.72) + blur           | —                         | command palette, sheet     |
| `--border`            | `oklch(91% 0.008 250)` ≈ `#E2E5EC`   | `rgba(255,255,255,0.07)`             | 3.1:1                     | divider sutil              |
| `--border-strong`     | `oklch(82% 0.012 250)` ≈ `#C5CAD3`   | `rgba(255,255,255,0.14)`             | 4.5:1                     | input border, card outline |
| `--text-primary`      | `oklch(18% 0.018 260)` ≈ `#181A22`   | `oklch(96% 0.005 250)` ≈ `#F2F4F7`   | 16.4:1 / 15.7:1           | body, headings             |
| `--text-secondary`    | `oklch(46% 0.018 260)` ≈ `#5A5F6E`   | `oklch(74% 0.012 250)` ≈ `#B0B4BD`   | 7.1:1 / 8.6:1             | meta, secondary            |
| `--text-muted`        | `oklch(60% 0.014 260)` ≈ `#8C8F99`   | `oklch(56% 0.012 250)` ≈ `#80838B`   | 4.6:1 / 4.7:1             | timestamps, captions       |
| `--accent`            | `oklch(55% 0.16 270)` ≈ `#5E66D3`    | `oklch(72% 0.15 270)` ≈ `#9098F3`    | 5.3:1 / 6.4:1             | primary CTA, focus, links  |
| `--accent-foreground` | `#FFFFFF`                            | `oklch(15% 0.06 270)` ≈ `#15172B`    | 8+:1                      | label sobre accent         |
| `--success`           | `oklch(54% 0.14 158)` ≈ `#198E5F`    | `oklch(74% 0.15 158)` ≈ `#5DD4A0`    | 4.7:1 / 7.2:1             | pago confirmado, llegada   |
| `--warning`           | `oklch(70% 0.15 75)` ≈ `#D29335`     | `oklch(82% 0.14 75)` ≈ `#F1B362`     | 3.4:1 / 8.0:1 (UI grande) | pago vencido, atención     |
| `--destructive`       | `oklch(54% 0.21 25)` ≈ `#C5392F`     | `oklch(70% 0.18 25)` ≈ `#EE7363`     | 5.5:1 / 5.9:1             | delete, error              |
| `--focus-ring`        | `oklch(55% 0.16 270 / 0.55)`         | `oklch(72% 0.15 270 / 0.65)`         | ≥3:1 vs adyacente         | `:focus-visible`           |

State layers vía `color-mix(in oklch, var(--text-primary) Xpct, transparent)`: hover 6%/8%, pressed 12%/14%, dragged 16%/18%.

## 1.5 Type system

- **Stack:** Inter Variable como sans (UI body), JetBrains Mono Variable o Geist Mono para IDs/códigos, **Tiempos Headline** (o **Editorial New** como alternativa libre) para superficies ceremoniales (números héroe en detalle, hitos, wrap-ups).
- **Escala:** Display 56/64 (clamp 40→56 mobile→desktop), Title 32/40, Subtitle 22/28, Body-L 17/26, Body 15/22, Caption 13/18, Mono-L 15/22, Mono 13/18.
- **Pesos:** UI Inter 400/500/600. Display Inter 600 con `font-feature-settings: "ss01", "cv11"` para alternates. Editorial display 400 italic en hero numbers.
- **Tracking:** `-0.02em` en display, `-0.01em` en Title, `0` en body, `+0.02em` mayúsculas pequeñas (badges).
- **Tabular nums:** OBLIGATORIO en cualquier cifra (`font-variant-numeric: tabular-nums`).
- **Ajustes por modo:** en dark, body al 96% L (no 100%) para reducir vibración. Display en dark con `font-weight` -50 (Inter Variable) para compensar el "engrosamiento" visual. Italic editorial en dark con +2% L sobre el body.

## 1.6 Spacing y radius

- **Spacing scale (rem):** 0.125, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12. Derivado de 4px grid.
- **Radius scale:** `xs 4`, `sm 6`, `md 8`, `lg 12`, `xl 16`, `2xl 20`, `pill 9999`. Default `md` para inputs/buttons. Cards `lg` o `xl`. Sheets `xl` superior.
- **Container max:** `max-w-6xl` mantiene la convención del shell actual.
- **Density mode:** opción en settings "comfortable" (default) vs "compact" (-2px en row height de listas) para power users.

## 1.7 Elevation language

**Light** (sombras reales):

- `elevation-1`: `0 1px 2px rgba(20, 22, 30, 0.04)` — cards en lista
- `elevation-2`: `0 4px 12px rgba(20, 22, 30, 0.06), 0 1px 2px rgba(20,22,30,0.04)` — popover
- `elevation-3`: `0 12px 24px rgba(20, 22, 30, 0.08), 0 2px 6px rgba(20,22,30,0.06)` — modal/sheet
- `elevation-4`: `0 24px 48px rgba(20, 22, 30, 0.12)` — command palette

**Dark** (sin shadow real, elevación por tono + borde):

- `elevation-1`: `surface` flat + `border` 1px
- `elevation-2`: `surface-elevated` (+3% L) + `border-strong` 1px
- `elevation-3`: `surface-elevated` (+5% L) + `border-strong` 1px + `inset 0 1px 0 rgba(255,255,255,0.06)`
- `elevation-4`: surface-overlay (blur 32px + 72% alpha) + glow accent 8% en borde

Esto implementa la receta M3 + Linear documentada en research §9.5.

## 1.8 Motion language

Vocabulario de 6 tokens (principio #4 cumplido):

| Token                   | Valor                                          | Uso                                           |
| ----------------------- | ---------------------------------------------- | --------------------------------------------- |
| `--motion-fast`         | 150ms                                          | hover/state, focus ring, toggle               |
| `--motion-base`         | 280ms                                          | sheet, modal, page transition                 |
| `--motion-slow`         | 480ms                                          | celebraciones, view transition shared element |
| `--ease-emphasis`       | `cubic-bezier(0.2, 0, 0, 1)`                   | opacity, color                                |
| `--ease-out-expressive` | `linear(0, 0.5, 0.85, 0.97, 1)` (spring suave) | enters espaciales                             |
| `--ease-bounce`         | `linear(...)` (spring bounce 0.18)             | celebración pago/entrega completos            |

**Qué se anima:** entrada de sheets (slide+fade `--motion-base` `--ease-out-expressive`), shared element list→detail vía View Transitions (`view-transition-name: order-${id}`), header sticky al scroll (compress 64→48px con scroll-driven CSS), hover de filas (state layer 150ms `--ease-emphasis`), command palette (scale 0.96→1 + fade 200ms), toast Sonner (stack con offset y resistance), progress bar de pago al optimistic update (linear() spring).

`prefers-reduced-motion: reduce` → todo a fade 150ms, sin springs, sin parallax, sin scroll-driven.

## 1.9 Iconografía

- **Set principal:** Lucide (peso 1.75 stroke, 20px default) — open source, completa, weight variable.
- **Set complementario:** Phosphor Duotone para empty states cuando se necesita diferenciación visual sin recurrir al panda.
- **Estilo:** outline only, esquinas suaves, peso uniforme. Nunca filled salvo en estado "active" del nav.
- **Tamaños:** 16, 20 (default), 24, 32 (FAB), 40 (hero).
- **Por modo:** mismo SVG, color via `currentColor`. En dark `--text-secondary` (no white puro). Stroke 1.75 mantiene legibilidad en ambos.

## 1.10 Mascot, ilustración, empty states

**Mascot panda en esta dirección = whisper.**

- Sólo aparece como **glyph monocromático** (línea + punto que sugiere oreja/oso) en el logotipo del header.
- En empty states **no aparece la mascota** — usa una ilustración geométrica abstracta del acento (Linear-style) con una insinuación de panda en el negativo.
- En el favicon y OG sí está el panda completo, pero estilizado plano.
- Achievement unlock = ondas concéntricas del acento + tipografía editorial, sin mascota visible.

**Empty state ejemplos:**

- Pedidos vacíos: ilustración geométrica `oklch(55% 0.16 270 / 0.16)` + título _"Aún no hay pre-órdenes"_ + subtítulo _"La primera te ordena el mes."_ + CTA "Crear pedido".
- Tienda no encontrada: composición geométrica con un glyph de bolsa abstracta.

## 1.11 Voice & tone

Directo, calmado, declarativo. Inspirado en Linear y Plain. Ejemplos:

- Empty pedidos: _"Aún no hay pre-órdenes. La primera te ordena el mes."_
- Pago confirmado (toast): _"Pago registrado. Quedan $48,50 USD."_
- Discrepancia modal: _"Lo que ingresaste no coincide con la suma. ¿Qué prefieres?"_
- Error 500: _"Algo se rompió de nuestro lado. Reintenta."_
- Confirmación destructiva: _"¿Eliminar este pedido? Sus pagos también se borran."_

## 1.12 Sample del Dashboard

### Layout desktop (≥1024px)

Sidebar fija 240px (collapsable a 64px) + main `max-w-6xl` con padding `px-8 py-10`. Top: content header sticky con título `Dashboard` en `Title` size + utility row (filtros globales, command palette trigger).

Bento principal en grid 12 cols, gap-6:

- **Hero (cols 1–7, row 1):** card `surface-elevated` `radius-xl`. _Eyebrow_ mono uppercase `text-muted` "TUS PRE-ÓRDENES". Display editorial italic `Display 56`: `$1.247,80 USD restante`. Subtítulo `Body-L`: `de $3.420,00 USD a través de 12 pedidos`. Mini progress bar 4px, accent. Línea separadora. Strip horizontal de 4 micro-stats (Pagado, Próximo, Vencidos, Llegando) con labels `Caption mono uppercase` y números `Body-L tabular`.
- **Próximo pago (cols 8–12, row 1):** card `surface` `radius-xl`. Título `Subtitle`: _"Próximo pago"_. Avatar de tienda 40px. `Display 32` con monto + currency. Caption: fecha relativa con tooltip absoluto. CTA tertiary "Registrar pago".
- **Entregas en tránsito (cols 1–6, row 2):** card con timeline horizontal de 3 entregas. Cada item: avatar tienda + nombre corto + chip de estado (pill `radius-pill` con `accent/16% bg + accent text`) + fecha esperada relativa.
- **Pre-órdenes activas (cols 7–12, row 2):** card lista densa de 5 últimas pre-órdenes (filas 36px), hover reveal con peek panel trigger.
- **Feed (cols 1–12, row 3):** "Actividad reciente" — timeline vertical estilo Plain, eventos tipados (pago, entrega, edición, cancelación) con icono, tienda, monto, timestamp relativo, divider sutil entre días.

### Layout mobile (360px)

Stack vertical. Top: AppBar `64px` con logo glyph izquierda + IconButton command palette derecha. Sticky content header con título.

1. **Hero card** full-width `surface-elevated`, padding `p-6`, radius `2xl`. Mismo contenido del bento hero pero `Display 40` en lugar de `56`. Mini-stats strip se hace scroll-x con snap.
2. **Próximo pago card** full-width.
3. **Entregas en tránsito** scroll-x horizontal de cards 280×140.
4. **Pre-órdenes activas** lista vertical compacta (54px row, doble línea: tienda + total / fecha + estado).
5. **Feed** timeline vertical completo, paginado.

Bottom: tab bar flotante de 4 íconos (Inicio, Pedidos, Tiendas, Perfil) + FAB "+" sobreimpuesto al centro. Sheet-based "Nuevo" abre con stops Vaul-style.

### Microinteracciones

1. **Card hover (desktop):** `--motion-fast` translate-y -1px + state layer 6% + border `border-strong`. Sin sombra agregada.
2. **Shared element list→detail:** click en pre-orden activa view-transition con `view-transition-name: order-${id}`. La card morfa al header del detalle. Tipografía y código mono se mantienen estables.
3. **Optimistic payment add:** la card hero recalcula localmente — el progress bar anima de X% a Y% con `linear() spring 280ms`, número con counter animation, mini-stats actualizan. Si server falla, revert + toast Sonner _"No pudimos guardar el pago. Reintenta."_

### Estados

- **Empty (sin pre-órdenes):** hero card sustituida por empty state geométrico con CTA "Crear primer pedido". Resto del bento se reemplaza por skeleton de instrucciones tipo "Aquí verás...".
- **Loading:** skeletons que copian la geometría exacta. Shimmer `--motion-slow` sutil con `oklch(...)` 4% alpha overlay.
- **Error en bento individual:** card específica con mensaje + reintentar, resto del bento sigue funcional.

### Light vs dark

- **Light:** lienzo `#F8F9FB`, cards `#FFFFFF` con sombra `elevation-1`. Body editorial italic en `#181A22`. Accent `#5E66D3` para CTAs y progress bar.
- **Dark:** lienzo `#0C0D11`, cards `#13141A` con `border` 1px. Body editorial en `#F2F4F7` con peso variable -50. Accent `#9098F3` aclarado para mantener contraste 6.4:1.
- Glow accent del 8% en borde sólo en card activa (focus-within).

## 1.13 Anti-patrones (no hacer)

- Mascot panda en cada esquina.
- Confeti en pago registrado.
- Sombra fuerte tipo neumorfismo.
- Gradients de identidad.
- Más de 1 acento de color simultáneo.

## 1.14 Riesgos de implementación

- Tipografía Tiempos Headline / Editorial New es de pago. Alternativa libre: **Newsreader** o **Source Serif 4** (italic 400). Decidir antes de S3.
- View Transitions cross-document requiere Next.js App Router con cache-control adecuado y `data-` para preservación de scroll. Validar en S2.
- Density alta + tabular nums obliga a font-loading optimizado (`font-display: swap` con metric override). Detalle técnico para S4.
- Editorial italic en dark puede sentirse "afectado" si el accent no está bien calibrado. Validar con usuarios reales en S6.

---

# Dirección 2 — Neon Drop Floor

> _"Drop Hunter"_: la app que vibra cuando llega el drop.

## 2.1 Concepto narrativo

El coleccionista 18–25 que vive de los drops, los countdowns, los "JUST DROPPED". Y2K + neo-brutalism híbrido: gradientes Oklch largos, glow controlado, tipografía variable display, badges en mono uppercase con offset shadow físico. Mascot panda chrome 3D con dos lighting setups, presente en momentos ceremoniales. Dark hero pulsante. La app se siente como **un floor de drops** — nervio eléctrico, motion físico, celebración cuando el pago se registra.

## 2.2 Mood board verbal

- **POPMART app** (8.7): drops, countdowns, blind box reveal con confeti+escala+sonido+haptic.
- **Vercel Ship / Hyperplane** (3.x del trends agent): neo-brutalism saturado con cyan/magenta eléctricos.
- **Gumroad / Manifesto.so** (8.3): bordes chunky, sombra offset dura, paleta saturada, type contundente.
- **Y2K revival / chrome type** (8.5): gradientes largos, glow, grain texture, type variable display.
- **Spline 3D / Vercel illustrations** (8.4): mascot 3D con rim light en dark.
- **Cash App** (1.4): tab bar elevado central, balance display 60–80pt.
- **Sonner + Vaul** (3.5, 3.6): toasts con motion físico para celebrar.

## 2.3 Modo hero

**Dark.** Justificación absoluta: Y2K, chrome, glow y 3D rim-light son nativos del fondo oscuro. El neon vibra sobre carbón. En light la dirección se reinterpreta como "showroom de día" con paleta desaturada (chrome → lavanda pastel, glow → halo suave) — válida pero no es la postal.

## 2.4 Paleta semántica

Espacio: **OKLCH**. Acentos en `gamut: P3` cuando se renderizan en pantallas P3.

| Token                            | Light                                                                                                         | Dark                                                                                                          | Contraste sobre bg        | Uso                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------- | --------------------------- |
| `--background`                   | `oklch(98% 0.012 320)` ≈ `#FBF6FA`                                                                            | `oklch(11% 0.025 295)` ≈ `#0A081A`                                                                            | —                         | lienzo                      |
| `--surface`                      | `oklch(95.5% 0.018 320)` ≈ `#F1E8ED`                                                                          | `oklch(15% 0.03 295)` ≈ `#110F22`                                                                             | —                         | card base                   |
| `--surface-elevated`             | `oklch(100% 0 0)`                                                                                             | `oklch(19% 0.034 295)` ≈ `#16142D`                                                                            | —                         | card activa, modal          |
| `--surface-glow`                 | gradient `oklch(96% 0.02 320)` → `oklch(96% 0.02 195)`                                                        | gradient `oklch(15% 0.05 295)` → `oklch(18% 0.06 195)`                                                        | —                         | hero, splash, achievements  |
| `--border`                       | `oklch(88% 0.012 320)` ≈ `#DCD2DA`                                                                            | `rgba(180, 130, 255, 0.10)`                                                                                   | 3.2:1                     | divider                     |
| `--border-strong`                | `oklch(20% 0.04 320)` ≈ `#28202A` (negro tinta)                                                               | `rgba(180, 130, 255, 0.22)`                                                                                   | 4.6:1                     | brutalism stroke, focus     |
| `--text-primary`                 | `oklch(20% 0.04 320)` ≈ `#28202A`                                                                             | `oklch(96% 0.012 320)` ≈ `#F4ECF1`                                                                            | 14.8:1 / 14.2:1           | body                        |
| `--text-secondary`               | `oklch(48% 0.04 320)` ≈ `#776276`                                                                             | `oklch(74% 0.025 320)` ≈ `#B6ACB3`                                                                            | 7.0:1 / 8.4:1             | meta                        |
| `--text-muted`                   | `oklch(62% 0.025 320)` ≈ `#9D8F9C`                                                                            | `oklch(56% 0.02 320)` ≈ `#7E7480`                                                                             | 4.5:1 / 4.6:1             | timestamps                  |
| `--accent-magenta`               | `oklch(60% 0.24 340)` ≈ `#D63CA0`                                                                             | `oklch(74% 0.21 340)` ≈ `#FA72C5`                                                                             | 4.6:1 / 6.7:1             | primary CTA                 |
| `--accent-cyan`                  | `oklch(70% 0.18 215)` ≈ `#3BB1D0`                                                                             | `oklch(82% 0.16 215)` ≈ `#62D6F0`                                                                             | 3.4:1 / 7.1:1             | secondary, links, focus     |
| `--accent-lime`                  | `oklch(82% 0.21 130)` ≈ `#A2E03F`                                                                             | `oklch(86% 0.22 130)` ≈ `#B8EE63`                                                                             | 3.5:1 / 11+:1 (UI grande) | success eléctrico, drop CTA |
| `--accent-foreground-on-magenta` | `#FFFFFF`                                                                                                     | `oklch(15% 0.06 340)` ≈ `#2B0E1F`                                                                             | 8+:1                      | label sobre magenta         |
| `--success`                      | `oklch(56% 0.16 152)` ≈ `#1F9762`                                                                             | `oklch(76% 0.17 152)` ≈ `#67DC9E`                                                                             | 4.7:1 / 7.5:1             | pago / llegada              |
| `--warning`                      | `oklch(70% 0.17 70)` ≈ `#D8902F`                                                                              | `oklch(82% 0.16 70)` ≈ `#F1AE56`                                                                              | 3.4:1 / 8+:1              | alerta drop, vencido        |
| `--destructive`                  | `oklch(56% 0.22 22)` ≈ `#CB3F2F`                                                                              | `oklch(72% 0.20 22)` ≈ `#F0786A`                                                                              | 5.4:1 / 6.1:1             | delete, sold out            |
| `--focus-ring`                   | `oklch(70% 0.18 215 / 0.7)` cyan                                                                              | `oklch(82% 0.16 215 / 0.75)` cyan                                                                             | ≥3:1                      | focus-visible eléctrico     |
| `--gradient-hero`                | `linear-gradient(118deg, oklch(78% 0.16 215 / 0.18), oklch(70% 0.22 340 / 0.20), oklch(82% 0.21 130 / 0.16))` | `linear-gradient(118deg, oklch(45% 0.18 215 / 0.30), oklch(40% 0.22 340 / 0.32), oklch(50% 0.18 130 / 0.22))` | —                         | hero, splash                |

## 2.5 Type system

- **Stack:** **Aeonik Pro** (display geométrica con 'a' doble piso) o alternativa libre **Sora Variable** para display y body. **JetBrains Mono Variable** para badges, IDs, countdowns. **Fraktion Mono** opcional para pixel-feel en tags.
- **Display chrome:** Sora Variable wght 800 + `font-feature-settings: "ss03"` con efecto chrome aplicado vía mask + gradient (no font face propietaria).
- **Escala:** Display 64/72 (clamp 44→64), Title 32/40, Subtitle 22/28, Body 15/22, Caption 13/18, Mono-display 18/22, Mono 13/18.
- **Tracking:** `-0.03em` display chrome, `0` body, `+0.08em` mono uppercase badges, `-0.01em` Title.
- **Tabular nums** obligatorio en cifras.
- **Modo:** en dark display chrome usa gradient `cyan→magenta→lime` en `clip-path: text`, en light el mismo gradient se desatura 30%.

## 2.6 Spacing y radius

- **Spacing scale (rem):** 0.125, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12, 16. Más generosa en hero/splash.
- **Radius scale:** `xs 2`, `sm 4`, `md 6`, `lg 10`, `xl 14`, `2xl 20`, `pill 9999`. Brutalism prefiere radius bajos (2–6) en CTAs y badges; cards principales `lg`/`xl`.
- **Brutalism stroke:** `border: 1.5px solid var(--border-strong)` en CTAs, badges. En light esto es negro tinta `#28202A`. En dark, magenta apagado.

## 2.7 Elevation language

**Light:**

- `elevation-1`: stroke 1.5px + offset shadow `4px 4px 0 var(--border-strong)` (brutalism). En cards de lista: `0 1px 2px rgba(40,32,42,0.06)`.
- `elevation-2`: card activa con offset 6px + `0 8px 16px rgba(40,32,42,0.08)` underneath.
- `elevation-3`: modal con `0 24px 48px rgba(40,32,42,0.18)` + grain texture overlay 2% opacity.

**Dark:**

- `elevation-1`: surface flat + 1px `border` magenta-violet tint.
- `elevation-2`: `surface-elevated` + `inset 0 1px 0 rgba(255,255,255,0.08)` + `box-shadow: 0 0 0 1px var(--border-strong), 0 0 24px -8px var(--accent-cyan / 0.32)` (glow lateral cyan controlado).
- `elevation-3`: doble-borde (1px outer cyan + 1px inner magenta) + radial glow `oklch(70% 0.22 340 / 0.18)` detrás.

Brutalism offset shadow en dark **NO** se usa (no hay luz que proyecte) — se sustituye por **doble stroke desplazado** (línea cyan offset 4px detrás de la línea principal).

## 2.8 Motion language

Mismos 6 tokens que Dirección 1, recalibrados:

| Token                   | Valor                                        | Uso                                  |
| ----------------------- | -------------------------------------------- | ------------------------------------ |
| `--motion-fast`         | 140ms                                        | hover, focus, toggle                 |
| `--motion-base`         | 320ms                                        | sheet, modal, transition             |
| `--motion-slow`         | 600ms                                        | celebración drop, achievement unlock |
| `--ease-emphasis`       | `cubic-bezier(0.2, 0, 0, 1)`                 | opacity/color                        |
| `--ease-out-expressive` | `linear()` spring stiff (mayor stiffness)    | enters, sheet                        |
| `--ease-bounce`         | `linear()` spring bounce 0.32 (más juguetón) | celebraciones, mascot                |

**Qué se anima:**

- **Pulso del countdown:** scale 1→1.02 cada segundo cuando faltan <60s para drop.
- **Ripple on press:** botones primarios con ripple animation desde tap point, color `--accent-cyan / 30%`.
- **Glow on hover:** cards activas crecen `box-shadow: 0 0 24px var(--accent-magenta / 0.32)` en `--motion-fast`.
- **Drop reveal:** al registrar pago completo o entrega completa, mascot panda 3D entra con scale 0.5→1 spring bounce + confeti (paleta tricromo) + haptic + Sonner toast con offset.
- **View Transitions:** shared element list→detail con escala+morph del badge "JUST DROPPED" o estado.
- **Background gradient:** `--gradient-hero` con animación CSS `background-position` infinita sutil `60s linear` en hero del dashboard.
- **Pull-to-refresh Vaul-style:** físico real con bounce, panda 3D estirándose en el rebote.

`prefers-reduced-motion` → desactiva pulso, glow, gradient animation, mascot motion. Conserva fade y slide.

## 2.9 Iconografía

- **Set principal:** **Phosphor Bold** (peso 1.5px stroke variable) — más juguetón que Lucide, encaja con la energía Y2K.
- **Set complementario:** Iconografía 3D chrome custom para hitos (paquete dropped, pago completed, drop incoming) en formato Lottie/exported PNG.
- **Estilo:** outline default, filled en estado active. Tamaño 16/20/24/32/48.
- **En dark:** stroke con leve glow `filter: drop-shadow(0 0 6px currentColor / 0.4)` en íconos activos.

## 2.10 Mascot, ilustración, empty states

**Panda chrome 3D — protagonista en momentos ceremoniales.**

- **Set de poses:** durmiendo (sin compras), watching the drop (countdown <60s), unboxing (entrega), proud (colección crece), confused (error/empty), incognito (perfil cerrado).
- **Lighting:** dos setups por pose — light usa luz cálida con sombras blandas pastel, dark usa rim light cyan-magenta + ambient violet alto.
- **Tech:** assets 3D renderizados en Spline o Blender, exportados a PNG `@2x/@3x` + Lottie para idle animation. NO Spline runtime en producción (performance).
- **Glyph:** versión flat 2D del panda como avatar/glyph en headers cuando la 3D no tiene espacio.
- **Empty states:** mascot al frente con copy juguetón y CTA brillante.
- **Splash/loaders:** chrome type "PandaTrack" + glow lateral + gradient animado.

**Empty state ejemplos:**

- Pedidos: panda durmiendo con un Z gigante. _"Sin pre-órdenes. ¿Listo para el primer drop?"_ CTA neon "Crear pedido".
- 404: panda incognito con lupa. _"Esto no existe. Vuelve al floor."_

## 2.11 Voice & tone

Energético, joven, slang moderado, primera persona del panda en momentos clave. Ejemplos:

- Empty pedidos: _"Sin pre-órdenes. ¿Listo para el primer drop?"_
- Countdown <60s: _"60s. Prepara la cartera."_
- Pago full: _"BOOM. Pre-orden pagada. ✨"_ (panda confeti + toast)
- Discrepancia modal: _"La cuenta no cuadra. ¿Dejamos el total que pusiste o usamos la suma?"_
- Error 500: _"Se nos cayó algo. Reintenta y avisamos al panda."_
- Confirmación destructiva: _"¿Borrar este pedido? Sus pagos también se van."_

Locales `es` con voltaje, `en` con voltaje paralelo (POPMART/StockX vibe).

## 2.12 Sample del Dashboard

### Layout desktop (≥1024px)

Sidebar 240px collapsable. Background con `--gradient-hero` aplicado en blur 80px sobre `--background` para ambient. Main `max-w-6xl`.

Bento grid 12 cols, gap-6:

- **Drop Hero (cols 1–12, row 1):** card `surface-elevated` `radius-2xl`, padding `p-8`, doble-borde glow. Eyebrow mono uppercase `--accent-cyan`: "PRÓXIMO DROP". Display chrome 64pt: nombre del drop o monto (`$1,247.80 USD`). Mini countdown mono-display `02d 14h 22m` con pulso si <60s. Strip de chips horizontal: estado emocional ("VIBE: cargado", "PAGADO 67%", "ENTREGAS: 2 EN CAMINO").
- **Pre-órdenes activas (cols 1–8, row 2):** lista de cards horizontales con tienda + producto + total + chip de estado neon + CTA primario "+ pago" en magenta.
- **Próximo pago (cols 9–12, row 2):** card vertical con avatar tienda + display 32pt monto + fecha relativa + CTA cyan "Pagar ahora" con ripple on press.
- **Drop floor (cols 1–12, row 3):** scroll horizontal de cards 220×280 que muestran las próximas pre-órdenes con countdown individual y mini-chart de % pagado. Cada card con doble-borde y micro-glow al hover.
- **Activity feed (cols 1–12, row 4):** timeline vertical más juguetón que Dirección 1 — eventos con micro-iconos color, agrupados por día con sticky headers `Caption mono uppercase`.

### Layout mobile (360px)

Stack:

1. **Drop Hero card** full-width, padding `p-6`, radius `2xl`. Display chrome `44pt` mobile. Countdown estable arriba derecha. CTA primario neon abajo "Pay $X now".
2. **Pre-órdenes activas** scroll horizontal con snap. Cada card 240×140.
3. **Próximo pago** card full-width.
4. **Drop floor** scroll horizontal.
5. **Activity feed** vertical paginado.

Bottom: tab bar flotante 4 íconos + FAB central elevado **con halo magenta** (Cash-style) para "Nuevo".

### Microinteracciones

1. **Ripple on press en CTA primario:** desde tap point, ripple cyan 30% expand + accent fill darken. Duration `--motion-fast`.
2. **Glow on hover card:** `box-shadow: 0 0 32px var(--accent-magenta / 0.28)` con scale 1.01. Duration `--motion-fast` `--ease-emphasis`.
3. **Drop reveal post-pago full:** mascot panda 3D entra desde abajo (spring bounce `--motion-slow`), confeti tricromo, Sonner toast magenta con texto chrome, haptic doble. Si reduce-motion → fade simple.
4. **Countdown pulso:** cuando <60s, mono display scale 1↔1.02 cada segundo + accent cyan flash 80ms.

### Estados

- **Empty:** Drop Hero card sustituida por panda durmiendo + copy juguetón + CTA "Crear primer pedido". Resto del bento se transforma en "lo que verás aquí".
- **Loading:** skeletons con shimmer cyan→magenta→lime gradient (más vibrante que en Dir 1).
- **Error:** card en `--destructive` border + ícono panda confused + retry CTA.

### Light vs dark

- **Light:** background `#FBF6FA`, cards `#F1E8ED` con stroke negro tinta `#28202A` (brutalism). CTA primario magenta `#D63CA0` con offset shadow físico `4px 4px 0`. Display chrome desaturado.
- **Dark:** background `#0A081A`, cards `#110F22` con border magenta-violet tint. CTA primario magenta `#FA72C5` con doble-borde y glow lateral cyan. Display chrome con gradient cyan→magenta→lime full saturation. Mascot 3D con rim light cyan.

## 2.13 Anti-patrones (no hacer)

- Brutalism aplicado a tablas o forms largos (sólo CTAs, badges, celebraciones).
- Glass + brutalism en la misma superficie.
- Y2K kitsch (Comic Sans, paletas saturadas mal calibradas, gradients RGB sin Oklch).
- Mascot panda en cada pantalla.
- Confeti permanente.
- Glow excesivo (mata batería en OLED).

## 2.14 Riesgos de implementación

- **Performance**: gradients + glow + 3D mascot puede ser pesado. Audit de Lighthouse obligatorio en S6. Lottie en lugar de Spline runtime.
- **Accesibilidad**: paleta saturada requiere checks AA estrictos en cada combinación. Algunos accents (lime sobre dark, cyan sobre light) sólo cumplen AA en UI grande — no usar como texto de body.
- **Audiencia split**: dirección polariza. Hace match exacto con drop hunters / streetwear / hype, puede alienar coleccionistas más calmados (manga, vinyl).
- **Chrome type**: requiere mask CSS bien pulida; en browsers viejos degrada a accent flat. Validar fallback.
- **Reduce-motion**: la dirección depende fuerte de motion. Asegurar que el estado reduced sigue siendo emocional (sin matar la dirección).

---

# Dirección 3 — Soft Garden

> _"Caretaker"_: el coleccionista que cuida su jardín.

## 3.1 Concepto narrativo

PandaTrack como **un jardín que el coleccionista cuida**. Cada categoría es un personaje 3D suave (figura, vinyl, manga, anime merch, plush, trading card). Bottom sheets con física real, glass contenido, paleta candy saturada en light, paleta nocturna cálida en dark. Editorial cálido para hero numbers. La mascota panda es un caretaker discreto que aparece como avatar del producto pero deja protagonismo a los personajes-categoría. La dopamina viene del **cuidado** y la **personalidad**, no del nervio o la densidad.

## 3.2 Mood board verbal

- **Copilot Money** (2.3): categorías como personajes, calidez ilustrativa con seriedad financiera.
- **Cash App** (1.4): tab bar central elevado, balance display 60–80pt con peso emocional.
- **Spline 3D / Vercel illustrations / Arc onboarding** (8.4): clay 3D con dos lighting setups.
- **POPMART app** (8.7): drops con celebración, paleta candy.
- **Apple HIG iOS 18+** (Materials, springs): glass contenido con vibrancy, springs `duration + bounce`.
- **Letterboxd** (4.5): grid de "posters" + listas curadas + activity feed.
- **Vaul + Sonner** (3.5, 3.6): bottom sheet con stops, toasts apilados.
- **Notion mascots / Bluesky butterfly** (8.1): personalidad tipográfica/cromática + mascot puntual.

## 3.3 Modo hero

**Light.** Justificación: la calidez del jardín vive en la luz natural. La paleta candy, los personajes 3D, el papel respirando — todo se siente más coherente sobre fondo claro. Dark es ciudadano de primera clase reinterpretado como **"noche del jardín"**: paleta cálida nocturna, 3D con rim light suave, glow muy controlado. No es light invertido — es otra hora del día del mismo lugar.

## 3.4 Paleta semántica

Espacio: **OKLCH**.

| Token                 | Light                                               | Dark                                                | Contraste sobre bg | Uso                     |
| --------------------- | --------------------------------------------------- | --------------------------------------------------- | ------------------ | ----------------------- |
| `--background`        | `oklch(98.5% 0.012 85)` ≈ `#FBF7EE` (papel cálido)  | `oklch(16% 0.022 35)` ≈ `#1A1311` (jardín nocturno) | —                  | lienzo                  |
| `--surface`           | `oklch(100% 0 0)` ≈ `#FFFFFF`                       | `oklch(20% 0.024 35)` ≈ `#221B19`                   | —                  | card base               |
| `--surface-elevated`  | `oklch(99% 0.008 85)` ≈ `#FCF8F0`                   | `oklch(24% 0.026 35)` ≈ `#2A2220`                   | —                  | sheet, modal            |
| `--surface-overlay`   | rgba(255,255,255,0.78) + blur 24px                  | rgba(34,27,25,0.78) + blur 24px                     | —                  | sheet, popover, tab bar |
| `--border`            | `oklch(91% 0.012 85)` ≈ `#E7DFCF`                   | `rgba(255, 220, 200, 0.10)`                         | 3.1:1              | divider                 |
| `--border-strong`     | `oklch(82% 0.018 85)` ≈ `#CDC1A8`                   | `rgba(255, 220, 200, 0.20)`                         | 4.5:1              | input, card outline     |
| `--text-primary`      | `oklch(22% 0.025 35)` ≈ `#2A1F1B`                   | `oklch(96% 0.012 85)` ≈ `#F4ECDA`                   | 14.6:1 / 14.0:1    | body                    |
| `--text-secondary`    | `oklch(48% 0.022 35)` ≈ `#7A615A`                   | `oklch(76% 0.018 85)` ≈ `#C2B59B`                   | 6.7:1 / 8.1:1      | meta                    |
| `--text-muted`        | `oklch(62% 0.018 35)` ≈ `#A18B82`                   | `oklch(58% 0.018 85)` ≈ `#8E7E63`                   | 4.6:1 / 4.6:1      | timestamps              |
| `--accent`            | `oklch(68% 0.18 25)` ≈ `#E0673E` (terracota cálida) | `oklch(78% 0.16 25)` ≈ `#F3946D`                    | 4.7:1 / 6.0:1      | primary CTA             |
| `--accent-foreground` | `#FFFFFF`                                           | `oklch(18% 0.05 25)` ≈ `#241310`                    | 8+:1               | label sobre accent      |
| `--success`           | `oklch(60% 0.14 152)` ≈ `#3CA77B`                   | `oklch(76% 0.16 152)` ≈ `#67DC9E`                   | 4.5:1 / 7.4:1      | pago, llegada           |
| `--warning`           | `oklch(72% 0.16 75)` ≈ `#D89A3C`                    | `oklch(82% 0.15 75)` ≈ `#F0B560`                    | 3.5:1 / 8+:1       | atención                |
| `--destructive`       | `oklch(56% 0.20 25)` ≈ `#C2402F`                    | `oklch(72% 0.18 25)` ≈ `#EE7A65`                    | 5.4:1 / 5.9:1      | delete, error           |
| `--focus-ring`        | `oklch(68% 0.18 25 / 0.55)`                         | `oklch(78% 0.16 25 / 0.65)`                         | ≥3:1               | focus-visible           |

**Paleta categórica** (los personajes-categoría tienen su color y el chrome respeta este sistema):

| Categoría     | Personaje          | Light                               | Dark                  |
| ------------- | ------------------ | ----------------------------------- | --------------------- |
| Figures       | Lila la lucha      | `oklch(72% 0.17 350)` rosa lila     | `oklch(80% 0.15 350)` |
| Vinyl         | Virgilio el vinilo | `oklch(70% 0.16 280)` violeta       | `oklch(80% 0.14 280)` |
| Manga         | Mango el manga     | `oklch(74% 0.16 50)` durazno        | `oklch(82% 0.15 50)`  |
| Anime merch   | Aria la anime      | `oklch(72% 0.18 195)` cyan suave    | `oklch(82% 0.16 195)` |
| Trading cards | Tato el card       | `oklch(74% 0.17 130)` lima pastel   | `oklch(82% 0.16 130)` |
| Plush         | Pánfilo el plush   | `oklch(76% 0.13 35)` durazno cálido | `oklch(82% 0.13 35)`  |

Cada personaje sigue las mismas reglas WCAG AA. Su color tiñe el chip de categoría, el avatar circular y el aro del item en lista, no toda la card.

## 3.5 Type system

- **Stack:** **Söhne** o alternativa libre **General Sans Variable** para body y display. **Fraunces Variable** (italic 12pt opt) para hero numbers cálidos. **Söhne Mono** o **JetBrains Mono** para IDs.
- **Escala:** Display 56/64 (clamp 38→56), Title 30/38, Subtitle 22/28, Body-L 17/26, Body 15/22, Caption 13/18, Mono-L 15/22, Mono 13/18.
- **Pesos:** body 400/500/600. Display Fraunces italic 400 con opt 12 (suaviza serifas). Mono 500.
- **Tracking:** `-0.015em` display, `0` body, `+0.04em` mono uppercase pequeño.
- **Tabular nums** obligatorio.
- **Modo:** en dark display Fraunces sube +30 wght para compensar (wght variable). En light papel cálido, body con +1% L para integrarse con `oklch(98.5% 0.012 85)`.

## 3.6 Spacing y radius

- **Spacing scale (rem):** 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8. Mobile-first: el valor base mobile es `0.75rem` para reducir aire excesivo en pantallas chicas.
- **Radius scale:** `xs 6`, `sm 10`, `md 14`, `lg 18`, `xl 24`, `2xl 32`, `pill 9999`. Soft Garden vive de radius generosos. Cards `lg` o `xl`. Sheet `2xl` superior. Avatares `pill`. Inputs `md`.

## 3.7 Elevation language

**Light** (papel + shadows blandas color marca):

- `elevation-1`: `0 2px 8px rgba(224, 103, 62, 0.06)` (terracota muy diluida)
- `elevation-2`: `0 8px 24px rgba(224, 103, 62, 0.10), 0 2px 6px rgba(34,27,25,0.04)`
- `elevation-3`: `0 24px 48px rgba(224, 103, 62, 0.14), 0 4px 12px rgba(34,27,25,0.06)`
- Cards de lista: shadow + border-strong sutil para definición.

**Dark** (jardín nocturno: glow cálido, no negro):

- `elevation-1`: surface flat + `border` 1px.
- `elevation-2`: `surface-elevated` + `inset 0 1px 0 rgba(255,220,200,0.06)` + `0 0 32px -16px var(--accent / 0.18)` (glow cálido sutil).
- `elevation-3`: surface-overlay (blur 24 + 78% alpha) + `0 0 64px -24px var(--accent / 0.32)` halo cálido.

**Glass contenido** (Apple Liquid Glass-style):

- Bottom sheet header: `backdrop-filter: blur(24px) saturate(180%)` + tint sólido.
- Toast inline: blur + tint del estado (success/error/info).
- Tab bar mobile flotante: glass con tinte de la sección activa.

## 3.8 Motion language

Mismos 6 tokens, calibrados a "spring suave juguetón":

| Token                   | Valor                                       | Uso                       |
| ----------------------- | ------------------------------------------- | ------------------------- |
| `--motion-fast`         | 200ms                                       | hover, focus              |
| `--motion-base`         | 360ms                                       | sheet, modal              |
| `--motion-slow`         | 560ms                                       | mascot idle, achievement  |
| `--ease-emphasis`       | `cubic-bezier(0.2, 0, 0, 1)`                | opacity/color             |
| `--ease-out-expressive` | spring `duration 0.5s, bounce 0.15` (Apple) | sheet, mascot enter       |
| `--ease-bounce`         | spring `duration 0.6s, bounce 0.28`         | celebración, mascot dance |

**Qué se anima:**

- **Bottom sheet con stops:** Vaul-style. Drag handle visible, peek/half/full, velocity del gesto alimenta velocidad del spring, magnet snap al soltar.
- **Pull-to-refresh:** elastic con panda regándose el jardín o estirándose. Refetch real.
- **Categoría-personaje idle:** los personajes 3D respiran (scale 0.99↔1.01) cada 4s, con stagger entre categorías visibles.
- **Card hover (desktop):** scale 1.02 + lift -2px + soft shadow expand. `--motion-fast`.
- **View Transitions list→detail:** card morfa al header del detalle con shared element, el personaje categórico se mantiene como punto de continuidad.
- **Achievement (entrega completa):** mascot panda + personaje categoría celebrando juntos, confeti pastel, Sonner toast con tinte success.
- **Glass blur on scroll:** tab bar mobile aumenta blur de 16→32px al scroll, tint se ajusta.

`prefers-reduced-motion: reduce` → desactiva idle de personajes, parallax, pull-to-refresh elastic. Conserva fade y slides estructurales.

## 3.9 Iconografía

- **Set principal:** **Phosphor Duotone** o **Lucide rounded** (esquinas suaves coherentes con radius generosos). Stroke 1.75, esquinas redondeadas.
- **Personajes-categoría:** ilustraciones 3D Spline rendered → PNG/Lottie. Tamaños 24/40/64/96/128.
- **Estilo:** outline + esquinas suaves. Filled en active. Color via `currentColor` para íconos genéricos; los personajes-categoría con paleta propia.

## 3.10 Mascot, ilustración, empty states

**Sistema de personajes-categoría + panda caretaker.**

- **Panda caretaker:** aparece como avatar del producto en header (logo), en achievements junto al personaje-categoría, en empty states con copy cálido. Tiene poses caretaker: regando, abrazando un paquete, sonriendo, durmiendo en hojas.
- **Personajes-categoría:** Lila, Virgilio, Mango, Aria, Tato, Pánfilo. Cada uno con clay 3D body + paleta propia + microexpresiones. Aparecen en chips de categoría, avatar de item, hero del jardín.
- **Lighting:** light = luz cálida natural con sombras blandas; dark = luna llena cálida con rim light suave color marca.
- **Tech:** Spline render → PNG `@2x/@3x` + Lottie idle. NO Spline runtime.
- **Empty states:** panda + personaje contextual.

**Empty state ejemplos:**

- Sin pre-órdenes: panda regando un macetero vacío + Lila la lucha asomada. _"Tu jardín espera. Siembra la primera pre-orden."_
- Sin tiendas: panda con catálogo en mano. _"Aún no conocemos tus tiendas favoritas. Agrega la primera."_
- 404: panda con linterna + personaje aleatorio. _"Esta esquina del jardín no existe."_

## 3.11 Voice & tone

Cálido, atento, segunda persona, metáfora jardín presente sin saturar. Ejemplos:

- Empty pedidos: _"Tu jardín espera. Siembra la primera pre-orden."_
- Pago confirmado: _"¡Listo! $48,50 USD menos por pagar. 🌱"_
- Discrepancia modal: _"Tu suma no cuadra con el total. ¿Cuál dejamos?"_
- Error 500: _"El jardín se enredó un poco. Reintenta."_
- Confirmación destructiva: _"¿Eliminar este pedido? Sus pagos también se van."_
- Achievement entrega completa: _"¡Llegó! Tu colección creció."_ + animación.

Locale `es` y `en` con paridad cálida.

## 3.12 Sample del Dashboard

### Layout desktop (≥1024px)

Sidebar 240px con personajes-categoría como decoración sutil al fondo (low opacity). Main `max-w-6xl`, padding `px-8 py-10`. Background `papel cálido`.

Bento grid 12 cols, gap-6:

- **Hero (cols 1–8, row 1):** card `surface-elevated` `radius-2xl` con padding generoso `p-10`. Eyebrow caption uppercase: "TU JARDÍN". Display Fraunces italic 56pt: _"Cuidando $1.247,80 USD"_. Subtítulo Body-L: _"de $3.420,00 USD a través de 12 pedidos."_. Strip horizontal de 6 personajes-categoría con count: "🌷 3 figures · 💿 2 vinyls · 📚 4 mangas · …". Mascot panda caretaker pequeño en esquina inferior derecha regando.
- **Próximo pago (cols 9–12, row 1):** card `surface` `radius-xl` con avatar tienda 48px (rounded), display 28pt monto, subtítulo fecha relativa, CTA primario terracota "Pagar ahora".
- **Personajes-categoría grid (cols 1–12, row 2):** 6 cards horizontal scroll con cada personaje-categoría 3D + count + total invertido + chip de "% del jardín". Hover → personaje hace idle de saludo. Click → filtro aplicado.
- **Próximas entregas (cols 1–7, row 3):** lista vertical con avatar tienda + producto + categoría chip color + chip estado + fecha relativa.
- **Activity feed (cols 8–12, row 3):** timeline vertical más cálido — eventos con pequeños iconos pastel + autor (panda o tú) + meta.

### Layout mobile (360px)

Stack cálido:

1. **Hero card** full-width `radius-2xl`, padding `p-6`. Display Fraunces italic 40pt. Strip de personajes scroll-x.
2. **Próximo pago** card.
3. **Personajes-categoría** scroll-x con snap.
4. **Próximas entregas** lista compacta con personaje-categoría como avatar circular (3D mini).
5. **Activity feed** timeline.

Bottom: tab bar flotante glass con 4 íconos (Inicio, Pedidos, Tiendas, Perfil) + FAB central terracota con halo cálido para "Nuevo pedido". Sheet bottom Vaul-style abre.

### Microinteracciones

1. **Card hover:** scale 1.02 + lift -2px + shadow expand cálida. `--motion-fast`.
2. **Personaje-categoría idle:** respiran cada 4s con stagger; al hover desktop se animan más activos (waving).
3. **Bottom sheet:** drag con velocity, magnet a stops peek/half/full. Drag handle siempre visible.
4. **Optimistic payment:** progress bar anima de X% a Y% con `--ease-out-expressive` spring suave; counter de números bouncy gentle. Si server falla: revert + toast Sonner con tono cálido y CTA "Reintentar".
5. **Achievement completa:** sheet bottom sube con panda + personaje-categoría celebrando, confeti pastel, haptic suave, Sonner success.
6. **Glass blur on scroll:** tab bar aumenta blur al scroll para mantener flotante sobre cualquier contenido.

### Estados

- **Empty:** Hero card sustituida por mascot regando + copy invitación. Personajes desvanecidos en background.
- **Loading:** skeletons con shimmer cálido (`oklch(...)` cream). Personajes en silueta low-opacity.
- **Error en bento:** card específica con personaje confused + CTA reintentar.

### Light vs dark

- **Light "jardín de día":** background papel cálido `#FBF7EE`. Cards blanco puro con shadow terracota diluida. Personajes 3D con luz natural amarilla. Display Fraunces italic en marrón cálido. Accent terracota `#E0673E` para CTAs.
- **Dark "noche del jardín":** background `#1A1311` (cálido nocturno, NO negro). Cards `#221B19` con border luz cálida 10% y glow accent sutil. Personajes 3D con rim light luna cálida + ambient violeta-naranja bajo. Accent `#F3946D` aclarado. Glass tab bar con tinte cálido.

## 3.13 Anti-patrones (no hacer)

- Personajes-categoría 3D animados todos a la vez en una pantalla (saturación).
- Glass sobre fondos complejos (foto producto, etc.) sin tint sólido detrás.
- Confeti excesivo en momentos no celebratorios.
- Light invertido a dark sin recalibrar lighting de personajes.
- Voice infantil ("¡yay!", "¡súper!", emoji storm).
- Density baja en listas de 80+ pre-órdenes (cards-pósters gigantes que obligan a scroll infinito).

## 3.14 Riesgos de implementación

- **Pipeline 3D:** producir + mantener 6 personajes con set de poses + 2 lighting setups requiere artist time. Definir alcance MVP en S2 (puede ser 3 personajes + panda en S2/S3, los demás en S6+).
- **Performance glass:** blur 24px sobre área grande es costoso. Limitar a sheets, popovers, tab bar. Tab bar glass requiere `will-change` cuidadoso.
- **Dark mode coherente:** la dirección depende de calibrar bien la "noche del jardín". Si dark se siente como light invertido, falla. Validar con usuarios reales en S6.
- **Audiencia split:** dirección puede sentirse muy "lifestyle" para hype/drop hunters. Es la apuesta más amable.
- **Letra italic Fraunces:** familia open source pero peso italic 12pt opt requiere font-loading con `font-display: swap` y metric override.
- **Personajes-categoría requieren naming + worldbuilding:** Lila/Virgilio/etc. son apuestas de copy/IP. Validar antes de S6.

---

---

# Dirección 4 — Bento Atelier

> _"Curated Workshop"_: la calma de Bento Editorial con un poco de color funcional, formularios con jerarquía y un sistema de íconos sobrio.

**Origen:** evolución de la Dirección 1 después de dos rondas de feedback humano (2026-05-01). Conserva la base de Bento Editorial (calma, densidad, type-driven, sub-200ms, dark hero, sidebar de resumen) y le suma de las otras direcciones sólo lo que la hacía sentir "muy plana": un acento cálido + uno frío para acompañar al indigo primario, formularios con cards de sección bien delimitadas, step indicator explícito con círculos numerados, big choice cards para decisiones primarias. Reemplaza la tipografía italic editorial (Fraunces) por un display sans heavy con tracking apretado. **Sin asistente conversacional dentro del sistema de diseño** — un panda asistente contextual queda fuera del rediseño visual y se trata en un FRD aparte (ver §4.10).

## 4.1 Concepto narrativo

Un **atelier digital del coleccionista** — el espacio curado donde organizas, ordenas y celebras tu colección. Calma de estudio profesional con un punto de calidez que la separa del azul-monocromo de Linear. La paleta tiene tres acentos coordinados (indigo primario + coral cálido + teal frío) que aparecen sólo donde tienen función (CTA primaria, status warm, info/link), nunca como decoración. La identidad categórica vive en **íconos**, no en colores — cada tipo de producto tiene su ícono Lucide (disc, book, sparkles, etc.), y los avatares de tienda muestran logo o, en su ausencia, una letra inicial sobre fondo neutro.

## 4.2 Mood board verbal

- **Linear** + **Plain** + **Height** (heredado de Dir 1): densidad calmada, peek panel, command palette, transiciones sub-200ms.
- **Vercel Geist + Stripe Dashboard** (research §9.5): paleta multi-acento coordinada con tokens semánticos, sin saturación gratuita.
- **Soft Garden** (Dir 3, sólo secciones 3.10 layout + 3.12 sample): big choice cards para decisiones, step indicator con círculos numerados. Se descartan los personajes-categoría con worldbuilding.
- **Lucide Icons** (lucide.dev): set principal del sistema. Stroke 1.75, currentColor, 16/20/24px. Los íconos son los que cargan la identidad categórica, no avatares de colores.
- **Notion empty states** + **Apple SF Symbols outline**: ilustraciones geométricas sobrias y íconos consistentes en peso.

## 4.3 Modo hero

**Dark.** Heredado de Dir 1. La paleta coral + teal en dark suma calidez sin perder seriedad. Light es ciudadano de primera clase con la misma estructura.

## 4.4 Paleta semántica

Espacio: **OKLCH** vía Tailwind v4 `@theme` con `color-mix()`. **Tres acentos coordinados** + paleta categórica de 6 tonos.

### Tokens core

| Token                | Light                                | Dark                                 | Contraste       | Uso                                |
| -------------------- | ------------------------------------ | ------------------------------------ | --------------- | ---------------------------------- |
| `--background`       | `oklch(98.5% 0.006 250)` ≈ `#F8F9FB` | `oklch(13.5% 0.014 260)` ≈ `#0C0E13` | —               | lienzo                             |
| `--surface`          | `oklch(100% 0 0)` ≈ `#FFFFFF`        | `oklch(17% 0.016 260)` ≈ `#13151C`   | —               | card base                          |
| `--surface-elevated` | `oklch(99% 0.005 250)`               | `oklch(20.5% 0.018 260)` ≈ `#191B25` | —               | sheet, modal, hero                 |
| `--surface-warm`     | `oklch(98% 0.012 35)` ≈ `#FBF6F2`    | `oklch(19% 0.022 30)` ≈ `#1F1814`    | —               | acento cálido sutil para secciones |
| `--border`           | `oklch(91% 0.008 250)`               | `rgba(255,255,255,0.07)`             | 3.1:1           | divider                            |
| `--border-strong`    | `oklch(82% 0.012 250)`               | `rgba(255,255,255,0.14)`             | 4.5:1           | input border, card outline         |
| `--text-primary`     | `oklch(18% 0.018 260)`               | `oklch(96% 0.005 250)`               | 16.4:1 / 15.7:1 | body                               |
| `--text-secondary`   | `oklch(42% 0.020 260)`               | `oklch(76% 0.014 250)`               | 8.4:1 / 9.4:1   | meta, labels, captions             |
| `--text-muted`       | `oklch(50% 0.018 260)`               | `oklch(64% 0.014 250)`               | 5.5:1 / 6.0:1   | timestamps, code, eyebrows         |

**Regla AA inviolable post-rev 2:** los tres tokens de texto cumplen WCAG 2.2 AA **incluso para texto pequeño 12–13px** (≥4.5:1). El `--text-muted` se subió de `oklch(60%/56%)` a `oklch(50%/64%)` después del feedback humano del 2026-05-01: en light la versión anterior daba ≈3.5:1 y los timestamps/code/eyebrows se leían mal sobre el lienzo claro. Ningún token nuevo puede caer por debajo de 4.5:1 sobre `--background` y `--surface`.

### Tres acentos coordinados

| Token                   | Light                             | Dark                              | Uso                                                    |
| ----------------------- | --------------------------------- | --------------------------------- | ------------------------------------------------------ |
| `--accent` (indigo)     | `oklch(56% 0.18 268)` ≈ `#5E5EE0` | `oklch(74% 0.16 268)` ≈ `#9B9CF7` | primary CTA, focus, links principales, progress bar    |
| `--accent-warm` (coral) | `oklch(68% 0.16 30)` ≈ `#E07F5C`  | `oklch(78% 0.15 30)` ≈ `#F39E80`  | métrica "próximo pago", badges puntuales, achievements |
| `--accent-cool` (teal)  | `oklch(68% 0.13 195)` ≈ `#3FAFB6` | `oklch(78% 0.12 195)` ≈ `#67D0D7` | links secundarios, tooltips, info inline               |

Los tres se usan **coordinadamente y con función**, no como decoración. Regla: una pantalla típica tiene 1 indigo (acción primaria), 1 coral (status o accent puntual), 1 teal (info o link secundario). Nunca los tres saturados al mismo tiempo en la misma vista. Los accents **NO se usan como color de avatar de tienda ni de chip de categoría** — los avatares son neutros y la categoría se identifica por ícono.

### Paleta categórica — RESERVADA, no es del sistema visible

**Decisión post-feedback (2026-05-01):** la paleta categórica de 6 tonos queda **definida pero no expuesta** como decoración. La identidad de categoría vive en **íconos Lucide**, no en color. La paleta categórica sólo se usa cuando el usuario explícitamente filtra/agrupa por categoría en una vista de análisis, y aún ahí en valores muy desaturados (alfa 8–14% sobre surface) — nunca como dot, avatar o chip lleno.

| Categoría       | Light (sólo para charts/filtros activos) | Dark (idem)           |
| --------------- | ---------------------------------------- | --------------------- |
| `--cat-figures` | `oklch(70% 0.16 350)` rosa               | `oklch(80% 0.14 350)` |
| `--cat-vinyl`   | `oklch(68% 0.16 285)` violeta            | `oklch(80% 0.14 285)` |
| `--cat-manga`   | `oklch(72% 0.16 50)` durazno             | `oklch(82% 0.14 50)`  |
| `--cat-anime`   | `oklch(70% 0.16 195)` cyan suave         | `oklch(82% 0.14 195)` |
| `--cat-cards`   | `oklch(72% 0.17 130)` lima               | `oklch(82% 0.15 130)` |
| `--cat-plush`   | `oklch(74% 0.13 35)` durazno cálido      | `oklch(82% 0.12 35)`  |

**Receta de avatar de tienda** (post-feedback 2026-05-01, ajuste anti-plano):

Una sola receta para toda la app, sin paleta categórica:

- **(1) Si existe logo de la tienda:** se renderiza en círculo (mobile) / `radius-lg` (desktop, 12px). Sin tinte de fondo.
- **(2) Si no hay logo:** fondo `color-mix(in oklch, var(--accent) 14%, var(--surface-elevated))` (sutil tinte indigo), borde `color-mix(in oklch, var(--accent) 28%, var(--border))`, **letra inicial en `var(--accent)`** con `font-display 600`.

Esto da identidad visual sin caer en la paleta categórica — el avatar siempre dice "PandaTrack indigo". El tinte 14% mantiene el avatar legible y discreto, el 28% del borde sirve para que el avatar no se confunda con la card cuando son del mismo plano. Ratio de contraste de la letra indigo sobre el background tintado: ≥4.5:1 verificado en ambos modos por construcción del color-mix.

### Status y feedback

| Token           | Light                             | Dark                         | Uso                      |
| --------------- | --------------------------------- | ---------------------------- | ------------------------ |
| `--success`     | `oklch(58% 0.15 152)` ≈ `#3CA77B` | `oklch(74% 0.16 152)`        | pago confirmado, llegada |
| `--warning`     | `oklch(70% 0.16 75)` ≈ `#D89A3C`  | `oklch(82% 0.15 75)`         | atención, vencido        |
| `--destructive` | `oklch(54% 0.21 25)`              | `oklch(70% 0.18 25)`         | delete, error            |
| `--focus-ring`  | `oklch(56% 0.18 268 / 0.55)`      | `oklch(74% 0.16 268 / 0.65)` | focus-visible            |

State layers vía `color-mix(in oklch, var(--text-primary) Xpct, transparent)`: hover 6%/8%, pressed 12%/14%.

### Jerarquía de uso — qué color va dónde (post rev 3, 2026-05-01)

Esta tabla resuelve la duda "¿puedo usar `--accent-warm` acá?". Es la regla del sistema, no una sugerencia. Cualquier uso fuera de esta tabla requiere un ADR en `docs/redesign/decisions/`.

| Token                                             | Tier          | Siempre se usa para                                                             | Sólo se usa para                                                                                                      | Nunca se usa para                                                                  |
| ------------------------------------------------- | ------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `--background`, `--surface`, `--surface-elevated` | **Primary**   | Lienzo + cards en cualquier pantalla                                            | —                                                                                                                     | —                                                                                  |
| `--text-primary`                                  | **Primary**   | Body, headings, valores en cifras, labels activos                               | —                                                                                                                     | Decoración, fondos                                                                 |
| `--text-secondary`                                | **Primary**   | Meta, captions, labels de form, helpers                                         | —                                                                                                                     | Body principal (usar `--text-primary`)                                             |
| `--text-muted`                                    | **Primary**   | Timestamps, code mono, eyebrows uppercase                                       | —                                                                                                                     | Body principal, CTA labels                                                         |
| `--border`, `--border-strong`                     | **Primary**   | Dividers, input borders, card outlines                                          | —                                                                                                                     | —                                                                                  |
| `--accent` (indigo)                               | **Primary**   | Primary CTA, focus ring, links principales, progress bar, avatar fallback tinte | Estado active de big choice cards y chips                                                                             | Decoración pura, dots de eyebrow, icons de categoría (esos van en teal)            |
| `--accent-warm` (coral)                           | **Extra**     | —                                                                               | Métrica "próximo pago" del dashboard, badge de status warm, card de achievement, gradient de progress (con indigo)    | CTAs, links, focus, fondos completos, avatares                                     |
| `--accent-cool` (teal)                            | **Extra**     | —                                                                               | Color por defecto de íconos de categoría, info inline, tooltips, links secundarios cuando coexisten con accent indigo | CTAs primarios, focus ring, cifras                                                 |
| `--success`                                       | **Extra**     | —                                                                               | Pago confirmado, entrega completa, status chip "100% pagado" / "creciendo"                                            | Decoración, fondos extensos                                                        |
| `--warning`                                       | **Extra**     | —                                                                               | Pago vencido, status chip "atrasado N días", métrica "vencidos" del dashboard                                         | CTAs, body text                                                                    |
| `--destructive`                                   | **Extra**     | —                                                                               | Botones de delete, error feedback, métricas con valor negativo                                                        | Decoración, status normal                                                          |
| `--focus-ring`                                    | **Primary**   | Cualquier `:focus-visible`                                                      | —                                                                                                                     | Hover state, decoración                                                            |
| Paleta categórica (`--cat-*`)                     | **Reservada** | —                                                                               | Charts y filtros activos con alfa muy bajo (12–18% sobre surface)                                                     | Dots, avatares, chips llenos, decoración, cualquier UI fuera de un chart explícito |

**Resumen:** los **Primary** son los colores que un dev verá en 95% de las pantallas. Los **Extras** sólo aparecen cuando hay una función específica que los justifica (status, métrica nombrada, info contextual). La **paleta categórica está reservada** para el día que tengamos charts; mientras tanto se queda en los tokens pero no se renderiza.

**Regla de oro:** una pantalla típica usa **3–4 tokens cromáticos visibles máximo** (`--accent` indigo + 1 status + opcionalmente `--accent-warm` o `--accent-cool` para 1 elemento puntual). Si una pantalla tiene 6+ colores visibles a la vez, está rota.

## 4.5 Type system

**Sin itálicas.** El énfasis viene del peso variable + tracking apretado, no de la inclinación.

- **Stack:**
  - **Inter Variable** para body (igual que Dir 1).
  - **Inter Display** (variant del mismo familiar, cortes para títulos grandes) o **Geist Variable** como alternativa para hero numbers y display.
  - **JetBrains Mono Variable** para IDs, badges, eyebrows.
- **Display approach:** weight 700 + `font-feature-settings: "ss01", "cv11"` + tracking `-0.03em`. Esto da contundencia editorial sin recurrir a italic.
- **Escala:** Display 56/64 (clamp 40→56), Title 32/40, Subtitle 22/28, Body-L 17/26, Body 15/22, Caption 13/18, Mono-L 15/22, Mono 13/18.
- **Pesos:** body 400/500/600. Display 700. Mono 500.
- **Tracking:** Display `-0.03em`, Title `-0.02em`, Body `0`, Mono uppercase `+0.08em`.
- **Tabular nums** obligatorio en cifras.
- **Modo:** en dark, body al 96% L (no 100%) para reducir vibración. Display en dark con weight -30 (Inter variable) para compensar engrosamiento óptico. **No hay italic en ningún display.**

## 4.6 Spacing y radius

- **Spacing scale (rem):** 0.125, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12. Igual que Dir 1.
- **Radius scale:** `xs 4`, `sm 6`, `md 8`, `lg 12`, `xl 16`, `2xl 20`, `pill 9999`. Default `md` para inputs/buttons. Section cards `xl`. Sub-cards dentro de section `lg`. Sheets `2xl` superior.
- **Section card padding:** `24px 28px` desktop, `20px` mobile. Más generoso que Dir 1 (que era flat) para que las secciones tengan respiración propia.

## 4.7 Elevation language

**Light** (sombras reales, suaves):

- `elevation-1`: `0 1px 2px rgba(20, 22, 30, 0.04)` — cards de lista
- `elevation-2`: `0 4px 12px rgba(20, 22, 30, 0.06), 0 1px 2px rgba(20,22,30,0.04)` — section cards de formulario, popover
- `elevation-3`: `0 12px 24px rgba(20, 22, 30, 0.08), 0 2px 6px rgba(20,22,30,0.06)` — modal, sheet
- `elevation-4`: `0 24px 48px rgba(20, 22, 30, 0.12)` — assistant bubble expanded, command palette

**Dark** (sin shadow real, elevación por tono + borde + glow accent puntual):

- `elevation-1`: surface flat + border 1px
- `elevation-2`: `surface-elevated` (+3% L) + border-strong 1px + `inset 0 1px 0 rgba(255,255,255,0.04)`
- `elevation-3`: surface-elevated + glow indigo 6% en borde superior
- `elevation-4`: assistant bubble = surface-elevated + halo teal radial sutil 12%

## 4.8 Motion language

Mismos 6 tokens que Dir 1, recalibrados ligeramente:

| Token                   | Valor                                          | Uso                                            |
| ----------------------- | ---------------------------------------------- | ---------------------------------------------- |
| `--motion-fast`         | 150ms                                          | hover, focus, toggle                           |
| `--motion-base`         | 280ms                                          | sheet, modal, page transition, step transition |
| `--motion-slow`         | 480ms                                          | View Transition shared element, achievement    |
| `--ease-emphasis`       | `cubic-bezier(0.2, 0, 0, 1)`                   | opacity, color                                 |
| `--ease-out-expressive` | `linear(0, 0.5, 0.85, 0.97, 1)` (spring suave) | enters espaciales, assistant pop               |
| `--ease-bounce`         | `linear()` (spring bounce 0.18)                | celebración pago/entrega completos             |

**Qué se anima:**

- **Step indicator:** círculo activo con scale 0→1 + accent fill, transition al avanzar paso.
- **Section cards:** entrada al cargar con stagger 40ms entre secciones (fade-in + translate-y 4px).
- **Big choice cards:** hover scale 1.01 + lift -1px + accent border. Click → micro-pulso del border en 200ms.
- **View Transitions list→detail:** card morfa al header del detalle (ver firma propia abajo).
- **Form section reveal:** al entrar a vista, 5 cards aparecen escalonadas en 240ms.
- **Mascota panda:** ver §4.10 (idle, walking, peeking, celebrating, sleeping).

`prefers-reduced-motion` → fade 150ms para todo, sin springs ni stagger ni walking de mascota.

### Firma propia — la transición list→detail (post rev 3, 2026-05-01)

Lo que hace que una app se sienta "esa app y no otra" no es el sub-200ms genérico — es **una transición específica que el usuario aprende a reconocer**. Linear tiene su slide horizontal de 280ms con `cubic-bezier(0.32, 0.72, 0, 1)`. Apple tiene su spring con `bounce 0.15`. La nuestra es:

**La transición canónica `order-card → order-detail`:**

```css
/* en la card de la lista */
.order-card[data-order-id="X"] {
  view-transition-name: order-X;
}

/* en el detalle */
.order-detail-header {
  view-transition-name: order-X;
}

/* la firma */
::view-transition-group(*) {
  animation-duration: 280ms;
  animation-timing-function: linear(0, 0.18, 0.5, 0.78, 0.95, 1.02, 1); /* spring overshoot 0.05 */
}
```

**Reglas de la firma** (TODA navegación list→detail debe cumplirlas):

1. **Duración fija: 280ms.** No 200, no 320. Ni más rápido ni más lento.
2. **Easing único:** `linear()` spring con **overshoot 0.05** (5% más allá del destino, vuelve). Es el sello que el ojo reconoce — sin overshoot se siente plano, con overshoot >0.10 se siente bouncy.
3. **El avatar de la tienda mantiene su tinte indigo continuo** durante la transición. No parpadea, no se re-pinta. Es el "ancla visual" del morph.
4. **El código mono (`PT-002418`) crece de 11px a 13px sin re-render** — animación de `font-size` en el mismo nodo, no fade de uno a otro. Esto evita el "flash" típico.
5. **El chip de status hace una micro-pausa de 40ms en el medio del path** — un "tic" visual entre los 120ms y 160ms. Es el detalle más sutil pero el que vuelve la transición memorable.
6. **No se anima el body de la card** — fade simple. Sólo los 3 elementos identitarios (avatar, código, status) tienen continuidad explícita.

**Por qué importa esta disciplina:** si cada pantalla inventa su transición, la app se siente desordenada aunque cada una sea bonita. Si el usuario ve **siempre la misma transición** entre lista y detalle, en una semana la reconoce como "PandaTrack" sin pensarlo. Es la diferencia entre tener motion y tener firma.

**Anti-patrón:** transiciones únicas por superficie. Easings inventados. Cambiar duración por "esta vez se siente mejor". Transiciones distintas en mobile vs desktop.

## 4.9 Iconografía

- **Set principal:** **Lucide Icons** (lucide.dev). Stroke 1.75, currentColor, tamaños 14/16/20/24/32/40. Es **el** set del sistema — no se mezcla con emojis ni se inventan glyphs custom salvo el panda de marca.
- **Identidad por categoría = ícono Lucide + un solo color.** Cada tipo de producto tiene un Lucide asignado:
  - Figures → `shapes` (o `box` como fallback)
  - Vinyl → `disc`
  - Manga → `book-open`
  - Anime merch → `sparkles`
  - Trading cards → `gallery-thumbnails` (o `spade` semántico)
  - Plush → `package` (o `gift`)

  **Color del ícono de categoría = `var(--accent-cool)` (teal)** en su contenedor por default (post-feedback rev 2 — el `--text-secondary` los hacía sentir muy planos y los confundía con texto deshabilitado). El teal es nuestro acento "informativo/categórico" — los íconos teal son la firma visual de "esto es una clasificación, no un estado". Cuando aparecen inline dentro de un código mono o de meta secundaria, bajan a `--text-muted` para no robar atención al texto. Cuando el ícono está dentro de un chip activo, hereda el color del chip (indigo).

- **Color de íconos genéricos** (nav, acciones de UI, helpers, settings): `--text-secondary` por default → `--text-primary` en hover/active.
- **Color de íconos de status en feed:** Lucide `circle-dollar-sign` para pago en `--accent-warm`, `package-check` para entrega en `--success`, `plus-circle` para creación en `--accent-cool`. Status colors funcionales, no decorativos. El border del cuadro contenedor también toma el color del status al 32% para reforzar legibilidad.
- **Estilo:** outline only por default; filled sólo en estado active del nav.
- **Avatares de tienda:** ver receta completa en §4.4 (tinte indigo 14% + letra indigo o logo). Una sola receta, sin variantes cromáticas categóricas.

## 4.10 Mascota panda — identidad y presencia visual

> **Scope:** este apartado define **sólo la presencia visual** de la mascota — render, estados, animación, posición, reglas de aparición. El **comportamiento conversacional contextual** (qué dice, cuándo lo dice, copy library, triggers, settings de usuario, analytics) **vive en un FRD aparte** (`docs/product/frds/asistente-pan.md` cuando se cree). El sistema de diseño provee el lienzo y los assets; el FRD provee el "qué decir".

### Working name y carácter

- **Nombre:** TBD. Se decide antes de S6. Candidatos para descartar/elegir: Bento, Ito, Boro, Mochi, Tomo, Kuma. La elección final también valida que no choque con marcas o jerga existente en `es/en`.
- **Carácter:** "curador atento del coleccionista" — sabe del tema, no es entrometido, aparece cuando suma. Inspiración de tono: Linny (Linear), Max el erizo (PostHog), el gato de Claude Code, Wumpus (Discord). Aparece raro, por eso encanta.

### Render: pixel art es la apuesta

**Decisión inicial recomendada (validar en S2/S3):** **pixel art con sprite sheet animado**, no AI hi-res render. Razones:

- **Encaja con la cultura coleccionista** (manga, vinyl, anime, NFT/sticker culture sin caer en cripto).
- **Performance:** sprite sheet PNG ~20–60KB total para los 5 estados; AI hi-res con Lottie son cientos de KB.
- **Animación más fácil:** pixel walking cycle de 4–6 frames es trivial; rigging hi-res requiere After Effects o Lottie complejo.
- **Escala mejor a mobile mid-tier** sin lag de GPU.
- **Estética distintiva** vs apps tipo Stripe/Linear que usan ilustraciones vectoriales.

Camino alternativo (AI hi-res / Spline) queda abierto si en S2 el equipo prefiere otra estética; la decisión final se toma con mocks reales lado a lado.

### 5 estados base (sprite sheets independientes)

Cada estado se entrega como sprite sheet PNG @1x/@2x/@3x + opcionalmente WebP:

| Estado            | Frames     | Duración loop     | Cuándo se renderiza                                                     |
| ----------------- | ---------- | ----------------- | ----------------------------------------------------------------------- |
| **`idle`**        | 4–6 frames | 2.4s loop         | Default cuando la mascota está visible (bubble de esquina, achievement) |
| **`walking`**     | 6–8 frames | 0.6s loop         | Durante el "paseo" por la pantalla (ver reglas abajo)                   |
| **`peeking`**     | 3 frames   | 1.2s in/out       | Cuando aparece desde el borde de un card o de la pantalla               |
| **`celebrating`** | 6–8 frames | 1.0s one-shot     | Achievement (entrega completa, pago full, hito de colección)            |
| **`sleeping`**    | 3 frames   | 4s loop muy lento | Empty state cuando "no hay pre-órdenes / primera vez"                   |

### Posiciones canónicas y dónde aparece

1. **Bubble flotante 56×56 en esquina inferior derecha** (desktop y mobile). Siempre visible salvo si el usuario lo oculta en settings. Estado: `idle`. Click se trata en el FRD.
2. **Walking strip** — el área horizontal de 80px de alto sobre el footer del dashboard donde la mascota puede pasear. Sólo desktop, sólo en `/dashboard`. Estado: `walking`.
3. **Peek desde card** — durante achievement o transición canónica list→detail (§4.8) larga, la mascota puede asomar desde el borde de la card. Estado: `peeking`.
4. **Empty state hero** — escala 96px, centrado en card vacía. Estado: `sleeping` o `idle` según contexto.
5. **Achievement hero** — escala 64–96px en toast Sonner-style o card de celebración. Estado: `celebrating`.
6. **404 / error pages** — escala 96px en escenario. Estado: `idle` con micro-prop contextual (lupa para 404, ojos cerrados para 500).

### Reglas estrictas del "paseo"

El paseo es la microinteracción de marca de PandaTrack — pero mal calibrada se vuelve la primera cosa que el usuario va a desactivar. Reglas:

- **Frecuencia:** una caminata cada **8 minutos** mínimo. Nunca más seguido.
- **Trigger:** sólo si el usuario lleva **≥30 segundos sin interactuar** (mouse/teclado/scroll).
- **Path:** entra desde el borde derecho del walking strip, camina hacia la izquierda en **~6 segundos** (a velocidad constante, ~50px/s), sale por el borde izquierdo. Sin pausas, sin desviaciones.
- **Sólo en desktop.** Mobile NO pasea — la mascota se queda en la bubble idle. Razón: en mobile el espacio es premium y el movimiento distrae más.
- **Sólo en `/dashboard`.** No en formularios, no en listas densas, no en settings. El usuario que está concentrado no debe ver mascotas pasando.
- **Respeta `prefers-reduced-motion: reduce`:** la mascota queda en idle siempre, no pasea, no celebra, no peek anima.
- **Opt-out en settings:** "Mostrar la mascota" toggle (default ON, opción OFF que oculta también la bubble idle).
- **Performance budget:** el sprite sheet no debe pasar de **80KB total** para los 5 estados. Si pasa, se simplifican frames o se reduce resolución.

### Color treatment

La mascota usa la paleta del sistema:

- **Cuerpo:** blanco + negro pixel art clásico (es panda).
- **Aro / aura del bubble:** `color-mix(in oklch, var(--accent-cool) 16%, var(--surface))` — teal sutil que la liga al sistema.
- **Achievement decoration:** `--accent-warm` 14% halo radial detrás de la mascota celebrando.
- **Empty state:** `--accent-cool / 24%` background detrás de la mascota sleeping.

En dark mode el aro/halo cambia a `--accent-cool` con glow 12% opacity para que la mascota tenga rim light suave (no se vea fantasmal).

### Lo que NO hace la mascota (anti-patrones)

- **No habla en bubbles permanentes** — eso es el FRD del asistente.
- **No aparece en cada pantalla** — sólo en las posiciones canónicas listadas.
- **No reacciona a cada acción del usuario** — sólo a achievements explícitos.
- **No interrumpe flujos críticos** — nunca en form active, nunca en payment processing, nunca en delete confirmation.
- **No camina en mobile** — en serio, nunca.
- **No tiene 20 estados emocionales** — son 5, fijos. Más estados = más mantenimiento + más inconsistencia.

## 4.11 Voice & tone (post rev 3, 2026-05-01)

**Informal, cómplice, breve, sin jerga corporativa.** El sweet spot entre Linear-frío y Duolingo-cringe. Para la audiencia 18–25 que ya está cansada del "ha ocurrido un error en el procesamiento de su solicitud" pero también del "ay bestie 💀 algo se rompió lol".

> **Glosario de 15 pares antes/después** está en [`principles.md` §7](./principles.md). Es la fuente de verdad cross-direction; aquí sólo aplicamos los principios al contexto de Atelier.

### Reglas de voz para Atelier

1. **Siempre `tú`, nunca `usted`.** Sin excepciones, ni en formularios legales (esos viven en `terms.md` con su tono propio).
2. **Voz activa.** "Cancela este pedido", no "Este pedido será cancelado".
3. **Contracciones naturales** cuando suenan a habla. "Te queda $48,50", no "Te queda $48,50 USD" (la moneda se asume del contexto del usuario).
4. **Honesto en errores.** "Algo se rompió de este lado" en lugar de "Lo sentimos por las molestias".
5. **Una idea por línea.** Frases cortas. Si una frase tiene más de 12 palabras, partirla.
6. **Cero corporativismo.** Banear: "Le informamos", "Ha ocurrido", "Tenga en cuenta", "Por favor", "Disculpe las molestias".
7. **Cero meme storm.** Banear: "bestie", "no cap", "literally me", emoji loop. Un emoji puntual y funcional sí (✨ en achievement, 🎉 en colección completa). Máximo 1 por mensaje.
8. **Brevedad sobre ingenio.** Si no se te ocurre algo divertido en 5 segundos, escribe lo más corto y útil. "Listo" es mejor que un chiste forzado.

### Aplicación a las superficies de Atelier

| Superficie                           | Tono Atelier                                                   |
| ------------------------------------ | -------------------------------------------------------------- |
| **Empty pre-órdenes**                | "Sin pre-órdenes todavía. Suma una y empezamos."               |
| **Pago registrado**                  | "Listo. Te quedan $48,50."                                     |
| **Pago full (achievement)**          | "¡Cubierto! Una pre-orden menos. ✨" + mascota celebrating     |
| **Entrega completa (achievement)**   | "Llegó. Pieza nueva en tu colección. 🎉" + mascota celebrating |
| **Validation duplicado**             | "Hey, hay 2 tiendas parecidas. ¿Es alguna?"                    |
| **Discrepancia modal**               | "Tu suma no cuadra con el total. ¿Cuál dejamos?"               |
| **Error 500**                        | "Algo se rompió de este lado. Dale otra vez."                  |
| **Confirm delete**                   | "¿Borrar este pedido? Sus pagos también se van."               |
| **Empty filter result**              | "Nada con esos filtros. ¿Quitamos alguno?"                     |
| **Email confirmado**                 | "Email confirmado. Ya estás dentro."                           |
| **CTA primario "registrar pago"**    | "Anotar pago"                                                  |
| **Onboarding step 1**                | "Vamos por tu primera tienda."                                 |
| **Date picker placeholder**          | "¿Para cuándo?"                                                |
| **Save autoguardado**                | "Guardado, hace 4s"                                            |
| **Sin tiendas (gate de orders/new)** | "Necesitas una tienda primero. Te ayudamos."                   |

## 4.12 Sample del Dashboard

### Layout desktop (≥1024px)

Igual que Dir 1 (sidebar 240px, main `max-w-6xl`, padding `px-8 py-10`, bento grid 12 cols gap-6) pero con estos cambios:

- **Hero (cols 1–7, row 1):** card `surface-elevated` `radius-xl`. Eyebrow mono uppercase _"TUS PRE-ÓRDENES"_. **Display Inter Display 700, tracking -0.03em** (NO italic): `$1.247,80 USD restante`. Subtítulo Body-L con `--text-secondary`. **Progress bar 4px gradient `--accent` → `--accent-warm`** (indigo a coral) — éste es el lugar protagónico del color. Strip de 4 micro-stats con color funcional de status: pagado (indigo), próximo (coral), vencidos (warning), llegando (success). El resto del hero es neutro.
- **Próximo pago (cols 8–12, row 1):** card `surface`. **Avatar tienda 40px circular: logo de la tienda si existe; si no, fondo `surface-elevated` + border-strong + inicial en `text-primary`**. Display 32pt. CTA primario indigo. Sin halo categórico.
- **Categorías mini-card (cols 1–6, row 2):** card horizontal con 6 filas — cada una con **ícono Lucide** del tipo (`disc`, `book-open`, `sparkles`, etc.) en `--text-secondary`, label, count, total. Sin color categórico, sólo el ícono identifica. Hover sutil background `surface-elevated`.
- **Entregas en tránsito (cols 7–12, row 2):** lista de 3 con avatar neutro (logo o letra) + ícono Lucide categoría + chip status (`--success / 14%` background, `--success` text + border).
- **Pre-órdenes activas (cols 1–7, row 3):** lista densa con avatar neutro + nombre tienda + código mono + ícono Lucide categoría inline + total + chip status.
- **Activity feed (cols 8–12, row 3):** timeline vertical con íconos Lucide por tipo de evento dentro de un círculo `surface-elevated` con border 1px: `circle-dollar-sign` para pago en `--accent-warm`, `package-check` para entrega en `--success`, `plus-circle` para creación en `--accent-cool`. Sólo el ícono lleva color funcional.

### Layout mobile (360px)

Stack heredado de Dir 1. La sección "Categorías" se mantiene como lista vertical compacta (no scroll-x).

### Microinteracciones

1. **Hero stats hover:** cada micro-stat sube `translate-y -1px` con `--motion-fast` y cambia su color de `text-secondary` al color de status. Sin scale.
2. **Categoría row click:** filtro aplicado al listado de pedidos con view-transition shared element.
3. **Lista row hover:** state layer `--text-primary / 6%` (light) / 8% (dark). Sin glow, sin shadow agregada.
4. **Achievement pop (post-pago full):** toast Sonner-style con glyph panda 64px + copy editorial + accent-warm decoration sutil. 800ms hold + fade.

### Estados

- **Empty:** glyph panda 96px en `--accent-cool / 24%` + copy declarativo + CTA primario.
- **Loading:** skeletons que respetan geometría exacta. Shimmer `--text-primary / 4%` overlay.
- **Error en bento individual:** card específica con ícono Lucide `alert-circle` en `--destructive`, copy + reintentar.

### Light vs dark

- **Light:** lienzo `#F8F9FB`, cards blanco con shadow-2. Avatares con border-strong sutil. Iconos Lucide en `text-secondary`. Status colors saturados.
- **Dark:** lienzo `#0C0E13`, cards `#13151C` con border + glow indigo 6% en card activa. Avatares con border 1px luz suave. Status colors +8% L para mantener contraste. **Sin halos categóricos en avatares.**

## 4.13 Sample del Formulario "Nueva tienda"

Reescrito sobre el feedback humano. Los cambios respecto a Dir 1:

### Step indicator explícito (heredado de Dir 3)

Antes de la primera card: 3 círculos numerados conectados con líneas, cada uno con label corto. **El indicador ocupa el ancho completo del contenido** (post-feedback rev 2 — antes las líneas tenían `max-width: 60px` y el step indicator se veía apretado a la izquierda; ahora `flex: 1` sin tope para que respire en desktop y se sienta como un progreso real).

```
●───────────────────●───────────────────○
1                   2                   3
Identidad          Canales            Listo
```

- Activo: círculo `--accent` con halo glow.
- Done: círculo `--success` con check.
- Pendiente: círculo border `--border-strong`.
- Línea conectora: `--border` plain, `--accent` para el tramo completado.
- En mobile (<880px) las líneas se reducen pero siguen sin `max-width` rígido — el indicador se queda visualmente equilibrado.

### Section cards (NUEVO en esta dirección)

El formulario se divide en **5 cards** con `radius-xl`, padding generoso, border sutil + shadow-2 (light) / border-strong + glow indigo 6% en card activa (dark). Cada card tiene:

- Eyebrow mono uppercase **neutro** (color `--text-muted`, sin dot cromático).
- Title Display 19pt — funcional, no metafórico (_"Tipo de tienda"_, _"Identidad"_, _"Categorías"_, _"Operativa"_, _"Presencia"_).
- Helper Body 13pt en `--text-secondary` debajo del title.
- Campos.
- **Sin tinte cálido** en ninguna card (eliminado el `surface-warm` de la versión anterior — todas las cards usan `surface` plano).

### Big choice cards para `tipo de tienda` (heredado de Dir 3)

En lugar del pill toggle de Dir 1, dos cards grandes lado a lado:

- **Negocio** con ícono Lucide `store` — _"Una tienda con marca, redes y direcciones."_
- **Persona** con ícono Lucide `user` — _"Una persona vendiendo — amigo, scout, vendedor."_

Cards con `radius-lg`, padding `20px`, ícono 24px dentro de cuadro 40×40 `radius-md` con background `surface-elevated` + border-strong (estado normal) → background `--accent / 14%` + color del ícono `--accent` (estado active). Title Body-L 600, helper Body 13. Estado active: border `--accent` + ring 4px `--accent / 14%`.

### Categorías chips (revisado)

Las 6 categorías se muestran como chips pill con **ícono Lucide + label**, sin color categórico:

- Estado normal: border `border-strong` 1.5px, background `surface-elevated`, ícono y texto en `text-secondary`.
- Estado active: border `--accent`, background `--accent / 10%`, ícono y texto en `--accent`.
- Iconos: `shapes` (Figures), `disc` (Vinyl), `book-open` (Manga), `sparkles` (Anime), `gallery-thumbnails` (Cards), `package` (Plush).

### Sidebar derecha

Dos bloques verticales en columna 320px sticky (eliminada la card del asistente Pan, que pasa a un FRD aparte). **Tipografía consistente entre ambas cards** (post-feedback rev 2 — antes Resumen y Atajos usaban dos colores distintos para los labels y se sentían dos sistemas):

1. **Card Resumen** — actualiza en vivo con tipo, nombre, país, categorías count, estado al crear. Eyebrow neutro.
2. **Card Atajos** — `⌘ + Enter` continuar, `Esc` cancelar, `⌘ + K` command palette. Eyebrow neutro.

**Receta visual de filas attribute → value (la misma para ambas cards):**

- **Atributo (label)**: `--text-secondary` Body 13px regular weight. Es la "pregunta".
- **Valor**: `--text-primary` Body 13px weight 500. Es la "respuesta". Para el caso de atajos, el valor es un `<kbd>` con su estilo (mono 11px en `surface-elevated` con `border-strong`) — pero se mantiene la jerarquía: el atajo siempre es la "respuesta" del label.

Esta consistencia hace que el sidebar entero se lea como una sola tabla de pares, no dos cards inconexas.

### Footer sticky

Heredado de Dir 1 + autosave indicator + CTAs primario indigo + ghost.

### Layout mobile

Las 5 section cards se stackean. El sidebar se vuelve un sheet bottom Vaul-style accesible desde icon-button `info` (Lucide) en el header.

## 4.14 Anti-patrones (no hacer)

- Usar los 3 acentos saturados al mismo tiempo en una sola pantalla.
- Italic en cualquier display (decisión explícita post-feedback).
- Avatares de tienda con color categórico (figures = rosa, vinyl = violeta, etc.) — los avatares son neutros: logo o letra inicial sobre `surface-elevated`.
- Dots de color en eyebrows como decoración constante — eyebrows son neutros (`text-muted`).
- Chips de categoría con color de fondo categórico — la identidad la lleva el ícono Lucide, no el color.
- Emojis decorativos en UI (📷, 🏪, 👤, ✨, etc.) — siempre Lucide.
- Mezclar Lucide con otra librería de íconos.
- Section cards con tinte cromático (`surface-warm`, etc.) — cards en `surface` plano.
- Big choice cards con copy metafórico.
- Categorías con nombres-personaje (Lila/Virgilio/etc.) — quedan como nombres funcionales (Figures, Vinyl, Manga, Anime, Cards, Plush).
- Asistente conversacional como parte del rediseño visual — eso es FRD aparte.

## 4.15 Riesgos de implementación

- **Inter Display weight 700 con tracking -0.03em** requiere font-loading optimizado y posiblemente `text-rendering: optimizeLegibility`. Probar en S3 con metric override.
- **Tres acentos coordinados** demanda design ops disciplinada — un dev junior puede usar coral donde tocaba indigo. Resolver con utilities tipo `accent-warm`/`accent-cool` claramente nombradas y lint rules en S3.
- **Lucide como set único** es una decisión de tooling: requiere instalar `lucide-react` (o `lucide-static` para SVG inline) y banear cualquier emoji decorativo en code review.
- **Avatares con logo / fallback letra** requiere pipeline de imágenes coherente: render del logo a 40/56/96px sin distorsión, y componente `<StoreAvatar>` reusable que decide automáticamente entre logo y letra.
- **Paleta categórica reservada** (no expuesta como decoración) requiere disciplina: si en charts o filtros activos se usa, debe ser con alfa muy bajo y nunca como dot/avatar/chip lleno.

---

# Resumen ejecutivo de las 4 direcciones

| Atributo              | 1. Bento Editorial                  | 2. Neon Drop Floor             | 3. Soft Garden                   | 4. Bento Atelier                                        |
| --------------------- | ----------------------------------- | ------------------------------ | -------------------------------- | ------------------------------------------------------- |
| **Modo hero**         | Dark serio                          | Dark eléctrico                 | Light cálido                     | Dark con calidez                                        |
| **Vibe**              | Calmado, denso, type-driven         | Pulsante, drops, brutalism     | Cálido, jardín, personajes       | Curado, sereno, multi-acento, asistido                  |
| **Mascot**            | Whisper (glyph)                     | Chrome 3D protagónico          | Caretaker + 6 personajes         | Glyph 2D sólo en empty/404/achievement (no asistente)   |
| **Paleta core**       | Violeta sereno único                | Magenta + cyan + lime tricromo | Terracota + 6 categóricos pastel | Indigo + coral + teal funcionales (cat reservada)       |
| **Identidad cat.**    | Genérica                            | Saturada                       | Color + nombre-personaje         | Ícono Lucide (no color)                                 |
| **Type display**      | Editorial italic (Fraunces/Tiempos) | Chrome variable (Sora/Aeonik)  | Italic cálido (Fraunces opt 12)  | Inter Display 700, tracking apretado, no italic         |
| **Form**              | Plano, single column con summary    | Multi-card brutalist           | Cards generosas + asistente      | 5 section cards + step circles + big choice (sin tinte) |
| **Iconografía**       | Lucide                              | Phosphor Bold + 3D chrome      | Phosphor Duotone + clay          | Lucide único (set canónico)                             |
| **Motion**            | Sub-200ms snappy                    | 320–600ms con bounce           | 200–560ms spring suave           | Sub-200ms con stagger sutil                             |
| **Densidad**          | Alta (Linear-DNA)                   | Media-alta con celebración     | Media-baja generosa              | Alta con respiración por sección                        |
| **Audiencia natural** | Power user, tracker serio           | Drop hunter, hype, streetwear  | Caretaker, lifestyle, casual     | Power user con calidez, mainstream Gen Z                |
| **Riesgo principal**  | Sentirse enterprise                 | Polarizar, performance         | Lifestyle vs power user          | Coordinar 3 acentos sin caos                            |

> Continúa en [`directions-comparison.md`](./directions-comparison.md) con la tabla puntuada por criterios.
