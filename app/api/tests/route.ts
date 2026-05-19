import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getRedis } from "@/lib/redis";
import { parsePromptSetsFromSourceConfig } from "@/lib/speaking/prompt-set-config";

type ModuleParam = "LISTENING" | "READING" | "WRITING" | "SPEAKING";
type AudienceParam = "student" | null;

const MOCK_TESTS = [
  {
    id: "demo-reading-1",
    title: "Reading Practice Set 1",
    description: "Academic reading passage set with 40 questions.",
    module: "READING",
    variant: "ACADEMIC",
    difficulty: "MEDIUM",
    durationMins: 60,
    totalQuestions: 40,
    isPractice: true,
    isActive: true,
    audioUrl: null,
    attemptsCount: 0,
  },
  {
    id: "demo-listening-1",
    title: "Listening Practice Set 1",
    description: "Listening sections with note completion and MCQ.",
    module: "LISTENING",
    variant: "ACADEMIC",
    difficulty: "MEDIUM",
    durationMins: 30,
    totalQuestions: 40,
    isPractice: true,
    isActive: true,
    audioUrl: null,
    attemptsCount: 0,
  },
  {
    id: "demo-writing-1",
    title: "Writing Task Pack 1",
    description: "Task 1 and Task 2 timed writing simulation.",
    module: "WRITING",
    variant: "ACADEMIC",
    difficulty: "HARD",
    durationMins: 60,
    totalQuestions: 2,
    isPractice: true,
    isActive: true,
    audioUrl: null,
    attemptsCount: 0,
  },
];

function parseModule(value: string | null): ModuleParam | null {
  if (
    value === "LISTENING" ||
    value === "READING" ||
    value === "WRITING" ||
    value === "SPEAKING"
  ) {
    return value;
  }
  return null;
}

function parseAudience(value: string | null): AudienceParam {
  return value === "student" ? value : null;
}

function isNonEmptyText(value: string | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isLaunchReadyForStudent(test: {
  module: ModuleParam;
  totalQuestions: number;
  sections: Array<{
    passage: string | null;
    audioUrl: string | null;
    _count: { questions: number };
  }>;
}): boolean {
  const totalFromSections = test.sections.reduce(
    (sum, section) => sum + section._count.questions,
    0,
  );

  if (test.module === "READING") {
    return (
      test.sections.length === 3 &&
      totalFromSections >= 40 &&
      test.sections.every(
        (section) =>
          section._count.questions > 0 && isNonEmptyText(section.passage),
      )
    );
  }

  if (test.module === "LISTENING") {
    return (
      test.sections.length === 4 &&
      totalFromSections >= 40 &&
      test.sections.every(
        (section) =>
          section._count.questions > 0 && isNonEmptyText(section.audioUrl),
      )
    );
  }

  if (test.module === "WRITING") {
    return test.sections.length >= 2 && totalFromSections >= 2;
  }

  return test.totalQuestions >= 3;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const selectedModule = parseModule(searchParams.get("module"));
  const audience = parseAudience(searchParams.get("audience"));
  const fresh = searchParams.get("fresh") === "1";
  const cacheKey = `tests:${selectedModule ?? "ALL"}:list:audience:${audience ?? "all"}`;

  try {
    const redis = getRedis();

    if (redis && !fresh) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return NextResponse.json({ tests: cached, source: "cache" });
      }
    }

    const tests = await prisma.test.findMany({
      where: {
        isActive: true,
        ...(selectedModule ? { module: selectedModule } : {}),
      },
      orderBy: [{ isPractice: "desc" }, { createdAt: "desc" }],
      include: {
        _count: {
          select: {
            attempts: true,
          },
        },
        sections: {
          select: {
            passage: true,
            audioUrl: true,
            _count: {
              select: {
                questions: true,
              },
            },
          },
        },
      },
    });

    const payload = tests
      .map((test) => {
        const isLaunchReady = isLaunchReadyForStudent(test);
        return {
          ...(test.module === "SPEAKING"
            ? (() => {
                const parsed = parsePromptSetsFromSourceConfig(test.sourceConfig);
                return {
                  activeSpeakingSetId: parsed.activeSetId,
                  speakingPromptSets: parsed.sets.map((set) => ({
                    id: set.id,
                    name: set.name,
                    promptCount: set.prompts.length,
                  })),
                };
              })()
            : {}),
          id: test.id,
          title: test.title,
          description: test.description,
          module: test.module,
          variant: test.variant,
          difficulty: test.difficulty,
          durationMins: test.durationMins,
          totalQuestions: test.totalQuestions,
          isPractice: test.isPractice,
          isActive: test.isActive,
          isLaunchReady,
          audioUrl: test.audioUrl,
          attemptsCount: test._count.attempts,
          createdAt: test.createdAt,
          updatedAt: test.updatedAt,
        };
      })
      .filter((test) => (audience === "student" ? test.isLaunchReady : true));

    if (redis && !fresh) {
      await redis.set(cacheKey, payload, { ex: 300 });
    }

    return NextResponse.json({ tests: payload, source: "db" });
  } catch {
    const fallback = selectedModule
      ? MOCK_TESTS.filter((test) => test.module === selectedModule)
      : MOCK_TESTS;

    return NextResponse.json({ tests: fallback, source: "mock" });
  }
}
