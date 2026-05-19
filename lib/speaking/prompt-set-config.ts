import type { SpeakingPart, SpeakingPromptTemplate } from "@/lib/speaking/flow";

const VALID_PARTS: SpeakingPart[] = ["PART_1", "PART_2_PREP", "PART_2", "PART_3"];

export type SpeakingPromptSet = {
  id: string;
  name: string;
  prompts: SpeakingPromptTemplate[];
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function normalizePart(value: unknown): SpeakingPart {
  if (typeof value === "string" && VALID_PARTS.includes(value as SpeakingPart)) {
    return value as SpeakingPart;
  }
  return "PART_1";
}

function normalizePromptText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function fallbackSetId(index: number): string {
  return `set-${index + 1}`;
}

function normalizeSetName(value: unknown, index: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text || `Set ${index + 1}`;
}

function normalizeSetId(value: unknown, index: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallbackSetId(index);
}

export function normalizePromptTemplate(input: unknown): SpeakingPromptTemplate | null {
  const row = asObject(input);
  if (!row) return null;
  const prompt = normalizePromptText(row.prompt);
  if (!prompt) return null;

  const targetAnswerSeconds = clampInt(row.targetAnswerSeconds, 45, 10, 300);
  const prepSeconds = clampInt(row.prepSeconds, 0, 0, 180);
  const hardLimitSeconds = Math.max(
    targetAnswerSeconds + 5,
    clampInt(row.hardLimitSeconds, targetAnswerSeconds + 20, 15, 360),
  );
  const silencePromptSeconds = clampInt(row.silencePromptSeconds, 11, 5, 60);

  return {
    part: normalizePart(row.part),
    prompt,
    prepSeconds,
    targetAnswerSeconds,
    hardLimitSeconds,
    silencePromptSeconds,
  };
}

export function normalizePromptTemplates(input: unknown): SpeakingPromptTemplate[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => normalizePromptTemplate(item))
    .filter((item): item is SpeakingPromptTemplate => item !== null);
}

function normalizePromptSet(input: unknown, index: number): SpeakingPromptSet | null {
  const row = asObject(input);
  if (!row) return null;
  const prompts = normalizePromptTemplates(row.prompts);
  if (prompts.length === 0) return null;

  return {
    id: normalizeSetId(row.id, index),
    name: normalizeSetName(row.name, index),
    prompts,
  };
}

export function normalizePromptSets(input: unknown): SpeakingPromptSet[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item, index) => normalizePromptSet(item, index))
    .filter((item): item is SpeakingPromptSet => item !== null);
}

export function parsePromptSetsFromSourceConfig(sourceConfig: unknown): {
  sets: SpeakingPromptSet[];
  activeSetId: string | null;
} {
  const source = asObject(sourceConfig);
  if (!source) return { sets: [], activeSetId: null };

  const setsRoot = asObject(source.speakingPromptSets);
  if (setsRoot) {
    const sets = normalizePromptSets(setsRoot.sets);
    const requestedActiveId =
      typeof setsRoot.activeSetId === "string" ? setsRoot.activeSetId.trim() : "";
    const activeSetId =
      sets.find((set) => set.id === requestedActiveId)?.id || sets[0]?.id || null;
    if (sets.length > 0) return { sets, activeSetId };
  }

  // Backward compatibility: previous single-set structure.
  const singleRoot = asObject(source.speakingPromptSet);
  if (singleRoot) {
    const prompts = normalizePromptTemplates(singleRoot.prompts);
    if (prompts.length > 0) {
      return {
        sets: [
          {
            id: "default-set",
            name:
              typeof singleRoot.name === "string" && singleRoot.name.trim()
                ? singleRoot.name.trim()
                : "Default Set",
            prompts,
          },
        ],
        activeSetId: "default-set",
      };
    }
  }

  const directPrompts = normalizePromptTemplates(source.prompts);
  if (directPrompts.length > 0) {
    return {
      sets: [{ id: "default-set", name: "Default Set", prompts: directPrompts }],
      activeSetId: "default-set",
    };
  }

  const speakingPrompts = normalizePromptTemplates(source.speakingPrompts);
  if (speakingPrompts.length > 0) {
    return {
      sets: [{ id: "default-set", name: "Default Set", prompts: speakingPrompts }],
      activeSetId: "default-set",
    };
  }

  return { sets: [], activeSetId: null };
}

export function buildSpeakingSourceConfig(
  existing: unknown,
  sets: SpeakingPromptSet[],
  activeSetId: string | null,
): Record<string, unknown> {
  const base = asObject(existing) || {};
  const normalizedSets = sets.map((set, index) => ({
    id: normalizeSetId(set.id, index),
    name: normalizeSetName(set.name, index),
    prompts: set.prompts,
  }));
  const finalActiveId =
    normalizedSets.find((set) => set.id === activeSetId)?.id ||
    normalizedSets[0]?.id ||
    null;

  return {
    ...base,
    speakingPromptSets: {
      version: 2,
      activeSetId: finalActiveId,
      sets: normalizedSets,
    },
  };
}
