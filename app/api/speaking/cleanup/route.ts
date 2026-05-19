import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { deleteSpeakingAudio } from "@/lib/speaking/storage";

function parseRetentionDays(): number {
  const raw = Number(process.env.SPEAKING_RECORDING_RETENTION_DAYS || 30);
  if (!Number.isFinite(raw)) return 30;
  return Math.max(1, Math.min(365, Math.round(raw)));
}

function isCleanupAuthorized(request: Request): boolean {
  const configured = process.env.SPEAKING_CLEANUP_SECRET;
  if (!configured) {
    return process.env.NODE_ENV !== "production";
  }
  const headerToken =
    request.headers.get("x-cleanup-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  return headerToken === configured;
}

export async function POST(request: Request) {
  try {
    if (!isCleanupAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized cleanup request" }, { status: 401 });
    }

    const retentionDays = parseRetentionDays();
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const staleRecordings = await prisma.speakingRecording.findMany({
      where: {
        createdAt: { lt: cutoff },
      },
      select: {
        id: true,
        storagePath: true,
        publicUrl: true,
      },
      take: 200,
      orderBy: { createdAt: "asc" },
    });

    let deletedFiles = 0;
    let deletedRows = 0;

    for (const recording of staleRecordings) {
      try {
        await deleteSpeakingAudio(recording.storagePath);
        deletedFiles += 1;
      } catch {
        // Keep row deletion independent from file cleanup issues.
      }
    }

    if (staleRecordings.length > 0) {
      const ids = staleRecordings.map((x) => x.id);
      const removed = await prisma.speakingRecording.deleteMany({
        where: { id: { in: ids } },
      });
      deletedRows = removed.count;
    }

    return NextResponse.json({
      retentionDays,
      scanned: staleRecordings.length,
      deletedRows,
      deletedFiles,
      cutoffIso: cutoff.toISOString(),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to cleanup speaking recordings", detail },
      { status: 500 },
    );
  }
}
