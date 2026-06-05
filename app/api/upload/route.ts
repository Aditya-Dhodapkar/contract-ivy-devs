// Image upload for property photos. Reused later for floor plans and (Step 3)
// sensitive documents — same endpoint, same auth, same storage adapter.

import { NextResponse } from "next/server";
import sharp from "sharp";
import convert from "heic-convert";
import { getSession } from "@/lib/auth";
import { put, isAllowedImage } from "@/lib/storage";
import { PHOTO_MAX_BYTES } from "@/lib/imageMime";

const MAX_MB = PHOTO_MAX_BYTES / 1024 / 1024;

// sharp's metadata().format → the MIME we persist under. We derive the stored
// MIME from the *decoded* format (not the browser's declared type) so the file
// extension is always honest. HEIC is handled separately (transcoded to JPEG),
// so "heif" is intentionally absent here.
const FORMAT_MIME: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

// HEIF/HEIC ftyp brands. We sniff the file's magic bytes so an iPhone photo is
// detected even when the browser supplied no MIME and the filename has no
// extension. (AVIF uses the "avif"/"avis" brands and is handled by sharp, so
// it's intentionally excluded here.)
const HEIF_BRANDS = new Set([
  "heic",
  "heix",
  "heim",
  "heis",
  "hevc",
  "hevx",
  "mif1",
  "msf1",
]);

function isHeifBuffer(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (buf.toString("latin1", 4, 8) !== "ftyp") return false;
  return HEIF_BRANDS.has(buf.toString("latin1", 8, 12));
}

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  // Reject oversize early via Content-Length, before formData() parses the body.
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > PHOTO_MAX_BYTES) {
    return NextResponse.json(
      { error: `That file is larger than ${MAX_MB} MB.` },
      { status: 413 }
    );
  }
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No file was received. Please choose a photo and try again." },
      { status: 400 }
    );
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return NextResponse.json(
      { error: `That file is larger than ${MAX_MB} MB.` },
      { status: 413 }
    );
  }

  // HEIC (the iPhone default) often arrives with an empty or octet-stream MIME
  // because the browser doesn't recognise it. Accept it by extension in that
  // one case so a real phone photo isn't bounced; an explicit non-image MIME is
  // still rejected. The decode step below is the real content gate.
  const looksImageByExt = /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name);
  const typeMissing = !file.type || file.type === "application/octet-stream";
  if (!isAllowedImage(file.type) && !(typeMissing && looksImageByExt)) {
    return NextResponse.json(
      { error: "Only image files (JPG, PNG, WebP, GIF or HEIC) can be uploaded." },
      { status: 415 }
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());

  const declaredHeic =
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    /\.(heic|heif)$/i.test(file.name);
  const isHeic = declaredHeic || isHeifBuffer(buf);

  // Read pixel dimensions before persisting so the form can render an
  // orientation badge + the brochure can guard against landscape covers.
  let outBuf: Buffer = buf;
  let outMime = file.type;
  let width: number | undefined;
  let height: number | undefined;

  if (isHeic) {
    // Browsers (and the brochure's Chromium renderer) can't display HEIC, and
    // sharp's prebuilt libvips here has no HEVC decoder. heic-convert is a
    // pure-JS libheif decoder — transcode once at upload to a web-displayable
    // JPEG. heic-convert applies the HEIF rotation transform, so the output is
    // already upright and its dimensions are correct (no EXIF rotate needed).
    try {
      const jpegAB = await convert({ buffer: buf, format: "JPEG", quality: 0.85 });
      outBuf = Buffer.from(jpegAB);
      outMime = "image/jpeg";
      const meta = await sharp(outBuf).metadata();
      width = meta.width;
      height = meta.height;
    } catch {
      // Couldn't decode the HEIC. Don't store a file the browser can't show
      // (and that, having no dimensions, could bypass the landscape-cover
      // guard) — reject with a plain, actionable message.
      return NextResponse.json(
        {
          error:
            "We couldn’t process this photo. Please try a different photo, or save it as a JPEG and upload again.",
        },
        { status: 422 }
      );
    }
  } else {
    // sharp.rotate() applies EXIF orientation so a "portrait phone photo" is
    // reported portrait, not as the raw landscape sensor frame.
    try {
      const meta = await sharp(buf).rotate().metadata();
      // Persist under the decoded format's MIME so the stored extension is
      // honest even when the browser's declared type was empty/wrong.
      outMime = FORMAT_MIME[meta.format ?? ""] ?? file.type;
      width = meta.width;
      height = meta.height;
    } catch {
      // Non-fatal — image still uploads, just without dimension metadata.
    }
  }

  const { url, key } = await put(outBuf, outMime);
  return NextResponse.json({ url, key, width, height });
}
