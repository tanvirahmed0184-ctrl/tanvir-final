import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const applications = await prisma.instructorApplication.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ applications });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(body.id || "");
  const status = String(body.status || "");
  const adminNotes = body.adminNotes == null ? null : String(body.adminNotes);

  if (!id || !["APPROVED", "REJECTED", "PENDING"].includes(status)) {
    return NextResponse.json({ error: "Invalid application update" }, { status: 400 });
  }

  const application = await prisma.instructorApplication.update({
    where: { id },
    data: {
      status,
      adminNotes,
      reviewedAt: status === "PENDING" ? null : new Date(),
      reviewedById: status === "PENDING" ? null : auth.userId,
    },
  });

  if (status === "APPROVED") {
    const user = await prisma.user.findUnique({
      where: { email: application.email },
      select: { id: true },
    });
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: "INSTRUCTOR", isActive: true },
      });
      await prisma.instructorProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          headline: "IELTS Instructor",
          bio: application.motivation,
          history: application.teachingExperience,
          specialties: application.specialties,
        },
        update: {
          specialties: application.specialties,
        },
      });
    }
  }

  return NextResponse.json({ application });
}
