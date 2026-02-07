import Link from "next/link";

const NAV_ITEMS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export default function HeaderNav() {
  return (
    <nav aria-label="Main" className="flex items-center gap-6 font-secondary text-sm text-text-body">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="transition-colors hover:text-text-title"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
