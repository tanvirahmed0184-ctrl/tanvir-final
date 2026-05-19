"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Menu, X, LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type NavItem = {
  label: string;
  href: string;
  external?: boolean;
  requiresAuth?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Listening", href: "/exam-library/listening" },
  { label: "Reading", href: "/exam-library/reading" },
  { label: "Writing", href: "/exam-library/writing" },
  { label: "Speaking", href: "/dashboard/student/speaking" },
  { label: "Pricing", href: "/pricing" },
  {
    label: "BC Exam Dates",
    href: "https://www.britishcouncil.org.bd/en/exam/ielts/dates-fees-locations",
    external: true,
  },
  {
    label: "Dashboard",
    href: "/dashboard/student/overview",
    requiresAuth: true,
  },
];

export default function MobileNav() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [open, setOpen] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setIsAuthed(Boolean(data.session));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setIsAuthed(Boolean(session));
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await supabase.auth.signOut();
      setOpen(false);
      router.push("/");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.requiresAuth ? isAuthed : true,
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white backdrop-blur md:hidden"
        aria-label="Open mobile menu"
      >
        <Menu size={18} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close mobile menu overlay"
            className="absolute inset-0 bg-slate-950/55"
            onClick={() => setOpen(false)}
          />

          <aside className="absolute right-0 top-0 h-full w-[88%] max-w-sm border-l border-white/10 bg-gradient-to-b from-brand-purple via-brand-purple-dark to-brand-teal p-4 text-white shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold tracking-wide">
                IELTS Flow Menu
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-white/10"
                aria-label="Close mobile menu"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="space-y-1">
              {visibleItems.map((item) => {
                const active = !item.external && pathname === item.href;
                const classes = [
                  "block rounded-xl px-3 py-2.5 text-sm transition",
                  active
                    ? "bg-white/20 font-semibold"
                    : "hover:bg-white/15 text-white/95",
                ].join(" ");

                if (item.external) {
                  return (
                    <a
                      key={item.label}
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className={classes}
                      onClick={() => setOpen(false)}
                    >
                      {item.label}
                    </a>
                  );
                }

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={classes}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-5 border-t border-white/15 pt-4">
              {!isAuthed ? (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/login"
                    className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-center text-sm font-medium"
                    onClick={() => setOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    className="rounded-lg bg-white px-3 py-2 text-center text-sm font-semibold text-brand-purple"
                    onClick={() => setOpen(false)}
                  >
                    Get Started
                  </Link>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-brand-purple disabled:opacity-70"
                >
                  <LogOut size={16} />
                  {isSigningOut ? "Signing Out..." : "Sign Out"}
                </button>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
