import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSpeakingUser } from "@/lib/speaking/auth";
import { storeSpeakingAudio } from "@/lib/speaking/storage";

type Params = { attemptId: string };

function parseText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseDurationMs(value: FormDataEntryValue | null): number | null {
  const n = Number(parseText(value));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(1, Math.min(180_000, Math.round(n)));
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
    const durationMs = parseDurationMs(form.get("durationMs"));
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
      select: { id: true },
    });

    if (!turn) {
      return NextResponse.json({ error: "Turn not found" }, { status: 404 });
    }

    const bytes = Buffer.from(await audioValue.arrayBuffer());
    const mimeType = audioValue.type || "audio/webm";
    const stored = await storeSpeakingAudio({
      attemptId,
      turnId,
      bytes,
      mimeType,
    });

    const recording = await prisma.speakingRecording.upsert({
      where: { turnId },
      create: {
        turnId,
        storagePath: stored.storagePath,
        publicUrl: stored.publicUrl,
        mimeType,
        durationMs,
        sizeBytes: bytes.length,
      },
      update: {
        storagePath: stored.storagePath,
        publicUrl: stored.publicUrl,
        mimeType,
        durationMs,
        sizeBytes: bytes.length,
      },
      select: {
        id: true,
        publicUrl: true,
        storagePath: true,
        mimeType: true,
        durationMs: true,
        sizeBytes: true,
      },
    });

    return NextResponse.json({ recording });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to save speaking recording", detail },
      { status: 500 },
    );
  }
}
