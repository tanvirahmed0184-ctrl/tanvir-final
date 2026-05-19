import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

type MediaType = "IMAGE" | "AUDIO";

function parseMediaType(value: unknown): MediaType | null {
  return value === "IMAGE" || value === "AUDIO" ? value : null;
}

function parseOrder(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(100, Math.round(n)));
}

function safeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function inferFileExt(fileName: string, contentType: string): string {
  const fromName = fileName.split(".").pop()?.trim().toLowerCase();
  if (fromName) return fromName;

  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("mp3")) return "mp3";
  if (contentType.includes("mpeg")) return "mp3";
  if (contentType.includes("wav")) return "wav";

  return "bin";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { error: "passage id is required" },
        { status: 400 },
      );
    }

    const passage = await prisma.passage.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!passage) {
      return NextResponse.json({ error: "Passage not found" }, { status: 404 });
    }

    const form = await request.formData();
    const type = parseMediaType(form.get("type"));
    const label = safeText(form.get("label"));
    const order = parseOrder(form.get("order"));
    const inputUrl = safeText(form.get("url"));
    const fileValue = form.get("file");

    if (!type) {
      return NextResponse.json(
        { error: "type must be IMAGE or AUDIO" },
        { status: 400 },
      );
    }

    let url = inputUrl;
    let storagePath: string | null = null;

    if (!url && fileValue instanceof File && fileValue.size > 0) {
      const bucket = process.env.SUPABASE_MEDIA_BUCKET || "exam-media";
      const ext = inferFileExt(fileValue.name, fileValue.type);
      const bytes = Buffer.from(await fileValue.arrayBuffer());
      const path = `passages/${id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

      let uploaded = false;
      try {
        const supabase = await createSupabaseServerClient();
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(path, bytes, {
            cacheControl: "3600",
            upsert: false,
            contentType: fileValue.type || undefined,
          });

        if (!uploadError) {
          const {
            data: { publicUrl },
          } = supabase.storage.from(bucket).getPublicUrl(path);
          url = publicUrl;
          storagePath = path;
          uploaded = true;
        }
      } catch {
        // Fallback below if cloud upload path fails.
      }

      if (!uploaded) {
        const fileName = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
        const localDir = join(process.cwd(), "public", "uploads", "passages", id);
        await mkdir(localDir, { recursive: true });
        const fullPath = join(localDir, fileName);
        await writeFile(fullPath, bytes);
        url = `/uploads/passages/${id}/${fileName}`;
        storagePath = `local:uploads/passages/${id}/${fileName}`;
      }
    }

    if (!url) {
      return NextResponse.json(
        { error: "Provide either media url or file upload" },
        { status: 400 },
      );
    }

    const media = await prisma.passageMedia.create({
      data: {
        passageId: id,
        type,
        url,
        storagePath,
        label: label || null,
        order,
      },
    });

    return NextResponse.json({ media }, { status: 201 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to add passage media", detail },
      { status: 500 },
    );
  }
}
