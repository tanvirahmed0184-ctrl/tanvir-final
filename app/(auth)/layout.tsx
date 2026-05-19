import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto flex min-h-[80vh] w-full max-w-lg items-center justify-center">
        <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {children}
        </section>
      </div>
    </main>
  );
}
