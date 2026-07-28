# UX Copy

This document defines PandaTrack's voice, tone, and writing rules for in-app copy: empty states, info banners, error messages, helper text, confirmation dialogs, success toasts, and CTAs. It is normative — any new or revised user-facing string is calibrated against it before merge.

It is the companion to `interface-patterns.md` (placement and component choice) and `visual-foundations.md` (visual treatment). For the _copy that lives inside_ state surfaces (empty / error / loading) see `states.md`; for the success micro-moments copy rides on (toasts, achievement celebrations) see `motion.md`. The matching repository rule is `.agents/rules/role-copywriting-marketing.mdc`.

## The model: one voice, many tones

PandaTrack follows the Mailchimp model: **the voice is constant, the tone varies by context.** The voice — who we sound like — never changes across the app. The tone — how warm or serious that voice is on a given screen — flexes with the reader's emotional state on that surface.

Two principles sit above everything:

- **Clarity beats entertainment.** Personality is a garnish, never the dish. If wit and clarity ever conflict, clarity wins.
- **Task first, personality second.** On functional surfaces (payment status, totals, tracking) deliver the task's information first; voice and tone come after. Warmth comes from conversational cadence, not from cleverness.

> **When in doubt, go neutral.** Misplaced delight — on money, on a failed delivery, on an error — pushes the user out of the product faster than coldness ever does.

The copy itself lives in `src/i18n/locales/{es,en}/*.json`. **This document is the arbiter; the JSON is the artifact.** Because the product is Spanish-first, all examples below are Spanish (neutral Spanish — see §5).

---

## 1. The voice (constant — never changes)

Four pillars define the voice. They hold on every screen; only the tone (§2) moves.

### Pillar 1 — Clear and direct

One idea per line. Active voice. Brevity over wit.

- Active, not passive: "Cancela este pedido", not "Este pedido será cancelado".
- One idea per line. If a sentence runs past ~12 words, split it. If a screen needs more than ~30 words of copy, the screen is mis-designed, not under-written.
- The data is the hero (Pillar 3); copy frames it, it doesn't bury it.
- If nothing natural comes in 5 seconds, write the shortest useful thing. "Listo" beats a forced joke.

### Pillar 2 — Complicit, not corporate

Sound like a friend who knows the domain, not like a system log or a legal notice.

- **`tú` always, never `usted`.** No exceptions in product copy. (Legal text in `terms` / `privacy` keeps its own formal register and is out of scope for this rule.)
- Zero corporativism. Banned phrasings: _"Le informamos"_, _"Ha ocurrido"_, _"Tenga en cuenta"_, _"Disculpe las molestias"_, _"Sistema"_, _"Procesamiento"_, _"Operación exitosa"_, and _"Por favor"_ in CTAs and validations (real courtesies are fine).
- Errors don't blame and don't grovel: assume the fault when it's ours, never apologize to the user for something they didn't do.

### Pillar 3 — Domain translator

Use the glossary terms; let the number speak.

- Use the canonical product terms — **pedido, entrega, tienda, producto, pago, pre-reserva, moneda, moneda base** (§7). No synonyms.
- **The data is the hero.** The figure or date leads; the copy frames it: _"Te quedan $48,50 de $120"_, not a bare _"$48,50"_ and not _"$48,50"_ drowned in prose.
- No technical jargon. When a technical term is unavoidable, explain it in the same sentence.

### Pillar 4 — Dry, punctual humor

Personality only when it comes naturally and the risk is low.

- Max **1 emoji** per message, and only in celebratory moments (✨ achievement, 🎉 collection milestone, 🌱 first order). Never in errors, never in ordinary CTAs.
- No meme storm: ban _"bestie"_, _"no cap"_, _"slay"_, _"literally me"_, emoji loops.
- "If in doubt, straight face."

### The sweet spot — between two banned poles

Every pillar lives between a cold failure and a cringe failure:

