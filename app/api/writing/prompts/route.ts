import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("search") || "").trim();
    const idsRaw = (searchParams.get("ids") || "").trim();
    const ids = idsRaw
      ? idsRaw
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
      : [];

    const prompts = await prisma.writingPrompt.findMany({
      where: {
        isActive: true,
        ...(ids.length ? { id: { in: ids } } : {}),
        ...(query
          ? {
              OR: [
                { title: { contains: query, mode: "insensitive" } },
                { promptText: { contains: query, mode: "insensitive" } },
                { topic: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }],
    });

    return NextResponse.json({ prompts });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch writing prompts", detail },
      { status: 500 },
    );
  }
}
