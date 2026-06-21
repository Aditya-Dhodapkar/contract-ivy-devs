// Feedback log repository. Every feedback submission is recorded so the
// submitter can see their history and tick items off as we finish them.
// Two backends (same pattern as the rest of the repo layer):
//   - dev:  .devdata/feedback.json
//   - prod: Supabase `feedback` table
//
// Attachments (screenshots + voice notes) live in Supabase Storage (see
// lib/storage putFeedbackAttachment) and are referenced here by URL, so the
// submitter can replay her own voice notes from the log.

import { promises as fs } from "fs";
import path from "path";
import { usingDevData } from "@/lib/devUsers";
import { supabase } from "@/lib/supabase";

export type FeedbackCategory = "bug" | "feature" | "other";

export interface FeedbackRecord {
  id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  category: FeedbackCategory;
  title: string;
  body?: string;
  imageUrls: string[];
  audioUrl?: string;
  githubIssueNumber?: number;
  githubIssueUrl?: string;
  done: boolean;
  createdAt: string;
  doneAt?: string;
}

type Row = Record<string, unknown>;

function fromRow(r: Row): FeedbackRecord {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    userEmail: (r.user_email as string) ?? undefined,
    userName: (r.user_name as string) ?? undefined,
    category: (r.category as FeedbackCategory) ?? "other",
    title: r.title as string,
    body: (r.body as string) ?? undefined,
    imageUrls: (r.image_urls as string[]) ?? [],
    audioUrl: (r.audio_url as string) ?? undefined,
    githubIssueNumber: (r.github_issue_number as number) ?? undefined,
    githubIssueUrl: (r.github_issue_url as string) ?? undefined,
    done: !!r.done,
    createdAt: r.created_at as string,
    doneAt: (r.done_at as string) ?? undefined,
  };
}

function toRow(rec: FeedbackRecord): Row {
  return {
    id: rec.id,
    user_id: rec.userId,
    user_email: rec.userEmail,
    user_name: rec.userName,
    category: rec.category,
    title: rec.title,
    body: rec.body,
    image_urls: rec.imageUrls,
    audio_url: rec.audioUrl,
    github_issue_number: rec.githubIssueNumber,
    github_issue_url: rec.githubIssueUrl,
    done: rec.done,
    created_at: rec.createdAt,
    done_at: rec.doneAt,
  };
}

const DEV_FILE = path.join(process.cwd(), ".devdata", "feedback.json");

async function devReadAll(): Promise<FeedbackRecord[]> {
  try {
    return JSON.parse(await fs.readFile(DEV_FILE, "utf8"));
  } catch {
    return [];
  }
}
async function devWriteAll(rows: FeedbackRecord[]): Promise<void> {
  await fs.mkdir(path.dirname(DEV_FILE), { recursive: true });
  await fs.writeFile(DEV_FILE, JSON.stringify(rows, null, 2));
}

export interface CreateFeedbackInput {
  userId: string;
  userEmail?: string;
  userName?: string;
  category: FeedbackCategory;
  title: string;
  body?: string;
  imageUrls?: string[];
  audioUrl?: string;
  githubIssueNumber?: number;
  githubIssueUrl?: string;
}

export async function createFeedback(input: CreateFeedbackInput): Promise<FeedbackRecord> {
  const record: FeedbackRecord = {
    id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId: input.userId,
    userEmail: input.userEmail,
    userName: input.userName,
    category: input.category,
    title: input.title,
    body: input.body,
    imageUrls: input.imageUrls ?? [],
    audioUrl: input.audioUrl,
    githubIssueNumber: input.githubIssueNumber,
    githubIssueUrl: input.githubIssueUrl,
    done: false,
    createdAt: new Date().toISOString(),
  };

  if (usingDevData) {
    const all = await devReadAll();
    await devWriteAll([record, ...all]);
    return record;
  }

  const { data, error } = await supabase().from("feedback").insert(toRow(record)).select().single();
  if (error) throw new Error(error.message);
  return fromRow(data);
}

/** A user's own feedback, newest first. */
export async function listFeedbackForUser(userId: string): Promise<FeedbackRecord[]> {
  if (usingDevData) {
    const all = await devReadAll();
    return all
      .filter((f) => f.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const { data, error } = await supabase()
    .from("feedback")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(fromRow);
}

/** Toggle the done flag — scoped to the owner so a user can only change their
 *  own items. Returns null if no matching row for that user. */
export async function setFeedbackDone(
  id: string,
  userId: string,
  done: boolean
): Promise<FeedbackRecord | null> {
  const doneAt = done ? new Date().toISOString() : undefined;
  if (usingDevData) {
    const all = await devReadAll();
    const i = all.findIndex((f) => f.id === id && f.userId === userId);
    if (i === -1) return null;
    all[i] = { ...all[i], done, doneAt };
    await devWriteAll(all);
    return all[i];
  }
  const { data, error } = await supabase()
    .from("feedback")
    .update({ done, done_at: doneAt ?? null })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? fromRow(data) : null;
}