- ❌ **Cold / corporate:** _"Ha ocurrido un error en el procesamiento de su solicitud."_
- ✅ **Sweet spot:** _"Algo se rompió de este lado. Vuelve a intentarlo."_
- ❌ **Cringe / TikTok-talk:** _"Ups bestie 💀 algo salió mal lol no cap fr"_

Either pole pushes the user out of the product.

---

## 2. The tone (variable) — the tone-by-context matrix

The axis is the **reader's emotional state** on the surface. There are two poles; the voice (§1) stays intact in both — only the temperature changes.

| Pole                  | When                                                                                                    | Temperature                         | Emoji       | Exclamation |
| --------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------- | ----------- |
| **Neutral / serious** | Money, payments, totals, delivery tracking, **destructive actions**, **errors**, confirmations, overdue | Serious, task-first, the data leads | **No**      | No          |
| **Playful / warm**    | Empty states, onboarding, **success / achievement**                                                     | Warm, collector personality         | 1, punctual | OK          |

Playful warmth is **reserved** for celebratory moments. It never sits on a trust surface (money, delivery, errors).

### 2.1 The full matrix

| Context / surface           | Reader state         | Pole                    | Tone rule                                               | Example ✅ (neutral es)                                        |
| --------------------------- | -------------------- | ----------------------- | ------------------------------------------------------- | -------------------------------------------------------------- |
| Payment status / balance    | focused, calculating | **Neutral**             | Figure first, no joke                                   | _"Te quedan $48,50 de $120."_                                  |
| Total / roll-up             | scanning             | **Neutral**             | Data is hero, `tabular-nums`                            | _"$1.240 en 8 pedidos."_                                       |
| Confirm destructive         | hesitating, at risk  | **Neutral**             | Name what's lost, don't dramatize                       | _"¿Borrar este pedido? Sus pagos también se van."_             |
| Error 500 / server          | frustrated           | **Neutral**             | Assume the fault, offer an action, don't apologize      | _"Algo se rompió de este lado. Vuelve a intentarlo."_          |
| Validation error            | correcting           | **Neutral**             | Name the problem + the fix; keep what they typed        | _"La fecha de entrega no puede ser anterior a la del pedido."_ |
| Overdue payment             | worried (money)      | **Neutral (sensitive)** | Treat it as someone's life: zero euphoria, zero mascot  | _"Pago vencido hace 3 días."_                                  |
| Empty · first time          | exploring, no data   | **Playful**             | Invite the first action (declarative)                   | _"Sin pre-reservas todavía. Suma una y empezamos."_            |
| Empty · no results          | filtering            | **Neutral-warm**        | Offer to clear filters, no blame                        | _"Nada con esos filtros. ¿Quitamos alguno?"_                   |
| Onboarding / first step     | new, motivated       | **Playful**             | Complicit, brief, second person                         | _"Vamos por tu primera tienda."_                               |
| Success / achievement toast | satisfied            | **Playful**             | Exclamation OK, 1 emoji, brief                          | _"Listo. Pieza nueva en tu colección. 🎉"_                     |
| Achievement (milestone)     | celebrating          | **Playful**             | The one place for bounce easing + emoji                 | _"Pre-reserva 100% pagada. 🎉"_                                |
| Primary CTA                 | decided              | **Neutral-warm**        | Verb + object, short                                    | _"Anotar pago"_ · _"Crear pedido"_                             |
| Helper / placeholder        | minor doubt          | **Neutral-warm**        | Guide, don't scold                                      | _"¿Para cuándo?"_ (date picker)                                |
| Loading                     | waiting              | **Neutral**             | Prefer a textless skeleton; if text is needed, one word | _"Buscando…"_                                                  |

> **Rule of thumb:** when unsure, drop to the neutral pole. Clarity first, always.

---

## 3. Do / Don't by surface

Each surface has a cold anti-pattern, a cringe anti-pattern, and a sweet spot. Aim for the sweet spot every time.

### 3.1 Empty state — _playful_

- ❌ Cold: _"No se encontraron pre-reservas registradas en el sistema."_
- ❌ Cringe: _"Ups, nada por acá bestie 👀 suma algo no seas tímido"_
- ✅ Sweet spot: _"Sin pre-reservas todavía. Suma una y empezamos."_

