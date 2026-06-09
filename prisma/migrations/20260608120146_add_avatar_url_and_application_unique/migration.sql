ALTER TABLE "Candidate" ADD COLUMN "avatarUrl" TEXT;
DELETE FROM "Application" a USING "Application" b WHERE a.id > b.id AND a."candidateId" = b."candidateId" AND a."jobOfferId" = b."jobOfferId";
CREATE UNIQUE INDEX "Application_candidateId_jobOfferId_key" ON "Application"("candidateId", "jobOfferId");
