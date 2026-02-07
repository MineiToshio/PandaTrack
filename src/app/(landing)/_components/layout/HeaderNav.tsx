import Link from "next/link";

const NAV_ITEMS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export default function HeaderNav() {
  return (
    <nav aria-label="Main" className="font-secondary text-text-body flex items-center gap-6 text-sm">
      {NAV_ITEMS.map((item) => (
        <Link key={item.href} href={item.href} className="hover:text-text-title transition-colors">
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
