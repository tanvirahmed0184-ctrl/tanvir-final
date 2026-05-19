"use client";

import Link from "next/link";

const legacyLinks = [
  { label: "Passage", href: "/dashboard/admin/passages" },
  { label: "Question Bank Builder", href: "/dashboard/admin/question-bank" },
  { label: "Question Map Builder", href: "/dashboard/admin/question-map" },
  { label: "Test Manager", href: "/dashboard/admin/resources" },
  { label: "Speaking Prompts", href: "/dashboard/admin/speaking-prompts" },
];

export default function AdminLegacyPages() {
  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-gradient-to-r from-brand-purple via-brand-purple-dark to-brand-teal p-5 text-white shadow-lg">
        <h1 className="text-2xl font-bold">Legacy Admin Pages</h1>
        <p className="mt-2 text-sm text-white/85">
          All existing admin tools are preserved here for compatibility and power-user flow.
        </p>
      </section>

      <section className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2">
          {legacyLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
