import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      role?: unknown;
      name?: unknown;
    };

    const nameFromBody = typeof body.name === "string" ? body.name : null;
    const nameFromMeta =
      typeof authUser.user_metadata?.name === "string"
        ? (authUser.user_metadata.name as string)
        : null;

    const email = authUser.email;
    if (!email) {
      return NextResponse.json(
        { error: "Authenticated user email not found" },
        { status: 400 },
      );
    }

    const existingBySupabaseId = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      select: { id: true },
    });

    const user = existingBySupabaseId
      ? await prisma.user.update({
          where: { supabaseId: authUser.id },
          data: {
            email,
            name: nameFromBody ?? nameFromMeta ?? undefined,
            isActive: true,
            lastLoginAt: new Date(),
          },
        })
      : await (async () => {
          const existingByEmail = await prisma.user.findUnique({
            where: { email },
            select: { id: true, role: true },
          });

          if (existingByEmail) {
            return prisma.user.update({
              where: { email },
              data: {
                supabaseId: authUser.id,
                name: nameFromBody ?? nameFromMeta ?? undefined,
                isActive: true,
                lastLoginAt: new Date(),
              },
            });
          }

          return prisma.user.create({
            data: {
              supabaseId: authUser.id,
              email,
              name: nameFromBody ?? nameFromMeta,
              role: "STUDENT",
              isActive: true,
              lastLoginAt: new Date(),
            },
          });
        })();

    const profile = await prisma.userProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        onboardingCompleted: false,
      },
      update: {},
    });

    await prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        plan: "free",
        status: "active",
      },
      update: {},
    });

    return NextResponse.json({ user, profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to ensure user", detail: message },
      { status: 500 },
    );
  }
}
