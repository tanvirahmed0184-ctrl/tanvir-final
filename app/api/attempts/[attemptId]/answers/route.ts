import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type IncomingAnswer = {
  questionId?: unknown;
  givenAnswer?: unknown;
};

type Body = {
  answers?: IncomingAnswer[];
  timeTakenSecs?: unknown;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ attemptId: string }> },
) {
  try {
    const { attemptId } = await context.params;

    if (attemptId.startsWith("demo-attempt-")) {
      return NextResponse.json({ ok: true, saved: 0, demo: true });
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
      select: { id: true, userId: true },
    });

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    if (attempt.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const incoming = Array.isArray(body.answers) ? body.answers : [];
    const rawTimeTaken = Number(body.timeTakenSecs);
    const timeTakenSecs =
      Number.isFinite(rawTimeTaken) && rawTimeTaken >= 0
        ? Math.round(rawTimeTaken)
        : null;

    const answers = incoming
      .map((item) => ({
        questionId:
          typeof item.questionId === "string" ? item.questionId.trim() : "",
        givenAnswer:
          item.givenAnswer == null ? null : String(item.givenAnswer).trim(),
      }))
      .filter((item) => item.questionId.length > 0);

    if (!answers.length) {
      return NextResponse.json(
        { error: "answers array is required" },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const questionIds = answers.map((a) => a.questionId);

      await tx.answer.deleteMany({
        where: {
          attemptId,
          questionId: { in: questionIds },
        },
      });

      await tx.answer.createMany({
        data: answers.map((answer) => ({
          attemptId,
          questionId: answer.questionId,
          givenAnswer: answer.givenAnswer,
        })),
      });

      if (timeTakenSecs != null) {
        await tx.testAttempt.update({
          where: { id: attemptId },
          data: { timeTakenSecs },
        });
      }

      return { saved: answers.length };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to save answers", detail },
      { status: 500 },
    );
  }
}
