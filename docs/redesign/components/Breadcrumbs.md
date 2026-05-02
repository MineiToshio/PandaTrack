---
title: Breadcrumbs
tier: 3
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0003 D4 (header con breadcrumbs + idioma + tema)
---

# Breadcrumbs

## Propósito

Camino jerárquico desde "Inicio" hasta la pantalla actual. Aparece en el content header de cada pantalla bajo `(app)` (ADR 0003 D4: breadcrumbs + idioma + tema, sin avatar). Provee orientación contextual + navegación de retorno a niveles superiores. Cada nivel anterior es link; el actual es texto sin link con `aria-current="page"`.

## API TypeScript

```ts
type BreadcrumbItem = {
  /** Label visible. */
  label: string;
  /** Si está, es link. Si no, es current (último item). */
  href?: string;
  /** Lucide icon opcional como prefijo (ej. ícono Home en el primer item). */
  icon?: import("react").ReactNode;
};

type BreadcrumbsProps = {
  /** Ruta jerárquica. El último item se renderiza sin href como current. */
  items: BreadcrumbItem[];
  /** Mobile collapse threshold. Default 3 — muestra primer + ellipsis + current cuando excede. */
  mobileMaxItems?: number;
  /** Aria-label del nav. Default "Breadcrumbs". */
  ariaLabel?: string;
};
```

## Variants / Sizes

Breadcrumbs tiene un solo render visual. Sin `size` variants — toma `--text-body` desktop / `--text-caption` mobile (ajuste responsivo automático).

| Slot              | Tokens                                                                             |
| ----------------- | ---------------------------------------------------------------------------------- |
| Container nav     | `display: flex; align-items: center; gap: 0; flex-wrap: nowrap; overflow: hidden;` |
| Link items        | `--text-secondary` `--text-body` `--font-weight-regular`                           |
| Current item      | `--text-primary` `--text-body` `--font-weight-medium`                              |
| Separator         | Lucide `chevron-right` 14×14 en `--text-muted`, margin horizontal `--space-2`      |
| Ellipsis (mobile) | "…" en `--text-muted` `--text-body`. Click expande inline.                         |

## Estados visuales

| Estado                | Receta CSS (light + dark)                                                                                                                                                                                                                   | Notas                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `link idle`           | `color: var(--text-secondary); font-size: var(--text-body); font-weight: var(--font-weight-regular); text-decoration: none; padding: var(--space-1) var(--space-1_5); border-radius: var(--radius-sm); cursor: pointer;`                    | Padding mínimo para tap target. Border-radius sutil para hover state-layer.                             |
| `link hover`          | `color: var(--text-primary); background-color: color-mix(in oklch, var(--text-primary) var(--state-hover-mix), transparent); text-decoration: none;`                                                                                        | Sin underline (state-layer comunica hover).                                                             |
| `link focus`          | `outline: 2px solid var(--focus-ring); outline-offset: 2px; color: var(--text-primary);`                                                                                                                                                    | Focus-visible ring estándar.                                                                            |
| `link active/pressed` | `background-color: color-mix(in oklch, var(--text-primary) var(--state-pressed-mix), transparent); color: var(--text-primary);`                                                                                                             |                                                                                                         |
| `current item`        | `color: var(--text-primary); font-weight: var(--font-weight-medium-body); cursor: default;`                                                                                                                                                 | No es link. `aria-current="page"`.                                                                      |
| `separator`           | Lucide `chevron-right` 14×14 `color: var(--text-muted)`. Margin horizontal `--space-2`. `flex-shrink: 0`.                                                                                                                                   | Render-only — no es focuseable ni interactive.                                                          |
| `ellipsis`            | `<button class="bc-ellipsis">…</button>` con `color: var(--text-muted); padding: var(--space-1) var(--space-1_5); border-radius: var(--radius-sm); cursor: pointer;` Hover: `color: var(--text-primary); background-color: color-mix(...)`. | Solo mobile cuando items > `mobileMaxItems`. Click expande inline.                                      |
| `truncated label`     | Cuando un item label es muy largo (e.g. `PT-002418-LARGO-AS-A-HOUSE`), aplicar `max-width: 12rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` con tooltip que muestre full label en hover.                             | Para code mono identificador (`PT-XXXXXX`) usar `<MonoCode>` interno con `--text-secondary` (ADR 0007). |

