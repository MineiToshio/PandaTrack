"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/pwa/registerServiceWorker";
import { initPwaInstallAnalytics } from "@/lib/pwa/installAnalytics";

/**
 * Bootstraps PWA installability from the authenticated app shell: registers the service worker
 * and wires best-effort install analytics. Renders nothing; both operations fail closed so a
 * registration error never blocks the shell from rendering.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    void registerServiceWorker();
    initPwaInstallAnalytics();
  }, []);

  return null;
}
