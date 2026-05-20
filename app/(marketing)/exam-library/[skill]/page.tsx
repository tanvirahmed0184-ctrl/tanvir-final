"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CircleAlert,
  Clock3,
  Lock,
  Search,
  Sparkles,
  Unlock,
  X,
} from "lucide-react";

type Skill = "listening" | "reading" | "writing" | "speaking";
type Module = "LISTENING" | "READING" | "WRITING" | "SPEAKING";
type Mode = "practice" | "simulation";

type ApiTest = {
  id: string;
  title: string;
  description?: string | null;
  module: Module;
  variant: "ACADEMIC" | "GENERAL";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  durationMins: number;
  totalQuestions: number;
  isPractice: boolean;
  isLaunchReady?: boolean;
  attemptsCount?: number;
};

type UserPlan = "free" | "pro" | "premium";

type ToastState = {
  title: string;
  description: string;
  variant: "default" | "destructive";
} | null;

const SKILL_TABS: Array<{ label: string; value: Skill; href: string }> = [
  { label: "Listening", value: "listening", href: "/exam-library/listening" },
  { label: "Reading", value: "reading", href: "/exam-library/reading" },
  { label: "Writing", value: "writing", href: "/exam-library/writing" },
  { label: "Speaking", value: "speaking", href: "/dashboard/student/speaking" },
];

const PARTS_BY_SKILL: Record<Exclude<Skill, "speaking">, string[]> = {
  reading: ["Passage 1", "Passage 2", "Passage 3"],
  listening: ["Section 1", "Section 2", "Section 3", "Section 4"],
  writing: ["Task 1", "Task 2"],
};

const TIME_LIMITS = ["15 min", "30 min", "45 min", "60 min"];

function toModule(skill: Skill): Module {
  if (skill === "reading") return "READING";
  if (skill === "writing") return "WRITING";
  if (skill === "speaking") return "SPEAKING";
  return "LISTENING";
}

function skillFromParams(value: string | string[] | undefined): Skill {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "reading" || raw === "writing" || raw === "speaking") return raw;
  return "listening";
}

