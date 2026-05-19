import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type RouteParams = {
  params: Promise<{
    instructorId: string;
  }>;
};

export async function GET(_: Request, context: RouteParams) {
  try {
    const { instructorId } = await context.params;

    const user = await prisma.user.findFirst({
      where: {
        id: instructorId,
        role: "INSTRUCTOR",
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Instructor not found" },
        { status: 404 },
      );
    }

    const [profile, completedStats, completedSessions] = await Promise.all([
      prisma.instructorProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          viewsCount: 1,
        },
        update: {
          viewsCount: {
            increment: 1,
          },
        },
      }),
      prisma.booking.aggregate({
        where: {
          instructorId: user.id,
          status: "COMPLETED",
        },
        _avg: {
          instructorBandScore: true,
        },
      }),
      prisma.booking.count({
        where: {
          instructorId: user.id,
          status: "COMPLETED",
        },
      }),
    ]);

    const startedAtYear = user.createdAt.getFullYear();

    return NextResponse.json({
      instructor: {
        id: user.id,
        name: user.name?.trim() || user.email.split("@")[0] || "Instructor",
        email: user.email,
        headline: profile.headline || "IELTS Instructor",
        bio:
          profile.bio ||
          "Dedicated IELTS mentor focused on practical score improvement through structured feedback and targeted strategy.",
        history:
          profile.history ||
          `Started mentoring IELTS learners in ${startedAtYear} and has been supporting students with exam-focused coaching since then.`,
        achievements: profile.achievements.length
          ? profile.achievements
          : [
              "Guided learners through mock-test based preparation",
              "Focused speaking and writing correction workflow",
              "Consistent student follow-up with actionable feedback",
            ],
        specialties: profile.specialties.length
          ? profile.specialties
          : ["Speaking", "Writing", "Band Strategy"],
        experienceYears: profile.experienceYears,
        avatarUrl: profile.avatarUrl,
        likes: profile.likesCount,
        comments: profile.commentsCount,
        views: profile.viewsCount,
        completedSessions,
        averageBand: completedStats._avg.instructorBandScore,
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch instructor details", detail },
      { status: 500 },
    );
  }
}
