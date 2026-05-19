export type PronunciationMetrics = {
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  pronunciationScore: number;
};

function parseNumber(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

export async function assessPronunciationWithAzure(params: {
  audio: File;
  transcript: string;
}): Promise<{
  provider: "azure" | "local_estimated";
  metrics: PronunciationMetrics;
  raw: unknown;
}> {
  const { audio, transcript } = params;
  const endpoint = process.env.AZURE_SPEECH_ENDPOINT;
  const key = process.env.AZURE_SPEECH_KEY;

  const estimateLocal = (reason: string) => {
    const cleaned = (transcript || "").trim();
    const words = cleaned ? cleaned.split(/\s+/).filter(Boolean) : [];
    const wordCount = words.length;
    const uniqueWords = new Set(words.map((word) => word.toLowerCase())).size;
    const lexicalRatio =
      wordCount > 0 ? Math.min(1, uniqueWords / Math.max(1, wordCount)) : 0;
    const durationSeconds = Math.max(1, Math.round((audio.size / 32000) * 8));
    const speechRateWpm = (wordCount * 60) / durationSeconds;

    const completenessScore = Math.max(
      20,
      Math.min(95, Math.round(35 + Math.min(60, wordCount * 1.8))),
    );
    const fluencyScore = Math.max(
      20,
      Math.min(
        95,
        Math.round(
          55 +
            (speechRateWpm >= 100 && speechRateWpm <= 170 ? 18 : 6) +
            lexicalRatio * 12,
        ),
      ),
    );
    const accuracyScore = Math.max(
      20,
      Math.min(95, Math.round(50 + lexicalRatio * 20 + (cleaned ? 8 : -8))),
    );
    const pronunciationScore = Math.round(
      accuracyScore * 0.45 + fluencyScore * 0.35 + completenessScore * 0.2,
    );

    return {
      provider: "local_estimated" as const,
      metrics: {
        accuracyScore,
        fluencyScore,
        completenessScore,
        pronunciationScore: Math.max(0, Math.min(100, pronunciationScore)),
      },
      raw: {
        reason,
        estimator: {
          transcriptWordCount: wordCount,
          lexicalRatio: Number(lexicalRatio.toFixed(3)),
          speechRateWpm: Number(speechRateWpm.toFixed(2)),
        },
      },
    };
  };

  if (!endpoint || !key) {
    return estimateLocal("Azure Speech credentials missing");
  }

  try {
    const contentType = audio.type || "audio/webm";
    const pronunciationConfig = {
      GradingSystem: "HundredMark",
      Granularity: "Phoneme",
      Dimension: "Comprehensive",
      EnableMiscue: true,
      ReferenceText: transcript,
    };
    const headerValue = Buffer.from(
      JSON.stringify(pronunciationConfig),
      "utf8",
    ).toString("base64");

    const url = new URL(endpoint);
    if (!url.searchParams.get("language")) {
      url.searchParams.set("language", "en-US");
    }
    if (!url.searchParams.get("format")) {
      url.searchParams.set("format", "detailed");
    }
    if (!url.searchParams.get("profanity")) {
      url.searchParams.set("profanity", "masked");
    }

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Pronunciation-Assessment": headerValue,
        "Content-Type": contentType,
      },
      body: await audio.arrayBuffer(),
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          NBest?: Array<{
            PronunciationAssessment?: {
              AccuracyScore?: number;
              FluencyScore?: number;
              CompletenessScore?: number;
              PronScore?: number;
            };
          }>;
          error?: { message?: string };
        }
      | null;

    if (!response.ok) {
      throw new Error(payload?.error?.message || "Azure pronunciation failed");
    }

    const assessment = payload?.NBest?.[0]?.PronunciationAssessment;
    const metrics: PronunciationMetrics = {
      accuracyScore: parseNumber(assessment?.AccuracyScore) ?? 0,
      fluencyScore: parseNumber(assessment?.FluencyScore) ?? 0,
      completenessScore: parseNumber(assessment?.CompletenessScore) ?? 0,
      pronunciationScore: parseNumber(assessment?.PronScore) ?? 0,
    };

    return {
      provider: "azure",
      metrics,
      raw: payload,
    };
  } catch (error) {
    return estimateLocal(
      error instanceof Error ? error.message : "Azure request failed",
    );
  }
}
