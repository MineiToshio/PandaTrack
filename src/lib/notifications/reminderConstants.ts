/**
 * Reminder dispatch tuning constants, internal to the notifications vertical.
 *
 * The lead-time windows are the FRD's "a few days" starting point and are not
 * yet collector-configurable; keeping them here makes the single tuning point
 * explicit. The coarse padding widens only the SQL pre-filter so no candidate is
 * lost at a timezone edge, while the authoritative window gate runs per collector
 * in the dispatcher.
 */

/** Days before a payment's expected date that an upcoming-payment reminder fires. */
export const REMINDER_PAYMENT_LEAD_DAYS = 3;

/** Days before an expected arrival that an upcoming-arrival reminder fires. */
export const REMINDER_ARRIVAL_LEAD_DAYS = 3;

/**
 * Extra days padded onto each candidate query's coarse date bound. A collector's
 * civil "today" can differ from the server's UTC day by less than a full day, so
 * one day of padding guarantees the thin SQL pre-filter never drops a candidate
 * the precise timezone-aware gate would keep.
 */
export const REMINDER_COARSE_WINDOW_PADDING_DAYS = 1;
