"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Role = "STUDENT" | "INSTRUCTOR" | "ADMIN";

const ROLE_OPTIONS: Role[] = ["STUDENT", "INSTRUCTOR", "ADMIN"];

function normalizeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}

export default function LoginPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [role, setRole] = useState<Role>("STUDENT");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      const ensureResponse = await fetch("/api/auth/ensure", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role }),
      });

      if (!ensureResponse.ok) {
        const payload = (await ensureResponse.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error || "Failed to sync account profile.");
      }

      const ensureData = (await ensureResponse.json().catch(() => null)) as {
        user?: { role?: string } | null;
        profile?: { onboardingCompleted?: boolean } | null;
      } | null;

      const resolvedRole = ensureData?.user?.role || role;

      if (resolvedRole === "ADMIN" || resolvedRole === "SUPER_ADMIN") {
        window.location.replace("/dashboard/admin/analytics");
        return;
      }

      if (resolvedRole === "INSTRUCTOR") {
        window.location.replace("/dashboard/instructor/availability");
        return;
      }

      const onboardingCompleted = Boolean(
        ensureData?.profile?.onboardingCompleted,
      );

      window.location.replace(
        onboardingCompleted ? "/dashboard/student/overview" : "/onboarding",
      );
    } catch (error) {
      setErrorMessage(normalizeError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Welcome Back</h1>
        <p className="text-sm text-slate-600">
          Sign in to continue your IELTS Flow preparation.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <span className="block text-sm font-medium text-slate-700">Role</span>
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1">
            {ROLE_OPTIONS.map((option) => {
              const active = role === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setRole(option)}
                  className={[
                    "rounded-lg px-3 py-2 text-sm font-medium transition",
                    active
                      ? "bg-brand-purple text-white shadow"
                      : "text-slate-700 hover:bg-slate-200",
                  ].join(" ")}
                >
                  {option[0] + option.slice(1).toLowerCase()}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-slate-700"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-slate-700"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
            placeholder="Your password"
          />
        </div>

        {errorMessage ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-brand-purple px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-purple-dark disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <p className="text-center text-sm text-slate-600">
        New here?{" "}
        <Link
          href="/register"
          className="font-medium text-brand-purple hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
