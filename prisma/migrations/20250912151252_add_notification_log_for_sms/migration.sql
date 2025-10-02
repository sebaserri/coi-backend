-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "coiId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_coiId_kind_tag_key" ON "NotificationLog"("coiId", "kind", "tag");
