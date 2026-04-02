import { z } from "zod";
import { createStoreSchema } from "../../../new/_schemas/createStoreSchema";

export const editStoreSchema = z.object({
  slug: z.string().min(1, "storeUnavailable"),
  locale: z.string().min(2),
  name: createStoreSchema.shape.name,
  description: z.string().max(2000).trim().optional().nullable(),
  storeType: createStoreSchema.shape.storeType,
  countryCode: createStoreSchema.shape.countryCode,
  presenceTypes: createStoreSchema.shape.presenceTypes,
  productTypeKeys: createStoreSchema.shape.productTypeKeys,
  hasStock: z.boolean().optional().nullable(),
  receivesOrders: z.boolean().optional().nullable(),
  contactChannels: createStoreSchema.shape.contactChannels,
  addresses: createStoreSchema.shape.addresses,
  importCountries: createStoreSchema.shape.importCountries,
  logoAction: createStoreSchema.shape.logoAction,
  logoCropArea: createStoreSchema.shape.logoCropArea,
  comment: z.string().max(500, "commentTooLong").trim().optional().nullable(),
});

export type EditStoreInput = z.infer<typeof editStoreSchema>;
