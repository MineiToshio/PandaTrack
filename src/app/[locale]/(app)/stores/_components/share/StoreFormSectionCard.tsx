import { ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import Typography from "@/components/core/Typography";
import SectionTitleWithAccent from "@/components/modules/SectionTitleWithAccent";
import { COLLECTOR_FORM_SECTION_CLASSNAME, cn } from "@/lib/styles";

type StoreFormSectionCardProps = {
  eyebrow: string;
  title: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  icon?: React.ComponentType<LucideProps>;
  iconClassName?: string;
};

export default function StoreFormSectionCard({
  eyebrow,
  title,
  children,
  action,
  className,
  icon,
  iconClassName,
}: StoreFormSectionCardProps) {
  return (
    <section className={cn(COLLECTOR_FORM_SECTION_CLASSNAME, "space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Typography size="xs" className="text-text-muted">
            {eyebrow}
          </Typography>
          <SectionTitleWithAccent as="h3" icon={icon} iconClassName={iconClassName}>
            {title}
          </SectionTitleWithAccent>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
