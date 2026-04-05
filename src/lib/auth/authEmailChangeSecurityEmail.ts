import { APP_NAME, SUPPORT_CONTACT_EMAIL } from "@/lib/constants";
import { getPublicSiteUrl } from "@/lib/app-url";
import { buildTransactionalEmailTemplate, buildTransactionalMailtoLink, escapeHtml } from "@/lib/integrations/resend";
import type { Locale } from "@/types/locale";

type EmailChangeSecurityMessages = {
  subject: string;
  text: string;
  eyebrow: string;
  title: string;
  intro: string;
  bodyLead: string;
  bodyAfterNew: string;
  bodyClosing: string;
  footer: string;
};

function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

async function getEmailChangeSecurityMessages(locale: Locale): Promise<EmailChangeSecurityMessages> {
  const authMessages =
    locale === "en"
      ? (await import("@/i18n/locales/en/auth.json")).default
      : (await import("@/i18n/locales/es/auth.json")).default;

  return authMessages.emailChangeSecurityEmail as EmailChangeSecurityMessages;
}

export async function buildAuthEmailChangeSecurityEmail(
  locale: Locale,
  newEmail: string,
): Promise<{ subject: string; text: string; html: string }> {
  const messages = await getEmailChangeSecurityMessages(locale);
  const interpolationValues = {
    appName: APP_NAME,
    newEmail,
    supportEmail: SUPPORT_CONTACT_EMAIL,
  };
  const subject = interpolate(messages.subject, interpolationValues);
  const text = interpolate(messages.text, interpolationValues);
  const eyebrow = interpolate(messages.eyebrow, interpolationValues);
  const title = interpolate(messages.title, interpolationValues);
  const intro = interpolate(messages.intro, interpolationValues);
  const footer = interpolate(messages.footer, interpolationValues);
  const logoUrl = `${getPublicSiteUrl()}/icon.svg`;

  const bodyHtml = [
    escapeHtml(interpolate(messages.bodyLead, interpolationValues)),
    " ",
    buildTransactionalMailtoLink(newEmail),
    escapeHtml(interpolate(messages.bodyAfterNew, interpolationValues)),
    " ",
    buildTransactionalMailtoLink(SUPPORT_CONTACT_EMAIL),
    escapeHtml(interpolate(messages.bodyClosing, interpolationValues)),
  ].join("");

  return {
    subject,
    text,
    html: buildTransactionalEmailTemplate({
      appName: APP_NAME,
      logoUrl,
      eyebrow,
      title,
      intro,
      bodyHtml,
      footer,
    }),
  };
}
