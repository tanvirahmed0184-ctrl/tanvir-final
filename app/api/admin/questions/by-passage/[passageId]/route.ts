import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function GET(
  _request: Request,
  context: { params: Promise<{ passageId: string }> },
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { passageId } = await context.params;
    if (!passageId) {
      return NextResponse.json(
        { error: "passageId is required" },
        { status: 400 },
      );
    }

    const questions = await prisma.questionBankItem.findMany({
      where: {
        passageId,
        isActive: true,
      },
      orderBy: [{ type: "asc" }, { id: "asc" }],
      select: {
        id: true,
        questionText: true,
        type: true,
        options: {
          select: {
            id: true,
            label: true,
            text: true,
          },
          orderBy: [{ label: "asc" }],
        },
      },
    });

    return NextResponse.json({ questions });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch questions by passage", detail },
      { status: 500 },
    );
  }
}
