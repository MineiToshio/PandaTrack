# UX Copy

This document defines PandaTrack's voice, tone, and writing principles for in-app microcopy: empty states, info banners, error messages, helper text, confirmation dialogs, and CTAs.

This is the companion to `interface-patterns.md` (which covers placement and component choice) and `visual-foundations.md` (which covers visual treatment). Read this file when writing or reviewing any user-facing string inside the private collector workspace.

## Product Voice

PandaTrack speaks like a knowledgeable friend who helps collectors stay on top of their orders, not like a system log or a legal notice.

**Core traits:**

- **Human, not mechanical.** Sentences should sound like something a person would say, not a status code.
- **Warm and supportive.** Sound like someone helping, not issuing instructions. Use "we" for what PandaTrack does and "you" for what the user does. Small words like "just", "solo", "por ti" make a task feel light.
- **Benefit-led.** Lead with what the user gains, not with what the system needs.
- **Written for someone discovering the app.** Never assume the reader has seen other screens. Describe benefits as concrete outcomes a first-time user can picture (e.g. "see how much you've spent in total"), not as references to product areas they may not have discovered yet (e.g. "in your dashboard and reports").
- **Contextual.** Every message should answer the implicit question "why does this matter to me right now?"
- **Concise but complete.** Cut filler words, but never cut the context the user needs to act.
- **Direct.** No hedging, no excessive politeness, no exclamation marks as a substitute for substance.

**Target audience:** collectors aged roughly 18–25 who are comfortable with digital apps but should never feel like they are reading documentation.

## Tone by Surface

| Surface              | Tone                                                                     |
| -------------------- | ------------------------------------------------------------------------ |
| Empty states         | Warm, motivational, action-oriented                                      |
| Info banners         | Helpful, non-alarmist, benefit-framed                                    |
| Error messages       | Clear, non-blaming, actionable                                           |
| Confirmation dialogs | Direct, specific about consequences                                      |
| Helper text          | Concise, answers "why does this field exist?"                            |
| Success toasts       | Affirming, short, no exclamation marks unless the moment truly earns one |
| CTAs                 | Action verb first, specific, never vague                                 |

## Writing Rules

### Always give context

Never name a state without explaining its consequence or benefit.

- Bad: "No base currency configured. Exchange rate unavailable."
- Good: "We'll show you how much you've spent in total, even when you buy from stores in different countries. Just choose your base currency and we'll convert each order to it for you."

The bad version names an absence. The good version explains what becomes possible.

### Lead with the benefit

Start messages with what the user gains, not with what they are missing or what went wrong.

- Bad: "You don't have a profile photo."
- Good: "Add a photo so stores and other collectors can recognize you."

### Write for someone discovering the app

The reader may be on their very first screen. They may not know yet that PandaTrack has a dashboard, a budget, or reports. Describe benefits as outcomes a first-time user can picture right now, not as references to features they haven't seen yet.

- Bad: "See your budget, dashboard, and reports in one currency."
- Good: "See how much you've spent in total, even when you buy from stores in different countries."

If a benefit only makes sense after the user has explored the app, rephrase it as the tangible outcome behind that feature.

### Be specific about consequences in destructive actions

Confirmation dialogs must say exactly what will be lost or removed.

- Bad: "Are you sure?"
- Good: "Leave without saving? Changes you made will not be saved."
- Good: "Cancel this order? The 2 recorded payments will be removed and 1 in-transit delivery will be unlinked."

### Write CTAs as verb + object

The label should describe the action, not just confirm it.

- Bad: "Accept", "Yes", "OK", "Set it up now", "Configurar ahora"
- Good: "Create store", "Choose base currency", "Delete order", "Back to form"

Exception: "Cancel" and "Leave" are acceptable for cancel/back actions where the object is implicit from context.

### Keep helper text functional

Helper text below a field should answer "why does this field exist or what should I put here?", not repeat the label.

- Bad: label "Base currency", helper "Select your base currency."
- Good: label "Base currency", helper "Used to convert your order costs and calculate your budget."

### Avoid jargon

Use plain language. When a technical term is unavoidable, explain it in the same sentence.

- Bad: "Exchange rate required for cross-currency orders."
- Good: "Enter how many [base currency] equal 1 [order currency] to calculate the cost in your local currency."

## Pattern Reference

### Empty states

Structure: icon + title + one supporting sentence + primary CTA.

The title names what is missing in a forward-looking way, not as a problem. The supporting sentence explains what becomes possible once the gap is filled. The CTA starts with a verb.

Example: no stores

> **"Start with a store"**
> To create an order, you'll need at least one store on record. Add your first one and come back when you're ready.
> `[Create store]`

### Info banners

Use for non-blocking guidance that helps the user unlock more value. Never use `warning` treatment for informational content, only for genuine risks.

Structure: short benefit statement (as a concrete outcome, not a feature name) + inline link CTA.

Example: no base currency

> ℹ "We'll show you how much you've spent in total, even when you buy from stores in different countries. Just choose your base currency and we'll convert each order to it for you." `[Choose base currency →]`

### Error messages

Structure: what happened (in plain language) + what to do.

Do not blame the user. Do not use passive voice to hide what failed.

- Bad: "An error occurred."
- Good: "We couldn't save the order. Check your connection and try again."
- Good (field-level): "Item name is required."

### Confirmation dialogs for destructive actions

Structure: question + specific consequence.

Always mention what will be permanently removed or changed when the action is irreversible.

- "Delete this order? The 3 recorded payments will also be removed. This cannot be undone."
- "Cancel this order? Payments and linked deliveries will be disconnected."

### Success toasts

One short sentence. Past tense. No exclamation marks unless the moment is genuinely celebratory (first order, milestone).

- "Order created."
- "Changes saved."
- "Store deleted."

## Language and Locale

- Write copy in both `es` (default) and `en` for every user-facing string.
- `es` is the primary locale; when in doubt about tone, write `es` first.
- Keep the same sentence length and structure across locales. Do not over-explain in one locale and under-explain in the other.
- All copy lives in `src/i18n/locales/{locale}/` JSON files. Never hardcode user-facing strings in components.
