"use client";

import Link from "next/link";

export default function AdminHubPage() {
  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-gradient-to-r from-brand-purple via-brand-purple-dark to-brand-teal p-5 text-white shadow-lg">
        <h1 className="text-2xl font-bold">Admin Studio Hub</h1>
        <p className="mt-2 text-sm text-white/85">
          Unified authoring and management hub for IELTS content, tests, and speaking sets.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <HubCard
          title="Content Studio"
          body="Passages + question bank CSV draft editor in one flow."
          href="/dashboard/admin/content-studio"
        />
        <HubCard
          title="Test Studio"
          body="Test shell lifecycle + mapping + completeness checks."
          href="/dashboard/admin/test-studio"
        />
        <HubCard
          title="Speaking Studio"
          body="Prompt sets, live control, JSON import/export."
          href="/dashboard/admin/speaking-studio"
        />
        <HubCard
          title="Analytics"
          body="Platform-wide usage, content health, engagement."
          href="/dashboard/admin/analytics"
        />
      </section>
    </div>
  );
}

function HubCard({
  title,
  body,
  href,
}: {
  title: string;
  body: string;
  href: string;
}) {
  return (
    <article className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
      <p className="text-base font-bold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{body}</p>
      <Link
        href={href}
        className="mt-3 inline-flex rounded-lg bg-brand-purple px-3 py-1.5 text-xs font-semibold text-white"
      >
        Open
      </Link>
    </article>
  );
}
