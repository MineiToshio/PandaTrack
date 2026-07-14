"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

type LangGuess = "es" | "en";

/**
 * Dependency-free guess of which language to lead with, based on the first path segment
 * (`/es/...` or `/en/...`). Falls back to the app default (`es`) when the path is unavailable
 * (no window) or unrecognized. This is not next-intl locale detection: it is a lightweight
 * hint, and the fallback always keeps both languages legible regardless of the guess.
 */
function guessLeadLang(): LangGuess {
  if (typeof window === "undefined") {
    return "es";
  }

  return window.location.pathname.split("/")[1] === "en" ? "en" : "es";
}

const COPY: Record<LangGuess, { eyebrow: string; title: string; description: string }> = {
  es: {
    eyebrow: "Error",
    title: "Algo se rompió de nuestro lado",
    description: "No pudimos cargar la aplicación. Vuelve a intentarlo en un momento.",
  },
  en: {
    eyebrow: "Error",
    title: "Something broke on our end",
    description: "We couldn't load the app. Try again in a moment.",
  },
};

/**
 * Catastrophic fallback for a root-layout render error. It replaces the root layout, so it has
 * no theme script, no fonts, no next-intl provider and no design tokens. Everything is therefore
 * self-contained: inline styles, inline SVG icons, a small inline `<style>` media query for
 * light/dark (the theme-init script never runs here, so `data-theme` cannot be assumed), and
 * copy in both supported languages. This is the one documented place where hardcoded colors
 * and inline i18n are allowed (ADR 0013).
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const leadLang = guessLeadLang();
  const otherLang: LangGuess = leadLang === "es" ? "en" : "es";
  const lead = COPY[leadLang];
  const other = COPY[otherLang];

  return (
    <html lang={leadLang} data-scroll-behavior="smooth">
      <head>
        <style>{`
          :root {
            --ge-bg: #f8f7fb;
            --ge-fg: #1c1b23;
            --ge-muted: #66647a;
            --ge-icon-bg: rgba(214, 62, 62, 0.12);
            --ge-icon-fg: #c23434;
            --ge-btn-bg: #6d4fe0;
            --ge-btn-fg: #ffffff;
            --ge-divider: #e2e0ea;
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --ge-bg: #0c0b12;
              --ge-fg: #ececf1;
              --ge-muted: #9a99a8;
              --ge-icon-bg: rgba(240, 100, 100, 0.14);
              --ge-icon-fg: #ff6b6b;
              --ge-btn-bg: #8b7bf0;
              --ge-btn-fg: #ffffff;
              --ge-divider: rgba(255, 255, 255, 0.1);
            }
          }
        `}</style>
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "var(--ge-bg)",
          color: "var(--ge-fg)",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div role="alert" style={{ maxWidth: 460, textAlign: "center" }}>
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
              background: "var(--ge-icon-bg)",
              color: "var(--ge-icon-fg)",
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

          <div lang={leadLang}>
            <p
              style={{
                fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, monospace",
                fontSize: 11,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--ge-muted)",
                margin: "0 0 12px",
              }}
            >
              {lead.eyebrow}
            </p>
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>{lead.title}</h1>
            <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--ge-muted)", margin: 0 }}>{lead.description}</p>
          </div>

          <hr
            aria-hidden="true"
            style={{ border: "none", borderTop: "1px solid var(--ge-divider)", margin: "18px 0" }}
          />

          <div lang={otherLang}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>{other.title}</h2>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--ge-muted)", margin: "0 0 26px" }}>
              {other.description}
            </p>
          </div>

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
              background: "var(--ge-btn-bg)",
              color: "var(--ge-btn-fg)",
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
            <span lang={leadLang}>{leadLang === "es" ? "Reintentar" : "Retry"}</span>
            <span aria-hidden="true">·</span>
            <span lang={otherLang}>{otherLang === "es" ? "Reintentar" : "Retry"}</span>
          </button>
        </div>
      </body>
    </html>
  );
}
