import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import IconButton from "@/components/core/IconButton";
import { buttonVariants } from "@/components/core/Button/buttonVariants";

/**
 * `IconButton` is the icon-only sibling of `Button`, and the two sit in the same toolbars. Their
 * secondary skin diverged for a long time — `IconButton` filled with `--surface` and edged with
 * `--border`, `Button` with `--surface-elevated` and `--border-strong` — which reads as two
 * different controls side by side and, on the `--surface-elevated` sidebar, made the fill the wrong
 * one twice over. `docs/design/visual-foundations.md` settles it: inputs, selects, secondary buttons
 * and chips fill with `--surface-elevated`, and a border doing real separating work escalates to
 * `--border-strong`. This pins the two components to the same answer.
 */
const SURFACE_TOKEN = /(?:bg-\[|\[background:)var\((--surface[a-z-]*)\)\]/;
const BORDER_TOKEN = /\[border:1px_solid_var\((--border[a-z-]*)\)\]/;

function tokensOf(classNames: string) {
  return {
    surface: classNames.match(SURFACE_TOKEN)?.[1] ?? null,
    border: classNames.match(BORDER_TOKEN)?.[1] ?? null,
  };
}

describe("IconButton", () => {
  it.each(["secondary", "outline"] as const)(
    "gives its %s skin the same surface and border tokens as Button's secondary",
    (variant) => {
      render(<IconButton aria-label="Close" variant={variant} />);
      const iconButton = tokensOf(screen.getByRole("button", { name: "Close" }).className);
      const button = tokensOf(buttonVariants({ variant: "secondary" }));

      expect(button.surface, "Button's secondary must declare a surface token").toBe("--surface-elevated");
      expect(button.border, "Button's secondary must declare a border token").toBe("--border-strong");
      expect(iconButton.surface).toBe(button.surface);
      expect(iconButton.border).toBe(button.border);
    },
  );
});
