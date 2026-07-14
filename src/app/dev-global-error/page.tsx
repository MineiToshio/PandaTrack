"use client";

import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import GlobalErrorContent from "../_components/GlobalErrorContent";

/**
 * Dev-only harness that renders the catastrophic global-error surface directly.
 * `global-error.tsx` only takes over a genuine root-layout failure in a production build, so
 * this route lets the surface be exercised end-to-end without forcing a real crash. It mounts
 * `GlobalErrorContent` (the same self-contained body the real fallback renders) under this
 * segment's own minimal root layout, since the real `<html>` replacement cannot be nested
 * inside a routed page. Redirects to the default locale outside development, so it is never a
 * reachable endpoint once deployed.
 */
export default function DevGlobalErrorPage() {
  if (process.env.NODE_ENV === "production") {
    redirect(`/${routing.defaultLocale}`);
  }

  return <GlobalErrorContent reset={() => window.location.reload()} />;
}
