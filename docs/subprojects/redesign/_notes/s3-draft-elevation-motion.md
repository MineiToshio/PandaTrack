---
title: S3 draft — elevation + motion tokens
status: draft delta — para consolidación cross-área
---

# 1. Elevation

Dos modos hermanos: mismos identificadores (`--elevation-1`..`--elevation-4`),
valor distinto por modo. Light usa sombras reales con alfa bajo; dark NO usa
sombra real — la elevación se construye con tono de superficie
(`--surface-elevated`), borde (`--border` / `--border-strong`), highlight
inset y, en niveles altos, un glow accent puntual.

## 1.1 Light (sombras reales)

```css
/* Cards de lista, hover sutil sin elevar layout */
--elevation-1: 0 1px 2px rgba(20, 22, 30, 0.04);

/* Section cards de formulario, popovers, dropdowns, drawer derecho */
--elevation-2: 0 4px 12px rgba(20, 22, 30, 0.06), 0 1px 2px rgba(20, 22, 30, 0.04);

/* Modales centrados, sheets mobile, mascot bubble flotante */
--elevation-3: 0 12px 24px rgba(20, 22, 30, 0.08), 0 2px 6px rgba(20, 22, 30, 0.06);

/* Command palette, assistant bubble expandida */
--elevation-4: 0 24px 48px rgba(20, 22, 30, 0.12);
```

Notas:

- El color base de la sombra es un slate frío (`rgba(20, 22, 30, ...)`) en
  vez de negro puro, para que combine con `--surface-base` cálido sin
  ensuciar la percepción de color.
- El stack de doble sombra (offset corto + offset largo) en `--elevation-2`
  y `--elevation-3` da contacto y dispersión en el mismo nivel sin pedir
  blur excesivo.

## 1.2 Dark (composiciones sin sombra real)

En dark NO se usa sombra real (resulta sucia sobre fondos oscuros). La
elevación viene de:

1. Tono de superficie: el componente eleva su `background` a
   `--surface-elevated` o `--surface-overlay` (definidos en color tokens).
2. Borde: `--border` (nivel 1) o `--border-strong` (niveles 2+).
3. Highlight superior interno: `inset 0 1px 0 rgba(255, 255, 255, 0.04)`
   simula la luz cenital sobre el canto del componente.
4. Glow accent puntual desde `--elevation-3`.
5. Halo accent-cool radial sutil desde `--elevation-4`.

Producto final por nivel (un único valor `box-shadow` apilable):

```css
/* Card de lista: solo borde + highlight cenital sutil */
--elevation-1: inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 0 0 1px var(--border);

/* Section card / popover / dropdown / drawer derecho */
--elevation-2: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 0 0 1px var(--border-strong);

/* Modal / sheet / mascot bubble: + glow accent 6% en borde superior */
--elevation-3:
  inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 0 0 1px var(--border-strong),
  0 -1px 8px color-mix(in oklch, var(--accent) 6%, transparent);

/* Command palette / assistant expandida: + halo accent-cool radial 12% */
--elevation-4:
  inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 0 0 1px var(--border-strong),
  0 -1px 8px color-mix(in oklch, var(--accent) 6%, transparent),
  0 16px 64px -16px color-mix(in oklch, var(--accent-cool) 12%, transparent);
```

Notas:

- Los valores `0 0 0 1px ...` actúan como hairline border sin consumir el
  slot de `border` real (importante para componentes que ya pintan border
  con otro color de estado, ej. `--border-error`).
- El glow `0 -1px 8px ...` queda anclado al borde superior (offset Y
  negativo) y desplaza la dispersión hacia arriba — leído como "luz que
  baja sobre el componente", coherente con la metáfora cenital del
  highlight inset.
- El halo accent-cool del nivel 4 usa `64px` de blur con `-16px` de spread
  negativo para que el halo solo se vea en la mitad superior y no derrame
  hacia abajo en pantallas chicas.

## 1.3 Asignación por componente

| Componente                            | Elevation                            |
| ------------------------------------- | ------------------------------------ |
| Card de lista                         | `1`                                  |
| Row hover (no eleva, usa state layer) | `0`                                  |
| Section card de formulario            | `2`                                  |
| Popover / dropdown                    | `2`                                  |
| Sheet (mobile)                        | `3`                                  |
| Modal centered                        | `3`                                  |
| Drawer derecho                        | `2`                                  |
| Toast neutral-undo (ADR 0001 D4)      | `2`                                  |
| Toast achievement (con halo coral)    | `3` + halo achievement (composición) |
| Command palette                       | `4`                                  |
| Mascot bubble flotante                | `3`                                  |
| FAB                                   | `2`                                  |

Halo achievement (composición ad-hoc, NO token nuevo):

```css
/* Aplicar SOLO al toast achievement por encima de --elevation-3 */
box-shadow:
  var(--elevation-3),
  0 0 0 1px color-mix(in oklch, var(--accent-warm) 24%, transparent),
  0 8px 32px color-mix(in oklch, var(--accent-warm) 14%, transparent);
```

# 2. Motion

## 2.1 Duraciones (`--motion-*`)

