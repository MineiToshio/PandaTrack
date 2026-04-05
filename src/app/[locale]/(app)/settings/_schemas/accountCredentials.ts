import { z } from "zod";
import { isLocale } from "@/types/locale";

const localeField = z.string().refine((v): v is "en" | "es" => isLocale(v));

const passwordField = z.string().min(8).max(128);

export const emailChangeFormSchema = z.object({
  locale: localeField,
  newEmail: z.string().trim().email(),
  currentPassword: z.string().min(1),
});

export const changePasswordFormSchema = z.object({
  locale: localeField,
  currentPassword: z.string().min(1),
  newPassword: passwordField,
});

export const setPasswordFormSchema = z.object({
  locale: localeField,
  newPassword: passwordField,
});

export type EmailChangeFormInput = z.infer<typeof emailChangeFormSchema>;
export type ChangePasswordFormInput = z.infer<typeof changePasswordFormSchema>;
export type SetPasswordFormInput = z.infer<typeof setPasswordFormSchema>;

export type SettingsAccountErrorCode =
  | "unauthorized"
  | "notAllowed"
  | "rateLimited"
  | "sameEmail"
  | "emailTaken"
  | "invalidPassword"
  | "passwordTooShort"
  | "passwordTooLong"
  | "passwordAlreadySet"
  | "validation"
  | "generic";

export type EmailChangeActionResult =
  | { ok: true }
  | { ok: false; error: SettingsAccountErrorCode; retryAfterIso?: string };

export type PasswordActionResult = { ok: true } | { ok: false; error: SettingsAccountErrorCode };
