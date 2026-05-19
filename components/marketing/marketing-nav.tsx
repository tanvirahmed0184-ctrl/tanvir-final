"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import MobileNav from "@/components/layout/mobile-nav";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Practice Test", href: "/exam-library/listening" },
  { label: "Speaking", href: "/dashboard/student/speaking" },
];

export default function MarketingNav({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed z-50 transition-all duration-500 ${
        isScrolled
          ? "top-4 left-4 right-4"
          : "top-0 left-0 right-0"
      }`}
    >
      <nav
        className={`mx-auto transition-all duration-500 ${
          isScrolled
            ? "bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-lg shadow-slate-900/5 max-w-[1200px]"
            : "bg-transparent max-w-[1400px]"
        }`}
      >
        <div
          className={`flex items-center justify-between transition-all duration-500 px-6 lg:px-8 ${
            isScrolled ? "h-14" : "h-20"
          }`}
        >
          <Link href="/" className="flex items-center gap-2.5 group">
            <span
              className={`inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-teal font-bold text-white transition-all duration-500 ${
                isScrolled ? "h-8 w-8 text-xs" : "h-9 w-9 text-sm"
              }`}
            >
              IF
            </span>
            <span
              className={`font-bold tracking-tight transition-all duration-500 ${
                isScrolled
                  ? "text-base text-slate-900"
                  : "text-lg text-white"
              }`}
            >
              IELTS Flow
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-10">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className={`text-sm font-medium transition-all duration-300 relative group ${
                  isScrolled
                    ? "text-slate-600 hover:text-slate-900"
                    : "text-white/80 hover:text-white"
                }`}
              >
                {link.label}
                <span
                  className={`absolute -bottom-1 left-0 w-0 h-px transition-all duration-300 group-hover:w-full ${
                    isScrolled ? "bg-brand-purple" : "bg-white"
                  }`}
                />
              </Link>
            ))}
            <Link
              href="/pricing"
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                isScrolled
                  ? "bg-gradient-to-r from-brand-purple to-brand-purple-light text-white shadow-sm hover:shadow-md"
                  : "bg-white/15 text-white border border-white/20 hover:bg-white/25"
              }`}
            >
              Plans
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-3">
            {isLoggedIn ? (
              <Link
                href="/dashboard/student/overview"
                className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all duration-300 ${
                  isScrolled
                    ? "bg-brand-purple text-white hover:bg-brand-purple-dark"
                    : "bg-white text-brand-purple hover:bg-white/90"
                }`}
              >
                Dashboard
                <ArrowRight size={14} />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 ${
                    isScrolled
                      ? "text-slate-600 hover:text-slate-900"
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all duration-300 group ${
                    isScrolled
                      ? "bg-brand-purple text-white hover:bg-brand-purple-dark shadow-sm"
                      : "bg-white text-brand-navy hover:bg-white/90"
                  }`}
                >
                  Get Started
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              </>
            )}
          </div>

          <div className="ml-auto md:hidden">
            <MobileNav />
          </div>
        </div>
      </nav>
    </header>
  );
}
