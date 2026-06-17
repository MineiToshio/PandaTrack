import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import UserAvatarHero from "../UserAvatarHero";

describe("UserAvatarHero", () => {
  it("renders the first letter of the display name when no image is provided", () => {
    render(<UserAvatarHero displayName="Vinyl Hunter" />);
    expect(screen.getByText("V")).toBeTruthy();
  });

  it("uppercases the initial letter regardless of input casing", () => {
    render(<UserAvatarHero displayName="ada" />);
    expect(screen.getByText("A")).toBeTruthy();
  });

  it("falls back to '?' when display name is empty or null", () => {
    render(<UserAvatarHero displayName={null} />);
    expect(screen.getByText("?")).toBeTruthy();
  });

  it("renders an image when imageUrl is provided", () => {
    render(<UserAvatarHero displayName="Vinyl Hunter" imageUrl="/test.png" alt="avatar" />);
    const images = screen.getAllByRole("img");
    expect(images.length).toBeGreaterThan(0);
  });

  it("falls back to the initial when the image fails to load", () => {
    render(<UserAvatarHero displayName="Vinyl Hunter" imageUrl="/broken.png" alt="avatar" />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByText("V")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });
});
