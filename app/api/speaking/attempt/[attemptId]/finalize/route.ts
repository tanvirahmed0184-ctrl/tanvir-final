import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSpeakingUser } from "@/lib/speaking/auth";

type Params = { attemptId: string };

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
      select: { id: true, status: true, submittedAt: true, completedAt: true },
    });

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    if (attempt.status === "EVALUATED" || attempt.status === "ERROR") {
      return NextResponse.json(
        {
          attemptId: attempt.id,
          status: attempt.status,
          submittedAt: attempt.submittedAt?.toISOString() || null,
          completedAt: attempt.completedAt?.toISOString() || null,
          locked: true,
        },
        { status: 200 },
      );
    }

    const now = new Date();
    const updated = await prisma.speakingAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "SUBMITTED",
        submittedAt: attempt.submittedAt || now,
      },
      select: {
        id: true,
        status: true,
        submittedAt: true,
      },
    });

    return NextResponse.json({
      attemptId: updated.id,
      status: updated.status,
      submittedAt: updated.submittedAt?.toISOString() || null,
      locked: true,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to finalize speaking attempt", detail },
      { status: 500 },
    );
  }
}
