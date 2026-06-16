---
title: Voice library — voz constante, tono por contexto
session: 12-motion-voice (Fase A)
status: Fase A — propuesta (gate humano pendiente)
last_updated: 2026-06-15
owner: Sergio Minei
related:
  - principles.md §7 (voice glossary — fuente de la voz)
  - docs/product/glossary.md (terminología canónica es/en)
  - PLAYBOOK.md §5.2 (español neutro obligatorio — constraint duro)
  - _notes/s12-motion-voice-research.md (insumo Part B: Mailchimp / Slack / Duolingo)
  - .cursor/rules/role-copywriting-marketing.mdc
---

# Voice library (S12)

> **S12 no escribe copy nuevo de producto.** Sistematiza **cómo** se escribe: una **voz constante**
>
> - una **matriz de tono por contexto**. El copy real ya vive en `src/i18n/locales/{es,en}/*.json`
>   (S6–S11); esta library es la referencia de calibración contra la que se escribe y se revisa.

## Modelo (verificado en el research)

- **Voz-constante / tono-variable (Mailchimp).** Una voz fija + una matriz que cambia el **tono** según
  el estado emocional del lector. **Regla dura: claridad > entretenimiento.** Humor solo cuando sale
  natural; _"si dudás, cara seria"_.
- **Tarea > personalidad en superficies funcionales (Slack).** Primero la info de la tarea, después
  voz/tono. Calidez liviana por **cadencia conversacional + contracciones** (en `en`: "You'll"), no por
  ingenio. Estado de pago, totales y tracking = task-first.
- **Tono-por-contexto con do/don't concretos (Duolingo).** Éxito → exclamación OK; error → amigable sin
  exagerar; sensible → _"bajá la euforia… tratalo no como contenido, sino como la vida de alguien"_.
- **El espectro Linear ↔ Arc/Duolingo ES la matriz.** Superficies de **plata / entrega / destructivas →
  polo Linear** (restraint, claridad). **Empty / onboarding / éxito → polo Arc/Duolingo** (delight,
  personalidad de coleccionista). El delight se **reserva** a momentos celebratorios; nunca sobre
  superficies de confianza.

---

## 1. La voz (constante — no cambia nunca)

Cuatro pilares enumerables (estructura Mailchimp), llenados desde `principles.md` §7. La voz es la
**misma en toda la app**; solo el **tono** se mueve (§2).

| #   | Pilar                        | Qué significa en PandaTrack                                                                                                                                                                                                         | Anti-patrón                                                                              |
| --- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | **Clara y directa**          | Una idea por línea. Voz activa ("Cancela este pedido", no "Este pedido será cancelado"). Brevedad sobre ingenio: si no sale algo natural en 5 s, escribí lo más corto y útil. Si una pantalla pide > 30 palabras, está mal pensada. | Párrafos, pasiva, frases de > 12 palabras                                                |
| 2   | **Cómplice, no corporativa** | `tú` siempre (nunca `usted`). Hablás como un amigo que sabe del tema. Cero corporativismo.                                                                                                                                          | "Le informamos", "Ha ocurrido", "Disculpe las molestias", "Sistema", "Operación exitosa" |
| 3   | **Traductora del dominio**   | Usás los términos del glosario (**pedido, entrega, tienda, producto, pago, pre-reserva, moneda**). El **dato es el héroe**: la cifra/fecha manda, el copy la enmarca ("$48,50 restantes de $120", no "$48,50").                     | Jerga técnica, sinónimos fuera del glosario (`orden`, `envío`), cifras sin contexto      |
| 4   | **Humor seco y puntual**     | Personalidad solo cuando sale natural y el riesgo es bajo. Máximo **1 emoji**, solo en celebración (✨ 🎉 🌱). "Si dudás, cara seria".                                                                                              | Meme storm ("bestie", "no cap", "slay"), emoji loops, chistes en errores/CTAs            |

**El sweet spot** (entre dos polos prohibidos — `principles.md` §7):

- ❌ **Linear-frío / corporativo:** _"Ha ocurrido un error en el procesamiento de su solicitud."_
- ✅ **Atelier:** _"Algo se rompió de este lado. Vuelve a intentarlo."_
- ❌ **Duolingo-cringe / TikTok-talk:** _"Ups bestie 💀 algo salió mal lol no cap fr"_

---

## 2. El tono (variable) — matriz tono-por-contexto

El eje es el **estado emocional del lector** en esa superficie. Dos polos; la voz (§1) sigue intacta en
ambos — lo que cambia es la temperatura.

| Polo                          | Cuándo                                                                                    | Temperatura                           | Emoji     | Exclamación |
| ----------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------- | --------- | ----------- |
| **Neutro / claro** (Linear)   | Plata, pagos, totales, tracking de entrega, **destructivas**, **errores**, confirmaciones | Serio, task-first, el dato manda      | **No**    | No          |
| **Juguetón** (Arc / Duolingo) | Empty states, onboarding, **éxito / achievement**                                         | Cálido, personalidad de coleccionista | 1 puntual | OK          |

