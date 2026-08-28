import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProgressionDelta } from "@/lib/data/progression/accrual";

const { addToastMock, claimRankMock, claimWelcomeMock, pushMock, captureMock } = vi.hoisted(() => ({
  addToastMock: vi.fn(),
  claimRankMock: vi.fn(),
  claimWelcomeMock: vi.fn(),
  pushMock: vi.fn(),
  captureMock: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) =>
    values
      ? Object.entries(values).reduce((text, [token, value]) => text.replaceAll(`{${token}}`, String(value)), key)
      : key,
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock, refresh: vi.fn() }) }));
vi.mock("posthog-js", () => ({ default: { capture: captureMock } }));

vi.mock("@/contexts/ToastContext", async () => {
  const actual = await vi.importActual<typeof import("@/contexts/ToastContext")>("@/contexts/ToastContext");
  return { ...actual, useToast: () => ({ addToast: addToastMock, removeToast: vi.fn() }) };
});

vi.mock("@/app/[locale]/(app)/_actions/progressionCelebrationActions", () => ({
  claimRankCelebrationAction: claimRankMock,
  claimWelcomeCelebrationAction: claimWelcomeMock,
}));

import { ProgressionFeedbackProvider, useProgressionFeedback } from "../ProgressionFeedbackContext";

/** The rank-up shape `settleProgression` hands back, with no medals attached. */
function delta(patch: Partial<ProgressionDelta> = {}): ProgressionDelta {
  return { pointsDelta: 10, rankUp: null, medalsUnlocked: [], ...patch };
}

function medal(medalKey: string, rarity: string) {
  return { medalKey, rarity, series: "first-steps" };
}

let announce: (value: ProgressionDelta | null) => void = () => {};

function Probe() {
  const { announceProgression } = useProgressionFeedback();
  // Published after render, not during: the provider's own value is stable, and reassigning a
  // module-level binding mid-render is the side effect React's rules forbid.
  useEffect(() => {
    announce = announceProgression;
  });
  return null;
}

