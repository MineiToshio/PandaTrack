import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import Banner from "./_components/Banner";
import Faqs from "./_components/Faqs";
import Features from "./_components/Features/Features";
import Footer from "./_components/Footer";
import Hero from "./_components/Hero";
import LandingJsonLd from "./_components/LandingJsonLd";
import UserFit from "./_components/UserFit/UserFit";
import Waitlist from "./_components/Waitlist/Waitlist";
import { buildPageMetadata } from "@/lib/seo";
import { APP_NAME } from "@/lib/constants";

type HomeProps = {
  params: Promise<{
    locale: string;
  }>;
};

export async function generateMetadata({ params }: HomeProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    locale,
    namespace: "landing",
    pathSegment: "",
    titleKey: "meta.title",
    descriptionKey: "meta.description",
  });
}

export default async function Home({ params }: HomeProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing" });

  return (
    <main className="bg-background text-foreground min-h-screen">
      <LandingJsonLd locale={locale} name={APP_NAME} description={t("meta.description")} />
      <Hero />
      <UserFit />
      <Features />
      <Banner />
      <Faqs />
      <Waitlist />
      <Footer locale={locale} />
    </main>
  );
}
