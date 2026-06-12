"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/styles";

export type UserAvatarHeroSize = "s40" | "s56" | "s72";

export type UserAvatarHeroProps = {
  /** Display name source for the initial letter fallback. */
  displayName: string | null | undefined;
  /** Optional uploaded image URL. When present, replaces the gradient fallback. */
  imageUrl?: string | null;
  size?: UserAvatarHeroSize;
  className?: string;
  /** Accessible alternative text when an image is rendered. */
  alt?: string;
};

const SIZE_PX: Record<UserAvatarHeroSize, number> = {
  s40: 40,
  s56: 56,
  s72: 72,
};

const SIZE_CLASSES: Record<UserAvatarHeroSize, string> = {
  s40: "size-10 text-[16px]",
  s56: "size-14 text-[22px]",
  s72: "size-[72px] text-[28px]",
};

function getInitial(displayName: string | null | undefined): string {
  const trimmed = (displayName ?? "").trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toLocaleUpperCase();
}

export default function UserAvatarHero({ displayName, imageUrl, size = "s56", className, alt }: UserAvatarHeroProps) {
  const [imgError, setImgError] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const pixelSize = SIZE_PX[size];
  const initial = getInitial(displayName);
  const hasImage = imageUrl != null && imageUrl.trim() !== "" && !imgError;

  // SSR-rendered images can fail before hydration attaches onError; detect that case on mount.
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth === 0) {
      setImgError(true);
    }
  }, []);

  return (
    <span
      className={cn(
        "relative inline-flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full",
        "[font-weight:var(--font-weight-bold)] [letter-spacing:0.5px] [color:var(--text-on-accent)]",
        "[background:linear-gradient(135deg,var(--accent),var(--accent-warm))]",
        "[box-shadow:0_6px_18px_color-mix(in_oklch,var(--accent)_35%,transparent),0_2px_4px_color-mix(in_oklch,var(--accent)_18%,transparent)]",
        SIZE_CLASSES[size],
        className,
      )}
      aria-hidden={hasImage ? undefined : "true"}
    >
      {hasImage ? (
        <Image
          ref={imgRef}
          src={imageUrl as string}
          alt={alt ?? ""}
          fill
          sizes={`${pixelSize}px`}
          className="object-cover"
          unoptimized
          onError={() => setImgError(true)}
        />
      ) : (
        <span>{initial}</span>
      )}
    </span>
  );
}
