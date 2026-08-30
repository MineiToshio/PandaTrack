import { expect, test, type Locator, type Page } from "@playwright/test";
import { signInAsProgressionUser, skipUnlessProgressionEnv } from "./_helpers/auth";
import { resetProgressionAccountState } from "./_helpers/dbCleanup";

/**
 * The unlock surfaces of the progression layer, driven through the real UI.
 *
 * This file was skipped for as long as it ran against the shared `E2E_USER_EMAIL` account: that
 * account carries the collector's own real, permanently-imported order history, and every unlock
 * or rank celebration it produces is permanent (`BR-12-08`, `FR-12-19`'s watermark). The owner's
 * imported history already satisfied nearly every phase-1 condition, so the first credited action
 * ever run against it unlocked the whole album in one pass, and no fixture could provoke a fresh
 * unlock again on that account, ever.
 *
 * It now signs in as a DEDICATED account (`E2E_PROGRESSION_USER_EMAIL`,
 * `scripts/e2e-progression-account-bootstrap.ts`) that exists for no other purpose than being
 * reset. `test.beforeAll`/`test.afterAll` below wipe every order, delivery, store payment and
 * progression row that account owns (`resetProgressionAccountState`), so each run starts from the
 * same virgin state a brand-new sign-up would, and leaves nothing for the next one to inherit.
 * `e2e/_helpers/auth.ts`'s `skipUnlessProgressionEnv()` hard-guards this account can never resolve
 * to `E2E_USER_EMAIL` or `E2E_ADMIN_EMAIL`, and the reset channel itself
 * (`scripts/e2e-db-cleanup.ts`) refuses again at the point of deletion, so a misconfigured env var
 * fails loudly instead of wiping a real collector's medals.
 *
 * They cover the surfaces of `FR-12-29` (one unlock toast at a time), `FR-12-19` (the once-per-rank
 * celebration, never replayed by a recompute) and `FR-12-47` (the full-screen celebration reserved
 * for the two highest print runs, everything below it toast only).
 *
 * Every body also pins the browser's timezone (`test.use({ timezoneId })`, computed fresh on every
 * run) rather than trusting whatever zone the machine running the suite happens to be in: the app
 * syncs `User.timezone` from the browser's own reported zone on every page load
 * (`TimezoneCapture.tsx`), and `midnight-order` (the fourth body) reads an order's real `createdAt`
 * through that zone. Left uncontrolled, the suite's own pass/fail would depend on what time of day
 * it happened to run — including, for the first three bodies, an unrelated one-in-six chance of
 * accidentally landing inside `midnight-order`'s own window and unlocking it early. Pinning a
 * computed fixed-offset zone (`pickFixedOffsetTimezoneForLocalHour`) makes every body deterministic
 * regardless of when it runs.
 */

/**
 * The store every body here orders from: approved, public and not private, which is the whole of
 * `BR-12-07`. A shared catalogue entry (not owned by the progression account), so ordering from it
 * says nothing about which account is doing the ordering.
 */
const CREDITING_STORE_NAME = "Akabane Comics";

/** Phase-1 medals these bodies provoke, by their `en` names (this spec drives the `en` locale). */
const FIRST_ORDER_MEDAL_NAME = "First order";
/**
 * Paired with `FIRST_ORDER_MEDAL_NAME` in the first body. NOT `"first-store"`: that medal's
 * condition is a SECOND distinct store (`STORES_ORDERED_2`), which a single order can never satisfy
 * by construction, on any account, virgin or not — the collector's very first order always resolves
 * `first-store` to false. `first-preorder` (`PREORDER_WINDOW_RECORDED`) is the pairing that a single
 * order actually CAN satisfy alongside `first-order`, by also recording an estimated delivery
 * window, and it is exactly as "Tirada normal" as the medal it replaces.
 */
const FIRST_PREORDER_MEDAL_NAME = "Pre-order logged";
const PATIENCE_200_MEDAL_NAME = "The impossible wait";
const MIDNIGHT_ORDER_MEDAL_NAME = "Night shift";

