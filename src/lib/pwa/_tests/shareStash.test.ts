import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearShareStash,
  readAndClearShareStash,
  type ShareStashPickupContext,
  SHARE_INTAKE_PATH,
  SHARE_SOURCE_PARAM,
  SHARE_SOURCE_SHARE,
  SHARE_STASH_CACHE_NAME,
  SHARE_STASH_FAILED,
  SHARE_STASH_FILE_URL_PREFIX,
  SHARE_STASH_INDEX_URL,
  SHARE_STASH_INDEX_VERSION,
  SHARE_STASH_PARAM,
  SHARE_STASH_TTL_MS,
  SHARE_TARGET_ACTION_PATH,
  SHARE_TARGET_FILES_FIELD,
  sweepExpiredShareStash,
} from "../shareStash";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

type StoredEntry = { json?: unknown; blob?: Blob; type?: string };

/**
 * Minimal Cache Storage double. Real `Response` objects are avoided on purpose: the helper only
 * ever calls `json()` and `blob()`, and jsdom does not guarantee a `Response` implementation.
 */
function installCaches(entries: Record<string, StoredEntry>) {
  const deleted: string[] = [];
  const cache = {
    match: vi.fn(async (key: string) => {
      const entry = entries[key];
      if (!entry) return undefined;
      return {
        json: async () => entry.json,
        blob: async () => entry.blob ?? new Blob([]),
      };
    }),
  };
  const cachesStub = {
    open: vi.fn(async () => cache),
    delete: vi.fn(async (name: string) => {
      deleted.push(name);
      return true;
    }),
  };
  vi.stubGlobal("caches", cachesStub);
  return { cache, cachesStub, deleted };
}

function buildIndex(overrides?: { createdAt?: number; version?: number; files?: unknown[] }) {
  return {
    version: overrides?.version ?? SHARE_STASH_INDEX_VERSION,
    createdAt: overrides?.createdAt ?? Date.now(),
    files: overrides?.files ?? [
      { key: `${SHARE_STASH_FILE_URL_PREFIX}0`, name: "chat.png", type: "image/png" },
      { key: `${SHARE_STASH_FILE_URL_PREFIX}1`, name: "receipt.webp", type: "image/webp" },
    ],
  };
}

