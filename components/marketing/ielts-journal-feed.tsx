"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BookOpenText, Newspaper } from "lucide-react";

type JournalArticle = {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceUrl: string | null;
  publishedAt: string | null;
  summary: string;
  category: string;
};

function formatDate(value: string | null): string {
  if (!value) return "Latest";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export default function IeltsJournalFeed() {
  const [articles, setArticles] = useState<JournalArticle[]>([]);
  const [visibleCount, setVisibleCount] = useState(4);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/marketing/ielts-journal", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load IELTS journal feed");
        const payload = (await res.json()) as {
          articles?: JournalArticle[];
        };
        if (!active) return;
        setArticles(Array.isArray(payload.articles) ? payload.articles : []);
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load live IELTS articles",
        );
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const visibleArticles = useMemo(
    () => articles.slice(0, visibleCount),
    [articles, visibleCount],
  );

  function articleKey(article: JournalArticle, index: number): string {
    return [
      article.id || "article",
      article.url || "url",
      article.source || "source",
      article.publishedAt || "date",
      index,
    ].join("::");
  }

  if (loading) {
    return (
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-72 animate-pulse rounded-[2rem] border border-slate-100 bg-slate-100"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        {error}
      </div>
    );
  }

  if (!articles.length) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
        No live IELTS articles are available from the configured trusted sources
        right now. Please try again later.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {visibleArticles.map((article, index) => (
          <a
            key={articleKey(article, index)}
            href={article.url}
            target="_blank"
            rel="noreferrer"
            className={[
              "group flex min-h-[20rem] flex-col rounded-[2rem] border border-slate-200 bg-white p-5 transition-all duration-500 hover:-translate-y-1 hover:border-brand-teal/30 hover:shadow-2xl hover:shadow-slate-200/70",
              index % 4 === 0 ? "xl:translate-y-5" : "",
              index % 4 === 2 ? "xl:translate-y-8" : "",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                <Newspaper size={12} />
                {article.category}
              </span>
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition group-hover:border-brand-teal/30 group-hover:text-brand-teal-dark">
                <ArrowUpRight size={15} />
              </span>
            </div>

            <div className="mt-8 flex-1">
              <p className="text-xs font-medium text-brand-teal-dark">
                {article.source} • {formatDate(article.publishedAt)}
              </p>
              <h3 className="mt-3 text-xl font-display leading-tight tracking-tight text-slate-950">
                {article.title}
              </h3>
              <p className="mt-4 line-clamp-4 text-sm leading-6 text-slate-500">
                {article.summary || "Open the original source for the full article and publication context."}
              </p>
            </div>

            <div className="mt-7 flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                <BookOpenText size={14} />
                Source article
              </span>
              <span className="text-xs font-semibold text-brand-purple opacity-0 transition group-hover:opacity-100">
                Read
              </span>
            </div>
          </a>
        ))}
      </div>

      {visibleCount < articles.length ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + 4)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-brand-teal/30 hover:bg-slate-50"
          >
            View More Articles
          </button>
        </div>
      ) : (
        <div className="flex justify-center text-xs font-medium text-slate-400">
          Live feed loaded from trusted IELTS and education sources.
        </div>
      )}
    </div>
  );
}
