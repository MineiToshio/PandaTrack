import * as Sentry from "@sentry/nextjs";
import { ROUTES } from "@/lib/constants";

/**
 * Client half of the "share to PandaTrack" hand-off.
 *
 * Android posts the original, uncompressed file to the share-target URL, so nothing has been
 * compressed yet and a multi-megabyte screenshot would breach the request ceiling on its own. The
 * service worker therefore answers that POST itself: it writes the shared files into Cache Storage
 * (the "stash") and redirects to the intake screen, which reads them here and runs the exact same
 * compress-and-upload path an in-app pick would run. One pipeline, one set of guards.
 *
 * Cache Storage rather than memory or `sessionStorage` because the POST is answered by the worker
 * and read by a different document after a redirect, and because it has to hold binary blobs, not
 * strings.
 *
 * Every constant below is mirrored as a literal in `public/sw.js`, which is plain JavaScript served
 * as a static asset and therefore cannot import this module. `shareStash.test.ts` reads that file
 * and fails if the two sides ever drift.
 */

/**
 * Manifest `share_target` action. Answered by the service worker when one is active, and by the
 * route handler of the same path when none is. It lives under `/api` because a root-level static
 * segment collides with the locale segment that owns every other path.
 */
export const SHARE_TARGET_ACTION_PATH = "/api/orders/image-intake/share";

/** Multipart field the OS attaches the shared images under. */
export const SHARE_TARGET_FILES_FIELD = "images";

/** Intake screen the share hand-off lands on, locale prefix added by the caller. */
export const SHARE_INTAKE_PATH = `${ROUTES.ordersNew}/image`;

/** Query param naming the door the user came through. */
export const SHARE_SOURCE_PARAM = "source";

/** `source` value written by the Android share target. */
export const SHARE_SOURCE_SHARE = "share";

/** `source` value written by the documented iOS Shortcut, which cannot carry the bytes. */
export const SHARE_SOURCE_IOS_SHORTCUT = "ios-shortcut";

/** Query param used to report that the hand-off itself failed before the stash was written. */
export const SHARE_STASH_PARAM = "stash";

/** `stash` value meaning: the share arrived but could not be stashed. */
export const SHARE_STASH_FAILED = "failed";

/** Cache Storage bucket holding the stashed files and their index. */
export const SHARE_STASH_CACHE_NAME = "panda-share-stash";

/** Synthetic request key for the stash index. Absolute so any page resolves it identically. */
export const SHARE_STASH_INDEX_URL = "/__panda-share-stash/index.json";

/** Synthetic request key prefix for each stashed file, suffixed with its position. */
export const SHARE_STASH_FILE_URL_PREFIX = "/__panda-share-stash/file-";

/** Index format marker, so a future shape change can be detected instead of misread. */
export const SHARE_STASH_INDEX_VERSION = 1;

/**
 * How long a stash stays usable.
 *
 * The stash is written by the service worker and read by the screen the very next navigation, so a
 * healthy hand-off completes in seconds. The window used to be long enough to cover a detour through
 * the sign-in flow, but a stash that survives an authentication is exactly the one that can no
 * longer be attributed to whoever shared it (see {@link readAndClearShareStash}), so it is refused
 * on arrival anyway. What is left to cover is a slow device, not a detour, and a short window means
 * a share the user abandons stops sitting in Cache Storage for a quarter of an hour.
 */
export const SHARE_STASH_TTL_MS = 5 * 60 * 1000;

/**
 * Above this age at pickup, the stash did not reach the screen on the immediate redirect: something
 * held the navigation up long enough to be worth measuring. There is no synchronous signal for that
 * detour, so the elapsed time is the only evidence available on the client. A heuristic, used for
 * analytics only.
 *
 * A detour through the sign-in flow no longer reaches a successful pickup at all (the session would
 * be younger than the stash), so what this now flags is a slow hand-off inside one session.
 */
export const SHARE_RESUMED_AFTER_AUTH_MIN_AGE_MS = 20 * 1000;

type ShareStashEntry = {
  key: string;
  name: string;
  type: string;
};

type ShareStashIndex = {
  version: number;
  createdAt: number;
  files: ShareStashEntry[];
};

export type ShareStashPickup = {
  files: File[];
  /** Epoch milliseconds the service worker wrote the stash at. */
  createdAt: number;
};

export type ShareStashPickupResult =
  | { outcome: "picked"; pickup: ShareStashPickup }
  /** Nothing usable was waiting: no stash, expired, unreadable, or its files were gone. */
  | { outcome: "empty" }
  /** Something was waiting, but it cannot be attributed to whoever is signed in now. */
  | { outcome: "identity-changed" };

export type ShareStashPickupContext = {
  /**
   * Epoch milliseconds the currently signed-in session started, or `null` when it cannot be read.
   * Compared against the stash's own timestamp to decide whether the share and the session belong
   * to the same visit.
   */
  sessionStartedAt: number | null;
};

function isShareStashIndex(value: unknown): value is ShareStashIndex {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ShareStashIndex>;
  if (candidate.version !== SHARE_STASH_INDEX_VERSION) return false;
  if (typeof candidate.createdAt !== "number" || !Number.isFinite(candidate.createdAt)) return false;
  if (!Array.isArray(candidate.files)) return false;
  return candidate.files.every(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      typeof entry.key === "string" &&
      typeof entry.name === "string" &&
      typeof entry.type === "string",
  );
}

