# IELTS Flow

IELTS Flow is a Next.js + Prisma + Supabase platform for IELTS preparation.

It includes:

- Reading/listening practice tests and question engine
- Writing prompts and evaluation workflow
- AI IELTS speaking attempt flow (Part 1/2/3) with audio turns, Whisper STT, Azure pronunciation, and Gemini rubric scoring
- Student and instructor dashboards
- Instructor slot booking with optional Meet link generation

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Prisma 7 (generated client at `app/generated/prisma`)
- PostgreSQL
- Supabase Auth (`@supabase/ssr`)
- Tailwind CSS v4

## Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL database (local or hosted)
- Supabase project (for auth)

## 1) Install

```bash
npm install
```

## 2) Environment Variables

Create a `.env` file in the project root with:

```env
# Prisma / Database
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB_NAME"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/DB_NAME"

# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"

# AI (required for writing/AI flows)
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"

# AI Speaking providers
OPENAI_API_KEY="YOUR_OPENAI_API_KEY"      # Whisper transcription
WHISPER_MODEL="whisper-1"
LOCAL_WHISPER_URL=""                      # e.g. http://127.0.0.1:9000/transcribe
LOCAL_WHISPER_TIMEOUT_MS="25000"
OLLAMA_BASE_URL="http://127.0.0.1:11434"
OLLAMA_MODEL="qwen3.5:4b"
OLLAMA_TIMEOUT_MS="35000"
AZURE_SPEECH_ENDPOINT=""                  # Azure Speech to Text endpoint URL
AZURE_SPEECH_KEY=""
SPEAKING_RECORDING_RETENTION_DAYS="30"    # auto-clean old speaking audio
SPEAKING_CLEANUP_SECRET=""                # required in production for cleanup endpoint

# Optional cache
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""

# Optional booking meet-link config
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REFRESH_TOKEN=""
```

Notes:

- If `UPSTASH_REDIS_REST_URL` is empty, Redis is disabled automatically.
- If Google credentials are missing, booking still works and meet link creation is skipped.

## 3) Generate Prisma Client

```bash
npx prisma generate
```

## 4) Run Migrations

Development migration:

```bash
npx prisma migrate dev
```

Production deploy migration:

```bash
npx prisma migrate deploy
```

Prisma-first workflow for Supabase:

```bash
# one-time: ensure Prisma can read datasource url
npx prisma validate

# dev schema sync (non-migration rapid iteration)
npx prisma db push

# team/prod-safe migration flow
npx prisma migrate dev --name your_change_name
npx prisma migrate deploy
```

Optional Supabase CLI link (for project metadata / functions):

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

## 5) Seed Database

Seed script file:

- `scripts/seed-db.ts`

Run seed script:

```bash
npx tsx scripts/seed-db.ts
```

If `tsx` is not available, install it once:

```bash
npm install -D tsx
```

Expected final output:

```text
Seeded successfully!
Tests: 3, Questions: 11, Writing: 2
```

## 6) Run App

```bash
npm run dev
```

Open `http://localhost:3000`.

## Useful Commands

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Speaking Recording Cleanup

Old speaking audio files can be cleaned up with:

```bash
curl -X POST http://localhost:3000/api/speaking/cleanup \
  -H "x-cleanup-secret: YOUR_SECRET"
```

Notes:

- If `SPEAKING_CLEANUP_SECRET` is set, the header is required.
- In production, always set `SPEAKING_CLEANUP_SECRET`.
- Cleanup removes both stored files and `SpeakingRecording` rows older than `SPEAKING_RECORDING_RETENTION_DAYS`.

## Speaking Reliability Notes

- Every speaking turn request now sends a `clientTurnId` (UUID-style) from frontend.
- The backend treats `clientTurnId` as lightweight idempotency key for each attempt turn.
- If a request is retried with the same `clientTurnId`, the existing attempt state is returned instead of creating duplicate processing.
- Minimal provider timing logs are emitted for Whisper, Azure, and Gemini evaluation passes.

## Local-First Speaking Setup

For speaking-only local inference:

- Run local Whisper service and set `LOCAL_WHISPER_URL`.
- Run Ollama with your local model and set:
  - `OLLAMA_BASE_URL`
  - `OLLAMA_MODEL` (default `qwen3.5:4b`)
- Keep cloud keys if you want fallback when local services are unavailable.

### Local Whisper Quick Start (Windows)

1. Keep app dev server running:
   ```bash
   npm run dev
   ```
2. Open another terminal in same project folder and install whisper server deps once:
   ```bash
   npm run whisper:install
   ```
3. Start local whisper server:
   ```bash
   npm run whisper:dev
   ```
4. In `.env`, set:
   ```env
   LOCAL_WHISPER_URL="http://127.0.0.1:9000/transcribe"
   LOCAL_WHISPER_MODEL="small"
   LOCAL_WHISPER_VAD_FILTER="false"
   LOCAL_WHISPER_VAD_MIN_SILENCE_MS="350"
   ```
5. Restart `npm run dev` after env changes.

If `npm run whisper:dev` terminal stays running and `/health` works, local whisper is active.

Provider priority in speaking flow:

1. Local Whisper (`LOCAL_WHISPER_URL`)
2. OpenAI Whisper (`OPENAI_API_KEY`)
3. Browser transcript fallback

Evaluation priority:

1. Gemini cloud (`GEMINI_API_KEY`)
2. Local Ollama (`OLLAMA_BASE_URL`, `OLLAMA_MODEL`)
3. Deterministic fallback evaluation

## Admin SQL (Role Management)

Use SQL against the same PostgreSQL database used by Prisma.

Promote a user to `ADMIN` by email:

```sql
UPDATE "User"
SET role = 'ADMIN'
WHERE email = 'admin@example.com';
```

Promote a user to `SUPER_ADMIN` by email:

```sql
UPDATE "User"
SET role = 'SUPER_ADMIN'
WHERE email = 'owner@example.com';
```

Promote by Supabase auth user id (`supabaseId`):

```sql
UPDATE "User"
SET role = 'INSTRUCTOR'
WHERE "supabaseId" = 'SUPABASE_USER_UUID';
```

Verify role assignments:

```sql
SELECT id, email, "supabaseId", role, "isActive"
FROM "User"
ORDER BY "createdAt" DESC;
```

Disable a user account without deleting data:

```sql
UPDATE "User"
SET "isActive" = false
WHERE email = 'user@example.com';
```

## Project Structure (High Level)

- `app/`: App Router pages, routes, and UI
- `app/api/`: Backend API routes
- `app/generated/prisma/`: Prisma generated client output
- `prisma/schema.prisma`: Data model
- `scripts/seed-db.ts`: Seed data script
- `lib/`: Shared server/client utilities (Prisma, Supabase, Redis, Gemini)
