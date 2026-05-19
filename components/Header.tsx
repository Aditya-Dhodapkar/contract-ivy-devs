// Shared back-office header. Always offers a way home + sign out, plus an
// optional contextual back link. Used on every inner page so nothing is a
// dead end (#17 navigation).

import Link from "next/link";

export function Header({ back }: { back?: { href: string; label: string } }) {
  return (
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
        <form action="/api/auth/logout" method="post">
          <button className="text-eyebrow uppercase text-ink-mute transition-colors hover:text-gold-deep">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
