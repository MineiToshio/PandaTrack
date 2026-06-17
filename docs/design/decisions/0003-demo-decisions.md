---
title: ADR 0003 — Decisiones consolidadas del demo visual (post-S2)
date: 2026-05-02
status: accepted
session: post-S2-demo
owner: Sergio Minei
supersedes: parts of S1 direction-chosen
---

# ADR 0003 — Decisiones consolidadas del demo visual

## Contexto

Después de cerrar S2 con los 6 wireframes lo-fi y el ADR 0001, se construyó un demo HTML self-contained en [`_notes/demo-screens.html`](../_notes/demo-screens.html) que **renderiza la dirección Atelier en pixeles reales**. Durante la iteración del demo con feedback humano se tomaron decisiones que afectan la dirección visual elegida en S1, la consistencia cross-pantalla, el comportamiento de componentes core (sidebar, wizard, drawer) y la organización de información (sidebar derecha en pantallas de detalle).

Este ADR consolida **8 decisiones** que aplican al demo y que deben aplicarse cuando se ejecute la implementación real (S3 tokens, S4 componentes core, S6+ alta fidelidad).

Es contrato vinculante. Cualquier desviación requiere un nuevo ADR que lo supersedeé explícitamente.

---

## Decisión 1 — Paleta primaria: **Velvet** (no Indigo)

**Origen:** feedback humano 2026-05-02 sobre el demo. La paleta Indigo elegida en S1 (Bento Atelier post rev 3) se sentía "muy financiera / muy SaaS B2B" para una app de coleccionistas. Reemplazada por Velvet.

**Decisión.** La paleta primaria de PandaTrack es **Velvet** — morado profundo en light, azul-violeta nocturno en dark.

**Spec final de tokens (OKLCH):**

### Light mode

```css
:root[data-palette="velvet"][data-theme="light"] {
  /* Lienzo plomito-violeta tipo papel de carta antiguo (NO blanco hospital) */
  --background: oklch(93% 0.02 285);
  --surface: oklch(96.5% 0.014 285);
  --surface-elevated: oklch(95% 0.016 285);
  --border: oklch(85% 0.024 285);
  --border-strong: oklch(74% 0.03 285);
  --text-primary: oklch(22% 0.03 285);
  --text-secondary: oklch(44% 0.024 285);
  --text-muted: oklch(54% 0.022 285);

  --accent: oklch(46% 0.2 290); /* morado profundo */
  --accent-warm: oklch(64% 0.2 22); /* coral cálido */
  --accent-cool: oklch(58% 0.1 215); /* azul gris suave */
  --focus-ring: oklch(46% 0.2 290 / 0.55);
}
```

### Dark mode

```css
:root[data-palette="velvet"][data-theme="dark"] {
  /* Fondo azul-violeta nocturno (h 265 — más azul que violeta) */
  --background: oklch(10% 0.028 265);
  --surface: oklch(13% 0.028 265);
  --surface-elevated: oklch(16% 0.03 265);
  --border: rgba(200, 200, 255, 0.07);
  --border-strong: rgba(200, 200, 255, 0.14);
  --text-primary: oklch(96% 0.012 280);
  --text-secondary: oklch(76% 0.02 280);
  --text-muted: oklch(64% 0.02 280);

  --accent: oklch(74% 0.19 290); /* violeta vibrante */
  --accent-warm: oklch(80% 0.15 25);
  --accent-cool: oklch(74% 0.11 215);
  --focus-ring: oklch(74% 0.19 290 / 0.65);
}
```

**Status semánticos** (`--success`, `--warning`, `--destructive`, `--info`) NO cambian: son tokens del sistema, no de marca.

**Justificación.**

1. La calidez del fondo en light (`h=285` con croma `0.020`) saca a la app del cluster "fintech B2B" de Linear / Stripe / Vercel y la lleva al territorio "coleccionable / hobby" sin caer en infantil (Soft Garden) ni en alocado (Neon Drop Floor).
2. El primario `oklch(46% 0.20 290)` es lo suficientemente saturado para sentirse "marca", lo suficientemente oscuro para legibilidad sobre el lienzo claro, y lo suficientemente alejado del azul fintech.
3. En dark, el lienzo `h=265` es **azul-violeta**, no púrpura cálido — feedback humano explícito ("me gustaría que sea una combinación entre azul y violeta").

