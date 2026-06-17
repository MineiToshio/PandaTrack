---
title: StoreAvatar
tier: 2
status: spec — no implementado
last_updated: 2026-05-02
session: 04-components
adrs:
  - ADR 0001 D16 (StoreAvatar spec — sizes 24/32/40/56, una letra, logo handling)
---

# StoreAvatar

## Propósito

Identificador visual de tienda — logo cuando existe, monograma de 1 letra cuando no. Aparece en cada row de [`orders-list.md`](../screens/orders-list.md), en el header del [`order-detail.md`](../screens/order-detail.md), en el field-as-attribute de [`delivery-create.md`](../screens/delivery-create.md) (paso 2 con prefill), en el activity feed y peek panel del [`dashboard.md`](../screens/dashboard.md), y en el listado público de `/stores`. Garantiza identidad cross-pantalla con receta única y radius dual mobile/desktop (ADR 0001 D16).

## API TypeScript

```ts
type StoreAvatarSize = 24 | 32 | 40 | 56;

type StoreLogo = {
  src: string;
  /** `square` → recortado a circle/radius-lg sin tinte; `rectangle` → contain + padding 12.5%; `alpha` → contain sobre `--surface-elevated`. */
  aspect: "square" | "rectangle" | "alpha";
  alt?: string;
};

type StoreAvatarProps =
  | {
      store: { name: string; logo?: never };
      size: StoreAvatarSize;
      /** Override del rendering responsive cuando se renderiza sobre fondo elevated (peek panel). Default `auto`. */
      surfaceContext?: "auto" | "elevated";
    }
  | {
      store: { name: string; logo: StoreLogo };
      size: StoreAvatarSize;
      surfaceContext?: "auto" | "elevated";
    };
```

(Discriminated union por presencia de `logo`. Con logo, el rendering depende de `aspect`. Sin logo, se cae al monograma de 1 letra.)

## Variants / Sizes

| Variant (`size`) | Uso                                                     | Tokens consumidos                                                   |
| ---------------- | ------------------------------------------------------- | ------------------------------------------------------------------- |
| `24`             | Eyebrow inline, breadcrumb, tabular metadata            | letter `--text-eyebrow` aprox · stroke 1px                          |
| `32`             | Field-as-attribute (delivery-create paso 2), row densa  | letter `--text-caption`                                             |
| `40` (canónico)  | Row de orders-list cómoda, peek panel                   | letter `--text-body`                                                |
| `56`             | Header de order-detail, hero de store-detail            | letter `--text-subtitle`                                            |

Variants por contenido (rendering interno, no prop expuesta):

| Variant interna  | Receta resumen                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| `letter`         | Bg `color-mix(in oklch, var(--accent) 14%, var(--surface-elevated))` + border 28% + letra en `--accent`.      |
| `logo-square`    | Logo full-bleed, sin tinte, `object-fit: cover`.                                                              |
| `logo-rectangle` | Logo `object-fit: contain` + padding `12.5% × size` sobre `--surface-elevated`.                               |
| `logo-alpha`     | Logo `object-fit: contain` sobre `--surface-elevated`.                                                        |

## Estados visuales

| Estado            | Receta CSS (light)                                                                                                                                                                                                                                                | Receta CSS (dark) | Notas                                                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `letter-default`  | `display: inline-flex; align-items: center; justify-content: center; width: <size>; height: <size>; background: color-mix(in oklch, var(--accent) 14%, var(--surface-elevated)); border: 1px solid color-mix(in oklch, var(--accent) 28%, var(--border)); color: var(--accent); font-family: var(--font-display); font-weight: var(--font-weight-semibold); border-radius: var(--radius-pill);` | mismo             | Mobile pill; desktop `--radius-lg` (ver "Mobile vs desktop"). La letra cumple ≥4.5:1 sobre el bg tintado por construcción del color-mix. |
| `logo-square`     | `background: var(--surface-elevated); border: 1px solid var(--border); border-radius: var(--radius-pill);` + `<img object-fit: cover; width: 100%; height: 100%;>`                                                                                                | mismo             | Sin tinte indigo. Border decorativo `--border`.                                                                                      |
| `logo-rectangle`  | `background: var(--surface-elevated); border: 1px solid var(--border);` + `<img object-fit: contain; padding: calc(<size> * 0.125);>`                                                                                                                              | mismo             | El padding `12.5% × size` se calcula en el wrapper o se aplica al img.                                                               |
| `logo-alpha`      | mismo `logo-rectangle` pero el img puede tener transparencia. El bg `--surface-elevated` siempre garantiza contraste.                                                                                                                                              | mismo             | Nunca renderizar logo alpha sobre el tinte `--accent`.                                                                               |
| `focus`           | `outline: 2px solid var(--focus-ring); outline-offset: 2px;` cuando el avatar es interactivo (link al detalle de la tienda).                                                                                                                                       | mismo             | Cuando el avatar es decorativo dentro de una row clickeable, el focus vive en la row entera.                                         |

