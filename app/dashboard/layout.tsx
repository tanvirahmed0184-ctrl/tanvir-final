"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LogOut, Search, UserCircle2, X } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Role = "STUDENT" | "INSTRUCTOR" | "ADMIN" | "SUPER_ADMIN";

const LINKS: Record<Role, Array<{ label: string; href: string }>> = {
  STUDENT: [
    { label: "Overview", href: "/dashboard/student/overview" },
    { label: "Practice", href: "/exam-library/reading" },
    { label: "Speaking", href: "/dashboard/student/speaking" },
    { label: "Progress", href: "/dashboard/student/progress" },
    { label: "Book Instructor", href: "/dashboard/student/book" },
    { label: "My Bookings", href: "/dashboard/student/bookings" },
    { label: "Settings", href: "/dashboard/student/settings" },
  ],
  INSTRUCTOR: [
    { label: "Availability", href: "/dashboard/instructor/availability" },
    { label: "Sessions", href: "/dashboard/instructor/sessions" },
    { label: "Evaluations", href: "/dashboard/instructor/evaluations" },
    { label: "Public Profile", href: "/dashboard/instructor/profile" },
  ],
  ADMIN: [
    { label: "Studio Hub", href: "/dashboard/admin" },
    { label: "Content Studio", href: "/dashboard/admin/content-studio" },
    { label: "Test Studio", href: "/dashboard/admin/test-studio" },
    { label: "Speaking Studio", href: "/dashboard/admin/speaking-studio" },
    { label: "Analytics", href: "/dashboard/admin/analytics" },
    { label: "Users", href: "/dashboard/admin/users" },
    { label: "Settings", href: "/dashboard/admin/settings" },
    { label: "Legacy Tools", href: "/dashboard/admin/legacy" },
  ],
  SUPER_ADMIN: [
    { label: "Studio Hub", href: "/dashboard/admin" },
    { label: "Content Studio", href: "/dashboard/admin/content-studio" },
    { label: "Test Studio", href: "/dashboard/admin/test-studio" },
    { label: "Speaking Studio", href: "/dashboard/admin/speaking-studio" },
    { label: "Analytics", href: "/dashboard/admin/analytics" },
    { label: "Users", href: "/dashboard/admin/users" },
    { label: "Settings", href: "/dashboard/admin/settings" },
    { label: "Legacy Tools", href: "/dashboard/admin/legacy" },
  ],
};

type GlobalSearchItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  type: "passage" | "question" | "test" | "speaking_set";
};

function toTitleCase(input: string): string {
  return input
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (x) => x.toUpperCase());
}

function buildBreadcrumb(pathname: string): Array<{ label: string; href: string }> {
  const chunks = pathname.split("/").filter(Boolean);
  const startIdx = chunks.indexOf("dashboard");
  if (startIdx === -1) return [];
  const crumbs: Array<{ label: string; href: string }> = [];
  for (let i = startIdx; i < chunks.length; i += 1) {
    const path = `/${chunks.slice(0, i + 1).join("/")}`;
    const label = toTitleCase(chunks[i]);
    crumbs.push({ label, href: path });
  }
  return crumbs;
}

