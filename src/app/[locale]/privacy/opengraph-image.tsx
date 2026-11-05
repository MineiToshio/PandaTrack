import { ImageResponse } from "next/og";
import { OgImageTemplate, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT } from "@/components/modules/OgImageTemplate";
import { getOgImageData } from "@/lib/og";
import { routing } from "@/i18n/routing";

export const runtime = "nodejs";

export const alt = "Privacy Policy - PandaTrack";
export const size = { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT };
export const contentType = "image/png";

export function generateStaticParams(): { locale: string }[] {
  return routing.locales.map((locale) => ({ locale }));
}

type OpengraphImageProps = {
  params: Promise<{ locale: string }>;
};

export default async function OpengraphImage({ params }: OpengraphImageProps) {
  const { locale } = await params;
  const data = await getOgImageData(locale, "privacy");

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
