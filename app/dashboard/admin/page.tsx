"use client";

import Link from "next/link";
import { BookOpen, Target, Mic, BarChart3, ArrowRight } from "lucide-react";

const hubs = [
  {
    title: "Content Studio",
    description: "Passages + question bank CSV draft editor in one flow.",
    href: "/dashboard/admin/content-studio",
    icon: BookOpen,
    color: "text-emerald-600 bg-emerald-50",
  },
  {
    title: "Test Studio",
    description: "Test shell lifecycle + mapping + completeness checks.",
    href: "/dashboard/admin/test-studio",
    icon: Target,
    color: "text-blue-600 bg-blue-50",
  },
  {
    title: "Speaking Studio",
    description: "Prompt sets, live control, JSON import/export.",
    href: "/dashboard/admin/speaking-studio",
    icon: Mic,
    color: "text-violet-600 bg-violet-50",
  },
  {
    title: "Analytics",
    description: "Platform-wide usage, content health, engagement.",
    href: "/dashboard/admin/analytics",
    icon: BarChart3,
    color: "text-amber-600 bg-amber-50",
  },
];

export default function AdminHubPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-dash-text">Studio Hub</h1>
        <p className="mt-1 text-sm text-dash-text-muted">
          Unified authoring and management hub for IELTS content, tests, and speaking sets.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {hubs.map((hub) => {
          const Icon = hub.icon;
          return (
            <Link
              key={hub.title}
              href={hub.href}
              className="group relative rounded-xl border border-dash-border bg-dash-surface p-5 transition-all duration-200 hover:border-dash-accent/25 hover:shadow-sm"
            >
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${hub.color} mb-4`}>
                <Icon size={18} />
              </div>
              <h2 className="text-sm font-semibold text-dash-text">{hub.title}</h2>
              <p className="mt-1 text-[13px] text-dash-text-muted leading-relaxed">
                {hub.description}
              </p>
              <div className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-dash-accent opacity-0 transition-opacity group-hover:opacity-100">
                Open
                <ArrowRight size={12} />
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
