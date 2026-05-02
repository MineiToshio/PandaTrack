---
title: Guía operacional — demo-screens.html
last_updated: 2026-05-02
status: active
owner: Sergio Minei
---

# Guía operacional del demo `demo-screens.html`

> **Para próximos agentes:** este doc explica qué es el archivo `demo-screens.html`, cómo está construido, qué decisiones contiene, y cómo extenderlo o iterarlo sin romper nada.

## 0. Lectura mínima de 3 minutos

Si vas a tocar el demo, leé en este orden:

1. **Este archivo** (5 min) — qué es el demo, convenciones, pendings.
2. [`../README.md`](../README.md) — estado del subproyecto de rediseño.
3. [`../decisions/0003-demo-decisions.md`](../decisions/0003-demo-decisions.md) — 8 decisiones consolidadas del demo. **Contrato vinculante.**
4. [`../decisions/0002-status-chip-mapping.md`](../decisions/0002-status-chip-mapping.md) — mapeo de estados de pedido/entrega a chips visuales.
5. [`../decisions/0001-s2-closure-decisions.md`](../decisions/0001-s2-closure-decisions.md) — 19 decisiones del cierre de S2 (gaps de Atelier resueltos, lifecycle, micro-stats, paginación, etc.).
6. [`store-detail-pendings.md`](./store-detail-pendings.md) — pendings conocidos del Detalle de tienda.

## 1. Qué es el demo y qué NO es

**Es:**

- Un único archivo HTML self-contained (`docs/redesign/_notes/demo-screens.html`) que renderiza visualmente la dirección Atelier en pixeles reales.
- Soporta light + dark, 5 paletas (Velvet default + Lilac, Plum, Lagoon, Forest), responsive mobile/desktop.
- Cubre 10 pantallas del producto: Dashboard, Pedidos, Detalle pedido, Nuevo pedido, Entregas, Nueva entrega, Tiendas, Detalle tienda, Sumar tienda, Ajustes.
- Es la **única referencia visual viva** para el subproyecto de rediseño hasta S6+ (alta fidelidad real).

**No es:**

- No es código de producción. Tailwind, Next.js, components reales, i18n real — nada de eso vive acá.
- No es contrato funcional. Datos mock, copy mock, estados mock. Lo que sí es contrato son los **ADRs** (`../decisions/`).
- No es 1:1 con los wireframes lo-fi. Algunos wireframes en `../screens/` están más detallados; el demo simplifica para que se vea bien renderizado.
- No reemplaza FRDs de producto.

## 2. Cómo abrirlo

```
file:///Users/Shared/Proyectos/pandatrack/docs/redesign/_notes/demo-screens.html
```

O cualquier servidor estático:

```bash
cd docs/redesign/_notes/
python3 -m http.server 8000
# abrir http://localhost:8000/demo-screens.html
```

No requiere build, no requiere dev server. Se abre directo en el browser.

## 3. Estructura del archivo

```
demo-screens.html
├── <head>
│   ├── Google Fonts (Inter + JetBrains Mono)
│   └── <style> ── todo el CSS inline
│       ├── Tokens base por theme (light/dark)
│       ├── Paletas alternativas (lilac, velvet, plum, lagoon, forest)
│       ├── Reset y base typography
│       ├── Demo header (palette switch + screen tabs + theme toggle)
│       ├── App shell (sidebar colapsable + topbar + content)
│       ├── Componentes core (.card, .chip, .btn, .row-list, etc.)
│       ├── Wizard accordion
│       ├── Filter drawer / sheet
│       └── Animations + reduced-motion
├── <body>
│   ├── Demo header (sticky)
│   ├── <main> con 10 <section class="screen">
│   ├── Filter overlay + drawer (único, dinámico)
│   ├── Bubble panda (fixed bottom-right)
│   ├── Achievement toast (fixed)
│   ├── Neutral undo toast (fixed)
│   ├── Stub toast (para nav links sin pantalla)
│   └── <script> ── todo el JS vanilla
│       ├── Theme management (localStorage, prefers-color-scheme inicial)
│       ├── Palette switch (5 paletas + persist)
│       ├── Sidebar collapse/expand (push mode + hover-expand)
│       ├── Topbar enriquecido (inyectado dinámicamente)
│       ├── Screen tab navigation (hash router)
│       ├── Order rows expand/collapse
│       ├── Sub-card collapse
│       ├── Wizard accordion genérico
│       ├── Filter drawer
│       ├── Inline pay form
│       ├── Toasts
│       ├── Settings tabs
│       └── Lucide icons init
└── </body>
```

