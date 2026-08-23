---
id: FDD-05
type: FDD
slug: order-payment-shipment
title: Orders, Payments & Shipment — Feature Design Document
status: ACTIVE
parent: FRD-05
last_updated: 2026-08-08
prototype: ./prototype/order-payment-shipment.html
design_system: ../../../design/README.md
demo_anchors:
  - "#orders"
  - "#order-detail"
  - "#order-create"
  - "#s7-orders-list-default"
  - "#s7-orders-list-filters-open"
  - "#s7-orders-list-empty-initial"
  - "#s7-orders-list-empty-filtered"
  - "#s7-order-detail-active"
  - "#s7-order-detail-cancelled"
  - "#s7-order-detail-completed-unpaid"
  - "#s7-order-detail-delete-modal"
  - "#s7-order-detail-cancel-modal"
  - "#s7-order-detail-pay-modal"
  - "#s7-order-create-step-1"
  - "#s7-order-create-step-2"
  - "#s7-order-create-step-3"
  - "#s7-order-create-step-4"
  - "#s7-order-create-step-5"
  - "#s7-order-create-empty-stores"
  - "#s7-order-create-discrepancy-modal"
  - "#s7-order-edit"
  - "#s7-order-edit-discard-modal"
  - "#s7-order-detail-overdue"
  - "#s7-order-detail-partially-paid"
  - "#s7-order-create-step-3-validation"
  - "#s7-order-create-step-1-from-store"
  - "#s7-orders-list-mobile"
  - "#s7-order-detail-mobile"
  - "#s7-order-create-mobile"
  - "#s7-order-edit-mobile"
  - "#s7-order-edit-discard-mobile"
  - "#s7-order-create-add-product-mobile"
  - "#s7-orders-list-loading"
  - "#s7-orders-list-loading-mobile"
  - "#s7-orders-list-empty-initial-mobile"
  - "#s7-orders-list-empty-filtered-mobile"
  - "#s7-orders-list-filters-mobile"
  - "#s7-order-detail-overdue-mobile"
  - "#s7-order-detail-cancelled-mobile"
  - "#s7-order-detail-completed-unpaid-mobile"
  - "#s7-order-detail-pay-mobile"
  - "#s7-order-detail-delete-mobile"
  - "#s7-order-detail-cancel-mobile"
  - "#s7-order-create-step-2-mobile"
  - "#s7-order-create-step-3-mobile"
  - "#s7-order-create-discrepancy-mobile"
  - "#s7-order-create-empty-stores-mobile"
  - "#s7-fx-reconciliation-mobile"
  - "#s7-product-type-picker-mobile"
  - "#s7-store-picker-mobile"
  - "#s7-currency-picker-mobile"
  - "#s7-date-range-picker-mobile"
  - "#s7-date-range-picker"
  - "#s7-orders-list-fx-banner"
  - "#s7-fx-reconciliation-modal"
---

# FDD-05 · Orders, Payments & Shipment — Feature Design Document

