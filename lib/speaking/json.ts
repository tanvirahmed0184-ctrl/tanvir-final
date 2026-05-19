import type { Prisma } from "@/app/generated/prisma/client";

export function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  if (value === null || value === undefined) return "";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => toInputJsonValue(item));
  }
  if (typeof value === "object") {
    const input = value as Record<string, unknown>;
    const out: Record<string, Prisma.InputJsonValue> = {};
    for (const key of Object.keys(input)) {
      out[key] = toInputJsonValue(input[key]);
    }
    return out;
  }
  return String(value);
}
