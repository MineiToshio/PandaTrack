"use client";

import type { ReactNode } from "react";
import CoreFieldErrorMsg from "@/components/core/FieldErrorMsg";

/**
 * StoreForm step wrapper around the canonical core field error. Keeps the step-specific
 * top margin (`mt-1.5`) so existing callsites stay visually identical; new code outside
 * StoreForm should use `@/components/core/FieldErrorMsg` directly.
 */
export default function FieldErrorMsg({ children }: { children: ReactNode }) {
  return <CoreFieldErrorMsg className="mt-1.5 inline-flex">{children}</CoreFieldErrorMsg>;
}
