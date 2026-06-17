---
title: Troubleshooting — problemas de renderizado CSS
last_updated: 2026-05-04
owner: Sergio Minei
status: vigente
---

# Troubleshooting: problemas de renderizado CSS

Registro de patrones de bugs de CSS/Tailwind encontrados durante el subproyecto de rediseño. Cuando algo "no se ve bien" a pesar de que los valores parecen estar asignados correctamente, revisar este listado antes de buscar otra causa.

---

## Bug #1 — Shorthand Tailwind sobreescribe longhand en misma clase (cascade override silencioso)

### Síntoma

Un token CSS (ej. `--border-strong`, `--accent`) parece estar asignado correctamente en el código, pero visualmente el valor nunca se aplica. En el inspector del navegador, la propiedad CSS final es el valor del shorthand (ej. `currentColor`) en lugar del token esperado. Reintentar asignar el token en distintas clases no ayuda — el valor sigue siendo ignorado.

### Causa raíz

Tailwind v4 genera clases CSS arbitrarias como reglas con **la misma especificidad** (selector de clase único). Cuando un elemento tiene dos clases que definen la misma sub-propiedad CSS — una vía shorthand y otra vía longhand —, la que aparece más tarde en la hoja de estilos generada gana, independientemente del orden de las clases en el JSX.

**Ejemplo concreto** (FilterDrawer pills, sesión 2026-05-03/04):

```tsx
// ❌ ROTO — shorthand en base class + longhand en state class
const PILL_BASE_CLASS = "[border:1px_solid] ..."; // shorthand → border-color: currentColor
const PILL_IDLE_CLASS = "[border-color:var(--border-strong)] ..."; // longhand → intenta asignar el color
```

En la hoja de estilos generada por Tailwind, la clase `[border:1px_solid]` define `border-color: currentColor`. La clase `[border-color:var(--border-strong)]` intenta sobreescribirla. Dependiendo del orden de generación del CSS, la regla shorthand puede ganar — incluso si en el JSX la clase longhand aparece después — porque Tailwind no garantiza orden por posición en JSX.

El resultado: el pill nunca muestra el color del borde correcto, aunque el token tenga el valor correcto en `globals.css`.

### Solución

**Nunca dividir una propiedad CSS entre shorthand en una clase base y longhand en una clase de estado.** Poner siempre el valor completo (incluyendo el sub-valor específico) directamente en la clase de estado.

```tsx
// ✅ CORRECTO — shorthand completo en cada clase de estado
const PILL_IDLE_CLASS = "[border:1px_solid_var(--border-strong)] ...";
const PILL_SELECTED_CLASS = "[border:1px_solid_var(--accent)] ...";
// No hay "[border:...]" en la clase base — solo propiedades no conflictivas.
```

### Checklist de diagnóstico

Cuando un color, borde, o estilo "no se renderiza" aunque el token tenga el valor correcto:

1. **Inspeccionar en el navegador** — ver si la propiedad CSS final en el elemento tiene un valor inesperado (ej. `currentColor`, `initial`, `transparent`).
2. **Buscar si la propiedad está declarada dos veces** en las clases del elemento — una vía shorthand, otra vía longhand.
3. **Verificar orden de clases Tailwind generadas** — en `_next/static/css/*.css` buscar las dos clases y ver cuál aparece más abajo (gana).
4. Si hay conflicto shorthand/longhand → **consolidar en la clase de estado** con el shorthand completo.
5. Si no hay conflicto de cascade → revisar si el **token mismo tiene el valor correcto** en `globals.css` (ver Bug #2 abajo).

---

## Bug #2 — Token correcto, valor incorrecto: OKLCH con alpha vs rgba literal

### Síntoma

Los colores del demo HTML y los de la app en `src/` son visualmente diferentes a pesar de que el token semántico es el mismo. Las diferencias más comunes: bordes demasiado visibles/brillantes en dark mode, colores de estado que no coinciden.

### Causa raíz

El demo HTML define sus tokens directamente con `rgba(r, g, b, alpha)`. La implementación en `globals.css` usa OKLCH con canal alpha (`oklch(L% C H / alpha)`). Aunque en teoría producen colores equivalentes, el alpha perceptual en OKLCH no es igual al alpha en sRGB, y valores "razonables" en OKLCH pueden dar un resultado visualmente distinto al rgba literal del demo.

**Ejemplo concreto** (S3-B.1, sesión 2026-05-04):

| Token                  | Demo HTML                   | Implementación original       | Resultado              |
| ---------------------- | --------------------------- | ----------------------------- | ---------------------- |
| `--border` dark        | `rgba(200, 200, 255, 0.07)` | `oklch(96% 0.012 280 / 0.18)` | Borde 2.5× más visible |
| `--border-strong` dark | `rgba(200, 200, 255, 0.14)` | `oklch(96% 0.012 280 / 0.45)` | Borde 3× más visible   |

### Solución

Para tokens donde la coincidencia visual exacta con el demo es la prioridad (dark mode borders, subtle surfaces), usar el literal `rgba(...)` del demo directamente. Anotar en `tokens.md` la razón (match con demo sobre pureza OKLCH).

Ver `docs/redesign/tokens.md §1.3` y `_notes/s3-contrast-audit.md §6` para el historial completo de S3-B.1.

### Checklist de diagnóstico

1. Comparar el valor del token en `globals.css` con el valor correspondiente en `_notes/demo-screens.html` (buscar la variable CSS en el `:root[data-theme="dark"]` del demo).
2. Si el demo usa `rgba(...)` y el repo usa OKLCH, calcular la equivalencia o simplemente adoptar el rgba del demo.
3. Documentar el cambio en `tokens.md` y en `cross-cutting-changes.md` si es tipo 4.