## Mobile vs desktop

- **Desktop** (`≥ --breakpoint-md`): todos los items visibles en el header. `--text-body`. Separator chevron 14×14.
- **Mobile** (`< --breakpoint-md`): si `items.length > mobileMaxItems` (default 3), colapsa mostrando: primer item + "…" + último (current). Click en "…" expande inline (replace ellipsis con los items intermedios). Tamaño `--text-caption` para que entre. Si igual no entra, el contenedor padre debe permitir scroll horizontal.

Layout responsivo:

```css
.breadcrumbs {
  display: flex;
  align-items: center;
  gap: 0;
  flex-wrap: nowrap;
  overflow: hidden;
}

@media (max-width: 47.99rem) {
  /* < --breakpoint-md */
  .breadcrumbs {
    font-size: var(--text-caption);
  }
}
```

## Accesibilidad

- Wrapper: `<nav aria-label={ariaLabel ?? "Breadcrumbs"}>` con `<ol>` interno (cada item `<li>`). Semántica de lista ordenada porque el orden importa.
- Last item: `aria-current="page"` y sin `<a>` — `<span>` directo.
- Separator: `<li aria-hidden="true">` o `<span role="presentation">` para que SR no lo lea cada vez. Alternativa: usar CSS `::after` con `content: '›'` y `aria-hidden`. Preferir `aria-hidden` Lucide para mantener consistencia visual.
- Ellipsis collapse: `<button aria-label="Mostrar todos los niveles" aria-expanded={expanded}>` con keyboard activate.
- Keyboard: Tab navega entre links + ellipsis. Enter activa link/ellipsis.
- Truncated label: si se aplica `text-overflow: ellipsis`, agregar `<Tooltip>` con full label para SR + sighted users.
- `prefers-reduced-motion`: ellipsis expand sin animación (cambio instantáneo).

## Motion

- Hover state-layer: transition `--motion-fast` `--ease-emphasis` para `background-color` y `color`.
- Ellipsis expand: cambio instantáneo (sin animation expand height — evita layout shift confuso).
- `prefers-reduced-motion`: no hay animation que adaptar.

## Copy default + i18n

| Clave i18n sugerida                      | Valor ES (voice glossary aplicado) |
| ---------------------------------------- | ---------------------------------- |
| `components.breadcrumbs.home`            | "Inicio"                           |
| `components.breadcrumbs.expandLabel`     | "Mostrar todos los niveles"        |
| `components.breadcrumbs.collapseLabel`   | "Colapsar"                         |
| `components.breadcrumbs.ariaLabel`       | "Breadcrumbs"                      |
| `components.breadcrumbs.currentSrSuffix` | "(página actual)"                  |

Sample paths típicos:

| Pantalla          | Breadcrumb path (es)               |
| ----------------- | ---------------------------------- |
| `/dashboard`      | `Inicio`                           |
| `/orders`         | `Inicio › Pedidos`                 |
| `/orders/[id]`    | `Inicio › Pedidos › PT-002418`     |
| `/orders/new`     | `Inicio › Pedidos › Nuevo`         |
| `/deliveries/new` | `Inicio › Entregas › Nueva`        |
| `/stores/[slug]`  | `Inicio › Tiendas › Akiba Records` |
| `/settings`       | `Inicio › Ajustes`                 |

## Edge cases

