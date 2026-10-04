-- AlterTable
ALTER TABLE "reorders" ADD COLUMN     "receivedAt" TIMESTAMP(3),
ADD COLUMN     "receivedUnitCost" DECIMAL(12,2);
