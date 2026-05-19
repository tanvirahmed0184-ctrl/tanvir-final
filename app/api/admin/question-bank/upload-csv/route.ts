import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { parseCsvRows, rowsToObjects } from "@/lib/csv";

type AllowedQuestionType =
  | "MULTIPLE_CHOICE"
  | "FILL_IN_BLANK"
  | "TRUE_FALSE_NOT_GIVEN"
  | "YES_NO_NOT_GIVEN"
  | "MATCHING_HEADINGS"
  | "MATCHING_INFORMATION"
  | "SENTENCE_COMPLETION"
  | "SUMMARY_COMPLETION"
  | "SHORT_ANSWER";

type ModuleInput = "READING" | "LISTENING" | "WRITING";
type DifficultyInput = "EASY" | "MEDIUM" | "HARD";

type UploadBody = {
  csvText?: unknown;
  defaultPassageId?: unknown;
};

const QUESTION_TYPES: AllowedQuestionType[] = [
  "MULTIPLE_CHOICE",
  "FILL_IN_BLANK",
  "TRUE_FALSE_NOT_GIVEN",
  "YES_NO_NOT_GIVEN",
  "MATCHING_HEADINGS",
  "MATCHING_INFORMATION",
  "SENTENCE_COMPLETION",
  "SUMMARY_COMPLETION",
  "SHORT_ANSWER",
];

const TEMPLATE_HEADERS = [
  "question_text",
  "question_type",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "correct_answer",
  "accepted_answers",
  "explanation",
  "module",
  "section_part",
  "passage_id",
  "difficulty",
  "points",
  "question_image_url",
  "question_audio_url",
  "passage_title",
];

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseQuestionType(value: string): AllowedQuestionType | null {
  const upper = value.trim().toUpperCase();
  return QUESTION_TYPES.includes(upper as AllowedQuestionType)
    ? (upper as AllowedQuestionType)
    : null;
}

function parseModule(value: string): ModuleInput | null {
  const upper = value.trim().toUpperCase();
  return upper === "READING" || upper === "LISTENING" || upper === "WRITING"
    ? upper
    : null;
}

function parseDifficulty(value: string): DifficultyInput {
  const upper = value.trim().toUpperCase();
  return upper === "EASY" || upper === "HARD" ? upper : "MEDIUM";
}

function parseSectionPart(
  value: string,
  fallback?: number | null,
): number | null {
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return Math.round(n);
  return fallback ?? null;
}

