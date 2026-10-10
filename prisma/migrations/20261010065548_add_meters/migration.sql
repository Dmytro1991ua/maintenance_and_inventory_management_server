-- CreateTable
CREATE TABLE "meters" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "currentReading" INTEGER NOT NULL,
    "lastReadingAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meter_readings" (
    "id" TEXT NOT NULL,
    "meterId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedBy" TEXT,

    CONSTRAINT "meter_readings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meters_assetId_name_key" ON "meters"("assetId", "name");

-- CreateIndex
CREATE INDEX "meter_readings_meterId_recordedAt_idx" ON "meter_readings"("meterId", "recordedAt");

-- AddForeignKey
ALTER TABLE "meters" ADD CONSTRAINT "meters_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "meters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
