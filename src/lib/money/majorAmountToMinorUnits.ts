import { MINOR_UNITS_PER_MAJOR } from "@/lib/currency";

/**
 * Decimal places kept before rounding, to absorb binary floating-point noise.
 *
 * `59.90 * 100` is `5989.999999999999` in IEEE 754, and `1.005 * 100` is `100.49999999999999`, so a
 * bare `Math.round` would answer 5990 correctly but turn 1.005 into 1.00 instead of 1.01. Rounding
 * the scaled value to six decimals first collapses that noise (both become `5990.000000` and
 * `100.500000`) while staying far below the precision any real money amount carries, so the final
 * `Math.round` decides on the number a person would have read rather than on its binary neighbour.
 */
const SCALING_NOISE_PRECISION = 6;

/**
 * Converts a major-unit decimal amount (`59.90`) into the integer minor units the domain stores
 * (`5990`). The scale is a uniform ×100 for every currency, including the zero-decimal ones
 * (`isZeroDecimalCurrency`), which is exactly what the storage rule in `src/lib/currency.ts`
 * requires: `1200` JPY becomes `120000`, a whole major amount as `isWholeMajorAmount` demands.
 *
 * This is the numeric sibling of `parseDecimalToMinorUnits`, which does the same job for the
 * decimal STRING a form field submits. This one exists for a boundary that hands over a JSON
 * number instead: the AI extraction response, where the model reports the amount as it appears in
 * the image and the server, never the model, does the arithmetic.
 *
 * The caller must pass a finite number. A non-finite input (JSON allows `1e400`, which parses to
 * `Infinity`) has no minor-unit representation, so it must be refused at the boundary that read it
 * rather than silently turned into a number here.
 */
export function majorAmountToMinorUnits(majorAmount: number): number {
  const scaled = majorAmount * MINOR_UNITS_PER_MAJOR;
  return Math.round(Number(scaled.toFixed(SCALING_NOISE_PRECISION)));
}
