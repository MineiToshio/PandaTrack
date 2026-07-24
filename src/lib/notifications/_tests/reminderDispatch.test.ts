import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationSubjectType, NotificationType } from "../../../../generated/prisma/client";
import type { NotificationPreferenceMap } from "@/lib/data/notifications/notificationQueries";
import type { ReminderCandidate } from "@/lib/data/notifications/reminderCandidateQueries";
import { dispatchReminders, type DispatchDeps, type DispatchSubscription } from "../reminderDispatch";

const NOW = new Date("2026-07-14T12:00:00Z");

const ALL_ENABLED: NotificationPreferenceMap = {
  [NotificationType.PAYMENT_DUE]: true,
  [NotificationType.ARRIVAL_DUE]: true,
  [NotificationType.ARRIVAL_OVERDUE]: true,
  [NotificationType.STORE_REJECTED]: true,
};

const SUBSCRIPTION: DispatchSubscription = { endpoint: "https://push.example.com/a", p256dh: "p", auth: "a" };

function candidate(overrides: Partial<ReminderCandidate> = {}): ReminderCandidate {
  return {
    userId: "user-1",
    type: NotificationType.PAYMENT_DUE,
    subjectType: NotificationSubjectType.ORDER,
    subjectId: "order-1",
    dueDate: new Date("2026-07-15T00:00:00Z"),
    descriptor: "Panda Store",
    locale: null,
    timezone: null,
    ...overrides,
  };
}

function buildDeps(overrides: Partial<DispatchDeps> = {}): DispatchDeps {
  return {
    now: NOW,
    loadCandidates: vi.fn().mockResolvedValue([candidate()]),
    getPreferences: vi.fn().mockResolvedValue(ALL_ENABLED),
    getSubscriptions: vi.fn().mockResolvedValue([SUBSCRIPTION]),
    hasBeenDelivered: vi.fn().mockResolvedValue(false),
    recordDelivery: vi.fn().mockResolvedValue({ recorded: true }),
    sendPush: vi.fn().mockResolvedValue("SENT"),
    pruneSubscription: vi.fn().mockResolvedValue(undefined),
    getTranslator: vi.fn().mockResolvedValue((key: string) => key),
    resolveLocale: vi.fn().mockReturnValue("es"),
    ...overrides,
  };
}

