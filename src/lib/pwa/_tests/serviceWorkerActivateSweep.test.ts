import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SHARE_STASH_CACHE_NAME,
  SHARE_STASH_FILE_URL_PREFIX,
  SHARE_STASH_INDEX_URL,
  SHARE_STASH_INDEX_VERSION,
  SHARE_STASH_TTL_MS,
} from "../shareStash";

const serviceWorkerSource = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");

type FakeCache = { match: ReturnType<typeof vi.fn> };
type FakeCaches = { open: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
type ActivateEvent = { waitUntil: (promise: Promise<unknown>) => void };
type ActivateListener = (event: ActivateEvent) => void;

/**
 * Runs `public/sw.js` in a sandboxed VM context and returns the listener it registered for
 * `activate`.
 *
 * The worker is a static asset written for the browser, not an importable module: it reads bare
 * globals (`self`, `caches`) rather than taking them as arguments. A VM context is the only way
 * to exercise its real `sweepExpiredShareStashOnActivate` logic (not just the mirrored constants,
 * which `shareStash.test.ts` already covers) without a browser or a real service worker.
 */
function loadActivateListener(cachesStub: FakeCaches): ActivateListener {
  const listeners: Record<string, ActivateListener> = {};
  const selfStub = {
    addEventListener: (type: string, handler: ActivateListener) => {
      listeners[type] = handler;
    },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn().mockResolvedValue(undefined) },
  };

  const context = vm.createContext({ self: selfStub, caches: cachesStub });
  vm.runInContext(serviceWorkerSource, context);

  const activateListener = listeners.activate;
  if (!activateListener) throw new Error("public/sw.js did not register an activate listener");
  return activateListener;
}

function installFakeCaches(entries: Record<string, unknown>) {
  const deleted: string[] = [];
  const cache: FakeCache = {
    match: vi.fn(async (key: string) => {
      if (!(key in entries)) return undefined;
      return { json: async () => entries[key] };
    }),
  };
  const cachesStub: FakeCaches = {
    open: vi.fn(async () => cache),
    delete: vi.fn(async (name: string) => {
      deleted.push(name);
      return true;
    }),
  };
  return { cache, cachesStub, deleted };
}

function buildIndex(createdAt: number) {
  return {
    version: SHARE_STASH_INDEX_VERSION,
    createdAt,
    files: [{ key: `${SHARE_STASH_FILE_URL_PREFIX}0`, name: "chat.png", type: "image/png" }],
  };
}

/** Fires the sandboxed `activate` listener and awaits whatever it passed to `waitUntil`. */
async function runActivate(cachesStub: FakeCaches) {
  const activate = loadActivateListener(cachesStub);
  let waitUntilPromise: Promise<unknown> = Promise.resolve();
  activate({
    waitUntil: (promise) => {
      waitUntilPromise = promise;
    },
  });
  await waitUntilPromise;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("service worker activate sweep", () => {
  it("drops a stash older than the TTL", async () => {
    const createdAt = Date.now() - SHARE_STASH_TTL_MS - 1;
    const { cachesStub, deleted } = installFakeCaches({ [SHARE_STASH_INDEX_URL]: buildIndex(createdAt) });

    await runActivate(cachesStub);

    expect(deleted).toEqual([SHARE_STASH_CACHE_NAME]);
  });

  it("keeps a stash that is still inside the TTL", async () => {
    const createdAt = Date.now() - 1_000;
    const { cachesStub, deleted } = installFakeCaches({ [SHARE_STASH_INDEX_URL]: buildIndex(createdAt) });

    await runActivate(cachesStub);

    expect(deleted).toEqual([]);
  });

  it("does nothing when nothing was ever stashed", async () => {
    const { cachesStub, deleted } = installFakeCaches({});

    await runActivate(cachesStub);

    expect(deleted).toEqual([]);
  });

  it("drops an index it cannot recognise", async () => {
    const { cachesStub, deleted } = installFakeCaches({
      [SHARE_STASH_INDEX_URL]: { version: 99, createdAt: Date.now(), files: [] },
    });

    await runActivate(cachesStub);

    expect(deleted).toEqual([SHARE_STASH_CACHE_NAME]);
  });

  it("never throws when Cache Storage itself fails, and still drops the bucket", async () => {
    const deleted: string[] = [];
    const cachesStub: FakeCaches = {
      open: vi.fn(async () => ({
        match: vi.fn(async () => {
          throw new Error("cache unavailable");
        }),
      })),
      delete: vi.fn(async (name: string) => {
        deleted.push(name);
        return true;
      }),
    };

    await expect(runActivate(cachesStub)).resolves.toBeUndefined();
    expect(deleted).toEqual([SHARE_STASH_CACHE_NAME]);
  });

  it("still claims clients alongside the sweep", async () => {
    const { cachesStub } = installFakeCaches({});
    const listeners: Record<string, ActivateListener> = {};
    const claimMock = vi.fn().mockResolvedValue(undefined);
    const selfStub = {
      addEventListener: (type: string, handler: ActivateListener) => {
        listeners[type] = handler;
      },
      skipWaiting: vi.fn(),
      clients: { claim: claimMock },
    };
    const context = vm.createContext({ self: selfStub, caches: cachesStub });
    vm.runInContext(serviceWorkerSource, context);

    let waitUntilPromise: Promise<unknown> = Promise.resolve();
    listeners.activate?.({
      waitUntil: (promise) => {
        waitUntilPromise = promise;
      },
    });
    await waitUntilPromise;

    expect(claimMock).toHaveBeenCalledTimes(1);
  });
});
