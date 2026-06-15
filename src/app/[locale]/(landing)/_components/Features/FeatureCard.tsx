import type { CSSProperties, ReactNode } from "react";

type FeatureCardProps = {
  /** Icon-tile accent color (a `--accent*` / status token). */
  tile: string;
  icon: ReactNode;
  title: string;
  description: string;
};

/** Feature card (`.mk-feature-card`): tinted icon-tile + title + copy. */
export default function FeatureCard({ tile, icon, title, description }: FeatureCardProps) {
  return (
    <article className="mk-feature-card">
      <span className="mk-icon-tile" style={{ "--tile": tile } as CSSProperties}>
        {icon}
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  );
}
