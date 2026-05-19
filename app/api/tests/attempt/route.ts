import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  testId?: unknown;
  mode?: unknown;
  selectedParts?: unknown;
  timeLimit?: unknown;
};

type ListeningAudioMode = "single_full_audio" | "sequential_section_audio";

function normalizeListeningAudioMode(value: unknown): ListeningAudioMode {
  return value === "single_full_audio"
    ? "single_full_audio"
    : "sequential_section_audio";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const testId = typeof body.testId === "string" ? body.testId : "";
    const mode = typeof body.mode === "string" ? body.mode : "simulation";
    const selectedParts = asStringArray(body.selectedParts);
    const timeLimit = asText(body.timeLimit);

    if (!testId) {
      return NextResponse.json(
        { error: "testId is required" },
        { status: 400 },
      );
    }

    if (testId.startsWith("demo-")) {
      return NextResponse.json({ attemptId: `demo-attempt-${Date.now()}` });
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!authUser.email) {
      return NextResponse.json(
        { error: "Authenticated user email not found" },
        { status: 400 },
      );
    }

    const user = await prisma.user.upsert({
      where: { supabaseId: authUser.id },
      create: {
        supabaseId: authUser.id,
        email: authUser.email,
        name:
          typeof authUser.user_metadata?.name === "string"
            ? (authUser.user_metadata.name as string)
            : null,
        role: "STUDENT",
        isActive: true,
        lastLoginAt: new Date(),
      },
      update: {
        email: authUser.email,
        lastLoginAt: new Date(),
      },
      include: {
        subscription: true,
      },
    });

    await prisma.userProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, onboardingCompleted: false },
      update: {},
    });

    const subscription = await prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        plan: "free",
        status: "active",
      },
      update: {},
    });

    const test = await prisma.test.findUnique({
      where: { id: testId },
      select: {
        id: true,
        isPractice: true,
        module: true,
        durationMins: true,
        sourceConfig: true,
      },
    });

    if (!test) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }

    const sourceConfig =
      test.sourceConfig && typeof test.sourceConfig === "object"
        ? (test.sourceConfig as Record<string, unknown>)
        : {};
    const listeningAudioMode =
      test.module === "LISTENING"
        ? normalizeListeningAudioMode(sourceConfig.listeningAudioMode)
        : null;

    if (!test.isPractice && subscription.plan === "free") {
      return NextResponse.json(
        { error: "Upgrade required for full simulation tests" },
        { status: 403 },
      );
    }

    if (test.module === "WRITING") {
      const config = (test.sourceConfig || {}) as {
        task1PromptId?: unknown;
        task2PromptId?: unknown;
        task1ImageUrl?: unknown;
        task2ImageUrl?: unknown;
      };
      const task1PromptId =
        typeof config.task1PromptId === "string" ? config.task1PromptId : "";
      const task2PromptId =
        typeof config.task2PromptId === "string" ? config.task2PromptId : "";
      const task1ImageUrl =
        typeof config.task1ImageUrl === "string" ? config.task1ImageUrl : "";
      const task2ImageUrl =
        typeof config.task2ImageUrl === "string" ? config.task2ImageUrl : "";

      let resolvedTask1PromptId = task1PromptId;
      let resolvedTask2PromptId = task2PromptId;

      if (!resolvedTask1PromptId || !resolvedTask2PromptId) {
        const fallbackPrompts = await prisma.writingPrompt.findMany({
          where: {
            isActive: true,
          },
          orderBy: [{ createdAt: "desc" }],
          select: { id: true, taskType: true },
        });

        if (!resolvedTask1PromptId) {
          resolvedTask1PromptId =
            fallbackPrompts.find((p) => p.taskType !== "TASK_2")?.id || "";
        }

        if (!resolvedTask2PromptId) {
          resolvedTask2PromptId =
            fallbackPrompts.find((p) => p.taskType === "TASK_2")?.id || "";
        }
      }

      if (!resolvedTask1PromptId || !resolvedTask2PromptId) {
        return NextResponse.json(
          {
            error:
              "Both active writing prompts (Task 1 and Task 2) are required",
          },
          { status: 400 },
        );
      }

      const { task1Attempt, task2Attempt, writingTestAttempt } =
        await prisma.$transaction(async (tx) => {
          const task1Attempt = await tx.writingAttempt.create({
            data: {
              userId: user.id,
              promptId: resolvedTask1PromptId,
              response: "",
              wordCount: 0,
              status: "IN_PROGRESS",
            },
            select: { id: true },
          });

          const task2Attempt = await tx.writingAttempt.create({
            data: {
              userId: user.id,
              promptId: resolvedTask2PromptId,
              response: "",
              wordCount: 0,
              status: "IN_PROGRESS",
            },
            select: { id: true },
          });

          const writingTestAttempt = await tx.testAttempt.create({
            data: {
              userId: user.id,
              testId: test.id,
              mode,
              status: "IN_PROGRESS",
            },
            select: { id: true },
          });

          return { task1Attempt, task2Attempt, writingTestAttempt };
        });

      return NextResponse.json({
        attemptId: task1Attempt.id,
        module: "WRITING",
        writingDurationMins: test.durationMins,
        task1PromptId: resolvedTask1PromptId,
        task2PromptId: resolvedTask2PromptId,
        task1ImageUrl: task1ImageUrl || null,
        task2ImageUrl: task2ImageUrl || null,
        task1AttemptId: task1Attempt.id,
        task2AttemptId: task2Attempt.id,
        writingTestAttemptId: writingTestAttempt.id,
      });
    }

    const attempt = await prisma.testAttempt.create({
      data: {
        userId: user.id,
        testId: test.id,
        mode,
      },
      select: {
        id: true,
      },
    });

    return NextResponse.json({
      attemptId: attempt.id,
      mode,
      durationMins: test.durationMins,
      listeningAudioMode,
      selectedParts,
      timeLimit: timeLimit || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create attempt", detail: message },
      { status: 500 },
    );
  }
}
