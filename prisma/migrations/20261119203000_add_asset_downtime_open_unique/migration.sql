-- At most one ongoing downtime per asset. Prisma cannot express a partial index in the schema.
CREATE UNIQUE INDEX "asset_downtimes_assetId_open_key" ON "asset_downtimes"("assetId") WHERE "endedAt" IS NULL;
