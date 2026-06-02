// AI gallery layout designer. Claude analyses gallery photos (via vision)
// + property context and picks a template id + photo order. The editor
// applies the AI's choices and the user can ship as-is or tweak.

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/roles";
import { getProperty } from "@/lib/repo/properties";
import {
  AI_LAYOUT_SYSTEM_PROMPT,
  buildAiLayoutUserPrompt,
  AI_LAYOUT_TOOL,
} from "@/lib/brochure/prompts/ai-layout";
import { templatesForCount, getTemplate } from "@/lib/brochure/templates";
import { templateFits } from "@/lib/brochure/gallery-layout";

type Params = { params: Promise<{ id: string }> };

let cached: Anthropic | null = null;
function client(): Anthropic {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set.");
  cached = new Anthropic({ apiKey });
  return cached;
}

async function loadImageAsBase64(
  url: string
): Promise<{ data: string; media_type: "image/jpeg" | "image/png" | "image/webp" | "image/gif" } | null> {
  if (!url.startsWith("/")) return null;
  const p = path.join(process.cwd(), "public", url.replace(/^\//, ""));
  try {
    const buf = await fs.readFile(p);
    const ext = (p.split(".").pop() || "jpg").toLowerCase();
    const media_type =
      ext === "png" ? "image/png" :
      ext === "webp" ? "image/webp" :
      ext === "gif" ? "image/gif" :
      "image/jpeg";
    return { data: buf.toString("base64"), media_type };
  } catch {
    return null;
  }
}

export async function POST(_req: Request, { params }: Params) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!can(user.role, "generateBrochure")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const p = await getProperty(id);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allPhotos = p.photos ?? [];
  const galleryUrls = allPhotos.slice(1, 8); // photos[1..7] — cover is photos[0]
  if (galleryUrls.length === 0) {
    return NextResponse.json({ error: "No gallery photos to design with." }, { status: 400 });
  }
  const galleryEntries = galleryUrls.map((url, i) => {
    const d = p.photoDimensions?.[i + 1];
    return {
      url,
      w: d?.w ?? 0,
      h: d?.h ?? 0,
      caption: p.photoCaptions?.[i + 1]?.trim() || undefined,
    };
  });

  // Determine fitting templates for these photos so Claude only picks from
  // ones we'd actually render.
  const inputs = galleryEntries.map((g) => ({
    url: g.url,
    aspect: g.w && g.h ? g.w / g.h : 1.0,
  }));
  const candidates = templatesForCount(galleryUrls.length);
  const fitting = candidates.filter((t) => templateFits(t, inputs));
  if (fitting.length === 0) {
    return NextResponse.json(
      { error: "No template fits these photos. Try a different photo count." },
      { status: 400 }
    );
  }

  // Load images as base64 for vision.
  const imageBlocks = await Promise.all(
    galleryEntries.map(async (g, i) => {
      const img = await loadImageAsBase64(g.url);
      if (!img) return null;
      return [
        { type: "text" as const, text: `Photo ${i + 1} (url: ${g.url}):` },
        {
          type: "image" as const,
          source: { type: "base64" as const, media_type: img.media_type, data: img.data },
        },
      ];
    })
  );
  const flatImageBlocks = imageBlocks.filter((b): b is NonNullable<typeof b> => !!b).flat();
  if (flatImageBlocks.length === 0) {
    return NextResponse.json(
      { error: "Could not load any gallery photos for AI analysis." },
      { status: 500 }
    );
  }

  try {
    const res = await client().messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 512,
      temperature: 0.4,
      system: AI_LAYOUT_SYSTEM_PROMPT,
      tools: [AI_LAYOUT_TOOL],
      tool_choice: { type: "tool", name: AI_LAYOUT_TOOL.name },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: buildAiLayoutUserPrompt(p, galleryEntries, fitting) },
            ...flatImageBlocks,
          ],
        },
      ],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use" || block.name !== AI_LAYOUT_TOOL.name) {
      throw new Error("Claude didn't return a layout in the expected format.");
    }
    const raw = block.input as { templateId?: string; photoOrder?: string[] };

    // Validate Claude's choices. Fall back gracefully on bad data.
    let templateId = raw.templateId;
    if (!templateId || !fitting.some((t) => t.id === templateId)) {
      templateId = fitting[0].id;
    }
    let photoOrder = Array.isArray(raw.photoOrder) ? raw.photoOrder : [];
    // Keep only urls from the gallery, dedupe.
    const allowed = new Set(galleryUrls);
    const seen = new Set<string>();
    photoOrder = photoOrder.filter((u) => {
      if (!allowed.has(u) || seen.has(u)) return false;
      seen.add(u);
      return true;
    });
    // Pad with any missing urls in their original order so we always have N.
    for (const u of galleryUrls) {
      if (!seen.has(u)) photoOrder.push(u);
    }
    // Verify chosen template needs the same count we now have.
    const template = getTemplate(templateId);
    if (!template || template.count !== photoOrder.length) {
      // Fall back to first fitting template; trim/pad as needed.
      templateId = fitting[0].id;
      photoOrder = photoOrder.slice(0, fitting[0].count);
    }

    return NextResponse.json({ templateId, photoOrder });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ error: err.message || "AI layout failed." }, { status: 500 });
  }
}
