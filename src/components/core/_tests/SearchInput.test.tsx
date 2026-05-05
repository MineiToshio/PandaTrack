import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SearchInput from "@/components/core/SearchInput";

describe("SearchInput — submit behavior", () => {
  it("calls onSubmit when submit button is clicked", () => {
    const onSubmit = vi.fn();
    render(<SearchInput value="panda" onChange={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onSubmit).toHaveBeenCalledWith("panda");
  });

  it("calls onSubmit when Enter is pressed inside the input", () => {
    const onSubmit = vi.fn();
    render(<SearchInput value="bear" onChange={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter", code: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("bear");
  });

  it("does not call onSubmit when a non-Enter key is pressed", () => {
    const onSubmit = vi.fn();
    render(<SearchInput value="x" onChange={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "a", code: "KeyA" });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("SearchInput — loading state", () => {
  it("shows Loader2 spinner when isLoading is true", () => {
    render(<SearchInput value="" onChange={vi.fn()} onSubmit={vi.fn()} isLoading />);
    expect(document.querySelector(".animate-spin")).toBeTruthy();
  });

  it("does not show spinner when isLoading is false", () => {
    render(<SearchInput value="" onChange={vi.fn()} onSubmit={vi.fn()} isLoading={false} />);
    expect(document.querySelector(".animate-spin")).toBeNull();
  });

  it("sets aria-busy on the submit button when isLoading is true", () => {
    render(<SearchInput value="" onChange={vi.fn()} onSubmit={vi.fn()} isLoading />);
    expect(screen.getByRole("button").getAttribute("aria-busy")).toBe("true");
  });

  it("does not set aria-busy on the submit button when not loading", () => {
    render(<SearchInput value="" onChange={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button").getAttribute("aria-busy")).toBeNull();
  });
});

describe("SearchInput — accessibility", () => {
  it("renders a search landmark", () => {
    render(<SearchInput value="" onChange={vi.fn()} onSubmit={vi.fn()} searchLabel="Search stores" />);
    expect(screen.getByRole("search")).toBeTruthy();
  });

  it("uses searchLabel as aria-label on the submit button", () => {
    render(<SearchInput value="" onChange={vi.fn()} onSubmit={vi.fn()} searchLabel="Find items" />);
    expect(screen.getByRole("button", { name: "Find items" })).toBeTruthy();
  });
});
