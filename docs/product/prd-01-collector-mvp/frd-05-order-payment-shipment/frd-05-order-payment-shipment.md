---
id: FRD-05
type: FRD
slug: order-payment-shipment
title: Order, Payment, and Shipment
status: DRAFT
parent: PRD-01
children:
  - BP-02
last_updated: 2026-03-21
source_features:
  - FUTURE-ORDER-CORE
implementation_status: PLANNED
---

# FRD-05 Order, Payment, and Shipment

## Purpose

Define the minimum agreed requirements for the MVP tracking core beyond stores. This FRD captures confirmed decisions now and leaves clearly labeled open questions for later refinement.

## Terminology

- primary term: `Order`
- alias policy: `Purchase` should not be the primary product term going forward
- product meaning: an `Order` is the main tracked transaction unit in PandaTrack

## Functional Requirements

- `FR-05-01`: The system must use `Order` as the primary tracked transaction entity.
- `FR-05-02`: An order must belong to exactly one store.
- `FR-05-03`: An order must support one or more order items.
- `FR-05-04`: An order must store a transaction currency selected by the user.
- `FR-05-05`: All direct payment records attached to an order must preserve the order currency as the original transaction currency.
- `FR-05-06`: An order must support an expected delivery date range.
- `FR-05-07`: An order must support a final delivery date representing when the product arrived.
- `FR-05-08`: The system must distinguish order status from payment status.
- `FR-05-09`: The system must support partial delivery outcomes at the order level.
- `FR-05-10`: Users must be able to record payments against any order type, including pre-orders.
- `FR-05-11`: Payment status must be independent from order fulfillment status.
- `FR-05-12`: The system must support multiple payment events over time for one order.
- `FR-05-13`: The system must store both the transaction amount and the converted base-currency amount for reporting.
- `FR-05-14`: The system must store the exchange-rate context used for the conversion at the time of payment.
- `FR-05-15`: Dashboard reporting must be able to use converted base-currency values.
- `FR-05-16`: A shipment must belong to exactly one store.
- `FR-05-17`: A shipment may contain items from multiple orders.
- `FR-05-18`: A shipment must never contain items from different stores.
- `FR-05-19`: The system must support linking shipments to specific order items.
- `FR-05-20`: Shipment tracking must allow a store-level shipment to resolve multiple order-item deliveries.

## Order Status Model

- `ORDERED`
- `PARTIALLY_DELIVERED`
- `COMPLETED`
- `CANCELLED`

## Payment Status Model

- `UNPAID`
- `PARTIALLY_PAID`
- `PAID`
- `REFUNDED`
- `CANCELLED`

## Shipment Status Model

### Confirmed

- `IN_TRANSIT`
- `DELIVERED`
- `CANCELLED`

### Deferred possibilities

- `WAITING`
- `DELAYED`
- `LOST`

## Multi-Currency Rules

- `BR-05-01`: Each user must define a base currency in settings.
- `BR-05-02`: Each order must define its transaction currency.
- `BR-05-03`: Each payment record must preserve the original amount and original currency.
- `BR-05-04`: Each payment record must also preserve the converted amount in the user's base currency.
- `BR-05-05`: The conversion must be tied to the exchange rate used on that payment date.
- `BR-05-06`: Dashboard totals should use the converted base-currency values.

## Confirmed

- order and purchase are the same domain concept
- `Order` is the preferred canonical term
- order status and payment status are separate
- shipments may span multiple orders from one store only
- attachments are out of MVP

## Open Questions

- exact exchange-rate source is not yet defined
- it is not yet decided whether conversion is stored on the order only, on each payment only, or on both
- it is not yet decided how refunds interact with converted totals in monthly budget reporting
- it is not yet decided whether orders can change currency after creation
- it is not yet decided whether final delivery date is order-level only or may also be item-level

## Linked Blueprints

- `docs/product/prd-01-collector-mvp/frd-05-order-payment-shipment/bp-02-order-payment-shipment-core/bp-02-order-payment-shipment-core.md`
