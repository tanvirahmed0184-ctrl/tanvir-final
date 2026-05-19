"use client";

import { useEffect, useState } from "react";
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
  Sparkles,
  UserCheck,
} from "lucide-react";
import InstructorCarousel from "@/components/marketing/instructor-carousel";

const skillCards = [
  {
    title: "Listening",
    description:
      "Audio-based practice with IELTS-style question flow and instant checking.",
    href: "/exam-library/listening",
    icon: Headphones,
    cardClass: "border-l-4 border-l-blue-500",
    iconClass: "bg-blue-600 text-white",
  },
  {
    title: "Reading",
    description:
      "Passage-based tests with navigation, timing, and review-ready analytics.",
    href: "/exam-library/reading",
    icon: ClipboardCheck,
    cardClass: "border-l-4 border-l-green-500",
    iconClass: "bg-green-600 text-white",
  },
  {
    title: "Writing",
    description:
      "Task 1 and Task 2 support with AI examiner feedback and rewrites.",
    href: "/exam-library/writing",
    icon: PenLine,
    cardClass: "border-l-4 border-l-orange-500",
    iconClass: "bg-orange-500 text-white",
  },
  {
    title: "Speaking",
    description:
      "Practice with an AI speaking examiner and structured band feedback.",
    href: "/dashboard/student/speaking",
    icon: Mic,
    cardClass: "border-l-4 border-l-purple-500",
    iconClass: "bg-purple-600 text-white",
  },
];

const heroSlides = [
  {
    title: "FREE IELTS PREPARATION WITH MOCK TEST IELTS",
    subtitle:
      "Practice all 4 IELTS skills with realistic exam flow, instant scoring, and AI feedback built to move your band score faster.",
    primaryCta: true,
  },
  {
    title: "Structured Lessons For Faster Band Growth",
    subtitle:
      "Follow guided modules with timed drills and focused revision paths for each skill.",
    primaryCta: false,
  },
  {
    title: "Practice Daily, Improve Consistently",
    subtitle:
      "Use analytics-backed recommendations to fix weak areas and stay exam-ready.",
    primaryCta: false,
  },
];

const mockTestCards = [
  {
    title: "Academic IELTS Mock",
    subtitle: "Reading + Writing + Listening",
    meta: "40 Questions | Full Time",
  },
  {
    title: "General Training Mock",
    subtitle: "Reading + Writing + Listening",
    meta: "2 Modules | Full Time",
  },
  {
    title: "Quick Practice Drill",
    subtitle: "Timed skill-by-skill sprint",
    meta: "20 Minutes | Instant Results",
  },
];

const scoreFeatures = [
  "Predict your likely IELTS band from real scoring tables",
  "Question-by-question accuracy with explanation",
  "Highlight weak areas with actionable next steps",
  "Track band movement over time and by module",
];

const credentials = [
  "Aligned with IELTS-style exam structure and timing",
  "Trusted by students from multiple countries",
  "AI feedback tuned for practical score improvement",
  "Performance analytics designed for clear progress",
  "Real-time practice simulation with authentic UX",
  "Built for both Academic and General candidates",
];

const topics = [
  "Education",
  "Health",
  "Technology",
  "Environment",
  "Media",
  "Urbanization",
  "Globalization",
  "Culture",
  "Work Life",
  "Government",
  "Travel",
  "Communication",
];

const stats = [
  { label: "Students", value: "50K+" },
  { label: "Mock Tests", value: "10K+" },
  { label: "Avg Band Gain", value: "+1.2" },
  { label: "Rating", value: "4.9/5" },
];

