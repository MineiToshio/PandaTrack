# PandaTrack Overview

PandaTrack is a web app for tracking purchases and collectible items. It helps users keep everything organized from the moment they discover a store to the day an item arrives and is added to their collection.

It is built for collectors who love the thrill of buying but are tired of the chaos that comes after.

## The problem PandaTrack solves

Collecting is fun: browsing, comparing shops, finding rare pieces, and finally buying.
The chaos starts later.

When users buy frequently across multiple channels, order details get fragmented across Instagram, Facebook, WhatsApp, emails, and different websites. This creates:

- Friction when searching past orders
- Duplicate-buying risk
- Lost tracking links and unclear shipping status
- Budget stress from stacked pre-order balances

PandaTrack centralizes purchases, payments, shipments, and store context so collecting stays exciting instead of stressful.

## Who PandaTrack is for

PandaTrack is designed for collectors who:

- Buy across multiple stores/channels
- Manage multiple active orders at once
- Need clarity on arrivals and outstanding balances
- Want a clean history and fewer surprises
- Prefer predictable spending and fewer missed follow-ups

## What PandaTrack helps users achieve

- One source of truth for purchases, orders, and shipments
- At-a-glance status visibility (pending, in transit, delivered, delayed)
- Better payment planning (paid vs remaining + monthly outlook)
- Lower mental overhead for order management
- Better buying confidence through store trust signals

## Core features (full vision)

- Store database and discovery
- Store reviews/community trust signals
- Purchase tracking (items, status, dates)
- Pre-order payment tracking (deposits vs remaining balance)
- Shipment tracking (including split shipments)
- Dashboard (status, spending, upcoming payments)
- Reminders and follow-ups
- Budgeting support
- Collection management (later)
- Wishlist (later)

## MVP focus

The first version prioritizes the workflow:
`discover -> buy -> wait -> receive`

Priority order:

1. Store discovery and trust signals
2. Purchase and item tracking
3. Pre-order payment tracking
4. Shipment tracking (including split shipments)
5. Dashboard clarity

## Product architecture

- Landing App: public marketing/waitlist experience
- Admin App: private management area for content/configuration

Current content strategy:

- Landing content managed centrally and rendered by the Landing App

## Tech stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Prisma ORM
- Postgres (Neon)
- Vercel

## Principles

- Fast and simple interactions
- Scannable, decision-ready UI
- Centralized and reliable data
- Collector-first behavior modeling
- Trust and clarity in key decisions

## Related docs

- `docs/product/vision-and-problem.md`
- `docs/product/mvp-scope.md`
- `docs/product/workflows.md`
- `docs/product/landing-and-positioning.md`
- `docs/product/roadmap.md`
