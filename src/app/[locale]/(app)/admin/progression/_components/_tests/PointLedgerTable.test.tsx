import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PointLedgerEntryDto } from "@/lib/data/progression/progressionQueries";

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));

import PointLedgerTable from "../PointLedgerTable";

function buildEntry(overrides: Partial<PointLedgerEntryDto> = {}): PointLedgerEntryDto {
  return {
    id: "entry-1",
    ruleKey: "order-created",
    entityType: "order",
    entityId: "order-abc",
    points: 5,
    occurredOn: new Date("2026-08-20T00:00:00.000Z"),
    source: "LIVE",
    createdAt: new Date("2026-08-20T14:03:00.000Z"),
    voidedAt: null,
    voidedReason: null,
    voidedByUserId: null,
    ...overrides,
  };
}

async function renderTable(entries: PointLedgerEntryDto[]) {
  render(await PointLedgerTable({ entries, locale: "es" }));
}

describe("PointLedgerTable", () => {
  it("renders one row per entry with its stored rule key, entity id and points", async () => {
    await renderTable([
      buildEntry({ id: "a", ruleKey: "order-created", entityId: "order-a", points: 5 }),
      buildEntry({ id: "b", ruleKey: "delivery-received", entityId: "delivery-b", points: 12 }),
    ]);

    const rows = screen.getAllByRole("row");
    // One header row plus one row per entry.
    expect(rows).toHaveLength(3);
    expect(screen.getByText("order-created")).toBeTruthy();
    expect(screen.getByText("delivery-received")).toBeTruthy();
    expect(screen.getByText("order-a")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
  });

  it("orders rows by the civil day the fact happened, exposed raw for verification", async () => {
    await renderTable([
      buildEntry({ id: "a", occurredOn: new Date("2026-08-20T00:00:00.000Z") }),
      buildEntry({ id: "b", occurredOn: new Date("2026-08-01T00:00:00.000Z") }),
    ]);

    const stamps = screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.getAttribute("data-occurred-on"));
    expect(stamps).toEqual(["2026-08-20T00:00:00.000Z", "2026-08-01T00:00:00.000Z"]);
  });

  it("marks a voided entry and shows the reason it was voided for", async () => {
    await renderTable([
      buildEntry({
        id: "a",
        voidedAt: new Date("2026-08-22T10:00:00.000Z"),
        voidedReason: "Points farmed through a self-created store",
        voidedByUserId: "admin-1",
      }),
    ]);

    expect(screen.getByText("progression.ledger.voided")).toBeTruthy();
    expect(screen.getByText("Points farmed through a self-created store")).toBeTruthy();
    expect(screen.queryByText("progression.ledger.live")).toBeNull();
  });

  it("marks a live entry as live and shows no reason", async () => {
    await renderTable([buildEntry()]);

    expect(screen.getByText("progression.ledger.live")).toBeTruthy();
    expect(screen.queryByText("progression.ledger.voided")).toBeNull();
  });

  it("renders the backfill origin distinctly from the live one", async () => {
    await renderTable([buildEntry({ id: "a", source: "BACKFILL" })]);

    expect(screen.getByText("progression.sources.BACKFILL")).toBeTruthy();
  });

  it("exposes an accessible caption and a header per column", async () => {
    await renderTable([buildEntry()]);

    const table = screen.getByRole("table");
    expect(within(table).getByText("progression.ledger.tableLabel")).toBeTruthy();
    expect(screen.getAllByRole("columnheader")).toHaveLength(6);
  });

  it("renders no monetary figure anywhere", async () => {
    await renderTable([buildEntry({ points: 5 })]);

    // The layer prices recordkeeping, never spending; a currency symbol here would mean a money
    // field reached a surface that has no business reading one.
    expect(screen.getByRole("table").textContent).not.toMatch(/S\/|\$|€/);
  });
});
