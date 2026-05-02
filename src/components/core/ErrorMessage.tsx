import { cn } from "@/lib/styles";
import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

export type ErrorMessageProps = {
  children: ReactNode;
  /** Required — link to the field via `aria-describedby`. */
  id?: string;
  className?: string;
};

export default function ErrorMessage({ children, id, className }: ErrorMessageProps) {
  return (
    <p
      id={id}
      role="alert"
      aria-live="polite"
      className={cn(
        "mt-[var(--space-1)] flex items-start gap-[var(--space-1)]",
        "[font-size:var(--text-caption)] [line-height:var(--text-caption--line-height)]",
        "[color:var(--destructive-chip-text)]",
        className,
      )}
    >
      <AlertCircle size={12} aria-hidden="true" className="mt-px flex-shrink-0" />
      {children}
    </p>
  );
}