describe("dispatchReminders", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends a payment reminder, writes the dedup row, and reports it in the summary", async () => {
    const deps = buildDeps();

    const summary = await dispatchReminders(deps);

    expect(deps.sendPush).toHaveBeenCalledTimes(1);
    expect(deps.recordDelivery).toHaveBeenCalledWith({
      userId: "user-1",
      type: NotificationType.PAYMENT_DUE,
      subjectType: NotificationSubjectType.ORDER,
      subjectId: "order-1",
      dueDate: new Date("2026-07-15T00:00:00Z"),
    });
    expect(summary.byType.PAYMENT_DUE).toMatchObject({ attempted: 1, sent: 1, deduped: 0 });
    expect(summary.totals).toMatchObject({ attempted: 1, sent: 1, pruned: 0, transientFailures: 0 });
  });

  it("skips a candidate whose per-type preference is off (BR-09-01, AC-09-09)", async () => {
    const deps = buildDeps({
      getPreferences: vi.fn().mockResolvedValue({ ...ALL_ENABLED, [NotificationType.PAYMENT_DUE]: false }),
    });

    const summary = await dispatchReminders(deps);

    expect(deps.sendPush).not.toHaveBeenCalled();
    expect(summary.totals.attempted).toBe(0);
  });

  it("skips a collector with no active subscription", async () => {
    const deps = buildDeps({ getSubscriptions: vi.fn().mockResolvedValue([]) });

    const summary = await dispatchReminders(deps);

    expect(deps.sendPush).not.toHaveBeenCalled();
    expect(summary.totals.attempted).toBe(0);
  });

  it("skips a candidate outside the collector's timezone window", async () => {
    const deps = buildDeps({
      loadCandidates: vi.fn().mockResolvedValue([candidate({ dueDate: new Date("2026-08-30T00:00:00Z") })]),
    });

    const summary = await dispatchReminders(deps);

    expect(deps.hasBeenDelivered).not.toHaveBeenCalled();
    expect(deps.sendPush).not.toHaveBeenCalled();
    expect(summary.totals.attempted).toBe(0);
  });

  it("skips and counts a candidate that was already delivered (BR-09-02, AC-09-05)", async () => {
    const deps = buildDeps({ hasBeenDelivered: vi.fn().mockResolvedValue(true) });

    const summary = await dispatchReminders(deps);

    expect(deps.sendPush).not.toHaveBeenCalled();
    expect(summary.byType.PAYMENT_DUE).toMatchObject({ attempted: 0, sent: 0, deduped: 1 });
  });

  it("prunes an expired endpoint without aborting the batch (BR-09-07, AC-09-07)", async () => {
    const second = candidate({ subjectId: "order-2", dueDate: new Date("2026-07-16T00:00:00Z") });
    const deps = buildDeps({
      loadCandidates: vi.fn().mockResolvedValue([candidate(), second]),
      sendPush: vi.fn().mockResolvedValue("EXPIRED"),
    });

    const summary = await dispatchReminders(deps);

    // First candidate prunes the endpoint; the second finds no active subscription left.
    expect(deps.pruneSubscription).toHaveBeenCalledWith(SUBSCRIPTION.endpoint);
    expect(deps.sendPush).toHaveBeenCalledTimes(1);
    expect(deps.recordDelivery).not.toHaveBeenCalled();
    expect(summary.byType.PAYMENT_DUE).toMatchObject({ attempted: 1, sent: 0, pruned: 1 });
  });

  it("counts a transient failure and does not write the dedup row", async () => {
    const deps = buildDeps({ sendPush: vi.fn().mockResolvedValue("TRANSIENT_FAILURE") });

    const summary = await dispatchReminders(deps);

    expect(deps.recordDelivery).not.toHaveBeenCalled();
    expect(summary.byType.PAYMENT_DUE).toMatchObject({ attempted: 1, sent: 0, transientFailures: 1 });
  });

  it("sends to every active subscription and records once when at least one succeeds", async () => {
    const second: DispatchSubscription = { endpoint: "https://push.example.com/b", p256dh: "p2", auth: "a2" };
    const deps = buildDeps({
      getSubscriptions: vi.fn().mockResolvedValue([SUBSCRIPTION, second]),
      sendPush: vi.fn().mockResolvedValueOnce("TRANSIENT_FAILURE").mockResolvedValueOnce("SENT"),
    });

    const summary = await dispatchReminders(deps);

    expect(deps.sendPush).toHaveBeenCalledTimes(2);
    expect(deps.recordDelivery).toHaveBeenCalledTimes(1);
    expect(summary.byType.PAYMENT_DUE).toMatchObject({ attempted: 1, sent: 1, transientFailures: 1 });
  });

  it("treats a losing dedup write race as deduped rather than sent", async () => {
    const deps = buildDeps({ recordDelivery: vi.fn().mockResolvedValue({ recorded: false }) });

    const summary = await dispatchReminders(deps);

    expect(summary.byType.PAYMENT_DUE).toMatchObject({ attempted: 1, sent: 0, deduped: 1 });
  });

  it("passes a money-free payload (title/body/url/tag only) to the transport", async () => {
    const sendPush = vi.fn().mockResolvedValue("SENT");
    const deps = buildDeps({ sendPush });

    await dispatchReminders(deps);

    const payload = sendPush.mock.calls[0][1];
    expect(Object.keys(payload).sort()).toEqual(["body", "tag", "title", "url"]);
  });

  it("returns a per-type summary with folded totals across all three types", async () => {
    const deps = buildDeps({
      loadCandidates: vi.fn().mockResolvedValue([
        candidate({ type: NotificationType.PAYMENT_DUE, subjectId: "o1", dueDate: new Date("2026-07-15T00:00:00Z") }),
        candidate({ type: NotificationType.ARRIVAL_DUE, subjectId: "o2", dueDate: new Date("2026-07-16T00:00:00Z") }),
        candidate({
          type: NotificationType.ARRIVAL_OVERDUE,
          subjectType: NotificationSubjectType.DELIVERY,
          subjectId: "d1",
          dueDate: new Date("2026-07-10T00:00:00Z"),
        }),
      ]),
    });

    const summary = await dispatchReminders(deps);

    expect(Object.keys(summary.byType).sort()).toEqual(["ARRIVAL_DUE", "ARRIVAL_OVERDUE", "PAYMENT_DUE"]);
    expect(summary.totals).toMatchObject({ attempted: 3, sent: 3 });
  });
});
