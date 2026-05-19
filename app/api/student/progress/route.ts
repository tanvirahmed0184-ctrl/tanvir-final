import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AttemptItem = {
  id: string;
  date: string;
  module: "READING" | "LISTENING" | "WRITING" | "SPEAKING";
  band: number;
  status: string;
  source: "test_attempt" | "booking" | "ai_speaking";
  reviewPath: string;
};

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();

    if (error || !authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const [testAttempts, speakingBookings, aiSpeakingAttempts] = await Promise.all([
      prisma.testAttempt.findMany({
        where: {
          userId: user.id,
          status: "EVALUATED",
          bandScore: { not: null },
        },
        orderBy: [{ completedAt: "desc" }, { startedAt: "desc" }],
        take: 60,
        select: {
          id: true,
          status: true,
          bandScore: true,
          startedAt: true,
          completedAt: true,
          test: {
            select: { module: true },
          },
        },
      }),
      prisma.booking.findMany({
        where: {
          studentId: user.id,
          instructorBandScore: { not: null },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          status: true,
          instructorBandScore: true,
          createdAt: true,
        },
      }),
      prisma.speakingAttempt.findMany({
        where: {
          userId: user.id,
          status: "EVALUATED",
          evaluation: {
            isNot: null,
          },
        },
        orderBy: [{ completedAt: "desc" }, { startedAt: "desc" }],
        take: 60,
        select: {
          id: true,
          status: true,
          startedAt: true,
          completedAt: true,
          evaluation: {
            select: {
              overallBand: true,
            },
          },
        },
      }),
    ]);

    const moduleAttempts: AttemptItem[] = testAttempts.map((row) => ({
      id: row.id,
      date: (row.completedAt || row.startedAt).toISOString().slice(0, 10),
      module: row.test.module,
      band: Number((row.bandScore || 0).toFixed(1)),
      status: row.status,
      source: "test_attempt",
      reviewPath: "/dashboard/student/overview",
    }));

    const speakingAttempts: AttemptItem[] = speakingBookings.map((row) => ({
      id: `booking-${row.id}`,
      date: row.createdAt.toISOString().slice(0, 10),
      module: "SPEAKING",
      band: Number((row.instructorBandScore || 0).toFixed(1)),
      status: row.status,
      source: "booking",
      reviewPath: "/dashboard/student/overview",
    }));

    const aiSpeakingRows: AttemptItem[] = aiSpeakingAttempts.map((row) => ({
      id: row.id,
      date: (row.completedAt || row.startedAt).toISOString().slice(0, 10),
      module: "SPEAKING",
      band: Number((row.evaluation?.overallBand || 0).toFixed(1)),
      status: row.status,
      source: "ai_speaking",
      reviewPath: `/dashboard/student/speaking/${row.id}`,
    }));

    const attempts = [...moduleAttempts, ...speakingAttempts, ...aiSpeakingRows]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 80);

    return NextResponse.json({ attempts });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to load student progress", detail },
      { status: 500 },
    );
  }
}
