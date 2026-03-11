import { buildAuthAlternativeHref, resolveAuthCallbackURL } from "@/lib/auth/authRedirect";

type ResolveAuthEntryContextParams = {
  locale: string;
  returnTo?: string;
  alternativePath: string;
};

type AuthEntryContext = {
  callbackURL: string;
  alternativeHref: string;
};

export function resolveAuthEntryContext({
  locale,
  returnTo,
  alternativePath,
}: ResolveAuthEntryContextParams): AuthEntryContext {
  const callbackURL = resolveAuthCallbackURL(locale, returnTo);
  const alternativeHref = buildAuthAlternativeHref(alternativePath, locale, returnTo);

  return {
    callbackURL,
    alternativeHref,
  };
}
