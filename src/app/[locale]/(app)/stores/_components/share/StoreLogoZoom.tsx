"use client";

import Image from "next/image";
import { useState } from "react";
import posthog from "posthog-js";
import StoreAvatar, { type StoreAvatarSize } from "@/components/core/StoreAvatar";
import Modal from "@/components/modules/Modal/Modal";
import { POSTHOG_EVENTS } from "@/lib/constants";

/** Rendered size of the zoomed logo. Under the 512px stored master, so it never upscales. */
const ZOOM_SIZE = 320;

export type StoreLogoZoomProps = {
  storeName: string;
  logoSrc: string;
  size: StoreAvatarSize;
  /** Accessible name for the trigger, e.g. "Ver el logo de Akabane más grande". */
  openLabel: string;
};

/**
 * Makes a store logo openable at a readable size.
 *
 * The avatar renders at 56px while the stored master is 512px, so nine tenths of the image the
 * collector uploaded is never visible; at that scale a detailed logo reads as a smudge. The trigger
 * is a real `<button>` rather than a click handler on the image, so it is reachable by keyboard and
 * announced as an action.
 *
 * The zoomed view uses `object-contain` where the avatar uses `object-cover`: the small avatar
 * crops to fill its square, and seeing the logo uncropped is part of the point of opening it.
 *
 * Deliberately opt-in per call site instead of baked into `StoreAvatar`. The same avatar appears
 * inside store cards and dashboard rows whose whole surface is a link, where a nested button would
 * be invalid markup and would swallow the navigation the row exists for.
 */
export default function StoreLogoZoom({ storeName, logoSrc, size, openLabel }: StoreLogoZoomProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => {
    setIsOpen(true);
    posthog.capture(POSTHOG_EVENTS.STORE.LOGO_ZOOM_OPENED);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={openLabel}
        aria-haspopup="dialog"
        className="inline-flex shrink-0 cursor-zoom-in rounded-full transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)] md:rounded-[var(--radius-lg)]"
      >
        <StoreAvatar store={{ name: storeName, logo: { src: logoSrc, aspect: "square" } }} size={size} />
      </button>

      {/*
        Centered at every width instead of the default mobile bottom sheet. A sheet is a task
        surface: it slides up under the thumb because it expects you to choose or confirm
        something. Looking at a logo is not a task, and anchoring to the bottom gives away the
        height the image wants. Centered on a dimmed backdrop is what every phone photo viewer
        does, and it is what the owner expected here.
      */}
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={storeName} presentation="centered">
        <div className="flex justify-center">
          <Image
            src={logoSrc}
            alt=""
            width={ZOOM_SIZE}
            height={ZOOM_SIZE}
            sizes={`${ZOOM_SIZE}px`}
            className="h-auto w-full max-w-[320px] rounded-[var(--radius-lg)] object-contain [background:var(--surface-elevated)] [border:1px_solid_var(--border)]"
          />
        </div>
      </Modal>
    </>
  );
}