### 2.1 La matriz completa

| Contexto / superficie    | Estado del lector     | Polo                  | Reglas de tono                                                  | Ejemplo ✅ (es neutro)                                         |
| ------------------------ | --------------------- | --------------------- | --------------------------------------------------------------- | -------------------------------------------------------------- |
| Estado de pago / saldo   | enfocado, calculando  | **Neutro**            | Cifra primero, sin chiste                                       | _"Te quedan $48,50 de $120."_                                  |
| Total / roll-up          | escaneando            | **Neutro**            | Dato héroe, `tabular-nums`                                      | _"$1.240 en 8 pedidos."_                                       |
| Confirmar destructiva    | dudando, con riesgo   | **Neutro**            | Nombra qué se pierde, sin dramatizar                            | _"¿Borrar este pedido? Sus pagos también se van."_             |
| Error 500 / servidor     | frustrado             | **Neutro**            | Asume la culpa, propone acción, no pide perdón                  | _"Algo se rompió de este lado. Vuelve a intentarlo."_          |
| Error de validación      | corrigiendo           | **Neutro**            | Nombra el problema + el arreglo; conserva lo tipeado            | _"La fecha de entrega no puede ser anterior a la del pedido."_ |
| Pago vencido / atraso    | preocupado (dinero)   | **Neutro (sensible)** | _"Tratalo como la vida de alguien"_: cero euforia, cero mascota | _"Pago vencido hace 3 días."_                                  |
| Empty · primera vez      | explorando, sin datos | **Juguetón**          | Invita a la primera acción (declarativo)                        | _"Sin pre-reservas todavía. Suma una y empezamos."_            |
| Empty · sin resultados   | filtrando             | **Neutro-cálido**     | Ofrece quitar filtros, sin culpa                                | _"Nada con esos filtros. ¿Quitamos alguno?"_                   |
| Onboarding / primer paso | nuevo, motivado       | **Juguetón**          | Cómplice, breve, segunda persona                                | _"Vamos por tu primera tienda."_                               |
| Éxito / toast de logro   | satisfecho            | **Juguetón**          | Exclamación OK, 1 emoji, breve                                  | _"Listo. Pieza nueva en tu colección. 🎉"_                     |
| Achievement (hito)       | celebrando            | **Juguetón**          | Único lugar para `--ease-bounce` + emoji                        | _"Pre-reserva 100% pagada. 🎉"_                                |
| CTA primario             | decidido              | **Neutro-cálido**     | Verbo + objeto, corto                                           | _"Anotar pago"_ · _"Crear pedido"_                             |
| Helper / placeholder     | en duda menor         | **Neutro-cálido**     | Guía, no regaña                                                 | _"¿Para cuándo?"_ (date picker)                                |
| Loading                  | esperando             | **Neutro**            | Preferir skeleton sin texto; si hace falta: una palabra         | _"Buscando…"_                                                  |

> **Regla de oro:** ante la duda, **bajá al polo neutro**. El delight mal puesto (sobre plata, error o
> entrega fallida) saca al usuario del producto más rápido que el frío. Claridad **siempre** primero.

---

## 3. Do / Don't por superficie

Anclados en el glosario de 15 pares de `principles.md` §7 (la fuente de calibración) + los patrones
Duolingo/Mailchimp del insumo. Cada superficie muestra los **dos polos prohibidos** + el sweet spot.

### 3.1 Empty state

- ❌ Frío: _"No se encontraron pre-reservas registradas en el sistema."_
- ❌ Cringe: _"Ups, nada por acá bestie 👀 sumá algo no seas tímido"_
- ✅ Atelier (juguetón): _"Sin pre-reservas todavía. Suma una y empezamos."_

### 3.2 Error

- ❌ Frío: _"Ha ocurrido un error en el servidor. Por favor, contacte al administrador."_
- ❌ Cringe / sobre-disculpa: _"Uff perdón perdón se rompió todo 😭 mil disculpas"_
- ✅ Atelier (neutro, asume la culpa): _"Algo se rompió de este lado. Vuelve a intentarlo."_
- **Duolingo:** error amigable sin exagerar; ni el frío "Incorrecto." ni la sobre-disculpa.

### 3.3 Confirmación destructiva

- ❌ Frío: _"¿Está seguro que desea eliminar este pedido? Esta acción es irreversible."_
- ❌ Cringe: _"¿Seguro seguro? 😳 no hay vuelta atrás eh"_
- ✅ Atelier (neutro, nombra la consecuencia): _"¿Borrar este pedido? Sus pagos también se van."_

### 3.4 Onboarding

- ❌ Frío: _"Para comenzar, deberá crear su primera tienda."_
- ❌ Cringe: _"Arrancá fuerte 🚀 creá tu primera tienda y rompela"_
- ✅ Atelier (juguetón, cómplice): _"Vamos por tu primera tienda."_

### 3.5 Success toast

