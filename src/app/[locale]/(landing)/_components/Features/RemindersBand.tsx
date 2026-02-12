import Chip from "@/components/core/Chip";
import Heading from "@/components/core/Heading";
import IconBox from "@/components/core/IconBox";
import Typography from "@/components/core/Typography";
import { useTranslations } from "next-intl";
import { Bell } from "lucide-react";

export default function RemindersBand() {
  const t = useTranslations("landing.features.reminders");
  return (
    <section className="border-border bg-card w-full rounded-2xl border p-6 md:p-8" aria-labelledby="reminders-heading">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
        <IconBox variant="soft" accentClassName="bg-accent/20 text-accent">
          <Bell className="h-6 w-6" aria-hidden />
        </IconBox>
        <div className="min-w-0 flex-1">
          <Heading as="h3" size="xs" id="reminders-heading" className="text-text-title md:text-xl">
            {t("heading")}
          </Heading>
          <Typography size="sm" className="text-text-body mt-2 leading-relaxed md:text-base">
            {t("description")}
          </Typography>
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip>{t("chips.0")}</Chip>
            <Chip>{t("chips.1")}</Chip>
          </div>
        </div>
      </div>
    </section>
  );
}
