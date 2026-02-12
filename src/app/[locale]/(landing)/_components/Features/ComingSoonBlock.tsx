import IconBox from "@/components/core/IconBox";
import { Heart, Sparkles } from "lucide-react";

const COMING_SOON_ITEMS = [
  "Gestión de colección (con fotos)",
  "Wishlist",
] as const;

export default function ComingSoonBlock() {
  return (
    <section
      className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 md:p-8"
      aria-labelledby="coming-soon-heading"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <IconBox
            variant="muted"
            size="sm"
            accentClassName="text-muted-foreground"
            className="rounded-lg"
          >
            <Sparkles className="h-5 w-5" aria-hidden />
          </IconBox>
          <h3
            id="coming-soon-heading"
            className="text-text-title text-lg font-semibold md:text-xl"
          >
            Lo que viene después
          </h3>
        </div>
        <ul className="space-y-2" role="list">
          {COMING_SOON_ITEMS.map((item, index) => (
            <li
              key={index}
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Heart className="h-4 w-4 shrink-0" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