function SidebarSkeleton() {
  return (
    <aside className="w-full rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm lg:w-72">
      <div className="mb-4 h-8 w-32 animate-pulse rounded bg-slate-200" />
      <div className="space-y-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-9 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    </aside>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [signingOut, setSigningOut] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchItems, setSearchItems] = useState<GlobalSearchItem[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  async function signOut() {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  const rawRole = typeof user?.role === "string" ? user.role : "STUDENT";
  const role: Role =
    rawRole === "ADMIN" || rawRole === "SUPER_ADMIN" || rawRole === "INSTRUCTOR"
      ? (rawRole as Role)
      : "STUDENT";
  const name = (typeof user?.name === "string" && user.name.trim()) || "User";
  const links = LINKS[role];
  const breadcrumbs = useMemo(() => buildBreadcrumb(pathname), [pathname]);
  const isAdminLike = role === "ADMIN" || role === "SUPER_ADMIN";

  useEffect(() => {
    if (!searchOpen || !isAdminLike) return;
    let active = true;
    setSearchLoading(true);

    Promise.all([
      fetch("/api/admin/passages?lite=1", { cache: "no-store" }),
      fetch("/api/admin/question-bank/upload-csv", { cache: "no-store" }),
      fetch("/api/tests?fresh=1", { cache: "no-store" }),
    ])
      .then(async ([passagesRes, questionsRes, testsRes]) => {
        const passagesData = (await passagesRes.json().catch(() => null)) as
          | {
              passages?: Array<{
                id: string;
                title: string;
                module: string;
                sectionPart: number;
              }>;
            }
          | null;
        const questionsData = (await questionsRes.json().catch(() => null)) as
          | {
              rows?: Array<{
                id: string;
                questionText: string;
                type: string;
                module: string;
              }>;
            }
          | null;
        const testsData = (await testsRes.json().catch(() => null)) as
          | {
              tests?: Array<{
                id: string;
                title: string;
                module: string;
                speakingPromptSets?: Array<{ id: string; name: string }>;
              }>;
            }
          | null;

        if (!active) return;

        const items: GlobalSearchItem[] = [];

        (passagesData?.passages || []).forEach((passage) => {
          items.push({
            id: `passage-${passage.id}`,
            title: passage.title,
            subtitle: `Passage • ${passage.module} Part ${passage.sectionPart}`,
            href: "/dashboard/admin/content-studio",
            type: "passage",
          });
        });

        (questionsData?.rows || []).slice(0, 200).forEach((question) => {
          items.push({
            id: `question-${question.id}`,
            title: question.questionText,
            subtitle: `Question • ${question.type} • ${question.module}`,
            href: "/dashboard/admin/content-studio",
            type: "question",
          });
        });

        (testsData?.tests || []).forEach((test) => {
          items.push({
            id: `test-${test.id}`,
            title: test.title,
            subtitle: `Test • ${test.module}`,
            href: "/dashboard/admin/test-studio",
            type: "test",
          });
          if (test.module === "SPEAKING" && Array.isArray(test.speakingPromptSets)) {
            test.speakingPromptSets.forEach((set) => {
              items.push({
                id: `speaking-set-${test.id}-${set.id}`,
                title: set.name,
                subtitle: `Speaking Set • ${test.title}`,
                href: "/dashboard/admin/speaking-studio",
                type: "speaking_set",
              });
            });
          }
        });

        setSearchItems(items);
      })
      .catch(() => {
        if (!active) return;
        setSearchItems([]);
      })
      .finally(() => {
        if (!active) return;
        setSearchLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isAdminLike, searchOpen]);

  const filteredSearchItems = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return searchItems.slice(0, 30);
    return searchItems
      .filter(
        (item) =>
          item.title.toLowerCase().includes(needle) ||
          item.subtitle.toLowerCase().includes(needle),
      )
      .slice(0, 50);
  }, [searchItems, searchQuery]);

  return (
    <div className="mx-auto max-w-350 px-4 py-6">
      <div className="grid gap-4 lg:grid-cols-[288px_1fr]">
        {loading ? (
          <SidebarSkeleton />
        ) : (
          <aside className="h-fit rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm lg:sticky lg:top-4">
            <h2 className="mb-3 text-base font-bold text-slate-900">
              Dashboard
            </h2>
            <nav className="space-y-1">
              {links.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={[
                      "block rounded-lg px-3 py-2 text-sm font-medium transition",
                      active
                        ? "bg-brand-purple text-white"
                        : "text-slate-700 hover:bg-brand-purple/5 hover:text-brand-purple",
                    ].join(" ")}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        )}

        <section className="space-y-4">
          <header className="flex items-center justify-between rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
            <div className="min-w-0 space-y-1">
              <div className="inline-flex items-center gap-2 text-slate-800">
                <UserCircle2 className="text-brand-purple" size={20} />
                <span className="text-sm font-semibold">
                  {loading ? "Loading..." : name}
                </span>
              </div>
              {breadcrumbs.length ? (
                <nav className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
                  {breadcrumbs.map((crumb, idx) => (
                    <span key={crumb.href} className="inline-flex items-center gap-1">
                      {idx > 0 ? <span>/</span> : null}
                      {idx === breadcrumbs.length - 1 ? (
                        <span className="font-semibold text-slate-700">{crumb.label}</span>
                      ) : (
                        <Link href={crumb.href} className="hover:text-brand-purple">
                          {crumb.label}
                        </Link>
                      )}
                    </span>
                  ))}
                </nav>
              ) : null}
            </div>

            <div className="inline-flex items-center gap-2">
              {isAdminLike ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchOpen(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Search size={16} />
                  Global Search
                </button>
              ) : null}
              <button
                type="button"
                onClick={signOut}
                disabled={signingOut}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <LogOut size={16} />
                {signingOut ? "Signing Out..." : "Sign Out"}
              </button>
            </div>
          </header>

          <div>{children}</div>
        </section>
      </div>

      {searchOpen ? (
        <div className="fixed inset-0 z-60 grid place-items-center bg-slate-950/45 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-brand-purple/20 bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-slate-900">Global Search</h2>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="rounded-md border border-slate-300 p-1 text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search passages, questions, tests, speaking sets..."
              className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
              autoFocus
            />

            <div className="mt-3 max-h-[55vh] overflow-y-auto rounded-xl border border-slate-200">
              {searchLoading ? (
                <div className="p-4 text-sm text-slate-500">Loading search data...</div>
              ) : filteredSearchItems.length ? (
                filteredSearchItems.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setSearchOpen(false)}
                    className="block border-b border-slate-100 px-3 py-2 hover:bg-slate-50"
                  >
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-500">{item.subtitle}</p>
                  </Link>
                ))
              ) : (
                <div className="p-4 text-sm text-slate-500">No matches found.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
