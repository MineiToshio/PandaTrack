import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EmptyState from "../EmptyState";

describe("EmptyState", () => {
  it("renders the card appearance with the requested heading level", () => {
    render(<EmptyState appearance="card" headingAs="h2" title="No orders" subtitle="Add your first" />);
    expect(screen.getByRole("heading", { level: 2, name: "No orders" })).toBeTruthy();
    expect(screen.getByText("Add your first")).toBeTruthy();
  });

  it("renders the page appearance as an alert with an h1 and a mono eyebrow", () => {
    render(
      <EmptyState
        appearance="page"
        role="alert"
        headingAs="h1"
        iconTone="destructive"
        eyebrow="Error 404"
        title="This page doesn't exist"
        subtitle="It may have moved"
      />,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "This page doesn't exist" })).toBeTruthy();
    expect(screen.getByText("Error 404")).toBeTruthy();
  });

  it("renders provided actions", () => {
    render(<EmptyState appearance="card" title="Empty" actions={<button type="button">Create</button>} />);
    expect(screen.getByRole("button", { name: "Create" })).toBeTruthy();
  });

  it("supports the warning tone on the page appearance without throwing", () => {
    render(<EmptyState appearance="page" iconTone="warning" title="Offline" />);
    expect(screen.getByRole("heading", { name: "Offline" })).toBeTruthy();
  });
});
