"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  BadgeCheck,
  BookOpenCheck,
  CalendarClock,
  Sparkles,
} from "lucide-react";

type InstructorCard = {
  id: string;
  name: string;
  email: string;
  role: string;
  score: string;
  likes: number;
  comments: number;
  views: number;
  avatarUrl: string | null;
  experienceYears: number | null;
  specialties?: string[];
};

function getVisibleCount(width: number): number {
  if (width < 640) return 1;
  if (width < 1024) return 2;
  return 4;
}

export default function InstructorCarousel() {
  const [instructors, setInstructors] = useState<InstructorCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [start, setStart] = useState(0);
  const [visibleCount, setVisibleCount] = useState(4);

  useEffect(() => {
    const resize = () => setVisibleCount(getVisibleCount(window.innerWidth));
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    let active = true;

    fetch("/api/marketing/instructors", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch instructors");
        const data = (await res.json()) as { instructors?: InstructorCard[] };
        if (!active) return;
        const rows = Array.isArray(data.instructors) ? data.instructors : [];
        setInstructors(rows);
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Unable to load instructors",
        );
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const realVisibleCount = Math.min(
    visibleCount,
    Math.max(1, instructors.length),
  );
  const canLoop = instructors.length > realVisibleCount;

  useEffect(() => {
    if (!canLoop) return;

    const intervalId = window.setInterval(() => {
      setStart((prev) => (prev + 1) % instructors.length);
    }, 3200);

    return () => window.clearInterval(intervalId);
  }, [canLoop, instructors.length]);

  const visible = useMemo(() => {
    if (!instructors.length) return [] as InstructorCard[];

    return Array.from({ length: realVisibleCount }).map((_, index) => {
      const itemIndex = (start + index) % instructors.length;
      return instructors[itemIndex];
    });
  }, [instructors, start, realVisibleCount]);

  const goNext = () => {
    if (!instructors.length) return;
    setStart((prev) => (prev + 1) % instructors.length);
  };

  const goPrev = () => {
    if (!instructors.length) return;
    setStart((prev) => (prev - 1 + instructors.length) % instructors.length);
  };

  if (loading) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="h-[360px] animate-pulse rounded-[2rem] bg-slate-100"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {error}
      </div>
    );
  }

  if (!instructors.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
        No instructors are published yet.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-xl text-sm leading-6 text-slate-500">
          Live instructor profiles are pulled from your platform data. New
          published instructors appear here automatically.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous instructors"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-brand-teal/30 hover:bg-slate-50"
          >
            <ChevronLeft size={17} />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next instructors"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-brand-teal/30 hover:bg-slate-50"
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {visible.map((expert, index) => {
          const initials = expert.name
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2);
          const tags =
            expert.specialties && expert.specialties.length
              ? expert.specialties.slice(0, 3)
              : [expert.role, "IELTS Coaching"].slice(0, 2);

          return (
            <Link
              key={`${expert.id}-${index}`}
              href={`/instructors/${expert.id}`}
              className="group block"
            >
              <article className="relative flex min-h-[360px] flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm transition-all duration-500 hover:-translate-y-1 hover:border-brand-teal/30 hover:shadow-2xl hover:shadow-slate-200/70">
                <div className="relative overflow-hidden rounded-[1.5rem] bg-slate-100">
                  <div
                    className="h-48 bg-cover bg-center transition duration-700 group-hover:scale-105"
                    style={
                      expert.avatarUrl
                        ? { backgroundImage: `url(${expert.avatarUrl})` }
                        : undefined
                    }
                  >
                    {!expert.avatarUrl ? (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 via-teal-50 to-purple-50 text-3xl font-display text-slate-500">
                        {initials}
                      </div>
                    ) : null}
                  </div>
                  <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-teal-800 shadow-sm backdrop-blur">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Available
                  </div>
                  <div className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow-sm backdrop-blur transition group-hover:text-brand-purple">
                    <ArrowUpRight size={15} />
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-2 pt-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-display leading-tight tracking-tight text-slate-950">
                        {expert.name}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">
                        {expert.role}
                      </p>
                    </div>
                    <BadgeCheck
                      size={19}
                      className="mt-0.5 shrink-0 text-brand-teal-dark"
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        <BookOpenCheck size={12} />
                        Rating
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {expert.score}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        <CalendarClock size={12} />
                        Experience
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {expert.experienceYears != null
                          ? `${expert.experienceYears}+ years`
                          : "Verified"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-teal-dark">
                      <Sparkles size={13} />
                      View profile
                    </span>
                    <span className="text-[11px] font-medium text-slate-400">
                      {expert.views} views
                    </span>
                  </div>
                </div>
              </article>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
