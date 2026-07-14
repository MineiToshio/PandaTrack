"use client";

import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import GlobalError from "../global-error";

/**
 * Dev-only harness that renders the catastrophic global-error fallback directly. Placed
 * outside the `/{locale}` tree, like `global-error.tsx` itself, so it needs no parent layout
 * and never collides with locale detection or routing. `global-error.tsx` only takes over a
 * genuine root-layout failure in a production build, so this route lets the fallback be
 * exercised without forcing a real crash. Redirects to the default locale outside
 * development (there is no root not-found boundary to render an on-brand 404 here), so it
 * is never a reachable endpoint once deployed.
 */
export default function DevGlobalErrorPage() {
  if (process.env.NODE_ENV === "production") {
    redirect(`/${routing.defaultLocale}`);
  }

  const error = Object.assign(new Error("Forced root-layout failure to exercise global-error.tsx."), {
    digest: "dev-global-error",
  });

  return <GlobalError error={error} reset={() => window.location.reload()} />;
}
