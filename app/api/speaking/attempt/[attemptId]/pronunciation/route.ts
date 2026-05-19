import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSpeakingUser } from "@/lib/speaking/auth";
import { toInputJsonValue } from "@/lib/speaking/json";
import { assessPronunciationWithAzure } from "@/lib/speaking/pronunciation";

type Params = { attemptId: string };

function parseText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(
  request: Request,
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

    const form = await request.formData();
    const turnId = parseText(form.get("turnId"));
    const transcript = parseText(form.get("transcript"));
    const audioValue = form.get("audio");

    if (!turnId || !(audioValue instanceof File)) {
      return NextResponse.json(
        { error: "turnId and audio file are required" },
        { status: 400 },
      );
    }
    if (audioValue.size <= 0) {
      return NextResponse.json(
        { error: "Audio file is empty" },
        { status: 400 },
      );
    }
    if (audioValue.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Audio file exceeds 20MB limit" },
        { status: 413 },
      );
    }

    const turn = await prisma.speakingTurn.findFirst({
      where: {
        id: turnId,
        attemptId,
        attempt: { userId: auth.userId },
      },
      select: { id: true, metadata: true },
    });

    if (!turn) {
      return NextResponse.json({ error: "Turn not found" }, { status: 404 });
    }

    const assessed = await assessPronunciationWithAzure({
      audio: audioValue,
      transcript,
    });

    const priorMeta =
      turn.metadata && typeof turn.metadata === "object"
        ? (turn.metadata as Record<string, unknown>)
        : {};

    const mergedMetaJson = toInputJsonValue({
      ...priorMeta,
      pronunciation: {
        provider: assessed.provider,
        metrics: assessed.metrics,
        raw: assessed.raw,
      },
    });

    await prisma.speakingTurn.update({
      where: { id: turn.id },
      data: {
        metadata: mergedMetaJson,
      },
    });

    return NextResponse.json({
      provider: assessed.provider,
      metrics: assessed.metrics,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed pronunciation assessment", detail },
      { status: 500 },
    );
  }
}
