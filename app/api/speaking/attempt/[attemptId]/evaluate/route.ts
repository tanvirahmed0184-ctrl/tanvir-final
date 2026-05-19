import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { GEMINI_MODEL, getGeminiClient } from "@/lib/gemini";
import { requireSpeakingUser } from "@/lib/speaking/auth";
import { toInputJsonValue } from "@/lib/speaking/json";
import {
  buildPrompt,
  buildRepairPrompt,
  generateWithOllama,
  parseAndValidateEvaluation,
  type SpeakingEvaluationPayload,
} from "@/lib/speaking/ollama";

type Params = { attemptId: string };

function fallbackEvaluation(turnCount: number): SpeakingEvaluationPayload {
  const baseline = turnCount >= 7 ? 6 : turnCount >= 5 ? 5.5 : 5;
  return {
    fluencyCoherence: {
      band: baseline,
      feedback:
        "Maintain longer connected speech and reduce repeated reformulation.",
    },
    lexicalResource: {
      band: baseline,
      feedback:
        "Use more precise topic vocabulary and collocations in extended answers.",
    },
    grammaticalRangeAccuracy: {
      band: Math.max(0, baseline - 0.5),
      feedback:
        "Increase sentence variety and monitor tense consistency while speaking.",
    },
    pronunciation: {
      band: baseline,
      feedback:
        "Keep a steady pace and stress key words clearly to improve intelligibility.",
    },
    overallBand: baseline,
    strengths: ["Able to respond to most prompts", "Maintains interaction flow"],
    weaknesses: [
      "Needs more detail in complex answers",
      "Occasional hesitation affects coherence",
    ],
    grammarCorrections: [],
    vocabularyUpgrades: [],
    actionableTips: [
      "Answer Part 3 with claim -> reason -> example structure.",
      "Record 2-minute responses and self-check pause frequency.",
    ],
    examinerSummary:
      "Fallback evaluation used because AI scoring was unavailable for this attempt.",
  };
}

function elapsedMs(startedAt: number): number {
  return Math.max(0, Date.now() - startedAt);
}

