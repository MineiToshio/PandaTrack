export type PaymentSummary = {
  paidAmount: number;
  remainingAmount: number;
  paymentPercentage: number;
};

export function calculatePaymentSummary(totalCost: number, payments: Array<{ amount: number }>): PaymentSummary {
  const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const remainingAmount = totalCost - paidAmount;
  const paymentPercentage = totalCost === 0 ? 0 : Math.floor((paidAmount / totalCost) * 100);
  return { paidAmount, remainingAmount, paymentPercentage };
}
