---
title: Kbd
tier: 1
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0001 D4 (atajo `Z` visible en toast neutral-undo desktop)
---

# Kbd

## Propósito

Atom para etiquetas de atajo de teclado. Aparece en el panel "Atajos" del sheet bottom de [`order-create.md`](../screens/order-create.md) (`⌘+Enter`, `Esc`, `+`), en el toast neutral-undo (atajo `Z` desktop — ADR 0001 D4), en command palette aspiracional (`⌘K`), y en tooltips de iconos del header. Soporta combinaciones `keys: string[]` con separador `+` automático.

## API TypeScript

```ts
type KbdProps = {
  /** Una o más teclas que componen el atajo. Se renderizan separadas con `+`. */
  keys: string[];
  /** Tamaño. Default `md`. */
  size?: "sm" | "md";
  /** Etiqueta accesible (`aria-label`) si las teclas no son auto-explicativas. */
  label?: string;
};
```

## Variants / Sizes

| Variant (`size`) | Uso                                              | Tokens consumidos                                    |
| ---------------- | ------------------------------------------------ | ---------------------------------------------------- |
| `sm`             | Inline en cuerpo, tooltips densos                | `--text-eyebrow`, padding `0 --space-1`              |
| `md` (default)   | Panel atajos, toasts, command palette            | `--text-eyebrow`, padding `0 --space-1_5`            |

## Estados visuales

| Estado    | Receta CSS (light)                                                                                                                                                                                                                                      | Receta CSS (dark) | Notas                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------ |
| `default` | `display: inline-flex; align-items: center; gap: var(--space-1); font-family: var(--font-mono); font-size: var(--text-eyebrow); line-height: var(--text-eyebrow--line-height); letter-spacing: var(--text-eyebrow--letter-spacing); color: var(--text-muted);`                                                                                                                                                                              | mismo             | El gap separa cada tecla del separador `+`.                                          |
| Tecla     | `padding: 0 var(--space-1_5); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-muted); background: transparent; min-height: 1.125rem;`                                                                                | mismo             | Cada tecla individual lleva borde fino y padding lateral.                             |
| Separador | `color: var(--text-muted); padding: 0 var(--space-0_5);`                                                                                                                                                                                                | mismo             | El `+` entre teclas vive como `<span aria-hidden="true">+</span>` para evitar SR ruido. |

Receta base (CSS):

```css
.kbd {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-family: var(--font-mono);
  font-size: var(--text-eyebrow);
  line-height: var(--text-eyebrow--line-height);
  letter-spacing: var(--text-eyebrow--letter-spacing);
  color: var(--text-muted);
  font-weight: var(--font-weight-mono);
}

.kbd__key {
  padding: 0 var(--space-1_5);
  min-height: 1.125rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.kbd__separator {
  color: var(--text-muted);
  padding: 0 var(--space-0_5);
}

.kbd--sm .kbd__key {
  padding: 0 var(--space-1);
}
```

## Mobile vs desktop

- Mobile: el atajo aparece igualmente, pero la sección "Atajos" del sheet bottom es opcional o queda oculta cuando no aplican atajos físicos.
- Desktop: visible siempre en panels de atajos del wizard, command palette, tooltips.
- Tamaño visual idéntico mobile / desktop.

## Accesibilidad

- Rol ARIA: native `<kbd>` para cada tecla individual (rol implícito).
- Atributos opcionales:
  - `aria-label` cuando las teclas son símbolos (`⌘`, `↵`, `↑`) que el screen reader podría no leer correctamente. Ej. `aria-label="Atajo Comando + Enter"`.
- Keyboard: no interactivo. El componente solo etiqueta atajos que se ejecutan en el documento padre.
- Screen reader: el `aria-hidden="true"` en el separador `+` evita "más" en cada lectura. El `aria-label` del wrapper completa el anuncio.
- `prefers-reduced-motion`: no aplica.

## Motion

Ninguno. El `<Kbd>` no se anima.

Bajo `prefers-reduced-motion`: sin cambios.

## Copy default + i18n