**Otras paletas válidas (alternativas conservadas en el demo).** El switch del demo conserva 5 paletas alternativas para validación: **Lilac, Plum, Lagoon, Forest** + Velvet. Cualquiera puede sustituir a Velvet si futuras pruebas lo justifican, pero **el default es Velvet**.

**Confianza:** alto, post-feedback humano.

**Costo:** medio. Requiere recalibrar tokens en S3 + asegurar contraste AA en ambos modos.

**Rollback:** si validaciones de a11y o usabilidad fallan, alternativas documentadas (Lilac es la opción más cercana sin perder cualidad coleccionista).

---

## Decisión 2 — Theme toggle: solo `light` y `dark` (sin `system`)

**Origen:** feedback humano 2026-05-02.

**Decisión.** El theme toggle ofrece **dos opciones**: `light` y `dark`. La opción `system` se elimina.

**Comportamiento de fallback:**

- Primera carga del usuario: el sistema infiere de `prefers-color-scheme: dark` y aplica el modo correspondiente como inicial.
- Después de la primera elección manual, queda fijo en lo que el usuario eligió. No vuelve a seguir cambios del sistema.
- Persistencia: `localStorage["pandatrack-demo-theme"]` (en producción la clave será `pandatrack-theme`).

**Justificación.** El feedback humano fue claro: "no pongas el modo sistema". La razón implícita es que `system` agrega complejidad sin valor evidente al user final — lo que importa es elegir light o dark, no que la app siga reglas opacas del SO.

**Confianza:** alto.

**Costo:** trivial.

**Rollback:** si en producción se reciben pedidos repetidos para volver a sumar `system`, evaluarse por separado.

---

## Decisión 3 — Sidebar de la app: estructura, colapsabilidad y comportamiento

**Origen:** requisito explícito 2026-05-02 para mantener consistencia con el patrón actual de la app.

**Decisión.** El sidebar principal de la app (capa shell `(app)`) tiene esta estructura **inviolable**:

```
┌──────────────────────┐
│  Logo + nombre        │  ← arriba
├──────────────────────┤
│  Nav links (5–6)      │
│  • Hoy                │  ← medio
│  • Pedidos            │
│  • Entregas           │
│  • Tiendas            │
│  • Ajustes            │
├──────────────────────┤
│  Avatar usuario       │
│  Sergio Minei         │  ← abajo (footer)
│  email · chev menu    │
│  ─────                │
│  Botón "Colapsar"     │
└──────────────────────┘
```

**Estados:**

- **Expanded:** 240px de ancho. Logo + nombre, nav links con texto, user widget completo.
- **Collapsed:** 64px de ancho. Solo íconos del nav, logo "P", avatar del user.
- **Hover-expand sobre collapsed:** **modo FLOAT** (actualizado 2026-06-17, supersede la decisión original de PUSH-en-hover). La rail colapsada se ensancha a ancho completo y **flota sobre el contenido** (sube su `z-index` + sombra), sin mover la columna de contenido. Solo el **toggle manual** de colapsar/expandir usa PUSH (cambia el ancho del grid y el contenido reflowa). El FLOAT-en-hover es lo shipeado e intencional (confirmado por Sergio); se tomó el "Rollback" que esta misma ADR anticipaba abajo. _(Texto original: "modo PUSH — el grid del shell se expande … el contenido principal se mueve hacia la derecha, no se solapa.")_

**Persistencia:** `localStorage["pandatrack-sidebar"]` con valor `"collapsed"` o `"expanded"` (default `"expanded"`).

**Justificación.**

1. La estructura logo/nav/user es el patrón estándar de SaaS premium (Linear, Vercel, Stripe, GitHub, Notion). Reutilizar ese patrón mantiene la curva de aprendizaje plana.
2. El modo PUSH en lugar de FLOAT en hover-expand fue feedback humano explícito 2026-05-02 ("el contenido cambia y se ve horrible" cuando flotaba sobre).
3. PUSH preserva la predictibilidad: el contenido principal nunca queda parcialmente cubierto.

**Confianza:** alto.

**Costo:** medio. El sidebar real en `src/app/(app)/` debe refactorearse para soportar este comportamiento.

