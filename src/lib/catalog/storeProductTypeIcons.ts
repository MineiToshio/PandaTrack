import type { LucideIcon } from "lucide-react";
import {
  BookImage,
  BookMarked,
  BookOpen,
  BookOpenText,
  Disc,
  Film,
  GalleryThumbnails,
  Gamepad2,
  Package,
  Palette,
  ScrollText,
  ShoppingBag,
  Shapes,
  Signature,
  Sticker,
  Tag,
} from "lucide-react";

/**
 * Lucide icon mapping for the 16 catalog product type keys.
 * Source of truth for product-type iconography across the app
 * (filter pills, store cards, store detail, future order detail "store info").
 *
 * Keys mirror `STORE_PRODUCT_TYPE_KEYS` from `src/lib/catalog/storeProductTypes.ts`.
 * Unknown keys fall back to `Tag` via `getStoreProductTypeIcon`.
 */
export const STORE_PRODUCT_TYPE_ICON_MAP: Record<string, LucideIcon> = {
  albums: Sticker,
  art_books: Palette,
  books: BookOpenText,
  book_accessories: BookMarked,
  comics: BookImage,
  figures: Shapes,
  funkos: Package,
  funko_accessories: Tag,
  home_video: Film,
  light_novels: ScrollText,
  manga: BookOpen,
  merchandise: ShoppingBag,
  music: Disc,
  signatures: Signature,
  trading_cards: GalleryThumbnails,
  video_games: Gamepad2,
};

/**
 * Resolve a Lucide icon component for a given product type key.
 * Falls back to `Tag` for unknown keys so render sites never crash.
 */
export function getStoreProductTypeIcon(key: string): LucideIcon {
  return STORE_PRODUCT_TYPE_ICON_MAP[key] ?? Tag;
}
