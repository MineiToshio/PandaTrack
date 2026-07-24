import { ShieldOff } from "lucide-react";
import EmptyState from "@/components/modules/EmptyState";

type AdminAccessDeniedProps = {
  title: string;
  description: string;
};

/**
 * Refusal panel for the admin space (FDD-02 screen 10). Presentational and data-free: it renders an
 * icon, a short heading, and a line explaining the area is administrators-only, and never shows any
 * moderation surface. The layout redirects a refused caller to the collector dashboard as the
 * effective behavior; this panel is the rendered fallback for a direct hit that is not redirected.
 * Copy is resolved by the caller against the `admin` namespace so all admin copy stays there.
 */
export default function AdminAccessDenied({ title, description }: AdminAccessDeniedProps) {
  return (
    <EmptyState
      appearance="page"
      role="status"
      headingAs="h1"
      icon={<ShieldOff className="h-8 w-8" aria-hidden />}
      iconTone="warning"
      title={title}
      subtitle={description}
    />
  );
}
