/**
 * OG image template. Hero-style layout: pill eyebrow, large headline, body subline.
 * Logo: Zilla Slab Highlight. Titles (eyebrow, headline): Roboto Condensed. Body (subline): Open Sans.
 */

import { OG_FONT_NAMES } from "@/lib/og";

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

/** Fallback when OG fonts are not loaded (e.g. Google returns only woff2). */
const FALLBACK_SANS = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const FALLBACK_LOGO = "Georgia, 'Times New Roman', serif";

/** Brand colors (dark theme) - inline hex for next/og */
const OG_COLORS = {
  background: "#0b0f14",
  primary: "#8b5cf6",
  primaryOrb: "rgba(139, 92, 246, 0.45)",
  highlight: "#a78bfa",
  highlightOrb: "rgba(167, 139, 250, 0.35)",
  info: "#38bdf8",
  infoOrb: "rgba(56, 189, 248, 0.3)",
  logo: "#e6edf3",
  textTitle: "#f2f6fb",
  textBody: "#d6dee6",
  textMuted: "#a8b3c0",
  eyebrowBg: "rgba(139, 92, 246, 0.25)",
  eyebrowBorder: "rgba(139, 92, 246, 0.4)",
  headlineStart: "#a78bfa",
  headlineEnd: "#38bdf8",
} as const;

export type OgFontsLoaded = { logo: boolean; title: boolean; body: boolean };

export type OgImageTemplateProps = {
  eyebrow: string;
  headline: string;
  subline: string;
  /** Which font families were actually passed to ImageResponse; use OG name only when true. */
  fontsLoaded?: OgFontsLoaded;
};

/**
 * Hero-style OG layout: logo (Zilla Slab Highlight), titles (Roboto Condensed), body (Open Sans).
 * Each element uses the OG font only when that font was loaded; otherwise fallback so Satori doesn't use another font.
 */
export function OgImageTemplate({ eyebrow, headline, subline, fontsLoaded }: OgImageTemplateProps) {
  const logoFont = fontsLoaded?.logo ? OG_FONT_NAMES.logo : FALLBACK_LOGO;
  const titleFont = fontsLoaded?.title ? OG_FONT_NAMES.title : FALLBACK_SANS;
  const bodyFont = fontsLoaded?.body ? OG_FONT_NAMES.body : FALLBACK_SANS;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        backgroundColor: OG_COLORS.background,
        backgroundImage: [
          "radial-gradient(ellipse 120% 120% at 15% 25%, rgba(139, 92, 246, 0.35) 0%, rgba(139, 92, 246, 0.12) 35%, rgba(139, 92, 246, 0.03) 55%, transparent 70%)",
          "radial-gradient(ellipse 100% 100% at 85% 75%, rgba(56, 189, 248, 0.2) 0%, rgba(56, 189, 248, 0.06) 40%, transparent 65%)",
          "linear-gradient(180deg, transparent 0%, transparent 50%, rgba(11, 15, 20, 0.4) 100%)",
        ].join(", "),
        fontFamily: bodyFont,
        padding: 56,
        paddingLeft: 64,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Soft edge fade so no hard cut at canvas edges */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(11, 15, 20, 0.4) 0%, transparent 22%, transparent 82%, rgba(11, 15, 20, 0.3) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Logo - only element with logo typography */}
      <div
        style={{
          position: "absolute",
          top: 48,
          left: 64,
          display: "flex",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontFamily: logoFont,
            fontWeight: 700,
            fontSize: 30,
            color: OG_COLORS.logo,
            letterSpacing: "0.02em",
          }}
        >
          PandaTrack
        </span>
      </div>

      {/* Hero content: pill and headline use title font (Roboto Condensed), subline uses body font (Open Sans) */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          flex: 1,
          maxWidth: 720,
          width: "100%",
        }}
      >
        {/* Eyebrow pill - title font */}
        <span
          style={{
            fontFamily: titleFont,
            fontSize: 13,
            fontWeight: 600,
            color: "#ffffff",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            background: OG_COLORS.eyebrowBg,
            border: `1px solid ${OG_COLORS.eyebrowBorder}`,
            borderRadius: 9999,
            paddingTop: 10,
            paddingBottom: 10,
            paddingLeft: 20,
            paddingRight: 20,
            marginBottom: 28,
          }}
        >
          {eyebrow}
        </span>

        {/* Headline - title font, gradient (purple to cyan) */}
        <h1
          style={{
            fontFamily: titleFont,
            fontSize: 52,
            fontWeight: 700,
            margin: 0,
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            background: `linear-gradient(90deg, ${OG_COLORS.headlineStart} 0%, ${OG_COLORS.textTitle} 45%, ${OG_COLORS.headlineEnd} 100%)`,
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {headline}
        </h1>

        {/* Subline - body font (Open Sans) */}
        <p
          style={{
            fontFamily: bodyFont,
            fontSize: 22,
            fontWeight: 400,
            color: OG_COLORS.textBody,
            marginTop: 22,
            marginBottom: 0,
            lineHeight: 1.45,
            maxWidth: 620,
          }}
        >
          {subline}
        </p>
      </div>
    </div>
  );
}
