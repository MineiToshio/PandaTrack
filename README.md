# PandaTrack

**Organize purchases, pre-orders, payments, and shipments in one place.**

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

### Current (Landing & waitlist)

- **Public landing**: Marketing site with hero, features, FAQ, and waitlist signup.
- **Waitlist**: Email signup with share (native share, copy link) and referral support.
- **i18n**: Spanish (default) and English with locale-based routing (`/es`, `/en`).
- **Theme**: Light and dark mode with persistent preference.
- **Analytics**: PostHog for key interactions (CTA, nav, waitlist, share).
- **Monitoring**: Sentry for error tracking.
- **Legal**: Terms and Privacy pages.

### MVP roadmap

The first version focuses on the "discover → buy → wait → receive" workflow:

1. **Stores**: Database and discovery by category (manga, figures, TCG, etc.), with trust signals and reviews.
2. **Purchases & orders**: Track items, status, dates, and details per purchase.
3. **Pre-orders & payments**: Deposits vs remaining balance; upcoming payments by month.
4. **Shipments**: Track single and split shipments (carrier, tracking, status).
5. **Dashboard**: Status, upcoming payments, and totals at a glance.
6. **Reminders**: Follow-ups for long pre-orders, upcoming payments, and silent shipments.

### Later

- Collection management and wishlist.
- Budget setup and alerts.
- Deeper analytics and smarter reminders.

See [docs/product.md](docs/product.md) for full product vision and workflows.

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

| Command                     | Description                                |
| --------------------------- | ------------------------------------------ |
| `npm run dev`               | Start Next.js dev server                   |
| `npm run build`             | Generate Prisma client + build Next.js     |
| `npm run start`             | Start production server (after `build`)    |
| `npm run db-push`           | Push Prisma schema and generate client     |
| `npm run db-reset`          | Force-reset DB and push schema             |
| `npm run type-check`        | Run TypeScript check (`tsc --noEmit`)      |
| `npm run lint`              | Run ESLint                                 |
| `npm run prettier`          | Format code with Prettier                  |
| `npm run download-og-fonts` | Download fonts used by OG image generation |

---

## Project structure

```
pandatrack/
├── src/
│   ├── app/                    # Next.js App Router
│   │   └── [locale]/            # Locale segment (es, en)
│   │       ├── (landing)/       # Landing route group
│   │       │   ├── page.tsx
│   │       │   └── _components/ # Page-specific components
│   │       ├── terms/
│   │       ├── privacy/
│   │   └── globals.css
│   ├── components/
│   │   ├── core/                # Reusable UI (Button, Typography, etc.)
│   │   └── modules/             # Complex reusable (FaqAccordion, etc.)
│   ├── contexts/                # React context (e.g. Theme)
│   ├── i18n/                    # next-intl config and locales
│   │   ├── locales/{es,en}/
│   │   ├── request.ts
│   │   └── routing.ts
│   ├── lib/                     # Shared utilities, Prisma, constants
│   ├── hooks/                   # Shared hooks
│   ├── types/                   # Shared TypeScript types
│   └── queries/                 # Prisma data access (per model)
├── prisma/
│   └── schema.prisma
├── docs/                        # Product and architecture docs
├── proxy.ts                     # Next.js 16 proxy (e.g. locale redirect)
└── next.config.ts
```

Route-level code (actions, hooks, utils, types) lives in `_actions/`, `_hooks/`, `_utils/`, `_types/` next to `_components/` for that route. See [.cursor/rules/project-structure.mdc](.cursor/rules/project-structure.mdc) for full conventions.

---

## Internationalization

- **Locales**: Spanish (`es`, default) and English (`en`).
- **URLs**: `/es` and `/en` (default locale may be served at `/`).
- **Copy**: All user-facing text lives in `src/i18n/locales/{locale}/*.json`; no hardcoded strings in components.
- **Usage**: `useTranslations()`, `useLocale()`, `useMessages()` in components; `getTranslations()` in server/non-React code.

Details: [docs/i18n.md](docs/i18n.md).

---

## Documentation

| Document                           | Description                                      |
| ---------------------------------- | ------------------------------------------------ |
| [docs/product.md](docs/product.md) | Product vision, workflows, MVP scope, roadmap    |
| [docs/i18n.md](docs/i18n.md)       | i18n setup, locales, and how to add translations |
| [AGENTS.md](AGENTS.md)             | Guidelines for AI and human contributors         |

---

## Contributing

1. Follow the conventions in [AGENTS.md](AGENTS.md) and `.cursor/rules/`.
2. Keep code and comments in English; user-facing copy goes in locale JSON files.
3. Before submitting: `npm run type-check`, `npm run lint`, and ensure `npm run build` succeeds.

---

## License

Proprietary. All rights reserved.
