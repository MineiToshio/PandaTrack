import type { ReactNode } from "react";
import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";

type AppPlaceholderPageProps = {
  title: ReactNode;
  description: ReactNode;
  headingAs?: "h1" | "h2";
};

export default function AppPlaceholderPage({ title, description, headingAs = "h2" }: AppPlaceholderPageProps) {
  return (
    <div className="text-foreground px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <Heading as={headingAs} size="sm" className="text-text-title">
          {title}
        </Heading>
        <Typography size="md" className="text-text-body mt-2">
          {description}
        </Typography>
      </div>
    </div>
  );
}
