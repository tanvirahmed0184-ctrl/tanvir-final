import { analyzeTranscript, type TranscriptMetrics } from "@/lib/speaking/metrics";

function toMs(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 1000)) : 0;
}

export type WhisperTranscriptionResult = TranscriptMetrics & {
  provider: "local_whisper" | "openai_whisper" | "fallback_local";
  segments: Array<{
    startMs: number;
    endMs: number;
    text: string;
  }>;
  raw: unknown;
};

type WhisperResponsePayload = {
  text?: string;
  transcript?: string;
  segments?: Array<{
    start?: number;
    end?: number;
    text?: string;
    start_ms?: number;
    end_ms?: number;
  }>;
  error?: { message?: string };
};

function parseTimeoutMs(raw: string | undefined, fallbackMs: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1000) return fallbackMs;
  return Math.min(180_000, Math.round(n));
}

function normalizeWhisperPayload(
  payload: WhisperResponsePayload | null,
  fallbackTranscript: string,
  durationMs: number | null,
  provider: "local_whisper" | "openai_whisper",
): WhisperTranscriptionResult {
  const transcript = (payload?.text || payload?.transcript || "").trim();
  const segments = Array.isArray(payload?.segments)
    ? payload!.segments!.map((seg) => {
        const hasMs =
          typeof seg.start_ms === "number" || typeof seg.end_ms === "number";
        return {
          startMs: hasMs
            ? Math.max(0, Math.round(Number(seg.start_ms || 0)))
            : toMs(String(seg.start ?? 0)),
          endMs: hasMs
            ? Math.max(0, Math.round(Number(seg.end_ms || 0)))
            : toMs(String(seg.end ?? 0)),
          text: typeof seg.text === "string" ? seg.text.trim() : "",
        };
      })
    : [];
  const metrics = analyzeTranscript(transcript || fallbackTranscript, durationMs);
  return {
    ...metrics,
    provider,
    segments,
    raw: payload,
  };
}

export async function transcribeAudioWithWhisper(params: {
  audioBuffer: Buffer;
  mimeType: string;
  fallbackTranscript: string;
  durationMs: number | null;
}): Promise<WhisperTranscriptionResult> {
  const { audioBuffer, mimeType, fallbackTranscript, durationMs } = params;
  const localWhisperUrl = (process.env.LOCAL_WHISPER_URL || "").trim();
  const localWhisperTimeoutMs = parseTimeoutMs(
    process.env.LOCAL_WHISPER_TIMEOUT_MS,
    25_000,
  );
  const apiKey = (process.env.OPENAI_API_KEY || "").trim();
  let localFailureReason: string | null = null;

  if (localWhisperUrl) {
    try {
      const form = new FormData();
      const ext = mimeType.includes("wav")
        ? "wav"
        : mimeType.includes("mp3")
          ? "mp3"
          : mimeType.includes("m4a")
            ? "m4a"
            : mimeType.includes("ogg")
              ? "ogg"
              : "webm";
      const byteArray = new Uint8Array(audioBuffer);
      const file = new File([byteArray], `speaking-turn.${ext}`, {
        type: mimeType || "audio/webm",
      });
      form.append("audio", file);
      form.append("file", file);
      form.append("model", process.env.WHISPER_MODEL || "whisper-1");
      form.append("language", "en");

      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort(
          new DOMException("Local Whisper timeout", "AbortError"),
        );
      }, localWhisperTimeoutMs);

      const response = await fetch(localWhisperUrl, {
        method: "POST",
        body: form,
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      const payload = (await response.json().catch(() => null)) as
        | WhisperResponsePayload
        | null;
      if (!response.ok) {
        throw new Error(
          payload?.error?.message || "Local Whisper transcription failed",
        );
      }
      return normalizeWhisperPayload(
        payload,
        fallbackTranscript,
        durationMs,
        "local_whisper",
      );
    } catch (error) {
      localFailureReason =
        error instanceof Error ? error.message : "Local Whisper failed";
      console.warn(
        `[Speaking][Whisper] local failed reason=${
          error instanceof Error ? error.message : "unknown"
        }`,
      );
    }
  }

  if (!apiKey) {
    const metrics = analyzeTranscript(fallbackTranscript, durationMs);
    return {
      ...metrics,
      provider: "fallback_local",
      segments: [],
      raw: {
        reason: localFailureReason
          ? `OPENAI_API_KEY missing; local failure: ${localFailureReason}`
          : "OPENAI_API_KEY missing",
      },
    };
  }

  try {
    const form = new FormData();
    const ext = mimeType.includes("wav")
      ? "wav"
      : mimeType.includes("mp3")
        ? "mp3"
        : mimeType.includes("m4a")
          ? "m4a"
          : mimeType.includes("ogg")
            ? "ogg"
            : "webm";
    const byteArray = new Uint8Array(audioBuffer);
    const file = new File([byteArray], `speaking-turn.${ext}`, {
      type: mimeType || "audio/webm",
    });
    form.append("file", file);
    form.append("model", process.env.WHISPER_MODEL || "whisper-1");
    form.append("response_format", "verbose_json");
    form.append("temperature", "0");
    form.append("language", "en");

    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: form,
      },
    );

    const payload = (await response.json().catch(() => null)) as
      | WhisperResponsePayload
      | null;

    if (!response.ok) {
      throw new Error(payload?.error?.message || "Whisper request failed");
    }
    return normalizeWhisperPayload(
      payload,
      fallbackTranscript,
      durationMs,
      "openai_whisper",
    );
  } catch (error) {
    console.error(
      `[Speaking][Whisper] fallback=true reason=${
        error instanceof Error ? error.message : "unknown"
      }`,
    );
    const metrics = analyzeTranscript(fallbackTranscript, durationMs);
    return {
      ...metrics,
      provider: "fallback_local",
      segments: [],
      raw: {
        reason: localFailureReason
          ? `Local failure: ${localFailureReason}; OpenAI failure: ${
              error instanceof Error ? error.message : "Whisper failed"
            }`
          : error instanceof Error
            ? error.message
            : "Whisper failed",
      },
    };
  }
}
