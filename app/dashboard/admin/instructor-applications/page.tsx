"use client";

import { useEffect, useState } from "react";

type Application = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  teachingExperience: string;
  ieltsExpertise: string;
  motivation: string;
  education: string | null;
  specialties: string[];
  status: string;
  adminNotes: string | null;
  createdAt: string;
};

export default function InstructorApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadApplications() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/instructor-applications", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { applications?: Application[] } | null;
      setApplications(Array.isArray(data?.applications) ? data.applications : []);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: "APPROVED" | "REJECTED") {
    setBusyId(id);
    try {
      await fetch("/api/admin/instructor-applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      await loadApplications();
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    void loadApplications();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <p className="workspace-section-title">Instructor approval</p>
        <h1 className="mt-4 text-3xl font-semibold text-dash-text md:text-4xl">
          Instructor Applications
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-dash-text-muted">
          Review applications before instructor dashboard access is activated.
        </p>
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-3xl bg-dash-border/50" />
      ) : (
        <section className="grid gap-4">
          {applications.map((app) => (
            <article key={app.id} className="rounded-3xl bg-white/70 p-5 shadow-[0_22px_70px_-50px_rgba(27,46,38,0.5)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-dash-accent">
                    {app.status}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-dash-text">{app.name}</h2>
                  <p className="text-sm text-dash-text-muted">{app.email}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === app.id}
                    onClick={() => void updateStatus(app.id, "APPROVED")}
                    className="rounded-2xl bg-dash-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busyId === app.id}
                    onClick={() => void updateStatus(app.id, "REJECTED")}
                    className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-60"
                  >
                    Reject
                  </button>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Info title="Experience" text={app.teachingExperience} />
                <Info title="IELTS expertise" text={app.ieltsExpertise} />
                <Info title="Motivation" text={app.motivation} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {app.specialties.map((item) => (
                  <span key={item} className="rounded-full bg-dash-accent-light px-3 py-1 text-xs font-semibold text-dash-accent">
                    {item}
                  </span>
                ))}
              </div>
            </article>
          ))}
          {!applications.length ? (
            <p className="rounded-3xl bg-white/70 p-6 text-sm text-dash-text-muted">
              No instructor applications yet.
            </p>
          ) : null}
        </section>
      )}
    </div>
  );
}

function Info({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl bg-dash-bg/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-dash-text-muted">
        {title}
      </p>
      <p className="mt-2 line-clamp-5 text-sm leading-6 text-dash-text">{text}</p>
    </div>
  );
}
