"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

const legacyLinks = [
  { label: "Passage Builder", href: "/dashboard/admin/passages", desc: "CRUD for reading/listening/writing passages" },
  { label: "Question Bank Builder", href: "/dashboard/admin/question-bank", desc: "CSV template upload and bank management" },
  { label: "Question Map Builder", href: "/dashboard/admin/question-map", desc: "Build tests from bank items with validation" },
  { label: "Test Manager", href: "/dashboard/admin/resources", desc: "List, create, and toggle test visibility" },
  { label: "Speaking Prompts", href: "/dashboard/admin/speaking-prompts", desc: "Named prompt sets per speaking test" },
];

export default function AdminLegacyPages() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-dash-text">Legacy Tools</h1>
        <p className="mt-1 text-sm text-dash-text-muted">
          All existing admin tools preserved for compatibility and power-user workflows.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        {legacyLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group flex items-center justify-between rounded-xl border border-dash-border bg-dash-surface px-5 py-4 transition-all duration-150 hover:border-dash-accent/25 hover:shadow-sm"
          >
            <div>
              <p className="text-sm font-medium text-dash-text">{link.label}</p>
              <p className="mt-0.5 text-xs text-dash-text-muted">{link.desc}</p>
            </div>
            <ArrowRight size={16} className="text-dash-text-light transition-colors group-hover:text-dash-accent" />
          </Link>
        ))}
      </section>
    </div>
  );
}