const TOAST_REGION_NAME_REGEX = /^(notifications|notificaciones)$/i;
const UNLOCK_TOAST_KICKER_REGEX = /medal unlocked|medalla desbloqueada/i;
const RANK_CELEBRATION_KICKER_REGEX = /you moved up|subiste de rango/i;
const RANK_CELEBRATION_CTA_REGEX = /^(continue|seguir)$/i;
const CELEBRATION_DISMISS_REGEX = /^(close|cerrar)$/i;

/** `patience-200` needs the arrival to land 200 or more days after the order date (`WAIT_200_DAYS`). */
const PATIENCE_200_WAIT_DAYS = 210;

/**
 * How far back to date the rank-crossing lifecycles' orders (and their payments). Two reasons, both
 * about staying out of OTHER medals' way rather than about the rank itself:
 *
 *  - Keeping the payment on the SAME day as the order, but a different day than the arrival (which
 *    defaults to "today"), keeps `same-day-settle` (a Holográfica, full-screen medal) from firing
 *    mid-loop and stealing the dialog the assertion is waiting for. `same-day-settle` compares the
 *    payment's civil day to the arrival's; the moment the two match, it unlocks.
 *  - It keeps `patience-*` out of reach (60+ days), so the only thing the loop can plausibly
 *    escalate to a full-screen celebration is the rank itself.
 */
const RANK_CROSSING_PAYMENT_OFFSET_DAYS = 2;

/**
 * Dead center of the collector's own 00:00-04:00 window, which is what `midnight-order` reads:
 * comfortable margin against either edge.
 */
const MIDNIGHT_TARGET_LOCAL_HOUR = 2;
/** Nowhere near the window on either side, for every body that must NOT land inside it. */
const SAFE_LOCAL_HOUR = 12;

/** Sampling budget for the toast queue: a drain of two toasts spans the first one's whole window. */
const TOAST_SAMPLE_INTERVAL_MS = 100;
const TOAST_OBSERVATION_BUDGET_MS = 20_000;

/** How many crediting order lifecycles it takes to cross the second rank's 200 point threshold. */
const ORDERS_TO_CROSS_FIRST_RANK = 3;

function toastRegion(page: Page) {
  return page.getByLabel(TOAST_REGION_NAME_REGEX);
}

/** Only the unlock toasts, so a confirmation toast raised by the host flow cannot be counted as one. */
function unlockToasts(page: Page) {
  return toastRegion(page).getByRole("status").filter({ hasText: UNLOCK_TOAST_KICKER_REGEX });
}

function celebrationDialog(page: Page) {
  return page.getByRole("dialog");
}

type ToastObservation = {
  /** Greatest number of unlock toasts on screen at the same instant over the whole drain. */
  maxSimultaneous: number;
  /** Distinct toasts seen, in the order they appeared. */
  names: string[];
};

/**
 * Watches the unlock toasts for a whole queue drain instead of asserting once at the end.
 *
 * `FR-12-29` promises a sequence, and a sequence is not something a post-hoc assertion can tell
 * apart from a pile that already expired: by the time two stacked toasts time out, the screen looks
 * exactly like a queue that behaved. Sampling is the only way to make the difference observable.
 */
async function observeUnlockToasts(page: Page, expectedCount: number): Promise<ToastObservation> {
  const toasts = unlockToasts(page);
  const names: string[] = [];
  let maxSimultaneous = 0;
  const deadline = Date.now() + TOAST_OBSERVATION_BUDGET_MS;

  while (Date.now() < deadline && names.length < expectedCount) {
    const texts = await toasts.allTextContents();
    maxSimultaneous = Math.max(maxSimultaneous, texts.length);
    for (const text of texts) {
      if (!names.some((seen) => text.includes(seen) || seen.includes(text))) {
        names.push(text);
      }
    }
    await page.waitForTimeout(TOAST_SAMPLE_INTERVAL_MS);
  }

  return { maxSimultaneous, names };
}

