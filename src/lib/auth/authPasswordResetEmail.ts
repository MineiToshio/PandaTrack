import { APP_NAME } from "@/lib/constants";
import { getPublicSiteUrl } from "@/lib/app-url";
import { buildTransactionalEmailTemplate } from "@/lib/integrations/resend";
import { Locale } from "@/types/locale";

type PasswordResetEmailMessages = {
  subject: string;
  text: string;
  eyebrow: string;
  title: string;
  intro: string;
  body: string;
  cta: string;
  fallback: string;
  footer: string;
};

function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

async function getPasswordResetEmailMessages(locale: Locale): Promise<PasswordResetEmailMessages> {
  const authMessages =
    locale === "en"
      ? (await import("@/i18n/locales/en/auth.json")).default
      : (await import("@/i18n/locales/es/auth.json")).default;

  return authMessages.passwordResetEmail as PasswordResetEmailMessages;
}

export async function buildAuthPasswordResetEmail(
  locale: Locale,
  resetUrl: string,
): Promise<{ subject: string; text: string; html: string }> {
  const messages = await getPasswordResetEmailMessages(locale);
  const interpolationValues = {
    appName: APP_NAME,
    resetUrl,
  };
  const subject = interpolate(messages.subject, interpolationValues);
  const text = interpolate(messages.text, interpolationValues);
  const eyebrow = interpolate(messages.eyebrow, interpolationValues);
  const title = interpolate(messages.title, interpolationValues);
  const intro = interpolate(messages.intro, interpolationValues);
  const body = interpolate(messages.body, interpolationValues);
  const cta = interpolate(messages.cta, interpolationValues);
  const fallback = interpolate(messages.fallback, interpolationValues);
  const footer = interpolate(messages.footer, interpolationValues);
  const logoUrl = `${getPublicSiteUrl()}/icon.svg`;

  return {
    subject,
    text,
    html: buildTransactionalEmailTemplate({
      appName: APP_NAME,
      logoUrl,
      eyebrow,
      title,
      intro,
      body,
      ctaLabel: cta,
      ctaUrl: resetUrl,
      fallbackLabel: fallback,
      fallbackUrl: resetUrl,
      footer,
    }),
  };
}
