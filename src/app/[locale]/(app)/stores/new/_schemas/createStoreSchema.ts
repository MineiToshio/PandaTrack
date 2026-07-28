import { z } from "zod";
import { storeLogoActionSchema } from "@/lib/store/logoShared";

// Upper bounds on array inputs so a crafted payload cannot flood the create-store mutation.
const MAX_PRESENCE_TYPES = 2;
const MAX_PRODUCT_TYPE_KEYS = 50;
const MAX_CONTACT_CHANNELS = 50;
const MAX_ADDRESSES = 50;
const MAX_IMPORT_COUNTRIES = 300;

const sellerTypeEnum = z.enum(["RETAILER", "PERSON", "PROXY"]);
const presenceTypeEnum = z.enum(["ONLINE", "PHYSICAL"]);
const contactChannelTypeEnum = z.enum([
  "INSTAGRAM",
  "WHATSAPP",
  "EMAIL",
  "PHONE",
  "WEBSITE",
  "FACEBOOK",
  "TIKTOK",
  "OTHER",
]);

const URL_PROTOCOLS = new Set(["http:", "https:"]);
const PHONE_REGEX = /^\+?[0-9().\-\s]{7,24}$/;

const tryParseUrl = (value: string) => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const hasValidWebProtocol = (url: URL) => URL_PROTOCOLS.has(url.protocol);

const matchesHost = (url: URL, acceptedHosts: string[]) =>
  acceptedHosts.some((acceptedHost) => url.hostname === acceptedHost || url.hostname.endsWith(`.${acceptedHost}`));

const hasEnoughPhoneDigits = (value: string) => value.replace(/\D/g, "").length >= 7;

const contactChannelSchema = z
  .object({
    type: contactChannelTypeEnum,
    value: z.string().min(1, "contactValueRequired").max(500).trim(),
    label: z.string().max(100).trim().optional().nullable(),
  })
  .superRefine((channel, ctx) => {
    const normalizedValue = channel.value.trim();

    if (normalizedValue.length === 0) {
      return;
    }

    if (channel.type === "EMAIL") {
      const parsedEmail = z.email().safeParse(normalizedValue);
      if (!parsedEmail.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["value"],
          message: "contactValueInvalidEmail",
        });
      }
      return;
    }

    if (channel.type === "PHONE") {
      if (!PHONE_REGEX.test(normalizedValue) || !hasEnoughPhoneDigits(normalizedValue)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["value"],
          message: "contactValueInvalidPhone",
        });
      }
      return;
    }

    if (channel.type === "OTHER") {
      return;
    }

    const parsedUrl = tryParseUrl(normalizedValue);
    if (!parsedUrl || !hasValidWebProtocol(parsedUrl)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message:
          channel.type === "WHATSAPP"
            ? "contactValueInvalidWhatsApp"
            : channel.type === "INSTAGRAM"
              ? "contactValueInvalidInstagram"
              : channel.type === "FACEBOOK"
                ? "contactValueInvalidFacebook"
                : channel.type === "TIKTOK"
                  ? "contactValueInvalidTikTok"
                  : "contactValueInvalidWebsite",
      });
      return;
    }

    if (channel.type === "WHATSAPP" && !matchesHost(parsedUrl, ["wa.me", "whatsapp.com"])) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "contactValueInvalidWhatsApp",
      });
      return;
    }

    if (channel.type === "INSTAGRAM" && !matchesHost(parsedUrl, ["instagram.com"])) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "contactValueInvalidInstagram",
      });
      return;
    }

    if (channel.type === "FACEBOOK" && !matchesHost(parsedUrl, ["facebook.com", "fb.com"])) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "contactValueInvalidFacebook",
      });
      return;
    }

    if (channel.type === "TIKTOK" && !matchesHost(parsedUrl, ["tiktok.com"])) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "contactValueInvalidTikTok",
      });
    }
  });

const addressSchema = z.object({
  city: z.string().max(100).trim().optional().nullable(),
  addressLine: z.string().min(1, "addressLineRequired").max(300).trim(),
  reference: z.string().max(200).trim().optional().nullable(),
  isPrimary: z.boolean().optional(),
});

export const createStoreShape = {
  name: z.string().min(1, "nameRequired").max(200, "nameTooLong").trim(),
  description: z.string().max(2000).trim().optional().nullable(),
  sellerType: sellerTypeEnum,
  countryCode: z.string().length(2, "countryInvalid").toUpperCase(),
  presenceTypes: z.array(presenceTypeEnum).min(1, "presenceRequired").max(MAX_PRESENCE_TYPES),
  // A PROXY has no catalog of its own, so at least one product type is required only for the other seller types
  // (enforced in `refineProductTypesForCatalogSellers`).
  productTypeKeys: z.array(z.string().min(1)).max(MAX_PRODUCT_TYPE_KEYS).optional().default([]),
  hasStock: z.boolean().optional().nullable(),
  receivesOrders: z.boolean().optional().nullable(),
  isPrivate: z.boolean().optional().default(false),
  contactChannels: z.array(contactChannelSchema).max(MAX_CONTACT_CHANNELS).optional().default([]),
  addresses: z.array(addressSchema).max(MAX_ADDRESSES).optional().default([]),
  importCountries: z.array(z.string().length(2).toUpperCase()).max(MAX_IMPORT_COUNTRIES).optional().default([]),
  logoAction: storeLogoActionSchema.default("keep"),
} as const;

const createStoreBaseSchema = z.object(createStoreShape);

type SellerTypeValue = "RETAILER" | "PERSON" | "PROXY";

/** Refinement enforcing, per ADR 0009, that `isPrivate` is only valid for PERSON. */
export const refinePrivateOnlyPerson = (
  input: { isPrivate?: boolean | null; sellerType: SellerTypeValue },
  ctx: z.RefinementCtx,
) => {
  if (input.isPrivate && input.sellerType !== "PERSON") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["isPrivate"],
      message: "isPrivateOnlyPerson",
    });
  }
};

/**
 * Refinement enforcing that at least one product type is provided for sellers that own a catalog
 * (RETAILER and PERSON). A PROXY is an intermediary with no catalog, so it may save with none.
 */
export const refineProductTypesForCatalogSellers = (
  input: { sellerType: SellerTypeValue; productTypeKeys?: string[] },
  ctx: z.RefinementCtx,
) => {
  if (input.sellerType !== "PROXY" && (input.productTypeKeys?.length ?? 0) === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["productTypeKeys"],
      message: "productTypeRequired",
    });
  }
};

export const createStoreSchema = createStoreBaseSchema
  .superRefine(refinePrivateOnlyPerson)
  .superRefine(refineProductTypesForCatalogSellers);

export type CreateStoreInput = z.infer<typeof createStoreSchema>;
