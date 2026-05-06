---
title: M04 — Wizard form polish (create-store)
date: 2026-05-05
owner: Sergio Minei
branch: redesign
type: correctiva
status: done
---

# M04 — Wizard form polish (create-store)

Sesión correctiva que resolvió un lote de bugs visuales y de UX descubiertos después de S6. No introduce funcionalidad nueva; todos los cambios son ajustes al comportamiento ya implementado del wizard de creación/edición de tiendas.

---

## Motivación

La implementación de S6 fue funcional pero mostró 5 categorías de problemas al usarlo en el navegador:

1. **Borde de error invisible**: `transition: border-color` en los wrappers de campos impedía que el borde rojo llegara al valor final durante re-renders de React.
2. **Logo preview demasiado pequeño**: el thumbnail de 48px hacía imposible juzgar el recorte sin reabrir el editor.
3. **Altura inconsistente**: Input y Select diferían en altura (48.5px vs 46px) por usar `min-h-` en lugar de `h-` fijo.
4. **Channels editor**: el formulario de agregar canal estaba siempre visible (UX confusa en pantalla vacía), sin validación de formato y sin botón de cancelar.
5. **Addresses**: inserción inmediata de fila vacía sin confirmación (UX confusa, sin forma de cancelar).
6. **Step 3**: los toggles de stock/preórdenes flotaban sin encabezado de sección.
7. **Step 5 review**: mostraba conteos ("1 canales, 1 direcciones") en lugar del contenido real.

---

## Cambios implementados

### Atoms (campos de formulario)

**`src/components/core/Input.tsx`**, **`Select.tsx`**, **`SearchableSelect.tsx`**, **`Textarea.tsx`**  
Eliminada la transición `transition: border-color` / `transition-[border-color]` de todos los wrappers. El cambio de borde en error ahora es instantáneo. Ver L01 en `_notes/learnings-implementation.md`.

**`src/components/core/Stepper.tsx`** y **`src/components/modules/WizardAccordion/WizardStep.tsx`**  
Ajustes de altura de campos: todos los campos del wizard usan `h-[2.875rem]` (46px fijo) en lugar de `min-h-`. Ver L03.

### Logo preview (`StoreLogoField`)

`src/app/[locale]/(app)/stores/_components/share/StoreLogoField/StoreLogoField.tsx`

- Thumbnail de logo subido a 150×150px (`size-[150px]`).
- Eliminado el botón "Replace"; quedaron únicamente "Edit" (cuando el archivo es modificable) y "Remove".
- En el preview con logo cargado: se muestra el nombre del archivo (`submission.file.name`) y el peso (`formatFileSize(submission.file.size)`), en lugar de `copy.acceptedFormats`.
- Los botones Edit/Remove se ubican bajo la info de archivo dentro de la misma tarjeta preview.

### StoreContactChannelEditor

`src/app/[locale]/(app)/stores/_components/share/StoreContactChannelEditor.tsx`

- **Formulario colapsado por defecto.** Solo visible el botón "Añadir canal" (ghost sm + Plus icon). El formulario se abre al hacer click.
- **Botón X de cancelar** en la esquina del card del formulario. Cierra sin agregar.
- **Validación por tipo** (`validateChannelValue`): Instagram, Facebook, TikTok, Website exigen el dominio respectivo o `https://`; WhatsApp acepta URL wa.me o número con `+`; Email, regex básico; Phone, `+` seguido de dígitos; Other, sin validación de formato.
- **Error inline** bajo el formulario con `<AlertCircle>` + mensaje localizado.
- **Prop `onFormOpenChange?: (open: boolean) => void`** — notifica al padre cuando el formulario está abierto para que el wizard pueda bloquear el avance.
- **Label `addChannel: string`** (ahora requerido en `Labels`). Todos los call-sites actualizados (CreateStoreForm + EditStoreForm).
- **Label `validationError?: (errorKey: string) => string`** — resuelve el texto del error según la clave del tipo.

### CreateStoreForm — paso 3

`src/app/[locale]/(app)/stores/new/_components/CreateStoreForm.tsx`

- Añadido encabezado `<Label>` "Comportamiento comercial" (`step3.stockSectionLabel`) sobre los toggles de stock y preórdenes. Los controles ya no flotan sin contexto visual.

### CreateStoreForm — paso 4 (addresses)

Mismo archivo.

- **Patrón staged-add**: el botón "Añadir dirección" no inserta una fila vacía inmediatamente. Abre un formulario pending (ciudad, línea, referencia). El usuario llena y hace click en "Agregar" → se confirma la entrada. X cancela sin agregar.
- **Estado completamente controlado**: `addressData: Array<{id, city, addressLine, reference}>` reemplaza el anterior `addressRows: number[]`. El estado completo de cada dirección vive en React, lo que permite renderizar el contenido en el paso de review sin acceder al DOM.
- **Bloqueo de avance**: si alguno de los dos formularios (canal o dirección) está abierto al intentar avanzar, el `validate()` del WizardStep agrega los errores `channelFormOpen` / `addressFormOpen` y retorna `false`. Los mensajes de advertencia localizados se inyectan desde los namespaces i18n correspondientes.

### CreateStoreForm — paso 5 (review)

Mismo archivo.

