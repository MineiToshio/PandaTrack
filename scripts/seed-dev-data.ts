/**
 * Development-only data seeder.
 *
 * Fills the database pointed at by `DATABASE_URL` with a realistic collector dataset (stores,
 * orders, items, payments and deliveries) so every dashboard zone renders with meaningful values:
 * budget consumption, overdue and upcoming obligations, month-by-month spend and outstanding-debt
 * trends, arrival punctuality, split shipments, and an FX-pending order.
 *
 * Idempotent: every store it creates carries the `dev-` slug prefix, and each run deletes those
 * stores first, cascading to the orders and deliveries hanging off them. Rows created outside this
 * script are never touched.
 *
 * Usage: `npm run db-seed-dev` (never point it at a production database).
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client";
import type {
  DeliveryStatus,
  OrderItemDeliveryState,
  StoreContactChannelType,
  StorePresenceType,
  SellerType,
} from "../generated/prisma/client";
import { deriveOrderStatus, type ItemDeliveryState } from "../src/lib/orders/orderState";
import { normalizeStoreName } from "../src/lib/store/duplicateMatch";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, allowExitOnIdle: true });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

/** Slug namespace that marks a store (and its cascade) as owned by this seeder. */
const DEV_SLUG_PREFIX = "dev-";

/** Collector whose dashboard the dataset is shaped for. */
const TARGET_USER_EMAIL = "sminei10@gmail.com";

const BASE_CURRENCY = "USD";
/** Minor units. `User.budgetAmount` must be a whole number of major units (DB check). */
const BUDGET_AMOUNT_MINOR = 60_000;
const BUDGET_RESET_DAY = 1;
const TIMEZONE = "America/Lima";

/** Rate to `BASE_CURRENCY`: how many base-currency units equal 1 order-currency unit. */
const EXCHANGE_RATES: Record<string, number | null> = {
  USD: null,
  PEN: 0.27,
  EUR: 1.08,
  JPY: 0.0064,
  MXN: 0.055,
};

