// Stateless, single-use password-reset tokens — no extra DB table needed.
//
// The token is a short-lived JWT signed with a key derived from AUTH_SECRET +
// the user's CURRENT password hash. Two consequences fall out for free:
//   • Single-use: the moment the password changes, the hash changes, so the
//     signing key changes and any previously-issued token stops verifying.
//   • Tamper-proof: an attacker can't forge one without AUTH_SECRET and the
//     user's stored hash.
// A 1-hour expiry caps the window.

import { SignJWT, jwtVerify, decodeJwt } from "jose";
import { getUser, type UserRecord } from "./repo/users";

const TTL = "1h";

function resetKey(passwordHash: string): Uint8Array {
  const base = process.env.AUTH_SECRET;
  if (!base) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(`${base}:pwreset:${passwordHash}`);
}

export async function createResetToken(user: {
  id: string;
  passwordHash: string;
}): Promise<string> {
  return new SignJWT({ purpose: "pwreset" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(resetKey(user.passwordHash));
}

/** Verify a reset token and return the user it belongs to, or null if the
 *  token is invalid, expired, or already used (password since changed). */
export async function consumeResetToken(token: string): Promise<UserRecord | null> {
  let sub: string | undefined;
  try {
    sub = decodeJwt(token).sub; // read subject WITHOUT verifying the signature
  } catch {
    return null;
  }
  if (!sub) return null;

  const user = await getUser(sub);
  if (!user) return null;

  try {
    const { payload } = await jwtVerify(token, resetKey(user.passwordHash));
    if (payload.purpose !== "pwreset") return null;
    return user;
  } catch {
    return null;
  }
}
