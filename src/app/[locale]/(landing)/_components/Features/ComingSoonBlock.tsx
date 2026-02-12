import Heading from "@/components/core/Heading";
import IconBox from "@/components/core/IconBox";
import Typography from "@/components/core/Typography";
import { Heart, Sparkles } from "lucide-react";

const COMING_SOON_ITEMS = ["Gestión de colección (con fotos)", "Wishlist"] as const;

export default function ComingSoonBlock() {
  return (
    <section
      className="border-border bg-muted/30 rounded-2xl border border-dashed p-6 md:p-8"
      aria-labelledby="coming-soon-heading"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <IconBox variant="muted" size="sm" accentClassName="text-muted-foreground" className="rounded-lg">
            <Sparkles className="h-5 w-5" aria-hidden />
          </IconBox>
          <Heading as="h3" size="xs" id="coming-soon-heading" className="text-text-title md:text-xl">
            Lo que viene después
          </Heading>
        </div>
        <ul className="space-y-2" role="list">
          {COMING_SOON_ITEMS.map((item, index) => (
            <li key={index} className="text-muted-foreground flex items-center gap-2">
              <Heart className="h-4 w-4 shrink-0" aria-hidden />
              <Typography as="span" size="sm">
                {item}
              </Typography>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