/** UTC-midnight domain date, matching how the app persists calendar days. */
function day(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

type SeedStore = {
  key: string;
  name: string;
  countryCode: string;
  sellerType: SellerType;
  description: string;
  presences: StorePresenceType[];
  productTypes: string[];
  importCountries: string[];
  contact: { type: StoreContactChannelType; value: string };
  address?: { city: string; addressLine: string };
  rating: number;
  reviewCount: number;
};

const STORES: SeedStore[] = [
  {
    key: "kinokuniya",
    name: "Kinokuniya Books",
    countryCode: "JP",
    sellerType: "RETAILER",
    description: "Japanese bookstore chain shipping manga, light novels and art books worldwide.",
    presences: ["ONLINE", "PHYSICAL"],
    productTypes: ["manga", "light_novels", "art_books"],
    importCountries: ["PE", "US", "ES"],
    contact: { type: "WEBSITE", value: "https://example.com/kinokuniya" },
    address: { city: "Tokyo", addressLine: "Shinjuku 3-17-7" },
    rating: 4.8,
    reviewCount: 214,
  },
  {
    key: "mandarake",
    name: "Mandarake",
    countryCode: "JP",
    sellerType: "RETAILER",
    description: "Second-hand figures, doujinshi and vintage collectibles.",
    presences: ["ONLINE"],
    productTypes: ["figures", "manga", "merchandise"],
    importCountries: ["PE", "MX", "US"],
    contact: { type: "WEBSITE", value: "https://example.com/mandarake" },
    rating: 4.5,
    reviewCount: 132,
  },
  {
    key: "amiami",
    name: "AmiAmi",
    countryCode: "JP",
    sellerType: "RETAILER",
    description: "Pre-orders for scale figures, nendoroids and hobby merchandise.",
    presences: ["ONLINE"],
    productTypes: ["figures", "merchandise"],
    importCountries: ["PE", "CL", "AR"],
    contact: { type: "INSTAGRAM", value: "@amiami" },
    rating: 4.6,
    reviewCount: 301,
  },
  {
    key: "otaku-lima",
    name: "Otaku Store Lima",
    countryCode: "PE",
    sellerType: "RETAILER",
    description: "Tienda limeña de manga, funkos y merchandising importado.",
    presences: ["PHYSICAL", "ONLINE"],
    productTypes: ["manga", "funkos", "merchandise"],
    importCountries: ["JP", "US"],
    contact: { type: "WHATSAPP", value: "+51987654321" },
    address: { city: "Lima", addressLine: "Av. Arequipa 1234, Miraflores" },
    rating: 4.2,
    reviewCount: 47,
  },
  {
    key: "comics-peru",
    name: "Comics Perú",
    countryCode: "PE",
    sellerType: "RETAILER",
    description: "Cómics, trading cards y singles en español.",
    presences: ["PHYSICAL"],
    productTypes: ["comics", "trading_cards"],
    importCountries: ["US"],
    contact: { type: "INSTAGRAM", value: "@comicsperu" },
    address: { city: "Lima", addressLine: "Jr. de la Unión 890" },
    rating: 3.9,
    reviewCount: 23,
  },
  {
    key: "panini-es",
    name: "Panini España",
    countryCode: "ES",
    sellerType: "RETAILER",
    description: "Editorial de cómic y manga en castellano.",
    presences: ["ONLINE"],
    productTypes: ["comics", "manga"],
    importCountries: ["PE", "MX", "AR"],
    contact: { type: "WEBSITE", value: "https://example.com/panini" },
    rating: 4.1,
    reviewCount: 88,
  },
  {
    key: "bbts",
    name: "BigBadToyStore",
    countryCode: "US",
    sellerType: "RETAILER",
    description: "Action figures, statues and import collectibles.",
    presences: ["ONLINE"],
    productTypes: ["figures", "funkos", "funko_accessories"],
    importCountries: ["PE", "MX", "CL"],
    contact: { type: "EMAIL", value: "orders@example.com" },
    rating: 4.7,
    reviewCount: 456,
  },
  {
    key: "tcg-vault",
    name: "TCG Vault",
    countryCode: "US",
    sellerType: "RETAILER",
    description: "Sealed product and graded singles for trading card games.",
    presences: ["ONLINE"],
    productTypes: ["trading_cards"],
    importCountries: ["PE", "CO"],
    contact: { type: "WEBSITE", value: "https://example.com/tcgvault" },
    rating: 4.4,
    reviewCount: 175,
  },
  {
    key: "vinyl-haus",
    name: "Vinyl Haus",
    countryCode: "DE",
    sellerType: "RETAILER",
    description: "Limited pressings, box sets and soundtrack vinyl.",
    presences: ["ONLINE", "PHYSICAL"],
    productTypes: ["albums", "music"],
    importCountries: ["ES", "PT", "FR"],
    contact: { type: "WEBSITE", value: "https://example.com/vinylhaus" },
    address: { city: "Berlin", addressLine: "Kastanienallee 42" },
    rating: 4.3,
    reviewCount: 61,
  },
  {
    key: "coleccionista-mx",
    name: "Coleccionista MX",
    countryCode: "MX",
    sellerType: "PERSON",
    description: "Vendedor particular de videojuegos retro y merchandising.",
    presences: ["ONLINE"],
    productTypes: ["video_games", "merchandise"],
    importCountries: ["US"],
    contact: { type: "WHATSAPP", value: "+525512345678" },
    rating: 4.0,
    reviewCount: 12,
  },
];

type SeedItem = {
  name: string;
  quantity: number;
  unitPrice: number | null;
  productTypeKey: string | null;
  state: ItemDeliveryState;
};

type SeedDelivery = {
  /** Item positions (0-based) carried by this shipment. */
  itemIndexes: number[];
  deliveryDate: string;
  receivedDate?: string;
  expectedArrivalFrom?: string;
  expectedArrivalTo?: string;
  status: DeliveryStatus;
  /** Shipping cost, in the order's currency. */
  cost: number;
  note?: string;
};

type SeedOrder = {
  storeKey: string;
  orderDate: string;
  currencyCode: keyof typeof EXCHANGE_RATES;
  totalCost: number;
  expectedDeliveryFrom: string | null;
  expectedDeliveryTo: string | null;
  items: SeedItem[];
  payments: Array<{ amount: number; date: string }>;
  deliveries?: SeedDelivery[];
  cancelled?: boolean;
  cancellationReason?: string;
  /** Leaves the stored rate un-attributed, so the order reads as FX-pending (see ADR 0024). */
  fxUnreconciled?: boolean;
  note?: string;
};

/**
 * The dataset is hand-shaped rather than randomized so each dashboard zone has something to show:
 * settled history for the trend series, overdue and no-date balances for the obligations zone,
 * on-time / late / unknown arrivals for punctuality, a split shipment, a cancelled order (excluded
 * from every rollup) and an FX-pending order (excluded from base-currency totals).
 *
 * "Today" for this dataset is mid-2026: payments landing in the current calendar month drive the
 * budget gauge, so shift the July dates if the machine clock moves far past that.
 */
const ORDERS: SeedOrder[] = [
  // ---- Settled history: feeds the spend + outstanding-debt trends and punctuality ----
  {
    storeKey: "kinokuniya",
    orderDate: "2025-11-12",
    currencyCode: "JPY",
    totalCost: 1_200_000,
    expectedDeliveryFrom: "2025-12-05",
    expectedDeliveryTo: "2025-12-20",
    items: [
      { name: "Chainsaw Man vol. 1-11", quantity: 11, unitPrice: 60_000, productTypeKey: "manga", state: "delivered" },
      { name: "Blame! Master Edition", quantity: 2, unitPrice: 270_000, productTypeKey: "manga", state: "delivered" },
    ],
    payments: [{ amount: 1_200_000, date: "2025-11-12" }],
    deliveries: [
      {
        itemIndexes: [0, 1],
        deliveryDate: "2025-12-10",
        receivedDate: "2025-12-24",
        status: "DELIVERED",
        cost: 45_000,
      },
    ],
  },
  {
    storeKey: "bbts",
    orderDate: "2025-12-03",
    currencyCode: "USD",
    totalCost: 24_500,
    expectedDeliveryFrom: "2026-01-10",
    expectedDeliveryTo: "2026-01-25",
    items: [
      { name: "MAFEX Spider-Man", quantity: 1, unitPrice: 9_500, productTypeKey: "figures", state: "delivered" },
      { name: "Funko Pop! Deluxe Batman", quantity: 3, unitPrice: 5_000, productTypeKey: "funkos", state: "delivered" },
    ],
    payments: [{ amount: 24_500, date: "2025-12-03" }],
    deliveries: [
      { itemIndexes: [0, 1], deliveryDate: "2026-01-28", receivedDate: "2026-02-06", status: "DELIVERED", cost: 3_200 },
    ],
    note: "Arrived late: carrier held the package at customs.",
  },
  {
    storeKey: "amiami",
    orderDate: "2026-01-15",
    currencyCode: "JPY",
    totalCost: 850_000,
    expectedDeliveryFrom: "2026-02-14",
    expectedDeliveryTo: "2026-02-28",
    items: [
      { name: "Nendoroid Frieren", quantity: 1, unitPrice: 550_000, productTypeKey: "figures", state: "delivered" },
      { name: "Acrylic stand set", quantity: 2, unitPrice: 150_000, productTypeKey: "merchandise", state: "delivered" },
    ],
    payments: [{ amount: 850_000, date: "2026-01-15" }],
    deliveries: [
      {
        itemIndexes: [0, 1],
        deliveryDate: "2026-02-20",
        receivedDate: "2026-03-02",
        status: "DELIVERED",
        cost: 28_000,
      },
    ],
  },
  {
    storeKey: "comics-peru",
    orderDate: "2026-02-02",
    currencyCode: "PEN",
    totalCost: 18_000,
    expectedDeliveryFrom: "2026-02-10",
    expectedDeliveryTo: "2026-02-18",
    items: [
      { name: "Saga vol. 1-5", quantity: 5, unitPrice: 2_400, productTypeKey: "comics", state: "delivered" },
      { name: "Sobre Pokémon 151", quantity: 4, unitPrice: 1_500, productTypeKey: "trading_cards", state: "delivered" },
    ],
    payments: [{ amount: 18_000, date: "2026-02-02" }],
    deliveries: [
      { itemIndexes: [0, 1], deliveryDate: "2026-02-12", receivedDate: "2026-02-14", status: "DELIVERED", cost: 1_200 },
    ],
  },
  {
    storeKey: "panini-es",
    orderDate: "2026-02-20",
    currencyCode: "EUR",
    totalCost: 6_500,
    expectedDeliveryFrom: "2026-03-12",
    expectedDeliveryTo: "2026-03-26",
    items: [
      {
        name: "Ultimate Spider-Man Omnibus",
        quantity: 1,
        unitPrice: 6_500,
        productTypeKey: "comics",
        state: "delivered",
      },
    ],
    payments: [{ amount: 6_500, date: "2026-02-20" }],
    deliveries: [
      { itemIndexes: [0], deliveryDate: "2026-03-18", receivedDate: "2026-03-30", status: "DELIVERED", cost: 900 },
    ],
  },
  {
    storeKey: "mandarake",
    orderDate: "2026-03-05",
    currencyCode: "JPY",
    totalCost: 2_400_000,
    expectedDeliveryFrom: "2026-04-02",
    expectedDeliveryTo: "2026-04-16",
    items: [
      {
        name: "Ichiban Kuji Evangelion lot",
        quantity: 1,
        unitPrice: 1_800_000,
        productTypeKey: "figures",
        state: "delivered",
      },
      { name: "Berserk deluxe vol. 1-3", quantity: 3, unitPrice: 200_000, productTypeKey: "manga", state: "delivered" },
    ],
    payments: [
      { amount: 1_200_000, date: "2026-03-05" },
      { amount: 1_200_000, date: "2026-04-04" },
    ],
    deliveries: [
      {
        itemIndexes: [0, 1],
        deliveryDate: "2026-04-10",
        receivedDate: "2026-04-22",
        status: "DELIVERED",
        cost: 62_000,
      },
    ],
  },
  {
    storeKey: "tcg-vault",
    orderDate: "2026-03-18",
    currencyCode: "USD",
    totalCost: 12_000,
    expectedDeliveryFrom: "2026-03-28",
    expectedDeliveryTo: "2026-04-08",
    items: [
      {
        name: "Pokémon 151 Booster Box",
        quantity: 1,
        unitPrice: 12_000,
        productTypeKey: "trading_cards",
        state: "delivered",
      },
    ],
    payments: [{ amount: 12_000, date: "2026-03-18" }],
    deliveries: [
      { itemIndexes: [0], deliveryDate: "2026-04-01", receivedDate: "2026-04-09", status: "DELIVERED", cost: 1_500 },
    ],
  },
  {
    storeKey: "vinyl-haus",
    orderDate: "2026-04-01",
    currencyCode: "EUR",
    totalCost: 9_800,
    expectedDeliveryFrom: "2026-04-18",
    expectedDeliveryTo: "2026-05-02",
    items: [
      { name: "Cowboy Bebop OST box set", quantity: 1, unitPrice: 7_000, productTypeKey: "albums", state: "delivered" },
      { name: "Akira OST reissue", quantity: 1, unitPrice: 2_800, productTypeKey: "music", state: "delivered" },
    ],
    payments: [{ amount: 9_800, date: "2026-04-01" }],
    deliveries: [
      { itemIndexes: [0, 1], deliveryDate: "2026-04-25", receivedDate: "2026-05-05", status: "DELIVERED", cost: 1_400 },
    ],
  },
  {
    storeKey: "otaku-lima",
    orderDate: "2026-04-22",
    currencyCode: "PEN",
    totalCost: 32_000,
    expectedDeliveryFrom: "2026-05-06",
    expectedDeliveryTo: "2026-05-16",
    items: [
      { name: "Funko Pop! Luffy Gear 5", quantity: 2, unitPrice: 8_500, productTypeKey: "funkos", state: "delivered" },
      { name: "One Piece vol. 100-105", quantity: 6, unitPrice: 2_500, productTypeKey: "manga", state: "delivered" },
    ],
    payments: [{ amount: 32_000, date: "2026-04-22" }],
    deliveries: [
      { itemIndexes: [0, 1], deliveryDate: "2026-05-08", receivedDate: "2026-05-11", status: "DELIVERED", cost: 1_500 },
    ],
  },
  {
    storeKey: "bbts",
    orderDate: "2026-05-06",
    currencyCode: "USD",
    totalCost: 18_900,
    expectedDeliveryFrom: "2026-05-24",
    expectedDeliveryTo: "2026-06-06",
    items: [
      {
        name: "S.H.Figuarts Gojo Satoru",
        quantity: 1,
        unitPrice: 8_900,
        productTypeKey: "figures",
        state: "delivered",
      },
      {
        name: "Funko Pop! protector case",
        quantity: 10,
        unitPrice: 1_000,
        productTypeKey: "funko_accessories",
        state: "delivered",
      },
    ],
    payments: [{ amount: 18_900, date: "2026-05-06" }],
    deliveries: [
      { itemIndexes: [0, 1], deliveryDate: "2026-05-30", receivedDate: "2026-06-04", status: "DELIVERED", cost: 2_100 },
    ],
  },

  // ---- Split shipment: one order, two deliveries, one still in transit ----
  {
    storeKey: "kinokuniya",
    orderDate: "2026-05-21",
    currencyCode: "JPY",
    totalCost: 1_560_000,
    expectedDeliveryFrom: "2026-06-18",
    expectedDeliveryTo: "2026-07-02",
    items: [
      {
        name: "Vagabond kanzenban vol. 1-6",
        quantity: 6,
        unitPrice: 180_000,
        productTypeKey: "manga",
        state: "delivered",
      },
      {
        name: "Makoto Shinkai art book",
        quantity: 1,
        unitPrice: 280_000,
        productTypeKey: "art_books",
        state: "in_transit",
      },
      {
        name: "Sousou no Frieren light novel",
        quantity: 2,
        unitPrice: 100_000,
        productTypeKey: "light_novels",
        state: "in_transit",
      },
    ],
    payments: [
      { amount: 800_000, date: "2026-05-21" },
      { amount: 760_000, date: "2026-06-20" },
    ],
    deliveries: [
      {
        itemIndexes: [0],
        deliveryDate: "2026-06-22",
        receivedDate: "2026-06-30",
        status: "DELIVERED",
        cost: 38_000,
        note: "First half of the order.",
      },
      {
        itemIndexes: [1, 2],
        deliveryDate: "2026-07-04",
        expectedArrivalFrom: "2026-07-16",
        expectedArrivalTo: "2026-07-24",
        status: "IN_TRANSIT",
        cost: 26_000,
        note: "Remaining items shipped separately.",
      },
    ],
  },

  // ---- Arrived at store by hand (no delivery record): punctuality "unknown" ----
  {
    storeKey: "amiami",
    orderDate: "2026-06-02",
    currencyCode: "JPY",
    totalCost: 980_000,
    expectedDeliveryFrom: "2026-07-15",
    expectedDeliveryTo: "2026-07-30",
    items: [
      {
        name: "Figma Guts Berserker Armor",
        quantity: 1,
        unitPrice: 980_000,
        productTypeKey: "figures",
        state: "arrived_at_store",
      },
    ],
    payments: [{ amount: 500_000, date: "2026-06-02" }],
    note: "Store confirmed the figure is in their warehouse.",
  },

  // ---- Overdue: expected arrival already past, balance still open ----
  {
    storeKey: "comics-peru",
    orderDate: "2026-05-15",
    currencyCode: "PEN",
    totalCost: 24_000,
    expectedDeliveryFrom: "2026-06-20",
    expectedDeliveryTo: "2026-06-30",
    items: [
      { name: "Batman: The Long Halloween", quantity: 1, unitPrice: 12_000, productTypeKey: "comics", state: "open" },
      { name: "Sobres Lorcana", quantity: 6, unitPrice: 2_000, productTypeKey: "trading_cards", state: "open" },
    ],
    payments: [{ amount: 8_000, date: "2026-05-15" }],
    note: "Store has not confirmed restock yet.",
  },
  {
    storeKey: "coleccionista-mx",
    orderDate: "2026-04-28",
    currencyCode: "MXN",
    totalCost: 450_000,
    expectedDeliveryFrom: "2026-06-10",
    expectedDeliveryTo: "2026-06-24",
    items: [
      {
        name: "Chrono Trigger SNES (CIB)",
        quantity: 1,
        unitPrice: 320_000,
        productTypeKey: "video_games",
        state: "open",
      },
      { name: "Poster serigrafiado", quantity: 2, unitPrice: 65_000, productTypeKey: "merchandise", state: "open" },
    ],
    payments: [{ amount: 150_000, date: "2026-04-28" }],
  },

  // ---- FX pending: base currency changed, this order's rate is stale ----
  {
    storeKey: "coleccionista-mx",
    orderDate: "2026-06-08",
    currencyCode: "MXN",
    totalCost: 180_000,
    expectedDeliveryFrom: "2026-07-20",
    expectedDeliveryTo: "2026-08-05",
    items: [
      { name: "Metroid Prime Trilogy", quantity: 1, unitPrice: 180_000, productTypeKey: "video_games", state: "open" },
    ],
    payments: [],
    fxUnreconciled: true,
    note: "Exchange rate needs to be re-entered.",
  },

  // ---- Current month: obligations due now, payments feeding the budget gauge ----
  {
    storeKey: "tcg-vault",
    orderDate: "2026-06-24",
    currencyCode: "USD",
    totalCost: 22_000,
    expectedDeliveryFrom: "2026-07-12",
    expectedDeliveryTo: "2026-07-22",
    items: [
      {
        name: "Magic: Modern Horizons 3 Collector Box",
        quantity: 1,
        unitPrice: 22_000,
        productTypeKey: "trading_cards",
        state: "open",
      },
    ],
    payments: [
      { amount: 6_000, date: "2026-06-24" },
      { amount: 8_000, date: "2026-07-03" },
    ],
  },
  {
    storeKey: "panini-es",
    orderDate: "2026-07-02",
    currencyCode: "EUR",
    totalCost: 4_200,
    expectedDeliveryFrom: "2026-07-24",
    expectedDeliveryTo: "2026-08-06",
    items: [
      { name: "Monstruo vol. 1-3 (kanzenban)", quantity: 3, unitPrice: 1_400, productTypeKey: "manga", state: "open" },
    ],
    payments: [{ amount: 4_200, date: "2026-07-02" }],
  },
  {
    storeKey: "bbts",
    orderDate: "2026-07-05",
    currencyCode: "USD",
    totalCost: 15_600,
    expectedDeliveryFrom: "2026-07-18",
    expectedDeliveryTo: "2026-07-28",
    items: [
      { name: "MAFEX Batman Hush", quantity: 1, unitPrice: 10_600, productTypeKey: "figures", state: "open" },
      { name: "Funko Pop! Chase Gojo", quantity: 1, unitPrice: 5_000, productTypeKey: "funkos", state: "open" },
    ],
    payments: [{ amount: 15_600, date: "2026-07-05" }],
  },
  {
    storeKey: "otaku-lima",
    orderDate: "2026-07-08",
    currencyCode: "PEN",
    totalCost: 21_000,
    expectedDeliveryFrom: "2026-07-26",
    expectedDeliveryTo: "2026-08-04",
    items: [
      {
        name: "Jujutsu Kaisen vol. 20-26",
        quantity: 7,
        unitPrice: 2_500,
        productTypeKey: "manga",
        state: "in_transit",
      },
      { name: "Llavero metálico", quantity: 2, unitPrice: 1_750, productTypeKey: "merchandise", state: "open" },
    ],
    payments: [{ amount: 10_000, date: "2026-07-09" }],
    deliveries: [
      {
        itemIndexes: [0],
        deliveryDate: "2026-07-09",
        expectedArrivalFrom: "2026-07-26",
        expectedArrivalTo: "2026-08-04",
        status: "IN_TRANSIT",
        cost: 1_500,
        note: "Los tomos salieron primero; el llavero sigue pendiente.",
      },
    ],
  },

  // ---- Pre-orders landing in the next three months ----
  {
    storeKey: "amiami",
    orderDate: "2026-06-28",
    currencyCode: "JPY",
    totalCost: 3_200_000,
    expectedDeliveryFrom: "2026-08-14",
    expectedDeliveryTo: "2026-08-28",
    items: [
      {
        name: "1/7 Scale Rem (re-release)",
        quantity: 1,
        unitPrice: 2_100_000,
        productTypeKey: "figures",
        state: "open",
      },
      {
        name: "Nendoroid Doll outfit set",
        quantity: 2,
        unitPrice: 550_000,
        productTypeKey: "merchandise",
        state: "open",
      },
    ],
    payments: [{ amount: 1_000_000, date: "2026-06-28" }],
    note: "Pre-order: balance due on release.",
  },
  {
    storeKey: "mandarake",
    orderDate: "2026-07-01",
    currencyCode: "JPY",
    totalCost: 1_450_000,
    expectedDeliveryFrom: "2026-09-05",
    expectedDeliveryTo: "2026-09-20",
    items: [
      {
        name: "Vintage Gundam model lot",
        quantity: 4,
        unitPrice: 250_000,
        productTypeKey: "merchandise",
        state: "open",
      },
      { name: "Akira hardcover set", quantity: 1, unitPrice: 450_000, productTypeKey: "manga", state: "open" },
    ],
    payments: [],
  },
  {
    storeKey: "vinyl-haus",
    orderDate: "2026-06-19",
    currencyCode: "EUR",
    totalCost: 14_500,
    expectedDeliveryFrom: "2026-10-02",
    expectedDeliveryTo: "2026-10-18",
    items: [
      {
        name: "Nier: Automata OST deluxe vinyl",
        quantity: 1,
        unitPrice: 11_000,
        productTypeKey: "albums",
        state: "open",
      },
      { name: "Signed sleeve print", quantity: 1, unitPrice: 3_500, productTypeKey: "signatures", state: "open" },
    ],
    payments: [{ amount: 5_000, date: "2026-07-06" }],
    note: "Limited pressing, ships in October.",
  },

  // ---- Outstanding without an expected arrival date ----
  {
    storeKey: "kinokuniya",
    orderDate: "2026-06-12",
    currencyCode: "JPY",
    totalCost: 640_000,
    expectedDeliveryFrom: null,
    expectedDeliveryTo: null,
    items: [
      {
        name: "Monogatari light novel box",
        quantity: 1,
        unitPrice: 640_000,
        productTypeKey: "light_novels",
        state: "open",
      },
    ],
    payments: [{ amount: 200_000, date: "2026-06-12" }],
    note: "Store has not given a shipping estimate.",
  },
  {
    storeKey: "comics-peru",
    orderDate: "2026-07-06",
    currencyCode: "PEN",
    totalCost: 9_500,
    expectedDeliveryFrom: null,
    expectedDeliveryTo: null,
    items: [
      { name: "Sandman edición Biblioteca", quantity: 1, unitPrice: 9_500, productTypeKey: "comics", state: "open" },
    ],
    payments: [],
  },

  // ---- In transit right now ----
  {
    storeKey: "tcg-vault",
    orderDate: "2026-06-14",
    currencyCode: "USD",
    totalCost: 8_400,
    expectedDeliveryFrom: "2026-07-09",
    expectedDeliveryTo: "2026-07-19",
    items: [
      {
        name: "PSA 9 Charizard Base Set",
        quantity: 1,
        unitPrice: 8_400,
        productTypeKey: "trading_cards",
        state: "in_transit",
      },
    ],
    payments: [{ amount: 8_400, date: "2026-06-14" }],
    deliveries: [
      {
        itemIndexes: [0],
        deliveryDate: "2026-07-07",
        expectedArrivalFrom: "2026-07-14",
        expectedArrivalTo: "2026-07-21",
        status: "IN_TRANSIT",
        cost: 1_800,
      },
    ],
  },

  // ---- Cancelled: excluded from every dashboard rollup ----
  {
    storeKey: "bbts",
    orderDate: "2026-06-05",
    currencyCode: "USD",
    totalCost: 33_000,
    expectedDeliveryFrom: "2026-08-01",
    expectedDeliveryTo: "2026-08-20",
    items: [
      { name: "Hot Toys Iron Man Mark III", quantity: 1, unitPrice: 33_000, productTypeKey: "figures", state: "open" },
    ],
    payments: [],
    cancelled: true,
    cancellationReason: "Price dropped elsewhere.",
  },
];

async function resolveTargetUserId(): Promise<string> {
  const user = await prisma.user.findUnique({ where: { email: TARGET_USER_EMAIL }, select: { id: true } });
  if (!user) {
    throw new Error(`No user found with email ${TARGET_USER_EMAIL}. Sign up first, then re-run this script.`);
  }
  return user.id;
}

/** Removes everything a previous run created; cascades from the store down to orders and deliveries. */
async function resetSeededData(): Promise<void> {
  const { count } = await prisma.store.deleteMany({ where: { slug: { startsWith: DEV_SLUG_PREFIX } } });
  if (count > 0) {
    console.log(`Removed ${count} previously seeded store(s) and their orders/deliveries.`);
  }
}

async function applyCollectorPreferences(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      baseCurrencyCode: BASE_CURRENCY,
      budgetAmount: BUDGET_AMOUNT_MINOR,
      budgetResetDayOfMonth: BUDGET_RESET_DAY,
      timezone: TIMEZONE,
      preferredCountryCode: "PE",
    },
  });

  await prisma.userPreferredProductType.deleteMany({ where: { userId } });
  await prisma.userPreferredProductType.createMany({
    data: ["manga", "figures", "trading_cards", "comics"].map((productTypeKey) => ({ userId, productTypeKey })),
    skipDuplicates: true,
  });
}

