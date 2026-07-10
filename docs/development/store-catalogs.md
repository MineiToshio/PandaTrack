# Store catalogs and seed data

Reference for seeded store catalog identifiers and how they are used. Labels are resolved via i18n; do not store localized names in the database.

## Country catalog

- **Table:** `country`
- **Primary key:** `code` (ISO 3166-1 alpha-2)
- **Display labels:** i18n key `countries.{code}` (e.g. `countries.ES`, `countries.MX`). Add keys in `src/i18n/locales/{locale}/` under a `countries` namespace or in a shared namespace.
- **Seeded codes:** Defined in `src/lib/catalog/collectorCountries.ts` as `COUNTRY_CODES` and re-exported from `prisma/seed.ts`. Initial set includes app-locale and collector-relevant countries (e.g. ES, MX, US, GB, JP, AR, PE, CO, CL, BR, DE, FR, IT, etc.). Expand the array when new countries are needed; keep codes stable and uppercase, and update the primary currency map in the same module for user base-currency validation.

**Usage:** Store `countryCode` (create/forms), addresses, import countries, and filters must reference only codes present in `country`. Validation should check `countryCode` against the catalog.

## Store product types

- **Table:** `store_product_type`
- **Primary key:** `key` (stable string, snake_case)
- **Display labels:** i18n key `storeProductTypes.{key}` (e.g. `storeProductTypes.manga`, `storeProductTypes.trading_cards`).
- **Seeded keys:** Defined in `src/lib/catalog/storeProductTypes.ts` as `STORE_PRODUCT_TYPE_KEYS` and re-exported from `prisma/seed.ts`. Initial set is collector-focused: `albums`, `art_books`, `books`, `book_accessories` (care, separators, sleeves for books/manga/light novels), `comics`, `figures`, `funkos`, `funko_accessories` (pedestals, display steps, protectors), `home_video` (DVD/Blu-ray: anime, movies, series), `light_novels`, `manga`, `merchandise`, `music` (CDs, vinyl), `signatures`, `trading_cards`, `video_games`. Do not change existing keys; add new product types via seed or admin flow and document them here.

**Usage:** Store creation and filters use product type keys from the catalog.

## Review aggregates (baseline)

Store-level trust summary is persisted on `store`:

- **averageRating:** Denormalized from `store_review`; updated when reviews are created, updated, or deleted.
- **reviewCount:** Denormalized count of public reviews; updated in the same write path as `averageRating`.
- **overallRating input:** review authors can submit ratings in `0.5` steps; aggregate averages remain float values.

No seed data is required for these fields; new stores start with `averageRating: null` and `reviewCount: 0`. Store review writes are responsible for keeping both fields in sync.

## Running the seed

```bash
npm run db-seed
```

Or:

```bash
npx prisma db seed
```

The seed is idempotent: safe to run multiple times. Countries and store product types both use `createMany` with `skipDuplicates`.

## Development-only sample data

`npm run db-seed-dev` (script: `scripts/seed-dev-data.ts`) fills a **development** database with a realistic collector dataset — stores, orders, items, payments and deliveries — so every dashboard zone renders with meaningful values (budget consumption, overdue and upcoming obligations, spend and outstanding-debt trends, arrival punctuality, split shipments, an FX-pending order).

It requires the catalog seed above to have run, and a user account to already exist for the email configured at the top of the script. Every store it creates carries the `dev-` slug prefix, and each run deletes those stores first, cascading to their orders and deliveries; rows created outside the script are left untouched. Never point it at a production database.

## Adding new catalog values

1. **Countries:** Add the ISO 3166-1 alpha-2 code to `COUNTRY_CODES` in `src/lib/catalog/collectorCountries.ts` (and the matching `PRIMARY_CURRENCY_BY_COUNTRY` entry), then run the seed. Add i18n keys for the new code in each locale.
2. **Product types:** Add the key to `STORE_PRODUCT_TYPE_KEYS` in `src/lib/catalog/storeProductTypes.ts`, run the seed, and add i18n keys.
