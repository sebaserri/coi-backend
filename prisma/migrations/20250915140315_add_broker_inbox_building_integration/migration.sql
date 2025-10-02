-- CreateTable
CREATE TABLE "BrokerInbox" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT,
    "vendorId" TEXT,
    "buildingId" TEXT,
    "status" TEXT NOT NULL,
    "meta" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrokerInbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildingIntegration" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT,
    "apiKey" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "BuildingIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrokerInbox_source_externalId_idx" ON "BrokerInbox"("source", "externalId");
