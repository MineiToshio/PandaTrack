---
title: Store create / edit
session: 06
status: html-approved
last_updated: 2026-05-03
demo_anchors:
  - "#s6-store-create-step-1-type"
  - "#s6-store-create-step-2-identity"
  - "#s6-store-create-step-2-logo-set"
  - "#s6-store-create-step-2-error"
  - "#s6-store-create-step-3-categories"
  - "#s6-store-create-category-request"
  - "#s6-store-create-step-4-channels"
  - "#s6-store-create-step-5-review"
  - "#s6-store-create-step-5-preview"
  - "#s6-store-create-duplicate-detected"
  - "#s6-store-create-logo-upload"
  - "#s6-store-create-edit-mode"
frd: docs/product/prd-01-collector-mvp/frd-04-store-domain/frd-04-store-domain.md
---

# Store create / edit

> **Fuente visual de verdad:** `docs/redesign/_notes/demo-screens.html`. Los doce anchors arriba son la referencia canónica. Este spec describe el contrato funcional + tokens + componentes consumidos.

## 1. Propósito y contrato funcional

Flujo wizard de 5 pasos para crear una tienda nueva (`/[locale]/stores/new`) y flujo de edición (`/[locale]/stores/[slug]/edit`). Requiere usuario autenticado. El wizard persiste estado en localStorage entre pasos (autosave). Al submit, usuarios normales crean en estado PENDING; admins crean en APPROVED. El edit de tienda PENDING es directo (creator + admins); el edit de tienda APPROVED genera un change request.

Ruta create: `POST` vía Server Action → redirect a `/[locale]/stores/[slug]` con Toast de confirmación.
Ruta edit (PENDING): `PATCH` directo.
Ruta edit (APPROVED, no-owner): genera `StoreChangeRequest`.

## 2. Layout base del wizard

`AppShell` ([spec](../components/AppShell.md)) con `Sidebar` ([spec](../components/Sidebar.md)). En mobile la navegación es el drawer del topbar; el wizard ocupa el viewport completo sin tab bar.

**Topbar:** botón ghost sm `← Tiendas` + título `h2` ("Nueva tienda" / "Editar tienda"). Usa `Breadcrumbs` ([spec](../components/Breadcrumbs.md)).

**Stepper horizontal** (`Stepper` [spec](../components/Stepper.md)): 5 pasos con dots numerados. El paso activo en `--accent`. Pasos completados con dot en `--success` + checkmark. Scroll horizontal en mobile.

**Form grid:** dos columnas en desktop — columna principal (accordion del wizard) + aside derecho (card "Resumen" sticky).

**WizardAccordion** ([spec](../components/WizardAccordion.md)): contenedor de los 5 steps. Implementado con `.section-cards[data-wizard]`. Cada `WizardStep` ([spec](../components/WizardStep.md)) es una `.section-card.section-card-wizard` con head (step-num + eyebrow + title + summary) + body colapsable. Solo el paso activo está expandido; los anteriores muestran su summary en el head.

**Aside Resumen:** card `elevated` con tabla de pares label/value reflejando el estado actual del form (Tipo, Nombre, País, Categorías, Estado). Sticky `top: 80px`.

**Form footer:** indicador de autosave ("Guardado en este navegador" + checkmark `--success`).

## 3. Paso 1 — Tipo (`#s6-store-create-step-1-type`)

Eyebrow: `PASO 1 · TIPO`. Helper: "Esto cambia los campos siguientes."

Selector de tipo mediante `big-choices` (dos `Button` [spec](../components/Button.md) tipo large-choice con `icon-tile` accent + nombre + descripción):

- **Negocio**: icono `store`. "Una tienda con marca, redes y direcciones."
- **Persona**: icono `user`. "Alguien vendiendo — amigo, scout, vendedor."

Cuando tipo = PERSON: sección separada por `border-top` con `Switch` ([spec](../components/Switch.md)) "Perfil privado". Helper: "Solo tú puedes verlo. No aparece en el directorio público ni en búsquedas." El switch solo aparece cuando tipo es PERSON (FR-04-33 / FR-04-34).

