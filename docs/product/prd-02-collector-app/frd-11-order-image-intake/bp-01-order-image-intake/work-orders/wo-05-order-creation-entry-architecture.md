---
id: WO-05
type: WORK_ORDER
slug: order-creation-entry-architecture
title: Order Creation Entry Architecture
status: ACTIVE
parent: BP-01
source_features: []
implementation_status: IMPLEMENTED
last_updated: 2026-07-29
---

# WO-05 Order Creation Entry Architecture

## Summary

Give order creation one door with two ways through it: a single "Nuevo pedido" selector, reachable from a floating action button on mobile and a primary bar button on desktop, with the navigation menus staying flat.

This slice also closes a real gap that exists today: a user with orders already registered, standing on the Dashboard, has no button to create another one. They have to open the menu, enter Orders, and find the button there.

## In Scope

- **Selector component**, one implementation with two presentations: inline cards when the surface is empty, `Modal` on desktop and `Sheet` on mobile when the surface already has content (canonical modal pattern, ADR 0008).
- Selector content: title "Nuevo pedido", subtitle "Elige cómo quieres registrarlo."; card 1 "Desde una imagen" with the "Más rápido" badge, the description, "No necesitas crear la tienda antes." and the remaining-photo line; card 2 "A mano" with "El formulario de siempre, en tres pasos. Sin límite de uso."
- **Floating action button**: single action, labelled "Nuevo pedido", bottom-right, on the Dashboard and the Orders list below `1024px` only. It never expands into a fan of options.
- Breakpoint and route gating: absent at `1024px` and above, absent on Stores, Deliveries, order detail, delivery detail, and inside creation wizards.
- When the floating button is visible, the mobile bar "Nuevo" button does not render, and the now-unused string is removed in the same change. Note: the memo names `hero.newOrderShort`; the key that actually exists is `newOrderShort` in `orderListing.json` (see `OQ-11-07`), and the removal must target the real key.
- **Toast clearance**: on surfaces with a visible floating button, toasts raise their bottom inset by the button height plus its margin, and lists reserve matching bottom padding so no card ends up underneath.
- Sidebar and mobile drawer stay flat: no create actions, no submenus, no "+" affordance next to a row.
- Desktop entries: a primary "Nuevo pedido" button in the Orders list toolbar and in the Dashboard header, both opening the same selector.
- **Bridge into the image method** from step 1 of the manual order form: "¿Tienes una captura? Créalo desde una imagen".
- i18n keys under a new `orders.createEntry` group in `src/i18n/locales/{es,en}/`, exactly as approved (`fabLabel`, `title`, `subtitle`, `fromImage.title`, `fromImage.titleLong`, `fromImage.description`, `fromImage.badge`, `fromImage.noStoreNeeded`, `manual.title`, `manual.description`, `wizardHint`, `backToManual`).
- Analytics for selector opened and method chosen, so the deliberate extra tap on the cold path can be measured (`FR-11-89`).

## Out of Scope

- The intake flow itself (WO-02) and the share target (WO-06).
- The remaining-photo line's real value, the disabled-when-exhausted state of the image card, and the exhausted copy (WO-07). During this slice the line renders from the counter contract with a placeholder source.
- Any change to the manual order form beyond adding the hint line.
- Redesigning the Dashboard or the Orders list beyond the entry affordance and the bottom padding.

## Requirements

- `FR-11-01` through `FR-11-11`.
- `FR-11-89`.
- Business rules `BR-11-07`, `BR-11-08`, `BR-11-09`.
- Acceptance criteria `AC-11-01`, `AC-11-02`, `AC-11-03`, `AC-11-04`, `AC-11-05`.
- Open questions that touch this slice: `OQ-11-06` (does the manual form really have three steps, which the approved card copy asserts), `OQ-11-07` (which i18n key is actually retired).
- Cross-FRD: the sidebar, the mobile drawer, and the header are owned by **FRD-03** ([`frd-03-collector-app-shell.md`](../../../frd-03-collector-app-shell/frd-03-collector-app-shell.md)); the Orders list and the manual create form are owned by **FRD-05** ([`frd-05-order-payment-shipment.md`](../../../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md)); the Dashboard is owned by **FRD-06** ([`frd-06-dashboard.md`](../../../frd-06-dashboard/frd-06-dashboard.md)).

## Blueprints

- [BP-01](../bp-01-order-image-intake.md): Architecture Decision 10, Runtime Components (Client).

## E2E Acceptance Tests

- On mobile, the Dashboard and the Orders list show the floating button; tapping it opens the selector with exactly two cards, and picking "Desde una imagen" reaches the intake surface.
- On mobile, the bar "Nuevo" button is absent wherever the floating button renders.
- At desktop width the floating button is absent, and the toolbar and Dashboard header buttons open the same selector.
- The floating button is absent on Stores, Deliveries, order detail, delivery detail, and inside creation wizards.
- With the floating button visible, a toast and its undo control are fully visible and tappable, and the last list card is not covered.
- Neither the sidebar nor the mobile drawer exposes any create action.
- On an account with no orders, the two cards render inline in the empty state and an order can be started from an image without creating a store first.
- Step 1 of the manual form shows the hint line, and following it reaches the image method.

## Implementation Notes

- **`CreateOrderFab`** (`src/components/modules/CreateOrderFab/`) is mounted once at the shell root and self-gates by route through `fabRouteGate.ts`'s `isFabEligibleRoute`, an exact match against the Dashboard and Orders-list paths only, so `/orders/[id]` and every `/orders/new*` wizard route stay excluded on purpose, and by breakpoint through Tailwind's `lg:hidden` on the button itself, i.e. the existing `1024px` `lg` breakpoint rather than a new one.
- **One selector component, two presentations.** `OrderCreateMethodSelector` renders inline cards or an overlay (`Modal` desktop / `Sheet` mobile) depending on a `presentation` prop; `CreateOrderFab`, the Orders-list toolbar button, and the Dashboard header button all mount the same component with `presentation="overlay"`, and the empty state renders it with `presentation="inline"`.
- **Analytics events shipped**: `order_create_method_selector_opened` (`POSTHOG_EVENTS.ORDER.CREATE_METHOD_SELECTOR_OPENED`) fires from each opening affordance with a `source` prop (`"fab"`, `"toolbar"`, `"dashboard"`, etc.) identifying which one; `order_create_method_selected` (`POSTHOG_EVENTS.ORDER.CREATE_METHOD_SELECTED`) fires declaratively via `data-ph-event` on each card with the chosen `method`. Both live under the `order` vocabulary, not a new `image_intake` one, since the selector is shared infrastructure the image method is only one card of.
- **`OQ-11-06` and `OQ-11-07`** were resolved during this slice; see the FRD's Open Questions for the confirmed manual-wizard step count and the retired `newOrderShort` key.