function parsePoints(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(20, Math.round(n)));
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const filterModule = parseModule(searchParams.get("module") || "");

    const rows = await prisma.questionBankItem.findMany({
      where: {
        ...(filterModule ? { module: filterModule } : {}),
      },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
      include: {
        options: {
          orderBy: [{ label: "asc" }],
        },
        passage: {
          select: {
            id: true,
            title: true,
            module: true,
            sectionPart: true,
          },
        },
      },
    });

    return NextResponse.json({ rows });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to list question bank items", detail },
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

    const body = (await request.json().catch(() => ({}))) as UploadBody;
    const csvText = normalizeText(body.csvText);
    const defaultPassageId = normalizeText(body.defaultPassageId);

    if (!csvText) {
      return NextResponse.json(
        { error: "csvText is required" },
        { status: 400 },
      );
    }

    const parsedRows = parseCsvRows(csvText);
    if (!parsedRows.length) {
      return NextResponse.json({ error: "CSV has no rows" }, { status: 400 });
    }

    const header = parsedRows[0].map((x) => x.trim().toLowerCase());
    if (
      !header.includes("question_text") ||
      !header.includes("question_type")
    ) {
      return NextResponse.json(
        { error: "CSV must include question_text and question_type columns" },
        { status: 400 },
      );
    }

    const rowObjects = rowsToObjects(parsedRows);
    if (!rowObjects.length) {
      return NextResponse.json(
        { error: "CSV has no data rows" },
        { status: 400 },
      );
    }

    const passages = await prisma.passage.findMany({
      select: {
        id: true,
        title: true,
        module: true,
        sectionPart: true,
      },
    });
    const passageById = new Map(passages.map((p) => [p.id, p]));
    const passageByTitle = new Map(
      passages.map((p) => [p.title.trim().toLowerCase(), p]),
    );

    if (defaultPassageId && !passageById.has(defaultPassageId)) {
      return NextResponse.json(
        { error: "defaultPassageId does not exist" },
        { status: 400 },
      );
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    const normalized = rowObjects.map((row, idx) => {
      const questionText = normalizeText(row.question_text);
      const type = parseQuestionType(normalizeText(row.question_type));
      const correctAnswer = normalizeText(row.correct_answer).toUpperCase();
      const explanation = normalizeText(row.explanation);
      const optionA = normalizeText(row.option_a);
      const optionB = normalizeText(row.option_b);
      const optionC = normalizeText(row.option_c);
      const optionD = normalizeText(row.option_d);
      const acceptedRaw = normalizeText(row.accepted_answers);
      const passageIdRaw = normalizeText(row.passage_id);
      const passageTitleRaw = normalizeText(row.passage_title).toLowerCase();
      const imageUrl = normalizeText(row.question_image_url);
      const audioUrl = normalizeText(row.question_audio_url);

      if (!questionText) {
        errors.push(`Row ${idx + 2}: question_text is required`);
      }
      if (!type) {
        errors.push(`Row ${idx + 2}: invalid question_type`);
      }
      if (!correctAnswer) {
        errors.push(`Row ${idx + 2}: correct_answer is required`);
      }

      let passage = null as (typeof passages)[number] | null;
      if (passageIdRaw) {
        passage = passageById.get(passageIdRaw) || null;
      } else if (passageTitleRaw) {
        passage = passageByTitle.get(passageTitleRaw) || null;
        if (!passage && defaultPassageId) {
          // If title in CSV doesn't match DB, fallback to selected default source.
          passage = passageById.get(defaultPassageId) || null;
          if (passage) {
            warnings.push(
              `Row ${idx + 2}: passage_title না মেলায় default passage ব্যবহার করা হয়েছে`,
            );
          }
        }
      } else if (defaultPassageId) {
        passage = passageById.get(defaultPassageId) || null;
      }

      if (passageIdRaw && !passage) {
        errors.push(`Row ${idx + 2}: passage_id not found`);
      }
      if (passageTitleRaw && !passage && !defaultPassageId) {
        errors.push(
          `Row ${idx + 2}: passage_title not found (and no defaultPassageId selected)`,
        );
      }

      const resolvedModule =
        parseModule(normalizeText(row.module)) ??
        (passage?.module as ModuleInput);
      if (!resolvedModule) {
        errors.push(
          `Row ${idx + 2}: module is required if passage link is missing`,
        );
      }

      const sectionPart = parseSectionPart(
        normalizeText(row.section_part),
        passage?.sectionPart,
      );

      if (type === "MULTIPLE_CHOICE") {
        const optionCount = [optionA, optionB, optionC, optionD].filter(
          Boolean,
        ).length;
        if (optionCount < 2) {
          errors.push(
            `Row ${idx + 2}: MULTIPLE_CHOICE needs at least 2 options`,
          );
        }
        if (!["A", "B", "C", "D"].includes(correctAnswer)) {
          errors.push(
            `Row ${idx + 2}: MULTIPLE_CHOICE correct_answer must be A, B, C, or D`,
          );
        }
      }

      const acceptedAnswers = acceptedRaw
        ? acceptedRaw
            .split("|")
            .map((x) => x.trim())
            .filter(Boolean)
        : [];
      if (correctAnswer && !acceptedAnswers.includes(correctAnswer)) {
        acceptedAnswers.unshift(correctAnswer);
      }

      return {
        questionText,
        type,
        module: resolvedModule,
        sectionPart,
        difficulty: parseDifficulty(normalizeText(row.difficulty)),
        points: parsePoints(normalizeText(row.points)),
        correctAnswer,
        acceptedAnswers,
        explanation: explanation || null,
        passageId: passage?.id || null,
        imageUrl: imageUrl || null,
        audioUrl: audioUrl || null,
        options: [
          { label: "A", text: optionA, isCorrect: correctAnswer === "A" },
          { label: "B", text: optionB, isCorrect: correctAnswer === "B" },
          { label: "C", text: optionC, isCorrect: correctAnswer === "C" },
          { label: "D", text: optionD, isCorrect: correctAnswer === "D" },
        ].filter((o) => o.text),
      };
    });

    if (errors.length) {
      return NextResponse.json(
        { error: "CSV validation failed", issues: errors.slice(0, 50) },
        { status: 400 },
      );
    }

    let inserted = 0;
    await prisma.$transaction(
      async (tx) => {
        for (const item of normalized) {
          if (!item.type || !item.module) continue;

          await tx.questionBankItem.create({
            data: {
              questionText: item.questionText,
              type: item.type,
              module: item.module,
              sectionPart: item.sectionPart,
              difficulty: item.difficulty,
              points: item.points,
              correctAnswer: item.correctAnswer,
              acceptedAnswers: item.acceptedAnswers,
              explanation: item.explanation,
              passageId: item.passageId,
              imageUrl: item.imageUrl,
              audioUrl: item.audioUrl,
              isActive: true,
              options: item.options.length
                ? {
                    create: item.options.map((opt) => ({
                      label: opt.label,
                      text: opt.text,
                      isCorrect: opt.isCorrect,
                    })),
                  }
                : undefined,
            },
          });
          inserted += 1;
        }
      },
      {
        // CSV imports can exceed Prisma interactive transaction defaults.
        maxWait: 10_000,
        timeout: 120_000,
      },
    );

    return NextResponse.json({
      inserted,
      warnings,
      expectedHeaders: TEMPLATE_HEADERS,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to upload question bank CSV", detail },
      { status: 500 },
    );
  }
}