1. **Un solo item** (current sin parent): no renderizar nada (return null) — el page title del header ya provee contexto, el breadcrumb redundante.
2. **Path muy profundo** (>5 niveles): mobile colapsa siempre. Desktop puede aplicar truncation a labels intermedios con tooltip.
3. **Code mono identificador** como label (ej. `PT-002418`): usar [`./MonoCode.md`](./MonoCode.md) interno con `--text-secondary` (ADR 0007). Tabular nums automático.
4. **Label dinámico cargando** (ej. nombre de tienda fetch): mostrar skeleton 80×20 inline (`background: color-mix(--text-primary 8%, --surface); border-radius: var(--radius-sm); animation: pulse;`) mientras llega el dato. No bloquear render del breadcrumb completo.
5. **Path con segmento sin label real** (ej. UUID en URL): el padre debe resolver el label legible (ej. nombre del recurso) antes de pasarlo. Si solo hay UUID, usar copy genérico "Detalle" en lugar de exponer el UUID.
6. **Click en current**: `pointer-events: none` + `cursor: default` — no responde a click.
7. **Locale change**: el primer item ("Inicio" / "Home") debe re-renderizarse con la copy del locale activo (responsabilidad del consumidor — el componente no traduce).
8. **Path con caracteres especiales** (em-dashes, ampersands): no escapar — render directo.

## Anti-patrones

1. **Nunca underline** en links breadcrumb idle — la jerarquía visual viene del color (`--text-secondary` link / `--text-primary` current). Underline solo en hover si el contraste lo requiere.
2. **Nunca usar `<` o `>`** como separator — usar Lucide `chevron-right` para consistencia con el resto del sistema.
3. **Nunca el ícono Home como único primer item** — usar el texto "Inicio" (icon optional como prefijo). Decálogo §7 voice (palabras antes que pictogramas para navegación).
4. **Nunca cortar el último item** (current) — siempre visible. Si no entra, scroll-x del container padre.
5. **Nunca usar breadcrumbs como sustituto de Tabs** — son cosas distintas. Breadcrumbs = camino jerárquico; Tabs = vistas hermanas de la misma pantalla.
6. **Nunca hover effect sobre current** (es informativo, no clickable).
7. **Nunca dropdown en ellipsis mobile** — la convención del sistema es expansión inline, no menú flotante.

## Ejemplos de uso

```tsx
// Header de /orders/[id]
<Breadcrumbs
  ariaLabel="Breadcrumbs"
  items={[
    { label: "Inicio", href: "/" },
    { label: "Pedidos", href: "/orders" },
    { label: order.humanId }, // current — sin href
  ]}
/>

// Header de /stores/[slug] con label dinámico
<Breadcrumbs
  items={[
    { label: "Inicio", href: "/" },
    { label: "Tiendas", href: "/stores" },
    { label: store?.name ?? "" }, // skeleton mientras carga
  ]}
/>
```

## Tokens consumidos

`--text-primary`, `--text-secondary`, `--text-muted`, `--focus-ring`, `--font-weight-regular`, `--font-weight-medium-body`, `--text-body`, `--text-caption`, `--space-1`, `--space-1_5`, `--space-2`, `--radius-sm`, `--motion-fast`, `--ease-emphasis`, `--state-hover-mix`, `--state-pressed-mix`.

## ADRs aplicables

- [`../decisions/0003-demo-decisions.md`](../decisions/0003-demo-decisions.md) D4 (header con breadcrumbs + lang + theme).
- [`../decisions/0007-text-muted-outdoor-code-mono-reassignment.md`](../decisions/0007-text-muted-outdoor-code-mono-reassignment.md) (code mono identificador en breadcrumb usa `<MonoCode>` con `--text-secondary`).

## Dependencias

Composible dentro del shell header (S5). Compone [`./MonoCode.md`](./MonoCode.md) cuando el label es un identificador (`PT-XXXXXX`). Compone [`./Tooltip.md`](./Tooltip.md) cuando un label se trunca.

## Notas para S12 (implementación)

- Generación automática a partir de la URL: el shell layout puede inferir items desde `usePathname()` + un mapping label/route configurable. Permitir override por página vía `<BreadcrumbsContext>`.
- Si la app usa next-intl, la primera label "Inicio" viene de `useTranslations("components.breadcrumbs")`.
- Considerar cache de label por route (especialmente labels async como nombre de tienda) para evitar fetch repetido al volver a una pantalla previa.
- Mobile ellipsis expand: implementar con simple `useState` boolean — sin animación.
- Tooltip on truncated label: solo cuando `scrollWidth > clientWidth` (medir con `ResizeObserver`).
