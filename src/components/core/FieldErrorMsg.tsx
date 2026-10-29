import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/styles";
import type { ReactNode } from "react";

export type FieldErrorMsgProps = {
  children: ReactNode;
  id?: string;
  className?: string;
};

/**
 * Canonical inline field error (playbook §3 wizard CTA rule): 13px `AlertCircle`
 * plus 12px destructive text, announced via `role="alert"`. Shared by all create/edit
 * forms so the error treatment never drifts between modules.
 */
export default function FieldErrorMsg({ children, className, id }: FieldErrorMsgProps) {
  return (
    <p
      id={id}
      className={cn("flex items-center gap-1.5 text-[12px] [color:var(--destructive)]", className)}
      role="alert"
    >
      <AlertCircle size={13} aria-hidden />
      <span>{children}</span>
    </p>
  );
}
