import { type CountryCode, parsePhoneNumberFromString } from "libphonenumber-js";

export type ContactChannelValueResolution = { ok: true; value: string } | { ok: false; error: string };

const WA_ME_URL_PATTERN = /^https?:\/\/(www\.)?(wa\.me|whatsapp\.com)\//;

/**
 * A collector typing a phone number types it the way they'd dial it locally, never in E.164 with
 * a country code they'd have to look up. `parsePhoneNumberFromString`'s `defaultCountry` fills
 * that gap from the store's own country without forcing the user to type it, while a number that
 * already carries its own "+CC" prefix is still honoured verbatim (an explicit prefix always wins
 * over the default region, per the library's own contract).
 *
 * Shared between `StoreContactChannelEditor` (client-side, on add/edit) and the create/edit
 * server actions (on submit, so an entry nobody re-touched this session still normalizes instead
 * of failing the whole save against the server's stricter historical validation).
 */
export function resolvePhoneValue(value: string, countryCode: string | null): ContactChannelValueResolution {
  const phone = parsePhoneNumberFromString(value, (countryCode as CountryCode) || undefined);
  if (!phone || !phone.isValid()) return { ok: false, error: "PHONE" };
  return { ok: true, value: phone.number };
}

/**
 * WhatsApp's stored value must be a `wa.me` URL (the server only accepts that host), but nobody
 * pastes one on purpose: they type the number the contact is reachable at. An existing wa.me/
 * whatsapp.com link is kept as-is; anything else is parsed as a phone number (same country
 * inference as `resolvePhoneValue`) and turned into the canonical link the server expects.
 */
export function resolveWhatsAppValue(value: string, countryCode: string | null): ContactChannelValueResolution {
  if (WA_ME_URL_PATTERN.test(value)) return { ok: true, value };
  const phone = parsePhoneNumberFromString(value, (countryCode as CountryCode) || undefined);
  if (!phone || !phone.isValid()) return { ok: false, error: "WHATSAPP" };
  return { ok: true, value: `https://wa.me/${phone.number.replace("+", "")}` };
}

/**
 * Best-effort normalization pass over a raw contact-channel list, meant to run just before schema
 * validation in the create/edit server actions. A PHONE/WHATSAPP entry that parses successfully is
 * rewritten to its normalized form; anything that fails to parse (or isn't PHONE/WHATSAPP) is
 * passed through unchanged, so the schema's own validation still produces its existing error for a
 * genuinely invalid value instead of this pass silently swallowing it.
 */
export function normalizeContactChannelsForCountry<T extends { type: string; value: string }>(
  channels: T[],
  countryCode: string | null,
): T[] {
  return channels.map((channel) => {
    if (channel.type !== "PHONE" && channel.type !== "WHATSAPP") return channel;
    const resolved =
      channel.type === "PHONE"
        ? resolvePhoneValue(channel.value, countryCode)
        : resolveWhatsAppValue(channel.value, countryCode);
    return resolved.ok ? { ...channel, value: resolved.value } : channel;
  });
}
