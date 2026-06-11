-- CreateEnum
CREATE TYPE "ChannelIdentityStatus" AS ENUM ('PENDING', 'LINKED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ChannelLinkMethod" AS ENUM ('TOKEN', 'PHONE_MATCH', 'MANUAL');

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_candidateId_fkey";

-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "langScoreENVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "langScoreFRVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "memory" JSONB;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "aiAnalysis" JSONB;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "channelIdentityId" TEXT,
ADD COLUMN     "enterpriseId" TEXT,
ALTER COLUMN "candidateId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ChannelIdentity" (
    "id" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "candidateId" TEXT,
    "status" "ChannelIdentityStatus" NOT NULL DEFAULT 'PENDING',
    "linkedVia" "ChannelLinkMethod",
    "pendingExtract" JSONB,
    "msgCountDay" INTEGER NOT NULL DEFAULT 0,
    "msgWindowStart" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelLinkToken" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "platform" "SocialPlatform",
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelLinkToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "externalId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisputeAttachment" (
    "id" TEXT NOT NULL,
    "checkpointId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisputeAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelIdentity_platform_externalUserId_key" ON "ChannelIdentity"("platform", "externalUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelLinkToken_code_key" ON "ChannelLinkToken"("code");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_externalId_key" ON "WebhookEvent"("externalId");

-- CreateIndex
CREATE INDEX "DisputeAttachment_checkpointId_idx" ON "DisputeAttachment"("checkpointId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_channelIdentityId_key" ON "Conversation"("channelIdentityId");

-- CreateIndex
CREATE INDEX "Conversation_enterpriseId_idx" ON "Conversation"("enterpriseId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_enterpriseId_platform_key" ON "Conversation"("enterpriseId", "platform");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "Enterprise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_channelIdentityId_fkey" FOREIGN KEY ("channelIdentityId") REFERENCES "ChannelIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelIdentity" ADD CONSTRAINT "ChannelIdentity_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelLinkToken" ADD CONSTRAINT "ChannelLinkToken_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeAttachment" ADD CONSTRAINT "DisputeAttachment_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "Checkpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeAttachment" ADD CONSTRAINT "DisputeAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

