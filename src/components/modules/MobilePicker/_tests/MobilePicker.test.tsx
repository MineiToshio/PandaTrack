import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Disc } from "lucide-react";
import { MobilePicker } from "@/components/modules/MobilePicker";

const options = [
  { value: "music", label: "Música", icon: <Disc /> },
  { value: "manga", label: "Manga", icon: <Disc /> },
  { value: "figure", label: "Figura", icon: <Disc /> },
  { value: "card", label: "Trading Cards", icon: <Disc /> },
  { value: "video", label: "Vídeo", icon: <Disc /> },
  { value: "other", label: "Otro", icon: <Disc /> },
];

describe("MobilePicker", () => {
  it("renders title and all options", () => {
    render(
      <MobilePicker
        open
        onOpenChange={() => null}
        title="Tipo de producto"
        options={options}
        selectedValue={null}
        onSelect={() => null}
      />,
    );
    expect(screen.getByText("Tipo de producto")).toBeTruthy();
    expect(screen.getByRole("option", { name: /Música/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Trading Cards/ })).toBeTruthy();
  });

  it("invokes onSelect and closes on row tap", () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <MobilePicker
        open
        onOpenChange={onOpenChange}
        title="Tipo"
        options={options}
        selectedValue={null}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("option", { name: /Manga/ }));
    expect(onSelect).toHaveBeenCalledWith("manga");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders search input when searchable and filters by query", () => {
    render(
      <MobilePicker
        open
        onOpenChange={() => null}
        title="Tipo"
        searchPlaceholder="Buscar tipo…"
        options={options}
        selectedValue={null}
        onSelect={() => null}
      />,
    );
    const input = screen.getByPlaceholderText("Buscar tipo…");
    fireEvent.change(input, { target: { value: "mang" } });
    expect(screen.getByRole("option", { name: /Manga/ })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Música/ })).toBeNull();
  });

  it("renders selected option with aria-selected", () => {
    render(
      <MobilePicker
        open
        onOpenChange={() => null}
        title="Tipo"
        options={options}
        selectedValue="music"
        onSelect={() => null}
      />,
    );
    const selected = screen.getByRole("option", { name: /Música/ });
    expect(selected.getAttribute("aria-selected")).toBe("true");
  });

  it("renders inlineAction with href", () => {
    render(
      <MobilePicker
        open
        onOpenChange={() => null}
        title="Tiendas"
        options={[]}
        selectedValue={null}
        onSelect={() => null}
        emptyLabel="Sin tiendas"
        inlineAction={{ label: "Crear nueva tienda", href: "/es/stores/new?returnTo=order-create" }}
      />,
    );
    const link = screen.getByRole("link", { name: /Crear nueva tienda/ });
    expect(link.getAttribute("href")).toBe("/es/stores/new?returnTo=order-create");
  });

  it("respects disabled option", () => {
    const onSelect = vi.fn();
    render(
      <MobilePicker
        open
        onOpenChange={() => null}
        title="Tipo"
        options={[{ value: "x", label: "Bloqueada", disabled: true }, ...options]}
        selectedValue={null}
        onSelect={onSelect}
      />,
    );
    const row = screen.getByRole("option", { name: /Bloqueada/ });
    expect(row.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(row);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("renders empty state when options.length === 0", () => {
    render(
      <MobilePicker
        open
        onOpenChange={() => null}
        title="Tiendas"
        options={[]}
        selectedValue={null}
        onSelect={() => null}
        emptyLabel="Sin tiendas"
      />,
    );
    expect(screen.getByText("Sin tiendas")).toBeTruthy();
  });
});
