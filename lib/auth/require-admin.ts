import prisma from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AdminOk = {
  ok: true;
  userId: string;
  supabaseId: string;
  role: "ADMIN" | "SUPER_ADMIN";
};

type AdminFail = {
  ok: false;
  error: string;
  status: 401 | 403 | 404;
};

export async function requireAdmin(): Promise<AdminOk | AdminFail> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();

  if (error || !authUser) {
    return { ok: false, error: "Unauthorized", status: 401 };
  }

  const user = await prisma.user.findUnique({
    where: { supabaseId: authUser.id },
    select: { id: true, role: true },
  });

  if (!user) {
    return { ok: false, error: "User not found", status: 404 };
  }

  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Forbidden", status: 403 };
  }

  return {
    ok: true,
    userId: user.id,
    supabaseId: authUser.id,
    role: user.role,
  };
}
