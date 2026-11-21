-- Assets already DOWN get an open breakdown, started when they were last updated.
INSERT INTO "asset_downtimes" ("id", "assetId", "reason", "startedAt")
SELECT gen_random_uuid()::text, a."id", 'BREAKDOWN', a."updatedAt"
FROM "assets" a
WHERE a."status" = 'DOWN'
  AND NOT EXISTS (
    SELECT 1 FROM "asset_downtimes" d WHERE d."assetId" = a."id" AND d."endedAt" IS NULL
  );
