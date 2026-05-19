import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type MePayload = {
  user?: {
    role?: string;
    profile?: {
      onboardingCompleted?: boolean;
    } | null;
  } | null;
};

function dashboardHomeByRole(role: string | undefined): string {
  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    return "/dashboard/admin/analytics";
  }
  if (role === "INSTRUCTOR") {
    return "/dashboard/instructor/availability";
  }
  return "/dashboard/student/overview";
}

async function fetchMe(request: NextRequest): Promise<MePayload | null> {
  try {
    const meRes = await fetch(new URL("/api/auth/me", request.url), {
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
      cache: "no-store",
    });
    if (!meRes.ok) return null;
    return (await meRes.json()) as MePayload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let session = null;

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const {
      data: { session: activeSession },
    } = await supabase.auth.getSession();

    session = activeSession;
  }

  const { pathname } = request.nextUrl;

  if (pathname === "/dashboard") {
    const me = session ? await fetchMe(request) : null;
    const role = me?.user?.role;
    return NextResponse.redirect(
      new URL(dashboardHomeByRole(role), request.url),
    );
  }

  if (pathname.startsWith("/dashboard/") && !session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (
    (pathname.startsWith("/login") || pathname.startsWith("/register")) &&
    session
  ) {
    const me = await fetchMe(request);
    const role = me?.user?.role;
    return NextResponse.redirect(
      new URL(dashboardHomeByRole(role), request.url),
    );
  }

  if (
    session &&
    !pathname.startsWith("/api/") &&
    (pathname === "/onboarding" || pathname.startsWith("/dashboard/"))
  ) {
    const me = await fetchMe(request);
    const role = me?.user?.role;
    const onboardingCompleted = Boolean(me?.user?.profile?.onboardingCompleted);
    const isStudent = role === "STUDENT" || !role;

    if (isStudent) {
      if (pathname === "/onboarding" && onboardingCompleted) {
        return NextResponse.redirect(
          new URL("/dashboard/student/overview", request.url),
        );
      }

      if (pathname.startsWith("/dashboard/") && !onboardingCompleted) {
        return NextResponse.redirect(new URL("/onboarding", request.url));
      }
    } else if (pathname === "/onboarding") {
      return NextResponse.redirect(
        new URL(dashboardHomeByRole(role), request.url),
      );
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/exam-library/:path*",
    "/exam-engine/:path*",
    "/api/:path*",
    "/login",
    "/register",
    "/onboarding",
  ],
};
