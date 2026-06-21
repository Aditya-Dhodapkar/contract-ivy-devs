// Feedback log — a user's own submission history. Lets the submitter replay
// voice notes / screenshots and tick items off as the developer finishes them.

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Header } from "@/components/Header";
import { listFeedbackForUser, type FeedbackCategory } from "@/lib/repo/feedback";
import { FeedbackDoneToggle } from "@/components/FeedbackDoneToggle";
import { relativeTime } from "@/lib/relative";

const CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  bug: "Bug",
  feature: "Idea",
  other: "Other",
};

export default async function FeedbackLogPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  const items = await listFeedbackForUser(user.id);

  return (
    <div className="min-h-screen bg-ivory">
      <Header back={{ href: "/dashboard", label: "Dashboard" }} />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-eyebrow uppercase text-ash">Your feedback</p>
        <h1 className="mt-2 font-serif text-4xl text-ink">Feedback log</h1>
        <p className="mt-1 text-sm text-ink-mute">
          Everything you&rsquo;ve sent the developer. Tick items off as they&rsquo;re done.
        </p>

        {items.length === 0 ? (
          <p className="mt-10 border border-hairline/15 bg-paper p-6 text-sm text-ink-mute">
            You haven&rsquo;t sent any feedback yet. Use the &ldquo;Feedback&rdquo;
            button in the header to send your first.
          </p>
        ) : (
          <ul className="mt-8 space-y-4">
            {items.map((f) => (
              <li
                key={f.id}
                className={`border bg-paper p-5 ${
                  f.done ? "border-hairline/15 opacity-70" : "border-hairline/25"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-eyebrow uppercase text-gold-deep">
                      {CATEGORY_LABEL[f.category]}
                    </p>
                    <h2
                      className={`mt-1 font-serif text-xl text-ink ${
                        f.done ? "line-through" : ""
                      }`}
                    >
                      {f.title}
                    </h2>
                    <p className="mt-0.5 text-xs text-ash">{relativeTime(f.createdAt)}</p>
                  </div>
                  <FeedbackDoneToggle id={f.id} initialDone={f.done} />
                </div>

                {f.body && (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-ink-soft">{f.body}</p>
                )}

                {f.audioUrl && (
                  <div className="mt-3">
                    <p className="text-eyebrow uppercase text-ash">Voice note</p>
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <audio controls src={f.audioUrl} className="mt-1 w-full" />
                  </div>
                )}

                {f.imageUrls.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {f.imageUrls.map((u, i) => (
                      <a key={i} href={u} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={u}
                          alt={`screenshot ${i + 1}`}
                          className="h-20 w-20 border border-hairline/20 object-cover"
                        />
                      </a>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
