import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

async function requireAdmin() {
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

  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    return { error: "Forbidden", status: 403 as const };
  }

  return { user };
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const now = new Date();
    const todayStart = startOfDay(now);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 6);

    const [
      totalUsers,
      testsToday,
      weeklyBands,
      activeSubscriptions,
      last7DayAttempts,
      recentAttempts,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.testAttempt.count({
        where: {
          startedAt: {
            gte: todayStart,
            lt: tomorrowStart,
          },
        },
      }),
      prisma.testAttempt.findMany({
        where: {
          completedAt: {
            gte: weekStart,
          },
          bandScore: {
            not: null,
          },
        },
        select: {
          bandScore: true,
        },
      }),
      prisma.subscription.count({
        where: {
          status: {
            in: ["active", "trialing"],
          },
        },
      }),
      prisma.testAttempt.findMany({
        where: {
          startedAt: {
            gte: weekStart,
            lt: tomorrowStart,
          },
        },
        select: {
          startedAt: true,
        },
      }),
      prisma.testAttempt.findMany({
        orderBy: {
          startedAt: "desc",
        },
        take: 10,
        select: {
          id: true,
          status: true,
          bandScore: true,
          startedAt: true,
          test: {
            select: {
              module: true,
            },
          },
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      }),
    ]);

    const dayBuckets = Array.from({ length: 7 }).map((_, index) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + index);
      return {
        key: startOfDay(d).toISOString().slice(0, 10),
        day: formatDayLabel(d),
        count: 0,
      };
    });

    const bucketMap = new Map(dayBuckets.map((b) => [b.key, b]));

    for (const row of last7DayAttempts) {
      const key = startOfDay(new Date(row.startedAt))
        .toISOString()
        .slice(0, 10);
      const bucket = bucketMap.get(key);
      if (bucket) bucket.count += 1;
    }

    const avgBandThisWeek = weeklyBands.length
      ? weeklyBands.reduce((sum, row) => sum + (row.bandScore ?? 0), 0) /
        weeklyBands.length
      : 0;

    const normalizedRecentAttempts = recentAttempts.map((row) => ({
      id: row.id,
      module: row.test.module,
      userName: row.user.name || row.user.email,
      bandScore: row.bandScore ?? 0,
      status: row.status,
      createdAt: row.startedAt.toISOString().slice(0, 16).replace("T", " "),
    }));

    return NextResponse.json({
      totalUsers,
      testsToday,
      avgBandThisWeek: Number(avgBandThisWeek.toFixed(1)),
      activeSubscriptions,
      testsByDay: dayBuckets.map(({ day, count }) => ({ day, count })),
      recentAttempts: normalizedRecentAttempts,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch admin analytics", detail },
      { status: 500 },
    );
  }
}
