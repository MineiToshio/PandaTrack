"use server";

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { getSession } from "@/lib/auth/auth-server";
import { prisma } from "@/lib/prisma";
import { validateUsernameCandidate, normalizeUsernameForUniqueness } from "@/lib/user-settings/usernameRules";
import { validateDisplayNameCandidate } from "@/lib/user-settings/displayNameRules";
import { assertUsernameChangeCooldownAllows, recordSuccessfulUsernameChange } from "@/lib/auth/usernameChangeCooldown";
import { processAvatarFile, AvatarProcessingError } from "@/lib/user/avatarProcessing";
import { uploadUserAvatarBuffer, deleteUserAvatarObject } from "@/lib/user/avatarStorage";

export type ProfileErrorCode =
  | "unauthorized"
  | "validation"
  | "usernameTaken"
  | "rateLimited"
  | "avatarInvalidType"
  | "avatarTooLarge"
  | "avatarMalformed"
  | "avatarProcessingFailed"
  | "generic";

type UsernameActionResult =
  | { ok: true; username: string }
  | { ok: false; error: ProfileErrorCode; retryAfterIso?: string };

type DisplayNameActionResult = { ok: true; name: string } | { ok: false; error: ProfileErrorCode };

type AvatarUploadResult = { ok: true; imageUrl: string } | { ok: false; error: ProfileErrorCode };

type AvatarRemoveResult = { ok: true } | { ok: false; error: ProfileErrorCode };

type UsernameAvailabilityResult = { available: boolean };

const avatarCropAreaSchema = z.object({
  x: z.number().finite().min(0),
  y: z.number().finite().min(0),
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
});

/**
 * Checks whether a username candidate is available for the current user.
 * Returns available=true if the normalized candidate is free or already owned by the caller.
 */
export async function checkUsernameAvailabilityAction(candidate: string): Promise<UsernameAvailabilityResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { available: false };
  }

  const formatResult = validateUsernameCandidate(candidate);
  if (!formatResult.ok) {
    return { available: false };
  }

  const normalized = formatResult.username;
  const existing = await prisma.user.findUnique({
    where: { username: normalized },
    select: { id: true },
  });

  const available = !existing || existing.id === session.user.id;
  return { available };
}

/**
 * Saves a new username for the authenticated user (FR-07-08, FR-07-33, BR-07-09).
 * Enforces format validation, rate limiting, and case-insensitive uniqueness on the server.
 */
export async function saveUsernameAction(candidate: string): Promise<UsernameActionResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, error: "unauthorized" };
  }

  const formatResult = validateUsernameCandidate(candidate);
  if (!formatResult.ok) {
    return { ok: false, error: "validation" };
  }

  const normalized = formatResult.username;
  const now = new Date();

  const cooldownResult = await assertUsernameChangeCooldownAllows(session.user.id, now);
  if (!cooldownResult.ok) {
    return { ok: false, error: "rateLimited", retryAfterIso: cooldownResult.retryAfterIso };
  }

  const existing = await prisma.user.findUnique({
    where: { username: normalized },
    select: { id: true },
  });

  if (existing && existing.id !== session.user.id) {
    return { ok: false, error: "usernameTaken" };
  }

  if (existing?.id === session.user.id) {
    return { ok: true, username: normalized };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { username: normalized },
  });

  await recordSuccessfulUsernameChange(session.user.id, now);

  return { ok: true, username: normalized };
}

/**
 * Saves a new display name for the authenticated user (FR-07-09, BR-07-12).
 * Applies trim, max-length, reserved-name, brand, and blocked-token validation.
 */
export async function saveDisplayNameAction(displayName: string): Promise<DisplayNameActionResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, error: "unauthorized" };
  }

  const validationResult = validateDisplayNameCandidate(displayName);
  if (!validationResult.ok) {
    return { ok: false, error: "validation" };
  }

  const trimmedName = validationResult.name;

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: trimmedName },
  });

  return { ok: true, name: trimmedName };
}

/**
 * Processes and uploads a profile image to R2, then updates User.image (FR-07-10, FR-07-11).
 * Accepts the file and crop area from FormData.
 */
export async function saveAvatarAction(formData: FormData): Promise<AvatarUploadResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, error: "unauthorized" };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "avatarMalformed" };
  }

  const rawCropArea = avatarCropAreaSchema.safeParse({
    x: Number(formData.get("cropX")),
    y: Number(formData.get("cropY")),
    width: Number(formData.get("cropWidth")),
    height: Number(formData.get("cropHeight")),
  });

  if (!rawCropArea.success) {
    return { ok: false, error: "avatarMalformed" };
  }

  let processedBuffer: Buffer;
  try {
    processedBuffer = await processAvatarFile(file, rawCropArea.data);
  } catch (error) {
    if (error instanceof AvatarProcessingError) {
      const code = error.code as ProfileErrorCode;
      return { ok: false, error: code };
    }
    Sentry.captureException(error, { extra: { action: "saveAvatarAction", userId: session.user.id } });
    return { ok: false, error: "avatarProcessingFailed" };
  }

  let imageUrl: string;
  try {
    imageUrl = await uploadUserAvatarBuffer(session.user.id, processedBuffer);
  } catch (error) {
    Sentry.captureException(error, { extra: { action: "saveAvatarAction", userId: session.user.id } });
    return { ok: false, error: "generic" };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { image: imageUrl },
  });

  return { ok: true, imageUrl };
}

/**
 * Removes the authenticated user's profile image (FR-07-12).
 * Clears User.image regardless of provider; attempts R2 cleanup and reports failures to Sentry
 * without reverting the user-facing removal (per observability contract in WO-03).
 */
export async function removeAvatarAction(): Promise<AvatarRemoveResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, error: "unauthorized" };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { image: null },
  });

  try {
    await deleteUserAvatarObject(session.user.id);
  } catch (error) {
    Sentry.captureException(error, {
      extra: {
        action: "removeAvatarAction",
        userId: session.user.id,
        note: "R2 cleanup failed after User.image cleared",
      },
    });
  }

  return { ok: true };
}

/**
 * Returns the current profile data for the settings page.
 */
export async function getProfileSnapshotAction(): Promise<{
  username: string;
  name: string;
  image: string | null;
} | null> {
  const session = await getSession();
  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { username: true, name: true, image: true },
  });

  if (!user) {
    return null;
  }

  const normalizedUsername = normalizeUsernameForUniqueness(user.username);
  return { username: normalizedUsername, name: user.name, image: user.image };
}
