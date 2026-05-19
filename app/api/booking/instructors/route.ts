import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const instructors = await prisma.user.findMany({
      where: {
        role: "INSTRUCTOR",
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        instructorSlots: {
          where: {
            isBooked: false,
            startTime: {
              gte: new Date(),
            },
          },
          orderBy: {
            startTime: "asc",
          },
          take: 1,
          select: {
            id: true,
            startTime: true,
            endTime: true,
            timezone: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const data = instructors.map((instructor) => ({
      id: instructor.id,
      name: instructor.name,
      email: instructor.email,
      nextAvailableSlot: instructor.instructorSlots[0] ?? null,
    }));

    return NextResponse.json({ instructors: data });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch instructors", detail },
      { status: 500 },
    );
  }
}
