"use client";

import { useState } from "react";
import FxBanner from "./FxBanner";
import FxReconciliationModal, { type FxPendingOrder } from "./FxReconciliationModal";

type FxAnnouncerProps = {
  count: number;
  baseCurrencyCode: string | null;
  orders: FxPendingOrder[];
};

export default function FxAnnouncer({ count, baseCurrencyCode, orders }: FxAnnouncerProps) {
  const [open, setOpen] = useState(false);
  if (count <= 0 || !baseCurrencyCode) return null;
  return (
    <>
      <FxBanner count={count} onOpenModal={() => setOpen(true)} />
      <FxReconciliationModal
        isOpen={open}
        onClose={() => setOpen(false)}
        baseCurrencyCode={baseCurrencyCode}
        orders={orders}
      />
    </>
  );
}
