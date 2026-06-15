import type { CSSProperties, ReactNode } from "react";

type ProblemCardProps = {
  index: string;
  /** Icon-tile + bottom-bar color (a `--accent*` / status token). */
  tile: string;
  icon: ReactNode;
  title: string;
  description: string;
};

/**
 * User-fit problem card (`.mk-fit-card`): index + icon-tile + copy + bottom bar
 * in the card's `--tile` color that grows to full width on hover.
 */
export default function ProblemCard({ index, tile, icon, title, description }: ProblemCardProps) {
  return (
    <article className="mk-fit-card" style={{ "--tile": tile } as CSSProperties}>
      <span className="mk-fit-index" aria-hidden="true">
        {index}
      </span>
      <span className="mk-icon-tile">{icon}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="mk-fit-bar" aria-hidden="true" />
    </article>
  );
}
