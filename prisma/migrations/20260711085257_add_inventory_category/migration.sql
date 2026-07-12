/*
  Warnings:

  - Added the required column `category` to the `inventory_items` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "InventoryCategory" AS ENUM ('ELECTRICAL', 'PLUMBING', 'HVAC', 'TOOLS', 'FASTENERS', 'CHEMICALS', 'SAFETY', 'BUILDING_MATERIALS');

-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN     "category" "InventoryCategory" NOT NULL;
