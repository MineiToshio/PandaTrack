import type { ReactNode } from "react";
import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";
import { cn } from "@/lib/styles";

type AuthStatusCardProps = {
  title: ReactNode;
  description: ReactNode;
  helpText?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export default function AuthStatusCard({ title, description, helpText, children, className }: AuthStatusCardProps) {
  return (
    <section className={cn("border-border bg-surface mx-auto w-full max-w-xl rounded-xl border p-6 sm:p-8", className)}>
      <Heading as="h1" size="sm" className="text-text-title">
        {title}
      </Heading>
      <Typography size="md" className="text-text-body mt-3">
        {description}
      </Typography>
      {helpText ? (
        <Typography size="xs" className="text-text-muted mt-2">
          {helpText}
        </Typography>
      ) : null}
      {children ? <div className="mt-6">{children}</div> : null}
    </section>
  );
}
