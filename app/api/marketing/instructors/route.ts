import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const [instructors, bookingStats] = await Promise.all([
      prisma.user.findMany({
        where: {
          role: "INSTRUCTOR",
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          instructorProfile: {
            select: {
              headline: true,
              specialties: true,
              experienceYears: true,
              avatarUrl: true,
              likesCount: true,
              commentsCount: true,
              viewsCount: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      }),
      prisma.booking.groupBy({
        by: ["instructorId"],
        where: {
          status: "COMPLETED",
        },
        _count: {
          _all: true,
        },
        _avg: {
          instructorBandScore: true,
        },
      }),
    ]);

    const statMap = new Map(bookingStats.map((s) => [s.instructorId, s]));

    const data = instructors.map((instructor) => {
      const stats = statMap.get(instructor.id);
      const completedSessions = stats?._count._all ?? 0;
      const averageBand = stats?._avg.instructorBandScore ?? null;
      const displayName =
        instructor.name?.trim() ||
        instructor.email.split("@")[0] ||
        "Instructor";
      const profile = instructor.instructorProfile;

      return {
        id: instructor.id,
        name: displayName,
        email: instructor.email,
        role:
          profile?.headline || profile?.specialties?.[0] || "IELTS Instructor",
        score:
          averageBand != null
            ? `Band ${averageBand.toFixed(1)} Mentor`
            : "Verified Mentor",
        likes: profile?.likesCount ?? Math.max(12, completedSessions * 3 + 10),
        comments:
          profile?.commentsCount ??
          Math.max(4, Math.ceil(completedSessions * 1.4)),
        views:
          profile?.viewsCount ?? Math.max(100, completedSessions * 20 + 80),
        avatarUrl: profile?.avatarUrl ?? null,
        experienceYears: profile?.experienceYears ?? null,
      };
    });

    return NextResponse.json({ instructors: data });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch public instructors", detail },
      { status: 500 },
    );
  }
}
