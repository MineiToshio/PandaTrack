import { ImageResponse } from "next/og";
import { OgImageTemplate, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT } from "@/components/modules/OgImageTemplate";
import { getOgImageData } from "@/lib/og";

/** Use Node runtime so og can read fonts from disk (fonts ready before render). */
export const runtime = "nodejs";

export const alt = "PandaTrack - Your command center for shopping and collectibles";
export const size = { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT };
export const contentType = "image/png";

type OpengraphImageProps = {
  params: Promise<{ locale: string }>;
};

/**
 * OG image for the locale root (landing page). Placed at [locale] level because
 * opengraph-image inside route groups like (landing) can return 404 in Next.js.
 */
export default async function OpengraphImage({ params }: OpengraphImageProps) {
  const { locale } = await params;
  const data = await getOgImageData(locale, "landing");

  return new ImageResponse(
    <OgImageTemplate
      eyebrow={data.eyebrow}
      headline={data.headline}
      subline={data.subline}
      fontsLoaded={data.fontsLoaded}
    />,
    {
      ...size,
      fonts: data.fonts.length > 0 ? data.fonts : undefined,
    },
  );
}