CTA: `Button` primary "Continuar →" alineado a la derecha.

## 4. Paso 2 — Identidad (`#s6-store-create-step-2-identity`, `#s6-store-create-step-2-logo-set`, `#s6-store-create-step-2-error`)

Eyebrow: `PASO 2 · IDENTIDAD`. Helper: "Cómo se llama y dónde está."

Campos en `grid-2`:

- **Nombre** (`Input` [spec](../components/Input.md)): campo principal. On blur con ≥2 chars: dispara detección de duplicados (ver §8). Con error inline: `ErrorMessage` ([spec](../components/ErrorMessage.md)) en rojo bajo el campo.
- **País** (`Combobox` [spec](../components/Combobox.md)): selector searchable de países del catálogo.

Sección de descripción (full width):

- **Descripción** (`Textarea` [spec](../components/Textarea.md)): texto libre de la tienda.

Sección de presencia (checkboxes o pills multi-select):

- Tienda física / Tienda online (multi-select, al menos uno requerido).

Sección de países de importación:

- `Combobox` multi-select de import countries. Opcional.

**Logo (solo BUSINESS):** aparece como sección separada después de presencia.

- **Sin logo** (`#s6-store-create-step-2-identity`): zona de drop/upload con icono `Building2`, texto "Subir logo" + helper de formato + pill "Subir" con Upload icon. Acepta drag & drop o click. Lleva al editor de recorte (`#s6-store-create-logo-upload`) cuando se selecciona un archivo.
- **Con logo** (`#s6-store-create-step-2-logo-set`): thumbnail **150×150px** del logo recortado dentro de la misma tarjeta. A la derecha: nombre del archivo (`submission.file.name`) + peso (`formatFileSize(submission.file.size)`). Bajo la info: botones ghost sm "Edit" (solo cuando el archivo es editable en la sesión actual) y "Remove". Sin botón "Reencuadrar" separado — la edición se hace desde el mismo botón "Edit".

**Estado de error** (`#s6-store-create-step-2-error`): `ErrorMessage` inline bajo el campo Nombre con tono destructive. El campo tiene borde en `--destructive`. `HelperText` ([spec](../components/HelperText.md)) en rojo.

CTA: `Button` primary "Continuar →".

## 5. Paso 3 — Categorías (`#s6-store-create-step-3-categories`)

Eyebrow: `PASO 3 · CATEGORÍAS`. Label de sección en `font-size:14px; font-weight:700`.

Chips de product types del catálogo: `cat-chip` seleccionables. Activos con tint accent + borde accent. Inactivos con tint neutro.

Botón dashed inline al final del grupo de chips: `Solicitar nueva categoría` (icono plus 12px + texto, borde dashed, color `text-muted`). Lleva al modal `#s6-store-create-category-request`.

Sección "Presencia" con label igual (14px bold): pills Tienda física / Tienda online.

Sección "Países de importación": label igual + combobox multi-select.

**Sección "Comportamiento comercial"** (label 14px bold, `step3.stockSectionLabel`): agrupa los dos switches de comportamiento:

- **Tiene stock disponible** (`Switch`): indica si la tienda gestiona stock en tiempo real.
- **Recibe preórdenes** (`Switch`): indica si acepta pedidos en preventa.

Los dos switches deben ir bajo este encabezado — sin él flotan visualmente desconectados del resto del paso.

CTA: `Button` primary "Continuar →".

## 6. Modal: solicitar nueva categoría (`#s6-store-create-category-request`)

`Modal` ([spec](../components/Modal.md)) superpuesto sobre el paso 3. Header con icono `tag` + título "Solicitar nueva categoría" + `IconButton` ([spec](../components/IconButton.md)) cerrar (×).

Body: párrafo helper + dos campos sin contenedor extra:

- **Nombre de la categoría**: label bold 13px `text-primary` + contador `0 / 50` alineado derecha + `Input` con placeholder.
- **Motivo** (opcional): label bold 13px + badge "(opcional)" en `text-muted` + contador `0 / 500` + `Textarea` 4 rows.

