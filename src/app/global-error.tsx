"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import GlobalErrorContent, { guessLeadLang } from "./_components/GlobalErrorContent";

/**
 * Catastrophic fallback for a root-layout render error. It replaces the root layout, so it has
 * no theme script, no fonts, no next-intl provider and no design tokens: everything visible is
 * self-contained inside `GlobalErrorContent` (ADR 0013). This shell owns the `<html>`/`<body>`
 * replacement and the single Sentry capture.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang={guessLeadLang()} data-scroll-behavior="smooth">
      <body style={{ margin: 0 }}>
        <GlobalErrorContent reset={reset} />
      </body>
    </html>
  );
}
