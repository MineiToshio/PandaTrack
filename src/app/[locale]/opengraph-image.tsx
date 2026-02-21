import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { OgImageTemplate, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT } from "@/components/modules/OgImageTemplate";
import { getOgFonts } from "@/lib/ogFonts";

/** Use Node runtime so ogFonts can read from public/fonts/ (fonts ready before render). */
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
  const t = await getTranslations({ locale, namespace: "landing" });
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
