"use client";

import { createContext, useContext } from "react";
import type { AppShellUserIdentity } from "@/app/[locale]/(app)/_components/AppLayout/types";

type ShellIdentityContextValue = {
  user: AppShellUserIdentity;
  updateUser: (patch: Partial<AppShellUserIdentity>) => void;
};

export const ShellIdentityContext = createContext<ShellIdentityContextValue | null>(null);

/**
 * Returns the current shell identity and an updater for optimistic client-side refreshes.
 * Must be used within the private app layout tree where AppLayout provides the context.
 */
export function useShellIdentity(): ShellIdentityContextValue {
  const ctx = useContext(ShellIdentityContext);
  if (!ctx) {
    throw new Error("useShellIdentity must be used within the private app layout.");
  }
  return ctx;
}
