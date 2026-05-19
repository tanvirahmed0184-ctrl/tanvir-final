import { z } from "zod";

const CriterionSchema = z.object({
  band: z.number().min(0).max(9),
  feedback: z.string().min(1),
});

const GrammarCorrectionSchema = z.object({
  original: z.string().min(1),
  corrected: z.string().min(1),
  explanation: z.string().min(1),
});

const VocabularyUpgradeSchema = z.object({
  original: z.string().min(1),
  better: z.string().min(1),
  reason: z.string().min(1),
});

export const SpeakingEvaluationSchema = z.object({
  fluencyCoherence: CriterionSchema,
  lexicalResource: CriterionSchema,
  grammaticalRangeAccuracy: CriterionSchema,
  pronunciation: CriterionSchema,
  overallBand: z.number().min(0).max(9),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  grammarCorrections: z.array(GrammarCorrectionSchema),
  vocabularyUpgrades: z.array(VocabularyUpgradeSchema),
  actionableTips: z.array(z.string()),
  examinerSummary: z.string(),
});

export type SpeakingEvaluationPayload = z.infer<typeof SpeakingEvaluationSchema>;

function parseTimeoutMs(raw: string | undefined, fallbackMs: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1000) return fallbackMs;
  return Math.min(180_000, Math.round(n));
}

export function clampBand(value: number): number {
  const safe = Number.isFinite(value) ? value : 0;
  return Math.round(Math.max(0, Math.min(9, safe)) * 2) / 2;
}

export function normalizeEvaluationPayload(
  payload: SpeakingEvaluationPayload,
): SpeakingEvaluationPayload {
  return {
    fluencyCoherence: {
      band: clampBand(payload.fluencyCoherence.band),
      feedback: payload.fluencyCoherence.feedback.trim(),
    },
    lexicalResource: {
      band: clampBand(payload.lexicalResource.band),
      feedback: payload.lexicalResource.feedback.trim(),
    },
    grammaticalRangeAccuracy: {
      band: clampBand(payload.grammaticalRangeAccuracy.band),
      feedback: payload.grammaticalRangeAccuracy.feedback.trim(),
    },
    pronunciation: {
      band: clampBand(payload.pronunciation.band),
      feedback: payload.pronunciation.feedback.trim(),
    },
    overallBand: clampBand(payload.overallBand),
    strengths: payload.strengths.map((x) => x.trim()).filter(Boolean),
    weaknesses: payload.weaknesses.map((x) => x.trim()).filter(Boolean),
    grammarCorrections: payload.grammarCorrections
      .map((item) => ({
        original: item.original.trim(),
        corrected: item.corrected.trim(),
        explanation: item.explanation.trim(),
      }))
      .filter((item) => item.original && item.corrected && item.explanation),
    vocabularyUpgrades: payload.vocabularyUpgrades
      .map((item) => ({
        original: item.original.trim(),
        better: item.better.trim(),
        reason: item.reason.trim(),
      }))
      .filter((item) => item.original && item.better && item.reason),
    actionableTips: payload.actionableTips.map((x) => x.trim()).filter(Boolean),
    examinerSummary: payload.examinerSummary.trim(),
  };
}

function extractJson(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function parseAndValidateEvaluation(
  raw: string,
): SpeakingEvaluationPayload | null {
  const parsed = extractJson(raw);
  if (!parsed) return null;
  const validated = SpeakingEvaluationSchema.safeParse(parsed);
  if (!validated.success) return null;
  return normalizeEvaluationPayload(validated.data);
}

export function buildPrompt(turns: Array<Record<string, unknown>>): string {
  const system = `You are a strict IELTS Speaking examiner.
Return ONLY valid JSON (no markdown), matching this shape:
{
  "fluencyCoherence": { "band": 6.0, "feedback": "..." },
  "lexicalResource": { "band": 6.0, "feedback": "..." },
  "grammaticalRangeAccuracy": { "band": 6.0, "feedback": "..." },
  "pronunciation": { "band": 6.0, "feedback": "..." },
  "overallBand": 6.0,
  "strengths": ["..."],
  "weaknesses": ["..."],
  "grammarCorrections": [{"original":"...","corrected":"...","explanation":"..."}],
  "vocabularyUpgrades": [{"original":"...","better":"...","reason":"..."}],
  "actionableTips": ["..."],
  "examinerSummary": "..."
}
Rules:
- Bands must be 0 to 9 in 0.5 increments.
- Use IELTS descriptors.
- Keep feedback concrete and actionable.
- Do not omit keys.`;

  return [system, "", "Speaking turns JSON:", JSON.stringify(turns)].join("\n");
}

export function buildRepairPrompt(raw: string): string {
  return [
    "Return ONLY strict valid JSON for this schema (no markdown):",
    "{",
    '  "fluencyCoherence": { "band": 6.0, "feedback": "..." },',
    '  "lexicalResource": { "band": 6.0, "feedback": "..." },',
    '  "grammaticalRangeAccuracy": { "band": 6.0, "feedback": "..." },',
    '  "pronunciation": { "band": 6.0, "feedback": "..." },',
    '  "overallBand": 6.0,',
    '  "strengths": ["..."],',
    '  "weaknesses": ["..."],',
    '  "grammarCorrections": [{"original":"...","corrected":"...","explanation":"..."}],',
    '  "vocabularyUpgrades": [{"original":"...","better":"...","reason":"..."}],',
    '  "actionableTips": ["..."],',
    '  "examinerSummary": "..."',
    "}",
    "",
    "Fix and normalize this previously generated response into valid schema JSON:",
    raw,
  ].join("\n");
}

type OllamaGenerateResponse = {
  response?: string;
  done?: boolean;
  error?: string;
};

export async function generateWithOllama(prompt: string): Promise<string> {
  const baseUrl = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").trim();
  const model =
    (process.env.OLLAMA_MODEL || "qwen3.5:4b").trim() || "qwen3.5:4b";
  const timeoutMs = parseTimeoutMs(process.env.OLLAMA_TIMEOUT_MS, 35_000);

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new DOMException("Ollama timeout", "AbortError"));
  }, timeoutMs);

  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: 0.2,
        },
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as
      | OllamaGenerateResponse
      | null;
    if (!response.ok) {
      throw new Error(payload?.error || "Ollama generate failed");
    }
    const text = String(payload?.response || "").trim();
    if (!text) {
      throw new Error("Ollama returned empty response");
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}
