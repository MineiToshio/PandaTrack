import type { ReactNode } from "react";
import AppPageHero from "@/components/modules/AppPageHero";

type AppPlaceholderPageProps = {
  eyebrow: ReactNode;
  title: ReactNode;
  description: ReactNode;
};

export default function AppPlaceholderPage({ eyebrow, title, description }: AppPlaceholderPageProps) {
  return (
    <div className="text-foreground">
      <AppPageHero eyebrow={eyebrow} title={title} description={description} />
    </div>
  );
}
