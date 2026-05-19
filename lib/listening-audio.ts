import prisma from "@/lib/prisma";
import { getGeminiClient } from "@/lib/gemini";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type PassageMediaInput = {
  id: string;
  type: "IMAGE" | "AUDIO";
  url: string;
  label?: string | null;
  order: number;
  storagePath?: string | null;
};

export type EnsureListeningPassageAudioParams = {
  passageId: string;
  passageContent: string | null;
  existingMedia: PassageMediaInput[];
  forceRegenerate?: boolean;
  label?: string;
};

export type EnsureListeningPassageAudioResult = {
  generated: boolean;
  media: PassageMediaInput;
  model: string | null;
  voice: string | null;
};

const DEFAULT_TTS_MODELS = [
  "gemini-2.5-flash-preview-tts",
  "gemini-2.5-pro-preview-tts",
  "gemini-2.5-flash-native-audio-preview-12-2025",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeText(value: string | null | undefined): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function modelCandidates(): string[] {
  const envModels = (process.env.GEMINI_TTS_MODEL || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return Array.from(new Set([...envModels, ...DEFAULT_TTS_MODELS]));
}

function extensionFromMimeType(mimeType: string): string {
  const value = mimeType.toLowerCase();
  if (value.includes("wav")) return "wav";
  if (value.includes("mpeg") || value.includes("mp3")) return "mp3";
  if (value.includes("ogg")) return "ogg";
  if (value.includes("aac")) return "aac";
  if (value.includes("flac")) return "flac";
  if (value.includes("aiff")) return "aiff";
  return "wav";
}

function extractInlineAudio(
  response: unknown,
): { data: string; mimeType: string } | null {
  if (!isRecord(response)) return null;
  const candidates = response.candidates;
  if (!Array.isArray(candidates)) return null;

  for (const candidate of candidates) {
    if (!isRecord(candidate)) continue;
    const content = candidate.content;
    if (!isRecord(content)) continue;
    const parts = content.parts;
    if (!Array.isArray(parts)) continue;

    for (const part of parts) {
      if (!isRecord(part)) continue;
      const inlineData = part.inlineData;
      if (!isRecord(inlineData)) continue;

      const data = inlineData.data;
      const mimeType = inlineData.mimeType;
      if (typeof data !== "string" || !data) continue;

      const safeMime =
        typeof mimeType === "string" && mimeType.trim()
          ? mimeType.trim()
          : "audio/wav";

      if (safeMime.toLowerCase().startsWith("audio/")) {
        return { data, mimeType: safeMime };
      }
    }
  }

  return null;
}

async function synthesizeListeningAudio(text: string): Promise<{
  bytes: Buffer;
  mimeType: string;
  model: string;
  voice: string;
}> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const ai = getGeminiClient();
  const voice = (process.env.GEMINI_TTS_VOICE || "Kore").trim() || "Kore";

  const narrationPrompt = [
    "Read this IELTS listening passage in clear neutral English.",
    "Keep the original text exactly and do not add commentary.",
    "Use natural pacing suitable for IELTS listening practice.",
    "",
    text,
  ].join("\n");

  let lastError: unknown = null;
  for (const model of modelCandidates()) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: narrationPrompt,
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            languageCode: "en-US",
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voice,
              },
            },
          },
        },
      });

      const inlineAudio = extractInlineAudio(response);
      if (!inlineAudio) {
        throw new Error("Model response did not include audio data");
      }

      const bytes = Buffer.from(inlineAudio.data, "base64");
      if (!bytes.length) {
        throw new Error("Generated audio payload was empty");
      }

      return {
        bytes,
        mimeType: inlineAudio.mimeType,
        model,
        voice,
      };
    } catch (error) {
      lastError = error;
    }
  }

  const detail =
    lastError instanceof Error ? lastError.message : "Unknown Gemini error";
  throw new Error(`Audio generation failed: ${detail}`);
}

async function uploadAudioBytes(params: {
  passageId: string;
  bytes: Buffer;
  mimeType: string;
}): Promise<{ url: string; storagePath: string | null }> {
  const { passageId, bytes, mimeType } = params;
  const bucket = process.env.SUPABASE_MEDIA_BUCKET || "exam-media";
  const ext = extensionFromMimeType(mimeType);
  const cloudPath = `passages/${passageId}/${Date.now()}-${crypto.randomUUID()}-ai.${ext}`;

  try {
    const supabase = await createSupabaseServerClient();
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(cloudPath, bytes, {
        cacheControl: "3600",
        upsert: false,
        contentType: mimeType,
      });

    if (!uploadError) {
      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(cloudPath);

      if (publicUrl) {
        return { url: publicUrl, storagePath: cloudPath };
      }
    }
  } catch {
    // Fall back to local storage if cloud upload is unavailable.
  }

  const fileName = `${Date.now()}-${crypto.randomUUID()}-ai.${ext}`;
  const localDir = join(
    process.cwd(),
    "public",
    "uploads",
    "passages",
    passageId,
  );
  await mkdir(localDir, { recursive: true });
  await writeFile(join(localDir, fileName), bytes);

  return {
    url: `/uploads/passages/${passageId}/${fileName}`,
    storagePath: `local:uploads/passages/${passageId}/${fileName}`,
  };
}

export async function ensureListeningPassageAudio(
  params: EnsureListeningPassageAudioParams,
): Promise<EnsureListeningPassageAudioResult> {
  const { passageId, existingMedia, forceRegenerate } = params;

  const ordered = [...existingMedia].sort((a, b) => a.order - b.order);
  const existingAudio = ordered.find((m) => m.type === "AUDIO");
  if (existingAudio && !forceRegenerate) {
    return {
      generated: false,
      media: {
        id: existingAudio.id,
        type: "AUDIO",
        url: existingAudio.url,
        label: existingAudio.label || null,
        order: existingAudio.order,
        storagePath: existingAudio.storagePath || null,
      },
      model: null,
      voice: null,
    };
  }

  const cleanContent = normalizeText(params.passageContent);
  if (!cleanContent) {
    throw new Error("Passage content is empty, so audio cannot be generated");
  }

  const cappedContent =
    cleanContent.length > 12_000 ? cleanContent.slice(0, 12_000) : cleanContent;
  const generated = await synthesizeListeningAudio(cappedContent);
  const uploaded = await uploadAudioBytes({
    passageId,
    bytes: generated.bytes,
    mimeType: generated.mimeType,
  });

  const nextOrder =
    ordered.reduce((max, item) => Math.max(max, item.order || 0), 0) + 1;

  const media = await prisma.passageMedia.create({
    data: {
      passageId,
      type: "AUDIO",
      url: uploaded.url,
      storagePath: uploaded.storagePath,
      label: params.label || `AI narration (${generated.voice})`,
      order: nextOrder,
    },
  });

  return {
    generated: true,
    media: {
      id: media.id,
      type: "AUDIO",
      url: media.url,
      label: media.label || null,
      order: media.order,
      storagePath: media.storagePath || null,
    },
    model: generated.model,
    voice: generated.voice,
  };
}
