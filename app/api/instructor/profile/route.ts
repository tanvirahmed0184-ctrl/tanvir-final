import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function toStringArray(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return undefined;
  return value
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 50);
}

async function requireInstructorOrAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();

  if (error || !authUser) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const user = await prisma.user.findUnique({
    where: { supabaseId: authUser.id },
    select: { id: true, role: true },
  });

  if (!user) {
    return {
      error: NextResponse.json({ error: "User not found" }, { status: 404 }),
    };
  }

  if (!["INSTRUCTOR", "ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { user };
}

export async function GET() {
  try {
    const auth = await requireInstructorOrAdmin();
    if ("error" in auth) return auth.error;

    const profile = await prisma.instructorProfile.upsert({
      where: { userId: auth.user.id },
      create: { userId: auth.user.id },
      update: {},
    });

    return NextResponse.json({ profile });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch instructor profile", detail },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireInstructorOrAdmin();
    if ("error" in auth) return auth.error;

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const data: {
      headline?: string | null;
      bio?: string | null;
      history?: string | null;
      achievements?: string[];
      specialties?: string[];
      experienceYears?: number | null;
      avatarUrl?: string | null;
    } = {};

    if ("headline" in body) {
      data.headline =
        body.headline == null ? null : String(body.headline).trim();
    }

    if ("bio" in body) {
      data.bio = body.bio == null ? null : String(body.bio).trim();
    }

    if ("history" in body) {
      data.history = body.history == null ? null : String(body.history).trim();
    }

    const achievements = toStringArray(body.achievements);
    if (achievements) {
      data.achievements = achievements;
    }

    const specialties = toStringArray(body.specialties);
    if (specialties) {
      data.specialties = specialties;
    }

    if ("experienceYears" in body) {
      const raw = body.experienceYears;
      if (raw === null || raw === "") {
        data.experienceYears = null;
      } else {
        const value = Number(raw);
        if (Number.isNaN(value) || value < 0 || value > 60) {
          return NextResponse.json(
            { error: "experienceYears must be between 0 and 60" },
            { status: 400 },
          );
        }
        data.experienceYears = Math.floor(value);
      }
    }

    if ("avatarUrl" in body) {
      data.avatarUrl =
        body.avatarUrl == null ? null : String(body.avatarUrl).trim();
    }

    const profile = await prisma.instructorProfile.upsert({
      where: { userId: auth.user.id },
      create: {
        userId: auth.user.id,
        ...data,
      },
      update: data,
    });

    return NextResponse.json({ profile });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to update instructor profile", detail },
      { status: 500 },
    );
  }
}
