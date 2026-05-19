import { NextResponse } from "next/server";
import { GEMINI_MODEL, getGeminiClient } from "@/lib/gemini";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  messages?: unknown;
  transcript?: unknown;
  part?: unknown;
};

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

const SYSTEM_PROMPT = `You are a strict IELTS Speaking Examiner conducting
a simulated speaking test. Rules:
1. Ask exactly ONE question at a time
2. Keep responses under 2 sentences
3. If transcript contains [pause: Xs] tags or
   filler words (um, uh, ah), note internally for scoring
4. After Part 1 (4 questions), Part 2 (cue card + talk),
   and Part 3 (4 questions), output ONLY this JSON:
{
  "testComplete": true,
  "fluencyBand": 6.0,
  "lexicalBand": 6.5,
  "grammarBand": 6.0,
  "pronunciationBand": 6.0,
  "overallBand": 6.0,
  "fluencyFeedback": "...",
  "lexicalFeedback": "...",
  "grammarFeedback": "...",
  "pronunciationFeedback": "...",
  "fillerWordCount": 3,
  "pauseCount": 2
}`;

function toMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = item as Record<string, unknown>;
      const role = row.role === "assistant" ? "assistant" : "user";
      const text = typeof row.text === "string" ? row.text : "";
      return { role, text } as ChatMessage;
    })
    .filter((m) => m.text.trim().length > 0);
}

function extractText(response: {
  text?: string;
  outputText?: string;
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}): string {
  return (
    response.text ??
    response.outputText ??
    response.candidates?.[0]?.content?.parts?.[0]?.text ??
    ""
  );
}

function extractJson(text: string): Record<string, unknown> | null {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;

  const candidate = text.slice(first, last + 1);
  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const messages = toMessages(body.messages);
    const transcript =
      typeof body.transcript === "string" ? body.transcript : "";
    const part = typeof body.part === "string" ? body.part : "part_1";

    const ai = getGeminiClient();

    const conversation = messages
      .map((m) => `${m.role.toUpperCase()}: ${m.text}`)
      .join("\n");

    const prompt = `${SYSTEM_PROMPT}

Current Part: ${part}
Transcript:
${transcript || "(none)"}

Conversation so far:
${conversation || "(none)"}

Respond now according to rules.`;

    const modelResponse = (await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    })) as unknown as {
      text?: string;
      outputText?: string;
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const text = extractText(modelResponse).trim();

    if (!text) {
      throw new Error("Empty speaking response");
    }

    const parsed = extractJson(text);

    if (parsed && parsed.testComplete === true) {
      return NextResponse.json({ type: "evaluation", evaluation: parsed });
    }

    return NextResponse.json({ type: "question", text });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to run speaking chat", detail },
      { status: 500 },
    );
  }
}
