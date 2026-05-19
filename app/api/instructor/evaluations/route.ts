import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type EvalItem = {
  id: string;
  attemptId: string;
  studentName: string;
  studentEmail: string;
  module: "SPEAKING" | "WRITING";
  overallBand: number;
  createdAt: string;
  strengths: string[];
  weaknesses: string[];
  summary: string;
  status: "READY" | "REVIEWED";
};

async function requireInstructorOrAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();

  if (error || !authUser) {
    return { error: "Unauthorized", status: 401 as const };
  }

  const user = await prisma.user.findUnique({
    where: { supabaseId: authUser.id },
    select: { id: true, role: true },
  });

  if (!user) {
    return { error: "User not found", status: 404 as const };
  }

  if (
    user.role !== "INSTRUCTOR" &&
    user.role !== "ADMIN" &&
    user.role !== "SUPER_ADMIN"
  ) {
    return { error: "Forbidden", status: 403 as const };
  }

  return { user };
}

function safeText(value: string | null | undefined, fallback: string) {
  const v = (value || "").trim();
  return v || fallback;
}

export async function GET() {
  try {
    const auth = await requireInstructorOrAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const [writingRows, speakingRows] = await Promise.all([
      prisma.testAttempt.findMany({
        where: {
          status: "EVALUATED",
          bandScore: { not: null },
          test: { module: "WRITING" },
        },
        orderBy: { completedAt: "desc" },
        take: 120,
        select: {
          id: true,
          status: true,
          bandScore: true,
          completedAt: true,
          startedAt: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.booking.findMany({
        where:
          auth.user.role === "INSTRUCTOR"
            ? { instructorId: auth.user.id }
            : {
                instructorBandScore: {
                  not: null,
                },
              },
        orderBy: { createdAt: "desc" },
        take: 120,
        include: {
          student: {
            select: {
              name: true,
              email: true,
            },
          },
          slot: {
            select: {
              endTime: true,
            },
          },
        },
      }),
    ]);

    const writingItems: EvalItem[] = writingRows.map((row) => ({
      id: `writing-${row.id}`,
      attemptId: row.id,
      studentName: safeText(row.user.name, row.user.email),
      studentEmail: row.user.email,
      module: "WRITING",
      overallBand: Number((row.bandScore ?? 0).toFixed(1)),
      createdAt: (row.completedAt || row.startedAt).toISOString(),
      strengths: ["Final weighted writing band finalized"],
      weaknesses: ["Open item-level feedback in writing attempt details"],
      summary:
        "Final writing band is persisted from Task 1 and Task 2 weighted evaluation.",
      status: row.status === "EVALUATED" ? "REVIEWED" : "READY",
    }));

    const speakingItems: EvalItem[] = speakingRows
      .filter((row) => row.instructorBandScore != null)
      .map((row) => ({
        id: `booking-${row.id}`,
        attemptId: row.id,
        studentName: safeText(row.student.name, row.student.email),
        studentEmail: row.student.email,
        module: "SPEAKING",
        overallBand: Number((row.instructorBandScore ?? 0).toFixed(1)),
        createdAt: row.createdAt.toISOString(),
        strengths: ["Interactive communication", "Task engagement"],
        weaknesses: ["Improve lexical variety"],
        summary: safeText(
          row.notes,
          "Speaking session feedback captured by instructor for follow-up practice.",
        ),
        status:
          row.status === "CANCELLED"
            ? "READY"
            : row.slot.endTime.getTime() < Date.now()
              ? "REVIEWED"
              : "READY",
      }));

    const evaluations = [...writingItems, ...speakingItems]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 200);

    return NextResponse.json({ evaluations });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch instructor evaluations", detail },
      { status: 500 },
    );
  }
}
