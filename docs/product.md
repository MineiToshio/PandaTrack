# PandaTrack overview

PandaTrack is a web app for tracking purchases and collectible items. It helps users keep everything organized from the moment they discover a store to the day an item arrives and is added to their collection.

It’s built for collectors who love the thrill of buying—but are tired of the chaos that comes after.

---

## The problem PandaTrack solves

Collecting is fun: browsing, comparing shops, finding that rare piece, and finally pulling the trigger.  
The chaos starts later.

When you buy frequently (and from multiple places), your orders end up scattered across channels: Instagram, Facebook, WhatsApp, emails, and different websites. Finding a single order becomes a mini investigation. It’s easy to forget what you bought—or even buy the same thing twice because you can’t remember where you ordered it.

Then comes the uncertainty: some sellers don’t provide clear updates, tracking links get lost, and shipments go silent for weeks. You’re left wondering what’s still on the way, what already arrived, and what’s delayed—until a package shows up unexpectedly.

And if you buy pre-orders, the payment pain is real. Paying 10%, 20%, or 50% upfront feels light… until the remaining balances stack up and hit in the same month. Without a clear view of what’s coming and what you still owe, budgeting gets messy—and surprise payments happen.

PandaTrack brings everything into one place: what you bought, where you bought it, what’s in transit, what’s delivered, and what you’ll need to pay next—so collecting stays exciting, not stressful.

---

## Who PandaTrack is for

PandaTrack is a perfect match if you:

- Buy collectibles across multiple stores and channels (IG/FB/WhatsApp/web/email invoices).
- Have several orders in progress at the same time (especially pre-orders).
- Want to know what’s arriving soon and what you still need to pay—without digging through chats.
- Care about having a clean purchase history (and avoiding duplicate buys).

---

## What PandaTrack helps you achieve

- **One source of truth** for all purchases, orders, and shipments.
- **Clarity at a glance**: what’s pending, what’s in transit, what’s delivered, what’s delayed.
- **Budget confidence**: understand upcoming balances so payments don’t catch you off guard.
- **Less mental load**: collecting feels fun again because tracking is organized.

---

## Core features (full vision)

- Store database
- Purchase tracking
- Shipment tracking
- Collection management
- Wishlist

---

## MVP focus (what comes first)

The first version prioritizes the “buy → wait → receive” workflow:

1. **Stores**: keep a clean list of where you buy (links, notes, channels, reliability).
2. **Purchases & orders**: track what you bought, status, and key details.
3. **Shipments**: track what’s on the way and what’s delayed.
4. **Dashboard**: see everything clearly in one place (and avoid forgetting orders).

Collection management and wishlist come after the tracking foundation is strong.

---

## Key workflows

### 1) Save a store

- Add store name + channel (Instagram / WhatsApp / Facebook / website)
- Add links, contact info, notes (e.g., “slow replies”, “good packaging”)

### 2) Track a purchase

- Item name, price, currency, date
- Status (ordered / paid / shipped / delivered)
- Notes, attachments/links (invoice, conversation link)

### 3) Track shipment progress

- Carrier + tracking code (when available)
- Estimated arrival (if known)
- Delivery status timeline

### 4) Pre-order and payment planning

- Track deposits vs remaining balance
- See what payments are coming up soon
- Avoid surprise “pay the rest” messages

---

## Dashboard (what it should answer instantly)

- What’s **pending**? (needs payment, confirmation, or follow-up)
- What’s **in transit**? (on the way, delayed, unknown status)
- What’s **delivered**? (ready to add to collection)
- What do I still **owe**? (upcoming balances and totals)
- Where am I buying the most? (stores and spend patterns)

---

## Content & positioning for the Landing App (Coming Soon)

The landing is designed as a “what’s coming” page with one main CTA:

- **Waitlist signup**: “Leave your email and we’ll notify you when PandaTrack launches.”

The goal is to make collectors instantly feel:

- “This is me.”
- “This solves my chaos.”
- “I want early access.”

A strong “user fit” section is essential to spark recognition:

- Purchases scattered across channels
- Uncertainty about what’s in transit
- Surprise payments from stacked pre-orders

---

## Product architecture (public vs private)

- **Landing App**: public-facing marketing site (waitlist, explanation, visuals).
- **Admin App**: private area to manage content and product configuration.

---

## Tech stack (current plan)

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Prisma ORM
- Postgres (Neon)
- Vercel

---

## Principles (what “good” looks like)

- **Fast and simple**: collecting is emotional; tracking should be frictionless.
- **Scannable UI**: dashboards and lists that answer questions in seconds.
- **Centralized truth**: no more searching across chats, emails, and screenshots.
- **Collector-first**: built around real behaviors (pre-orders, multiple sellers, long waits).

---

## Roadmap (high level)

### Phase 1 — Tracking foundation (MVP)

- Stores
- Purchases/orders
- Shipment tracking
- Dashboard

### Phase 2 — Collector layer

- Collection management (what you own, metadata, value over time)
- Wishlist

### Phase 3 — Power features (optional)

- Advanced analytics
- Smarter reminders and follow-ups
- Better organization for large collections

---
