import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ModuleInput = "LISTENING" | "READING" | "WRITING" | "SPEAKING";
type VariantInput = "ACADEMIC" | "GENERAL";
type DifficultyInput = "EASY" | "MEDIUM" | "HARD";

type PatchBody = {
  title?: unknown;
  description?: unknown;
  module?: unknown;
  variant?: unknown;
  difficulty?: unknown;
  durationMins?: unknown;
  isPractice?: unknown;
  isActive?: unknown;
};

function parseModule(value: unknown): ModuleInput | null {
  return value === "LISTENING" ||
    value === "READING" ||
    value === "WRITING" ||
    value === "SPEAKING"
    ? value
    : null;
}

function parseVariant(value: unknown): VariantInput | null {
  return value === "ACADEMIC" || value === "GENERAL" ? value : null;
}

function parseDifficulty(value: unknown): DifficultyInput | null {
  return value === "EASY" || value === "MEDIUM" || value === "HARD"
    ? value
    : null;
}

function parseDuration(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(240, Math.max(5, Math.round(n)));
}

async function requireAdmin() {
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
    select: { role: true },
  });

  if (!user) {
    return { error: "User not found", status: 404 as const };
  }

  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    return { error: "Forbidden", status: 403 as const };
  }

  return { ok: true as const };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { error: "Test id is required" },
        { status: 400 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as PatchBody;

    const data: {
      title?: string;
      description?: string | null;
      module?: ModuleInput;
      variant?: VariantInput;
      difficulty?: DifficultyInput;
      durationMins?: number;
      isPractice?: boolean;
      isActive?: boolean;
    } = {};

    if (typeof body.title === "string") {
      const title = body.title.trim();
      if (!title) {
        return NextResponse.json(
          { error: "title cannot be empty" },
          { status: 400 },
        );
      }
      data.title = title;
    }

    if (typeof body.description === "string") {
      const description = body.description.trim();
      data.description = description || null;
    }

    if (body.module !== undefined) {
      const module = parseModule(body.module);
      if (!module) {
        return NextResponse.json(
          { error: "module must be LISTENING, READING, WRITING, or SPEAKING" },
          { status: 400 },
        );
      }
      data.module = module;
    }

    if (body.variant !== undefined) {
      const variant = parseVariant(body.variant);
      if (!variant) {
        return NextResponse.json(
          { error: "variant must be ACADEMIC or GENERAL" },
          { status: 400 },
        );
      }
      data.variant = variant;
    }

    if (body.difficulty !== undefined) {
      const difficulty = parseDifficulty(body.difficulty);
      if (!difficulty) {
        return NextResponse.json(
          { error: "difficulty must be EASY, MEDIUM, or HARD" },
          { status: 400 },
        );
      }
      data.difficulty = difficulty;
    }

    if (body.durationMins !== undefined) {
      const durationMins = parseDuration(body.durationMins);
      if (durationMins == null) {
        return NextResponse.json(
          { error: "durationMins must be a number" },
          { status: 400 },
        );
      }
      data.durationMins = durationMins;
    }

    if (body.isPractice !== undefined) {
      if (typeof body.isPractice !== "boolean") {
        return NextResponse.json(
          { error: "isPractice must be boolean" },
          { status: 400 },
        );
      }
      data.isPractice = body.isPractice;
    }

    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") {
        return NextResponse.json(
          { error: "isActive must be boolean" },
          { status: 400 },
        );
      }
      data.isActive = body.isActive;
    }

    if (!Object.keys(data).length) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const test = await prisma.test.update({
      where: { id },
      data,
      select: {
        id: true,
        title: true,
        description: true,
        module: true,
        variant: true,
        difficulty: true,
        durationMins: true,
        totalQuestions: true,
        isActive: true,
        isPractice: true,
      },
    });

    return NextResponse.json({ test });
  } catch (error) {
    const known = error as { code?: string; message?: string };
    if (known?.code === "P2025") {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }

    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to update test", detail },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { error: "Test id is required" },
        { status: 400 },
      );
    }

    try {
      await prisma.test.delete({ where: { id } });
      return NextResponse.json({ ok: true, deleted: true });
    } catch (error) {
      const known = error as { code?: string; message?: string };
      if (known?.code === "P2025") {
        return NextResponse.json({ error: "Test not found" }, { status: 404 });
      }

      if (known?.code === "P2003" || known?.code === "P2014") {
        await prisma.test.update({
          where: { id },
          data: { isActive: false },
        });
        return NextResponse.json({ ok: true, deleted: false, archived: true });
      }

      throw error;
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to delete test", detail },
      { status: 500 },
    );
  }
}