/** A session that was already open when the stash was written, which is the ordinary case. */
function sessionOlderThanStash(stashCreatedAt: number = Date.now()): ShareStashPickupContext {
  return { sessionStartedAt: stashCreatedAt - 60_000 };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("readAndClearShareStash", () => {
  it("rebuilds the shared files in order and clears the stash", async () => {
    const { deleted } = installCaches({
      [SHARE_STASH_INDEX_URL]: { json: buildIndex() },
      [`${SHARE_STASH_FILE_URL_PREFIX}0`]: { blob: new Blob(["first"], { type: "image/png" }) },
      [`${SHARE_STASH_FILE_URL_PREFIX}1`]: { blob: new Blob(["second"], { type: "image/webp" }) },
    });

    const result = await readAndClearShareStash(sessionOlderThanStash());

    expect(result.outcome).toBe("picked");
    const files = result.outcome === "picked" ? result.pickup.files : [];
    expect(files.map((file) => file.name)).toEqual(["chat.png", "receipt.webp"]);
    expect(files.map((file) => file.type)).toEqual(["image/png", "image/webp"]);
    expect(deleted).toEqual([SHARE_STASH_CACHE_NAME]);
  });

  it("refuses a stash written before the current session started and still clears it", async () => {
    const stashCreatedAt = Date.now() - 30_000;
    const { deleted } = installCaches({
      [SHARE_STASH_INDEX_URL]: { json: buildIndex({ createdAt: stashCreatedAt }) },
      [`${SHARE_STASH_FILE_URL_PREFIX}0`]: { blob: new Blob(["first"], { type: "image/png" }) },
      [`${SHARE_STASH_FILE_URL_PREFIX}1`]: { blob: new Blob(["second"], { type: "image/webp" }) },
    });

    const result = await readAndClearShareStash({ sessionStartedAt: stashCreatedAt + 1_000 });

    expect(result).toEqual({ outcome: "identity-changed" });
    expect(deleted).toEqual([SHARE_STASH_CACHE_NAME]);
  });

  it("refuses a stash when the session cannot be established at all", async () => {
    installCaches({
      [SHARE_STASH_INDEX_URL]: { json: buildIndex() },
      [`${SHARE_STASH_FILE_URL_PREFIX}0`]: { blob: new Blob(["first"], { type: "image/png" }) },
      [`${SHARE_STASH_FILE_URL_PREFIX}1`]: { blob: new Blob(["second"], { type: "image/webp" }) },
    });

    await expect(readAndClearShareStash({ sessionStartedAt: null })).resolves.toEqual({
      outcome: "identity-changed",
    });
  });

  it("reports empty and clears the stash when the entry is older than the TTL", async () => {
    const createdAt = Date.now() - SHARE_STASH_TTL_MS - 1;
    const { deleted } = installCaches({
      [SHARE_STASH_INDEX_URL]: { json: buildIndex({ createdAt }) },
      [`${SHARE_STASH_FILE_URL_PREFIX}0`]: { blob: new Blob(["first"], { type: "image/png" }) },
    });

    await expect(readAndClearShareStash(sessionOlderThanStash(createdAt))).resolves.toEqual({ outcome: "empty" });
    expect(deleted).toEqual([SHARE_STASH_CACHE_NAME]);
  });

  it("keeps a stash that is still inside the TTL window", async () => {
    const createdAt = Date.now() - (SHARE_STASH_TTL_MS - 1_000);
    installCaches({
      [SHARE_STASH_INDEX_URL]: {
        json: buildIndex({
          createdAt,
          files: [{ key: `${SHARE_STASH_FILE_URL_PREFIX}0`, name: "chat.png", type: "image/png" }],
        }),
      },
      [`${SHARE_STASH_FILE_URL_PREFIX}0`]: { blob: new Blob(["first"], { type: "image/png" }) },
    });

    const result = await readAndClearShareStash(sessionOlderThanStash(createdAt));

    expect(result.outcome === "picked" && result.pickup.files).toHaveLength(1);
  });

  it("reports empty when nothing was ever stashed", async () => {
    installCaches({});

    await expect(readAndClearShareStash(sessionOlderThanStash())).resolves.toEqual({ outcome: "empty" });
  });

  it("reports empty and clears the stash when the index shape is not recognised", async () => {
    const { deleted } = installCaches({
      [SHARE_STASH_INDEX_URL]: { json: { version: 99, createdAt: Date.now(), files: [] } },
    });

    await expect(readAndClearShareStash(sessionOlderThanStash())).resolves.toEqual({ outcome: "empty" });
    expect(deleted).toEqual([SHARE_STASH_CACHE_NAME]);
  });

  it("reports empty when the index lists files the cache no longer holds", async () => {
    installCaches({ [SHARE_STASH_INDEX_URL]: { json: buildIndex() } });

    await expect(readAndClearShareStash(sessionOlderThanStash())).resolves.toEqual({ outcome: "empty" });
  });

  it("reports a cache failure to Sentry and still clears the stash", async () => {
    const Sentry = await import("@sentry/nextjs");
    const failingCache = {
      match: vi.fn(async () => {
        throw new Error("cache unavailable");
      }),
    };
    const deleted: string[] = [];
    vi.stubGlobal("caches", {
      open: vi.fn(async () => failingCache),
      delete: vi.fn(async (name: string) => {
        deleted.push(name);
        return true;
      }),
    });

    await expect(readAndClearShareStash(sessionOlderThanStash())).resolves.toEqual({ outcome: "empty" });
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(deleted).toEqual([SHARE_STASH_CACHE_NAME]);
  });

  it("is a no-op in a browser without Cache Storage", async () => {
    vi.stubGlobal("caches", undefined);

    await expect(readAndClearShareStash(sessionOlderThanStash())).resolves.toEqual({ outcome: "empty" });
    await expect(clearShareStash()).resolves.toBeUndefined();
  });
});

describe("sweepExpiredShareStash", () => {
  it("drops an expired stash nobody came back for", async () => {
    const { deleted } = installCaches({
      [SHARE_STASH_INDEX_URL]: { json: buildIndex({ createdAt: Date.now() - SHARE_STASH_TTL_MS - 1 }) },
    });

    await sweepExpiredShareStash();

    expect(deleted).toEqual([SHARE_STASH_CACHE_NAME]);
  });

  it("leaves a stash that is still within its TTL for the pickup to consume", async () => {
    const { deleted } = installCaches({
      [SHARE_STASH_INDEX_URL]: { json: buildIndex() },
    });

    await sweepExpiredShareStash();

    expect(deleted).toEqual([]);
  });

  it("does nothing when nothing was ever stashed", async () => {
    const { deleted } = installCaches({});

    await sweepExpiredShareStash();

    expect(deleted).toEqual([]);
  });

  it("drops an index no future pickup could read", async () => {
    const { deleted } = installCaches({
      [SHARE_STASH_INDEX_URL]: { json: { version: 99, createdAt: Date.now(), files: [] } },
    });

    await sweepExpiredShareStash();

    expect(deleted).toEqual([SHARE_STASH_CACHE_NAME]);
  });

  it("is a no-op in a browser without Cache Storage", async () => {
    vi.stubGlobal("caches", undefined);

    await expect(sweepExpiredShareStash()).resolves.toBeUndefined();
  });
});

describe("service worker share contract", () => {
  const serviceWorkerSource = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");

  /**
   * The worker is a static asset and cannot import the module above, so every shared value is
   * duplicated there as a literal. This is the guard that keeps the two copies identical: a rename
   * on either side breaks the hand-off silently at runtime, on a real user's shared screenshot.
   */
  it.each([
    ["SHARE_TARGET_ACTION_PATH", SHARE_TARGET_ACTION_PATH],
    ["SHARE_TARGET_FILES_FIELD", SHARE_TARGET_FILES_FIELD],
    ["SHARE_INTAKE_PATH", SHARE_INTAKE_PATH],
    ["SHARE_SOURCE_PARAM", SHARE_SOURCE_PARAM],
    ["SHARE_SOURCE_SHARE", SHARE_SOURCE_SHARE],
    ["SHARE_STASH_PARAM", SHARE_STASH_PARAM],
    ["SHARE_STASH_FAILED", SHARE_STASH_FAILED],
    ["SHARE_STASH_CACHE_NAME", SHARE_STASH_CACHE_NAME],
    ["SHARE_STASH_INDEX_URL", SHARE_STASH_INDEX_URL],
    ["SHARE_STASH_FILE_URL_PREFIX", SHARE_STASH_FILE_URL_PREFIX],
  ])("declares %s with the same value as the client module", (name, value) => {
    expect(serviceWorkerSource).toContain(`const ${name} = "${value}";`);
  });

  it("declares the same index version", () => {
    expect(serviceWorkerSource).toContain(`const SHARE_STASH_INDEX_VERSION = ${SHARE_STASH_INDEX_VERSION};`);
  });

  it("declares the same stash TTL, used by its own activate-time sweep", () => {
    expect(serviceWorkerSource).toContain(`const SHARE_STASH_TTL_MS = ${SHARE_STASH_TTL_MS};`);
  });

  it("intercepts only the share-target POST", () => {
    expect(serviceWorkerSource).toContain('if (request.method !== "POST") return;');
    expect(serviceWorkerSource).toContain("url.pathname !== SHARE_TARGET_ACTION_PATH");
  });

  it("redirects with See Other so the share becomes a navigation", () => {
    expect(serviceWorkerSource).toContain("const SHARE_REDIRECT_STATUS = 303;");
  });
});