async function createStores(userId: string): Promise<Map<string, string>> {
  const storeIdsByKey = new Map<string, string>();

  for (const store of STORES) {
    const created = await prisma.store.create({
      data: {
        slug: `${DEV_SLUG_PREFIX}${store.key}`,
        name: store.name,
        searchName: normalizeStoreName(store.name),
        description: store.description,
        sellerType: store.sellerType,
        status: "APPROVED",
        visibility: "PUBLIC",
        isActive: true,
        isPrivate: false,
        hasStock: true,
        receivesOrders: true,
        countryCode: store.countryCode,
        averageRating: store.rating,
        reviewCount: store.reviewCount,
        createdByUserId: userId,
        approvedByUserId: userId,
        approvedAt: day("2026-01-05"),
        presences: { create: store.presences.map((presenceType) => ({ presenceType })) },
        contactChannels: { create: [{ type: store.contact.type, value: store.contact.value, isPrimary: true }] },
        addresses: store.address ? { create: [{ ...store.address, isPrimary: true }] } : undefined,
        importCountries: { create: store.importCountries.map((countryCode) => ({ countryCode })) },
        productTypeAssignments: { create: store.productTypes.map((productTypeKey) => ({ productTypeKey })) },
      },
      select: { id: true },
    });
    storeIdsByKey.set(store.key, created.id);
  }

  return storeIdsByKey;
}

