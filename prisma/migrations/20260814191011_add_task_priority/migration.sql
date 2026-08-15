-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM';
