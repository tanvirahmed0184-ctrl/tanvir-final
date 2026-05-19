"use client";

import { FormEvent, useEffect, useState } from "react";
import { Save } from "lucide-react";

type InstructorProfile = {
  headline: string | null;
  bio: string | null;
  history: string | null;
  achievements: string[];
  specialties: string[];
  experienceYears: number | null;
  avatarUrl: string | null;
};

export default function InstructorProfilePage() {
  const [profile, setProfile] = useState<InstructorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/instructor/profile", { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as {
          profile?: InstructorProfile;
          error?: string;
        } | null;

        if (!res.ok || !data?.profile) {
          throw new Error(data?.error || "Failed to load profile");
        }

        if (!active) return;
        setProfile(data.profile);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load profile");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/instructor/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profile,
          achievements: profile.achievements,
          specialties: profile.specialties,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        profile?: InstructorProfile;
        error?: string;
      } | null;

      if (!res.ok || !data?.profile) {
        throw new Error(data?.error || "Failed to save profile");
      }

      setProfile(data.profile);
      setSuccess("Profile updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />;
  }

  if (!profile) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {error || "Unable to load instructor profile."}
      </div>
    );
  }

  return (
    <form
      onSubmit={onSave}
      className="space-y-4 rounded-2xl border border-brand-purple/15 bg-white p-5 shadow-sm"
    >
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Instructor Public Profile
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          This information is shown on the landing page card and instructor
          details page.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      <label className="block text-sm font-medium text-slate-700">
        Headline
        <input
          value={profile.headline ?? ""}
          onChange={(e) =>
            setProfile((prev) =>
              prev ? { ...prev, headline: e.target.value } : prev,
            )
          }
          placeholder="IELTS Speaking and Writing Mentor"
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
        />
      </label>

      <label className="block text-sm font-medium text-slate-700">
        Bio
        <textarea
          value={profile.bio ?? ""}
          onChange={(e) =>
            setProfile((prev) =>
              prev ? { ...prev, bio: e.target.value } : prev,
            )
          }
          rows={4}
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
        />
      </label>

      <label className="block text-sm font-medium text-slate-700">
        History
        <textarea
          value={profile.history ?? ""}
          onChange={(e) =>
            setProfile((prev) =>
              prev ? { ...prev, history: e.target.value } : prev,
            )
          }
          rows={4}
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Achievements (one per line)
          <textarea
            value={profile.achievements.join("\n")}
            onChange={(e) =>
              setProfile((prev) =>
                prev
                  ? {
                      ...prev,
                      achievements: e.target.value
                        .split("\n")
                        .map((line) => line.trim())
                        .filter(Boolean),
                    }
                  : prev,
              )
            }
            rows={5}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Specialties (comma separated)
          <textarea
            value={profile.specialties.join(", ")}
            onChange={(e) =>
              setProfile((prev) =>
                prev
                  ? {
                      ...prev,
                      specialties: e.target.value
                        .split(",")
                        .map((line) => line.trim())
                        .filter(Boolean),
                    }
                  : prev,
              )
            }
            rows={5}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Experience Years
          <input
            type="number"
            min={0}
            max={60}
            value={profile.experienceYears ?? ""}
            onChange={(e) =>
              setProfile((prev) =>
                prev
                  ? {
                      ...prev,
                      experienceYears:
                        e.target.value === "" ? null : Number(e.target.value),
                    }
                  : prev,
              )
            }
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Avatar URL (optional)
          <input
            value={profile.avatarUrl ?? ""}
            onChange={(e) =>
              setProfile((prev) =>
                prev ? { ...prev, avatarUrl: e.target.value } : prev,
              )
            }
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-purple px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
      >
        <Save size={16} />
        {saving ? "Saving..." : "Save Public Profile"}
      </button>
    </form>
  );
}
