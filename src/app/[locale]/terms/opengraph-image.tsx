import { ImageResponse } from "next/og";
import { OgImageTemplate, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT } from "@/components/modules/OgImageTemplate";
import { getOgImageData } from "@/lib/og";

export const runtime = "nodejs";

export const alt = "Terms of Service - PandaTrack";
export const size = { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT };
export const contentType = "image/png";

type OpengraphImageProps = {
  params: Promise<{ locale: string }>;
};

export default async function OpengraphImage({ params }: OpengraphImageProps) {
  const { locale } = await params;
  const data = await getOgImageData(locale, "terms");

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
