export type SpeakingEvaluationView = {
  fluencyCoherence: number;
  lexicalResource: number;
  grammaticalRangeAccuracy: number;
  pronunciation: number;
  overallBand: number;
  criterionFeedback: {
    fluencyCoherence?: string;
    lexicalResource?: string;
    grammaticalRangeAccuracy?: string;
    pronunciation?: string;
  };
  strengths: string[];
  weaknesses: string[];
  actionableTips: string[];
  grammarCorrections: Array<{
    original: string;
    corrected: string;
    explanation: string;
  }>;
  vocabularyUpgrades: Array<{
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
};

type InputEval = {
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
} | null | undefined;

export function mapEvaluationFromResult(
  input: InputEval,
): SpeakingEvaluationView | null {
  if (!input) return null;
  return {
    fluencyCoherence: Number(input.fluencyCoherence ?? 0),
    lexicalResource: Number(input.lexicalResource ?? 0),
    grammaticalRangeAccuracy: Number(input.grammaticalRangeAccuracy ?? 0),
    pronunciation: Number(input.pronunciation ?? 0),
    overallBand: Number(input.overallBand ?? 0),
    criterionFeedback: {
      fluencyCoherence: input.criterionFeedback?.fluencyCoherence,
      lexicalResource: input.criterionFeedback?.lexicalResource,
      grammaticalRangeAccuracy: input.criterionFeedback?.grammaticalRangeAccuracy,
      pronunciation: input.criterionFeedback?.pronunciation,
    },
    strengths: input.strengths || [],
    weaknesses: input.weaknesses || [],
    actionableTips: input.actionableTips || [],
    grammarCorrections: input.grammarCorrections || [],
    vocabularyUpgrades: input.vocabularyUpgrades || [],
    pronunciationSummary: input.pronunciationSummary,
    examinerSummary: input.examinerSummary || null,
  };
}
