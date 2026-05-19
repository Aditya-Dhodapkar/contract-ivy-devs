// Lightweight session: a signed JWT in an httpOnly cookie. Chosen over a heavier
// auth framework so the client's team can read and hand this off easily.
//
// Deliverables: #1 Login, #2 Logout, #5 Stay logged in.

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Role } from "./roles";

const COOKIE = "sansi_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days — "stay logged in"

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      id: payload.id as string,
      name: payload.name as string,
      email: payload.email as string,
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** Verify a raw token (used by middleware, which can't use next/headers). */
export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      id: payload.id as string,
      name: payload.name as string,
      email: payload.email as string,
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = COOKIE;
