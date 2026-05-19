import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SessionStatus = "UPCOMING" | "COMPLETED" | "CANCELLED";

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

function mapStatus(
  rawStatus: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED",
  endTime: Date,
): SessionStatus {
  if (rawStatus === "CANCELLED") return "CANCELLED";
  if (rawStatus === "COMPLETED") return "COMPLETED";
  if (endTime.getTime() < Date.now()) return "COMPLETED";
  return "UPCOMING";
}

function inferFocusArea(notes: string | null): string {
  if (!notes) return "Speaking feedback session";
  const cleaned = notes.trim();
  if (!cleaned) return "Speaking feedback session";
  if (cleaned.length <= 80) return cleaned;
  return `${cleaned.slice(0, 77)}...`;
}

export async function GET() {
  try {
    const auth = await requireInstructorOrAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const where =
      auth.user.role === "INSTRUCTOR" ? { instructorId: auth.user.id } : {};

    const bookings = await prisma.booking.findMany({
      where,
      orderBy: {
        slot: {
          startTime: "asc",
        },
      },
      include: {
        student: {
          select: {
            name: true,
            email: true,
          },
        },
        slot: {
          select: {
            startTime: true,
            endTime: true,
            timezone: true,
          },
        },
      },
      take: 200,
    });

    const sessions = bookings.map((booking) => ({
      id: booking.id,
      studentName: booking.student.name || booking.student.email,
      studentEmail: booking.student.email,
      startTime: booking.slot.startTime.toISOString(),
      endTime: booking.slot.endTime.toISOString(),
      timezone: booking.slot.timezone,
      meetLink: booking.meetLink,
      status: mapStatus(booking.status, booking.slot.endTime),
      focusArea: inferFocusArea(booking.notes),
      notes: booking.notes || undefined,
    }));

    return NextResponse.json({ sessions });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch instructor sessions", detail },
      { status: 500 },
    );
  }
}
