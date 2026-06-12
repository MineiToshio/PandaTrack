/**
 * Local-time date helpers shared by order filter and form components.
 * Server-side query boundaries use UTC instead — do not swap these in there.
 */

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  // Day 0 of the next month resolves to the last day of the current month.
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function toIsoDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
