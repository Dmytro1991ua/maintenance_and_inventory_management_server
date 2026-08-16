-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "afterPhotoUrl" TEXT,
ADD COLUMN     "beforePhotoUrl" TEXT,
ADD COLUMN     "category" "InventoryCategory";

-- CreateTable
CREATE TABLE "checklist_templates" (
    "id" TEXT NOT NULL,
    "category" "InventoryCategory" NOT NULL,
    "items" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_part_usages" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_part_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "checklist_templates_category_key" ON "checklist_templates"("category");

-- AddForeignKey
ALTER TABLE "task_part_usages" ADD CONSTRAINT "task_part_usages_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_part_usages" ADD CONSTRAINT "task_part_usages_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
