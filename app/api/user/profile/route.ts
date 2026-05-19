import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function parseExamDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();

    if (error || !authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const data: {
      targetBand?: number | null;
      currentBand?: number | null;
      examDate?: Date | null;
      studyProfession?: string | null;
      examReason?: string | null;
      onboardingCompleted?: boolean;
      timezone?: string;
    } = {};

    if ("targetBand" in body) {
      data.targetBand =
        body.targetBand === null || body.targetBand === ""
          ? null
          : Number(body.targetBand);
      if (
        data.targetBand !== null &&
        (Number.isNaN(data.targetBand) || data.targetBand < 0)
      ) {
        return NextResponse.json(
          { error: "Invalid targetBand value" },
          { status: 400 },
        );
      }
    }

    if ("currentBand" in body) {
      data.currentBand =
        body.currentBand === null || body.currentBand === ""
          ? null
          : Number(body.currentBand);
      if (
        data.currentBand !== null &&
        (Number.isNaN(data.currentBand) || data.currentBand < 0)
      ) {
        return NextResponse.json(
          { error: "Invalid currentBand value" },
          { status: 400 },
        );
      }
    }

    if ("examDate" in body) {
      const parsed = parseExamDate(body.examDate);
      if (parsed === undefined && body.examDate !== undefined) {
        return NextResponse.json(
          { error: "Invalid examDate value" },
          { status: 400 },
        );
      }
      data.examDate = parsed;
    }

    if ("studyProfession" in body) {
      data.studyProfession =
        body.studyProfession === null ? null : String(body.studyProfession);
    }

    if ("examReason" in body) {
      data.examReason =
        body.examReason === null ? null : String(body.examReason);
    }

    if ("onboardingCompleted" in body) {
      data.onboardingCompleted = Boolean(body.onboardingCompleted);
    }

    if ("timezone" in body && body.timezone != null) {
      data.timezone = String(body.timezone);
    }

    const profile = await prisma.userProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        ...data,
      },
      update: data,
    });

    return NextResponse.json({ profile });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to update profile", detail: message },
      { status: 500 },
    );
  }
}
