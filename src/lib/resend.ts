const RESEND_API_BASE = "https://api.resend.com";

function getResendApiKey(): string {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey?.trim()) {
    throw new Error("RESEND_API_KEY is not set. Configure it in your environment.");
  }

  return apiKey.trim();
}

function getDefaultFromEmail(): string {
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!fromEmail?.trim()) {
    throw new Error("RESEND_FROM_EMAIL is not set. Configure it in your environment.");
  }

  return fromEmail.trim();
}

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
};

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
