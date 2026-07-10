"use client";

import { cn } from "@/lib/styles";
import { User } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

export type AvatarSize = 24 | 32 | 40 | 56;

export type AvatarProps = {
  user: { name: string; image?: string };
  size: AvatarSize;
  ariaLabel?: string;
  className?: string;
};

const SIZE_MAP: Record<AvatarSize, { px: number; style: CSSProperties; iconSize: number }> = {
  24: { px: 24, style: { fontSize: "var(--text-eyebrow)", lineHeight: "1" }, iconSize: 12 },
  32: { px: 32, style: { fontSize: "var(--text-mono)", lineHeight: "1" }, iconSize: 14 },
  40: { px: 40, style: { fontSize: "var(--text-body)", lineHeight: "1" }, iconSize: 16 },
  56: { px: 56, style: { fontSize: "var(--text-subtitle)", lineHeight: "1" }, iconSize: 24 },
};

function getInitial(name: string): string | null {
  const match = name.match(/[a-zA-ZÀ-ÿ]/);
  if (match) return match[0].toUpperCase();
  const firstChar = name.trim()[0];
  return firstChar ?? null;
}

export default function Avatar({ user, size, ariaLabel, className }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const { px, style, iconSize } = SIZE_MAP[size];
  const resolvedLabel = ariaLabel ?? user.name;
  const initial = user.name ? getInitial(user.name) : null;
  const showImage = Boolean(user.image) && !imgError;

  // SSR-rendered images can fail before hydration attaches onError; detect that case on mount.
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth === 0) {
      setImgError(true);
    }
  }, []);

  const baseClass = cn(
    "inline-flex flex-shrink-0 items-center justify-center select-none",
    "[border-radius:var(--radius-pill)] [border:1px_solid_var(--border)] overflow-hidden",
    className,
  );

  if (showImage && user.image) {
    return (
      <Image
        ref={imgRef}
        src={user.image}
        alt={resolvedLabel}
        width={px}
        height={px}
        className={cn(baseClass, "object-cover")}
        style={{ width: px, height: px }}
        onError={() => setImgError(true)}
      />
    );
  }

  if (initial) {
    return (
      <span
        role="img"
        aria-label={resolvedLabel}
        className={cn(
          baseClass,
          "[background:color-mix(in_oklab,var(--text-primary)_14%,var(--surface-elevated))]",
          "[font-family:var(--font-display)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]",
        )}
        style={{ width: px, height: px, ...style }}
      >
        {initial}
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={resolvedLabel}
      className={cn(baseClass, "[color:var(--text-muted)] [background:var(--surface-elevated)]")}
      style={{ width: px, height: px }}
    >
      <User size={iconSize} aria-hidden="true" />
    </span>
  );
}
