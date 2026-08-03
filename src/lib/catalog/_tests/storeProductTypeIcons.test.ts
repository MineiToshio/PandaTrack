import { Tag } from "lucide-react";
import { describe, expect, it } from "vitest";
import { STORE_PRODUCT_TYPE_KEYS } from "../storeProductTypes";
import { getStoreProductTypeIcon, STORE_PRODUCT_TYPE_ICON_MAP } from "../storeProductTypeIcons";

describe("store product type icons", () => {
  it("maps every seeded catalog key, so no seeded type renders as the generic fallback", () => {
    // The map is the reason categories are recognisable at a glance in a dense list. A seeded key
    // missing from it is invisible as a bug: the row still renders, just with the wrong meaning.
    const unmapped = STORE_PRODUCT_TYPE_KEYS.filter((key) => STORE_PRODUCT_TYPE_ICON_MAP[key] === undefined);

    expect(unmapped).toEqual([]);
  });

  it("gives magazines an icon of its own rather than the generic tag", () => {
    expect(getStoreProductTypeIcon("magazines")).not.toBe(Tag);
  });

  it("falls back to the generic tag for an admin-authored key the map cannot know", () => {
    expect(getStoreProductTypeIcon("blu_rays")).toBe(Tag);
  });
});
