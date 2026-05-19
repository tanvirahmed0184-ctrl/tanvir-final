const FILLER_WORDS = new Set(["um", "uh", "ah", "erm", "hmm"]);

export type TranscriptMetrics = {
  cleanedTranscript: string;
  fillerWordCount: number;
  pauseCount: number;
  pauseDurationMs: number;
  wordCount: number;
  speechRateWpm: number | null;
};

function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function analyzeTranscript(
  transcript: string,
  durationMs: number | null | undefined,
): TranscriptMetrics {
  const raw = typeof transcript === "string" ? transcript : "";
  const cleaned = normalizeSpace(raw);
  if (!cleaned) {
    return {
      cleanedTranscript: "",
      fillerWordCount: 0,
      pauseCount: 0,
      pauseDurationMs: 0,
      wordCount: 0,
      speechRateWpm: null,
    };
  }

  const lower = cleaned.toLowerCase();
  const fillerWordCount = lower
    .split(/\s+/)
    .filter((token) => FILLER_WORDS.has(token.replace(/[^a-z]/g, ""))).length;

  const pauseMatches = [...cleaned.matchAll(/\[pause:\s*([0-9]+(?:\.[0-9]+)?)s\]/gi)];
  const pauseCount = pauseMatches.length;
  const pauseDurationMs = Math.round(
    pauseMatches.reduce((total, item) => total + Number(item[1] || 0), 0) * 1000,
  );

  const withoutTags = normalizeSpace(
    cleaned.replace(/\[pause:\s*[0-9]+(?:\.[0-9]+)?s\]/gi, " "),
  );
  const wordCount = withoutTags ? withoutTags.split(/\s+/).length : 0;

  const safeDurationMs = Number(durationMs);
  const hasDuration = Number.isFinite(safeDurationMs) && safeDurationMs > 0;
  const speechRateWpm =
    hasDuration && wordCount > 0
      ? Number((((wordCount * 60_000) / safeDurationMs) as number).toFixed(2))
      : null;

  return {
    cleanedTranscript: withoutTags,
    fillerWordCount,
    pauseCount,
    pauseDurationMs,
    wordCount,
    speechRateWpm,
  };
}
