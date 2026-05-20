"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  BookOpenCheck,
  CalendarClock,
} from "lucide-react";

type InstructorDetails = {
  id: string;
  name: string;
  email: string;
  headline: string;
  bio: string;
  history: string;
  achievements: string[];
  specialties: string[];
  experienceYears: number | null;
  avatarUrl: string | null;
  likes: number;
  comments: number;
  views: number;
  completedSessions: number;
  averageBand: number | null;
};

export default function InstructorPublicProfilePage() {
  const params = useParams<{ id: string }>();
  const [instructor, setInstructor] = useState<InstructorDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = params?.id;
    if (!id) return;

    let active = true;

    fetch(`/api/marketing/instructors/${id}`, { cache: "no-store" })
      .then(async (res) => {
        const payload = (await res.json().catch(() => null)) as {
          instructor?: InstructorDetails;
          error?: string;
        } | null;

        if (!res.ok || !payload?.instructor) {
          throw new Error(
            payload?.error || "Failed to load instructor details",
          );
        }

        if (!active) return;
        setInstructor(payload.instructor);
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Unable to load instructor",
        );
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [params?.id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="h-72 animate-pulse rounded-3xl bg-slate-200" />
      </div>
    );
  }

  if (error || !instructor) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-700">
          {error || "Instructor not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#f7f5ee] py-10">
      <div className="mx-auto max-w-6xl space-y-6 px-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm"
        >
          <ArrowLeft size={16} /> Back to Home
        </Link>

        <section className="relative overflow-hidden rounded-[2.5rem] bg-white p-8 shadow-[0_30px_90px_-65px_rgba(15,23,42,0.75)]">
          <div className="absolute right-0 top-0 h-72 w-72 rounded-bl-[10rem] bg-emerald-100" />
          <div className="relative grid gap-6 md:grid-cols-[140px_1fr_auto] md:items-center">
            <div className="inline-flex h-32 w-32 items-center justify-center rounded-[2rem] bg-gradient-to-br from-emerald-100 to-white text-3xl font-display text-emerald-900 shadow-inner">
              {instructor.name
                .split(" ")
                .map((part) => part[0])
                .join("")}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">
                IELTS Mentor
              </p>
              <h1 className="mt-2 text-4xl font-display tracking-tight text-slate-950">
                {instructor.name}
              </h1>
              <p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">
                {instructor.headline}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-800">
                  <BookOpenCheck size={13} /> {instructor.completedSessions}{" "}
                  Sessions
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-800">
                  <BadgeCheck size={13} />
                  {instructor.averageBand != null
                    ? `Avg Band ${instructor.averageBand.toFixed(1)}`
                    : "Verified Mentor"}
                </span>
                {instructor.experienceYears != null ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-800">
                    <CalendarClock size={13} /> {instructor.experienceYears}{" "}
                    Years Experience
                  </span>
                ) : null}
              </div>
            </div>
            <Link
              href="/dashboard/student/book"
              className="inline-flex rounded-2xl bg-emerald-900 px-5 py-3 text-sm font-semibold text-white"
            >
              Book Session
            </Link>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          <aside className="space-y-6">
            <div className="rounded-[2rem] bg-white/80 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Skills</h2>
              <div className="mt-4 space-y-4">
                {instructor.specialties.slice(0, 4).map((skill, index) => (
                  <div key={skill}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium text-slate-700">{skill}</span>
                      <span className="text-slate-400">{85 - index * 7}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-700"
                        style={{ width: `${85 - index * 7}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[2rem] bg-white/80 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Specialties</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {instructor.specialties.map((item) => (
                  <span key={item} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </aside>

          <div className="space-y-6">
            <section className="rounded-[2rem] bg-white/80 p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-950">About me</h2>
              <p className="mt-3 text-sm leading-7 text-slate-700">{instructor.bio}</p>
            </section>
            <section className="rounded-[2rem] bg-white/80 p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-950">Experience</h2>
              <div className="mt-4 border-l border-emerald-200 pl-5">
                <p className="relative text-sm leading-7 text-slate-700 before:absolute before:-left-[1.58rem] before:top-2 before:h-3 before:w-3 before:rounded-full before:bg-emerald-700">
                  {instructor.history}
                </p>
              </div>
            </section>
            <section className="rounded-[2rem] bg-white/80 p-6 shadow-sm">
              <h2 className="inline-flex items-center gap-2 text-xl font-semibold text-slate-950">
                <Award size={18} className="text-emerald-700" /> Achievements
              </h2>
              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                {instructor.achievements.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-emerald-700" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}
