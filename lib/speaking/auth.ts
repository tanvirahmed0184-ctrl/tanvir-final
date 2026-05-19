import prisma from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SpeakingAuthResult =
  | { ok: true; authUserId: string; userId: string }
  | { ok: false; status: 401 | 404; error: string };

export async function requireSpeakingUser(): Promise<SpeakingAuthResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();

  if (error || !authUser) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const user = await prisma.user.findUnique({
    where: { supabaseId: authUser.id },
    select: { id: true },
  });

  if (!user) {
    return { ok: false, status: 404, error: "User not found" };
  }

  return { ok: true, authUserId: authUser.id, userId: user.id };
}
