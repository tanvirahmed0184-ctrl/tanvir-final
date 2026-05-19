import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  task1AttemptId?: unknown;
  task2AttemptId?: unknown;
  writingTestAttemptId?: unknown;
};

function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function asId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const task1AttemptId = asId(body.task1AttemptId);
    const task2AttemptId = asId(body.task2AttemptId);
    const writingTestAttemptId = asId(body.writingTestAttemptId);

    if (!task1AttemptId || !task2AttemptId) {
      return NextResponse.json(
        { error: "task1AttemptId and task2AttemptId are required" },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const attempts = await prisma.writingAttempt.findMany({
      where: {
        id: { in: [task1AttemptId, task2AttemptId] },
        userId: user.id,
      },
      select: {
        id: true,
        prompt: { select: { taskType: true } },
        evaluation: { select: { overallBand: true } },
      },
    });

    if (attempts.length !== 2) {
      return NextResponse.json(
        { error: "Writing attempts not found for user" },
        { status: 404 },
      );
    }

    const task1 = attempts.find((a) => a.id === task1AttemptId);
    const task2 = attempts.find((a) => a.id === task2AttemptId);

    if (!task1 || !task2) {
      return NextResponse.json(
        { error: "Both writing attempts are required" },
        { status: 400 },
      );
    }

    if (
      task1.prompt.taskType === "TASK_2" ||
      task2.prompt.taskType !== "TASK_2"
    ) {
      return NextResponse.json(
        {
          error:
            "Attempt mapping must be Task 1 for task1AttemptId and Task 2 for task2AttemptId",
        },
        { status: 400 },
      );
    }

    const task1Band = Number(task1.evaluation?.overallBand ?? NaN);
    const task2Band = Number(task2.evaluation?.overallBand ?? NaN);

    if (!Number.isFinite(task1Band) || !Number.isFinite(task2Band)) {
      return NextResponse.json(
        { error: "Both writing tasks must be evaluated before finalization" },
        { status: 400 },
      );
    }

    const finalOverallBand = roundToHalf((task1Band + task2Band * 2) / 3);

    if (writingTestAttemptId) {
      const writingTestAttempt = await prisma.testAttempt.findUnique({
        where: { id: writingTestAttemptId },
        select: {
          id: true,
          userId: true,
          test: { select: { module: true } },
        },
      });

      if (!writingTestAttempt || writingTestAttempt.userId !== user.id) {
        return NextResponse.json(
          { error: "writingTestAttemptId not found" },
          { status: 404 },
        );
      }

      if (writingTestAttempt.test.module !== "WRITING") {
        return NextResponse.json(
          { error: "writingTestAttemptId must belong to a WRITING test" },
          { status: 400 },
        );
      }

      await prisma.testAttempt.update({
        where: { id: writingTestAttemptId },
        data: {
          status: "EVALUATED",
          completedAt: new Date(),
          bandScore: finalOverallBand,
        },
      });
    }

    return NextResponse.json({
      finalOverallBand,
      writingTestAttemptId: writingTestAttemptId || null,
      persisted: Boolean(writingTestAttemptId),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to finalize writing result", detail },
      { status: 500 },
    );
  }
}
