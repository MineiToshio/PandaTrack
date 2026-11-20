type SettlementOrder = {
  closesOrder: boolean;
  orderDate: Date;
  humanReadableId: string;
};

/** Closed orders drain the shared pool first; date and readable id keep every attempt deterministic. */
export function compareSettlementOrders(a: SettlementOrder, b: SettlementOrder): number {
  return (
    Number(b.closesOrder) - Number(a.closesOrder) ||
    a.orderDate.getTime() - b.orderDate.getTime() ||
    a.humanReadableId.localeCompare(b.humanReadableId)
  );
}
