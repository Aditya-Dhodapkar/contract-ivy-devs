// Feedback → GitHub Issues bridge. Keeps the dev's issue tracker entirely
// outside the client's system: nothing lands in her DB; the back-office
// just relays the report to a private repo we own.
//
// Required env:
//   GITHUB_FEEDBACK_TOKEN   fine-grained PAT; scopes:
//                             - Issues: read/write
//                             - Contents: read/write  (to commit screenshots)
//   GITHUB_FEEDBACK_REPO    "owner/repo" — where issues + images land
//
// Image strategy: screenshots are committed to an ORPHAN branch named
// `feedback-attachments` (configurable via FEEDBACK_BRANCH) — never main.
// This keeps the main commit log clean and means devs never see the
// "you have N commits to pull" surprise when feedback comes in. The
// orphan branch is bootstrapped lazily on first feedback with images.
//
// The resulting raw.githubusercontent.com URL embeds the branch name and
// renders inline in the issue. Because the repo is private, only people
// with repo access can view the images — which is exactly the right
// audience (us).

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

type ImageIn = { name: string; type: string; base64: string };
type Body = {
  category?: "bug" | "feature" | "other";
  title?: string;
  body?: string;
  images?: ImageIn[];
};

const CATEGORY_LABEL: Record<NonNullable<Body["category"]>, string> = {
  bug: "Bug",
  feature: "Feature",
  other: "Feedback",
};

const GH_API = "https://api.github.com";
const FEEDBACK_BRANCH = process.env.FEEDBACK_BRANCH || "feedback-attachments";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "image";
}

function extFromName(name: string, fallbackType = ""): string {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  if (m) return m[1].toLowerCase();
  if (fallbackType.startsWith("image/")) return fallbackType.slice(6);
  return "png";
}