/**
 * Deletes the whole stash bucket. Safe to call when nothing was ever stashed.
 *
 * Kept separate from the read so the caller can also drop the stash on paths that never reach a
 * successful pickup.
 */
export async function clearShareStash(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    await caches.delete(SHARE_STASH_CACHE_NAME);
  } catch {
    // A cache that cannot be deleted is not worth surfacing: the TTL check on the next read
    // discards its content anyway, and there is nothing the user could do about it here.
  }
}

/**
 * Drops the stash when it is past its TTL, without consuming a stash that is still usable.
 *
 * The pickup already discards expired content, but it only runs when the screen is reached through
 * the share door. A share the user abandons (they close the tab at the sign-in gate, or the redirect
 * never lands) leaves its bytes in Cache Storage with nothing scheduled to come back for them, so
 * the intake screen sweeps on every mount instead of only on the paths that read the stash.
 *
 * Never throws: a browser that cannot answer here is one where the stash was unreachable anyway.
 */
export async function sweepExpiredShareStash(): Promise<void> {
  if (typeof caches === "undefined") return;

  try {
    const cache = await caches.open(SHARE_STASH_CACHE_NAME);
    const indexResponse = await cache.match(SHARE_STASH_INDEX_URL);
    if (!indexResponse) return;

    const index: unknown = await indexResponse.json();
    // An index nobody can read is not worth keeping either: no future pickup could ever use it.
    if (!isShareStashIndex(index) || Date.now() - index.createdAt > SHARE_STASH_TTL_MS) {
      await clearShareStash();
    }
  } catch {
    // The read failed, so whether the stash is expired is unknowable from here. Dropping it is the
    // safe answer: an unreadable stash cannot be picked up either.
    await clearShareStash();
  }
}

/**
 * Reads the files the service worker stashed for this share and clears the stash.
 *
 * The stash is always cleared, on every outcome: a successful pickup, a refused one, a malformed
 * index, a read error, or an expired entry. Shared screenshots are the user's private
 * conversations, so they are never left behind for the next navigation to find.
 *
 * ## Why the session's age decides who may pick a stash up
 *
 * The service worker writes the stash while answering the share POST, and a worker cannot read the
 * session cookie, so nothing in Cache Storage says who shared. On a shared device that gap is a real
 * leak: someone shares a private chat, their session turns out to be expired, the app sends them to
 * sign in, and the next person to sign in on that device lands on the intake screen and picks up
 * screenshots that were never theirs, spending their own extraction quota on them.
 *
 * What is knowable is when the current session started. A stash written *before* the session began
 * cannot have been shared under it, so it is refused. In the ordinary flow the session is hours or
 * days older than the share and the pickup proceeds untouched; it is only the case where someone
 * authenticated after the bytes arrived that is turned away, which is exactly the ambiguous case.
 *
 * Two consequences worth stating plainly:
 *
 * - Resuming a share across the sign-in flow no longer works, including when the same person signs
 *   back in after their own session expired. The two situations are indistinguishable from here, and
 *   the screen already has the remedy for it: it asks for the photos to be attached again.
 * - The stash timestamp comes from the device clock and the session timestamp from the server, so a
 *   badly skewed device clock can turn a legitimate pickup away. That only reaches shares made in
 *   the first moments of a session; the outcome is the same "attach them again" prompt, never a lost
 *   order.
 *
 * A `null` session start is refused for the same reason: an unknown owner is not this owner.
 */
export async function readAndClearShareStash(context: ShareStashPickupContext): Promise<ShareStashPickupResult> {
  if (typeof caches === "undefined") return { outcome: "empty" };

  try {
    const cache = await caches.open(SHARE_STASH_CACHE_NAME);
    const indexResponse = await cache.match(SHARE_STASH_INDEX_URL);
    if (!indexResponse) return { outcome: "empty" };

    const index: unknown = await indexResponse.json();
    if (!isShareStashIndex(index)) return { outcome: "empty" };

    if (Date.now() - index.createdAt > SHARE_STASH_TTL_MS) return { outcome: "empty" };

    if (context.sessionStartedAt === null || context.sessionStartedAt > index.createdAt) {
      return { outcome: "identity-changed" };
    }

    const files: File[] = [];
    for (const entry of index.files) {
      const fileResponse = await cache.match(entry.key);
      if (!fileResponse) continue;
      const blob = await fileResponse.blob();
      files.push(new File([blob], entry.name, { type: entry.type || blob.type }));
    }

    if (files.length === 0) return { outcome: "empty" };
    return { outcome: "picked", pickup: { files, createdAt: index.createdAt } };
  } catch (error) {
    // Losing a share the user already committed to is a real failure, not a user mistake: the
    // screenshot is gone and the screen can only ask them to attach it again. Captured once, with
    // no payload attached, so image bytes and file names never leave the device.
    Sentry.captureException(error, { extra: { action: "readAndClearShareStash" } });
    return { outcome: "empty" };
  } finally {
    await clearShareStash();
  }
}
