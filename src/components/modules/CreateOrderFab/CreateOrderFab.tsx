"use client";

import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import Button from "@/components/core/Button/Button";
import OrderCreateMethodSelector from "@/components/modules/OrderCreateMethodSelector/OrderCreateMethodSelector";
import type { PhotoCounterSnapshot } from "@/app/[locale]/(app)/orders/_components/share/photoCounterContract";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { isFabEligibleRoute } from "./fabRouteGate";

type CreateOrderFabProps = {
  locale: string;
  /** Photo balance shown on the selector's image card; read server-side by the shell. */
  photoCounter?: PhotoCounterSnapshot | null;
};

/**
 * Single-action "Nuevo pedido" floating button: a labelled pill, never a bare circle, that
 * opens the shared `OrderCreateMethodSelector` overlay. Mounted once at the shell root and
 * self-gated by route (Dashboard / Orders list only) and breakpoint (below `1024px` via
 * `lg:hidden`); see `fabRouteGate.ts` for the route contract shared with the matching raised
 * toast inset.
 */
export default function CreateOrderFab({ locale, photoCounter = null }: CreateOrderFabProps) {
  const pathname = usePathname();
  const t = useTranslations("orders.createEntry");
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  if (!isFabEligibleRoute(pathname ?? "", locale)) return null;

  return (
    <>
      <Button
        type="button"
        variant="primary"
        size="md"
        onClick={() => setIsSelectorOpen(true)}
        leadingIcon={<Plus size={18} aria-hidden />}
        posthogEvent={POSTHOG_EVENTS.ORDER.CREATE_METHOD_SELECTOR_OPENED}
        posthogProps={{ source: "fab" }}
        className="fixed right-[calc(env(safe-area-inset-right,0px)+var(--fab-offset))] bottom-[calc(env(safe-area-inset-bottom,0px)+var(--fab-offset))] z-[var(--z-fab,38)] min-h-[var(--fab-h)] rounded-[var(--radius-pill)] px-5 shadow-[0_8px_24px_oklch(20%_0.02_50/0.24)] lg:hidden"
      >
        {t("fabLabel")}
      </Button>
      <OrderCreateMethodSelector
        presentation="overlay"
        locale={locale}
        isOpen={isSelectorOpen}
        onClose={() => setIsSelectorOpen(false)}
        photoCounter={photoCounter}
      />
    </>
  );
}