### 3.2 Error — _neutral, assume the fault_

- ❌ Cold: _"Ha ocurrido un error en el servidor. Por favor, contacte al administrador."_
- ❌ Cringe / over-apology: _"Uff perdón perdón se rompió todo 😭 mil disculpas"_
- ✅ Sweet spot: _"Algo se rompió de este lado. Vuelve a intentarlo."_

Friendly but not exaggerated: neither the cold "Incorrecto." nor the grovel.

### 3.3 Destructive confirmation — _neutral, name the consequence_

- ❌ Cold: _"¿Está seguro que desea eliminar este pedido? Esta acción es irreversible."_
- ❌ Cringe: _"¿Seguro seguro? 😳 no hay vuelta atrás eh"_
- ✅ Sweet spot: _"¿Borrar este pedido? Sus pagos también se van."_

### 3.4 Onboarding — _playful, complicit_

- ❌ Cold: _"Para comenzar, deberá crear su primera tienda."_
- ❌ Cringe: _"Arranca fuerte 🚀 crea tu primera tienda y rómpela"_
- ✅ Sweet spot: _"Vamos por tu primera tienda."_

### 3.5 Success toast — _neutral on the figure, warm around it_

- ❌ Cold: _"El pago ha sido procesado exitosamente. Saldo restante: $48,50 USD."_
- ❌ Cringe: _"GG 🤑 plata anotada bestie te quedan $48,50"_
- ✅ Sweet spot: _"Listo. Te quedan $48,50."_

Exclamation is OK for a genuine milestone ("¡Listo!"), never the encyclopedic "Has procesado exitosamente…".

### 3.6 Helper / microcopy — _neutral-warm, guide_

- ❌ Cold: _"Seleccione una fecha del calendario."_
- ❌ Cringe: _"¿Cuándo cae? 📅 tú dale fecha"_
- ✅ Sweet spot: _"¿Para cuándo?"_

---

## 4. Writing rules

These apply across all surfaces and refine the four pillars.

### Always give context

Never name a state without explaining its consequence or benefit. The data is the hero, but a bare figure isn't context.

- Bad: "No base currency configured. Exchange rate unavailable."
- Good: "Te mostramos cuánto llevas gastado en total, aunque compres en tiendas de distintos países. Elige tu moneda base y convertimos cada pedido por ti."

The bad version names an absence; the good version explains what becomes possible.

### Lead with the benefit

Start with what the user gains, not with what's missing or what went wrong.

- Bad: "No tienes foto de perfil."
- Good: "Agrega una foto para que las tiendas y otros coleccionistas te reconozcan."

### Write for someone discovering the app

The reader may be on their very first screen and may not know there's a dashboard, a budget, or reports. Describe benefits as outcomes they can picture now, not as references to features they haven't found yet.

- Bad: "Ve tu presupuesto, panel y reportes en una sola moneda."
- Good: "Ve cuánto llevas gastado en total, aunque compres en tiendas de distintos países."

### Be specific about consequences in destructive actions

Confirmation dialogs must say exactly what will be lost. When the action is irreversible, name it.

- Bad: "¿Estás seguro?"
- Good: "¿Salir sin guardar? Se perderán los cambios."
- Good: "¿Cancelar este pedido? Se quitan los 2 pagos registrados y se desvincula 1 entrega en tránsito."

### Write CTAs as verb + object

The label describes the action, not just confirms it.

- Bad: "Aceptar", "Sí", "OK", "Configurar ahora"
- Good: "Crear tienda", "Elegir moneda base", "Borrar pedido", "Volver al formulario"

Exception: "Cancelar" and "Volver" are fine for cancel/back actions where the object is implicit.

### Required vs optional field labels

Forms use one consistent convention: required is the default and is unmarked; optional fields are tagged explicitly. Never mix asterisks and tags.

- Required: the field name only. No asterisk, no "requerido".
  - Good (es): `"costLabel": "Costo"` · Good (en): `"costLabel": "Cost"`
