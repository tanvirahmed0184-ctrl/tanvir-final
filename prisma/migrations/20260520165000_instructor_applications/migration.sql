CREATE TABLE "InstructorApplication" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "teachingExperience" TEXT NOT NULL,
  "ieltsExpertise" TEXT NOT NULL,
  "motivation" TEXT NOT NULL,
  "education" TEXT,
  "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "adminNotes" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InstructorApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InstructorApplication_status_createdAt_idx" ON "InstructorApplication"("status", "createdAt");
CREATE INDEX "InstructorApplication_email_idx" ON "InstructorApplication"("email");
