// Complete a password reset: verify the token and set the new password.
// Public route (see middleware). The token is single-use — setting the new
// password changes the hash, which invalidates the token's signing key.

import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeResetToken } from "@/lib/passwordReset";
import { setUserPassword } from "@/lib/repo/users";

const Body = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const user = await consumeResetToken(parsed.data.token);
  if (!user) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Request a new one." },
      { status: 400 }
    );
  }

  await setUserPassword(user.id, parsed.data.password);
  return NextResponse.json({ ok: true });
}
