import { getCollectorCountryFlagEmoji } from "@/lib/catalog/collectorCountries";
import { cn } from "@/lib/styles";

type CollectorCountryFlagEmojiProps = {
  countryCode: string;
  className?: string;
};

/**
 * Decorative flag emoji for a collector country. Pair with translated country name for accessible labels.
 */
export default function CollectorCountryFlagEmoji({ countryCode, className }: CollectorCountryFlagEmojiProps) {
  const emoji = getCollectorCountryFlagEmoji(countryCode);
  if (!emoji) {
    return null;
  }

  return (
    <span aria-hidden className={cn("text-[1.22em] leading-none", className)}>
      {emoji}
    </span>
  );
}