**Rollback:** si los usuarios reportan que el push molesta cuando están leyendo contenido cercano al borde izquierdo, se puede volver a flotante (con sombra y padding bien calibrados) o se puede hacer hover-expand opt-in (solo on-click, no on-hover).

---

## Decisión 4 — Header de la app: breadcrumbs + idioma + tema

**Origen:** requisito explícito 2026-05-02.

**Decisión.** El topbar de cada pantalla bajo `(app)` tiene esta estructura:

```
┌──────────────────────────────────────────────────────────┐
│ Inicio › Pedidos › PT-002418     [ES] [☀ 🌙]            │
└──────────────────────────────────────────────────────────┘
```

- **Breadcrumbs** (izquierda): camino jerárquico desde "Inicio". Cada nivel anterior es link, el actual es texto.
- **Idioma** (derecha): toggle compacto ES / EN.
- **Tema** (derecha del idioma): toggle compacto Light / Dark (sin system).
- **Avatar del usuario:** NO va en el header. Vive en el sidebar footer (Decisión 3).

**Justificación.** Breadcrumbs como navegación contextual estándar. El theme toggle compacto en el header ofrece acceso rápido al lado del idioma — es la setting más usada y debe estar a un click (alineado con ADR 0001 Decisión 14 sobre theme toggle dual).

**Confianza:** alto.

**Costo:** bajo.

**Rollback:** ninguno previsto.

---

## Decisión 5 — Wizard accordion para formularios de creación

**Origen:** feedback humano 2026-05-02 sobre el form de "Nuevo pedido".

**Decisión.** Los formularios de creación con ≥3 pasos se renderizan como **wizard accordion**: solo el paso activo está expandido; los demás están colapsados como cards delgadas mostrando solo número, eyebrow, título y summary del valor (cuando está completado).

**Reglas:**

1. **Solo una card expandida a la vez.** Las demás colapsan automáticamente.
2. **Click en card colapsada** → la abre y cierra las demás.
3. **Click en bolita del stepper** (arriba) → idem.
4. **Botón "Continuar" → marca paso actual como done, abre el siguiente.**
5. **Botón "Atrás"** → vuelve al anterior.
6. **Step indicator de arriba refleja el accordion** (no son dos cosas separadas).
7. **Auto-scroll suave** a la card activa cuando cambia.
8. **Pasos completados** muestran summary ("Akiba Records" para tienda, "5 may 26" para fecha, "3 items", etc.) y la bolita en `--success` con check.

**Aplica a:**

- `/orders/new` (Nuevo pedido) — 5 pasos: Tienda · Fechas · Items · Costos · Listo
- `/deliveries/new` (Nueva entrega) — 4 pasos: Tienda · Productos · Costos · Listo
- `/stores/new` (Sumar tienda) — 5 pasos: Tipo · Identidad · Categorías · Canales · Listo

**Implementación core S4:** componente `<WizardAccordion>` con API:

```tsx
<WizardAccordion startStep={2} onStepChange={...}>
  <WizardStep n={1} eyebrow="Paso 1 · Tienda" title="¿Dónde lo compraste?">
    {/* contenido */}
  </WizardStep>
  ...
</WizardAccordion>
```

**Justificación.** Feedback humano: "tienen los pasos arriba pero también me das todo el formulario entero. Sí tiene sentido si es un wizard, que vas avanzando o que se va colapsando". El wizard accordion combina lo mejor de:

- **Wizard tradicional:** un paso a la vez, foco claro.
- **Single-page form:** acceso rápido a cualquier paso, scroll spy del progreso.
- **Notion / Typeform 2024:** progreso visible + libertad de navegación.

**Reemplaza la decisión OC3 del ADR 0001** (que dejaba todo el form expandido con scroll spy). El wizard accordion es estricto sobre qué está expandido pero sigue permitiendo libertad de navegación entre pasos.

**Confianza:** alto, post-feedback.

**Costo:** medio. Requiere componente core S4.

**Rollback:** si validaciones humanas en S6 muestran que el accordion confunde (usuarios no ven los pasos posteriores), volver al modelo single-page con scroll spy.

---

## Decisión 6 — La nota privada NO es un paso de creación

**Origen:** feedback humano 2026-05-02.

