import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getRedis } from "@/lib/redis";
import { ensureListeningPassageAudio } from "@/lib/listening-audio";

type ModuleInput = "READING" | "LISTENING" | "WRITING";
type VariantInput = "ACADEMIC" | "GENERAL";
type DifficultyInput = "EASY" | "MEDIUM" | "HARD";
type KindInput = "PRACTICE" | "MOCK" | "FINAL";
type ListeningAudioModeInput =
  | "single_full_audio"
  | "sequential_section_audio";

type SectionInput = {
  part?: unknown;
  passageId?: unknown;
  questionIds?: unknown;
};

type WritingInput = {
  task1PromptId?: unknown;
  task2PromptId?: unknown;
  task1ImageUrl?: unknown;
  task2ImageUrl?: unknown;
};

type Body = {
  title?: unknown;
  description?: unknown;
  module?: unknown;
  variant?: unknown;
  difficulty?: unknown;
  kind?: unknown;
  durationMins?: unknown;
  sections?: unknown;
  writing?: unknown;
  autoGenerateMissingListeningAudio?: unknown;
  listeningAudioMode?: unknown;
  listeningSectionPauseSeconds?: unknown;
  listeningSectionTransitionMessage?: unknown;
};

function parseModule(value: unknown): ModuleInput | null {
  return value === "READING" || value === "LISTENING" || value === "WRITING"
    ? value
    : null;
}

function parseVariant(value: unknown): VariantInput {
  return value === "GENERAL" ? "GENERAL" : "ACADEMIC";
}

function parseDifficulty(value: unknown): DifficultyInput {
  return value === "EASY" || value === "HARD" ? value : "MEDIUM";
}

function parseKind(value: unknown): KindInput {
  return value === "MOCK" || value === "FINAL" ? value : "PRACTICE";
}

function parseDuration(value: unknown, module: ModuleInput): number {
  const fallback = module === "LISTENING" ? 30 : 60;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(10, Math.min(240, Math.round(n)));
}

function parseAutoGenerateMissingListeningAudio(value: unknown): boolean {
  if (value === false || value === "false") return false;
  return true;
}

function parseListeningAudioMode(value: unknown): ListeningAudioModeInput {
  return value === "single_full_audio"
    ? "single_full_audio"
    : "sequential_section_audio";
}

function parseSectionPauseSeconds(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 10;
  return Math.max(0, Math.min(120, Math.round(parsed)));
}

function parseTransitionMessage(value: unknown): string {
  const text =
    typeof value === "string" ? value.trim() : "Now, starting another section, be prepared.";
  return text || "Now, starting another section, be prepared.";
}

function sortedSectionsAudioUrl(
  sections: Array<{ part: number; passageId: string }>,
  audioUrlByPassageId: Map<string, string>,
): string | null {
  const ordered = [...sections].sort((a, b) => a.part - b.part);
  for (const section of ordered) {
    const audioUrl = audioUrlByPassageId.get(section.passageId);
    if (audioUrl) return audioUrl;
  }
  return null;
}

function asId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asSectionRows(value: unknown): Array<{
  part: number;
  passageId: string;
  questionIds: string[];
}> {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => row as SectionInput)
    .map((row) => ({
      part: Number(row.part),
      passageId: asId(row.passageId),
      questionIds: Array.isArray(row.questionIds)
        ? row.questionIds.map((id) => asId(id)).filter(Boolean)
        : [],
    }))
    .filter(
      (row) => Number.isFinite(row.part) && row.part > 0 && row.passageId,
    );
}

function isTask1(taskType: string): boolean {
  return taskType === "TASK_1_ACADEMIC" || taskType === "TASK_1_GENERAL";
}