export default function MarketingHomePage() {
  const [activeSlide, setActiveSlide] = useState(0);

  const prevSlide = () => {
    setActiveSlide(
      (prev) => (prev - 1 + heroSlides.length) % heroSlides.length,
    );
  };

  const nextSlide = () => {
    setActiveSlide((prev) => (prev + 1) % heroSlides.length);
  };

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="w-full">
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-purple-dark via-brand-purple to-brand-purple-light text-white">
        <div className="w-full py-16 sm:py-24">
          <div className="w-full relative">
            <div
              className="flex transition-transform duration-700 ease-out w-full"
              style={{ transform: `translateX(-${activeSlide * 100}%)` }}
            >
              {heroSlides.map((slide) => (
                <div
                  key={slide.title}
                  className="w-full shrink-0 px-4 py-8 sm:py-12"
                >
                  <div className="mx-auto max-w-3xl text-center">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
                      <Sparkles size={14} />
                      AI-Powered IELTS Prep
                    </span>
                    <h1 className="mt-5 text-4xl font-black leading-tight sm:text-5xl">
                      {slide.title}
                    </h1>
                    <p className="mx-auto mt-4 max-w-2xl text-sm text-white/90 sm:text-base">
                      {slide.subtitle}
                    </p>
                    {slide.primaryCta ? (
                      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                        <Link
                          href="/register"
                          className="rounded-full bg-brand-teal px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-teal/30 transition hover:bg-brand-teal-dark"
                        >
                          Start Free Today
                        </Link>
                        <Link
                          href="/pricing"
                          className="rounded-full border border-white/35 bg-white/10 px-6 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
                        >
                          View Plans
                        </Link>
                      </div>
                    ) : (
                      <div className="mt-7 h-10" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={prevSlide}
              aria-label="Previous slide"
              className="absolute left-6 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-brand-purple shadow-md transition hover:bg-slate-100 z-10"
            >
              &lt;
            </button>
            <button
              type="button"
              onClick={nextSlide}
              aria-label="Next slide"
              className="absolute right-6 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-brand-purple shadow-md transition hover:bg-slate-100 z-10"
            >
              &gt;
            </button>

            <div className="pb-6">
              <div className="flex items-center justify-center gap-2">
                {heroSlides.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setActiveSlide(index)}
                    className={[
                      "h-3 w-3 rounded-full transition",
                      activeSlide === index
                        ? "scale-125 bg-white"
                        : "bg-white/50 hover:bg-white/80",
                    ].join(" ")}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="mx-auto mt-8 flex max-w-4xl flex-wrap items-center justify-around gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-4 backdrop-blur-sm">
            {stats.map((stat) => (
              <div key={stat.label} className="min-w-[110px] text-center">
                <p className="text-xl font-black sm:text-2xl">{stat.value}</p>
                <p className="text-xs text-white/80">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <svg
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
          className="wave-drift"
          style={{
            position: "absolute",
            bottom: 0,
            left: "-5%",
            width: "110%",
            height: "80px",
          }}
        >
          <defs>
            <linearGradient id="wave-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.7)" />
              <stop offset="100%" stopColor="#ffffff" />
            </linearGradient>
          </defs>
          <path
            d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z"
            fill="url(#wave-fade)"
          />
        </svg>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-6 text-center">
            <h2 className="text-3xl font-bold text-slate-900">
              Practice All 4 Skills
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Everything you need in one platform to train smarter.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {skillCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.title}
                  href={card.href}
                  className={`group rounded-2xl border border-gray-100 bg-white p-6 shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${card.cardClass}`}
                >
                  <div
                    className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${card.iconClass}`}
                  >
                    <Icon size={18} />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    {card.description}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-900 group-hover:text-brand-purple-dark">
                    Start Practice <ArrowRight size={15} />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-teal-50 py-20 text-slate-900">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-6 text-center">
            <h2 className="text-3xl font-bold">
              Take an IELTS Test Online Now
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Choose your preferred simulation style and get instant outcomes.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {mockTestCards.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-white/60 bg-white/80 p-5 text-slate-900 shadow-sm backdrop-blur-sm transition hover:shadow-md"
              >
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{item.subtitle}</p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  <Clock3 size={14} />
                  {item.meta}
                </div>
                <Link
                  href="/exam-library/reading"
                  className="mt-5 inline-flex items-center justify-center rounded-full bg-brand-purple px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-purple-dark"
                >
                  Start Mock
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl bg-gradient-to-br from-white to-gray-50 p-6 shadow-md">
              <p className="inline-flex items-center gap-2 rounded-full bg-brand-purple/10 px-3 py-1 text-xs font-semibold text-brand-purple">
                <Brain size={14} />
                AI Band Intelligence
              </p>
              <h2 className="mt-3 text-3xl font-bold text-slate-900">
                Understand Your Band Score Like Never Before
              </h2>
              <p className="mt-3 text-sm text-slate-600">
                Get clear scoring explanations and practical next actions after
                each test attempt.
              </p>
              <ul className="mt-5 space-y-2">
                {scoreFeatures.map((line) => (
                  <li
                    key={line}
                    className="inline-flex items-start gap-2 text-sm text-slate-700"
                  >
                    <CheckCircle2
                      size={16}
                      className="mt-0.5 text-brand-teal"
                    />
                    {line}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="mt-6 inline-flex rounded-xl bg-brand-purple px-4 py-2 text-sm font-semibold text-white"
              >
                Try Band Tracker
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "AI Band Breakdown",
                "Error Pattern Detection",
                "Progress Timeline",
                "Personalized Focus Plan",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl bg-gradient-to-br from-white to-gray-50 p-6 shadow-md transition hover:ring-2 hover:ring-purple-200"
                >
                  <p className="text-sm font-semibold text-slate-900">{item}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Insight cards designed to move your score faster.
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-6 text-center">
            <h2 className="text-3xl font-bold text-slate-900">
              Meet Our IELTS Experts
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Experienced mentors to guide your strategy and speaking
              confidence.
            </p>
          </div>
          <InstructorCarousel />
        </div>
      </section>

      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-center text-3xl font-bold text-slate-900">
            Established Credentials You Can Trust
          </h2>
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {credentials.map((item) => (
              <div
                key={item}
                className="inline-flex items-start gap-2 rounded-xl border border-brand-teal/20 bg-white p-4 text-sm text-slate-700 shadow-sm"
              >
                <CheckCircle2 size={16} className="mt-0.5 text-brand-teal" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-center text-3xl font-bold text-slate-900">
            Important Topics
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            Practice with the most common IELTS themes across all modules.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {topics.map((topic) => (
              <span
                key={topic}
                className="cursor-pointer rounded-full bg-white px-5 py-2 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-100"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-brand-purple py-20 text-white">
        <div className="mx-auto max-w-5xl px-4">
          <div className="rounded-2xl border border-white/20 bg-white/10 p-8 text-center text-white shadow-lg">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
              <UserCheck size={14} />
              Ready?
            </p>
            <h2 className="mt-3 text-3xl font-bold">
              Take your IELTS score to the next level
            </h2>
            <p className="mt-2 text-sm text-white/85">
              Join thousands of learners practicing daily with IELTS Flow.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/register"
                className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand-purple"
              >
                Start for Free
              </Link>
              <Link
                href="/pricing"
                className="rounded-xl border border-white/35 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white"
              >
                See Pricing
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
