import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { gradeAttempt } from "@/lib/scoring/deterministic-grader";
import { getBandScore } from "@/lib/scoring/band-mapping";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function mapModule(module: string): "READING" | "LISTENING" {
  return module === "LISTENING" ? "LISTENING" : "READING";
}

function mapVariant(variant: string): "ACADEMIC" | "GENERAL" {
  return variant === "GENERAL" ? "GENERAL" : "ACADEMIC";
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ attemptId: string }> },
) {
  try {
    const { attemptId } = await context.params;

    if (attemptId.startsWith("demo-attempt-")) {
      const rawScore = 28;
      const totalCount = 40;
      const bandScore = getBandScore(rawScore, "READING", "ACADEMIC");

      return NextResponse.json({
        bandScore,
        rawScore,
        correctCount: rawScore,
        totalCount,
        mcqResults: [],
      });
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: {
        test: {
          select: {
            module: true,
            variant: true,
          },
        },
        answers: {
          include: {
            question: {
              select: {
                id: true,
                questionText: true,
                correctAnswer: true,
                acceptedAnswers: true,
                explanation: true,
                points: true,
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    if (attempt.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (
      attempt.test.module !== "READING" &&
      attempt.test.module !== "LISTENING"
    ) {
      return NextResponse.json(
        {
          error:
            "This evaluation route supports only READING and LISTENING attempts",
        },
        { status: 400 },
      );
    }

    const rows = attempt.answers.map((answer) => ({
      userAnswer: answer.givenAnswer,
      correctAnswer: answer.question.correctAnswer,
      acceptedAnswers: answer.question.acceptedAnswers,
      points: answer.question.points,
    }));

    const graded = gradeAttempt(rows);

    const module = mapModule(attempt.test.module);
    const variant = mapVariant(attempt.test.variant);
    const bandScore = getBandScore(graded.correctCount, module, variant);

    const totalCount = rows.length;

    await prisma.$transaction(
      async (tx) => {
        const incorrectIds: string[] = [];
        const correctIdsByPoints = new Map<number, string[]>();

        for (let i = 0; i < attempt.answers.length; i += 1) {
          const item = attempt.answers[i];
          const isCorrect = graded.results[i]?.isCorrect ?? false;

          if (!isCorrect) {
            incorrectIds.push(item.id);
            continue;
          }

          const points = item.question.points;
          const bucket = correctIdsByPoints.get(points) || [];
          bucket.push(item.id);
          correctIdsByPoints.set(points, bucket);
        }

        if (incorrectIds.length) {
          await tx.answer.updateMany({
            where: { id: { in: incorrectIds } },
            data: {
              isCorrect: false,
              pointsAwarded: 0,
            },
          });
        }

        for (const [points, ids] of correctIdsByPoints.entries()) {
          if (!ids.length) continue;
          await tx.answer.updateMany({
            where: { id: { in: ids } },
            data: {
              isCorrect: true,
              pointsAwarded: points,
            },
          });
        }

        await tx.testAttempt.update({
          where: { id: attemptId },
          data: {
            status: "EVALUATED",
            completedAt: new Date(),
            bandScore,
            rawScore: graded.correctCount,
            correctCount: graded.correctCount,
            totalCount,
          },
        });
      },
      {
        // Evaluation updates can timeout if done as many sequential writes.
        maxWait: 10_000,
        timeout: 60_000,
      },
    );

    const mcqResults = attempt.answers.map((answer, idx) => {
      const isCorrect = graded.results[idx]?.isCorrect ?? false;
      return {
        questionId: answer.question.id,
        questionText: answer.question.questionText,
        yourAnswer: answer.givenAnswer,
        correctAnswer: answer.question.correctAnswer,
        acceptedAnswers: answer.question.acceptedAnswers,
        explanation: answer.question.explanation,
        isCorrect,
      };
    });

    return NextResponse.json({
      bandScore,
      rawScore: graded.correctCount,
      correctCount: graded.correctCount,
      totalCount,
      mcqResults,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to evaluate attempt", detail },
      { status: 500 },
    );
  }
}
