import Image from "next/image";
import { Store } from "lucide-react";
import { cn } from "@/lib/styles";
import type { CSSProperties } from "react";

export type StoreAvatarSize = 24 | 32 | 40 | 56;

export type StoreLogo = {
  src: string;
  /** `square` → cover; `rectangle` → contain + 12.5% padding; `alpha` → contain on --surface-elevated. */
  aspect: "square" | "rectangle" | "alpha";
  /** Alt text. Use `""` when store name is rendered adjacent (avoids SR duplication). */
  alt?: string;
};

export type StoreAvatarProps = (
  | { store: { name: string; logo?: never } }
  | { store: { name: string; logo: StoreLogo } }
) & {
  size: StoreAvatarSize;
  /** Surface context hint for future token adjustments. Default `auto`. */
  surfaceContext?: "auto" | "elevated";
  className?: string;
};

/** Maps size to letter font-size token (ADR 0001 D16). */
const LETTER_FONT_SIZES: Record<StoreAvatarSize, string> = {
  24: "var(--text-eyebrow)",
  32: "var(--text-caption)",
  40: "var(--text-body)",
  56: "var(--text-subtitle)",
};

/** Maps size to placeholder icon size (roughly 45% of container). */
const ICON_SIZES: Record<StoreAvatarSize, number> = {
  24: 11,
  32: 14,
  40: 18,
  56: 25,
};

/** Extracts first Unicode letter from a store name. Returns `""` when none found. */
function getStoreInitial(name: string): string {
  const match = name.trim().match(/\p{L}/u);
  return match ? match[0].toUpperCase() : "";
}

/**
 * Identifies a store visually: logo when available, letter monogram as fallback.
 * Sizes: 24 / 32 / 40 (canonical) / 56. Radius: pill on mobile, --radius-lg on desktop.
 * ADR 0001 D16.
 */
export default function StoreAvatar({
  store,
  size,
  surfaceContext: _surfaceContext = "auto",
  className,
}: StoreAvatarProps) {
  const hasLogo = "logo" in store && store.logo != null;

  const containerStyle: CSSProperties = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    flexShrink: 0,
  };

  const baseContainerClass = cn(
    "inline-flex items-center justify-center overflow-hidden",
    "rounded-full md:rounded-[var(--radius-lg)]",
    className,
  );

  if (hasLogo) {
    const { src, aspect, alt = "" } = (store as { name: string; logo: StoreLogo }).logo;
    return (
      <span
        className={cn(baseContainerClass, "[background:var(--surface-elevated)] [border:1px_solid_var(--border)]")}
        style={containerStyle}
        role="img"
        aria-label={store.name}
      >
        <span className="relative block h-full w-full">
          <Image
            src={src}
            alt={alt}
            fill
            className={cn(
              aspect === "square" && "object-cover",
              (aspect === "rectangle" || aspect === "alpha") && "object-contain p-[12.5%]",
            )}
            sizes={`${size}px`}
          />
        </span>
      </span>
    );
  }

  const initial = getStoreInitial(store.name);

  if (!initial) {
    // Neutral placeholder when no valid letter is found
    return (
      <span
        className={cn(
          baseContainerClass,
          "[color:var(--text-muted)] [background:var(--surface-elevated)] [border:1px_solid_var(--border)]",
        )}
        style={containerStyle}
        role="img"
        aria-label={store.name || "Tienda"}
      >
        <Store size={ICON_SIZES[size]} aria-hidden="true" />
      </span>
    );
  }

  return (
    <span
      className={cn(baseContainerClass, "select-none")}
      style={{
        ...containerStyle,
        background: "color-mix(in oklch, var(--accent) 14%, var(--surface-elevated))",
        border: "1px solid color-mix(in oklch, var(--accent) 28%, var(--border))",
        color: "var(--accent)",
        fontFamily: "var(--font-display)",
        fontWeight: "var(--font-weight-semibold)",
        fontSize: LETTER_FONT_SIZES[size],
        lineHeight: 1,
      }}
      role="img"
      aria-label={store.name}
    >
      {initial}
    </span>
  );
}
