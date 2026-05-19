import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DemoQuestion = {
  id: string;
  type: string;
  order: number;
  questionText: string;
  questionContext: string | null;
  explanation: string | null;
  points: number;
  options: Array<{ id: string; label: string; text: string }>;
};

type ListeningAudioMode = "single_full_audio" | "sequential_section_audio";

const DEMO_SECTIONS: Array<{
  id: string;
  title: string;
  passage: string;
  audioUrl?: string | null;
  questions: DemoQuestion[];
}> = [
  {
    id: "demo-section-1",
    title: "Section 1",
    passage:
      "Modern cities are adopting smart transport systems to reduce congestion and improve sustainability.",
    questions: [
      {
        id: "demo-q-1",
        type: "MULTIPLE_CHOICE",
        order: 1,
        questionText: "What is the main topic of the passage?",
        questionContext: null,
        explanation:
          "The passage focuses on transport systems in modern cities.",
        points: 1,
        options: [
          { id: "demo-q-1-a", label: "A", text: "Food security" },
          { id: "demo-q-1-b", label: "B", text: "Smart transport" },
          { id: "demo-q-1-c", label: "C", text: "Ocean pollution" },
          { id: "demo-q-1-d", label: "D", text: "Tourism growth" },
        ],
      },
      {
        id: "demo-q-2",
        type: "TRUE_FALSE_NOT_GIVEN",
        order: 2,
        questionText:
          "Smart transport systems are introduced to increase traffic jams.",
        questionContext: null,
        explanation: "The passage states they reduce congestion.",
        points: 1,
        options: [],
      },
    ],
  },
];

function stripQuestion(question: {
  correctAnswer: string;
  acceptedAnswers: string[];
  [key: string]: unknown;
}) {
  const {
    correctAnswer: _correctAnswer,
    acceptedAnswers: _acceptedAnswers,
    ...safe
  } = question;
  return safe;
}

function parseSelectedPartNumbers(raw: string | null): number[] {
  if (!raw) return [];
  const unique = new Set(
    raw
      .split(",")
      .map((part) => {
        const match = part.match(/(\d+)/);
        return match ? Number(match[1]) : NaN;
      })
      .filter((num) => Number.isFinite(num) && num > 0),
  );
  return Array.from(unique);
}

function parseTimeLimitMins(raw: string | null): number | null {
  if (!raw) return null;
  const match = raw.match(/(\d+)/);
  if (!match) return null;
  const mins = Number(match[1]);
  if (!Number.isFinite(mins) || mins <= 0) return null;
  return Math.max(1, Math.min(240, Math.round(mins)));
}

function sectionNumberFromTitle(title: string, index: number): number {
  const match = title.match(/(\d+)/);
  if (match) {
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return index + 1;
}

function normalizeListeningAudioMode(value: unknown): ListeningAudioMode {
  return value === "single_full_audio"
    ? "single_full_audio"
    : "sequential_section_audio";
}

function normalizeSectionPauseSeconds(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 10;
  return Math.max(0, Math.min(120, Math.round(parsed)));
}

function normalizeTransitionMessage(value: unknown): string {
  const text =
    typeof value === "string" ? value.trim() : "Now, starting another section, be prepared.";
  return text || "Now, starting another section, be prepared.";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ attemptId: string }> },
) {
  try {
    const { attemptId } = await context.params;
    const { searchParams } = new URL(request.url);
    const selectedPartNumbers = parseSelectedPartNumbers(
      searchParams.get("selectedParts"),
    );
    const practiceDurationMins = parseTimeLimitMins(
      searchParams.get("timeLimit"),
    );

    if (attemptId.startsWith("demo-attempt-")) {
      return NextResponse.json({
        sections: DEMO_SECTIONS,
        mode: "practice",
        durationMins: 30,
        practiceDurationMins,
      });
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
      select: { testId: true, userId: true, mode: true },
    });

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    if (attempt.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const test = await prisma.test.findUnique({
      where: { id: attempt.testId },
      select: {
        module: true,
        durationMins: true,
        audioUrl: true,
        sourceConfig: true,
        sections: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            title: true,
            passage: true,
            audioUrl: true,
            sourcePassageId: true,
            sourcePassage: {
              select: {
                media: {
                  orderBy: [{ order: "asc" }, { createdAt: "asc" }],
                  select: {
                    id: true,
                    type: true,
                    url: true,
                    label: true,
                    order: true,
                  },
                },
              },
            },
            questions: {
              orderBy: { order: "asc" },
              include: {
                options: {
                  orderBy: { label: "asc" },
                },
              },
            },
          },
        },
      },
    });

    if (!test) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }

    const sections = test.sections.map((section) => ({
      ...section,
      audioUrl: section.audioUrl || test.audioUrl || null,
      media: Array.isArray(section.sourcePassage?.media)
        ? section.sourcePassage.media
        : [],
      sourcePassage: undefined,
      questions: section.questions.map((question) => stripQuestion(question)),
    }));

    const sourceConfig =
      test.sourceConfig && typeof test.sourceConfig === "object"
        ? (test.sourceConfig as Record<string, unknown>)
        : {};
    const listeningAudioMode = normalizeListeningAudioMode(
      sourceConfig.listeningAudioMode,
    );
    const listeningSectionPauseSeconds = normalizeSectionPauseSeconds(
      sourceConfig.listeningSectionPauseSeconds,
    );
    const listeningSectionTransitionMessage = normalizeTransitionMessage(
      sourceConfig.listeningSectionTransitionMessage,
    );

    const listeningAudioTracks = sections
      .map((section) => ({
        sectionId: section.id,
        sectionTitle: section.title,
        audioUrl: section.audioUrl || null,
      }))
      .filter((track) => Boolean(track.audioUrl));

    const filteredSections =
      attempt.mode === "practice" &&
      test.module === "LISTENING" &&
      selectedPartNumbers.length
        ? sections.filter((section, index) =>
            selectedPartNumbers.includes(
              sectionNumberFromTitle(section.title, index),
            ),
          )
        : sections;

    return NextResponse.json({
      sections: filteredSections.length ? filteredSections : sections,
      testAudioUrl: test.audioUrl || null,
      listeningAudioMode,
      listeningAudioTracks,
      listeningSectionPauseSeconds,
      listeningSectionTransitionMessage,
      mode: attempt.mode,
      durationMins: test.durationMins,
      practiceDurationMins,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to load attempt test", detail },
      { status: 500 },
    );
  }
}