```css
--motion-fast: 150ms; /* hover, focus ring, tooltip in/out, ripple state layer */
--motion-base: 280ms; /* sheet, modal, drawer, page transition, view-transition */
--motion-slow: 480ms; /* celebraciones, achievements, mascot peeking */
```

Reglas:

- Cualquier transición de estado de control (hover, focus, pressed) usa
  `--motion-fast`.
- Cualquier entrada/salida de superficie (modal, sheet, drawer, popover)
  usa `--motion-base`.
- `--motion-slow` está reservado para feedback expresivo. No usar en
  navegación ni en transiciones de form.

## 2.2 Easings (`--ease-*`)

Tailwind v4 los expone como `--ease-*` sin prefijo `--ease-fn-`.

```css
/* Lineal expresivo para opacity, color, focus ring */
--ease-emphasis: cubic-bezier(0.2, 0, 0, 1);

/* Easing expresivo para sheets, modals, page transitions, step transitions */
--ease-out-expressive: linear(0, 0.5, 0.85, 0.97, 1);

/* Spring suave (~0.18 bounce) para celebraciones y mascot */
--ease-bounce: linear(0, 0.32, 0.68, 0.92, 1.08, 1.04, 1);
```

Mapping rápido propiedad ↔ easing:

| Propiedad / contexto                     | Easing                  |
| ---------------------------------------- | ----------------------- |
| `opacity`, `color`, `background-color`   | `--ease-emphasis`       |
| `transform: translate/scale` de overlays | `--ease-out-expressive` |
| Focus ring fade-in                       | `--ease-emphasis`       |
| Achievement, mascot peek/celebrate       | `--ease-bounce`         |
| View-transition canónica de orden        | `--ease-vt-signature`   |

## 2.3 Firma view-transition canónica (`--ease-vt-signature`)

Es un easing dedicado. Existe SOLO para la firma view-transition de orden.
No reutilizar en ningún otro contexto (auditable, fácil de detectar mal
uso).

```css
/* Spring overshoot 0.05 — firma exclusiva de view-transitions de orden */
--ease-vt-signature: linear(0, 0.18, 0.5, 0.78, 0.95, 1.02, 1);
```

Aplicación canónica:

```css
::view-transition-group(*) {
  animation-duration: var(--motion-base); /* 280ms */
  animation-timing-function: var(--ease-vt-signature);
}
```

Reglas vinculantes (ADR 0001 D5):

- Convención de nombre: `view-transition-name: order-{humanId}` (ej.
  `order-PT-002418`).
- Duración fija: `--motion-base` (280ms). No customizar.
- Easing único: `--ease-vt-signature`. No usar `--ease-out-expressive` ni
  `--ease-bounce` aquí.
- Solo la row clickeada/focused recibe el `view-transition-name`
  (delegación dinámica, evita colisión de nombres en listas).
- Avatar tienda mantiene tinte indigo continuo durante el morph (no
  toggle de filtro).
- Código mono `PT-002418` crece de 11px a 13px sin re-render: animar
  `font-size` en el mismo nodo, no swap.
- Chip status hace micro-pausa de 40ms entre 120ms y 160ms del morph
  (parte de la firma — visual hint de "snap" en estado).
- Body de la card: fade simple, sin `view-transition-name` compartido
  (evita drag visual).

## 2.4 Reducción bajo `prefers-reduced-motion: reduce`

Receta vinculante:

- Toda transición se reduce a `opacity` + `transform: none` con
  `--motion-fast` (150ms).
- Spring easings (`--ease-bounce`, `--ease-vt-signature`) se reemplazan
  por `--ease-emphasis`.
- View transitions: la firma se desactiva — corte directo (duración
  efectiva 0.01ms para no romper la API).
- Mascota panda se queda en `idle` siempre (no walking, no peeking, no
  celebrating animado — solo estado visual final).
- Stagger animations: se desactivan (todo aparece simultáneo en el mismo
  frame).

Bloque CSS canónico (incluir una sola vez en la raíz del stylesheet):

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 150ms !important;
    scroll-behavior: auto !important;
  }
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation-duration: 0.01ms !important;
  }
}
```

# 3. Mapping @theme propuesto

Bloque CSS dummy (Tailwind v4 — convención `@theme`). El switch
light/dark se hace re-declarando los mismos identificadores dentro de
`:root` y `[data-theme="dark"]`, no dentro de `@theme` para no duplicar
la API generada por Tailwind.

```css
@theme {
  /* Elevation: el valor real lo provee :root / [data-theme="dark"] abajo. */
  --shadow-elevation-1: var(--elevation-1);
  --shadow-elevation-2: var(--elevation-2);
  --shadow-elevation-3: var(--elevation-3);
  --shadow-elevation-4: var(--elevation-4);

  /* Motion */
  --ease-emphasis: cubic-bezier(0.2, 0, 0, 1);
  --ease-out-expressive: linear(0, 0.5, 0.85, 0.97, 1);
  --ease-bounce: linear(0, 0.32, 0.68, 0.92, 1.08, 1.04, 1);
  --ease-vt-signature: linear(0, 0.18, 0.5, 0.78, 0.95, 1.02, 1);
}