**Decisión.** Los formularios de creación (`/orders/new`, `/deliveries/new`) **no incluyen la nota privada como paso del wizard**. La nota se agrega después, desde la **vista de detalle**.

**Justificación.** La nota privada es contextual al recurso ya creado, no parte del flujo de creación. Pedirla durante creación añade fricción al flujo principal y no es información obligatoria. Es exactamente el tipo de campo que se completa "cuando hay tiempo", no "cuando estás creando".

**Implicancia para wizards:**

- Nuevo pedido pasa de 5 pasos (Tienda · Fechas · Items · Costos · Nota) a 5 pasos (Tienda · Fechas · Items · Costos · **Listo** = revisar y anotar).
- Nueva entrega ya tenía 4 pasos sin Nota — sin cambios.

**Implicancia para detalles:** Decisión 7 (abajo).

**Confianza:** alto.

**Costo:** trivial.

---

## Decisión 7 — Sidebar derecha consistente en todas las pantallas de detalle

**Origen:** feedback humano 2026-05-02 sobre la inconsistencia entre Detalle de pedido (nota privada como acordeón en cuerpo) y Detalle de tienda (nota privada en sidebar).

**Decisión.** **Toda pantalla de detalle** tiene un sidebar derecho con la misma estructura jerárquica:

```
┌──────────────────────┐
│  Card 1: Resumen      │  ← stats / datos clave del recurso
├──────────────────────┤
│  Card 2: Acciones     │  ← CTAs sobre el recurso
│   • Acción primaria   │
│   • Acciones secun.   │
│   • (destructivas)    │
├──────────────────────┤
│  Card 3: Tu nota      │  ← textarea privado del viewer
│   privada              │
└──────────────────────┘
```

**Aplica a:**

- `/orders/[id]` — Resumen (totales, % pagado) · Acciones (Crear entrega, Editar, Cancelar) · Tu nota privada
- `/stores/[slug]` — Resumen (tus pedidos, total gastado, última visita) · Acciones (Anotar pedido aquí, Guardar tienda, Reportar tienda) · Tu nota privada
- `/deliveries/[id]` — (cuando se diseñe) Resumen · Acciones · Tu nota privada

**Reglas vinculantes:**

1. **Mismo orden de cards en todas las pantallas de detalle.** No se intercambian Resumen y Acciones.
2. **La nota privada SIEMPRE en sidebar**, no como acordeón en el cuerpo principal. (Reemplaza el comportamiento previo en Detalle de pedido.)
3. **El cuerpo principal** está reservado al recurso público / contenido del recurso (items, pagos, historial en pedido; reseñas, contactos, categorías en tienda).
4. **El sidebar es del viewer**: información que pertenece al usuario autenticado sobre el recurso (su resumen, sus acciones, su nota).
5. **En mobile** el sidebar se stackea debajo del cuerpo principal (orden: cuerpo → Resumen → Acciones → Nota).
6. **Las acciones destructivas** (Reportar, Cancelar) viven dentro de Acciones como `destructive-ghost`. Las **destructivas irreversibles** (Eliminar) van al menú overflow `[···]` del header (alineado con ADR 0001 Decisión 6).

**Justificación.** Feedback humano: "detalle de pedido y detalle de tienda no deben parecer aplicaciones diferentes. Si tenemos algo similar, tiene que estar en el mismo lugar y mantener esta consistencia."

La separación cuerpo (recurso) vs sidebar (viewer) es el patrón Notion / Linear / Stripe. Mantiene jerarquía clara: lo que cualquiera vería del recurso a la izquierda, lo que solo el viewer tiene/hace a la derecha.

**Confianza:** alto.

**Costo:** medio. Requiere refactor de las pantallas de detalle existentes.

**Rollback:** si en validaciones humanas las pantallas de detalle se sienten "demasiado lateralizadas" en mobile (donde stackea), evaluar agrupar Resumen + Acciones en un sticky inferior tipo bottom-bar.

---

## Decisión 8 — Filter sheet/rail unificado para listas

**Origen:** demo iteración 2026-05-02. Las listas (Pedidos, Entregas, Tiendas) tenían botón "Filtrar" no funcional.

**Decisión.** Toda lista filtrable abre un **drawer único de filtros** con comportamiento consistente:

