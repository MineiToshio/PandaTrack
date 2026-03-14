# Store catalogs and seed data

Reference for seeded store catalog identifiers and how they are used. Labels are resolved via i18n; do not store localized names in the database.

## Country catalog

- **Table:** `country`
- **Primary key:** `code` (ISO 3166-1 alpha-2)
- **Display labels:** i18n key `countries.{code}` (e.g. `countries.ES`, `countries.MX`). Add keys in `src/i18n/locales/{locale}/` under a `countries` namespace or in a shared namespace.
- **Seeded codes:** See `prisma/seed.ts` (`COUNTRY_CODES`). Initial set includes app-locale and collector-relevant countries (e.g. ES, MX, US, GB, JP, AR, PE, CO, CL, BR, DE, FR, IT, etc.). Expand the array in the seed when new countries are needed; keep codes stable and uppercase.

**Usage:** Store `countryCode` (create/forms), addresses, import countries, and filters must reference only codes present in `country`. Validation should check `countryCode` against the catalog.

## Store categories

- **Table:** `store_category`
- **Primary key:** `key` (stable string, snake_case)
- **Display labels:** i18n key `storeCategories.{key}` (e.g. `storeCategories.manga`, `storeCategories.trading_cards`).
- **Seeded keys:** See `prisma/seed.ts` (`STORE_CATEGORY_KEYS`). Initial set is collector-focused: `albums`, `art_books`, `books`, `comics`, `figures`, `funkos`, `home_video` (DVD/Blu-ray: anime, movies, series), `light_novels`, `manga`, `merchandise`, `music` (CDs, vinyl), `signatures`, `trading_cards`, `video_games`. Do not change existing keys; add new categories via seed or admin flow and document them here.

**Usage:** Store creation and filters use category keys from the catalog. Category-specific property definitions (slice 3) link to these keys.

## Review aggregates (baseline)

Store-level trust summary is persisted on `store`:

- **averageRating:** Denormalized from `store_review`; updated when reviews are created, updated, or deleted.
- **reviewCount:** Denormalized count of public reviews; updated in the same write path as `averageRating`.

No seed data is required for these fields; new stores start with `averageRating: null` and `reviewCount: 0`. Later slices (e.g. store reviews) will implement the logic to keep these in sync.

## Running the seed

```bash
npm run db-seed
```

Or:

```bash
npx prisma db seed
```

The seed is idempotent: safe to run multiple times. Countries and store categories both use `createMany` with `skipDuplicates`.

## Adding new catalog values

1. **Countries:** Add the ISO 3166-1 alpha-2 code to `COUNTRY_CODES` in `prisma/seed.ts`, then run the seed. Add i18n keys for the new code in each locale.
2. **Categories:** Add the key to `STORE_CATEGORY_KEYS` in `prisma/seed.ts`, run the seed, and add i18n keys. If the category drives property definitions, update slice 3 (property definitions) accordingly.
