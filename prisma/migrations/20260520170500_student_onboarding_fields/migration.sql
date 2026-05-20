ALTER TABLE "UserProfile" ADD COLUMN "weakSkills" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "UserProfile" ADD COLUMN "examTimeline" TEXT;