async function ghFetch(path: string, init: RequestInit, token: string) {
  return fetch(`${GH_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

/** Lazily create the orphan attachments branch. Idempotent: returns early
 *  if it already exists. The branch is created with a single README commit
 *  and NO parents — fully disconnected from main, so noise here can never
 *  reach the working branch. */
async function ensureFeedbackBranch(repo: string, branch: string, token: string): Promise<void> {
  const check = await ghFetch(`/repos/${repo}/branches/${encodeURIComponent(branch)}`, {}, token);
  if (check.ok) return;
  if (check.status !== 404) {
    throw new Error(`Branch existence check failed (HTTP ${check.status}).`);
  }

  // 1. README blob
  const readme =
    `# Feedback attachments\n\n` +
    `This orphan branch stores screenshots attached to feedback submitted ` +
    `via the back-office. The files are automatically committed by ` +
    `\`/api/feedback\` and referenced from the corresponding GitHub issue ` +
    `on this repo. Do not check out or modify this branch by hand.\n`;
  const blobRes = await ghFetch(
    `/repos/${repo}/git/blobs`,
    { method: "POST", body: JSON.stringify({ content: readme, encoding: "utf-8" }) },
    token
  );
  if (!blobRes.ok) throw new Error(`Bootstrap blob failed (HTTP ${blobRes.status}).`);
  const { sha: blobSha } = (await blobRes.json()) as { sha: string };

  // 2. Tree containing just that README
  const treeRes = await ghFetch(
    `/repos/${repo}/git/trees`,
    {
      method: "POST",
      body: JSON.stringify({
        tree: [{ path: "README.md", mode: "100644", type: "blob", sha: blobSha }],
      }),
    },
    token
  );
  if (!treeRes.ok) throw new Error(`Bootstrap tree failed (HTTP ${treeRes.status}).`);
  const { sha: treeSha } = (await treeRes.json()) as { sha: string };

  // 3. Orphan commit (parents: [] = disconnected from main)
  const commitRes = await ghFetch(
    `/repos/${repo}/git/commits`,
    {
      method: "POST",
      body: JSON.stringify({
        message: "init feedback-attachments orphan branch",
        tree: treeSha,
        parents: [],
      }),
    },
    token
  );
  if (!commitRes.ok) throw new Error(`Bootstrap commit failed (HTTP ${commitRes.status}).`);
  const { sha: commitSha } = (await commitRes.json()) as { sha: string };

  // 4. Point the ref at it
  const refRes = await ghFetch(
    `/repos/${repo}/git/refs`,
    {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commitSha }),
    },
    token
  );
  if (!refRes.ok) throw new Error(`Bootstrap ref failed (HTTP ${refRes.status}).`);
}

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const token = process.env.GITHUB_FEEDBACK_TOKEN;
  const repo = process.env.GITHUB_FEEDBACK_REPO;
  if (!token || !repo) {
    return NextResponse.json(
      {
        error:
          "Feedback isn't configured yet. Ask the developer to set GITHUB_FEEDBACK_TOKEN and GITHUB_FEEDBACK_REPO.",
      },
      { status: 503 }
    );
  }

  let payload: Body;
  try {
    payload = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const category = payload.category ?? "other";
  const title = (payload.title || "").trim();
  const body = (payload.body || "").trim();
  const images = Array.isArray(payload.images) ? payload.images : [];
  if (!title || !body) {
    return NextResponse.json({ error: "Title and details are required." }, { status: 400 });
  }
  if (images.length > 6) {
    return NextResponse.json({ error: "At most 6 screenshots, please." }, { status: 400 });
  }

  // 1. Commit each image to the orphan attachments branch. Failures here
  // are logged but do not block the issue — the report is more important
  // than the screenshots. The branch is bootstrapped lazily on first use;
  // skip the check entirely when there are no images to upload.
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const titleSlug = slugify(title);
  const imageMarkdown: string[] = [];
  const uploadErrors: string[] = [];

  if (images.length > 0) {
    try {
      await ensureFeedbackBranch(repo, FEEDBACK_BRANCH, token);
    } catch (e) {
      uploadErrors.push(`branch bootstrap: ${(e as Error).message}`);
      // If we can't ensure the branch, fall back to skipping image upload
      // entirely rather than half-committing somewhere unexpected.
      images.length = 0;
    }
  }

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    if (!img?.base64) continue;
    const ext = extFromName(img.name || "", img.type || "");
    const path = `feedback-images/${ts}-${i + 1}-${titleSlug}.${ext}`;
    try {
      const res = await ghFetch(
        `/repos/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}`,
        {
          method: "PUT",
          body: JSON.stringify({
            message: `feedback: attach ${path.split("/").pop()}`,
            content: img.base64,
            branch: FEEDBACK_BRANCH,
          }),
        },
        token
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        uploadErrors.push(`image ${i + 1}: HTTP ${res.status} ${text.slice(0, 200)}`);
        continue;
      }
      const j = (await res.json()) as { content?: { html_url?: string; download_url?: string } };
      const rawUrl = j.content?.download_url || j.content?.html_url || "";
      if (rawUrl) imageMarkdown.push(`![screenshot ${i + 1}](${rawUrl})`);
    } catch (e) {
      uploadErrors.push(`image ${i + 1}: ${(e as Error).message}`);
    }
  }

  // 2. Compose the issue body. Submitter context + the user's prose + any
  // image markdown + a footer with upload errors if any.
  const submitter = `${user.name} (${user.email}) · role: ${user.role}`;
  const ua = req.headers.get("user-agent") || "—";
  const referer = req.headers.get("referer") || "—";
  const sections: string[] = [
    `**From:** ${submitter}`,
    `**When:** ${new Date().toISOString()}`,
    `**Page:** ${referer}`,
    `**User agent:** ${ua}`,
    "",
    "---",
    "",
    body,
  ];
  if (imageMarkdown.length) {
    sections.push("", "---", "", "### Screenshots", "", ...imageMarkdown);
  }
  if (uploadErrors.length) {
    sections.push(
      "",
      "---",
      "",
      "_Note: some screenshots failed to upload:_",
      ...uploadErrors.map((m) => `- ${m}`)
    );
  }
  const issueBody = sections.join("\n");
  const labels = [
    `feedback`,
    `feedback:${category}`,
    `submitter:${user.role}`,
  ];

  // 3. Create the issue.
  const issueRes = await ghFetch(
    `/repos/${repo}/issues`,
    {
      method: "POST",
      body: JSON.stringify({
        title: `[${CATEGORY_LABEL[category]}] ${title}`,
        body: issueBody,
        labels,
      }),
    },
    token
  );
  if (!issueRes.ok) {
    const text = await issueRes.text().catch(() => "");
    return NextResponse.json(
      { error: `Could not file the issue (HTTP ${issueRes.status}). ${text.slice(0, 300)}` },
      { status: 502 }
    );
  }
  const issue = (await issueRes.json()) as { number: number; html_url: string };
  return NextResponse.json({ ok: true, number: issue.number, url: issue.html_url });
}
