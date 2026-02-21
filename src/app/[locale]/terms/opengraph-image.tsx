import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { OgImageTemplate, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT } from "@/components/modules/OgImageTemplate";
import { getOgFonts } from "@/lib/ogFonts";

export const runtime = "nodejs";

export const alt = "Terms of Service - PandaTrack";
export const size = { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT };
export const contentType = "image/png";

type OpengraphImageProps = {
  params: Promise<{ locale: string }>;
};

export default async function OpengraphImage({ params }: OpengraphImageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "terms" });
  const eyebrow = t("ogEyebrow");
  const headline = t("ogHeadline");
  const subline = t("ogSubline");
  const { fonts, loaded } = await getOgFonts();

  return new ImageResponse(
    <OgImageTemplate eyebrow={eyebrow} headline={headline} subline={subline} fontsLoaded={loaded} />,
    {
      ...size,
      fonts: fonts.length > 0 ? fonts : undefined,
    },
  );
}