## 4. Convenciones / atributos que el JS reconoce

| Atributo                                             | Aplica a                                 | Hace                                             |
| ---------------------------------------------------- | ---------------------------------------- | ------------------------------------------------ |
| `data-theme="light\|dark"`                           | `<html>`                                 | Modo de tema                                     |
| `data-palette="velvet\|lilac\|plum\|lagoon\|forest"` | `<html>`                                 | Paleta primaria                                  |
| `data-sidebar="expanded\|collapsed"`                 | `<html>`                                 | Estado del sidebar global                        |
| `data-screen="..."`                                  | screen tabs del header demo              | Identifica qué pantalla activar                  |
| `data-screen-link="<screen-id>"`                     | links internos                           | Navegación con view-transition CSS suave         |
| `data-theme-set="light\|dark"`                       | botones del theme toggle                 | Aplica tema                                      |
| `data-palette-set="<palette-id>"`                    | botones del palette menu                 | Aplica paleta                                    |
| `data-pref-theme="light\|dark"`                      | botones del Settings → Apariencia        | Aplica tema (sincronizado con header)            |
| `data-sidebar-toggle`                                | botón de colapsar                        | Alterna estado del sidebar                       |
| `data-open-filters="orders\|deliveries\|stores"`     | botones "Filtrar"                        | Abre drawer con config del contexto              |
| `data-wizard`                                        | container de wizard accordion            | Inicializa el accordion al cargar                |
| `data-wizard-start="N"`                              | container de wizard                      | Paso inicial activo (default 1)                  |
| `data-step="N"`                                      | `.section-card-wizard`                   | Número de paso                                   |
| `data-wizard-step="N"`                               | header clickable de cada step            | Activa ese paso al click                         |
| `data-wizard-next`                                   | botón "Continuar" dentro del step        | Avanza al siguiente                              |
| `data-wizard-prev`                                   | botón "Atrás" dentro del step            | Retrocede al anterior                            |
| `data-summary`                                       | elemento `.step-summary` dentro del step | Donde se inyecta el resumen automático           |
| `data-summary-static="texto"`                        | `.section-card-wizard`                   | Override del summary auto con texto fijo         |
| `data-expandable`                                    | row de tabla (Pedidos / Entregas)        | Permite expand/collapse de items                 |
| `data-expand-btn`                                    | botón chevron de la row                  | Toggle del expand                                |
| `data-target="<screen-id>"`                          | row expandable                           | Si hay valor, click en row navega a esa pantalla |
| `data-collapsible`                                   | sub-card                                 | Permite expand/collapse del contenido            |
| `data-store="..."`                                   | row de tienda en el wizard               | Permite selección con check                      |
| `data-choice-group`                                  | wrapper de big choices                   | Agrupa opciones radio-like                       |
| `data-settings-tab="..."`                            | tabs verticales en Settings              | Navegación interna                               |
| `data-settings-pane="..."`                           | secciones de Settings                    | Contenido de cada tab                            |

## 5. Cómo agregar/modificar cosas

### 5.1 Agregar una paleta nueva

1. Añadir bloque CSS:

   ```css
   :root[data-palette="<id>"][data-theme="light"] {
     --background: oklch(...);
     --surface: oklch(...);
     --surface-elevated: oklch(...);
     --border: oklch(...);
     --border-strong: oklch(...);
     --text-primary: oklch(...);
     --text-secondary: oklch(...);
     --text-muted: oklch(...);
     --accent: oklch(...);
     --accent-warm: oklch(...);
     --accent-cool: oklch(...);
     --focus-ring: oklch(... / 0.55);
   }
   :root[data-palette="<id>"][data-theme="dark"] { ... }
   ```

   Status (`--success`, `--warning`, `--destructive`, `--info`) NO se tocan — son tokens semánticos del sistema.

2. Añadir entrada al menú del header demo (en HTML):

   ```html
   <button class="palette-option" data-palette-set="<id>" role="menuitemradio">
     <span class="swatches">
       <span class="sw" style="background: oklch(...)"></span>
       <span class="sw" style="background: oklch(...)"></span>
       <span class="sw" style="background: oklch(...)"></span>
     </span>
     <span class="info"><strong>Nombre</strong><small>Vibe corto</small></span>
     <span class="check"><i data-lucide="check"></i></span>
   </button>
   ```

