// Shared back-office header. Always offers a way home, to the profile, and
// to sign out, plus an optional contextual back link. Used on every inner
// page so nothing is a dead end (#17 navigation). Async because it reads the
// session to render the "must change password" banner after an admin reset.

import Link from "next/link";
import { getSession } from "@/lib/auth";

export async function Header({ back }: { back?: { href: string; label: string } }) {
  const user = await getSession();
  return (
    <>
      <header className="border-b border-hairline/15 bg-paper">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-5">
            <Link
              href="/dashboard"
              className="text-eyebrow uppercase text-ink-mute transition-colors hover:text-gold-deep"
            >
              Sansi · Home
            </Link>
            {back && (
              <Link
                href={back.href}
                className="text-eyebrow uppercase text-ash transition-colors hover:text-gold-deep"
              >
                ← {back.label}
              </Link>
            )}
          </div>
          <div className="flex items-center gap-5">
            <Link
              href="/profile"
              className="text-eyebrow uppercase text-ink-mute transition-colors hover:text-gold-deep"
            >
              Profile
            </Link>
            <form action="/api/auth/logout" method="post">
              <button className="text-eyebrow uppercase text-ink-mute transition-colors hover:text-gold-deep">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      {user?.mustChangePassword && (
        <div className="border-b border-gold/40 bg-gold/10">
          <div className="mx-auto max-w-4xl px-6 py-2.5 text-sm text-gold-deep">
            Your password was reset by the owner.{" "}
            <Link href="/profile" className="underline hover:text-ink">
              Set a new one →
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
