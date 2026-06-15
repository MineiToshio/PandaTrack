import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/styles";

type BrandMarkProps = {
  /** When set, renders a link to this href (e.g. the localized home). Otherwise a plain span. */
  href?: string;
  /** Accessible label for the link (e.g. "PandaTrack, go to home"). */
  ariaLabel?: string;
  className?: string;
};

/**
 * Public brand lockup: gradient "P" tile + wordmark. Shared by the marketing
 * header, the public minibar (auth/legal) and the footer. Visual: `.mk-brand`.
 */
export default function BrandMark({ href, ariaLabel, className }: BrandMarkProps) {
  const content = (
    <>
      <span className="mk-brand-mark" aria-hidden="true">
        {APP_NAME.charAt(0)}
      </span>
      {APP_NAME}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cn("mk-brand", className)} aria-label={ariaLabel}>
        {content}
      </Link>
    );
  }

  return <span className={cn("mk-brand", className)}>{content}</span>;
}
