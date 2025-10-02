-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'VENDOR', 'GUARD');

-- CreateEnum
CREATE TYPE "COIStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FileKind" AS ENUM ('CERTIFICATE', 'ENDORSEMENT', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL,
    "vendorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementTemplate" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "generalLiabMin" INTEGER,
    "autoLiabMin" INTEGER,
    "workersCompRequired" BOOLEAN NOT NULL DEFAULT true,
    "umbrellaMin" INTEGER,
    "additionalInsuredText" TEXT,
    "certificateHolderText" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RequirementTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "COI" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "producer" TEXT,
    "insuredName" TEXT NOT NULL,
    "generalLiabLimit" INTEGER,
    "autoLiabLimit" INTEGER,
    "workersComp" BOOLEAN,
    "umbrellaLimit" INTEGER,
    "additionalInsured" BOOLEAN,
    "waiverOfSubrogation" BOOLEAN,
    "certificateHolder" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "expirationDate" TIMESTAMP(3) NOT NULL,
    "status" "COIStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "COI_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "COIFile" (
    "id" TEXT NOT NULL,
    "coiId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" "FileKind" NOT NULL,

    CONSTRAINT "COIFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoiRequest" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoiRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementTemplate_buildingId_active_key" ON "RequirementTemplate"("buildingId", "active");

-- CreateIndex
CREATE INDEX "COI_buildingId_status_idx" ON "COI"("buildingId", "status");

-- CreateIndex
CREATE INDEX "COI_expirationDate_idx" ON "COI"("expirationDate");

-- CreateIndex
CREATE UNIQUE INDEX "CoiRequest_token_key" ON "CoiRequest"("token");

-- CreateIndex
CREATE INDEX "CoiRequest_buildingId_vendorId_idx" ON "CoiRequest"("buildingId", "vendorId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementTemplate" ADD CONSTRAINT "RequirementTemplate_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "COI" ADD CONSTRAINT "COI_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "COI" ADD CONSTRAINT "COI_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "COIFile" ADD CONSTRAINT "COIFile_coiId_fkey" FOREIGN KEY ("coiId") REFERENCES "COI"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoiRequest" ADD CONSTRAINT "CoiRequest_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoiRequest" ADD CONSTRAINT "CoiRequest_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
