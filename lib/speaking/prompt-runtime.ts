import prisma from "@/lib/prisma";
import {
  getActiveSpeakingPromptTemplates,
  resetActiveSpeakingPrompts,
  setActiveSpeakingPrompts,
  type SpeakingPromptTemplate,
} from "@/lib/speaking/flow";
import {
  parsePromptSetsFromSourceConfig,
  type SpeakingPromptSet,
} from "@/lib/speaking/prompt-set-config";

type CacheEntry = {
  updatedAtMs: number;
  activeSetId: string | null;
  sets: SpeakingPromptSet[];
};

const PROMPT_CACHE_TTL_MS = 45_000;
const promptCache = new Map<string, CacheEntry>();

function fromCache(testId: string): CacheEntry | null {
  const cached = promptCache.get(testId);
  if (!cached) return null;
  if (Date.now() - cached.updatedAtMs > PROMPT_CACHE_TTL_MS) {
    promptCache.delete(testId);
    return null;
  }
  return {
    updatedAtMs: cached.updatedAtMs,
    activeSetId: cached.activeSetId,
    sets: cached.sets.map((set) => ({
      id: set.id,
      name: set.name,
      prompts: set.prompts.map((prompt) => ({ ...prompt })),
    })),
  };
}

function parseMode(mode: string): { testId: string | null; setId: string | null } {
  const normalized = typeof mode === "string" ? mode.trim() : "";
  if (!normalized.startsWith("test:")) {
    return { testId: null, setId: null };
  }
  const payload = normalized.slice("test:".length);
  if (!payload) return { testId: null, setId: null };
  const [testIdRaw, maybeSetRaw] = payload.split(":set:");
  const testId = testIdRaw?.trim() || null;
  const setId = maybeSetRaw?.trim() || null;
  return { testId, setId };
}

export function clearSpeakingPromptRuntimeCache(testId?: string): void {
  if (testId) {
    promptCache.delete(testId);
    return;
  }
  promptCache.clear();
}

export async function loadSpeakingPromptsForAttempt(mode: string): Promise<{
  testId: string | null;
  activeSetId: string | null;
  prompts: SpeakingPromptTemplate[];
}> {
  const parsedMode = parseMode(mode);
  const customTestId = parsedMode.testId;
  const requestedSetId = parsedMode.setId;

  const speakingTest = customTestId
    ? await prisma.test.findFirst({
        where: { id: customTestId, module: "SPEAKING", isActive: true },
        select: { id: true, sourceConfig: true },
      })
    : await prisma.test.findFirst({
        where: { module: "SPEAKING", isActive: true },
        orderBy: { updatedAt: "desc" },
        select: { id: true, sourceConfig: true },
      });

  if (!speakingTest) {
    resetActiveSpeakingPrompts();
    return {
      testId: null,
      activeSetId: null,
      prompts: getActiveSpeakingPromptTemplates(),
    };
  }

  const cached = fromCache(speakingTest.id);
  const parsed = cached || parsePromptSetsFromSourceConfig(speakingTest.sourceConfig);
  const sets = parsed.sets;
  const activeSet =
    sets.find((set) => set.id === requestedSetId) ||
    sets.find((set) => set.id === parsed.activeSetId) ||
    sets[0] ||
    null;
  const prompts = activeSet?.prompts || [];

  if (prompts.length > 0) {
    if (!cached) {
      promptCache.set(speakingTest.id, {
        updatedAtMs: Date.now(),
        activeSetId: parsed.activeSetId,
        sets: sets.map((set) => ({
          id: set.id,
          name: set.name,
          prompts: set.prompts.map((prompt) => ({ ...prompt })),
        })),
      });
    }
    setActiveSpeakingPrompts(prompts);
    return {
      testId: speakingTest.id,
      activeSetId: activeSet?.id || null,
      prompts,
    };
  }

  resetActiveSpeakingPrompts();
  return {
    testId: speakingTest.id,
    activeSetId: null,
    prompts: getActiveSpeakingPromptTemplates(),
  };
}
