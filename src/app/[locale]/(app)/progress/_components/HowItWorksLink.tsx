import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/styles";

type HowItWorksLinkProps = {
  locale: string;
  /** Short label, e.g. `"Cómo funciona"`. The destination carries the full title. */
  label: string;
  className?: string;
};

/**
 * The one way into the rules explainer, from the `Resumen` tab.
 *
 * A quiet inline link and not a button on purpose: the rulebook is read once, and a fourth tab or a
 * filled CTA would give it the standing of the album and the ladder, which are read every visit.
 * It sits beside the honesty line because that line is the shortest statement of the same rules,
 * and a reader who stops on it is exactly the reader who wants the rest.
 *
 * Its own component so the entry point has one definition and one test, rather than two lines of
 * JSX buried in a page that cannot be rendered in a unit test.
 */
export default function HowItWorksLink({ locale, label, className }: HowItWorksLinkProps) {
  return (
    <Link
      href={`/${locale}${ROUTES.progressHowItWorks}`}
      className={cn(
        "inline-flex w-fit items-center gap-1 [font-size:var(--text-caption)] [font-weight:var(--font-weight-medium)] [color:var(--accent)] hover:underline focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:outline-offset-2",
        className,
      )}
    >
      {label}
      <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
    </Link>
  );
}
