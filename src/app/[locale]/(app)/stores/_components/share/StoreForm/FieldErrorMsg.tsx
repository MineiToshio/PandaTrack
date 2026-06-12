"use client";

import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

export default function FieldErrorMsg({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] [color:var(--destructive)]" role="alert">
      <AlertCircle size={13} aria-hidden />
      <span>{children}</span>
    </p>
  );
}
