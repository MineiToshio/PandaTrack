import { buildCanonicalPath, getSiteUrl } from "@/lib/seo";

type LandingJsonLdProps = {
  locale: string;
  name: string;
  description: string;
};

function getHomeUrl(locale: string): string {
  const baseUrl = getSiteUrl();
  return `${baseUrl}${buildCanonicalPath(locale, "")}`;
}

export default function LandingJsonLd({ locale, name, description }: LandingJsonLdProps) {
  const url = getHomeUrl(locale);

  const webSite = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    description,
    url,
    inLanguage: locale === "es" ? "es" : "en",
  };

  const softwareApplication = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name,
    description,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web",
    url,
  };

  const jsonLd = [webSite, softwareApplication];

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />;
}