export async function POST(
  _request: Request,
  context: { params: Promise<Params> },
) {
  try {
    const auth = await requireSpeakingUser();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { attemptId } = await context.params;
    if (!attemptId) {
      return NextResponse.json({ error: "attemptId is required" }, { status: 400 });
    }

    const attempt = await prisma.speakingAttempt.findFirst({
      where: { id: attemptId, userId: auth.userId },
      include: {
        turns: {
          orderBy: { sequence: "asc" },
          include: { recording: true },
        },
      },
    });

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    if (attempt.status === "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Attempt must be finalized before evaluation" },
        { status: 400 },
      );
    }

    if (!attempt.turns.length) {
      return NextResponse.json(
        { error: "No speaking turns to evaluate" },
        { status: 400 },
      );
    }

    const turnPayload = attempt.turns.map((turn) => ({
      part: turn.part,
      sequence: turn.sequence,
      examinerPrompt: turn.examinerPrompt,
      transcript: turn.userTranscript,
      durationMs: turn.durationMs,
      fillerWordCount: turn.fillerWordCount,
      pauseCount: turn.pauseCount,
      pauseDurationMs: turn.pauseDurationMs,
      speechRateWpm: turn.speechRateWpm,
      pronunciation: (() => {
        const metadata =
          turn.metadata && typeof turn.metadata === "object"
            ? (turn.metadata as Record<string, unknown>)
            : {};
        const pron = metadata.pronunciation;
        if (!pron || typeof pron !== "object") return null;
        return pron;
      })(),
      recordingUrl: turn.recording?.publicUrl || null,
    }));

    let evaluation: SpeakingEvaluationPayload = fallbackEvaluation(
      attempt.turns.length,
    );
    let provider: "ollama" | "gemini" | "fallback" = "fallback";
    let rawModelOutput: unknown = null;
    let geminiFailureReason: string | null = null;

    try {
      const ai = getGeminiClient();
      const modelStartedAt = Date.now();
      const response = (await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: buildPrompt(turnPayload),
      })) as unknown as {
        text?: string;
        outputText?: string;
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };
      const raw =
        response.text ||
        response.outputText ||
        response.candidates?.[0]?.content?.parts?.[0]?.text ||
        "";
      const firstParsed = parseAndValidateEvaluation(raw);
      if (firstParsed) {
        evaluation = firstParsed;
        provider = "gemini";
        rawModelOutput = firstParsed;
        console.info(
          `[Speaking][Gemini] attempt=${attempt.id} pass=primary durationMs=${elapsedMs(
            modelStartedAt,
          )}`,
        );
      } else {
        const repairStartedAt = Date.now();
        const repairedResponse = (await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: buildRepairPrompt(raw),
        })) as unknown as {
          text?: string;
          outputText?: string;
          candidates?: Array<{
            content?: {
              parts?: Array<{ text?: string }>;
            };
          }>;
        };
        const repairedRaw =
          repairedResponse.text ||
          repairedResponse.outputText ||
          repairedResponse.candidates?.[0]?.content?.parts?.[0]?.text ||
          "";
        const repairedParsed = parseAndValidateEvaluation(repairedRaw);
        if (!repairedParsed) {
          throw new Error("Gemini response failed schema validation");
        }
        evaluation = repairedParsed;
        provider = "gemini";
        rawModelOutput = repairedParsed;
        console.info(
          `[Speaking][Gemini] attempt=${attempt.id} pass=repair durationMs=${elapsedMs(
            repairStartedAt,
          )}`,
        );
      }
    } catch (error) {
      geminiFailureReason =
        error instanceof Error ? error.message : "Gemini evaluation failed";
      console.warn(
        `[Speaking][Gemini] attempt=${attempt.id} fallback=ollama reason=${geminiFailureReason}`,
      );
    }

    if (provider !== "gemini") {
      try {
        const localStartedAt = Date.now();
        const localRaw = await generateWithOllama(buildPrompt(turnPayload));
        const localParsed = parseAndValidateEvaluation(localRaw);
        if (!localParsed) {
          const repairRaw = await generateWithOllama(buildRepairPrompt(localRaw));
          const repairParsed = parseAndValidateEvaluation(repairRaw);
          if (!repairParsed) {
            throw new Error("Ollama response failed schema validation");
          }
          evaluation = repairParsed;
          provider = "ollama";
          rawModelOutput = repairParsed;
          console.info(
            `[Speaking][Ollama] attempt=${attempt.id} pass=repair durationMs=${elapsedMs(
              localStartedAt,
            )}`,
          );
        } else {
          evaluation = localParsed;
          provider = "ollama";
          rawModelOutput = localParsed;
          console.info(
            `[Speaking][Ollama] attempt=${attempt.id} pass=primary durationMs=${elapsedMs(
              localStartedAt,
            )}`,
          );
        }
      } catch (localError) {
        const ollamaFailureReason =
          localError instanceof Error
            ? localError.message
            : "Ollama evaluation failed";
        evaluation = fallbackEvaluation(attempt.turns.length);
        provider = "fallback";
        rawModelOutput = {
          geminiError: geminiFailureReason,
          ollamaError: ollamaFailureReason,
        };
        console.error(
          `[Speaking][Ollama] attempt=${attempt.id} fallback=true reason=${ollamaFailureReason}`,
        );
      }
    }

    const pronunciationScores = attempt.turns
      .map((turn) => {
        const metadata =
          turn.metadata && typeof turn.metadata === "object"
            ? (turn.metadata as Record<string, unknown>)
            : {};
        const pron =
          metadata.pronunciation && typeof metadata.pronunciation === "object"
            ? (metadata.pronunciation as Record<string, unknown>)
            : null;
        const metrics =
          pron?.metrics && typeof pron.metrics === "object"
            ? (pron.metrics as Record<string, unknown>)
            : null;
        const score = Number(metrics?.pronunciationScore ?? NaN);
        return Number.isFinite(score) ? score : null;
      })
      .filter((value): value is number => value !== null);

    const pronunciationProviders = attempt.turns
      .map((turn) => {
        const metadata =
          turn.metadata && typeof turn.metadata === "object"
            ? (turn.metadata as Record<string, unknown>)
            : {};
        const pron =
          metadata.pronunciation && typeof metadata.pronunciation === "object"
            ? (metadata.pronunciation as Record<string, unknown>)
            : null;
        const provider = pron?.provider;
        return typeof provider === "string" && provider.trim()
          ? provider.trim()
          : null;
      })
      .filter((value): value is string => Boolean(value));

    const pronunciationProviderCounts = pronunciationProviders.length
      ? pronunciationProviders.reduce(
          (acc, current) => {
            acc[current] = (acc[current] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        )
      : null;

    const topPronunciationProvider = pronunciationProviderCounts
      ? Object.entries(pronunciationProviderCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
        null
      : null;

    const pronunciationSummary = {
      provider: topPronunciationProvider,
      averagePronunciationScore: pronunciationScores.length
        ? Number(
            (
              pronunciationScores.reduce((sum, v) => sum + v, 0) /
              pronunciationScores.length
            ).toFixed(2),
          )
        : null,
      scoredTurns: pronunciationScores.length,
      totalTurns: attempt.turns.length,
    };

    const criterionFeedbackJson = toInputJsonValue({
      fluencyCoherence: evaluation.fluencyCoherence.feedback,
      lexicalResource: evaluation.lexicalResource.feedback,
      grammaticalRangeAccuracy: evaluation.grammaticalRangeAccuracy.feedback,
      pronunciation: evaluation.pronunciation.feedback,
      provider,
      rawModelOutput,
    });
    const actionableTipsJson = toInputJsonValue(evaluation.actionableTips);
    const grammarCorrectionsJson = toInputJsonValue(evaluation.grammarCorrections);
    const vocabularyUpgradesJson = toInputJsonValue(evaluation.vocabularyUpgrades);
    const pronunciationSummaryJson = toInputJsonValue(pronunciationSummary);

    await prisma.$transaction(async (tx) => {
      await tx.speakingEvaluation.upsert({
        where: { attemptId: attempt.id },
        create: {
          attemptId: attempt.id,
          fluencyCoherence: evaluation.fluencyCoherence.band,
          lexicalResource: evaluation.lexicalResource.band,
          grammaticalRangeAccuracy: evaluation.grammaticalRangeAccuracy.band,
          pronunciation: evaluation.pronunciation.band,
          overallBand: evaluation.overallBand,
          criterionFeedback: criterionFeedbackJson,
          actionableTips: actionableTipsJson,
          grammarCorrections: grammarCorrectionsJson,
          vocabularyUpgrades: vocabularyUpgradesJson,
          strengths: evaluation.strengths,
          weaknesses: evaluation.weaknesses,
          pronunciationSummary: pronunciationSummaryJson,
          examinerSummary: evaluation.examinerSummary,
        },
        update: {
          fluencyCoherence: evaluation.fluencyCoherence.band,
          lexicalResource: evaluation.lexicalResource.band,
          grammaticalRangeAccuracy: evaluation.grammaticalRangeAccuracy.band,
          pronunciation: evaluation.pronunciation.band,
          overallBand: evaluation.overallBand,
          criterionFeedback: criterionFeedbackJson,
          actionableTips: actionableTipsJson,
          grammarCorrections: grammarCorrectionsJson,
          vocabularyUpgrades: vocabularyUpgradesJson,
          strengths: evaluation.strengths,
          weaknesses: evaluation.weaknesses,
          pronunciationSummary: pronunciationSummaryJson,
          examinerSummary: evaluation.examinerSummary,
          evaluatedAt: new Date(),
        },
      });

      await tx.speakingAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "EVALUATED",
          completedAt: new Date(),
          submittedAt: attempt.submittedAt || new Date(),
        },
      });
    });

    return NextResponse.json({
      provider,
      evaluation,
      pronunciationSummary,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to evaluate speaking attempt", detail },
      { status: 500 },
    );
  }
}
