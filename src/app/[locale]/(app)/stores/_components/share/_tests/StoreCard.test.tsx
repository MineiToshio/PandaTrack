import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

// Same stubs `OrderCard.test.tsx` uses: the link pulls the app router in and the avatar pulls
// image handling in, neither of which this card's own logic depends on. The plain anchor keeps the
// accessible-name assertions honest, since that is where the private state has to land.
vi.mock("@/components/core/ViewTransitionLink", () => ({
  default: ({ children, ...props }: { children?: ReactNode }) => <a {...props}>{children}</a>,
}));
vi.mock("@/components/core/StoreAvatar", () => ({
  default: () => <span data-testid="store-avatar" />,
}));

import StoreCard, { type StoreCardLabels } from "../StoreCard";
import type { PublicStoreListingItem } from "@/lib/data/stores/storeQueries";

const VIEWER_ID = "user-1";

const LABELS: StoreCardLabels = {
  importCountriesLabel: "Importa de ·",
  noImportCountries: "Sin países de importación declarados",
  countryName: (code) => (code === "PE" ? "Perú" : code),
  productTypeLabel: (key) => key,
  ratingCount: (count) => `${count} reseñas`,
  ratingFallback: "Sin reseñas",
  ordersForViewerLabel: "tus pedidos",
  moreCategories: (count) => `+${count} más`,
  privateMarker: "Privada",
  ariaLabel: (name) => `Ver detalle de ${name}`,
  ariaLabelPrivateSuffix: ", tienda privada",
};

function makeStore(overrides: Partial<PublicStoreListingItem> = {}): PublicStoreListingItem {
  return {
    slug: "kyle-mendoza",
    name: "Kyle Mendoza",
    countryCode: "PE",
    status: "PENDING",
    isPrivate: false,
    createdByUserId: VIEWER_ID,
    sellerType: "PERSON",
    logoUrl: null,
    presenceTypes: ["ONLINE"],
    productTypeKeys: ["manga"],
    importCountryCodes: [],
    contactChannels: [],
    receivesOrders: null,
    hasStock: null,
    averageRating: null,
    reviewCount: 0,
    ...overrides,
  };
}

function renderCard(store: PublicStoreListingItem, viewerId: string | null = VIEWER_ID) {
  return render(<StoreCard store={store} locale="es" labels={LABELS} viewerId={viewerId} />);
}

describe("StoreCard private marker", () => {
  it("marks a private store the viewer created", () => {
    renderCard(makeStore({ isPrivate: true }));

    expect(screen.getByText("Privada")).toBeInTheDocument();
  });

  it("does not mark a public store", () => {
    renderCard(makeStore({ isPrivate: false }));

    expect(screen.queryByText("Privada")).not.toBeInTheDocument();
  });

  /**
   * The listing cannot hand this card somebody else's private store today, but the marker asserts
   * something about the *viewer* ("this one is yours and hidden"), so it is keyed on ownership
   * rather than on the flag alone. The store detail page gets this wrong: it renders "Privada,
   * solo tú la ves" to an admin looking at another user's store.
   */
  it("never marks a private store the viewer did not create", () => {
    renderCard(makeStore({ isPrivate: true, createdByUserId: "someone-else" }));

    expect(screen.queryByText("Privada")).not.toBeInTheDocument();
  });

  it("does not mark anything when there is no viewer", () => {
    renderCard(makeStore({ isPrivate: true }), null);

    expect(screen.queryByText("Privada")).not.toBeInTheDocument();
  });

  /**
   * The marker sits in the country band, which every card renders, precisely so it survives this
   * case: a store with no categories renders no chip row at all, and every store image intake
   * creates is exactly that (`productTypeKeys: []`).
   */
  it("still marks a private store that has no categories at all", () => {
    renderCard(makeStore({ isPrivate: true, productTypeKeys: [] }));

    expect(screen.getByText("Privada")).toBeInTheDocument();
  });
});

describe("StoreCard accessible name", () => {
  /**
   * The whole card is one link carrying an `aria-label`, and that label overrides the subtree for
   * assistive tech. So the visible marker is not announced on its own and the private state has to
   * be part of the label itself.
   */
  it("states the private condition in the link's accessible name", () => {
    renderCard(makeStore({ isPrivate: true }));

    expect(screen.getByRole("link", { name: "Ver detalle de Kyle Mendoza, tienda privada" })).toBeInTheDocument();
  });

  it("leaves the accessible name alone for a public store", () => {
    renderCard(makeStore({ isPrivate: false }));

    expect(screen.getByRole("link", { name: "Ver detalle de Kyle Mendoza" })).toBeInTheDocument();
  });
});

describe("StoreCard category overflow", () => {
  it("localizes the overflow pill instead of hardcoding Spanish", () => {
    renderCard(makeStore({ productTypeKeys: ["manga", "figures", "comics", "funkos", "books", "music"] }));

    expect(screen.getByText("+3 más")).toBeInTheDocument();
  });
});
