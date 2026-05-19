import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  promptId?: unknown;
  mode?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const promptId = typeof body.promptId === "string" ? body.promptId : "";
    const mode = typeof body.mode === "string" ? body.mode : "practice";

    if (!promptId) {
      return NextResponse.json(
        { error: "promptId is required" },
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

    if (!authUser.email) {
      return NextResponse.json(
        { error: "Authenticated user email not found" },
        { status: 400 },
      );
    }

    const user = await prisma.user.upsert({
      where: { supabaseId: authUser.id },
      create: {
        supabaseId: authUser.id,
        email: authUser.email,
        name:
          typeof authUser.user_metadata?.name === "string"
            ? (authUser.user_metadata.name as string)
            : null,
        role: "STUDENT",
      },
      update: {
        email: authUser.email,
        lastLoginAt: new Date(),
      },
      select: { id: true },
    });

    const prompt = await prisma.writingPrompt.findUnique({
      where: { id: promptId },
      select: { id: true, isActive: true },
    });

    if (!prompt || !prompt.isActive) {
      return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
    }

    const attempt = await prisma.writingAttempt.create({
      data: {
        userId: user.id,
        promptId: prompt.id,
        response: "",
        wordCount: 0,
      },
      select: { id: true },
    });

    return NextResponse.json({ attemptId: attempt.id, mode });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create writing attempt", detail },
      { status: 500 },
    );
  }
}
