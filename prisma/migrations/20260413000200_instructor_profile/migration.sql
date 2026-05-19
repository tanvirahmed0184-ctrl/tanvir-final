CREATE TABLE "InstructorProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "headline" TEXT,
  "bio" TEXT,
  "history" TEXT,
  "achievements" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "experienceYears" INTEGER,
  "avatarUrl" TEXT,
  "likesCount" INTEGER NOT NULL DEFAULT 0,
  "commentsCount" INTEGER NOT NULL DEFAULT 0,
  "viewsCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InstructorProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InstructorProfile_userId_key" ON "InstructorProfile"("userId");

ALTER TABLE "InstructorProfile"
ADD CONSTRAINT "InstructorProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
