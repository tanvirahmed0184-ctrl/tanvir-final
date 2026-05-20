import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f7f5ee] px-4 py-10">
      <div className="mx-auto grid min-h-[80vh] w-full max-w-5xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="hidden lg:block">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-800">
            IELTS Flow
          </p>
          <h1 className="mt-4 text-5xl font-display leading-tight tracking-tight text-slate-950">
            A calmer way to prepare for IELTS.
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-slate-600">
            Premium practice, instructor support, and progress intelligence in
            one focused educational workspace.
          </p>
        </aside>
        <section className="w-full rounded-[2rem] bg-white/85 p-6 shadow-[0_30px_90px_-65px_rgba(15,23,42,0.75)] backdrop-blur sm:p-8">
          {children}
        </section>
      </div>
    </main>
  );
}
