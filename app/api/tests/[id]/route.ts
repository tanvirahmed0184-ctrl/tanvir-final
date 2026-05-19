import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getRedis } from "@/lib/redis";

function stripQuestionAnswers(question: {
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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const cacheKey = `test:${id}:v1`;
    const redis = getRedis();

    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return NextResponse.json({ test: cached, source: "cache" });
      }
    }

    const test = await prisma.test.findUnique({
      where: { id },
      include: {
        sections: {
          orderBy: { order: "asc" },
          include: {
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

    const safeTest = {
      ...test,
      sections: test.sections.map((section) => ({
        ...section,
        questions: section.questions.map((question) =>
          stripQuestionAnswers(question),
        ),
      })),
    };

    if (redis) {
      await redis.set(cacheKey, safeTest, { ex: 300 });
    }

    return NextResponse.json({ test: safeTest, source: "db" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch test", detail: message },
      { status: 500 },
    );
  }
}