- Optional: append `(opcional)` / `(optional)` inside the string.
  - Good (es): `"expectedArrivalLabel": "Llegada estimada (opcional)"`
  - Good (en): `"expectedArrivalLabel": "Expected arrival (optional)"`
- Bad: `"Costo *"`, `"Costo (requerido)"`, mixing asterisks-for-required with `(opcional)` in the same screen.

See `interface-patterns.md` → "Form field required vs optional labeling" for the matching component rule.

### Keep helper text functional

Helper text answers "why does this field exist / what goes here?", never repeats the label.

- Bad: label "Moneda base", helper "Selecciona tu moneda base."
- Good: label "Moneda base", helper "Se usa para convertir los costos de tus pedidos y calcular tu presupuesto."

### Never use the em dash (`—`) in copy

The em dash (`—`, U+2014) is banned in every user-facing string — `es`, `en`, marketing, in-app, and hardcoded labels built in components. Reach for the punctuation the sentence actually needs:

| Instead of an em dash…          | Use                          | Example                                                                         |
| ------------------------------- | ---------------------------- | ------------------------------------------------------------------------------- |
| Aside / appositive              | Parentheses or paired commas | "el ciclo (tienda, pedido, pago y entrega)"                                     |
| Two independent clauses         | Period or semicolon          | "Opcional. Puedes editarlo después."                                            |
| Label + explanation             | Colon or comma               | "Un vendedor individual: amigo, scout, revendedor." / "Privada, solo tú la ves" |
| Code / name or inline separator | Middot `·`                   | "PEN · Sol peruano"                                                             |
| Numeric range                   | En dash `–` (keep)           | "15 – 22 may"                                                                   |

**The only allowed em dash** is a standalone null / empty placeholder — a value that is _exactly_ `—`, showing an absent number, name, or date in a summary cell. There it is the "nothing here" glyph, not punctuation.

Enforced automatically by `src/test/em-dash-copy-guard.test.ts`, which fails on any em dash in `src/i18n/locales/**` that is not a standalone placeholder.

---

## 5. Neutral Spanish (hard constraint)

All copy uses **international neutral Spanish.** The informal, complicit `tú` voice from §1 stays; what gets neutralized is the dialect. No voseo, no regionalisms.

- ❌ Voseo / regional: "dejás", "podés", "anotá", "tenés", "querés", "necesitás", "agregá", "elegí", "guardá", "dale".
- ✅ Neutral `tú`: "deja", "puedes", "anota", "tienes", "quieres", "necesitas", "agrega", "elige", "guarda".

### es ↔ en parity = reinterpret, don't translate

Write the pair together; do not translate literally. The `en` earns warmth through contractions, not added words.

- _"Te quedan $48,50"_ (es) → _"$48,50 to go"_ (en) — **not** _"$48,50 left to you"_.
- Prefer _"You'll"_ over _"You will"_ in `en`.

Keep sentence length and structure comparable across locales: don't over-explain in one and under-explain in the other.

---

## 6. Pattern reference

Durable structure per surface, aligned with the matrix (§2).

### Empty states

Structure: icon + title + one supporting sentence + primary CTA. The title names what's missing in a forward-looking way (not as a problem); the sentence says what becomes possible; the CTA starts with a verb. Tone: **playful** (first-time) or **neutral-warm** (no results).

> **"Sin pre-reservas todavía"**
> Suma una y empezamos a seguir tus pagos.
> `[Crear pre-reserva]`

### Info banners

Use for non-blocking guidance that unlocks value. Never use `warning` treatment for informational content — only for genuine risk. Tone: **neutral-warm**. Structure: short benefit statement (concrete outcome, not feature name) + inline link CTA.

> ℹ "Te mostramos cuánto llevas gastado en total, aunque compres en tiendas de distintos países. Elige tu moneda base y convertimos cada pedido por ti." `[Elegir moneda base →]`

### Error messages

Structure: what happened (plain language) + what to do. Don't blame the user; don't hide the failure behind passive voice. Tone: **neutral**.

