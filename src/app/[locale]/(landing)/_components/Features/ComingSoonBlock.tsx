import Heading from "@/components/core/Heading";
import IconBox from "@/components/core/IconBox";
import Typography from "@/components/core/Typography";
import { useTranslations } from "next-intl";
import { Heart, Sparkles } from "lucide-react";

export default function ComingSoonBlock() {
  const t = useTranslations("landing.features.comingSoon");
  const itemCount = 2;
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
            {t("heading")}
          </Heading>
        </div>
        <ul className="space-y-2" role="list">
          {Array.from({ length: itemCount }, (_, i) => (
            <li key={i} className="text-muted-foreground flex items-center gap-2">
              <Heart className="h-4 w-4 shrink-0" aria-hidden />
              <Typography as="span" size="sm">
                {t(`items.${i}`)}
              </Typography>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
