import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type BookingViewStatus = "UPCOMING" | "COMPLETED" | "CANCELLED";

function toViewStatus(
  raw: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED",
  endTime: Date,
): BookingViewStatus {
  if (raw === "CANCELLED") return "CANCELLED";
  if (raw === "COMPLETED") return "COMPLETED";
  if (endTime.getTime() < Date.now()) return "COMPLETED";
  return "UPCOMING";
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const bookings = await prisma.booking.findMany({
      where: { studentId: user.id },
      include: {
        instructor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        slot: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            timezone: true,
          },
        },
      },
      orderBy: {
        slot: {
          startTime: "asc",
        },
      },
      take: 200,
    });

    const payload = bookings.map((b) => ({
      id: b.id,
      status: toViewStatus(b.status, b.slot.endTime),
      meetLink: b.meetLink,
      notes: b.notes,
      instructor: {
        id: b.instructor.id,
        name: b.instructor.name || b.instructor.email,
        email: b.instructor.email,
      },
      slot: {
        id: b.slot.id,
        startTime: b.slot.startTime.toISOString(),
        endTime: b.slot.endTime.toISOString(),
        timezone: b.slot.timezone,
      },
      createdAt: b.createdAt.toISOString(),
    }));

    return NextResponse.json({ bookings: payload });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch student bookings", detail },
      { status: 500 },
    );
  }
}
