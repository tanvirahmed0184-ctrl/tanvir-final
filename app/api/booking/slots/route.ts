import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SlotBody = {
  startTime?: unknown;
  endTime?: unknown;
  timezone?: unknown;
};

async function getCurrentUserWithRole() {
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
    select: {
      id: true,
      role: true,
    },
  });

  if (!user) {
    return { error: "User not found", status: 404 as const };
  }

  return { user };
}

export async function GET() {
  try {
    const slots = await prisma.instructorSlot.findMany({
      where: {
        isBooked: false,
        startTime: {
          gte: new Date(),
        },
      },
      orderBy: [{ startTime: "asc" }],
      include: {
        instructor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ slots });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch slots", detail },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const current = await getCurrentUserWithRole();
    if ("error" in current) {
      return NextResponse.json(
        { error: current.error },
        { status: current.status },
      );
    }

    if (current.user.role !== "INSTRUCTOR" && current.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only instructors can create slots" },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as SlotBody;
    const timezone =
      typeof body.timezone === "string" && body.timezone.trim().length > 0
        ? body.timezone.trim()
        : "UTC";

    const start = new Date(String(body.startTime ?? ""));
    const end = new Date(String(body.endTime ?? ""));

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return NextResponse.json(
        { error: "Invalid startTime or endTime" },
        { status: 400 },
      );
    }

    if (end <= start) {
      return NextResponse.json(
        { error: "endTime must be after startTime" },
        { status: 400 },
      );
    }

    const slot = await prisma.instructorSlot.create({
      data: {
        instructorId: current.user.id,
        startTime: start,
        endTime: end,
        timezone,
      },
    });

    return NextResponse.json({ slot }, { status: 201 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create slot", detail },
      { status: 500 },
    );
  }
}
