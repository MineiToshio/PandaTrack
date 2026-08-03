# PandaTrack

**Organize orders, pre-orders, payments, and shipments in one place.**

PandaTrack is a web app for collectors who buy across multiple stores and channels. It turns scattered orders, tracking links, and upcoming payments into a single source of truth so collecting stays fun instead of chaotic.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [Internationalization](#internationalization)
- [Documentation](#documentation)

---

## Features

PandaTrack is one product with two durable surfaces: a public landing and an authenticated collector app. Both are shipped and in active use; neither is a placeholder for the other.

### Public landing

- **Marketing site**: Hero, features, and FAQ, with SEO and localized OG images.
- **i18n**: Spanish (default) and English with locale-based routing (`/es`, `/en`).
- **Theme**: Light and dark mode with persistent preference.
- **Analytics**: PostHog for key interactions.
- **Monitoring**: Sentry for error tracking.
- **Legal**: Terms and Privacy pages.

### Collector app

Authenticated workspace for collectors who buy across many stores and channels:

- **Account access**: Sign up, sign in (email/password and Google), password recovery, and email verification.
- **Stores**: Store directory with trust signals, categories, and both merchant and person sellers.
- **Orders & pre-orders**: Track items, status, and dates per order, including deposit vs remaining-balance payment tracking for pre-orders.
- **Deliveries**: Track shipments, including split shipments across multiple deliveries per order.
- **Dashboard**: Status, upcoming payments, and totals at a glance.
- **Settings**: User preferences, including base currency for cross-store totals.

See [docs/product/README.md](docs/product/README.md) for the product-documentation tree and the source of truth for scope — [docs/product/prd-01-public-landing/prd-01-public-landing.md](docs/product/prd-01-public-landing/prd-01-public-landing.md) and [docs/product/prd-02-collector-app/prd-02-collector-app.md](docs/product/prd-02-collector-app/prd-02-collector-app.md).

---

## Tech stack

| Area       | Technology                   |
| ---------- | ---------------------------- |
| Framework  | Next.js 16 (App Router)      |
| Language   | TypeScript                   |
| Styling    | Tailwind CSS v4              |
| i18n       | next-intl                    |
| Database   | PostgreSQL (Neon) + Prisma 7 |
| Validation | Zod                          |
| Analytics  | PostHog                      |
| Monitoring | Sentry                       |
| Deployment | Vercel (intended)            |

---

## Prerequisites

- **Node.js** 20+
- **npm** (or pnpm/yarn)
- **PostgreSQL** (e.g. [Neon](https://neon.tech) or local)
- **Environment variables**: Copy `.env.example` to `.env` and set your values (database URL, optional PostHog/Sentry keys for analytics and errors).

---

## Getting started

### 1. Clone and install

```bash
git clone <repository-url>
cd pandatrack
npm install
```

### 2. Environment

Create a `.env` file from the example and configure at least the database URL:

```bash
cp .env.example .env
# Edit .env and set DATABASE_URL and any optional keys (PostHog, Sentry).
```

### 3. Database

Generate the Prisma client and sync the schema (development):

```bash
npm run db-push
```

For a clean reset (drops data):

```bash
npm run db-reset
```

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app will redirect to the default locale (e.g. `/es`). Use `/en` for English.

---

## Scripts

| Command                      | Description                                                          |
| ---------------------------- | -------------------------------------------------------------------- |
| `npm run dev`                | Start Next.js dev server                                             |
| `npm run build`              | Full deploy build: Prisma generate + migrate deploy + Next.js build  |
| `npm run validate-build`     | Local validation: Prisma generate + Next.js build (no DB migrations) |
| `npm run start`              | Start production server (after `build`)                              |
| `npm run db-push`            | Push Prisma schema and generate client                               |
| `npm run db-reset`           | Force-reset DB and push schema                                       |
| `npm run type-check`         | Run TypeScript check (`tsc --noEmit`)                                |
| `npm run lint`               | Run ESLint                                                           |
| `npm run prettier`           | Format code with Prettier                                            |
| `npm run download-og-fonts`  | Download fonts used by OG image generation                           |
| `npm run smoke-image-intake` | Manual only. Sends 3 real Gemini requests (costs a few cents)        |

`smoke-image-intake` is never part of `npm run test` or CI, and it is the only check that catches
two failures nothing else can see. One is a mismatch between the request we build and what the
Gemini API accepts, which fails as an opaque HTTP 400 and breaks every extraction at once. The
other is a data-contract break: the model answers with a valid draft carrying amounts in the wrong
unit, so a purchase of S/ 59.90 is saved as S/ 0.59 and no schema notices. The script sends
synthetic receipts with known amounts and asserts the figures that come back. Run it by hand after
changing `IMAGE_INTAKE_RESPONSE_SCHEMA`, `buildRequestConfig`, the extraction prompt, the draft
contract, or the model id. It needs `GEMINI_API_KEY` and `IMAGE_INTAKE_PAID_TIER_CONFIRMED` in
`.env`.

---

## Project structure

```
pandatrack/
├── src/
│   ├── app/                    # Next.js App Router
│   │   └── [locale]/            # Locale segment (es, en)
│   │       ├── (landing)/       # Public landing route group
│   │       │   ├── page.tsx
│   │       │   └── _components/ # Page-specific components
│   │       ├── (auth)/          # Sign-in, sign-up, password recovery, email verification
│   │       ├── (app)/           # Authenticated collector app (stores, orders, deliveries,
│   │       │                    # dashboard, settings), each with its own _components/_actions
│   │       ├── terms/
│   │       ├── privacy/
│   │   └── globals.css
│   ├── components/
│   │   ├── core/                # Reusable UI (Button, Typography, etc.)
│   │   └── modules/             # Complex reusable (Modal, FaqAccordion, etc.)
│   ├── contexts/                # React context (e.g. Theme)
│   ├── i18n/                    # next-intl config and locales
│   │   ├── locales/{es,en}/
│   │   ├── request.ts
│   │   └── routing.ts
│   ├── lib/                     # Shared utilities, Prisma, constants
│   │   └── data/                # Per-domain query + mutation modules (see ADR 0015)
│   ├── hooks/                   # Shared hooks
│   ├── types/                   # Shared TypeScript types
│   └── queries/                 # Prisma data access, one file per model (see ADR 0015)
├── prisma/
│   └── schema.prisma
├── docs/                        # Product, design, and process docs
├── proxy.ts                     # Next.js 16 proxy (e.g. locale redirect, private-route auth gate)
└── next.config.ts
```

Route-level code (actions, hooks, utils, types) lives in `_actions/`, `_hooks/`, `_utils/`, `_types/` next to `_components/` for that route. See [.agents/rules/project-structure.mdc](.agents/rules/project-structure.mdc) for full conventions.

---

## Internationalization

- **Locales**: Spanish (`es`, default) and English (`en`).
- **URLs**: `/es` and `/en` (default locale may be served at `/`).
- **Copy**: All user-facing text lives in `src/i18n/locales/{locale}/*.json`; no hardcoded strings in components.
- **Usage**: `useTranslations()`, `useLocale()`, `useMessages()` in components; `getTranslations()` in server/non-React code.

Details: [docs/development/i18n.md](docs/development/i18n.md).

---

## Documentation

| Document                                                       | Description                                             |
| -------------------------------------------------------------- | ------------------------------------------------------- |
| [docs/product/README.md](docs/product/README.md)               | Product docs index (PRD, FRDs, blueprints, work orders) |
| [docs/design/README.md](docs/design/README.md)                 | Design system index (visual language, patterns, ADRs)   |
| [docs/development/i18n.md](docs/development/i18n.md)           | i18n setup, locales, and how to add translations        |
| [docs/development/og-images.md](docs/development/og-images.md) | OG image generation conventions                         |
| [docs/process/workflow-ai.md](docs/process/workflow-ai.md)     | AI delivery workflow (GitHub Epic/Slice first)          |
| [AGENTS.md](AGENTS.md)                                         | Guidelines for AI and human contributors                |

---

## Contributing

1. Follow the conventions in [AGENTS.md](AGENTS.md) and `.agents/rules/`.
2. Keep code and comments in English; user-facing copy goes in locale JSON files.
3. Before submitting: `npm run type-check`, `npm run lint`, and ensure `npm run validate-build` succeeds.

---

## License

Proprietary. All rights reserved.
