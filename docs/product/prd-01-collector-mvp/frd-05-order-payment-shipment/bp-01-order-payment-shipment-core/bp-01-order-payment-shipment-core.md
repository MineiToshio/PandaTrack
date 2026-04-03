---
id: BP-01
type: BLUEPRINT
slug: order-payment-shipment-core
title: Order, Payment, and Shipment Core
status: DRAFT
parent: FRD-05
children:
  - WO-01
  - WO-02
  - WO-03
  - WO-04
last_updated: 2026-04-03
implementation_status: PLANNED
---

# BP-01 Order, Payment, and Shipment Core

## Purpose

Organize the core tracking domain for orders, payments, and shipments into a system that can later feed the dashboard and reminders.

## System Intent

- orders are the main tracked user commitment
- payment records explain financial progress
- shipments explain delivery progress
- item links explain partial resolution

## Structural Priorities

1. settle terminology and entity shape
2. settle money and conversion model
3. settle item-link model
4. settle shipment grouping rules

## Linked Work Orders

- `work-orders/wo-01-order-terminology-and-entity-alignment.md`
- `work-orders/wo-02-order-and-payment-model-refinement.md`
- `work-orders/wo-03-shipment-item-link-model.md`
- `work-orders/wo-04-exchange-rate-and-conversion-strategy.md`