3. Añadir entrada al map `PALETTES` en JS:

   ```js
   const PALETTES = { lilac, velvet, plum, lagoon, forest, <id>: 'Nombre' };
   ```

### 5.2 Agregar una pantalla nueva

1. Añadir tab al `<nav class="screen-tabs">` del header demo.
2. Añadir mapping al objeto `SCREEN_BREADCRUMBS` en JS (para que el topbar inyecte breadcrumbs correctos).
3. Crear `<section id="<id>" class="screen">` con la estructura estándar:

   ```html
   <section id="<id>" class="screen">
     <div class="app-shell">
       <aside class="app-sidebar">...</aside>
       <div class="app-content">
         <div class="app-topbar"></div>
         <!-- el JS lo inyecta -->
         <!-- contenido de la pantalla -->
       </div>
       <nav class="mobile-tabbar">...</nav>
     </div>
   </section>
   ```

4. El sidebar de la pantalla debe seguir la receta:

   ```html
   <aside class="app-sidebar" aria-label="Navegación principal">
     <div class="app-sidebar-brand">
       <div class="demo-brand-mark">P</div>
       PandaTrack
     </div>
     <a href="#dashboard" class="app-nav-link"><i data-lucide="layout-dashboard"></i>Hoy</a>
     <a href="#orders" class="app-nav-link"><i data-lucide="package"></i>Pedidos</a>
     <a href="#deliveries" class="app-nav-link"><i data-lucide="truck"></i>Entregas</a>
     <a href="#stores" class="app-nav-link"><i data-lucide="store"></i>Tiendas</a>
     <a href="#settings" class="app-nav-link"><i data-lucide="settings"></i>Ajustes</a>
     <div class="app-sidebar-footer">
       <button class="app-sidebar-user" type="button" aria-label="Menú de usuario">
         <span class="avatar">S</span>
         <span class="info">
           <strong>Sergio Minei</strong>
           <small>sergio@pandatrack.dev</small>
         </span>
         <span class="chev"><i data-lucide="chevrons-up-down"></i></span>
       </button>
       <button
         class="app-sidebar-collapse-btn"
         type="button"
         data-sidebar-toggle
         aria-label="Colapsar / expandir sidebar"
       >
         <i data-lucide="panel-left-close"></i>
         <span class="label">Colapsar</span>
       </button>
     </div>
   </aside>
   ```

   El nav link de la pantalla activa lleva `is-active`.

### 5.3 Agregar un wizard nuevo

```html
<div data-wizard data-wizard-start="1">
  <div class="section-card section-card-wizard is-active" data-step="1">
    <button class="section-card-head" type="button" data-wizard-step="1">
      <span class="step-num"><span class="num">1</span></span>
      <div class="step-titles">
        <span class="eyebrow">Paso 1 · Título</span>
        <h3 class="card-title">Pregunta del paso</h3>
        <div class="step-summary" data-summary>—</div>
      </div>
      <span class="step-chev"><i data-lucide="chevron-down"></i></span>
    </button>
    <div class="section-card-body">
      <div class="section-card-inner">
        <p class="card-helper">Helper opcional.</p>
        <!-- campos del paso -->
        <div class="wizard-actions">
          <button class="btn primary" type="button" data-wizard-next>
            Continuar <i data-lucide="arrow-right"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
  <!-- repetir para más pasos -->
</div>
```

El JS auto-inicializa al cargar (`document.querySelectorAll('[data-wizard]').forEach(initWizard)`).

### 5.4 Agregar un filtro nuevo

Modificar `FILTER_CONFIGS` en JS:

```js
const FILTER_CONFIGS = {
  <contexto>: {
    title: 'Filtrar X',
    sections: [
      { name: 'Estado', type: 'pills', options: [...], selected: [...] },
      { name: 'Fecha', type: 'date-range' },
      { name: 'Otros', type: 'switches', options: [['Toggle 1', false], ...] },
      // tipos disponibles: pills, pills-search, icon-pills, date-range, switches
    ],
    resultCount: 24,
  },
};
```

Y marcar el botón con `data-open-filters="<contexto>"`.

### 5.5 Agregar/cambiar un chip de estado

