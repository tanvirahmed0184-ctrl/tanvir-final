"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  LogOut,
  Search,
  X,
  LayoutDashboard,
  BookOpen,
  Mic,
  BarChart3,
  Users,
  Settings,
  Archive,
  TrendingUp,
  Calendar,
  ClipboardList,
  User,
  CalendarCheck,
  FileText,
  Target,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Role = "STUDENT" | "INSTRUCTOR" | "ADMIN" | "SUPER_ADMIN";

type NavLink = {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

const LINKS: Record<Role, NavLink[]> = {
  STUDENT: [
    { label: "Overview", href: "/dashboard/student/overview", icon: LayoutDashboard },
    { label: "Practice", href: "/exam-library/reading", icon: BookOpen },
    { label: "Speaking", href: "/dashboard/student/speaking", icon: Mic },
    { label: "Progress", href: "/dashboard/student/progress", icon: TrendingUp },
    { label: "Book Instructor", href: "/dashboard/student/book", icon: Calendar },
    { label: "My Bookings", href: "/dashboard/student/bookings", icon: CalendarCheck },
    { label: "Settings", href: "/dashboard/student/settings", icon: Settings },
  ],
  INSTRUCTOR: [
    { label: "Availability", href: "/dashboard/instructor/availability", icon: Calendar },
    { label: "Sessions", href: "/dashboard/instructor/sessions", icon: ClipboardList },
    { label: "Evaluations", href: "/dashboard/instructor/evaluations", icon: FileText },
    { label: "Public Profile", href: "/dashboard/instructor/profile", icon: User },
  ],
  ADMIN: [
    { label: "Studio Hub", href: "/dashboard/admin", icon: LayoutDashboard },
    { label: "Content Studio", href: "/dashboard/admin/content-studio", icon: BookOpen },
    { label: "Test Studio", href: "/dashboard/admin/test-studio", icon: Target },
    { label: "Speaking Studio", href: "/dashboard/admin/speaking-studio", icon: Mic },
    { label: "Analytics", href: "/dashboard/admin/analytics", icon: BarChart3 },
    { label: "Users", href: "/dashboard/admin/users", icon: Users },
    { label: "Settings", href: "/dashboard/admin/settings", icon: Settings },
    { label: "Legacy Tools", href: "/dashboard/admin/legacy", icon: Archive },
  ],
  SUPER_ADMIN: [
    { label: "Studio Hub", href: "/dashboard/admin", icon: LayoutDashboard },
    { label: "Content Studio", href: "/dashboard/admin/content-studio", icon: BookOpen },
    { label: "Test Studio", href: "/dashboard/admin/test-studio", icon: Target },
    { label: "Speaking Studio", href: "/dashboard/admin/speaking-studio", icon: Mic },
    { label: "Analytics", href: "/dashboard/admin/analytics", icon: BarChart3 },
    { label: "Users", href: "/dashboard/admin/users", icon: Users },
    { label: "Settings", href: "/dashboard/admin/settings", icon: Settings },
    { label: "Legacy Tools", href: "/dashboard/admin/legacy", icon: Archive },
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
    <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-dash-sidebar">
      <div className="flex h-full flex-col px-4 py-6">
        <div className="mb-8 h-8 w-28 animate-pulse rounded bg-white/10" />
        <div className="space-y-1.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-lg bg-white/5" />
          ))}
        </div>
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

  const roleLabel = role === "SUPER_ADMIN" ? "Super Admin" : role === "ADMIN" ? "Admin" : role === "INSTRUCTOR" ? "Instructor" : "Student";

  return (
    <div className="flex h-screen overflow-hidden bg-dash-bg">
      {/* Desktop Sidebar */}
      {loading ? (
        <SidebarSkeleton />
      ) : (
        <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-dash-sidebar">
          <div className="flex h-full flex-col">
            {/* Sidebar header */}
            <div className="flex items-center gap-3 px-5 py-5 border-b border-white/8">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-dash-accent text-xs font-bold text-white">
                IF
              </span>
              <div>
                <p className="text-sm font-semibold text-white">IELTS Flow</p>
                <p className="text-[11px] text-white/40">{roleLabel} Workspace</p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
              {links.map((link) => {
                const active = pathname === link.href;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={[
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-150",
                      active
                        ? "bg-dash-sidebar-active text-white shadow-sm"
                        : "text-white/60 hover:bg-dash-sidebar-hover hover:text-white/90",
                    ].join(" ")}
                  >
                    <Icon size={16} className={active ? "text-white" : "text-white/40"} />
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Sidebar footer */}
            <div className="border-t border-white/8 px-3 py-4">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-dash-accent/20 text-xs font-semibold text-dash-accent">
                  {name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-white/80">{name}</p>
                  <p className="text-[11px] text-white/35">{roleLabel}</p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Mobile sidebar overlay */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close menu"
          />
          <aside className="absolute left-0 top-0 h-full w-72 bg-dash-sidebar shadow-2xl">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between px-5 py-5 border-b border-white/8">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-dash-accent text-xs font-bold text-white">
                    IF
                  </span>
                  <p className="text-sm font-semibold text-white">IELTS Flow</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded-md p-1.5 text-white/50 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
                {links.map((link) => {
                  const active = pathname === link.href;
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileNavOpen(false)}
                      className={[
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-150",
                        active
                          ? "bg-dash-sidebar-active text-white"
                          : "text-white/60 hover:bg-dash-sidebar-hover hover:text-white/90",
                      ].join(" ")}
                    >
                      <Icon size={16} className={active ? "text-white" : "text-white/40"} />
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex items-center justify-between border-b border-dash-border bg-dash-surface px-4 lg:px-8 h-14 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile hamburger */}
            <button
              type="button"
              className="lg:hidden rounded-md p-1.5 text-dash-text-muted hover:text-dash-text hover:bg-dash-accent-light"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>

            {/* Breadcrumbs */}
            {breadcrumbs.length > 0 && (
              <nav className="hidden sm:flex items-center gap-1 text-[13px] text-dash-text-muted">
                {breadcrumbs.map((crumb, idx) => (
                  <span key={crumb.href} className="inline-flex items-center gap-1">
                    {idx > 0 && <ChevronRight size={12} className="text-dash-text-light" />}
                    {idx === breadcrumbs.length - 1 ? (
                      <span className="font-medium text-dash-text">{crumb.label}</span>
                    ) : (
                      <Link href={crumb.href} className="hover:text-dash-accent transition-colors">
                        {crumb.label}
                      </Link>
                    )}
                  </span>
                ))}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isAdminLike && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSearchOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-dash-border bg-dash-bg px-3 py-1.5 text-[13px] text-dash-text-muted hover:border-dash-accent/30 hover:text-dash-accent transition-colors"
              >
                <Search size={14} />
                <span className="hidden sm:inline">Search</span>
                <kbd className="hidden sm:inline ml-2 text-[11px] font-mono text-dash-text-light bg-dash-surface border border-dash-border rounded px-1 py-0.5">⌘K</kbd>
              </button>
            )}
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-dash-text-muted hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">{signingOut ? "Signing Out..." : "Sign Out"}</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] px-4 lg:px-8 py-6">
            {children}
          </div>
        </main>
      </div>

      {/* Global Search Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-60 flex items-start justify-center pt-[15vh] bg-black/30 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-xl border border-dash-border bg-dash-surface shadow-2xl">
            <div className="flex items-center gap-3 border-b border-dash-border px-4 py-3">
              <Search size={16} className="text-dash-text-muted shrink-0" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search passages, questions, tests, speaking sets..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-dash-text-light"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="shrink-0 rounded-md border border-dash-border px-2 py-0.5 text-xs text-dash-text-muted hover:bg-dash-bg"
              >
                ESC
              </button>
            </div>

            <div className="max-h-[50vh] overflow-y-auto">
              {searchLoading ? (
                <div className="p-6 text-center text-sm text-dash-text-muted">Loading...</div>
              ) : filteredSearchItems.length ? (
                <div className="py-2">
                  {filteredSearchItems.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => setSearchOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-dash-accent-light/50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-dash-text">{item.title}</p>
                        <p className="truncate text-xs text-dash-text-muted">{item.subtitle}</p>
                      </div>
                      <ChevronRight size={14} className="text-dash-text-light shrink-0" />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-sm text-dash-text-muted">
                  No results found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