type PastCivilDay = {
  year: number;
  /** 1-based, unlike `Date#getMonth`. */
  month: number;
  day: number;
  monthName: string;
  /** Full months from the page's own "now" back to this day's month; negative when in the past. */
  monthDeltaFromNow: number;
};

/**
 * The civil day `daysAgo` days before "now" as the PAGE ITSELF would compute it — inside
 * `page.evaluate`, not in this Node process. `DatePickerInput`'s calendar (`react-day-picker`) and
 * the browser's own `Intl`/`Date` all resolve "today" through the page's timezone, which
 * `test.use({ timezoneId })` forces to a zone this Node process does not share. Computing the
 * target day out here instead would silently drift by a day whenever the two disagree.
 */
async function resolvePastCivilDay(page: Page, daysAgo: number): Promise<PastCivilDay> {
  return page.evaluate((daysAgoInPage) => {
    const MS_PER_DAY_IN_PAGE = 24 * 60 * 60 * 1000;
    const now = new Date();
    const target = new Date(now.getTime() - daysAgoInPage * MS_PER_DAY_IN_PAGE);
    return {
      year: target.getFullYear(),
      month: target.getMonth() + 1,
      day: target.getDate(),
      monthName: target.toLocaleString("en-US", { month: "long" }),
      monthDeltaFromNow: (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()),
    };
  }, daysAgo);
}

/** `yyyy-mm-dd`, the literal value a native `<input type="date">` needs. */
function toDateInputValue({ year, month, day }: PastCivilDay): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Opens the calendar behind `trigger` (a `DatePickerInput`, e.g. the order wizard's "Order date")
 * and picks `civilDay`. This field has no typable input — only a `react-day-picker` popup — so
 * driving it to a specific PAST day means navigating the calendar for real: `Math.abs(monthDelta)`
 * clicks on the month-nav chevron, then the day button itself.
 *
 * The day button's accessible name is `"{Weekday}, {Month} {day}{ordinal suffix}, {year}"` (e.g.
 * "Wednesday, August 28th, 2026"). Matching `{Month} {day}\w{0,2}, {year}` rather than
 * reconstructing the ordinal suffix works because the suffix is always exactly two letters: for any
 * OTHER day sharing the same leading digit (`1` vs `11`, `2` vs `20`-`29`, ...) the extra digit
 * pushes the match past the `\w{0,2}` cap, so it can never resolve to the wrong day.
 */
async function pickPastCalendarDate(page: Page, trigger: Locator, civilDay: PastCivilDay): Promise<void> {
  await trigger.click();
  const navButtonName = civilDay.monthDeltaFromNow < 0 ? /go to the previous month/i : /go to the next month/i;
  const navButton = page.getByRole("button", { name: navButtonName });
  for (let step = 0; step < Math.abs(civilDay.monthDeltaFromNow); step += 1) {
    await navButton.click();
  }
  await page
    .getByRole("button", { name: new RegExp(`${civilDay.monthName} ${civilDay.day}\\w{0,2}, ${civilDay.year}`) })
    .click();
}

/** Clamps a real UTC-offset (hours, east positive) into the range a fixed-offset zone can express. */
function normalizeOffsetHours(offsetHours: number): number {
  let normalized = offsetHours % 24;
  if (normalized > 14) normalized -= 24;
  if (normalized < -12) normalized += 24;
  return normalized;
}

/**
 * A fixed-offset IANA zone (`Etc/GMT±N`, never observes DST) that makes "now" fall on
 * `targetLocalHour` in that zone, computed fresh at call time.
 *
 * This is what turns `midnight-order`'s window, and every OTHER body's need to stay OUT of it, from
 * "only reachable if the suite happens to run at 2 AM" into something reachable on every run,
 * deterministically, without touching the machine's own clock. `Etc/GMT` sign is inverted from the
 * real offset (`Etc/GMT+N` is UTC−N), which the sign flip below accounts for.
 */
