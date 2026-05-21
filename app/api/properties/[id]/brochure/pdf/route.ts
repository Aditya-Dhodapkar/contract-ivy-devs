// Step 2 of the brochure flow: take the human-approved slots + the property
// record, render the PDF, stream it back as a downloadable file.

import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/roles";
import { getProperty } from "@/lib/repo/properties";
import { BrochureDoc } from "@/lib/brochure/template";
import type { BrochureSlots } from "@/lib/brochure/types";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!can(user.role, "generateBrochure")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const p = await getProperty(id);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const slots: BrochureSlots = body.slots;
  if (!slots || typeof slots !== "object") {
    return NextResponse.json({ error: "Missing slots" }, { status: 400 });
  }

  // The logo lives in /public so it's reachable as a same-origin URL.
  // (Saved at /public/sansi-logo.jpg by the team during setup.)
  const logoSrc = `${new URL(req.url).origin}/sansi-logo.jpg`;

  // The renderToStream signature expects a Document element; BrochureDoc
  // returns one, but its prop type is independent of DocumentProps, so we
  // cast through unknown to keep TS happy without weakening runtime safety.
  const element = React.createElement(BrochureDoc, { p, slots, logoSrc });
  const stream = await renderToStream(element as unknown as Parameters<typeof renderToStream>[0]);

  // Stream → Web ReadableStream so Next can send it down as a file.
  const webStream = new ReadableStream({
    async start(controller) {
      stream.on("data", (chunk: Buffer) => controller.enqueue(chunk));
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
  });

  const filename = `${(p.referenceNumber || "brochure").replace(/[^A-Za-z0-9_-]+/g, "-")}.pdf`;
  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
