import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

function parsePage(value: string | null): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

function parsePageSize(value: string | null): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 100;
  return Math.max(1, Math.min(500, Math.floor(n)));
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const page = parsePage(searchParams.get("page"));
    const pageSize = parsePageSize(searchParams.get("pageSize"));
    const search = (searchParams.get("search") || "").trim();
    const role = (searchParams.get("role") || "ALL").trim().toUpperCase();

    const where: {
      OR?: Array<{
        name?: { contains: string; mode: "insensitive" };
        email?: { contains: string; mode: "insensitive" };
        id?: { contains: string; mode: "insensitive" };
      }>;
      role?: "GUEST" | "STUDENT" | "INSTRUCTOR" | "ADMIN" | "SUPER_ADMIN";
    } = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { id: { contains: search, mode: "insensitive" } },
      ];
    }

    if (
      ["GUEST", "STUDENT", "INSTRUCTOR", "ADMIN", "SUPER_ADMIN"].includes(role)
    ) {
      where.role = role as
        | "GUEST"
        | "STUDENT"
        | "INSTRUCTOR"
        | "ADMIN"
        | "SUPER_ADMIN";
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          subscription: {
            select: {
              plan: true,
              status: true,
            },
          },
        },
      }),
    ]);

    const userIds = users.map((u) => u.id);

    const attemptsSummary = userIds.length
      ? await prisma.testAttempt.groupBy({
          by: ["userId"],
          where: {
            userId: { in: userIds },
          },
          _count: {
            _all: true,
          },
          _avg: {
            bandScore: true,
          },
        })
      : [];

    const attemptsMap = new Map(
      attemptsSummary.map((row) => [
        row.userId,
        {
          testsTaken: row._count._all,
          avgBand: row._avg.bandScore ?? 0,
        },
      ]),
    );

    const normalizedUsers = users.map((u) => {
      const stats = attemptsMap.get(u.id);
      return {
        id: u.id,
        name: u.name || "Unnamed User",
        email: u.email,
        role: u.role,
        plan: u.subscription?.plan || "free",
        subscriptionStatus: u.subscription?.status || "active",
        createdAt: u.createdAt.toISOString().slice(0, 10),
        testsTaken: stats?.testsTaken ?? 0,
        avgBand: Number((stats?.avgBand ?? 0).toFixed(1)),
      };
    });

    return NextResponse.json({
      users: normalizedUsers,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch users", detail },
      { status: 500 },
    );
  }
}
