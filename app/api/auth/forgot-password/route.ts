// Request a password reset. Self-service reset is OWNER-ONLY: if the email
// belongs to an active owner, we email a reset link; anyone else is told to
// contact the owner (who can reset team members from the Team page).
//
// Public route (see middleware). Rate-limited per IP to prevent abuse.

import { NextResponse } from "next/server";
import { z } from "zod";
import { findUserByEmail } from "@/lib/repo/users";
import { createResetToken } from "@/lib/passwordReset";
import { sendEmail, emailConfigured } from "@/lib/email";
import { checkRateLimit, recordFailure } from "@/lib/rateLimit";

const Body = z.object({ email: z.string().email() });

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

function resetEmailHtml(link: string): string {
  return `
  <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;color:#14130f">
    <p style="letter-spacing:.22em;text-transform:uppercase;font-size:12px;color:#8b8478">Sansi Africa</p>
    <h1 style="font-weight:400;font-size:26px;margin:8px 0 16px">Reset your password</h1>
    <p style="font-size:15px;line-height:1.6;color:#4f4a3f">
      We received a request to reset your back-office password. Click below to
      choose a new one. This link expires in 1 hour and can only be used once.
    </p>
    <p style="margin:28px 0">
      <a href="${link}" style="background:#14130f;color:#fff;text-decoration:none;padding:12px 22px;letter-spacing:.15em;text-transform:uppercase;font-size:12px">Reset password</a>
    </p>
    <p style="font-size:13px;line-height:1.6;color:#8b8478">
      If you didn't request this, you can safely ignore this email — your
      password won't change.
    </p>
  </div>`;
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limit = checkRateLimit(`forgot:${ip}`);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter ?? 900) } }
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  const user = await findUserByEmail(parsed.data.email);
  const isOwnerSelfServe = user?.role === "owner" && user.active;

  // Count every request against the limiter so the endpoint can't be hammered.
  recordFailure(`forgot:${ip}`);

  if (!isOwnerSelfServe) {
    // Non-owner (or unknown) — no email sent. The UI tells them to contact the
    // owner. We intentionally return a normal 200 so timing doesn't leak much.
    return NextResponse.json({ ownerFlow: false });
  }

  if (!emailConfigured()) {
    return NextResponse.json(
      { error: "Email isn't configured yet. Contact your developer." },
      { status: 503 }
    );
  }

  const token = await createResetToken({ id: user!.id, passwordHash: user!.passwordHash });
  const base =
    process.env.APP_URL ||
    req.headers.get("origin") ||
    (req.headers.get("host") ? `https://${req.headers.get("host")}` : "");
  const link = `${base}/reset-password?token=${encodeURIComponent(token)}`;

  try {
    await sendEmail({
      to: user!.email,
      subject: "Reset your Sansi Africa password",
      html: resetEmailHtml(link),
    });
  } catch {
    return NextResponse.json(
      { error: "Could not send the reset email. Try again shortly." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ownerFlow: true });
}
