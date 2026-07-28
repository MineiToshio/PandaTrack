import { z } from "zod";
import {
  createStoreShape,
  refinePrivateOnlyPerson,
  refineProductTypesForCatalogSellers,
} from "../../../new/_schemas/createStoreSchema";

const editStoreBaseSchema = z.object({
  slug: z.string().min(1, "storeUnavailable"),
  locale: z.string().min(2),
  name: createStoreShape.name,
  description: z.string().max(2000).trim().optional().nullable(),
  sellerType: createStoreShape.sellerType,
  countryCode: createStoreShape.countryCode,
  presenceTypes: createStoreShape.presenceTypes,
  productTypeKeys: createStoreShape.productTypeKeys,
  hasStock: z.boolean().optional().nullable(),
  receivesOrders: z.boolean().optional().nullable(),
  isPrivate: createStoreShape.isPrivate,
  // Operational state. `false` marks the store as closed / no longer operating.
  isActive: z.boolean().optional(),
  contactChannels: createStoreShape.contactChannels,
  addresses: createStoreShape.addresses,
  importCountries: createStoreShape.importCountries,
  logoAction: createStoreShape.logoAction,
  comment: z.string().max(500, "commentTooLong").trim().optional().nullable(),
});

export const editStoreSchema = editStoreBaseSchema
  .superRefine(refinePrivateOnlyPerson)
  .superRefine(refineProductTypesForCatalogSellers);

export type EditStoreInput = z.infer<typeof editStoreSchema>;