| Clave i18n sugerida                          | Valor ES                                  |
| -------------------------------------------- | ----------------------------------------- |
| `components.kbd.aria.cmd`                    | "Comando"                                 |
| `components.kbd.aria.shift`                  | "Shift"                                   |
| `components.kbd.aria.alt`                    | "Alt"                                     |
| `components.kbd.aria.ctrl`                   | "Control"                                 |
| `components.kbd.aria.enter`                  | "Enter"                                   |
| `components.kbd.aria.esc`                    | "Escape"                                  |
| `components.kbd.aria.tab`                    | "Tab"                                     |
| `components.kbd.aria.space`                  | "Espacio"                                 |
| `components.kbd.aria.combination`            | "Atajo: {keys}"                           |

Símbolos por convención (no traducidos): `⌘`, `⌥`, `⇧`, `⌃`, `↵`, `⇥`, `↑`, `↓`, `←`, `→`, `Esc`, `Z`, `⌫`.

## Edge cases

1. **Plataforma no-Mac**: `⌘` se reemplaza por `Ctrl` automáticamente cuando el componente detecta plataforma. Decisión propagada a S12 — MVP renderiza tal cual recibe. La detección se hace en `useUserAgent()` o por convención del consumidor.
2. **Atajo de una sola tecla** (ej. `Z` en toast): `keys: ["Z"]` renderiza solo la tecla, sin separadores.
3. **Atajo de 3+ teclas** (ej. `⌘+Shift+P`): `keys: ["⌘", "Shift", "P"]` renderiza con dos `+`.
4. **Tecla con label largo** (ej. `Backspace`): permitido — el padding lateral del key crece naturalmente.
5. **Render inline en body**: usar `size="sm"`. Mantener line-height para que no rompa el flujo del texto.
6. **Atajo en context donde no aplica** (ej. `⌘K` en mobile): el padre debe ocultarlo (`display: none` por breakpoint).
7. **Combinación que requiere `aria-label`**: ej. `["↵"]` debe llevar `label="Enter"` para SR.

## Anti-patrones

1. **`<Kbd>` con animación**: rompe la lectura. No animar.
2. **Color `--text-primary` o `--text-secondary`**: usar `--text-muted` (es metadata).
3. **Borde `--border-strong`**: usar `--border` (decorativo, no funcional).
4. **Border-radius `--radius-md`**: usar `--radius-sm` (chip pequeño).
5. **Tamaño `--text-body`** (15px): rompe la jerarquía visual. Usar `--text-eyebrow` (11px).
6. **`font-family: var(--font-sans)`**: usar `--font-mono` (semántica de código).
7. **Symbol Unicode sin `aria-label`**: rompe SR.

## Ejemplos de uso

```tsx
// Order create · sheet Resumen · panel atajos
<dl>
  <dt>Enviar</dt>
  <dd>
    <Kbd keys={["⌘", "↵"]} label="Comando + Enter" />
  </dd>
  <dt>Cancelar</dt>
  <dd>
    <Kbd keys={["Esc"]} />
  </dd>
  <dt>Agregar item</dt>
  <dd>
    <Kbd keys={["+"]} />
  </dd>
</dl>

// Toast neutral-undo · atajo Z (desktop only)
<Toast>
  Borraste el pedido. <Kbd keys={["Z"]} label="Tecla Z" /> deshace.
</Toast>

// Command palette aspiracional · trigger en header
<button aria-label="Abrir paleta de comandos">
  Buscar <Kbd keys={["⌘", "K"]} label="Comando + K" size="sm" />
</button>
```

## Tokens consumidos

- `--font-mono`
- `--text-eyebrow`
- `--font-weight-mono`
- `--text-muted`
- `--border`
- `--space-0_5`, `--space-1`, `--space-1_5`
- `--radius-sm`

## ADRs aplicables

- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md) (D4 toast neutral-undo con atajo `Z` visible desktop)

## Dependencias

Ninguna. Es atom puro.

## Notas para S12 (implementación)

1. La detección de plataforma (`⌘` vs `Ctrl`) se hace una sola vez al montar la app y se pasa via context o helper `getModifierKey()`. MVP: el consumer pasa los símbolos correctos.
2. El componente NO atrapa eventos de teclado — solo renderiza la etiqueta visual. El handling vive en el `<Form>`, `<CommandPalette>`, etc.
3. Decidir en S12 si el componente acepta `<KbdGroup>` para múltiples atajos en una fila (ej. `Z o ⌘+Z`). MVP: una sola combinación por instancia.
4. Auditar en S12 que los símbolos Unicode (`⌘`, `↵`) no se ven mal en el font fallback — JetBrains Mono los soporta nativamente.
