import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  slotId?: unknown;
};

function hasGoogleCalendarConfig() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN,
  );
}

async function maybeCreateMeetLink(bookingId: string): Promise<string | null> {
  if (!hasGoogleCalendarConfig()) return null;
  return `https://meet.google.com/ielts-flow-${bookingId.slice(0, 8)}`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const slotId = typeof body.slotId === "string" ? body.slotId : "";

    if (!slotId) {
      return NextResponse.json(
        { error: "slotId is required" },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const student = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      select: { id: true, role: true },
    });

    if (!student) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const hasActiveBooking = await prisma.booking.findFirst({
      where: {
        studentId: student.id,
        status: {
          in: ["PENDING", "CONFIRMED"],
        },
      },
      select: { id: true },
    });

    if (hasActiveBooking) {
      return NextResponse.json(
        { error: "You already have an active booking" },
        { status: 409 },
      );
    }

    const txResult = await prisma.$transaction(async (tx) => {
      const slot = await tx.instructorSlot.findUnique({
        where: { id: slotId },
        select: {
          id: true,
          instructorId: true,
          isBooked: true,
          startTime: true,
        },
      });

      if (!slot) {
        return { error: "Slot not found", status: 404 as const };
      }

      if (slot.isBooked) {
        return { error: "Slot already booked", status: 409 as const };
      }

      if (slot.startTime <= new Date()) {
        return { error: "Slot must be in the future", status: 400 as const };
      }

      const slotUpdated = await tx.instructorSlot.updateMany({
        where: {
          id: slot.id,
          isBooked: false,
        },
        data: {
          isBooked: true,
        },
      });

      if (slotUpdated.count !== 1) {
        return { error: "Slot no longer available", status: 409 as const };
      }

      const booking = await tx.booking.create({
        data: {
          studentId: student.id,
          instructorId: slot.instructorId,
          slotId: slot.id,
          status: "CONFIRMED",
        },
        select: {
          id: true,
        },
      });

      return { bookingId: booking.id };
    });

    if ("error" in txResult) {
      return NextResponse.json(
        { error: txResult.error },
        { status: txResult.status },
      );
    }

    const meetLink = await maybeCreateMeetLink(txResult.bookingId);

    if (meetLink) {
      await prisma.booking.update({
        where: { id: txResult.bookingId },
        data: { meetLink },
      });
    }

    return NextResponse.json({ bookingId: txResult.bookingId, meetLink });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create booking", detail },
      { status: 500 },
    );
  }
}
