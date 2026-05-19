export type SpeakingPart = "PART_1" | "PART_2_PREP" | "PART_2" | "PART_3";

export type SpeakingPrompt = {
  index: number;
  part: SpeakingPart;
  prompt: string;
  prepSeconds: number;
  targetAnswerSeconds: number;
  hardLimitSeconds: number;
  silencePromptSeconds: number;
};

export type SpeakingPromptTemplate = Omit<SpeakingPrompt, "index">;

const DEFAULT_PROMPTS: SpeakingPromptTemplate[] = [
  {
    part: "PART_1",
    prompt:
      "Good morning. Let us start with your hometown. What do you like most about the place where you live?",
    prepSeconds: 0,
    targetAnswerSeconds: 40,
    hardLimitSeconds: 75,
    silencePromptSeconds: 11,
  },
  {
    part: "PART_1",
    prompt:
      "What kind of work or study are you doing at the moment, and why did you choose it?",
    prepSeconds: 0,
    targetAnswerSeconds: 45,
    hardLimitSeconds: 80,
    silencePromptSeconds: 11,
  },
  {
    part: "PART_1",
    prompt:
      "How do you usually spend your weekends? Please give a little detail.",
    prepSeconds: 0,
    targetAnswerSeconds: 45,
    hardLimitSeconds: 80,
    silencePromptSeconds: 11,
  },
  {
    part: "PART_1",
    prompt:
      "Do you think your daily routine will change in the next few years? Why?",
    prepSeconds: 0,
    targetAnswerSeconds: 45,
    hardLimitSeconds: 80,
    silencePromptSeconds: 11,
  },
  {
    part: "PART_2",
    prompt:
      "Now I am going to give you a topic. Describe a person who has positively influenced your life. You should say who this person is, how you met them, what they did that influenced you, and explain why this influence was important. You have one minute to prepare and up to two minutes to speak.",
    prepSeconds: 60,
    targetAnswerSeconds: 120,
    hardLimitSeconds: 150,
    silencePromptSeconds: 12,
  },
  {
    part: "PART_3",
    prompt:
      "Let us discuss influence in society. Why do some people influence others more strongly than others?",
    prepSeconds: 0,
    targetAnswerSeconds: 55,
    hardLimitSeconds: 100,
    silencePromptSeconds: 11,
  },
  {
    part: "PART_3",
    prompt:
      "Do you think social media has changed how young people choose role models?",
    prepSeconds: 0,
    targetAnswerSeconds: 55,
    hardLimitSeconds: 100,
    silencePromptSeconds: 11,
  },
  {
    part: "PART_3",
    prompt:
      "What responsibilities should public figures have when they know others are influenced by them?",
    prepSeconds: 0,
    targetAnswerSeconds: 60,
    hardLimitSeconds: 105,
    silencePromptSeconds: 11,
  },
  {
    part: "PART_3",
    prompt:
      "In your opinion, can a person become a positive influence later in life, even after making mistakes earlier?",
    prepSeconds: 0,
    targetAnswerSeconds: 60,
    hardLimitSeconds: 105,
    silencePromptSeconds: 11,
  },
];

let activePrompts: SpeakingPromptTemplate[] = [...DEFAULT_PROMPTS];

export function setActiveSpeakingPrompts(prompts: SpeakingPromptTemplate[]): void {
  if (!Array.isArray(prompts) || prompts.length === 0) {
    activePrompts = [...DEFAULT_PROMPTS];
    return;
  }
  activePrompts = prompts.map((prompt) => ({ ...prompt }));
}

export function resetActiveSpeakingPrompts(): void {
  activePrompts = [...DEFAULT_PROMPTS];
}

export function getActiveSpeakingPromptTemplates(): SpeakingPromptTemplate[] {
  return activePrompts.map((prompt) => ({ ...prompt }));
}

export function getSpeakingQuestionCount(): number {
  return activePrompts.length;
}

export const SPEAKING_QUESTION_COUNT = DEFAULT_PROMPTS.length;

export function getSpeakingPrompt(index: number): SpeakingPrompt | null {
  if (index < 0 || index >= activePrompts.length) return null;
  const prompt = activePrompts[index];
  return {
    index,
    part: prompt.part,
    prompt: prompt.prompt,
    prepSeconds: prompt.prepSeconds,
    targetAnswerSeconds: prompt.targetAnswerSeconds,
    hardLimitSeconds: prompt.hardLimitSeconds,
    silencePromptSeconds: prompt.silencePromptSeconds,
  };
}

export function partLabel(part: SpeakingPart): string {
  if (part === "PART_1") return "Part 1";
  if (part === "PART_2_PREP") return "Part 2 Prep";
  if (part === "PART_2") return "Part 2";
  return "Part 3";
}

export function nextPrompt(currentIndex: number): SpeakingPrompt | null {
  return getSpeakingPrompt(currentIndex + 1);
}
