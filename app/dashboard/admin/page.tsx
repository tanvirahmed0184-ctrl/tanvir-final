"use client";

import Link from "next/link";
import {
  Archive,
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Mic,
  Settings,
  Target,
  Users,
} from "lucide-react";

const hubs = [
  {
    title: "Content Studio",
    description: "Passages + question bank CSV draft editor in one flow.",
    href: "/dashboard/admin/content-studio",
    icon: BookOpen,
    color: "text-emerald-700 bg-emerald-50",
    eyebrow: "Authoring",
    features: ["Passage workspace", "CSV draft editor", "Media attachments"],
  },
  {
    title: "Test Studio",
    description: "Test shell lifecycle + mapping + completeness checks.",
    href: "/dashboard/admin/test-studio",
    icon: Target,
    color: "text-teal-700 bg-teal-50",
    eyebrow: "Publishing",
    features: ["Create shell", "Map sections", "Inspector + publish"],
  },
  {
    title: "Speaking Studio",
    description: "Prompt sets, live control, JSON import/export.",
    href: "/dashboard/admin/speaking-studio",
    icon: Mic,
    color: "text-lime-800 bg-lime-50",
    eyebrow: "Speaking engine",
    features: ["Prompt set manager", "Live set governance", "Usage monitor"],
  },
  {
    title: "Analytics",
    description: "Platform-wide usage, content health, engagement.",
    href: "/dashboard/admin/analytics",
    icon: BarChart3,
    color: "text-amber-700 bg-amber-50",
    eyebrow: "Insights",
    features: ["Attempt activity", "Content health", "Risk signals"],
  },
];

const operations = [
  {
    title: "Users",
    href: "/dashboard/admin/users",
    icon: Users,
    description: "Role management, learner records, and instructor accounts.",
  },
  {
    title: "Settings",
    href: "/dashboard/admin/settings",
    icon: Settings,
    description: "Platform preferences, policy toggles, and operational defaults.",
  },
  {
    title: "Legacy Tools",
    href: "/dashboard/admin/legacy",
    icon: Archive,
    description: "Older builders kept available while the studio workflow matures.",
  },
];

const healthSignals = [
  { label: "Content coverage", value: "Ready", icon: Database },
  { label: "CSV pipeline", value: "Editable", icon: FileSpreadsheet },
  { label: "Publishing guardrails", value: "Mapped", icon: CheckCircle2 },
];

export default function AdminHubPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="workspace-section-title">Admin operating system</p>
        <h1 className="mt-4 text-3xl font-semibold text-dash-text md:text-4xl">
          Studio Hub
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-dash-text-muted md:text-base">
          A calm command center for IELTS content production, test publishing,
          speaking governance, analytics, users, settings, and the legacy
          builders that still support the workflow.
        </p>
      </div>

      <section className="grid gap-4 xl:grid-cols-[1.45fr_0.55fr]">
        <div className="grid gap-4 md:grid-cols-2">
          {hubs.map((hub) => {
            const Icon = hub.icon;
            return (
              <Link
                key={hub.title}
                href={hub.href}
                className="group relative overflow-hidden rounded-3xl border border-dash-border bg-dash-surface p-6"
              >
                <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-[4rem] bg-dash-accent-light/70 transition-transform group-hover:scale-110" />
                <div className="relative">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-dash-text-muted">
                        {hub.eyebrow}
                      </p>
                      <h2 className="mt-3 text-lg font-semibold text-dash-text">
                        {hub.title}
                      </h2>
                    </div>
                    <div
                      className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${hub.color}`}
                    >
                      <Icon size={20} />
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-dash-text-muted">
                    {hub.description}
                  </p>

                  <div className="mt-5 grid gap-2">
                    {hub.features.map((feature) => (
                      <div
                        key={feature}
                        className="flex items-center gap-2 rounded-2xl border border-dash-border/80 bg-white/60 px-3 py-2 text-xs font-medium text-dash-text"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-dash-accent" />
                        {feature}
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-dash-accent">
                    Open workspace
                    <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <aside className="rounded-3xl border border-dash-border bg-dash-surface p-6">
          <p className="workspace-section-title">Workspace health</p>
          <div className="mt-5 space-y-3">
            {healthSignals.map((signal) => {
              const Icon = signal.icon;
              return (
                <div
                  key={signal.label}
                  className="rounded-2xl border border-dash-border/80 bg-white/65 p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-dash-accent-light text-dash-accent">
                      <Icon size={17} />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-dash-text-muted">
                        {signal.label}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-dash-text">
                        {signal.value}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {operations.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.title}
              href={item.href}
              className="group rounded-3xl border border-dash-border bg-dash-surface p-5"
            >
              <div className="flex items-start gap-4">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-dash-accent-light text-dash-accent">
                  <Icon size={18} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-dash-text">
                    {item.title}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-dash-text-muted">
                    {item.description}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-dash-accent">
                    Manage
                    <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="rounded-3xl border border-dash-border bg-dash-surface p-6">
        <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <p className="workspace-section-title">Production rhythm</p>
            <h2 className="mt-3 text-xl font-semibold text-dash-text">
              From draft content to live IELTS workflow
            </h2>
            <p className="mt-2 text-sm leading-6 text-dash-text-muted">
              The admin area now reads like a connected editorial system: author
              content, assemble tests, govern speaking sets, then monitor
              platform health.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            {["Author", "Validate", "Publish", "Monitor"].map((step, index) => (
              <div
                key={step}
                className="rounded-2xl border border-dash-border/80 bg-white/65 p-4"
              >
                <span className="text-xs font-bold text-dash-accent">
                  0{index + 1}
                </span>
                <p className="mt-3 text-sm font-semibold text-dash-text">
                  {step}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
