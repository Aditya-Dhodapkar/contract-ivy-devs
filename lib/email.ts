// Minimal transactional email via Resend (https://resend.com). Uses the REST
// API directly (no SDK dependency). Configure:
//   RESEND_API_KEY  — required to actually send
//   RESEND_FROM     — verified sender, e.g. "Sansi Africa <noreply@sansi.africa>"
//                     Falls back to Resend's shared onboarding sender, which in
//                     test mode can only deliver to your Resend account email.

interface SendArgs {
  to: string;
  subject: string;
  html: string;
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail({ to, subject, html }: SendArgs): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const from = process.env.RESEND_FROM || "Sansi Africa <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Email send failed (${res.status}): ${detail}`);
  }
}
