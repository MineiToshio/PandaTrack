import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SectionCard from "@/components/core/SectionCard";

describe("SectionCard", () => {
  it("renders title and body when not collapsible", () => {
    render(
      <SectionCard title="Title" eyebrow="EYEBROW">
        <p>body</p>
      </SectionCard>,
    );
    expect(screen.getByText("Title")).toBeTruthy();
    expect(screen.getByText("EYEBROW")).toBeTruthy();
    expect(screen.getByText("body")).toBeTruthy();
  });

  it("hides body when collapsible and defaultOpen=false", () => {
    render(
      <SectionCard title="X" collapsible defaultOpen={false}>
        <p>hidden</p>
      </SectionCard>,
    );
    expect(screen.queryByText("hidden")).toBeNull();
  });

  it("toggles body when header is clicked", () => {
    render(
      <SectionCard title="X" collapsible defaultOpen={false}>
        <p>toggle</p>
      </SectionCard>,
    );
    const header = screen.getByRole("button");
    fireEvent.click(header);
    expect(screen.getByText("toggle")).toBeTruthy();
  });

  it("renders summary when collapsed and not active", () => {
    render(
      <SectionCard title="X" summary="ready" collapsible defaultOpen={false}>
        <p>body</p>
      </SectionCard>,
    );
    expect(screen.getByText("ready")).toBeTruthy();
  });
});
