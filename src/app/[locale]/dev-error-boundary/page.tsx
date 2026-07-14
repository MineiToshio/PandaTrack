import { notFound } from "next/navigation";

/**
 * Intentionally throws during render so `[locale]/error.tsx` can be exercised end-to-end.
 * Resolves to the standard 404 outside development, so it is never a reachable failure
 * endpoint once deployed.
 */
export default function DevErrorBoundaryPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  throw new Error("Forced render error to exercise the locale error boundary.");
}
