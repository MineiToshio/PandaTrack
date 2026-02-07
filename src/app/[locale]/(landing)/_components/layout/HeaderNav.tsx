import Link from "next/link";
import { useTranslations } from "next-intl";

const NAV_ITEMS = [
  { key: "features", href: "#features" },
  { key: "howItWorks", href: "#how-it-works" },
  { key: "pricing", href: "#pricing" },
  { key: "faq", href: "#faq" },
] as const;

export default function HeaderNav() {
  const t = useTranslations("header.nav");

  return (
    <nav aria-label="Main" className="font-secondary text-text-body flex items-center gap-6 text-sm">
      {NAV_ITEMS.map((item) => (
        <Link key={item.href} href={item.href} className="hover:text-text-title transition-colors">
          {t(item.key)}
        </Link>
      ))}
    </nav>
  );
}