Receta base CSS:

```css
.store-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in oklch, var(--accent) 14%, var(--surface-elevated));
  border: 1px solid color-mix(in oklch, var(--accent) 28%, var(--border));
  color: var(--accent);
  font-family: var(--font-display);
  font-weight: var(--font-weight-semibold);
  border-radius: var(--radius-pill); /* mobile */
  overflow: hidden;
}

@media (min-width: 48rem) {
  .store-avatar {
    border-radius: var(--radius-lg); /* desktop */
  }
}

.store-avatar--with-logo {
  background: var(--surface-elevated);
  border-color: var(--border);
}

.store-avatar__img--rectangle,
.store-avatar__img--alpha {
  object-fit: contain;
  width: 100%;
  height: 100%;
  padding: 12.5%;
}

.store-avatar__img--square {
  object-fit: cover;
  width: 100%;
  height: 100%;
}
```

## Mobile vs desktop

- **Radius dual:** mobile (`< --breakpoint-md`) → `--radius-pill` (circular). Desktop (`≥ --breakpoint-md`) → `--radius-lg`. Mantener consistencia cross-pantalla.
- **Sizes:** los 4 sizes (`24 | 32 | 40 | 56`) son fijos cross-viewport. La densidad de la fila puede preferir `32` mobile / `40` desktop, pero esa elección la hace el padre (no el componente).
- **Padding logo rectangular:** el `12.5%` se calcula sobre `size` en ambos viewports.
- **Letra display:** la familia es `--font-display` siempre — el peso óptico cambia por modo automáticamente vía `--font-weight-semibold`.

## Accesibilidad

- Rol ARIA: por default `<span role="img" aria-label="<storeName>">` cuando es decorativo dentro de una row con texto del nombre adyacente. Si el avatar es el único enlace al detalle de la tienda, envolverlo en `<a>` y dejar el `aria-label` en el link.
- Atributos requeridos:
  - `aria-label="<storeName>"` cuando no hay texto adyacente.
  - `<img alt="">` (vacío) para logos cuando el nombre de la tienda ya está adyacente — evita que el SR repita.
  - `<img alt="<storeName>">` cuando el avatar va solo (sin label de texto).
- Keyboard: solo aplica si el avatar es interactivo (Tab + Enter en el `<a>` envolvente).
- Focus management: el outline rodea el wrapper completo cuando es interactivo.
- Screen reader: si va con texto adyacente, el SR lee solo el texto. Si va aislado, lee `aria-label`.
- `prefers-reduced-motion`: no aplica.
- Contraste: la letra `--accent` sobre `color-mix(--accent 14%, --surface-elevated)` cumple ≥4.5:1 cross-paleta por construcción del mix (validado en S3 contrast audit).

## Motion

Ninguno. El avatar es estático.

Bajo `prefers-reduced-motion`: sin cambios.

## Copy default + i18n

| Clave i18n sugerida                          | Valor ES                                       |
| -------------------------------------------- | ---------------------------------------------- |
| `components.storeAvatar.aria.label`          | "Logo de {storeName}"                          |
| `components.storeAvatar.aria.fallback`       | "Iniciales de {storeName}"                     |

(Las claves se usan solo cuando el avatar va aislado sin texto adyacente.)

## Edge cases

1. **Nombre vacío o whitespace-only:** caer a placeholder neutro — bg `--surface-elevated`, border `--border`, ícono Lucide `store` en `--text-muted`. Nunca renderizar string vacío.
2. **Nombre con emoji o caracter especial primero:** tomar el primer code point que sea letra Unicode (`/\p{L}/u`); si no hay, fallback al placeholder neutro.
3. **Nombre con espacios al inicio:** trim antes de extraer la primera letra.
4. **Nombre en mayúsculas (ej. "XYZ Records"):** tomar la "X" tal cual; el `text-transform: uppercase` se aplica por CSS para reforzar consistencia.
5. **Logo `src` inválido o 404:** caer al monograma de letra. Detección via `onError` del `<img>` o validación previa en el padre.
6. **Logo `aspect: 'rectangle'` muy ancho (ratio > 3:1):** el padding 12.5% mantiene la lectura; el `object-fit: contain` garantiza no recorte.
7. **Logo `aspect: 'alpha'` con bordes blancos invisibles en light:** el `--surface-elevated` light tiene leve diferencia con `--background`; aceptable. En dark, el tinte oscuro hace el alpha logo más legible automáticamente.
8. **Avatar `size: 24` con letra:** la letra cabe pero ajustar la receta para no usar `--font-display` 600 si el ratio queda < 4.5:1; preferir `--text-mono` peso 600 como fallback.
9. **`surfaceContext: 'elevated'`:** cuando el avatar va sobre `--surface-elevated` (peek panel, drawer), el `color-mix` debe usar `--surface-elevated` como base (ya lo hace por default). No requiere override visual; la prop existe para clarificar al consumidor.
10. **Avatar dentro de chip o badge:** descartado — el componente no se compone dentro de chips. Los chips no llevan avatar.