- **Canales**: por cada `ContactChannelEntry`, se renderiza una fila `<dt>` (tipo, en muted) + `<dd>` (value, truncado).
- **Direcciones**: por cada dirección, se renderiza la ciudad + línea + referencia en stack vertical separado por `mt-1 space-y-0.5`.
- Sin conteos; siempre datos reales.

### i18n

`src/i18n/locales/es/stores.json` y `src/i18n/locales/en/stores.json`

Claves añadidas bajo `redesign.create`:

| Clave                                | es                                                  | en                                           |
| ------------------------------------ | --------------------------------------------------- | -------------------------------------------- |
| `step3.stockSectionLabel`            | Comportamiento comercial                            | Commerce behavior                            |
| `channels.addChannel`                | Añadir canal                                        | Add channel                                  |
| `channels.formOpenWarning`           | Termina de agregar el canal antes de continuar.     | Finish adding the channel before continuing. |
| `channels.validationError.required`  | El valor no puede estar vacío.                      | Value cannot be empty.                       |
| `channels.validationError.INSTAGRAM` | Ingresa la URL de Instagram (instagram.com/…).      | Enter your Instagram URL (instagram.com/…).  |
| `channels.validationError.WHATSAPP`  | Ingresa un número con + o una URL de wa.me.         | Enter a number with + or a wa.me URL.        |
| `channels.validationError.EMAIL`     | Ingresa una dirección de correo válida.             | Enter a valid email address.                 |
| `channels.validationError.PHONE`     | Ingresa un número con código de país (+51…).        | Enter a number with country code (+1…).      |
| `channels.validationError.FACEBOOK`  | Ingresa la URL de Facebook (facebook.com/…).        | Enter your Facebook URL (facebook.com/…).    |
| `channels.validationError.TIKTOK`    | Ingresa la URL de TikTok (tiktok.com/…).            | Enter your TikTok URL (tiktok.com/…).        |
| `channels.validationError.WEBSITE`   | Ingresa una URL completa (https://…).               | Enter a full URL (https://…).                |
| `addresses.formOpenWarning`          | Termina de agregar la dirección antes de continuar. | Finish adding the address before continuing. |

---

## Errores corregidos durante la sesión

1. **`addChannel` faltaba en EditStoreForm**: al agregar el prop requerido `addChannel` a `Labels`, TypeScript falló en `EditStoreForm`. Resuelto añadiendo `addChannel` y `validationError` a ese archivo. Ver L08.

2. **`FORMATTING_ERROR` en `addressItemLabel`**: `rowLabel` usaba `tCreate("addressItemLabel").replace("{index}", ...)`. next-intl intercepta las llaves `{variable}` y requiere que sean pasadas como segundo argumento. Resuelto: `tCreate("addressItemLabel", { index: rowIndex + 1 })`. Ver L07.

---

## Validación final

- `npm run type-check`: 0 errores.
- `npm run lint`: 0 errores, 14 warnings preexistentes (sin cambio).
- `npm run test`: 411 tests ✅.
- Manual en navegador: flujo create completo, paso 4 (canales + direcciones), paso 5 (review). Sin regresiones visibles.

---

## Aprendizajes registrados

Ver `docs/redesign/_notes/learnings-implementation.md` — 10 entradas L01–L10 creadas en esta sesión.

---

## Handoff brief para la próxima conversación

### Estado del branch `redesign`

5 archivos modificados (no commiteados). Los cambios son todos en el módulo Tiendas y componentes compartidos.

### Qué viene después: S7 — Módulo Órdenes

La próxima sesión es S7 (módulo Órdenes). Antes de iniciarla:

1. **Commit de M04**: commitear los 5 archivos modificados más este doc y las actualizaciones de `store-create.md` + `README.md`.
2. **Gate visual humano**: verificar en el navegador el wizard de creación con los cambios de M04 antes de avanzar.
3. **S7 Fase A**: análogo al proceso de S6 — extender el demo HTML con las pantallas del módulo Órdenes, iterar hasta aprobación visual, producir spec markdown + handoff brief para Fase B.

### Archivos modificados en M04

```
src/app/[locale]/(app)/stores/new/_components/CreateStoreForm.tsx
src/components/core/Stepper.tsx
src/components/modules/WizardAccordion/WizardStep.tsx
src/i18n/locales/en/stores.json
src/i18n/locales/es/stores.json
```

Archivos tocados en sesiones previas (ya commiteados):

```
src/app/[locale]/(app)/stores/_components/share/StoreContactChannelEditor.tsx
src/app/[locale]/(app)/stores/_components/share/StoreLogoField/StoreLogoField.tsx
src/app/[locale]/(app)/stores/[slug]/edit/_components/EditStoreForm.tsx
src/components/core/Input.tsx
src/components/core/Select.tsx
src/components/core/SearchableSelect.tsx
src/components/core/Textarea.tsx
```

### Contexto que el agente de S7 debe leer

1. `docs/redesign/README.md` — estado del subproyecto.
2. `docs/redesign/methodology.md` — metodología post-S4 (Fase A + Fase B).
3. `docs/redesign/_notes/learnings-implementation.md` — L01–L10, lectura obligatoria antes de implementar.
4. `docs/redesign/screens/store-create.md` — spec de referencia (patrón para producir el spec de Órdenes).
5. `docs/redesign/sessions/06-stores-impl.md` — cómo fue S6 Fase B (referencia de proceso).
6. El FRD de pedidos (`docs/product/prd-01-collector-mvp/frd-02-orders/`) para entender el contrato funcional del módulo.
