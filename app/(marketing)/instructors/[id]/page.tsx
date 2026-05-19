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
  Eye,
  MessageCircle,
  ThumbsUp,
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
    setLoading(true);

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
    <div className="bg-slate-50 py-10">
      <div className="mx-auto max-w-5xl space-y-6 px-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
        >
          <ArrowLeft size={16} /> Back to Home
        </Link>

        <section className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 p-6 text-white shadow-xl">
          <div className="grid gap-5 md:grid-cols-[100px_1fr]">
            <div className="inline-flex h-24 w-24 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-2xl font-bold">
              {instructor.name
                .split(" ")
                .map((part) => part[0])
                .join("")}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{instructor.name}</h1>
              <p className="mt-1 text-sm text-white/80">
                {instructor.headline}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/85">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1">
                  <BookOpenCheck size={13} /> {instructor.completedSessions}{" "}
                  Sessions
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1">
                  <BadgeCheck size={13} />
                  {instructor.averageBand != null
                    ? `Avg Band ${instructor.averageBand.toFixed(1)}`
                    : "Verified Mentor"}
                </span>
                {instructor.experienceYears != null ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1">
                    <CalendarClock size={13} /> {instructor.experienceYears}{" "}
                    Years Experience
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Likes
            </p>
            <p className="mt-1 inline-flex items-center gap-2 text-xl font-bold text-slate-900">
              <ThumbsUp size={18} className="text-teal-600" />{" "}
              {instructor.likes}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Comments
            </p>
            <p className="mt-1 inline-flex items-center gap-2 text-xl font-bold text-slate-900">
              <MessageCircle size={18} className="text-teal-600" />{" "}
              {instructor.comments}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Views
            </p>
            <p className="mt-1 inline-flex items-center gap-2 text-xl font-bold text-slate-900">
              <Eye size={18} className="text-teal-600" /> {instructor.views}
            </p>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">About</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            {instructor.bio}
          </p>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">History</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            {instructor.history}
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Award size={18} className="text-teal-700" /> Achievements
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {instructor.achievements.map((item) => (
                <li key={item} className="rounded-lg bg-slate-50 px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Specialties
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {instructor.specialties.map((item) => (
                <span
                  key={item}
                  className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <Link
            href="/dashboard/student/book"
            className="inline-flex rounded-xl bg-brand-purple px-5 py-2.5 text-sm font-semibold text-white"
          >
            Book Session With This Instructor
          </Link>
        </section>
      </div>
    </div>
  );
}
