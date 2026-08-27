import Card from "@/components/core/Card";
import { HOW_IT_WORKS_BLOCK_ICONS, type HowItWorksBlockKey } from "../_utils/howItWorksBlocks";

export type HowItWorksBlock = {
  key: HowItWorksBlockKey;
  /** The rule, as a short heading. */
  title: string;
  /** What the rule does, in the collector's own terms. */
  body: string;
  /** Why the rule exists. Quieter than the body, and never optional: a rule with no reason reads as a whim. */
  why: string;
};

type HowItWorksGuideProps = {
  blocks: readonly HowItWorksBlock[];
};

/**
 * The explainer's body: one card per rule, each stating the rule and then, in a quieter line, the
 * reason it exists.
 *
 * Server-rendered and entirely presentational, so the page above it only has to resolve copy. Two
 * columns from `lg` up, one below: six cards in a single column on a wide screen would push the
 * last rule below the fold of a page whose whole promise is that it reads in a minute.
 */
export default function HowItWorksGuide({ blocks }: HowItWorksGuideProps) {
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-[var(--space-4)] p-0 lg:grid-cols-2 lg:gap-[var(--space-5)]">
      {blocks.map((block) => {
        const Icon = HOW_IT_WORKS_BLOCK_ICONS[block.key];
        return (
          <li key={block.key} className="h-full">
            <Card as="article" variant="elevated" padding="lg" className="flex h-full flex-col gap-[var(--space-3)]">
              <header className="flex items-center gap-[var(--space-3)]">
                {/* The Modal's tonal icon circle at a smaller size: one recipe for "an icon that
                    belongs to a heading", so this page does not invent a second one. */}
                <span
                  aria-hidden="true"
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-full [color:var(--accent)] [background:color-mix(in_oklch,var(--accent)_14%,var(--surface-elevated))]"
                >
                  <Icon className="size-4" />
                </span>
                <h2 className="text-text-title m-0 [font-size:var(--text-body)] [font-weight:var(--font-weight-semibold)]">
                  {block.title}
                </h2>
              </header>

              <p className="text-text-body m-0 [font-size:var(--text-body)]">{block.body}</p>

              <p className="text-text-muted border-border m-0 mt-auto border-t pt-[var(--space-3)] [font-size:var(--text-caption)]">
                {block.why}
              </p>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