:root {
  /* Light: sombras reales suaves */
  --elevation-1: 0 1px 2px rgba(20, 22, 30, 0.04);
  --elevation-2: 0 4px 12px rgba(20, 22, 30, 0.06), 0 1px 2px rgba(20, 22, 30, 0.04);
  --elevation-3: 0 12px 24px rgba(20, 22, 30, 0.08), 0 2px 6px rgba(20, 22, 30, 0.06);
  --elevation-4: 0 24px 48px rgba(20, 22, 30, 0.12);

  /* Motion durations */
  --motion-fast: 150ms;
  --motion-base: 280ms;
  --motion-slow: 480ms;
}

[data-theme="dark"] {
  /* Dark: composiciones sin sombra real */
  --elevation-1: inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 0 0 1px var(--border);
  --elevation-2: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 0 0 1px var(--border-strong);
  --elevation-3:
    inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 0 0 1px var(--border-strong),
    0 -1px 8px color-mix(in oklch, var(--accent) 6%, transparent);
  --elevation-4:
    inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 0 0 1px var(--border-strong),
    0 -1px 8px color-mix(in oklch, var(--accent) 6%, transparent),
    0 16px 64px -16px color-mix(in oklch, var(--accent-cool) 12%, transparent);
}

/* Firma VT canónica — aplica por defecto a todos los grupos VT.
   Componentes que no quieran usarla deben no setear view-transition-name. */
::view-transition-group(*) {
  animation-duration: var(--motion-base);
  animation-timing-function: var(--ease-vt-signature);
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 150ms !important;
    scroll-behavior: auto !important;
  }
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation-duration: 0.01ms !important;
  }
}
```

# 4. Decisiones cerradas

1. **`--ease-vt-signature` es token aparte, no parámetro inline.**
   Razón: la firma VT debe ser un valor reusable y auditable. Si aparece
   un uso fuera de `::view-transition-*`, es bug detectable por grep o
   lint. Documentado: NUNCA usar fuera de view-transitions.

2. **Halo achievement = composición ad-hoc, NO token nuevo.**
   Razón: solo lo usa el toast achievement (Atelier §4.10 + ADR 0001).
   Promover a token sería sobre-ingeniería. Documentado en §1.3 como
   receta CSS reusable: `var(--elevation-3)` + ring `--accent-warm` 24%
   - halo `--accent-warm` 14%.

3. **Glow accent dark elevation-3 = `0 -1px 8px color-mix(in oklch,
var(--accent) 6%, transparent)`.**
   Anclado al borde superior con offset Y negativo. Forma parte del
   shadow stack dark de `--elevation-3` y `--elevation-4` (ver §1.2).

4. **Highlight cenital interno escalonado por nivel** (3% → 4% → 5% →
   6% de blanco). Razón: refuerza la percepción de elevación en dark
   sin necesidad de blur real.

5. **Color base de sombra light = slate frío `rgba(20, 22, 30, ...)`,
   no negro puro.** Razón: combina con `--surface-base` cálido sin
   ensuciar la percepción de color.

6. **Switch light/dark fuera de `@theme`** (en `:root` /
   `[data-theme="dark"]`) para no duplicar la API generada por
   Tailwind. `@theme` solo declara la indirección
   `--shadow-elevation-* → --elevation-*`.

# 5. Riesgos / dudas para el agente principal

1. **`linear()` timing function — soporte de browsers.** `linear()`
   con multistop tiene soporte amplio en Chromium 113+, Safari 17.4+,
   Firefox 112+. Para usuarios fuera de ese rango, el fallback nativo
   degrada a `linear` puro (sin overshoot). Aceptable, pero confirmar
   si el target oficial de PandaTrack incluye Safari < 17.4.

2. **`color-mix(in oklch, ...)` en `box-shadow`.** Funciona en todos
   los navegadores que ya soportan `color-mix`, pero conviene validar
   en Safari 16.x si está dentro del soporte. Si no, fallback a un
   valor RGBA precalculado del accent dark.

3. **`view-transition-name` dinámico en row.** El plan es delegación
   dinámica (set + clean) para evitar colisión en listas largas.
   Necesita un hook (`useViewTransitionName`) compartido para que
   cards de orden, store y delivery usen la misma convención. Definir
   en S4.

4. **Halo achievement vs toast neutral-undo.** El toast achievement usa
   `--elevation-3` + halo. El neutral-undo usa `--elevation-2` plano.
   Si en el futuro aparecen más variantes (warning toast, error
   toast), revisar si conviene promover el halo a token
   `--halo-{tone}` o mantener composición ad-hoc por variante.

5. **Drawer derecho elevation = 2 (no 3).** Decisión basada en que el
   drawer no bloquea totalmente el viewport y convive con el contenido
   detrás. Si red-team de S3 indica que se siente "pegado" al canvas,
   subir a 3.

6. **Stagger reducido bajo `prefers-reduced-motion`.** La regla
   "todo aparece simultáneo" puede sentirse abrupta en listas largas
   (50+ items). Considerar si conviene mantener un fade global muy
   corto (150ms) en vez de aparición instantánea. Validar en S5 con
   usuarios reales.
