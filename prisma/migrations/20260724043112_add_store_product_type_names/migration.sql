-- AlterTable
ALTER TABLE "store_product_type" ADD COLUMN     "nameEn" TEXT,
ADD COLUMN     "nameEs" TEXT;

-- Backfill the seeded catalog rows with their localized names from the `storeProductTypes`
-- i18n namespace, so no seeded key is nameless once the hybrid name resolver reads the DB first.
-- Admin-authored types set these columns at approval time; the seeded values are pinned here.
UPDATE "store_product_type" SET "nameEs" = 'Álbumes de figuritas', "nameEn" = 'Sticker albums' WHERE "key" = 'albums';
UPDATE "store_product_type" SET "nameEs" = 'Art books', "nameEn" = 'Art books' WHERE "key" = 'art_books';
UPDATE "store_product_type" SET "nameEs" = 'Libros', "nameEn" = 'Books' WHERE "key" = 'books';
UPDATE "store_product_type" SET "nameEs" = 'Accesorios para libros', "nameEn" = 'Book accessories' WHERE "key" = 'book_accessories';
UPDATE "store_product_type" SET "nameEs" = 'Cómics', "nameEn" = 'Comics' WHERE "key" = 'comics';
UPDATE "store_product_type" SET "nameEs" = 'Figuras', "nameEn" = 'Figures' WHERE "key" = 'figures';
UPDATE "store_product_type" SET "nameEs" = 'Funkos', "nameEn" = 'Funkos' WHERE "key" = 'funkos';
UPDATE "store_product_type" SET "nameEs" = 'Accesorios Funko', "nameEn" = 'Funko accessories' WHERE "key" = 'funko_accessories';
UPDATE "store_product_type" SET "nameEs" = 'DVD/Blu-ray', "nameEn" = 'DVD/Blu-ray' WHERE "key" = 'home_video';
UPDATE "store_product_type" SET "nameEs" = 'Light novels', "nameEn" = 'Light novels' WHERE "key" = 'light_novels';
UPDATE "store_product_type" SET "nameEs" = 'Revistas', "nameEn" = 'Magazines' WHERE "key" = 'magazines';
UPDATE "store_product_type" SET "nameEs" = 'Manga', "nameEn" = 'Manga' WHERE "key" = 'manga';
UPDATE "store_product_type" SET "nameEs" = 'Merchandising', "nameEn" = 'Merchandise' WHERE "key" = 'merchandise';
UPDATE "store_product_type" SET "nameEs" = 'Música (CD, vinilo)', "nameEn" = 'Music (CD, vinyl)' WHERE "key" = 'music';
UPDATE "store_product_type" SET "nameEs" = 'Autógrafos', "nameEn" = 'Signatures' WHERE "key" = 'signatures';
UPDATE "store_product_type" SET "nameEs" = 'Cartas coleccionables', "nameEn" = 'Trading cards' WHERE "key" = 'trading_cards';
UPDATE "store_product_type" SET "nameEs" = 'Videojuegos', "nameEn" = 'Video games' WHERE "key" = 'video_games';
