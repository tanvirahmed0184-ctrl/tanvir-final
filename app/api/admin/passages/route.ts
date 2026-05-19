import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

type ModuleInput = "READING" | "LISTENING" | "WRITING";
type DifficultyInput = "EASY" | "MEDIUM" | "HARD";

type CreateBody = {
  title?: unknown;
  content?: unknown;
  module?: unknown;
  sectionPart?: unknown;
  difficulty?: unknown;
};

function parseModule(value: unknown): ModuleInput | null {
  return value === "READING" || value === "LISTENING" || value === "WRITING"
    ? value
    : null;
}

function parseDifficulty(value: unknown): DifficultyInput {
  return value === "EASY" || value === "HARD" ? value : "MEDIUM";
}

function parseSectionPart(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(10, Math.round(n)));
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const lite = searchParams.get("lite") === "1";

    if (lite) {
      const passages = await prisma.passage.findMany({
        orderBy: [{ updatedAt: "desc" }],
        select: {
          id: true,
          title: true,
          module: true,
          sectionPart: true,
          media: {
            select: {
              id: true,
              type: true,
              url: true,
              label: true,
              order: true,
            },
            orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          },
        },
      });

      return NextResponse.json({ passages });
    }

    const passages = await prisma.passage.findMany({
      orderBy: [{ updatedAt: "desc" }],
      include: {
        media: {
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        },
        _count: {
          select: {
            bankQuestions: true,
          },
        },
      },
    });

    const payload = passages.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      module: row.module,
      sectionPart: row.sectionPart,
      wordCount: row.wordCount,
      difficulty: row.difficulty,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      media: row.media,
      linkedQuestions: row._count.bankQuestions,
    }));

    return NextResponse.json({ passages: payload });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to list passages", detail },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = (await request.json().catch(() => ({}))) as CreateBody;

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const testModule = parseModule(body.module);
    const sectionPart = parseSectionPart(body.sectionPart);
    const difficulty = parseDifficulty(body.difficulty);

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    if (!testModule) {
      return NextResponse.json(
        { error: "module must be READING, LISTENING, or WRITING" },
        { status: 400 },
      );
    }

    const passage = await prisma.passage.create({
      data: {
        title,
        content: content || null,
        module: testModule,
        sectionPart,
        difficulty,
        wordCount: content ? countWords(content) : null,
      },
      include: {
        media: {
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        },
        _count: {
          select: {
            bankQuestions: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        passage: {
          ...passage,
          linkedQuestions: passage._count.bankQuestions,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create passage", detail },
      { status: 500 },
    );
  }
}