function renderProvider(options: { visible?: boolean; welcomePending?: boolean } = {}) {
  return render(
    <ProgressionFeedbackProvider
      locale="es"
      progressionVisible={options.visible ?? true}
      onProgressionVisibleChange={vi.fn()}
      welcomeCelebrationPending={options.welcomePending ?? false}
    >
      <Probe />
    </ProgressionFeedbackProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  claimRankMock.mockResolvedValue({ claimed: false });
  claimWelcomeMock.mockResolvedValue({ claimed: false });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("unlock toast queue", () => {
  it("raises two unlocks one at a time, the second only after the first's window", () => {
    renderProvider();

    act(() => {
      announce(delta({ medalsUnlocked: [medal("first-order", "normal"), medal("first-payment", "normal")] }));
    });
    expect(addToastMock).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(addToastMock).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(addToastMock).toHaveBeenCalledTimes(2);
  });

  it("raises the toast in the achievement variant, carrying the rarity ring", () => {
    renderProvider();

    act(() => {
      announce(delta({ medalsUnlocked: [medal("first-order", "normal")] }));
    });

    const [, options] = addToastMock.mock.calls[0];
    expect(options.variant).toBe("achievement");
    expect(options.achievement.ringVar).toBe("var(--rarity-normal)");
  });

  it("raises nothing for an empty unlock list", () => {
    renderProvider();

    act(() => {
      announce(delta({ medalsUnlocked: [] }));
    });
    expect(addToastMock).not.toHaveBeenCalled();
  });

  it("raises nothing at all while the layer is hidden", () => {
    renderProvider({ visible: false });

    act(() => {
      announce(delta({ medalsUnlocked: [medal("first-order", "normal")] }));
    });
    expect(addToastMock).not.toHaveBeenCalled();
  });

  it("raises nothing for a null delta, which means the credit outcome is unknown", () => {
    renderProvider();

    act(() => {
      announce(null);
    });
    expect(addToastMock).not.toHaveBeenCalled();
  });
});

describe("order-creation points toast", () => {
  it("states both the immediate credit and the deferred amount when one is still owed (FR-12-05)", () => {
    renderProvider();

    act(() => {
      announce(delta({ pointsDelta: 5, deferredOrderPoints: 20 }));
    });

    expect(addToastMock).toHaveBeenCalledTimes(1);
    expect(addToastMock.mock.calls[0][0]).toBe("creation.toast.withDeferred");
    expect(addToastMock.mock.calls[0][1].variant).toBe("success");
    expect(captureMock).toHaveBeenCalledWith(
      "order_points_toast_shown",
      expect.objectContaining({ points_delta: 5, deferred_points: 20 }),
    );
  });

  it("states only the immediate credit once nothing is left to defer", () => {
    renderProvider();

    act(() => {
      // An initial payment declared alongside the order already credited `order-registered`, so
      // the write path reports `null`: nothing remains, and the deferred sentence must not appear.
      announce(delta({ pointsDelta: 25, deferredOrderPoints: null }));
    });

    expect(addToastMock).toHaveBeenCalledTimes(1);
    expect(addToastMock.mock.calls[0][0]).toBe("creation.toast.immediateOnly");
  });

  it("stays silent when the store cannot credit anything at all", () => {
    renderProvider();

    act(() => {
      announce(delta({ pointsDelta: 0, deferredOrderPoints: null }));
    });

    expect(addToastMock).not.toHaveBeenCalled();
  });

  it("never fires for a delta from a different credited action, which never carries this field", () => {
    renderProvider();

    act(() => {
      // A payment/delivery/review delta has no `deferredOrderPoints` key at all (`undefined`, not
      // `null`), which is what tells this toast apart from every other credited action.
      announce(delta({ pointsDelta: 8 }));
    });

    expect(addToastMock).not.toHaveBeenCalled();
  });

  it("stays silent while the layer is hidden, same as every other progression surface", () => {
    renderProvider({ visible: false });

    act(() => {
      announce(delta({ pointsDelta: 5, deferredOrderPoints: 20 }));
    });

    expect(addToastMock).not.toHaveBeenCalled();
  });
});

describe("unlock burst collapse", () => {
  /** The ten phase-1 medals a migrated history unlocks on its very first credited action. */
  const MIGRATED_HISTORY_BURST = [
    medal("first-order", "normal"),
    medal("first-payment", "normal"),
    medal("first-arrival", "normal"),
    medal("first-order-closed", "normal"),
    medal("first-store", "normal"),
    medal("patience-60", "first-print"),
    medal("patience-120", "limited"),
    medal("patience-200", "holo"),
    medal("split-arrival", "first-print"),
    medal("midnight-order", "first-print"),
  ];

  it("keeps announcing three unlocks one by one, which is still a readable sequence", () => {
    renderProvider();

    act(() => {
      announce(
        delta({
          medalsUnlocked: [
            medal("first-order", "normal"),
            medal("first-payment", "normal"),
            medal("first-store", "normal"),
          ],
        }),
      );
      vi.advanceTimersByTime(20_000);
    });

    expect(addToastMock).toHaveBeenCalledTimes(3);
    expect(addToastMock.mock.calls[0][0]).toBe("medals.first-order.name");
  });

  it("collapses a four-medal batch into one toast naming the count", () => {
    renderProvider();

    act(() => {
      announce(
        delta({
          medalsUnlocked: [
            medal("first-order", "normal"),
            medal("first-payment", "normal"),
            medal("first-store", "normal"),
            medal("first-arrival", "normal"),
          ],
        }),
      );
      vi.advanceTimersByTime(60_000);
    });

    expect(addToastMock).toHaveBeenCalledTimes(1);
    expect(addToastMock.mock.calls[0][0]).toBe("celebration.burst.title");
    expect(addToastMock.mock.calls[0][1].achievement.kicker).toBe("celebration.burst.kicker");
  });

  it("collapses the migrated history's ten unlocks into one toast and no medal dialog", async () => {
    renderProvider();

    await act(async () => {
      announce(delta({ medalsUnlocked: MIGRATED_HISTORY_BURST }));
    });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(addToastMock).toHaveBeenCalledTimes(1);
    // Worn by the rarest of the batch, so the moment still looks earned rather than generic.
    expect(addToastMock.mock.calls[0][1].achievement.ringVar).toBe("var(--rarity-holo)");
    // The holographic unlock inside a burst does NOT also open the full-screen surface: that would
    // put back the interruption the collapse exists to remove.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("still celebrates a rank crossing that arrives with a burst", async () => {
    claimRankMock.mockResolvedValue({
      claimed: true,
      content: {
        rankKey: "guild-senpai",
        rankIndex: 4,
        previousRankIndex: 3,
        totalPoints: 1400,
        nextRank: null,
        nextRankProgressPercent: 100,
      },
    });
    renderProvider();

    await act(async () => {
      announce(delta({ rankUp: { from: 3, to: 4 }, medalsUnlocked: MIGRATED_HISTORY_BURST }));
    });

    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByText("ranks.guild-senpai.name")).toBeInTheDocument();
  });
});

describe("full-screen celebration selection", () => {
  it("escalates a holographic unlock to the celebration instead of the toast", async () => {
    renderProvider();

    await act(async () => {
      announce(delta({ medalsUnlocked: [medal("patience-200", "holo")] }));
    });

    expect(addToastMock).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("escalates a signed unlock the same way", async () => {
    renderProvider();

    await act(async () => {
      announce(delta({ medalsUnlocked: [medal("patience-200", "signed")] }));
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it.each(["normal", "first-print", "limited"])("keeps a %s unlock on the toast alone", async (rarity) => {
    renderProvider();

    await act(async () => {
      announce(delta({ medalsUnlocked: [medal("midnight-order", rarity)] }));
    });

    expect(addToastMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a rank-up and a qualifying unlock in sequence, never two dialogs at once", async () => {
    claimRankMock.mockResolvedValue({
      claimed: true,
      content: {
        rankKey: "guild-senpai",
        rankIndex: 4,
        previousRankIndex: 3,
        totalPoints: 1400,
        nextRank: null,
        nextRankProgressPercent: 100,
      },
    });
    renderProvider();

    await act(async () => {
      announce(delta({ rankUp: { from: 3, to: 4 }, medalsUnlocked: [medal("patience-200", "holo")] }));
    });

    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByText("ranks.guild-senpai.name")).toBeInTheDocument();
  });

  it("does not open the rank celebration when the claim was already taken", async () => {
    claimRankMock.mockResolvedValue({ claimed: false });
    renderProvider();

    await act(async () => {
      announce(delta({ rankUp: { from: 3, to: 4 } }));
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("claims the rank with both the reached and the abandoned index", async () => {
    renderProvider();

    await act(async () => {
      announce(delta({ rankUp: { from: 3, to: 4 } }));
    });

    expect(claimRankMock).toHaveBeenCalledWith(4, 3);
  });
});

describe("aggregated welcome", () => {
  it("claims the welcome once when the shell reports one pending", async () => {
    claimWelcomeMock.mockResolvedValue({
      claimed: true,
      content: { rankKey: "guild-senpai", rankIndex: 4, medalCount: 7 },
    });

    await act(async () => {
      renderProvider({ welcomePending: true });
    });

    expect(claimWelcomeMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not claim anything when the shell reports none pending", async () => {
    await act(async () => {
      renderProvider({ welcomePending: false });
    });

    expect(claimWelcomeMock).not.toHaveBeenCalled();
  });

  it("does not claim anything while the layer is hidden", async () => {
    await act(async () => {
      renderProvider({ welcomePending: true, visible: false });
    });

    expect(claimWelcomeMock).not.toHaveBeenCalled();
  });
});
