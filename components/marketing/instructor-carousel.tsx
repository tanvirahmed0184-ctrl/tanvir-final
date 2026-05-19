"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Expand,
  Eye,
  Heart,
  MessageCircle,
  Star,
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="h-[280px] animate-pulse rounded-2xl bg-slate-200"
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
      <div className="mb-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={goPrev}
          aria-label="Previous instructors"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          onClick={goNext}
          aria-label="Next instructors"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {visible.map((expert, index) => {
          const emphasizeMiddle =
            realVisibleCount >= 4
              ? index === 1 || index === 2
              : realVisibleCount === 3
                ? index === 1
                : realVisibleCount === 2
                  ? index === 1
                  : true;

          return (
            <Link
              key={`${expert.id}-${index}`}
              href={`/instructors/${expert.id}`}
              className={[
                "group block transform transition-all duration-500",
                emphasizeMiddle
                  ? "scale-100 xl:scale-[1.07]"
                  : "scale-95 opacity-90",
              ].join(" ")}
            >
              <div className="relative mx-auto w-full max-w-[260px]">
                <div className="pointer-events-none absolute -left-0 top-6 h-[204px] w-full rounded-2xl bg-slate-900/60 transition-all duration-300 group-hover:-left-2 group-hover:top-3 group-hover:scale-[1.03]" />

                <article className="relative rounded-2xl bg-[#252525] p-4 text-white shadow-xl">
                  <div className="mb-2 flex justify-end opacity-100 transition duration-300 md:opacity-0 md:group-hover:opacity-100">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-slate-500 text-slate-100 shadow-md transition group-hover:scale-110 group-hover:bg-slate-400">
                      <Expand size={14} />
                    </span>
                  </div>

                  <div className="flex min-h-[92px] items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-teal-600/35 via-cyan-600/30 to-emerald-600/35 p-3">
                    <label className="relative inline-block h-[52px] w-[20px]">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        defaultChecked={expert.likes > 20}
                        readOnly
                        aria-label={`${expert.name} highlight status`}
                      />
                      <span className="absolute inset-0 rounded-md bg-zinc-300 transition peer-checked:bg-lime-500" />
                      <span className="absolute -left-[10px] top-1 h-2 w-10 rounded-md bg-white shadow-[0_6px_7px_rgba(0,0,0,0.3)] transition duration-300 peer-checked:translate-y-9" />
                    </label>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-teal-300/40 bg-teal-400/20 text-sm font-bold text-teal-100">
                      {expert.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-white">
                        {expert.name}
                      </h3>
                      <p className="truncate text-xs text-white/70">
                        {expert.role}
                      </p>
                    </div>
                  </div>
                </article>
              </div>

              <div className="mx-auto mt-5 flex max-w-[260px] items-center justify-between gap-2">
                <span className="inline-flex translate-y-0 items-center gap-1 rounded-md bg-slate-700 px-2.5 py-1 text-xs text-white opacity-100 transition duration-200 md:translate-y-2 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100">
                  <Heart size={12} /> {expert.likes}
                </span>
                <span className="inline-flex translate-y-0 items-center gap-1 rounded-md bg-slate-700 px-2.5 py-1 text-xs text-white opacity-100 transition duration-200 md:translate-y-2 md:opacity-0 md:delay-75 md:group-hover:translate-y-0 md:group-hover:opacity-100">
                  <MessageCircle size={12} /> {expert.comments}
                </span>
                <span className="inline-flex translate-y-0 items-center gap-1 rounded-md bg-slate-700 px-2.5 py-1 text-xs text-white opacity-100 transition duration-200 md:translate-y-2 md:opacity-0 md:delay-100 md:group-hover:translate-y-0 md:group-hover:opacity-100">
                  <Eye size={12} /> {expert.views}
                </span>
              </div>

              <p className="mx-auto mt-3 inline-flex items-center gap-1 rounded-full bg-brand-teal/10 px-3 py-1 text-xs font-semibold text-brand-teal-dark">
                <Star size={12} />
                {expert.score}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
