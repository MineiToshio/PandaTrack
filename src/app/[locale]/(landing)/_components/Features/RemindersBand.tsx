import Chip from "@/components/core/Chip";
import Heading from "@/components/core/Heading";
import IconBox from "@/components/core/IconBox";
import Typography from "@/components/core/Typography";
import { Bell } from "lucide-react";

export default function RemindersBand() {
  return (
    <section className="border-border bg-card w-full rounded-2xl border p-6 md:p-8" aria-labelledby="reminders-heading">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
        <IconBox variant="soft" accentClassName="bg-accent/20 text-accent">
          <Bell className="h-6 w-6" aria-hidden />
        </IconBox>
        <div className="min-w-0 flex-1">
          <Heading as="h3" size="xs" id="reminders-heading" className="text-text-title md:text-xl">
            Recordatorios y alertas útiles
          </Heading>
          <Typography size="sm" className="text-text-body mt-2 leading-relaxed md:text-base">
            Recibe recordatorios para pedir updates y no olvidar preventas largas. Define un presupuesto y recibe
            alertas cuando te estés acercando al límite.
          </Typography>
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip>Recordatorios</Chip>
            <Chip>Presupuesto</Chip>
          </div>
        </div>
      </div>
    </section>
  );
}
