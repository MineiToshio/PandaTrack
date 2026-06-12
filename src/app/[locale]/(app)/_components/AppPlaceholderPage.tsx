import type { ReactNode } from "react";
import AppPageHero from "@/components/modules/AppPageHero";

type AppPlaceholderPageProps = {
  eyebrow: ReactNode;
  title: ReactNode;
  description: ReactNode;
  /** Optional content rendered below the hero (e.g. a coming-soon card with CTAs). */
  children?: ReactNode;
};

export default function AppPlaceholderPage({ eyebrow, title, description, children }: AppPlaceholderPageProps) {
  return (
    <div className="text-foreground">
      <AppPageHero eyebrow={eyebrow} title={title} description={description} />
      {children}
    </div>
  );
}
