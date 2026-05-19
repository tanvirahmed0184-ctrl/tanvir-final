"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";

const DEFAULT_SETTINGS = {
  maintenanceMode: false,
  allowNewRegistrations: true,
  autoPublishGeneratedQuestions: false,
  analyticsWindowDays: 7,
  supportEmail: "support@ieltsflow.com",
  defaultModule: "READING",
  defaultDifficulty: "MEDIUM",
  autoCopyPassageId: true,
  autoSuggestPassageLinking: true,
  csvTemplate: "IELTS_DEFAULT",
  requireReadyBeforeLive: true,
  publishReplaceConfirmation: true,
  speakingSilenceThreshold: 11,
  retryRules: "standard",
  evalProviderPriority: "gemini>ollama>fallback",
};

export default function AdminSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [adminName, setAdminName] = useState("Admin");
  const [adminEmail, setAdminEmail] = useState("-");
  const [adminRole, setAdminRole] = useState("ADMIN");

  const [maintenanceMode, setMaintenanceMode] = useState(
    DEFAULT_SETTINGS.maintenanceMode,
  );
  const [allowNewRegistrations, setAllowNewRegistrations] = useState(
    DEFAULT_SETTINGS.allowNewRegistrations,
  );
  const [autoPublishGeneratedQuestions, setAutoPublishGeneratedQuestions] =
    useState(DEFAULT_SETTINGS.autoPublishGeneratedQuestions);
  const [analyticsWindowDays, setAnalyticsWindowDays] = useState(
    DEFAULT_SETTINGS.analyticsWindowDays,
  );
  const [supportEmail, setSupportEmail] = useState(
    DEFAULT_SETTINGS.supportEmail,
  );
  const [defaultModule, setDefaultModule] = useState(DEFAULT_SETTINGS.defaultModule);
  const [defaultDifficulty, setDefaultDifficulty] = useState(
    DEFAULT_SETTINGS.defaultDifficulty,
  );
  const [autoCopyPassageId, setAutoCopyPassageId] = useState(
    DEFAULT_SETTINGS.autoCopyPassageId,
  );
  const [autoSuggestPassageLinking, setAutoSuggestPassageLinking] = useState(
    DEFAULT_SETTINGS.autoSuggestPassageLinking,
  );
  const [csvTemplate, setCsvTemplate] = useState(DEFAULT_SETTINGS.csvTemplate);
  const [requireReadyBeforeLive, setRequireReadyBeforeLive] = useState(
    DEFAULT_SETTINGS.requireReadyBeforeLive,
  );
  const [publishReplaceConfirmation, setPublishReplaceConfirmation] = useState(
    DEFAULT_SETTINGS.publishReplaceConfirmation,
  );
  const [speakingSilenceThreshold, setSpeakingSilenceThreshold] = useState(
    DEFAULT_SETTINGS.speakingSilenceThreshold,
  );
  const [retryRules, setRetryRules] = useState(DEFAULT_SETTINGS.retryRules);
  const [evalProviderPriority, setEvalProviderPriority] = useState(
    DEFAULT_SETTINGS.evalProviderPriority,
  );

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      const timer = window.setTimeout(() => {
        setError("Unable to load admin profile");
        setLoading(false);
      }, 0);
      return () => {
        window.clearTimeout(timer);
      };
    }

    const timer = window.setTimeout(() => {
      setAdminName(
        typeof user.name === "string" && user.name.trim() ? user.name : "Admin",
      );
      setAdminEmail(typeof user.email === "string" ? user.email : "-");
      setAdminRole(typeof user.role === "string" ? user.role : "ADMIN");
      setLoading(false);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [authLoading, user]);

  function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    // These values are currently UI-level operational defaults.
    // They can be persisted via a dedicated admin settings API in a later phase.
    setTimeout(() => {
      setSaving(false);
      setMessage("Settings saved locally for this session.");
    }, 350);
  }

  if (loading) {
    return (
      <div className="grid gap-4">
        <div className="h-32 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-96 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-gradient-to-r from-brand-purple via-brand-purple-dark to-brand-teal p-5 text-white shadow-lg">
        <h1 className="text-2xl font-bold">Admin Settings</h1>
        <p className="mt-2 text-sm text-white/85">
          Configure platform operations, moderation defaults, and system
          preferences.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm md:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Administrator
          </p>
          <h2 className="mt-2 text-lg font-bold text-slate-900">{adminName}</h2>
          <p className="text-sm text-slate-600">{adminEmail}</p>
        </article>

        <article className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Access Role
          </p>
          <p className="mt-2 text-lg font-bold text-slate-900">{adminRole}</p>
          <p className="text-sm text-slate-600">Operational control enabled</p>
        </article>
      </section>

      <section className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
        <form onSubmit={onSave} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <ToggleField
              label="Maintenance Mode"
              description="Show maintenance state for non-admin users."
              value={maintenanceMode}
              onChange={setMaintenanceMode}
            />

            <ToggleField
              label="Allow New Registrations"
              description="Enable new account onboarding flow."
              value={allowNewRegistrations}
              onChange={setAllowNewRegistrations}
            />

            <ToggleField
              label="Auto Publish AI Questions"
              description="Immediately publish approved generated questions."
              value={autoPublishGeneratedQuestions}
              onChange={setAutoPublishGeneratedQuestions}
            />

            <label className="block rounded-xl border border-slate-200 p-3 text-sm">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Analytics Window (Days)
              </span>
              <input
                type="number"
                min={1}
                max={90}
                value={analyticsWindowDays}
                onChange={(e) =>
                  setAnalyticsWindowDays(
                    Math.max(1, Math.min(90, Number(e.target.value) || 1)),
                  )
                }
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="block rounded-xl border border-slate-200 p-3 text-sm">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Default Module
              </span>
              <select
                value={defaultModule}
                onChange={(e) => setDefaultModule(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="READING">READING</option>
                <option value="LISTENING">LISTENING</option>
                <option value="WRITING">WRITING</option>
              </select>
            </label>

            <label className="block rounded-xl border border-slate-200 p-3 text-sm">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Default Difficulty
              </span>
              <select
                value={defaultDifficulty}
                onChange={(e) => setDefaultDifficulty(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="EASY">EASY</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HARD">HARD</option>
              </select>
            </label>

            <ToggleField
              label="Auto-copy Passage ID on Save"
              description="Auto-copy generated passage id after passage create."
              value={autoCopyPassageId}
              onChange={setAutoCopyPassageId}
            />

            <ToggleField
              label="Auto Suggest Passage Linking"
              description="Suggest passage_id in CSV drafts from module + section."
              value={autoSuggestPassageLinking}
              onChange={setAutoSuggestPassageLinking}
            />

            <label className="block rounded-xl border border-slate-200 p-3 text-sm">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                CSV Template Profile
              </span>
              <input
                value={csvTemplate}
                onChange={(e) => setCsvTemplate(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <ToggleField
              label="Require Ready Before Live"
              description="Prevent direct publish from Draft to Live."
              value={requireReadyBeforeLive}
              onChange={setRequireReadyBeforeLive}
            />

            <ToggleField
              label="Confirm Before Replacing Live"
              description="Show confirmation modal before replacing live content."
              value={publishReplaceConfirmation}
              onChange={setPublishReplaceConfirmation}
            />

            <label className="block rounded-xl border border-slate-200 p-3 text-sm">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Speaking Silence Threshold (seconds)
              </span>
              <input
                type="number"
                min={5}
                max={60}
                value={speakingSilenceThreshold}
                onChange={(e) =>
                  setSpeakingSilenceThreshold(
                    Math.max(5, Math.min(60, Number(e.target.value) || 11)),
                  )
                }
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="block rounded-xl border border-slate-200 p-3 text-sm">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Retry Rules
              </span>
              <input
                value={retryRules}
                onChange={(e) => setRetryRules(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="block rounded-xl border border-slate-200 p-3 text-sm">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Evaluation Provider Priority
              </span>
              <input
                value={evalProviderPriority}
                onChange={(e) => setEvalProviderPriority(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Support Email
            </span>
            <input
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-brand-purple px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </form>
      </section>
    </div>
  );
}

function ToggleField({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="block rounded-xl border border-slate-200 p-3 text-sm">
      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <p className="mt-1 text-xs text-slate-600">{description}</p>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={[
          "mt-3 rounded-full px-3 py-1 text-xs font-semibold",
          value
            ? "bg-emerald-100 text-emerald-700"
            : "bg-slate-200 text-slate-700",
        ].join(" ")}
      >
        {value ? "Enabled" : "Disabled"}
      </button>
    </label>
  );
}
