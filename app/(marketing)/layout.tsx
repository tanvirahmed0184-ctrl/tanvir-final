import Link from "next/link";
import {
  Facebook,
  Instagram,
  Mail,
  MapPin,
  Phone,
  Youtube,
} from "lucide-react";
import MobileNav from "@/components/layout/mobile-nav";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Practice Test", href: "/exam-library/listening" },
  { label: "Speaking", href: "/dashboard/student/speaking" },
];

const FOOTER_GROUPS = [
  {
    title: "Practice Tests",
    links: [
      { label: "Listening", href: "/exam-library/listening" },
      { label: "Reading", href: "/exam-library/reading" },
      { label: "Writing", href: "/exam-library/writing" },
      { label: "Speaking", href: "/dashboard/student/speaking" },
    ],
  },
  {
    title: "Company Links",
    links: [
      { label: "About", href: "/" },
      { label: "Features", href: "/" },
      { label: "Pricing", href: "/pricing" },
      { label: "Contact", href: "/" },
      { label: "FAQ", href: "/" },
    ],
  },
  {
    title: "Contact",
    links: [
      { label: "support@ieltsflow.ai", href: "mailto:support@ieltsflow.ai" },
      { label: "+880-1700-000000", href: "tel:+8801700000000" },
      {
        label: "BC Exam Dates",
        href: "https://www.britishcouncil.org.bd/en/exam/ielts/dates-fees-locations",
        external: true,
      },
    ],
  },
];

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoggedIn = Boolean(user);

  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-900">
      <div className="bg-gradient-to-r from-brand-purple to-brand-purple-light text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 text-xs sm:text-sm">
          <div className="inline-flex items-center gap-2 text-white/90">
            <Mail size={14} />
            <span>support@ieltsflow.ai</span>
          </div>
          <div className="flex items-center gap-3 text-white/85">
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noreferrer"
              aria-label="Facebook"
            >
              <Facebook size={14} />
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
            >
              <Instagram size={14} />
            </a>
            <a
              href="https://youtube.com"
              target="_blank"
              rel="noreferrer"
              aria-label="YouTube"
            >
              <Youtube size={14} />
            </a>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-40 w-full border-b border-white/20 bg-gradient-to-r from-brand-purple to-brand-purple-light text-white backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-xs font-bold text-white ring-1 ring-white/30">
              IF
            </span>
            <span className="text-base font-bold tracking-tight text-white">
              IELTS Flow
            </span>
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-white transition hover:text-white/85"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/pricing"
              className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition hover:shadow-md hover:brightness-110"
            >
              Plans
            </Link>
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            {isLoggedIn ? (
              <Link
                href="/dashboard/student/overview"
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-brand-purple shadow-sm transition hover:bg-slate-100"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-xl border border-white/60 bg-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/25"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-brand-purple shadow-sm transition hover:bg-slate-100"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          <div className="ml-auto md:hidden">
            <MobileNav />
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="mt-16 bg-slate-900 text-white">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-purple to-brand-teal text-xs font-bold text-white">
                IF
              </span>
              <span className="text-base font-bold text-white">IELTS Flow</span>
            </Link>
            <p className="text-sm text-slate-300">
              AI-powered IELTS preparation with mock tests, speaking
              simulations, and progress analytics.
            </p>
            <div className="space-y-2 text-sm text-slate-300">
              <p className="inline-flex items-center gap-2">
                <MapPin size={14} />
                Dhaka, Bangladesh
              </p>
              <p className="inline-flex items-center gap-2">
                <Phone size={14} />
                +880-1700-000000
              </p>
            </div>
          </div>

          {FOOTER_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-white/95">
                {group.title}
              </h3>
              <ul className="space-y-2 text-sm text-slate-300">
                {group.links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="transition hover:text-white"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="transition hover:text-white"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-4 py-4 text-xs text-slate-400 sm:flex-row sm:items-center">
            <p>© {new Date().getFullYear()} IELTS Flow. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <Link href="/" className="hover:text-slate-200">
                Privacy
              </Link>
              <Link href="/" className="hover:text-slate-200">
                Terms
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
