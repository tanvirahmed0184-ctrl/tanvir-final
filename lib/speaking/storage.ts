import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type StoredAudio = {
  publicUrl: string;
  storagePath: string | null;
};

function mimeToExt(mimeType: string): string {
  const value = mimeType.toLowerCase();
  if (value.includes("wav")) return "wav";
  if (value.includes("mpeg") || value.includes("mp3")) return "mp3";
  if (value.includes("ogg")) return "ogg";
  if (value.includes("aac")) return "aac";
  if (value.includes("flac")) return "flac";
  if (value.includes("mp4")) return "m4a";
  if (value.includes("webm")) return "webm";
  return "webm";
}

function speakingBucket(): string {
  return process.env.SUPABASE_MEDIA_BUCKET || "exam-media";
}

export async function storeSpeakingAudio(params: {
  attemptId: string;
  turnId: string;
  bytes: Buffer;
  mimeType: string;
}): Promise<StoredAudio> {
  const { attemptId, turnId, bytes, mimeType } = params;
  const bucket = speakingBucket();
  const ext = mimeToExt(mimeType);
  const cloudPath = `speaking/${attemptId}/${turnId}-${Date.now()}.${ext}`;

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.storage.from(bucket).upload(cloudPath, bytes, {
      cacheControl: "3600",
      upsert: false,
      contentType: mimeType,
    });

    if (!error) {
      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(cloudPath);

      if (publicUrl) {
        return { publicUrl, storagePath: cloudPath };
      }
    }
  } catch {
    // Fall back to local storage.
  }

  const localName = `${turnId}-${Date.now()}.${ext}`;
  const localDir = join(
    process.cwd(),
    "public",
    "uploads",
    "speaking",
    attemptId,
  );
  await mkdir(localDir, { recursive: true });
  await writeFile(join(localDir, localName), bytes);

  return {
    publicUrl: `/uploads/speaking/${attemptId}/${localName}`,
    storagePath: `local:uploads/speaking/${attemptId}/${localName}`,
  };
}

export async function deleteSpeakingAudio(storagePath: string | null | undefined) {
  if (!storagePath) return;

  if (storagePath.startsWith("local:")) {
    const relative = storagePath.slice("local:".length);
    const publicRoot = resolve(process.cwd(), "public");
    const target = resolve(publicRoot, relative);
    if (!target.startsWith(publicRoot)) {
      throw new Error("Refusing to delete path outside public directory");
    }
    await rm(target, { force: true });
    return;
  }

  try {
    const supabase = await createSupabaseServerClient();
    await supabase.storage.from(speakingBucket()).remove([storagePath]);
  } catch {
    // Ignore remote delete failures for cleanup best-effort.
  }
}