function pickFixedOffsetTimezoneForLocalHour(targetLocalHour: number, now: Date = new Date()): string {
  const utcHour = now.getUTCHours();
  const offsetHours = normalizeOffsetHours(utcHour - targetLocalHour);
  if (offsetHours === 0) return "Etc/GMT";
  const sign = offsetHours >= 0 ? "-" : "+";
  return `Etc/GMT${sign}${Math.abs(offsetHours)}`;
}

/**
 * Creates a one-item order at the crediting store and returns its detail URL.
 *
 * The store is picked by name rather than by taking the combobox's first option: which store the
 * order sits under is the whole precondition here, and the first option is whatever sorts first.
 *
 * `orderDateDaysAgo` backdates the order via `pickPastCalendarDate` (the field is a
 * `DatePickerInput`, not a typable input — see that function's own doc). `recordPreorderWindow`
 * additionally records an estimated delivery window (the "Next 7 days" preset on the
 * delivery-range field), which is the whole of `PREORDER_WINDOW_RECORDED` — used by the first body
 * to unlock `first-preorder` alongside `first-order` in the very same request.
 *
 * Nothing here tracks the created order (or its later delivery) for per-test cleanup, unlike
 * similar helpers elsewhere in this suite: those track ids because they run against the
 * collector's own real, shared account, where a leaked fixture pollutes real data. This spec's
 * account is a dedicated throwaway (`E2E_PROGRESSION_USER_EMAIL`), and `resetProgressionAccountState`
 * wipes every order, delivery and store payment it owns wholesale in `beforeAll`/`afterAll` — a
 * coarser but simpler guarantee that needs no id bookkeeping to hold.
 */
async function createCreditingOrder(
  page: Page,
  orderDateDaysAgo?: number,
  recordPreorderWindow = false,
): Promise<string> {
  await page.goto("/en/orders/new");
  await expect(page).toHaveURL(/\/en\/orders\/new$/);

  await page.locator("#order-store").click();
  await page.getByRole("option", { name: CREDITING_STORE_NAME }).click();
  if (orderDateDaysAgo) {
    const civilDay = await resolvePastCivilDay(page, orderDateDaysAgo);
    await pickPastCalendarDate(page, page.locator("#order-date"), civilDay);
  }
  if (recordPreorderWindow) {
    await page.locator("#delivery-range").click();
    // Desktop viewport renders the SHORT preset labels ("7 days"), not the mobile long form
    // ("Next 7 days") — `OrderDeliveryRangeField`'s `isMobile` ternary is inverted from what the
    // labels' own names suggest.
    await page.getByRole("button", { name: /^7 days$/i }).click();
  }
  await page
    .getByRole("button", { name: /^continue$/i })
    .first()
    .click();

  await page
    .getByLabel(/^name$/i)
    .first()
    .fill(`E2E progression item ${Date.now()}`);
  await page.getByLabel(/^total/i).fill("10.00");
  await page
    .getByRole("button", { name: /^continue$/i })
    .first()
    .click();

  await page.getByRole("button", { name: /create order/i }).click();
  await expect(page).toHaveURL(/\/en\/orders\/(?!new)[a-z0-9]+$/i, { timeout: 15_000 });
  return page.url();
}

/**
 * Records a full payment of `amount` against `orderUrl` through the order detail's own inline
 * payment panel (`e2e/order-cancellation.spec.ts`'s `recordFullPayment`, extended with an optional
 * backdated payment day). Polls the hero's own "Allocated" readout on a fresh navigation until the
 * server has actually persisted the allocation, since the next step (logging the arrival) needs the
 * order to already carry an assigned payment (`ORDER_HAS_ASSIGNED_PAYMENT`) for `delivery-received`
 * and `order-completed` to credit at all.
 */
