import Link from "next/link";
import {
  Facebook,
  Instagram,
  MapPin,
  Phone,
  Youtube,
  ArrowUpRight,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import MarketingNav from "@/components/marketing/marketing-nav";

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
    title: "Company",
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
    <div className="min-h-screen bg-white text-slate-900">
      <MarketingNav isLoggedIn={isLoggedIn} />

      <main>{children}</main>

      <footer className="relative bg-brand-navy text-white overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-50" />
        <div className="relative z-10 mx-auto max-w-[1400px] px-6 lg:px-12 pt-20 pb-8">
          <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-5">
              <Link href="/" className="inline-flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-teal text-sm font-bold text-white">
                  IF
                </span>
                <span className="text-lg font-bold tracking-tight text-white">
                  IELTS Flow
                </span>
              </Link>
              <p className="text-sm text-white/60 leading-relaxed max-w-xs">
                AI-powered IELTS preparation with mock tests, speaking
                simulations, and progress analytics.
              </p>
              <div className="space-y-2 text-sm text-white/50">
                <p className="inline-flex items-center gap-2">
                  <MapPin size={14} />
                  Dhaka, Bangladesh
                </p>
                <p className="inline-flex items-center gap-2">
                  <Phone size={14} />
                  +880-1700-000000
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                {[
                  { icon: Facebook, href: "https://facebook.com", label: "Facebook" },
                  { icon: Instagram, href: "https://instagram.com", label: "Instagram" },
                  { icon: Youtube, href: "https://youtube.com", label: "YouTube" },
                ].map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={social.label}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/50 transition-all hover:border-white/25 hover:text-white hover:bg-white/5"
                  >
                    <social.icon size={15} />
                  </a>
                ))}
              </div>
            </div>

            {FOOTER_GROUPS.map((group) => (
              <div key={group.title}>
                <h3 className="mb-5 text-xs font-mono-brand font-semibold uppercase tracking-[0.2em] text-white/40">
                  {group.title}
                </h3>
                <ul className="space-y-3 text-sm">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      {link.external ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className="group inline-flex items-center gap-1 text-white/60 transition-colors hover:text-white"
                        >
                          {link.label}
                          <ArrowUpRight size={12} className="opacity-0 -translate-y-0.5 translate-x-0.5 transition-all group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0" />
                        </a>
                      ) : (
                        <Link
                          href={link.href}
                          className="text-white/60 transition-colors hover:text-white"
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

          <div className="mt-16 border-t border-white/10 pt-6 flex flex-col items-start justify-between gap-3 text-xs text-white/40 sm:flex-row sm:items-center">
            <p>© {new Date().getFullYear()} IELTS Flow. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link href="/" className="hover:text-white/70 transition-colors">
                Privacy
              </Link>
              <Link href="/" className="hover:text-white/70 transition-colors">
                Terms
              </Link>
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse-slow" />
                All systems operational
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
