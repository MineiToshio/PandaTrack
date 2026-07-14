import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { NotificationType } from "../../../../../../generated/prisma/client";
import type { DispatchRunSummary } from "@/lib/notifications/reminderDispatch";

const {
  dispatchRemindersMock,
  getPostHogClientMock,
  captureMock,
  captureExceptionMock,
  withScopeMock,
  getTranslationsMock,
} = vi.hoisted(() => ({
  dispatchRemindersMock: vi.fn(),
  getPostHogClientMock: vi.fn(),
  captureMock: vi.fn(),
  captureExceptionMock: vi.fn(),
  withScopeMock: vi.fn(),
  getTranslationsMock: vi.fn(),
}));

vi.mock("@/lib/notifications/reminderDispatch", () => ({ dispatchReminders: dispatchRemindersMock }));
vi.mock("@/lib/analytics/posthog-server", () => ({ getPostHogClient: getPostHogClientMock }));
vi.mock("next-intl/server", () => ({ getTranslations: getTranslationsMock }));
vi.mock("@sentry/nextjs", () => ({
  captureException: captureExceptionMock,
  withScope: withScopeMock,
}));
// Stub the modules that pull the real Prisma client and web-push transport at import time.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/push", () => ({ sendPushMessage: vi.fn() }));

import { GET, POST } from "../route";

const SECRET = "test-secret";

function emptyTypeSummary() {
  return { attempted: 0, sent: 0, deduped: 0, pruned: 0, transientFailures: 0 };
}

const RUN_SUMMARY: DispatchRunSummary = {
  byType: {
    [NotificationType.PAYMENT_DUE]: { attempted: 2, sent: 2, deduped: 0, pruned: 0, transientFailures: 0 },
    [NotificationType.ARRIVAL_DUE]: emptyTypeSummary(),
    [NotificationType.ARRIVAL_OVERDUE]: emptyTypeSummary(),
  },
  totals: { attempted: 2, sent: 2, deduped: 0, pruned: 0, transientFailures: 0 },
};

function request(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/notifications/dispatch", { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = SECRET;
  getPostHogClientMock.mockReturnValue({ capture: captureMock });
  withScopeMock.mockImplementation((callback: (scope: { setTag: () => void }) => void) =>
    callback({ setTag: vi.fn() }),
  );
  dispatchRemindersMock.mockResolvedValue(RUN_SUMMARY);
});

afterEach(() => {
  process.env.CRON_SECRET = SECRET;
});

describe("dispatch route guard", () => {
  it("rejects a request with no Authorization header before any work (AC-09-08)", async () => {
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(dispatchRemindersMock).not.toHaveBeenCalled();
  });

  it("rejects a request with a wrong secret before any work", async () => {
    const response = await POST(request({ authorization: "Bearer wrong" }));

    expect(response.status).toBe(401);
    expect(dispatchRemindersMock).not.toHaveBeenCalled();
  });

  it("rejects every request when CRON_SECRET is unset (fail closed)", async () => {
    delete process.env.CRON_SECRET;

    const response = await GET(request({ authorization: "Bearer " }));

    expect(response.status).toBe(401);
    expect(dispatchRemindersMock).not.toHaveBeenCalled();
  });
});

describe("dispatch route run", () => {
  it("runs the dispatcher and returns the run summary on a correct secret", async () => {
    const response = await GET(request({ authorization: `Bearer ${SECRET}` }));

    expect(response.status).toBe(200);
    expect(dispatchRemindersMock).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual(RUN_SUMMARY);
  });

  it("reports the run summary to PostHog with count-only properties", async () => {
    await POST(request({ authorization: `Bearer ${SECRET}` }));

    expect(captureMock).toHaveBeenCalledTimes(1);
    const capture = captureMock.mock.calls[0][0];
    expect(capture.event).toBe("notification_dispatch_run");
    expect(capture.properties).toMatchObject({ attempted: 2, sent: 2, payment_due_sent: 2 });
  });

  it("captures an unexpected failure once with Sentry and returns 500", async () => {
    dispatchRemindersMock.mockRejectedValueOnce(new Error("db down"));

    const response = await GET(request({ authorization: `Bearer ${SECRET}` }));

    expect(response.status).toBe(500);
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
  });
});
