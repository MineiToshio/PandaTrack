import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

/**
 * Generates the Apple touch icon (180x180) for iOS "Add to Home Screen".
 * Matches the favicon design: purple rounded square with "PT" in white.
 */
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#7c3aed",
        borderRadius: 24,
        fontFamily: "system-ui, sans-serif",
        fontWeight: 700,
        fontSize: 72,
        color: "white",
      }}
    >
      PT
    </div>,
    { ...size },
  );
}