- **Mobile (`<768px`):** bottom sheet con drag handle, slide vertical 320ms, max-height 88vh.
- **Desktop (`≥768px`):** drawer derecho de 440px, slide horizontal 320ms.

**Header del drawer:**

- Ícono `sliders-horizontal` + título contextual ("Filtrar pedidos", "Filtrar entregas", "Filtrar tiendas").
- Botón cerrar `x` a la derecha.

**Body del drawer:** lista de secciones por filtro. Tipos de filtro disponibles:

- `pills` — multi-select con chips.
- `pills-search` — search input + multi-select chips.
- `icon-pills` — chips con ícono Lucide + label.
- `date-range` — desde + hasta.
- `switches` — toggles (con label + estado on/off).

**Footer (sticky):**

- Botón "Limpiar" (ghost) — deselecciona todo dentro del drawer.
- Botón "Aplicar (N resultados)" (primary) — aplica y cierra. **N se actualiza al cambiar filtros**.

**Cierre:** click en overlay, Esc, botón cerrar, o botón aplicar.

**Filtros por contexto:**

| Contexto     | Secciones del drawer                                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `orders`     | Estado del pedido (6 enum) · Pago derivado · Tienda · Categorías de producto · Rango fechas (pedido) · Rango fechas (llegada) |
| `deliveries` | Estado de la entrega (3 enum) · Solo atrasadas (toggle) · Tienda · Rango fechas (entrega) · Rango fechas (ETA)                |
| `stores`     | Categorías que vende · Presencia · País · Switches (Recibe pre-órdenes, Tiene stock, Envía a CO)                              |

Los enums de estados se alinean con el [ADR 0002](./0002-status-chip-mapping.md).

**Implementación core S4:** componente `<FilterDrawer config={...}>` con configuración declarativa.

**Confianza:** alto.

**Costo:** medio. Drawer es componente core S4.

**Rollback:** ninguno previsto.

---

## Resumen ejecutivo

| #   | Decisión                                                      | Confianza | Bloqueante para |
| --- | ------------------------------------------------------------- | --------- | --------------- |
| 1   | Paleta primaria: **Velvet** (no Indigo)                       | Alto      | S3 tokens       |
| 2   | Theme toggle: solo `light` / `dark` (sin `system`)            | Alto      | S3 tokens       |
| 3   | Sidebar: logo top / nav medio / user bottom · collapse + push | Alto      | S5 navegación   |
| 4   | Header: breadcrumbs + lang + theme · sin avatar               | Alto      | S5 navegación   |
| 5   | Wizard accordion para formularios ≥3 pasos                    | Alto      | S4 componentes  |
| 6   | Nota privada NO es paso de creación (solo en detalle)         | Alto      | S7 / S8         |
| 7   | Sidebar derecha consistente en pantallas de detalle           | Alto      | S6 alta fi      |
| 8   | Filter drawer unificado (mobile sheet / desktop rail)         | Alto      | S4 componentes  |

**Total decisiones:** 8. **Bloqueantes:** 0 (todas con suficiente claridad). **Conflictos abiertos con FRDs existentes:** ninguno conocido — el subproyecto opera sobre área que aún no tiene FRD aprobado (`docs/product/frds/` salvo los específicos que estén).

---

## Próximos pasos

1. **Sesión 3 — Sistema de tokens dual-mode** debe usar Velvet como paleta default (Decisión 1).
2. **Sesión 4 — Componentes core** debe implementar:
   - `<WizardAccordion>` y `<WizardStep>` (Decisión 5).
   - `<FilterDrawer>` (Decisión 8).
   - `<DetailSidebar>` con slots Resumen/Acciones/NotaPrivada (Decisión 7).
3. **Sesión 5 — Navegación y layouts** debe implementar:
   - Sidebar colapsable con push (Decisión 3).
   - Header con breadcrumbs + lang + theme (Decisión 4).
4. **Sesión 6 — Dashboard alta fi** y siguientes deben respetar los 4 micro-stats del ADR 0001 + la estructura del sidebar derecha del ADR 0003.
5. **Antes de implementar** ejecutar la pasada de alineación FRD ↔ rediseño descrita en `_notes/demo-screens-readme.md`.
