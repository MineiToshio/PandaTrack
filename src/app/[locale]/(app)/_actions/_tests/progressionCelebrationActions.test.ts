import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, claimRankMock, cacheMock, contentMock, captureMock, shutdownMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  claimRankMock: vi.fn(),
  cacheMock: vi.fn(),
  contentMock: vi.fn(),
  captureMock: vi.fn(),
  shutdownMock: vi.fn(),
}));

vi.mock("@/lib/auth/auth-server", () => ({ getSession: getSessionMock }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/analytics/posthog-server", () => ({
  getPostHogClient: () => ({ capture: captureMock, shutdown: shutdownMock }),
}));
vi.mock("@/lib/data/progression/progressionMutations", () => ({ claimRankCelebration: claimRankMock }));
vi.mock("@/lib/data/progression/progressionQueries", () => ({
  getUserProgressCache: cacheMock,
  getRankCelebrationContent: contentMock,
  getWelcomeCelebrationContent: vi.fn(),
}));

import { claimRankCelebrationAction } from "../progressionCelebrationActions";

const CONTENT = {
  rankKey: "guild-senpai" as const,
  rankIndex: 4,
  previousRankIndex: 3,
  totalPoints: 1400,
  nextRank: null,
  nextRankProgressPercent: 100,
};

beforeEach(() => {
  vi.clearAllMocks();
  getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
  claimRankMock.mockResolvedValue(true);
  contentMock.mockResolvedValue(CONTENT);
});

describe("claimRankCelebrationAction", () => {
  it("claims a rank the server itself already recorded as reached", async () => {
    cacheMock.mockResolvedValue({ highestRankIndex: 4, rankIndex: 4, maturedPoints: 1400 });

    await expect(claimRankCelebrationAction(4, 3)).resolves.toEqual({ claimed: true, content: CONTENT });
    expect(claimRankMock).toHaveBeenCalledWith("user-1", 4);
  });

  it("refuses a rank above the recorded high-water mark without touching the watermark", async () => {
    // The rank arrives from the client. A tampered or stale index that claimed anyway would advance
    // `lastCelebratedRankIndex` past ranks the collector has not reached, permanently swallowing
    // every real celebration below it.
    cacheMock.mockResolvedValue({ highestRankIndex: 2, rankIndex: 2, maturedPoints: 240 });

    await expect(claimRankCelebrationAction(10, 1)).resolves.toEqual({ claimed: false });
    expect(claimRankMock).not.toHaveBeenCalled();
  });

  it("refuses when no progression has ever been derived for the collector", async () => {
    cacheMock.mockResolvedValue(null);

    await expect(claimRankCelebrationAction(2, 1)).resolves.toEqual({ claimed: false });
    expect(claimRankMock).not.toHaveBeenCalled();
  });

  it("refuses an unauthenticated caller before reading anything", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(claimRankCelebrationAction(4, 3)).resolves.toEqual({ claimed: false });
    expect(cacheMock).not.toHaveBeenCalled();
    expect(claimRankMock).not.toHaveBeenCalled();
  });
});
