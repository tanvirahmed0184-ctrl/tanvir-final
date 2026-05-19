-- CreateEnum
CREATE TYPE "SpeakingPart" AS ENUM ('PART_1', 'PART_2_PREP', 'PART_2', 'PART_3');

-- CreateEnum
CREATE TYPE "SpeakingTurnRole" AS ENUM ('EXAMINER', 'CANDIDATE');

-- CreateTable
CREATE TABLE "SpeakingAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "mode" TEXT NOT NULL DEFAULT 'simulation',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "currentPart" "SpeakingPart" NOT NULL DEFAULT 'PART_1',
    "currentQuestionIndex" INTEGER NOT NULL DEFAULT 0,
    "totalQuestionsAsked" INTEGER NOT NULL DEFAULT 0,
    "latestExaminerPrompt" TEXT,
    "transcriptFull" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "errorMessage" TEXT,

    CONSTRAINT "SpeakingAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakingTurn" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "part" "SpeakingPart" NOT NULL,
    "role" "SpeakingTurnRole" NOT NULL DEFAULT 'CANDIDATE',
    "sequence" INTEGER NOT NULL,
    "examinerPrompt" TEXT NOT NULL,
    "userTranscript" TEXT NOT NULL DEFAULT '',
    "transcriptSource" TEXT,
    "fillerWordCount" INTEGER NOT NULL DEFAULT 0,
    "pauseCount" INTEGER NOT NULL DEFAULT 0,
    "pauseDurationMs" INTEGER NOT NULL DEFAULT 0,
    "speechRateWpm" DOUBLE PRECISION,
    "durationMs" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "silencePromptShown" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,

    CONSTRAINT "SpeakingTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakingRecording" (
    "id" TEXT NOT NULL,
    "turnId" TEXT NOT NULL,
    "storagePath" TEXT,
    "publicUrl" TEXT,
    "mimeType" TEXT,
    "durationMs" INTEGER,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpeakingRecording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakingEvaluation" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "fluencyCoherence" DOUBLE PRECISION,
    "lexicalResource" DOUBLE PRECISION,
    "grammaticalRangeAccuracy" DOUBLE PRECISION,
    "pronunciation" DOUBLE PRECISION,
    "overallBand" DOUBLE PRECISION,
    "criterionFeedback" JSONB NOT NULL DEFAULT '{}',
    "actionableTips" JSONB NOT NULL DEFAULT '[]',
    "grammarCorrections" JSONB NOT NULL DEFAULT '[]',
    "vocabularyUpgrades" JSONB NOT NULL DEFAULT '[]',
    "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "weaknesses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pronunciationSummary" JSONB NOT NULL DEFAULT '{}',
    "examinerSummary" TEXT,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpeakingEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpeakingAttempt_userId_status_startedAt_idx" ON "SpeakingAttempt"("userId", "status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SpeakingTurn_attemptId_sequence_key" ON "SpeakingTurn"("attemptId", "sequence");

-- CreateIndex
CREATE INDEX "SpeakingTurn_attemptId_part_sequence_idx" ON "SpeakingTurn"("attemptId", "part", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "SpeakingRecording_turnId_key" ON "SpeakingRecording"("turnId");

-- CreateIndex
CREATE UNIQUE INDEX "SpeakingEvaluation_attemptId_key" ON "SpeakingEvaluation"("attemptId");

-- AddForeignKey
ALTER TABLE "SpeakingAttempt" ADD CONSTRAINT "SpeakingAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingTurn" ADD CONSTRAINT "SpeakingTurn_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "SpeakingAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingRecording" ADD CONSTRAINT "SpeakingRecording_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "SpeakingTurn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingEvaluation" ADD CONSTRAINT "SpeakingEvaluation_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "SpeakingAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
