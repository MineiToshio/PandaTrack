---
title: Aprendizajes — implementación de módulos (post-S6)
last_updated: 2026-05-05
owner: Sergio Minei
status: vigente
---

# Aprendizajes de implementación

Registro de errores, re-trabajos y brechas que aparecieron durante y después de S6 (módulo Tiendas). Estos patrones deben revisarse antes de implementar cualquier módulo nuevo para que no se repitan.

---

## L01 — Las animaciones CSS en `border-color` ocultan el estado de error

### Qué pasó

Los campos Input, Select, SearchableSelect y Textarea tenían `transition: border-color 0.15s` en sus wrappers. Cuando React aplica el estado de error (cambia la clase que define `border-color` a `var(--destructive)`), cada re-render reinicia la transición desde el valor actual. `getComputedStyle` devuelve el valor interpolado a mitad de la transición (≈ `border-strong`) en lugar del valor final (`destructive`). El borde rojo nunca se renderiza visualmente aunque el DOM sea correcto.

### Causa raíz

React re-renders son continuos mientras el usuario está interactuando. Cada re-render reinicia la transición, impidiendo que llegue al destino.

### Solución

Eliminar `transition` o `transition-[border-color]` de todos los wrappers de campos de formulario. El cambio de borde en error debe ser instantáneo.

### Regla

> **Nunca animar `border-color` en campos de formulario.** Si se quiere un efecto visual en el estado de error, usar `box-shadow` con `transition: box-shadow` (no afecta el flujo de rendering de error de la misma forma), o simplemente sin transición.

### Archivos corregidos

- `src/components/core/Input.tsx`
- `src/components/core/Select.tsx`
- `src/components/core/SearchableSelect.tsx`
- `src/components/core/Textarea.tsx`

---

## L02 — Tailwind shorthand vs longhand: conflicto de cascade silencioso

### Qué pasó

Usar `[border:1px_solid]` en una clase base y `[border-color:var(--destructive)]` en una clase de estado produce que el shorthand define `border-color: currentColor`, que puede ganar sobre el longhand dependiendo del orden de generación del CSS.

### Causa raíz

Tailwind v4 genera clases con la misma especificidad. El orden en la hoja de estilos generada determina cuál gana, no el orden en el JSX.

### Solución

Emitir **una sola clase** de `border-color` por estado, con el valor completo. Nunca dividir un shorthand en la clase base y un longhand en la clase de estado.

```tsx
// ✅ Correcto
!hasError && "[border-color:var(--border-strong)] bg-[var(--surface-elevated)]",
hasError && "[border-color:var(--destructive)] [background:...]",
```

> Ver también `docs/redesign/_notes/troubleshooting-css-rendering.md` §Bug #1.

---

## L03 — `min-h-` no garantiza altura uniforme; usar `h-` fijo en campos

### Qué pasó

Los campos usaban `min-h-[2.75rem]` con variantes `@md:min-h-[2.5rem]`. El resultado era inconsistencia de altura entre Input (48.5px) y Select (46px) visualmente.

### Solución

Usar `h-[2.875rem]` (46px fijo) en todos los campos md. El `min-h-` se reserva solo para áreas de texto (Textarea) donde el contenido puede crecer.

### Regla

> **Campos de formulario usan `h-[valor]` fijo, no `min-h-`.** La excepción es Textarea. El tamaño `sm` (32px) se reserva para chips/filtros compactos, no para formularios principales.

---

## L04 — El demo HTML no modela los estados vacíos ni los estados de archivo

### Qué pasó

El demo HTML mostraba el formulario de agregar canal siempre visible, y el preview de logo con texto placeholder ("nombre.png · 2.4 MB"). En la implementación real:

1. El formulario de canales iniciaba siempre abierto y molestaba en pantallas vacías.
2. El preview de logo mostraba `copy.acceptedFormats` ("PNG, JPG, JPEG o WebP") en lugar del nombre y peso real del archivo.

### Causa raíz

El demo HTML usa datos ficticios hardcodeados y no modela el estado de "ninguna entrada todavía" ni extrae metadata real del `File`.

### Solución aplicada

1. **Canales:** iniciar colapsado, revelar con botón "Añadir canal", X para cancelar.
2. **Logo preview:** mostrar `submission.file.name` y `formatFileSize(submission.file.size)`, con botones Edit/Remove debajo de esa info.

### Regla para sesiones futuras

> **Al implementar un componente con lista vacía, diseñar explícitamente el estado cero.** No asumir que el demo HTML cubre ese estado. Si el demo muestra datos placeholder, verificar que la implementación extrae datos reales del estado/props.

---

## L05 — El formulario de agregar ítems multi-campo necesita patrón "staged add"

### Qué pasó

La dirección de UX inicial para direcciones era: click "Añadir dirección" → aparece fila vacía inline → usuario llena → no hay confirmación explícita. El resultado era confuso (la fila aparecía vacía de inmediato) y difícil de cancelar.

### Patrón correcto: staged add

1. Botón "Añadir" → abre formulario pending (colapsado por defecto).
2. Usuario llena campos.
3. Click "Agregar" → ítem se añade a la lista y el formulario se cierra.
4. Click X → cancela sin agregar.
5. Si el formulario está abierto y el usuario intenta avanzar → bloquear con advertencia.