/** Maps the item's display milestone to the persisted enum. */
function toItemDeliveryState(state: ItemDeliveryState): OrderItemDeliveryState {
  switch (state) {
    case "delivered":
      return "DELIVERED";
    case "in_transit":
      return "IN_TRANSIT";
    case "arrived_at_store":
      return "ARRIVED_AT_STORE";
    default:
      return "NONE";
  }
}

/**
 * Sequential per-day identifiers in the app's `ORD-yyyymmdd-nn` / `DLV-yyyymmdd-nn` shape.
 * Seeded rows must not collide with identifiers already in the database, so counters start above
 * whatever the target day already holds.
 */
function createIdentifierFactory(prefix: string, taken: Set<string>) {
  return (isoDate: string): string => {
    const compact = isoDate.replaceAll("-", "");
    for (let sequence = 1; sequence < 100; sequence += 1) {
      const candidate = `${prefix}-${compact}-${String(sequence).padStart(2, "0")}`;
      if (!taken.has(candidate)) {
        taken.add(candidate);
        return candidate;
      }
    }
    throw new Error(`Exhausted ${prefix} identifiers for ${isoDate}`);
  };
}

async function createOrders(userId: string, storeIdsByKey: Map<string, string>): Promise<void> {
  const existingOrderIds = new Set(
    (await prisma.order.findMany({ select: { humanReadableId: true } })).map((row) => row.humanReadableId),
  );
  const existingDeliveryIds = new Set(
    (await prisma.delivery.findMany({ select: { humanReadableId: true } })).map((row) => row.humanReadableId),
  );
  const nextOrderId = createIdentifierFactory("ORD", existingOrderIds);
  const nextDeliveryId = createIdentifierFactory("DLV", existingDeliveryIds);

  for (const seed of ORDERS) {
    const storeId = storeIdsByKey.get(seed.storeKey);
    if (!storeId) {
      throw new Error(`Unknown store key: ${seed.storeKey}`);
    }

    const status = seed.cancelled
      ? "CANCELLED"
      : deriveOrderStatus(seed.items.map((item, index) => ({ itemId: String(index), deliveryState: item.state })));

    const order = await prisma.order.create({
      data: {
        storeId,
        userId,
        humanReadableId: nextOrderId(seed.orderDate),
        orderDate: day(seed.orderDate),
        expectedDeliveryFrom: seed.expectedDeliveryFrom ? day(seed.expectedDeliveryFrom) : null,
        expectedDeliveryTo: seed.expectedDeliveryTo ? day(seed.expectedDeliveryTo) : null,
        currencyCode: seed.currencyCode,
        exchangeRate: EXCHANGE_RATES[seed.currencyCode],
        exchangeRateBaseCode: seed.fxUnreconciled ? null : BASE_CURRENCY,
        totalCost: seed.totalCost,
        note: seed.note,
        status,
        cancellationReason: seed.cancellationReason,
        items: {
          create: seed.items.map((item, index) => ({
            userId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            productTypeKey: item.productTypeKey,
            position: index,
            deliveryState: toItemDeliveryState(item.state),
          })),
        },
        payments: {
          create: seed.payments.map((payment) => ({ userId, amount: payment.amount, paymentDate: day(payment.date) })),
        },
        history: {
          create: [{ userId, eventType: "ORDER_CREATED", metadata: {} }],
        },
      },
      select: { id: true, items: { select: { id: true, position: true } } },
    });

    if (seed.cancelled) {
      await prisma.orderHistory.create({
        data: {
          orderId: order.id,
          userId,
          eventType: "ORDER_CANCELLED",
          metadata: { reason: seed.cancellationReason },
        },
      });
    }

    const itemIdByPosition = new Map(order.items.map((item) => [item.position, item.id]));

    for (const delivery of seed.deliveries ?? []) {
      await prisma.delivery.create({
        data: {
          humanReadableId: nextDeliveryId(delivery.deliveryDate),
          storeId,
          userId,
          status: delivery.status,
          deliveryDate: day(delivery.deliveryDate),
          expectedArrivalFrom: delivery.expectedArrivalFrom ? day(delivery.expectedArrivalFrom) : null,
          expectedArrivalTo: delivery.expectedArrivalTo ? day(delivery.expectedArrivalTo) : null,
          receivedDate: delivery.receivedDate ? day(delivery.receivedDate) : null,
          cost: delivery.cost,
          currencyCode: seed.currencyCode,
          exchangeRate: EXCHANGE_RATES[seed.currencyCode],
          exchangeRateBaseCode: BASE_CURRENCY,
          note: delivery.note,
          orderItems: {
            create: delivery.itemIndexes.map((position) => ({ orderItemId: itemIdByPosition.get(position)! })),
          },
        },
      });
    }
  }
}

async function main(): Promise<void> {
  const userId = await resolveTargetUserId();
  await resetSeededData();
  await applyCollectorPreferences(userId);
  const storeIdsByKey = await createStores(userId);
  await createOrders(userId, storeIdsByKey);

  const deliveries = await prisma.delivery.count({ where: { userId } });
  const orders = await prisma.order.count({ where: { userId } });
  console.log(`Seeded ${STORES.length} stores, ${ORDERS.length} orders for ${TARGET_USER_EMAIL}.`);
  console.log(`User now owns ${orders} orders and ${deliveries} deliveries in total.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
