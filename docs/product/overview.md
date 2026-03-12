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

## Current product shape

PandaTrack is currently structured around two complementary layers:

- A public experience that explains the product, builds trust, and gives people a clear entry point into the app
- A private account experience where collectors will manage their orders, payments, shipments, and account activity

The public foundation already covers the essentials needed to present the product clearly:

- Landing and positioning pages
- Localized experience in Spanish and English
- Legal pages for privacy and terms
- Search/social-sharing foundations so public pages are easy to discover and share

The account foundation is now taking shape around a secure collector workspace:

- Sign up and sign in flows
- Protected private access for account-based product areas
- Email verification lifecycle and account protection rules
- Account recovery for people who forget their password
- A planned collector workspace shell centered on dashboard-first navigation and a reusable private app layout

This means PandaTrack is moving from a pre-release marketing experience into a usable product shell with identity, access, and recovery basics in place.

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

## Product capabilities tracked today

From the current product and planning work, PandaTrack now groups its capabilities into these areas:

- Public product presence: landing, localized messaging, legal trust pages, and SEO/shareability
- Product measurement and reliability: analytics for meaningful interactions and error monitoring for unexpected failures
- Account access: sign up, sign in, sign out, route protection, email verification, and password recovery
- Quality foundation: a risk-based automated testing strategy is now part of delivery planning so critical landing and account flows gain unit, integration, and end-to-end coverage over time
- Collector workspace foundation: the next major layer now includes the private app shell, dashboard-first navigation, and the shared layout needed to make the workflow understandable
- Collector workflow foundation: the next major layer remains centered on stores, purchases, pre-order payments, shipments, and dashboard clarity

At a product level, this means the app already covers the outer layer of trust, discovery, and access, while the core tracking workflow remains the next major delivery focus.

That next phase now has a clearer product surface: PandaTrack is moving toward a private collector workspace where the dashboard acts as the home base, navigation stays stable across the app, and module-level searches live within the relevant product areas instead of the global header in MVP.

## MVP focus

The first version prioritizes the workflow:
`discover -> buy -> wait -> receive`

Priority order:

1. Store discovery and trust signals
2. Purchase and item tracking
3. Pre-order payment tracking
4. Shipment tracking (including split shipments)
5. Dashboard clarity

## What is already in place vs. what comes next

Already in place or substantially defined:

- Product positioning and public landing
- Locale support for the public app
- Privacy and terms pages
- SEO and social preview foundations
- Product analytics and monitoring foundations
- Account access baseline
- Email verification and recovery planning

Next major user value to deliver:

- A reusable collector workspace shell with a hybrid desktop sidebar, content header, and responsive navigation patterns
- A dashboard-first private experience that makes the main product areas easy to reach
- Store discovery and trust signals inside the product workflow
- Purchase and item tracking
- Pre-order payment visibility
- Shipment tracking and split-shipment handling
- A dashboard that answers the most important status and money questions quickly

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
- A private workspace that feels controlled, rewarding, and easy to grow into

## Related docs

- `docs/product/vision-and-problem.md`
- `docs/product/mvp-scope.md`
- `docs/product/workflows.md`
- `docs/product/collector-workspace-layout.md`
- `docs/product/landing-and-positioning.md`
- `docs/product/roadmap.md`
