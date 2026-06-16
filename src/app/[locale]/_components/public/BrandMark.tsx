import Link from "next/link";
import { cn } from "@/lib/styles";
import Logo from "@/components/core/Logo";

type BrandMarkProps = {
  /** When set, renders a link to this href (e.g. the localized home). Otherwise a plain span. */
  href?: string;
  /** Accessible label for the link (e.g. "PandaTrack, go to home"). */
  ariaLabel?: string;
  className?: string;
};

/** Public wordmark. Shared by the marketing header, minibar, and footer. */
export default function BrandMark({ href, ariaLabel, className }: BrandMarkProps) {
  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} className={cn("inline-flex flex-shrink-0 items-center", className)}>
        <Logo />
      </Link>
    );
  }

  return <Logo className={className} />;
}