Consultar primero [`../decisions/0002-status-chip-mapping.md`](../decisions/0002-status-chip-mapping.md). El mapeo de enums reales (`OrderStatus`, `DeliveryStatus`, `OrderItemDeliveryState`) a chips visuales **es contrato vinculante**. No inventar copy nuevo sin agregar al ADR 0002.

Variants disponibles: `success`, `warning`, `destructive`, `info`, `accent`, `neutral`.

```html
<span class="chip success"><i data-lucide="check-circle"></i> Completo</span>
<span class="chip info"><i data-lucide="package"></i> En camino</span>
<span class="chip warning"><i data-lucide="alert-circle"></i> Atrasado 3d</span>
<span class="chip neutral"><i data-lucide="clock"></i> Abierto</span>
```

## 6. Reglas de oro al iterar

1. **Consistencia visual cross-pantalla.** Si dos pantallas son del mismo tipo (dos detalles, dos listas, dos formularios), deben verse y comportarse igual. Si una tiene una card en el sidebar derecho, la otra también.
2. **Velvet es la paleta default.** Si te toca cambiarla, abrir un nuevo ADR.
3. **No tocar los tokens de status.** `--success`, `--warning`, `--destructive`, `--info` viven igual en todas las paletas.
4. **No modificar el shell.** Sidebar (logo top / nav / user bottom) y topbar (breadcrumbs / lang / theme) tienen estructura fija (Decisión 3 y 4 del ADR 0003).
5. **No agregar paso "Nota" a wizards de creación.** La nota privada solo vive en pantallas de detalle (Decisión 6 ADR 0003).
6. **Ante conflicto rediseño ↔ FRD/código:** PARÁ y consultá. No implementar sin acuerdo.
7. **Si toca cambio de modelo de datos, escalá.** El subproyecto no decide en schema.

## 7. Pendings conocidos

### Funcionales

- `Detalle de entrega` (`/deliveries/[id]`) no tiene pantalla en el demo todavía. El click en row de Entregas solo expande items, no navega. Cuando se diseñe, debe seguir la regla de sidebar consistente (Decisión 7 ADR 0003).
- `Editar pedido` (`/orders/[id]/edit`) no tiene pantalla — usa el form de Nuevo pedido como referencia.
- `Editar tienda` (`/stores/[slug]/edit`) idem.
- Detalle de tienda tiene pendings específicos en [`store-detail-pendings.md`](./store-detail-pendings.md).

### Visuales

- Mascota panda renderizada como emoji 🐼; pixel art real llega en S6.
- View-transitions usan fade+slide CSS, no la API canónica con `view-transition-name`. La API real se implementa en S6+ (firma propia documentada en `directions.md` §4.8).
- Walking strip de la mascota corre en loop continuo en el demo; el cooldown real (≥8 min, ≥30s idle) se respeta en producción.
- Achievement toast usa el panda 🐼 emoji con halo coral; el celebrating animado real (1s one-shot, 6-8 frames) llega en S6.

### Comportamientos

- Filtros "Aplicar" no disparan fetch real; cierran el drawer.
- Paginación "Cargar más" en mobile añade 3 rows mock.
- Búsqueda global / command palette `⌘K` no implementada en demo (queda como placeholder).
- Pull-to-refresh, swipe gestures (izquierda "Anotar pago", derecha "Ver tienda") no implementados en demo.

## 8. Cómo escalar a la implementación real

Cuando se ejecute S6+ y se construya la app con código real, la migración del demo a producción debe respetar:

- Los **8 ADRs del subproyecto** (`0001`, `0002`, `0003`, futuros).
- La estructura del shell que el demo prototipa (sidebar, topbar, content).
- Los componentes core que el demo prototipa (`<WizardAccordion>`, `<FilterDrawer>`, `<DetailSidebar>`, `<StatusChip>`).
- Los tokens de Velvet (Decisión 1 ADR 0003).

**Antes de implementar:** cruzar cada ADR del subproyecto contra los FRDs en `docs/product/`. Si hay conflicto:

1. **Visual o componente** → rediseño gana. Sumar nota al FRD afectado.
2. **Copy / voz** → actualizar `docs/product/glossary.md` en el mismo cambio.
3. **Flujo o reglas de negocio** → actualizar el FRD primero. Si el FRD se queda como está, re-abrir el ADR.
4. **Modelo de datos** → no es decisión del subproyecto. Escalar.

Output esperado: un doc `_notes/frd-alignment.md` que liste cada ADR, los FRDs afectados, y la resolución.