Footer: "Cancelar" (ghost) + "Enviar solicitud" (primary + icono send). El modal cierra al cancelar o al enviar. Dispatch `Toast` ([spec](../components/Toast.md)) de confirmación post-envío.

## 7. Paso 4 — Canales y direcciones (`#s6-store-create-step-4-channels`)

Eyebrow: `PASO 4 · CANALES`. Label de sección 14px bold.

### Canales de contacto

**Canales existentes:** lista dentro de contenedor bordeado (border radius lg, overflow hidden). Cada fila: icono del tipo (`--accent-cool`) + label muted + value + botón Editar (Pencil 13px) + botón Quitar (X 13px). Separados por `border-top` entre filas.

**Modo edición de fila**: inline dentro del mismo contenedor. Select de tipo (150px) + Input de valor (flex-1) + Button primary "Guardar" (Check icon) + Button ghost "Cancelar".

**Agregar canal:** por defecto el formulario de agregar está **colapsado**. Se muestra solo el botón ghost sm "Añadir canal" (Plus icon). Al hacer click:

- Aparece tarjeta con `[background:var(--surface-elevated)]` + `[border:1px_solid_var(--border)]`.
- Esquina superior derecha: botón X que cancela sin agregar.
- Fila: `Select` de tipo (150px, fijo) + `Input` de valor (flex-1) + `Button` primary "Agregar" (Plus icon).
- Error de validación inline bajo el input si el valor no cumple las reglas del tipo.

**Validación por tipo** (L06 en `_notes/learnings-implementation.md`):

| Tipo      | Regla                                                    |
| --------- | -------------------------------------------------------- |
| INSTAGRAM | Debe contener `instagram.com/`                           |
| FACEBOOK  | Debe contener `facebook.com/` o `fb.com/`                |
| TIKTOK    | Debe contener `tiktok.com/`                              |
| WEBSITE   | Debe empezar con `https://`                              |
| WHATSAPP  | URL `wa.me/` o número con `+` seguido de dígitos         |
| EMAIL     | Regex básico `user@domain.tld`                           |
| PHONE     | `+` seguido de dígitos (con espacios/guiones permitidos) |
| OTHER     | Cualquier valor no vacío                                 |

**Bloqueo de avance:** si el formulario de agregar canal está abierto cuando el usuario intenta avanzar al paso 5, el wizard muestra el error `channels.formOpenWarning` y no avanza.

### Direcciones

**Patrón staged-add** (L05 en `_notes/learnings-implementation.md`): nunca se inserta una fila vacía de inmediato.

1. Botón ghost sm "Añadir dirección" (Plus icon) abre el formulario pending.
2. El formulario tiene tres campos: Ciudad (Input), Dirección (Input), Referencia (Input opcional).
3. Click "Agregar" confirma la entrada y cierra el formulario. X cancela sin agregar.
4. Las entradas confirmadas se muestran en `StoreAddressList` encima del botón/formulario.

**Bloqueo de avance:** análogo al de canales — si el formulario de dirección está abierto, el wizard no avanza y muestra `addresses.formOpenWarning`.

El paso es opcional en su totalidad (sin canales ni direcciones también avanza si los formularios están cerrados).

CTA: `Button` primary "Continuar →".

## 8. Detección de duplicados (`#s6-store-create-duplicate-detected`)

Se activa al hacer blur sobre el campo Nombre (paso 2) cuando hay ≥2 caracteres y el score de similitud supera threshold.

**Inline (on blur):** `DuplicateAlertInline` (componente propio) aparece bajo el campo Nombre como `role="alert"`. Eyebrow "Tiendas similares encontradas", título "¿Es alguna de estas?". Lista de hasta 5 candidatos: `StoreAvatar` 32px + nombre + ciudad/país/estado + link "Ver tienda" (abre `#s6-store-create-step-5-preview`).

**Modal de confirmación (on submit):** si al submit persiste similitud con tienda del mismo país. `Modal` ([spec](../components/Modal.md)) con lista de candidatos + acciones: "Cancelar" (ghost) y "Crear de todos modos" (primary). Sin botón "Esta es mi tienda" (eliminado en A.2).

