# Glossary

This document is the canonical glossary of product terminology used across PandaTrack. Both languages are canonical: every team-facing surface must use these exact terms.

If a term you need is not listed here, add it before introducing inconsistent wording in code, copy, or documentation.

## How to use this glossary

- **Source of truth.** When the product code, copy, or documentation references one of the concepts below, use the exact term in the column for that locale. Do not introduce synonyms.
- **Applies to.** UX copy (`src/i18n/locales/**`), in-product labels, marketing copy, product docs (`docs/product/**`), GitHub issues, FRDs, work orders, ADRs, and PR descriptions.
- **Locale-paired.** When a string exists in both `es` and `en`, use the matching pair from this table. Do not translate between the two using a thesaurus; use this glossary.
- **Code identifiers.** Code identifiers (variables, types, files, routes) follow the **English** column. Repository code is English-only per `english-code-only.mdc`.
- **Update process.** When introducing a new product concept, add the term here in the same change that introduces it. When a term is renamed, update existing strings, identifiers, and docs in the same change and remove the old term.

## Approved terms

| Concept                                                      | Spanish (es)    | English (en)      | Notes                                                                                                                                       |
| ------------------------------------------------------------ | --------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| A purchase placed at a store, with one or more items.        | **pedido**      | **order**         | Never use `orden` (es) or `purchase` (en) in user-facing copy or new code. Existing identifiers using `purchase` are legacy; do not extend. |
| A shipment of one or more order items reaching the user.     | **entrega**     | **delivery**      | Never use `envío` (es) or `shipment` (en). Replaces the previous `shipments` route, copy, and identifiers.                                  |
| A merchant or person where pedidos are placed.               | **tienda**      | **store**         | Use even when the seller is an individual (`PERSON` store type).                                                                            |
| A line item inside a pedido.                                 | **producto**    | **product**       | Avoid `artículo` / `item` in user-facing copy when referring to an order line; reserve `item` for generic UI lists.                         |
| A pedido with payments tracked over time before fulfillment. | **pre-reserva** | **pre-order**     | Hyphenated form in English. Spanish form uses `pre-reserva` (with hyphen) consistently.                                                     |
| A monetary movement against a pedido.                        | **pago**        | **payment**       |                                                                                                                                             |
| The user's currency for total roll-ups across stores.        | **moneda base** | **base currency** |                                                                                                                                             |
| The currency a pedido is denominated in.                     | **moneda**      | **currency**      |                                                                                                                                             |

## Domain rules tied to terminology

### Producto / product is an atomic shippable unit

Each `producto` (a line inside a `pedido`) represents **one shippable unit**, even when its `cantidad` (quantity) is greater than `1`. The data model treats `producto` as atomic for fulfillment: every `producto` is either fully included in a given `entrega` or not included at all. Fractional fulfillment of a single `producto` across multiple `entrega`s is **not supported**.

Consequences for product surfaces:

- When a user expects different units of the same SKU to arrive in separate `entrega`s, they must enter each unit as a **separate `producto`** with `cantidad = 1` at the time of `pedido` creation. Quantity greater than `1` should be reserved for units that will arrive together.
- The `entrega` create flow must not expose a quantity selector per `producto`; the checkbox represents the entire `producto`.
- The order form must surface this rule contextually (e.g. an inline tooltip near the products section) when at least one `producto` in the form has `cantidad` greater than `1`, so the user has the chance to split before saving.
- If the product later needs partial fulfillment, that is a schema change (adding `quantity` to `DeliveryOrderItem`) tracked in `frd-05` and `frd-08`, not a UI tweak.

## Anti-patterns to avoid

- `orden` / `órdenes` (es) — always use `pedido` / `pedidos`.
- `envío` / `envíos` (es) — always use `entrega` / `entregas`.
- `shipment` / `shipments` (en) — always use `delivery` / `deliveries`. Marketing copy that references the broader concept of physical shipping is the only allowed exception, but keep the in-app feature name as `delivery`.
- Mixing `purchase` and `order` in the same surface. New work should standardize on `order`.

## Cross-references

- UX voice and writing rules: `docs/design/ux-copy.md`.
- Repository implementation rules that depend on this glossary: `.agents/rules/role-copywriting-marketing.mdc`, `.agents/rules/english-code-only.mdc`.
- Locale files: `src/i18n/locales/{es,en}/*.json`.
