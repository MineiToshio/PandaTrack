import { cn } from "@/lib/styles";

type SectionHeaderProps = {
  title: string;
  subtitle: string;
  id?: string;
  className?: string;
};

export default function SectionHeader({ title, subtitle, id, className }: SectionHeaderProps) {
  return (
    <header className={cn("mx-auto max-w-3xl text-center", className)}>
      <h2 id={id} className="text-text-title text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
        {title}
      </h2>
      <p className="text-text-body mt-4 text-base leading-relaxed md:text-lg">{subtitle}</p>
    </header>
  );
}