> **What this document is.** The FDD is "the prototype in words": the durable, text
> form of the visual and interaction design for FRD-05, so the feature's design is
> reconstructible without depending on the redesign subproject. It
> pairs with the self-contained prototype at [`./prototype/order-payment-shipment.html`](./prototype/order-payment-shipment.html)
> (the pixel truth) and is governed by the design system in
> [`docs/design/`](../../../design/README.md) (the system rules).
>
> **Three-source rule.** This document **references** the design system for system-wide
> rules (tokens, components, motion, states, copy voice), **describes** what is specific
> to Orders, Payments & Shipment, and **cites the prototype** for the exact pixel. When
> this FDD and the design system disagree on a system-wide rule, `docs/design/` wins. When
> this FDD and the prototype disagree on an Orders-specific visual, the prototype wins
> until this FDD is corrected in the same change.
>
> **Language.** Prose is English (repository docs convention); user-facing copy is quoted
> verbatim in Spanish (`es` is the default locale). The `en` equivalents live in
> `src/i18n/locales/en/orders.json` (with list copy under the `orderListing` namespace).
>
> **Amendment — Store-level payments (v5, 2026-08-08).** Money moved from a per-order payment
> ledger to the store (`StorePayment`, with an optional, declared `PaymentAllocation` per
> order/item — `docs/design/decisions/0025-store-level-payments-declared-allocations.md`). This
> consolidates the three implementation phases (3a orders-list view, 3b order-detail/store-aside,
> 4 payment sheet + create-flow advance) into one section; none of it is yet reflected in the
> prototype HTML below (see the follow-up note at the end).
>
> - **Orders list — "Por tienda" view.** A second view, `?view=store`, remembered per collector via
>   a cookie, groups every store's pending products with a per-currency debt summary and a
>   "Registrar pago" entry point per group, in place of the per-order payment percentage the
>   `#s7-orders-list-*` anchors below still show. The classic "Por pedido" list itself dropped the
>   payment-progress column/bar, the paid/partial/unpaid filter pills, and the `payment-asc` sort.
>   New components: `StoreGroupedView`, `StoreGroupHeader`, `StorePendingProductRow`,
>   `StorePendingProductCard` under `src/app/[locale]/(app)/orders/_components/`.
>   **The view switcher** (`OrderListGroupBy`) went through two rejected iterations — full-width
>   `ToggleChoiceGroup` chips, then a compact segmented control with a per-option icon, label, and
>   `Tooltip` (`ThemeToggle` grammar) — before settling (2026-08-09) on its current shape: the
>   choice is low-frequency and always binary, so it shows as the ACTIVE VALUE rather than as two
>   options side by side (see `docs/design/interface-patterns.md` §3, "A low-frequency, always-binary
>   switch…"). Desktop (`variant="select"`) reuses the shared `Select` in controlled/grouped mode,
>   text only, no icon, no tooltip, taking its place in the toolbar's canonical control order,
>   Search < Filter < Sort < **Group by** < New order (Group by sits right after Sort so the pair
>   anchors together to the row's right edge, in every view, at every desktop width). Mobile
>   (`variant="compact"`) is a short pill + `MobilePicker` sheet, last in the sticky mobile row so
>   its x position doesn't shift between views. Behavior (`?view=`, cookie, sort reset,
>   `orders_list_view_changed`, now carrying a `surface` prop alongside `view`) is unchanged from the
>   original toggle.
> - **Order detail hero.** The protagonist figure is now the order's TOTAL, a stable number that
>   never moves as payments come and go (superseding "the outstanding balance ('Saldo pendiente')
>   against the total" in §1 below). Below it: while this order has an allocation, "Asignado {X} de
>   {Y}" plus a progress bar (allocated/total); while it has none, a "Deuda de la tienda: {Z}" link
>   into the store detail (green "A favor {|Z|}" when the store owes the collector instead). A "Pago
>   completado" chip joins the status chips once allocated is greater than or equal to the total.
>   Dropped: the old "Saldo pendiente"/"de {total}" amount swap and the payment-percent meta segment.
> - **Payments card.** The totals block reads "Asignado" / **"Falta"** (was "Total pagado" /
>   "Saldo pendiente", then briefly "Por asignar" — **revised 2026-08-14 (F1):** the order detail and
>   the store payment sheet stopped using two words for the same figure, and "Por asignar" was
>   accounting language that existed nowhere else in the product; pinned by the `residual vocabulary`
>   test against both catalogs). A payment shared with other orders shows a "Parte de un pago de {total} a
>   {tienda}" subtitle on its row, and its delete-confirm copy makes clear only this order's slice is
>   removed, not the whole payment. A new empty state ("Sin pagos asignados a este pedido" + "Ver
>   deuda de la tienda") replaces the blank rows list when nothing is allocated yet.
> - **Sticky bar.** The primary CTA reads "Saldar {X}" once something is already allocated
>   (continuing a payment), "Anotar pago" while nothing is (a first one), regardless of order status.
> - **Cancel modal** (`#s7-order-detail-cancel-modal`). The payments-choice radios are "Queda a
>   favor de {tienda}" (`credit`, default) / "Lo doy por perdido" (`lost`), replacing the earlier
>   "Conservarlos" / "Quitarlos"; the question copy is "Pagaste {X} de este pedido. ¿Qué hacemos con
>   ese dinero?".
> - **Store detail aside** (FRD-04, not pictured in this FDD). A "Deuda pendiente" row per currency
>   (green "A favor" when negative), and a "Registrar pago" action opening the store payment sheet
>   below (shipped active, not the placeholder-disabled state an earlier draft of this note
>   described).
> - **Store payment sheet** (`StorePaymentSheet`, `src/components/modules/StorePaymentSheet/`).
>   Reachable from the "Por tienda" view and the store detail aside above, and rebuilt on
>   2026-08-10 into **two panels inside one `<Modal size="lg">`**. Panel **Pago** (the default): a
>   one-line debt readout for the selected currency, the currency select when the store has more
>   than one, amount + date side by side, the note, and a 52px summary row ("¿A qué va este pago?"
>   · "Sin asignar todavía" / "N líneas · {total}") whose button enters the second panel. Panel
>   **Asignación** takes the whole body: a recap strip of the amount and date, a totals bar that
>   turns destructive and names a culprit when the declared total overruns the payment, a filter
>   (only past 12 lines), a desktop column header carrying the sort caption,
>   and then the list. The list is **flat** and full-bleed (`-mx-6`), one row per payable line on a
>   `1fr | 120px | 140px` grid at ≥768px (52px rows) and a `1fr | 96px` two-line grid below it
>   (64px rows). Line 1 is the product name (truncated with a `title`, clamped to two lines on
>   mobile); line 2 is the order's `humanReadableId`, repeated on every row so each row is
>   self-describing and a filter match on a reference is visible. When an order's products cannot
>   absorb its balance, a **"Resto del pedido"** row closes its block. The shortcut cell is a **fill
>   control**, not a label: labelled **"Máx."**, it writes the largest amount assignable without
>   invalidating the draft and prints no figure of its own, the amount it will write living only in
>   its accessible name (`computeFillableMinor`, recomputed live). A settled line shows a "Saldado"
>   chip instead, and an unpriced line shows the mark-paid toggle ("Marcar pagado" / "marcado")
>   rather than a fill control, since there is no number to offer (`ADR 0026`). The order's own
>   balance is instead printed once per order block, on the first row's reference line
>   (`orderBalanceMinor`, `FR-05-42a`) — a per-order fact, stated once, rather than a per-line one.
>   **Corrected 2026-08-14, `ADR 0027`:** the cell used to print that same ceiling as a visible
>   "Falta {amount}" figure, the line's own static base rather than the live ceiling the button
>   actually wrote, so a line whose order already held money elsewhere in the draft advertised room
>   the order no longer had; the system rule ("a figure printed in a list partitions its quantity,
>   never replicates it") is in `docs/design/interface-patterns.md`. A "Resto del pedido" row's fill
>   amount is `min(su propio techo, lo que le queda al pedido una vez restadas sus otras líneas)`, so
>   it never advertises room the order does not have. A settled line's amount field is locked **only
>   while it is empty**: a row can turn settled with money already typed into it (the server settles
>   it under a live draft), and the field keeps accepting the edit that EMPTIES it, locking again
>   once it is. Never `disabled` for that lock, always `readOnly` plus `tabIndex={-1}`: the lock
>   snaps shut on the keystroke that empties the field, with the caret still inside, and a field that
>   turns `disabled` under the caret drops the focus onto `<body>`, from where the next `Tab` leaves
>   the modal. There is no "Saldado" toggle any more, and no zero-amount allocation is ever written.
>   Loading, empty, error (with
>   "Reintentar") and no-results states all reserve the same 312px so the panel never jumps. The
>   list is the ONLY child of that column allowed to give up height: the recap strip and the totals
>   bar both wrap at 375px, and both carry `shrink-0` so their `min-h` stays a resting floor instead
>   of becoming a ceiling that makes them paint over the text below (see `L082` in
>   `docs/design/PLAYBOOK.md`). Submit
>   closes optimistically only when nothing is declared (`FR-05-42b`).
>
>   Five behaviors of this sheet are load-bearing and easy to lose in a refactor:
>   1. **Focus.** Opening the sheet leaves the focus on the amount field (the modal's
>      `initialFocusRef`); the panel's own focus handling only fires on a panel CHANGE, never on the
>      initial open, because a child's effect would otherwise overwrite the modal's. Entering
>      **Asignación** focuses the filter when it exists and the first line's amount field otherwise
>      (never the recap's "Editar monto o fecha", which is first in document order and leads back
>      out). Leaving it returns focus to the summary row's button.
>   2. **"Revisar" / "Ver".** Both clear the filter and then scroll and focus the offending line.
>      The line they name is always one that is actually RENDERED: an order-level rule implicates
>      that order's "Resto del pedido" key too, and that row only exists when
>      `restCeilingMinor > 0`, so the culprit is chosen among rendered lines (preferring the line
>      the collector last touched when it is itself blocked).
>   3. **Refusals.** One that names a line marks that line and reveals it. The reveal WAITS for a
>      list with rows in it: a refusal retires the sheet's cached orders, so a refetch is normally
>      in flight right behind it, and a reveal spent against a skeleton would be lost for good,
>      leaving a line marked wrong with nothing pointing at it. One that names none
>      (`STORE_DEBT_EXCEEDED`, `ALLOCATION_SUM_EXCEEDS_PAYMENT`, `unauthorized`…) renders a
>      sheet-level `role="alert"` above the active panel, because the coordinator's toast renders
>      behind the modal, and shuts the CTA until the amount, date or currency changes: those are the
>      inputs such a verdict is about, so retyping a LINE cannot lift it and an unchanged resend can
>      only earn the same refusal (and "Limpiar", which is a change to the lines, does not re-arm it
>      either). A submission that got NO ANSWER is the opposite case and is treated as one: no
>      verdict was given, so the message appears but the CTA stays live for an identical resend, and
>      the modal is never left undismissible (the submit path always releases its loading state).
>      The sheet tells the two apart by an `unanswered` flag the coordinators set, never by a
>      rejected promise: both of them absorb a rejection into a resolved `{ ok: false }` on purpose,
>      so reading the rejection would put every real network drop in the blocking branch.
>      A promise that DOES reject is a third case and blocks: the only live way there is a
>      coordinator's own success handler throwing, so the server already answered and a resend
>      would either duplicate a committed payment or earn the identical refusal. Keeping the CTA
>      live for a genuinely unanswered submission is an accepted trade, not a closed case:
>      `createStorePayment` has no idempotency key, so a payment with no declarations and small
>      against the store's debt can be recorded twice (known seam, `FR-05-42b`).
>   4. **The draft outlives the list.** A refetch with the sheet open keeps the previous payload on
>      screen (and falls back to it if the new one never lands), because the typed line amounts only
>      exist as long as the rows they were typed into do. Money typed into a row that has since
>      stopped rendering stops counting: it leaves the totals, the CTA's arithmetic and the payload
>      rather than being submitted invisibly, **and the sheet says so** — a `role="alert"` naming
>      the amount that fell away, the CTA shut until it is dealt with, and a dismissal that drops
>      only those keys (unlike "Limpiar", which takes the whole draft). This is derived from the
>      DRAFT, not from the load status: the reachable way here is a refetch that SUCCEEDS and comes
>      back shorter, with the list `ready` throughout. A submission whose declarations were all
>      dropped never takes the optimistic-close path. A payload kept after a FAILED refresh is
>      marked stale and gets its own `role="status"` notice with a retry that refetches over the
>      rows, because the only other refresh available is closing the sheet, which costs the draft.
>   5. **Announcements.** The totals bar is not itself a live region (its figures change on every
>      keystroke and it carries buttons); the announcement is a debounced, text-only `role="status"`
>      sibling. A line marked invalid by an order-level rule points its `aria-describedby` at the
>      one message that rule writes, on the block's last line.
>
> - **Order create — "¿Pagaste algo hoy?".** An optional toggle in the confirm step (Paso 3) with
>   "Pagué todo" / "Adelanto" quick options, an amount field, and a payment-date field (default
>   today); submitting creates the order and its pre-assigned payment together (`FR-05-45`).
>
> **Amendment — Batch arrival from the "Por tienda" view (2026-08-13, `FR-05-48` / `FR-08-38`).**
> The view gained its second mutation: the collector marks arrivals inside one store group, across
> that group's orders, and confirms once. New components under
> `src/app/[locale]/(app)/orders/_components/`: `PendingProductSelectToggle`,
> `StoreGroupSelectionBar`, `useStoreProductSelection`.
>
> - **The tile is the control.** `StorePendingProductRow`'s 32px `Package` square carried no
>   information (same glyph for every product, already `aria-hidden`), which is exactly what freed
>   it to become the selection control without losing anything or moving the geometry. It is a real
>   `<input type="checkbox">` kept `sr-only` inside a `<label>` that paints the box, so `Space`,
>   the announced role and the checked state are native and the painting is ours. Its accessible
>   name is "Seleccionar {producto}": the product name cannot be the visible label, because it
>   shares a two-line block with a link into the order and a `<label>` around an `<a>` is invalid
>   markup that swallows the link's click. **The example changed on 2026-08-16 and the rule did
>   not:** the name is no longer plain text beside the tile, it IS that link now (the order date it
>   used to sit above is gone). Nothing about the checkbox moved — the `<label>` never contained the
>   name, only the `sr-only` input and its three `aria-hidden` painting spans — so the name became an
>   `<a>` without touching the control, and the reason it stays outside the label is if anything
>   stronger than before.
> - **Four states, opacity only.** Three glyphs share one grid cell and only their opacity crosses,
>   never the box (`--motion-instant` + `--ease-emphasis`, the "Toggle" recipe of
>   `docs/design/motion.md`; no transition under `prefers-reduced-motion`). Rest is today's package
>   tile unchanged. Hover / `focus-visible`, **and every tile in a group that already has something
>   marked**, show an empty 1.5px `--border-strong` square. Selected fills with `--accent` plus a
>   `--text-on-accent` check, and the whole row takes `.state-selected`. A product already
>   `IN_TRANSIT` renders no control at all, only the muted package with the reason in `title`: a
>   checkbox that can never be enabled from here is noise in the tab order, and the row's own state
>   chip already says "En camino" in text.
> - **How selection is entered.** Desktop: the column-header strip carries a permanently visible
>   tri-state master `Checkbox`, indented by a 32px box plus the row's own `gap-2.5` so "Producto"
>   keeps sitting over the product names; hover on the tiles is the accelerator, never the only
>   door. Mobile: there is no hover and `StorePendingProductCard` never had an icon, so the group
>   gets an explicit "Seleccionar" strip; pressing it grows a 36px tile on each card and the
>   two-line block shifts right. Long-press was rejected (no affordance, competes with text
>   selection). `Shift` + click extends the range from the last tile toggled **within the same
>   group**, skipping what is not eligible, and it only ever adds. The modifier is read off the
>   label's `mousedown` (a click on a `<label>` reaches the input as a synthetic click that does not
>   carry it), which means it also has to be _forgotten_: leaving the label cancels an aborted press,
>   and a `keydown` on the input restates it, so `Shift` + `Space` extends the same way and a
>   previous pointer press can never turn a plain `Space` into a range.
> - **One live selection, one store.** State is `{ storeId, itemIds: Set } | null`; starting one in
>   another group replaces it. An EMPTY set is meaningful (touch select mode, nothing marked yet).
>   Collapsing the group clears it. `Escape` clears it too, bound to the group's own subtree and
>   **not** to the document: `Modal` already listens at document level, so a single press meant to
>   dismiss the arrival dialog would otherwise wipe the selection behind it. Dismissing the dialog
>   keeps the selection.
> - **The action bar** (`StoreGroupSelectionBar`) is `sticky` at the foot of the group's own card,
>   in flow, never `fixed` to the viewport, so it can never be ambiguous about which store it
>   belongs to; on touch it is lifted clear of the "Nuevo pedido" FAB with the same
>   `--fab-offset` + `--fab-h` contract `ToastContainer` uses. It carries the count
>   ("3 productos de 2 pedidos") and **never an amount** (a large share of pending products have no
>   derivable price, so any total would be blank or wrong), plus exactly two actions: "Cancelar"
>   (ghost) and "Ya me llegó" (primary, right). The count is never truncated: the two buttons alone
>   are 210px against the 228px a 320px viewport leaves inside the card, so below ~507px the button
>   pair wraps to its own line (`flex-wrap` + a `13rem` flex basis on the count, sized off the
>   widest string the message can produce) and the count takes the bar's full width, costing ~24px
>   of bar height on phones and nothing above. The delivery wizard is deliberately not offered:
>   its first two steps are what the selection just did, and `FR-08-36` already demoted it. The
>   group `<section>` lost its `overflow-hidden` for this (a clipping ancestor turns the card into a
>   scrollport and kills `sticky`); nothing painted to the corners, so the rounding never depended
>   on it. A separate `sr-only role="status"` node carries the live count, never the toolbar
>   container, whose `aria-atomic` would re-read the button labels on every change.
> - **Confirmation** is the existing `QuickArrivalModal` with `alwaysListItems`, so a hand-picked
>   selection of exactly ONE product still gets the count and the list rather than the per-order
>   launchers' single-product sentence. No type-to-confirm word: the act is recoverable by deleting
>   the delivery, and what is lost is one bit (`BR-08-11`). Its subtitle is the store name and
>   nothing else: unchecking a row inside the dialog moves the dialog's own state and never this
>   view's selection (that isolation is what keeps an id from leaking back into the batch), so a
>   count composed by the coordinator would freeze at what the dialog opened with while the list's
>   "{n} de {total} seleccionados" and the primary's label keep counting. And the dialog is mounted
>   only while the selection it describes exists, so the flag that opens it follows that selection
>   down (`FR-05-48d`): a resync that prunes the last marked product closes it for good instead of
>   leaving it armed to re-appear, filled in, on the next tile the collector marks.
> - **Optimistic, and the coordinator owns the rollback.** `StoreGroupedView` removes the marked
>   products, recomputes `openOrdersCount` from the survivors, drops an emptied group, and
>   **re-sorts** with `sortStoreGroups` (removing products changes a store's own sort key, which is
>   an aggregate over them, so the page would otherwise jump when the server payload lands; the
>   active `?sort=` is now a prop). `debts` is never touched: an arrival is not a payment. A
>   refusal restores the snapshot AND the selection, minus any product the server named ineligible
>   (those rows are flagged "Ya no disponible" until the next payload) — except for a bare
>   `PRODUCT_NOT_ELIGIBLE`, the mutation's compare-and-swap race, which names nothing: there the
>   selection is dropped and the copy asks for a reload, because a set handed back unchanged fails
>   identically on every retry. A cancelled order is re-worded on the way out: `createDelivery` read
>   one order and says so ("Este pedido está cancelado."), which names nothing in a batch that can
>   span several, so this coordinator maps `ORDER_CANCELLED` to the selection-scoped copy that also
>   says what to do. Restoring a snapshot does not re-fire `delivery_store_selection_started`
>   either: it is the same selection coming back, not one the collector began.
> - **Two staleness holes closed with it.** The server-resync signature now includes
>   `deliveryState` (the query calls anything not-yet-delivered "pending", so a product moving to
>   `IN_TRANSIT` produced an identical signature and left a live tile on an unselectable product),
>   and every resync intersects the live selection with what is still listed AND still eligible.
>   Without the second, a marked product that vanished left an id with no checkbox to clear it,
>   and the batch failed forever.
> - **Column rename.** "Llegada" became **"Estado" / "Status"**, not "En tienda". The old header
>   claimed the collector's own arrival, which is now what the tile and the bar do, so it had to
>   go; but "En tienda" would have been just as false for the two of its four values that are about
>   the shipment ("En camino", "Entregado"). A column header names the dimension, and the chips
>   already name their own place.
> - **A store can leave the list in one click.** The group exists only while it has a pending
>   product, so the last arrival takes the store's debt figure and its "Registrar pago" button off
>   this view with it. Pre-existing behaviour of the query, but one click away from here now, so
>   the success toast says it once, where it happens: "Llegada anotada: 1 producto. Sigues debiendo
>   {X} a {tienda}." The store detail keeps the full record.
>
> **Amendment — Declared payment coverage per producto (2026-08-14, `FR-05-49`…`FR-05-51`,
> [ADR 0026](../../../design/decisions/0026-declared-product-payment-coverage.md)).** A producto can
> now be declared paid without an amount. Design-wise this is a **second axis** drawn beside the
> money one, and the whole visual problem is keeping the two legible without letting either read as
> the other. New components: `PaidMarkControl` +
> `useOrderItemPaidDeclaration` in `orders/_components/share/`, `StoreUndetailedPayments` in
> `orders/_components/`, and `OrderItemPaidMark` in `orders/[id]/_components/` (the detail's client
> leaf, which owns the toast).
>
> - **One control, five states, and only two of them are buttons.** `PaidMarkControl` renders one
>   pill-shaped chip whose tone carries the fact and whose label carries who is claiming it —
>   or renders nothing at all. **Revised 2026-08-14 (F2):** the table used to have four rows and no
>   `absent` one, and the `unmarked` row used to describe every product without a mark.
>
>   | State      | When                                                            | Render                                                               | Interaction                    |
>   | ---------- | --------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------ |
>   | `absent`   | no mark, and none can be added (`!rendersPaidMark`), not proven | **nothing**: no chip, no tab stop                                    | none                           |
>   | `proven`   | arithmetic settles it and no mark of its own is being shown     | `success` chip "Saldado", `CircleCheck`, `<span>`                    | none, out of the tab order     |
>   | `declared` | the producto carries a mark                                     | `success` chip "Saldado · marcado", `CircleCheck`, `aria-pressed`    | tap removes the mark           |
>   | `unmarked` | no mark and one **can be added** (`offersPaidMark`: no number)  | ghost chip "Marcar pagado", `Circle` outline, `aria-pressed="false"` | tap sets it                    |
>   | `locked`   | the pedido is cancelled                                         | the corresponding chip as a `<span>` with an explanatory `title`     | none (the pedido is cancelled) |
>
>   `absent` outranks `unmarked`, and `proven` outranks the button: a priced producto of a pedido the
>   arithmetic already settles states "Saldado" as a `<span>` and offers nothing. It used to render
>   an interactive chip whose accessible name read "Marcar {name} como pagado" over that same visible
>   "Saldado" (WCAG 2.5.3, Label in Name), and pressing it wrote a mark nothing needed.
>
>   `<button aria-pressed>` and not `role="switch"` or `<Switch>`: the repo's precedent for a
>   per-item state inside a dense list is the togglable chip (`OrderItemStateChip`,
>   `OrderItemStatePill`), and the design system reserves `<Switch>` for form options. A state
>   nothing can change is a `<span>` and stays out of the tab order. Colours are
>   `--success-chip-text` over `color-mix(--success 10%)` with a 22% border — the pair already
>   validated in `StorePaymentAllocationRow` — and the ghost rest state is `--text-secondary` on
>   `--border`, going `--accent` on hover. The accessible name always names the producto ("Marcar
>   {name} como pagado"), because one store group can hold 29 otherwise identical controls.
>   Optimistic per `.agents/rules/optimistic-client-updates.mdc`: the hook reverts silently and the
>   **consumer** owns the toast, which is mandatory here rather than optional, because a lost mark
>   is the collector's own claim disappearing without a word.
>
> - **Two success chips in one column, on purpose.** "Saldado" and "Saldado · marcado" share a tone
>   because they state the same fact; the suffix says who is asserting it. The screen reader gets
>   the difference from the label either way.
> - **"Marcado" survives on top of "proven" in the detail, and only there.** `showMarkWhenProven` is
>   set by `OrderItemPaidMark` alone. The order detail is the audit surface, so a mark put there by
>   mistake stays visible and removable even while the pedido's own balance already proves the
>   producto settled; the list surfaces state the proven fact and stop, because there the fact is
>   the whole answer.
> - **Desktop (≥1024px), "Por tienda" row.** The control takes the 140px "Pagado" column. **Revised
>   2026-08-14 (F2):** the rule used to read "always in the DOM and always in the tab order", which
>   stopped being true when `absent` started rendering nothing. It now reads: **whenever the control
>   renders at all, it is in the DOM and in the tab order** — only its opacity waits, with the same
>   crossfade `PendingProductSelectToggle` uses (`group-hover` + `focus-within`), never
>   `display:none` and never `visibility:hidden`. What is hidden by opacity is still reachable; what
>   is `absent` is not rendered, because there is no action behind it. A marked producto stays at
>   full opacity: there the chip is an answer, not an affordance. `proven` renders the plain `success` "Saldado" chip and
>   `partial` keeps its 44px `ProgressBar` + percentage, untouched.
> - **Mobile / tablet (<1024px), `StorePendingProductCard`.** No hover exists, so the control is
>   simply present, in the slot on line 2 where the percentage (or nothing) used to sit, beside the
>   window that ends the line (the "pedido el {fecha}" link until 2026-08-16, the expected-arrival
>   window since — see the amendment below; the slot and its geometry are unchanged). The 44px tap target is bought with a transparent `::after` overlay
>   rather than with padding, so the chip keeps the density the row was designed around; the one
>   place that trick is not available is the payment sheet's own cell, where the amount input sits
>   less than 2N away and the **box itself** is resized instead (`min-h-11 md:min-h-0`, PLAYBOOK §4).
> - **Payment sheet.** The line with no price base swaps its dead `<span>` for the mark button —
>   the only place the sheet offers the mark, because where the number is known the "Máx." fill
>   control (its accessible name carrying the amount, `ADR 0027`) is strictly more informative. A
>   **priced** line that is already marked shows a text
>   marker instead, "· marcado" in `--success-chip-text` on the reference line beside its
>   `ORD-…`: real text, not a colour, so it lands inside the row's accessible name where the
>   collector is looking while they pay. The amount input's editability is decided by
>   `line.state === "settled"` and by nothing else; a mark must never reach that comparison.
> - **Order detail, Productos subcard.** The control sits beside the delivery-state pill, at
>   `size="sm"` (11px), stacking under the name below 640px so it does not compete with the price
>   column. Delivery state and payment coverage are different axes and are drawn as siblings.
> - **Order detail, Pagos card.** Two new muted 12px lines under the totals ("Pagado al pedido, sin
>   desglosar" with its amount, and "Productos marcados como pagados: {marked} de {total}"), then,
>   only when every producto is marked and the pedido still owes money, the contradiction notice.
>   **Revised 2026-08-14 (F1):** the notice is `--info` tinted 8% with **no border** at
>   `--radius-md`, not the `--warning` banner recipe it borrowed from the sheet: an amber panel with
>   an alert border reads as a fault, and nothing faulted. It keeps `role="status"` /
>   `aria-live="polite"` rather than `alert` (it blocks nothing and is usually on screen at load),
>   and its CTA is a primary-coloured button carrying the residual ("Registrar {amount}") rather
>   than a bare "Anotar pago" link. **Corrected 2026-08-14 (F2 fix):** that CTA opens the inline
>   panel **already holding the residual**, submit live — a button that names a figure and lands on
>   an empty field with a dead submit is a promise the panel breaks. And it follows the surface that
>   owns the action: on mobile (`showAddCta={false}`, where `OrderPaymentMobileSheet` is the single
>   source of truth, §5.8) the notice states the gap with **no** CTA, instead of mounting the desktop
>   panel inside the card and raising the keyboard over the sheet's own quick-picks. The card's own
>   heading turns "Pagado al 100%" in `success` tone once the balance closes.
> - **~~"Sin desglosar" block, foot of the store group~~ — moved behind a trigger 2026-08-15.** It
>   was an `Eyebrow` title with an `aria-labelledby` section, a muted hint line, then one row per
>   pedido: the `ORD-…` as a link on the left, the amount `tabular-nums` on the right, separated
>   from the product list by a `--border` rule. At the foot rather than interleaved because the
>   products of a group are sorted by arrival, date or price, never by pedido, so a row inserted per
>   pedido would land in an arbitrary place in five of the six supported orderings — which is still
>   the reason it is not interleaved now.
>
>   **What it is now: `StoreUndetailedPaymentsModal`, opened from a header trigger.** The same
>   content (hint line, one linked `ORD-…` row per pedido with its amount) inside the canonical
>   `<Modal>`: `tone="info"`, a `Coins` icon-circle, the store name as the subtitle, **no footer
>   actions** (`bodyClassName="pb-6"` restores the breathing room the footer would have owned), a
>   bottom sheet under 768px. This is the second instance of the repo's summary-modal shape, after
>   `StoreGovernanceSummaryModal`; nothing new was invented for it. Each row is one full-width link
>   at `min-h-11`, so the row IS the tap target and no pseudo-element is involved, and it calls
>   `onClose` on the way out rather than leaving the overlay painting over the view transition.
>
>   **Why a modal and not a popover, a disclosure or a page.** A popover does not exist in this repo
>   and would be a new primitive with its own positioning, focus and touch fallback, which
>   `ui-libs-policy` and `modal-canonical-pattern` both point away from. An inline disclosure would
>   put the answer at the foot of a list up to 29 rows long while the control that opened it is at
>   the top, and would still be unreachable with the group collapsed. A page does not exist for a
>   per-store slice of one to five lines. The modal was already the app's only overlay.
>
>   **The trigger, "Sin desglosar · {n}", and why it has two slots.** `Button variant="ghost"
size="sm"`, text only: `ghost` is outline-only against the elevated `secondary` of "Registrar
>   pago" beside it, so it reads as a control without competing with the primary, and it carries no
>   icon precisely because `HandCoins` is already next to it. `{n}` is the number of PEDIDOS the
>   list holds (the `aria-label` says so in words, so the count is never a bare number to a screen
>   reader), and the trigger does not render at all when there is none — 8 of the collector's 10
>   store groups, today. From `md:` up it sits between "Registrar pago" and "Ver tienda", which is
>   where the owner asked for it. Below `md:` it does not: that cluster measures ~278px at
>   `--text-caption` against the ~252px a 320px viewport leaves inside the card and the ~307px a
>   375px one does, so a fourth labelled control needs a viewport around 495px and there is no phone
>   with one. Making the row wrap instead produces three lines with the chevron stranded alone, so
>   the touch slot is the identity block's money line — already `flex-wrap`, already full width, and
>   beside the saldo figure this list is an annotation of. Both slots are mounted and chosen by CSS
>   (`hidden md:inline-flex` / `min-h-11 md:hidden`), never by `useIsMobile()`, so nothing is
>   painted first and swapped. The touch slot is RESIZED to `min-h-11` rather than expanded with a
>   `::before`, because its neighbours are the debt figure and, on a wrap, the row above
>   (`docs/design/interface-patterns.md` §12).
>
>   **What did NOT change.** The query is untouched (`undetailedByOrder` still carries only pedidos
>   with a positive undeclared sum AND a live balance), and so is the optimistic payment patch: a
>   payment declared from the sheet still moves only `debts` and the per-product figures, so the
>   trigger's count catches up on the next full load exactly as the row-level `allocatedMinor`
>   already did. The view's resync signature covers it anyway, because every pedido in that list has
>   a pending producto whose `orderAllocatedAmountMinor` is part of the signature.
>
> - **~~The inline payment form's coverage block~~ — removed 2026-08-14 (F2).** It appeared with
>   more than one producto, after the date field: heading, "Opcional" marker, a hint that said out
>   loud that it did not split the amount, then plain checkboxes. It is gone, with its whole server
>   chain. When the copy has to deny what the position promises, the position is the defect: the
>   block sat 40px from an amount field inside a form about money, and asked a question about
>   coverage. It wrote 0 marks in the entire history.
>
>   **What the panel is now, top to bottom:** eyebrow + close, the amount field (the only element
>   with typographic weight), the three quick-picks ("Todo · {amount}" / "50%" / "20%", the selected
>   one carrying `aria-pressed` and an `aria-label` with the resulting amount), a folded date line
>   ("Hoy, {date} · Cambiar", `aria-expanded` + `aria-controls` on the disclosure, focus handed to
>   the field on unfold), and a submit button that names the outcome ("Registrar {amount}"). Five
>   blocks became three. The mobile sheet is the same form with the amber "Saldo pendiente" box
>   replaced by a one-line subtitle and with the amount field's autofocus **off**, so the keyboard
>   does not cover the quick-picks that make it a one-tap flow.
>
> - **Order detail, Productos subcard — a producto with money and no price.** Renders the amount as
>   plain 11px secondary text ("{amount} pagados") beside the delivery pill, with no bar and no
>   percentage: there is no denominator to divide by.
>
> **Amendment — The "Por tienda" view rebuilt for touch (2026-08-22, `FR-05-70` / `FR-05-71` /
> `FR-05-72`).** Measured in the browser at 375px on real collector data (10 stores, 66 pending
> products) before anything was drawn: **7,916px of scroll** (9.7 screens), store headers of 165 to
> 235px, **43 of the 66 product names truncated**, and rows ranging 66 to 106px with no rhythm. Six
> of the ten stores were spending ~185px each to announce a zero balance. The diagnosis was not
> width: the group's chrome weighed more than its content, and each row was trying to be a
> four-column table inside 309px.
>
> Three changes, in the order they matter:
>
> - **Groups land closed** (`FR-05-70`), at every breakpoint, ~1,110px in place of 7,916. What
>   closing would have hidden, the closed row now says: "15 de 20 atrasados" in the summary line,
>   counted through the same `resolveArrivalState` predicate the rows use (`countOverdueProducts`),
>   so header and rows cannot disagree. The whole header row is the disclosure control, wrapped in
>   an `h3` per the APG pattern. **The target is the whole row**, padding and chevron included, via an
>   `::after` overlay at `inset-0` of a `relative` row: the button's own box stops at the text, which
>   shipped once and left the chevron inert, the one pixel a collector actually aims at. Same shape
>   `OrderCard` uses for "the card is one big link" (overlay owns everything, content is inert,
>   controls opt back in); here the chevron is `pointer-events-none` so a press falls through, and the
>   desktop action cluster is `relative` so tree order keeps it above. "Registrar pago" /
>   "Sin desglosar" / "Ver tienda" left the header for the group body below `md`
>   (`StoreGroupActions`, one mount per breakpoint, the two-slot shape the "Sin desglosar" trigger
>   already used). That order is the collector's: the two money controls together, navigation last.
> - **The view switcher moved to the app header** (`FR-05-71`), portalled through a slot the shell
>   publishes (`HeaderAccessoryPortal`). The owner proposed the burger menu; both places free the
>   same 94px, so the tiebreaker was that the menu COSTS the active-view answer (the title says
>   "Pedidos" in both views) while the header, being `sticky top-0`, keeps it visible with the list
>   scrolled. Nav items are flat in this shell, so the menu would also have needed sub-items built
>   for one control. The freed width let the mobile search placeholders drop their unreadable
>   parenthetical examples (`search.placeholderCompact`) instead of being cut mid-word.
> - **The row is leading / content / trailing** (`FR-05-72`). The name takes up to two lines
>   (`-webkit-line-clamp:2`), which took truncation from 43 rows to 5; line 2 is two fixed slots,
>   money then arrival, and never wraps. The state chip left line 1 for the trailing slot and stands
>   down while selecting. The currency code prints only in a group that mixes currencies. One
>   implementation trap is worth recording: `[display:-webkit-box]` must be the element's ONLY
>   display utility, because a second one wins on source order and kills the clamp silently, with
>   nothing in the class list looking wrong. It shipped that way once (a formatter reordered `block`
>   after the arbitrary property) and is now guarded in the card's own test.

> **Amendment — Search in the "Por tienda" view (2026-08-15, `FR-05-55`).** The view shipped with
> no way to narrow anything: sort and collapse were the only controls, so finding one store or one
> product among tens meant scrolling the whole list. It now carries a search box, and the design
> question was never whether to add one but where to put it and what it may change on screen.
>
> - **Same slot, not a new one.** The box takes the toolbar's leading position, exactly where the
>   "Por pedido" view already puts its own, so the canonical order (Search < Filter < Sort < Group
>   by < New order) holds in both views and the store view simply renders the subsequence without
>   Filter. The drawer stays order-only: its sections are per-order predicates (status, order date,
>   FX, saldo) that the grouped-by-store body cannot answer, so the only control that was missing
>   was the free-text one.
> - **Two search boxes, two params (`q` for orders, `sq` for stores).** They look identical and are
>   deliberately not the same control: each view carries the other's params forward inert, and
>   sharing one param would make text typed in one view silently re-filter the other's body on the
>   next switch. The placeholder is what tells them apart ("Producto, tienda o código…" vs "Tienda o
>   producto…"), and that is enough because only one is ever on screen.
> - **What the search may change, and what it may not.** A store matched by NAME keeps its group
>   whole; a store matched through its PRODUCTS shows only those products, with the header's open-
>   order count recomputed from the survivors and the "sin desglosar" list (and the count on its
>   trigger) narrowed to the orders still on screen — the same recomputation the optimistic arrival patch already does, for the same
>   reason: a count that describes rows nobody can see is a wrong count. **The debt figure is the
>   exception and stays put.** What a store is owed is a fact about the store, not about the subset
>   currently rendered, and a number that shrank because someone typed into a search box would be a
>   lie about money.
> - **The active search shows as a chip below the toolbar** (`StoreViewFilterChips`, reusing
>   `AppliedFilterChip`), in the same row position the "Por pedido" list puts `OrderListFilterChips`
>   in: a list that is being narrowed says so on the list itself, not only inside the input. Its X
>   drops `sq` and keeps every other param, and the toolbar input empties with it (it syncs from the
>   URL). Unlike the order view, no "Limpiar filtros" link sits beside it: that link exists there
>   because several chips can be up at once, and here the single chip's X already is the clear-all.
>   The chip is a separate component rather than a branch of `OrderListFilterChips`, which is built
>   on `OrderListActiveFilters` + `buildOrderListFilterUrl` and rebuilds the URL from the order
>   view's filter shape alone (dropping `?view=store` on the way).
> - **No match** renders the canonical `EmptyState` card (`SearchX`, neutral tone, `h2`), with one
>   ghost action that clears `sq` and keeps every other param — the "Por pedido" list's own
>   `noResults` grammar, worded for this view ("Ninguna tienda ni producto pendiente coincide con tu
>   búsqueda").
> - **Mobile: the sort moves from a `Select` to an icon trigger** (`StoreViewSortCompact`,
>   `ArrowUpDown` + `MobilePicker` sheet). With the search box leading the row there is no width
>   left for a select whose intrinsic floor is its longest option ("Llegada más próxima"): the two
>   together left the input around 70px. The order view already answers the same squeeze the same
>   way — below `lg` its sort lives inside the filter drawer — so below `lg` sort is a control you
>   OPEN in both views, never a value read off the toolbar. The result is that both views' mobile
>   rows are now the same three slots at the same widths (measured at 375px: search 189px, icon
>   trigger 44px, Group by 94px), which is what keeps Group by pinned across a view switch.
>
> **Amendment — The arrival window replaces the order date (2026-08-16, `FR-05-56` / `BR-05-25`,
> `ADR 0030`).**
>
> > **Superseded 2026-08-17 by the amendment below, and kept in full deliberately** (the same
> > treatment `ADR 0030` §5 gives its own retired section). The FIRST bullet — granularity — is the
> > only one that still describes the shipped screen. Everything from "`resolved` is a state"
> > onwards is written in a present tense that is now false, and the falsehoods are load-bearing
> > enough to name, because `frd-design-documentation.mdc` makes this file the source of truth while
> > the prototype lags:
> >
> > - **There is no `suppressed` prop.** The row passes the optimistic `deliveryState` itself, and
> >   the line changes WORDING ("Atrasado 17 días" → "Esperada 12 jun") instead of hiding a chip.
> >   The mechanism and its rollback are unchanged; what moved is what the row does with the answer.
> > - **There is no `soon` state and no "Pronto" chip.** It was merged into `scheduled`: with the
> >   chip gone it rendered the same sentence as its neighbour, so only colour would have separated
> >   them, which is the WCAG 1.4.1 violation the chip existed to prevent.
> > - **There is no arrival chip at all**, so the whole one-pill budget below — the
> >   `isFlaggedIneligible` suppression, the `isQuietLabel` width assumption, and both declared
> >   deviations from `docs/design/interface-patterns.md` §8 — has no object. A flagged row now shows
> >   its ineligible chip on line 1 AND its delay on line 2. (The delay a flagged row keeps is a
> >   declared trade, not an oversight: see `ADR 0030` §8.)
> > - **"41 of 73 rows" is now 49**, and the count moved for a reason rather than by recount: with
> >   `soon` merged away, the quiet set is 34 `scheduled` + 11 `noDate` + 4 `resolved`. The 24 amber
> >   rows and the 42% figure in the same bullet are unchanged and still correct.
> >
> > The section stays because it is the record of what the width arithmetic cost and of what a change
> > in the state's SHAPE dissolved in one move. Anyone putting a second pill back on line 1 has to
> > redo it.
>
> The row's second line answered a question nobody was asking. This is a list of
> products that have NOT arrived, sorted by arrival by default, and the date it printed was the day
> the collector placed the order. It now prints when the order is expected.
>
> - **Granularity is the whole design decision.** The existing `formatArrivalWindow` would render
>   `2026-09-01 → 2026-09-30` as "1–30 sept", which is a day-level promise; the order form's own
>   "este mes" / "el próximo mes" presets write exactly those two endpoints, so that range IS the
>   encoding of "septiembre", and 48 of the 62 dated rows in the real data have that shape. A new
>   `formatExpectedArrival` collapses it to "sept" / "sept 2027", keeps a single stated day
>   ("12 jun"), keeps a genuinely irregular window ("20 sept – 31 oct"), and prints the year only
>   when it is not the reader's own — both years when the window crosses it ("20 dic 2026 – 16 ene
>   2027"). `formatArrivalWindow` is untouched and its four consumers are unaffected.
> - **The state scheme is not Linear's.** Red-today / orange-within-a-week / grey-otherwise applied
>   to this data gives 26 reds, 0 oranges and 36 greys: a binary dressed as three levels. Linear
>   designs for deadlines the user controls; here the collector controls nothing and the window
>   carries ±15 days of declared slack. The gradation that IS actionable is the AGE of the delay
>   (16 days late on a pre-order is normal; 228 is a date that has lost all credibility), so it
>   lives in the label — "Atrasado 47d" under 60 days, "Atrasado 7 meses" from there — and never in
>   a second tone. A `destructive` arrival would exist only in this view, and the same order would
>   read amber in "Por pedido", in its detail and in deliveries, and red here.
> - **`resolved` is a state, and its name was chosen against the neighbours.** `arrived_at_store`
>   and `in_transit` both mean an observed event has ANSWERED the prediction, so the row shows the
>   window in the past tense with no chip and no future tense, whichever side of today it falls on.
>   Four real rows made this blocking: two would have shown a delay counter growing over a product
>   sitting on a shelf, and two would have announced "llega sept 2026" about a product already at the
>   store. It is deliberately not called `settled`: "Saldado" (`storeView.settled`, `ADR 0026`) is
>   the PAYMENT vocabulary of this very row, rendered forty lines away. **It resolves on the state
>   the row is SHOWING (2026-08-16):** the state chip beside it is a control with an optimistic value
>   of its own, so it reports every transition (rollback included) and the row passes it down as
>   `suppressed`. Otherwise pressing "Marcar como listo en tienda" left a delay counter running next
>   to a chip that already read "Listo en tienda".
> - **`soon` carries a chip, and that is a contrast decision rather than a decorative one.** It
>   renders the same sentence as `scheduled` ("llega {ventana}"), so a coloured line with no chip
>   would leave colour as the only difference between two states (WCAG 1.4.1); and raw `--info` does
>   not reach AA as body text in light theme, which the system already conceded when it created
>   `--info-chip-text` as a light-only alias. `Chip variant="info"` resolves to that alias, so the
>   chip fixes the contrast by construction instead of by vigilance. Icon `CalendarClock`, because
>   `Truck` already means in transit and `Clock` already means `OPEN`.
> - **The chip sits on line 1, and only one chip ever does.** Line 2 has no element that truncates,
>   so window + chip together overflow it by 45–93px at 375px, with no escape (the component already
>   carries a comment recording that this exact failure once wrapped 63 of 67 rows). Line 1 does have
>   one — the name's `truncate` — so the chip goes there in both breakpoints. But that escape only
>   works up to ONE extra pill: the `truncate` is on the name's `<span>` and the `<p>` has no
>   `overflow-hidden`, so with two pills the name reaches zero and the pills leave the box. Hence
>   the ineligible flag SUPPRESSES the arrival chip rather than ordering itself against it —
>   transient feedback about the action just attempted outranks a chronic delay, and suppressing
>   avoids the state instead of cropping it. The same one-pill budget is what a mark would break:
>   flipping the state chip restores its full ~131px label, which does not fit beside the ~146px
>   delay pill, so the arrival chip goes with the mark (above). On desktop the arrival chip also cannot join the state
>   chip in the Estado column: 150px against a ~146px pill. Both are declared deviations from
>   `docs/design/interface-patterns.md` §8.
> - **The order link moved onto the product name.** The date was the row's ONLY route into the
>   order, and 11 rows have no date at all, so removing it without moving the link would have left
>   them unnavigable. The name is the primary identifier, the natural destination, and a far larger
>   touch target than a caption-sized date; `ArrowUpRight` 10×10 `aria-hidden` follows it, and the
>   `viewTransitionEntity="order"` and `returnTo` are unchanged. On the card the hit area is grown
>   with a `::before` sized to the clearance that actually exists (10px of the card's top padding,
>   the 4px inter-line gap below) and stops there, because line 2 carries its own controls
>   underneath; the desktop row gets no expansion at all, since it only renders from `lg` up.
> - **41 of 73 rows stay exactly as quiet as before.** `scheduled` and `noDate` carry no chip and no
>   colour. That is the anti-fatigue mechanism, and it is what makes the 24 amber rows readable —
>   uncomfortable, but true: 42% of the dated products really are past their window.

> **Amendment — The chip becomes a line, and the delay replaces the estimate (2026-08-17,
> `FR-05-56`, `ADR 0030` §8).** The collector read the amendment above on screen and asked for two
> things: the amber pill is too loud and in the wrong place, and a late row should say
> "Atrasado 17 días" **where** the estimate was, not next to it.
>
> - **One slot, four states, one size.** The row's second line is a single `<span>` at
>   `--text-caption`. `scheduled` reads "Llega sept 2026", `resolved` "Esperada 12 jun", `noDate`
>   "Sin fecha estimada" — all `--text-muted` — and `overdue` reads "Atrasado 17 días" /
>   "Atrasado 7 meses" in `--warning-chip-text`, **instead of** the window. Nothing else changes
>   between states: same element, same typeface, same size, only the colour.
> - **The request is the better design, and the reason is worth keeping.** On a row that is late the
>   estimate is the least interesting thing on it: "Esperada 26 jul" asks the reader to subtract and
>   "Atrasado 17 días" is the answer they were subtracting to get. The previous layout printed the
>   question and the answer side by side and spent a pill doing it. What it costs is that a late row
>   no longer names which estimate slipped; the detail holds it, one link away on the product name.
> - **This is MORE conformant with WCAG 1.4.1, not less.** The words differ ("Atrasado" against
>   "Llega" / "Esperada"), so a reader who cannot see the amber loses nothing and the colour only
>   reinforces. Which is also why **`soon` was merged into `scheduled` rather than recoloured**: it
>   renders the same sentence as its neighbour, so a coloured line would have left colour as the sole
>   differentiator — the exact violation the "Pronto" chip had been introduced to prevent. It cost
>   1 row of 73; the window already states proximity at a finer resolution than a badge ("Llega sept"
>   read in September), and the default `arrival-asc` sort puts those rows first anyway.
> - **`--warning-chip-text`, never `--warning`.** 2.46:1 against `--surface` in light for the raw
>   token (it is a chip FILL) versus 8.42:1 light / 11.30:1 dark for the alias; 8.06:1 on
>   `--surface-elevated`, 6.77:1 / 9.87:1 on a `state-selected` row. The same trap as the `soon` chip
>   hit from the other side with `--info` (3.83:1), and nothing in the suite computes contrast.
> - **Sentence case, both locales, every state.** The first version shipped lowercase because the
>   keys were copied from `orderListing.table.arrivalArrives`, where the phrase is embedded in a
>   sentence. Here each one starts a line. `src/test/arrival-line-copy-guard.test.ts` holds it.
> - **What this simplified.** Line 1 is back to the name plus at most the ineligible flag, so the
>   whole two-pill arithmetic of the amendment above loses its object: both declared deviations from
>   `docs/design/interface-patterns.md` §8, the `isFlaggedIneligible` suppression, and the fragile
>   `isQuietLabel` width assumption. A flagged row now shows its ineligible chip **and** its delay,
>   on different lines. The optimistic-state rule survives unchanged in substance: the state chip
>   still reports every transition and its rollback, and the row still hands it down — what changed
>   is that it now switches the line's WORDING to the neutral past tense instead of hiding a chip.
> - **Line 2 got cheaper, not more expensive.** An overdue row prints ~100px where it used to print
>   ~115px ("Esperada sept 2026" — the Spanish short month for September is four characters, not
>   three; see `ADR 0030` §8), so the widest string that slot can hold is still a future irregular window
>   ("Llega 20 dic 2026 – 16 ene 2027"), unchanged by this amendment and pinned
>   `shrink-0 whitespace-nowrap` as before.

> **Amendment — A resolved arrival states the EVENT, and the same rule reaches the order surfaces
> (2026-08-17, `FR-05-56` / `FR-05-57`, `ADR 0030` §3.1 / §3.2).** The collector opened the shipped
> version on `ORD-20260509-02` (Palmito Store, "One Piece Card Game Starter Deck EX ST-30"), read
> "Esperada 12 jun" in August, and asked why it was not marked late. **Everything above that says
> `resolved` prints the window in the past tense is now false; the suppression itself is unchanged
> and is not reversed.**
>
> - **The bug was legibility, not semantics.** The line stated a prediction and never named the event
>   that answered it. On the desktop row the chip that accounts for it is the third grid track
>   (`minmax(0,1fr)_120px_150px_140px`), ~270px away past the price; on the mobile card it is one
>   line up, closer but still a second fact to assemble. And the row's own sort compounds it:
>   `arrival-asc` ranks by the window, so this row (12 jun) sits at the TOP of its store group,
>   directly above six rows reading "Atrasado 17 días" against a LATER window (31 jul).
> - **`resolved` now reads "Ya llegó a la tienda" / "Ya está en camino"**, split by delivery state,
>   with no ventana in either. Neither repeats its chip ("Listo en tienda" / "En camino"): a chip
>   names a STATE and is a control; this line answers "when does it get here?" in the past tense.
>   `storeView.arrival.expected` has no caller left in this list and was deleted.
> - **Two of the four resolved rows are the worse half.** Their window is in the FUTURE, so
>   "Esperada oct" read as a live promise about a product already on the shelf. Those disappear
>   entirely rather than being reworded.
> - **It no longer needs a window.** A product at the store with no window used to fall to `noDate`,
>   so three of the seven at-the-store rows read "Sin fecha estimada" beside four that said something
>   else. Since the sentence names no date, the branch had no reason to exist.
> - **The slot got cheaper again**, which matters because the mobile card pins it
>   `shrink-0 whitespace-nowrap`: the longest resolved string is now 20 characters against a previous
>   worst case of "Esperada 20 dic 2026 – 16 ene 2027". Keeping the window would have needed a verb
>   to disown it ("Ya llegó a la tienda, se esperaba 20 sep – 31 oct", ~50 characters), which is why
>   it was dropped rather than shortened.
> - **The same reading existed one click away, at ORDER level (`FR-05-57`).** The per-order list chip
>   read "Atrasado 2 meses" for that order and its detail opened with a `role="alert"` banner
>   counting the same delay above the product's own "Listo en tienda" pill. `isOrderOverdue` now takes
>   the items and clears the flag once **every** product has been observed arriving; the list's
>   arrival line gained a third reading ("ya llegó a la tienda") because "llega" was merely the `else`
>   of "overdue" and would otherwise have printed a future tense over a past date; and the
>   "Entrega atrasada" filter moved with the chip so the two cannot disagree on the same screen.
> - **Rejected: showing the real arrival date.** There is no such column. `OrderItem` has no
>   `arrivedAtStoreAt`, only `updatedAt` (bumped by any edit), and `Delivery.receivedDate` belongs to
>   a delivery whose items are `delivered` and therefore absent from this list.

> **Follow-up (explicit, not scheduled):** the prototype HTML's `#s7-orders-list-*` /
> `#s7-order-detail-*` anchors have not been updated for this model, and there is no prototype
> screen for the "Por tienda" view at all — so the selection tiles, the group action bar and the
> "Estado" column of the 2026-08-13 amendment are not drawn either, nor is the "Por tienda" half of
> the 2026-08-14 amendment (the row/card mark control and the "sin desglosar" list, which moved
> behind a header trigger on 2026-08-15), nor its
> toolbar search of 2026-08-15, nor the arrival window that replaced the order date on 2026-08-16
> (nor its 2026-08-17 revision to a single line of coloured text).
> The FDD prose above and the shipped implementation are the source
> of truth in the meantime (per the Authority
> order in `.agents/rules/frd-design-documentation.mdc`). This no longer covers the store payment
> sheet, which has its own prototype section (`#s7-store-payment-sheet`, added 2026-08-10; its
> allocation panel gained the mark button and the "· marcado" marker on 2026-08-14).

---

## 1. Overview & screens covered

Orders, Payments & Shipment is the **central collector workspace**: the place where a
collector records what they bought, what it cost, how much has been paid, and whether the
order is still open, partially in transit, completed, or cancelled. It is the first of the
three lifecycle workspaces and the one the Deliveries workspace (FRD-08) was deliberately
modeled after — same shell, same list/detail/wizard grammar, same action hierarchy.

The one defining trait of Orders, and the divergence Deliveries calls out by contrast:
**the protagonist datum is a money amount, not an arrival window.** An order is the
financial commitment the collector is paying down over time, so the detail hero leads with
the outstanding balance ("Saldo pendiente") against the total, and fulfillment timing is a
caption. The two states are kept conceptually distinct end-to-end (`FR-05-32`/`FR-05-33`):
status is system-derived from fulfillment, while payment progress is tracked separately —
which is why a `COMPLETED` order can still carry a visible unpaid signal.

### Screens in this FDD

The prototype is the S7 workshop demo; it carries the full Velvet redesign plus a few
**superseded** sections retained for provenance. The canonical create flow is a **3-step
wizard** (Datos → Productos y costos → Confirmar); the `step-4`/`step-5`,
`step-3-validation`, and `step-1-from-store` anchors belong to an earlier 5-step iteration
and are **not** the design of record (see §9 and the create spec's methodology note).

| #   | Screen                                  | Route                        | Prototype anchor                           |
| --- | --------------------------------------- | ---------------------------- | ------------------------------------------ |
| 1   | Orders list (default)                   | `/{locale}/orders`           | `#s7-orders-list-default`                  |
| 2   | List · loading                          | `/{locale}/orders`           | `#s7-orders-list-loading`                  |
| 3   | List · empty (initial)                  | `/{locale}/orders`           | `#s7-orders-list-empty-initial`            |
| 4   | List · empty (filtered)                 | `/{locale}/orders?…`         | `#s7-orders-list-empty-filtered`           |
| 5   | List · FilterDrawer open                | `/{locale}/orders`           | `#s7-orders-list-filters-open`             |
| 6   | List · FX banner                        | `/{locale}/orders`           | `#s7-orders-list-fx-banner`                |
| 7   | Modal · FX reconciliation               | (list overlay)               | `#s7-fx-reconciliation-modal`              |
| 8   | Order detail · active                   | `/{locale}/orders/[id]`      | `#s7-order-detail-active`                  |
| 9   | Order detail · overdue                  | `/{locale}/orders/[id]`      | `#s7-order-detail-overdue`                 |
| 10  | Order detail · partially paid           | `/{locale}/orders/[id]`      | `#s7-order-detail-partially-paid`          |
| 11  | Order detail · completed + unpaid       | `/{locale}/orders/[id]`      | `#s7-order-detail-completed-unpaid`        |
| 12  | Order detail · cancelled                | `/{locale}/orders/[id]`      | `#s7-order-detail-cancelled`               |
| 13  | Detail · inline pay form                | (detail expand)              | `#s7-order-detail-pay-modal`               |
| 14  | Modal · cancel order                    | (detail overlay)             | `#s7-order-detail-cancel-modal`            |
| 15  | Modal · delete order                    | (detail overlay)             | `#s7-order-detail-delete-modal`            |
| 16  | Create · step 1 (Datos)                 | `/{locale}/orders/new`       | `#s7-order-create-step-1`                  |
| 17  | Create · step 2 (Productos y costos)    | `/{locale}/orders/new`       | `#s7-order-create-step-2`                  |
| 18  | Create · step 3 (Confirmar)             | `/{locale}/orders/new`       | `#s7-order-create-step-3`                  |
| 19  | Create · no eligible stores             | `/{locale}/orders/new`       | `#s7-order-create-empty-stores`            |
| 20  | Modal · discrepancy                     | (create overlay)             | `#s7-order-create-discrepancy-modal`       |
| 21  | Calendar · date-range picker            | (create/edit popover)        | `#s7-date-range-picker`                    |
| 22  | Edit order (all-open)                   | `/{locale}/orders/[id]/edit` | `#s7-order-edit`                           |
| 23  | Modal · discard changes                 | (edit overlay)               | `#s7-order-edit-discard-modal`             |
| 24  | Mobile · list                           | `/{locale}/orders`           | `#s7-orders-list-mobile`                   |
| 25  | Mobile · list loading                   | `/{locale}/orders`           | `#s7-orders-list-loading-mobile`           |
| 26  | Mobile · list empty (initial)           | `/{locale}/orders`           | `#s7-orders-list-empty-initial-mobile`     |
| 27  | Mobile · list empty (filtered)          | `/{locale}/orders?…`         | `#s7-orders-list-empty-filtered-mobile`    |
| 28  | Mobile · FilterDrawer (bottom sheet)    | `/{locale}/orders`           | `#s7-orders-list-filters-mobile`           |
| 29  | Mobile · FX reconciliation (full sheet) | (list overlay)               | `#s7-fx-reconciliation-mobile`             |
| 30  | Mobile · detail                         | `/{locale}/orders/[id]`      | `#s7-order-detail-mobile`                  |
| 31  | Mobile · detail overdue                 | `/{locale}/orders/[id]`      | `#s7-order-detail-overdue-mobile`          |
| 32  | Mobile · detail cancelled               | `/{locale}/orders/[id]`      | `#s7-order-detail-cancelled-mobile`        |
| 33  | Mobile · detail completed + unpaid      | `/{locale}/orders/[id]`      | `#s7-order-detail-completed-unpaid-mobile` |
| 34  | Mobile · pay sheet                      | (detail overlay)             | `#s7-order-detail-pay-mobile`              |
| 35  | Mobile · cancel sheet                   | (detail overlay)             | `#s7-order-detail-cancel-mobile`           |
| 36  | Mobile · delete sheet                   | (detail overlay)             | `#s7-order-detail-delete-mobile`           |
| 37  | Mobile · create (step 1)                | `/{locale}/orders/new`       | `#s7-order-create-mobile`                  |
| 38  | Mobile · create (step 2)                | `/{locale}/orders/new`       | `#s7-order-create-step-2-mobile`           |
| 39  | Mobile · create (step 3)                | `/{locale}/orders/new`       | `#s7-order-create-step-3-mobile`           |
| 40  | Mobile · add product sheet              | (create overlay)             | `#s7-order-create-add-product-mobile`      |
| 41  | Mobile · discrepancy sheet              | (create overlay)             | `#s7-order-create-discrepancy-mobile`      |
| 42  | Mobile · no eligible stores             | `/{locale}/orders/new`       | `#s7-order-create-empty-stores-mobile`     |
| 43  | Mobile · store picker                   | (create overlay)             | `#s7-store-picker-mobile`                  |
| 44  | Mobile · currency picker                | (create overlay)             | `#s7-currency-picker-mobile`               |
| 45  | Mobile · product-type picker            | (create overlay)             | `#s7-product-type-picker-mobile`           |
| 46  | Mobile · date-range picker (full sheet) | (create/edit overlay)        | `#s7-date-range-picker-mobile`             |
| 47  | Mobile · edit                           | `/{locale}/orders/[id]/edit` | `#s7-order-edit-mobile`                    |
| 48  | Mobile · discard sheet                  | (edit overlay)               | `#s7-order-edit-discard-mobile`            |
| 49  | (provenance) Section index — list       | —                            | `#orders`                                  |
| 50  | (provenance) Section index — detail     | —                            | `#order-detail`                            |
| 51  | (provenance) Section index — create     | —                            | `#order-create`                            |
| 52  | (superseded) Create · step 4 (5-step)   | —                            | `#s7-order-create-step-4`                  |
| 53  | (superseded) Create · step 5 (5-step)   | —                            | `#s7-order-create-step-5`                  |
| 54  | (superseded) Create · step 3 validation | —                            | `#s7-order-create-step-3-validation`       |
| 55  | (superseded) Create · step 1 from store | —                            | `#s7-order-create-step-1-from-store`       |

Requirements traced throughout: `FR-05-01 … FR-05-38`, `BR-05-01 … BR-05-18`,
`AC-05-01 … AC-05-07` (see [`frd-05-order-payment-shipment.md`](./frd-05-order-payment-shipment.md)).
Status-chip mapping is governed by [ADR 0002](../../../design/decisions/0002-status-chip-mapping.md);
the detail/aside grammar by [ADR 0003](../../../design/decisions/0003-demo-decisions.md);
the inline secondary-action card by [ADR 0011](../../../design/decisions/0011-mobile-detail-secondary-actions.md).

---

## 2. Layout & structure per screen

All product screens live inside the collector **App Shell** (PUSH `Sidebar` + `Header`
topbar + content column) — see [interface-patterns.md → Layout & app shell](../../../design/interface-patterns.md).
The shell is system chrome and is **not** redefined here; only the content column is
Orders-specific.

### 2.1 Orders list (`#s7-orders-list-default`)

Vertical rhythm, top to bottom:

```
app-topbar (sticky)     título "Pedidos" (desktop, no breadcrumb at list root)
page-heading            <h1>Pedidos</h1> + meta "5 activos · 1 cerrado"
orders-toolbar          search · FilterTriggerButton · sort Select · [+ Nuevo pedido]
orders-filter-chips     removable chips for active filters (default: "Solo activas")
fx banner               s7-orders-list-fx-banner — only when pendingFxCount > 0
card (tabular list)      orders-table-head + order-row × N + pagination
```

Unlike the card-grid the FRD originally sketched, the redesign settled on a **tabular
list**. **Desktop columns** (left→right) on the `order-row`:
`[store-avatar s32] · Pedido / Tienda (col-store) · Productos (col-product) · Estado
(col-status) · Total (col-total) · % Pago (col-progress) · [expand-toggle chevron]`.

- **Pedido / Tienda**: store name in `font-weight 600`, then the **order date** in `MonoCode`
  and the **expected arrival**, joined on one line (`26 jul 2026 · llega 1–30 nov`) from
  **1360px** up and stacked on two lines below it.

**Design decision, 2026-08-05 — the row shows the expected arrival and drops the order code.**
This supersedes the earlier version of these two bullets, which put `ORD-YYYYMMDD-NN` in the
secondary line and gave the table no arrival column at all. Two reasons. First, `FR-05-29` always
required the expected delivery range in the row and this design never carried it, so the list
could be filtered by delivery date (`deliveryFrom` / `deliveryTo` / "Entrega atrasada") while
showing nothing to check the filter against. Second, the identifier is detail-surface metadata by
`FR-05-03` and `WO-06`; it is still searchable, still on the detail hero with its copy button,
still in the breadcrumb, and still on the dashboard rows.

It lives **inside `col-store`**, joined to the order date where the cell is wide enough and
stacked under it where it is not. Two other shapes were tried and rejected. A **column** cost an
eighth track that squeezed the other five hard enough to wrap the payment cell's percentage under
its own progress bar between 1024px and 1280px, and the value is null on many orders, so it does
not earn permanent horizontal space. **Joining unconditionally** fails at the narrow end: this
line is `truncate`d, and `truncate` cuts from the right, so a cell too narrow silently eats the
arrival — the value being added. The responsive split keeps the compact single line where it is
safe and degrades to two full-width lines where it is not.

**The 1360px switch is measured, not chosen.** Against the real corpus (491 orders with a window,
median 28 characters, longest 37 — `12 feb 2026 · esperada 1 jun – 31 jul` in `es`,
`May 27, 2026 · arrives Sep 20 – Oct 31` in `en`), forcing the single line and counting clipped
nodes over 100 rows gives: **1152px → 14 clipped, 1230px → 2, 1280px → 0, 1360px → 0 in both
locales, 1600px → 0**. The true boundary is near 1250px; 1360px keeps roughly 18 characters of
headroom for longer future windows, longer month names and other locales. Below it the stacked
form clips nothing, and the `·` separator is hidden so it never orphans at the start of a line.
Re-measure this number if the window format or the column widths change.

- **Expected arrival line**: the window via `formatArrivalWindow` (`src/lib/arrivalWindow.ts`,
  shared with the deliveries list) — `llega 15–22 ago`, collapsing to a single date when both
  ends fall on the same day (image intake writes both ends from one stated date, so this is
  common). Once the window has elapsed the verb becomes `esperada …` in `--warning` (`WO-06`);
  a `COMPLETED` / `CANCELLED` order renders no line at all rather than promising an arrival.
  "Elapsed" is `resolveOrderArrivalDueDate` (window close, or its start when open-ended), the
  same rule the status chip, the "Entrega atrasada" filter and the dashboard now share.
- **No `% Pago` column** _(retired 2026-08-08, `ADR 0025`)_: the row used to end in a mini
  progress bar plus a paid percentage. Under store-level payments a per-order percentage is not a
  fact the data can state, so the column, the bar and the "Impago" pill are gone and the grid is
  six tracks. What replaced them is **binary**: see the "Saldo pendiente" chip in §5.2.
- **Terminal-state dimming**: `COMPLETED` rows render at `opacity: 0.75` — closed but not
  hidden; `CANCELLED` rows only appear when the user explicitly includes that status.

Each `order-row` is expandable; the chevron reveals an inline product list (every item

**Design decision, 2026-08-06 — the expanded drawer lists every product.** It used to stop at five and print `"+ N más…"`, which was inert text: it named products it would not show, while the row's own Products column already printed the true total beside it and the quick-arrival modal already offered the full list. The mobile card never capped, so the same order showed five items on a monitor and all of them on a phone; this is desktop catching up to it, not a new behaviour. Real distribution here is p50 = 1 item, p90 = 6, p99 = 15, max = 32, so the cap fired on about one row in eight while the tall case it guarded against is a single order in 560. Because an uncapped drawer (~56px per row, so ~1,900px at 32 items) pushes the expand chevron far above the fold, the drawer now ends with its own collapse action, mirroring the mobile card whose toggle already sat below its items. FDD-08 never specified a cap; the deliveries list had it as undocumented drift and loses it here too.
with item-icon + name + subtype + item-state + qty + price, then `"+ N más…"` and an
`"Abrir detalle →"` link). Default visible sort is **newest first** (CB-01: a deliberate
divergence from `FR-05-28`'s original oldest-first, because collectors manage recent orders
first).

A thin right-aligned row above the list (below `orders-filter-chips`, shown only from 2 rows
up) carries a single `Expand all` / `Collapse all` toggle (`ExpandAllToggle`) driving one
shared multi-open expansion set for every row on the current page + filter — the desktop
table is no longer a single-open accordion. Its label always shows the _next_ action
(`"Expandir todo"` until every row is open, then `"Colapsar todo"`), while `aria-pressed`
carries the true `true`/`false`/`mixed` state for assistive tech.

The **FX banner** (`#s7-orders-list-fx-banner`, `role="status"`, `aria-live="polite"`,
leading `refresh-cw` in `--accent`) sits between the chips and the list when
`pendingFxCount > 0`; its tonal CTA opens the FX reconciliation modal (§5.6).

### 2.2 Order detail (`#s7-order-detail-active` and state variants)

Two-column `detail-grid`: a main column + a **sticky aside** (ADR 0003 Decision 7).

```
app-topbar     breadcrumb "Pedidos › ORD-YYYYMMDD-NN"  (id in JetBrains Mono)
overdue banner (only when overdue) — role="alert", between topbar and back-link
back-link      "← Pedidos"
detail-grid
  main         detail-hero (top-accent) → Productos subcard (open) → Historial subcard (closed)
  aside        Pagos card → Acciones card → Tu nota privada card
```

The aside ordering is **Pagos → Acciones → Nota** (the payment ledger, not a generic
summary, leads here — the divergence from Deliveries' Resumen-first aside). Unlike delivery
detail, **order detail keeps the Historial subcard** (`FR-05-22`/`BR-05-09`): an automatic,
**read-only** lifecycle log, closed by default and desktop-only.

**Hero anatomy** (`detail-hero.s8-card-accent`, `view-transition-name: order-{id}`):

1. `detail-hero-head`: `StoreAvatar s56` + store name + `ORD-…` (with a copy button on
   mobile) + status `Chip` (sometimes dual — see per-state table). The store name links to the
   store's detail page (`order_view_store_clicked`), carrying `returnTo`/`returnLabel` so that
   page's back link reads "Volver al pedido {orderId}" instead of the default "back to listing"
   (`FR-05-23`, mirrors the mechanism `frd-04-store-domain.md` documents on the store side).
2. `s8-eyebrow-chip`: `"Tu pedido · {currency}"` (the warm-possessive section identity).
3. **Protagonist block** (the divergence from Deliveries): label `"Saldo pendiente"` → the
   large outstanding amount in `detail-hero-amount.num` → sub `"de {total} {currency}"`
   (`detail-hero-amount-sub`) → a `progress` bar of payment → a caption
   `"{pct}% pagado · entrega estimada {fecha}"`.

**Per-state hero** (prototype anchors in parentheses):

| State                                                    | Hero treatment                                                                                                                                |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Active (`#s7-order-detail-active`)                       | Single status chip (e.g. `info` "Parcialmente en camino"); balance in default ink; progress bar `--accent`                                    |
| Overdue (`#s7-order-detail-overdue`)                     | `role="alert"` banner above + **dual chip** (status + `warning` "Atrasado Nd"); progress bar `--warning` when unpaid                          |
| Partially paid (`#s7-order-detail-partially-paid`)       | Progress between 0–100%; `--warning` progress when overdue/unpaid                                                                             |
| Completed + unpaid (`#s7-order-detail-completed-unpaid`) | **Dual chip**: `success` "Completo" (`package-check`) + `warning` "Saldo pendiente" (`alert-triangle`); hero figure and bar in `--warning`    |
| Cancelled (`#s7-order-detail-cancelled`)                 | `detail-hero` at `opacity 0.75`; `neutral` "Cancelado" (`ban`); label switches to "Total"; cancellation-reason callout (`role="note"`) if any |

**Productos subcard** (`subcard.is-open.s8-card-cool`, expanded by default): `item-row`s,
each with an item-type icon, the product name + optional subtype, an item-state chip
(`s7-istate`: `none` / `transit` / `delivered`), read-only qty, and unit price. It closes
with `"Crear entrega con estos productos"`.

### 2.3 Create (`#s7-order-create-step-1/2/3`)

A 3-step `WizardAccordion` inside `form-grid` (main wizard column + sticky `form-sidebar`
holding the reactive Resumen). One step is open at a time; "Continuar" is forward-gated by
inline validation; backward navigation is always free (`is-done` steps re-expand without
data loss). Each step is a `section-card.section-card-wizard` carrying `step-num` +
`is-active`/`is-done` state.

```
stepper      ①Datos · ②Productos y costos · ③Confirmar
step 1       Tienda (combobox) · Moneda (select) · Fecha orden · Fecha aprox. entrega (range)
step 2       OrderItemsGrid spreadsheet · "Usar este total" · Costo total · Tipo de cambio (+ "Hoy")
step 3       Resumen card (surface-elevated) + info banner "se creará en estado Abierto"
```

The **store-from-context** entry (`?storeId=…`, ADR 0001 D2) renders step 1's store as a
field-as-attribute accent container with a `"↳ DESDE TIENDA"` badge and a
`"cambiar la tienda"` inline link; the currency auto-fills from the store's default. The
**empty-stores gate** (`#s7-order-create-empty-stores`) replaces step-1's fields with a
`store`-icon empty state and a `"Crear primera tienda"` CTA.

### 2.4 Edit (`#s7-order-edit`)

**Edit is not a wizard.** It uses the **L020 all-open** pattern (parity with delivery-edit):
stacked, always-expanded `section-card`s with **static** headers (not buttons), CTA
`"Guardar cambios"` + `"Cancelar"` in a `form-footer`, and the same sticky reactive Resumen
rail (whose values render in `--warning` to signal the editing context). The **store and
currency are immutable** (`BR-05-11`): each renders as a read-only `<div>` with a `lock`
icon and an explanatory helper. Cancelling with pending changes opens the discard modal
(§5.7); the breadcrumb is the 3-level `Pedidos › ORD-… › Editar pedido`.

---

## 3. Visual treatment

Orders introduces **no new tokens, palettes, surfaces, or type ramps.** It consumes the
Velvet system as-is. This section records only how the FRD _applies_ the system; the
definitions live in [visual-foundations.md](../../../design/visual-foundations.md) and
[tokens-css.md](../../../design/tokens-css.md).

### 3.1 Color roles

| Role in this FRD                                             | Token / class                        | Where                                  |
| ------------------------------------------------------------ | ------------------------------------ | -------------------------------------- |
| Primary CTA (`Crear pedido`, `Anotar pago`, `Crear entrega`) | `--accent` (Button primary)          | wizard step 3, hero aside, action bar  |
| Hero / Acciones surface accent                               | `s8-card-accent` (top-accent border) | detail hero, Acciones card             |
| Pagos / Productos surface                                    | `s8-card-cool` (`--accent-cool`)     | Productos subcard, aside cards         |
| Private note surface                                         | `s8-card-warm` (`--accent-warm`)     | aside Tu nota privada                  |
| In-transit / partial status                                  | `--info`                             | `chip info` + `s7-istate transit`      |
| Overdue (derived) / unpaid balance                           | `--warning`                          | `chip warning` "Atrasado Nd"; hero bar |
| Completed status                                             | `--success`                          | `chip success` "Completo"; paid 100%   |
| Cancelled status                                             | `--neutral` + `--text-muted`         | `chip neutral` + dimmed hero           |
| Destructive (delete)                                         | `--destructive`                      | Button destructive-ghost, delete modal |

The **Chip-Eyebrow + Top-Accent** pattern (`s8-eyebrow-chip` + `s8-card-accent/cool/warm`)
is the system's section-identity device — see [interface-patterns.md](../../../design/interface-patterns.md).
Status color is **never** carried by color alone: every chip is icon + label
([ADR 0006](../../../design/decisions/0006-color-blindness-icon-label-contract.md)). The
unpaid signal on a `COMPLETED` order (`FR-05-35`) is therefore carried by a labelled
`warning` chip plus the `--warning` progress bar, never by the hue alone.

### 3.2 Typography

- Store names and row titles: body semibold (`font-weight 600`).
- Order identifiers `ORD-YYYYMMDD-NN` and (in Productos) delivery references: **JetBrains
  Mono** via `MonoCode` (renders in `--text-secondary`,
  [ADR 0007](../../../design/decisions/0007-text-muted-outdoor-code-mono-reassignment.md)).
- The hero outstanding balance uses the large `detail-hero-amount` ramp — the same slot
  Deliveries repurposes for an arrival range; here it carries money, the protagonist datum.
- Eyebrow chips and the `"↳ DESDE TIENDA"` badge use uppercase + wide tracking per the system.
- Numerals (totals, amounts, percentages, dates, counts) use the `.num` tabular treatment.

### 3.3 Shape, radius & elevation

Standard system values, no overrides: cards at the standard radius, pills/chips fully
rounded, border-first elevation (the system is border-led, not shadow-led). The cancelled
hero deliberately reads as "closed" via reduced opacity and a `neutral` chip rather than a
top-accent. Overlays (modals/sheets) use the system's elevated treatment via the canonical
`Modal`; the FX full-screen sheet is the documented exception under
[ADR 0008](../../../design/decisions/0008-modal-enhancement.md).

---

## 4. Components consumed

Everything below already exists in the catalog — see
[components.md](../../../design/components.md). Orders, Payments & Shipment is an
**assembly of existing components**; it must not fork or reinvent any of them.

| Component                              | Tier        | Role in FRD-05                                                                                                                                                                  |
| -------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Sidebar`, `Header`                    | module      | App shell chrome (PUSH sidebar, breadcrumbs/lang/theme topbar)                                                                                                                  |
| `StoreAvatar`                          | core        | s32 in list rows, s56 in detail hero                                                                                                                                            |
| `MonoCode`                             | core        | `ORD-…` identifiers in rows, hero, breadcrumb                                                                                                                                   |
| `StatusChip`                           | core        | Order + item status, per [ADR 0002](../../../design/decisions/0002-status-chip-mapping.md)                                                                                      |
| `CodeCopyButton`                       | core        | copy the `ORD-…` in the mobile hero                                                                                                                                             |
| `Button`                               | core        | primary / accent (tonal) / ghost / destructive-ghost hierarchy                                                                                                                  |
| `ViewTransitionLink`                   | core        | list row → detail (`view-transition-name: order-{id}`)                                                                                                                          |
| `FilterTriggerButton` + `FilterDrawer` | core/module | list filtering (`FR-05-26`); side drawer (desktop) / bottom sheet (mobile, ADR 0003 D8)                                                                                         |
| `AppliedFilterChip`                    | core        | removable active-filter chips, incl. the default "Solo activas"                                                                                                                 |
| `ListPagination` / `PerPageSelect`     | module      | desktop summary + page-size select + numbered nav / mobile summary + "Cargar más" ([ADR 0018](../../../design/decisions/0018-list-pagination-page-size-and-desktop-summary.md)) |
| `Select`                               | core        | sort, currency                                                                                                                                                                  |
| `WizardAccordion`                      | module      | 3-step create flow                                                                                                                                                              |
| `StoreCombobox`                        | module      | create store selection (+ inline "Crear nueva tienda" with `returnTo` context)                                                                                                  |
| `OrderItemsGrid`                       | module      | spreadsheet item entry (keyboard nav, drag reorder) — `FR-05-06`…`FR-05-10`, `BR-05-04`                                                                                         |
| `DateRangePickerInput`                 | core        | estimated delivery range (with quick-range presets)                                                                                                                             |
| `DateInput`                            | core        | order date, payment date                                                                                                                                                        |
| `Textarea`                             | core        | inline-editable private note, cancellation reason                                                                                                                               |
| `CollapsibleSubcard`                   | module      | Productos / Historial subcards                                                                                                                                                  |
| `AsideSummary` / `DetailSidebar`       | module      | Pagos / Acciones / Nota rail; reactive create/edit Resumen                                                                                                                      |
| `PrivateNoteCard`                      | module      | inline-editable private note (autosave on blur, ~800ms debounce — `FR-05-21`)                                                                                                   |
| `Modal` (`ModalDialog` / `ModalSheet`) | module      | pay / cancel / delete / discard / discrepancy / FX overlays — [ADR 0008](../../../design/decisions/0008-modal-enhancement.md)                                                   |
| `FxReconciliationModal`                | module      | bulk FX reconciliation grouped by currency pair (`FR-05-36`…`FR-05-38`)                                                                                                         |
| `MobilePicker`                         | module      | mobile store / currency / product-type / date-range pickers                                                                                                                     |
| `EmptyState`                           | module      | initial empty, filtered empty, no-eligible-stores                                                                                                                               |
| `Skeleton`                             | core        | list loading                                                                                                                                                                    |
| `Toast`                                | core        | payment-complete achievement, save confirmations, add-payment failure reverts                                                                                                   |
| `OrderCreateMethodSelector`            | module      | the two order-creation methods (manual / from an image), rendered inline in the initial empty state                                                                             |

Implementation contracts (not design surfaces): the `getOrdersList` / `getOrderDetail`
queries, the `pendingFxCount` derivation, `deriveOrderStatus` (`BR-05-02`), and the
payment / lifecycle / note server actions.

---

## 5. Interactions & states

### 5.1 Cross-cutting states

Owned by the system — see [states.md](../../../design/states.md) and
[ADR 0013](../../../design/decisions/0013-cross-cutting-state-system.md). FRD-05 instances:

- **Loading** (`#s7-orders-list-loading` / `#s7-orders-list-loading-mobile`): card-style
  skeletons (avatar placeholder + text bars + chip + progress placeholder), disabled
  toolbar, `aria-busy="true"`. SSR-delivered — no fake client fallback.
- **Empty, initial** (`#s7-orders-list-empty-initial`): `EmptyState appearance="card"` with the
  `PackageOpen` icon in an `accent` icon well, `"Aún no hay pedidos"`, `"Anota tu primer pedido y
empieza a seguir tus compras desde aquí."`. The action slot is **not** a single CTA: it renders
  `OrderCreateMethodSelector presentation="inline"`, so a brand-new account can reach an order from
  an image without creating a store first (`OrderListEmptyState.tsx`).
- **Empty, filtered** (`#s7-orders-list-empty-filtered`): `EmptyState appearance="card"` with the
  `SearchX` icon in a `neutral` icon well, `"Sin resultados"`, ghost CTA `"Limpiar filtros"` back to
  a bare `/orders`; toolbar and chips stay visible.

> **Mascot: deferred design intent, not a spec.** Earlier drafts of this section specified a
> `MascotBubble` in `sleeping` / `confused` variants here. No mascot sprite ever existed and the
> component has since been deleted, so those variants were never buildable. The binding rule is
> [ADR 0013 · D5](../../../design/decisions/0013-cross-cutting-state-system.md): empties mount the
> canonical icon well, never a mascot, and the `visual` slot of `EmptyState` stays reserved for a
> future mascot illustration **if and when the graphic assets are produced**. Treat any mascot copy
> below as intent awaiting assets, never as an accepted requirement.

- **No eligible stores** (`#s7-order-create-empty-stores`): `store` icon,
  `"Sin tiendas aún"`, CTA `"Crear primera tienda"` → `/stores/new`.

Route-error / 404 are system screens, not Orders-specific mocks.

### 5.2 Status-chip mapping (ADR 0002)

The list "Estado" column applies a display hierarchy (distinct from the `BR-05-02`
derivation): conditions are evaluated top-down and the first match wins.

| Condition                                            | Chip label               | Variant   | Icon             |
| ---------------------------------------------------- | ------------------------ | --------- | ---------------- |
| `CANCELLED`                                          | `Cancelado`              | `neutral` | `ban`            |
| `COMPLETED`                                          | `Completo`               | `success` | `package-check`  |
| `status != COMPLETED` + `expectedDeliveryTo < today` | `Atrasado Nd` (derived)  | `warning` | `alert-triangle` |
| `IN_TRANSIT`                                         | `En camino`              | `info`    | `truck`          |
| `PARTIALLY_IN_TRANSIT`                               | `Parcialmente en camino` | `info`    | `truck`          |
| `PARTIALLY_DELIVERED`                                | `Parcialmente entregado` | `info`    | `truck`          |
| `OPEN` + `paymentPercentage === 100`                 | `Pagado`                 | `success` | `check-circle`   |
| `OPEN`                                               | `Abierto`                | `neutral` | `clock`          |

**Secondary chip: "Saldo pendiente"** (`FR-05-35a`, added 2026-08-11). The table above picks
**one** chip, so a delivered pedido that still owes money read as a lone green "Completado". The
balance signal is therefore a **second** chip rendered beside the status chip, in the same
flex-wrap group, on both the desktop row and the mobile card: `warning` tone, `alert-triangle`,
label "Saldo pendiente" / "Outstanding balance". It is the same chip the order detail hero already
showed (`orders.detail.hero.chipUnpaid`), so a pedido reads identically on both surfaces, and it
follows the secondary-chip rule in `docs/design/interface-patterns.md` §8: a derived state sits
beside the primary status chip, never in place of it. Recolouring the status chip was the obvious
alternative and was rejected: it would have made the list lie about fulfilment to tell the truth
about money.

It fires on `COMPLETED` + `hasUnpaidBalance` only. An active pedido with a balance is the ordinary
state of nearly every row, so flagging those would paint the list amber and the chip would stop
carrying information; a `CANCELLED` pedido owes nothing whatever its total says. There is no
percentage and no bar inside it: `ADR 0025` retired those and this does not bring them back.

**Finding the flagged pedidos: "Solo con saldo pendiente"** (`FR-05-47`). A chip only helps once
the row is on screen, and 560 pedidos do not fit on one screen. The isolation door is a switch in
the **filter drawer** (section "Pago"), not a new toolbar control: the toolbar's canonical order
(`Buscar < Filtrar < Ordenar < Agrupar < Nuevo pedido`) is at its width budget, and a refinement of
a list belongs in the drawer that already holds every other refinement. It behaves like the
existing `fxPending` switch: it increments the drawer's applied-count badge and renders as a
removable "Con saldo pendiente" chip in the chips row.

Item-level chips (`s7-istate`): `transit` ("En camino"), `delivered` ("Entregado"), `none`
("Pendiente en tienda" / "Listo en tienda" depending on item delivery state).

### 5.3 Payment flow (`FR-05-17`…`FR-05-20`, `BR-05-10`)

Adding a payment is an **inline expand inside the Pagos card** on desktop
(`#s7-order-detail-pay-modal`) — the rest of the page stays visible so the collector sees
the outstanding balance while entering an amount. The amount field offers three quick-pick
`filter-pill`s: `"Todo · $X"`, `"50%"` and `"20%"`, all computed on the
**remaining balance** (never the gross total). **Revised 2026-08-14 (F1):** this used to describe
two pills, `"Saldo pendiente ($X)"` and `"Mitad ($X/2)"`; the percentage chips now carry the
percentage in the label and the resulting amount in the `aria-label` (see §"Marca de pagado" and
`FR-05-17`). When the panel is opened from the coverage-contradiction CTA it also opens with that
amount already in the field and the `"Todo"` chip pressed. A payment greater than the remaining balance
is rejected (`FR-05-19`). Deleting a `pay-row` opens a destructive confirmation modal
(`role="alertdialog"`) and is awaited — the row is removed only after the server confirms;
there is no optimistic delete and no undo toast.

**The desglose block (2026-08-15, `FR-05-52`…`FR-05-54`, [ADR 0028](../../../design/decisions/0028-order-scoped-payment-breakdown.md)).**
Between the folded date line and the submit, an order of more than one product grows a folded
disclosure, "Desglosar entre productos", which says how much of THIS payment names each product. It
is closed by default always (536 of 626 payments name nothing), and while the amount is empty its
trigger stays put with "Escribe primero el monto del pago." beside it rather than being removed: a
control that disappears and returns on the first keystroke moves the submit under the thumb. Folded
over a draft the trigger reads the whole answer, "Desglose · {count} de {total} productos ·
{amount}", where `{count}` counts the lines that will be WRITTEN and not the boxes that are ticked.

**Inert, not `disabled` (corrected 2026-08-15).** That trigger carries `aria-disabled` + a no-op
handler + `aria-describedby` at the sentence, which is what `interface-patterns.md` §14 requires and
what the same change extended to name this panel: `disabled` drops the control out of the tab order,
never reads its name, and kills the pointer events a tooltip would need, so the reason ends up
reachable by no input device. The fill control ("Máx.") takes the same treatment when nothing of the
payment is left for its line ("No queda nada de este pago por asignar.", `sr-only`, exactly as
`StorePaymentAllocationRow` does it). A real `disabled` is kept for the one state with no sentence to
lose: the submission in flight, where the whole panel is inert.

**The fold hides the lines; it never withdraws them (2026-08-15).** A folded draft is submitted just
as the trigger reads it back, and it still keeps the form mounted for the verdict. And a draft the
panel is REFUSING cannot be folded away: while the draft outruns the payment or a line outruns its
own price, the block holds itself open, because the sentence saying why and the fields that fix it
both live inside it and the submit is dead until they are. Same shape, and the same reason, as the
date disclosure unfolding itself on a date the form refuses.

Open, top to bottom: the intro line; the **pool strip** (`--info` tinted 8%, no border, only when
the order already holds money naming no product, which today is 8 of the 8 orders that reach this
panel) saying what was paid without naming a product, why nothing can therefore say what each
product owes, and how to break down an earlier payment (delete it and record it again); **the one
live figure**, "Por repartir {amount} · {pct} % del pedido", rounded to an integer and labelled
**del pedido** and never _del saldo_, because it measures the payment against the order's total while
the quick-picks above measure it against the balance; the mode chips ("Por precio" first, then
"Partes iguales") **or**, on an order with no price anywhere, one line explaining why there is no
choice; a caption naming what the current mode is doing; the product list; and a two-line foot.

**Row anatomy** — `grid-cols-[auto_1fr_auto_92px]`, `min-h-[64px]` below `md` and `min-h-[52px]`
from it:

| Zone     | Content                                                                                                                                                                          |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| col 1    | `Checkbox size="sm"` with `min-h-11`, the box **resized** rather than expanded with a pseudo-element, because the vertical neighbour is another checkbox (PLAYBOOK §4)           |
| col 2 L1 | the product's name, `line-clamp-2`, 13px                                                                                                                                         |
| col 2 L2 | its STATIC facts, joined by `·`: `S/ 40,50` / `S/ 40,50 · S/ 10,00 asignados` / `Sin precio`, plus `fijado` while pinned and `marcado` when the product already carries the mark |
| col 3    | the fill control: the word **`Máx.`**, no figure, the live amount in its `aria-label` only. Absent on a settled row                                                              |
| col 4    | `MoneyAmountInput` (`core/`, promoted out of `modules/StorePaymentSheet/` when this became its second consumer)                                                                  |

A product whose price is already covered is not offered at all: a "Saldado" chip, no checkbox, no
field, mutually exclusive with the static-facts cell. **No row prints a figure derived from the
payment**, which is [ADR 0027](../../../design/decisions/0027-allocation-list-figures-partition-never-replicate.md)'s
I-1b on this surface: a per-row ceiling is right line by line and false in aggregate, because with an
empty draft every row's ceiling is the whole payment, so ORD-20260509-03 (six products, no prices)
would advertise S/ 280,00 six times over. The foot carries two lines with two different equations,
and only the first may move: "Desglosado {A} de {P} · Sin desglosar {P − A}" (replaced wholesale by
the over-allocation error, which also names the last line touched), then "Este pedido quedará
debiendo {X}" beside "Limpiar". Extra foot lines name WHY a residual exists when it is not obvious
(products already covered, or an order total above the sum of its prices), and **at most one of them
shows**: all three print the same figure, so by price the residual is explained by the two terms of
`BR-05-24` and "los productos marcados ya no admiten más" is reserved for **partes iguales**, the
only mode that actually fills every ticked line to its ceiling.

The caption over the list follows the same discipline: "Algunos productos ya tenían pagos, así que
reciben menos" is shown only for a line the split really cut short (`quota > tope`), never for one
that lands on its ceiling exactly, which is what the closing half of an adelanto + pago final does on
every line at once.

**One layout, both breakpoints.** The desktop aside is ~300px of usable width and the mobile sheet
~327px, so there is no width at which a two-column desktop variant would be a different design; row
height and the list's own scroll ceiling (`45vh`, `340px` from `md`) are the only difference.
Marking a box re-splits N fields at once, so the panel announces itself through **one** `sr-only`
`role="status"` region debounced by `TOTALS_ANNOUNCE_DELAY_MS` (700ms, shared with the store payment
sheet), naming both foot lines because the second is the one figure a screen reader cannot rebuild by
tabbing the fields — in the words the visible foot uses, settled case included ("Este pedido queda
saldado", not "quedará debiendo S/ 0,00"). No automatic focus move: ticking splits but does not move focus, and the panel
comes after its trigger in the DOM so the next `Tab` walks in.

**Where a refusal is painted, one rule for both breakpoints** (`FR-05-42c`): the form's inline error
is authoritative and the coordinator's toast fires only when the form is already gone. A submission
with a draft therefore keeps the form up, in loading, until the server answers, marks the row the
server named with the destructive rail, and on a verdict about the amount or the date greys the CTA
until one of those two moves. The mobile surface is a `<Modal>` and the toast renders BEHIND it, so
this is not a refinement: routed the other way it is a hanging sheet with a full draft inside it and
nothing on screen saying why.

**Not built:** the prototype's celebratory achievement toast for a payment that exactly clears the
balance (`"¡Cubierto! Una pre-orden menos. ✨"`, `#achievement-toast`) has no implementation. In the
prototype its avatar is a `🐼` emoji in a `.panda-circle`, not a mascot sprite; earlier drafts of
this section described it as `MascotBubble celebrating`, a variant that never existed. If the toast
is ever built it inherits [ADR 0013 · D5](../../../design/decisions/0013-cross-cutting-state-system.md):
no mascot until the graphic assets exist. Today a payment simply updates the balance in place.

### 5.4 Lifecycle actions (`FR-05-23`, ADR 0011 — the action hierarchy)

Secondary affordances live in an inline **Acciones card** at the foot of the detail (not a
split button, not a `⋯` overflow), on both desktop and mobile.

| State            | Primary                     | Rest                                                                                                  |
| ---------------- | --------------------------- | ----------------------------------------------------------------------------------------------------- |
| Active / overdue | **Crear entrega** (`truck`) | Editar (ghost) · Ver tienda (ghost) · Cancelar (ghost) · Eliminar (destructive-ghost)                 |
| Completed        | **Crear entrega**           | Editar + Ver tienda + Eliminar; **no Cancelar** (a completed order cannot be cancelled)               |
| Cancelled        | **Reactivar pedido**        | Ver tienda (enabled); Eliminar (enabled); Editar + Crear entrega **disabled** with explanatory helper |

`Ver tienda` is never disabled by order status: it is the same store, orderable or not, so viewing it carries no lifecycle precondition. It links to the store's detail page carrying `returnTo`/`returnLabel` so that page's back link reads "Volver al pedido {orderId}" (`order_view_store_clicked`, shared with the store-name link in the hero, §2.4).

`Cancelar` and `Eliminar` share one eligibility rule (`FR-05-24`/`FR-05-25`): both are
disabled (with a `title` tooltip) when any item is linked to a non-cancelled delivery.
**Reactivate carries no modal** (reversible, `BR-05-17`): it runs directly.

### 5.5 Modals (adaptive — desktop dialog / mobile `ModalSheet`, ADR 0008)

- **Anotar pago** — desktop inline expand (§5.3); **mobile** opens a dedicated bottom sheet
  (`#s7-order-detail-pay-mobile`) with a highlighted "Saldo pendiente" panel.
- **Cancelar pedido** (`#s7-order-detail-cancel-modal`, `tone-warning`, `ban`): keeps the
  record, preserves payments/history, reversible via reactivate; optional `"Motivo
(opcional)"` textarea; footer `Volver` + `--warning` CTA `"Cancelar pedido"`.
- **Eliminar pedido** (`#s7-order-detail-delete-modal`, `tone-destructive`, `trash-2`):
  irreversible; deletes payments + history; deliveries untouched; **type-to-confirm**
  (`"eliminar"`) gates the CTA (parity desktop + mobile).
- **Importe no coincide** (`#s7-order-create-discrepancy-modal`, `tone-warning`): the
  2-option discrepancy modal (CB-02 / `FR-05-13`) — `"Volver y corregir"` /
  `"Guardar de todos modos"`; the entered total is authoritative, no auto-replace.
- **¿Salir sin guardar?** (`#s7-order-edit-discard-modal`, `tone-warning`): edit-cancel
  guard; `"Quedarse"` / `"Salir"`.
- **FX reconciliation** (`#s7-fx-reconciliation-modal`): bulk update grouped by currency
  pair with a "Hoy" prefill per group and a defer option (`FR-05-38`); renders as a
  full-screen sheet on mobile (`#s7-fx-reconciliation-mobile`).

### 5.6 Optimistic behavior & motion

All mutations are **optimistic** — see the `optimistic-client-updates` policy and
[motion.md](../../../design/motion.md):

- Payment add/delete and lifecycle changes update the hero/ledger locally and revert with a
  toast on failure (the parent coordinator owns rollback). The private note is the
  documented exception (`FR-05-21`): it waits for server confirmation before showing
  `"Guardada hace Ns"`.
- Modal/sheet flows close **synchronously** on submit (Optimistic Confirmation).
- List row → detail and create-confirm → detail use **View Transitions** keyed
  `order-{id}` (the row's `view-transition-name` matches the detail hero); the create
  confirm card uses `order-create-confirm`.
- Within the wizard, only one step is expanded; advancing animates the accordion.

> Note: the prototype approximates View Transitions with a CSS fade+slide and runs the
> mascot walk continuously; the canonical View Transitions API
> ([ADR 0014](../../../design/decisions/0014-motion-system-and-view-transitions.md)) and the
> mascot cooldown are implementation concerns, not design changes.

### 5.7 Removed-store tombstone (`FR-04-42`, `AC-04-22`)

This is the order-side render of a cross-FRD requirement whose store-side lifecycle
(`REJECTED` status + `Store.removalReason`) is owned by
[FRD-04 · BP-01 · WO-09](../../frd-04-store-domain/bp-01-store-public-trust-system/work-orders/wo-09-store-approval-and-removal.md)
and delivered here by
[BP-02 · WO-08](bp-02-order-workspace-and-list-experience/work-orders/wo-08-order-side-removed-store-tombstone.md).
[FDD-04](../../frd-04-store-domain/fdd-04-store-domain.md) deferred the exact order-row pixel
to this FDD because a `REJECTED` store is a **collector-order** surface, not a store surface
(the store detail route 404s and no store-detail tombstone screen exists).

Presentation **accompanies** the store name, it does not replace it: the store row is
retained by the tombstone, so the historical `store.name` stays visible as plain text and a
marker is added next to it. This preserves the collector's "who did I buy from" context
across a list of orders spanning many stores.

| Surface                     | Marker treatment                                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `OrderCard` (mobile list)   | Compact inline marker beside the name: lucide icon + core `Tooltip` with the full message + screen-reader text |
| `OrdersTable` row (desktop) | Same compact inline marker beside the name                                                                     |
| `OrderDetailHero`           | Fuller inline line under the store `<h1>`: neutral rendered muted, sanction rendered in `--warning` tone       |
| `OrderDetailContent`        | Pass-through: threads `store.status` + `store.removalReason` to the hero; no store link to hide today          |

Variant selection is neutral by default and sanction only for the abuse category, driven by
`isSanctionRemovalReason(store.removalReason)` via the shared `resolveStoreTombstone` helper.
The order side **never re-classifies** removal reasons; it consumes the value WO-09 persisted.
The two variants use distinct lucide icons, each with an `aria-label`, so the state is never
color-only (ADR 0006), and the hero message is real, announceable text.

Presentation is a small route-level `StoreTombstoneNotice`
(`orders/_components/share/`, `variant: "compact" | "full"`) reading `useTranslations("stores")`.
It is intentionally **not** mocked in the FRD-05 prototype (which predates this record); it is
reconstructible from this section plus the copy row in §6. The delivery and dashboard surfaces
that also render a store name are a documented sibling follow-up (they would show a stale name
for a removed store) and will reuse the same helper and copy; `FR-04-42` itself is scoped to
collector orders.

---

## 6. Copy & voice

Voice is constant and tone is per-surface — see [ux-copy.md](../../../design/ux-copy.md)
and the workshop voice library. FRD-05 keeps the canonical glossary (`pedido ↔ order`,
`tienda ↔ store`, `entrega ↔ delivery`) — see [glossary.md](../../glossary.md). Strings
live in `src/i18n/locales/{es,en}/orders.json` (list copy under `orderListing`).

Key strings (es), by surface and tone:

| Surface                            | Tone                    | String                                                                                                                              |
| ---------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| List heading meta                  | neutral, factual        | `"{active} activos · {closed} cerrado"`                                                                                             |
| List search placeholder            | helpful                 | `"Código o producto (ORD-20260428-01, Evangelion OST…)"`                                                                            |
| Hero eyebrow                       | warm-possessive         | `"Tu pedido · {currency}"`                                                                                                          |
| Hero balance label                 | factual                 | `"Saldo pendiente"` / `"de {total} {currency}"`                                                                                     |
| Hero progress caption              | reassuring              | `"{pct}% pagado · entrega estimada {date}"`                                                                                         |
| Payment success (full)             | celebratory-restrained  | `"¡Cubierto! Una pre-orden menos. ✨"`                                                                                              |
| Overdue banner                     | alerting                | `"Atrasado {days} días"` · `"Estimado el {date} · aún sin entrega confirmada"`                                                      |
| Private note placeholder           | inviting                | `"Escribe una nota o recordatorio para este pedido…"`                                                                               |
| FX banner                          | confidence-building     | `"Tienes {count} pedidos con el tipo de cambio desactualizado. Actualízalos para que tus reportes reflejen tu moneda base actual."` |
| Empty (initial)                    | encouraging             | `"Aún no hay pedidos"`                                                                                                              |
| Empty (filtered)                   | neutral                 | `"Sin resultados"`                                                                                                                  |
| No eligible stores                 | explanatory             | `"Sin tiendas aún"`                                                                                                                 |
| Edit, immutable store              | explanatory             | `"La tienda no se puede cambiar una vez creado el pedido."`                                                                         |
| Discrepancy modal title            | factual                 | `"Importe no coincide"`                                                                                                             |
| Delete confirm body                | concrete                | `"Se eliminarán también los pagos y el historial asociados. Las entregas vinculadas no se verán afectadas."`                        |
| Removed-store tombstone (neutral)  | factual, non-accusatory | `"Esta tienda ya no está disponible."`                                                                                              |
| Removed-store tombstone (sanction) | firm, non-accusatory    | `"Esta tienda fue retirada por incumplir nuestras políticas."`                                                                      |

The two removed-store tombstone strings (§5.7) live in `src/i18n/locales/{es,en}/stores.json`
under a dedicated `orderTombstone` group, not in `orders.json`: the copy is store-semantic,
the neutral wording already exists store-side, and the order list and detail surfaces read
different namespaces (`orderListing` and `orders`), so a single store-namespace home avoids a
duplicated key. The exact sanction wording is subject to copywriting review; the neutral vs
sanction split is fixed by `Store.removalReason`. See
[WO-08](bp-02-order-workspace-and-list-experience/work-orders/wo-08-order-side-removed-store-tombstone.md).

Tone rule for this FRD: **confirmations and errors carry no mascot** (decálogo #6); the
panda appears only in the celebratory/empty register (sleeping/confused empty states, the
payment-complete toast) — never on cancel, delete, reactivate, or error.

---

## 7. Responsive

Mobile-first; desktop is extra room (decálogo #10). Breakpoint behavior is the system's —
see [interface-patterns.md → Responsive](../../../design/interface-patterns.md). FRD-05
specifics:

- **List → cards** (`#s7-orders-list-mobile`): the tabular rows collapse into vertical
  `s7-order-card`s (avatar, store title, `{fecha del pedido}`, status chip, the expected-arrival
  line stacked under it (`llega …` / `esperada …` in `--warning`, omitted on a terminal order),
  status chip, progress bar, meta `"N productos · X% pagado · $total"`). The order code is not on the card;
  see the 2026-08-05 decision under Desktop columns. The page action row is a sticky search +
  icon-only `FilterTriggerButton` (with count badge) + `[+ Nuevo]`; chips stay removable; a
  per-card `s7-mob-card-expand-row` chevron expands items inline; footer is `"Cargar más"`.
  Tapping the card navigates to detail.
- **Detail → stacked** (`#s7-order-detail-mobile`): hero → state-aware subcards (Productos
  open; Pagos open when balance > 0, closed otherwise; Nota closed; **Historial omitted on
  mobile**) → inline Acciones card → **sticky single-primary action bar**. The primary sits
  on the right and is the highest-frequency action per state (payment over delivery); the bar
  carries **no `⋯`**. The bar background uses `color-mix(in oklab, …)` + blur — **`oklab`,
  not `oklch`** (lesson L074); the scroll container gets bottom padding so it never occludes
  content.
- **Create → mobile wizard** (`#s7-order-create-mobile`, `…step-2/3-mobile`): a compact
  `"Paso X de 3 · {paso}"` eyebrow + segmented progress bar; locked future steps use a
  `lock` icon (not opacity); sticky footer `[Atrás] [Continuar →]`. Store/currency/
  product-type/date pickers open dedicated `MobilePicker` sheets; the order-date field uses
  the native `<input type="date">`; add/edit product opens a bottom sheet.
- **Modals → sheets**: pay, cancel, delete, discard, discrepancy render as `ModalSheet`
  (vaul) on mobile; the FX flow renders as a full-screen sheet.

Known issue inherited at the list level: the mobile action row can overflow the viewport by
a few pixels at ~390px (tracked in the FRD).

---

## 8. Accessibility (FRD-05 specifics)

Baseline is WCAG 2.2 AA in both themes (decálogo #8). System-wide a11y rules live in
[interface-patterns.md → Accessibility](../../../design/interface-patterns.md). What
matters specifically here:

- **Status never by color alone**: every order/item chip is icon + label
  ([ADR 0006](../../../design/decisions/0006-color-blindness-icon-label-contract.md)); the
  `COMPLETED`-but-unpaid case is a labelled `warning` chip, not a hue.
- **Expandable rows & subcards**: `aria-expanded` + `aria-controls` on the toggle; expansion
  is keyboard-operable; the desktop chevron is `align-self: start` (L059).
- **Overdue banner**: `role="alert"`, announced on load.
- **Progress bar**: `role="progressbar"` with `aria-valuenow/min/max` and an `aria-label`.
- **Disabled actions explain themselves**: cancelled-state Editar/Crear entrega keep
  `disabled` + `aria-disabled="true"` plus a textual reason; delete/cancel eligibility
  tooltips state why (`FR-05-24`/`FR-05-25`).
- **Modals**: `role="dialog"` / `alertdialog` + `aria-modal` + `aria-labelledby`; the
  type-to-confirm delete input is a real labelled field; focus returns to the trigger on close.
- **Payment form**: `aria-label="Formulario de nuevo pago"`; per-field labels; errors via
  `aria-describedby`; the pay-row delete control names the amount and date.
- **Copy button**: the mobile hero `ORD-…` copy control has an accessible label.
- **Spreadsheet**: `role="grid"` / `gridcell` with descriptive input `aria-label`s and
  documented keyboard navigation/reorder shortcuts.
- **Note autosave**: the `"Guardada hace Ns"` indicator is `aria-live="polite"`; the undo
  toast is a `status` region with a focusable "Deshacer" button.
- **FX banner**: `role="status"` + `aria-live="polite"`.

---

## 9. Sources & provenance

- **Pixel truth**: [`./prototype/order-payment-shipment.html`](./prototype/order-payment-shipment.html)
  (self-contained; opens standalone in light + dark; default palette Velvet). 55 sections,
  including a few superseded 5-step-wizard anchors retained for provenance (see §1). Verified S15.
- **System rules**: [`docs/design/`](../../../design/README.md) — visual-foundations,
  tokens-css, interface-patterns, components, motion, states, ux-copy, and ADRs
  0001/0002/0003/0006/0007/0008/0011/0013/0014.
- **Functional contract**: [`frd-05-order-payment-shipment.md`](./frd-05-order-payment-shipment.md)
  and its blueprints/work-orders (`bp-01-order-domain-foundation`,
  `bp-02-order-workspace-and-list-experience`).
- **Workshop raw material (historical)**: distilled from the redesign subproject; see git history. This FDD + the
  prototype are the durable record.
