import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { ensureListeningPassageAudio } from "@/lib/listening-audio";

type Body = {
  force?: unknown;
};

function parseForce(value: unknown): boolean {
  return value === true || value === "true";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { error: "passage id is required" },
        { status: 400 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const force = parseForce(body.force);

    const passage = await prisma.passage.findUnique({
      where: { id },
      include: {
        media: {
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!passage) {
      return NextResponse.json({ error: "Passage not found" }, { status: 404 });
    }

    if (passage.module !== "LISTENING") {
      return NextResponse.json(
        { error: "Audio generation is only available for listening passages" },
        { status: 400 },
      );
    }

    const result = await ensureListeningPassageAudio({
      passageId: passage.id,
      passageContent: passage.content,
      existingMedia: passage.media.map((m) => ({
        id: m.id,
        type: m.type,
        url: m.url,
        label: m.label,
        order: m.order,
        storagePath: m.storagePath,
      })),
      forceRegenerate: force,
    });

    return NextResponse.json({
      generated: result.generated,
      media: result.media,
      model: result.model,
      voice: result.voice,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate listening audio", detail },
      { status: 500 },
    );
  }
}
