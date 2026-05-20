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
      <header className="border-b border-hairline/25 bg-paper">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="group block leading-none">
              <span className="block font-serif text-xl text-ink transition-colors group-hover:text-gold-deep">
                Sansi
              </span>
              <span className="mt-1 block text-[10px] tracking-[0.22em] text-ash">
                BACK OFFICE
              </span>
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
          {/* Both items render as direct flex children of this container so
              their text baselines align. `contents` removes the <form> from
              layout so the <button> participates directly. */}
          <div className="flex items-center gap-6">
            <Link
              href="/profile"
              className="text-eyebrow uppercase text-ink-mute transition-colors hover:text-gold-deep"
            >
              Profile
            </Link>
            <form action="/api/auth/logout" method="post" className="contents">
              <button className="text-eyebrow uppercase text-ink-mute transition-colors hover:text-gold-deep">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <div className="h-px bg-gold/30" aria-hidden />
      </header>
      {user?.mustChangePassword && (
        <div className="border-b border-gold/40 bg-gold/10">
          <div className="mx-auto max-w-5xl px-6 py-2.5 text-sm text-gold-deep">
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
