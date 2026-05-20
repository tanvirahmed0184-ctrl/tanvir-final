import { XMLParser } from "fast-xml-parser";
import { NextResponse } from "next/server";

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

const FEEDS = [
  {
    category: "British Council",
    url: "https://news.google.com/rss/search?q=IELTS%20site%3Atakeielts.britishcouncil.org&hl=en-US&gl=US&ceid=US:en",
  },
  {
    category: "Cambridge",
    url: "https://news.google.com/rss/search?q=IELTS%20site%3Acambridgeenglish.org&hl=en-US&gl=US&ceid=US:en",
  },
  {
    category: "IELTS",
    url: "https://news.google.com/rss/search?q=IELTS%20site%3Aielts.org&hl=en-US&gl=US&ceid=US:en",
  },
  {
    category: "Universities",
    url: "https://news.google.com/rss/search?q=IELTS%20university%20English%20language%20requirements&hl=en-US&gl=US&ceid=US:en",
  },
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: true,
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function itemId(url: string, title: string): string {
  return Buffer.from(`${url}-${title}`).toString("base64url").slice(0, 28);
}

export async function GET() {
  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const response = await fetch(feed.url, {
        headers: {
          "User-Agent":
            "IELTS-Flow/1.0 (+https://ielts-flow.local; educational article discovery)",
        },
        next: { revalidate: 1800 },
      });

      if (!response.ok) {
        throw new Error(`Feed failed: ${feed.category}`);
      }

      const xml = await response.text();
      const parsed = parser.parse(xml) as {
        rss?: {
          channel?: {
            item?: Array<{
              title?: string;
              link?: string;
              pubDate?: string;
              description?: string;
              source?: { "#text"?: string; url?: string } | string;
            }>;
          };
        };
      };

      return asArray(parsed.rss?.channel?.item).map<JournalArticle | null>(
        (item) => {
          const title = stripHtml(item.title || "");
          const url = item.link || "";
          if (!title || !url) return null;

          const source =
            typeof item.source === "string"
              ? item.source
              : item.source?.["#text"] || feed.category;

          const summary = stripHtml(item.description || "")
            .replace(title, "")
            .slice(0, 180)
            .trim();

          return {
            id: itemId(url, title),
            title,
            url,
            source,
            sourceUrl:
              typeof item.source === "object" ? item.source.url || null : null,
            publishedAt: item.pubDate
              ? new Date(item.pubDate).toISOString()
              : null,
            summary,
            category: feed.category,
          };
        },
      );
    }),
  );

  const articles = results
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .filter((article): article is JournalArticle => Boolean(article))
    .filter(
      (article, index, all) =>
        all.findIndex((candidate) => candidate.url === article.url) === index,
    )
    .sort((a, b) => {
      const aTime = a.publishedAt ? +new Date(a.publishedAt) : 0;
      const bTime = b.publishedAt ? +new Date(b.publishedAt) : 0;
      return bTime - aTime;
    })
    .slice(0, 24);

  return NextResponse.json({ articles });
}