async function invalidateTestsCache(module: ModuleInput) {
  const redis = getRedis();
  if (!redis) return;

  const keys = [`tests:${module}:list`, "tests:ALL:list"];
  await Promise.all(keys.map((key) => redis.del(key).catch(() => 0)));
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const title = asId(body.title);
    const description = asId(body.description) || null;
    const testModule = parseModule(body.module);

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    if (!testModule) {
      return NextResponse.json(
        { error: "module must be READING, LISTENING, or WRITING" },
        { status: 400 },
      );
    }

    const duplicate = await prisma.test.findFirst({
      where: {
        title: {
          equals: title,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "Test title already exists. Please use a new name." },
        { status: 409 },
      );
    }

    const variant = parseVariant(body.variant);
    const difficulty = parseDifficulty(body.difficulty);
    const kind = parseKind(body.kind);
    const durationMins = parseDuration(body.durationMins, testModule);
    const isPractice = kind === "PRACTICE";
    const autoGenerateMissingListeningAudio =
      parseAutoGenerateMissingListeningAudio(
        body.autoGenerateMissingListeningAudio,
      );
    const listeningAudioMode = parseListeningAudioMode(body.listeningAudioMode);
    const listeningSectionPauseSeconds = parseSectionPauseSeconds(
      body.listeningSectionPauseSeconds,
    );
    const listeningSectionTransitionMessage = parseTransitionMessage(
      body.listeningSectionTransitionMessage,
    );

    if (testModule === "WRITING") {
      const writing = (body.writing || {}) as WritingInput;
      const task1PromptId = asId(writing.task1PromptId);
      const task2PromptId = asId(writing.task2PromptId);
      const task1ImageUrl = asId(writing.task1ImageUrl) || null;
      const task2ImageUrl = asId(writing.task2ImageUrl) || null;

      if (!task1PromptId || !task2PromptId) {
        return NextResponse.json(
          {
            error:
              "writing.task1PromptId and writing.task2PromptId are required",
          },
          { status: 400 },
        );
      }

      const prompts = await prisma.writingPrompt.findMany({
        where: {
          id: { in: [task1PromptId, task2PromptId] },
          isActive: true,
        },
      });
      const p1 = prompts.find((p) => p.id === task1PromptId);
      const p2 = prompts.find((p) => p.id === task2PromptId);

      if (!p1 || !p2) {
        return NextResponse.json(
          { error: "One or more writing prompts were not found or inactive" },
          { status: 400 },
        );
      }
      if (!isTask1(p1.taskType) || p2.taskType !== "TASK_2") {
        return NextResponse.json(
          { error: "Task selection must be Task 1 prompt + Task 2 prompt" },
          { status: 400 },
        );
      }

      const test = await prisma.$transaction(
        async (tx) => {
          const created = await tx.test.create({
            data: {
              title,
              description,
              module: testModule,
              variant,
              difficulty,
              kind,
              durationMins,
              totalQuestions: 2,
              totalParts: 2,
              isPractice,
              isActive: true,
              sourceConfig: {
                task1PromptId,
                task2PromptId,
                task1ImageUrl,
                task2ImageUrl,
              },
            },
          });

          const task1Section = await tx.testSection.create({
            data: {
              testId: created.id,
              title: "Task 1",
              order: 1,
            },
          });
          const task2Section = await tx.testSection.create({
            data: {
              testId: created.id,
              title: "Task 2",
              order: 2,
            },
          });

          await tx.question.create({
            data: {
              testId: created.id,
              sectionId: task1Section.id,
              type: "SHORT_ANSWER",
              order: 1,
              questionText: p1.promptText,
              questionContext: p1.title,
              correctAnswer: "N/A",
              acceptedAnswers: [],
              explanation: "Writing Task 1 prompt",
              points: 1,
              imageUrl: task1ImageUrl || p1.imageUrl || null,
            },
          });

          await tx.question.create({
            data: {
              testId: created.id,
              sectionId: task2Section.id,
              type: "SHORT_ANSWER",
              order: 1,
              questionText: p2.promptText,
              questionContext: p2.title,
              correctAnswer: "N/A",
              acceptedAnswers: [],
              explanation: "Writing Task 2 prompt",
              points: 1,
              imageUrl: task2ImageUrl || p2.imageUrl || null,
            },
          });

          return created;
        },
        {
          // Writing a full mapped test can exceed Prisma interactive transaction defaults.
          maxWait: 10_000,
          timeout: 120_000,
        },
      );

      await invalidateTestsCache(testModule);

      return NextResponse.json(
        { testId: test.id, module: testModule },
        { status: 201 },
      );
    }

    const sections = asSectionRows(body.sections);
    const expectedParts = testModule === "READING" ? 3 : 4;
    if (sections.length !== expectedParts) {
      return NextResponse.json(
        {
          error: `${testModule} requires exactly ${expectedParts} parts/sections`,
        },
        { status: 400 },
      );
    }

    const partSet = new Set(sections.map((s) => s.part));
    if (partSet.size !== expectedParts) {
      return NextResponse.json(
        { error: "Each part must be unique" },
        { status: 400 },
      );
    }
    const passageSet = new Set(sections.map((s) => s.passageId));
    if (passageSet.size !== sections.length) {
      return NextResponse.json(
        { error: "Each part/section must use a different source passage" },
        { status: 400 },
      );
    }

    const expectedByPart = testModule === "READING" ? [13, 14] : [10, 10];
    const totalSelected = sections.reduce(
      (sum, s) => sum + s.questionIds.length,
      0,
    );

    if (testModule === "READING") {
      const ok = sections.every(
        (s) => s.questionIds.length >= 13 && s.questionIds.length <= 14,
      );
      if (!ok || totalSelected !== 40) {
        return NextResponse.json(
          {
            error:
              "READING requires 3 passages, 13-14 questions each, total exactly 40",
          },
          { status: 400 },
        );
      }
    } else {
      const ok = sections.every(
        (s) => s.questionIds.length === expectedByPart[0],
      );
      if (!ok || totalSelected !== 40) {
        return NextResponse.json(
          {
            error:
              "LISTENING requires 4 sections, 10 questions each, total exactly 40",
          },
          { status: 400 },
        );
      }
    }

    const passageIds = Array.from(new Set(sections.map((s) => s.passageId)));
    const passages = await prisma.passage.findMany({
      where: {
        id: { in: passageIds },
      },
      include: {
        media: {
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        },
      },
    });
    const passageById = new Map(passages.map((p) => [p.id, p]));
    const audioUrlByPassageId = new Map<string, string>();

    if (testModule === "LISTENING") {
      for (const passage of passages) {
        const audioUrl = passage.media.find((m) => m.type === "AUDIO")?.url;
        if (audioUrl) {
          audioUrlByPassageId.set(passage.id, audioUrl);
        }
      }
    }

    for (const section of sections) {
      const p = passageById.get(section.passageId);
      if (!p) {
        return NextResponse.json(
          { error: `Passage not found for part ${section.part}` },
          { status: 400 },
        );
      }
      if (p.module !== testModule) {
        return NextResponse.json(
          { error: `Passage module mismatch at part ${section.part}` },
          { status: 400 },
        );
      }
      if (testModule === "LISTENING") {
        const hasAudio = audioUrlByPassageId.has(p.id);
        if (!hasAudio) {
          if (!autoGenerateMissingListeningAudio) {
            return NextResponse.json(
              { error: `Listening part ${section.part} must have audio media` },
              { status: 400 },
            );
          }

          try {
            const generated = await ensureListeningPassageAudio({
              passageId: p.id,
              passageContent: p.content,
              existingMedia: p.media.map((m) => ({
                id: m.id,
                type: m.type,
                url: m.url,
                label: m.label,
                order: m.order,
                storagePath: m.storagePath,
              })),
            });

            audioUrlByPassageId.set(p.id, generated.media.url);
          } catch (error) {
            const detail =
              error instanceof Error
                ? error.message
                : "Unknown generation error";
            return NextResponse.json(
              {
                error: `Listening part ${section.part} must have audio media`,
                detail,
              },
              { status: 400 },
            );
          }
        }
      }
    }

    const allQuestionIds = Array.from(
      new Set(sections.flatMap((s) => s.questionIds)),
    );
    const bankItems = await prisma.questionBankItem.findMany({
      where: {
        id: { in: allQuestionIds },
        isActive: true,
      },
      include: {
        options: {
          orderBy: [{ label: "asc" }],
        },
      },
    });
    const bankById = new Map(bankItems.map((q) => [q.id, q]));

    for (const section of sections) {
      for (const qid of section.questionIds) {
        const q = bankById.get(qid);
        if (!q) {
          return NextResponse.json(
            { error: `Question ${qid} not found or inactive` },
            { status: 400 },
          );
        }
        if (q.passageId !== section.passageId) {
          return NextResponse.json(
            {
              error: `Question ${qid} is not linked to the selected passage in part ${section.part}`,
            },
            { status: 400 },
          );
        }
      }
    }

    const test = await prisma.$transaction(
      async (tx) => {
        const created = await tx.test.create({
          data: {
            title,
            description,
            module: testModule,
            variant,
            difficulty,
            kind,
            durationMins,
            totalQuestions: 40,
            totalParts: expectedParts,
            isPractice,
            isActive: true,
            audioUrl:
              testModule === "LISTENING"
                ? sortedSectionsAudioUrl(sections, audioUrlByPassageId) || null
                : null,
            sourceConfig: {
              sections: sections.map((s) => ({
                part: s.part,
                passageId: s.passageId,
                questionIds: s.questionIds,
              })),
              listeningAudioMode:
                testModule === "LISTENING"
                  ? listeningAudioMode
                  : undefined,
              listeningSectionPauseSeconds:
                testModule === "LISTENING"
                  ? listeningSectionPauseSeconds
                  : undefined,
              listeningSectionTransitionMessage:
                testModule === "LISTENING"
                  ? listeningSectionTransitionMessage
                  : undefined,
            },
          },
        });

        const sortedSections = [...sections].sort((a, b) => a.part - b.part);
        for (const sectionInput of sortedSections) {
          const sourcePassage = passageById.get(sectionInput.passageId)!;
          const audioFromPassage =
            audioUrlByPassageId.get(sourcePassage.id) ||
            sourcePassage.media.find((m) => m.type === "AUDIO")?.url ||
            null;
          const passageHasAudio = Boolean(audioFromPassage);

          const section = await tx.testSection.create({
            data: {
              testId: created.id,
              title:
                testModule === "READING"
                  ? `Passage ${sectionInput.part}`
                  : `Section ${sectionInput.part}`,
              order: sectionInput.part,
              passage: sourcePassage.content,
              audioUrl: testModule === "LISTENING" ? audioFromPassage : null,
              sourcePassageId: sourcePassage.id,
            },
          });

          for (let i = 0; i < sectionInput.questionIds.length; i += 1) {
            const bank = bankById.get(sectionInput.questionIds[i])!;
            const sourceMediaType = bank.audioUrl
              ? "AUDIO"
              : bank.imageUrl
                ? "IMAGE"
                : passageHasAudio
                  ? "AUDIO"
                  : sourcePassage.media.some((m) => m.type === "IMAGE")
                    ? "IMAGE"
                    : null;

            await tx.question.create({
              data: {
                testId: created.id,
                sectionId: section.id,
                type: bank.type,
                order: i + 1,
                questionText: bank.questionText,
                questionContext: bank.explanation,
                correctAnswer: bank.correctAnswer || "N/A",
                acceptedAnswers: bank.acceptedAnswers,
                explanation: bank.explanation,
                points: bank.points,
                sourceBankItemId: bank.id,
                sourcePassageId: bank.passageId,
                sourceMediaType,
                imageUrl: bank.imageUrl,
                audioUrl: bank.audioUrl,
                options: bank.options.length
                  ? {
                      create: bank.options.map((opt) => ({
                        label: opt.label,
                        text: opt.text,
                        isCorrect: opt.isCorrect,
                      })),
                    }
                  : undefined,
              },
            });
          }
        }

        return created;
      },
      {
        // 40-question mapped test creation is a large write operation.
        maxWait: 10_000,
        timeout: 120_000,
      },
    );

    await invalidateTestsCache(testModule);

    return NextResponse.json(
      { testId: test.id, module: testModule },
      { status: 201 },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create mapped test", detail },
      { status: 500 },
    );
  }
}