## Anti-patrones

1. **Usar 2 letras (iniciales)**: el monograma es de 1 letra (ADR 0001 D16). 2 letras se ven "fallback de contacto".
2. **Tinte indigo sobre logo:** logos siempre sin tinte. El tinte es exclusivo del fallback letter.
3. **`opacity: 0.5` en estado disabled:** no aplica — el avatar no tiene estado disabled.
4. **`text-white` hardcoded en la letra:** la letra usa `--accent`, no `--text-on-accent`.
5. **Radius pill hardcoded en desktop:** romp consistencia cross-pantalla. Respetar el dual mobile/desktop.
6. **Sizes 16 o 48:** descartados (ADR 0001 D16). Los 4 sizes oficiales son `24/32/40/56`.
7. **Logo con alpha sobre tinte `--accent`:** interferencia cromática (ADR 0001 D16).
8. **Animación de pulse o glow:** rompe densidad informativa.

## Ejemplos de uso

```tsx
// Orders list · row densa con logo cuadrado
<li className="order-row">
  <StoreAvatar
    size={40}
    store={{
      name: "Akiba Records",
      logo: { src: "/logos/akiba.png", aspect: "square", alt: "" },
    }}
  />
  <MonoCode>PT-002418</MonoCode>
  <span className="order-row__store">Akiba Records</span>
  <StatusChip kind="orderStatus" value="IN_TRANSIT" />
</li>

// Field-as-attribute · delivery-create paso 2 (sin logo, monograma)
<div className="field-as-attribute">
  <Eyebrow size="sm">↳ DESDE PT-002418</Eyebrow>
  <span className="field-as-attribute__value">
    <StoreAvatar size={32} store={{ name: "Akiba Records" }} />
    Akiba Records
  </span>
  <Button variant="ghost" iconLeft={<PencilIcon size={16} />}>
    Cambiar
  </Button>
</div>
```

## Tokens consumidos

- `--accent`
- `--surface-elevated`, `--background`
- `--border`, `--border-strong`
- `--font-display`, `--font-weight-semibold`
- `--text-mono` (fallback size 24)
- `--radius-pill`, `--radius-lg`
- `--breakpoint-md`
- `--focus-ring`

## ADRs aplicables

- [ADR 0001 — S2 closure decisions](../decisions/0001-s2-closure-decisions.md) D16 (sizes, una letra, logo handling, surfaces).

## Dependencias

Ninguna primitiva en este tier. El componente puede renderizarse dentro de [`./PrefilledField.md`](./PrefilledField.md), [`./Card.md`](./Card.md), o composiciones tier 3 (rows, headers).

## Notas para S12 (implementación)

1. Decidir si el switch de `--radius-pill` ↔ `--radius-lg` se hace por media query CSS o por hook `useMediaQuery`. Recomendado: CSS puro (sin JS) para evitar flash en hidration.
2. La detección automática de `aspect` (square/rectangle/alpha) puede vivir en un helper `detectLogoAspect(file)` que analiza el `<img>` antes de subirlo. MVP: el dato lo provee el formulario de creación de tienda como dropdown manual.
3. Para `size: 24` con letra, validar contraste cross-paleta y decidir si caer a `--text-mono` peso 600 o si el `--font-display` con tracking ajustado funciona.
4. El `aria-label` cuando hay texto adyacente debe omitirse o ser `aria-hidden="true"` para evitar duplicación. Definir helper `<StoreAvatar decorative>` o detección via prop.
5. Para logos servidos remotamente, S12 debe definir el placeholder mientras carga (skeleton del avatar circular `--surface-elevated` `--elevation-1`).
6. La letra a renderizar es la primera del nombre tras trim — definir helper compartido `getStoreInitial(name)` reusable en server actions y client.