- Bad: "Ha ocurrido un error."
- Good: "No pudimos guardar el pedido. Revisa tu conexión y vuelve a intentarlo."
- Good (field-level): "El nombre del producto es obligatorio."

### Confirmation dialogs (destructive)

Structure: question + specific consequence. Always name what's permanently removed or changed. Tone: **neutral**.

- "¿Borrar este pedido? También se quitan los 3 pagos registrados."
- "¿Cancelar este pedido? Se desvinculan los pagos y las entregas asociadas."

### Success toasts

One short sentence, past tense. No exclamation unless the moment is genuinely celebratory (first order, milestone). Tone: **neutral** on the figure, **playful** for a true achievement. See `motion.md` for the celebration micro-moment.

- "Pedido creado."
- "Cambios guardados."
- "Listo. Pieza nueva en tu colección. 🎉" (milestone only)

### CTA labels

Verb + object, short, specific. See "Write CTAs as verb + object" (§4).

### Helper text

Concise; answers "why this field exists". See "Keep helper text functional" (§4).

### Required / optional field labels

Required unmarked, optional tagged. See "Required vs optional field labels" (§4).

---

## 7. Product terminology

The product glossary is the source of truth for the canonical names of product concepts in both `es` and `en`. Read it before writing copy or naming any product UI string. This document does not redefine terms — it consumes them.

- Glossary: `docs/product/glossary.md`.
- **No synonyms.** Never `orden` for `pedido`; never `envío` for `entrega`. Required pairs include `pedido` ↔ `order`, `entrega` ↔ `delivery`, `tienda` ↔ `store`, `producto` ↔ `product`, `pre-reserva` ↔ `pre-order`, `pago` ↔ `payment`, `moneda base` ↔ `base currency`.
- Add new product concepts to the glossary in the same change that introduces them.

Enforcement is layered: the glossary fixes the _terms_; this document's matrix (§2) fixes the _tone_ per surface — the dimension the glossary doesn't cover. Both are checked before a new `i18n` key merges. The glossary rule is enforced by `.agents/rules/role-copywriting-marketing.mdc` and `.agents/rules/english-code-only.mdc`.

---

## Rules & anti-patterns

**Rules**

- Voice is constant; tone varies by reader state. When in doubt, go neutral.
- One idea per line, active voice, ~12 words max; ~30 words max per screen.
- `tú` always; the data is the hero; figures carry context.
- No em dash (`—`) in copy — comma, colon, period, parentheses, or `·`; the only exception is a standalone `—` null placeholder (§4). Guarded by `src/test/em-dash-copy-guard.test.ts`.
- Neutral Spanish — no voseo. es ↔ en is reinterpreted, not literal-translated.
- ≤ 1 emoji, celebratory moments only.
- Every new string is placed in the matrix and checked against the glossary before merge.

**Review checklist:** glossary term? · correct matrix pole? · `tú`, active voice, one idea per line? · neutral Spanish? · ≤ 1 emoji and only celebratory? · is the data the hero? · es/en reinterpreted, not translated?

**Anti-patterns**

- Corporativism: "Le informamos", "Ha ocurrido", "Tenga en cuenta", "Disculpe las molestias", "Sistema", "Procesamiento", "Operación exitosa".
- Apologizing for the user's nonexistent fault; passive voice hiding what failed.
- Cringe / meme storm: "bestie", "no cap", "slay", emoji loops; emoji or jokes on errors and ordinary CTAs.
- Voseo / regionalisms in copy ("dejás", "podés", "anotá").
- Bare figures without context; synonyms outside the glossary (`orden`, `envío`).
- Delight on a trust surface (money, delivery, error). Hardcoded strings in components — copy belongs in `src/i18n/locales/{es,en}/*.json`.
- Em dash (`—`) as sentence punctuation or a label separator (e.g. `` `${code} — ${name}` ``). It is copy, not a null placeholder, so it is banned.

> Historical note: this voice system was distilled during the "Velvet" redesign; the prior design system's copy conventions are superseded by this document.