async function recordFullPayment(page: Page, orderUrl: string, amount: string, paymentDateIso?: string): Promise<void> {
  await page.goto(orderUrl);
  await page.getByRole("button", { name: /^record payment$/i }).click();
  if (paymentDateIso) {
    await page.getByRole("button", { name: /change the payment date/i }).click();
    await page.getByLabel(/^date$/i).fill(paymentDateIso);
  }
  await page.getByLabel(/^amount$/i).fill(amount);
  await page
    .locator("form")
    .filter({ has: page.getByLabel(/^amount$/i) })
    .getByRole("button", { name: /^record/i })
    .click();

  await expect(async () => {
    await page.goto(orderUrl);
    await expect(page.getByText(/^allocated /i).first()).toContainText(amount, { timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
}

type LogArrivalOptions = {
  receivedOn?: string;
  /**
   * The "It arrived" dialog defaults to "I already paid the rest" CHECKED, which auto-records a
   * payment dated the SAME day as the arrival the instant an unpaid order logs one. Left at its
   * default (`true`) that is exactly what `escalates a Holográfica unlock…` (`patience-200`) must
   * NOT get: a same-day payment plus a same-day arrival is also the whole of `same-day-settle`
   * (another Holográfica, full-screen medal), and two qualifying unlocks racing for the one
   * celebration slot is not a scenario either body is written to assert on. Pass `false` to
   * uncheck it (clicking the visible label, never the `sr-only` input itself — see
   * `.agents/rules/browser-testing-patterns.mdc`) and leave the order genuinely unpaid.
   */
  settleRemainingBalance?: boolean;
};

/**
 * Logs the arrival of everything in the open order through the one-step arrival flow (`"It
 * arrived"`), which is what credits `delivery-received` and `order-completed` and evaluates the
 * arrival-shaped medals.
 *
 * The dialog dismisses optimistically, before the server has actually answered
 * (`.agents/rules/modal-canonical-pattern.mdc`), and the order page it leaves behind is not proof
 * of anything: it still shows the pre-arrival "Pending at store" state (with a "Create delivery"
 * link, not a link to the real one just created) until a fresh render catches up. Polling a reload
 * for the derived "Completed" status is what turns "the dialog is gone" into "the arrival actually
 * landed" before anything here (a later loop iteration navigating away, or an assertion) can race it.
 */
async function logArrival(page: Page, orderUrl: string, options?: LogArrivalOptions): Promise<void> {
  const { receivedOn, settleRemainingBalance = true } = options ?? {};
  await page.goto(orderUrl);
  await page
    .getByRole("button", { name: /^it arrived$/i })
    .first()
    .click();

  const dialog = page.getByRole("dialog", { name: /^it arrived$/i });
  await expect(dialog).toBeVisible();
  if (receivedOn) {
    await dialog.getByLabel(/when did it arrive/i).fill(receivedOn);
  }
  // The dialog fetches the order's current settlement context in the background ("Calculating the
  // payment…") and only decides whether to show the "I already paid the rest" checkbox once that
  // resolves. Submitting before it settles has raced the mutation itself in practice: the arrival
  // never landed, silently, with no error surfaced anywhere. Waiting it out first is what makes the
  // submit that follows trustworthy.
  await expect(dialog.getByText(/calculating the payment/i)).toHaveCount(0, { timeout: 10_000 });
  if (!settleRemainingBalance) {
    const payTheRestLabel = dialog.getByText(/^i already paid the rest$/i);
    if (await payTheRestLabel.isVisible().catch(() => false)) {
      await payTheRestLabel.click();
    }
  }
  await dialog.getByRole("button", { name: /log (the )?arrival/i }).click();
  await expect(dialog).toHaveCount(0, { timeout: 15_000 });

  // Dev-sized budgets (`playwright.config.ts`'s own reasoning): a `next dev` reload here pays a
  // real Neon round-trip and can outrun a short inner timeout on its own, well before the mutation
  // is even the slow part. A too-short inner check starves every attempt inside `toPass` alike.
  await expect(async () => {
    await page.reload();
    await expect(page.getByText(/^completed$/i).first()).toBeVisible({ timeout: 8_000 });
  }).toPass({ timeout: 45_000 });
}

test.describe("Progression unlock surfaces", () => {
  test.describe.configure({ mode: "serial" });

  // Fixed for every body below except the fourth, which overrides it: comfortably outside
  // `midnight-order`'s [00:00, 04:00) window on every run, regardless of the real time of day.
  test.use({ timezoneId: pickFixedOffsetTimezoneForLocalHour(SAFE_LOCAL_HOUR) });

  test.beforeAll(async () => {
    // Starts every run from the same virgin state a brand-new sign-up would: no medal already
    // unlocked, no rank already celebrated, no order or store payment left over from a previous run
    // to skew a point total. See `resetProgressionAccountState`'s own doc for the guard it enforces.
    await resetProgressionAccountState(process.env.E2E_PROGRESSION_USER_EMAIL ?? "");
  });

  test.afterAll(async () => {
    // Leaves nothing behind for the NEXT run's data-baseline capture to freeze: a row that survived
    // here would be "pre-existing" the moment the next run starts, and this same reset deleting it
    // then would trip the suite-wide guard that protects the collector's real data.
    await resetProgressionAccountState(process.env.E2E_PROGRESSION_USER_EMAIL ?? "");
  });

  test("raises two non-qualifying unlocks one toast at a time, never overlapping", async ({ page }) => {
    skipUnlessProgressionEnv();
    await signInAsProgressionUser(page);

    // The dedicated account's very first order, at a store it has never ordered from and carrying
    // an estimated delivery window it has never recorded either: `first-order` (`ANY_ORDER`) and
    // `first-preorder` (`PREORDER_WINDOW_RECORDED`) both resolve true in the same Server Action
    // response, and both are `Tirada normal`, so both stay on the toast (`FR-12-47`).
    await createCreditingOrder(page, undefined, true);

    const observation = await observeUnlockToasts(page, 2);
    expect(observation.maxSimultaneous).toBe(1);
    expect(observation.names).toHaveLength(2);
    expect(observation.names.join(" ")).toContain(FIRST_ORDER_MEDAL_NAME);
    expect(observation.names.join(" ")).toContain(FIRST_PREORDER_MEDAL_NAME);

    // Neither rarity escalates, so nothing here may open a dialog over the order that was just
    // created.
    await expect(celebrationDialog(page)).toHaveCount(0);
  });

  test("celebrates a rank crossing once and does not replay it after a recompute", async ({ page }) => {
    skipUnlessProgressionEnv();
    // Three full lifecycles (order, backdated payment, arrival), each paying its own dev-server
    // round-trips plus `logArrival`'s reload-poll for the derived "Completed" status: comfortably
    // over the default 90s budget on a cold `next dev`. Same reasoning as `store-payments.spec.ts`'s
    // own `test.setTimeout(180_000)`.
    test.setTimeout(240_000);
    await signInAsProgressionUser(page);

    // The second rank sits at 200 points. Each lifecycle here pays the order in full (backdated
    // `RANK_CROSSING_PAYMENT_OFFSET_DAYS` so it lands on a different civil day than the arrival,
    // see that constant's own doc) before logging the arrival, which is what actually credits
    // `order-registered`, `order-first-payment`, `delivery-received`, `order-completed` and
    // `order-settled` — none of them fire on an unpaid order (`ORDER_HAS_ASSIGNED_PAYMENT`). The
    // celebration is a persistent gate (`ProgressionSettings.lastCelebratedRankIndex` versus the
    // derived rank), not a one-shot toast, so it is still showing on whichever page the loop ends
    // on regardless of which exact lifecycle crossed the threshold.
    for (let index = 0; index < ORDERS_TO_CROSS_FIRST_RANK; index += 1) {
      const orderUrl = await createCreditingOrder(page, RANK_CROSSING_PAYMENT_OFFSET_DAYS);
      // Resolved again (not reused from inside `createCreditingOrder`) so it reflects the SAME
      // civil day the order itself just landed on, read fresh from this now-loaded order page.
      const paymentDate = toDateInputValue(await resolvePastCivilDay(page, RANK_CROSSING_PAYMENT_OFFSET_DAYS));
      await recordFullPayment(page, orderUrl, "10.00", paymentDate);
      await logArrival(page, orderUrl);
    }

    const dialog = celebrationDialog(page);
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByText(RANK_CELEBRATION_KICKER_REGEX)).toBeVisible();

    await dialog.getByRole("button", { name: RANK_CELEBRATION_CTA_REGEX }).click();
    await expect(dialog).toHaveCount(0);

    // The rank is the one fact a later recompute re-derives, which is exactly what the claimed
    // watermark exists to stop. Opening the section schedules that recompute, and the reload after
    // it renders whatever the recompute produced.
    await page.goto("/en/progress");
    await page.reload();
    await expect(celebrationDialog(page)).toHaveCount(0);
  });

  test("escalates a Holográfica unlock to the full-screen celebration", async ({ page }) => {
    skipUnlessProgressionEnv();
    // The calendar has to walk back ~7 months to reach `PATIENCE_200_WAIT_DAYS`, one dev-server
    // round-trip per "previous month" click, on top of `logArrival`'s own reload-poll budget.
    test.setTimeout(120_000);
    await signInAsProgressionUser(page);

    // `patience-200` is the only phase-1 medal at either qualifying tier: an order placed over 200
    // days ago whose products arrive today. Reading `loadArrivalShape` (`medalEvaluation.ts`) shows
    // it needs only a fully-arrived order, no payment, so this body needs neither — and must
    // decline the arrival dialog's own default settlement, or a same-day payment plus a same-day
    // arrival unlocks `same-day-settle` (also Holográfica) alongside it (see `logArrival`'s doc).
    const orderUrl = await createCreditingOrder(page, PATIENCE_200_WAIT_DAYS);
    await logArrival(page, orderUrl, { settleRemainingBalance: false });

    const dialog = celebrationDialog(page);
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByText(PATIENCE_200_MEDAL_NAME)).toBeVisible();

    // Announced by the celebration INSTEAD of the toast, never by both: the same medal arriving
    // twice would read as two unlocks.
    await expect(unlockToasts(page).filter({ hasText: PATIENCE_200_MEDAL_NAME })).toHaveCount(0);

    await dialog.getByRole("button", { name: CELEBRATION_DISMISS_REGEX }).click();
    await expect(dialog).toHaveCount(0);
  });

  test.describe("midnight-order under a controlled timezone", () => {
    // Overrides the outer "safe" zone: this is the one body that must land INSIDE the window
    // instead of outside it. Computed fresh on every run, same mechanism, opposite target hour.
    test.use({ timezoneId: pickFixedOffsetTimezoneForLocalHour(MIDNIGHT_TARGET_LOCAL_HOUR) });

    test("keeps a Primera edición unlock on the toast with no celebration", async ({ page }) => {
      skipUnlessProgressionEnv();
      await signInAsProgressionUser(page);

      // The shell's `TimezoneCapture` syncs the browser's own reported zone (forced above) down to
      // `User.timezone` on mount, fire-and-forget. The wait gives that write time to land before an
      // order is created, so `midnight-order`'s read of this same zone (`getCivilHour`) sees it.
      await page.waitForTimeout(1_500);

      await createCreditingOrder(page);

      await expect(unlockToasts(page).filter({ hasText: MIDNIGHT_ORDER_MEDAL_NAME })).toBeVisible({
        timeout: 15_000,
      });
      // `Primera edición` is below the two qualifying tiers, so the toast is the whole surface.
      await expect(celebrationDialog(page)).toHaveCount(0);
    });
  });
});