- ❌ Frío: _"El pago ha sido procesado exitosamente. Saldo restante: $48,50 USD."_
- ❌ Cringe: _"GG 🤑 plata anotada bestie te quedan $48,50"_
- ✅ Atelier (neutro para la cifra + cálido): _"Listo. Te quedan $48,50."_
- **Duolingo:** éxito con exclamación OK ("¡Listo!"), no la versión enciclopédica ("Has procesado
  exitosamente…").

### 3.6 Helper / microcopy

- ❌ Frío: _"Seleccione una fecha del calendario."_
- ❌ Cringe: _"¿Cuándo cae? 📅 tú dale fecha"_
- ✅ Atelier (neutro-cálido, guía): _"¿Para cuándo?"_

---

## 4. Español neutro (constraint duro) — reconciliación con §7

**Vinculante (PLAYBOOK §5.2):** todo el copy usa **español neutro internacional**. Sin modismos
regionales. La voz de §7 (informal, cómplice, `tú`) se mantiene; lo que se neutraliza es el **dialecto**.

- ❌ Voseo / argentinismos: "dejás", "podés", "anotá", "tenés", "querés", "necesitás", "agregá",
  "elegí", "guardá", "dale".
- ✅ Tuteo neutro: "deja", "puedes", "anota", "tienes", "quieres", "necesitas", "agrega", "elige",
  "guarda".

### 4.1 Drift detectado en `principles.md` §7 (flag, no fix silencioso)

El glosario de §7 es la fuente de la voz, pero algunos ejemplos quedaron en dialecto rioplatense. Se
**flaggean** acá para un pase de limpieza de copy (PLAYBOOK §5.2: _flageá pero no fixees silenciosamente_).
El copy **nuevo** ya usa la forma neutra.

| §7 ref                          | Hoy (dialecto)                               | Neutro propuesto                                     |
| ------------------------------- | -------------------------------------------- | ---------------------------------------------------- |
| #3 Error 500                    | _"Dale otra vez."_                           | _"Vuelve a intentarlo."_                             |
| Reglas/anti-patrón (texto guía) | "dudás", "tratalo", "bajá" en la prosa de §7 | Forma neutra al reescribir §7 en el pase de limpieza |

> No se reescribe `principles.md` en S12 (es docs histórico de S1). El pase de neutralización es trabajo
> de Fase B / cross-cutting de copy. Lo que importa: **el copy que entra a `i18n` usa neutro desde el
> primer minuto**, y esta library es el árbitro.

---

## 5. Cómo se hace enforceable

La voice library **no es código** — es la capa de convención que calibra el copy. Se vuelve enforceable por:

1. **Glosario** (`docs/product/glossary.md`) — términos canónicos es/en. **Binding.** Ya enforced por
   `role-copywriting-marketing.mdc` + `english-code-only.mdc`. La library **no** redefine términos: los consume.
2. **Matriz de tono (§2)** — la dimensión que el glosario no cubre: **qué polo** por superficie. Cualquier
   copy nuevo se ubica en la matriz antes de escribirse.
3. **Copy real en next-intl** — `src/i18n/locales/{es,en}/*.json`. La library es el árbitro; el copy es
   el artefacto. Toda key nueva se compara contra el glosario de 15 pares de §7 + esta matriz antes de mergear.
4. **Paridad es ↔ en (reinterpretar, no traducir — §7 regla 8).** _"Te quedan $48,50"_ en `es` →
   _"$48,50 to go"_ en `en`, no _"$48,50 left to you"_. El `en` gana calidez por **contracciones**
   (Slack B2: "You'll" > "You will"). Cada par se escribe junto, no por traducción literal.
5. **Checklist de review** (al escribir/revisar copy):
   - ¿Término del glosario? · ¿Polo correcto de la matriz? · ¿`tú`, voz activa, una idea por línea? ·
     ¿Español neutro (sin voseo)? · ¿≤ 1 emoji y solo en celebración? · ¿El dato es el héroe? ·
     ¿Paridad es/en reinterpretada?

---

## 6. Handoff a Fase B

La voz **ya está mayormente aplicada** (S6–S11). El trabajo de Fase B para voice es de **revisión de
copy**, no de componentes nuevos:

1. **Audit del copy existente** (`src/i18n/locales/es/*.json` + `en/*.json`) contra la matriz §2 y el
   glosario §7 — marcar superficies fuera de polo.
2. **Neutralizar el drift dialectal** (§4.1) en un pase dedicado: el "Dale otra vez" y similares.
3. **Paridad en**: pasar el `en` por el filtro de reinterpretación + contracciones (§5.4).
4. **Copy nuevo** (si Fase B agrega superficies de motion con texto, ej. estados de VT/loading): seguir la
   matriz desde el primer minuto.

**Riesgo:** la voz es subjetiva — el gate humano de Sergio es el árbitro final de "¿esto suena a
PandaTrack?". La matriz reduce el espacio de decisión, no lo elimina.

**Validación:** docs/convención. Si el pase de copy toca `i18n` + componentes, aplican `npm run lint`
(claves) + revisión visual de las superficies tocadas. Sin cambios de comportamiento.
