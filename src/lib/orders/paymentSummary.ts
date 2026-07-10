export type PaymentSummary = {
  paidAmount: number;
  remainingAmount: number;
  paymentPercentage: number;
};

export function calculatePaymentSummary(totalCost: number, payments: Array<{ amount: number }>): PaymentSummary {
  const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  // Clamp both derived values at the source so overpayment or rounding can never surface a
  // negative outstanding balance or a percentage outside 0–100 to any consumer downstream.
  const remainingAmount = Math.max(0, totalCost - paidAmount);
  const rawPercentage = totalCost === 0 ? 0 : Math.floor((paidAmount / totalCost) * 100);
  const paymentPercentage = Math.min(100, Math.max(0, rawPercentage));
  return { paidAmount, remainingAmount, paymentPercentage };
}
