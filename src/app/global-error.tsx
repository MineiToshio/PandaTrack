"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Catastrophic fallback for a root-layout render error. It replaces the root layout, so it has
 * no theme script, no fonts, no next-intl provider and no design tokens. Everything is therefore
 * self-contained: inline styles, inline SVG icons, and copy in the default locale (es). This is
 * the one documented place where hardcoded colors are allowed (ADR 0013).
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#0c0b12",
          color: "#ececf1",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div role="alert" style={{ maxWidth: 440, textAlign: "center" }}>
          <span
            aria-hidden="true"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 72,
              height: 72,
              borderRadius: "50%",
              marginBottom: 18,
              background: "rgba(240, 100, 100, 0.14)",
              color: "#ff6b6b",
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </span>
          <p
            style={{
              fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, monospace",
              fontSize: 11,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#9a99a8",
              margin: "0 0 12px",
            }}
          >
            Error
          </p>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>Algo se rompió de nuestro lado</h1>
          <p style={{ fontSize: 14, lineHeight: 1.55, color: "#b8b7c4", margin: "0 0 26px" }}>
            No pudimos cargar la aplicación. Vuelve a intentarlo en un momento.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              background: "#8b7bf0",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