El modal de duplicado bloquea el submit hasta resolución (BR-01-08). Tiendas en diferentes países no bloquean (BR-01-09).

## 9. Upload de logo (`#s6-store-create-logo-upload`)

`Modal` ([spec](../components/Modal.md)) de recorte/ajuste. `ProgressBar` ([spec](../components/ProgressBar.md)) durante upload. Área de preview del logo con controles de recorte. Footer: "Cancelar" (ghost) + "Guardar logo" (primary).

## 10. Preview de tienda existente (`#s6-store-create-step-5-preview`)

`Modal` ([spec](../components/Modal.md)) que muestra la vista pública de una tienda existente (Akiba Records en el demo) para que el user verifique si el candidato duplicado es la misma. Header: icono store + nombre + `IconButton` cerrar. Body: mini-versión del detalle de la tienda (hero compacto + chips + "Importa de" + stats). Footer: link "← Volver" (ghost, cierra el modal).

## 11. Paso 5 — Review y confirmar (`#s6-store-create-step-5-review`)

Eyebrow: `PASO 5 · LISTO`. Título "Revisa y confirma."

Resumen de todos los campos del wizard en modo read-only (pares label/value con icono de edición por sección). Checkbox de aceptación de términos. CTA final: `Button` primary "Crear tienda".

**Canales:** por cada `ContactChannelEntry`, renderizar:

- `<dt>`: nombre del tipo (ej. "Instagram") en `text-muted`.
- `<dd>`: URL o valor real truncado con `truncate`.

Nunca mostrar conteos ("1 canal"). Siempre datos reales. Ver L09 en `_notes/learnings-implementation.md`.

**Direcciones:** por cada dirección confirmada, renderizar en stack vertical:

- Ciudad.
- Línea de dirección.
- Referencia (si existe).

Separación visual entre entradas. Nunca mostrar "1 dirección".

Estado en aside Resumen: chip `info` "Pendiente" con icono clock (para users normales).

Post-submit: redirect a `/[locale]/stores/[slug]` + `Toast` ([spec](../components/Toast.md)) "Tienda creada — pendiente de revisión" (tono info, no destructivo).

## 12. Modo edición (`#s6-store-create-edit-mode`)

Mismo layout que el wizard de creación pero con los campos pre-poblados. El topbar dice "Editar tienda". Para tiendas APPROVED de usuarios normales: los cambios generan un `StoreChangeRequest` (no mutación directa). El aside Resumen muestra el estado actual de la tienda.

## 13. Tokens relevantes

| Elemento            | Token                                                                        |
| ------------------- | ---------------------------------------------------------------------------- |
| Step-num activo     | `var(--accent)`, `color: #fff`                                               |
| Step-num completado | `color-mix(in oklch, var(--success) 15%, transparent)`, borde `--success`    |
| Big-choice activo   | `color-mix(in oklch, var(--accent) 8%, transparent)`, borde accent           |
| Icon-tile           | `color-mix(in oklch, var(--accent) 12%, transparent)`, icono `var(--accent)` |
| Cat-chip activo     | `color-mix(in oklch, var(--accent) 10%, transparent)`, borde `22%`           |
| Cat-chip dashed     | `border-style: dashed`, `color: var(--text-muted)`                           |
| Error border        | `var(--destructive)`                                                         |
| Autosave checkmark  | `var(--success)`                                                             |
| Section label       | `font-size:14px; font-weight:700`                                            |

## 14. Accesibilidad acordada

- Stepper con buttons navegables por teclado.
- `Switch` perfil privado con `aria-pressed` + `aria-label`.
- `DuplicateAlertInline` con `role="alert"` para anuncio automático.
- Todos los modales con `role="dialog"`, `aria-modal="true"`, `aria-labelledby`.
- `ProgressBar` con `aria-valuenow`, `aria-valuemin`, `aria-valuemax`.
- Campos requeridos con `aria-required="true"`.
- Error inline con `aria-describedby` apuntando al `ErrorMessage`.
- Cat-chips seleccionables con `aria-pressed` o como checkboxes visualmente estilizados.
