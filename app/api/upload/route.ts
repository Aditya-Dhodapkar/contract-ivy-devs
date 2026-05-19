// Image upload for property photos. Reused later for floor plans and (Step 3)
// sensitive documents — same endpoint, same auth, same storage adapter.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { put, isAllowedImage } from "@/lib/storage";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  // Reject oversize early via Content-Length, before formData() parses the body.
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (>${MAX_BYTES / 1024 / 1024} MB).` },
      { status: 413 }
    );
  }
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (>${MAX_BYTES / 1024 / 1024} MB).` },
      { status: 413 }
    );
  }
  if (!isAllowedImage(file.type)) {
    return NextResponse.json(
      { error: "Only image files (jpg, png, webp, gif, heic) are allowed." },
      { status: 415 }
    );
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const { url, key } = await put(buf, file.type);
  return NextResponse.json({ url, key });
}
