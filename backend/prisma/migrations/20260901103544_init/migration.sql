-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "HotelExperienceStatus" AS ENUM ('ACTIVE', 'TO_VERIFY', 'NOT_FOUND', 'ERROR');

-- CreateEnum
CREATE TYPE "ScanHotelStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('PENDING', 'RUNNING', 'OK', 'ERROR', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ScanStepName" AS ENUM ('BASE', 'CAPTURE', 'OTA', 'RETURNING', 'MARKETING');

-- CreateEnum
CREATE TYPE "ScanErrorType" AS ENUM ('TIMEOUT', 'ELEMENT_NOT_FOUND', 'PAGE_UNAVAILABLE', 'AUTHENTICATION_ERROR', 'HOTEL_NOT_FOUND', 'NAVIGATION_ERROR', 'UNKNOWN_ERROR');

-- CreateEnum
CREATE TYPE "SignalSeverity" AS ENUM ('ALERT', 'VIGILANCE', 'OPPORTUNITY');

-- CreateEnum
CREATE TYPE "AudienceMode" AS ENUM ('NONE', 'SINGLE', 'MULTIPLE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hotel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "experienceLabel" TEXT NOT NULL,
    "city" TEXT,
    "starRating" INTEGER,
    "roomCount" INTEGER,
    "experienceStatus" "HotelExperienceStatus" NOT NULL DEFAULT 'TO_VERIFY',
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "lastConnectionCheckAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hotel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioHotel" (
    "portfolioId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioHotel_pkey" PRIMARY KEY ("portfolioId","hotelId")
);

-- CreateTable
CREATE TABLE "Scan" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT,
    "requestedById" TEXT NOT NULL,
    "period" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Scan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanHotel" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "status" "ScanHotelStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "healthScore" DOUBLE PRECISION,
    "healthLevel" TEXT,
    "rawResult" JSONB,

    CONSTRAINT "ScanHotel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanStep" (
    "id" TEXT NOT NULL,
    "scanHotelId" TEXT NOT NULL,
    "name" "ScanStepName" NOT NULL,
    "status" "StepStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ScanStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanError" (
    "id" TEXT NOT NULL,
    "scanHotelId" TEXT NOT NULL,
    "stepName" "ScanStepName" NOT NULL,
    "errorType" "ScanErrorType" NOT NULL,
    "userMessage" TEXT NOT NULL,
    "technicalMessage" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScanError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KPIDefinition" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "dateFilterable" BOOLEAN NOT NULL,
    "version" TEXT NOT NULL,
    "scraped" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "KPIDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KPIResult" (
    "id" TEXT NOT NULL,
    "scanHotelId" TEXT NOT NULL,
    "kpiDefinitionId" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "available" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "KPIResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalDefinition" (
    "playbookId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "severity" "SignalSeverity" NOT NULL,
    "conditionDescription" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "audienceMode" "AudienceMode" NOT NULL DEFAULT 'NONE',

    CONSTRAINT "SignalDefinition_pkey" PRIMARY KEY ("playbookId")
);

-- CreateTable
CREATE TABLE "SignalResult" (
    "id" TEXT NOT NULL,
    "scanHotelId" TEXT NOT NULL,
    "playbookId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "scanHotelId" TEXT NOT NULL,
    "signalResultId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "audienceDefinitionId" TEXT,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudienceDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "AudienceDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudienceResult" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "audienceDefinitionId" TEXT NOT NULL,
    "comparisonId" TEXT,
    "recipients" INTEGER NOT NULL,
    "highlighted" BOOLEAN NOT NULL DEFAULT false,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AudienceResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudienceComparison" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "playbookId" TEXT NOT NULL,
    "chosenResultId" TEXT,

    CONSTRAINT "AudienceComparison_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "ScanHotel_hotelId_idx" ON "ScanHotel"("hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "ScanStep_scanHotelId_name_key" ON "ScanStep"("scanHotelId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "KPIResult_scanHotelId_kpiDefinitionId_key" ON "KPIResult"("scanHotelId", "kpiDefinitionId");

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioHotel" ADD CONSTRAINT "PortfolioHotel_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioHotel" ADD CONSTRAINT "PortfolioHotel_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanHotel" ADD CONSTRAINT "ScanHotel_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanHotel" ADD CONSTRAINT "ScanHotel_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanStep" ADD CONSTRAINT "ScanStep_scanHotelId_fkey" FOREIGN KEY ("scanHotelId") REFERENCES "ScanHotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanError" ADD CONSTRAINT "ScanError_scanHotelId_fkey" FOREIGN KEY ("scanHotelId") REFERENCES "ScanHotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPIResult" ADD CONSTRAINT "KPIResult_scanHotelId_fkey" FOREIGN KEY ("scanHotelId") REFERENCES "ScanHotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPIResult" ADD CONSTRAINT "KPIResult_kpiDefinitionId_fkey" FOREIGN KEY ("kpiDefinitionId") REFERENCES "KPIDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalResult" ADD CONSTRAINT "SignalResult_scanHotelId_fkey" FOREIGN KEY ("scanHotelId") REFERENCES "ScanHotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalResult" ADD CONSTRAINT "SignalResult_playbookId_fkey" FOREIGN KEY ("playbookId") REFERENCES "SignalDefinition"("playbookId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_signalResultId_fkey" FOREIGN KEY ("signalResultId") REFERENCES "SignalResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_audienceDefinitionId_fkey" FOREIGN KEY ("audienceDefinitionId") REFERENCES "AudienceDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienceResult" ADD CONSTRAINT "AudienceResult_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienceResult" ADD CONSTRAINT "AudienceResult_audienceDefinitionId_fkey" FOREIGN KEY ("audienceDefinitionId") REFERENCES "AudienceDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienceResult" ADD CONSTRAINT "AudienceResult_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "AudienceComparison"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienceComparison" ADD CONSTRAINT "AudienceComparison_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
