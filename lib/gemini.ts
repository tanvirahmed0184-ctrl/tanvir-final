import { GoogleGenAI } from "@google/genai";

let _client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (_client) return _client;
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");
  _client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return _client;
}

export const GEMINI_MODEL = "gemini-2.0-flash";
