import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  buildSpeakingSourceConfig,
  normalizePromptSets,
  normalizePromptTemplates,
  parsePromptSetsFromSourceConfig,
  type SpeakingPromptSet,
} from "@/lib/speaking/prompt-set-config";
import { toInputJsonValue } from "@/lib/speaking/json";
import { clearSpeakingPromptRuntimeCache } from "@/lib/speaking/prompt-runtime";

type PromptInput = {
  part?: unknown;
  prompt?: unknown;
  prepSeconds?: unknown;
  targetAnswerSeconds?: unknown;
  hardLimitSeconds?: unknown;
  silencePromptSeconds?: unknown;
};

type UpsertBody = {
  testId?: unknown;
  activeSetId?: unknown;
  sets?: unknown;
  prompts?: unknown;
};

function parsePromptRows(input: unknown): PromptInput[] {
  if (!Array.isArray(input)) return [];
  return input as PromptInput[];
}

type PromptSetInput = {
  id?: unknown;
  name?: unknown;
  prompts?: unknown;
};

function parsePromptSets(input: unknown): PromptSetInput[] {
  if (!Array.isArray(input)) return [];
  return input as PromptSetInput[];
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const url = new URL(request.url);
    const testId = url.searchParams.get("testId")?.trim() || "";

    const test = testId
      ? await prisma.test.findFirst({
          where: { id: testId, module: "SPEAKING" },
          select: {
            id: true,
            title: true,
            isActive: true,
            sourceConfig: true,
            updatedAt: true,
          },
        })
      : await prisma.test.findFirst({
          where: { module: "SPEAKING", isActive: true },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            title: true,
            isActive: true,
            sourceConfig: true,
            updatedAt: true,
          },
        });

    if (!test) {
      return NextResponse.json({ error: "Speaking test not found" }, { status: 404 });
    }

    const parsed = parsePromptSetsFromSourceConfig(test.sourceConfig);

    return NextResponse.json({
      test: {
        id: test.id,
        title: test.title,
        isActive: test.isActive,
        updatedAt: test.updatedAt.toISOString(),
      },
      activeSetId: parsed.activeSetId,
      sets: parsed.sets,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to load speaking prompt set", detail },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = (await request.json().catch(() => ({}))) as UpsertBody;
    const testId = typeof body.testId === "string" ? body.testId.trim() : "";
    if (!testId) {
      return NextResponse.json({ error: "testId is required" }, { status: 400 });
    }

    let sets: SpeakingPromptSet[] = [];
    if (body.sets !== undefined) {
      sets = normalizePromptSets(parsePromptSets(body.sets));
    } else {
      const rawRows = parsePromptRows(body.prompts);
      const prompts = normalizePromptTemplates(rawRows);
      if (prompts.length > 0) {
        sets = [{ id: "default-set", name: "Default Set", prompts }];
      }
    }

    if (sets.length === 0) {
      return NextResponse.json(
        { error: "At least one speaking prompt set is required" },
        { status: 400 },
      );
    }

    const invalidSet = sets.find((set) => set.prompts.length < 5);
    if (invalidSet) {
      return NextResponse.json(
        { error: `Set "${invalidSet.name}" must have at least 5 prompts` },
        { status: 400 },
      );
    }

    const existing = await prisma.test.findFirst({
      where: { id: testId, module: "SPEAKING" },
      select: { id: true, sourceConfig: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Speaking test not found" }, { status: 404 });
    }

    const activeSetId =
      typeof body.activeSetId === "string" ? body.activeSetId.trim() : null;
    const sourceConfig = buildSpeakingSourceConfig(
      existing.sourceConfig,
      sets,
      activeSetId,
    );
    const parsed = parsePromptSetsFromSourceConfig(sourceConfig);
    const activeSet =
      parsed.sets.find((set) => set.id === parsed.activeSetId) ||
      parsed.sets[0] ||
      null;
    const activePromptCount = activeSet?.prompts.length || sets[0].prompts.length;
    const updated = await prisma.test.update({
      where: { id: existing.id },
      data: {
        sourceConfig: toInputJsonValue(sourceConfig),
        totalQuestions: activePromptCount,
      },
      select: {
        id: true,
        title: true,
        isActive: true,
        totalQuestions: true,
        updatedAt: true,
      },
    });

    clearSpeakingPromptRuntimeCache(existing.id);

    return NextResponse.json({
      test: {
        id: updated.id,
        title: updated.title,
        isActive: updated.isActive,
        totalQuestions: updated.totalQuestions,
        updatedAt: updated.updatedAt.toISOString(),
      },
      activeSetId: parsed.activeSetId,
      sets: parsed.sets,
      saved: true,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to save speaking prompt set", detail },
      { status: 500 },
    );
  }
}
