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
- Prefer planning your spending and avoiding “payment out of nowhere” moments.

---

## What PandaTrack helps you achieve

- **One source of truth** for all purchases, orders, and shipments.
- **Clarity at a glance**: what’s pending, what’s in transit, what’s delivered, what’s delayed.
- **Budget confidence**: understand upcoming balances so payments don’t catch you off guard.
- **Less mental load**: collecting feels fun again because tracking is organized.
- **Safer buying**: discover stores and use community feedback to reduce risk.

---

## Core features (full vision)

- Store database + discovery
- Store reviews / community feedback
- Purchase tracking (items, status, dates)
- Pre-order & payment tracking (deposits vs remaining balance)
- Shipment tracking (including multiple shipments per order)
- Dashboard (status + spending + upcoming payments)
- Reminders & follow-ups (payments, long pre-orders, seller updates)
- Budgeting (monthly budget + alerts)
- Collection management (later)
- Wishlist (later)

---

## MVP focus (what comes first)

The first version prioritizes the “discover → buy → wait → receive” workflow:

1. **Stores (database + discovery)**: find and save stores by collecting category (manga, figures, funkos, TCG, etc.).
2. **Trust signals**: store feedback/reviews so users can buy with more confidence.
3. **Purchases & orders**: track what you bought, item list, status, and key details.
4. **Pre-orders & payments**: deposits vs remaining balance, plus upcoming payments by month.
5. **Shipments**: track what’s on the way and what’s delayed (including partial shipments).
6. **Dashboard**: see everything clearly in one place (status + upcoming payments + totals).

Collection management and wishlist come after the tracking foundation is strong.

---

## Key workflows

### 1) Discover & save a store

- Browse stores by category (manga, funkos, figures, TCG, etc.)
- View community feedback / reliability signals
- Save store name + channel (Instagram / WhatsApp / Facebook / website)
- Save links, contact info, notes (e.g., “slow replies”, “great packaging”)

### 2) Track a purchase (with item list)

- Assign a store (e.g., “Kenshin Store”)
- Add multiple items inside a single purchase (e.g., 5 manga volumes)
- Price per item, currency, purchase date
- Expected arrival window (optional)
- Notes, attachments/links (invoice, conversation link)

### 3) Pre-order & payment tracking

- Track partial payments (10%/20%/50% deposits + remaining balance)
- See total paid vs remaining due per purchase
- View upcoming payments by month (so nothing catches you off guard)

### 4) Shipment tracking (including split shipments)

- A single purchase/order can generate multiple shipments:
  - Example: “3 items arrived—ship now or wait for the rest?”
- Track shipments per order and mark what’s:
  - waiting at store / shipped / in transit / delivered
- Carrier + tracking code when available
- Delivery status timeline

### 5) Reminders & follow-ups

- Reminders to:
  - ask for an update (especially on long pre-orders)
  - prepare for upcoming payments
  - follow up when a shipment is silent for too long

### 6) Budget setup (optional, but powerful)

- Set a monthly budget
- Alerts when approaching the limit (e.g., 80–90%)
- Keep collecting fun while staying in control

---

## Dashboard (what it should answer instantly)

- What’s **pending**? (needs payment, confirmation, or follow-up)
- What’s **in transit**? (on the way, delayed, unknown status)
- What’s **delivered**? (ready to add to collection)
- What do I still **owe**? (remaining balances + upcoming payments by month)
- What’s my **monthly outlook**? (e.g., March: 50, April: 100, May: 0)
- Where am I buying the most? (stores and spend patterns)
- Am I close to my **budget**?

---

## Content & positioning for the Landing App (Coming Soon)

The landing is designed as a “what’s coming” page with one main CTA:

- **Waitlist signup**: “Leave your email and we’ll notify you when PandaTrack launches.”

The goal is to make collectors instantly feel:

- “This is me.”
- “This solves my chaos.”
- “I want early access.”

### Key landing sections (current plan)

- **Hero** (waitlist form immediately visible)
- **User fit / recognition** (“Is PandaTrack right for me?”)
  - Purchases buried in chats/screenshots
  - Uncertainty about what’s on the way
  - Surprise payments from pre-orders
- **Value-focused Features** (not repeating the user-fit pain)
  - “Todo tu coleccionismo, en un solo sistema”
  - Trusted stores, clean purchase history, pre-orders without surprises, shipments under control
  - Reminders + budgeting as supportive layer
- **FAQs**
- **Final waitlist CTA**

---

## Product architecture (public vs private)

- **Landing App**: public-facing marketing site (waitlist, explanation, visuals).
- **Admin App**: private area to manage content and product configuration.

Content approach (current plan):

- Landing content stored in a single JSON field (generated/edited from Admin App).
- Landing App consumes the JSON to render sections.

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
- **Collector-first**: built around real behaviors (pre-orders, multiple sellers, long waits, split shipments).
- **Trust & clarity**: store feedback + upcoming payments to reduce risk and stress.

---

## Roadmap (high level)

### Phase 1 — Tracking foundation (MVP)

- Store database + discovery
- Store feedback / reviews (initial version)
- Purchases/orders (with item list)
- Pre-orders & payment tracking (upcoming payments by month)
- Shipment tracking (including split shipments)
- Dashboard (status + totals + monthly outlook)
- Reminders (basic)

### Phase 2 — Collector layer

- Collection management (what you own, metadata, value over time, photos)
- Wishlist

### Phase 3 — Power features (optional)

- Advanced analytics
- Smarter reminders and follow-ups
- Better organization for large collections