### Consecuencias técnicas

Cambiar de `addressRows: number[]` (solo IDs) a `addressData: Array<{id, city, addressLine, reference}>` (estado completamente controlado). Los inputs pasan a ser controlled con `onChange` handlers.

### Regla

> **Para formularios de "agregar ítem" con ≥2 campos, usar siempre el patrón staged add (pending form + confirmación explícita).** No insertar filas vacías. Siempre ofrecer un X para cancelar.

---

## L06 — Validación de canal por tipo: el demo no la incluía

### Qué pasó

El formulario de agregar canales en el demo HTML no tenía ninguna validación del valor (tipo "Instagram" pero valor "hola"). La implementación tampoco la tenía inicialmente.

### Solución

Agregar `validateChannelValue(type, value)` que valida según el tipo:

- INSTAGRAM/FACEBOOK/TIKTOK/WEBSITE: debe contener el dominio o empezar con `https://`
- WHATSAPP: URL wa.me o número con `+`
- EMAIL: regex básico
- PHONE: empieza con `+` seguido de dígitos
- OTHER: no valida (cualquier valor no vacío)

Los mensajes de error van en `redesign.create.channels.validationError.*` en los archivos i18n.

### Regla

> **Siempre agregar validación tipo-específica en campos de formato conocido.** El demo HTML es solo visual; la validación de negocio vive en el componente.

---

## L07 — next-intl: no usar `.replace()` en strings con variables

### Qué pasó

```tsx
// ❌ Roto — next-intl intenta formatear {index} como variable
`${tCreate("addressItemLabel").replace("{index}", String(n))}`;
// → FORMATTING_ERROR: The intl string context variable "index" was not provided
```

### Causa raíz

Cuando una clave de next-intl contiene `{variable}`, el `t()` call espera que esa variable sea pasada como segundo argumento. Si no se pasa, lanza error en runtime.

### Solución

```tsx
// ✅ Correcto
tCreate("addressItemLabel", { index: rowIndex + 1 });
```

### Regla

> **Nunca hacer `.replace()` manual sobre el resultado de un `t()` de next-intl si el string tiene `{variable}`.** Pasar siempre el mapa de variables como segundo argumento.

---

## L08 — Cambios en la API de componentes compartidos requieren búsqueda global

### Qué pasó

Al agregar `addChannel: string` como campo requerido a `Labels` en `StoreContactChannelEditor`, TypeScript falló en `EditStoreForm.tsx` porque ese archivo también usa el mismo componente y no tenía el nuevo prop.

### Regla

> **Antes de agregar un prop requerido a un componente compartido, hacer `grep -r "ComponentName"` para encontrar todos los call-sites.** Actualizar todos en el mismo commit. Nunca dejar call-sites sin compilar.

---

## L09 — El resumen del paso final debe mostrar contenido real, no conteos

### Qué pasó

El paso 5 (revisión) mostraba "1 canales, 1 direcciones" — números aggregados. El usuario no puede verificar si los datos están correctos sin volver al paso anterior.

### Solución

Mostrar el contenido real:

- Canales: tipo + valor (dos líneas por entrada)
- Direcciones: ciudad + línea + referencia (stack vertical con espacio entre entradas)

### Regla

> **En pantallas de revisión/resumen, siempre mostrar datos reales en lugar de conteos.** Si el dato es largo, truncarlo con `truncate`; nunca reemplazarlo con un número.

---

## L10 — Los grupos de controles sin encabezado parecen huérfanos

### Qué pasó

Los toggles "Tiene stock" y "Recibe preórdenes" en el paso 3 no tenían ningún encabezado de sección. Visualmente aparecían flotando bajo los otros grupos (Tipos de producto, Presencia, Importación) que sí tienen `<Label>`.

### Regla

> **Todo grupo de controles relacionados en un wizard step debe tener un `<Label>` de sección visible.** No dejar controles sin contexto de agrupación, aunque el copy sea obvio.

---

## Resumen rápido

| #   | Patrón roto                                    | Regla                                              |
| --- | ---------------------------------------------- | -------------------------------------------------- |
| L01 | `transition: border-color` en campos           | Nunca animar `border-color` en form fields         |
| L02 | Shorthand + longhand del mismo prop            | Emitir una sola clase `border-color` por estado    |
| L03 | `min-h-` para altura fija                      | Usar `h-[valor]` en campos de ancho fijo           |
| L04 | Demo HTML con placeholder ≠ datos reales       | Modelar el estado vacío y la metadata real         |
| L05 | Fila vacía inmediata en listas multi-campo     | Siempre usar patrón staged add                     |
| L06 | No validar tipo de canal                       | Validar formato según tipo al agregar              |
| L07 | `.replace()` en string next-intl con variable  | Pasar variables como segundo argumento a `t()`     |
| L08 | Prop requerido sin buscar todos los call-sites | Buscar globalmente antes de cambiar API compartida |
| L09 | Conteos en lugar de datos en resumen           | Mostrar contenido real en pantallas de revisión    |
| L10 | Grupo de controles sin encabezado              | Siempre poner `<Label>` de sección en cada grupo   |
