import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const teachingExperience = String(body.teachingExperience || "").trim();
    const ieltsExpertise = String(body.ieltsExpertise || "").trim();
    const motivation = String(body.motivation || "").trim();

    if (!name || !email || !teachingExperience || !ieltsExpertise || !motivation) {
      return NextResponse.json(
        { error: "Name, email, experience, IELTS expertise, and motivation are required." },
        { status: 400 },
      );
    }

    const application = await prisma.instructorApplication.create({
      data: {
        name,
        email,
        phone: body.phone ? String(body.phone) : null,
        teachingExperience,
        ieltsExpertise,
        motivation,
        education: body.education ? String(body.education) : null,
        specialties: Array.isArray(body.specialties)
          ? body.specialties.map((item) => String(item)).filter(Boolean)
          : [],
      },
    });

    return NextResponse.json({ application });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to submit instructor application", detail },
      { status: 500 },
    );
  }
}
