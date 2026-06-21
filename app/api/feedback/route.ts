// Feedback bridge. Two destinations:
//   1. Supabase: a `feedback` row (the submitter's own log) + attachments in
//      the public feedback-attachments bucket, so she can replay her voice
//      notes / screenshots from the log.
//   2. GitHub Issues (optional, if configured): our dev tracker, referencing
//      the same Supabase attachment URLs.
//
// Required env for the GitHub mirror (optional — feedback still logs without it):
//   GITHUB_FEEDBACK_TOKEN   fine-grained PAT: Issues read/write
//   GITHUB_FEEDBACK_REPO    "owner/repo"

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { putFeedbackAttachment } from "@/lib/storage";
import { createFeedback, type FeedbackCategory } from "@/lib/repo/feedback";

type FileIn = { name: string; type: string; base64: string };
type Body = {
  category?: FeedbackCategory;
  title?: string;
  body?: string;
  images?: FileIn[];
  audio?: FileIn;
};

const CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  bug: "Bug",
  feature: "Feature",
  other: "Feedback",
};

const GH_API = "https://api.github.com";

async function uploadAttachment(f: FileIn): Promise<string | null> {
  try {
    const buf = Buffer.from(f.base64, "base64");
    const { url } = await putFeedbackAttachment(buf, f.type || "application/octet-stream");
    return url;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  let payload: Body;
  try {
    payload = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const category = payload.category ?? "other";
  const title = (payload.title || "").trim();
  const body = (payload.body || "").trim();
  const images = Array.isArray(payload.images) ? payload.images.slice(0, 6) : [];
  const audioIn = payload.audio?.base64 ? payload.audio : null;

  if (!title) {
    return NextResponse.json({ error: "A short title is required." }, { status: 400 });
  }
  if (!body && !audioIn) {
    return NextResponse.json(
      { error: "Add details or record a voice note." },
      { status: 400 }
    );
  }

  // 1. Upload attachments to Supabase Storage (public URLs the submitter can
  // open from her log, and which also render in the GitHub issue).
  const imageUrls: string[] = [];
  for (const img of images) {
    const url = await uploadAttachment(img);
    if (url) imageUrls.push(url);
  }
  const audioUrl = audioIn ? await uploadAttachment(audioIn) : null;

  // 2. Optionally mirror to GitHub Issues (our tracker).
  let githubIssueNumber: number | undefined;
  let githubIssueUrl: string | undefined;
  const token = process.env.GITHUB_FEEDBACK_TOKEN;
  const repo = process.env.GITHUB_FEEDBACK_REPO;
  if (token && repo) {
    const submitter = `${user.name} (${user.email}) · role: ${user.role}`;
    const sections: string[] = [
      `**From:** ${submitter}`,
      `**When:** ${new Date().toISOString()}`,
      `**Page:** ${req.headers.get("referer") || "—"}`,
      "",
      "---",
      "",
      body || "_(No typed details — see the voice note below.)_",
    ];
    if (audioUrl) {
      sections.push("", "---", "", "### Voice note", "", `🎙️ [Voice note — click to play](${audioUrl})`);
    }
    if (imageUrls.length) {
      sections.push("", "---", "", "### Screenshots", "", ...imageUrls.map((u, i) => `![screenshot ${i + 1}](${u})`));
    }
    try {
      const res = await fetch(`${GH_API}/repos/${repo}/issues`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: `[${CATEGORY_LABEL[category]}] ${title}`,
          body: sections.join("\n"),
          labels: ["feedback", `feedback:${category}`, `submitter:${user.role}`],
        }),
      });
      if (res.ok) {
        const issue = (await res.json()) as { number: number; html_url: string };
        githubIssueNumber = issue.number;
        githubIssueUrl = issue.html_url;
      }
    } catch {
      // GitHub mirror is best-effort; the feedback log is the source of truth.
    }
  }

  // 3. Record it in the feedback log (the submitter's own history).
  try {
    const fb = await createFeedback({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      category,
      title,
      body,
      imageUrls,
      audioUrl: audioUrl ?? undefined,
      githubIssueNumber,
      githubIssueUrl,
    });
    return NextResponse.json({ ok: true, id: fb.id, number: githubIssueNumber });
  } catch (e) {
    return NextResponse.json(
      { error: `Could not save feedback: ${(e as Error).message}` },
      { status: 502 }
    );
  }
}
