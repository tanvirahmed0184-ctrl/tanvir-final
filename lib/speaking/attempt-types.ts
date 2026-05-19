import type { SpeakingPrompt, SpeakingPart } from "@/lib/speaking/flow";
import type { TurnView } from "@/lib/speaking/session-engine";

export type SpeakingResultResponse = {
  attempt?: {
    id: string;
    status: string;
    mode: string;
    startedAt: string;
    submittedAt: string | null;
    completedAt: string | null;
    currentPart: SpeakingPart;
    currentQuestionIndex?: number;
    totalQuestionsAsked: number;
    transcriptFull: string;
  };
  nextPrompt?: SpeakingPrompt | null;
  turns?: TurnView[];
  evaluation?: {
    fluencyCoherence: number | null;
    lexicalResource: number | null;
    grammaticalRangeAccuracy: number | null;
    pronunciation: number | null;
    overallBand: number | null;
    criterionFeedback?: {
      fluencyCoherence?: string;
      lexicalResource?: string;
      grammaticalRangeAccuracy?: string;
      pronunciation?: string;
      provider?: string;
    };
    strengths?: string[];
    weaknesses?: string[];
    actionableTips?: string[];
    grammarCorrections?: Array<{
      original: string;
      corrected: string;
      explanation: string;
    }>;
    vocabularyUpgrades?: Array<{
      original: string;
      better: string;
      reason: string;
    }>;
    pronunciationSummary?: {
      provider?: string | null;
      averagePronunciationScore?: number | null;
      scoredTurns?: number;
      totalTurns?: number;
    };
    examinerSummary?: string | null;
  } | null;
};
