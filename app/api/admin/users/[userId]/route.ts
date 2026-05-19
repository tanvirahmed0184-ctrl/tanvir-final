import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  role?: unknown;
  plan?: unknown;
  subscriptionStatus?: unknown;
};

type AllowedRole = "GUEST" | "STUDENT" | "INSTRUCTOR" | "ADMIN" | "SUPER_ADMIN";
type AllowedPlan = "free" | "pro" | "premium";
type AllowedSubscriptionStatus =
  | "active"
  | "inactive"
  | "cancelled"
  | "past_due"
  | "trialing";

const ROLES: AllowedRole[] = [
  "GUEST",
  "STUDENT",
  "INSTRUCTOR",
  "ADMIN",
  "SUPER_ADMIN",
];
const PLANS: AllowedPlan[] = ["free", "pro", "premium"];
const SUBSCRIPTION_STATUSES: AllowedSubscriptionStatus[] = [
  "active",
  "inactive",
  "cancelled",
  "past_due",
  "trialing",
];

function parseRole(value: unknown): AllowedRole | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return ROLES.includes(normalized as AllowedRole)
    ? (normalized as AllowedRole)
    : null;
}

function parsePlan(value: unknown): AllowedPlan | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return PLANS.includes(normalized as AllowedPlan)
    ? (normalized as AllowedPlan)
    : null;
}

function parseSubscriptionStatus(value: unknown): AllowedSubscriptionStatus | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return SUBSCRIPTION_STATUSES.includes(normalized as AllowedSubscriptionStatus)
    ? (normalized as AllowedSubscriptionStatus)
    : null;
}

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
    select: { id: true, role: true },
  });

  if (!user) {
    return { error: "User not found", status: 404 as const };
  }

  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    return { error: "Forbidden", status: 403 as const };
  }

  return { user };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { userId } = await context.params;
    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const role = parseRole(body.role);
    const plan = parsePlan(body.plan);
    const subscriptionStatus = parseSubscriptionStatus(body.subscriptionStatus);

    if (!role && !plan && !subscriptionStatus) {
      return NextResponse.json(
        {
          error:
            "Provide at least one valid field: role, plan, or subscriptionStatus",
        },
        { status: 400 },
      );
    }

    if (
      role &&
      auth.user.id === userId &&
      role !== "ADMIN" &&
      role !== "SUPER_ADMIN"
    ) {
      return NextResponse.json(
        { error: "You cannot remove your own admin access" },
        { status: 400 },
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const user = role
        ? await tx.user.update({
            where: { id: userId },
            data: { role },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              createdAt: true,
            },
          })
        : await tx.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              createdAt: true,
            },
          });

      if (!user) {
        throw Object.assign(new Error("User not found"), { code: "P2025" });
      }

      if (plan || subscriptionStatus) {
        await tx.subscription.upsert({
          where: { userId },
          create: {
            userId,
            plan: plan || "free",
            status: subscriptionStatus || "active",
          },
          update: {
            ...(plan ? { plan } : {}),
            ...(subscriptionStatus ? { status: subscriptionStatus } : {}),
          },
        });
      }

      const subscription = await tx.subscription.findUnique({
        where: { userId },
        select: { plan: true, status: true },
      });

      return {
        ...user,
        subscription,
      };
    });

    return NextResponse.json({
      user: {
        id: updated.id,
        name: updated.name || "Unnamed User",
        email: updated.email,
        role: updated.role,
        plan: updated.subscription?.plan || "free",
        subscriptionStatus: updated.subscription?.status || "active",
        createdAt: updated.createdAt.toISOString().slice(0, 10),
      },
    });
  } catch (error) {
    const known = error as { code?: string };
    if (known?.code === "P2025") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to update user role", detail },
      { status: 500 },
    );
  }
}
