/**
 * Strips any character that is not a digit or period, keeps only the first period,
 * and limits the fractional part to two digits. Safe to call on every keystroke.
 */
export function sanitizeDecimalInput(value: string): string {
  let v = value.replace(/[^\d.]/g, "");
  const dotIndex = v.indexOf(".");
  if (dotIndex !== -1) {
    v = v.slice(0, dotIndex + 1) + v.slice(dotIndex + 1).replace(/\./g, "");
    if (v.length > dotIndex + 3) {
      v = v.slice(0, dotIndex + 3);
    }
  }
  return v;
}

/**
 * Returns true when value is a well-formed positive decimal with at most two
 * decimal places (e.g. "25", "25.5", "25.99"). Use on form submit, not on
 * every keystroke (a trailing dot like "25." is rejected here but is valid
 * while the user is still typing).
 */
export function isValidPositiveDecimal(value: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(value) && parseFloat(value) > 0;
}