export default function ExamLibrarySkillPage() {
  const router = useRouter();
  const params = useParams<{ skill: string }>();

  const skill = skillFromParams(params?.skill);

  const [tests, setTests] = useState<ApiTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeTest, setActiveTest] = useState<ApiTest | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showModeModal, setShowModeModal] = useState(false);
  const [parts, setParts] = useState<string[]>([]);
  const [timeLimit, setTimeLimit] = useState(TIME_LIMITS[1]);
  const [startingMode, setStartingMode] = useState<Mode | null>(null);
  const [startingTestId, setStartingTestId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [userPlan, setUserPlan] = useState<UserPlan>("free");
  const [planLoading, setPlanLoading] = useState(true);

  const skillModule = toModule(skill);

  useEffect(() => {
    if (skill === "speaking") {
      router.replace("/dashboard/student/speaking");
    }
  }, [router, skill]);

  useEffect(() => {
    void refreshUserPlan();
  }, []);

  async function refreshUserPlan(): Promise<UserPlan> {
    setPlanLoading(true);
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) {
        setUserPlan("free");
        return "free";
      }
      const data = (await res.json().catch(() => null)) as {
        user?: {
          subscription?: {
            plan?: string;
          } | null;
        } | null;
      } | null;
      const plan = data?.user?.subscription?.plan;
      const resolved = plan === "pro" || plan === "premium" ? plan : "free";
      setUserPlan(resolved);
      return resolved;
    } catch {
      setUserPlan("free");
      return "free";
    } finally {
      setPlanLoading(false);
    }
  }

  useEffect(() => {
    if (skill === "speaking") return;

    let active = true;
    setLoading(true);
    setError(null);

    fetch(`/api/tests?module=${skillModule}&fresh=1&audience=student`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch tests");
        const data = (await res.json()) as { tests?: ApiTest[] };
        if (!active) return;
        setTests(Array.isArray(data.tests) ? data.tests : []);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load tests");
        setTests([]);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [skillModule, skill]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const filteredTests = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = tests.filter((test) => {
      if (!q) return true;
      return (
        test.title.toLowerCase().includes(q) ||
        (test.description || "").toLowerCase().includes(q)
      );
    });

    return list.sort((a, b) => Number(b.isPractice) - Number(a.isPractice));
  }, [search, tests]);

  function togglePart(part: string) {
    setParts((prev) =>
      prev.includes(part) ? prev.filter((p) => p !== part) : [...prev, part],
    );
  }

  async function openTest(test: ApiTest) {
    if (startingTestId) return;
    if (test.isLaunchReady === false) {
      showToast(
        "Test not ready",
        "This test is still being prepared by admin. Please try another test.",
        "destructive",
      );
      return;
    }
    setActiveTest(test);
    if (test.isPractice) {
      const defaults =
        PARTS_BY_SKILL[skill as Exclude<Skill, "speaking">] || [];
      setParts(defaults);
      setTimeLimit(TIME_LIMITS[1]);
      setShowModeModal(true);
      setShowUpgradeModal(false);
      return;
    }

    const effectivePlan = planLoading ? await refreshUserPlan() : userPlan;

    if (effectivePlan === "free") {
      setShowUpgradeModal(true);
      setShowModeModal(false);
      return;
    }

    setShowUpgradeModal(false);
    setShowModeModal(false);
    void startAttempt("simulation", test);
  }

  function showToast(
    title: string,
    description: string,
    variant: "default" | "destructive" = "default",
  ) {
    setToast({ title, description, variant });
  }

  async function startAttempt(mode: Mode, targetTest?: ApiTest) {
    const chosenTest = targetTest || activeTest;
    if (!chosenTest) return;
    setStartingTestId(chosenTest.id);
    setStartingMode(mode);
    try {
      const res = await fetch("/api/tests/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testId: chosenTest.id,
          mode,
          selectedParts: mode === "practice" ? parts : undefined,
          timeLimit: mode === "practice" ? timeLimit : undefined,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        attemptId?: string;
        module?: string;
        mode?: string;
        durationMins?: number;
        selectedParts?: string[];
        timeLimit?: string | null;
        writingDurationMins?: number;
        task1PromptId?: string | null;
        task2PromptId?: string | null;
        task1ImageUrl?: string | null;
        task2ImageUrl?: string | null;
        task1AttemptId?: string | null;
        task2AttemptId?: string | null;
        writingTestAttemptId?: string | null;
        error?: string;
      } | null;

      if (!res.ok || !data?.attemptId) {
        throw new Error(data?.error || "Unable to start test");
      }

      const params = new URLSearchParams();
      params.set("module", chosenTest.module);
      if (typeof data?.mode === "string" && data.mode) {
        params.set("attemptMode", data.mode);
      }
      if (typeof data?.durationMins === "number") {
        params.set("durationMins", String(data.durationMins));
      }
      if (Array.isArray(data?.selectedParts) && data.selectedParts.length) {
        params.set("selectedParts", data.selectedParts.join(","));
      }
      if (typeof data?.timeLimit === "string" && data.timeLimit) {
        params.set("timeLimit", data.timeLimit);
      }
      if (typeof data.writingDurationMins === "number") {
        params.set("writingDurationMins", String(data.writingDurationMins));
      }
      if (data?.task1PromptId) params.set("task1PromptId", data.task1PromptId);
      if (data?.task2PromptId) params.set("task2PromptId", data.task2PromptId);
      if (data?.task1ImageUrl) params.set("task1ImageUrl", data.task1ImageUrl);
      if (data?.task2ImageUrl) params.set("task2ImageUrl", data.task2ImageUrl);
      if (data?.task1AttemptId)
        params.set("task1AttemptId", data.task1AttemptId);
      if (data?.task2AttemptId)
        params.set("task2AttemptId", data.task2AttemptId);
      if (data?.writingTestAttemptId) {
        params.set("writingTestAttemptId", data.writingTestAttemptId);
      }

      router.push(
        `/exam-engine/${data.attemptId}/instructions?${params.toString()}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to start test";
      showToast("Could not start test", msg, "destructive");
    } finally {
      setStartingMode(null);
      setStartingTestId(null);
    }
  }

  if (skill === "speaking") {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-7xl bg-[#f7f5ee] px-4 py-8 text-slate-950">
      {toast ? (
        <div className="fixed right-4 top-4 z-60 w-full max-w-sm">
          <div
            className={[
              "rounded-xl border p-4 shadow-2xl backdrop-blur",
              toast.variant === "destructive"
                ? "border-rose-300 bg-rose-50 text-rose-800"
                : "border-emerald-300 bg-emerald-50 text-emerald-800",
            ].join(" ")}
            role="status"
            aria-live="polite"
          >
            <p className="text-sm font-bold">{toast.title}</p>
            <p className="mt-1 text-sm">{toast.description}</p>
          </div>
        </div>
      ) : null}

      <header className="relative overflow-hidden rounded-[2.25rem] bg-white p-8 shadow-[0_30px_90px_-60px_rgba(15,23,42,0.7)]">
        <div className="absolute right-0 top-0 h-56 w-56 rounded-bl-[8rem] bg-emerald-100" />
        <p className="relative inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
          <Sparkles size={14} />
          IELTS Exam Library
        </p>
        <h1 className="relative mt-5 text-4xl font-display tracking-tight text-slate-950 md:text-5xl">
          Practice {skill[0].toUpperCase() + skill.slice(1)}
        </h1>
        <p className="relative mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Select a test, choose your mode, and start your IELTS workflow.
        </p>
      </header>

      <div className="mt-5 flex flex-wrap gap-2">
        {SKILL_TABS.map((tab) => {
          const active = tab.value === skill;
          return (
            <Link
              key={tab.value}
              href={tab.href}
              className={[
                "rounded-full border px-4 py-2 text-sm font-semibold transition",
                active
                  ? "border-emerald-800 bg-emerald-900 text-white"
                  : "border-slate-200 bg-white/70 text-slate-700 hover:border-emerald-200 hover:bg-white",
              ].join(" ")}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-6 rounded-[1.5rem] bg-white/70 p-3 shadow-sm">
        <label className="relative block">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tests by title or keyword..."
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
          />
        </label>
      </div>

      {loading ? (
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-40 animate-pulse rounded-2xl bg-slate-200"
            />
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredTests.map((test) => {
            const isFree = test.isPractice;
            return (
              <button
                key={test.id}
                type="button"
                onClick={() => {
                  void openTest(test);
                }}
                disabled={Boolean(startingTestId)}
                className="group min-h-56 rounded-[2rem] bg-white p-6 text-left shadow-[0_24px_75px_-58px_rgba(15,23,42,0.75)] transition hover:-translate-y-1 hover:shadow-[0_30px_85px_-55px_rgba(15,23,42,0.85)]"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {test.variant}
                  </span>
                  <span
                    className={[
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                      isFree
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700",
                    ].join(" ")}
                  >
                    {isFree ? <Unlock size={12} /> : <Lock size={12} />}
                    {isFree ? "FREE" : "LOCKED"}
                  </span>
                </div>

                <h3 className="text-xl font-display tracking-tight text-slate-950">
                  {test.title}
                </h3>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                  {test.description || "No description"}
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="rounded-lg bg-slate-100 px-2 py-1">
                    {test.difficulty}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1">
                    <Clock3 size={12} />
                    {test.durationMins} min
                  </span>
                  <span className="rounded-lg bg-slate-100 px-2 py-1">
                    {test.attemptsCount ?? 0} attempts
                  </span>
                </div>
                {startingTestId === test.id ? (
                  <p className="mt-3 text-xs font-semibold text-brand-purple">
                    Starting test...
                  </p>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {showUpgradeModal && activeTest ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">
                  Upgrade to Pro
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {activeTest.title} is a premium simulation test.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUpgradeModal(false)}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-500"
              >
                <X size={16} />
              </button>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p className="inline-flex items-start gap-2">
                <CircleAlert size={16} className="mt-0.5" />
                Unlock full simulations, advanced analytics, and AI insights by
                upgrading.
              </p>
            </div>

            <div className="mt-5 flex items-center gap-2">
              <Link
                href="/pricing"
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-brand-purple to-brand-teal px-4 py-2.5 text-sm font-semibold text-white"
              >
                Upgrade to Pro
              </Link>
              <button
                type="button"
                onClick={() => setShowUpgradeModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showModeModal && activeTest ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">
                  Select Test Mode
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {activeTest.title} • Choose how you want to practice.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModeModal(false)}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-500"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.5rem] bg-emerald-50/80 p-5">
                <h4 className="text-base font-semibold text-slate-900">
                  Practice Mode
                </h4>
                <p className="mt-1 text-sm text-slate-600">
                  Pick parts/tasks and train with a custom timer.
                </p>

                <div className="mt-3 space-y-2">
                  {PARTS_BY_SKILL[skill as Exclude<Skill, "speaking">].map(
                    (part) => (
                      <label
                        key={part}
                        className="flex items-center gap-3 rounded-xl bg-white/70 px-3 py-2 text-sm text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={parts.includes(part)}
                          onChange={() => togglePart(part)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        {part}
                      </label>
                    ),
                  )}
                </div>

                <div className="mt-4">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Time Limit
                  </label>
                  <select
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    {TIME_LIMITS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => void startAttempt("practice")}
                  disabled={startingMode === "practice" || parts.length === 0}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-brand-teal px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {startingMode === "practice"
                    ? "Starting..."
                    : "Start Practice"}
                </button>
              </div>

              <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white">
                <h4 className="text-base font-semibold text-white">
                  Full Simulation
                </h4>
                <p className="mt-1 text-sm text-white/65">
                  Attempt the complete official-style test with standard timing.
                </p>

                <ul className="mt-3 space-y-2 text-sm text-white/70">
                  <li>• Full question set</li>
                  <li>• Official time format</li>
                  <li>• End-to-end test experience</li>
                </ul>

                <button
                  type="button"
                  onClick={() => void startAttempt("simulation")}
                  disabled={startingMode === "simulation"}
                  className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {startingMode === "simulation"
                    ? "Starting..."
                    : "Start Full Simulation"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
