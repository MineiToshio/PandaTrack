import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HowItWorksGuide, { type HowItWorksBlock } from "../HowItWorksGuide";
import { HOW_IT_WORKS_BLOCK_KEYS } from "../../_utils/howItWorksBlocks";

/**
 * What matters here is not the styling but the shape a reader gets: every rule announced as a real
 * heading, and every rule followed by its reason. A block that silently dropped its `why` would
 * still look fine on a screenshot and would have turned the page back into a list of decrees.
 */

const BLOCKS: HowItWorksBlock[] = HOW_IT_WORKS_BLOCK_KEYS.map((key) => ({
  key,
  title: `Rule ${key}`,
  body: `What ${key} does`,
  why: `Why ${key} exists`,
}));

describe("HowItWorksGuide", () => {
  it("renders every rule as a heading, with what it does and why it exists", () => {
    render(<HowItWorksGuide blocks={BLOCKS} />);

    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(HOW_IT_WORKS_BLOCK_KEYS.length);

    for (const block of BLOCKS) {
      expect(screen.getByRole("heading", { level: 2, name: block.title })).toBeTruthy();
      expect(screen.getByText(block.body)).toBeTruthy();
      expect(screen.getByText(block.why)).toBeTruthy();
    }
  });

  it("keeps the block glyphs out of the accessible name of their heading", () => {
    render(<HowItWorksGuide blocks={[BLOCKS[0]]} />);

    const heading = screen.getByRole("heading", { level: 2, name: BLOCKS[0].title });
    expect(heading.textContent).toBe(BLOCKS[0].title);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });
});
