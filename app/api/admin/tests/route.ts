import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRedis } from "@/lib/redis";

type ModuleInput = "LISTENING" | "READING" | "WRITING" | "SPEAKING";
type VariantInput = "ACADEMIC" | "GENERAL";
type DifficultyInput = "EASY" | "MEDIUM" | "HARD";

type CreateBody = {
  title?: unknown;
  description?: unknown;
  module?: unknown;
  variant?: unknown;
  difficulty?: unknown;
  durationMins?: unknown;
  isPractice?: unknown;
};

function parseModule(value: unknown): ModuleInput | null {
  return value === "LISTENING" ||
    value === "READING" ||
    value === "WRITING" ||
    value === "SPEAKING"
    ? value
    : null;
}

function parseVariant(value: unknown): VariantInput {
  return value === "GENERAL" ? "GENERAL" : "ACADEMIC";
}

function parseDifficulty(value: unknown): DifficultyInput {
  return value === "EASY" || value === "HARD" ? value : "MEDIUM";
}

function parseDuration(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 60;
  return Math.min(240, Math.max(5, Math.round(n)));
}

function parsePractice(value: unknown): boolean {
  return typeof value === "boolean" ? value : true;
}

function defaultTotalQuestions(module: ModuleInput): number {
  if (module === "WRITING") return 2;
  if (module === "SPEAKING") return 3;
  return 40;
}

async function invalidateTestsCache(module: ModuleInput) {
  const redis = getRedis();
  if (!redis) return;

  const keys = [`tests:${module}:list`, "tests:ALL:list"];
  await Promise.all(keys.map((key) => redis.del(key).catch(() => 0)));
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

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = (await request.json().catch(() => ({}))) as CreateBody;

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : "";
    const module = parseModule(body.module);

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    if (!module) {
      return NextResponse.json(
        { error: "module must be LISTENING, READING, WRITING, or SPEAKING" },
        { status: 400 },
      );
    }

    const variant = parseVariant(body.variant);
    const difficulty = parseDifficulty(body.difficulty);
    const durationMins = parseDuration(body.durationMins);
    const isPractice = parsePractice(body.isPractice);

    const test = await prisma.test.create({
      data: {
        title,
        description: description || null,
        module,
        variant,
        difficulty,
        durationMins,
        isPractice,
        isActive: true,
        totalQuestions: defaultTotalQuestions(module),
      },
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

    await invalidateTestsCache(module);

    return NextResponse.json({ test }, { status: 201 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create test", detail },
      { status: 500 },
    );
  }
}
