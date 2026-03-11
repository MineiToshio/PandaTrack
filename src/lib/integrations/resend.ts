import { EMAIL_FROM_NAME } from "@/lib/constants";

const RESEND_API_BASE = "https://api.resend.com";

function getResendApiKey(): string {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey?.trim()) {
    throw new Error("RESEND_API_KEY is not set. Configure it in your environment.");
  }

  return apiKey.trim();
}

function getDefaultFromEmail(): string {
  const fromAddress = process.env.RESEND_FROM_EMAIL;

  if (!fromAddress?.trim()) {
    throw new Error("RESEND_FROM_EMAIL is not set. Configure it in your environment.");
  }

  return `${EMAIL_FROM_NAME} <${fromAddress.trim()}>`;
}

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
};

export type TransactionalEmailTemplateInput = {
  appName: string;
  logoUrl: string;
  eyebrow?: string;
  title: string;
  intro: string;
  body?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  fallbackLabel?: string;
  fallbackUrl?: string;
  footer: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildTransactionalEmailTemplate({
  appName,
  logoUrl,
  eyebrow,
  title,
  intro,
  body,
  ctaLabel,
  ctaUrl,
  fallbackLabel,
  fallbackUrl,
  footer,
}: TransactionalEmailTemplateInput): string {
  const safeAppName = escapeHtml(appName);
  const safeLogoUrl = escapeHtml(logoUrl);
  const safeEyebrow = eyebrow ? escapeHtml(eyebrow) : "";
  const safeTitle = escapeHtml(title);
  const safeIntro = escapeHtml(intro);
  const safeBody = body ? escapeHtml(body) : "";
  const safeFooter = escapeHtml(footer);
  const safeCtaLabel = ctaLabel ? escapeHtml(ctaLabel) : "";
  const safeCtaUrl = ctaUrl ? escapeHtml(ctaUrl) : "";
  const safeFallbackLabel = fallbackLabel ? escapeHtml(fallbackLabel) : "";
  const safeFallbackUrl = fallbackUrl ? escapeHtml(fallbackUrl) : "";

  const eyebrowBlock = eyebrow
    ? `<div style="display:inline-block;margin-bottom:14px;padding:6px 10px;border:1px solid rgba(139,92,246,0.4);border-radius:999px;background:rgba(139,92,246,0.18);color:#f2f6fb;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">${safeEyebrow}</div>`
    : "";

  const bodyBlock = body
    ? `<p style="margin:0 0 24px;color:#d6dee6;font-size:15px;line-height:1.75;">${safeBody}</p>`
    : "";

  const ctaBlock =
    ctaLabel && ctaUrl
      ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">
          <tr>
            <td style="border-radius:14px;background:#8b5cf6;">
              <a href="${safeCtaUrl}" style="display:inline-block;padding:14px 22px;border-radius:14px;color:#ffffff;font-size:15px;font-weight:700;letter-spacing:0.01em;text-decoration:none;">${safeCtaLabel}</a>
            </td>
          </tr>
        </table>`
      : "";

  const fallbackBlock =
    fallbackLabel && fallbackUrl
      ? `<div style="margin-top:8px;padding-top:18px;border-top:1px solid #1f2a3a;">
          <p style="margin:0 0 8px;color:#a8b3c0;font-size:12px;line-height:1.6;">${safeFallbackLabel}</p>
          <a href="${safeFallbackUrl}" style="color:#a78bfa;font-size:12px;line-height:1.6;word-break:break-all;text-decoration:none;">${safeFallbackUrl}</a>
        </div>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:#0b0f14;font-family:Arial,sans-serif;color:#e6edf3;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#0b0f14;">
      <tr>
        <td style="padding:32px 16px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:640px;margin:0 auto;">
            <tr>
              <td style="padding-bottom:18px;text-align:center;">
                <img src="${safeLogoUrl}" alt="${safeAppName} logo" width="56" height="56" style="display:block;margin:0 auto 12px;border-radius:16px;" />
                <div style="color:#f2f6fb;font-size:20px;font-weight:700;letter-spacing:0.02em;">${safeAppName}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:1px;background:linear-gradient(135deg, rgba(139,92,246,0.8), rgba(167,139,250,0.28));border-radius:28px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:linear-gradient(180deg,#111826 0%,#0f172a 100%);border-radius:27px;">
                  <tr>
                    <td style="padding:36px 32px 28px;">
                      ${eyebrowBlock}
                      <h1 style="margin:0 0 14px;color:#f2f6fb;font-size:32px;line-height:1.1;font-weight:800;">${safeTitle}</h1>
                      <p style="margin:0 0 18px;color:#d6dee6;font-size:16px;line-height:1.75;">${safeIntro}</p>
                      ${bodyBlock}
                      ${ctaBlock}
                      ${fallbackBlock}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 12px 0;text-align:center;">
                <p style="margin:0;color:#a8b3c0;font-size:12px;line-height:1.7;">${safeFooter}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendEmailWithResend({ to, subject, text, html, from }: SendEmailInput): Promise<void> {
  const apiKey = getResendApiKey();
  const resolvedFrom = from ?? getDefaultFromEmail();
  const recipients = Array.isArray(to) ? to : [to];

  const response = await fetch(`${RESEND_API_BASE}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: resolvedFrom,
      to: recipients,
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = typeof body?.message === "string" ? body.message : response.statusText;
    throw new Error(`Resend email send failed: ${message}`);
  }
}
