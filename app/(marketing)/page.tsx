"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Headphones,
  Mic,
  PenLine,
  UserCheck,
  Target,
  BarChart3,
  BookOpenText,
  Zap,
  Globe2,
  ShieldCheck,
} from "lucide-react";
import InstructorCarousel from "@/components/marketing/instructor-carousel";
import IeltsJournalFeed from "@/components/marketing/ielts-journal-feed";

const skillCards = [
  {
    title: "Listening",
    description:
      "Audio-based practice with IELTS-style question flow and instant checking.",
    href: "/exam-library/listening",
    icon: Headphones,
    accent: "from-blue-500 to-blue-600",
    accentLight: "bg-blue-500/10 text-blue-600",
    number: "01",
  },
  {
    title: "Reading",
    description:
      "Passage-based tests with navigation, timing, and review-ready analytics.",
    href: "/exam-library/reading",
    icon: ClipboardCheck,
    accent: "from-emerald-500 to-emerald-600",
    accentLight: "bg-emerald-500/10 text-emerald-600",
    number: "02",
  },
  {
    title: "Writing",
    description:
      "Task 1 and Task 2 support with AI examiner feedback and rewrites.",
    href: "/exam-library/writing",
    icon: PenLine,
    accent: "from-amber-500 to-orange-500",
    accentLight: "bg-amber-500/10 text-amber-600",
    number: "03",
  },
  {
    title: "Speaking",
    description:
      "Practice with an AI speaking examiner and structured band feedback.",
    href: "/dashboard/student/speaking",
    icon: Mic,
    accent: "from-purple-500 to-purple-600",
    accentLight: "bg-purple-500/10 text-purple-600",
    number: "04",
  },
];

const heroWords = ["master", "achieve", "conquer", "excel"];

const mockTestCards = [
  {
    title: "Academic IELTS Mock",
    subtitle: "Reading + Writing + Listening",
    meta: "40 Questions | Full Time",
    icon: Target,
  },
  {
    title: "General Training Mock",
    subtitle: "Reading + Writing + Listening",
    meta: "2 Modules | Full Time",
    icon: BarChart3,
  },
  {
    title: "Quick Practice Drill",
    subtitle: "Timed skill-by-skill sprint",
    meta: "20 Minutes | Instant Results",
    icon: Zap,
  },
];

const scoreFeatures = [
  "Predict your likely IELTS band from real scoring tables",
  "Question-by-question accuracy with explanation",
  "Highlight weak areas with actionable next steps",
  "Track band movement over time and by module",
];

const whyPanels = [
  {
    title: "Exam-native structure",
    label: "Authentic flow",
    description:
      "Practice inside IELTS-style timing, navigation, section logic, and scoring expectations instead of disconnected drills.",
    icon: BookOpenText,
  },
  {
    title: "Human teaching layer",
    label: "Expert guidance",
    description:
      "Learners can move from AI feedback to real instructor coaching when they need sharper diagnosis and accountability.",
    icon: UserCheck,
  },
  {
    title: "Progress intelligence",
    label: "Clear analytics",
    description:
      "Band trends, weak areas, and attempt history turn practice into a measurable preparation system.",
    icon: BarChart3,
  },
  {
    title: "Global learner fit",
    label: "Academic + General",
    description:
      "The platform supports multiple IELTS goals with a calm interface designed for long study sessions.",
    icon: Globe2,
  },
  {
    title: "Safe learning engine",
    label: "Trusted workflow",
    description:
      "Content, tests, and speaking sets follow structured publishing flows so students receive consistent practice.",
    icon: ShieldCheck,
  },
];

const stats = [
  { label: "Active Students", value: "50K+" },
  { label: "Mock Tests Taken", value: "10K+" },
  { label: "Avg Band Gain", value: "+1.2" },
  { label: "Platform Rating", value: "4.9/5" },
];

function SectionReveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={sectionRef}
      className={`transition-all duration-700 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export default function MarketingHomePage() {
  const [wordIndex, setWordIndex] = useState(0);
  const [activeWhy, setActiveWhy] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % heroWords.length);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full overflow-x-hidden">
      {/* ===== HERO SECTION ===== */}
      <section className="relative min-h-screen flex flex-col justify-center overflow-hidden bg-brand-navy noise-overlay">
        <div className="absolute inset-0 grid-bg" />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-purple/20 via-transparent to-brand-navy" />
        <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] rounded-full bg-brand-purple/10 blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-brand-teal/8 blur-[100px]" />

        <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12 pt-32 lg:pt-40 pb-24">
          <div className="mb-8 animate-fade-up" style={{ animationDelay: "100ms" }}>
            <span className="inline-flex items-center gap-3 text-sm font-mono text-white/50">
              <span className="w-8 h-px bg-brand-teal/60" />
              AI-Powered IELTS Preparation
            </span>
          </div>

          <div className="mb-12">
            <h1 className="text-[clamp(2.5rem,8vw,7rem)] font-display leading-[0.95] tracking-tight text-white animate-fade-up" style={{ animationDelay: "200ms", animationDuration: "1s" }}>
              <span className="block">The smarter way</span>
              <span className="block">
                to{" "}
                <span className="relative inline-block">
                  <span key={wordIndex} className="inline-flex text-gradient-purple" style={{ WebkitTextFillColor: "unset" }}>
                    {heroWords[wordIndex].split("").map((char, i) => (
                      <span
                        key={`${wordIndex}-${i}`}
                        className="inline-block animate-char-in"
                        style={{ animationDelay: `${i * 60}ms` }}
                      >
                        {char}
                      </span>
                    ))}
                  </span>
                </span>
              </span>
              <span className="block text-white/40">IELTS.</span>
            </h1>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-end">
            <p className="text-lg lg:text-xl text-white/60 leading-relaxed max-w-xl animate-fade-up" style={{ animationDelay: "400ms" }}>
              Practice all 4 IELTS skills with realistic exam flow, instant AI
              scoring, and personalized feedback designed to move your band
              score faster.
            </p>

            <div className="flex flex-col sm:flex-row items-start gap-4 animate-fade-up" style={{ animationDelay: "500ms" }}>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-brand-navy transition-all hover:bg-white/90 hover:shadow-lg hover:shadow-white/10 group"
              >
                Start Free Today
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white transition-all hover:bg-white/10 hover:border-white/25"
              >
                View Plans
              </Link>
            </div>
          </div>
        </div>

        {/* Stats marquee */}
        <div className="relative z-10 border-t border-white/5 mt-auto animate-fade-up" style={{ animationDelay: "700ms" }}>
          <div className="overflow-hidden">
            <div className="flex gap-0 marquee whitespace-nowrap py-5 lg:py-6">
              {[...Array(2)].map((_, setIdx) => (
                <div key={setIdx} className="flex gap-0 shrink-0">
                  {stats.map((stat) => (
                    <div
                      key={`${stat.label}-${setIdx}`}
                      className="flex items-baseline gap-2 sm:gap-3 px-6 sm:px-10 border-r border-white/5"
                    >
                      <span className="text-2xl sm:text-3xl lg:text-4xl font-display text-white">
                        {stat.value}
                      </span>
                      <span className="text-[10px] sm:text-xs text-white/40 font-mono">
                        {stat.label}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== SKILLS SECTION ===== */}
      <section className="relative py-24 lg:py-32 bg-white">
        <div className="absolute inset-0 grid-bg-light" />
        <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">
          <SectionReveal>
            <div className="mb-16 lg:mb-20">
              <span className="inline-flex items-center gap-3 text-sm font-mono text-slate-400 mb-5">
                <span className="w-8 h-px bg-brand-purple/40" />
                Core Skills
              </span>
              <h2 className="text-4xl lg:text-6xl font-display tracking-tight">
                Practice all four skills.
                <br />
                <span className="text-slate-400">Train smarter.</span>
              </h2>
            </div>
          </SectionReveal>

          <div className="space-y-0">
            {skillCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <SectionReveal key={card.title} delay={index * 100}>
                  <Link
                    href={card.href}
                    className="group flex flex-col lg:flex-row gap-6 lg:gap-12 py-8 lg:py-10 border-b border-slate-100"
                  >
                    <div className="shrink-0 w-12">
                      <span className="font-mono text-sm text-slate-300">
                        {card.number}
                      </span>
                    </div>
                    <div className="flex-1 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-12">
                      <div className="flex-1">
                        <h3 className="text-2xl lg:text-3xl font-display mb-2 group-hover:translate-x-2 transition-transform duration-500">
                          {card.title}
                        </h3>
                        <p className="text-base text-slate-500 leading-relaxed max-w-lg">
                          {card.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${card.accentLight}`}>
                          <Icon size={22} />
                        </div>
                        <ArrowRight
                          size={20}
                          className="text-slate-300 transition-all duration-300 group-hover:text-brand-purple group-hover:translate-x-1"
                        />
                      </div>
                    </div>
                  </Link>
                </SectionReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== MOCK TESTS SECTION ===== */}
      <section className="relative py-24 lg:py-32 bg-slate-50/80">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <SectionReveal>
            <div className="mb-16 lg:mb-20">
              <span className="inline-flex items-center gap-3 text-sm font-mono text-slate-400 mb-5">
                <span className="w-8 h-px bg-brand-teal/40" />
                Exam Simulations
              </span>
              <h2 className="text-4xl lg:text-6xl font-display tracking-tight">
                Take a test.
                <br />
                <span className="text-slate-400">Get instant results.</span>
              </h2>
            </div>
          </SectionReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-slate-200 rounded-2xl overflow-hidden">
            {mockTestCards.map((item, index) => {
              const Icon = item.icon;
              return (
                <SectionReveal key={item.title} delay={index * 100}>
                  <div className="bg-white p-8 lg:p-10 group hover:bg-slate-50 transition-colors duration-300 h-full">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-purple/8 text-brand-purple mb-6">
                      <Icon size={20} />
                    </div>
                    <h3 className="text-xl font-display mb-2">{item.title}</h3>
                    <p className="text-sm text-slate-500 mb-5">{item.subtitle}</p>
                    <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-mono text-slate-500 mb-6">
                      <Clock3 size={13} />
                      {item.meta}
                    </div>
                    <div>
                      <Link
                        href="/exam-library/reading"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-brand-purple transition-all group-hover:gap-3"
                      >
                        Start Mock
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                </SectionReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== AI BAND INTELLIGENCE SECTION ===== */}
      <section className="relative py-24 lg:py-32 bg-brand-navy text-white overflow-hidden noise-overlay">
        <div className="absolute inset-0 grid-bg" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-brand-purple/10 blur-[120px]" />

        <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">
          <SectionReveal>
            <div className="mb-16 lg:mb-20">
              <span className="inline-flex items-center gap-3 text-sm font-mono text-white/40 mb-5">
                <span className="w-8 h-px bg-brand-teal/50" />
                AI-Powered Intelligence
              </span>
              <h2 className="text-4xl lg:text-6xl font-display tracking-tight">
                Understand your score
                <br />
                <span className="text-white/40">like never before.</span>
              </h2>
            </div>
          </SectionReveal>

          <div className="grid gap-8 lg:grid-cols-2">
            <SectionReveal delay={100}>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-8 lg:p-10 backdrop-blur-sm h-full">
                <div className="inline-flex items-center gap-2 rounded-full bg-brand-teal/15 px-3 py-1 text-xs font-semibold text-brand-teal mb-6">
                  <Brain size={14} />
                  AI Band Intelligence
                </div>
                <p className="text-lg text-white/70 leading-relaxed mb-8">
                  Get clear scoring explanations and practical next actions after
                  each test attempt. Our AI analyzes your responses against real
                  IELTS marking criteria.
                </p>
                <ul className="space-y-3 mb-8">
                  {scoreFeatures.map((line) => (
                    <li
                      key={line}
                      className="flex items-start gap-3 text-sm text-white/60"
                    >
                      <CheckCircle2
                        size={16}
                        className="mt-0.5 text-brand-teal shrink-0"
                      />
                      {line}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-brand-navy transition-all hover:bg-white/90 group"
                >
                  Try Band Tracker
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </SectionReveal>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { title: "AI Band Breakdown", desc: "Granular score analysis per criterion" },
                { title: "Error Pattern Detection", desc: "Identify recurring mistakes" },
                { title: "Progress Timeline", desc: "Visual band score history" },
                { title: "Personalized Focus Plan", desc: "Targeted improvement roadmap" },
              ].map((item, index) => (
                <SectionReveal key={item.title} delay={(index + 2) * 100}>
                  <div className="group rounded-xl border border-white/8 bg-white/[0.03] p-6 backdrop-blur-sm transition-all duration-300 hover:border-brand-purple/30 hover:bg-white/[0.06] h-full">
                    <div className="h-1 w-8 rounded-full bg-gradient-to-r from-brand-purple to-brand-teal mb-4 transition-all duration-300 group-hover:w-12" />
                    <p className="text-sm font-semibold text-white/90 mb-1">
                      {item.title}
                    </p>
                    <p className="text-xs text-white/40">
                      {item.desc}
                    </p>
                  </div>
                </SectionReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== INSTRUCTORS SECTION ===== */}
      <section className="py-24 lg:py-32 bg-white">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <SectionReveal>
            <div className="mb-16 lg:mb-20">
              <span className="inline-flex items-center gap-3 text-sm font-mono text-slate-400 mb-5">
                <span className="w-8 h-px bg-brand-purple/40" />
                Expert Guidance
              </span>
              <h2 className="text-4xl lg:text-6xl font-display tracking-tight">
                Meet our IELTS experts.
                <br />
                <span className="text-slate-400">Learn from the best.</span>
              </h2>
            </div>
          </SectionReveal>
          <InstructorCarousel />
        </div>
      </section>

      {/* ===== CREDENTIALS SECTION ===== */}
      <section className="relative overflow-hidden py-24 lg:py-32 bg-[#f6f2e9] border-y border-amber-100/70">
        <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(120,80,30,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(120,80,30,0.04)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <SectionReveal>
            <div className="relative mb-16 lg:mb-20 text-center">
              <span className="inline-flex items-center gap-3 text-sm font-mono text-amber-900/45 mb-5 justify-center">
                <span className="w-8 h-px bg-amber-900/25" />
                Why Choose Us
                <span className="w-8 h-px bg-amber-900/25" />
              </span>
              <h2 className="text-4xl lg:text-5xl font-display tracking-tight">
                Credentials as a living library.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600">
                A tactile, book-inspired view of what makes the platform
                reliable for serious IELTS preparation.
              </p>
            </div>
          </SectionReveal>

          <div className="relative">
            <div className="hidden gap-3 lg:flex min-h-[420px]">
              {whyPanels.map((panel, index) => {
                const Icon = panel.icon;
                const active = activeWhy === index;
                return (
                  <button
                    key={panel.title}
                    type="button"
                    onMouseEnter={() => setActiveWhy(index)}
                    onFocus={() => setActiveWhy(index)}
                    onClick={() => setActiveWhy(index)}
                    className={[
                      "group relative overflow-hidden rounded-[2rem] border border-amber-900/10 bg-white/72 p-6 text-left shadow-xl shadow-amber-900/5 transition-all duration-500",
                      active ? "flex-[2.6]" : "flex-[0.62]",
                    ].join(" ")}
                  >
                    <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-b from-amber-900/20 via-brand-teal/30 to-brand-purple/20" />
                    <div className="flex h-full flex-col">
                      <div className="flex items-center justify-between gap-4">
                        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-900">
                          <Icon size={19} />
                        </span>
                        <span className="font-mono text-xs text-amber-900/35">
                          0{index + 1}
                        </span>
                      </div>
                      <div
                        className={[
                          "mt-auto transition-all duration-500",
                          active ? "max-w-lg" : "max-w-[9rem]",
                        ].join(" ")}
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-teal-dark">
                          {panel.label}
                        </p>
                        <h3
                          className={[
                            "mt-3 font-display tracking-tight text-slate-950 transition-all duration-500",
                            active ? "text-4xl" : "text-2xl [writing-mode:vertical-rl] rotate-180",
                          ].join(" ")}
                        >
                          {panel.title}
                        </h3>
                        <p
                          className={[
                            "mt-5 text-sm leading-7 text-slate-600 transition-all duration-500",
                            active ? "opacity-100" : "max-h-0 overflow-hidden opacity-0",
                          ].join(" ")}
                        >
                          {panel.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-4 lg:hidden">
              {whyPanels.map((panel, index) => {
                const Icon = panel.icon;
                return (
                  <article
                    key={panel.title}
                    className="rounded-[2rem] border border-amber-900/10 bg-white/80 p-6 shadow-lg shadow-amber-900/5"
                  >
                    <div className="flex items-start gap-4">
                      <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-900">
                        <Icon size={19} />
                      </span>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-teal-dark">
                          0{index + 1} / {panel.label}
                        </p>
                        <h3 className="mt-2 text-2xl font-display tracking-tight text-slate-950">
                          {panel.title}
                        </h3>
                        <p className="mt-3 text-sm leading-7 text-slate-600">
                          {panel.description}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ===== IELTS JOURNAL SECTION ===== */}
      <section className="py-24 lg:py-32 bg-white">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <SectionReveal>
            <div className="mb-14 grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
              <div>
                <span className="inline-flex items-center gap-3 text-sm font-mono text-slate-400 mb-5">
                  <span className="w-8 h-px bg-slate-300" />
                  IELTS Journal
                </span>
                <h2 className="text-4xl lg:text-5xl font-display tracking-tight">
                  Live article discovery.
                </h2>
              </div>
              <p className="max-w-2xl text-base leading-7 text-slate-500 lg:ml-auto">
                Real IELTS and education articles from trusted source feeds:
                universities, Cambridge/British Council related results,
                IELTS organizations, and global education publications.
              </p>
            </div>
          </SectionReveal>

          <SectionReveal delay={200}>
            <IeltsJournalFeed />
          </SectionReveal>
        </div>
      </section>

      {/* ===== CTA SECTION ===== */}
      <section className="py-24 lg:py-32 bg-white">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <SectionReveal>
            <div className="relative rounded-3xl bg-brand-navy overflow-hidden">
              <div className="absolute inset-0 grid-bg" />
              <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-brand-purple/15 blur-[100px]" />
              <div className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full bg-brand-teal/10 blur-[80px]" />

              <div className="absolute top-0 right-0 w-32 h-32 border-b border-l border-white/5" />
              <div className="absolute bottom-0 left-0 w-32 h-32 border-t border-r border-white/5" />

              <div className="relative z-10 px-8 lg:px-16 py-16 lg:py-24 text-center">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-mono text-white/60 mb-8">
                  <UserCheck size={14} />
                  Ready to begin?
                </span>
                <h2 className="text-4xl lg:text-6xl font-display tracking-tight text-white mb-5">
                  Take your IELTS score
                  <br />
                  <span className="text-white/40">to the next level.</span>
                </h2>
                <p className="text-base text-white/50 max-w-md mx-auto mb-10">
                  Join thousands of learners practicing daily with IELTS Flow.
                  Start free, upgrade anytime.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-brand-navy transition-all hover:bg-white/90 hover:shadow-lg hover:shadow-white/10 group"
                  >
                    Start for Free
                    <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <Link
                    href="/pricing"
                    className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-8 py-3.5 text-sm font-semibold text-white transition-all hover:bg-white/10"
                  >
                    See Pricing
                  </Link>
                </div>
              </div>
            </div>
          </SectionReveal>
        </div>
      </section>
    </div>
  );
}
