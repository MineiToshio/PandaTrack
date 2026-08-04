---
id: WO-02
type: WORK_ORDER
slug: image-upload-and-review-confirm
title: Image Upload and "Revisa y confirma"
status: ACTIVE
parent: BP-01
source_features: []
implementation_status: IMPLEMENTED
last_updated: 2026-07-29
---

# WO-02 Image Upload and "Revisa y confirma"

## Summary

Turn the foundation into the feature: a user attaches one or more photos, watches them being read, reviews the result on a single unskippable screen, and saves a real order.

This is the spine of FRD-11. Everything after it is either an enrichment of this screen or another door into it.

## In Scope

- Intake route under the orders subtree (proposed `orders/new/image`) with its upload surface: attach photos, thumbnails, remove a photo, and the "Extraer datos" action.
- Client pipeline wiring: compress through `compressForIntake`, show an "Optimizando imágenes..." state, upload, and batch the request when the attachments exceed the 4.5 MB request ceiling.
- Processing screen naming the real steps (optimising, uploading, reading), not an indeterminate spinner. Three to eight seconds is the expected duration.
- Server Action `imageIntakeActions.ts`: authenticate, validate, call `extract`, return the draft.
- **Currency gate**: when the user has no base currency configured, ask for it before extraction runs and only process the submission once it is set.
- **"Revisa y confirma" screen**:
  - header summary in both variants ("Encontramos 6 productos por S/ 480.00. Revisa 2 datos y guarda." and "Todo salió limpio del chat. Revísalo y guarda."),
  - read values as plain, non-focusable text; assumed and missing values as focusable controls,
  - an assumed currency visibly marked as assumed,
  - group cards with the four-part structure (what we did, what the chat said quoted verbatim, why, and the reverting action), in their good / amber / doubtful states,
  - group collapse rules: 2 to 5 expanded, 6 or more collapsed with a summary row, a row-level doubt forcing expansion, warnings aggregating to the group chip,
  - the payment and total rows,
  - "Completar a mano", which opens the manual order form prefilled with what was read,
  - the primary CTA reusing the existing `orders.create.submit` string ("Crear pedido").
  - **Addition, delivered after the slice**: each product row shows its suggested catalog category with the catalog icon, marked `sugerida` while it is still the model's answer, editable through the same `MobilePicker` the manual product sheet uses, and a collapsed group shows that control once for the whole group (`FR-11-93`, `FR-11-94`). A product identified by a link shows the link as an openable anchor labelled with its host (`FR-11-96`). The page reads the live active catalog and passes the keys down to the group cards; the reviewed category rides to the order write on `orderCreateSchema.items[].productTypeKey`, while the link is not persisted at all. Two analytics events were added: `image_intake_category_set` and `image_intake_reference_link_opened`.
- Save: map the confirmed draft and call `createOrder` and `addOrderPayment`, writing the idempotency marker into the order note. `createDelivery` is deliberately not called (`OQ-11-08`, `FR-11-52a`): the draft's delivery block is an expected arrival window, which rides on the order's own expected-delivery fields, plus a shipping cost, which the review screen shows and states is stored when the delivery is registered. Optimistic confirmation per `optimistic-client-updates.mdc`.
- Error surfaces for the intake taxonomy: too many images, file too large, unsupported format, unreadable file, provider failure or timeout, and the 200-product ceiling stop.
- i18n: a new image-intake namespace in `src/i18n/locales/{es,en}/`, nothing hardcoded.
- Analytics: `image_intake_submitted`, `image_intake_succeeded`, `image_intake_result_confirmed`.

## Out of Scope

- The creation selector, the floating button, and the shell changes (WO-05). During this slice the route is reached directly.
- The split and merge modal (WO-03). Group cards render their state and their explanation; the reverting buttons are wired in WO-03.
- Store matching, the disambiguator, and inline store creation (WO-04). During this slice the store block shows the matched name as read, with the existing `StoreCombobox` as the fallback control.
- The share target (WO-06).
- The photo counter, the overflow interruption, the exhausted state, and the admin override (WO-07). Quota is enforced only by the foundation's global cut-off during this slice.

## Requirements

- `FR-11-12`, `FR-11-19`: attaching photos and batching.
- `FR-11-27`: idempotency marker.
- `FR-11-30`: the base-currency gate.
- `FR-11-50` through `FR-11-58`: the review screen.
- `FR-11-41`: the 200-product ceiling stop as a user-visible outcome.
- `FR-11-10`, `FR-11-11`: same final CTA, indistinguishable saved order.
- `FR-11-09` (partial): the "Completar a mano" exit. The wizard hint line into this method belongs to WO-05.
- `FR-11-88`: analytics.
- Business rules `BR-11-01`, `BR-11-02`, `BR-11-10` (no pre-confirmation dialog), `BR-11-16`, `BR-11-17`.
- Acceptance criteria `AC-11-06`, `AC-11-07`, `AC-11-08`, `AC-11-09`, `AC-11-15`, `AC-11-16`, `AC-11-20`, `AC-11-21`, `AC-11-30`, `AC-11-31`, `AC-11-32`, `AC-11-33`.
- Cross-FRD: the save path is owned by **FRD-05** ([`frd-05-order-payment-shipment.md`](../../../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md)); deliveries are owned by **FRD-08** ([`frd-08-delivery-management.md`](../../../frd-08-delivery-management/frd-08-delivery-management.md)), and the revalidation `OQ-11-08` asked for was done: intake writes no delivery.

## Blueprints

- [BP-01](../bp-01-order-image-intake.md): Runtime Components (Client, Server), Architecture Decisions 2, 4, 7, Contracts (extracted draft, save boundary).

## E2E Acceptance Tests

- A signed-in user attaches a chat screenshot, sees the processing steps, lands on "Revisa y confirma", and saves an order that appears in the orders list with the expected store, products, total, and payment.
- No code path saves an order without passing through the review screen: submitting the extraction alone creates nothing.
- A user with no base currency configured is asked for it before extraction runs; setting it lets the same submission proceed.
- A draft with an assumed currency renders the assumed marker, and the value is editable; a draft with a read currency renders it as plain text.
- A draft with a group of 50 products arrives collapsed with the summary row; a group of 3 arrives expanded; a group with a row-level doubt arrives expanded regardless of size.
- A draft implying more than 200 products shows the ceiling message and saves nothing.
- "Completar a mano" opens the manual form prefilled with the read values and never empty.
- A provider timeout shows the error surface and creates nothing.
- The saved order's detail screen is identical to a manually created order's, with no AI marker anywhere.

## Notes

The review screen is the highest-risk surface in the FRD: if it reads as a form, users will scroll and accept, which defeats mandatory review. The FDD ([`fdd-11-order-image-intake.md`](../../fdd-11-order-image-intake.md)) and the prototype ([`prototype/order-image-intake.html`](../../prototype/order-image-intake.html), anchors `#intake-review` and `#intake-group-collapsed`) are the design contract for it.

## Implementation Notes

- **Three Server Action files, not one.** `src/app/[locale]/(app)/orders/_actions/` holds `imageIntakeExtractAction.ts`, `imageIntakeSaveAction.ts`, and `imageIntakeStoreActions.ts` (WO-04) instead of a single `imageIntakeActions.ts`. Each action needs a different combination of guards, an auth check plus the spend guard and quota reservation for extraction, auth plus draft re-validation only for saving, auth plus the duplicate-store check for inline creation, so one file per action keeps each Server Action's permission surface legible on its own rather than folding three different guard combinations into one module. Their shared wire types (request fields, error codes) live in the separate `imageIntakeContract.ts`, because a `"use server"` file may only export async functions.
- **Idempotency marker.** `saveOrderFromDraftAction` (`imageIntakeSaveAction.ts`) builds a `[image-intake:<sha256-prefix>]` marker, writes it into the order's `note`, and checks for an existing order with that marker before creating a new one, following the precedent already used by `chat-load.ts`. The digest is taken over the signing collector plus the review screen's own save token (`newImageIntakeSaveToken`, `imageIntakeContract.ts`), which `ImageIntakeScreen` mints on the first save attempt and holds for as long as that draft is on screen (`FR-11-27a`). Freezing it there is what makes a retry a retry: the marker used to be derived from the draft's own contents, so once the review screen could correct a name or a price, a save that reported failure after the write went through and was then retried with one value adjusted produced a second order for the same purchase. The content-derived signature (store, order date, currency, total, product/price signature) remains as the fallback for a call that sends no token, and a token that fails `IMAGE_INTAKE_SAVE_TOKEN_PATTERN` falls back to it rather than being trusted.
- **Payments are written best-effort, not all-or-nothing.** `recordDraftPayments` writes each of the draft's payments independently after the order itself is created; a payment the order domain refuses (a date before the order, an amount over the balance) is counted and skipped rather than aborting the save, because the order is already correct and exists, and losing it over a secondary row the user can add in two taps would be the worse outcome. The result carries `paymentsRecorded` / `paymentsSkipped` so the caller can surface a partial-success state if it chooses to.
- **The draft is re-validated server-side on save**, not trusted from the client round trip: `saveOrderFromDraftAction` re-parses the incoming payload with `parseImageIntakeDraft` and then runs the mapped input back through `orderCreateSchema` / `orderPaymentCreateSchema`, the same schemas the manual form uses, before writing anything.
- **No delivery is created.** Confirming `OQ-11-08`: the save path calls `createOrder` and `addOrderPayment` only. The draft's expected arrival window is mapped onto the order's own `expectedDeliveryFrom` / `expectedDeliveryTo`; an extracted shipping cost has no field on an order and is shown on the review screen as read but not persisted, per `FR-11-52a`.
